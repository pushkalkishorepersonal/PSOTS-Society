import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const residentsTable = pgTable("residents", {
  id: serial("id").primaryKey(),
  telegramUserId: text("telegram_user_id").unique(),
  telegramUsername: text("telegram_username"),
  name: text("name").notNull(),
  flatNumber: text("flat_number"),
  tower: text("tower"),
  phone: text("phone").unique(),
  email: text("email").unique(),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertResidentSchema = createInsertSchema(residentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertResident = z.infer<typeof insertResidentSchema>;
export type Resident = typeof residentsTable.$inferSelect;
