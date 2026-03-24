import { pgTable, text, serial, boolean, timestamp, jsonb, unique } from "drizzle-orm/pg-core";

// Individual keywords/phrases used for moderation
export const moderationKeywordsTable = pgTable("moderation_keywords", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(), // foul | personal_attack | ad | political | religious | communal | threat | social | listing_signal
  keyword: text("keyword").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [unique("moderation_keyword_unique").on(t.category, t.keyword)]);

// Regex patterns (phone detection, promo links, etc.)
export const moderationPatternsTable = pgTable("moderation_patterns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // phone | price_inline | promo_link | external_link | caps
  pattern: text("pattern").notNull(), // regex string
  flags: text("flags").notNull().default("i"), // regex flags
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Domains allowed through the external link filter
export const whitelistedDomainsTable = pgTable("whitelisted_domains", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull().unique(),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Named group moderation config presets
export const configPresetsTable = pgTable("config_presets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // general | marketplace | announcements
  config: jsonb("config").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ModerationKeyword = typeof moderationKeywordsTable.$inferSelect;
export type ModerationPattern = typeof moderationPatternsTable.$inferSelect;
export type WhitelistedDomain = typeof whitelistedDomainsTable.$inferSelect;
export type ConfigPreset = typeof configPresetsTable.$inferSelect;
