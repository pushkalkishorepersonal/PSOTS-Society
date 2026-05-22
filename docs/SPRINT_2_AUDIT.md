# Sprint 2 Codebase Audit — Auth Endpoints (Login, Register, Session, OTP)

## Current Status
- **Last worked:** April 20, 2026 (Sprints 1a, 1b, 1.5 completed)
- **Next sprint:** Sprint 2 (Auth endpoints)
- **Design reference:** IDENTITY_MODEL.md (Sections 4-7)
- **Codebase rules:** CLAUDE.md (Critical Rules, File Size Limits, Code Rules)

---

## ✅ COMPLETED (Sprints 0-1.5)

### Sprint 0 — Basics
- Basic site (index.html, guides, marketplace, recommendations)
- Telegram bot (@psots_telegram_bot)
- Marketplace, lost & found, carpooling

### Sprint 1a — Identity Schema + Adapters
- `residents/` collection (20 adapter functions)
- `credentials/` collection (4 adapter functions)
- `flats/` collection (3 adapter functions)
- `device_sessions/` collection (3 adapter functions)
- Migration script stub (incomplete)

### Sprint 1b — Rate Limiting + Device Trust
- Rate limiter module (src/security/ratelimiter.js)
- Device session management (/device/register, /device/revoke)
- KV namespace binding (RATE_LIMITS_KV)
- Sliding-window rate limiter for OTP/login

### Sprint 1.5 — PWA
- Web app manifest (society/manifest.json)
- Service worker (society/sw.js)
- Offline support + installable

---

## ❌ PENDING — Sprint 2 (Auth Endpoints)

### Missing Core Endpoints

| Endpoint | Status | Design Ref | Notes |
|----------|--------|-----------|-------|
| `/auth/unified-login` | ❌ Missing | Sec 4 | Case A/B/C credential lookup |
| `/auth/register` | ❌ Missing | Sec 5 | New resident + flat validation |
| `/auth/resume-device` | ❌ Missing | Sec 7 | Trusted device quick return |
| `/auth/send-email-otp` | ✅ Built | Sec 4 | Works, needs Sprint 2 integration |
| `/auth/verify-email-otp` | ✅ Built | Sec 4 | Works, needs Spring 2 integration |

### Missing OTP Rate Limits (Design: Sec 24)

| Limit | Target | Current | Needed |
|-------|--------|---------|--------|
| OTP request | 5/hour per IP | ❌ Partial | Enforce |
| OTP request | 3/hour per identifier | ❌ Partial | Enforce |
| OTP verification | 5 attempts per OTP | ❌ Missing | Build |
| OTP expiry | 15 min | ❌ Missing | Build |
| Failed attempts | Lock 30 min after 3 wrong | ❌ Missing | Build |

### Missing Frontend (Design: Sec 4-5)

| Page | Status | Notes |
|------|--------|-------|
| 3-button login screen | ❌ Missing | "Continue with Google", "Continue with Email", "Continue with Phone (Telegram)" |
| Login → flat entry form | ❌ Missing | Single text input: "What's your flat number?" |
| Registration flow UI | ❌ Stub | register.html exists (325 bytes) — empty |
| Device quick return | ❌ Missing | "Welcome back! Tap to continue" |
| Device management UI | 🟡 Partial | Device list exists in profile, no management |

### Missing Session Management (Design: Sec 9)

| Feature | Status | Notes |
|---------|--------|-------|
| `/auth/resume-device` endpoint | ❌ Missing | Core quick-return flow |
| Session cookie (psots_session) | ✅ Exists | Used for auth, need unification |
| Cross-subdomain cookie scope | ❌ Missing | Need `.psots.in` scope (for chhath.psots.in) |
| 90-day sliding expiry | ❌ Missing | Need KV session store extension |
| Device email alerts | ❌ Missing | "New device logged in from {location}" |

---

## 📋 DETAILED AUDIT BY FILE

