export const INITIAL_ADMIN = "pushkalkishore@gmail.com";

export const DEFAULT_KEYWORDS = {
  buySell: ['sell', 'buy', 'rent', 'price', '₹', 'rs.', 'contact for price', 'call me', 'dm me', 'whatsapp me', 'available for sale', 'second hand', 'looking to buy', 'for sale', 'selling', 'buying', 'rental', 'lease'],
  political: ['bjp', 'congress', 'aap', 'election', 'vote', 'modi', 'cm', 'government policy', 'party', 'protest', 'rally', 'political', 'minister', 'parliament', 'lok sabha'],
  religious: ['temple donation', 'mosque', 'church collection', 'prayer meeting', 'temple', 'church', 'prayer', 'religious'],
  approvedEvents: ['chhath puja', 'diwali', 'holi', 'navratri', 'eid', 'rakhi', 'ganesh chaturthi', 'durga puja', 'makar sankranti'],
  spam: ['discount', 'offer', 'limited time', 'click here', 'refer a friend', 'earn money', 'business opportunity', 'join us', 'sign up', 'special offer', 'exclusive deal', 'hurry', 'act now'],
  abuseHindi: ['बेवकूफ', 'मूर्ख', 'गधा', 'चोर', 'झूठा', 'बदमाश', 'भाड़', 'साला', 'हरामी', 'कमीना'],
  abuseEnglish: ['idiot', 'stupid', 'fool', 'moron', 'dumb', 'jerk', 'ass', 'bastard', 'jackass', 'imbecile'],
  personalAttacks: ['you are wrong', 'you are an', 'shut up', 'go away', 'mind your own business', 'nobody asked you'],
  societyFees: ['cam', 'maintenance', 'maintenance charge', 'society fee', 'maintenance fee', 'dues', 'payment', 'monthly charge']
};

export const DEFAULT_ACTIONS = {
  firstViolation: {
    action: 'warn',
    message: 'Hi {name}, your message was removed for: {reason}. Please follow group guidelines. 🙏'
  },
  secondViolation: {
    action: 'warn',
    message: 'Hi {name}, this is your 2nd warning for {reason}. Please be careful. 🙏'
  },
  thirdViolation: {
    action: 'mute',
    duration: 3600,
    message: 'Hi {name}, you have been muted for 1 hour due to repeated violations. 🙏'
  },
  fifthViolation: {
    action: 'kick',
    message: 'User {name} has been removed for repeated violations.'
  },
  tenthViolation: {
    action: 'ban',
    message: 'User {name} has been banned for persistent violations.'
  }
};

export async function getBotToken(kv) {
  return await kv.get('_bot_token');
}

export async function getAdmins(kv, chatId = null) {
  const key = chatId ? `_admin_emails_${chatId}` : '_admin_emails';
  const admins = await kv.get(key);
  if (!admins && chatId) return await getAdmins(kv); 
  return admins ? JSON.parse(admins) : [INITIAL_ADMIN];
}

export async function saveAdmins(admins, kv, chatId = null) {
  const key = chatId ? `_admin_emails_${chatId}` : '_admin_emails';
  await kv.put(key, JSON.stringify(admins));
}

export async function getPINs(kv) {
  const pins = await kv.get('_admin_pins');
  return pins ? JSON.parse(pins) : ['1234'];
}

export async function savePINs(pins, kv) {
  await kv.put('_admin_pins', JSON.stringify(pins));
}

export async function getKeywords(kv, chatId = null) {
  const key = chatId ? `_keywords_config_${chatId}` : '_keywords_config';
  const stored = await kv.get(key);
  if (!stored && chatId) return await getKeywords(kv); 
  return stored ? JSON.parse(stored) : DEFAULT_KEYWORDS;
}

export async function saveKeywords(keywords, kv, chatId = null) {
  const key = chatId ? `_keywords_config_${chatId}` : '_keywords_config';
  await kv.put(key, JSON.stringify(keywords));
}

export async function getStats(kv, chatId = null) {
  const key = chatId ? `_stats_${chatId}` : '_stats';
  const stats = await kv.get(key);
  return stats ? JSON.parse(stats) : { totalScanned: 0, lastReset: Date.now() };
}

export async function updateStats(kv, chatId = null) {
  const stats = await getStats(kv, chatId);
  stats.totalScanned++;
  const key = chatId ? `_stats_${chatId}` : '_stats';
  await kv.put(key, JSON.stringify(stats));
}

export async function getActionSettings(kv, chatId = null) {
  const key = chatId ? `_action_settings_${chatId}` : '_action_settings';
  const settings = await kv.get(key);
  if (!settings && chatId) return await getActionSettings(kv); 
  return settings ? JSON.parse(settings) : DEFAULT_ACTIONS;
}

export async function saveActionSettings(settings, kv, chatId = null) {
  const key = chatId ? `_action_settings_${chatId}` : '_action_settings';
  await kv.put(key, JSON.stringify(settings));
}

export async function getActionForViolationCount(count, kv, chatId = null) {
  const settings = await getActionSettings(kv, chatId);

  if (count === 1) return settings.firstViolation;
  if (count === 2) return settings.secondViolation;
  if (count === 3) return settings.thirdViolation;
  if (count >= 5) return settings.fifthViolation;
  if (count >= 10) return settings.tenthViolation;

  return { action: 'warn', message: settings.thirdViolation.message };
}

export async function getUserViolations(userId, kv, chatId) {
  const prefix = chatId ? `user_${chatId}_` : 'user_';
  const data = await kv.get(`${prefix}${userId}`);
  return data ? JSON.parse(data) : null;
}

export async function saveUserViolations(userId, data, kv, chatId) {
  const prefix = chatId ? `user_${chatId}_` : 'user_';
  await kv.put(`${prefix}${userId}`, JSON.stringify(data), { expirationTtl: 2592000 });
}

export async function getViolationsLast30Days(kv, chatId) {
  const prefix = chatId ? `user_${chatId}_` : 'user_';
  const list = await kv.list({ prefix });
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const violations = [];

  for (const item of list.keys) {
    const data = JSON.parse(await kv.get(item.name));
    if (data.lastViolationTime > thirtyDaysAgo) {
      violations.push({ ...data, chatId });
    }
  }
  return violations;
}

export async function isResidentVerified(userId, kv) {
  const verified = await kv.get(`resident_verified_${userId}`);
  return !!verified;
}

export async function markResidentVerified(userId, data, kv) {
  await kv.put(`resident_verified_${userId}`, JSON.stringify(data));
}

export function checkViolation(text, keywords) {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('₹') && keywords.societyFees.some(f => lowerText.includes(f.toLowerCase()))) return null;
  if (keywords.approvedEvents.some(e => lowerText.includes(e.toLowerCase()))) return null;
  if (keywords.buySell.some(k => lowerText.includes(k.toLowerCase()))) return 'Buy/Sell Content';
  if (keywords.political.some(k => lowerText.includes(k.toLowerCase()))) return 'Political Content';
  if (keywords.religious.some(k => lowerText.includes(k.toLowerCase()))) return 'Religious Content';
  if (keywords.spam.some(k => lowerText.includes(k.toLowerCase()))) return 'Spam/Unsolicited Promotion';
  if (keywords.abuseHindi.some(k => lowerText.includes(k.toLowerCase())) || keywords.abuseEnglish.some(k => lowerText.includes(k.toLowerCase()))) return 'Abusive Language';
  if (keywords.personalAttacks.some(k => lowerText.includes(k.toLowerCase()))) return 'Personal Attack/Foul Language';
  return null;
}
