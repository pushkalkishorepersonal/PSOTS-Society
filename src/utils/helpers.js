// Auto-extracted helpers from index.js
// Import these in route files as needed

// ============================================================
// src/index.js — PSOTS Telegram Bot Worker
// Gemini context-aware moderation + /verify OTP for psots.in
// ============================================================

import { EVENTS_HTML, GRAND_LOBBY_HTML, MARKETPLACE_HTML, HANDBOOK_HTML, USER_PANEL } from './templates.js';
import {
  INITIAL_ADMIN, DEFAULT_KEYWORDS, DEFAULT_ACTIONS,
  getBotToken, getAdmins, saveAdmins, getPINs, savePINs,
  getKeywords, saveKeywords, getStats, updateStats,
  getActionSettings, saveActionSettings, getActionForViolationCount,
  getUserViolations, saveUserViolations, getViolationsLast30Days,
  isResidentVerified, markResidentVerified, checkViolation
} from './store.js';
import {
  sendMessage, deleteTelegramMessage, parseListingWithGemini,
  fetchChatMember, moderateWithGemini, handleVerifyCommand, verifyOTP
} from './telegram.js';

const ADMIN_ID = 989358143;
const GOOGLE_CLIENT_ID_VALUE = "774636811164-c9n9n8a27c9d0fbhg7e6vie759gq1sun.apps.googleusercontent.com";

// ── MESSAGE HISTORY HELPERS ───────────────────────────────────
// Store last 5 messages per chat for Gemini context
async function getRecentMessages(chatId, kv) {
  const raw = await kv.get(`_history_${chatId}`);
  return raw ? JSON.parse(raw) : [];
}

async function addToHistory(chatId, from, text, kv) {
  const history = await getRecentMessages(chatId, kv);
  history.push({ from, text: text.substring(0, 200) });
  // Keep only last 5
  if (history.length > 5) history.shift();
  await kv.put(`_history_${chatId}`, JSON.stringify(history), { expirationTtl: 3600 });
}

// ── FIRESTORE HELPERS ─────────────────────────────────────────
async function getFirestoreToken(env) {
  const token = await mintFirebaseToken('__bot__', env);
  return token;
}

async function getServiceAccountToken(env) {
  try {
    const email = env.FIREBASE_SA_EMAIL;
    const key = env.FIREBASE_SA_KEY.replace(/\\n/g, '\n').replace(/\r/g, '');
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: email, sub: email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now, exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/datastore'
    };
    const header = { alg: 'RS256', typ: 'JWT' };
    const encode = obj => btoa(JSON.stringify(obj))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const signingInput = `${encode(header)}.${encode(payload)}`;
    const pemKey = key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
    const binaryKey = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8', binaryKey.buffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['sign']
    );
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput));
    const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`;
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });
    const data = await res.json();
    return data.access_token || null;
  } catch (e) {
    console.error('getServiceAccountToken error:', e);
    return null;
  }
}

async function firestoreGet(path, env) {
  try {
    const token = await getServiceAccountToken(env);
    if (!token) return null;
    const base = 'https://firestore.googleapis.com/v1/projects/psots-society-25899/databases/(default)/documents';
    const res = await fetch(`${base}/${path}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch (e) {
    console.error('firestoreGet error:', e);
    return null;
  }
}

