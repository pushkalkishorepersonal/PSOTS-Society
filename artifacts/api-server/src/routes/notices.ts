import { Router, type IRouter } from "express";
import { db, noticesTable, insertNoticeSchema } from "@workspace/db";
import { eq, desc, isNull, isNotNull } from "drizzle-orm";
import { postRateLimiter } from "../middlewares/rateLimiter";

const COMMUNITY_PIN = process.env.COMMUNITY_PIN ?? "PSOTS2025";

const router: IRouter = Router();

router.get("/notices", async (req, res) => {
  const { tower, category, archived } = req.query;

  const rows = await db
    .select()
    .from(noticesTable)
    .where(archived === "true" ? isNotNull(noticesTable.archivedAt) : isNull(noticesTable.archivedAt))
    .orderBy(desc(noticesTable.isPinned), desc(noticesTable.createdAt));

  const filtered = rows.filter((n) => {
    if (tower && tower !== "All" && n.tower !== "All" && n.tower !== tower) return false;
    if (category && category !== "All" && n.category !== category) return false;
    return true;
  });

  res.json(filtered);
});

router.get("/notices/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [notice] = await db.select().from(noticesTable).where(eq(noticesTable.id, id));
  if (!notice) { res.status(404).json({ error: "Notice not found" }); return; }
  res.json(notice);
});

router.post("/notices", postRateLimiter, async (req, res) => {
  const { communityPin, ...rest } = req.body;

  if (!communityPin || communityPin.trim() !== COMMUNITY_PIN) {
    res.status(403).json({ error: "Invalid community access code. Please use the code shared by the Society Office." });
    return;
  }

  const parsed = insertNoticeSchema.safeParse(rest);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }

  const [notice] = await db.insert(noticesTable).values(parsed.data).returning();
  res.status(201).json(notice);
});

export default router;
