import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  location: text("location").notNull(),
  eventDate: timestamp("event_date").notNull(),
  endDate: timestamp("end_date"),
  organizer: text("organizer").notNull(),
  rsvpCount: integer("rsvp_count").notNull().default(0),
  imageUrl: text("image_url"),          // Optional cover photo URL
  isFeatured: boolean("is_featured").notNull().default(false), // Pinned to Festival Spotlight
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

const coerceDate = z.union([z.date(), z.string().transform((s) => new Date(s))]);

export const insertEventSchema = createInsertSchema(eventsTable, {
  eventDate: coerceDate,
  endDate: coerceDate.nullable().optional(),
}).omit({ id: true, createdAt: true, rsvpCount: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
