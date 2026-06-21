# PSOTS Society — Claude Code Rules
# Read this file at the start of EVERY session

---

## Project Overview
- **Platform:** PSOTS Society — society.psots.in
- **Purpose:** Resident portal for Prestige Song of the South, Bangalore (2100+ flats, 14 towers)
- **Repo:** ~/Documents/Playground/PSOTS (private)
- **Superadmin:** pushkalkishore@gmail.com / Telegram: @pushkalkishore

---

## Architecture
```
psots.in                    → Public homepage
society.psots.in/society/   → Resident portal (login required)
society.psots.in/society/admin → Admin panel (RBAC)
telegram.psots.in           → Cloudflare Worker API
@psots_telegram_bot         → Telegram bot
```

## Tech Stack
- **Frontend:** Vanilla JS ES modules, no framework, no bundler
- **Database:** Firebase Firestore (psots-society-25899, asia-south1)
- **Auth:** Firebase Auth — Google + Email OTP + Telegram OTP
- **Hosting:** Cloudflare Pages (auto-deploy from main branch)
- **Worker:** Cloudflare Workers (src/index.js) → telegram.psots.in
- **AI:** Gemini 1.5 Flash (message moderation)
- **Email:** Resend API (otp@society.psots.in, noreply@society.psots.in)

---

## Deployment Commands
```bash
# Worker (run after ANY src/index.js change)
npx wrangler deploy

# Firestore rules (run after firestore.rules change)
firebase deploy --only firestore:rules --project psots-society-25899

# Firestore indexes (run after firestore.indexes.json change)
firebase deploy --only firestore:indexes --project psots-society-25899

# Git (always in this order)
git add -A && git commit -m "message" && git pull --rebase origin main && git push origin main
```

---

## Approval Chain — NEVER BREAK THIS

**PRIMARY RESIDENT registration → ADMIN approves**
- Admin panel → Resident Approvals tab → Approve/Reject buttons
- Daily digest email at 8 PM IST if approvals pending
- All admins notified via email + Telegram for each new registration

**FAMILY MEMBER joining → PRIMARY RESIDENT approves**
- Profile page → My Family → Pending Approval → Approve/Reject
- Admin is NOTIFIED ONLY — NO approve/reject buttons in admin panel
- Family member appears in admin panel with "Owner approves" note

**TENANT adding → PRIMARY RESIDENT approves (owner declaration)**
- Profile page → My Tenants → Add Tenant flow
- Admin is NOTIFIED ONLY
- Tenant appears in admin panel with "Owner approves" note

**TENANT FAMILY request → PRIMARY RESIDENT approves**
- Owner sees request in profile → My Tenants → Pending
- Admin is NOTIFIED ONLY
- Admin can take oversight actions (see below)

**Admin Oversight Actions (available for all invite types):**
- ✓ ACK — Acknowledged, no action needed
- 🚩 Flag — Mark suspicious, add reason
- ❌ Remove — Revoke access immediately (security action)
- 😴 Snooze — Remind tomorrow 8 PM

**Admin Notification Rules**
- All admins MUST have: email, phone in admins Firestore collection
- New primary resident registered → notify all admins immediately
- Family/tenant joined → notify all admins (info only)
- Daily 8 PM IST digest → only if primary approvals pending
- Security action (flag/remove) → notify all admins immediately

---

## CRITICAL RULES — Never violate these

### File Size Limits
- `src/index.js` is 1400+ lines — NEVER read in full, grep only
- `society/admin.html` is 800+ lines — grep for specific sections
- `SocietyNav.js` is 486 lines — read fully only if needed

### Flat Number Rules
- Flat numbers always plain: `15167` not `Tower 15, Floor 16, Unit 7`
- `buildFlatNumber(tower, floor, unit)` returns plain number — never display components
- Never add Tower/Floor/Unit breakdown in UI, emails, or logs

