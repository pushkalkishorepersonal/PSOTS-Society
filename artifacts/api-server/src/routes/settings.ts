import { Router, type IRouter } from "express";
import { db, settingsTable, auditLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/settings", async (_req, res) => {
  const settings = await db.select().from(settingsTable);
  // Never expose community_pin value via API (kept for backward compat during transition)
  const safe = settings.map((s) =>
    s.key === "community_pin" ? { ...s, value: s.value ? "***" : "" } : s
  );
  res.json(safe);
});

router.patch("/settings/:key", requireAuth("admin"), async (req, res) => {
  const { key } = req.params;
  const parsed = z.object({ value: z.string() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }

  const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  if (!existing) { res.status(404).json({ error: "Setting not found" }); return; }

  const [updated] = await db
    .update(settingsTable)
    .set({ value: parsed.data.value, updatedAt: new Date() })
    .where(eq(settingsTable.key, key))
    .returning();

  await db.insert(auditLogsTable).values({
    action: "update",
    entityType: "setting",
    entityId: existing.id,
    userId: String(req.user!.sub),
    changes: {
      before: key === "community_pin" ? "***" : existing.value,
      after: key === "community_pin" ? "***" : parsed.data.value,
    },
    metadata: { key },
  });

  res.json(key === "community_pin" ? { ...updated, value: "***" } : updated);
});

export default router;
