import { pgTable, text, serial, integer, timestamp, jsonb, unique } from "drizzle-orm/pg-core";

export interface GroupConfig {
  preset: string;
  modAds: boolean;
  modForwards: boolean;
  modLinks: boolean;
  modSocial: boolean;
  modPolitical: boolean;
  modReligious: boolean;
  modCommunal: boolean;
  modFlood: boolean;
  modCaps: boolean;
  modFoul: boolean;
  modPersonal: boolean;
  modThreats: boolean;
  cmdNotice: boolean;
  cmdEvent: boolean;
  cmdSell: boolean;
  announceOnly: boolean;
}

export const DEFAULT_GENERAL_CONFIG: GroupConfig = {
  preset: "general",
  modAds: true,
  modForwards: true,
  modLinks: true,
  modSocial: true,
  modPolitical: true,
  modReligious: true,
  modCommunal: true,
  modFlood: true,
  modCaps: true,
  modFoul: true,
  modPersonal: true,
  modThreats: true,
  cmdNotice: true,
  cmdEvent: true,
  cmdSell: true,
  announceOnly: false,
};

export const DEFAULT_MARKETPLACE_CONFIG: GroupConfig = {
  preset: "marketplace",
  modAds: false,
  modForwards: true,
  modLinks: false,
  modSocial: false,
  modPolitical: true,
  modReligious: true,
  modCommunal: false,
  modFlood: true,
  modCaps: false,
  modFoul: true,
  modPersonal: true,
  modThreats: true,
  cmdNotice: false,
  cmdEvent: false,
  cmdSell: true,
  announceOnly: false,
};

export const DEFAULT_ANNOUNCEMENTS_CONFIG: GroupConfig = {
  preset: "announcements",
  modAds: false,
  modForwards: false,
  modLinks: false,
  modSocial: false,
  modPolitical: false,
  modReligious: false,
  modCommunal: false,
  modFlood: false,
  modCaps: false,
  modFoul: false,
  modPersonal: false,
  modThreats: false,
  cmdNotice: false,
  cmdEvent: false,
  cmdSell: false,
  announceOnly: true,
};

export const botGroupsTable = pgTable("bot_groups", {
  chatId: text("chat_id").primaryKey(),
  name: text("name").notNull().default(""),
  config: jsonb("config").notNull().$type<GroupConfig>().default(DEFAULT_GENERAL_CONFIG),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const botStrikesTable = pgTable("bot_strikes", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  chatId: text("chat_id").notNull(),
  strikes: integer("strikes").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [unique("bot_strikes_chat_user").on(t.chatId, t.userId)]);

export type BotGroup = typeof botGroupsTable.$inferSelect;
export type BotStrike = typeof botStrikesTable.$inferSelect;