### Bot Rules
- Bot can NEVER ban users — ban is always admin decision only
- Bot can mute temporarily
- Gemini always defaults to PASS on any API error — never punish on AI failure
- Do NOT add bot to Buy/Sell group (-1001257269381) until public launch

### Code Rules
- Never modify `residentService.create()` or `resolveIdentity()`
- Firebase version pinned to `10.12.0` across all CDN imports
- All Worker endpoints need `Authorization: Bearer {idToken}` header
- Always `firebase deploy` before `git push` when rules change
- Always `npx wrangler deploy` before `git push` when src/index.js changes

---

## Pre-Flight Check (run BEFORE every task)
Before writing any code:
1. Read CLAUDE.md — confirm all rules understood
2. State which files you WILL touch
3. State which files you will NOT touch
4. Confirm flat numbers will stay plain
5. Confirm src/index.js will be grepped only, not read in full

## Post-Flight Check (run AFTER every task)
Before committing:
1. No dead code left behind
2. No console.log() or debug statements
3. No duplicate functions
4. No commented-out old code
5. All new variables actually used
6. Existing functionality still works
7. Commit message is descriptive
8. npx wrangler deploy run if src/index.js changed
9. firebase deploy run if firestore.rules changed

---

## Anti-Clutter Rules
- Remove old code you replaced — never comment it out
- Remove debug statements before committing
- Remove unused CSS classes
- Remove unused imports
- One function does one thing
- Never leave TODO comments in production code

---

## Language & Terminology
Always use these terms consistently:
- "Flat number" not "unit number" or "apartment number"
- "Resident" not "user" or "member"
- "Admin" not "administrator" or "moderator"
- "PSOTS Society" not "MySociety" or "the society"
- "Approve/Reject" not "Accept/Decline"
- "Pending" not "waiting" or "queued"
- All UI text in English only
- Error messages: clear, friendly, no technical jargon
- Button labels: action verbs (Save, Submit, Approve, Cancel)

---

## Programming Languages Supported

### JavaScript (Primary)
- ES modules with import/export
- Async/await for all async operations
- No jQuery, no React, no bundler
- Firebase SDK v10.12.0 from CDN
- Vanilla DOM manipulation

### Python (Utility Scripts)
Use for: bulk imports, data migration, analytics, CSV processing
Location: /scripts/ folder
Run with: `python3 scripts/filename.py`
Libraries available: firebase-admin, pandas, requests
Example use cases:
- Bulk import residents from Excel
- Export Firestore data to CSV
- Generate monthly reports
- Migrate data between collections

### Bash/Shell (Automation)
Use for: deployment scripts, bulk operations, file processing
Always use `set -e` at top of scripts (exit on error)
Example use cases:
- Automated deployment sequences
- Bulk file operations
- Environment setup scripts

### JSON (Config & Data)
- Firestore rules: firestore.rules
- Firestore indexes: firestore.indexes.json
- Wrangler config: wrangler.toml
- Package config: package.json

---

## Design Tokens
```css
--jade: #1a4a3a          /* Primary green */
--jade-light: #2d6b57    /* Hover state */
--gold: #b8882a          /* Accent */
--cream: #faf6f0         /* Background */
--cream-dark: #f0e8db    /* Footer background */
--ink: #1a1208           /* Primary text */
--muted: #8a7a6a         /* Secondary text */
--border: rgba(160,130,90,0.22)
```
Font: Nunito Sans (body), Playfair Display (headings)

---

## Known Firestore Collections
```
residents          — resident profiles and status
flats              — flat ownership records
admins             — admin accounts with RBAC permissions
announcements      — community announcements
marketplace_listings — buy/sell listings
lost_found         — lost and found posts
carpooling         — carpooling offers and requests
feedback           — resident feedback
group_settings     — Telegram group moderation settings
violations         — resident violation records
moderation_logs    — bot moderation history
recommendations    — vendor/service recommendations
events             — community events
blogs              — community blog posts
settings           — platform settings (contact, platform)
```

---

