import { Router, type IRouter } from "express";
import { db, noticesTable, insertNoticeSchema, auditLogsTable } from "@workspace/db";
import { eq, desc, isNull, isNotNull } from "drizzle-orm";
import { postRateLimiter } from "../middlewares/rateLimiter";
import { requireAuth } from "../middlewares/requireAuth";

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

// Requires login (any resident). Pinning requires committee or admin.
router.post("/notices", postRateLimiter, requireAuth("resident"), async (req, res) => {
  const parsed = insertNoticeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }

  const data = parsed.data;

  // Only committee/admin may pin notices
  const userLevel = req.user!.role === "admin" ? 3 : req.user!.role === "committee" ? 2 : 1;
  if (data.isPinned && userLevel < 2) {
    res.status(403).json({ error: "Only committee members and admins can pin notices." });
    return;
  }

  const [notice] = await db.insert(noticesTable).values(data).returning();

  await db.insert(auditLogsTable).values({
    action: "create",
    entityType: "notice",
    entityId: notice.id,
    userId: String(req.user!.sub),
    metadata: { postedBy: data.postedBy, flatNumber: data.flatNumber },
  });

  res.status(201).json(notice);
});

export default router;
