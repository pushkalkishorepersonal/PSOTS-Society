> **ARCHIVED:** This file was the initial codebase audit captured during Phase 0B (April 18, 2026).
> It is preserved for historical reference. For current state, see `/docs/FEATURE_STATUS.md`.
> Do not treat this document as authoritative.

# PSOTS Society — Current State Inventory (Phase 0B)

**Audit Date:** April 18, 2026  
**Scope:** Read-only inventory of all routes, services, collections, integrations, and critical flows  
**Purpose:** Ground truth for all subsequent refactoring and feature development  

---

## SECTION 1 — Worker Routes (src/index.js)

| Method | Path | Auth Required | Handler | What It Does |
|--------|------|---------------|---------|--------------|
| GET | `/` or `/index.html` | None | GRAND_LOBBY_HTML | Serve landing page with Google login button |
| GET | `/market` | None | MARKETPLACE_HTML | Serve marketplace landing page |
| GET | `/handbook` | None | HANDBOOK_HTML | Serve community handbook |
| GET | `/events` | None | EVENTS_HTML | Serve events calendar page |
| GET | `/user` or `/user/` | None | USER_PANEL | Serve user panel page |
| GET | `/send-otp?username={u}` | None | handleVerifyCommand | Send Telegram OTP to user by username |
| GET | `/verify-otp?username={u}&otp={otp}` | None | verifyOTP | Verify Telegram OTP and mint Firebase token |
| POST | `/flat/check` | None | firestoreQuery + parse | Check flat status: empty, pending, occupied (pre-login) |
| POST | `/auth/send-email-otp` | None | Resend API | Send 6-digit OTP to email via Resend |
| POST | `/auth/verify-email-otp` | None | verifyOTP + mintFirebaseToken | Verify email OTP and return Firebase custom token |
| POST | `/auth/link-email` | None | KV put | Store email→UID mapping for repeat login |
| POST | `/resident/feedback` | None | KV rate limit | Accept resident feedback (rate limited 5/hour) |
| POST | `/notify-registration` | None | sendMessage to ADMIN_ID | Send Telegram alert to admin when registration submitted |
| POST | `/admin/notify-registration` | None | notifyAllAdmins + Resend + Telegram | Email all admins with approval tokens, notify Telegram group |
| POST | `/resident/registration-confirmation` | None | Resend | Send confirmation email to resident after registration |
| POST | `/admin/process-action` | Token auth | mintFirebaseToken + Resend | Process admin approval/rejection with token validation |
| GET | `/admin/groups` | None | KV get | List all managed Telegram groups |
| GET | `/admin/members?groupId=X` | None | Telegram API getChatMember | List group members (simplified, returns empty) |
| POST | `/admin/mute` | None | Telegram restrictChatMember | Mute user in group for duration |
| POST | `/admin/ban` | None | Telegram kickChatMember | Ban user from group (continues below) |
| GET | `/admin/violations` | None | KV list | Get violations list for last 30 days |
| POST | `/webhook/telegram` | Token verify | moderateMessage | Main Telegram webhook handler for moderation |
| POST | `/scheduled` | Cron trigger | Cleanup/daily tasks | Scheduled job (8 PM IST / 14:30 UTC) |

---

## SECTION 2 — Worker Helper Modules

### src/store.js — KV configuration and keyword management

**Exported functions:**
- `getBotToken(kv)` — Retrieve Telegram bot token from KV
- `getAdmins(kv, chatId)` — Get admin emails (with per-chat override)
- `saveAdmins(admins, kv, chatId)` — Store admin email list
- `getPINs(kv)` — Get admin PIN codes for verification
- `savePINs(pins, kv)` — Store PIN codes
- `getKeywords(kv, chatId)` — Get moderation keyword config (buy/sell, political, religious, abuse, spam, etc.)
- `saveKeywords(keywords, kv, chatId)` — Update keyword config
- `getStats(kv, chatId)` — Get message scan statistics
- `updateStats(kv, chatId)` — Increment scan count
- `getActionSettings(kv, chatId)` — Get violation thresholds (warn at 1, mute at 3, ban at 10, etc.)
- `saveActionSettings(settings, kv, chatId)` — Update action thresholds
- `getActionForViolationCount(count, kv, chatId)` — Get action type for violation number
- `getUserViolations(userId, kv, chatId)` — Get violation record for user
- `saveUserViolations(userId, data, kv, chatId)` — Store violation count and timestamp
- `getViolationsLast30Days(kv, chatId)` — Query all violations in last 30 days
- `isResidentVerified(userId, kv)` — Check if user is verified resident
- `markResidentVerified(userId, data, kv)` — Mark user as verified
- `checkViolation(text, keywords)` — Check if message triggers keyword violation