async function firestoreSet(path, data, env) {
  try {
    const token = await getServiceAccountToken(env);
    if (!token) return false;
    const base = 'https://firestore.googleapis.com/v1/projects/psots-society-25899/databases/(default)/documents';
    const fields = {};
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'string') fields[k] = { stringValue: v };
      else if (typeof v === 'number') fields[k] = { integerValue: String(v) };
      else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
      else if (Array.isArray(v)) fields[k] = { arrayValue: { values: v.map(i => ({ stringValue: String(i) })) }};
      else if (v !== null && typeof v === 'object') fields[k] = { mapValue: { fields: v }};
    }
    const res = await fetch(`${base}/${path}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });
    return res.ok;
  } catch (e) {
    console.error('firestoreSet error:', e);
    return false;
  }
}

async function processAdminPhoto(message, botToken, env) {
  try {
    const photo = message.photo[message.photo.length - 1]; // Get largest
    const fileId = photo.file_id;

    // 1. Get file path
    const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();
    if (!fileData.ok) throw new Error("Failed to get file path");
    const filePath = fileData.result.file_path;

    // 2. Download image
    const imgRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
    const imgBuffer = await imgRes.arrayBuffer();
    const base64Img = btoa(new Uint8Array(imgBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));

    // 3. Call Gemini 1.5 Flash Vision
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
    const prompt = `This is a screenshot from a WhatsApp/Telegram food group. 
Extract ALL vendor/seller information visible:
1. Vendor name or phone number
2. Items being sold
3. Prices mentioned (₹ amounts)
4. Any contact details
5. Date/time if visible

Return as JSON:
{
  vendor: 'name or phone',
  items: ['item1', 'item2'],
  prices: ['₹120', '₹200'],
  contact: 'phone or username',
  hasPrice: true/false,
  rawText: 'all text visible in image'
}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Img
              }
            }
          ]
        }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const geminiData = await geminiRes.json();
    if (geminiData.error) throw new Error(geminiData.error.message || "Gemini API error");
    
    const resultText = geminiData.candidates[0].content.parts[0].text;
    const extracted = JSON.parse(resultText);

    // 4. Save to Firestore
    const loggedAt = Math.floor(Date.now() / 1000);
    const docId = `img_${loggedAt}_${message.from.id}`;
    await firestoreSet(`forwarded_analysis/${docId}`, {
      groupName: "Foodies",
      source: "image_upload",
      vendor: extracted.vendor || "Unknown",
      items: extracted.items || [],
      prices: extracted.prices || [],
      contact: extracted.contact || "Unknown",
      hasPrice: !!extracted.hasPrice,
      rawText: extracted.rawText || "",
      loggedAt
    }, env);

    // 5. Reply to admin
    const replyText = `📊 <b>Extracted from image:</b>\n` +
      `Vendor: ${extracted.vendor || "N/A"}\n` +
      `Items: ${(extracted.items || []).join(', ') || "N/A"}\n` +
      `Prices: ${(extracted.prices || []).join(', ') || "N/A"}\n` +
      `Contact: ${extracted.contact || "N/A"}\n\n` +
      `✅ Saved to research database`;

    await sendMessage(message.from.id, replyText, botToken);
  } catch (err) {
    console.error("processAdminPhoto error:", err);
    await sendMessage(message.from.id, `❌ Photo processing failed: ${err.message}`, botToken);
  }
}

async function firestoreQuery(collection, filters, env) {
  try {
    const token = await getServiceAccountToken(env);
    if (!token) return [];
    const base = 'https://firestore.googleapis.com/v1/projects/psots-society-25899/databases/(default)/documents';
    const whereClause = filters.map(([field, value]) => ({
      fieldFilter: {
        field: { fieldPath: field },
        op: 'EQUAL',
        value: { stringValue: value }
      }
    }));
    const body = {
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: whereClause.length === 1
          ? whereClause[0]
          : { compositeFilter: { op: 'AND', filters: whereClause } }
      }
    };
    const res = await fetch(`${base}:runQuery`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return rows.filter(r => r.document).map(r => parseFirestoreDoc(r.document));
  } catch (e) {
    console.error('firestoreQuery error:', e);
    return [];
  }
}

function parseFirestoreDoc(data) {
  if (!data || !data.fields) return null;
  const obj = {};
  for (const [k, v] of Object.entries(data.fields)) {
    if (v.stringValue !== undefined) obj[k] = v.stringValue;
    else if (v.integerValue !== undefined) obj[k] = parseInt(v.integerValue);
    else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
    else if (v.arrayValue?.values) obj[k] = v.arrayValue.values.map(i => i.stringValue || i.integerValue);
    else if (v.mapValue?.fields) obj[k] = parseFirestoreDoc({ fields: v.mapValue.fields });
  }
  return obj;
}

