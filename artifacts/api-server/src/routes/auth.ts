import { Router, type IRouter } from "express";
import { db, residentsTable, magicLinkTokensTable } from "@workspace/db";
import { and, eq, gt, isNull } from "drizzle-orm";
import { randomUUID, createHash, createHmac } from "crypto";
import { z } from "zod/v4";
import { signJwt } from "../lib/jwt";
import { sendMagicLink } from "../lib/mailer";

// Short-lived CSRF state store for Google OAuth (in-memory, per-instance)
const oauthStates = new Map<string, number>();

const router: IRouter = Router();

const requestSchema = z.object({
  email: z.string().email("Valid email required"),
  flatNumber: z.string().min(1, "Flat number required"),
});

// POST /auth/request — send a magic link to the resident's email
router.post("/auth/request", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  const { email, flatNumber } = parsed.data;

  const [resident] = await db
    .select()
    .from(residentsTable)
    .where(
      and(
        eq(residentsTable.email, email.toLowerCase()),
        eq(residentsTable.flatNumber, flatNumber),
      ),
    );

  // Always return the same message to prevent resident enumeration
  const ok = {
    ok: true,
    message:
      "If your email and flat number match our records, a login link has been sent. Check your inbox (and spam folder).",
  };

  if (!resident) {
    await new Promise((r) => setTimeout(r, 300)); // prevent timing attacks
    res.json(ok);
    return;
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await db.insert(magicLinkTokensTable).values({
    email: email.toLowerCase(),
    token,
    residentId: resident.id,
    expiresAt,
  });

  await sendMagicLink(email, resident.name, token);
  res.json(ok);
});

// GET /auth/verify?token=xxx — exchange magic link token for a JWT
router.get("/auth/verify", async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Token required" });
    return;
  }

  const [row] = await db
    .select()
    .from(magicLinkTokensTable)
    .where(
      and(
        eq(magicLinkTokensTable.token, token),
        gt(magicLinkTokensTable.expiresAt, new Date()),
        isNull(magicLinkTokensTable.usedAt),
      ),
    );

  if (!row) {
    res
      .status(400)
      .json({ error: "This login link is invalid or has expired. Please request a new one." });
    return;
  }

  // Mark token as used (one-time)
  await db
    .update(magicLinkTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(magicLinkTokensTable.id, row.id));

  const [resident] = await db
    .select()
    .from(residentsTable)
    .where(eq(residentsTable.id, row.residentId));

  if (!resident) {
    res.status(404).json({ error: "Resident not found" });
    return;
  }

  const jwt = signJwt({
    sub: resident.id,
    role: (resident.role ?? "resident") as "resident" | "committee" | "admin",
    name: resident.name,
    flatNumber: resident.flatNumber ?? null,
    email: resident.email!,
  });

  res.json({
    token: jwt,
    resident: {
      id: resident.id,
      name: resident.name,
      role: resident.role,
      flatNumber: resident.flatNumber,
    },
  });
});

// GET /auth/google — redirect to Google OAuth consent screen
router.get("/auth/google", (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    res.status(503).json({ error: "Google login not configured" });
    return;
  }
  const state = randomUUID();
  oauthStates.set(state, Date.now() + 10 * 60 * 1000); // 10 min expiry

  const appUrl = process.env.APP_URL ?? "http://localhost:5173";
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${appUrl}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// GET /auth/google/callback — exchange code for token, find resident, issue one-time token
router.get("/auth/google/callback", async (req, res) => {
  const appUrl = process.env.APP_URL ?? "http://localhost:5173";
  const { code, state, error } = req.query as Record<string, string>;

  if (error || !code || !state) {
    res.redirect(`${appUrl}/?auth_error=cancelled`);
    return;
  }

  const stateExpiry = oauthStates.get(state);
  if (!stateExpiry || Date.now() > stateExpiry) {
    res.redirect(`${appUrl}/?auth_error=invalid_state`);
    return;
  }
  oauthStates.delete(state);

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${appUrl}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });

    const tokens = (await tokenRes.json()) as { id_token?: string; error?: string };
    if (!tokens.id_token) {
      res.redirect(`${appUrl}/?auth_error=google_failed`);
      return;
    }

    // Decode id_token payload (Google already verified it)
    const idPayload = JSON.parse(
      Buffer.from(tokens.id_token.split(".")[1], "base64url").toString(),
    );
    const email = (idPayload.email as string)?.toLowerCase();

    if (!email) {
      res.redirect(`${appUrl}/?auth_error=no_email`);
      return;
    }

    const [resident] = await db
      .select()
      .from(residentsTable)
      .where(eq(residentsTable.email, email));

    if (!resident) {
      res.redirect(`${appUrl}/?auth_error=not_registered`);
      return;
    }

    // Reuse magic link flow: create a short-lived one-time token
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min
    await db.insert(magicLinkTokensTable).values({
      email,
      token,
      residentId: resident.id,
      expiresAt,
    });

    res.redirect(`${appUrl}/auth/verify?token=${encodeURIComponent(token)}`);
  } catch {
    res.redirect(`${appUrl}/?auth_error=server_error`);
  }
});

// POST /auth/telegram — verify Telegram Login Widget data and issue JWT
router.post("/auth/telegram", async (req, res) => {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    res.status(503).json({ error: "Telegram login not configured" });
    return;
  }

  const { hash, ...authData } = req.body as Record<string, string>;

  if (!hash || !authData.id) {
    res.status(400).json({ error: "Invalid Telegram auth data" });
    return;
  }

  // Verify hash per Telegram docs
  const dataCheckString = Object.entries(authData)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = createHash("sha256").update(process.env.TELEGRAM_BOT_TOKEN).digest();
  const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (expectedHash !== hash) {
    res.status(401).json({ error: "Invalid Telegram authentication" });
    return;
  }

  // Reject stale auth (>1 hour)
  if (Date.now() / 1000 - Number(authData.auth_date) > 3600) {
    res.status(401).json({ error: "Telegram auth expired, please try again" });
    return;
  }

  const telegramId = String(authData.id);
  const [resident] = await db
    .select()
    .from(residentsTable)
    .where(eq(residentsTable.telegramUserId, telegramId));

  if (!resident) {
    res.status(404).json({
      error: "not_registered",
      message: "Your Telegram account is not linked to any resident record. Contact the Society Office.",
    });
    return;
  }

  const jwt = signJwt({
    sub: resident.id,
    role: (resident.role ?? "resident") as "resident" | "committee" | "admin",
    name: resident.name,
    flatNumber: resident.flatNumber ?? null,
    email: resident.email!,
  });

  res.json({ token: jwt });
});

export default router;
