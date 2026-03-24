import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { residentsTable } from "./residents";

export const magicLinkTokensTable = pgTable("magic_link_tokens", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  residentId: integer("resident_id")
    .notNull()
    .references(() => residentsTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type MagicLinkToken = typeof magicLinkTokensTable.$inferSelect;