async function getSettings(docId, env) {
  const doc = await firestoreGet(`settings/${docId}`, env);
  return parseFirestoreDoc(doc);
}

// ── FIREBASE CUSTOM TOKEN ─────────────────────────────────────
function pemToBuffer(pem) {
  const b64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
  return buffer.buffer;
}

async function mintFirebaseToken(uid, env) {
  try {
    const email = env.FIREBASE_SA_EMAIL;
    const key = env.FIREBASE_SA_KEY.replace(/\\n/g, '\n').replace(/\r/g, '');
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: email, sub: email,
      aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
      iat: now, exp: now + 3600, uid: String(uid)
    };
    const header = { alg: 'RS256', typ: 'JWT' };
    const encode = obj => {
  const str = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(str);
  let b64 = '';
  bytes.forEach(b => b64 += String.fromCharCode(b));
  return btoa(b64).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};
    const signingInput = `${encode(header)}.${encode(payload)}`;
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8', pemToBuffer(key),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['sign']
    );
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput));
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${signingInput}.${sigB64}`;
  } catch (e) {
    console.error('mintFirebaseToken error:', e);
    return null;
  }
}

// ── EMAIL UTILITY FUNCTIONS ──────────────────────────────────
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ── JWT PAYLOAD DECODE (no signature verification) ───────────
function decodeJwtPayload(authHeader) {
  try {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) payload += '=';
    return JSON.parse(atob(payload));
  } catch (e) {
    return null;
  }
}

// ── INVITE AUDIT HELPER ──────────────────────────────────────
async function auditInvitePatch(token, fields, env) {
  try {
    const tokenAuth = await getServiceAccountToken(env);
    if (!tokenAuth) return false;
    const base = 'https://firestore.googleapis.com/v1/projects/psots-society-25899/databases/(default)/documents';
    const paths = Object.keys(fields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
    const res = await fetch(`${base}/invite_audit/${token}?${paths}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });
    return res.ok;
  } catch (e) {
    console.error('auditInvitePatch error:', e);
    return false;
  }
}

function toFirestoreFields(data) {
  const fields = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (typeof v === 'number') fields[k] = { integerValue: String(v) };
  }
  return fields;
}

// ── EMAIL TEMPLATES ──────────────────────────────────────────
const EMAIL_CSS = `
  body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #faf6f0; color: #1a1208; line-height: 1.6; }
  .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(26,18,8,0.1); border: 1px solid rgba(160, 130, 90, 0.1); }
  .header { background-color: #1a4a3a; color: #ffffff; padding: 32px 24px; text-align: center; }
  .header h1 { font-size: 28px; font-weight: 700; margin: 0; letter-spacing: 0.5px; }
  .header p { font-size: 14px; margin: 4px 0 0; opacity: 0.9; font-weight: 400; }
  .content { padding: 40px 32px; background-color: #ffffff; }
  .footer { background-color: #faf6f0; padding: 32px 24px; text-align: center; font-size: 12px; color: #8a7a6a; border-top: 1px solid rgba(160, 130, 90, 0.1); }
  .footer p { margin: 4px 0; }
  .footer a { color: #1a4a3a; text-decoration: none; font-weight: 600; }
  .button { display: inline-block; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; transition: all 0.2s; text-align: center; margin: 20px 0; }
  .btn-jade { background-color: #1a4a3a; color: #ffffff !important; }
  .btn-red { background-color: #8b3a1a; color: #ffffff !important; }
  .otp-code { font-size: 48px; font-weight: 800; color: #1a4a3a; text-align: center; margin: 32px 0; letter-spacing: 4px; background: #f0f7f4; padding: 20px; border-radius: 12px; border: 2px dashed #1a4a3a; }
  .info-box { background-color: #f0e8d8; padding: 24px; border-radius: 12px; margin: 24px 0; border-left: 4px solid #b8882a; }
  .info-box p { margin: 8px 0; font-size: 14px; }
  .resident-info { border-collapse: collapse; width: 100%; margin: 24px 0; background: #faf6f0; border-radius: 8px; overflow: hidden; }
  .resident-info td { padding: 12px 16px; border-bottom: 1px solid rgba(160, 130, 90, 0.1); font-size: 14px; }
  .label { font-weight: 700; color: #3d2f1e; width: 100px; }
  .value { color: #1a1208; }
`;

