import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const whatsappSubscribersTable = pgTable("whatsapp_subscribers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  optedIn: boolean("opted_in").notNull().default(true),
  subscribedAt: timestamp("subscribed_at").notNull().defaultNow(),
  unsubscribedAt: timestamp("unsubscribed_at"),
});

export const insertWhatsappSubscriberSchema = createInsertSchema(whatsappSubscribersTable).omit({
  id: true,
  subscribedAt: true,
  unsubscribedAt: true,
});

export type InsertWhatsappSubscriber = z.infer<typeof insertWhatsappSubscriberSchema>;
export type WhatsappSubscriber = typeof whatsappSubscribersTable.$inferSelect;
