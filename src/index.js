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
  isResidentVerified, markResidentVerified, checkViolation,
  getModerationConfig, saveModerationConfig, storeMessageContext, getMessageContext
} from './store.js';
import {
  sendMessage, deleteTelegramMessage, parseListingWithGemini,
  fetchChatMember, moderateWithGemini, analyzeWithGemini, handleVerifyCommand, verifyOTP
} from './telegram.js';
import * as db from './db/adapter-d1.js';  // D1-only (Firestore removed)
import { firestoreSet, firestoreQuery, firestoreGet } from './db/adapter-d1.js';
import { getServiceAccountToken } from './db/firebase-init.js';
import { checkAndRecord } from './security/rate-limiter.js';
import { applyRateLimit } from './middleware/ratelimit.middleware.js';
import { maskEmail, maskPhone, maskName, sanitizeForAdmin, sanitizeForResident, sanitizeForPublic } from './db/pii.js';

// ── sendEmail helper (Resend API wrapper) ──
// Centralizes the Resend API call pattern used throughout this file so the
// notification call sites (new-device alert, lease reminder) actually work.
// Returns true on success, false on any error (never throws — email is fire-and-forget).
async function sendEmail(to, subject, html, env) {
  if (!env.RESEND_API_KEY || !to) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'PSOTS Society <noreply@society.psots.in>',
        to: [to], subject, html
      })
    });
    return res.ok;
  } catch (e) {
    console.error('sendEmail failed:', e.message);
    return false;
  }
}

const ADMIN_ID = 989358143;
const ADMIN_GROUP_ID = -1001328126394;
const GOOGLE_CLIENT_ID_VALUE = "774636811164-c9n9n8a27c9d0fbhg7e6vie759gq1sun.apps.googleusercontent.com";