### src/index.js (4549 lines)
**Status:** Cannot read in full (>1400 line limit per CLAUDE.md)

**Grep findings:**
- ✅ OTP send/verify endpoints exist
- ✅ Device register/revoke endpoints exist
- ✅ Rate limiter imported + used
- ❌ `/auth/unified-login` missing
- ❌ `/auth/register` missing
- ❌ `/auth/resume-device` missing
- ❌ OTP expiry (15 min) not enforced
- ❌ Lock-after-3-failures not enforced

### src/db/adapter.js
- ✅ `createCredential()` exists
- ✅ `getCredentialByTypeAndId()` (Case A lookup)
- ✅ `getAllCredentialsForIdentifier()` (Case B lookup)
- ✅ All CRUD for residents, flats, device_sessions
- ❌ No `findResidentByCredential()` shortcut

### src/security/ratelimiter.js
- ✅ Sliding-window rate limiter exists
- ✅ Used for OTP requests
- ❌ No OTP verification attempt counter
- ❌ No identifier lock-after-N-failures

### society/login.html (1386 lines)
- 🟡 Partial — uses Firebase Auth directly
- ❌ Not using `/auth/unified-login` endpoint
- ❌ No 3-button UI (has tabs instead)
- ❌ No flat number entry form
- ❌ No device quick return

### society/register.html
- ❌ Stub only (325 bytes)
- Needs complete rebuild per IDENTITY_MODEL.md Sec 5

### society/profile.html
- 🟡 Device list exists (devices tab)
- ❌ No device management (revoke, sign out all)
- ❌ No privacy settings tab (CLAUDE.md privacy section)

---

## 🔧 WORK BREAKDOWN FOR SPRINT 2

### Phase 1: Backend Endpoints (Priority: Critical)

**Task 1.1:** Build `/auth/unified-login` endpoint
- Input: { type, identifier, firebaseToken }
- Case A: (type, identifier) match → return resident + session
- Case B: identifier match different type → link + return resident + session
- Case C: no match → signal registration needed
- Dependencies: `getCredentialByTypeAndId()`, `getAllCredentialsForIdentifier()`
- Tests: 3 cases, edge cases (Case 6.1-6.11)
- Est: 4-6 hours

**Task 1.2:** Build `/auth/register` endpoint
- Input: { flatNumber, residentType, email, phone, name }
- Validation: flat format, role rules, duplicate check
- Atomically: create resident + credential + flat
- Rate limit: 1 pending per email/flat per 24h
- Output: resident record + session
- Dependencies: `validateFlatNumber()`, `createResident()`, `createCredential()`, `createFlat()`
- Tests: all 3 registration types, all validation failures, atomicity
- Est: 6-8 hours

**Task 1.3:** Build `/auth/resume-device` endpoint
- Input: deviceToken (from cookie)
- Lookup: device_sessions/{deviceToken}
- Check: not revoked, within 1 year
- Output: new session + user data
- Dependencies: `getDeviceSessionById()`, session creation
- Tests: valid device, expired device, revoked device, missing device
- Est: 2-3 hours

**Task 1.4:** Harden OTP verification
- Enforce: 5 attempts per OTP (counter in KV or OTP doc)
- Enforce: 15-min OTP expiry (timestamp in OTP doc)
- Enforce: 30-min lock after 3 wrong attempts (KV identifier lock)
- Output: "Too many attempts" or "OTP expired" errors
- Dependencies: OTP storage schema change, KV operations
- Tests: limit enforcement, lock timing, unlock logic
- Est: 3-4 hours

### Phase 2: Frontend — Login Flow (Priority: High)

**Task 2.1:** Redesign login.html → 3-button UI
- Remove tabs, add 3 full-width buttons
- Flow: button → choose auth method → `POST /auth/unified-login`
- Case C → redirect to flat entry form
- Turnstile on all forms (Sec 24)
- Design tokens: CLAUDE.md (--jade, --gold, --cream, etc.)
- Est: 4-5 hours