### src/telegram.js — Telegram API and moderation

**Exported functions:**
- `sendMessage(chatId, text, token, replyMarkup)` — Send message to Telegram chat
- `deleteTelegramMessage(chatId, messageId, token)` — Delete message from group
- `fetchChatMember(chatId, userId, token)` — Get member info from Telegram
- `sendSocietyEmail(toEmail, subject, content)` — Send email via MailChannels API (legacy)
- `parseListingWithGemini(text, env)` — Extract marketplace data from text via Gemini
- `moderateWithGemini(flaggedMessage, recentMessages, violationType, env)` — Context-aware moderation decision via Gemini
- `handleVerifyCommand(userId, firstName, token, kv)` — Generate and send Telegram OTP (10-min TTL)
- `verifyOTP(userId, submittedOTP, kv)` — Verify OTP and mark as used

### src/templates.js — HTML templates

**Exported templates:**
- `EVENTS_HTML` — Community events calendar page
- `GRAND_LOBBY_HTML(clientId)` — Landing page with Google OAuth and Telegram login
- `MARKETPLACE_HTML` — Marketplace listings landing
- `HANDBOOK_HTML` — Community guide/handbook
- `USER_PANEL` — User profile and settings panel

---

## SECTION 3 — Frontend Services (js/services/)

### admin.service.js
**Key exports:**
- `isAdmin(email)` — Check if user is admin (cache-first, 15-min TTL)
- `getAdmins()` — List all admin accounts
- `approve(uid, email)` — Approve resident registration
- `reject(uid, email, reason)` — Reject resident with reason
- `updateFlatMember(uid, flatNumber, changes)` — Update family/tenant record

### resident.service.js
**Key exports:**
- `resolveIdentity(uid)` — Map Firebase UID → {flatNumber, memberId}
- `get(uid)` — Load full resident record
- `create(flatNumber, data)` — Create new pending resident
- `updateStatus(uid, status)` — Change resident status (pending → approved → deleted)
- `getByFlat(flatNumber)` — List all residents in flat

### flat.service.js
**Key exports:**
- `validate(tower, floor, unit)` — Validate flat number components
- `buildFlatNumber(tower, floor, unit)` — Construct plain flat number
- `parseFlatNumber(flatNumber)` — Decompose flat number to {tower, floor, unit}
- `getFloors(tower)` — List valid floors for tower (skip floor 13)
- `getUnits(tower)` — List units for tower
- `upsert(flatNumber, changes)` — Create or update flat record in Firestore

### marketplace.service.js
**Key exports:**
- `getListings()` — Fetch all active marketplace listings (filter hidden if 3+ reports)
- `createListing(title, price, description, category, telegramUsername, resident)` — Post new listing
- `reportListing(listingId, reason)` — Report listing for removal

### rateLimit.service.js
**Key exports:**
- `check(key, limit, windowSeconds)` — Rate limit check (returns count, increments)

---

## SECTION 4 — Frontend Pages (js/pages/)

### admin/index.js — Admin Panel
**Services imported:** `adminService`  
**Firebase calls:** `onAuthStateChanged`, `signInWithPopup` (Google OAuth), `signOut`  
**Firestore reads:** admins collection, residents collection (with pending filter)  
**Firestore writes:** resident status updates, rejection reasons  
**Key features:** Resident approval/rejection queue, admin list management, moderation logs

### profile/index.js — Resident Profile
**Services imported:** `residentService`, `flatService`  
**Firebase calls:** User auth state, profile document reads/writes  
**Firestore reads:** Own profile, family members, tenant records  
**Firestore writes:** Profile updates, privacy settings, family approvals  
**Key features:** Family management, device trust, privacy controls, account deletion

### residents/index.js — Resident Directory (Login Page)
**Services imported:** None (direct Firebase calls)  
**Firebase calls:** signInWithPopup (Google), custom token from `/auth/verify-email-otp`  
**Firestore reads:** Check flat ownership via `/flat/check` Worker endpoint  
**Key features:** Google login, email OTP, Telegram OTP, registration form, quick return

