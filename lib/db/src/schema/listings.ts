import { pgTable, text, serial, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const listingsTable = pgTable("listings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }),
  type: text("type").notNull(), // sell | buy | rent | free
  category: text("category").notNull(),
  tower: text("tower").notNull(),
  contactName: text("contact_name").notNull(),
  contactPhone: text("contact_phone"),
  isActive: boolean("is_active").notNull().default(true),
  status: text("status").notNull().default("active"), // active | sold | closed | expired
  flatNumber: text("flat_number"),                     // e.g. "1203" — for resident accountability
  telegramUserId: text("telegram_user_id"),            // Telegram user ID for ownership
  telegramUsername: text("telegram_username"),
  expiresAt: timestamp("expires_at"),                  // Auto-set to 30 days from creation
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertListingSchema = createInsertSchema(listingsTable).omit({
  id: true, createdAt: true, isActive: true, status: true,
});
export type InsertListing = z.infer<typeof insertListingSchema>;
export type Listing = typeof listingsTable.$inferSelect;
