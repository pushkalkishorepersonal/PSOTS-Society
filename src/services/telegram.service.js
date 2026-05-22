// ============================================================
// src/telegram.js
// Telegram API helpers + Gemini context-aware moderation + OTP
// ============================================================

export async function sendMessage(chatId, text, token, replyMarkup = null) {
  try {
    const body = { chat_id: chatId, text, parse_mode: 'HTML' };
    if (replyMarkup) body.reply_markup = replyMarkup;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (err) {}
}

export async function deleteTelegramMessage(chatId, messageId, token) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId })
    });
  } catch (err) {}
}

export async function fetchChatMember(chatId, userId, token) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, user_id: userId })
    });
    const data = await res.json();
    return data.ok ? data.result : null;
  } catch (err) {
    return null;
  }
}

export async function sendSocietyEmail(toEmail, subject, content) {
  try {
    await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toEmail, name: "PSOTS Resident" }] }],
        from: { email: "noreply@society.psots.in", name: "PSOTS Community Portal" },
        subject,
        content: [{ type: "text/html", value: content }]
      })
    });
  } catch (e) {}
}

// ── GEMINI: PARSE MARKETPLACE LISTING ────────────────────────
export async function parseListingWithGemini(text, env) {
  if (!env.GEMINI_API_KEY) return { text };
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`;
    const prompt = `Extract marketplace listing data from this Telegram message. Return ONLY a JSON object with keys: item (string), price (number or null), tower (number or null), category (one of: Electronics, Furniture, Services, Vehicle, Rentals, Other). Text: "${text}"`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const d = await res.json();
    const aiText = d.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
    return JSON.parse(aiText);
  } catch (e) {
    return { text };
  }
}

// ── GEMINI: CONTEXT-AWARE MODERATION ─────────────────────────
// Returns { action: 'flag'|'ignore', reason: string, confidence: 'high'|'medium'|'low' }
// Only acts on 'high' confidence. 'medium' and 'low' are silently ignored.
export async function moderateWithGemini(flaggedMessage, recentMessages, violationType, env) {
  if (!env.GEMINI_API_KEY) {
    // No API key — fall back to blind keyword action
    return { action: 'flag', reason: violationType, confidence: 'high' };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`;

    const context = recentMessages.length > 0
      ? recentMessages.map((m, i) => `[${i + 1}] ${m.from}: ${m.text}`).join('\n')
      : 'No prior messages available.';

    const prompt = `You are a moderation assistant for a residential society WhatsApp/Telegram group called PSOTS (Prestige Song of the South, Bangalore). The group has 2,100+ families.

A message has been flagged by keyword matching for: "${violationType}"

Recent conversation context (last ${recentMessages.length} messages before the flagged message):
${context}

Flagged message:
"${flaggedMessage}"

Your job: Read the FULL context and decide if this message is genuinely violating the community guidelines or if it is harmless in context.

Community guidelines:
- No buying/selling in general groups (only in marketplace group)
- No political content or party propaganda
- No religious solicitation or donation drives
- No spam or unsolicited promotions
- No abusive language or personal attacks
- Society fee discussions ARE allowed

Examples of false positives to IGNORE:
- "sell" in "I will sell my vote... just kidding, happy voting day!" → harmless
- "buy" in "Let's buy time on this issue" → harmless
- "price" in "Price of petrol is rising, tough times" → harmless
- "party" in "Birthday party at the clubhouse" → harmless
- "temple" in "Temple maintenance work happening this week" → harmless
- "payment" in "Payment gateway maintenance by bank tonight" → harmless

Return ONLY a JSON object with exactly these keys:
{
  "action": "flag" or "ignore",
  "reason": "one sentence explanation",
  "confidence": "high", "medium", or "low"
}

Rules:
- "flag" + "high" = delete message and warn user
- "flag" + "medium" = notify admin silently, do NOT delete
- "ignore" = do nothing, false positive
- Be conservative — when in doubt, choose "ignore" or lower confidence
- Only "flag" + "high" triggers automatic deletion`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 200 }
      })
    });

    const d = await res.json();
    const raw = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    // Validate response shape
    if (!result.action || !result.confidence) {
      return { action: 'ignore', reason: 'Gemini response malformed', confidence: 'low' };
    }

    return result;
  } catch (e) {
    // On any error, fail safe — do NOT delete the message
    return { action: 'ignore', reason: 'Gemini API error', confidence: 'low' };
  }
}

// ── OTP: GENERATE 6-DIGIT OTP ────────────────────────────────
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── OTP: SEND VERIFICATION OTP ───────────────────────────────
// Called when user sends /verify in private chat with the bot
// Stores OTP in KV with 10 minute TTL
export async function handleVerifyCommand(userId, firstName, token, kv) {
  const otp = generateOTP();
  const key = `otp_${userId}`;

  await kv.put(key, JSON.stringify({
    otp,
    userId,
    createdAt: Date.now(),
    used: false
  }), { expirationTtl: 600 }); // 10 minutes

  await sendMessage(
    userId,
    `🔐 <b>Your PSOTS Verification OTP</b>\n\n<code>${otp}</code>\n\n⏱ Valid for <b>10 minutes</b>.\n\nPaste this code on <a href="https://psots.in/residents.html">psots.in/residents.html</a> to sign in.\n\nDo not share this code with anyone.`,
    token
  );

  return otp;
}

// ── OTP: VERIFY OTP (called from Worker HTTP endpoint) ───────
export async function verifyOTP(userId, submittedOTP, kv) {
  const key = `otp_${userId}`;
  const raw = await kv.get(key);
  if (!raw) return { valid: false, reason: 'OTP expired or not found' };

  const data = JSON.parse(raw);
  if (data.used) return { valid: false, reason: 'OTP already used' };
  if (data.otp !== submittedOTP) return { valid: false, reason: 'Invalid OTP' };

  // Mark as used
  await kv.put(key, JSON.stringify({ ...data, used: true }), { expirationTtl: 60 });

  return { valid: true, userId: data.userId };
}