## Worker Endpoints Reference
```
Auth:
POST /auth/send-email-otp          — send OTP to email
POST /auth/verify-email-otp        — verify OTP, return custom token
POST /auth/send-telegram-otp       — send OTP via Telegram
POST /auth/verify-telegram-otp     — verify Telegram OTP

Resident:
POST /notify-registration          — notify admin of new registration
POST /admin/notify-registration    — send approval email to admins
POST /admin/approve-resident       — approve resident (token-based)
POST /admin/reject-resident        — reject resident (token-based)
POST /resident/registration-confirmation — send confirmation to resident

Admin:
GET  /admin/groups                 — list Telegram groups
GET  /admin/group-settings         — get group moderation settings
POST /admin/group-settings         — save group moderation settings
GET  /admin/moderation-logs        — get moderation history
GET  /admin/violations             — get violations list
POST /admin/violations/reset       — reset user violations
POST /admin/violations/mute        — mute user
POST /admin/violations/ban         — ban user (admin only)

User:
GET  /user/violations              — get resident's own violations
POST /user/appeal                  — submit violation appeal
```

---

## Telegram Groups
```
Main group:        (residents group)
Buy/Sell:          -1001257269381  ← bot NOT admin, do not enforce yet
Admin notifications: -1001328126394
```

---

## Environment Variables (Cloudflare Worker Secrets)
```
BOT_TOKEN          — Telegram bot token
GEMINI_API_KEY     — Google Gemini API key
RESEND_API_KEY     — Resend email API key
FIREBASE_SA_EMAIL  — Firebase service account email
FIREBASE_SA_KEY    — Firebase service account private key
ADMIN_WHATSAPP     — Admin WhatsApp number (configurable)
ADMIN_TELEGRAM     — Admin Telegram handle (configurable)
ADMIN_EMAIL        — Admin email (configurable)
```

---

## Admin Contact (configurable via Firestore settings/contact)
```
adminName:      Pushkal Kishore
adminWhatsapp:  919482088904
adminTelegram:  pushkalkishore
adminEmail:     pushkalkishore@gmail.com
```

---

## Session Start Checklist
- [ ] Read CLAUDE.md (this file)
- [ ] Read CODEBASE_INDEX.md for current state
- [ ] Check git status — ensure clean working tree
- [ ] Confirm which task you are working on

## Session End Checklist
- [ ] All changes committed and pushed
- [ ] Worker deployed if src/index.js changed
- [ ] Firestore rules deployed if changed
- [ ] No debug code left in codebase
- [ ] CODEBASE_INDEX.md will auto-update

---

*Last updated: April 15, 2026*
*Platform: PSOTS Society — society.psots.in*

## Security Checklist (run before every deploy)
- Does any rule use: if true? → justify or remove
- Does any new collection expose PII without auth?
- Are user-supplied fields wrapped in escapeHTML()?
- Are flat numbers plain — never Tower/Floor/Unit?
- Does any endpoint expose data without auth token?
- Are all new Worker endpoints protected with Bearer token?

## Architecture Rules (learned from security audit)
- Frontend NEVER queries residents collection directly — use Worker endpoint
- Worker acts as secure proxy for all sensitive Firestore reads
- New endpoint pattern: POST /flat/check, GET /resident/profile etc.
- Never expose email, phone, full name to unauthenticated requests
- Only return minimum safe fields: ownerFirstName, status — never PII

## New Worker Endpoints (added today)
POST /flat/check — pre-login flat check (no auth required)
  Returns: { status: "empty|pending|occupied", ownerFirstName }
  Never returns: email, phone, full name

POST /invite/generate — generate family member invite (auth required)
POST /invite/validate — check invite token status (no auth)
POST /invite/use — mark invite as used (auth required)

## Firestore Rules — Current State
residents:
  get: isOwnerOf(uid) || isAdmin()
  list: isAdmin() only — NEVER if true
  create: isOwnerOf(uid) && uid == auth.uid
  update: isOwnerOf(uid) || isAdmin()
  delete: isAdmin()

flats:
  create: isAdmin() only
  update: isAdmin() only

