import { Router, type IRouter } from "express";
import { db, eventsTable, insertEventSchema, eventAttendeesTable, insertEventAttendeeSchema, auditLogsTable } from "@workspace/db";
import { eq, desc, gte, lt, sql } from "drizzle-orm";
import { postRateLimiter } from "../middlewares/rateLimiter";

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

router.get("/events/:id/attendees", async (req, res) => {
  const id = Number(req.params.id);
  const attendees = await db.select().from(eventAttendeesTable).where(eq(eventAttendeesTable.eventId, id));
  res.json(attendees);
});

router.post("/events", postRateLimiter, async (req, res) => {
  const parsed = insertEventSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const [event] = await db.insert(eventsTable).values(parsed.data).returning();

  await db.insert(auditLogsTable).values({
    action: "create",
    entityType: "event",
    entityId: event.id,
    metadata: { organizer: parsed.data.organizer },
  });

  res.status(201).json(event);
});

router.post("/events/:id/rsvp", postRateLimiter, async (req, res) => {
  const id = Number(req.params.id);

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id));
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  // Parse attendee info
  const parsed = insertEventAttendeeSchema.safeParse({ ...req.body, eventId: id });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }

  // Upsert attendee record (idempotent if telegramUserId provided)
  let attendee;
  if (parsed.data.telegramUserId) {
    [attendee] = await db.insert(eventAttendeesTable)
      .values(parsed.data)
      .onConflictDoUpdate({
        target: [eventAttendeesTable.eventId, eventAttendeesTable.telegramUserId],
        set: { status: parsed.data.status, name: parsed.data.name },
      })
      .returning();
  } else {
    [attendee] = await db.insert(eventAttendeesTable).values(parsed.data).returning();
  }

  // Keep rsvpCount in sync (count accepted attendees)
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(eventAttendeesTable)
    .where(eq(eventAttendeesTable.eventId, id));

  const [updated] = await db
    .update(eventsTable)
    .set({ rsvpCount: Number(count) })
    .where(eq(eventsTable.id, id))
    .returning();

  await db.insert(auditLogsTable).values({
    action: "rsvp",
    entityType: "event",
    entityId: id,
    metadata: { attendeeId: attendee.id, name: attendee.name, status: attendee.status },
  });

  res.json({ event: updated, attendee });
});

export default router;