### marketplace/index.js — Marketplace Listings
**Services imported:** `marketplaceService`  
**Firebase calls:** Marketplace listings collection read  
**Firestore reads:** marketplace_listings collection (filtered by report count)  
**Firestore writes:** New listing creation  
**Key features:** List view, create listing form, reporting system

---

## SECTION 5 — Firestore Collections Used

| Collection | Read By | Write By | Purpose |
|-----------|---------|----------|---------|
| `residents` | admin.service, resident.service, src/index.js | resident.service, admin.service | Primary resident profile (status, email, phone, loginMethod) |
| `flats` | flat.service, resident.service | flat.service, resident.service | Flat record with ownerUid, status, createdAt |
| `flats/{flatNumber}/members` | resident.service, admin.service | resident.service, admin.service | Family members and tenants as sub-documents |
| `identities` | resident.service | resident.service | Maps Firebase UID → {flatNumber, memberId} |
| `linkedAccounts` | resident.service | resident.service | Legacy UID → flat mapping (for backward compat) |
| `admins` | admin.service, src/index.js | admin.service | Admin email list with phone and contact info |
| `violations` | src/index.js (moderateMessage) | src/index.js | Telegram violation tracking per user, per chat |
| `appeals` | src/index.js | src/index.js | User appeal submissions (text, status, timestamp) |
| `orders` | (Phase 3) | (Phase 3) | Food marketplace orders — not yet implemented |
| `vendors` | (Phase 3) | (Phase 3) | Vendor profiles and menu — not yet implemented |
| `marketplace_listings` | marketplace.service | marketplace.service | Buy/sell listings with photos and pricing |
| `invites` | src/index.js | src/index.js | Family/tenant invite tokens with expiry |
| `invite_audit` | src/index.js | src/index.js | Audit log of who joined via which invite |
| `feedback` | (Not yet stored) | (Not yet stored) | Resident feedback submissions |
| `forwarded_analysis` | src/index.js | src/index.js | Gemini-extracted marketplace data from Telegram photos |
| `group_settings` | src/index.js | src/index.js | Per-group moderation config (keywords, thresholds, etc.) |
| `settings` | src/index.js | (Admin only) | Platform settings: contact info, feature flags |
| `tenants` | resident.service | resident.service | Tenant records with residentType='tenant' |
| `carpooling_listings` | (Page exists) | (Page exists) | Carpool offers and requests (structure incomplete) |
| `lost_found_posts` | (Page exists) | (Page exists) | Lost and found posts (structure incomplete) |
| `jobs_listings` | (Page exists) | (Page exists) | Job board posts (structure incomplete) |
| `recommendations` | (Page exists) | (Page exists) | Vendor/service recommendations (structure incomplete) |

---

## SECTION 6 — Environment Variables & Secrets

| Name | Source | Used By | Purpose |
|------|--------|---------|---------|
| `BOT_TOKEN` | GitHub secret → Cloudflare KV (`_bot_token`) | src/index.js, src/telegram.js | Telegram bot authentication |
| `GEMINI_API_KEY` | GitHub secret → Worker env | src/index.js (moderateWithGemini), src/telegram.js | Google Gemini moderation and listing parsing |
| `RESEND_API_KEY` | GitHub secret → Worker env | src/index.js (notifyAllAdmins, email endpoints) | Resend email delivery |
| `FIREBASE_SA_EMAIL` | GitHub secret → Worker env | src/index.js (getServiceAccountToken) | Firebase service account JWT issuer |
| `FIREBASE_SA_KEY` | GitHub secret → Worker env | src/index.js (getServiceAccountToken) | Firebase service account private key |
| `GOOGLE_CLIENT_ID` | Hardcoded or env | src/templates.js, login.html | Google OAuth client ID for sign-in |
| `CLOUDFLARE_API_TOKEN` | GitHub secret | GitHub Actions deploy | Cloudflare API authentication |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub secret | GitHub Actions deploy | Cloudflare account ID for KV and Workers |
| `TELEGRAM_BOT_TOKEN` | GitHub secret | GitHub Actions (stored in KV) | Telegram bot token (stored as KV key) |

**Deployment script** (.github/workflows/deploy.yml):
- Stores `TELEGRAM_BOT_TOKEN` in Cloudflare KV via `wrangler kv key put`
- Deploys Worker with `wrangler deploy`

---

## SECTION 7 — Cloudflare KV Usage