settings:
  read: isSignedIn() — not public
  write: isAdmin()

violations:
  read: isAdmin() || record owner only

## XSS Prevention
- Always wrap user Firestore data in escapeHTML() before innerHTML
- escapeHTML() helper must exist in every page that renders user content
- Never trust: name, title, description, notes, location fields from Firestore

## Known Security Fixed (April 15, 2026)
- residents list: was if true → now admin only
- flat check: moved from frontend to Worker /flat/check endpoint
- flats create: was any signed-in user → now admin only
- XSS: escapeHTML() added to carpooling, lostandfound, admin, index pages
- Tower/Floor/Unit: removed from all display locations

---

## Privacy & PII Policy (April 18, 2026)

### PII Masking Rules
**Admin view — ALWAYS APPLY:**
- Names: maskName() → "First L." (first name + last initial)
- Emails: maskEmail() → "p***@domain.com"
- Phones: maskPhone() → "+91 XX XXX X1234"
- Used by: GET /admin/residents (sanitizeForAdmin), GET /admin/stats, GET /admin/violations, GET /family/list (when called by non-owner)

**Owner view:**
- Owner sees full names of own family members, masked email/phone for others

**Self view:**
- Resident sees their own full data only (no masking)

**Public/Listing view:**
- Flat number visible only if resident's privacyShowFlat toggle is ON
- Name visible only if resident's privacyShowNameOnRecs toggle is ON (for recommendations)

### Contact Relay (Privacy-First Messaging)
**Purpose:** Connect residents without exposing phone numbers or emails

**Endpoints:**
- POST /contact/send — sender calls this, message relayed via email to recipient
- GET /contact/check-limit — check remaining contacts for today (max 5/day)
- POST /resident/privacy-settings — save privacy toggles

**Implementation:**
- Never display phone numbers for residents on listing pages (marketplace, lost&found, carpooling)
- Replace with "Contact Resident" button → opens modal → sends message via /contact/send
- Email to recipient contains: sender's flat number (NOT email or phone)
- Rate limited to 5 contacts per resident per day (enforced in Worker via KV)
- Contact logs stored in contact_log collection

**Exception:** Recommendations page keeps phone visible (service providers are not residents, different privacy model)

### Consent Toggles (Firestore residents/{uid})
User controls what other residents see about them:
- `privacyShowFlat` (default: true) — if OFF: posts show "Tower X resident" instead of flat number
- `privacyAllowContact` (default: true) — if OFF: "Contact Resident" button hidden on their posts
- `privacyShowNameOnRecs` (default: true) — if OFF: recommendations show "Anonymous PSOTS Resident"
- `privacyEmailOnContact` (default: true) — if OFF: no email notification when contacted (but message still relayed)

### Storage & Retention Rules
**Family members (access level: "family"):**
- Store email AND phone (phone enables SMS OTP sign-in for family members too — every resident type should have at least one verified login method beyond what they registered with)
- Display: masked to non-owners

**Tenants (residentType: "tenant"):**
- Store phone (for owner notifications), store email
- Display: visible to owner only, masked to admins

**Primary residents (residentType: "owner"):**
- Store all fields (name, email, phone, address)
- Display: unmasked to self, masked to admins, selectively visible to others per privacy settings

**Deleted accounts:**
- Name → "Former Resident"
- Email → `uid@deleted.psots.in`
- Phone → ""
- Status → "deleted"
- All posts anonymized: postedBy → "Former Resident, Flat XXXXX"
- Audit trail kept with uid hash (name not recoverable)

### Access Logging
**Admin data access is logged automatically:**
- GET /admin/residents automatically logs to admin_access_log/{timestamp}_{adminUid}
- Fields logged: adminUid, action: "viewed_residents", timestamp, ipCity
- Retained for 30 days
- Resident can view via GET /resident/my-access-log (shows city only, not admin email)

