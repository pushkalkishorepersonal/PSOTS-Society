import { Router, type IRouter } from "express";
import { db, residentsTable, magicLinkTokensTable } from "@workspace/db";
import { and, eq, gt, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod/v4";
import { signJwt } from "../lib/jwt";
import { sendMagicLink } from "../lib/mailer";

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

export default router;