function generateBaseEmail(title, subtitle, content) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${EMAIL_CSS}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
      <p>${subtitle || 'PSOTS Society · Prestige Song of the South'}</p>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p><strong>PSOTS Society · <a href="https://society.psots.in">society.psots.in</a></strong></p>
      <p>This is a resident initiative — not affiliated with RWA or Prestige.</p>
      <p>© 2026 PSOTS Society, Prestige Song of the South, Bangalore</p>
    </div>
  </div>
</body>
</html>`;
}

function generateOtpEmail(otp) {
  return generateBaseEmail('PSOTS Society', 'Prestige Song of the South', `
    <p>Hi there,</p>
    <p>Your one-time login code is:</p>
    <div class="otp-code">${otp}</div>
    <p style="text-align: center; color: #8a7a6a; font-size: 14px;">Valid for 15 minutes. Do not share this code with anyone.</p>
    <p style="margin-top: 32px; border-top: 1px solid #f0e8d8; padding-top: 24px; font-size: 13px; color: #8a7a6a;">
      If you didn't request this code, please ignore this email.
    </p>
  `);
}

function generateRegistrationApprovalEmail(residentName, flatNumber, residentEmail, approveToken, rejectToken) {
  const approveUrl = `https://society.psots.in/society/admin.html?action=approve&uid=${residentEmail}&token=${approveToken}`;
  const rejectUrl = `https://society.psots.in/society/admin.html?action=reject&uid=${residentEmail}&token=${rejectToken}`;

  return generateBaseEmail('PSOTS Society Admin', 'New Registration Request', `
    <p>A new registration is pending your review:</p>
    
    <table class="resident-info">
      <tr><td class="label">Name:</td><td class="value">${residentName}</td></tr>
      <tr><td class="label">Flat:</td><td class="value">${flatNumber}</td></tr>
      <tr><td class="label">Email:</td><td class="value">${residentEmail}</td></tr>
      <tr><td class="label">Submitted:</td><td class="value">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td></tr>
    </table>

    <div style="text-align: center; margin-top: 32px;">
      <a href="${approveUrl}" class="button btn-jade">✅ APPROVE REGISTRATION</a>
      <div style="margin-top: 12px;">
        <a href="${rejectUrl}" style="color: #8b3a1a; font-size: 14px; font-weight: 600;">❌ Reject Request</a>
      </div>
    </div>

    <p style="color: #8a7a6a; font-size: 12px; margin-top: 32px; text-align: center;">
      Links expire in 72 hours. Processing will automatically notify the resident.
    </p>
  `);
}

function generateApprovalConfirmationEmail(residentName, flatNumber) {
  return generateBaseEmail('PSOTS Society', 'Registration Approved! 🎉', `
    <p>Hi ${residentName},</p>
    <p>🎉 Your registration for <strong>Flat ${flatNumber}</strong> has been approved!</p>
    
    <div class="info-box">
      <p><strong>You can now access all community features:</strong></p>
      <p>• Community Marketplace (Buy/Sell)</p>
      <p>• Lost & Found board</p>
      <p>• Carpooling (Find/Offer rides)</p>
      <p>• Community Digital Guide</p>
    </div>

    <div style="text-align: center;">
      <a href="https://society.psots.in/society/login.html" class="button btn-jade">LOGIN NOW →</a>
    </div>

    <p style="margin-top: 32px; font-size: 14px;">Welcome to our digital community! If you have any questions, feel free to reach out to the admin team.</p>
  `);
}

