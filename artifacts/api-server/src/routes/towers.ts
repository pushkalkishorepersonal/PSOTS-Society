import { Router, type IRouter } from "express";
import { db, towersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { postRateLimiter } from "../middlewares/rateLimiter";

const router: IRouter = Router();

router.get("/towers", async (_req, res) => {
  const towers = await db.select().from(towersTable).where(eq(towersTable.isActive, true));
  res.json(towers);
});

router.post("/towers", postRateLimiter, async (req, res) => {
  const parsed = z.object({ name: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }

  const [tower] = await db.insert(towersTable).values({ name: parsed.data.name }).returning();
  res.status(201).json(tower);
});

router.delete("/towers/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [tower] = await db.update(towersTable)
    .set({ isActive: false })
    .where(eq(towersTable.id, id))
    .returning();
  if (!tower) { res.status(404).json({ error: "Tower not found" }); return; }
  res.json(tower);
});

export default router;
