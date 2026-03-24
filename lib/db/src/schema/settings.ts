import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Setting = typeof settingsTable.$inferSelect;

// Typed helper: get a setting value as a number with fallback
export const SETTING_KEYS = {
  LISTING_EXPIRY_DAYS: "listing_expiry_days",
  NOTICE_ARCHIVE_DAYS: "notice_archive_days",
  FLOOD_WINDOW_MS: "flood_window_ms",
  FLOOD_MAX_MESSAGES: "flood_max_messages",
  STRIKE_THRESHOLD_BEFORE_MUTE: "strike_threshold_before_mute",
  MUTE_DURATION_SECONDS: "mute_duration_seconds",
  COMMUNITY_PIN: "community_pin",
} as const;
