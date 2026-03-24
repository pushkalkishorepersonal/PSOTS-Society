import { Router, type IRouter } from "express";
import { db, eventsTable, insertEventSchema } from "@workspace/db";
import { eq, desc, gte, lt } from "drizzle-orm";
import { postRateLimiter } from "../middlewares/rateLimiter";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/events", async (req, res) => {
  const { upcoming } = req.query;
  const now = new Date();

  let events;
  if (upcoming === "true") {
    events = await db.select().from(eventsTable)
      .where(gte(eventsTable.eventDate, now))
      .orderBy(eventsTable.eventDate);
  } else if (upcoming === "false") {
    events = await db.select().from(eventsTable)
      .where(lt(eventsTable.eventDate, now))
      .orderBy(desc(eventsTable.eventDate));
  } else {
    events = await db.select().from(eventsTable).orderBy(desc(eventsTable.eventDate));
  }

  res.json(events);
});

router.get("/events/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id));
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  res.json(event);
});

router.post("/events", postRateLimiter, async (req, res) => {
  const parsed = insertEventSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const [event] = await db.insert(eventsTable).values(parsed.data).returning();
  res.status(201).json(event);
});

router.post("/events/:id/rsvp", async (req, res) => {
  const id = Number(req.params.id);
  const [event] = await db
    .update(eventsTable)
    .set({ rsvpCount: sql`${eventsTable.rsvpCount} + 1` })
    .where(eq(eventsTable.id, id))
    .returning();
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  res.json(event);
});

export default router;