function generateRegistrationReceivedEmail(name, flatNumber, adminContact = {}) {
  const whatsapp = adminContact.adminWhatsapp || '919482088904';
  const telegram = adminContact.adminTelegram || 'pushkalkishore';

  return generateBaseEmail('PSOTS Society', 'Registration Received', `
    <p>Hi ${name},</p>
    <p>✅ Your registration for <strong>Flat ${flatNumber}</strong> has been received and is pending admin approval.</p>

    <div class="info-box">
      <p><strong>What happens next:</strong></p>
      <p>• Admin will verify your details within 24-48 hours</p>
      <p>• You will receive an email once approved</p>
      <p>• Check status: <a href="https://society.psots.in/society/login.html" style="color: #1a4a3a;">society.psots.in/login</a></p>
    </div>

    <p style="margin-top: 32px;"><strong>Questions? Contact admin:</strong></p>
    <p>
      • <strong>WhatsApp:</strong> <a href="https://wa.me/${whatsapp}" style="color: #1a4a3a;">Click to Chat</a><br>
      • <strong>Telegram:</strong> <a href="https://t.me/${telegram}" style="color: #1a4a3a;">@${telegram}</a>
    </p>
  `);
}

function generateRejectionEmail(residentName, flatNumber, adminContact = {}) {
  const whatsapp = adminContact.adminWhatsapp || '919482088904';
  const telegram = adminContact.adminTelegram || 'pushkalkishore';

  return generateBaseEmail('PSOTS Society', 'Registration Update', `
    <p>Hi ${residentName},</p>
    <p>Your registration for <strong>Flat ${flatNumber}</strong> could not be approved at this time.</p>

    <p>If you believe this is an error or need to provide additional details, please contact our admin team:</p>
    
    <div class="info-box" style="background-color: #faf6f0; border-left-color: #8b3a1a;">
      <p>• <strong>WhatsApp:</strong> <a href="https://wa.me/${whatsapp}" style="color: #1a4a3a;">Click to Chat</a></p>
      <p>• <strong>Telegram:</strong> <a href="https://t.me/${telegram}" style="color: #1a4a3a;">@${telegram}</a></p>
    </div>

    <p style="color: #8a7a6a; font-size: 13px; margin-top: 32px;">We appreciate your interest in joining the PSOTS community portal.</p>
  `);
}

// ── DEFAULT GROUP SETTINGS ────────────────────────────────────
const DEFAULT_SETTINGS = {
  botActive: true,
  thresholds: { warn: 1, mute: 3, muteDuration: 60, ban: 10 },
  gemini: { enabled: true, sensitivity: 'medium', contextMessages: 10 },
  keywords: {
    predefined: { spam: true, abuse: true, links: false, ads: false, hate: true },
    custom: []
  },
  warningMessages: {
    dmThreshold: 3,
    notifyAdminFrom: 2,
    levels: [
      { atCount: 1, text: "⚠️ Hi {name}, your message was removed as it violated our community guidelines.\n\nThis is violation #1. Please review the guidelines.\n\nView your record: {profile}", muteMinutes: 0 },
      { atCount: 2, text: "⚠️ Hi {name}, this is your 2nd violation. Your message has been removed.\n\nReason: {reason}\n\nRepeated violations will result in being muted.\n\nView & appeal: {profile}", muteMinutes: 0 },
      { atCount: 3, text: "🔇 Hi {name}, you have been muted for 60 minutes (violation #3).\n\nReason: {reason}\n\nYou may appeal at: {profile}", muteMinutes: 60 },
      { atCount: 5, text: "🔇 Hi {name}, you have been muted for 24 hours (violation #{count}).\n\nThis is a serious violation. Admin has been notified.\n\nAppeal: {profile}", muteMinutes: 1440 },
      { atCount: 10, text: "⛔ Hi {name}, you have reached the maximum violation limit (#{count}).\n\nYou are indefinitely muted pending admin review.\n\nTo appeal: {profile}", muteMinutes: 999999 }
    ]
  }
};

