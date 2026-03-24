import { Router, type IRouter } from "express";
import { db, noticesTable, insertNoticeSchema, settingsTable, auditLogsTable, SETTING_KEYS } from "@workspace/db";
import { eq, desc, isNull, isNotNull } from "drizzle-orm";
import { postRateLimiter } from "../middlewares/rateLimiter";

const router: IRouter = Router();

async function getCommunityPin(): Promise<string> {
  // Env var takes precedence over DB setting
  if (process.env.COMMUNITY_PIN) return process.env.COMMUNITY_PIN;
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, SETTING_KEYS.COMMUNITY_PIN));
  return row?.value ?? "";
}

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

  const pin = await getCommunityPin();
  if (!pin) {
    res.status(503).json({ error: "Community access code not configured. Contact the Society Office." });
    return;
  }
  if (!communityPin || communityPin.trim() !== pin) {
    res.status(403).json({ error: "Invalid community access code. Please use the code shared by the Society Office." });
    return;
  }

  const parsed = insertNoticeSchema.safeParse(rest);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }

  const [notice] = await db.insert(noticesTable).values(parsed.data).returning();

  await db.insert(auditLogsTable).values({
    action: "create",
    entityType: "notice",
    entityId: notice.id,
    metadata: { postedBy: parsed.data.postedBy, flatNumber: parsed.data.flatNumber },
  });

  res.status(201).json(notice);
});

export default router;