### Right to Be Forgotten
**Endpoint:** POST /resident/delete-account
- Requires confirmation: { confirmation: "DELETE" } (must match exactly)
- Anonymizes profile immediately
- Updates all marketplace, lost_found, carpooling posts: postedBy → "Former Resident, Flat XXXXX"
- Revokes all device sessions
- No recovery possible

### Pages & Links
- `/privacy.html` — full privacy policy (public, no auth required)
- `/terms.html` — terms of service (public)
- `/about.html` — about the platform (public)
- Profile → Privacy Settings — user controls + data access history + delete account

### Deployment Notes
- No Firestore rules changes needed (already secure)
- Worker deployment required: `npx wrangler deploy` (src/index.js has new endpoints)
- New HTML pages pushed to Cloudflare Pages auto-deploy
- Update footer links to point to /privacy.html, /terms.html, /about.html

## Device Trust System (April 18, 2026)

### Overview
Device token = localStorage UUID (NOT hardware fingerprint — privacy by design)
Stored: localStorage key `psots_device_token` + Firestore `device_sessions/{token}`
Purpose: Convenience layer only — Firebase Auth is real security
Max devices: 10 per user (oldest auto-pruned after 90 days)

### Quick Return Flow
1. Page load → check localStorage for `psots_device_token`
2. Call GET `/device/check?token={token}`
3. If trusted → show Quick Return screen:
   - Avatar + "Welcome back, {name}!"
   - "Flat {flatNumber} · Last seen: {timestamp}"
   - One-tap "Continue" button (no password)
   - "Not you? Switch account" link
4. Continue → restore Firebase session silently
5. Fall back to normal login if session expired or device untrusted

### Device Registration
When resident signs in (any method):
- Generate UUID: `crypto.randomUUID()`
- Call POST `/device/register` with: `deviceToken, deviceLabel, fingerprint, loginMethod, flatNumber`
- Worker stores in `device_sessions/{deviceToken}` with: `uid, flatNumber, trusted: true, firstSeen, lastSeen, ipCity`
- If new device: send email notification
- Store token in localStorage for future quick returns

Device label = "iPhone · Safari" or "MacBook · Chrome" (generated by `getDeviceLabel()`)
Fingerprint = browser hash (generated by `getDeviceFingerprint()` from UA + screen + timezone)

### My Devices Section (Profile)
Show list of trusted devices:
- Icon + label (e.g., 📱 iPhone · Safari)
- "Last seen: {timestamp}"
- "📍 This device" badge on current device
- Location hint from IP (e.g., "Bangalore")
- ✅ Active / ⚠️ Revoked status
- Revoke button (device must re-authenticate next time)

Endpoints:
- GET `/device/list?uid={uid}` — return all devices for user (sorted by lastSeen DESC)
- POST `/device/revoke` — set device to untrusted

### Storage Rules
Device tokens are localStorage UUIDs — NOT hardware IDs:
- Browser data cleared = new device = new token = new email notification (by design)
- Cannot track device across browsers or browser profiles
- Private browsing mode = new device each time
- iOS app ≠ Safari on same iPhone (different localStorage)

### Privacy Notes
- Email notifications on new device: "New device logged in — {deviceLabel} from {city}"
- Admin can see logged-in devices in device_sessions (no privacy impact — resident data)
- Device tokens are opaque UUIDs, cannot identify hardware or individual
- Right to be forgotten (delete account) revokes all device sessions

### Modules & Functions
File: `js/core/device.js`
- `getDeviceFingerprint()` → hash of UA, screen, timezone, etc.
- `getDeviceLabel()` → "iPhone · Safari" style string
- `getStoredDeviceToken()` → read from localStorage
- `storeDeviceToken(token)` → write to localStorage
- `getPreferredLoginMethod()` → read login method preference
- `storeLoginMethod(method)` → save preferred method (Google/Email/Telegram)

Import in login.html and profile.html:
```javascript
import { getStoredDeviceToken, storeDeviceToken, getDeviceFingerprint, getDeviceLabel, getPreferredLoginMethod, storeLoginMethod } from '../../js/core/device.js';
```
