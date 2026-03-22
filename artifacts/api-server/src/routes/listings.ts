import { Router, type IRouter } from "express";
import { db, listingsTable, insertListingSchema } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { postRateLimiter } from "../middlewares/rateLimiter";

const router: IRouter = Router();

const EXPIRY_DAYS = 30;

router.get("/listings", async (req, res) => {
  const { category, type, status } = req.query;

  const rows = await db
    .select()
    .from(listingsTable)
    .orderBy(desc(listingsTable.createdAt));

  const filtered = rows.filter((l) => {
    if (status) {
      if (l.status !== status) return false;
    } else {
      // Default: only active listings
      if (!l.isActive || l.status !== "active") return false;
    }
    if (category && l.category !== category) return false;
    if (type && l.type !== type) return false;
    return true;
  });

  res.json(filtered);
});

router.get("/listings/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, id));
  if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }
  res.json(listing);
});

router.post("/listings", postRateLimiter, async (req, res) => {
  const parsed = insertListingSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS);

  const [listing] = await db
    .insert(listingsTable)
    .values({ ...parsed.data, expiresAt, status: "active", isActive: true })
    .returning();

  res.status(201).json(listing);
});

router.patch("/listings/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body as { status: string };

  if (!["active", "sold", "closed"].includes(status)) {
    res.status(400).json({ error: "Invalid status. Use: active | sold | closed" });
    return;
  }

  const isActive = status === "active";
  const [updated] = await db
    .update(listingsTable)
    .set({ status, isActive })
    .where(eq(listingsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Listing not found" }); return; }
  res.json(updated);
});

router.delete("/listings/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.update(listingsTable).set({ isActive: false, status: "closed" }).where(eq(listingsTable.id, id));
  res.status(204).send();
});

export default router;
