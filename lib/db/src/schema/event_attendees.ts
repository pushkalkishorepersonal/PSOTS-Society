import { pgTable, text, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";

export const eventAttendeesTable = pgTable("event_attendees", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  flatNumber: text("flat_number"),
  phone: text("phone"),
  telegramUserId: text("telegram_user_id"),
  status: text("status").notNull().default("accepted"), // accepted | declined | tentative
  registeredAt: timestamp("registered_at").notNull().defaultNow(),
}, (t) => [unique("event_attendee_unique").on(t.eventId, t.telegramUserId)]);

export const insertEventAttendeeSchema = createInsertSchema(eventAttendeesTable).omit({ id: true, registeredAt: true });
export type InsertEventAttendee = z.infer<typeof insertEventAttendeeSchema>;
export type EventAttendee = typeof eventAttendeesTable.$inferSelect;