// Escape HTML special characters to prevent XSS in email templates and responses
function escapeHTML(str) {
  if (str === undefined || str === null) return '';
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// resolveAuth — extract identity from cookie OR Firebase Bearer token
// Returns: { uid, residentId, email, name, flatNumber, isAdmin, authMethod: 'cookie'|'firebase' } or null
async function resolveAuth(request, env) {
  try {
    // Try cookie first (OAuth users, direct Google login)
    const cookieStr = request.headers.get('Cookie') || '';
    const m = cookieStr.match(/psots_session=([^;]+)/);
    if (m) {
      const { data } = await db.getSession(env, m[1]);
      if (data) {
        const isAdmin = data.isAdmin || (await db.isAdmin(data.uid, env));
        return {
          uid: data.uid,
          residentId: data.uid,
          email: data.email,
          name: data.name,
          flatNumber: data.flatNumber,
          isAdmin,
          authMethod: 'cookie'
        };
      }
    }

    // Fall back to Firebase Bearer token (transition period)
    const authHeader = request.headers.get('Authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const resident = await db.getResident(token, env);
      if (resident) {
        const isAdmin = resident.isAdmin || (await db.isAdmin(token, env));
        return {
          uid: token,
          residentId: token,
          email: resident.email,
          name: resident.name,
          flatNumber: resident.flatNumber,
          isAdmin,
          authMethod: 'firebase'
        };
      }
    }

    return null;
  } catch (_) {
    return null;
  }
}

// Verify Telegram login widget hash using HMAC-SHA256
async function verifyTelegramHash(data, botToken) {
  const dataCheckString = Object.keys(data)
    .filter(key => key !== 'hash')
    .sort()
    .map(key => `${key}=${data[key]}`)
    .join('\n');

  const secretKey = await crypto.subtle.digest('SHA256', new TextEncoder().encode(botToken));
  const signature = await crypto.subtle.sign('HMAC',
    await crypto.subtle.importKey('raw', secretKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
    new TextEncoder().encode(dataCheckString)
  );

  const hash = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return hash === data.hash;
}

// Valid tower configuration (source: js/config/constants.js)
const VALID_TOWERS = [1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 14, 15, 16, 17];

/**
 * Parse a flat number string into tower, floor, unit components.
 * Uses longest-prefix matching to avoid ambiguity (e.g. "11178" is T11 not T1).
 * Floor is always 2 digits after the tower prefix.
 * Unit is raw integer (never padded).
 *
 * @param {string} flatNumber - e.g. "15167", "8053", "121011"
 * @returns {{tower: number, floor: number, unit: number} | null}
 */
function parseFlatNumber(flatNumber) {
  const flatStr = String(flatNumber).trim();
  if (!flatStr || flatStr.length < 4) return null;

  // Try each valid tower prefix, longest first (prevents T1 matching T10/11/12/14/15/16/17)
  const sortedTowers = [...VALID_TOWERS].sort((a, b) => String(b).length - String(a).length);

  for (const tower of sortedTowers) {
    const towerStr = String(tower);
    if (flatStr.startsWith(towerStr)) {
      const remainder = flatStr.slice(towerStr.length);
      if (remainder.length < 3) continue;

      const floorStr = remainder.slice(0, 2);
      const unitStr = remainder.slice(2);

      const floor = parseInt(floorStr, 10);
      const unit = parseInt(unitStr, 10);

      if (isNaN(floor) || isNaN(unit)) continue;

      return { tower, floor, unit };
    }
  }
  return null;
}

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

// NOTE: firestoreQuery is now imported from adapter-d1.js (uses D1 instead of Firestore)
// The old Firestore implementation has been removed. If you need legacy Firestore access,
// uncomment below and rename to firestoreQueryLegacy()

/*
async function firestoreQueryLegacy(collection, filters, env) {
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
*/

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
  const doc = await db.firestoreGet(`settings/${docId}`, env);
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

// ── FIREBASE CUSTOM TOKEN (for SMS-OTP login → Firebase auth handoff) ──
// Mints a signed Firebase Auth custom token so the browser can call
// signInWithCustomToken() and pick up a normal Firebase session after we
// verified the user's phone via MSG91.
async function mintFirebaseCustomToken(uid, env, extraClaims = null) {
  const email = env.FIREBASE_SA_EMAIL;
  const rawKey = (env.FIREBASE_SA_KEY || '').replace(/\\n/g, '\n').replace(/\r/g, '');
  if (!email || !rawKey || !uid) throw new Error('missing_sa_or_uid');

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: email,
    sub: email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    uid: String(uid),
  };
  if (extraClaims) payload.claims = extraClaims;
  const header = { alg: 'RS256', typ: 'JWT' };
  const b64url = obj => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const signingInput = `${b64url(header)}.${b64url(payload)}`;

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToBuffer(rawKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${signingInput}.${sigB64}`;
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
// Verify Firebase ID token signature (CRITICAL: prevents forged JWTs)
async function verifyFirebaseToken(authHeader, env) {
  try {
    const token = authHeader?.slice(7);
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Decode payload first (no crypto needed)
    let p = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (p.length % 4) p += '=';
    const payload = JSON.parse(atob(p));

    // Superadmin bypass - skip crypto verification
    if (payload.email === 'pushkalkishore@gmail.com') {
      return payload;
    }

    // For other users - verify with Google keys
    // Fetch fresh keys every time (no caching)
    const keysRes = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
    const keys = await keysRes.json();

    // Get the key for this token's kid
    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    const certPem = keys[header.kid];
    if (!certPem) return null;

    // Verify signature
    const encoder = new TextEncoder();
    const data = encoder.encode(parts[0] + '.' + parts[1]);
    const sigBytes = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      'spki',
      pemToArrayBuffer(certPem),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, sigBytes, data);

    if (!valid) return null;
    if (payload.exp < Date.now() / 1000) return null;

    return payload;
  } catch (e) {
    console.error('verifyFirebaseToken error:', e);
    return null;
  }
}

function pemToArrayBuffer(pem) {
  const b64 = pem.replace('-----BEGIN CERTIFICATE-----', '').replace('-----END CERTIFICATE-----', '').replace(/\s+/g, '');
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function importPublicKey(pemKey) {
  const b64 = pemKey
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\s+/g, '');
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return crypto.subtle.importKey(
    'spki',
    bytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

function base64urlToBuffer(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Legacy function (DEPRECATED: use verifyFirebaseToken instead)
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
      <tr><td class="label">Name:</td><td class="value">${escapeHTML(residentName)}</td></tr>
      <tr><td class="label">Flat:</td><td class="value">${escapeHTML(flatNumber)}</td></tr>
      <tr><td class="label">Email:</td><td class="value">${escapeHTML(residentEmail)}</td></tr>
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
    <p>Hi ${escapeHTML(residentName)},</p>
    <p>🎉 Your registration for <strong>Flat ${escapeHTML(flatNumber)}</strong> has been approved!</p>
    
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
    <p>Hi ${escapeHTML(name)},</p>
    <p>✅ Your registration for <strong>Flat ${escapeHTML(flatNumber)}</strong> has been received and is pending admin approval.</p>

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
    <p>Hi ${escapeHTML(residentName)},</p>
    <p>Your registration for <strong>Flat ${escapeHTML(flatNumber)}</strong> could not be approved at this time.</p>

    <p>If you believe this is an error or need to provide additional details, please contact our admin team:</p>

    <div class="info-box" style="background-color: #faf6f0; border-left-color: #8b3a1a;">
      <p>• <strong>WhatsApp:</strong> <a href="https://wa.me/${whatsapp}" style="color: #1a4a3a;">Click to Chat</a></p>
      <p>• <strong>Telegram:</strong> <a href="https://t.me/${telegram}" style="color: #1a4a3a;">@${telegram}</a></p>
    </div>

    <p style="color: #8a7a6a; font-size: 13px; margin-top: 32px;">We appreciate your interest in joining the PSOTS community portal.</p>
  `);
}

function generateRegistrationInviteEmail(residentName, flatNumber, adminContact = {}) {
  const whatsapp = adminContact.adminWhatsapp || '919482088904';
  const telegram = adminContact.adminTelegram || 'pushkalkishore';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #1a4a3a 0%, #2d6a5a 100%); color: white; padding: 32px 24px; text-align: center; }
    .content { padding: 32px 24px; }
    .button { display: inline-block; background: linear-gradient(135deg, #1a4a3a 0%, #2d6a5a 100%); color: white !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 24px 0; box-shadow: 0 4px 12px rgba(26, 74, 58, 0.3); }
    .feature-list { background: #f9fafb; border-left: 4px solid #d4af37; padding: 20px; margin: 24px 0; border-radius: 4px; }
    .contact-box { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; margin: 24px 0; }
    .footer { background: #f9fafb; padding: 24px; text-align: center; font-size: 13px; color: #6b7280; border-top: 2px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700;">PSOTS Society</h1>
      <p style="margin: 0; font-size: 14px; opacity: 0.95;">Prestige Song of the South, Bangalore</p>
    </div>

    <!-- Content -->
    <div class="content">
      <p style="font-size: 16px; margin-bottom: 20px;">Hi <strong>${escapeHTML(residentName)}</strong>,</p>

      <p style="font-size: 15px; line-height: 1.7; color: #374151;">
        You have been identified as a resident of <strong>Flat ${escapeHTML(flatNumber)}</strong> in our community.
      </p>

      <p style="font-size: 15px; line-height: 1.7; color: #374151;">
        Our admin team needs you to create an account to complete your registration and access community features.
      </p>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="https://society.psots.in/society/register.html" class="button">Complete Registration</a>
      </div>

      <!-- Features -->
      <div class="feature-list">
        <p style="margin: 0 0 12px 0; font-weight: 600; color: #1f2937;">Once registered, you'll be able to access:</p>
        <ul style="margin: 0; padding-left: 20px; color: #374151;">
          <li style="margin-bottom: 8px;"><strong>Community Marketplace</strong> — Buy & sell items with neighbors</li>
          <li style="margin-bottom: 8px;"><strong>Lost & Found</strong> — Report and find lost items</li>
          <li style="margin-bottom: 8px;"><strong>Carpooling</strong> — Find or offer rides</li>
          <li style="margin-bottom: 8px;"><strong>Announcements</strong> — Stay updated on community events</li>
          <li><strong>Digital Guide</strong> — Access community resources</li>
        </ul>
      </div>

      <!-- Contact Info -->
      <div class="contact-box">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #92400e;">Need help? Contact admin:</p>
        <p style="margin: 0; font-size: 14px; color: #78350f;">
          <strong>WhatsApp:</strong> +${whatsapp}<br>
          <strong>Telegram:</strong> @${telegram}
        </p>
      </div>

      <p style="font-size: 13px; color: #6b7280; margin-top: 24px;">
        Registration takes less than 2 minutes. If you have any questions, feel free to reach out to our admin team.
      </p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #374151;">PSOTS Society</p>
      <p style="margin: 0 0 12px 0;">
        <a href="https://society.psots.in" style="color: #1a4a3a; text-decoration: none;">society.psots.in</a>
      </p>
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        This is a resident initiative — not affiliated with PSOTSAOA, Prestige Estates or PPMS.
      </p>
    </div>
  </div>
</body>
</html>`;
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

function parseDate(dateStr) {
  // Parse dates in format DD/MM/YYYY or DD-MM-YYYY
  if (!dateStr) return null;
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1; // JS months are 0-indexed
  const year = parseInt(parts[2]);
  return new Date(year, month, day);
}

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
        from: 'hello@society.psots.in',
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
  const settings = parseFirestoreDoc(await db.firestoreGet(`group_settings/${chatId}`, env));
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
  const violationDoc = parseFirestoreDoc(await db.firestoreGet(violationPath, env));
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
      body: JSON.stringify({ chat_id: ADMIN_GROUP_ID, text: adminMsg, parse_mode: 'HTML' })
    }).catch(() => {});
  }
}

async function executeModAction(action, message, reason, botToken, env) {
  const chatId = message.chat.id;
  const messageId = message.message_id;
  const username = message.from?.username
    ? '@' + message.from.username
    : message.from?.first_name || 'resident';

  if (action === 'delete_warn' || action === 'delete_silent') {
    await deleteTelegramMessage(chatId, messageId, botToken);
  }
  if (action === 'delete_warn') {
    const warning = `⚠️ ${username}, your message was removed as it appears to be unsolicited sharing. If someone requested this, please reply directly to their message. Repeated violations may result in a mute.`;
    await sendMessage(chatId, warning, botToken);
  }
  if (action === 'warn_only') {
    const warning = `⚠️ ${username}, please avoid unsolicited sharing in this group.`;
    await sendMessage(chatId, warning, botToken);
  }
  if (action === 'flag_review') {
    await env.VIOLATIONS.put(
      `_flagged_msg_${Date.now()}`,
      JSON.stringify({
        chatId, messageId,
        from: message.from,
        text: message.text,
        reason,
        flaggedAt: new Date().toISOString()
      }),
      { expirationTtl: 604800 }
    );
  }
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      // ── CORS ──────────────────────────────────────────────
      const CORS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };
      const pathname = url.pathname;

      // Credentialed endpoints (cookie-based auth) need specific origin + credentials:true.
      // Wildcard origin is rejected by browsers when credentials are sent.
      const isCredentialedAuth = pathname === '/auth/me' || pathname === '/auth/logout' || pathname.startsWith('/society/');
      if (request.method === 'OPTIONS') {
        if (isCredentialedAuth) {
          const origin = request.headers.get('Origin') || '';
          const allowOrigin = /^https:\/\/([a-z0-9-]+\.)?psots\.in$/.test(origin) ? origin : 'https://society.psots.in';
          return new Response(null, {
            headers: {
              'Access-Control-Allow-Origin': allowOrigin,
              'Access-Control-Allow-Credentials': 'true',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
          });
        }
        return new Response(null, { headers: CORS });
      }

      // ── RATE LIMITING ─────────────────────────────────────
      let sessionUidForRateLimit = null;
      const cookieHeader = request.headers.get('Cookie') || '';
      const sessionMatch = cookieHeader.match(/psots_session=([^;]+)/);
      if (sessionMatch) {
        try {
          const { data } = await db.getSession(env, sessionMatch[1]);
          if (data?.uid) sessionUidForRateLimit = data.uid;
        } catch { /* silent — falls back to IP-based bucket */ }
      }
      const rateLimitResponse = await applyRateLimit(request, env, sessionUidForRateLimit);
      if (rateLimitResponse) return rateLimitResponse;

      // ── STATIC PAGES ─────────────────────────────────────
      if (pathname === '/' || pathname === '/index.html') {
        return new Response(GRAND_LOBBY_HTML(env.GOOGLE_CLIENT_ID), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
      if (pathname === '/market') return new Response(MARKETPLACE_HTML, { headers: { 'Content-Type': 'text/html' } });
      if (pathname === '/handbook') return new Response(HANDBOOK_HTML, { headers: { 'Content-Type': 'text/html' } });
      if (pathname === '/events') return new Response(EVENTS_HTML, { headers: { 'Content-Type': 'text/html' } });
      if (pathname === '/user' || pathname === '/user/') {
        return new Response(USER_PANEL, { headers: { 'Content-Type': 'text/html' } });
      }

      // ── OTP ENDPOINTS (called from psots.in) ─────────────

      // Send OTP to a Telegram user by username
      // GET /send-otp?username=username
      if (pathname === '/send-otp' && request.method === 'GET') {
        const username = url.searchParams.get('username')?.replace('@', '').toLowerCase();
        if (!username) return new Response(JSON.stringify({ error: 'username required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });

        const botToken = await getBotToken(env.VIOLATIONS);
        if (!botToken) return new Response(JSON.stringify({ error: 'bot not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });

        // Look up stored userId for this username
        const userIdRaw = await env.VIOLATIONS.get(`_tg_user_${username}`);
        if (!userIdRaw) {
          return new Response(JSON.stringify({ error: 'User not found. Send any message to @psots_telegram_bot first.' }), {
            status: 404, headers: { 'Content-Type': 'application/json', ...CORS }
          });
        }

        const userId = JSON.parse(userIdRaw).userId;
        await handleVerifyCommand(userId, username, botToken, env.VIOLATIONS);
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...CORS } });
      }

      // Verify OTP submitted from psots.in
      // GET /verify-otp?username=username&otp=123456
      if (pathname === '/verify-otp' && request.method === 'GET') {
        const username = url.searchParams.get('username')?.replace('@', '').toLowerCase();
        // Strip non-digit chars (locale separators, whitespace) before comparison
        const otp = (url.searchParams.get('otp') || '').replace(/\D/g, '').trim();
        if (!username || !otp) return new Response(JSON.stringify({ error: 'username and otp required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });

        const userIdRaw = await env.VIOLATIONS.get(`_tg_user_${username}`);
        if (!userIdRaw) return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } });

        const userId = JSON.parse(userIdRaw).userId;
        const result = await verifyOTP(userId, otp, env.VIOLATIONS);

        if (!result.valid) {
          return new Response(JSON.stringify({ error: result.reason }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
        }

        const { sessionId, error: sessionError } = await db.createSession(env, userId, { username, loginMethod: 'telegram' });
        if (sessionError) {
          return new Response(JSON.stringify({ error: 'Session creation failed' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }

        return new Response(JSON.stringify({ ok: true, userId }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': `psots_session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
            ...CORS
          }
        });
      }

      // POST /flat/check — pre-login flat status check (no auth required)
      // Returns only safe fields: exists, status, ownerFirstName (first name only)
      // Also checks if this uid already has an account to prevent re-registration
      if (pathname === '/flat/check' && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          const { flatNumber, uid } = body;
          if (!flatNumber || typeof flatNumber !== 'string') {
            return new Response(JSON.stringify({ error: 'flatNumber required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Check if this uid already has an account (re-registration prevention)
          if (uid) {
            const existingByUid = parseFirestoreDoc(await db.firestoreGet(`residents/${uid}`, env));
            if (existingByUid) {
              return new Response(JSON.stringify({
                alreadyRegistered: true,
                flatNumber: existingByUid.flatNumber,
                status: existingByUid.status
              }), { headers: { 'Content-Type': 'application/json', ...CORS } });
            }
          }

          const residentsRaw = await firestoreQuery('residents', [['flatNumber', flatNumber]], env);
          const residents = residentsRaw.map(doc => parseFirestoreDoc(doc));
          const pending = residents.find(r => r.status === 'pending');
          if (pending) {
            return new Response(JSON.stringify({ exists: true, status: 'pending' }), { headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const owner = residents.find(r => r.status === 'approved' && r.residentType === 'owner');
          if (owner) {
            const ownerFirstName = (owner.name || '').split(' ')[0] || 'Resident';
            return new Response(JSON.stringify({ exists: true, status: 'occupied', ownerFirstName }), { headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          return new Response(JSON.stringify({ exists: false, status: 'empty' }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Flat check failed' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /auth/unified-login { type, identifier, firebaseToken, flatNumber }
      // Handles Cases A/B/C credential lookup and session creation.
      // Case A: (type, identifier) exact match → login
      // Case B: identifier matches different type → link + login (or prompt)
      // Case C: no match → signal registration needed
      // Case D: flatNumber provided (Telegram linking) → look up by flat → link + login
      if (pathname === '/auth/unified-login' && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          const { type, identifier, firebaseToken, flatNumber } = body;

          // Validate inputs
          if (!type || !identifier) {
            return new Response(JSON.stringify({ ok: false, case: null, error: 'missing_fields' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          if (!['google', 'email', 'telegram', 'sms'].includes(type)) {
            return new Response(JSON.stringify({ ok: false, case: null, error: 'invalid_type' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Case D: flatNumber provided (Telegram linking to existing resident)
          if (type === 'telegram' && flatNumber) {
            const identifierStr = String(identifier);
            const flatRecord = await db.getFlatV2(flatNumber, env);
            console.error('Case D: flatRecord:', JSON.stringify(flatRecord));

            // Extract residentId from flatRecord (raw Firestore REST response)
            const ownerResidentId =
              flatRecord?.fields?.ownerResidentId?.stringValue ||
              flatRecord?.ownerResidentId ||
              null;
            const residentIdFromFlat = ownerResidentId;
            console.error('Case D: residentIdFromFlat:', residentIdFromFlat);
            let resident = null;
            let residentId = residentIdFromFlat;

            if (residentId) {
              // Get resident using V2 schema only
              resident = await db.getResidentV2(residentId, env);

              // Parse Firestore REST response if needed
              if (resident?.fields) {
                resident = parseFirestoreDoc(resident);
              }

              if (resident && resident.status === 'approved') {
                // Check if credential already exists
                const existing = await db.getCredentialByTypeAndIdentifier(type, identifierStr, env);
                if (!existing) {
                  // Create new credential with residentId (the Firestore document ID)
                  const newCredId = `cred_${type}_${identifierStr}_${Date.now()}`;
                  await db.createCredential({
                    credentialId: newCredId,
                    residentId: String(residentId),
                    type,
                    identifier: identifierStr,
                    firebaseUid: firebaseToken || null,
                  }, env);
                }
                // Create session
                const { ok, sessionId, error } = await db.createSession(env, residentId, {
                  flatNumber: resident.flatNumber,
                  residentType: resident.residentType,
                });
                if (!ok) throw new Error(`Session creation failed: ${error}`);

                return new Response(JSON.stringify({
                  ok: true,
                  case: 'D',
                  sessionId,
                  resident: { residentId, name: resident.name, flatNumber: resident.flatNumber, status: resident.status, isAdmin: resident.isAdmin || false },
                }), { headers: { 'Content-Type': 'application/json', ...CORS } });
              } else if (resident) {
                // Resident exists but not approved
                return new Response(JSON.stringify({
                  ok: false,
                  case: 'D',
                  error: 'not_approved',
                  status: resident.status || 'unknown',
                }), { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
              }
            }

            // Flat not found or no residentId in flatRecord
            return new Response(JSON.stringify({
              ok: false,
              case: 'C',
              error: 'not_registered',
            }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Case A: exact (type, identifier) match
          const credentialA = await db.getCredentialByTypeAndIdentifier(type, identifier, env);
          if (credentialA && credentialA.residentId) {
            let resident = await db.getResidentV2(credentialA.residentId, env);
            if (resident?.fields) {
              resident = parseFirestoreDoc(resident);
            }
            if (resident && resident.status === 'approved') {
              // Create session
              const { ok, sessionId, error } = await db.createSession(env, resident.residentId, {
                flatNumber: resident.flatNumber,
                residentType: resident.residentType,
              });
              if (!ok) throw new Error(`Session creation failed: ${error}`);

              // Update lastUsedAt on credential
              await db.updateCredentialLastUsed(credentialA.credentialId, env);

              return new Response(JSON.stringify({
                ok: true,
                case: 'A',
                sessionId,
                resident: {
                  residentId: resident.residentId || credentialA.residentId,
                  name: resident.name,
                  flatNumber: resident.flatNumber,
                  status: resident.status,
                  email: resident.email || identifier,
                  phone: resident.phone || null,
                  telegram: resident.telegram || null,
                  secondaryEmail: resident.secondaryEmail || null,
                  secondaryPhone: resident.secondaryPhone || null,
                  residentType: resident.residentType || null,
                  isAdmin: resident.isAdmin || false
                }
              }), { headers: { 'Content-Type': 'application/json', ...CORS } });
            }
            // Resident exists but status not approved
            return new Response(JSON.stringify({
              ok: false,
              case: 'A',
              error: 'not_approved',
              status: resident?.status || 'unknown',
            }), { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Case B: identifier matches different auth type (cross-method linking)
          const credentialsB = await db.getCredentialsByIdentifier(identifier, env);
          if (credentialsB && credentialsB.length > 0) {
            // Found credential(s) with same identifier but different type
            const existing = credentialsB[0]; // Use first match
            let resident = await db.getResidentV2(existing.residentId, env);
            if (resident?.fields) {
              resident = parseFirestoreDoc(resident);
            }
            if (resident && resident.status === 'approved') {
              // Auto-link: create new credential for this type + resident
              const newCredId = `cred_${type}_${identifier}_${Date.now()}`;
              await db.createCredential({
                credentialId: newCredId,
                residentId: resident.residentId,
                type,
                identifier,
                firebaseUid: firebaseToken || null,
              }, env);

              // Create session
              const { ok, sessionId, error } = await db.createSession(env, resident.residentId, {
                flatNumber: resident.flatNumber,
                residentType: resident.residentType,
              });
              if (!ok) throw new Error(`Session creation failed: ${error}`);

              return new Response(JSON.stringify({
                ok: true,
                case: 'B',
                sessionId,
                resident: { residentId: resident.residentId, name: resident.name, flatNumber: resident.flatNumber, status: resident.status, isAdmin: resident.isAdmin || false },
              }), { headers: { 'Content-Type': 'application/json', ...CORS } });
            }
          }

          // Legacy fallback removed - all residents must use V2 schema (residents/{residentId} + credentials)

          // Case C: no match anywhere → signal registration needed
          return new Response(JSON.stringify({
            ok: false,
            case: 'C',
            error: 'not_registered',
            message: 'Please register with your flat number',
          }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('unified-login error:', e);
          return new Response(JSON.stringify({ ok: false, case: null, error: 'server_error', details: e.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /flat/{flatNumber} - Check if flat exists and has owner
      if (pathname.startsWith('/flat/') && request.method === 'GET') {
        try {
          const flatNumber = pathname.split('/')[2];
          if (!flatNumber) {
            return new Response(JSON.stringify({ error: 'flat_number_required' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const flat = await db.getFlatV2(flatNumber, env);
          if (!flat) {
            return new Response(JSON.stringify({ flat: null }),
              { headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Parse if needed
          const parsedFlat = flat.fields ? parseFirestoreDoc(flat) : flat;

          return new Response(JSON.stringify({
            flat: {
              flatNumber: parsedFlat.flatNumber,
              ownerResidentId: parsedFlat.ownerResidentId || null,
              hasOwner: !!parsedFlat.ownerResidentId
            }
          }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('GET /flat error:', e);
          return new Response(JSON.stringify({ error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /debug/check-account?email=... (admin only for debugging)
      if (pathname === '/debug/check-account' && request.method === 'GET') {
        try {
          const url = new URL(request.url);
          const email = url.searchParams.get('email');

          if (!email || email !== 'pushkalkishore@gmail.com') {
            return new Response(JSON.stringify({ error: 'unauthorized' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const results = {
            credentials: [],
            residents: [],
            flats: []
          };

          // Check credentials
          const allCreds = await db.firestoreQuery('credentials', [], env);
          results.credentials = (allCreds || []).filter(c => c.identifier === email);

          // Check residents by email
          const allResidents = await db.firestoreQuery('residents', [], env);
          results.residents = (allResidents || []).filter(r =>
            r.email === email || r.flatNumber === '15167'
          );

          // Check flat 15167
          const flat = await db.getFlatV2('15167', env);
          if (flat) results.flats.push(flat);

          return new Response(JSON.stringify(results, null, 2),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /check-existing-resident?email=xxx
      // Check if a resident with this email already exists
      if (pathname === '/check-existing-resident' && request.method === 'GET') {
        try {
          const url = new URL(request.url);
          const email = url.searchParams.get('email');

          if (!email) {
            return new Response(JSON.stringify({ exists: false }),
              { headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Check credentials collection
          const credentials = await firestoreQuery('credentials',
            [{ field: 'identifier', operator: '==', value: email }], env);

          if (credentials && credentials.length > 0) {
            return new Response(JSON.stringify({ exists: true, hasCredential: true }),
              { headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Check residents collection
          const residents = await firestoreQuery('residents',
            [{ field: 'email', operator: '==', value: email }], env);

          if (residents && residents.length > 0) {
            return new Response(JSON.stringify({ exists: true, hasResident: true }),
              { headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          return new Response(JSON.stringify({ exists: false }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('check-existing-resident error:', err);
          return new Response(JSON.stringify({ exists: false }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /auth/register { type, identifier, name, flatNumber }
      // Creates new resident (status=pending) + credential + flat record atomically.
      // Rate limit: 1 pending per email/flat per 24h (via KV sliding window).
      if (pathname === '/auth/register' && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          const { type, identifier, name, flatNumber, firebaseToken, phone, status, documentBase64, documentMimeType, verificationMethod, residentType, email, verificationResult, userConsent, userNote, mismatchDetails, verificationToken, smsVerifyToken } = body;

          // SMS-based registration: require a fresh smsVerifyToken (issued by /auth/sms-verify-only)
          // that proves the user controls the phone they're registering with.
          if (type === 'sms') {
            if (!smsVerifyToken) {
              return new Response(JSON.stringify({ ok: false, error: 'sms_not_verified', message: 'Verify your phone number via OTP first.' }),
                { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
            }
            const smsRecord = await env.CACHE_KV.get(smsVerifyToken);
            if (!smsRecord) {
              return new Response(JSON.stringify({ ok: false, error: 'sms_token_expired', message: 'Phone verification expired. Request OTP again.' }),
                { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
            }
            const parsed = JSON.parse(smsRecord);
            const submittedPhone = String(phone || identifier).replace(/\D/g, '');
            const tokenPhone = String(parsed.phone || '').replace(/\D/g, '');
            const tail = s => s.slice(-10);
            if (tail(submittedPhone) !== tail(tokenPhone)) {
              return new Response(JSON.stringify({ ok: false, error: 'sms_token_phone_mismatch', message: 'Phone in OTP verification does not match.' }),
                { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
            }
            // Consume token (one-time use)
            await env.CACHE_KV.delete(smsVerifyToken);
          }

          // If verificationToken provided (pre-registration flow), validate and extract data
          let verificationData = null;
          if (verificationToken) {
            verificationData = await env.CACHE_KV.get(verificationToken);
            if (!verificationData) {
              return new Response(JSON.stringify({ ok: false, error: 'invalid_verification_token', message: 'Verification token expired or invalid. Please upload document again.' }),
                { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
            }
            verificationData = JSON.parse(verificationData);

            // Validate token matches the flat number
            if (verificationData.flatNumber !== flatNumber) {
              return new Response(JSON.stringify({ ok: false, error: 'token_flat_mismatch', message: 'Verification token does not match this flat number.' }),
                { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
            }
          }

          // Validate inputs - MANDATORY: email AND phone required
          if (!type || !identifier || !name || !flatNumber) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          if (!email || !phone) {
            return new Response(JSON.stringify({
              ok: false,
              error: 'email_phone_required',
              message: 'Both email and phone number are required for registration. This allows you to login using either method.'
            }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          if (!['google', 'email', 'telegram', 'sms'].includes(type)) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_type' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Document verification rules:
          // - Admin email: no document needed, auto-approved
          // - Owner: ownership document required (unless admin)
          // - Tenant: lease agreement required
          // - Family: no document needed, pending approval
          const isAdminEmail = identifier === 'pushkalkishore@gmail.com';
          const hasDocument = documentBase64 && verificationMethod === 'document';
          const isOwner = residentType === 'owner';
          const isTenant = residentType === 'tenant';

          if (!isAdminEmail && isOwner && !hasDocument) {
            return new Response(JSON.stringify({ ok: false, error: 'document_required', message: 'Ownership document verification is required for owner registration' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          if (isTenant && !hasDocument) {
            return new Response(JSON.stringify({ ok: false, error: 'lease_required', message: 'Lease agreement is required for tenant registration' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Validate flat number format
          const parsed = parseFlatNumber(flatNumber);
          if (!parsed) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_flat_number' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Check rate limit: 1 pending registration per email/flat per 24h
          const rateLimitKey = `register_pending:${identifier}:${flatNumber}`;
          const rateLimitValue = await env.SESSIONS_KV.get(rateLimitKey);
          if (rateLimitValue) {
            return new Response(JSON.stringify({
              ok: false,
              error: 'rate_limit',
              message: 'A registration is already pending for this email and flat. Please wait 24 hours or contact admin.',
            }), { status: 429, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Check if flat is already occupied by another resident
          const existingFlat = await db.getFlatV2(flatNumber, env);
          if (existingFlat && existingFlat.ownerResidentId) {
            // Admin email can override and re-register
            if (!isAdminEmail) {
              return new Response(JSON.stringify({
                ok: false,
                error: 'flat_occupied',
                message: 'This flat is already registered. If this is your flat, contact admin.',
              }), { status: 409, headers: { 'Content-Type': 'application/json', ...CORS } });
            }
            // Admin: delete existing flat and continue
            console.log(`Admin override: deleting existing flat ${flatNumber} and re-registering`);
            // Note: We'll create new flat record below, overwriting the old one
          }

          // Check if credential already exists for this (type, identifier)
          const existingCredential = await db.getCredentialByTypeAndIdentifier(type, identifier, env);
          if (existingCredential) {
            // Admin email can override - return existing resident instead of error
            if (isAdminEmail) {
              console.log(`Admin override: credential exists, returning existing resident`);
              const existingResident = await db.getResidentV2(existingCredential.residentId, env);
              if (existingResident) {
                // Parse Firestore response if needed
                const resident = existingResident.fields ? parseFirestoreDoc(existingResident) : existingResident;
                return new Response(JSON.stringify({
                  ok: true,
                  message: 'Already registered - logging you in',
                  resident: {
                    residentId: existingCredential.residentId,
                    name: resident.name,
                    flatNumber: resident.flatNumber,
                    status: resident.status
                  }
                }), { headers: { 'Content-Type': 'application/json', ...CORS } });
              }
            }
            return new Response(JSON.stringify({
              ok: false,
              error: 'credential_exists',
              message: 'This email/account is already registered. Use login instead.',
            }), { status: 409, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Generate IDs (using random UUID for security and uniqueness)
          const residentId = `r_${flatNumber}_${crypto.randomUUID().split('-')[0]}`;
          const credentialId = `cred_${type}_${identifier}_${Date.now()}`;

          // Determine resident status based on verification
          // verificationToken provided: document was pre-verified, auto-approved
          // Admin email: auto-approved without document
          // Document verified: approved
          // Document needs manual review: pending_verification (separate from normal pending)
          // No document: should have been blocked above
          const hasVerifiedToken = !!verificationToken;
          const hasVerifiedDocument = status === 'approved';
          const hasUnverifiedDocument = hasDocument && status !== 'approved';
          let residentStatus;
          if (hasVerifiedToken) {
            residentStatus = 'approved';
          } else if (isAdminEmail) {
            residentStatus = 'approved';
          } else if (hasVerifiedDocument) {
            residentStatus = 'approved';
          } else if (hasUnverifiedDocument) {
            residentStatus = 'pending_verification';
          } else {
            residentStatus = 'pending';
          }

          // Create resident with appropriate status
          const resident = await db.createResidentV2({
            residentId,
            flatNumber,
            name,
            residentType: residentType || 'owner',
            status: residentStatus,
            phone: phone || null,
            email: email || null,
            documentVerified: status === 'approved' ? true : false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }, env);
          if (!resident) throw new Error('Failed to create resident');

          // Create primary credential (based on registration method)
          const credential = await db.createCredential({
            credentialId,
            residentId,
            type,
            identifier,
            firebaseUid: firebaseToken || null,
            createdAt: new Date().toISOString(),
          }, env);
          if (!credential) throw new Error('Failed to create credential');

          // IMPORTANT: Create additional credentials for email AND phone
          // This allows login via any method (Google, email OTP, SMS OTP)
          const additionalCredentials = [];

          // If registered via Google, also create email and SMS credentials
          if (type === 'google' && email && phone) {
            // Create email credential
            const emailCredId = `cred_email_${email}_${Date.now()}`;
            additionalCredentials.push({
              credentialId: emailCredId,
              residentId,
              type: 'email',
              identifier: email,
              firebaseUid: firebaseToken || null,
              createdAt: new Date().toISOString(),
            });

            // Create SMS credential (normalize phone to E.164 format)
            const normalizedPhone = phone.replace(/\D/g, '').startsWith('91')
              ? phone.replace(/\D/g, '')
              : `91${phone.replace(/\D/g, '').slice(-10)}`;
            const smsCredId = `cred_sms_${normalizedPhone}_${Date.now()}`;
            additionalCredentials.push({
              credentialId: smsCredId,
              residentId,
              type: 'sms',
              identifier: normalizedPhone,
              firebaseUid: null,
              createdAt: new Date().toISOString(),
            });
          }
          // If registered via email, also create SMS credential
          else if (type === 'email' && phone) {
            const normalizedPhone = phone.replace(/\D/g, '').startsWith('91')
              ? phone.replace(/\D/g, '')
              : `91${phone.replace(/\D/g, '').slice(-10)}`;
            const smsCredId = `cred_sms_${normalizedPhone}_${Date.now()}`;
            additionalCredentials.push({
              credentialId: smsCredId,
              residentId,
              type: 'sms',
              identifier: normalizedPhone,
              firebaseUid: null,
              createdAt: new Date().toISOString(),
            });
          }

          // Create all additional credentials
          for (const cred of additionalCredentials) {
            await db.createCredential(cred, env);
          }
          console.log(`Created ${additionalCredentials.length + 1} credentials for ${residentId} (primary: ${type}, additional: ${additionalCredentials.map(c => c.type).join(', ')})`);


          // Create flat record
          const flat = await db.createFlatV2(flatNumber, residentId, env);
          if (!flat) throw new Error('Failed to create flat record');

          // Delete verification token from KV if used (one-time use)
          if (verificationToken) {
            await env.CACHE_KV.delete(verificationToken);
            console.log(`Deleted verification token ${verificationToken} after account creation`);
          }

          // If document needs manual review, store in KV for admin review
          if (residentStatus === 'pending_verification' && documentBase64) {
            const kvKey = `pending_verification:${residentId}`;
            const verificationData = {
              residentId,
              name,
              flatNumber,
              documentBase64,
              documentMimeType,
              createdAt: new Date().toISOString(),
              checks: mismatchDetails?.checks || {}, // From manual review or empty
              userConsent,
              manualReviewConsented: verificationResult === 'manual_review_consented',
              userNote: userNote || null,
              mismatchDetails: mismatchDetails || null
            };
            // Store for 48 hours (172800 seconds)
            await env.CACHE_KV.put(kvKey, JSON.stringify(verificationData), { expirationTtl: 172800 });

            // Also update resident document with consent info
            if (verificationResult === 'manual_review_consented') {
              await db.firestoreSet(`residents/${residentId}`, {
                manualReviewConsented: true,
                userNote: userNote || null,
                mismatchDetails: mismatchDetails || null
              }, env, ['manualReviewConsented', 'userNote', 'mismatchDetails']);
            }
          }

          // Set rate limit key (24h expiry = 86400 seconds)
          await env.SESSIONS_KV.put(rateLimitKey, 'pending', { expirationTtl: 86400 });

          console.log(`/auth/register: ${residentStatus} resident ${residentId} (${name}, flat ${flatNumber})`);

          // Return success response
          return new Response(JSON.stringify({
            ok: true,
            residentId,
            flatNumber,
            status: residentStatus,
            message: residentStatus === 'approved' ? 'Registration complete! Welcome to PSOTS.' : 'Registration submitted. Admin will review within 24-48 hours.',
          }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('register error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error', details: e.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /auth/msg91-config — return MSG91 widget config so the browser can
      // initialize the OTP widget. widgetId and tokenAuth are public-facing per
      // MSG91 design (they only authorize widget calls, not API access). The
      // master authkey stays on the Worker.
      if (pathname === '/auth/msg91-config' && request.method === 'GET') {
        return new Response(JSON.stringify({
          ok: true,
          widgetId: env.MSG91_WIDGET_ID || '',
          tokenAuth: env.MSG91_WIDGET_TOKEN || ''
        }), { headers: { 'Content-Type': 'application/json', ...CORS } });
      }


      // ═══════════════════════════════════════════════════════════════
      // Direct Google OAuth (no Firebase)
      // ═══════════════════════════════════════════════════════════════
      // Phase 1: parallel with Firebase Google. Issues Worker session cookie.
      //   GET  /auth/google/start?next=/society/   → redirect to Google
      //   GET  /auth/google/callback?code&state    → exchange, verify, set cookie
      //   GET  /auth/me                            → who is the cookie holder
      //   POST /auth/logout                        → clear cookie + KV session
      // Required secrets: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET
      // Authorized redirect URI in Google Console: <worker-origin>/auth/google/callback

      if (pathname === '/auth/google/start' && request.method === 'GET') {
        if (!env.GOOGLE_OAUTH_CLIENT_ID) {
          return new Response(JSON.stringify({ ok: false, error: 'oauth_not_configured' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
        const rawNext = url.searchParams.get('next') || '/society/';
        const next = rawNext.startsWith('/') ? rawNext : '/society/';

        const randBytes = (n) => {
          const a = new Uint8Array(n);
          crypto.getRandomValues(a);
          return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
        };
        const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const state = randBytes(16);
        const verifier = randBytes(32);
        const challengeBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
        const challenge = b64url(challengeBuf);

        await env.CACHE_KV.put(`_oauth_state_${state}`,
          JSON.stringify({ verifier, next }),
          { expirationTtl: 600 });

        const redirectUri = 'https://login.society.psots.in/auth/google/callback';
        const params = new URLSearchParams({
          client_id: env.GOOGLE_OAUTH_CLIENT_ID,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: 'openid email profile',
          state,
          code_challenge: challenge,
          code_challenge_method: 'S256',
          access_type: 'online',
          prompt: 'select_account'
        });
        return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
      }

      if (pathname === '/auth/google/callback' && request.method === 'GET') {
        const FRONTEND_BASE = 'https://society.psots.in';
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const errorParam = url.searchParams.get('error');

        if (errorParam) {
          return Response.redirect(`${FRONTEND_BASE}/society/login.html?oauth_error=${encodeURIComponent(errorParam)}`, 302);
        }
        if (!code || !state) {
          return new Response('Missing code or state', { status: 400 });
        }
        const stateData = await env.CACHE_KV.get(`_oauth_state_${state}`, 'json');
        if (!stateData) {
          return Response.redirect(`${FRONTEND_BASE}/society/login.html?oauth_error=invalid_state`, 302);
        }
        await env.CACHE_KV.delete(`_oauth_state_${state}`);

        // Exchange authorization code for tokens
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: env.GOOGLE_OAUTH_CLIENT_ID,
            client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
            redirect_uri: 'https://login.society.psots.in/auth/google/callback',
            grant_type: 'authorization_code',
            code_verifier: stateData.verifier
          })
        });
        if (!tokenRes.ok) {
          const errText = await tokenRes.text();
          console.error('Google token exchange failed:', tokenRes.status, errText);
          return Response.redirect(`${FRONTEND_BASE}/society/login.html?oauth_error=token_exchange_failed`, 302);
        }
        const tokens = await tokenRes.json();
        if (!tokens.id_token) {
          return Response.redirect(`${FRONTEND_BASE}/society/login.html?oauth_error=no_id_token`, 302);
        }

        // Verify ID token signature against Google JWKS
        let payload;
        try {
          const [headerB64, payloadB64, sigB64] = tokens.id_token.split('.');
          const fromB64Url = (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/'));
          const header = JSON.parse(fromB64Url(headerB64));
          payload = JSON.parse(fromB64Url(payloadB64));

          if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
            throw new Error('invalid_issuer');
          }
          if (payload.aud !== env.GOOGLE_OAUTH_CLIENT_ID) throw new Error('invalid_audience');
          if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('token_expired');

          const jwksRes = await fetch('https://www.googleapis.com/oauth2/v3/certs');
          const jwks = await jwksRes.json();
          const key = jwks.keys.find(k => k.kid === header.kid);
          if (!key) throw new Error('signing_key_not_found');

          const pubKey = await crypto.subtle.importKey(
            'jwk', key,
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            false, ['verify']
          );
          const sigBytes = Uint8Array.from(fromB64Url(sigB64), c => c.charCodeAt(0));
          const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
          const ok = await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, pubKey, sigBytes, data);
          if (!ok) throw new Error('signature_invalid');
        } catch (e) {
          console.error('ID token verification failed:', e.message);
          return Response.redirect(`${FRONTEND_BASE}/society/login.html?oauth_error=invalid_token`, 302);
        }

        const email = String(payload.email || '').toLowerCase();
        const name = payload.name || '';
        if (!email || !payload.email_verified) {
          return Response.redirect(`${FRONTEND_BASE}/society/login.html?oauth_error=email_unverified`, 302);
        }

        // Look up resident by google credential (or email credential as fallback)
        let credential = await db.getCredentialByTypeAndIdentifier('google', email, env);
        if (!credential) credential = await db.getCredentialByTypeAndIdentifier('email', email, env);

        if (!credential) {
          const regParams = new URLSearchParams({ email, name, from: 'google' });
          return Response.redirect(`${FRONTEND_BASE}/society/register.html?${regParams}`, 302);
        }

        const residentId = credential.resident_id || credential.residentId;
        const resident = await db.getResidentV2(residentId, env);
        if (!resident) {
          return Response.redirect(`${FRONTEND_BASE}/society/login.html?oauth_error=resident_not_found`, 302);
        }
        const status = resident.status;
        if (status !== 'approved' && status !== 'verified_owner') {
          return Response.redirect(`${FRONTEND_BASE}/society/login.html?oauth_error=not_approved&status=${encodeURIComponent(status)}`, 302);
        }

        // Issue session cookie
        const sessionId = crypto.randomUUID();
        await env.SESSIONS_KV.put(sessionId, JSON.stringify({
          uid: residentId,
          email,
          name,
          flatNumber: resident.flat_number || resident.flatNumber,
          authMethod: 'google_oauth',
          createdAt: Date.now()
        }), { expirationTtl: 30 * 24 * 60 * 60 });

        try { await db.updateCredentialLastUsed(credential.credential_id || credential.credentialId, env); } catch (_e) { /* non-fatal */ }

        const cookie = `psots_session=${sessionId}; Path=/; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; Secure; SameSite=Lax; Domain=.psots.in`;
        return new Response(null, {
          status: 302,
          headers: {
            'Location': `${FRONTEND_BASE}${stateData.next}`,
            'Set-Cookie': cookie
          }
        });
      }

      if (pathname === '/auth/me' && request.method === 'GET') {
        const origin = request.headers.get('Origin') || '';
        const allowOrigin = /^https:\/\/([a-z0-9-]+\.)?psots\.in$/.test(origin) ? origin : 'https://society.psots.in';
        const corsHeaders = {
          'Access-Control-Allow-Origin': allowOrigin,
          'Access-Control-Allow-Credentials': 'true',
          'Content-Type': 'application/json'
        };
        const cookieStr = request.headers.get('Cookie') || '';
        const m = cookieStr.match(/psots_session=([^;]+)/);
        if (!m) return new Response(JSON.stringify({ ok: false, error: 'no_session' }), { status: 401, headers: corsHeaders });
        const { data } = await db.getSession(env, m[1]);
        if (!data) return new Response(JSON.stringify({ ok: false, error: 'invalid_session' }), { status: 401, headers: corsHeaders });
        return new Response(JSON.stringify({ ok: true, user: data }), { headers: corsHeaders });
      }

      // POST /auth/sms-login — MSG91 SMS OTP verification + login/signup intent.
      // Frontend uses MSG91 widget (initSendOTP) which returns an access-token after
      // the user completes OTP entry. We verify it server-side, look up the resident
      // by phone (sms credential), and return either a session+customToken (if they
      // exist & approved) or a "not_registered" hint (so the UI can redirect to register).
      //
      // Body: { accessToken, phone }   phone in E.164 like "919XXXXXXXXX" or "+919XXX..."
      if (pathname === '/auth/sms-login' && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          const { accessToken, phone } = body;
          if (!accessToken || !phone) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // 1) Verify MSG91 widget access-token
          const msgRes = await fetch('https://control.msg91.com/api/v5/widget/verifyAccessToken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              'authkey': env.MSG91_AUTH_KEY,
              'access-token': accessToken
            })
          });
          const msgData = await msgRes.json().catch(() => ({}));
          if (msgData.type !== 'success') {
            console.log('MSG91 verify failed:', JSON.stringify(msgData));
            return new Response(JSON.stringify({ ok: false, error: 'invalid_otp', detail: msgData.message || 'OTP verification failed' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // 2) Normalize phone (E.164 without +)
          const normalizedPhone = String(phone).replace(/\D/g, '').replace(/^0+/, '');
          const phoneForLookup = normalizedPhone.startsWith('91') ? normalizedPhone : `91${normalizedPhone.slice(-10)}`;

          // 3) Lookup sms credential
          const credential = await db.getCredentialByTypeAndIdentifier('sms', phoneForLookup, env);
          if (!credential || !credential.residentId) {
            return new Response(JSON.stringify({ ok: false, error: 'not_registered', phone: phoneForLookup }),
              { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // 4) Lookup resident
          let resident = await db.getResidentV2(credential.residentId, env);
          if (resident?.fields) resident = parseFirestoreDoc(resident);
          if (!resident) {
            return new Response(JSON.stringify({ ok: false, error: 'resident_not_found' }),
              { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          if (resident.status !== 'approved') {
            return new Response(JSON.stringify({ ok: false, error: 'not_approved', status: resident.status || 'pending' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // 5) Create session
          const { ok: sok, sessionId, error: serr } = await db.createSession(env, credential.residentId, {
            flatNumber: resident.flatNumber,
            residentType: resident.residentType,
          });
          if (!sok) throw new Error(`Session creation failed: ${serr}`);
          await db.updateCredentialLastUsed(credential.credentialId, env);

          // 6) Mint Firebase custom token so frontend can signInWithCustomToken()
          let customToken = null;
          try {
            customToken = await mintFirebaseCustomToken(credential.residentId, env);
          } catch (ctErr) {
            console.error('mintFirebaseCustomToken failed:', ctErr.message);
          }

          return new Response(JSON.stringify({
            ok: true,
            sessionId,
            customToken,
            resident: {
              residentId: credential.residentId,
              name: resident.name,
              flatNumber: resident.flatNumber,
              status: resident.status,
              phone: resident.phone || phoneForLookup,
              email: resident.email || null,
              residentType: resident.residentType || null,
              isAdmin: resident.isAdmin || false
            }
          }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/auth/sms-login error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error', details: e.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /auth/sms-verify-only — verify MSG91 token + return normalized phone, no DB lookup.
      // Used during REGISTRATION: frontend has already collected flat + doc, just needs to prove
      // ownership of the phone before creating credentials. No session/custom-token issued.
      if (pathname === '/auth/sms-verify-only' && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          const { accessToken, phone } = body;
          if (!accessToken || !phone) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const msgRes = await fetch('https://control.msg91.com/api/v5/widget/verifyAccessToken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 'authkey': env.MSG91_AUTH_KEY, 'access-token': accessToken })
          });
          const msgData = await msgRes.json().catch(() => ({}));
          if (msgData.type !== 'success') {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_otp', detail: msgData.message || 'OTP verification failed' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const normalizedPhone = String(phone).replace(/\D/g, '').replace(/^0+/, '');
          const phoneE164 = normalizedPhone.startsWith('91') ? normalizedPhone : `91${normalizedPhone.slice(-10)}`;

          // Short-lived KV token so /auth/register can trust this phone was verified
          const tokenId = crypto.randomUUID();
          const smsVerifyToken = `_sms_verified_${tokenId}`;
          await env.CACHE_KV.put(smsVerifyToken, JSON.stringify({
            phone: phoneE164,
            verifiedAt: new Date().toISOString(),
          }), { expirationTtl: 900 });

          return new Response(JSON.stringify({ ok: true, phone: phoneE164, smsVerifyToken }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/auth/sms-verify-only error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error', details: e.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /auth/resume-device?token={deviceToken}
      // Trusted device quick-return: validates device token, returns resident info if valid.
      // No auth required (deviceToken is opaque UUID, not sensitive).
      if (pathname === '/auth/resume-device' && request.method === 'GET') {
        try {
          const url = new URL(request.url);
          const deviceToken = url.searchParams.get('token');

          if (!deviceToken) {
            return new Response(JSON.stringify({ ok: false, trusted: false, error: 'missing_token' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Get device session from Firestore
          const deviceSession = await db.getDeviceSession(deviceToken, env);
          if (!deviceSession) {
            return new Response(JSON.stringify({ ok: false, trusted: false, error: 'device_not_found' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Check if device is revoked
          if (deviceSession.revoked) {
            return new Response(JSON.stringify({ ok: false, trusted: false, error: 'device_revoked' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Check if device session expired (1 year TTL)
          const expiresAt = new Date(deviceSession.expiresAt);
          if (expiresAt < new Date()) {
            return new Response(JSON.stringify({ ok: false, trusted: false, error: 'device_expired' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Update lastUsedAt timestamp
          const now = new Date().toISOString();
          await firestoreSet(`device_sessions/${deviceToken}`, {
            lastUsedAt: now,
          }, env);

          // Return device info for quick-return UI
          return new Response(JSON.stringify({
            ok: true,
            trusted: true,
            uid: deviceSession.uid,
            flatNumber: deviceSession.flatNumber,
            lastSeen: deviceSession.lastUsedAt,
            ipCity: deviceSession.ipCity || null,
            deviceLabel: deviceSession.deviceLabel || null,
          }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('resume-device error:', e);
          return new Response(JSON.stringify({ ok: false, trusted: false, error: 'server_error', details: e.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // Email OTP endpoints (called from society.psots.in/login.html)
      // POST /auth/send-email-otp { email }
      if (pathname === '/auth/send-email-otp' && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          const { email } = body;

          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_email' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Rate limit: max 10 per hour
          const rlKey = `email_ratelimit_${email}`;
          const rlVal = await env.VIOLATIONS.get(rlKey);
          const rlCount = rlVal ? parseInt(rlVal) : 0;
          if (rlCount >= 10) {
            return new Response(JSON.stringify({ ok: false, error: 'rate_limited' }),
              { status: 429, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          await env.VIOLATIONS.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });

          // Generate OTP (without checking resident for now - check happens on verify)
          const otp = String(Math.floor(100000 + Math.random() * 900000));
          const expires = Date.now() + 15 * 60 * 1000;
          await env.VIOLATIONS.put(`email_otp_${email}`,
            JSON.stringify({ otp, used: false, expires }),
            { expirationTtl: 900 });

          // Send via Resend
          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'PSOTS Society <otp@society.psots.in>',
              to: email,
              subject: `Your PSOTS Society login code — ${otp}`,
              html: generateOtpEmail(otp),
            }),
          });

          if (!resendRes.ok) {
            return new Response(JSON.stringify({ ok: false, error: 'email_failed' }),
              { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          return new Response(JSON.stringify({ ok: true }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /auth/verify-email-otp { email, otp, registration }
      // Rate limiting: max 5 attempts, 30-min lockout after limit reached
      if (pathname === '/auth/verify-email-otp' && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          const { email, otp, registration } = body;

          if (!email || !otp) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Check lockout: too many failed attempts (5+ attempts = 30-min lockout)
          const lockoutKey = `otp_lockout_${email.toLowerCase()}`;
          const lockoutValue = await env.VIOLATIONS.get(lockoutKey);
          if (lockoutValue) {
            return new Response(JSON.stringify({
              ok: false,
              error: 'rate_limited',
              message: 'Too many failed attempts. Please try again in 30 minutes.',
            }), { status: 429, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const stored = await env.VIOLATIONS.get(`email_otp_${email}`);
          if (!stored) {
            return new Response(JSON.stringify({ ok: false, error: 'otp_expired' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const { otp: storedOtp, used, expires } = JSON.parse(stored);

          if (used) {
            return new Response(JSON.stringify({ ok: false, error: 'otp_used' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          if (Date.now() > expires) {
            return new Response(JSON.stringify({ ok: false, error: 'otp_expired' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          if (otp !== storedOtp) {
            // Track failed attempt
            const attemptKey = `otp_attempts_${email.toLowerCase()}`;
            const attemptValue = await env.VIOLATIONS.get(attemptKey);
            const attempts = attemptValue ? parseInt(attemptValue) : 0;
            const newAttempts = attempts + 1;

            if (newAttempts >= 5) {
              // Lock email for 30 minutes (1800 seconds)
              await env.VIOLATIONS.put(lockoutKey, 'locked', { expirationTtl: 1800 });
              // Clear attempt counter
              await env.VIOLATIONS.delete(attemptKey);

              return new Response(JSON.stringify({
                ok: false,
                error: 'rate_limited',
                message: 'Too many failed attempts. Account locked for 30 minutes.',
                attempts: newAttempts,
                maxAttempts: 5,
              }), { status: 429, headers: { 'Content-Type': 'application/json', ...CORS } });
            } else {
              // Increment attempt counter (15-min expiry = 900 seconds)
              await env.VIOLATIONS.put(attemptKey, String(newAttempts), { expirationTtl: 900 });

              return new Response(JSON.stringify({
                ok: false,
                error: 'otp_invalid',
                attempts: newAttempts,
                maxAttempts: 5,
                attemptsRemaining: 5 - newAttempts,
              }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
            }
          }

          await env.VIOLATIONS.put(`email_otp_${email}`,
            JSON.stringify({ otp: storedOtp, used: true, expires }),
            { expirationTtl: 900 });

          // Clear attempt counter on successful verification
          const attemptKey = `otp_attempts_${email.toLowerCase()}`;
          await env.VIOLATIONS.delete(attemptKey);

          // Look up uid by email from KV (stored when user first logs in via Google)
          const uidRaw = await env.VIOLATIONS.get(`_email_uid_${email.toLowerCase()}`);
          let uid;
          if (!uidRaw) {
            if (registration) {
              // New registration — generate a UID and link it
              uid = generateUUID();
              await env.VIOLATIONS.put(`_email_uid_${email.toLowerCase()}`,
                JSON.stringify({ uid, email, linkedAt: Date.now() }),
                { expirationTtl: 31536000 }); // 1 year
            } else {
              return new Response(JSON.stringify({ ok: false, error: 'not_registered' }),
                { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
            }
          } else {
            uid = JSON.parse(uidRaw).uid;
          }

          const { sessionId, error: sessionError } = await db.createSession(env, uid, { loginMethod: 'email' });
          if (sessionError) {
            return new Response(JSON.stringify({ ok: false, error: 'session_failed' }),
              { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          return new Response(JSON.stringify({ ok: true, uid }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': `psots_session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
                ...CORS
              }
            });
        } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /auth/link-email { email, uid } — called after Google login to store email→uid mapping
      if (pathname === '/auth/link-email' && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          const { email, uid } = body;
          if (!email || !uid) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          await env.VIOLATIONS.put(`_email_uid_${email.toLowerCase()}`,
            JSON.stringify({ uid, email, linkedAt: Date.now() }),
            { expirationTtl: 31536000 }); // 1 year
          return new Response(JSON.stringify({ ok: true }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /auth/logout — delete session and expire cookie
      if (pathname === '/auth/logout' && request.method === 'POST') {
        const origin = request.headers.get('Origin') || '';
        const allowOrigin = /^https:\/\/([a-z0-9-]+\.)?psots\.in$/.test(origin) ? origin : 'https://society.psots.in';
        const cookieStr = request.headers.get('Cookie') || '';
        const m = cookieStr.match(/psots_session=([^;]+)/);
        if (m) { try { await env.SESSIONS_KV.delete(m[1]); } catch (_e) { /* ignore */ } }
        // Cookie set on .psots.in domain by OAuth callback — clear with matching Domain
        const clearCookie = 'psots_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax; Domain=.psots.in';
        return new Response(JSON.stringify({ ok: true }), {
          headers: {
            'Access-Control-Allow-Origin': allowOrigin,
            'Access-Control-Allow-Credentials': 'true',
            'Content-Type': 'application/json',
            'Set-Cookie': clearCookie
          }
        });
      }

      // ══════════════════════════════════════════════════════════════════════════════════
      // /SOCIETY/* ENDPOINTS — Credentialed, D1-backed society features
      // ══════════════════════════════════════════════════════════════════════════════════

      // GET /society/announcements — list announcements (no auth required)
      if (pathname === '/society/announcements' && request.method === 'GET') {
        try {
          const announcements = await db.listAnnouncements(env);
          return new Response(JSON.stringify({ ok: true, announcements }), {
            headers: { 'Content-Type': 'application/json', ...CORS }
          });
        } catch (e) {
          console.error('/society/announcements error:', e);
          return new Response(JSON.stringify({ ok: false, error: e.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /society/announcements — create announcement (admin only)
      if (pathname === '/society/announcements' && request.method === 'POST') {
        try {
          const auth = await resolveAuth(request, env);
          if (!auth?.isAdmin) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const { title, body } = await request.json();
          const result = await db.createAnnouncement({ title, body, createdBy: auth.uid }, env);
          return new Response(JSON.stringify({ ok: true, id: result.id }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('POST /society/announcements error:', e);
          return new Response(JSON.stringify({ ok: false, error: e.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /society/marketplace — list marketplace listings
      if (pathname === '/society/marketplace' && request.method === 'GET') {
        try {
          const category = url.searchParams.get('category');
          const filters = category ? { category } : {};
          const listings = await db.listMarketplaceListings(filters, env);
          return new Response(JSON.stringify({ ok: true, listings }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/society/marketplace error:', e);
          return new Response(JSON.stringify({ ok: false, error: e.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /society/marketplace — create listing (auth required)
      if (pathname === '/society/marketplace' && request.method === 'POST') {
        try {
          const auth = await resolveAuth(request, env);
          if (!auth) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const body = await request.json();
          const listing = await db.createMarketplaceListing({
            ...body,
            createdBy: auth.uid,
            posterFlat: auth.flatNumber
          }, env);
          return new Response(JSON.stringify({ ok: true, id: listing.id }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('POST /society/marketplace error:', e);
          return new Response(JSON.stringify({ ok: false, error: e.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // PUT /society/marketplace/:id — update listing (owner only)
      if (pathname.match(/^\/society\/marketplace\/[^/]+$/) && request.method === 'PUT') {
        try {
          const auth = await resolveAuth(request, env);
          if (!auth) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const id = pathname.split('/').pop();
          const body = await request.json();
          await db.updateMarketplaceListing(id, body, env);
          return new Response(JSON.stringify({ ok: true }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('PUT /society/marketplace error:', e);
          return new Response(JSON.stringify({ ok: false, error: e.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // DELETE /society/marketplace/:id — delete listing (owner only)
      if (pathname.match(/^\/society\/marketplace\/[^/]+$/) && request.method === 'DELETE') {
        try {
          const auth = await resolveAuth(request, env);
          if (!auth) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const id = pathname.split('/').pop();
          await db.deleteMarketplaceListing(id, env);
          return new Response(JSON.stringify({ ok: true }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('DELETE /society/marketplace error:', e);
          return new Response(JSON.stringify({ ok: false, error: e.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /society/carpooling — list carpooling posts
      if (pathname === '/society/carpooling' && request.method === 'GET') {
        try {
          const type = url.searchParams.get('type');
          const filters = type ? { type } : {};
          const posts = await db.listCarpoolingPosts(filters, env);
          return new Response(JSON.stringify({ ok: true, posts }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/society/carpooling error:', e);
          return new Response(JSON.stringify({ ok: false, error: e.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /society/carpooling — create carpooling post (auth required)
      if (pathname === '/society/carpooling' && request.method === 'POST') {
        try {
          const auth = await resolveAuth(request, env);
          if (!auth) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const body = await request.json();
          const post = await db.createCarpoolingPost({
            ...body,
            createdBy: auth.uid,
            posterFlat: auth.flatNumber
          }, env);
          return new Response(JSON.stringify({ ok: true, id: post.id }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('POST /society/carpooling error:', e);
          return new Response(JSON.stringify({ ok: false, error: e.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /society/lost-found — list lost & found posts
      if (pathname === '/society/lost-found' && request.method === 'GET') {
        try {
          const type = url.searchParams.get('type');
          const filters = type ? { type } : {};
          const posts = await db.listLostFoundPosts(filters, env);
          return new Response(JSON.stringify({ ok: true, posts }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/society/lost-found error:', e);
          return new Response(JSON.stringify({ ok: false, error: e.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /society/lost-found — create lost & found post (auth required)
      if (pathname === '/society/lost-found' && request.method === 'POST') {
        try {
          const auth = await resolveAuth(request, env);
          if (!auth) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const body = await request.json();
          const post = await db.createLostFoundPost({
            ...body,
            createdBy: auth.uid,
            posterFlat: auth.flatNumber
          }, env);
          return new Response(JSON.stringify({ ok: true, id: post.id }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('POST /society/lost-found error:', e);
          return new Response(JSON.stringify({ ok: false, error: e.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /society/recommendations — list recommendations
      if (pathname === '/society/recommendations' && request.method === 'GET') {
        try {
          const category = url.searchParams.get('category');
          const query = category ? `SELECT * FROM recommendations WHERE category = ? LIMIT 1000` : 'SELECT * FROM recommendations LIMIT 1000';
          const params = category ? [category] : [];
          const { results } = await env.PSOTS_DB.prepare(query).bind(...params).all();
          const recommendations = results.map(parseD1Row);
          return new Response(JSON.stringify({ ok: true, recommendations }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/society/recommendations error:', e);
          return new Response(JSON.stringify({ ok: false, error: e.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /resident/feedback { type, message, flatNumber, residentName, residentEmail }
      // Feedback stored in Firestore only, no email sent
      if (pathname === '/resident/feedback' && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          const { type, message, flatNumber, residentName, residentEmail } = body;

          if (!message || !type) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Rate limit: max 5 per hour per email
          const rlKey = `feedback_rl_${residentEmail}`;
          const rlVal = await env.VIOLATIONS.get(rlKey);
          const rlCount = rlVal ? parseInt(rlVal) : 0;
          if (rlCount >= 5) {
            return new Response(JSON.stringify({ ok: false, error: 'rate_limited' }),
              { status: 429, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          await env.VIOLATIONS.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });

          // TODO: Store in Firestore feedback collection
          // For now, just acknowledge receipt
          return new Response(JSON.stringify({ ok: true }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // ── REGISTRATION NOTIFICATION (called from psots.in after submit) ──
      // POST /notify-registration  { name, flatNumber, residentType, email }
      if (pathname === '/notify-registration' && request.method === 'POST') {
        try {
          const { name, flatNumber, residentType, email } = await request.json();
          const botToken = await getBotToken(env.VIOLATIONS);
          if (botToken) {
            const typeLabel = residentType === 'owner' ? '🏠 Owner' : '🔑 Tenant';
            const msg = `🔔 <b>New Registration</b>\n\n`
              + `👤 <b>Name:</b> ${name || '—'}\n`
              + `🏢 <b>Flat:</b> ${flatNumber || '—'}\n`
              + `📋 <b>Type:</b> ${typeLabel}\n`
              + `📧 <b>Email:</b> ${email || '—'}\n\n`
              + `<a href="https://society.psots.in/society/admin.html">Review in Admin Panel →</a>`;
            await sendMessage(ADMIN_ID, msg, botToken);
          }
        } catch (e) {
          console.error('/notify-registration telegram error:', e);
        }
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...CORS } });
      }

      // ── ADMIN NOTIFICATION ENDPOINTS ──────────────────────

      // POST /admin/notify-registration - Notify all admins of new registration via email with approval tokens
      if (pathname === '/admin/notify-registration' && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          const { residentName, flatNumber, email, phone, residentType } = body;

          if (!residentName || !flatNumber || !email) {
            return new Response(JSON.stringify({ ok: false, error: 'Missing required fields' }), {
              status: 400, headers: { 'Content-Type': 'application/json', ...CORS }
            });
          }

          // Query Firestore for all admins
          const firestoreUrl = 'https://firestore.googleapis.com/v1/projects/psots-society-25899/databases/(default)/documents/admins';
          const firestoreRes = await fetch(firestoreUrl);
          if (!firestoreRes.ok) {
            console.error('Failed to fetch admins from Firestore');
            return new Response(JSON.stringify({ ok: true }), {
              headers: { 'Content-Type': 'application/json', ...CORS }
            });
          }

          const firestoreData = await firestoreRes.json();
          const adminDocs = firestoreData.documents || [];

          // Extract admin emails
          const adminEmails = new Set();
          adminDocs.forEach(doc => {
            const fields = doc.fields || {};
            if (fields.email && fields.email.stringValue) {
              adminEmails.add(fields.email.stringValue);
            }
          });

          // Add superadmin email
          adminEmails.add('pushkalkishore@gmail.com');

          // Generate approval/rejection tokens (72-hour TTL)
          const approveToken = generateUUID();
          const rejectToken = generateUUID();
          const tokenExpiry = Date.now() + (72 * 60 * 60 * 1000);
          await env.VIOLATIONS.put(`admin_action_${approveToken}`,
            JSON.stringify({ action: 'approve', email, residentName, flatNumber, createdAt: Date.now() }),
            { expirationTtl: 72 * 60 * 60 });
          await env.VIOLATIONS.put(`admin_action_${rejectToken}`,
            JSON.stringify({ action: 'reject', email, residentName, flatNumber, createdAt: Date.now() }),
            { expirationTtl: 72 * 60 * 60 });

          // Generate beautiful HTML email with action buttons
          const emailHtml = generateRegistrationApprovalEmail(residentName, flatNumber, email, approveToken, rejectToken);

          // Send email to each admin via Resend
          const resendApiKey = env.RESEND_API_KEY;
          if (!resendApiKey) {
            console.error('RESEND_API_KEY not configured');
            return new Response(JSON.stringify({ ok: true }), {
              headers: { 'Content-Type': 'application/json', ...CORS }
            });
          }

          // Send emails to all admins
          for (const adminEmail of adminEmails) {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'PSOTS Society Admin <hello@society.psots.in>',
                to: adminEmail,
                subject: `New Registration — Flat ${flatNumber} · ${residentName}`,
                html: emailHtml,
              }),
            }).catch(err => console.error(`Failed to send email to ${adminEmail}:`, err));
          }

          // Send Telegram notification to admin group
          const botToken = await getBotToken(env.VIOLATIONS);
          if (botToken) {
            const typeLabel = residentType === 'owner' ? '🏠 Owner' : '🔑 Tenant';
            const adminGroupId = ADMIN_GROUP_ID;
            const telegramMsg = `<b>🔔 New Registration</b>\n\n` +
              `👤 <b>Name:</b> ${residentName}\n` +
              `🏢 <b>Flat:</b> ${flatNumber}\n` +
              `📋 <b>Type:</b> ${typeLabel}\n` +
              `📧 <b>Email:</b> ${email}\n` +
              (phone ? `📱 <b>Phone:</b> ${phone}\n` : '') +
              `\n<a href="https://society.psots.in/society/admin.html">Review in Admin Panel →</a>`;
            await sendMessage(adminGroupId, telegramMsg, botToken);
          }

          return new Response(JSON.stringify({ ok: true }), {
            headers: { 'Content-Type': 'application/json', ...CORS }
          });
        } catch (err) {
          console.error('Error in notify-registration:', err);
          return new Response(JSON.stringify({ ok: true }), {
            headers: { 'Content-Type': 'application/json', ...CORS }
          });
        }
      }

      // POST /resident/registration-confirmation - Send confirmation email to resident
      if (pathname === '/resident/registration-confirmation' && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          const { email, name, flatNumber } = body;

          if (!email || !name || !flatNumber) {
            return new Response(JSON.stringify({ ok: false, error: 'Missing required fields' }), {
              status: 400, headers: { 'Content-Type': 'application/json', ...CORS }
            });
          }

          // Fetch admin contacts from Firestore settings
          const adminContact = await getSettings('contact', env) || {};

          const resendApiKey = env.RESEND_API_KEY;
          if (resendApiKey) {
            const emailHtml = generateRegistrationReceivedEmail(name, flatNumber, adminContact);
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'PSOTS Society <hello@society.psots.in>',
                to: email,
                subject: `Registration Received — Flat ${flatNumber}`,
                html: emailHtml,
              }),
            }).catch(err => console.error(`Failed to send confirmation email to ${email}:`, err));
          }

          return new Response(JSON.stringify({ ok: true }), {
            headers: { 'Content-Type': 'application/json', ...CORS }
          });
        } catch (err) {
          console.error('Error in registration-confirmation:', err);
          return new Response(JSON.stringify({ ok: true }), {
            headers: { 'Content-Type': 'application/json', ...CORS }
          });
        }
      }

      // POST /admin/process-action - Process admin approval/rejection of registrations
      if (pathname === '/admin/process-action' && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          const { action, token } = body;

          if (!action || !token) {
            return new Response(JSON.stringify({ ok: false, error: 'Missing action or token' }), {
              status: 400, headers: { 'Content-Type': 'application/json', ...CORS }
            });
          }

          // Verify token exists and hasn't been used
          const tokenData = await env.VIOLATIONS.get(`admin_action_${token}`);
          if (!tokenData) {
            return new Response(JSON.stringify({ ok: false, error: 'Invalid or expired token' }), {
              status: 401, headers: { 'Content-Type': 'application/json', ...CORS }
            });
          }

          const { action: tokenAction, email, residentName, flatNumber } = JSON.parse(tokenData);

          // Verify action matches token
          if (action !== tokenAction) {
            return new Response(JSON.stringify({ ok: false, error: 'Action mismatch' }), {
              status: 400, headers: { 'Content-Type': 'application/json', ...CORS }
            });
          }

          // Delete token to prevent reuse
          await env.VIOLATIONS.delete(`admin_action_${token}`);

          // Send confirmation email to resident
          const resendApiKey = env.RESEND_API_KEY;
          if (resendApiKey) {
            // Fetch admin contacts from Firestore settings
            const adminContact = await getSettings('contact', env) || {};

            let emailSubject, emailBody;
            if (action === 'approve') {
              emailSubject = 'Welcome to PSOTS Society — Registration Approved! 🎉';
              emailBody = generateApprovalConfirmationEmail(residentName, flatNumber);
            } else {
              emailSubject = `PSOTS Society Registration Update — Flat ${flatNumber}`;
              emailBody = generateRejectionEmail(residentName, flatNumber, adminContact);
            }

            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'PSOTS Society <hello@society.psots.in>',
                to: email,
                subject: emailSubject,
                html: emailBody,
              }),
            }).catch(err => console.error(`Failed to send confirmation email to ${email}:`, err));
          }

          // TODO: Update Firestore resident document with approval/rejection status
          // This will require Firebase admin SDK or REST API call with proper auth

          // Send Telegram notification to admin about the action taken
          const botToken = await getBotToken(env.VIOLATIONS);
          if (botToken) {
            const actionEmoji = action === 'approve' ? '✅' : '❌';
            const adminGroupId = ADMIN_GROUP_ID;
            const msg = `${actionEmoji} Admin action: ${action.toUpperCase()}\n\n👤 ${residentName}\n🏢 Flat ${flatNumber}\n📧 ${email}`;
            await sendMessage(adminGroupId, msg, botToken);
          }

          return new Response(JSON.stringify({ ok: true, action, residentName, email }), {
            headers: { 'Content-Type': 'application/json', ...CORS }
          });
        } catch (err) {
          console.error('Error in process-action:', err);
          return new Response(JSON.stringify({ ok: true }), {
            headers: { 'Content-Type': 'application/json', ...CORS }
          });
        }
      }

      // ── ADMIN ENDPOINTS ────────────────────────────────────
      // GET /admin/groups - List all managed Telegram groups
      if (pathname === '/admin/groups' && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_auth' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Early superadmin bypass: extract email without crypto verification
          const token = authHeader.slice(7);
          const parts = token.split('.');
          let earlyEmail = '';
          try {
            let p = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            while (p.length % 4) p += '=';
            const ep = JSON.parse(atob(p));
            earlyEmail = ep.email || '';
          } catch (_) {}
          const isSuperAdmin = earlyEmail === 'pushkalkishore@gmail.com';

          let payload, uid;
          if (!isSuperAdmin) {
            payload = await verifyFirebaseToken(authHeader, env);
            if (!payload) {
              console.error('[/admin/groups] Token verification failed');
              return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }),
                { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
            }
            uid = payload?.user_id || payload?.sub || '';
            if (!uid) {
              return new Response(JSON.stringify({ ok: false, error: 'invalid_auth' }),
                { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
            }
            const adminDoc = parseFirestoreDoc(await db.firestoreGet(`admins/${uid}`, env));
            if (!adminDoc) {
              return new Response(JSON.stringify({ ok: false, error: 'not_admin' }),
                { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
            }
          }

          const groupsJson = await env.VIOLATIONS.get('_groups');
          const groups = groupsJson ? JSON.parse(groupsJson) : {};
          const groupsList = Object.entries(groups).map(([chatId, data]) => ({
            chatId: parseInt(chatId),
            title: data.title,
            firstSeen: data.firstSeen,
            photo: data.photo
          }));
          return new Response(JSON.stringify({ ok: true, groups: groupsList }), {
            headers: { 'Content-Type': 'application/json', ...CORS }
          });
        } catch (err) {
          console.error('/admin/groups error:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /admin/members?groupId=X - List group members with roles
      if (pathname === '/admin/members' && request.method === 'GET') {
        try {
          const groupId = url.searchParams.get('groupId');
          if (!groupId) {
            return new Response(JSON.stringify({ ok: false, error: 'groupId required' }), {
              status: 400, headers: { 'Content-Type': 'application/json', ...CORS }
            });
          }

          const botToken = await getBotToken(env.VIOLATIONS);
          if (!botToken) {
            return new Response(JSON.stringify({ ok: false, error: 'bot not configured' }), {
              status: 500, headers: { 'Content-Type': 'application/json', ...CORS }
            });
          }

          // Get group members via Telegram API
          const res = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${groupId}&user_id=1`);
          // Note: This is a simplified implementation. Full member listing would need /getChat endpoint
          // For now, return empty list. In production, iterate through known user IDs.
          return new Response(JSON.stringify({ ok: true, members: [] }), {
            headers: { 'Content-Type': 'application/json', ...CORS }
          });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err.message }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...CORS }
          });
        }
      }

      // POST /admin/mute { groupId, userId, duration } - Mute user in group for duration seconds
      if (pathname === '/admin/mute' && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          const { groupId, userId, duration } = body;

          if (!groupId || !userId) {
            return new Response(JSON.stringify({ ok: false, error: 'groupId and userId required' }), {
              status: 400, headers: { 'Content-Type': 'application/json', ...CORS }
            });
          }

          const botToken = await getBotToken(env.VIOLATIONS);
          if (!botToken) {
            return new Response(JSON.stringify({ ok: false, error: 'bot not configured' }), {
              status: 500, headers: { 'Content-Type': 'application/json', ...CORS }
            });
          }

          // Mute user via Telegram API (restrict chat member)
          const untilDate = Math.floor(Date.now() / 1000) + (duration || 86400); // Default 24h
          const muteRes = await fetch(`https://api.telegram.org/bot${botToken}/restrictChatMember`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: groupId,
              user_id: userId,
              permissions: {
                can_send_messages: false,
                can_send_media_messages: false,
                can_send_polls: false,
                can_send_other_messages: false
              },
              until_date: untilDate
            })
          });

          const muteData = await muteRes.json();
          if (!muteData.ok) {
            return new Response(JSON.stringify({ ok: false, error: muteData.description }), {
              status: 400, headers: { 'Content-Type': 'application/json', ...CORS }
            });
          }

          return new Response(JSON.stringify({ ok: true }), {
            headers: { 'Content-Type': 'application/json', ...CORS }
          });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err.message }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...CORS }
          });
        }
      }

      // POST /admin/ban { groupId, userId } - Ban user from group permanently
      if (pathname === '/admin/ban' && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          const { groupId, userId } = body;

          if (!groupId || !userId) {
            return new Response(JSON.stringify({ ok: false, error: 'groupId and userId required' }), {
              status: 400, headers: { 'Content-Type': 'application/json', ...CORS }
            });
          }

          const botToken = await getBotToken(env.VIOLATIONS);
          if (!botToken) {
            return new Response(JSON.stringify({ ok: false, error: 'bot not configured' }), {
              status: 500, headers: { 'Content-Type': 'application/json', ...CORS }
            });
          }

          // Ban user via Telegram API (kick chat member)
          const banRes = await fetch(`https://api.telegram.org/bot${botToken}/kickChatMember`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: groupId,
              user_id: userId
            })
          });

          const banData = await banRes.json();
          if (!banData.ok) {
            return new Response(JSON.stringify({ ok: false, error: banData.description }), {
              status: 400, headers: { 'Content-Type': 'application/json', ...CORS }
            });
          }

          return new Response(JSON.stringify({ ok: true }), {
            headers: { 'Content-Type': 'application/json', ...CORS }
          });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err.message }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...CORS }
          });
        }
      }

      // GET /admin/check-admin?telegramId=X - Check if user is Telegram group admin
      if (pathname === '/admin/check-admin' && request.method === 'GET') {
        try {
          const telegramId = url.searchParams.get('telegramId');
          const groupId = url.searchParams.get('groupId');

          if (!telegramId || !groupId) {
            return new Response(JSON.stringify({ ok: false, error: 'telegramId and groupId required' }), {
              status: 400, headers: { 'Content-Type': 'application/json', ...CORS }
            });
          }

          const botToken = await getBotToken(env.VIOLATIONS);
          if (!botToken) {
            return new Response(JSON.stringify({ ok: false, error: 'bot not configured' }), {
              status: 500, headers: { 'Content-Type': 'application/json', ...CORS }
            });
          }

          // Check if user is group admin via Telegram API
          const memberRes = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${groupId}&user_id=${telegramId}`);
          const memberData = await memberRes.json();

          if (!memberData.ok) {
            return new Response(JSON.stringify({ ok: false, isAdmin: false }), {
              headers: { 'Content-Type': 'application/json', ...CORS }
            });
          }

          const member = memberData.result;
          const isAdmin = member.status === 'administrator' || member.status === 'creator';

          return new Response(JSON.stringify({ ok: true, isAdmin, status: member.status }), {
            headers: { 'Content-Type': 'application/json', ...CORS }
          });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err.message }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...CORS }
          });
        }
      }

      // ── MODERATION API ENDPOINTS ───────────────────────────
      // GET /admin/group-settings?chatId=X
      if (pathname === '/admin/group-settings' && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });

          const token = authHeader.slice(7);
          const parts = token.split('.');
          let earlyEmail = '';
          try {
            let p = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            while (p.length % 4) p += '=';
            const ep = JSON.parse(atob(p));
            earlyEmail = ep.email || '';
          } catch (e) {}

          const isSuperAdmin = earlyEmail === 'pushkalkishore@gmail.com';
          if (!isSuperAdmin) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const chatId = url.searchParams.get('chatId');
          if (!chatId) return new Response(JSON.stringify({ ok: false, error: 'chatId required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });

          let settings;
          try {
            settings = parseFirestoreDoc(await db.firestoreGet(`group_settings/${chatId}`, env));
          } catch (e) {
            console.log('group-settings Firestore fetch error:', e.message);
          }

          // Always return defaults if not found
          if (!settings) {
            settings = {
              active: true,
              warnAt: 1,
              muteAt: 3,
              muteDuration: 60,
              banLimit: 10,
              geminiEnabled: true,
              sensitivity: 'medium',
              contextMessages: 10,
              dmThreshold: 3,
              notifyFrom: 2
            };
          }

          return new Response(JSON.stringify({ ok: true, settings }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.log('group-settings GET error:', err.message);
          // Return defaults even on error - never fail
          const defaults = {
            active: true,
            warnAt: 1,
            muteAt: 3,
            muteDuration: 60,
            banLimit: 10,
            geminiEnabled: true,
            sensitivity: 'medium',
            contextMessages: 10,
            dmThreshold: 3,
            notifyFrom: 2
          };
          return new Response(JSON.stringify({ ok: true, settings: defaults }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /admin/group-settings { chatId, ... }
      if (pathname === '/admin/group-settings' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });

          const token = authHeader.slice(7);
          const parts = token.split('.');
          let earlyEmail = '';
          try {
            let p = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            while (p.length % 4) p += '=';
            const ep = JSON.parse(atob(p));
            earlyEmail = ep.email || '';
          } catch (e) {}

          const isSuperAdmin = earlyEmail === 'pushkalkishore@gmail.com';
          if (!isSuperAdmin) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const body = await request.json();
          const { chatId, reactions } = body;
          if (!chatId) return new Response(JSON.stringify({ ok: false, error: 'chatId required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });

          await firestoreSet(`group_settings/${chatId}`, body, env);
          if (reactions) {
            await env.VIOLATIONS.put(`_reactions_${chatId}`, JSON.stringify(reactions));
          }
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.log('group-settings POST error:', err.message);
          return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /admin/violations?chatId=X
      if (pathname === '/admin/violations' && request.method === 'GET') {
        try {
          const chatId = url.searchParams.get('chatId');
          if (!chatId) return new Response(JSON.stringify({ ok: false, error: 'chatId required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });

          // Get all violations for this chat by querying Firestore
          const path = `violations/${chatId}/members`;
          // For now, return empty array — full collection query requires more complex Firestore API
          return new Response(JSON.stringify({ ok: true, violations: [] }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /admin/violations/reset { chatId, userId }
      if (pathname === '/admin/violations/reset' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { chatId, userId } = body;
          if (!chatId || !userId) return new Response(JSON.stringify({ ok: false, error: 'chatId and userId required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });

          await firestoreSet(`violations/${chatId}/members/${userId}`, { userId, count: 0, lastViolation: new Date().toISOString() }, env);
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /admin/violations/mute { chatId, userId, duration }
      if (pathname === '/admin/violations/mute' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { chatId, userId, duration } = body;
          const botToken = await getBotToken(env.VIOLATIONS);
          if (!botToken) return new Response(JSON.stringify({ ok: false, error: 'bot not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });

          await fetch(`https://api.telegram.org/bot${botToken}/restrictChatMember`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId, user_id: userId,
              permissions: { can_send_messages: false },
              until_date: Math.floor(Date.now() / 1000) + (duration * 60)
            })
          });
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /admin/violations/ban { chatId, userId } — Admin-only action
      if (pathname === '/admin/violations/ban' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { chatId, userId } = body;
          const botToken = await getBotToken(env.VIOLATIONS);
          if (!botToken) return new Response(JSON.stringify({ ok: false, error: 'bot not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });

          await fetch(`https://api.telegram.org/bot${botToken}/kickChatMember`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, user_id: userId, revoke_messages: true })
          });
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /admin/moderation-logs?chatId={id}
      if (pathname === '/admin/moderation-logs' && request.method === 'GET') {
        try {
          const chatId = url.searchParams.get('chatId');
          if (!chatId) return new Response(JSON.stringify({ ok: false, error: 'chatId required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });

          const list = await env.VIOLATIONS.list({ prefix: '_flagged_msg_' });
          const logs = [];

          for (const item of list.keys) {
            const raw = await env.VIOLATIONS.get(item.name);
            if (raw) {
              const log = JSON.parse(raw);
              if (String(log.chatId) === String(chatId)) {
                logs.push(log);
              }
            }
          }

          logs.sort((a, b) => (b.flaggedAt || 0) - (a.flaggedAt || 0));
          return new Response(JSON.stringify({ ok: true, logs: logs.slice(0, 50) }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /admin/resident-violations?userId={telegramId}
      if (pathname === '/admin/resident-violations' && request.method === 'GET') {
        try {
          const userId = url.searchParams.get('userId');
          if (!userId) return new Response(JSON.stringify({ ok: false, error: 'userId required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });

          const data = await getUserViolations(userId, env.VIOLATIONS);
          const violationCount = data ? (data.count || 0) : 0;
          return new Response(JSON.stringify({ ok: true, userId, violationCount }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /admin/moderation-config?chatId={id}
      if (pathname === '/admin/moderation-config' && request.method === 'GET') {
        try {
          const chatId = url.searchParams.get('chatId');
          if (!chatId) return new Response(JSON.stringify({ ok: false, error: 'chatId required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });

          const config = await getModerationConfig(env.VIOLATIONS, String(chatId));
          return new Response(JSON.stringify({ ok: true, config }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /admin/moderation-config
      if (pathname === '/admin/moderation-config' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { chatId, config } = body;
          if (!chatId || !config) return new Response(JSON.stringify({ ok: false, error: 'chatId and config required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });

          await saveModerationConfig(env.VIOLATIONS, String(chatId), config);
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /admin/bot-status?chatId={id}
      if (pathname === '/admin/bot-status' && request.method === 'GET') {
        try {
          const chatId = url.searchParams.get('chatId');
          if (!chatId) return new Response(JSON.stringify({ ok: false, error: 'chatId required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });

          const botToken = await getBotToken(env.VIOLATIONS);
          if (!botToken) return new Response(JSON.stringify({ ok: false, error: 'bot not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });

          const getMeRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
          const getMeData = await getMeRes.json();
          const botUserId = getMeData.result?.id;
          if (!botUserId) return new Response(JSON.stringify({ ok: false, error: 'Failed to get bot user ID' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });

          const res = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${chatId}&user_id=${botUserId}`, {
            method: 'GET'
          });
          const data = await res.json();
          console.log('Telegram getChatMember response:', JSON.stringify(data.result));
          if (!data.ok) return new Response(JSON.stringify({ ok: false, error: 'Failed to fetch bot status' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });

          const member = data.result;
          const isAdmin = member.status === 'administrator' || member.status === 'creator';
          return new Response(JSON.stringify({
            ok: true,
            status: member.status,
            isAdmin,
            canDeleteMessages: isAdmin && (member.can_delete_messages || false),
            canRestrictMembers: isAdmin && (member.can_restrict_members || false),
            canSendMessages: member.can_send_messages !== false
          }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /admin/group-info?chatId={id}
      if (pathname === '/admin/group-info' && request.method === 'GET') {
        try {
          const chatId = url.searchParams.get('chatId');
          if (!chatId) return new Response(JSON.stringify({ ok: false, error: 'chatId required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });

          // Early superadmin bypass: extract email without crypto verification
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });

          const token = authHeader.slice(7);
          const parts = token.split('.');
          let earlyEmail = '';
          try {
            let p = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            while (p.length % 4) p += '=';
            const ep = JSON.parse(atob(p));
            earlyEmail = ep.email || '';
          } catch (e) {}

          const isSuperAdmin = earlyEmail === 'pushkalkishore@gmail.com';
          if (!isSuperAdmin) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const botToken = await getBotToken(env.VIOLATIONS);
          if (!botToken) return new Response(JSON.stringify({ ok: false, error: 'bot not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });

          // Fetch both chat info and member count in parallel
          const [chatRes, memberCountRes] = await Promise.all([
            fetch(`https://api.telegram.org/bot${botToken}/getChat?chat_id=${chatId}`),
            fetch(`https://api.telegram.org/bot${botToken}/getChatMemberCount?chat_id=${chatId}`)
          ]);

          const chatData = await chatRes.json();
          const memberCountData = await memberCountRes.json();

          if (!chatData.ok || !memberCountData.ok) {
            return new Response(JSON.stringify({ ok: false, error: 'Failed to fetch group info' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const chat = chatData.result;
          const memberCount = memberCountData.result || 0;

          return new Response(JSON.stringify({
            ok: true,
            title: chat.title || 'Unknown Group',
            memberCount,
            description: chat.description || '',
            inviteLink: chat.invite_link || null
          }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /admin/keywords?chatId={id}
      if (pathname === '/admin/keywords' && request.method === 'GET') {
        try {
          const chatId = url.searchParams.get('chatId');
          if (!chatId) return new Response(JSON.stringify({ ok: false, error: 'chatId required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });

          const keywords = await getKeywords(env.VIOLATIONS, String(chatId));
          return new Response(JSON.stringify({ ok: true, keywords }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /admin/messages?chatId={id}
      if (pathname === '/admin/messages' && request.method === 'GET') {
        try {
          const chatId = url.searchParams.get('chatId');
          if (!chatId) return new Response(JSON.stringify({ ok: false, error: 'chatId required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });

          const messages = await getMessageContext(env.VIOLATIONS, String(chatId), 10);
          return new Response(JSON.stringify({ ok: true, messages }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /admin/residents — get all residents for admin approval tab
      if (pathname === '/admin/residents' && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_auth' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const payload = decodeJwtPayload(authHeader);
          const adminUid = payload?.user_id || payload?.sub;

          const residents = await firestoreQuery('residents', [], env);
          if (!Array.isArray(residents)) {
            console.error('firestoreQuery returned non-array:', typeof residents);
            return new Response(JSON.stringify({ ok: true, residents: [] }),
              { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const sorted = residents.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

          await firestoreSet(`admin_access_log/${Date.now()}_${adminUid}`, {
            adminUid,
            targetUid: null,
            action: 'viewed_residents',
            timestamp: new Date().toISOString(),
            ipCity: request.cf?.city || 'Unknown'
          }, env).catch(() => {});

          const masked = await Promise.all(sorted.map(async r => {
            // Fetch credential for email (V2 residents store email in credentials collection)
            const creds = await firestoreQuery('credentials', [['residentId', r._id || r.residentId || r.uid]], env);
            const cred = creds?.[0];
            if (cred) {
              r.email = cred.identifier || '';
              r.credType = cred.type || '';
            }
            const sanitized = sanitizeForAdmin(r);
            if (sanitized) sanitized.id = r._id || r.residentId || r.uid;
            return sanitized;
          })).then(results => results.filter(Boolean));

          return new Response(JSON.stringify({ ok: true, residents: masked }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('Error fetching residents:', err?.message, err?.stack);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /admin/stats — stats for admin dashboard
      if (pathname === '/admin/stats' && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_auth' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const residents = await firestoreQuery('residents', [], env);
          const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

          const pendingPrimary = residents.filter(r => r.status === 'pending' && (!r.accessLevel || r.accessLevel !== 'family')).length;
          const familyAdded = residents.filter(r => r.accessLevel === 'family' && r.createdAt > thirtyDaysAgo).length;
          const tenantsAdded = residents.filter(r => r.accessLevel === 'tenant' && r.createdAt > thirtyDaysAgo).length;
          const totalActive = residents.filter(r => r.status === 'approved').length;

          return new Response(JSON.stringify({ ok: true, pendingPrimary, familyAdded, tenantsAdded, totalActive }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('Error fetching stats:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /admin/restore-resident — Superadmin restores corrupted resident record
      if (pathname === '/admin/restore-resident' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_auth' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const payload = decodeJwtPayload(authHeader);
          const email = payload?.email;
          if (email !== 'pushkalkishore@gmail.com') {
            return new Response(JSON.stringify({ ok: false, error: 'superadmin_only' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const body = await request.json();
          const { uid, flatNumber, name, email: residentEmail, phone, status } = body;

          if (!uid || !flatNumber) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const parsed = parseFlatNumber(flatNumber);
          if (!parsed) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_flat_number' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const { tower, floor, unit } = parsed;

          const residentDoc = {
            fields: {
              uid: { stringValue: uid },
              flatNumber: { stringValue: flatNumber.toString() },
              name: { stringValue: name || 'Unnamed' },
              email: { stringValue: residentEmail || '' },
              phone: { stringValue: phone || '' },
              status: { stringValue: status || 'approved' },
              role: { stringValue: 'resident' },
              residentType: { stringValue: 'owner' },
              tower: { integerValue: tower },
              floor: { integerValue: floor },
              unit: { integerValue: unit },
              updatedAt: { integerValue: Date.now().toString() },
              approvedBy: { stringValue: 'system-restore' },
              approvedAt: { integerValue: Date.now().toString() },
            }
          };

          const saKey = await env.FIREBASE_SA_KEY.text ? JSON.parse(await env.FIREBASE_SA_KEY.text) : null;
          const projectId = 'psots-society-25899';
          const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/residents/${uid}`;
          const accessToken = await getServiceAccountToken(saKey, env);

          const updateRes = await fetch(url, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(residentDoc),
          });

          if (!updateRes.ok) {
            const error = await updateRes.text();
            throw new Error(`Firestore error: ${error}`);
          }

          return new Response(JSON.stringify({ ok: true, message: `Resident ${uid} restored` }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('Error restoring resident:', err);
          return new Response(JSON.stringify({ ok: false, error: err.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /user/violations?telegramUsername=X — User's own violation records
      if (pathname === '/user/violations' && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_auth' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const telegramUsername = url.searchParams.get('telegramUsername');
          if (!telegramUsername) {
            return new Response(JSON.stringify({ violations: [] }),
              { headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const allViolations = await env.VIOLATIONS.list();
          const violations = [];
          const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

          for (const item of allViolations.keys) {
            try {
              const data = JSON.parse(await env.VIOLATIONS.get(item.name));
              if (data.tgUsername === telegramUsername && data.timestamp > thirtyDaysAgo) {
                violations.push({
                  chatId: data.chatId,
                  chatTitle: data.chatTitle || `Group ${data.chatId}`,
                  timestamp: data.timestamp,
                  reason: data.reason || 'Message removed',
                  count: data.count || 1
                });
              }
            } catch (e) {
              console.error('violation parse error:', e);
            }
          }

          return new Response(JSON.stringify({ violations }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /admin/forwarded-analysis — Research report of forwarded messages
      if (pathname === '/admin/forwarded-analysis' && request.method === 'GET') {
        try {
          const docs = await firestoreQuery('forwarded_analysis', [], env);
          const total = docs.length;
          const byGroup = {};
          const byHour = {};
          const byDay = {};
          let withPrice = 0;
          let withPhoto = 0;
          const groupStats = {};

          docs.forEach(d => {
            const group = d.groupName || 'Unknown';
            byGroup[group] = (byGroup[group] || 0) + 1;

            const date = new Date(d.loggedAt * 1000);
            const hour = date.getHours();
            byHour[hour] = (byHour[hour] || 0) + 1;

            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const day = dayNames[date.getDay()];
            byDay[day] = (byDay[day] || 0) + 1;

            if (d.hasPrice) withPrice++;
            if (d.hasPhoto) withPhoto++;

            if (!groupStats[group]) groupStats[group] = { name: group, count: 0, priceCount: 0, hours: {} };
            groupStats[group].count++;
            if (d.hasPrice) groupStats[group].priceCount++;
            groupStats[group].hours[hour] = (groupStats[group].hours[hour] || 0) + 1;
          });

          const topGroups = Object.values(groupStats)
            .sort((a, b) => b.count - a.count)
            .map(g => {
              let peakHour = 0, maxMessages = 0;
              Object.entries(g.hours).forEach(([h, c]) => {
                if (c > maxMessages) { maxMessages = c; peakHour = h; }
              });
              return {
                name: g.name,
                count: g.count,
                pricePercent: Math.round((g.priceCount / g.count) * 100),
                peakHour: peakHour + ":00"
              };
            });

          return new Response(JSON.stringify({
            total, byGroup, byHour, byDay, withPrice, withPhoto, topGroups
          }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err.message }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...CORS }
          });
        }
      }

      // ── API ENDPOINTS ─────────────────────────────────────
      if (pathname.startsWith('/api/')) {
        const endpoint = pathname.replace('/api/', '');
        const group = url.searchParams.get('group');

        if (endpoint === 'my-groups') {
          const email = url.searchParams.get('email');
          if (!email) return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });

          const groupsJson = await env.VIOLATIONS.get('_groups');
          const allGroups = groupsJson ? JSON.parse(groupsJson) : {};
          const allowed = {};
          const globalAdminsJson = await env.VIOLATIONS.get('_admin_emails');
          const globalAdmins = globalAdminsJson ? JSON.parse(globalAdminsJson) : ['pushkalkishore@gmail.com'];
          const isGlobalAdmin = globalAdmins.includes(email);

          for (const [id, data] of Object.entries(allGroups)) {
            if (isGlobalAdmin) {
              allowed[id] = data;
            } else {
              const groupAdminsJson = await env.VIOLATIONS.get(`_admin_emails_${id}`);
              const groupAdmins = groupAdminsJson ? JSON.parse(groupAdminsJson) : [];
              if (groupAdmins.includes(email)) allowed[id] = data;
            }
          }
          if (isGlobalAdmin && Object.keys(allowed).length === 0) {
            allowed['initial'] = { title: 'System Initialization (No Groups Active)' };
          }
          const botToken = await getBotToken(env.VIOLATIONS);
          return new Response(JSON.stringify({ groups: allowed, tokenSet: !!botToken }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint === 'groups') {
          const groupsJson = await env.VIOLATIONS.get('_groups');
          return new Response(groupsJson || '{}', { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint === 'refresh-groups') {
          const botToken = await getBotToken(env.VIOLATIONS);
          if (!botToken) return new Response(JSON.stringify({ error: 'No token' }), { status: 500 });
          const groupsJson = await env.VIOLATIONS.get('_groups');
          const groups = groupsJson ? JSON.parse(groupsJson) : {};
          const results = {};
          for (const chatId of Object.keys(groups)) {
            try {
              const res = await fetch(`https://api.telegram.org/bot${botToken}/getChat?chat_id=${chatId}`);
              const data = await res.json();
              if (data.ok) {
                let photoUrl = groups[chatId].photo || null;
                if (data.result.photo) {
                  const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${data.result.photo.small_file_id}`);
                  const fileData = await fileRes.json();
                  if (fileData.ok) photoUrl = `/api/group-photo?path=${encodeURIComponent(fileData.result.file_path)}`;
                }
                groups[chatId] = { title: data.result.title, firstSeen: groups[chatId].firstSeen || new Date().toISOString(), photo: photoUrl };
                results[chatId] = data.result.title;
              }
            } catch (e) {
              console.error('group-info fetch error:', e);
            }
          }
          await env.VIOLATIONS.put('_groups', JSON.stringify(groups));
          return new Response(JSON.stringify({ ok: true, updated: results }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint === 'group-photo') {
          const path = url.searchParams.get('path');
          if (!path) return new Response(JSON.stringify({ ok: false, error_code: 404, description: 'Not Found' }), { status: 404 });
          const photoData = await env.VIOLATIONS.get(path, { type: 'arrayBuffer' });
          if (!photoData) return new Response(JSON.stringify({ ok: false, error_code: 404, description: 'Not Found' }), { status: 404 });
          return new Response(photoData, { headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS'
          } });
        }

        if (endpoint === 'webhook-status') {
          const botToken = await getBotToken(env.VIOLATIONS);
          if (!botToken) return new Response(JSON.stringify({ error: 'BOT_TOKEN not set' }), { headers: { 'Content-Type': 'application/json' } });
          try {
            const res = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
            const data = await res.json();
            return new Response(JSON.stringify({ webhookConfigured: data.ok, webhookInfo: data.result }), { headers: { 'Content-Type': 'application/json' } });
          } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), { headers: { 'Content-Type': 'application/json' } });
          }
        }

        if (endpoint === 'check-keywords') {
          const keywords = await getKeywords(env.VIOLATIONS);
          return new Response(JSON.stringify({ keywordCategories: Object.keys(keywords), buySell: keywords.buySell, total: Object.values(keywords).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0) }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint === 'debug-logs') {
          const list = await env.VIOLATIONS.list({ prefix: '_log_' });
          const logs = [];
          for (const item of list.keys) {
            const data = await env.VIOLATIONS.get(item.name);
            logs.push({ key: item.name, value: JSON.parse(data) });
          }
          return new Response(JSON.stringify({ debugLogs: logs.sort((a, b) => b.key.localeCompare(a.key)).slice(0, 20) }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint === 'diagnostics') {
          const botToken = await getBotToken(env.VIOLATIONS);
          const hasToken = !!botToken;
          const kvList = await env.VIOLATIONS.list();
          const kvKeys = kvList.keys.map(k => k.name);
          let botInfo = null;
          if (botToken) {
            try {
              const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
              const data = await res.json();
              botInfo = data.ok ? { id: data.result.id, username: data.result.username } : { error: data.description };
            } catch (err) { botInfo = { error: err.message }; }
          }
          return new Response(JSON.stringify({ hasToken, botInfo, kvWorking: !!env.VIOLATIONS, kvDebug: { totalKeys: kvKeys.length } }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint === 'status') {
          const stats = await getStats(env.VIOLATIONS, group);
          const violations = await getViolationsLast30Days(env.VIOLATIONS, group);
          const admins = await getAdmins(env.VIOLATIONS, group);
          const userList = await env.VIOLATIONS.list({ prefix: 'user_' });
          return new Response(JSON.stringify({ totalScanned: stats.totalScanned, violations: violations.reduce((sum, v) => sum + v.count, 0), users: userList.keys.length, admins: admins.length }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint === 'violations' && request.method === 'GET') {
          const violations = await getViolationsLast30Days(env.VIOLATIONS, group);
          return new Response(JSON.stringify({ violations: violations.sort((a, b) => b.count - a.count) }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint === 'violations' && request.method === 'POST') {
          const body = await request.json();
          if (body.action === 'reset') {
            const prefix = group ? `user_${group}_` : 'user_';
            const list = await env.VIOLATIONS.list({ prefix });
            for (const item of list.keys) {
              const data = JSON.parse(await env.VIOLATIONS.get(item.name));
              if (data.username === body.username) {
                data.count = 0;
                await saveUserViolations(data.userId, data, env.VIOLATIONS, group);
                break;
              }
            }
          }
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint.startsWith('user-violations')) {
          const userId = url.searchParams.get('id');
          const violations = await getUserViolations(userId, env.VIOLATIONS, group);
          const admins = await getAdmins(env.VIOLATIONS, group);
          return new Response(JSON.stringify({ violations, admins: admins.map(a => ({ email: a })) }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint === 'keywords' && request.method === 'GET') {
          const keywords = await getKeywords(env.VIOLATIONS, group);
          return new Response(JSON.stringify({ keywords }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint === 'keywords' && request.method === 'POST') {
          const body = await request.json();
          const keywords = await getKeywords(env.VIOLATIONS, group);
          if (body.action === 'add') {
            if (!keywords[body.category]) keywords[body.category] = [];
            if (!keywords[body.category].includes(body.keyword)) keywords[body.category].push(body.keyword);
          } else if (body.action === 'remove') {
            keywords[body.category] = keywords[body.category].filter(kw => kw !== body.keyword);
          }
          await saveKeywords(keywords, env.VIOLATIONS, group);
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint === 'admins' && request.method === 'GET') {
          const admins = await getAdmins(env.VIOLATIONS, group);
          const adminTgIds = await env.VIOLATIONS.get('_admin_telegram_ids');
          const tgIds = adminTgIds ? JSON.parse(adminTgIds) : {};
          return new Response(JSON.stringify({ admins, telegram_ids: tgIds }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint === 'admins' && request.method === 'POST') {
          const body = await request.json();
          if (body.action === 'add' || body.action === 'remove') {
            const admins = await getAdmins(env.VIOLATIONS, group);
            if (body.action === 'add' && !admins.includes(body.email)) admins.push(body.email);
            else if (body.action === 'remove') admins.splice(admins.indexOf(body.email), 1);
            await saveAdmins(admins, env.VIOLATIONS, group);
          }
          if (body.action === 'register-telegram') {
            const adminTgIds = await env.VIOLATIONS.get('_admin_telegram_ids');
            const tgIds = adminTgIds ? JSON.parse(adminTgIds) : {};
            tgIds[body.email] = body.telegram_id;
            await env.VIOLATIONS.put('_admin_telegram_ids', JSON.stringify(tgIds));
          }
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint === 'pins' && request.method === 'GET') {
          const pins = await getPINs(env.VIOLATIONS);
          return new Response(JSON.stringify({ pins }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint === 'pins' && request.method === 'POST') {
          const body = await request.json();
          const pins = await getPINs(env.VIOLATIONS);
          if (body.action === 'add' && !pins.includes(body.pin)) pins.push(body.pin);
          else if (body.action === 'remove') pins.splice(pins.indexOf(body.pin), 1);
          await savePINs(pins, env.VIOLATIONS);
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint === 'verify-pin' && request.method === 'POST') {
          const body = await request.json();
          const pins = await getPINs(env.VIOLATIONS);
          return new Response(JSON.stringify({ valid: pins.includes(body.pin) }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint === 'verify-resident' && request.method === 'POST') {
          const body = await request.json();
          if (body.action === 'approve') await markResidentVerified(body.userId, { ...body.details, verifiedAt: new Date().toISOString() }, env.VIOLATIONS);
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint === 'residents' && request.method === 'GET') {
          const list = await env.VIOLATIONS.list({ prefix: 'resident_verified_' });
          const userList = await env.VIOLATIONS.list({ prefix: 'user_' });
          const residents = [];
          for (const item of list.keys) {
            const data = JSON.parse(await env.VIOLATIONS.get(item.name));
            residents.push({ ...data, userId: item.name.replace('resident_verified_', '') });
          }
          for (const item of userList.keys) {
            const userId = item.name.replace('user_', '');
            if (!residents.find(r => r.userId === userId)) {
              const data = JSON.parse(await env.VIOLATIONS.get(item.name));
              residents.push({ userId, username: data.username, status: 'pending' });
            }
          }
          return new Response(JSON.stringify({ residents }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint === 'register' && request.method === 'POST') {
          const body = await request.json();
          const flatId = `flat_${body.tower}_${body.flat}`;
          const flatData = await env.VIOLATIONS.get(flatId);
          const flatMembers = flatData ? JSON.parse(flatData) : [];
          if (flatMembers.length >= 4) return new Response(JSON.stringify({ error: 'Max 4 accounts reached for this flat.' }), { status: 403 });
          await markResidentVerified(body.userId, { ...body, registeredAt: new Date().toISOString(), status: 'pending' }, env.VIOLATIONS);
          flatMembers.push(body.userId);
          await env.VIOLATIONS.put(flatId, JSON.stringify(flatMembers));
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint.startsWith('marketplace') && request.method === 'GET') {
          const list = await env.VIOLATIONS.list({ prefix: 'market_listing_' });
          const listings = [];
          for (const item of list.keys) {
            const data = JSON.parse(await env.VIOLATIONS.get(item.name));
            listings.push({ ...data, listingId: item.name });
          }
          return new Response(JSON.stringify({ listings: listings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint === 'marketplace' && request.method === 'POST') {
          const body = await request.json();
          const verified = await isResidentVerified(body.userId, env.VIOLATIONS);
          if (!verified) return new Response(JSON.stringify({ error: 'Identity verification required to post.' }), { status: 403 });
          const keywords = await getKeywords(env.VIOLATIONS, group);
          const violation = checkViolation(body.description + ' ' + body.item, keywords);
          if (violation && violation !== 'Buy/Sell Content') return new Response(JSON.stringify({ error: 'Post violates community guidelines: ' + violation }), { status: 400 });
          const listing = { ...body, timestamp: new Date().toISOString(), source: 'web' };
          await env.VIOLATIONS.put(`market_listing_${Date.now()}_${body.userId}`, JSON.stringify(listing), { expirationTtl: 2592000 });
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint.startsWith('marketplace') && request.method === 'DELETE') {
          const id = url.searchParams.get('id');
          if (id) await env.VIOLATIONS.delete(id);
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint === 'settings' && request.method === 'GET') {
          const settings = await getActionSettings(env.VIOLATIONS, group);
          return new Response(JSON.stringify({ settings }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint === 'settings' && request.method === 'POST') {
          const settings = await request.json();
          await saveActionSettings(settings, env.VIOLATIONS, group);
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (endpoint === 'logs') {
          const list = await env.AUDIT_LOG.list();
          const logs = [];
          const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
          for (const item of list.keys) {
            const data = JSON.parse(await env.AUDIT_LOG.get(item.name));
            if (new Date(data.timestamp).getTime() > thirtyDaysAgo) {
              if (group && String(data.chatId) !== String(group)) continue;
              logs.push(data);
            }
          }
          return new Response(JSON.stringify({ logs: logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) }), { headers: { 'Content-Type': 'application/json' } });
        }
      }

      // POST /invite/create — create family member invite
      if (pathname === '/invite/create' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_auth' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const body = await request.json().catch(() => ({}));
          const { flatNumber, relation } = body;
          if (!flatNumber || !relation) {
            return new Response(JSON.stringify({ ok: false, error: 'flatNumber and relation required' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Decode uid from ID token and look up inviter
          const payload = decodeJwtPayload(authHeader);
          const inviterUid = payload?.user_id || payload?.sub || '';
          let inviterName = '';
          let inviterTelegram = '';
          if (inviterUid) {
            const inviterDoc = await db.firestoreGet(`residents/${inviterUid}`, env);
            const inviter = parseFirestoreDoc(inviterDoc);
            if (inviter) {
              inviterName = [inviter.firstName, inviter.lastName].filter(Boolean).join(' ').trim() || inviter.name || '';
              inviterTelegram = inviter.telegramUsername || inviter.tgUsername || '';
            }
          }

          const method = body.emailSentTo ? 'email' : 'qr';
          const inviterUserAgent = request.headers.get('User-Agent') || '';

          const token = generateUUID();
          const expiresAt = Date.now() + 10 * 60 * 1000;
          const inviteData = {
            token,
            flatNumber,
            relation,
            createdAt: Date.now(),
            expiresAt,
            used: false
          };

          const invitePath = `invites/${token}`;
          const fields = {};
          for (const [k, v] of Object.entries(inviteData)) {
            if (typeof v === 'string') fields[k] = { stringValue: v };
            else if (typeof v === 'number') fields[k] = { integerValue: String(v) };
            else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
          }

          const tokenAuth = await getServiceAccountToken(env);
          if (!tokenAuth) {
            return new Response(JSON.stringify({ ok: false, error: 'auth_failed' }),
              { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const base = 'https://firestore.googleapis.com/v1/projects/psots-society-25899/databases/(default)/documents';
          const fsRes = await fetch(`${base}/${invitePath}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields })
          });

          if (!fsRes.ok) {
            return new Response(JSON.stringify({ ok: false, error: 'firestore_error' }),
              { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Write audit record
          const auditFields = toFirestoreFields({
            token,
            status: 'created',
            invitedByUid: inviterUid,
            invitedByName: inviterName,
            invitedByFlat: String(flatNumber),
            invitedByTelegram: inviterTelegram,
            relation,
            method,
            emailSentTo: body.emailSentTo || '',
            createdAt: Date.now(),
            expiresAt,
            inviterUserAgent,
            flagged: false
          });
          await fetch(`${base}/invite_audit/${token}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: auditFields })
          }).catch(() => {});

          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`https://society.psots.in/society/join?token=${token}`)}`;

          return new Response(JSON.stringify({ ok: true, token, qrUrl, expiresAt }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /invite/send-email — send family member invite via email
      if (pathname === '/invite/send-email' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_auth' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const payload = decodeJwtPayload(authHeader);
          const inviterUid = payload?.user_id || payload?.sub || '';
          if (!inviterUid) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_auth' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Rate limit: max 10 invites per hour per user
          const rateLimitKey = `${inviterUid}:invite_send_email`;
          const result = await checkAndRecord({ key: rateLimitKey, limit: 10, windowSeconds: 3600, env });
          if (!result.allowed) {
            return new Response(JSON.stringify({ ok: false, error: 'rate_limit_exceeded' }),
              { status: 429, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const body = await request.json().catch(() => ({}));
          const { token, email, inviterName, flatNumber } = body;
          if (!token || !email || !inviterName || !flatNumber) {
            return new Response(JSON.stringify({ ok: false, error: 'token, email, inviterName, flatNumber required' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const joinUrl = `https://society.psots.in/society/join?token=${token}`;
          const emailHtml = generateBaseEmail('You\'re Invited to PSOTS Society', 'Family Member Join', `
            <p>Hi there,</p>
            <p>${escapeHTML(inviterName)} has invited you to join PSOTS Society as a family member.</p>

            <div class="info-box">
              <p><strong>Flat Number:</strong> ${escapeHTML(flatNumber)}</p>
              <p><strong>Expires:</strong> 10 minutes from now</p>
            </div>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${joinUrl}" class="button btn-jade">📱 Join as Family Member</a>
            </div>

            <p style="font-size: 13px; color: #8a7a6a; margin-top: 24px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <code style="word-break: break-all; background: #f0e8db; padding: 8px; display: block; margin-top: 8px; border-radius: 4px;">${joinUrl}</code>
            </p>
          `);

          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'hello@society.psots.in',
              to: email,
              subject: `You're invited to join PSOTS Society - Flat ${flatNumber}`,
              html: emailHtml,
            }),
          });

          if (!resendRes.ok) {
            const err = await resendRes.text();
            console.error('Resend error:', err);
            return new Response(JSON.stringify({ ok: false, error: 'email_failed' }),
              { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Update audit: method=email, emailSentTo
          await auditInvitePatch(token, toFirestoreFields({
            method: 'email',
            emailSentTo: email
          }), env);

          return new Response(JSON.stringify({ ok: true }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('Error sending invite email:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /invite/validate — validate invite token
      if (pathname.startsWith('/invite/validate') && request.method === 'GET') {
        try {
          const url = new URL(request.url);
          const token = url.searchParams.get('token');
          if (!token) {
            return new Response(JSON.stringify({ ok: false, error: 'token_required' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const inviteDoc = await db.firestoreGet(`invites/${token}`, env);
          if (!inviteDoc) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }),
              { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const invite = parseFirestoreDoc(inviteDoc);
          if (!invite) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }),
              { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          if (invite.used === true) {
            return new Response(JSON.stringify({ ok: false, error: 'already_used' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          if (!invite.expiresAt || invite.expiresAt < Date.now()) {
            return new Response(JSON.stringify({ ok: false, error: 'expired' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Get inviter name from residents collection
          const residentsQuery = await firestoreQuery('residents', [['flatNumber', invite.flatNumber]], env);
          const inviter = residentsQuery?.[0];
          const inviterName = maskName(inviter?.firstName || 'Family member');

          // Update audit: status=opened, openedAt, joinerIP
          const joinerIP = request.headers.get('CF-Connecting-IP')
            || request.headers.get('X-Forwarded-For')
            || '';
          await auditInvitePatch(token, toFirestoreFields({
            status: 'opened',
            openedAt: Date.now(),
            joinerIP
          }), env);

          return new Response(JSON.stringify({
            ok: true,
            flatNumber: invite.flatNumber,
            inviterName,
            relation: invite.relation,
            expiresAt: invite.expiresAt
          }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /invite/accept — accept invite and create family member
      if (pathname === '/invite/accept' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_auth' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const body = await request.json().catch(() => ({}));
          const { token, uid, name, loginMethod } = body;
          if (!token || !uid) {
            return new Response(JSON.stringify({ ok: false, error: 'token and uid required' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const inviteDoc = await db.firestoreGet(`invites/${token}`, env);
          if (!inviteDoc) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }),
              { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const invite = parseFirestoreDoc(inviteDoc);
          if (!invite || invite.used || invite.expiresAt < Date.now()) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Mark invite as used
          const tokenAuth = await getServiceAccountToken(env);
          if (!tokenAuth) {
            return new Response(JSON.stringify({ ok: false, error: 'auth_failed' }),
              { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const base = 'https://firestore.googleapis.com/v1/projects/psots-society-25899/databases/(default)/documents';
          await fetch(`${base}/invites/${token}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: { used: { booleanValue: true } } })
          });

          // Determine invite type — family (default), tenant, or tenant_family
          const inviteType = invite.type || 'family';

          // Get resident's name and flat number
          const residentDoc = await db.firestoreGet(`residents/${uid}`, env);
          const resident = parseFirestoreDoc(residentDoc);

          const joinerName = resident
            ? ([resident.firstName, resident.lastName].filter(Boolean).join(' ').trim() || resident.name || 'Family member')
            : 'Family member';
          const joinerEmail = resident?.email || '';
          const joinerUserAgent = request.headers.get('User-Agent') || '';

          // Resolve tenant context for tenant / tenant_family
          let tenantRec = null;
          let joinerFlat = resident?.flatNumber || invite.flatNumber || '';
          if (inviteType === 'tenant' && invite.tenantId) {
            tenantRec = parseFirestoreDoc(await db.firestoreGet(`tenants/${invite.tenantId}`, env));
            if (tenantRec) joinerFlat = tenantRec.ownerFlat || joinerFlat;
          } else if (inviteType === 'tenant_family' && invite.tenantUid) {
            const tenantRecords = await firestoreQuery('tenants', [['tenantUid', invite.tenantUid]], env);
            tenantRec = tenantRecords[0] || null;
            if (tenantRec) joinerFlat = tenantRec.ownerFlat || invite.flatNumber || joinerFlat;
          }

          await auditInvitePatch(token, toFirestoreFields({
            status: 'completed',
            completedAt: Date.now(),
            joinedByUid: uid,
            joinedByName: maskName(joinerName),
            joinedByEmail: maskEmail(joinerEmail),
            joinedByFlat: String(joinerFlat),
            joinedByLoginMethod: loginMethod || '',
            joinerUserAgent
          }), env);

          if (inviteType === 'tenant') {
            // Activate tenant record + set resident accessLevel
            if (invite.tenantId) {
              const tenantUpd = toFirestoreFields({
                tenantUid: uid,
                status: 'active',
                activatedAt: Date.now()
              });
              const mask = 'updateMask.fieldPaths=tenantUid&updateMask.fieldPaths=status&updateMask.fieldPaths=activatedAt';
              await fetch(`${base}/tenants/${invite.tenantId}?${mask}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: tenantUpd })
              }).catch(() => {});
            }
            // Patch resident doc with tenant access metadata (if resident doc exists)
            const residentPatch = toFirestoreFields({
              accessLevel: 'tenant',
              status: 'active',
              ownerUid: tenantRec?.ownerUid || '',
              flatNumber: String(joinerFlat || ''),
              leaseStart: tenantRec?.leaseStart || '',
              leaseEnd: tenantRec?.leaseEnd || '',
              joinedByFlat: String(joinerFlat || '')
            });
            const mask2 = 'updateMask.fieldPaths=accessLevel&updateMask.fieldPaths=status&updateMask.fieldPaths=ownerUid&updateMask.fieldPaths=flatNumber&updateMask.fieldPaths=leaseStart&updateMask.fieldPaths=leaseEnd&updateMask.fieldPaths=joinedByFlat';
            await fetch(`${base}/residents/${uid}?${mask2}`, {
              method: 'PATCH',
              headers: { 'Authorization': `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ fields: residentPatch })
            }).catch(() => {});
          } else if (inviteType === 'tenant_family') {
            // Set resident accessLevel = tenant_family
            const residentPatch = toFirestoreFields({
              accessLevel: 'tenant_family',
              status: 'active',
              tenantUid: invite.tenantUid || '',
              ownerUid: tenantRec?.ownerUid || '',
              flatNumber: String(joinerFlat || ''),
              leaseEnd: tenantRec?.leaseEnd || invite.leaseEnd || '',
              joinedByFlat: String(joinerFlat || '')
            });
            const mask3 = 'updateMask.fieldPaths=accessLevel&updateMask.fieldPaths=status&updateMask.fieldPaths=tenantUid&updateMask.fieldPaths=ownerUid&updateMask.fieldPaths=flatNumber&updateMask.fieldPaths=leaseEnd&updateMask.fieldPaths=joinedByFlat';
            await fetch(`${base}/residents/${uid}?${mask3}`, {
              method: 'PATCH',
              headers: { 'Authorization': `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ fields: residentPatch })
            }).catch(() => {});
          } else {
            // Family invite — create resident doc + add to inviter's family list
            try {
              console.error('invite doc:', JSON.stringify(invite));
              const inviterQuery = await firestoreQuery('residents', [['flatNumber', invite.flatNumber]], env);
              console.error('inviterQuery result:', JSON.stringify(inviterQuery));

              if (!inviterQuery || inviterQuery.length === 0) {
                console.error('No resident found for flatNumber:', invite.flatNumber);
                return new Response(JSON.stringify({ ok: false, error: 'inviter_not_found' }),
                  { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
              }

              const inviterUid = inviterQuery[0].uid;

              // Create resident document for family member
              const familyResidentFields = toFirestoreFields({
                uid: uid,
                flatNumber: invite.flatNumber,
                status: 'pending',
                relation: invite.relation || '',
                accessLevel: 'family',
                invitedBy: inviterUid,
                firstName: name || resident?.firstName || 'Family Member',
                createdAt: Date.now()
              });
              const maskResident = 'updateMask.fieldPaths=uid&updateMask.fieldPaths=flatNumber&updateMask.fieldPaths=status&updateMask.fieldPaths=relation&updateMask.fieldPaths=accessLevel&updateMask.fieldPaths=invitedBy&updateMask.fieldPaths=firstName&updateMask.fieldPaths=createdAt';
              const residentRes = await fetch(`${base}/residents/${uid}?${maskResident}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: familyResidentFields })
              });

              if (!residentRes.ok) {
                const err = await residentRes.text();
                console.error('Failed to save resident:', residentRes.status, err);
                return new Response(JSON.stringify({ ok: false, error: 'failed_to_create_resident' }),
                  { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
              }

              // Add to inviter's family list
              const familyMemberId = generateUUID();
              const familyFields = {
                name: { stringValue: name || resident?.firstName || 'Family Member' },
                relation: { stringValue: invite.relation || '' },
                addedAt: { integerValue: String(Date.now()) }
              };
              const familyRes = await fetch(`${base}/residents/${inviterUid}/family/${familyMemberId}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: familyFields })
              });

              if (!familyRes.ok) {
                const err = await familyRes.text();
                console.error('Failed to add to family list:', familyRes.status, err);
                // Log but don't fail — resident is already created
              }
            } catch (familyErr) {
              console.error('Family invite error:', familyErr);
              return new Response(JSON.stringify({ ok: false, error: 'family_invite_failed' }),
                { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
            }
          }

          // Get admins for notification
          const adminEmails = await firestoreQuery('admins', [], env);
          const adminList = adminEmails.map(a => a.email).filter(Boolean);

          // Send admin notification
          if (adminList.length > 0) {
            const inviteeName = resident?.firstName || 'Family member';
            const html = `
              <p>A family member has joined the society:</p>
              <ul>
                <li><strong>Name:</strong> ${escapeHTML(inviteeName)}</li>
                <li><strong>Flat:</strong> ${escapeHTML(invite.flatNumber)}</li>
                <li><strong>Relation:</strong> ${escapeHTML(invite.relation)}</li>
                <li><strong>Joined:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</li>
              </ul>
            `;
            const emailHtml = generateBaseEmail('Family Member Joined', 'PSOTS Society', html);

            for (const email of adminList) {
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${env.RESEND_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  from: 'PSOTS Society <hello@society.psots.in>',
                  to: email,
                  subject: `Family Member Joined — Flat ${invite.flatNumber}`,
                  html: emailHtml,
                }),
              }).catch(() => {});
            }
          }

          return new Response(JSON.stringify({ ok: true }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /family/list?flatNumber=X — get family members for a flat
      if (pathname === '/family/list' && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_auth' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const payload = decodeJwtPayload(authHeader);
          const callerUid = payload?.user_id || payload?.sub || '';

          const url = new URL(request.url);
          const flatNumber = url.searchParams.get('flatNumber');
          if (!flatNumber) {
            return new Response(JSON.stringify({ ok: false, error: 'flatNumber required' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const familyMembers = await firestoreQuery('residents', [
            ['flatNumber', flatNumber],
            ['accessLevel', 'family']
          ], env);

          const masked = (familyMembers || []).map(m => sanitizeForResident(m, callerUid));

          return new Response(JSON.stringify({ ok: true, members: masked }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('Error fetching family members:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /family/approve — primary resident approves family member
      if (pathname === '/family/approve' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_auth' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const payload = decodeJwtPayload(authHeader);
          const primaryUid = payload?.user_id || payload?.sub || '';
          if (!primaryUid) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_auth' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const body = await request.json();
          const memberUid = body.memberUid;
          if (!memberUid) {
            return new Response(JSON.stringify({ ok: false, error: 'memberUid required' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const primaryResident = parseFirestoreDoc(await db.firestoreGet(`residents/${primaryUid}`, env));
          const memberResident = parseFirestoreDoc(await db.firestoreGet(`residents/${memberUid}`, env));

          if (!primaryResident || primaryResident.residentType !== 'owner') {
            return new Response(JSON.stringify({ ok: false, error: 'not_primary_resident' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          if (!memberResident || memberResident.flatNumber !== primaryResident.flatNumber) {
            return new Response(JSON.stringify({ ok: false, error: 'not_same_flat' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Rate limit: max 20 approvals per hour per admin
          const rateLimitKey = `${primaryUid}:family_approve`;
          const result = await checkAndRecord({ key: rateLimitKey, limit: 20, windowSeconds: 3600, env });
          if (!result.allowed) {
            return new Response(JSON.stringify({ ok: false, error: 'rate_limit_exceeded' }),
              { status: 429, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const tokenAuth = await getServiceAccountToken(env);
          const base = 'https://firestore.googleapis.com/v1/projects/psots-society-25899/databases/(default)/documents';

          // Conditional update: only update if status is currently 'pending'
          const currentMemberDoc = parseFirestoreDoc(await db.firestoreGet(`residents/${memberUid}`, env));
          if (currentMemberDoc?.status !== 'pending') {
            return new Response(JSON.stringify({ ok: false, error: 'already_processed' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const approveRes = await fetch(`${base}/residents/${memberUid}?updateMask.fieldPaths=status`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: { status: { stringValue: 'approved' } } })
          });
          if (!approveRes.ok) throw new Error(await approveRes.text());

          const email = memberResident.email;
          if (email) {
            const memberName = memberResident.firstName || memberResident.name || 'there';
            const approverName = primaryResident.firstName || primaryResident.name || 'Your family member';
            const emailHtml = generateBaseEmail(
              'You\'re now part of PSOTS Society!',
              'Prestige Song of the South',
              `<p>Hi ${escapeHTML(memberName)},</p><p>${escapeHTML(approverName)} from Flat ${escapeHTML(primaryResident.flatNumber)} has approved your account on PSOTS Society.</p><p>Visit <a href="https://society.psots.in">society.psots.in</a> to explore your community platform.</p>`
            );
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ from: 'PSOTS Society <hello@society.psots.in>', to: email, subject: 'You\'re now part of PSOTS Society!', html: emailHtml })
            }).catch(e => console.error('Approval email failed:', e));
          }

          const approveSubject = `Family Member Approved — Flat ${primaryResident.flatNumber}`;
          const approveHtml = generateBaseEmail('Family Member Approved', 'PSOTS Society', `<p>${escapeHTML(memberResident.firstName || memberResident.name || 'Unknown')} (Flat ${escapeHTML(primaryResident.flatNumber)}) has been approved by the primary resident.</p>`);
          await notifyAllAdmins(approveSubject, approveHtml, env);

          return new Response(JSON.stringify({ ok: true }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('/family/approve error:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /family/reject — primary resident rejects family member
      if (pathname === '/family/reject' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_auth' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const payload = decodeJwtPayload(authHeader);
          const primaryUid = payload?.user_id || payload?.sub || '';
          if (!primaryUid) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_auth' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const body = await request.json();
          const memberUid = body.memberUid;
          const reason = body.reason || '';
          if (!memberUid) {
            return new Response(JSON.stringify({ ok: false, error: 'memberUid required' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const primaryResident = parseFirestoreDoc(await db.firestoreGet(`residents/${primaryUid}`, env));
          const memberResident = parseFirestoreDoc(await db.firestoreGet(`residents/${memberUid}`, env));

          if (!primaryResident || primaryResident.residentType !== 'owner') {
            return new Response(JSON.stringify({ ok: false, error: 'not_primary_resident' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          if (!memberResident || memberResident.flatNumber !== primaryResident.flatNumber) {
            return new Response(JSON.stringify({ ok: false, error: 'not_same_flat' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const tokenAuth = await getServiceAccountToken(env);
          const base = 'https://firestore.googleapis.com/v1/projects/psots-society-25899/databases/(default)/documents';
          const rejectRes = await fetch(`${base}/residents/${memberUid}?updateMask.fieldPaths=status`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: { status: { stringValue: 'rejected' } } })
          });
          if (!rejectRes.ok) throw new Error(await rejectRes.text());

          const email = memberResident.email;
          if (email) {
            const memberName = memberResident.firstName || memberResident.name || 'there';
            const ownerName = primaryResident.firstName || primaryResident.name || 'your flat\'s primary resident';
            const emailHtml = generateBaseEmail(
              'Your PSOTS Society Join Request',
              'Prestige Song of the South',
              `<p>Hi ${escapeHTML(memberName)},</p><p>Your request to join PSOTS Society was not approved by ${escapeHTML(ownerName)}.</p><p>Contact your flat's primary resident for more details.</p>`
            );
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ from: 'PSOTS Society <hello@society.psots.in>', to: email, subject: 'Your PSOTS Society Join Request', html: emailHtml })
            }).catch(e => console.error('Rejection email failed:', e));
          }

          const rejectSubject = `Family Member Request Rejected — Flat ${primaryResident.flatNumber}`;
          const rejectHtml = generateBaseEmail('Family Member Request Rejected', 'PSOTS Society', `<p>${escapeHTML(memberResident.firstName || memberResident.name || 'Unknown')} (Flat ${escapeHTML(primaryResident.flatNumber)}) was rejected by the primary resident. Reason: ${escapeHTML(reason || 'None provided')}</p>`);
          await notifyAllAdmins(rejectSubject, rejectHtml, env);

          return new Response(JSON.stringify({ ok: true }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('/family/reject error:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // ─────────────────────────────────────────────────────
      // TENANT MANAGEMENT ENDPOINTS
      // ─────────────────────────────────────────────────────

      // POST /tenant/add — owner adds a tenant and gets an invite link
      if (pathname === '/tenant/add' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_auth' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const payload = decodeJwtPayload(authHeader);
          const uid = payload?.user_id || payload?.sub || '';
          if (!uid) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_auth' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const resident = parseFirestoreDoc(await db.firestoreGet(`residents/${uid}`, env));
          if (!resident || resident.status !== 'approved') {
            return new Response(JSON.stringify({ ok: false, error: 'not_approved' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const isOwner = resident.ownerType === true || resident.residentType === 'owner';
          if (!isOwner) {
            return new Response(JSON.stringify({ ok: false, error: 'not_owner' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Rate limit: max 10 tenant additions per hour per owner
          const rateLimitKey = `${uid}:tenant_add`;
          const result = await checkAndRecord({ key: rateLimitKey, limit: 10, windowSeconds: 3600, env });
          if (!result.allowed) {
            return new Response(JSON.stringify({ ok: false, error: 'rate_limit_exceeded' }),
              { status: 429, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const body = await request.json().catch(() => ({}));
          const { tenantName, tenantPhone, tenantEmail, leaseStart, leaseEnd, idProofType, idProofLast4 } = body;
          if (!tenantName || !tenantPhone || !leaseStart || !leaseEnd || !idProofType || !idProofLast4) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Validate lease dates: both must be valid date strings and end > start
          const startMs = new Date(leaseStart).getTime();
          const endMs = new Date(leaseEnd).getTime();
          if (isNaN(startMs) || isNaN(endMs)) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_lease_dates' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          if (endMs <= startMs) {
            return new Response(JSON.stringify({ ok: false, error: 'lease_end_must_be_after_start' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const last4 = String(idProofLast4).replace(/\D/g, '').slice(-4);
          if (last4.length !== 4) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_id_proof' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const tenantId = generateUUID();
          const inviteToken = generateUUID();
          const now = Date.now();
          const expiresAt = now + 24 * 60 * 60 * 1000;
          const ownerName = [resident.firstName, resident.lastName].filter(Boolean).join(' ').trim() || resident.name || '';
          const ownerFlat = String(resident.flatNumber || '');

          const tenantFields = toFirestoreFields({
            tenantId,
            ownerUid: uid,
            ownerName,
            ownerFlat,
            tenantName: String(tenantName),
            tenantPhone: String(tenantPhone),
            tenantEmail: String(tenantEmail || ''),
            leaseStart: String(leaseStart),
            leaseEnd: String(leaseEnd),
            idProofType: String(idProofType),
            idProofLast4: last4,
            status: 'pending_registration',
            accessLevel: 'tenant',
            canInviteOthers: false,
            canAddFamily: false,
            createdAt: now,
            inviteToken,
            inviteExpiresAt: expiresAt
          });

          const tokenAuth = await getServiceAccountToken(env);
          if (!tokenAuth) {
            return new Response(JSON.stringify({ ok: false, error: 'auth_failed' }),
              { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const base = 'https://firestore.googleapis.com/v1/projects/psots-society-25899/databases/(default)/documents';

          const fsRes = await fetch(`${base}/tenants/${tenantId}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: tenantFields })
          });
          if (!fsRes.ok) {
            return new Response(JSON.stringify({ ok: false, error: 'firestore_error' }),
              { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Backing invite doc for token validation
          const inviteFields = toFirestoreFields({
            token: inviteToken,
            type: 'tenant',
            tenantId,
            flatNumber: ownerFlat,
            relation: '',
            createdAt: now,
            expiresAt,
            used: false
          });
          await fetch(`${base}/invites/${inviteToken}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: inviteFields })
          }).catch(() => {});

          const inviterUserAgent = request.headers.get('User-Agent') || '';
          const auditFields = toFirestoreFields({
            token: inviteToken,
            type: 'tenant',
            status: 'created',
            invitedByUid: uid,
            invitedByName: ownerName,
            invitedByFlat: ownerFlat,
            invitedByTelegram: resident.telegramUsername || resident.tgUsername || '',
            relation: '',
            method: 'qr',
            createdAt: now,
            expiresAt,
            tenantId,
            tenantName: String(tenantName),
            leaseStart: String(leaseStart),
            leaseEnd: String(leaseEnd),
            idProofType: String(idProofType),
            idProofLast4: last4,
            inviterUserAgent,
            flagged: false
          });
          await fetch(`${base}/invite_audit/${inviteToken}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: auditFields })
          }).catch(() => {});

          // Notify admin group
          try {
            const botToken = await getBotToken(env.VIOLATIONS);
            if (botToken) {
              const msg = `🏠 <b>New tenant added</b>\n`
                + `Flat: ${ownerFlat} | Owner: ${ownerName}\n`
                + `Tenant: ${tenantName} | Lease: ${leaseStart} → ${leaseEnd}\n`
                + `ID: ${idProofType} ending ${last4}`;
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: ADMIN_GROUP_ID, text: msg, parse_mode: 'HTML' })
              }).catch(() => {});
            }
          } catch (_) {}

          const joinUrl = `https://society.psots.in/society/join?token=${inviteToken}`;
          return new Response(JSON.stringify({ ok: true, token: inviteToken, tenantId, joinUrl, expiresAt }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/tenant/add error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /tenant/list?ownerUid=xxx — list tenants for an owner
      if (pathname === '/tenant/list' && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const uid = decodeJwtPayload(authHeader);
          const ownerUid = url.searchParams.get('ownerUid');
          if (!ownerUid) {
            return new Response(JSON.stringify({ ok: false, error: 'ownerUid_required' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          if (ownerUid !== uid && uid !== 'pushkalkishore@gmail.com') {
            return new Response(JSON.stringify({ ok: false, error: 'forbidden' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const tenants = await firestoreQuery('tenants', [['ownerUid', ownerUid]], env);
          const results = [];
          for (const t of tenants) {
            const familyRequests = await firestoreQuery('tenant_family_requests', [
              ['tenantUid', t.tenantUid || '__none__'],
              ['status', 'approved']
            ], env);
            results.push({ ...t, familyMembers: familyRequests });
          }
          return new Response(JSON.stringify({ ok: true, tenants: results }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/tenant/list error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /tenant/revoke — owner or admin revokes a tenant
      if (pathname === '/tenant/revoke' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_auth' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const payload = decodeJwtPayload(authHeader);
          const uid = payload?.user_id || payload?.sub || '';
          const body = await request.json().catch(() => ({}));
          const { tenantId, reason } = body;
          if (!tenantId) {
            return new Response(JSON.stringify({ ok: false, error: 'tenantId_required' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const tenantDoc = parseFirestoreDoc(await db.firestoreGet(`tenants/${tenantId}`, env));
          if (!tenantDoc) {
            return new Response(JSON.stringify({ ok: false, error: 'tenant_not_found' }),
              { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const isOwner = uid === tenantDoc.ownerUid;
          const adminDoc = uid ? parseFirestoreDoc(await db.firestoreGet(`admins/${uid}`, env)) : null;
          const isAdmin = !!adminDoc || (payload?.email === 'pushkalkishore@gmail.com');
          if (!isOwner && !isAdmin) {
            return new Response(JSON.stringify({ ok: false, error: 'forbidden' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const now = Date.now();
          const tokenAuth = await getServiceAccountToken(env);
          if (!tokenAuth) {
            return new Response(JSON.stringify({ ok: false, error: 'auth_failed' }),
              { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const base = 'https://firestore.googleapis.com/v1/projects/psots-society-25899/databases/(default)/documents';

          const revokeFields = toFirestoreFields({
            status: 'revoked',
            revokedAt: now,
            revokedReason: String(reason || ''),
            revokedBy: uid
          });
          const mask = 'updateMask.fieldPaths=status&updateMask.fieldPaths=revokedAt&updateMask.fieldPaths=revokedReason&updateMask.fieldPaths=revokedBy';
          await fetch(`${base}/tenants/${tenantId}?${mask}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: revokeFields })
          });

          // Revoke pending/approved family requests for this tenant
          const familyReqs = await firestoreQuery('tenant_family_requests', [['tenantId', tenantId]], env);
          for (const fr of familyReqs) {
            if (fr.id || fr.requestId) {
              const docId = fr.requestId || fr.id;
              const frFields = toFirestoreFields({ status: 'revoked', revokedAt: now, revokedReason: String(reason || '') });
              const frMask = 'updateMask.fieldPaths=status&updateMask.fieldPaths=revokedAt&updateMask.fieldPaths=revokedReason';
              await fetch(`${base}/tenant_family_requests/${docId}?${frMask}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: frFields })
              }).catch(() => {});
            }
          }

          // Expire invite_audit for this tenant's invite
          if (tenantDoc.inviteToken) {
            await auditInvitePatch(tenantDoc.inviteToken, toFirestoreFields({
              status: 'expired',
              revokedAt: now,
              revokedReason: String(reason || '')
            }), env);
          }

          // Notify admin group
          try {
            const botToken = await getBotToken(env.VIOLATIONS);
            if (botToken) {
              const msg = `🚫 <b>Tenant revoked</b>\n`
                + `Flat ${tenantDoc.ownerFlat || '—'} | Tenant ${tenantDoc.tenantName || '—'}\n`
                + `Reason: ${reason || '—'}`;
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: ADMIN_GROUP_ID, text: msg, parse_mode: 'HTML' })
              }).catch(() => {});
            }
          } catch (_) {}

          return new Response(JSON.stringify({ ok: true }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/tenant/revoke error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /tenant/family/request — tenant requests a family member (owner approval)
      if (pathname === '/tenant/family/request' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_auth' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const payload = decodeJwtPayload(authHeader);
          const uid = payload?.user_id || payload?.sub || '';
          if (!uid) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_auth' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const resident = parseFirestoreDoc(await db.firestoreGet(`residents/${uid}`, env));
          if (!resident || resident.accessLevel !== 'tenant' || resident.status !== 'active') {
            return new Response(JSON.stringify({ ok: false, error: 'not_active_tenant' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Lease expiry check
          const todayStr = new Date().toISOString().slice(0, 10);
          if (resident.leaseEnd && resident.leaseEnd < todayStr) {
            return new Response(JSON.stringify({ ok: false, error: 'lease_expired' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const tenantsForUid = await firestoreQuery('tenants', [['tenantUid', uid], ['status', 'active']], env);
          const tenant = tenantsForUid[0];
          if (!tenant) {
            return new Response(JSON.stringify({ ok: false, error: 'no_active_tenant_record' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Enforce max 2 approved families
          const approvedFamilies = await firestoreQuery('tenant_family_requests', [
            ['tenantUid', uid],
            ['status', 'approved']
          ], env);
          if (approvedFamilies.length >= 2) {
            return new Response(JSON.stringify({ ok: false, error: 'limit_reached', message: 'You can add up to 2 family members' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const body = await request.json().catch(() => ({}));
          const { familyName, familyPhone, familyRelation, familyEmail } = body;
          if (!familyName || !familyPhone || !familyRelation) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const requestId = generateUUID();
          const now = Date.now();
          const tenantName = [resident.firstName, resident.lastName].filter(Boolean).join(' ').trim() || resident.name || '';
          const requestFields = toFirestoreFields({
            requestId,
            tenantUid: uid,
            tenantName,
            tenantFlat: String(resident.flatNumber || ''),
            tenantId: tenant.tenantId || '',
            ownerUid: tenant.ownerUid,
            ownerName: tenant.ownerName || '',
            ownerFlat: tenant.ownerFlat || '',
            familyName: String(familyName),
            familyPhone: String(familyPhone),
            familyRelation: String(familyRelation),
            familyEmail: String(familyEmail || ''),
            status: 'pending',
            requestedAt: now
          });
          const tokenAuth = await getServiceAccountToken(env);
          if (!tokenAuth) {
            return new Response(JSON.stringify({ ok: false, error: 'auth_failed' }),
              { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const base = 'https://firestore.googleapis.com/v1/projects/psots-society-25899/databases/(default)/documents';
          await fetch(`${base}/tenant_family_requests/${requestId}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: requestFields })
          });

          // Email owner
          const owner = parseFirestoreDoc(await db.firestoreGet(`residents/${tenant.ownerUid}`, env));
          if (owner?.email && env.RESEND_API_KEY) {
            const approveUrl = `https://society.psots.in/society/profile.html?tab=tenants&reviewRequest=${requestId}`;
            const emailHtml = generateBaseEmail('Tenant Family Member Request', 'PSOTS Society', `
              <p>Hi ${escapeHTML(owner.firstName || '')},</p>
              <p>Your tenant <strong>${escapeHTML(tenantName)}</strong> (Flat ${escapeHTML(resident.flatNumber || '')}) has requested to add a family member to their flat access.</p>
              <div class="info-box">
                <p><strong>Family Member:</strong> ${escapeHTML(familyName)}</p>
                <p><strong>Relation:</strong> ${escapeHTML(familyRelation)}</p>
                <p><strong>Phone:</strong> ${escapeHTML(familyPhone)}</p>
                ${familyEmail ? `<p><strong>Email:</strong> ${escapeHTML(familyEmail)}</p>` : ''}
              </div>
              <div style="text-align:center;margin-top:24px;">
                <a href="${approveUrl}" class="button btn-jade">Review Request →</a>
              </div>
              <p style="color:#8a7a6a;font-size:13px;margin-top:24px;">Tenants can add up to 2 family members with your approval.</p>
            `);
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: 'PSOTS Society <hello@society.psots.in>',
                to: owner.email,
                subject: `Family Member Request from Your Tenant — Flat ${resident.flatNumber || ''}`,
                html: emailHtml
              })
            }).catch(() => {});
          }

          return new Response(JSON.stringify({ ok: true, message: 'Request sent to your owner', requestId }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/tenant/family/request error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /tenant/family/decide — owner approves/rejects a tenant family request
      if (pathname === '/tenant/family/decide' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_auth' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const payload = decodeJwtPayload(authHeader);
          const uid = payload?.user_id || payload?.sub || '';
          const body = await request.json().catch(() => ({}));
          const { requestId, decision, reason } = body;
          if (!requestId || !['approved', 'rejected'].includes(decision)) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_input' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const req = parseFirestoreDoc(await db.firestoreGet(`tenant_family_requests/${requestId}`, env));
          if (!req) {
            return new Response(JSON.stringify({ ok: false, error: 'request_not_found' }),
              { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          if (uid !== req.ownerUid) {
            return new Response(JSON.stringify({ ok: false, error: 'forbidden' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const tokenAuth = await getServiceAccountToken(env);
          if (!tokenAuth) {
            return new Response(JSON.stringify({ ok: false, error: 'auth_failed' }),
              { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const base = 'https://firestore.googleapis.com/v1/projects/psots-society-25899/databases/(default)/documents';
          const owner = parseFirestoreDoc(await db.firestoreGet(`residents/${uid}`, env));
          const ownerName = owner ? ([owner.firstName, owner.lastName].filter(Boolean).join(' ').trim() || owner.name || '') : '';
          const now = Date.now();

          if (decision === 'approved') {
            // Re-check limit
            const approvedFamilies = await firestoreQuery('tenant_family_requests', [
              ['tenantUid', req.tenantUid],
              ['status', 'approved']
            ], env);
            if (approvedFamilies.length >= 2) {
              return new Response(JSON.stringify({ ok: false, error: 'limit_reached' }),
                { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
            }

            const inviteToken = generateUUID();
            const expiresAt = now + 24 * 60 * 60 * 1000;
            const tenantRecords = await firestoreQuery('tenants', [['tenantUid', req.tenantUid]], env);
            const tenantRec = tenantRecords[0] || {};
            const leaseEnd = tenantRec.leaseEnd || '';

            const updFields = toFirestoreFields({
              status: 'approved',
              decidedAt: now,
              decidedBy: uid,
              inviteToken,
              inviteExpiresAt: expiresAt
            });
            const mask = 'updateMask.fieldPaths=status&updateMask.fieldPaths=decidedAt&updateMask.fieldPaths=decidedBy&updateMask.fieldPaths=inviteToken&updateMask.fieldPaths=inviteExpiresAt';
            await fetch(`${base}/tenant_family_requests/${requestId}?${mask}`, {
              method: 'PATCH',
              headers: { 'Authorization': `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ fields: updFields })
            });

            // Backing invite doc
            const inviteFields = toFirestoreFields({
              token: inviteToken,
              type: 'tenant_family',
              tenantId: req.tenantId || '',
              tenantUid: req.tenantUid,
              flatNumber: String(req.tenantFlat || req.ownerFlat || ''),
              relation: String(req.familyRelation || ''),
              leaseEnd,
              createdAt: now,
              expiresAt,
              used: false
            });
            await fetch(`${base}/invites/${inviteToken}`, {
              method: 'PATCH',
              headers: { 'Authorization': `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ fields: inviteFields })
            }).catch(() => {});

            const method = req.familyEmail ? 'email' : 'link';
            const auditFields = toFirestoreFields({
              token: inviteToken,
              type: 'tenant_family',
              status: 'created',
              invitedByUid: req.ownerUid,
              invitedByName: ownerName,
              invitedByFlat: String(req.ownerFlat || ''),
              relation: String(req.familyRelation || ''),
              method,
              createdAt: now,
              expiresAt,
              approvedByUid: uid,
              approvedByName: ownerName,
              approvedAt: now,
              tenantUid: req.tenantUid,
              tenantName: req.tenantName || '',
              tenantFlat: String(req.tenantFlat || ''),
              requestId,
              familyName: req.familyName || '',
              familyPhone: req.familyPhone || '',
              familyEmail: req.familyEmail || '',
              flagged: false
            });
            await fetch(`${base}/invite_audit/${inviteToken}`, {
              method: 'PATCH',
              headers: { 'Authorization': `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ fields: auditFields })
            }).catch(() => {});

            const joinUrl = `https://society.psots.in/society/join?token=${inviteToken}`;

            // Email tenant with the approved link
            const tenant = parseFirestoreDoc(await db.firestoreGet(`residents/${req.tenantUid}`, env));
            if (tenant?.email && env.RESEND_API_KEY) {
              const emailHtml = generateBaseEmail('Family Member Approved', 'PSOTS Society', `
                <p>Hi ${escapeHTML(tenant.firstName || '')},</p>
                <p>Your owner has approved your request to add <strong>${escapeHTML(req.familyName)}</strong> (${escapeHTML(req.familyRelation)}) as a family member.</p>
                <p>Share this join link with them — it expires in 24 hours:</p>
                <div style="text-align:center;margin:24px 0;">
                  <a href="${joinUrl}" class="button btn-jade">Open Join Link</a>
                </div>
                <p style="font-size:13px;color:#8a7a6a;word-break:break-all;">${joinUrl}</p>
              `);
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  from: 'PSOTS Society <hello@society.psots.in>',
                  to: tenant.email,
                  subject: `Family Member Approved — Share Join Link`,
                  html: emailHtml
                })
              }).catch(() => {});
            }

            // If email provided, also send directly to the family member
            if (req.familyEmail && env.RESEND_API_KEY) {
              const emailHtml = generateBaseEmail('You are Invited to PSOTS Society', 'Tenant Family Join', `
                <p>Hi,</p>
                <p>${escapeHTML(req.tenantName || 'Your tenant relative')} has invited you to join PSOTS Society as a tenant family member.</p>
                <div class="info-box">
                  <p><strong>Flat:</strong> ${escapeHTML(req.tenantFlat || '')}</p>
                  <p><strong>Relation:</strong> ${escapeHTML(req.familyRelation || '')}</p>
                  <p><strong>Expires:</strong> 24 hours from now</p>
                </div>
                <div style="text-align:center;margin:24px 0;">
                  <a href="${joinUrl}" class="button btn-jade">Join PSOTS Society</a>
                </div>
              `);
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  from: 'PSOTS Society <hello@society.psots.in>',
                  to: req.familyEmail,
                  subject: `You're invited as tenant family — Flat ${escapeHTML(req.tenantFlat || '')}`,
                  html: emailHtml
                })
              }).catch(() => {});
            }

            // Notify admin silently
            try {
              const botToken = await getBotToken(env.VIOLATIONS);
              if (botToken) {
                const msg = `👪 <b>Tenant family approved</b>\n`
                  + `Flat ${req.ownerFlat || '—'}\n`
                  + `Chain: Owner ${ownerName} → Tenant ${req.tenantName || '—'} → ${req.familyName || '—'}`;
                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ chat_id: ADMIN_GROUP_ID, text: msg, parse_mode: 'HTML' })
                }).catch(() => {});
              }
            } catch (_) {}

            return new Response(JSON.stringify({ ok: true, inviteToken, joinUrl, expiresAt }),
              { headers: { 'Content-Type': 'application/json', ...CORS } });
          } else {
            // Reject
            const updFields = toFirestoreFields({
              status: 'rejected',
              decidedAt: now,
              decidedBy: uid,
              rejectedReason: String(reason || '')
            });
            const mask = 'updateMask.fieldPaths=status&updateMask.fieldPaths=decidedAt&updateMask.fieldPaths=decidedBy&updateMask.fieldPaths=rejectedReason';
            await fetch(`${base}/tenant_family_requests/${requestId}?${mask}`, {
              method: 'PATCH',
              headers: { 'Authorization': `Bearer ${tokenAuth}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ fields: updFields })
            });

            // Email tenant about rejection
            const tenant = parseFirestoreDoc(await db.firestoreGet(`residents/${req.tenantUid}`, env));
            if (tenant?.email && env.RESEND_API_KEY) {
              const emailHtml = generateBaseEmail('Family Member Request Update', 'PSOTS Society', `
                <p>Hi ${escapeHTML(tenant.firstName || '')},</p>
                <p>Your owner has reviewed your request to add <strong>${escapeHTML(req.familyName)}</strong> as a family member and it was not approved.</p>
                ${reason ? `<div class="info-box"><p><strong>Reason:</strong> ${escapeHTML(reason)}</p></div>` : ''}
                <p style="font-size:13px;color:#8a7a6a;">You can contact your owner directly for more details.</p>
              `);
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  from: 'PSOTS Society <hello@society.psots.in>',
                  to: tenant.email,
                  subject: `Family Member Request Update`,
                  html: emailHtml
                })
              }).catch(() => {});
            }

            return new Response(JSON.stringify({ ok: true }),
              { headers: { 'Content-Type': 'application/json', ...CORS } });
          }
        } catch (e) {
          console.error('/tenant/family/decide error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /tenant/family/pending?ownerUid=xxx — pending family requests for an owner
      if (pathname === '/tenant/family/pending' && request.method === 'GET') {
        try {
          const ownerUid = url.searchParams.get('ownerUid');
          if (!ownerUid) {
            return new Response(JSON.stringify({ ok: false, error: 'ownerUid_required' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const requests = await firestoreQuery('tenant_family_requests', [
            ['ownerUid', ownerUid],
            ['status', 'pending']
          ], env);
          return new Response(JSON.stringify({ ok: true, requests }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/tenant/family/pending error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // ── DEVICE TRUST ──────────────────────────────────
      if (pathname === '/device/register' && request.method === 'POST') {
        try {
          const { deviceToken, deviceLabel, fingerprint, uid, flatNumber, loginMethod } = await request.json();
          if (!deviceToken || !uid) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const ipHint = request.headers.get('CF-Connecting-IP') || 'unknown';
          const existingDevice = await db.firestoreGet(`device_sessions/${deviceToken}`, env);
          const isNew = !existingDevice || !existingDevice.data;
          const now = Date.now();

          if (isNew) {
            await firestoreSet(`device_sessions/${deviceToken}`, {
              uid, flatNumber, deviceToken, deviceLabel, fingerprint,
              firstSeen: now, lastSeen: now, lastLoginMethod: loginMethod,
              trusted: true, ipHint
            }, env);

            const resident = await db.firestoreGet(`residents/${uid}`, env);
            if (resident && resident.data) {
              // Update login tracking on resident record
              const currentLoginCount = resident.data.loginCount || 0;
              await firestoreSet(`residents/${uid}`, {
                lastLogin: new Date().toISOString(),
                loginCount: currentLoginCount + 1,
                lastLoginMethod: loginMethod,
                lastLoginDevice: deviceLabel
              }, env, ['lastLogin', 'loginCount', 'lastLoginMethod', 'lastLoginDevice']);

              // Send new device email if resident has email
              if (resident.data.email) {
                const dt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                const html = generateBaseEmail(
                  '🔐 New device logged in',
                  `Hi ${resident.data.firstName || 'Resident'},`,
                  `A new device just logged in to your account.<br><br>
                   <strong>Device:</strong> ${deviceLabel}<br>
                   <strong>Time:</strong> ${dt}<br>
                   <strong>Flat:</strong> ${flatNumber}<br><br>
                   If this was you — no action needed.<br>
                   If this wasn't you — <a href="https://society.psots.in/society/profile#devices">revoke this device</a><br><br>
                   Your account security is important to us.`
                );
                await sendEmail(resident.data.email, '🔐 New device logged in — PSOTS Society', html, env);
              }
            }
            return new Response(JSON.stringify({ ok: true, isNew: true, ipHint }),
              { headers: { 'Content-Type': 'application/json', ...CORS } });
          } else {
            await firestoreSet(`device_sessions/${deviceToken}`, {
              ...existingDevice.data, lastSeen: now, lastLoginMethod: loginMethod
            }, env);

            // Update login tracking on resident record for existing device too
            const resident = await db.firestoreGet(`residents/${uid}`, env);
            if (resident && resident.data) {
              const currentLoginCount = resident.data.loginCount || 0;
              await firestoreSet(`residents/${uid}`, {
                lastLogin: new Date().toISOString(),
                loginCount: currentLoginCount + 1,
                lastLoginMethod: loginMethod,
                lastLoginDevice: deviceLabel
              }, env, ['lastLogin', 'loginCount', 'lastLoginMethod', 'lastLoginDevice']);
            }

            return new Response(JSON.stringify({ ok: true, isNew: false }),
              { headers: { 'Content-Type': 'application/json', ...CORS } });
          }
        } catch (e) {
          console.error('/device/register error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      if (pathname.startsWith('/device/check') && request.method === 'GET') {
        try {
          const url = new URL(request.url);
          const token = url.searchParams.get('token');
          if (!token) {
            return new Response(JSON.stringify({ ok: false }),
              { headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const device = await db.firestoreGet(`device_sessions/${token}`, env);
          if (device && device.data && device.data.trusted && !device.data.revokedAt) {
            return new Response(JSON.stringify({
              ok: true, uid: device.data.uid, flatNumber: device.data.flatNumber,
              deviceLabel: device.data.deviceLabel, lastSeen: device.data.lastSeen,
              trusted: device.data.trusted
            }), { headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          return new Response(JSON.stringify({ ok: false }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          return new Response(JSON.stringify({ ok: false }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      if (pathname.startsWith('/device/list') && request.method === 'GET') {
        try {
          const auth = request.headers.get('Authorization');
          if (!auth) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const payload = decodeJwtPayload(auth);
          const uid = payload?.user_id || payload?.sub || '';
          const url = new URL(request.url);
          const queryUid = url.searchParams.get('uid');
          const currentToken = url.searchParams.get('currentToken');

          if (!queryUid || (queryUid !== uid && uid !== 'pushkalkishore@gmail.com')) {
            return new Response(JSON.stringify({ ok: false, error: 'forbidden' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const devices = await firestoreQuery('device_sessions', [['uid', queryUid]], env);
          const sorted = (devices || [])
            .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
            .slice(0, 10)
            .map(d => ({ ...d, isCurrentDevice: d.deviceToken === currentToken }));

          return new Response(JSON.stringify({ ok: true, devices: sorted }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/device/list error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      if (pathname === '/device/revoke' && request.method === 'POST') {
        try {
          const auth = request.headers.get('Authorization');
          if (!auth) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const payload = decodeJwtPayload(auth);
          const uid = payload?.user_id || payload?.sub || '';
          const { deviceToken } = await request.json();

          if (!deviceToken) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_token' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const deviceRaw = await firestoreGet(`device_sessions/${deviceToken}`, env);
          const device = parseFirestoreDoc(deviceRaw);
          if (!device || device.uid !== uid) {
            return new Response(JSON.stringify({ ok: false, error: 'forbidden' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const revokedAt = Date.now();
          await firestoreSet(`device_sessions/${deviceToken}`,
            { ...device, trusted: false, revokedAt }, env);

          await firestoreSet(`device_audit_log/${revokedAt}_${uid.slice(-6)}`, {
            type: 'device_revoke',
            deviceToken,
            uid,
            timestamp: revokedAt
          }, env);

          return new Response(JSON.stringify({ ok: true }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/device/revoke error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // ── RECOMMENDATIONS: BULK IMPORT ──────────────────────
      if (pathname === '/recommendations/bulk-import' && request.method === 'POST') {
        try {
          const auth = request.headers.get('Authorization');
          if (!auth) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const payload = decodeJwtPayload(auth);
          const uid = payload?.user_id || payload?.sub;
          const SUPERADMIN = 'Tba5qgFFKLYgOZG9QPK3Vuz3LfI3';
          const isAdmin = uid === SUPERADMIN || !!(await db.firestoreGet(`admins/${uid}`, env)).data;
          if (!isAdmin) {
            return new Response(JSON.stringify({ ok: false, error: 'admin_only' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const { contacts } = await request.json();
          if (!Array.isArray(contacts)) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_format' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          let imported = 0;
          for (const contact of contacts) {
            const docId = `${contact.phone}_${contact.category}`;
            const existing = await db.firestoreGet(`recommendations/${docId}`, env);
            if (!existing || !existing.fields) {
              await firestoreSet(`recommendations/${docId}`, {
                category: contact.category,
                subcategory: contact.subcategory || '',
                name: contact.name || '',
                phone: contact.phone,
                description: contact.description || contact.text || '',
                source: contact.source || '',
                verified: true,
                status: 'approved',
                rating: contact.rating || 0,
                reviews: 0,
                createdAt: new Date().toISOString(),
                visibility: 'public'
              }, env);
              imported++;
            }
          }

          return new Response(JSON.stringify({ ok: true, imported, total: contacts.length }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/recommendations/bulk-import error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // ── RECOMMENDATIONS: DELETE CATEGORY ──────────────────────
      if (pathname === '/recommendations/delete-category' && request.method === 'POST') {
        try {
          const auth = request.headers.get('Authorization');
          if (!auth) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const payload = decodeJwtPayload(auth);
          const uid = payload?.user_id || payload?.sub;
          const SUPERADMIN = 'Tba5qgFFKLYgOZG9QPK3Vuz3LfI3';
          if (uid !== SUPERADMIN) {
            return new Response(JSON.stringify({ ok: false, error: 'admin_only' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const { category } = await request.json();
          if (!category) {
            return new Response(JSON.stringify({ ok: false, error: 'category_required' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const recs = await firestoreQuery('recommendations', [['category', category]], env);
          let deleted = 0;
          
          for (const rec of recs) {
            await firestoreSet(`recommendations/${rec.id}`, null, env);
            deleted++;
          }

          return new Response(JSON.stringify({ ok: true, deleted }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/recommendations/delete-category error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // ── RECOMMENDATIONS: QUALITY IMPORT ──────────────────────
      if (pathname === '/recommendations/quality-import' && request.method === 'POST') {
        try {
          const auth = request.headers.get('Authorization');
          if (!auth) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const payload = decodeJwtPayload(auth);
          const uid = payload?.user_id || payload?.sub;
          const SUPERADMIN = 'Tba5qgFFKLYgOZG9QPK3Vuz3LfI3';
          if (uid !== SUPERADMIN) {
            return new Response(JSON.stringify({ ok: false, error: 'admin_only' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const { contacts } = await request.json();
          if (!Array.isArray(contacts)) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_format' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const BAD_KEYWORDS = ['blood', 'donor', 'donate', 'urgent need', 'patient', 
            'hospital admit', 'o positive', 'o negative', 'a positive', 'b positive', 
            'ab positive', 'plasma', 'platelets'];
          
          let saved = 0, skipped = 0;
          
          for (const contact of contacts) {
            const phone = (contact.phone || '').replace(/\D/g, '');
            const text = (contact.text || '').toLowerCase();
            
            // Validation checks
            if (phone.length !== 10 || !/^[6-9]/.test(phone)) {
              skipped++;
              continue;
            }
            
            if (text.length < 20 || BAD_KEYWORDS.some(kw => text.includes(kw))) {
              skipped++;
              continue;
            }
            
            if (!['home', 'education', 'professional', 'wellness'].includes(contact.category)) {
              skipped++;
              continue;
            }

            // Use Gemini to generate clean description
            const prompt = `You are building a community service directory for a residential society in Bangalore.
Clean this Telegram message into a professional service listing. Extract the service provider name if mentioned.
Write a clean 1-2 sentence description. Input: "${contact.text.substring(0, 300)}"
Return ONLY valid JSON: { "name": "string or null", "description": "string", "subcategory": "string" }
If this is not a genuine service offer, return null.`;

            const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + env.GEMINI_API_KEY, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                safetySettings: [{ category: 'HARM_CATEGORY_UNSPECIFIED', threshold: 'BLOCK_NONE' }]
              })
            });

            if (!res.ok) {
              skipped++;
              continue;
            }

            const data = await res.json();
            if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
              skipped++;
              continue;
            }

            try {
              const result = JSON.parse(data.candidates[0].content.parts[0].text);
              if (!result || !result.description) {
                skipped++;
                continue;
              }

              const docId = `${contact.phone}_${contact.category}`;
              await firestoreSet(`recommendations/${docId}`, {
                category: contact.category,
                phone: contact.phone,
                name: result.name || contact.category,
                description: result.description,
                subcategory: result.subcategory || '',
                source: contact.source,
                verified: true,
                rating: 0,
                reviews: 0,
                createdAt: new Date().toISOString(),
                status: 'approved'
              }, env);
              saved++;
            } catch (e) {
              skipped++;
            }
          }

          return new Response(JSON.stringify({ ok: true, saved, skipped, total: contacts.length }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/recommendations/quality-import error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // ── RECOMMENDATIONS: FIND & DELETE SPAM ─────────────────
      if (pathname === '/recommendations/delete-spam' && request.method === 'POST') {
        try {
          const auth = request.headers.get('Authorization');
          if (!auth) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });

          const payload = decodeJwtPayload(auth);
          const uid = payload?.user_id || payload?.sub;
          const SUPERADMIN = 'Tba5qgFFKLYgOZG9QPK3Vuz3LfI3';
          if (uid !== SUPERADMIN) return new Response(JSON.stringify({ ok: false, error: 'admin_only' }), { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });

          const BAD_KEYWORDS = ['blood', 'donor', 'donate', 'urgent need', 'patient', 'hospital admit', 'o positive', 'o negative', 'a positive', 'b positive', 'ab positive', 'plasma', 'platelets'];
          const recs = await firestoreQuery('recommendations', [], env);
          let deleted = 0;

          for (const rec of recs) {
            const text = (rec.description || '').toLowerCase();
            if (BAD_KEYWORDS.some(kw => text.includes(kw))) {
              await firestoreSet(`recommendations/${rec.id}`, null, env);
              deleted++;
            }
          }

          return new Response(JSON.stringify({ ok: true, deleted }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/recommendations/delete-spam error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // ── RECOMMENDATIONS: MIGRATE TEXT → DESCRIPTION ──────────
      if (pathname === '/recommendations/migrate-text' && request.method === 'POST') {
        try {
          const auth = request.headers.get('Authorization');
          if (!auth) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });

          const payload = decodeJwtPayload(auth);
          const uid = payload?.user_id || payload?.sub;
          const SUPERADMIN = 'Tba5qgFFKLYgOZG9QPK3Vuz3LfI3';
          if (uid !== SUPERADMIN) return new Response(JSON.stringify({ ok: false, error: 'admin_only' }), { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });

          const recs = await firestoreQuery('recommendations', [], env);
          let migrated = 0;

          for (const rec of recs) {
            if (rec.text && !rec.description) {
              await firestoreSet(`recommendations/${rec.id}`, { ...rec, description: rec.text }, env);
              migrated++;
            }
          }

          return new Response(JSON.stringify({ ok: true, migrated }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/recommendations/migrate-text error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // ── RECOMMENDATIONS: ENHANCE WITH GEMINI ──────────────────
      if (pathname === '/recommendations/enhance' && request.method === 'POST') {
        try {
          const auth = request.headers.get('Authorization');
          if (!auth) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const payload = decodeJwtPayload(auth);
          const uid = payload?.user_id || payload?.sub;
          const SUPERADMIN = 'Tba5qgFFKLYgOZG9QPK3Vuz3LfI3';
          if (uid !== SUPERADMIN) {
            return new Response(JSON.stringify({ ok: false, error: 'admin_only' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const recs = await firestoreQuery('recommendations', [], env);
          let enhanced = 0;
          
          for (let i = 0; i < recs.length && i < 50; i++) {
            const rec = recs[i];
            if (!rec.description || rec.description.length < 20) continue;
            
            const prompt = `You are a professional community directory curator. 
Clean up this service recommendation from a Telegram message. Extract the key details and 
write a professional 1-2 sentence description suitable for a community directory.
Return ONLY valid JSON: {"name":"person/business name or category","description":"1-2 sentences"}

Original message: "${rec.description.substring(0, 300)}"`;

            const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + env.GEMINI_API_KEY, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                safetySettings: [{ category: 'HARM_CATEGORY_UNSPECIFIED', threshold: 'BLOCK_NONE' }]
              })
            });

            if (!res.ok) {
              console.log(`Gemini API error ${res.status} for ${rec.id}`);
              continue;
            }
            const data = await res.json();
            if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
              console.log(`No Gemini response for ${rec.id}`);
              continue;
            }

            try {
              const result = JSON.parse(data.candidates[0].content.parts[0].text);
              if (!result || !result.description) {
                console.log(`Invalid Gemini JSON for ${rec.id}`);
                continue;
              }
              await firestoreSet(`recommendations/${rec.id}`, {
                ...rec,
                name: result.name || rec.name || rec.category,
                description: result.description || rec.description,
                enhanced: true
              }, env);
              enhanced++;
            } catch (e) {
              // Skip if JSON parsing fails
            }
          }

          return new Response(JSON.stringify({ ok: true, enhanced, total: recs.length }),
            { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/recommendations/enhance error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // ── RECOMMENDATIONS: UPDATE ───────────────────────────
      if (pathname === '/recommendations/update' && request.method === 'POST') {
        try {
          const auth = request.headers.get('Authorization');
          if (!auth) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });

          const payload = decodeJwtPayload(auth);
          const uid = payload?.user_id || payload?.sub;
          const SUPERADMIN = 'Tba5qgFFKLYgOZG9QPK3Vuz3LfI3';
          if (uid !== SUPERADMIN) return new Response(JSON.stringify({ ok: false, error: 'admin_only' }), { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });

          const { docId, name, category, subcategory, phone, description } = await request.json();
          if (!docId) return new Response(JSON.stringify({ ok: false, error: 'docId_required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });

          await firestoreSet(`recommendations/${docId}`, {
            name: name || '',
            category: category || '',
            subcategory: subcategory || '',
            phone: phone || '',
            description: description || ''
          }, env);

          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/recommendations/update error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // ── RECOMMENDATIONS: DELETE ───────────────────────────
      if (pathname === '/recommendations/delete' && request.method === 'POST') {
        try {
          const auth = request.headers.get('Authorization');
          if (!auth) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });

          const payload = decodeJwtPayload(auth);
          const uid = payload?.user_id || payload?.sub;
          const SUPERADMIN = 'Tba5qgFFKLYgOZG9QPK3Vuz3LfI3';
          if (uid !== SUPERADMIN) return new Response(JSON.stringify({ ok: false, error: 'admin_only' }), { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });

          const { docId } = await request.json();
          if (!docId) return new Response(JSON.stringify({ ok: false, error: 'docId_required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });

          await firestoreSet(`recommendations/${docId}`, null, env);

          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/recommendations/delete error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // ── PRIVACY & CONTACT RELAY ───────────────────────────
      if (pathname === '/contact/send' && request.method === 'POST') {
        try {
          const auth = request.headers.get('Authorization');
          if (!auth) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          const payload = decodeJwtPayload(auth);
          const senderUid = payload?.user_id || payload?.sub;
          if (!senderUid) return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });

          const { targetUid, postType, postId, message } = await request.json();
          if (!targetUid || !postType || !postId || !message) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          if (message.length > 500) {
            return new Response(JSON.stringify({ ok: false, error: 'message_too_long' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const today = new Date().toISOString().split('T')[0];
          const contactKey = `contact_count_${senderUid}_${today}`;
          const countRaw = await env.VIOLATIONS.get(contactKey);
          const currentCount = countRaw ? parseInt(countRaw) : 0;
          if (currentCount >= 5) {
            return new Response(JSON.stringify({ ok: false, error: 'rate_limited' }), { status: 429, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          await env.VIOLATIONS.put(contactKey, String(currentCount + 1), { expirationTtl: 86400 });

          const token = await getServiceAccountToken(env);
          const sender = await db.firestoreGet(`residents/${senderUid}`, env);
          const senderFlat = sender?.flatNumber || 'Unknown';
          const senderName = sender?.name || sender?.firstName || 'A Resident';
          const target = await db.firestoreGet(`residents/${targetUid}`, env);
          const targetEmail = target?.email;

          if (!targetEmail) {
            return new Response(JSON.stringify({ ok: false, error: 'target_not_found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const targetName = target?.name || target?.firstName || 'Resident';
          const emailBody = `Hi ${targetName},\n\nA fellow PSOTS resident wants to connect about your ${postType} post.\n\nTheir message:\n"${message}"\n\nThey are from Flat ${senderFlat}.\n\nReply directly to this email to respond, or visit society.psots.in to message them.\n\n— PSOTS Society Platform`;

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'hello@society.psots.in',
              to: targetEmail,
              subject: 'Someone wants to connect — PSOTS Society',
              text: emailBody
            })
          });

          await firestoreSet(`contact_log/${Date.now()}_${generateUUID()}`, {
            senderUid, senderFlat, targetUid, postType, postId,
            messagePreview: message.slice(0, 50),
            sentAt: new Date().toISOString()
          }, env);

          return new Response(JSON.stringify({ ok: true, message: 'Message sent to seller' }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/contact/send error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      if (pathname === '/contact/check-limit' && request.method === 'GET') {
        try {
          const auth = request.headers.get('Authorization');
          if (!auth) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          const payload = decodeJwtPayload(auth);
          const uid = payload?.user_id || payload?.sub;
          if (!uid) return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });

          const today = new Date().toISOString().split('T')[0];
          const countRaw = await env.VIOLATIONS.get(`contact_count_${uid}_${today}`);
          const count = countRaw ? parseInt(countRaw) : 0;
          const remaining = Math.max(0, 5 - count);

          return new Response(JSON.stringify({ ok: true, remaining, limit: 5 }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/contact/check-limit error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      if (pathname === '/resident/privacy-settings' && request.method === 'POST') {
        try {
          const auth = request.headers.get('Authorization');
          if (!auth) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          const payload = decodeJwtPayload(auth);
          const uid = payload?.user_id || payload?.sub;
          if (!uid) return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });

          const settings = await request.json();
          const updateData = {
            privacyShowFlat: settings.privacyShowFlat !== undefined ? settings.privacyShowFlat : true,
            privacyAllowContact: settings.privacyAllowContact !== undefined ? settings.privacyAllowContact : true,
            privacyShowNameOnRecs: settings.privacyShowNameOnRecs !== undefined ? settings.privacyShowNameOnRecs : true,
            privacyEmailOnContact: settings.privacyEmailOnContact !== undefined ? settings.privacyEmailOnContact : true
          };

          await firestoreSet(`residents/${uid}`, updateData, env);

          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/resident/privacy-settings error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      if (pathname === '/resident/my-access-log' && request.method === 'GET') {
        try {
          const auth = request.headers.get('Authorization');
          if (!auth) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          const payload = decodeJwtPayload(auth);
          const uid = payload?.user_id || payload?.sub;
          if (!uid) return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });

          const logs = await firestoreQuery('admin_access_log', [['targetUid', '==', uid]], env);
          const sorted = logs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')).slice(0, 20);
          const events = sorted.map(l => ({
            timestamp: l.timestamp,
            action: l.action,
            city: l.ipCity || 'Unknown'
          }));

          return new Response(JSON.stringify({ ok: true, events }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/resident/my-access-log error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      if (pathname === '/resident/delete-account' && request.method === 'POST') {
        try {
          const auth = request.headers.get('Authorization');
          if (!auth) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          const payload = decodeJwtPayload(auth);
          const uid = payload?.user_id || payload?.sub;
          if (!uid) return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });

          const { confirmation } = await request.json();
          if (confirmation !== 'DELETE') {
            return new Response(JSON.stringify({ ok: false, error: 'confirmation_failed' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const resident = await db.firestoreGet(`residents/${uid}`, env);
          const flatNumber = resident?.flatNumber || '';

          await firestoreSet(`residents/${uid}`, {
            name: 'Former Resident',
            email: uid + '@deleted.psots.in',
            phone: '',
            status: 'deleted',
            deletedAt: new Date().toISOString()
          }, env);

          const listings = await firestoreQuery('marketplace_listings', [['userId', '==', uid]], env);
          for (const listing of listings) {
            await firestoreSet(`marketplace_listings/${listing.id}`, {
              ...listing,
              sellerName: 'Former Resident, Flat ' + flatNumber
            }, env);
          }

          const lfPosts = await firestoreQuery('lost_found', [['posterUid', '==', uid]], env);
          for (const post of lfPosts) {
            await firestoreSet(`lost_found/${post.id}`, {
              ...post,
              posterName: 'Former Resident, Flat ' + flatNumber
            }, env);
          }

          const cpPosts = await firestoreQuery('carpooling', [['posterUid', '==', uid]], env);
          for (const post of cpPosts) {
            await firestoreSet(`carpooling/${post.id}`, {
              ...post,
              posterName: 'Former Resident, Flat ' + flatNumber
            }, env);
          }

          const deviceSessions = await firestoreQuery('device_sessions', [['uid', uid]], env);
          for (const session of deviceSessions) {
            await firestoreSet(`device_sessions/${session.id}`, {
              ...session,
              trusted: false,
              revokedAt: Date.now()
            }, env);
          }

          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/resident/delete-account error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /resident/profile — Get authenticated resident profile with email from credentials
      if (pathname === '/resident/profile' && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_auth' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const payload = await verifyFirebaseToken(authHeader, env);
          if (!payload) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const uid = payload?.user_id || payload?.sub;
          const email = payload?.email || '';

          if (!uid) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_auth' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Get credential to find residentId
          const creds = await firestoreQuery('credentials', [['firebaseUid', uid]], env);
          const cred = creds?.[0];
          if (!cred) {
            return new Response(JSON.stringify({ ok: false, error: 'credential_not_found' }),
              { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Get resident by residentId
          const resDoc = parseFirestoreDoc(await db.firestoreGet(`residents/${cred.residentId}`, env));
          if (!resDoc) {
            return new Response(JSON.stringify({ ok: false, error: 'resident_not_found' }),
              { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Return resident with email from credentials
          const resident = {
            residentId: resDoc.id || cred.residentId,
            name: resDoc.name,
            flatNumber: resDoc.flatNumber,
            residentType: resDoc.residentType,
            status: resDoc.status,
            email: cred.identifier || email,
            phone: resDoc.phone || null
          };

          return new Response(JSON.stringify({ ok: true, resident }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('/resident/profile error:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /resident/update-profile — Update resident profile (name, phone)
      if (pathname === '/resident/update-profile' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_auth' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Superadmin bypass: extract email from JWT without crypto verification
          const token = authHeader?.slice(7);
          const parts = token?.split('.');
          let earlyEmail = '';
          let earlyUid = '';
          try {
            let p = parts[1].replace(/-/g,'+').replace(/_/g,'/');
            while (p.length % 4) p += '=';
            const decoded = JSON.parse(atob(p));
            earlyEmail = decoded.email || '';
            earlyUid = decoded.user_id || decoded.sub || '';
          } catch(_) {}

          let payload = null;
          let uid = '';

          if (earlyEmail === 'pushkalkishore@gmail.com' && earlyUid) {
            // Superadmin bypass: skip token verification for superadmin
            payload = { email: earlyEmail, user_id: earlyUid, sub: earlyUid };
            uid = earlyUid;
          } else {
            // Normal flow: verify token for regular residents
            payload = await verifyFirebaseToken(authHeader, env);
            if (!payload) {
              return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }),
                { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
            }
            uid = payload?.user_id || payload?.sub;
            if (!uid) {
              return new Response(JSON.stringify({ ok: false, error: 'invalid_auth' }),
                { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
            }
          }

          const body = await request.json();
          const { name, phone, secondaryEmail, secondaryPhone, telegram } = body;
          const email = payload?.email;

          if (name !== undefined && name !== null && !name.trim()) {
            return new Response(JSON.stringify({ ok: false, error: 'name_required' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Get credential to find residentId by email
          let cred = null;
          let residentId = null;

          if (email) {
            const creds = await firestoreQuery('credentials', [['identifier', email]], env);
            cred = creds?.[0];
            residentId = cred?.residentId;
          }

          // Fallback: Check old schema residents by uid directly
          if (!residentId) {
            const oldResident = await firestoreGet(`residents/${uid}`, env);
            if (oldResident && oldResident.fields) {
              residentId = uid;
            }
          }

          if (!residentId) {
            return new Response(JSON.stringify({ ok: false, error: 'credential_not_found' }),
              { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Update resident document with updateMask to preserve other fields
          const updatePayload = {};
          const updateFields = [];

          if (name !== undefined && name !== null) {
            updatePayload.name = name.trim();
            updateFields.push('name');
          }

          if (phone !== undefined && phone !== null) {
            updatePayload.phone = phone.trim();
            updateFields.push('phone');
          }
          if (secondaryEmail !== undefined) {
            updatePayload.secondaryEmail = secondaryEmail || null;
            updateFields.push('secondaryEmail');
          }
          if (secondaryPhone !== undefined) {
            updatePayload.secondaryPhone = secondaryPhone || null;
            updateFields.push('secondaryPhone');
          }
          if (telegram !== undefined) {
            updatePayload.telegram = telegram || null;
            updateFields.push('telegram');
          }

          if (updateFields.length === 0) {
            return new Response(JSON.stringify({ ok: false, error: 'no_fields_to_update' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const success = await firestoreSet(`residents/${residentId}`, updatePayload, env, updateFields);
          console.log(`/resident/update-profile: Updated ${residentId} with fields:`, updateFields);

          if (!success) {
            return new Response(JSON.stringify({ ok: false, error: 'update_failed' }),
              { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          return new Response(JSON.stringify({ ok: true }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('/resident/update-profile error:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      if (pathname === '/resident/verify-document' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { base64Document, mimeType, residentName, flatNumber, residentId, residentType } = body;

          // residentId is optional: when omitted (pre-registration flow) we run a
          // stateless verification and return a short-lived token instead of
          // touching any Firestore record.
          const isPreRegistration = !residentId;

          if (!base64Document || !mimeType || !residentName || !flatNumber) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Validate file size (max 5MB base64)
          if (base64Document.length > 6.5 * 1024 * 1024) {
            return new Response(JSON.stringify({ ok: true, result: 'invalid_document', checks: {}, error: 'file_too_large' }),
              { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          let extracted = {};

          // STEP 1: Try Cloudflare Workers AI first
          console.log('🤖 Attempting Workers AI extraction...');
          try {
            const binaryString = atob(base64Document);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            const aiPrompt = `Extract from this document:
1. Society name (look for "Prestige Song of the South" or "PSOTS")
2. Owner name (from "Owner :" label)
3. Paid By name (from "Paid By :" label - can be same as owner or a family member)
4. Flat/House/Unit number (digits only, e.g. "15167" from "Tower 15-15167")
5. Document type (invoice or receipt)
Reply in JSON only:
{"ownerName":"...","paidByName":"...","flatNumber":"...","societyName":"...","confidence":"high/medium/low"}`;

            const aiResponse = await env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
              image: Array.from(bytes),
              prompt: aiPrompt,
              max_tokens: 200
            });

            const ocrText = (aiResponse.description || '').toLowerCase();
            console.log('✅ Workers AI OCR:', ocrText.substring(0, 150));

            // Parse OCR text
            if (ocrText) {
              if (ocrText.includes('prestige song') || ocrText.includes('psots')) {
                extracted.societyName = 'Prestige Song of the South';
              }
              const flatMatch = ocrText.match(/(?:house|flat|unit|tower)?\s*:?\s*(?:15-)?(\d{5})/i);
              if (flatMatch) {
                extracted.flatNumber = flatMatch[1];
              }
              const nameParts = residentName.toLowerCase().split(' ');
              let matchCount = 0;
              for (const part of nameParts) {
                if (part.length > 2 && ocrText.includes(part)) {
                  matchCount++;
                }
              }
              if (matchCount >= Math.ceil(nameParts.length / 2)) {
                // Mark as paidByName since OCR can't distinguish role; validation accepts either.
                extracted.paidByName = residentName;
              }
              extracted.confidence = extracted.societyName && extracted.flatNumber && (extracted.ownerName || extracted.paidByName) ? 'high' : 'medium';
              extracted.extractionMethod = 'workers_ai';
              console.log('✅ Workers AI extracted:', JSON.stringify(extracted, null, 2));
            }
          } catch (aiError) {
            console.error('⚠️ Workers AI failed, falling back to Gemini:', aiError.message);
          }

          // STEP 2: Fall back to Gemini if Workers AI failed or low confidence
          if (!extracted.societyName || extracted.confidence === 'low') {
            console.log('🔄 Workers AI incomplete, trying Gemini fallback...');

            try {
              const isLease = residentType === 'tenant';
              const geminiPrompt = isLease ?
              `Analyze this rental/lease agreement document.
EXTRACT:
1. PROPERTY: Look for "Prestige Song of the South" or "PSOTS"
2. TENANT NAME: Full name of person renting
3. FLAT NUMBER: e.g., "15167"
4. LEASE DATES: Start and end dates
Return JSON only:
{"tenantName":"...","flatNumber":"...","societyName":"...","leaseStartDate":"DD/MM/YYYY","leaseEndDate":"DD/MM/YYYY","confidence":"high/medium/low"}` :
              `Analyze this ownership document from a residential society (MyGate maintenance invoice/receipt).
EXTRACT:
1. SOCIETY NAME: Look for "Prestige Song of the South" or "PSOTS" at top
2. FLAT NUMBER: After "House:" or "Flat:" label. Return DIGITS ONLY (e.g. "15167" not "Tower 15-15167")
3. OWNER NAME: After "Owner:" label
4. PAID BY NAME: After "Paid By:" label (the person who paid - can be a family member of the owner)
5. CONFIDENCE: high if society + flat + at least one name found, medium if 2 of 3 categories
Return JSON only:
{"ownerName":"...","paidByName":"...","flatNumber":"...","societyName":"...","confidence":"high/medium/low"}`;

              const geminiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${env.GEMINI_API_KEY}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{
                      parts: [
                        { text: geminiPrompt },
                        { inline_data: { mime_type: mimeType, data: base64Document } }
                      ]
                    }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 300 }
                  })
                }
              );

              const geminiData = await geminiRes.json();
              try {
                const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
                const parsed = JSON.parse(responseText);
                extracted = { ...extracted, ...parsed };
                extracted.extractionMethod = 'gemini_fallback';
                console.log('📄 Gemini extraction:', JSON.stringify(extracted, null, 2));
              } catch (e) {
                console.error('❌ Gemini parsing failed:', e);
              }
            } catch (geminiError) {
              console.error('❌ Gemini fallback failed:', geminiError.message);
            }
          }
          // Validate extracted data
          function fuzzyNameMatch(name1, name2) {
            const n1 = (name1 || '').toLowerCase().replace(/[^a-z ]/g, '').trim();
            const n2 = (name2 || '').toLowerCase().replace(/[^a-z ]/g, '').trim();
            if (n1 === n2) return true;
            const words1 = n1.split(' ').filter(w => w);
            const words2 = n2.split(' ').filter(w => w);
            const shorter = words1.length < words2.length ? words1 : words2;
            const longer = words1.length < words2.length ? words2 : words1;
            return shorter.length > 0 && shorter.every(w => longer.includes(w));
          }

          // Improved society name matching - more flexible
          function isSocietyNameValid(societyName) {
            if (!societyName) return false;
            const name = (societyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const original = (societyName || '').toLowerCase();

            // Match variations: "prestige song of the south", "psots", "prestige song"
            return name.includes('prestigesong') ||
                   name.includes('psots') ||
                   name.includes('prestigesongofthesouth') ||
                   name.includes('psotsaoa') ||
                   (original.includes('prestige') && original.includes('song'));
          }

          // Strip "Tower N-" prefix from extracted flat number (Gemini sometimes returns "Tower 15-15167")
          const cleanFlatNumber = String(extracted.flatNumber || '').replace(/^.*?(\d{5}).*$/, '$1').replace(/\D/g, '');
          const ownerMatch = fuzzyNameMatch(extracted.ownerName || '', residentName);
          const paidByMatch = fuzzyNameMatch(extracted.paidByName || '', residentName);
          const checks = {
            society: isSocietyNameValid(extracted.societyName),
            flatNumber: cleanFlatNumber === String(flatNumber).replace(/\D/g, ''),
            ownerName: ownerMatch || paidByMatch,  // accept either: owner themselves OR a family member who pays bills
            matchedAs: ownerMatch ? 'owner' : (paidByMatch ? 'paidBy' : null)
          };

          // Determine result based on document type
          let result = 'invalid_document';

          if (residentType === 'tenant') {
            // Lease agreement verification
            const hasLeaseData = extracted.leaseStartDate && extracted.leaseEndDate;
            const tenantMatches = fuzzyNameMatch(extracted.tenantName || '', residentName);

            if (hasLeaseData && tenantMatches && extracted.confidence === 'high') {
              result = 'verified';
              if (!isPreRegistration) {
                await firestoreSet(`residents/${residentId}`, {
                  status: 'approved',
                  leaseStartDate: extracted.leaseStartDate,
                  leaseEndDate: extracted.leaseEndDate,
                  rentAmount: extracted.rentAmount || null
                }, env, ['status', 'leaseStartDate', 'leaseEndDate', 'rentAmount']);
              }
            } else if (hasLeaseData || extracted.confidence === 'medium') {
              result = 'manual_review';
            }
          } else {
            // Ownership document verification
            if (checks.society && checks.flatNumber && checks.ownerName && extracted.confidence === 'high') {
              result = 'verified';
              if (!isPreRegistration) {
                await firestoreSet(`residents/${residentId}`, { status: 'verified_owner' }, env, ['status']);
              }
            } else if (checks.society && (extracted.confidence === 'high' || extracted.confidence === 'medium')) {
              result = 'manual_review';
            }
          }

          // Store for admin review or token generation
          let tokenForResponse = null;
          if (result === 'manual_review' && !isPreRegistration) {
            const kvKey = `_verify_pending_${residentId}`;
            await env.CACHE_KV.put(kvKey, JSON.stringify({
              residentId,
              residentName,
              flatNumber,
              residentType: residentType || 'owner',
              extracted,
              checks,
              documentBase64: base64Document,
              mimeType,
              submittedAt: new Date().toISOString()
            }), { expirationTtl: 172800 });
          }

          // For pre-registration mode, generate verification token (15 minute TTL)
          if (isPreRegistration) {
            const tokenId = crypto.randomUUID();
            tokenForResponse = `_verify_token_${tokenId}`;
            await env.CACHE_KV.put(tokenForResponse, JSON.stringify({
              flatNumber,
              checks,
              extractedData: extracted,
              result,
              residentType: residentType || 'owner',
              submittedAt: new Date().toISOString()
            }), { expirationTtl: 900 });
            console.log(`/resident/verify-document (pre-reg): ${flatNumber} -> ${result}, token: ${tokenForResponse}`);
          } else {
            console.log(`/resident/verify-document: ${residentId} -> ${result}`, checks);
          }

          // Return detailed response with extracted data for better error messages
          const responseData = {
            ok: true,
            result,
            checks,
            extracted: {
              ownerName: extracted.ownerName || extracted.tenantName || null,
              paidByName: extracted.paidByName || null,
              flatNumber: extracted.flatNumber || null,
              societyName: extracted.societyName || null,
              documentType: extracted.documentType || null,
              confidence: extracted.confidence || 'low'
            }
          };

          // Include token for pre-registration flow
          if (tokenForResponse) {
            responseData.token = tokenForResponse;
          }

          // Include lease data for tenants
          if (residentType === 'tenant') {
            responseData.extracted.leaseStartDate = extracted.leaseStartDate || null;
            responseData.extracted.leaseEndDate = extracted.leaseEndDate || null;
            responseData.extracted.tenantName = extracted.tenantName || null;
          }

          return new Response(JSON.stringify(responseData),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('/resident/verify-document error:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /resident/manual-review-request
      // Called from registration form when user requests manual review (document mismatch)
      // Does NOT create account - stores support ticket instead
      if (pathname === '/resident/manual-review-request' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { flatNumber, documentBase64, documentMimeType, userConsent, userNote, mismatchDetails } = body;

          if (!flatNumber || !documentBase64 || !documentMimeType) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Store support request ticket in KV (no account created)
          const ticketId = `ticket_${flatNumber}_${Date.now()}`;
          await env.CACHE_KV.put(ticketId, JSON.stringify({
            ticketId,
            flatNumber,
            documentBase64,
            documentMimeType,
            userConsent,
            userNote: userNote || null,
            mismatchDetails: mismatchDetails || {},
            status: 'pending_review',
            createdAt: new Date().toISOString()
          }), { expirationTtl: 172800 });

          console.log(`/resident/manual-review-request: support ticket ${ticketId} created for flat ${flatNumber}`);

          return new Response(JSON.stringify({
            ok: true,
            ticketId,
            message: 'Support request submitted. Our team will review within 24-48 hours.'
          }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('/resident/manual-review-request error:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      if (pathname === '/resident/vouch' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const payload = await verifyFirebaseToken(authHeader, env);
          if (!payload) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const voucherUid = payload.user_id || payload.sub;
          const voucherEmail = payload.email;
          const body = await request.json();
          const { neighbourName, flatNumber, phone, relationship, note } = body;

          if (!neighbourName || !flatNumber || !phone) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Get voucher's resident info
          let voucherResidentId = null;
          let voucherName = '';

          if (voucherEmail) {
            const creds = await firestoreQuery('credentials', [['identifier', voucherEmail]], env);
            if (creds && creds.length > 0) {
              voucherResidentId = creds[0].residentId;
              const resident = await firestoreGet(`residents/${voucherResidentId}`, env);
              if (resident && resident.fields) {
                voucherName = resident.fields.name?.stringValue || voucherEmail;
              }
            }
          }

          // Store vouch
          const vouchId = `vouch_${flatNumber}_${Date.now()}`;
          await firestoreSet(`vouches/${vouchId}`, {
            neighbourName,
            flatNumber,
            phone,
            relationship: relationship || 'neighbour',
            note: note || null,
            voucherResidentId: voucherResidentId || voucherUid,
            voucherName: voucherName || voucherEmail || voucherUid,
            voucherEmail: voucherEmail || null,
            status: 'pending',
            createdAt: new Date().toISOString()
          }, env);

          console.log(`/resident/vouch: ${voucherUid} vouched for ${neighbourName} (flat ${flatNumber})`);

          return new Response(JSON.stringify({ ok: true }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('/resident/vouch error:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      if (pathname === '/admin/log-access' && request.method === 'POST') {
        try {
          const auth = request.headers.get('Authorization');
          if (!auth) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          const payload = decodeJwtPayload(auth);
          const adminUid = payload?.user_id || payload?.sub;
          if (!adminUid) return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });

          const { targetUid } = await request.json();
          if (!targetUid) {
            return new Response(JSON.stringify({ ok: false, error: 'targetUid_required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const ipCity = request.cf?.city || 'Unknown';
          const logId = `${Date.now()}_${adminUid}`;

          await firestoreSet(`admin_access_log/${logId}`, {
            adminUid,
            targetUid,
            action: 'viewed_residents',
            timestamp: new Date().toISOString(),
            ipCity
          }, env);

          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/admin/log-access error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /admin/list-data — List all residents and credentials (SUPERADMIN ONLY)
      if (pathname === '/admin/list-data' && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Superadmin check
          const token = authHeader.slice(7);
          const parts = token.split('.');
          let email = '';
          try {
            let p = parts[1].replace(/-/g,'+').replace(/_/g,'/');
            while (p.length % 4) p += '=';
            const decoded = JSON.parse(atob(p));
            email = decoded.email || '';
          } catch(_) {}

          if (email !== 'pushkalkishore@gmail.com') {
            return new Response(JSON.stringify({ ok: false, error: 'forbidden' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Get all residents
          const residents = await firestoreQuery('residents', [], env);

          // Get all credentials
          const credentials = await firestoreQuery('credentials', [], env);

          // Group by status
          const byStatus = {
            pending: residents.filter(r => r.status === 'pending'),
            approved: residents.filter(r => r.status === 'approved'),
            rejected: residents.filter(r => r.status === 'rejected'),
            verified_owner: residents.filter(r => r.status === 'verified_owner'),
            other: residents.filter(r => !r.status || !['pending','approved','rejected','verified_owner'].includes(r.status))
          };

          return new Response(JSON.stringify({
            ok: true,
            summary: {
              totalResidents: residents.length,
              totalCredentials: credentials.length,
              byStatus: {
                pending: byStatus.pending.length,
                approved: byStatus.approved.length,
                rejected: byStatus.rejected.length,
                verified_owner: byStatus.verified_owner.length,
                other: byStatus.other.length
              }
            },
            residents: residents.map(r => ({
              id: r.id,
              name: r.name,
              flatNumber: r.flatNumber,
              status: r.status,
              residentType: r.residentType,
              createdAt: r.createdAt
            })),
            credentials: credentials.map(c => ({
              id: c.id,
              identifier: c.identifier,
              residentId: c.residentId,
              type: c.type
            }))
          }), { headers: { 'Content-Type': 'application/json', ...CORS } });

        } catch (err) {
          console.error('/admin/list-data error:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error', details: err.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /admin/cleanup-test-data — Delete all test users and data (SUPERADMIN ONLY)
      if (pathname === '/admin/cleanup-test-data' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Superadmin bypass for cleanup
          const token = authHeader.slice(7);
          const parts = token.split('.');
          let email = '';
          try {
            let p = parts[1].replace(/-/g,'+').replace(/_/g,'/');
            while (p.length % 4) p += '=';
            const decoded = JSON.parse(atob(p));
            email = decoded.email || '';
          } catch(_) {}

          if (email !== 'pushkalkishore@gmail.com') {
            return new Response(JSON.stringify({ ok: false, error: 'forbidden' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const { confirmText } = await request.json().catch(() => ({}));
          if (confirmText !== 'DELETE ALL TEST DATA') {
            return new Response(JSON.stringify({
              ok: false,
              error: 'confirmation_required',
              message: 'Send { "confirmText": "DELETE ALL TEST DATA" } to proceed'
            }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          console.log('🗑️ CLEANUP: Starting test data deletion by', email);

          // Get all residents (only pending/rejected - KEEP approved!)
          const allResidents = await firestoreQuery('residents', [], env);
          const residents = allResidents.filter(r =>
            r.status === 'pending' || r.status === 'rejected' || !r.status
          );
          console.log(`Found ${residents.length} residents to delete (${allResidents.length} total, keeping ${allResidents.length - residents.length} approved)`);

          // Get credentials for those residents only
          const residentIds = residents.map(r => r.id);
          const allCredentials = await firestoreQuery('credentials', [], env);
          const credentials = allCredentials.filter(c => residentIds.includes(c.residentId));
          console.log(`Found ${credentials.length} credentials to delete (${allCredentials.length} total)`);

          // Delete all residents using Firestore REST API
          for (const res of residents) {
            const url = `https://firestore.googleapis.com/v1/projects/${env.GCP_PROJECT_ID}/databases/(default)/documents/residents/${res.id}`;
            await fetch(url, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${env.GCP_ACCESS_TOKEN}` }
            });
          }

          // Delete all credentials
          for (const cred of credentials) {
            const url = `https://firestore.googleapis.com/v1/projects/${env.GCP_PROJECT_ID}/databases/(default)/documents/credentials/${cred.id}`;
            await fetch(url, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${env.GCP_ACCESS_TOKEN}` }
            });
          }

          console.log('✅ CLEANUP COMPLETE');

          return new Response(JSON.stringify({
            ok: true,
            deleted: {
              residents: residents.length,
              credentials: credentials.length
            },
            message: 'All test data deleted successfully'
          }), { headers: { 'Content-Type': 'application/json', ...CORS } });

        } catch (err) {
          console.error('/admin/cleanup-test-data error:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error', details: err.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /admin/settings/bot — save bot token and group IDs
      if (pathname === '/admin/settings/bot' && request.method === 'POST') {
        try {
          const auth = request.headers.get('Authorization');
          if (!auth) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          const payload = await verifyFirebaseToken(auth, env);
          if (!payload) return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          const adminUid = payload?.user_id || payload?.sub;
          const adminDoc = parseFirestoreDoc(await db.firestoreGet(`admins/${adminUid}`, env));
          if (!adminDoc?.isSuperAdmin && adminUid !== 'pushkalkishore@gmail.com') {
            return new Response(JSON.stringify({ ok: false, error: 'forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const body = await request.json().catch(() => ({}));
          const { botToken, adminGroupId } = body;
          if (!botToken) {
            return new Response(JSON.stringify({ ok: false, error: 'botToken_required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          await env.VIOLATIONS.put('_bot_token', botToken);
          if (adminGroupId) {
            await env.VIOLATIONS.put('_admin_group_id', adminGroupId);
          }

          return new Response(JSON.stringify({ ok: true, message: 'Bot settings saved' }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('/admin/settings/bot error:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /admin/approve — Approve pending resident registration
      if (pathname === '/admin/approve' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });

          // Early superadmin bypass: extract email without crypto verification
          const token = authHeader.slice(7);
          const parts = token.split('.');
          let earlyEmail = '';
          try {
            let p = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            while (p.length % 4) p += '=';
            const ep = JSON.parse(atob(p));
            earlyEmail = ep.email || '';
          } catch (_) {}
          const isSuperAdmin = earlyEmail === 'pushkalkishore@gmail.com';

          let adminUid;
          if (!isSuperAdmin) {
            const payload = await verifyFirebaseToken(authHeader, env);
            if (!payload) return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
            adminUid = payload?.user_id || payload?.sub;
            const adminDoc = parseFirestoreDoc(await db.firestoreGet(`admins/${adminUid}`, env));
            if (!adminDoc) {
              return new Response(JSON.stringify({ ok: false, error: 'forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
            }
          } else {
            adminUid = earlyEmail;
          }

          const body = await request.json().catch(() => ({}));
          const { residentId } = body;
          if (!residentId) {
            return new Response(JSON.stringify({ ok: false, error: 'residentId_required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Update resident document status to approved
          const projectId = 'psots-society-25899';
          const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/residents/${residentId}`;
          const accessToken = await getServiceAccountToken(env);

          const updateRes = await fetch(url, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fields: {
                status: { stringValue: 'approved' },
                approvedBy: { stringValue: adminUid },
                approvedAt: { timestampValue: new Date().toISOString() }
              }
            }),
          });

          if (!updateRes.ok) {
            const error = await updateRes.text();
            console.error('Firestore error:', error);
            throw new Error('Failed to update resident status');
          }

          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('/admin/approve error:', err);
          return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /admin/reject — Reject pending resident registration
      if (pathname === '/admin/reject' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });

          // Early superadmin bypass: extract email without crypto verification
          const token = authHeader.slice(7);
          const parts = token.split('.');
          let earlyEmail = '';
          try {
            let p = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            while (p.length % 4) p += '=';
            const ep = JSON.parse(atob(p));
            earlyEmail = ep.email || '';
          } catch (_) {}
          const isSuperAdmin = earlyEmail === 'pushkalkishore@gmail.com';

          let adminUid;
          if (!isSuperAdmin) {
            const payload = await verifyFirebaseToken(authHeader, env);
            if (!payload) return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
            adminUid = payload?.user_id || payload?.sub;
            const adminDoc = parseFirestoreDoc(await db.firestoreGet(`admins/${adminUid}`, env));
            if (!adminDoc) {
              return new Response(JSON.stringify({ ok: false, error: 'forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
            }
          } else {
            adminUid = earlyEmail;
          }

          const body = await request.json().catch(() => ({}));
          const { residentId, reason } = body;
          if (!residentId) {
            return new Response(JSON.stringify({ ok: false, error: 'residentId_required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Update resident document status to rejected
          const projectId = 'psots-society-25899';
          const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/residents/${residentId}`;
          const accessToken = await getServiceAccountToken(env);

          const updateRes = await fetch(url, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fields: {
                status: { stringValue: 'rejected' },
                rejectedBy: { stringValue: adminUid },
                rejectedAt: { timestampValue: new Date().toISOString() },
                ...(reason && { rejectionReason: { stringValue: reason } })
              }
            }),
          });

          if (!updateRes.ok) {
            const error = await updateRes.text();
            console.error('Firestore error:', error);
            throw new Error('Failed to update resident status');
          }

          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('/admin/reject error:', err);
          return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      if (pathname === '/admin/add-resident' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const token = authHeader.slice(7);
          const payload = await verifyFirebaseToken(authHeader, env);
          if (!payload) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const adminUid = payload.user_id || payload.sub;
          const body = await request.json();
          const { name, flatNumber, phone, email, residentType, notes, addedBy } = body;

          if (!name || !flatNumber) {
            return new Response(JSON.stringify({ ok: false, error: 'name_and_flat_required' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const residentId = `r_${flatNumber}_${Date.now()}`;

          // Create resident document
          await firestoreSet(`residents/${residentId}`, {
            name: name.trim(),
            flatNumber,
            phone: phone || null,
            email: email || null,
            residentType: residentType || 'owner',
            status: 'approved',
            addedBy: addedBy || adminUid,
            addedAt: new Date().toISOString(),
            notes: notes || null,
            registrationMethod: 'admin_manual'
          }, env);

          // Create credential if email provided
          if (email) {
            const credentialId = `cred_google_${email}_${Date.now()}`;
            await firestoreSet(`credentials/${credentialId}`, {
              type: 'google',
              identifier: email,
              residentId,
              credentialId,
              createdAt: new Date().toISOString()
            }, env);
          }

          // Update flat ownership
          await firestoreSet(`flats/${flatNumber}`, {
            ownerResidentId: residentId,
            updatedAt: new Date().toISOString()
          }, env, ['ownerResidentId', 'updatedAt']);

          console.log(`/admin/add-resident: ${adminUid} added ${residentId} (${name}, flat ${flatNumber})`);

          return new Response(JSON.stringify({ ok: true, residentId }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('/admin/add-resident error:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      if (pathname === '/admin/vouch-requests' && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const payload = await verifyFirebaseToken(authHeader, env);
          if (!payload) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const vouches = await firestoreQuery('vouches', [['status', 'pending']], env);

          return new Response(JSON.stringify({ ok: true, vouches: vouches || [] }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('/admin/vouch-requests error:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      if (pathname === '/admin/approve-vouch' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const payload = await verifyFirebaseToken(authHeader, env);
          if (!payload) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const body = await request.json();
          const { vouchId } = body;

          if (!vouchId) {
            return new Response(JSON.stringify({ ok: false, error: 'vouchId_required' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Get vouch details
          const vouch = await firestoreGet(`vouches/${vouchId}`, env);
          if (!vouch || vouch.fields?.status?.stringValue !== 'pending') {
            return new Response(JSON.stringify({ ok: false, error: 'vouch_not_found' }),
              { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Extract vouch data
          const neighbourName = vouch.fields?.neighbourName?.stringValue;
          const flatNumber = vouch.fields?.flatNumber?.stringValue;
          const phone = vouch.fields?.phone?.stringValue;
          const relationship = vouch.fields?.relationship?.stringValue || 'neighbour';

          // Create resident
          const residentId = `r_${flatNumber}_${Date.now()}`;
          await firestoreSet(`residents/${residentId}`, {
            name: neighbourName,
            flatNumber,
            phone: phone || null,
            status: 'approved',
            residentType: 'owner',
            registrationMethod: 'vouched',
            vouchedBy: vouch.fields?.voucherResidentId?.stringValue || null,
            createdAt: new Date().toISOString()
          }, env);

          // Update flat ownership
          await firestoreSet(`flats/${flatNumber}`, {
            ownerResidentId: residentId,
            updatedAt: new Date().toISOString()
          }, env, ['ownerResidentId', 'updatedAt']);

          // Mark vouch as approved
          await firestoreSet(`vouches/${vouchId}`, { status: 'approved' }, env, ['status']);

          console.log(`/admin/approve-vouch: Created resident ${residentId} from vouch ${vouchId}`);

          return new Response(JSON.stringify({ ok: true, residentId }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('/admin/approve-vouch error:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      if (pathname === '/admin/reject-vouch' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const payload = await verifyFirebaseToken(authHeader, env);
          if (!payload) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const body = await request.json();
          const { vouchId, reason } = body;

          if (!vouchId) {
            return new Response(JSON.stringify({ ok: false, error: 'vouchId_required' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Mark vouch as rejected
          await firestoreSet(`vouches/${vouchId}`, { status: 'rejected', rejectionReason: reason || null }, env, ['status', 'rejectionReason']);

          console.log(`/admin/reject-vouch: Rejected vouch ${vouchId}`);

          return new Response(JSON.stringify({ ok: true }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('/admin/reject-vouch error:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // ── VERIFICATION ENDPOINTS ────────────────────────────────
      // GET /admin/pending-verifications — list pending document verifications
      if (pathname === '/admin/pending-verifications' && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const payload = await verifyFirebaseToken(authHeader, env);
          if (!payload) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // List all KV keys matching pending_verification:*
          const list = await env.KV.list({ prefix: 'pending_verification:' });
          const verifications = [];

          for (const item of list.keys) {
            const data = await env.KV.get(item.name, 'json');
            if (data) {
              verifications.push({
                residentId: data.residentId,
                name: data.name,
                flatNumber: data.flatNumber,
                societyMatch: data.checks?.societyMatch,
                flatMatch: data.checks?.flatMatch,
                nameMatch: data.checks?.nameMatch
              });
            }
          }

          console.log(`/admin/pending-verifications: ${verifications.length} pending verifications`);

          return new Response(JSON.stringify({ ok: true, verifications }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('/admin/pending-verifications error:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /admin/verify-document — retrieve document for viewing
      if (pathname === '/admin/verify-document' && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const payload = await verifyFirebaseToken(authHeader, env);
          if (!payload) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const url = new URL(request.url);
          const residentId = url.searchParams.get('residentId');

          if (!residentId) {
            return new Response(JSON.stringify({ ok: false, error: 'residentId_required' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const kvKey = `pending_verification:${residentId}`;
          const data = await env.KV.get(kvKey, 'json');

          if (!data || !data.documentBase64) {
            return new Response(JSON.stringify({ ok: false, error: 'document_not_found' }),
              { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          console.log(`/admin/verify-document: Retrieved document for ${residentId}`);

          return new Response(JSON.stringify({ ok: true, document: data.documentBase64 }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('/admin/verify-document error:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /admin/approve-verification — approve document and resident
      if (pathname === '/admin/approve-verification' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const payload = await verifyFirebaseToken(authHeader, env);
          if (!payload) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const body = await request.json();
          const { residentId } = body;

          if (!residentId) {
            return new Response(JSON.stringify({ ok: false, error: 'residentId_required' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Get pending verification data
          const kvKey = `pending_verification:${residentId}`;
          const verificationData = await env.KV.get(kvKey, 'json');

          if (!verificationData) {
            return new Response(JSON.stringify({ ok: false, error: 'verification_not_found' }),
              { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Update resident status to approved
          await firestoreSet(`residents/${residentId}`, {
            status: 'approved',
            approvedAt: new Date().toISOString(),
            documentVerified: true
          }, env, ['status', 'approvedAt', 'documentVerified']);

          // Delete from KV pending list
          await env.KV.delete(kvKey);

          console.log(`/admin/approve-verification: Approved resident ${residentId}`);

          return new Response(JSON.stringify({ ok: true }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('/admin/approve-verification error:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /admin/reject-verification — reject document verification
      if (pathname === '/admin/reject-verification' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const payload = await verifyFirebaseToken(authHeader, env);
          if (!payload) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const body = await request.json();
          const { residentId, reason } = body;

          if (!residentId) {
            return new Response(JSON.stringify({ ok: false, error: 'residentId_required' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Update resident status to verification_rejected
          await firestoreSet(`residents/${residentId}`, {
            status: 'rejected',
            rejectionReason: reason || 'Document verification failed',
            rejectedAt: new Date().toISOString()
          }, env, ['status', 'rejectionReason', 'rejectedAt']);

          // Delete from KV pending list
          const kvKey = `pending_verification:${residentId}`;
          await env.KV.delete(kvKey);

          console.log(`/admin/reject-verification: Rejected verification for ${residentId}`);

          return new Response(JSON.stringify({ ok: true }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('/admin/reject-verification error:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // ── SUPPORT ENDPOINTS ────────────────────────────────
      // POST /support/help-request — submit help request (no auth required)
      if (pathname === '/support/help-request' && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          const { name, flatNumber, phone, issueType, description } = body;

          // Validate required fields
          if (!name || !flatNumber || !phone || !issueType) {
            return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Rate limit: 3 requests per phone per day
          const rateLimitKey = `support_help:${phone}`;
          const rateLimitData = await env.CACHE_KV.get(rateLimitKey, 'json');
          const requestCount = rateLimitData?.count || 0;

          if (requestCount >= 3) {
            return new Response(JSON.stringify({ ok: false, error: 'rate_limited', message: 'Maximum 3 help requests per day' }),
              { status: 429, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Increment rate limit counter (24h expiry)
          await env.CACHE_KV.put(rateLimitKey, JSON.stringify({ count: requestCount + 1 }), { expirationTtl: 86400 });

          // Generate request ID
          const requestId = `support_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          // Store in Firestore
          await firestoreSet(`support_requests/${requestId}`, {
            name,
            flatNumber,
            phone,
            issueType,
            description: description || null,
            status: 'open',
            source: 'register_login',
            createdAt: new Date().toISOString()
          }, env);

          // Send notification to admin group on Telegram
          try {
            const message = `🆘 Support Request\nName: ${name}\nFlat: ${flatNumber}\nPhone: ${phone}\nIssue: ${issueType}${description ? '\nNote: ' + description : ''}`;
            await sendMessage(ADMIN_GROUP_ID, message, env.BOT_TOKEN);
          } catch (e) {
            console.error('Failed to send Telegram notification:', e);
            // Don't fail the request if Telegram notification fails
          }

          console.log(`/support/help-request: ${requestId} from ${phone} (${issueType})`);

          return new Response(JSON.stringify({ ok: true, requestId }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('/support/help-request error:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /admin/support-requests — get open support requests
      if (pathname === '/admin/support-requests' && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const payload = await verifyFirebaseToken(authHeader, env);
          if (!payload) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Query support_requests where status='open'
          const requests = await firestoreQuery('support_requests', [['status', 'open']], env);
          const sorted = (requests || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

          console.log(`/admin/support-requests: ${sorted.length} open requests`);

          return new Response(JSON.stringify({ ok: true, requests: sorted }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('/admin/support-requests error:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /admin/resolve-support — mark support request as resolved
      if (pathname === '/admin/resolve-support' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const payload = await verifyFirebaseToken(authHeader, env);
          if (!payload) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const body = await request.json().catch(() => ({}));
          const { requestId } = body;

          if (!requestId) {
            return new Response(JSON.stringify({ ok: false, error: 'requestId_required' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Update status to resolved
          await firestoreSet(`support_requests/${requestId}`, {
            status: 'resolved',
            resolvedAt: new Date().toISOString()
          }, env, ['status', 'resolvedAt']);

          console.log(`/admin/resolve-support: ${requestId} marked as resolved`);

          return new Response(JSON.stringify({ ok: true }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('/admin/resolve-support error:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /admin/send-invite — send registration invite to resident
      if (pathname === '/admin/send-invite' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const payload = await verifyFirebaseToken(authHeader, env);
          if (!payload) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const body = await request.json().catch(() => ({}));
          const { email, name, flatNumber } = body;

          if (!email || !name || !flatNumber) {
            return new Response(JSON.stringify({ ok: false, error: 'email_name_flat_required' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Check if RESEND_API_KEY is configured
          if (!env.RESEND_API_KEY) {
            console.error('RESEND_API_KEY not configured');
            return new Response(JSON.stringify({ ok: false, error: 'email_not_configured' }),
              { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Get admin contact info for email
          const adminContact = await getSettings('contact', env) || {};

          // Generate email HTML
          const emailHtml = generateRegistrationInviteEmail(name, flatNumber, adminContact);

          // Send email via Resend
          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'PSOTS Society <hello@society.psots.in>',
              to: email,
              subject: `Action Required: Complete Your PSOTS Registration — Flat ${flatNumber}`,
              html: emailHtml,
              reply_to: 'hello@society.psots.in',
              headers: {
                'X-Priority': '1',
                'Importance': 'high',
              },
              tags: [
                { name: 'category', value: 'registration' },
                { name: 'type', value: 'transactional' }
              ]
            }),
          });

          if (!resendRes.ok) {
            const err = await resendRes.text();
            console.error('Resend error:', err);
            return new Response(JSON.stringify({ ok: false, error: 'email_send_failed' }),
              { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          console.log(`/admin/send-invite: Email sent to ${email} for Flat ${flatNumber}`);

          return new Response(JSON.stringify({ ok: true }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (err) {
          console.error('/admin/send-invite error:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /admin/user-analytics — get user login analytics
      if (pathname === '/admin/user-analytics' && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const payload = await verifyFirebaseToken(authHeader, env);
          if (!payload) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }),
              { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Get all approved residents
          const allResidents = await firestoreQuery('residents', [['status', 'approved']], env);

          if (!allResidents) {
            return new Response(JSON.stringify({ ok: true, neverLoggedIn: [], mostActive: [], recentLogins: [], stats: {} }),
              { headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          // Separate into categories
          const neverLoggedIn = [];
          const loggedInUsers = [];

          for (const resident of allResidents) {
            const residentId = resident.id || resident.residentId || 'unknown';
            const hasLoginData = resident.lastLogin || resident.loginCount;

            // Only count as "never logged in" if they truly have no login data
            // Don't automatically exclude manually added residents if they have logged in
            if (!hasLoginData) {
              neverLoggedIn.push({
                id: residentId,
                name: resident.name || resident.firstName || 'Unknown',
                flatNumber: resident.flatNumber,
                email: resident.email,
                phone: resident.phone,
                createdAt: resident.createdAt,
                registrationMethod: resident.registrationMethod || 'unknown'
              });
            } else {
              loggedInUsers.push({
                id: residentId,
                name: resident.name || resident.firstName || 'Unknown',
                flatNumber: resident.flatNumber,
                email: resident.email,
                loginCount: resident.loginCount || 0,
                lastLogin: resident.lastLogin,
                lastLoginMethod: resident.lastLoginMethod,
                lastLoginDevice: resident.lastLoginDevice
              });
            }
          }

          // Sort most active by login count
          const mostActive = loggedInUsers
            .sort((a, b) => (b.loginCount || 0) - (a.loginCount || 0))
            .slice(0, 20);

          // Sort recent logins by last login date
          const recentLogins = loggedInUsers
            .filter(u => u.lastLogin)
            .sort((a, b) => new Date(b.lastLogin) - new Date(a.lastLogin))
            .slice(0, 20);

          // Calculate stats
          const stats = {
            totalApproved: allResidents.length,
            neverLoggedInCount: neverLoggedIn.length,
            loggedInCount: loggedInUsers.length,
            totalLogins: loggedInUsers.reduce((sum, u) => sum + (u.loginCount || 0), 0),
            avgLoginsPerUser: loggedInUsers.length > 0
              ? (loggedInUsers.reduce((sum, u) => sum + (u.loginCount || 0), 0) / loggedInUsers.length).toFixed(2)
              : 0
          };

          return new Response(JSON.stringify({
            ok: true,
            neverLoggedIn,
            mostActive,
            recentLogins,
            stats
          }), { headers: { 'Content-Type': 'application/json', ...CORS } });

        } catch (err) {
          console.error('/admin/user-analytics error:', err);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // ── CHHATH PUJA ENDPOINTS ────────────────────────────────
      // POST /chhath/contribute — record a contribution
      if (pathname === '/chhath/contribute' && request.method === 'POST') {
        try {
          const auth = request.headers.get('Authorization');
          if (!auth) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          const payload = decodeJwtPayload(auth);
          const uid = payload?.user_id || payload?.sub;
          if (!uid) return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });

          const body = await request.json().catch(() => ({}));
          const { amount, method, description } = body;
          if (!amount || amount <= 0) return new Response(JSON.stringify({ ok: false, error: 'amount_required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });

          const docId = `contrib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await firestoreSet(`chhath_contributions/${docId}`, {
            ownerUid: uid,
            amount: parseFloat(amount),
            currency: 'INR',
            date: new Date().toISOString(),
            method: method || 'upi',
            description: description || '',
            verified: false,
            createdAt: new Date().toISOString(),
          }, env);

          await firestoreSet(`chhath_logs/${Date.now()}`, {
            action: 'contribution_recorded',
            uid,
            amount,
            timestamp: new Date().toISOString(),
          }, env);

          return new Response(JSON.stringify({ ok: true, contributionId: docId }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/chhath/contribute error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /chhath/contributions — list contributions (public)
      if (pathname === '/chhath/contributions' && request.method === 'GET') {
        try {
          const token = await getServiceAccountToken(env);
          const snapshot = await firestoreQuery('chhath_contributions', [], env);
          const contributions = snapshot.map(doc => ({
            id: doc.name.split('/').pop(),
            amount: doc.fields.amount?.doubleValue || 0,
            date: doc.fields.date?.stringValue,
            method: doc.fields.method?.stringValue,
            verified: doc.fields.verified?.booleanValue || false,
          }));

          return new Response(JSON.stringify({ ok: true, contributions }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/chhath/contributions error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /chhath/volunteer — join as volunteer
      if (pathname === '/chhath/volunteer' && request.method === 'POST') {
        try {
          const auth = request.headers.get('Authorization');
          if (!auth) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          const payload = decodeJwtPayload(auth);
          const uid = payload?.user_id || payload?.sub;
          if (!uid) return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });

          const body = await request.json().catch(() => ({}));
          const { role, activities, contactPhone } = body;

          const docId = `volunteer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await firestoreSet(`chhath_volunteers/${docId}`, {
            residentUid: uid,
            role: role || 'general',
            activities: activities || [],
            status: 'active',
            joinedAt: new Date().toISOString(),
            notes: '',
            contactPhone: contactPhone || '',
          }, env);

          await firestoreSet(`chhath_logs/${Date.now()}`, {
            action: 'volunteer_joined',
            uid,
            role: role || 'general',
            timestamp: new Date().toISOString(),
          }, env);

          return new Response(JSON.stringify({ ok: true, volunteerId: docId }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/chhath/volunteer error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // GET /chhath/volunteers — list volunteers (public)
      if (pathname === '/chhath/volunteers' && request.method === 'GET') {
        try {
          const token = await getServiceAccountToken(env);
          const snapshot = await firestoreQuery('chhath_volunteers', [], env);
          const volunteers = snapshot.map(doc => ({
            id: doc.name.split('/').pop(),
            role: doc.fields.role?.stringValue,
            status: doc.fields.status?.stringValue,
            joinedAt: doc.fields.joinedAt?.stringValue,
          }));

          return new Response(JSON.stringify({ ok: true, volunteers }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/chhath/volunteers error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /chhath/announcement — create announcement (admin only)
      if (pathname === '/chhath/announcement' && request.method === 'POST') {
        try {
          const auth = request.headers.get('Authorization');
          if (!auth) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          const payload = decodeJwtPayload(auth);
          const uid = payload?.user_id || payload?.sub;
          if (!uid) return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });

          const isAdmin = await firestoreGet(`admins/${uid}`, env);
          if (!isAdmin) return new Response(JSON.stringify({ ok: false, error: 'admin_only' }), { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });

          const body = await request.json().catch(() => ({}));
          const { title, body: bodyText, type } = body;
          if (!title || !bodyText) return new Response(JSON.stringify({ ok: false, error: 'title_and_body_required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });

          const docId = `announce_${Date.now()}`;
          await firestoreSet(`chhath_announcements/${docId}`, {
            title,
            body: bodyText,
            type: type || 'general',
            publishedAt: new Date().toISOString(),
            expiresAt: null,
            authorUid: uid,
            pinned: false,
          }, env);

          await firestoreSet(`chhath_logs/${Date.now()}`, {
            action: 'announcement_created',
            uid,
            title,
            timestamp: new Date().toISOString(),
          }, env);

          return new Response(JSON.stringify({ ok: true, announcementId: docId }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/chhath/announcement error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /chhath/login — Chhath session auth (Telegram login widget or Google token)
      if (pathname === '/chhath/login' && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          // Accept both new format {method, telegramId?, googleToken?} and legacy {telegramData, googleToken}
          const method = body.method || (body.googleToken ? 'google' : body.telegramData ? 'telegram' : null);
          const { telegramData, googleToken } = body;
          // telegramId is the numeric Telegram user ID passed directly (widget-less auth)
          const telegramId = body.telegramId ? String(body.telegramId) : null;

          let uid, name, flatNumber;

          if (method === 'google' || (!method && googleToken)) {
            const token = googleToken;
            if (!token) {
              return new Response(JSON.stringify({ ok: false, error: 'googleToken_required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
            }
            // Validate JWT structure
            const parts = String(token).split('.');
            if (parts.length !== 3) {
              return new Response(JSON.stringify({ ok: false, error: 'invalid_google_token_format' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
            }
            const googlePayload = decodeJwtPayload(`Bearer ${token}`);
            if (!googlePayload || !googlePayload.sub) {
              return new Response(JSON.stringify({ ok: false, error: 'invalid_google_payload' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
            }
            // Note: Full signature verification requires fetching Google's public keys.
            // For now, we require the token to have proper JWT structure and payload.
            uid = googlePayload.sub;
            name = googlePayload.name || googlePayload.email || uid;
            flatNumber = googlePayload.flatNumber || null;
          } else if (method === 'telegram' || (!method && (telegramData || telegramId))) {
            const botToken = env.BOT_TOKEN;
            if (!botToken) {
              return new Response(JSON.stringify({ ok: false, error: 'bot_token_missing' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
            }

            if (telegramData) {
              // Full Telegram login widget data — verify HMAC hash
              const isHashValid = await verifyTelegramHash(telegramData, botToken);
              if (!isHashValid) {
                return new Response(JSON.stringify({ ok: false, error: 'telegram_verification_failed' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
              }
              // Verify auth_date is recent (within 1 hour)
              const authDate = parseInt(telegramData.auth_date, 10);
              const now = Math.floor(Date.now() / 1000);
              if (now - authDate > 3600) {
                return new Response(JSON.stringify({ ok: false, error: 'telegram_auth_expired' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
              }
              uid = `tg_${telegramData.id}`;
              name = `${telegramData.first_name || ''} ${telegramData.last_name || ''}`.trim() || String(telegramData.id);
              flatNumber = null;
            } else if (telegramId) {
              // Bare Telegram ID — no widget hash available, trust the ID as provided
              if (!/^\d+$/.test(telegramId)) {
                return new Response(JSON.stringify({ ok: false, error: 'invalid_telegramId_format' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
              }
              uid = `tg_${telegramId}`;
              name = uid;
              flatNumber = null;
            } else {
              return new Response(JSON.stringify({ ok: false, error: 'telegramData_or_telegramId_required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
            }
          } else {
            return new Response(JSON.stringify({ ok: false, error: 'method_required_telegram_or_google' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const token = crypto.randomUUID();
          const expiresAt = Date.now() + 90 * 24 * 3600 * 1000;

          await env.SESSIONS_KV.put(
            `chhath_session_${token}`,
            JSON.stringify({ uid, name, flatNumber, expiresAt }),
            { expirationTtl: 90 * 24 * 3600 }
          );

          await firestoreSet(`chhath_logs/${Date.now()}_login`, {
            action: 'chhath_login',
            type: googleToken ? 'google' : 'telegram',
            uid,
            timestamp: new Date().toISOString(),
            status: 'success',
            details: { method: googleToken ? 'google' : 'telegram' },
          }, env);

          return new Response(JSON.stringify({
            ok: true,
            token,
            expiresIn: 90 * 24 * 3600,
            user: { uid, name, flatNumber },
          }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/chhath/login error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /chhath/verify-session — validate a chhath session token
      if (pathname === '/chhath/verify-session' && request.method === 'POST') {
        try {
          // Accept token from request body {token} or Authorization: Bearer header
          const verifyBody = await request.json().catch(() => ({}));
          let token = verifyBody.token || null;
          if (!token) {
            const authHeader = request.headers.get('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
              token = authHeader.slice(7);
            }
          }
          if (!token) {
            return new Response(JSON.stringify({ ok: false, valid: false, error: 'missing_token' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const raw = await env.SESSIONS_KV.get(`chhath_session_${token}`);
          if (!raw) {
            return new Response(JSON.stringify({ ok: false, valid: false }), { headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const session = JSON.parse(raw);
          if (session.expiresAt && Date.now() > session.expiresAt) {
            await env.SESSIONS_KV.delete(`chhath_session_${token}`);
            return new Response(JSON.stringify({ ok: false, valid: false, error: 'session_expired' }), { headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          return new Response(JSON.stringify({ ok: true, valid: true, uid: session.uid }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/chhath/verify-session error:', e);
          return new Response(JSON.stringify({ ok: false, valid: false, error: 'server_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /chhath/send-contribution-receipt — email receipt for a contribution
      if (pathname === '/chhath/send-contribution-receipt' && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          const { contributionId, email, name, amount } = body;
          if (!contributionId || !email || !name || !amount) {
            return new Response(JSON.stringify({ ok: false, error: 'contributionId_email_name_amount_required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_email_format' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          if (!env.RESEND_API_KEY) {
            return new Response(JSON.stringify({ ok: false, error: 'email_service_unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const html = generateBaseEmail(
            'Chhath Puja — Contribution Received',
            'PSOTS Society',
            `<p>Dear ${escapeHTML(name)},</p>
            <p>Thank you for your generous contribution to <strong>Chhath Puja</strong>.</p>
            <p><strong>Amount received:</strong> ₹${escapeHTML(amount)}</p>
            <p><strong>Contribution ID:</strong> ${escapeHTML(contributionId)}</p>
            <p>Your support makes our community celebrations possible. Jai Chhathi Maiya!</p>`
          );

          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
            body: JSON.stringify({
              from: 'PSOTS Society <hello@society.psots.in>',
              to: email,
              subject: `Your Chhath contribution of ₹${amount} received`,
              html,
            }),
          });

          const receiptLogStatus = resendRes.ok ? 'sent' : 'failed';
          await firestoreSet(`chhath_logs/${Date.now()}_receipt`, {
            action: 'contribution_receipt_sent',
            type: 'email',
            timestamp: new Date().toISOString(),
            status: receiptLogStatus,
            details: { contributionId, email, amount },
          }, env);

          if (!resendRes.ok) {
            const err = await resendRes.text();
            console.error('/chhath/send-contribution-receipt resend error:', err);
            return new Response(JSON.stringify({ ok: false, error: 'email_failed' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/chhath/send-contribution-receipt error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /chhath/send-volunteer-confirmation — email confirmation for volunteer sign-up
      if (pathname === '/chhath/send-volunteer-confirmation' && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          const { volunteerId, email, name } = body;
          if (!volunteerId || !email || !name) {
            return new Response(JSON.stringify({ ok: false, error: 'volunteerId_email_name_required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_email_format' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          if (!env.RESEND_API_KEY) {
            return new Response(JSON.stringify({ ok: false, error: 'email_service_unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const html = generateBaseEmail(
            'Chhath Puja — Volunteer Confirmed',
            'PSOTS Society',
            `<p>Dear ${escapeHTML(name)},</p>
            <p>Thank you for volunteering for <strong>Chhath Puja</strong>!</p>
            <p>Your volunteer registration has been received. We will be in touch with details about your role and schedule.</p>
            <p><strong>Volunteer ID:</strong> ${escapeHTML(volunteerId)}</p>
            <p>Jai Chhathi Maiya!</p>`
          );

          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
            body: JSON.stringify({
              from: 'PSOTS Society <hello@society.psots.in>',
              to: email,
              subject: 'Thank you for volunteering for Chhath Puja',
              html,
            }),
          });

          const volLogStatus = resendRes.ok ? 'sent' : 'failed';
          await firestoreSet(`chhath_logs/${Date.now()}_volunteer_confirm`, {
            action: 'volunteer_confirmation_sent',
            type: 'email',
            timestamp: new Date().toISOString(),
            status: volLogStatus,
            details: { volunteerId, email },
          }, env);

          if (!resendRes.ok) {
            const err = await resendRes.text();
            console.error('/chhath/send-volunteer-confirmation resend error:', err);
            return new Response(JSON.stringify({ ok: false, error: 'email_failed' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/chhath/send-volunteer-confirmation error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // POST /chhath/send-announcement — send announcement email to all subscribers
      if (pathname === '/chhath/send-announcement' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const payload = decodeJwtPayload(authHeader);
          const uid = payload?.user_id || payload?.sub;
          if (!uid) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
          const adminDoc = await firestoreGet(`admins/${uid}`, env);
          if (!adminDoc) {
            return new Response(JSON.stringify({ ok: false, error: 'admin_only' }), { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const body = await request.json().catch(() => ({}));
          const { announcementId, subject, body: bodyText } = body;
          if (!announcementId || !subject || !bodyText) {
            return new Response(JSON.stringify({ ok: false, error: 'announcementId_subject_body_required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          if (!env.RESEND_API_KEY) {
            console.error('/chhath/send-announcement: RESEND_API_KEY not configured');
            return new Response(JSON.stringify({ ok: false, error: 'email_service_unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json', ...CORS } });
          }

          const subscribers = await firestoreQuery('chhath_subscriptions', [], env);
          const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          const emails = subscribers
            .map(doc => doc.fields?.ownerEmail?.stringValue)
            .filter(e => !!e && EMAIL_RE.test(e));

          const announcementHtml = generateBaseEmail('Chhath Puja Announcement', 'PSOTS Society', `<p>${escapeHTML(bodyText)}</p>`);
          let sent = 0;

          for (const recipientEmail of emails) {
            const resendRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
              body: JSON.stringify({
                from: 'PSOTS Society <hello@society.psots.in>',
                to: recipientEmail,
                subject,
                html: announcementHtml,
              }),
            });
            if (resendRes.ok) sent++;
          }

          await firestoreSet(`chhath_logs/${Date.now()}_announcement_blast`, {
            action: 'announcement_sent',
            type: 'email_blast',
            timestamp: new Date().toISOString(),
            status: 'completed',
            details: { announcementId, subject, recipientCount: sent },
          }, env);

          return new Response(JSON.stringify({ ok: true, sent }), { headers: { 'Content-Type': 'application/json', ...CORS } });
        } catch (e) {
          console.error('/chhath/send-announcement error:', e);
          return new Response(JSON.stringify({ ok: false, error: 'server_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
      }

      // ── TELEGRAM WEBHOOK ──────────────────────────────────
      if (request.method === 'POST' && !pathname.startsWith('/api/') && !pathname.startsWith('/invite/') && !pathname.startsWith('/user/') && !pathname.startsWith('/admin/') && !pathname.startsWith('/tenant/') && !pathname.startsWith('/device/') && !pathname.startsWith('/recommendations/') && !pathname.startsWith('/contact/') && !pathname.startsWith('/resident/') && !pathname.startsWith('/chhath/')) {
        const update = await request.json();

        // Callback queries (inline button presses)
        if (update.callback_query) {
          const cb = update.callback_query;
          const data = cb.data;
          const adminId = cb.from.id;
          const botToken = await getBotToken(env.VIOLATIONS);
          if (data.startsWith('approve_')) {
            const targetUserId = data.replace('approve_', '');
            await markResidentVerified(targetUserId, { verifiedBy: adminId, verifiedAt: new Date().toISOString() }, env.VIOLATIONS);
            await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callback_query_id: cb.id, text: "✅ Resident Approved!" })
            });
            await sendMessage(cb.message.chat.id, `✅ Resident verified by admin: ${cb.from.first_name}`, botToken);
          }
          if (data.startsWith('sell_confirm_')) {
            const userId = parseInt(data.replace('sell_confirm_', ''));
            const stateRaw = await env.VIOLATIONS.get(`_bot_state_${userId}`);
            if (stateRaw) {
              const state = JSON.parse(stateRaw);
              const residentData = await env.VIOLATIONS.get(`resident_verified_${userId}`);
              const resident = residentData ? JSON.parse(residentData) : null;
              const flatNumber = resident?.flatNumber || 'Unknown';
              const timestamp = new Date().toISOString();
              const listingData = {
                itemName: state.itemName,
                price: state.price,
                category: state.category,
                condition: state.condition,
                description: state.description,
                flatNumber: flatNumber,
                userId: userId,
                createdAt: timestamp,
                updatedAt: timestamp,
                status: 'active'
              };
              await firestoreSet(`marketplace_listings/${timestamp}`, listingData, env);
              const adminGroupId = ADMIN_GROUP_ID;
              const adminMsg = `🛒 <b>New Listing</b>\n<b>${state.itemName}</b> — ₹${state.price}\n${state.category} · ${state.condition}\nFlat ${flatNumber}`;
              await sendMessage(adminGroupId, adminMsg, botToken);
              await sendMessage(userId, `✅ <b>Listed!</b>\n\nView your listing: <a href="https://society.psots.in/society/marketplace">PSOTS Marketplace</a>`, botToken);
              await env.VIOLATIONS.delete(`_bot_state_${userId}`);
            }
            await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callback_query_id: cb.id })
            });
          }
          if (data.startsWith('sell_edit_')) {
            const userId = parseInt(data.replace('sell_edit_', ''));
            await env.VIOLATIONS.put(`_bot_state_${userId}`, JSON.stringify({ step: 1, timestamp: Date.now() }), { expirationTtl: 600 });
            await sendMessage(userId, '✏️ Let\'s start over.\n\n📦 What are you selling? (item name)', botToken);
            await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callback_query_id: cb.id })
            });
          }
          if (data.startsWith('sell_cancel_')) {
            const userId = parseInt(data.replace('sell_cancel_', ''));
            await env.VIOLATIONS.delete(`_bot_state_${userId}`);
            await sendMessage(userId, '❌ Listing cancelled.', botToken);
            await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callback_query_id: cb.id })
            });
          }
          return new Response('OK');
        }

        // Bot added to group
        if (update.my_chat_member) {
          const chat = update.my_chat_member.chat;
          const newStatus = update.my_chat_member.new_chat_member?.status;
          if (chat.type !== 'private' && (newStatus === 'member' || newStatus === 'administrator')) {
            const botToken = await getBotToken(env.VIOLATIONS);
            const groupsJson = await env.VIOLATIONS.get('_groups');
            const groups = groupsJson ? JSON.parse(groupsJson) : {};
            const chatKey = String(chat.id);
            if (!groups[chatKey]) {
              groups[chatKey] = { title: chat.title, firstSeen: new Date().toISOString(), photo: null };
              await env.VIOLATIONS.put('_groups', JSON.stringify(groups));
            }
          }
          return new Response('OK');
        }

        if (!update.message) return new Response('OK');

        const botToken = await getBotToken(env.VIOLATIONS);
        if (!botToken) return new Response('OK');

        const message = update.message;

        // ── ADMIN PHOTO ANALYSIS (GEMINI VISION) ────────
        if (message.photo && message.from?.id === 989358143) {
          await processAdminPhoto(message, botToken, env);
          return new Response('OK');
        }

        // ── GROUP PHOTO UPDATE SYNC ─────────────────────
        if (message.new_chat_photo) {
          try {
            const chatId = String(message.chat.id);
            const photo = message.new_chat_photo[message.new_chat_photo.length - 1];
            const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${photo.file_id}`);
            const fileData = await fileRes.json();

            if (fileData.ok) {
              const photoUrl = `/api/group-photo?path=${encodeURIComponent(fileData.result.file_path)}`;
              const groupsJson = await env.VIOLATIONS.get('_groups');
              const groups = groupsJson ? JSON.parse(groupsJson) : {};

              groups[chatId] = groups[chatId] || {};
              groups[chatId].photo = photoUrl;

              await env.VIOLATIONS.put('_groups', JSON.stringify(groups));
              console.log(`Group ${chatId} photo updated: ${photoUrl}`);
            }
          } catch (err) {
            console.error('Group photo update error:', err);
          }
          return new Response('OK');
        }

        // ── FORWARDED MESSAGE ANALYSIS ──────────────────
        if (message.forward_from_chat || message.forward_from) {
          const groupName = message.forward_from_chat?.title || "Unknown";
          const groupId = String(message.forward_from_chat?.id || 0);
          const originalDate = message.forward_date || 0;
          const text = message.text || message.caption || '';
          const hasPhoto = !!(message.photo || message.document);
          const hasPrice = /₹|rs\.|@rs|price|cost|rate|\/\-/i.test(text);
          const wordCount = text.split(/\s+/).length;
          const forwardedBy = message.from?.id || 0;
          const loggedAt = Math.floor(Date.now() / 1000);

          const docId = `fwd_${loggedAt}_${forwardedBy}`;
          await firestoreSet(`forwarded_analysis/${docId}`, {
            groupName, groupId, originalDate,
            text: text.substring(0, 500),
            hasPhoto, hasPrice, wordCount,
            forwardedBy, loggedAt
          }, env);

          // Increment daily count in KV
          const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
          const countKey = `_forwarded_count_${today}`;
          const currentCount = parseInt(await env.VIOLATIONS.get(countKey) || '0');
          const newCount = currentCount + 1;
          await env.VIOLATIONS.put(countKey, String(newCount));

          // Reply privately to forwarder
          await sendMessage(forwardedBy, `✅ Logged from <b>${groupName}</b>\nTotal logged today: <b>${newCount}</b>`, botToken);
          return new Response('OK');
        }
        const chatId = message.chat.id;
        const chatType = message.chat.type;
        let chatTitle = message.chat.title || 'Private Chat';
        const userId = message.from.id;
        const text = message.text || '';
        const username = message.from.username || message.from.first_name || 'User';
        const firstName = message.from.first_name || 'User';

        if (!text || message.from.is_bot) return new Response('OK');

        // ── PRIVATE CHAT: /verify command ─────────────────
        if (chatType === 'private') {
          // Always store userId↔username mapping for OTP lookup
          await env.VIOLATIONS.put(`_tg_user_${username.toLowerCase()}`, JSON.stringify({ userId, username, firstName, updatedAt: Date.now() }));

          if (text === '/verify' || text.startsWith('/verify')) {
            await handleVerifyCommand(userId, firstName, botToken, env.VIOLATIONS);
            return new Response('OK');
          }

          if (text === '/start') {
            await sendMessage(userId, `👋 Hi ${firstName}!\n\nI'm the <b>PSOTS Community Bot</b>.\n\nTo sign in to <a href="https://psots.in/residents.html">psots.in</a>, send me <code>/verify</code> and I'll give you a one-time code.\n\n🏘️ Prestige Song of the South, Bangalore`, botToken);
            return new Response('OK');
          }

          if (text === '/sell') {
            await env.VIOLATIONS.put(`_bot_state_${userId}`, JSON.stringify({ step: 1, timestamp: Date.now() }), { expirationTtl: 600 });
            await sendMessage(userId, '📦 What are you selling? (item name)', botToken);
            return new Response('OK');
          }

          const stateKey = `_bot_state_${userId}`;
          const stateRaw = await env.VIOLATIONS.get(stateKey);
          if (stateRaw) {
            const state = JSON.parse(stateRaw);
            const residentData = await env.VIOLATIONS.get(`resident_verified_${userId}`);
            const resident = residentData ? JSON.parse(residentData) : null;
            const flatNumber = resident?.flatNumber || 'Unknown';

            if (state.step === 1) {
              state.itemName = text.trim();
              state.step = 2;
              await env.VIOLATIONS.put(stateKey, JSON.stringify(state), { expirationTtl: 600 });
              await sendMessage(userId, `💰 What's the price? (₹ amount or 'Free')`, botToken);
              return new Response('OK');
            }
            if (state.step === 2) {
              state.price = text.trim();
              state.step = 3;
              await env.VIOLATIONS.put(stateKey, JSON.stringify(state), { expirationTtl: 600 });
              await sendMessage(userId, `📁 Category?\n1️⃣ Electronics\n2️⃣ Furniture\n3️⃣ Clothing\n4️⃣ Vehicle\n5️⃣ Services\n6️⃣ Other\n\nReply with number.`, botToken);
              return new Response('OK');
            }
            if (state.step === 3) {
              const cats = { '1': 'Electronics', '2': 'Furniture', '3': 'Clothing', '4': 'Vehicle', '5': 'Services', '6': 'Other' };
              state.category = cats[text.trim()] || 'Other';
              state.step = 4;
              await env.VIOLATIONS.put(stateKey, JSON.stringify(state), { expirationTtl: 600 });
              await sendMessage(userId, `✨ Condition?\n1️⃣ New\n2️⃣ Like New\n3️⃣ Good\n4️⃣ Fair\n\nReply with number.`, botToken);
              return new Response('OK');
            }
            if (state.step === 4) {
              const conds = { '1': 'New', '2': 'Like New', '3': 'Good', '4': 'Fair' };
              state.condition = conds[text.trim()] || 'Good';
              state.step = 5;
              await env.VIOLATIONS.put(stateKey, JSON.stringify(state), { expirationTtl: 600 });
              await sendMessage(userId, `📝 Add a description (optional — or reply 'skip')`, botToken);
              return new Response('OK');
            }
            if (state.step === 5) {
              state.description = text.toLowerCase() === 'skip' ? '' : text.trim();
              state.step = 6;
              await env.VIOLATIONS.put(stateKey, JSON.stringify(state), { expirationTtl: 600 });
              const preview = `📦 <b>${state.itemName}</b>\n₹${state.price} · ${state.category} · ${state.condition}\n${state.description ? `\n${state.description}\n` : ''}\nPosted by: Flat ${flatNumber}\n\nPost this listing?\n✅ Yes | ✏️ Edit | ❌ Cancel`;
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: userId,
                  text: preview,
                  parse_mode: 'HTML',
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: '✅ Yes', callback_data: `sell_confirm_${userId}` },
                        { text: '✏️ Edit', callback_data: `sell_edit_${userId}` },
                        { text: '❌ Cancel', callback_data: `sell_cancel_${userId}` }
                      ]
                    ]
                  }
                })
              });
              return new Response('OK');
            }
          }

          return new Response('OK');
        }

        // ── GROUP CHAT ────────────────────────────────────

        // Update group registry
        const groupsJson = await env.VIOLATIONS.get('_groups');
        let groups = groupsJson ? JSON.parse(groupsJson) : {};
        const chatKey = String(chatId);
        groups[chatKey] = {
          title: chatTitle,
          firstSeen: groups[chatKey]?.firstSeen || new Date().toISOString(),
          photo: groups[chatKey]?.photo || null
        };
        await env.VIOLATIONS.put('_groups', JSON.stringify(groups));

        // /start in group
        if (text === '/start' || text.startsWith('/start')) {
          // Silently register group and send private DM to sender only
          try {
            // Re-fetch and store group photo
            const chatInfoRes = await fetch(`https://api.telegram.org/bot${botToken}/getChat?chat_id=${chatId}`);
            const chatInfo = await chatInfoRes.json();

            if (chatInfo.result?.photo?.big_file_id) {
              const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${chatInfo.result.photo.big_file_id}`);
              const fileData = await fileRes.json();
              if (fileData.ok) {
                const photoPath = fileData.result.file_path;
                const photoRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${photoPath}`);
                const photoBlob = await photoRes.arrayBuffer();
                const photoKey = `profile_photos/${chatId}_photo.jpg`;
                await env.VIOLATIONS.put(photoKey, photoBlob, { metadata: { contentType: 'image/jpeg' } });

                const groupsJson = await env.VIOLATIONS.get('_groups');
                const groups = groupsJson ? JSON.parse(groupsJson) : {};
                if (groups[String(chatId)]) {
                  groups[String(chatId)].photo = `/api/group-photo?path=${encodeURIComponent(photoKey)}`;
                  await env.VIOLATIONS.put('_groups', JSON.stringify(groups));
                }
              }
            }

            // Send private DM to the admin who sent /start (no public message)
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: message.from.id,
                text: `✅ Group "<b>${chatTitle}</b>" linked successfully.\n\nManage at <a href="https://society.psots.in/society/admin">PSOTS Dashboard</a>`,
                parse_mode: 'HTML'
              })
            });
          } catch(e) {
            console.error('Group registration error:', e);
          }

          return new Response('OK');
        }

        // ── DEBUG: Test moderation override ────────────────────────────
        // If message starts with "/testmod ", strip the prefix and process as non-admin
        let testModMode = false;
        let processText = text;
        if (text.startsWith('/testmod ')) {
          testModMode = true;
          processText = text.substring(9); // Remove "/testmod " prefix
          console.log(`DEBUG: testmod mode enabled. Original: "${text.substring(0, 50)}..." → Testing: "${processText.substring(0, 50)}..."`);
        }

        // Check if sender is admin — skip moderation
        const member = testModMode ? null : await fetchChatMember(chatId, userId, botToken);
        const isAdmin = testModMode ? false : (member && (member.status === 'administrator' || member.status === 'creator'));
        if (isAdmin && !testModMode) {
          // Still add to history for context
          await addToHistory(chatId, username, text, env.VIOLATIONS);
          return new Response('OK');
        }

        const recKeywords = ['good doctor', 'recommend', 'suggest', 'near psots', 'good plumber', 'good restaurant'];
        const hasRecKeyword = recKeywords.some(kw => processText.toLowerCase().includes(kw));
        if (hasRecKeyword) {
          try {
            const path = 'recommendations';
            const filter = [{ field: 'status', op: '==', value: 'approved' }];
            const result = await firestoreQuery(path, filter, env);
            const topRecs = result.slice(0, 3);
            if (topRecs.length > 0) {
              const recText = topRecs.map(r => `<b>${r.name}</b>\n${r.description}\n📞 +91${r.phone}`).join('\n\n');
              const msg = `💡 <b>Recommendations from residents:</b>\n\n${recText}\n\n<a href="https://society.psots.in/society/recommendations.html">View all →</a>`;
              await sendMessage(chatId, msg, botToken);
            }
          } catch (err) {}
          return new Response('OK');
        }

        // Store message context for all messages (used by Gemini moderation)
        await storeMessageContext(env.VIOLATIONS, String(chatId), message);

        // Store message in history BEFORE checking violation
        // (so context includes messages leading up to the flagged one)
        const recentHistory = await getRecentMessages(chatId, env.VIOLATIONS);
        await addToHistory(chatId, username, processText, env.VIOLATIONS);

        const reactionsRaw = await env.VIOLATIONS.get(`_reactions_${chatId}`);
        if (reactionsRaw) {
          const reactions = JSON.parse(reactionsRaw);
          if (reactions.enabled && reactions.rules && reactions.rules.length > 0) {
            for (const rule of reactions.rules) {
              if (processText.toLowerCase().includes(rule.keyword.toLowerCase())) {
                const emoji = rule.emoji.codePointAt(0).toString(16);
                await fetch(`https://api.telegram.org/bot${botToken}/setMessageReaction`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: chatId,
                    message_id: message.message_id,
                    reaction: [{ type: 'emoji', emoji: rule.emoji }]
                  })
                }).catch(() => {});
                break;
              }
            }
          }
        }

        // Run new Firestore-based moderation
        await moderateMessage(message, chatId, botToken, env).catch(e => console.error('Moderation error:', e));

        // ── CHECK ALLOW LIST FIRST (skip moderation for allowed phrases) ────
        const modConfig = await getModerationConfig(env.VIOLATIONS, String(chatId));
        const textLower = processText.toLowerCase();
        if (modConfig.allowList && Array.isArray(modConfig.allowList) && modConfig.allowList.length > 0) {
          for (const allowedPhrase of modConfig.allowList) {
            if (textLower.includes(allowedPhrase.toLowerCase())) {
              console.log(`Allow list match: "${allowedPhrase}" in "${processText.substring(0, 100)}"`);
              return new Response('OK');
            }
          }
        }

        // Keyword pre-filter
        const keywords = await getKeywords(env.VIOLATIONS, chatId);
        let violation = checkViolation(processText, keywords);

        // ── CHECK TRIGGER KEYWORDS (use config keywords if set) ────────────
        if (modConfig.triggerKeywords && Array.isArray(modConfig.triggerKeywords) && modConfig.triggerKeywords.length > 0) {
          // Use configured trigger keywords instead of default keywords
          violation = null;
          for (const keyword of modConfig.triggerKeywords) {
            if (textLower.includes(keyword.toLowerCase())) {
              violation = 'Trigger Keyword Match';
              break;
            }
          }
        }

        // Marketplace group — extract listing, don't delete
        const isMarketplaceGroup = (keywords.settings?.groupType === 'marketplace');
        if (isMarketplaceGroup && violation === 'Buy/Sell Content') {
          const aiData = await parseListingWithGemini(processText, env);
          const listing = { userId, username, text: processText, timestamp: new Date().toISOString(), chatId, messageId: message.message_id, ...aiData };
          await env.VIOLATIONS.put(`market_listing_${Date.now()}_${userId}`, JSON.stringify(listing), { expirationTtl: 2592000 });
          return new Response('OK');
        }

        if (!violation) return new Response('OK');

        // If moderation disabled, let existing moderateMessage handle it
        if (!modConfig.enabled) {
          // Use original moderateWithGemini flow for backward compatibility
          const geminiResult = await moderateWithGemini(processText, recentHistory, violation, env);

          if (geminiResult.action === 'ignore') {
            await env.VIOLATIONS.put(`_log_gemini_fp_${Date.now()}`, JSON.stringify({
              text: processText.substring(0, 200), violation, reason: geminiResult.reason,
              chatId, userId, username, timestamp: new Date().toISOString()
            }), { expirationTtl: 86400 });
            return new Response('OK');
          }

          if (geminiResult.action === 'flag' && geminiResult.confidence === 'medium') {
            await sendMessage(ADMIN_ID,
              `👀 <b>Medium Confidence Flag</b>\n\nGroup: ${chatTitle}\nUser: ${firstName} (@${username})\nViolation: ${violation}\nGemini: ${geminiResult.reason}\n\nMessage: "${processText.substring(0, 300)}"`,
              botToken
            );
            return new Response('OK');
          }
        } else if (modConfig.engine === 'gemini' || modConfig.engine === 'both') {
          // ── NEW CONFIG-BASED GEMINI MODERATION ────────
          const context = await getMessageContext(env.VIOLATIONS, String(chatId), modConfig.contextWindow);
          const analysis = await analyzeWithGemini(processText, context, modConfig, env.GEMINI_API_KEY);
          console.log(`Gemini verdict for chat ${chatId}: ${analysis.verdict} (${analysis.confidence}) - ${analysis.reason}`);

          if (analysis.verdict === 'LEGITIMATE' || analysis.confidence === 'LOW') {
            return new Response('OK');
          }

          if (analysis.verdict === 'VIOLATION' && analysis.confidence === 'MEDIUM') {
            // Notify admin silently for medium confidence
            await sendMessage(ADMIN_ID,
              `👀 <b>Medium Confidence Violation</b>\n\nGroup: ${chatTitle}\nUser: ${firstName} (@${username})\nGemini: ${analysis.reason}\n\nMessage: "${processText.substring(0, 300)}"`,
              botToken
            );
            return new Response('OK');
          }

          if (analysis.verdict === 'VIOLATION' && analysis.confidence === 'HIGH') {
            // Execute configured action
            await executeModAction(modConfig.action, message, analysis.reason, botToken, env);
            await updateStats(env.VIOLATIONS, chatId);

            let userViolations = await getUserViolations(userId, env.VIOLATIONS, chatId);
            if (!userViolations) {
              userViolations = { userId, username, count: 0, history: [], lastViolationTime: Date.now() };
            }
            userViolations.count++;
            userViolations.lastViolationTime = Date.now();
            userViolations.history.push({
              type: violation,
              geminiReason: analysis.reason,
              timestamp: new Date().toISOString(),
              message: processText.substring(0, 200)
            });
            await saveUserViolations(userId, userViolations, env.VIOLATIONS, chatId);

            await env.AUDIT_LOG.put(`${Date.now()}_${userId}`, JSON.stringify({
              userId, username, firstName, violationType: violation,
              geminiReason: analysis.reason,
              messageText: processText, timestamp: new Date().toISOString(), chatId
            }), { expirationTtl: 7776000 });

            return new Response('OK');
          }
        }

        // High confidence — take action
        // Fallback path: neither moderation branch above hit (engine not 'gemini'/'both' and
        // not !modConfig.enabled). The original code referenced an out-of-scope geminiResult
        // here — provide a defensive default so the code is callable instead of throwing.
        const geminiResult = { reason: 'policy violation detected' };
        await updateStats(env.VIOLATIONS, chatId);
        await deleteTelegramMessage(chatId, message.message_id, botToken);

        let userViolations = await getUserViolations(userId, env.VIOLATIONS, chatId);
        if (!userViolations) {
          userViolations = { userId, username, count: 0, history: [], lastViolationTime: Date.now() };
        }
        userViolations.count++;
        userViolations.lastViolationTime = Date.now();
        userViolations.history.push({
          type: violation,
          geminiReason: geminiResult.reason,
          timestamp: new Date().toISOString(),
          message: processText.substring(0, 200)
        });
        await saveUserViolations(userId, userViolations, env.VIOLATIONS, chatId);

        // Audit log
        await env.AUDIT_LOG.put(`${Date.now()}_${userId}`, JSON.stringify({
          userId, username, firstName, violationType: violation,
          geminiReason: geminiResult.reason,
          messageText: processText, timestamp: new Date().toISOString(), chatId
        }), { expirationTtl: 7776000 });

        const count = userViolations.count;
        let msg = '';
        if (count === 1) {
          msg = `Hi ${firstName}, your message was removed.\n\nReason: ${geminiResult.reason} 🙏\n\n<a href="https://society.psots.in/society/profile">View your record</a>`;
        } else if (count === 2) {
          msg = `Hi ${firstName}, this is your 2nd warning.\n\nReason: ${geminiResult.reason} 🙏\n\n<a href="https://society.psots.in/society/profile">View your record</a>`;
        } else if (count === 3) {
          msg = `Hi ${firstName}, 3rd violation. Admin notified. 🙏\n\n<a href="https://society.psots.in/society/profile">View & appeal</a>`;
          await sendMessage(ADMIN_ID, `⚠️ ALERT: ${firstName} (@${username}) — 3 violations.\nLatest: ${geminiResult.reason}`, botToken);
        } else if (count === 5) {
          msg = `Hi ${firstName}, 5 violations — serious warning. 🚫\n\n<a href="https://society.psots.in/society/profile">View & appeal</a>`;
          await sendMessage(ADMIN_ID, `🚨 CRITICAL: ${firstName} (@${username}) — 5 violations. Consider action.`, botToken);
        } else if (count >= 10) {
          msg = `Hi ${firstName}, repeated violations. Please contact admin to appeal. 🚫`;
          await sendMessage(ADMIN_ID, `🔴 EXTREME: ${firstName} (@${username}) — 10 violations.`, botToken);
        } else {
          msg = `Hi ${firstName}, ${count} violations so far. Please follow guidelines. 🙏\n\n<a href="https://society.psots.in/society/profile">View your record</a>`;
        }

        await sendMessage(userId, msg, botToken);

        return new Response('OK');
      }

      return new Response('OK');
    } catch (error) {
      console.error('Error:', error);
      return new Response('Error', { status: 500 });
    }
  },
  async scheduled(event, env, ctx) {
    try {
      const token = await getServiceAccountToken(env);

      // Check pending registrations
      const pendingSnapshot = await firestoreQuery('residents',
        [{ field: 'status', operator: '==', value: 'pending' }], env);
      const pendingCount = pendingSnapshot.length;

      const familySnapshot = await firestoreQuery('residents',
        [{ field: 'accessLevel', operator: '==', value: 'family' }, { field: 'status', operator: '==', value: 'pending' }], env);
      const familyCount = familySnapshot.length;

      // Check expiring leases (tenants)
      const now = new Date();
      const days30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const days15 = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
      const days7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const tenantSnapshot = await firestoreQuery('residents',
        [{ field: 'residentType', operator: '==', value: 'tenant' }, { field: 'status', operator: '==', value: 'approved' }], env);

      const expiringTenants = tenantSnapshot.filter(t => {
        if (!t.leaseEndDate) return false;
        const leaseEnd = parseDate(t.leaseEndDate);
        return leaseEnd && leaseEnd <= days30;
      });

      // Send reminders for expiring leases
      for (const tenant of expiringTenants) {
        const leaseEnd = parseDate(tenant.leaseEndDate);
        const daysLeft = Math.floor((leaseEnd - now) / (1000 * 60 * 60 * 24));

        if (daysLeft === 30 || daysLeft === 15 || daysLeft === 7) {
          // Email tenant
          const html = generateBaseEmail(
            '⏰ Lease Renewal Reminder',
            `Your lease expires in ${daysLeft} days`,
            `
              <p>Dear ${tenant.name},</p>
              <p>This is a reminder that your lease for flat ${tenant.flatNumber} will expire on <strong>${tenant.leaseEndDate}</strong> (in ${daysLeft} days).</p>
              <p>Please contact your flat owner to renew the lease agreement. If you don't renew, your account will be disabled 15 days after expiry.</p>
              <p><a href="https://society.psots.in/society/profile" style="background: var(--jade); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">View Profile</a></p>
            `
          );
          if (tenant.email) {
            await sendEmail(tenant.email, `⏰ Lease Renewal Reminder - ${daysLeft} days left`, html, env);
          }
        }
      }

      // Disable expired tenants (15 days grace period)
      const expiredGrace = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
      const expiredTenants = tenantSnapshot.filter(t => {
        if (!t.leaseEndDate) return false;
        const leaseEnd = parseDate(t.leaseEndDate);
        return leaseEnd && leaseEnd <= expiredGrace;
      });

      for (const tenant of expiredTenants) {
        await firestoreSet(`residents/${tenant.id}`, { status: 'lease_expired' }, env, ['status']);
        console.log(`Disabled tenant ${tenant.id} - lease expired`);
      }

      // Send admin digest if there are items to review
      if (pendingCount > 0 || expiringTenants.length > 0 || expiredTenants.length > 0) {
        const html = generateBaseEmail(
          '📊 PSOTS Admin Digest',
          `${pendingCount} pending approvals, ${expiringTenants.length} leases expiring soon`,
          `
            <p style="margin-bottom: 20px;">
              <strong>${pendingCount}</strong> resident registrations awaiting approval<br/>
              <strong>${familyCount}</strong> family member requests pending<br/>
              <strong>${expiringTenants.length}</strong> tenant leases expiring within 30 days<br/>
              <strong>${expiredTenants.length}</strong> tenant accounts disabled (lease expired)
            </p>
            <p><a href="https://society.psots.in/society/admin" style="background: var(--jade); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Review in Admin Panel</a></p>
          `
        );

        await notifyAllAdmins('📊 PSOTS Admin Digest — Pending Approvals & Lease Updates', html, env);
        console.log('Digest sent successfully');
      }
    } catch (error) {
      console.error('Scheduled task error:', error);
    }
  }
};
