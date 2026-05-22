# PSOTS Society — Architecture

**Last reviewed:** April 18, 2026
**Version:** 2.0

---

## 1. Platform Overview

PSOTS Society Platform (society.psots.in) is a resident-to-resident community utility for Prestige Song of the South, Bangalore — 2,100+ flats across 14 towers. It is not a society management tool. No feature requires RWA involvement. Every feature works purely between verified residents. The platform is maintained by a single individual contributor and designed to be self-managing at scale.

---

## 2. Infrastructure

| Service | Provider | URL | Purpose |
|---------|----------|-----|---------|
| Frontend | Cloudflare Pages | society.psots.in | All resident-facing HTML/JS pages |
| Bot + API | Cloudflare Workers | telegram.psots.in | Telegram bot + all API endpoints |
| Event pages | Cloudflare Pages | chhathpuja.psots.in | Festival pages (AdSense enabled) |
| KV Storage | Cloudflare KV | — | Violations, keywords, audit logs, sessions |
| Database | Firebase Firestore | asia-south1 Mumbai | Residents, family, orders, community data |
| Auth | Firebase Auth | — | Google OAuth, Email OTP, Telegram OTP |
| Email | Resend API | — | Registration, approval, invite emails |
| File storage | Cloudflare R2 | — | Vendor photos (Phase 3B) |
| CI/CD | GitHub Actions | pushkalkishorepersonal/psots | Auto-deploy on push to main |

Cloudflare is the only deployment platform. No Vercel, Railway, or Render.
Firebase is used for auth and database only — not hosting.

---

## 3. Identity Model

**Last reviewed:** April 18, 2026 — no structural changes from repo cleanup

Flat number is the primary key for all identity.

```
flats/{flatNumber}
  ownerUid, createdAt
  └── members/{memberId}     — family (role='family')

residents/{uid}
  uid, flatNumber, status, loginMethod, ...
  └── linkedAccounts/        — multiple login methods per resident

tenants/{tenantId}
  residentType='tenant', flatNumber, ownerUid, ...
  └── family/{memberId}
```

- **Primary resident** — one per flat. Admin approves once.
- **Family member** — sub-document under flat. No separate Firebase account. Primary resident approves.
- **Tenant** — separate record. Owner approves. Admin gets notice only.
- **Admin** — always sees masked PII. Never sees full email, phone, or full name.

---

## 4. Auth Flows

**Google login:** Firebase OAuth → check UID → new (registration) or existing (dashboard or pending screen)

**Email OTP:** Enter email → POST /auth/send-email-otp → enter OTP → POST /auth/verify-email-otp → session

**Telegram OTP:** Click login → bot sends OTP to Telegram DM → enter OTP → POST /verify-otp → session

**Device recognition:** fingerprint in localStorage `psots_device_token` → GET /device/check → known = skip OTP, new = full auth + email alert

---

## 5. PII Masking Policy (Option C)

> STATUS: ✅ FULLY IMPLEMENTED (April 18, 2026) — Masking functions applied at all 4 key routes + 9 smoke tests verify no raw PII leaks. Option C refinement (April 18): Admins see FULL names, all others see masked names.

All masking logic in `src/db/pii.js`. Only the resident sees their own full data. Masking is applied at response boundaries in route handlers.

| Field | Admin view | Resident-to-resident | Public | Status |
|-------|-----------|----------------------|--------|--------|
| Email | `p***@gmail.com` | `p***@gmail.com` | Hidden | ✅ maskEmail() implemented |
| Phone | `+91 94XXX X8904` | `+91 94XXX X8904` | Hidden | ✅ maskPhone() implemented |
| Full name | **FULL** name | `Pushkal K.` | `Pushkal K.` | ✅ maskName() used except admin |
| Flat number | Visible | Visible | Visible | ✅ No masking |
| Login method | Visible | Hidden | Hidden | ✅ Admin context only |
| IP address | City only | Not exposed | Not exposed | ✅ City geolocation only |

Implemented functions in `src/db/pii.js` (15 tests passing):

```javascript
maskEmail(email)                            // p***@gmail.com
maskPhone(phone)                            // +91 94XXX X8904
maskName(fullName)                          // Pushkal K.
sanitizeForAdmin(resident)                  // apply all masks
sanitizeForResident(resident, requestingUid) // full if own record, else masked
sanitizeForPublic(resident)                 // flatNumber + displayName only
```

**Routes that apply masking:**
- ✅ GET /admin/residents — sanitizeForAdmin on response list
- ✅ GET /family/list — sanitizeForResident per member (caller-aware)
- ✅ GET /invite/validate — maskName on inviterName (public endpoint)
- ✅ POST /invite/accept audit — maskEmail + maskName on joinerEmail and joinedByName

**Verification:** PII-leak smoke tests in `tests/smoke/pii-leak.smoke.test.js` (9 tests) fail if masking is skipped or broken. Patterns tested: no raw email (p@*.com), no raw phone (+91 10-digit), no full names in public responses.

---

## 6. DB Adapter Layer

> PERMANENT ARCHITECTURAL RULE — never violate