// ── NOTIFICATION HELPERS ──────────────────────────────────────
async function notifyAllAdmins(subject, htmlContent, env) {
  try {
    const token = await getServiceAccountToken(env);
    const adminsSnapshot = await firestoreQuery('admins', [], env);
    const admins = adminsSnapshot.map(doc => parseFirestoreDoc(doc));

    const incompleteEmails = admins.filter(a => !a.email?.trim() || !a.phone?.trim());
    if (incompleteEmails.length > 0) {
      console.warn(`Skipping ${incompleteEmails.length} admins with missing email/phone`);
    }

    const emailList = admins
      .filter(a => a.email?.trim())
      .map(a => a.email.trim());

    if (emailList.length === 0) {
      console.error('No admin emails found to notify');
      return { success: false, reason: 'no_emails' };
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'noreply@society.psots.in',
        to: emailList,
        subject: subject,
        html: htmlContent
      })
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('Resend error:', err);
      return { success: false, reason: 'resend_failed', error: err };
    }

    return { success: true, count: emailList.length };
  } catch (err) {
    console.error('notifyAllAdmins error:', err);
    return { success: false, reason: 'error', error: err.message };
  }
}

// ── MODERATION FUNCTIONS ──────────────────────────────────────
async function checkWithGemini(message, contextMessages, geminiSettings, env) {
  const sensitivity = {
    low: 'Only flag clearly harmful content: hate speech, explicit threats, obvious spam.',
    medium: 'Flag harmful content, aggressive behavior, unsolicited promotions, suspicious links.',
    high: 'Flag anything disrupting community harmony including heated arguments.'
  }[geminiSettings.sensitivity || 'medium'];

  const prompt = `You are a moderator for Prestige Song of the South residential society in Bangalore.
${sensitivity}

CONVERSATION CONTEXT (last ${contextMessages.length} messages):
${contextMessages.map((m, i) => `[${i+1}] ${m.from}: ${m.text}`).join('\n')}

FLAGGED MESSAGE: ${message.from?.first_name}: ${message.text}

This was flagged by a keyword. Analyze FULL context. A resident saying "selling my car, son is critically ill" is GENUINE — pass it. Generic spam/ads/abuse should be flagged.

Respond in JSON only:
{"verdict":"pass"|"flag","reason":"1-2 sentences","confidence":"high"|"medium"|"low"}`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 200 }
      })
    });
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch (e) {
    console.error('Gemini error:', e);
    return { verdict: 'pass', reason: 'Gemini error — defaulting to pass', confidence: 'low' };
  }
}