**Namespaces (from wrangler.toml):**
- `VIOLATIONS` (binding) → KV namespace ID: `3c89be83b87e4cf0b8f91b18bf2dc0e4`
- `AUDIT_LOG` (binding) → KV namespace ID: `6a727dbadb5c4bb3b1062c319758a0a1`

**Key patterns stored in VIOLATIONS KV:**

| Key Pattern | TTL | Purpose | Size |
|------------|-----|---------|------|
| `_bot_token` | None | Telegram bot token | Small |
| `_admin_emails[_chatId]` | None | Admin email list (per-chat override) | Small |
| `_admin_pins` | None | Admin PIN codes | Small |
| `_keywords_config[_chatId]` | None | Moderation keywords (buy/sell, abuse, spam, etc.) | Medium |
| `_stats[_chatId]` | None | Message scan counter | Tiny |
| `_action_settings[_chatId]` | None | Violation thresholds (warn at 1, mute at 3, etc.) | Small |
| `user_{chatId}_{userId}` | 30 days | Violation count and last violation timestamp | Tiny |
| `resident_verified_{userId}` | None | Mark resident as verified (data stored) | Tiny |
| `_history_{chatId}` | 1 hour | Last 5 messages for Gemini context | Medium |
| `_tg_user_{username}` | None | Map Telegram username → userId | Tiny |
| `_session_{sessionToken}` | 5 min | Session data after OTP verification | Small |
| `email_otp_{email}` | 15 min | OTP code and expiry timestamp | Tiny |
| `email_ratelimit_{email}` | 1 hour | Counter of OTP requests | Tiny |
| `_email_uid_{email}` | 1 year | Map email → Firebase UID | Tiny |
| `feedback_rl_{email}` | 1 hour | Counter for feedback submissions | Tiny |
| `admin_action_{token}` | 72 hours | Approval/rejection token with action metadata | Small |
| `_groups` | None | Telegram groups info (chatId → title, photo) | Medium |

**AUDIT_LOG namespace:** Reserved for future audit logging (not currently used).

---

## SECTION 8 — External Integrations

| Service | Endpoint | Auth | Purpose | Failure Mode |
|---------|----------|------|---------|--------------|
| **Telegram API** | `api.telegram.org/bot{BOT_TOKEN}/...` | Bearer token in URL | Send messages, delete messages, mute/ban users, get chat member info | Silently caught; messages not delivered but request continues |
| **Gemini API** | `generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent` | Bearer {GEMINI_API_KEY} | Context-aware moderation (high confidence only), marketplace listing parsing from images | Defaults to PASS on any error (never punish user on AI failure) |
| **Firebase Firestore REST** | `firestore.googleapis.com/v1/projects/psots-society-25899/databases/(default)/documents` | Bearer token from service account | Read/write resident, flat, admin, violation records | Returns null or empty list; Worker continues |
| **Firebase OAuth** | `oauth2.googleapis.com/token` | JWT from service account | Exchange service account JWT for access token | Caught and logged; affects Firestore reads |
| **Resend Email API** | `api.resend.com/emails` | Bearer {RESEND_API_KEY} | Send transactional emails (OTP, approval, rejection, notifications) | Silent catch; email not delivered but request continues |
| **Google Sign-In** | `accounts.google.com/gsi/` | GOOGLE_CLIENT_ID | Client-side OAuth flow in login.html | User sees error; popup closes |

---

## SECTION 9 — Cron & Scheduled Tasks

**From wrangler.toml:**
```
[triggers]
crons = ["30 14 * * *"]  # 2:30 PM UTC = 8 PM IST (India Standard Time)
```

**Handler in src/index.js:**
- Not yet fully implemented — `scheduled()` event handler stub exists but TODO
- Intended for: Daily digest emails, cleanup tasks, vendor weekly analytics (Phase 3A)

**Current status:** Trigger configured but handler incomplete. No production tasks running on schedule yet.

---

## SECTION 10 — Known Behaviour That MUST NOT BREAK

### Critical Flows to Preserve

#### 1. Google OAuth Login Flow
**Where it lives:** login.html, src/templates.js (GRAND_LOBBY_HTML), src/index.js  
**What to test after refactor:**
- [ ] User lands on landing page with Google button visible
- [ ] Click "Google Sign In" opens OAuth popup
- [ ] User authorizes, popup closes, user redirected to dashboard
- [ ] Firebase custom token minted successfully
- [ ] User can access profile and create listings