**Last reviewed:** April 18, 2026 — Implemented (src/db/{adapter.js, firebase.js, firebase-init.js}) + Frontend wrapper (js/core/db.js) + All services migrated + Architecture check passing in CI

All database operations must go through the adapter:
- **Worker (src/):** `src/db/adapter.js` is the only import point
- **Frontend (js/):** `js/core/db.js` wraps Firestore client SDK
No direct Firebase/Firestore imports anywhere else in the codebase.
When migration is triggered, only `firebase.js` is replaced with `supabase.js`.
One import line in `adapter.js` changes. Nothing else touches migration.

**Verification rule:** Every `db.X(...)` call site in the codebase must resolve to an export in `src/db/adapter.js`. Wrangler static analysis enforces this — any "Import will always be undefined" warning in a deploy log is a blocking bug.

```
src/db/
  adapter.js      ← application calls only this
  firebase.js     ← current Firebase implementation
  pii.js          ← masking functions
  supabase.js     ← future (created when migration triggered)

js/core/
  db.js           ← frontend adapter: re-exports Firestore from firebase.js
  firebase.js     ← frontend Firebase initialization only
```

Key adapter exports: `getResident`, `getResidentByFlat`, `saveResident`, `listResidents`, `updateResidentStatus`, `getFamilyMembers`, `saveFamilyMember`, `updateFamilyMemberStatus`, `saveInvite`, `getInvite`, `logInviteAudit`, `saveOrder`, `getOrder`, `listVendorOrders`, `getVendor`, `listVendors`, `saveVendorMenu`

**Migration trigger:** Firebase bill exceeds ₹1,500/month OR food orders exceed 500/day.
**Auth stays in Firebase permanently — not part of any migration.**

---

## 7. Firestore Schema

```
residents/{uid}
  uid, flatNumber, name, email, phone, loginMethod,
  status, createdAt, reasonCategory, reasonNote, accessLevel

flats/{flatNumber}
  flatNumber, ownerUid, createdAt
  └── members/{memberId}
        memberId, name, email, relation, role='family',
        status, inviteToken, joinedAt, approvedByUid

invites/{token}
  token, flatNumber, createdByUid, type, status, createdAt, expiresAt

invite_audit/{token}
  token, flatNumber, joinerEmail (masked), inviterFlat, action, timestamp

tenants/{tenantId}
  tenantId, flatNumber, ownerUid, name, email, phone,
  residentType='tenant', status, leaseStart, leaseEnd
  └── family/{memberId}

violations/{chatId}/members/{userId}
  userId, username, violationCount, lastViolation, mutedUntil, banned

appeals/{docId}
  userId, groupId, reason, status, createdAt

orders/{orderId}                        [Phase 3]
  orderId, buyerFlat, vendorFlat, items, total, status, createdAt

vendors/{flatNumber}                    [Phase 3]
  flatNumber, ownerName, whatsapp, subscriptionType, creditBalance
  └── menu/{itemId}
        name, price, unit, available, photo
```

---

## 8. Worker Routes