async function moderateMessage(message, chatId, botToken, env) {
  const settings = parseFirestoreDoc(await firestoreGet(`group_settings/${chatId}`, env));
  if (!settings || !settings.botActive) return;

  // Build keyword list
  const PREDEFINED = {
    spam: ['spam', 'forward this', 'share this'],
    abuse: ['abuse keywords here'],
    links: ['http://', 'https://', 't.me/'],
    ads: ['for sale', 'buy now', 'discount', 'offer'],
    hate: ['hate keywords here']
  };
  const keywords = [];
  Object.entries(settings.keywords?.predefined || {}).forEach(([cat, enabled]) => {
    if (enabled && PREDEFINED[cat]) keywords.push(...PREDEFINED[cat]);
  });
  if (settings.keywords?.custom) keywords.push(...settings.keywords.custom);

  const msgText = message.text?.toLowerCase() || '';
  const matched = keywords.find(k => msgText.includes(k.toLowerCase()));
  if (!matched) return;

  // Gemini context check
  const context = await getRecentMessages(chatId, env.VIOLATIONS);
  let verdict = { verdict: 'flag', reason: 'Keyword match' };
  if (settings.gemini?.enabled) {
    verdict = await checkWithGemini(message, context, settings.gemini, env);
  }
  if (verdict.verdict === 'pass') return;

  // Delete message
  await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: message.message_id })
  });

  // Get/update violation count
  const userId = String(message.from.id);
  const violationPath = `violations/${chatId}/members/${userId}`;
  const violationDoc = parseFirestoreDoc(await firestoreGet(violationPath, env));
  const currentCount = violationDoc?.count || 0;
  const newCount = currentCount + 1;

  await firestoreSet(violationPath, {
    userId: message.from.id,
    username: message.from.username || '',
    name: `${message.from.first_name} ${message.from.last_name || ''}`.trim(),
    count: newCount,
    lastViolation: new Date().toISOString()
  }, env);

  // Determine warning delivery
  const dmThreshold = settings.warningMessages?.dmThreshold ?? 3;
  const sendInGroup = newCount > dmThreshold;

  // Get message template
  const levels = settings.warningMessages?.levels || DEFAULT_SETTINGS.warningMessages.levels;
  const levelConfig = [...levels].reverse().find(l => newCount >= l.atCount)
    || { text: '⚠️ Your message was removed for violating community guidelines.', muteMinutes: 0 };

  // Replace placeholders
  const warningText = levelConfig.text
    .replace(/{name}/g, message.from.first_name)
    .replace(/{count}/g, newCount)
    .replace(/{reason}/g, verdict.reason)
    .replace(/{profile}/g, 'society.psots.in/society/profile');

  // Send warning
  const targetChat = sendInGroup ? chatId : message.from.id;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: targetChat, text: warningText })
  });

  // Mute if configured
  if (levelConfig.muteMinutes > 0) {
    await fetch(`https://api.telegram.org/bot${botToken}/restrictChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId, user_id: message.from.id,
        permissions: { can_send_messages: false },
        until_date: Math.floor(Date.now() / 1000) + (levelConfig.muteMinutes * 60)
      })
    });
  }

  // Notify admin group
  const notifyAdmin = settings.warningMessages?.notifyAdminFrom ?? 1;
  if (newCount >= notifyAdmin) {
    const adminMsg = `🚨 <b>Moderation Alert</b>\n\nGroup: ${chatId}\nUser: @${message.from.username || message.from.first_name}\nViolation #${newCount}\nKeyword: "${matched}"\nGemini: ${verdict.reason}\n\nMessage: "${message.text?.substring(0, 150)}"\n\nAction: ${levelConfig.muteMinutes > 0 ? `Muted ${levelConfig.muteMinutes}min` : 'Warned'}\n\n⚠️ BAN requires manual admin action in Admin Panel.`;
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: -1001328126394, text: adminMsg, parse_mode: 'HTML' })
    }).catch(() => {});
  }
}

// ── PII MASKING FUNCTIONS ─────────────────────────────────────
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return local[0] + '***@' + domain;
}

function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const clean = phone.replace(/\D/g, '').slice(-10);
  if (clean.length < 6) return 'XXXXXX';
  return '+91 ' + clean.slice(0, 2) + 'XXX X' + clean.slice(-4);
}

function maskName(fullName) {
  if (!fullName || typeof fullName !== 'string') return '';
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return parts[0];
  return parts[0] + ' ' + parts[parts.length - 1][0] + '.';
}

function sanitizeForAdmin(resident) {
  if (!resident) return null;
  return {
    uid: resident.uid || '',
    flatNumber: resident.flatNumber || '',
    displayName: maskName(resident.name || resident.firstName || ''),
    relation: resident.relation || '',
    accessLevel: resident.accessLevel || 'owner',
    loginMethod: resident.loginMethod || '',
    status: resident.status || 'pending',
    createdAt: resident.createdAt || '',
    email: maskEmail(resident.email || ''),
    phone: maskPhone(resident.phone || ''),
    invitedByFlat: resident.invitedByFlat || '',
  };
}
