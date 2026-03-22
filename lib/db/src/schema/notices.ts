import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const noticesTable = pgTable("notices", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(),
  tower: text("tower").notNull().default("All"),
  isPinned: boolean("is_pinned").notNull().default(false),
  postedBy: text("posted_by").notNull(),
  flatNumber: text("flat_number"),         // e.g. "1203" — for resident accountability
  archivedAt: timestamp("archived_at"),   // Null = active, set = archived
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNoticeSchema = createInsertSchema(noticesTable).omit({
  id: true, createdAt: true, archivedAt: true,
});
export type InsertNotice = z.infer<typeof insertNoticeSchema>;
export type Notice = typeof noticesTable.$inferSelect;
