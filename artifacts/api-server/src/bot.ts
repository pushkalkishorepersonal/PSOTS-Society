import TelegramBot from "node-telegram-bot-api";
import { db, noticesTable, eventsTable, listingsTable, botGroupsTable, botStrikesTable } from "@workspace/db";
import {
  DEFAULT_GENERAL_CONFIG,
  DEFAULT_MARKETPLACE_CONFIG,
  DEFAULT_ANNOUNCEMENTS_CONFIG,
  type GroupConfig,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./lib/logger";

const EXPIRY_DAYS = 30;

// ─── Tower config ─────────────────────────────────────────────────────────────
const VALID_TOWERS = [
  "Tower 1","Tower 2","Tower 3","Tower 4","Tower 5",
  "Tower 8","Tower 9","Tower 10","Tower 11","Tower 12",
  "Tower 14","Tower 15","Tower 16","Tower 17",
];

// ═══════════════════════════════════════════════════════════════════════════════
// ███  MODERATION PATTERNS  ███
// ═══════════════════════════════════════════════════════════════════════════════

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
const FOUL_REGEX = new RegExp(`\\b(${FOUL_WORDS.join("|")})\\b`, "i");

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
const PERSONAL_ATTACK_REGEX = new RegExp(
  `(${PERSONAL_ATTACK_PHRASES.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "i"
);

const PHONE_PATTERN = /(?:^|\s)(?:\+?91[-.\s]?)?[6-9]\d{9}(?:\s|$)/m;
const PRICE_INLINE_PATTERN = /(?:₹|rs\.?|inr)\s*[\d,]+|[\d,]+\s*(?:₹|rs|rupees)/i;

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
const AD_REGEX = new RegExp(`(${AD_KEYWORDS.join("|")})`, "i");

const PROMO_LINK_REGEX = /(?:t\.me\/(?!psots_telegram_bot)[a-zA-Z0-9_+]+|wa\.me\/|chat\.whatsapp\.com\/|whatsapp\.com\/channel)/i;
const EXTERNAL_LINK_REGEX = /https?:\/\/(?!(?:psots\.in|t\.me\/psots_telegram_bot|youtube\.com|youtu\.be|maps\.google\.com|goo\.gl\/maps))[^\s]+/gi;

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
const POLITICAL_REGEX = new RegExp(`\\b(${POLITICAL_KEYWORDS.join("|")})\\b`, "i");
const RELIGIOUS_REGEX = new RegExp(`(${RELIGIOUS_KEYWORDS.join("|")})`, "i");

const SENSITIVE_TOPICS = [
  "pet owners","non-pet owners","dog owners should","cat owners should",
  "pets in lift","pets in elevator","pets in common area","ban pets",
  "communal issue","caste discrimination","north indian","south indian",
  "outsiders in bangalore","locals vs outsiders","language issue",
  "marathi vs","kannada vs","hindi imposition","anti kannada","anti hindi",
  "north south divide","migrant workers","bhaiyya","madrasi",
];
const SENSITIVE_REGEX = new RegExp(`(${SENSITIVE_TOPICS.join("|")})`, "i");

const SOCIAL_PHRASES = [
  "happy birthday","hbd","wish you","many happy returns","congratulations","congrats",
  "well done","good morning","good evening","good night","gm everyone","gn everyone",
  "happy diwali","happy holi","happy new year","happy anniversary","happy wedding",
  "best wishes","advance wishes","have a great","have a wonderful",
  "subah ki","शुभ प्रभात","goodnight all","morning all","evening all",
];
const SOCIAL_REGEX = new RegExp(`\\b(${SOCIAL_PHRASES.join("|")})\\b`, "i");

const THREAT_PATTERNS = [
  "will report you","will file complaint","lodge complaint against you",
  "see you in court","drag you to court","take legal action","teach you a lesson",
  "you will regret","you'll regret","i will make your life","maza chakha dunga",
  "dekh lena","dekh lunga","kaafi dekha hai",
];
const THREAT_REGEX = new RegExp(
  `(${THREAT_PATTERNS.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "i"
);

// ─── Marketplace: detect listing-like messages (so off-topic check isn't too aggressive) ──
const LISTING_SIGNAL_REGEX = /(?:sell|selling|sale|available|for sale|rent|renting|buy|buying|looking for|wanted|free|giveaway|give away|₹|rs\.|inr|\d+k\b|offer|price|contact|call|whatsapp|dm me|message me|ping me)/i;

// ─── Informal listing attempt: has price OR listing signals but is NOT a command ─────────
function looksLikeInformalListing(text: string): boolean {
  const hasPrice = /(?:₹|rs\.?|inr)\s*[\d,]+|[\d,]+\s*(?:₹|rs|rupees|\bk\b)/i.test(text);
  const hasItem = /(?:sell|selling|sale|for sale|available|rent|renting|giveaway|give away|free to take|free item)/i.test(text);
  return hasPrice || hasItem;
}

function isPotentialPrivacyBreach(msg: TelegramBot.Message): boolean {
  return !!(msg.photo && msg.forward_from && !msg.forward_from.is_bot);
}
function isForwardedFromChannel(msg: TelegramBot.Message): boolean {
  return !!(msg.forward_from_chat && msg.forward_from_chat.type === "channel");
}
function isForwardedFromExternalGroup(msg: TelegramBot.Message): boolean {
  return !!(msg.forward_from_chat && msg.forward_from_chat.type === "supergroup");
}
function isExcessiveCaps(text: string): boolean {
  if (text.length < 20) return false;
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 10) return false;
  return letters.replace(/[^A-Z]/g, "").length / letters.length > 0.65;
}
function isContextualAd(text: string): boolean {
  return PHONE_PATTERN.test(text) && PRICE_INLINE_PATTERN.test(text);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ███  FLOOD DETECTION  ███
// ═══════════════════════════════════════════════════════════════════════════════
const FLOOD_WINDOW_MS = 30_000;
const FLOOD_MAX_MESSAGES = 5;
const userMessageTimes = new Map<string, number[]>();

function isFlooding(chatId: string, userId: number): boolean {
  const key = `${chatId}:${userId}`;
  const now = Date.now();
  const times = (userMessageTimes.get(key) ?? []).filter(t => now - t < FLOOD_WINDOW_MS);
  times.push(now);
  userMessageTimes.set(key, times);
  return times.length > FLOOD_MAX_MESSAGES;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ███  GROUP CONFIG CACHE  ███
// ═══════════════════════════════════════════════════════════════════════════════
const HARD_WARNINGS_BEFORE_MUTE = 3;
const MUTE_DURATION_SECONDS = 3600;

const groupConfigCache = new Map<string, GroupConfig>();
const strikeCache = new Map<string, number>();

async function getGroupConfig(chatId: string): Promise<GroupConfig> {
  if (groupConfigCache.has(chatId)) return groupConfigCache.get(chatId)!;
  try {
    const [row] = await db.select().from(botGroupsTable).where(eq(botGroupsTable.chatId, chatId));
    const config = (row?.config ?? DEFAULT_GENERAL_CONFIG) as GroupConfig;
    groupConfigCache.set(chatId, config);
    return config;
  } catch {
    return DEFAULT_GENERAL_CONFIG;
  }
}

async function saveGroupConfig(chatId: string, name: string, config: GroupConfig): Promise<void> {
  groupConfigCache.set(chatId, config);
  await db.insert(botGroupsTable)
    .values({ chatId, name, config })
    .onConflictDoUpdate({ target: botGroupsTable.chatId, set: { config, name, updatedAt: new Date() } });
}

async function getStrikes(chatId: string, userId: string): Promise<number> {
  const key = `${chatId}:${userId}`;
  if (strikeCache.has(key)) return strikeCache.get(key)!;
  try {
    const [row] = await db.select().from(botStrikesTable)
      .where(and(eq(botStrikesTable.chatId, chatId), eq(botStrikesTable.userId, userId)));
    const count = row?.strikes ?? 0;
    strikeCache.set(key, count);
    return count;
  } catch {
    return 0;
  }
}

async function setStrikes(chatId: string, userId: string, count: number): Promise<void> {
  const key = `${chatId}:${userId}`;
  strikeCache.set(key, count);
  try {
    await db.insert(botStrikesTable)
      .values({ chatId, userId, strikes: count, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [botStrikesTable.chatId, botStrikesTable.userId],
        set: { strikes: count, updatedAt: new Date() },
      });
  } catch {
    // keep in cache if DB write fails
  }
}

// ─── Per-group /rules text ────────────────────────────────────────────────────
function getRulesText(config: GroupConfig): string {
  if (config.announceOnly) {
    return `📢 *This is a read-only announcements channel.*\n\nOnly admins and the bot post here. For discussions, head to the main residents group.`;
  }
  if (config.preset === "marketplace") {
    return `
🛍️ *PSOTS Marketplace Rules*

✅ *Allowed posts:*
• /sell — item for sale
• /buy — item wanted
• /free — giving something away

🚫 *Not allowed:*
• General chat (use the residents group)
• Abusive language or personal attacks
• Spam / forwarded posts from other groups
• Political or religious content

📌 *How to post:*
\`/sell Title | Price | Tower | Phone | Description\`
\`/buy Title | Tower | Description\`
\`/free Title | Tower | Description\`

All posts go live on *psots.in* ✅
`.trim();
  }
  return `
📋 *PSOTS Group Rules & Etiquettes*

🚫 *Strictly NOT Allowed (message deleted + warning):*
1️⃣ Foul language, abusive or derogatory comments
2️⃣ Personal attacks, bullying, or threatening anyone
3️⃣ Sharing another member's photo without consent
4️⃣ Advertisements in chat — use /sell /buy /free instead
5️⃣ Political content of any kind
6️⃣ Religious debates or divisive content
7️⃣ Communal discussions (pet debates, language issues, etc.)
8️⃣ Forwarded posts from external channels or groups
9️⃣ External promotional links

⚠️ *Avoid (gentle reminder):*
• Birthday/greeting messages (use personal chat)
• Good morning/evening greetings
• Excessive CAPITAL LETTERS

⚡ *Strike System:*
• 3 hard violations = 1 hour mute
• Repeat offenders may be removed

Use */mystatus* to check your strikes. Thank you! 🏢
`.trim();
}

// ─── Per-group /help text ─────────────────────────────────────────────────────
function getHelpText(config: GroupConfig): string {
  if (config.announceOnly) {
    return `📢 *Read-only channel.* Admins post announcements here.\n\nFor the marketplace use /sell /buy /free in the marketplace group.\nVisit *psots.in* for all notices, events and listings.`;
  }
  const lines: string[] = ["🏢 *PSOTS Community Bot*\n"];
  if (config.cmdNotice) {
    lines.push(`*📢 Notice Board*\n\`/notice Title | Your message\`\n_Example:_ /notice Water cut | No water in Tower 3 from 10AM–2PM.\n`);
  }
  if (config.cmdEvent) {
    lines.push(`*📅 Events*\n\`/event Title | DD-Mon-YYYY HH:MM | Venue | Description\`\n_Example:_ /event Holi Party | 25-Mar-2026 18:00 | Clubhouse | Join us!\n`);
  }
  if (config.cmdSell) {
    lines.push(`*🛍️ Sell Something*\n\`/sell Title | Price | Tower | Phone | Description\`\n_Example:_ /sell Old Sofa | 4000 | Tower 8 | 9876543210 | Brown 3-seater.\n`);
    lines.push(`*🔍 Buy / Wanted*\n\`/buy Title | Tower | Description\`\n_Example:_ /buy Cook | Tower 2 | Need breakfast and dinner cook.\n`);
    lines.push(`*🎁 Give Away (Free)*\n\`/free Title | Tower | Description\`\n_Example:_ /free Baby Walker | Tower 5 | Baby outgrown it.\n`);
    lines.push(`*📋 Manage Listings*\n\`/mylistings\` — see your active listings\n\`/sold <id>\` — mark a listing sold\n\`/close <id>\` — remove your listing\n`);
  }
  lines.push(`*ℹ️ Info*\n\`/rules\` — group etiquettes\n\`/mystatus\` — your moderation status\n`);
  lines.push(`All posts appear live on *psots.in* ✅`);
  return lines.join("\n");
}

// ─── Welcome message ──────────────────────────────────────────────────────────
function getWelcomeText(name: string, config: GroupConfig): string {
  if (config.preset === "marketplace") {
    return `👋 *Welcome ${name}!*\n\nThis is the *PSOTS Marketplace* — for buying, selling and giving away items.\n\n• /sell — post an item for sale\n• /buy — post a wanted ad\n• /free — give something away\n\nAll posts go live on *psots.in*. Please keep this group for listings only. For general chat, use the main residents group.`;
  }
  if (config.announceOnly) {
    return `👋 *Welcome ${name}!* This is a read-only announcements channel. Admins and the bot post here. Visit *psots.in* for the full community portal.`;
  }
  return `👋 *Welcome to PSOTS, ${name}!*\n\nYou've joined the community group for *Prestige Song of the South* — home to 2300+ families across 14 towers.\n\n*Quick Links:*\n🌐 psots.in — community portal\n📢 /notice — post announcements\n🛍️ /sell — marketplace listings\n📅 /event — upcoming events\n\nPlease read /rules before posting. Let's keep this group useful and respectful for all residents! 🙏`;
}

// ─── Groupinfo display ────────────────────────────────────────────────────────
function formatGroupInfo(name: string, config: GroupConfig): string {
  const on = "✅";
  const off = "❌";
  const presetLabel = config.preset === "custom"
    ? "Custom"
    : config.preset.charAt(0).toUpperCase() + config.preset.slice(1);

  if (config.announceOnly) {
    return `📋 *Group Config: ${name || "This group"}*\n\nPreset: *${presetLabel}*\nMode: 📢 Read-only announcements channel\n\nAll regular member messages are deleted. Only admins and the bot can post.\n\nChange with: /setup general | /setup marketplace`;
  }

  return `
📋 *Group Config: ${name || "This group"}*
Preset: *${presetLabel}*

*Moderation:*
${on}Foul language / personal attacks / threats (always on)
${config.modAds ? on : off} Ad detection (price + contact in chat)
${config.modForwards ? on : off} Block forwarded posts
${config.modLinks ? on : off} Block external links
${config.modSocial ? on : off} Warn for greetings / social messages
${config.modPolitical ? on : off} Block political content
${config.modReligious ? on : off} Block religious debates
${config.modCommunal ? on : off} Block divisive/communal topics
${config.modFlood ? on : off} Anti-flood (spam) detection
${config.modCaps ? on : off} Warn for ALL-CAPS messages

*Commands allowed:*
${config.cmdNotice ? on : off} /notice — post to Notice Board
${config.cmdEvent ? on : off} /event — post to Events
${config.cmdSell ? on : off} /sell /buy /free — Marketplace

_Admins: use /groupset <rule> on|off to toggle any setting._
_Use /setup general | /setup marketplace | /setup announcements to apply a preset._
`.trim();
}

// ─── Setting name map ─────────────────────────────────────────────────────────
const SETTING_LABELS: Record<string, { key: keyof GroupConfig; label: string }> = {
  ads:       { key: "modAds",       label: "Ad detection" },
  forwards:  { key: "modForwards",  label: "Block forwarded posts" },
  links:     { key: "modLinks",     label: "Block external links" },
  social:    { key: "modSocial",    label: "Warn for greetings/social messages" },
  political: { key: "modPolitical", label: "Block political content" },
  religious: { key: "modReligious", label: "Block religious debates" },
  communal:  { key: "modCommunal",  label: "Block communal/divisive topics" },
  flood:     { key: "modFlood",     label: "Anti-flood detection" },
  caps:      { key: "modCaps",      label: "Warn for ALL-CAPS" },
  "cmd_notice": { key: "cmdNotice", label: "Allow /notice command" },
  "cmd_event":  { key: "cmdEvent",  label: "Allow /event command" },
  "cmd_sell":   { key: "cmdSell",   label: "Allow /sell /buy /free commands" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseParts(text: string, count: number): string[] | null {
  const parts = text.split("|").map((p) => p.trim());
  if (parts.length < count) return null;
  return parts;
}

function parseDate(dateStr: string): Date | null {
  const cleaned = dateStr.trim();
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d;
  const match = cleaned.match(/^(\d{1,2})-([A-Za-z]+)-(\d{4})\s*(\d{1,2}):(\d{2})$/);
  if (match) {
    const months: Record<string, number> = {
      jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11
    };
    const month = months[match[2].toLowerCase().slice(0, 3)];
    if (month !== undefined) {
      return new Date(Number(match[3]), month, Number(match[1]), Number(match[4]), Number(match[5]));
    }
  }
  return null;
}

function normalizeTower(input: string): string {
  const num = input.trim().replace(/tower\s*/i, "").trim();
  const candidate = `Tower ${num}`;
  if (VALID_TOWERS.includes(candidate)) return candidate;
  const directMatch = VALID_TOWERS.find(t => t.toLowerCase() === input.trim().toLowerCase());
  return directMatch ?? "All";
}

function getDisplayName(from: TelegramBot.User): string {
  const name = from.first_name + (from.last_name ? " " + from.last_name : "");
  return from.username ? `${name} (@${from.username})` : name;
}

function getMentionName(from: TelegramBot.User): string {
  return from.username ? `@${from.username}` : `*${from.first_name}*`;
}

// ─── Marketplace listing card ─────────────────────────────────────────────────
function formatListingCard(opts: {
  type: "sell" | "buy" | "free" | "rent";
  id: number;
  title: string;
  price?: number;
  tower: string;
  contactName: string;
  contactPhone?: string;
  username?: string;
  description: string;
  expiryDays: number;
}): string {
  const typeLabel = {
    sell: "🛍️ FOR SALE",
    buy:  "🔍 WANTED",
    free: "🎁 FREE GIVEAWAY",
    rent: "🏠 FOR RENT",
  }[opts.type];

  const priceStr = opts.type === "buy" || opts.type === "free"
    ? ""
    : opts.price
      ? `\n💰 *Price:* ₹${opts.price.toLocaleString("en-IN")}`
      : "\n💰 *Price:* Open to offers";

  const contactStr = opts.username
    ? `\n👤 *Posted by:* @${opts.username}`
    : `\n👤 *Posted by:* ${opts.contactName}`;

  const phoneStr = opts.contactPhone
    ? `\n📞 *Phone:* ${opts.contactPhone}`
    : "";

  const towerStr = opts.tower !== "All" ? `\n📍 *Tower:* ${opts.tower}` : "";

  const divider = "━━━━━━━━━━━━━━━━━━━━━━";

  return (
    `${divider}\n` +
    `${typeLabel}  \\#${opts.id}\n` +
    `${divider}\n\n` +
    `📦 *${opts.title}*\n` +
    `${priceStr}${towerStr}${contactStr}${phoneStr}\n\n` +
    `_${opts.description}_\n\n` +
    `⏳ Expires in ${opts.expiryDays} days · Live on psots\\.in\n` +
    `${divider}\n` +
    `_Manage: /sold ${opts.id} · /close ${opts.id}_`
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ███  MAIN EXPORT  ███
// ═══════════════════════════════════════════════════════════════════════════════
export function startBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — Telegram bot disabled");
    return;
  }

  // Start with polling disabled, clear any lingering session first, then start
  const bot = new TelegramBot(token, { polling: false });

  async function initPolling() {
    try {
      // Tell Telegram to drop any pending updates from old sessions to prevent 409 conflicts
      const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`);
      const data = await res.json() as { ok: boolean };
      if (data.ok) logger.info("Cleared Telegram session and pending updates");
    } catch (err) {
      logger.warn({ err }, "Could not clear Telegram session — continuing anyway");
    }
    // Brief pause to let Telegram release any previous long-poll connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    bot.startPolling({ restart: false });
    logger.info("Telegram bot started with long polling");
  }

  initPolling().catch(err => logger.error({ err }, "Failed to start bot polling"));

  const send = (chatId: number | string, text: string, extra?: TelegramBot.SendMessageOptions) =>
    bot.sendMessage(chatId, text, { parse_mode: "Markdown", ...extra });

  async function isAdmin(chatId: number, userId: number): Promise<boolean> {
    try {
      const member = await bot.getChatMember(chatId, userId);
      return ["administrator", "creator"].includes(member.status);
    } catch {
      return false;
    }
  }

  async function muteUser(chatId: number, userId: number, seconds: number): Promise<boolean> {
    try {
      await bot.restrictChatMember(chatId, userId, {
        permissions: {
          can_send_messages: false,
          can_send_polls: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false,
          can_change_info: false,
          can_invite_users: false,
          can_pin_messages: false,
        },
        until_date: Math.floor(Date.now() / 1000) + seconds,
      });
      return true;
    } catch (err) {
      logger.warn({ err }, "Could not mute user — bot may not have ban permission");
      return false;
    }
  }

  async function deleteMsg(chatId: number, msgId: number): Promise<void> {
    try {
      await bot.deleteMessage(chatId, msgId);
    } catch (err) {
      logger.warn({ err }, "Could not delete message — bot may not be admin");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  MODERATION ENGINE (per-group config aware)
  // ─────────────────────────────────────────────────────────────────────────
  async function moderateMessage(msg: TelegramBot.Message): Promise<void> {
    if (msg.chat.type !== "group" && msg.chat.type !== "supergroup") return;
    const from = msg.from;
    if (!from || from.is_bot) return;

    const chatId = msg.chat.id;
    const chatIdStr = String(chatId);
    const userId = from.id;
    const userIdStr = String(userId);
    const displayName = getDisplayName(from);
    const mention = getMentionName(from);
    const text = msg.text || msg.caption || "";

    const config = await getGroupConfig(chatIdStr);

    // ── Announcements-only: delete everything from non-admins ───────────────
    if (config.announceOnly) {
      if (text.startsWith("/")) return;
      const adminCheck = await isAdmin(chatId, userId);
      if (!adminCheck) {
        await deleteMsg(chatId, msg.message_id);
        await send(chatId,
          `📢 ${mention} — this is a *read-only announcements channel*.\n\nFor discussions please use the main residents group.`
        );
      }
      return;
    }

    if (text.startsWith("/")) return;

    type Severity = "hard" | "soft";
    interface Violation {
      type: string;
      rule: string;
      ruleNumber: string;
      severity: Severity;
    }

    let violation: Violation | null = null;

    // ── Flood (checked before everything else) ─────────────────────────────
    if (config.modFlood && isFlooding(chatIdStr, userId)) {
      violation = { type: "Rapid-fire message flood", rule: "Too many messages too fast disrupts the group.", ruleNumber: "—", severity: "soft" };
    }
    // ── Always-on: foul language ───────────────────────────────────────────
    else if (config.modFoul && FOUL_REGEX.test(text)) {
      violation = { type: "Foul language / derogatory comment", rule: "Abusive or offensive language is strictly prohibited.", ruleNumber: "Rule 1", severity: "hard" };
    }
    // ── Always-on: personal attacks ────────────────────────────────────────
    else if (config.modPersonal && PERSONAL_ATTACK_REGEX.test(text)) {
      violation = { type: "Personal attack / bullying", rule: "Attacking or belittling fellow residents has zero tolerance.", ruleNumber: "Rule 2", severity: "hard" };
    }
    // ── Always-on: threats ─────────────────────────────────────────────────
    else if (config.modThreats && THREAT_REGEX.test(text)) {
      violation = { type: "Threatening language", rule: "Threats or intimidation of any kind are strictly prohibited.", ruleNumber: "Rule 2", severity: "hard" };
    }
    // ── Privacy breach ─────────────────────────────────────────────────────
    else if (isPotentialPrivacyBreach(msg)) {
      violation = { type: "Sharing another member's photo without consent", rule: "Forwarding someone else's photo is a privacy breach.", ruleNumber: "Rule 3", severity: "hard" };
    }
    // ── Configurable: ad detection ─────────────────────────────────────────
    else if (config.modAds && isContextualAd(text)) {
      violation = { type: "Unsanctioned advertisement (price + contact in message)", rule: "Please use /sell, /buy or /free to post on psots.in instead.", ruleNumber: "Rule 4", severity: "hard" };
    }
    else if (config.modAds && AD_REGEX.test(text)) {
      violation = { type: "Advertisement / promotional content", rule: "Ads and promotional messages are not allowed. Use /sell, /buy or /free.", ruleNumber: "Rule 4", severity: "hard" };
    }
    // ── Configurable: promo group links ────────────────────────────────────
    else if (PROMO_LINK_REGEX.test(text)) {
      violation = { type: "Promotional group / channel link", rule: "Links to other Telegram groups, WhatsApp groups or channels are not allowed.", ruleNumber: "Rule 9", severity: "hard" };
    }
    // ── Configurable: political ────────────────────────────────────────────
    else if (config.modPolitical && POLITICAL_REGEX.test(text)) {
      violation = { type: "Political content", rule: "Political posts or discussions are strictly not allowed.", ruleNumber: "Rule 5", severity: "hard" };
    }
    // ── Configurable: religious ────────────────────────────────────────────
    else if (config.modReligious && RELIGIOUS_REGEX.test(text)) {
      violation = { type: "Religious debate / divisive religious content", rule: "Religious arguments or divisive content are strictly not allowed.", ruleNumber: "Rule 6", severity: "hard" };
    }
    // ── Configurable: communal ─────────────────────────────────────────────
    else if (config.modCommunal && SENSITIVE_REGEX.test(text)) {
      violation = { type: "Communal / sensitive topic", rule: "Divisive community discussions are strictly not allowed.", ruleNumber: "Rule 7", severity: "hard" };
    }
    // ── Configurable: forwarded posts ──────────────────────────────────────
    else if (config.modForwards && isForwardedFromChannel(msg)) {
      violation = { type: "Forwarded channel post", rule: "Posts forwarded from external channels are not allowed.", ruleNumber: "Rule 8", severity: "hard" };
    }
    else if (config.modForwards && isForwardedFromExternalGroup(msg)) {
      violation = { type: "Forwarded content from another group", rule: "Messages forwarded from other groups are not allowed.", ruleNumber: "Rule 8", severity: "hard" };
    }
    // ── Configurable: external links ───────────────────────────────────────
    else if (config.modLinks && EXTERNAL_LINK_REGEX.test(text)) {
      violation = { type: "External link / URL", rule: "External links are not permitted without admin approval.", ruleNumber: "Rule 9", severity: "hard" };
    }
    // ── Configurable: social messages ──────────────────────────────────────
    else if (config.modSocial && SOCIAL_REGEX.test(text)) {
      violation = { type: "Social / greeting message", rule: "Social messages (birthdays, greetings) are better sent personally. Keep the group for PSOTS matters.", ruleNumber: "—", severity: "soft" };
    }
    // ── Configurable: excessive caps ───────────────────────────────────────
    else if (config.modCaps && isExcessiveCaps(text)) {
      violation = { type: "Excessive capital letters", rule: "ALL-CAPS messages are difficult to read and feel aggressive.", ruleNumber: "—", severity: "soft" };
    }
    // ── Marketplace: informal listing attempt → help them use the command ──
    else if (config.preset === "marketplace" && looksLikeInformalListing(text)) {
      // Don't delete — just guide them to use the proper command
      await send(chatId,
        `💡 ${mention} — Looks like you want to post a listing!\n\n` +
        `Please use the proper command so your post gets saved to *psots.in* and stays easy to find:\n\n` +
        `🛍️ *Selling?*\n\`/sell Item name | Price | Tower | Phone | Description\`\n\n` +
        `🔍 *Buying / Looking for something?*\n\`/buy Item name | Tower | Description\`\n\n` +
        `🎁 *Giving away free?*\n\`/free Item name | Tower | Description\`\n\n` +
        `🏠 *For rent?*\n\`/rent Item name | Price | Tower | Phone | Description\`\n\n` +
        `_Type /rules to see how this group works._`
      );
      return;
    }
    // ── Marketplace: off-topic general chat → redirect to main group ────────
    else if (config.preset === "marketplace" && text.length > 5) {
      await send(chatId,
        `💬 ${mention} — This group is for *buy / sell / rent / free* listings only.\n\nFor general chat, please use the main residents group. Type /help to see available commands.`
      );
      await deleteMsg(chatId, msg.message_id);
      return;
    }

    if (!violation) return;

    if (violation.severity === "hard") {
      await deleteMsg(chatId, msg.message_id);

      const prev = await getStrikes(chatIdStr, userIdStr);
      const count = prev + 1;
      await setStrikes(chatIdStr, userIdStr, count);

      const remaining = HARD_WARNINGS_BEFORE_MUTE - count;
      logger.info({ userId, displayName, violation: violation.type, warnings: count }, "Message moderated (hard)");

      if (count >= HARD_WARNINGS_BEFORE_MUTE) {
        const muted = await muteUser(chatId, userId, MUTE_DURATION_SECONDS);
        await setStrikes(chatIdStr, userIdStr, 0);
        if (muted) {
          await send(chatId,
            `🚫 *${displayName}* has been *muted for 1 hour* after ${HARD_WARNINGS_BEFORE_MUTE} violations.\n\nLast offence: ${violation.ruleNumber} — _${violation.type}_\n\nPlease review /rules carefully before your mute lifts.`
          );
        } else {
          await send(chatId,
            `⛔ ${mention} — your message was removed. Maximum warnings reached.\nOffence: ${violation.ruleNumber} — _${violation.type}_\n\nAdmins have been notified. Please review /rules.`
          );
        }
      } else {
        const strikeBar = "🔴".repeat(count) + "⚪".repeat(HARD_WARNINGS_BEFORE_MUTE - count);
        await send(chatId,
          `⚠️ *Message removed* — ${mention}\n\n*${violation.ruleNumber}:* _${violation.type}_\n${violation.rule}\n\n${strikeBar} Strike ${count}/${HARD_WARNINGS_BEFORE_MUTE}` +
          `${remaining > 0 ? ` — ${remaining} more before a 1-hour mute.` : ""}\n\nType /rules for full etiquettes.`
        );
      }
    } else {
      logger.info({ userId, displayName, violation: violation.type }, "Message moderated (soft)");
      await send(chatId,
        `💬 *Friendly reminder* — ${mention}\n\n_${violation.type}_\n${violation.rule}\n\n_This is just a gentle nudge. Type /rules for full etiquettes._`
      );
    }
  }

  // ─── Welcome new members ─────────────────────────────────────────────────
  bot.on("message", async (msg) => {
    if (msg.new_chat_members && msg.new_chat_members.length > 0) {
      const config = await getGroupConfig(String(msg.chat.id));
      for (const member of msg.new_chat_members) {
        if (!member.is_bot) {
          await send(msg.chat.id, getWelcomeText(member.first_name, config));
        }
      }
      return;
    }
    await moderateMessage(msg);
  });

  // ─── /start and /help ─────────────────────────────────────────────────────
  bot.onText(/^\/(start|help)/, async (msg) => {
    const config = await getGroupConfig(String(msg.chat.id));
    send(msg.chat.id, getHelpText(config));
  });

  // ─── /rules ──────────────────────────────────────────────────────────────
  bot.onText(/^\/rules/, async (msg) => {
    const config = await getGroupConfig(String(msg.chat.id));
    send(msg.chat.id, getRulesText(config));
  });

  // ─── /mystatus ───────────────────────────────────────────────────────────
  bot.onText(/^\/mystatus/, async (msg) => {
    if (!msg.from) { send(msg.chat.id, "❌ Could not identify you."); return; }
    const count = await getStrikes(String(msg.chat.id), String(msg.from.id));
    const strikeBar = count > 0
      ? "🔴".repeat(count) + "⚪".repeat(Math.max(0, HARD_WARNINGS_BEFORE_MUTE - count))
      : "✅ Clean record";
    send(msg.chat.id,
      `📊 *Your Moderation Status*\n\n${strikeBar}\nStrikes: *${count}/${HARD_WARNINGS_BEFORE_MUTE}*\n` +
      `${count === 0 ? "You have a clean record. Keep it up!" : `${HARD_WARNINGS_BEFORE_MUTE - count} more violation(s) before a 1-hour mute.`}\n\n_Strikes persist across restarts. Type /rules to review etiquettes._`
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ███  ADMIN: GROUP SETUP COMMANDS  ███
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── /setup <preset> ─────────────────────────────────────────────────────
  bot.onText(/^\/setup(?:\s+(\S+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const chatIdStr = String(chatId);
    if (!msg.from) return;
    if (!(await isAdmin(chatId, msg.from.id))) {
      send(chatId, "❌ This command is for group admins only.");
      return;
    }

    const preset = match?.[1]?.toLowerCase();
    const groupName = msg.chat.title ?? "";

    if (!preset) {
      send(chatId,
        `🛠️ *Group Setup*\n\nChoose a preset to apply:\n\n` +
        `• /setup general — Main residents group (full moderation, all commands)\n` +
        `• /setup marketplace — Buy/sell group (ads allowed, no greetings, sell commands only)\n` +
        `• /setup announcements — Read-only channel (bot and admins post only)\n\n` +
        `After applying a preset, use /groupset to fine-tune individual rules.\n` +
        `Use /groupinfo to see current settings.`
      );
      return;
    }

    let config: GroupConfig;
    let presetLabel: string;

    if (preset === "general") {
      config = { ...DEFAULT_GENERAL_CONFIG };
      presetLabel = "General (Main Residents Group)";
    } else if (preset === "marketplace" || preset === "market" || preset === "sells" || preset === "sell") {
      config = { ...DEFAULT_MARKETPLACE_CONFIG };
      presetLabel = "Marketplace (Buy/Sell Group)";
    } else if (preset === "announcements" || preset === "announcement" || preset === "announce") {
      config = { ...DEFAULT_ANNOUNCEMENTS_CONFIG };
      presetLabel = "Announcements (Read-only Channel)";
    } else {
      send(chatId, `❌ Unknown preset *${preset}*.\n\nUse: /setup general | /setup marketplace | /setup announcements`);
      return;
    }

    await saveGroupConfig(chatIdStr, groupName, config);
    logger.info({ chatId: chatIdStr, preset, admin: msg.from.id }, "Group setup applied");
    send(chatId,
      `✅ *Group configured: ${presetLabel}*\n\nUse /groupinfo to see all settings.\nUse /groupset <rule> on|off to customise individual rules.`
    );
  });

  // ─── /groupinfo ───────────────────────────────────────────────────────────
  bot.onText(/^\/groupinfo/, async (msg) => {
    const chatId = msg.chat.id;
    if (!msg.from) return;
    if (!(await isAdmin(chatId, msg.from.id))) {
      send(chatId, "❌ This command is for group admins only.");
      return;
    }
    const config = await getGroupConfig(String(chatId));
    send(chatId, formatGroupInfo(msg.chat.title ?? "", config));
  });

  // ─── /groupset <rule> <on|off> ────────────────────────────────────────────
  bot.onText(/^\/groupset(?:\s+(\S+)(?:\s+(on|off))?)?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const chatIdStr = String(chatId);
    if (!msg.from) return;
    if (!(await isAdmin(chatId, msg.from.id))) {
      send(chatId, "❌ This command is for group admins only.");
      return;
    }

    const rule = match?.[1]?.toLowerCase();
    const value = match?.[2]?.toLowerCase();

    if (!rule || !value) {
      const settingsList = Object.keys(SETTING_LABELS)
        .map(k => `• \`/groupset ${k} on|off\` — ${SETTING_LABELS[k].label}`)
        .join("\n");
      send(chatId,
        `🛠️ *Available Settings*\n\n${settingsList}\n\n_Example:_ /groupset ads off\n_Example:_ /groupset cmd_notice on\n\nUse /groupinfo to see current values.`
      );
      return;
    }

    const setting = SETTING_LABELS[rule];
    if (!setting) {
      send(chatId, `❌ Unknown setting *${rule}*.\n\nType /groupset to see all available settings.`);
      return;
    }

    const config = await getGroupConfig(chatIdStr);
    const newConfig: GroupConfig = { ...config, preset: "custom" };
    (newConfig as Record<string, unknown>)[setting.key] = value === "on";

    await saveGroupConfig(chatIdStr, msg.chat.title ?? "", newConfig);
    logger.info({ chatId: chatIdStr, rule, value, admin: msg.from.id }, "Group setting changed");
    send(chatId,
      `✅ *${setting.label}* → ${value === "on" ? "✅ ON" : "❌ OFF"}\n\nPreset changed to *Custom*.\nUse /groupinfo to see all current settings.`
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ███  ADMIN: MODERATION COMMANDS  ███
  // ═══════════════════════════════════════════════════════════════════════════

  bot.onText(/^\/warn(?:\s+@?(\S+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!msg.from) return;
    if (!(await isAdmin(chatId, msg.from.id))) { send(chatId, "❌ Admins only."); return; }
    const target = match?.[1];
    if (!target) { send(chatId, "Usage: `/warn @username`"); return; }
    send(chatId,
      `⚠️ *Admin Warning*\n\n@${target.replace("@", "")} has been issued an official warning by an admin.\n\nPlease review /rules and ensure your messages follow the group etiquettes.`
    );
    logger.info({ target, adminId: msg.from.id }, "Manual admin warning issued");
  });

  bot.onText(/^\/unmute(?:\s+(\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!msg.from) return;
    if (!(await isAdmin(chatId, msg.from.id))) { send(chatId, "❌ Admins only."); return; }
    const userId = match?.[1] ? Number(match[1]) : null;
    if (!userId) { send(chatId, "Usage: `/unmute <userId>`"); return; }
    try {
      await bot.restrictChatMember(chatId, userId, {
        permissions: {
          can_send_messages: true, can_send_polls: true,
          can_send_other_messages: true, can_add_web_page_previews: true,
          can_change_info: false, can_invite_users: true, can_pin_messages: false,
        },
      });
      await setStrikes(String(chatId), String(userId), 0);
      send(chatId, `✅ User ${userId} unmuted and strikes reset. Remind them to review /rules.`);
      logger.info({ userId, adminId: msg.from.id }, "User unmuted by admin");
    } catch (err) {
      logger.warn({ err }, "Could not unmute user");
      send(chatId, "❌ Could not unmute. Make sure I am an admin with Restrict Members permission.");
    }
  });

  bot.onText(/^\/strikes(?:\s+(\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!msg.from) return;
    if (!(await isAdmin(chatId, msg.from.id))) { send(chatId, "❌ Admins only."); return; }
    const userId = match?.[1];
    if (!userId) { send(chatId, "Usage: `/strikes <userId>`"); return; }
    const count = await getStrikes(String(chatId), userId);
    send(chatId, `📊 User ${userId} has *${count}/${HARD_WARNINGS_BEFORE_MUTE}* strikes in this group.`);
  });

  bot.onText(/^\/resetstrikes(?:\s+(\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!msg.from) return;
    if (!(await isAdmin(chatId, msg.from.id))) { send(chatId, "❌ Admins only."); return; }
    const userId = match?.[1];
    if (!userId) { send(chatId, "Usage: `/resetstrikes <userId>`"); return; }
    await setStrikes(String(chatId), userId, 0);
    send(chatId, `✅ Strikes reset to 0 for user ${userId}.`);
    logger.info({ userId, adminId: msg.from.id }, "Strikes reset by admin");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ███  CONTENT COMMANDS (group-config gated)  ███
  // ═══════════════════════════════════════════════════════════════════════════

  bot.onText(/^\/notice (.+)/s, async (msg, match) => {
    const chatId = msg.chat.id;
    const config = await getGroupConfig(String(chatId));
    if (!config.cmdNotice) {
      send(chatId, "❌ /notice is not enabled in this group.\n\nTo enable: `/groupset cmd_notice on` (admins only).");
      return;
    }
    const parts = parseParts(match![1].trim(), 2);
    if (!parts) { send(chatId, "❌ Format: `/notice Title | Your message`"); return; }
    const [title, ...rest] = parts;
    const content = rest.join(" | ");
    const postedBy = msg.from ? `${msg.from.first_name}${msg.from.last_name ? " " + msg.from.last_name : ""} (Telegram)` : "Telegram";
    try {
      await db.insert(noticesTable).values({ title, content, category: "General", tower: "All", isPinned: false, postedBy });
      send(chatId, `✅ *Notice posted!*\n\n📢 *${title}*\n${content}\n\n_Live on psots.in_`);
      logger.info({ title }, "Notice created via Telegram bot");
    } catch (err) {
      logger.error({ err }, "Failed to create notice via bot");
      send(chatId, "❌ Something went wrong. Please try again.");
    }
  });

  bot.onText(/^\/event (.+)/s, async (msg, match) => {
    const chatId = msg.chat.id;
    const config = await getGroupConfig(String(chatId));
    if (!config.cmdEvent) {
      send(chatId, "❌ /event is not enabled in this group.\n\nTo enable: `/groupset cmd_event on` (admins only).");
      return;
    }
    const parts = parseParts(match![1].trim(), 4);
    if (!parts) { send(chatId, "❌ Format: `/event Title | Date | Venue | Description`\n\nDate: `25-Mar-2026 18:00`"); return; }
    const [title, dateStr, location, ...descParts] = parts;
    const description = descParts.join(" | ");
    const eventDate = parseDate(dateStr);
    if (!eventDate) { send(chatId, "❌ Invalid date. Use: `25-Mar-2026 18:00`"); return; }
    const organizer = msg.from ? `${msg.from.first_name}${msg.from.last_name ? " " + msg.from.last_name : ""}` : "Community Member";
    try {
      await db.insert(eventsTable).values({ title, description, location, eventDate, organizer });
      send(chatId, `✅ *Event posted!*\n\n📅 *${title}*\n📍 ${location}\n🕐 ${dateStr}\n\n_Live on psots.in_`);
      logger.info({ title }, "Event created via Telegram bot");
    } catch (err) {
      logger.error({ err }, "Failed to create event via bot");
      send(chatId, "❌ Something went wrong. Please try again.");
    }
  });

  bot.onText(/^\/sell (.+)/s, async (msg, match) => {
    const chatId = msg.chat.id;
    const config = await getGroupConfig(String(chatId));
    if (!config.cmdSell) {
      send(chatId, "❌ Marketplace commands are not enabled in this group.\n\nTo enable: `/groupset cmd_sell on` (admins only).");
      return;
    }
    const parts = parseParts(match![1].trim(), 3);
    if (!parts) { send(chatId, "❌ Format: `/sell Title | Price | Tower | Phone | Description`"); return; }
    const [title, priceStr, towerRaw, phoneOrDesc, ...rest] = parts;
    const tower = normalizeTower(towerRaw);
    const price = parseFloat(priceStr.replace(/[₹,\s]/g, "")) || undefined;
    const contactName = msg.from ? `${msg.from.first_name}${msg.from.last_name ? " " + msg.from.last_name : ""}` : "Resident";
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS);
    let contactPhone: string | undefined;
    let description: string;
    if (phoneOrDesc && /^\+?[\d\s\-]{7,}$/.test(phoneOrDesc)) {
      contactPhone = phoneOrDesc;
      description = rest.join(" | ") || title;
    } else {
      description = [phoneOrDesc, ...rest].filter(Boolean).join(" | ") || title;
    }
    try {
      const [listing] = await db.insert(listingsTable).values({
        title, description, price: price ? String(price) : null,
        type: "sell", category: "Other", tower, contactName,
        contactPhone: contactPhone ?? null,
        telegramUserId: msg.from ? String(msg.from.id) : null,
        telegramUsername: msg.from?.username ?? null,
        expiresAt, status: "active",
      }).returning();
      send(chatId,
        `✅ *Listing posted!* (ID: ${listing.id})\n\n🛍️ *${title}*\n💰 ${price ? `₹${price.toLocaleString()}` : "Price not set"}\n📍 ${tower}\n⏳ Expires in ${EXPIRY_DAYS} days\n\n` +
        `_To close: /close ${listing.id} | To mark sold: /sold ${listing.id}_\n_Live on psots.in_`
      );
      logger.info({ title }, "Sell listing created via Telegram bot");
    } catch (err) {
      logger.error({ err }, "Failed to create listing via bot");
      send(chatId, "❌ Something went wrong. Please try again.");
    }
  });

  bot.onText(/^\/buy (.+)/s, async (msg, match) => {
    const chatId = msg.chat.id;
    const config = await getGroupConfig(String(chatId));
    if (!config.cmdSell) {
      send(chatId, "❌ Marketplace commands are not enabled in this group.");
      return;
    }
    const parts = parseParts(match![1].trim(), 2);
    if (!parts) { send(chatId, "❌ Format: `/buy Title | Tower | Description`"); return; }
    const [title, towerRaw, ...rest] = parts;
    const tower = normalizeTower(towerRaw);
    const description = rest.join(" | ") || title;
    const contactName = msg.from ? `${msg.from.first_name}${msg.from.last_name ? " " + msg.from.last_name : ""}` : "Resident";
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS);
    try {
      const [listing] = await db.insert(listingsTable).values({
        title, description, price: null, type: "buy", category: "Other", tower, contactName,
        contactPhone: null, telegramUserId: msg.from ? String(msg.from.id) : null,
        telegramUsername: msg.from?.username ?? null, expiresAt, status: "active",
      }).returning();
      send(chatId, `✅ *Wanted listing posted!* (ID: ${listing.id})\n\n🔍 *${title}*\n📍 ${tower}\n\n_To close: /close ${listing.id}_\n_Live on psots.in_`);
      logger.info({ title }, "Buy listing created via Telegram bot");
    } catch (err) {
      logger.error({ err }, "Failed to create listing via bot");
      send(chatId, "❌ Something went wrong. Please try again.");
    }
  });

  bot.onText(/^\/free (.+)/s, async (msg, match) => {
    const chatId = msg.chat.id;
    const config = await getGroupConfig(String(chatId));
    if (!config.cmdSell) {
      send(chatId, "❌ Marketplace commands are not enabled in this group.");
      return;
    }
    const parts = parseParts(match![1].trim(), 2);
    if (!parts) { send(chatId, "❌ Format: `/free Title | Tower | Description`"); return; }
    const [title, towerRaw, ...rest] = parts;
    const tower = normalizeTower(towerRaw);
    const description = rest.join(" | ") || title;
    const contactName = msg.from ? `${msg.from.first_name}${msg.from.last_name ? " " + msg.from.last_name : ""}` : "Resident";
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS);
    try {
      const [listing] = await db.insert(listingsTable).values({
        title, description, price: null, type: "free", category: "Other", tower, contactName,
        contactPhone: null, telegramUserId: msg.from ? String(msg.from.id) : null,
        telegramUsername: msg.from?.username ?? null, expiresAt, status: "active",
      }).returning();
      send(chatId, `✅ *Free item posted!* (ID: ${listing.id})\n\n🎁 *${title}*\n📍 ${tower}\n\n_To close: /close ${listing.id}_\n_Live on psots.in_`);
      logger.info({ title }, "Free listing created via Telegram bot");
    } catch (err) {
      logger.error({ err }, "Failed to create listing via bot");
      send(chatId, "❌ Something went wrong. Please try again.");
    }
  });

  bot.onText(/^\/mylistings/, async (msg) => {
    const chatId = msg.chat.id;
    if (!msg.from) { send(chatId, "❌ Could not identify you."); return; }
    const userId = String(msg.from.id);
    const listings = await db.select().from(listingsTable)
      .where(and(eq(listingsTable.telegramUserId, userId), eq(listingsTable.isActive, true)));
    if (listings.length === 0) {
      send(chatId, "📭 You have no active listings.\n\nPost one with /sell, /buy, or /free.");
      return;
    }
    const lines = listings.map((l) => {
      const expiry = l.expiresAt ? `⏳ ${Math.max(0, Math.ceil((l.expiresAt.getTime() - Date.now()) / 86400000))}d left` : "";
      const statusIcon = l.status === "sold" ? "✅ Sold" : l.status === "closed" ? "🔒 Closed" : "🟢 Active";
      return `• [${l.id}] *${l.title}* — ${statusIcon} ${expiry}\n  /sold ${l.id} | /close ${l.id}`;
    }).join("\n\n");
    send(chatId, `📋 *Your Listings*\n\n${lines}`);
  });

  bot.onText(/^\/sold (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const id = Number(match![1]);
    if (!msg.from) { send(chatId, "❌ Could not identify you."); return; }
    const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, id));
    if (!listing) { send(chatId, `❌ Listing #${id} not found.`); return; }
    if (listing.telegramUserId && listing.telegramUserId !== String(msg.from.id)) {
      send(chatId, "❌ You can only manage your own listings."); return;
    }
    await db.update(listingsTable).set({ status: "sold", isActive: false }).where(eq(listingsTable.id, id));
    send(chatId, `✅ *"${listing.title}"* (ID: ${id}) marked as *Sold!*\n\nIt will be moved to the sold section on psots.in.`);
    logger.info({ id }, "Listing marked as sold via bot");
  });

  bot.onText(/^\/close (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const id = Number(match![1]);
    if (!msg.from) { send(chatId, "❌ Could not identify you."); return; }
    const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, id));
    if (!listing) { send(chatId, `❌ Listing #${id} not found.`); return; }
    if (listing.telegramUserId && listing.telegramUserId !== String(msg.from.id)) {
      send(chatId, "❌ You can only manage your own listings."); return;
    }
    await db.update(listingsTable).set({ status: "closed", isActive: false }).where(eq(listingsTable.id, id));
    send(chatId, `🔒 *"${listing.title}"* (ID: ${id}) has been *closed* and removed from the marketplace.`);
    logger.info({ id }, "Listing closed via bot");
  });

  bot.on("polling_error", (err) => {
    logger.error({ err }, "Telegram bot polling error");
  });

  return bot;
}
