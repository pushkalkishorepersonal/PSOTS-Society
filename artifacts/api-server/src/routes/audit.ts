import { Router, type IRouter } from "express";
import { db, auditLogsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/audit", async (req, res) => {
  const { entityType, limit = "100" } = req.query;

  let rows;
  if (entityType) {
    rows = await db.select().from(auditLogsTable)
      .where(eq(auditLogsTable.entityType, String(entityType)))
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(Number(limit));
  } else {
    rows = await db.select().from(auditLogsTable)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(Number(limit));
  }

  res.json(rows);
});

export default router;
