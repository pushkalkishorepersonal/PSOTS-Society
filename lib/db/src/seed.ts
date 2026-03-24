/**
 * Seed script — run once to populate initial reference data.
 * Safe to re-run: uses onConflictDoNothing() throughout.
 *
 * Usage: DATABASE_URL=... npx tsx src/seed.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import {
  settingsTable,
  towersTable,
  contactsTable,
  moderationKeywordsTable,
  moderationPatternsTable,
  whitelistedDomainsTable,
  configPresetsTable,
  SETTING_KEYS,
} from "./schema";
import {
  DEFAULT_GENERAL_CONFIG,
  DEFAULT_MARKETPLACE_CONFIG,
  DEFAULT_ANNOUNCEMENTS_CONFIG,
} from "./schema/bot";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

// ─── Settings ─────────────────────────────────────────────────────────────────
const SETTINGS = [
  { key: SETTING_KEYS.LISTING_EXPIRY_DAYS,        value: "30",    description: "Days until a marketplace listing auto-expires" },
  { key: SETTING_KEYS.NOTICE_ARCHIVE_DAYS,        value: "60",    description: "Days until a non-pinned notice is auto-archived" },
  { key: SETTING_KEYS.FLOOD_WINDOW_MS,            value: "30000", description: "Sliding window (ms) for flood detection in Telegram bot" },
  { key: SETTING_KEYS.FLOOD_MAX_MESSAGES,         value: "5",     description: "Max messages allowed inside the flood window before action" },
  { key: SETTING_KEYS.STRIKE_THRESHOLD_BEFORE_MUTE, value: "3",  description: "Hard-violation strikes before a user is muted" },
  { key: SETTING_KEYS.MUTE_DURATION_SECONDS,      value: "3600",  description: "Duration of bot-issued mute in seconds (3600 = 1 hour)" },
  { key: SETTING_KEYS.COMMUNITY_PIN,              value: "",      description: "Community access code required to post notices (set via env in prod)" },
];

// ─── Towers ───────────────────────────────────────────────────────────────────
const TOWERS = [
  "Tower 1", "Tower 2", "Tower 3", "Tower 4", "Tower 5",
  "Tower 8", "Tower 9", "Tower 10", "Tower 11", "Tower 12",
  "Tower 14", "Tower 15", "Tower 16", "Tower 17",
];

// ─── Emergency Contacts ───────────────────────────────────────────────────────
const CONTACTS = [
  { name: "Security Gate",         role: "Security",         phone: "+91 80 0000 0001", available: "24/7" },
  { name: "Fire Emergency",        role: "Fire Safety",      phone: "101",              available: "24/7" },
  { name: "Ambulance",             role: "Medical",          phone: "108",              available: "24/7" },
  { name: "Society Office",        role: "Administration",   phone: "+91 80 0000 0002", available: "Mon-Sat 9am-6pm" },
  { name: "Maintenance Helpdesk",  role: "Maintenance",      phone: "+91 80 0000 0003", available: "Mon-Sat 8am-8pm" },
  { name: "Plumber On-call",       role: "Plumbing",         phone: "+91 80 0000 0004", available: "Mon-Sat 8am-8pm" },
  { name: "Electrician On-call",   role: "Electrical",       phone: "+91 80 0000 0005", available: "Mon-Sat 8am-8pm" },
];

// ─── Moderation keywords ──────────────────────────────────────────────────────
const FOUL_WORDS = [
  "fuck","shit","bitch","asshole","bastard","cunt","dick","pussy","cock","whore",
  "slut","nigger","faggot","motherfucker","idiot","stupid","moron","loser","dumbass",
  "retard","imbecile","jackass","dipshit","prick","twat",
  "madarchod","behenchod","bhosdike","chutiya","chutiye","randi","haramzada",
  "gaandu","bkl","bc","mc","mf","maderchod","bhosdi","loda","lund","lavda",
  "harami","kamina","kuttiya","kutte","saala","sala","bakwaas","bakwas",
  "gadha","ullu","andha","gandu","chod","teri maa","teri behen",
  "sale kamine","haramkhor","namard","napunsak",
  "thika","tunne","sule","hogli","nayi","myskin","siggilla","ninna amma",
  "ninna akka","ooru bidappa","hodi","bidi","ninage gottilla",
  "poda","ommala","pundek","sunni","otha",
];

const PERSONAL_ATTACK_PHRASES = [
  "you are stupid","you're stupid","ur stupid","you idiot","shut up","get lost",
  "go away","you fool","what a fool","you are useless","pathetic person",
  "mind your business","none of your business","who are you to","stay in your lane",
  "you don't know anything","you know nothing","stop talking","keep quiet",
  "you are shameless","bloody fool","go to hell","drop dead","you are a liar",
  "you are a fraud","stop interfering","not your problem","butt out",
  "back off","shut your mouth","you are toxic","you are a problem",
  "tu kya samjhta hai","apna kaam kar","teri aukat kya hai","besharam",
  "tere ko kya","naalyak","nalayak","bekaar","ghatiya","neech",
];

const AD_KEYWORDS = [
  "earn money","work from home","make money online","investment opportunity",
  "guaranteed returns","join my team","mlm","network marketing",
  "limited offer","hurry up","act now","free gift","win prize","lucky draw",
  "loan offer","credit card offer","insurance plan","mutual fund","real estate deal",
  "contact for price","dm for details","whatsapp for details","call for price",
  "best price guaranteed","discount offer","cashback offer","referral bonus",
  "business opportunity","passive income","financial freedom","double your money",
  "no investment required","work 2 hours a day","be your own boss",
  "register now","sign up for free","click the link","follow the link",
  "call now","call me for","text me for","message me for","ping me",
  "property for sale","flat for sale","flat for rent","apartment for rent",
  "pg available","room available for rent","house for rent",
  "interior designer","carpenter available","painting service","cleaning service",
  "maid available","cook available","driver available","security guard",
  "pest control","plumber available","electrician available","ac service",
];

const POLITICAL_KEYWORDS = [
  "bjp","congress","aap","modi","rahul gandhi","kejriwal","election","vote for",
  "political party","manifesto","parliament","government policy","ruling party",
  "opposition","mla","mp candidat","propaganda","jai shri ram","pakistan zindabad",
  "bharat mata","anti national","urban naxal","liberal","woke",
  "hindu rashtra","secular","reservation politics","caste vote","communal politics",
  "godi media","presstitutes","bhakt","libtard",
];

const RELIGIOUS_KEYWORDS = [
  "religion is","muslims are","hindus are","christians are","sikhs are",
  "islam is","hinduism is","temple vs","mosque vs","church vs",
  "cow slaughter","beef ban","halal","haram","kafir","jihad",
  "mandir wahi banayenge","love jihad","religious conversion","communal riot",
  "minority appeasement","majority community","religious superiority",
];

const SENSITIVE_TOPICS = [
  "pet owners","non-pet owners","dog owners should","cat owners should",
  "pets in lift","pets in elevator","pets in common area","ban pets",
  "communal issue","caste discrimination","north indian","south indian",
  "outsiders in bangalore","locals vs outsiders","language issue",
  "marathi vs","kannada vs","hindi imposition","anti kannada","anti hindi",
  "north south divide","migrant workers","bhaiyya","madrasi",
];

const SOCIAL_PHRASES = [
  "happy birthday","hbd","wish you","many happy returns","congratulations","congrats",
  "well done","good morning","good evening","good night","gm everyone","gn everyone",
  "happy diwali","happy holi","happy new year","happy anniversary","happy wedding",
  "best wishes","advance wishes","have a great","have a wonderful",
  "subah ki","शुभ प्रभात","goodnight all","morning all","evening all",
];

const THREAT_PATTERNS = [
  "will report you","will file complaint","lodge complaint against you",
  "see you in court","drag you to court","take legal action","teach you a lesson",
  "you will regret","you'll regret","i will make your life","maza chakha dunga",
  "dekh lena","dekh lunga","kaafi dekha hai",
];

type KeywordRow = { category: string; keyword: string };

function toRows(category: string, items: string[]): KeywordRow[] {
  return items.map((keyword) => ({ category, keyword }));
}

const ALL_KEYWORDS: KeywordRow[] = [
  ...toRows("foul", FOUL_WORDS),
  ...toRows("personal_attack", PERSONAL_ATTACK_PHRASES),
  ...toRows("ad", AD_KEYWORDS),
  ...toRows("political", POLITICAL_KEYWORDS),
  ...toRows("religious", RELIGIOUS_KEYWORDS),
  ...toRows("communal", SENSITIVE_TOPICS),
  ...toRows("threat", THREAT_PATTERNS),
  ...toRows("social", SOCIAL_PHRASES),
];

// ─── Moderation patterns (regex) ─────────────────────────────────────────────
const MODERATION_PATTERNS = [
  {
    name: "phone",
    pattern: "(?:^|\\s)(?:\\+?91[-.\\s]?)?[6-9]\\d{9}(?:\\s|$)",
    flags: "m",
  },
  {
    name: "price_inline",
    pattern: "(?:₹|rs\\.?|inr)\\s*[\\d,]+|[\\d,]+\\s*(?:₹|rs|rupees)",
    flags: "i",
  },
  {
    name: "promo_link",
    pattern: "(?:t\\.me\\/(?!psots_telegram_bot)[a-zA-Z0-9_+]+|wa\\.me\\/|chat\\.whatsapp\\.com\\/|whatsapp\\.com\\/channel)",
    flags: "i",
  },
  {
    name: "external_link",
    pattern: "https?:\\/\\/(?!(?:psots\\.in|t\\.me\\/psots_telegram_bot|youtube\\.com|youtu\\.be|maps\\.google\\.com|goo\\.gl\\/maps))[^\\s]+",
    flags: "gi",
  },
];

// ─── Whitelisted domains ──────────────────────────────────────────────────────
const WHITELISTED_DOMAINS = [
  { domain: "psots.in",            reason: "Official society website" },
  { domain: "t.me/psots_telegram_bot", reason: "Official society Telegram bot" },
  { domain: "youtube.com",         reason: "Public video platform" },
  { domain: "youtu.be",            reason: "YouTube short links" },
  { domain: "maps.google.com",     reason: "Google Maps locations" },
  { domain: "goo.gl/maps",         reason: "Google Maps short links" },
];

// ─── Config presets ───────────────────────────────────────────────────────────
const CONFIG_PRESETS = [
  {
    name: "general",
    description: "Standard community group — full moderation enabled",
    config: DEFAULT_GENERAL_CONFIG,
  },
  {
    name: "marketplace",
    description: "Marketplace group — ads and links allowed, foul language still blocked",
    config: DEFAULT_MARKETPLACE_CONFIG,
  },
  {
    name: "announcements",
    description: "Announcements-only group — no user posts, bot-only",
    config: DEFAULT_ANNOUNCEMENTS_CONFIG,
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  console.log("Seeding settings…");
  await db.insert(settingsTable).values(SETTINGS).onConflictDoNothing();

  console.log("Seeding towers…");
  await db.insert(towersTable)
    .values(TOWERS.map((name) => ({ name })))
    .onConflictDoNothing();

  console.log("Seeding contacts…");
  await db.insert(contactsTable).values(CONTACTS).onConflictDoNothing();

  console.log("Seeding moderation keywords…");
  // Insert in batches to avoid parameter limits
  const BATCH = 50;
  for (let i = 0; i < ALL_KEYWORDS.length; i += BATCH) {
    await db.insert(moderationKeywordsTable)
      .values(ALL_KEYWORDS.slice(i, i + BATCH))
      .onConflictDoNothing();
  }

  console.log("Seeding moderation patterns…");
  await db.insert(moderationPatternsTable).values(MODERATION_PATTERNS).onConflictDoNothing();

  console.log("Seeding whitelisted domains…");
  await db.insert(whitelistedDomainsTable).values(WHITELISTED_DOMAINS).onConflictDoNothing();

  console.log("Seeding config presets…");
  await db.insert(configPresetsTable)
    .values(CONFIG_PRESETS.map((p) => ({ ...p, config: p.config as Record<string, unknown> })))
    .onConflictDoNothing();

  console.log("Seed complete.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