**Task 2.2:** Build registration form (flat + role + details)
- Flat input: single text field, client-side validation
- Role: 3 radio buttons (Owner/Tenant/Family)
- Details: name, email, phone
- Validation: `validateFlatNumber()` + server-side checks
- Turnstile before submit
- Est: 3-4 hours

**Task 2.3:** Build device quick return screen
- Check localStorage for `psots_device_token`
- `GET /device/check?token={token}` → if trusted
- Show: Avatar, "Welcome back, {name}!", flat, "Continue" button
- One-tap → `POST /auth/resume-device` → dashboard
- Est: 2-3 hours

### Phase 3: Session Management (Priority: High)

**Task 3.1:** Implement cross-subdomain session cookie
- Cookie: `psots_session`; scope: `.psots.in`
- Purpose: login at society.psots.in → auto-logged into chhath.psots.in
- Implementation: Worker sets cookie header on login
- Tests: same domain cookie, subdomain inheritance
- Est: 1-2 hours

**Task 3.2:** Implement 90-day sliding session expiry
- Store: KV `session:{sessionId}` with `expiresAt`
- On each request: extend `expiresAt` by 90 days
- Cleanup: expire old sessions (KV TTL)
- Tests: session creation, extension, expiry
- Est: 2-3 hours

### Phase 4: Alerts & Notifications (Priority: Medium)

**Task 4.1:** Email alert on new device
- Trigger: `/device/register` → new device
- Email: "New sign-in from {deviceLabel}, {city}"
- Template: use Resend API
- Rate limit: 1 email per device per registration
- Est: 2-3 hours

---

## 📊 SPRINT 2 ESTIMATE
- **Backend:** Tasks 1.1-1.4 = 15-21 hours
- **Frontend:** Tasks 2.1-2.3 = 9-12 hours
- **Sessions:** Tasks 3.1-3.2 = 3-5 hours
- **Alerts:** Task 4.1 = 2-3 hours
- **Testing & fixes:** 5-10 hours
- **Total: 34-51 hours** (~1-1.5 weeks)

---

## ⚠️ BLOCKERS & DEPENDENCIES
1. Firestore rules update: allow `credentials` writes (check sec 24 rules)
2. Turnstile site key: have you added to wrangler.toml yet?
3. Resend API key: confirmed working for emails?
4. Device UUID generation: `crypto.randomUUID()` availability (should be fine in Workers)

---

## 📝 QUICK REFERENCE: CLAUDE.md Rules for Sprint 2

**CRITICAL FILE SIZE LIMITS:**
- src/index.js (4549 lines) — GREP ONLY, never read full
- society/login.html (1386 lines) — read only needed sections

**CODE RULES:**
- Never modify `residentService.create()` or `resolveIdentity()` ← check if these exist
- Firebase version pinned to `10.12.0`
- All Worker endpoints need `Authorization: Bearer {idToken}` header ← except /auth/unified-login, /auth/register, /device/check (public)
- Always `npx wrangler deploy` before `git push` if src/index.js changes
- Always `firebase deploy --only firestore:rules` if firestore.rules changes

**DEPLOYMENT:**
```bash
# After src/index.js changes:
npx wrangler deploy

# After firestore.rules changes:
firebase deploy --only firestore:rules --project psots-society-25899

# Git push (always in this order):
git add -A && git commit -m "message" && git pull --rebase origin main && git push origin main
```

**FLAT NUMBERS:**
- Always plain: `15167` not "Tower 15, Floor 16, Unit 7"
- Use `validateFlatNumber()` from flat.service.js
- Valid towers: [1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 14, 15, 16, 17] (no 6, 7, 13)

---

## ✅ NEXT STEPS

1. **Confirm priorities:** Backend first (endpoints), then frontend?
2. **Assign order:** Should I start with 1.1 (unified-login), 1.2 (register), or something else?
3. **Clarify blockers:** Are Turnstile keys, Resend API, Firestore rules ready?

