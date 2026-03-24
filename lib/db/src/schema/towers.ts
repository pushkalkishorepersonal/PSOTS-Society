import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";

export const towersTable = pgTable("towers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Tower = typeof towersTable.$inferSelect;
