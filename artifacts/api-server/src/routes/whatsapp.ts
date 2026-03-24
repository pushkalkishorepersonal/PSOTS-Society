import { Router, type IRouter } from "express";
import { db, whatsappSubscribersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// List all opted-in subscribers
router.get("/whatsapp/subscribers", async (_req, res) => {
  const subscribers = await db
    .select()
    .from(whatsappSubscribersTable)
    .orderBy(whatsappSubscribersTable.subscribedAt);
  res.json(subscribers);
});

// Add a subscriber
router.post("/whatsapp/subscribers", async (req, res) => {
  const { name, phone } = req.body as { name: string; phone: string };
  if (!name || !phone) {
    res.status(400).json({ error: "name and phone are required" });
    return;
  }

  const normalised = phone.replace(/\s+/g, "").replace(/^0/, "+91");

  try {
    const [row] = await db
      .insert(whatsappSubscribersTable)
      .values({ name, phone: normalised, optedIn: true })
      .onConflictDoUpdate({
        target: whatsappSubscribersTable.phone,
        set: { name, optedIn: true, unsubscribedAt: null },
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "Failed to add WhatsApp subscriber");
    res.status(500).json({ error: "Failed to add subscriber" });
  }
});

// Remove / opt-out a subscriber
router.delete("/whatsapp/subscribers/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  await db
    .update(whatsappSubscribersTable)
    .set({ optedIn: false, unsubscribedAt: new Date() })
    .where(eq(whatsappSubscribersTable.id, id));

  res.status(204).send();
});

// Broadcast a message to all opted-in subscribers via Fonnte (committee+ only)
router.post("/whatsapp/broadcast", requireAuth("committee"), async (req, res) => {
  const { message } = req.body as { message: string };
  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const token = process.env.FONNTE_TOKEN;
  if (!token) {
    res.status(503).json({ error: "FONNTE_TOKEN not configured" });
    return;
  }

  const subscribers = await db
    .select()
    .from(whatsappSubscribersTable)
    .where(eq(whatsappSubscribersTable.optedIn, true));

  if (subscribers.length === 0) {
    res.status(200).json({ sent: 0, message: "No opted-in subscribers" });
    return;
  }

  const targets = subscribers.map((s) => s.phone).join(",");

  try {
    const response = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ target: targets, message, delay: "2" }),
    });

    const data = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      logger.error({ data }, "Fonnte API error");
      res.status(502).json({ error: "Fonnte API error", detail: data });
      return;
    }

    logger.info({ sent: subscribers.length }, "WhatsApp broadcast sent via Fonnte");
    res.json({ sent: subscribers.length, fonnte: data });
  } catch (err) {
    logger.error({ err }, "Failed to reach Fonnte API");
    res.status(502).json({ error: "Failed to reach Fonnte API" });
  }
});

export default router;