#### 2. Email OTP Flow
**Where it lives:** login.html, src/index.js (/auth/send-email-otp, /auth/verify-email-otp)  
**What to test:**
- [ ] Enter email, click "Send OTP"
- [ ] OTP arrives in inbox within 30 seconds
- [ ] User enters OTP, verifies successfully
- [ ] Firebase custom token returned
- [ ] Rate limit enforced (max 10 per hour per email)

#### 3. Telegram OTP Flow
**Where it lives:** src/telegram.js, src/index.js (/send-otp, /verify-otp)  
**What to test:**
- [ ] User sends `/verify` to @psots_telegram_bot in DM
- [ ] OTP sent in DM within 30 seconds
- [ ] User enters OTP at society.psots.in/login
- [ ] Firebase custom token returned
- [ ] OTP marked as used (cannot be reused)

#### 4. Telegram Bot Moderation
**Where it lives:** src/index.js (moderateMessage), src/store.js, src/telegram.js  
**What to test after any change to moderation logic:**
- [ ] Keyword detection (spam, abuse, buy/sell keywords) works
- [ ] Gemini context check runs when enabled
- [ ] Message deleted only on high-confidence Gemini verdict (never on API error)
- [ ] User warned via DM (not in group) until violation #3
- [ ] Violation #3 triggers mute (60 min default)
- [ ] Admin group notified at violation #2 or higher
- [ ] Ban requires manual admin action (bot cannot ban)

#### 5. Admin Registration Approval Queue
**Where it lives:** src/index.js, admin.service.js, admin panel HTML  
**What to test:**
- [ ] New resident registration triggers admin email with approve/reject tokens
- [ ] Admin panel shows pending residents with approve/reject buttons
- [ ] Clicking approve in email or admin panel approves resident and sends confirmation
- [ ] Rejected resident gets rejection email with admin contact
- [ ] Approved resident can access all features (marketplace, carpool, etc.)
- [ ] Duplicate flat registration prevented

#### 6. Scheduled Cron Job (8 PM IST / 14:30 UTC)
**Where it lives:** wrangler.toml [triggers.crons], src/index.js scheduled() handler  
**What to test when implemented:**
- [ ] Job fires at exact time (14:30 UTC daily)
- [ ] Daily digest emails sent to admins with pending approvals
- [ ] Vendor weekly analytics sent Monday morning (Phase 3A)
- [ ] No duplicate emails sent to same admin
- [ ] Failures logged and don't block next run

### Data Integrity Safeguards

- **Flat numbers always plain:** Never display `Tower X, Floor Y, Unit Z` — always use `buildFlatNumber()` to generate plain `TFLFU` format
- **Flat ownership verified:** `/flat/check` endpoint checks ownership before allowing registration
- **PII masking NOT YET LIVE:** Admin panel currently shows raw email/phone. Do not onboard real residents until `src/db/pii.js` is complete
- **Firestore rules in place:** Security rules enforce:
  - residents collection: only owners and admins can read
  - flats collection: only owner and admins can read
  - No direct list of all residents for non-admins

### External Service Dependencies

- **Resend email failures:** Non-blocking — request continues but email may not arrive. Monitor Resend dashboard.
- **Gemini API errors:** Always default to PASS (never delete/mute on AI failure)
- **Telegram API errors:** Non-blocking — messages not delivered but moderation continues
- **Firebase token generation failure:** Blocks login — user sees error

---

## Summary

**PSOTS currently has:**
- **25 Worker routes** spanning auth, registration, admin, moderation, and notifications
- **22 Firestore collections** (11 active, 11 future/partial)
- **8 external integrations** (Telegram, Gemini, Firebase, Resend, Google)
- **2 KV namespaces** storing moderation state, sessions, keywords, violations
- **5 frontend services** for admin, resident, flat, marketplace operations
- **4 main frontend pages** (admin, profile, login, marketplace)
- **1 scheduled cron job** configured (8 PM IST) but handler not yet implemented

**Most critical flow to preserve:** Resident registration → admin approval → access to marketplace. Any break here blocks onboarding.

**Most at-risk behaviour during refactor:** Telegram bot moderation logic. Changes to `moderateMessage()` must preserve:
1. Gemini always defaults to PASS on error
2. Only high-confidence verdicts auto-delete
3. Muting works (restrictChatMember)
4. Ban is admin-only decision

---

**Audit completed by:** Claude Code (automated)  
**Next action:** Implement PII masking (`src/db/pii.js`) — blocks resident onboarding until complete