**Last reviewed:** April 18, 2026 — reconciled with /docs/CURRENT_STATE.md Section 1 (25 routes found, CURRENT_STATE is truth)

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/` or `/index.html` | None | Serve landing page with Google login |
| GET | `/market` | None | Serve marketplace landing page |
| GET | `/handbook` | None | Serve community handbook |
| GET | `/events` | None | Serve events calendar page |
| GET | `/user` or `/user/` | None | Serve user panel page |
| GET | `/send-otp?username={u}` | None | Send Telegram OTP to user by username |
| GET | `/verify-otp?username={u}&otp={otp}` | None | Verify Telegram OTP and mint Firebase token |
| POST | `/flat/check` | None | Check flat status: empty, pending, occupied (pre-login) |
| POST | `/auth/send-email-otp` | None | Send 6-digit OTP to email via Resend |
| POST | `/auth/verify-email-otp` | None | Verify email OTP and return Firebase token |
| POST | `/auth/link-email` | None | Store email→UID mapping for repeat login |
| POST | `/resident/feedback` | None | Accept resident feedback (rate limited 5/hour) |
| POST | `/notify-registration` | None | Send Telegram alert to admin when registration submitted |
| POST | `/admin/notify-registration` | None | Email all admins with approval tokens, notify Telegram group |
| POST | `/resident/registration-confirmation` | None | Send confirmation email to resident after registration |
| POST | `/admin/process-action` | Token auth | Process admin approval/rejection with token validation |
| GET | `/admin/groups` | None | List all managed Telegram groups |
| GET | `/admin/members?groupId=X` | None | List group members (simplified, returns empty) |
| POST | `/admin/mute` | None | Mute user in group for duration |
| POST | `/admin/ban` | None | Ban user from group |
| GET | `/admin/violations` | None | Get violations list for last 30 days |
| POST | `/webhook/telegram` | Token verify | Main Telegram webhook handler for moderation |
| POST | `/scheduled` | Cron trigger | Scheduled job (8 PM IST / 14:30 UTC) |

---

## 9. Registration Data Flows

**Primary resident:**
Form → Worker → check duplicate flat → create PENDING → welcome email → admin queue → admin approves → approval email → onboarding modal

**Family member:**
Primary generates invite → family gets link → validates token → completes join form → stored as sub-document → primary sees pending → primary approves → confirmation email → admin gets notice (not a task)

**Tenant:**
Owner generates tenant invite → same flow → stored as residentType='tenant' → owner approves → admin gets notice

---

## 10. Out of Scope — Permanent

| Feature | Reason |
|---------|--------|
| Maintenance request tracker | RWA management workflow |
| Visitor gate pass | Guard-side integration required |
| Facility booking | RWA admin capacity management |
| Official RWA notices | Must come from official channels |
| Society voting / AGM | Legal certification required |
| Parking management | Hardware integration required |

---

## 11. Caching Strategy

**Status:** ✅ Implemented April 18, 2026.

**Scope:** KV-backed read cache via `src/db/cache.js`. Three hot-path reads cached:
- `getResident(uid)` — 5-minute TTL
- `getResidentByFlat(flatNumber)` — 5-minute TTL
- `getFamilyMembers(flatNumber)` — 2-minute TTL

**Design:** Transparent adapter-layer wrapping. Cache misses fall through to Firestore. Cache hits return immediately.

**Invalidation:** Synchronous on matching writes. Five write functions delete related cache keys:
- `saveResident()` — deletes resident:uid and resident:flat:flatNumber
- `updateResidentStatus()` — deletes resident:uid
- `saveFamilyMember()` — deletes family:flatNumber
- `updateFamilyMemberStatus()` — deletes family:flatNumber
- `deleteFamilyMember()` — deletes family:flatNumber

**Projected impact:** 60-70% Firestore read reduction at 4,000 concurrent users peak.

**Escape hatch:** env.CACHE_BYPASS='1' disables all cache reads and writes (debugging only).

---

## 12. Rate Limiting

**Status:** ✅ Implemented April 18, 2026.

**Scope:** Sliding-window rate limiter in `src/middleware/ratelimit.middleware.js`. Four rate limit buckets:
- `auth` — 5 requests/min per client IP (OTP endpoints, strict)
- `public` — 30 requests/min per client IP (unauthenticated)
- `session` — 120 requests/min per authenticated user (full residents)
- `admin` — 300 requests/min per admin UID (privileged)

**Design:** Applied early in fetch handler via `applyRateLimit()`. Returns 429 Too Many Requests if limit exceeded. Counters stored in CACHE_KV with 2-minute TTL. Windows reset every 60 seconds.

**Window reset:** Each bucket:identifier combination has a 1-minute window. On window boundary, counter resets. Requests within window increment counter. No sliding clock arithmetic — cleaner implementation.

**Escape hatch:** env.RATELIMIT_BYPASS='1' allows unlimited requests (debugging only).

**Skip list:** /webhook/telegram (Telegram shared-secret authentication handles its own rate limiting).

**Fail open:** If CACHE_KV unavailable, rate limiter allows request (availability > strict security at this stage).

---

## 15. Quality Gates

**Last reviewed:** April 18, 2026 — established as baseline before any refactoring

All CI and local checks before code merges or deployment.

### Local Development

```bash
npm test              # Vitest: unit tests from **/*.test.js
npm test:watch       # Vitest: watch mode for development
npm test:coverage    # Vitest: coverage report
npm run lint         # ESLint: src/ and js/ (Worker + Browser code)
npm run check:arch   # Custom script: Firebase imports only in src/db/
```

### GitHub Actions CI Pipeline

**File:** `.github/workflows/deploy.yml`

1. **Quality job** (runs first)
   - `npm install` with cached dependencies
   - `npm run lint` — fails if errors exceed config
   - `npm run test` — fails on test failures
   - ~~`npm run check:arch`~~ (commented out until Prompt 4 adapter is complete)

2. **Deploy job** (depends on quality job passing)
   - Only runs if quality job succeeds
   - Stores bot token in KV
   - Deploys Worker to Cloudflare

### ESLint Configuration

**File:** `eslint.config.mjs`

- **Recommended rules** from @eslint/js
- **Separate configs** for src/ (Cloudflare Workers environment) and js/ (browser environment)
- **Globals**: Response, Request, fetch, TextEncoder, TextDecoder (src/), document, window, localStorage, etc. (js/)
- **Rule overrides**: no-console off, no-empty warn, no-prototype-builtins warn
- **Max warnings**: 150 (baseline; tightened in future prompts)

### Vitest Configuration

**File:** `vitest.config.js`

- **Environment**: Node
- **Include**: `**/*.test.js`
- **Exclude**: node_modules, promo-video, archive

### Architecture Enforcement

**File:** `scripts/check-architecture.js`

Prevents Firebase imports outside `src/db/`:
- Walks src/ and js/ directories
- For each .js file, checks if it imports 'firebase' or 'firebase-admin'
- Fails (exit 1) if violations found
- Allows only: src/db/firebase.js, src/db/firebase-admin.js
- Status: Pass (all Firebase imports already isolated)
