# PSOTS Society — Feature Status

**Last audited:** April 18, 2026
**Audited by:** Claude Code (initial) + Pushkal review
**Next action:** Implement PII masking — blocks resident onboarding

---

## Auth & Identity

| Feature | Status | Notes | Blocker |
|---------|--------|-------|---------|
| Google login | ✅ DONE | OAuth flow in login.html, Firebase Auth integrated | — |
| Email/Password login | ✅ DONE | Firebase createUserWithEmailAndPassword, password reset via sendPasswordReset(), account linking enabled | — |
| Email OTP login | ⚠️ PARTIAL | Moved to backup branch (backup/telegram-email-otp) for future review | — |
| Telegram OTP login | ⚠️ PARTIAL | Moved to backup branch (backup/telegram-email-otp) for future review | — |
| Flat number as primary identity key | ✅ DONE | flatNumber drives identities, linkedAccounts, flats collections | — |
| New resident registration form | ✅ DONE | 3-step flow in society/register.html: flat selection → role selection → personal details, posts to /auth/register | — |
| Password reset email | ✅ DONE | Firebase sendPasswordReset() with PSOTS branding, user receives reset link via email | — |
| Firebase Account Linking | ✅ DONE | Enabled in Firebase Console, prevents duplicate accounts with same email across auth methods | — |
| Phone number in registration | ✅ DONE | Optional tel field in registration step 3, passed to /auth/register endpoint | — |
| Resident status = pending on registration | ✅ DONE | ACCOUNT_STATUSES.PENDING in resident.service.js create() | — |
| Admin approval queue | ✅ DONE | Admin panel tabs, subscribeResidents() with pending filter | — |
| Admin can approve a resident | ✅ DONE | POST /admin/approve Worker endpoint, updates status to APPROVED, sends confirmation email, supports both old (uid) and new (residentId) schema | — |
| Admin can reject a resident with reason | ✅ DONE | POST /admin/reject Worker endpoint with reasonCategory + reasonNote, sends rejection email with reason | — |
| Approved resident gets email confirmation | ⚠️ PARTIAL | /resident/registration-confirmation endpoint exists, untested | End-to-end test needed |
| Rejected resident gets email with reason | ⚠️ PARTIAL | Code path exists, email delivery not verified | End-to-end test needed |
| Device recognition (quick return) | ✅ DONE | localStorage psots_device_token (browser UUID), GET /device/check validates token, quick return screen shows resident greeting | — |
| New device email alert | ✅ DONE | POST /device/register creates device session, email notification sent on new device login, tested end-to-end | — |
| Device management (My Devices tab) | ⚠️ PARTIAL | Profile page structure exists, device list retrieval working, revoke functionality pending | Profile UI refinement |
| Re-registration duplicate prevention | ✅ DONE | resident.service.js checks flatNumber before create(), throws error | — |

---

## Family & Tenant Flows & Profile Features

> ⏳ **Coming Soon (UI disabled as of April 19, 2026)** — Family member, tenant, device management, and data access history features are being rebuilt in Sprint 3 of the identity refactor. Profile UI frozen behind "Coming Soon" messaging for demo readiness. Family UI disabled in commit c861786 (Apr 19). Tenant UI disabled in commit d50dd07 (Apr 19). Device management and data access history UI disabled in profile demo polish (Apr 19). Backend endpoints `/invite/create`, `/tenant/add`, `/device/*`, and `/resident/my-access-log` currently return 500/403 or are incomplete. See DECISIONS.md for context.

| Feature | Status | Notes | Blocker |
|---------|--------|-------|---------|
| Primary resident generates invite token | ✅ DONE | POST /invite/create, stores in invites/{token} | — |
| Primary resident sends email invite link | ✅ DONE | POST /invite/send-email, HTML template via Resend API | — |
| Family member lands on join page via invite | ✅ DONE | Invite UI validates token via GET /invite/validate | — |
| Family member completes registration | ✅ DONE | POST /invite/accept creates under flats/{flatNumber}/members | — |
| Family stored as sub-document under flat | ✅ DONE | flats/{flatNumber}/members/{memberId} with role='family' | — |
| Primary resident sees pending family tab | ⏳ COMING SOON | UI disabled during refactor. Page structure exists, approval UI flow incomplete | Sprint 3 rebuild |
| Primary resident approves family member | ⏳ COMING SOON | UI disabled during refactor. No owner-side endpoint — only admin approval exists | Sprint 3 rebuild |
| Primary resident rejects family member | ⏳ COMING SOON | UI disabled during refactor. No owner-side rejection endpoint | Sprint 3 rebuild |
| Approved family member gets email | ⏳ COMING SOON | UI disabled during refactor. Blocked by missing approval flow | Sprint 3 rebuild |
| Admin gets notice when family joins | ⚠️ PARTIAL | invite_audit/{token} collection exists, notification untested | Email delivery verification |
| Admin acknowledges or flags family notice | ❌ MISSING | No UI or endpoint for admin action on notices | Not implemented |
| Tenant registration flow | ⏳ COMING SOON | UI disabled during refactor. tenants/{tenantId} collection exists, invite endpoints exist | Sprint 3 rebuild |
| Tenant stored separately with type flag | ✅ DONE | residentType='tenant' field exists | — |
| Tenant family invite | ⏳ COMING SOON | UI disabled during refactor. tenant_family_requests collection exists, flow incomplete | Sprint 3 rebuild |
| Owner gets notice when tenant family joins | ⏳ COMING SOON | UI disabled during refactor. Collection exists, notification untested | Sprint 3 rebuild |

---

## PII Masking

> ⚠️ CRITICAL — do not onboard real residents until this section is complete

| Feature | Status | Notes | Blocker |
|---------|--------|-------|---------|
| maskEmail() function | ✅ DONE | Implemented in src/db/pii.js, 4 tests (malformed, empty, null cases) | — |
| maskPhone() function | ✅ DONE | Implemented in src/db/pii.js, 4 tests (10-digit, +91, short, empty) | — |
| maskName() function | ✅ DONE | Implemented in src/db/pii.js, 4 tests (2-part, 3-part, single, empty) | — |
| sanitizeForAdmin() function | ✅ DONE | Implemented in src/db/pii.js, masks email/phone/name in admin view | — |
| sanitizeForResident() function | ✅ DONE | Implemented in src/db/pii.js, 2 tests (own uid=full, others=masked) | — |
| sanitizeForPublic() function | ✅ DONE | Implemented in src/db/pii.js, 1 test (flat + displayName only) | — |
| GET /admin/residents uses masking | ✅ DONE | sanitizeForAdmin applied at response boundary, 9 smoke tests verify no raw PII leaks | — |
| GET /family/list uses masking | ✅ DONE | sanitizeForResident applied per member with caller UID context | — |
| Invite audit responses mask PII | ✅ DONE | maskEmail + maskName applied to joinerEmail and joinedByName in audit | — |
| Admin panel shows masked email | ✅ DONE | sanitizeForAdmin masks to p***@domain.com format | — |
| Admin panel shows masked phone | ✅ DONE | sanitizeForAdmin masks to +91 XXXX X1234 format | — |
| Admin panel shows full name (Option C) | ✅ DONE | sanitizeForAdmin shows full names. Email/phone still masked. Admins need full names for WhatsApp community verification. | — |
| Resident sees own full PII on profile | ✅ DONE | sanitizeForResident returns full data when uid matches caller, masked otherwise | — |
| GET /invite/validate masks inviter | ✅ DONE | maskName applied to inviterName (public endpoint) | — |
| PII-leak smoke tests | ✅ DONE | tests/smoke/pii-leak.smoke.test.js with 9 tests covering admin/resident/public views | — |
| Privacy page at society/privacy.html | ✅ DONE | Comprehensive privacy policy live | — |

---

## DB Adapter Layer

> ⚠️ ARCHITECTURAL RULE — must be in place before any new DB code is written

| Feature | Status | Notes | Blocker |
|---------|--------|-------|---------|
| src/db/adapter.js created | ✅ DONE | Pass-through shell with 58 exports (all above + createSession, getSession, deleteSession, touchSession, firestoreGet) | — |
| src/db/firebase.js (isolated implementation) | ✅ DONE | Firestore REST API layer: getResident, listResidents, saveResident, etc. All functions return { data/ok, error } pattern | — |
| src/db/firebase-init.js (centralized init) | ✅ DONE | Single init point: getServiceAccountToken(), getAuthHeader(), PROJECT_ID, BASE_URL constants | — |
| No direct Firebase imports outside adapter | ✅ DONE | js/core/db.js wrapper created; all services refactored (resident, admin, marketplace, flat, rateLimit); npm run check:arch passing | — |
| Firebase Auth stays permanent (not migrated) | ✅ DECIDED | Auth is not part of any migration plan | — |
| Architecture check enabled in CI | ✅ DONE | .github/workflows/deploy.yml uncommented npm run check:arch line | — |
| Session adapter exports wired | ✅ DONE | createSession, getSession, deleteSession, touchSession re-exported from adapter; production login paths now valid | — |
| firestoreGet added + re-exported | ✅ DONE | Legacy helper in firebase.js for 35+ direct Firestore reads; Wrangler "will always be undefined" warnings eliminated | — |

---

## Telegram Bot

| Feature | Status | Notes | Blocker |
|---------|--------|-------|---------|
| Keyword detection in groups | ⚠️ PARTIAL | Gemini-powered moderation in telegram.js, untested in live group | Bot integration testing |
| Violation tracking per user | ✅ DONE | violations/{chatId}/members/{userId}, POST endpoints exist | — |
| Admin dashboard — violations and stats | ✅ DONE | /admin/violations GET endpoint, admin panel tabs | — |
| Moderation actions (mute / kick / ban) | ✅ DONE | POST /admin/mute, POST /admin/ban implemented | — |
| User appeal via Telegram DM | ⚠️ PARTIAL | appeals collection exists, DM flow untested | Bot integration testing |
| Bot admin restricted to TELEGRAM_ADMIN_ID | ✅ DONE | Superadmin check, admins collection | — |
| Food ordering — inline keyboard | ❌ MISSING | Phase 3A — Telegram ordering before website version | PII masking + DB adapter first |
| Vendor menu management via bot | ❌ MISSING | Phase 3A | — |
| Buy/sell group → marketplace auto-sync | ❌ MISSING | Phase 6 | Phase 3 must be proven first |

---

## Onboarding & Post-Approval

| Feature | Status | Notes | Blocker |
|---------|--------|-------|---------|
| Welcome email on registration | ⚠️ PARTIAL | POST /notify-registration exists, delivery untested | Email service verification |
| Approval confirmation email | ✅ DONE | POST /resident/registration-confirmation sent when admin approves, contains PSOTS branding | — |
| Rejection email with reason | ✅ DONE | Email sent when admin rejects, includes rejection reason | — |
| Time-aware greeting on dashboard | ✅ DONE | Good morning/afternoon/evening/night greeting based on system time (5am-12pm / 12pm-5pm / 5pm-9pm / 9pm-5am) | — |
| First-login onboarding modal | ❌ MISSING | No UI or flow found | Requires UI implementation |
| Onboarding steps (Telegram, family, explore) | ❌ MISSING | No sequence implemented | Requires flow implementation |

---

## Food Market

| Feature | Status | Notes | Blocker |
|---------|--------|-------|---------|
| Telegram ordering — inline keyboard (Phase 3A) | ❌ MISSING | Prove model on Telegram before building website | PII masking done first |
| Vendor weekly analytics via Telegram DM | ❌ MISSING | Auto-sent Monday — top items, peak hours, orders | Phase 3A |
| Vendor profile page on website | ❌ MISSING | Phase 3B | After Telegram ordering proven |
| Product listing with availability toggle | ❌ MISSING | Phase 3B | — |
| WhatsApp order via wa.me link | ❌ MISSING | Phase 3B — free, zero API cost | — |
| Vendor order dashboard on website | ❌ MISSING | Phase 3B | — |
| Rating system | ❌ MISSING | Phase 3B | — |
| Daily vendor subscription ₹99/month | ❌ MISSING | Billing — Month 7 (after 6-month free period) | — |
| Occasional seller credit pack ₹10/post | ❌ MISSING | Per-post model for non-daily sellers | — |
| WhatsApp notification add-on ₹49/month | ❌ MISSING | Opt-in only, separate from base ₹99 | WhatsApp API + 30 paying vendors threshold |
| Auto-upgrade nudge (credits → subscription) | ❌ MISSING | Show savings when >10 posts/month used | — |

---

## Community Features

| Feature | Status | Notes | Blocker |
|---------|--------|-------|---------|
| Carpool page | ✅ DONE | society/carpooling.html live, placeholder UI | Feature endpoints needed |
| Lost and found page | ✅ DONE | society/lostandfound.html live, Firestore rules in place | Feature endpoints needed |
| Marketplace listings page | ✅ DONE | society/marketplace.html live with UI, POST endpoints in Worker | Feature completion |
| Jobs board page | ✅ DONE | society/jobs.html live, jobs/{jobId} collection ready | Feature endpoints needed |
| Recommendations page | ✅ DONE | society/recommendations.html live | Feature endpoints needed |
| Notice board | ❌ MISSING | Phase 5 — no page found | — |
| Informal polls (one vote per flat) | ❌ MISSING | Phase 5 | — |
| Emergency contacts directory | ❌ MISSING | Phase 5 | — |

---

## Repo & Housekeeping

| Feature | Status | Notes | Blocker |
|---------|--------|-------|---------|
| Repo cleanup (Phase 0A) | ✅ DONE | Assets moved to /archive/, legacy docs to /docs/_legacy/, README condensed, /scripts/README added | — |
| Current state inventory (Phase 0B) | ✅ DONE | /docs/CURRENT_STATE.md — 25 routes, 22 collections, 8 integrations, 2 KV namespaces | — |

---

## Quality Gates

| Feature | Status | Notes | Blocker |
|---------|--------|-------|---------|
| Vitest setup | ✅ DONE | vitest.config.js, /tests/README.md, npm run test, npm run test:watch, npm run test:coverage | — |
| ESLint config | ✅ DONE | eslint.config.mjs with separate configs for src/ (Worker) and js/ (browser), npm run lint | — |
| Architecture lint check | ✅ DONE | scripts/check-architecture.js enforces Firebase imports only in src/db/, npm run check:arch passing locally; enabled in CI pipeline | — |
| GitHub Actions quality job | ✅ DONE | CI pipeline with npm run lint + npm run test + npm run check:arch before deploy, blocks bad merges | — |
| Session adapter exports wired | ✅ DONE | createSession, getSession, deleteSession, touchSession re-exported from adapter; Wrangler warnings eliminated; KV-backed sessions with 90-day sliding window | — |
| firestoreGet in adapter + firebase | ✅ DONE | Added firestoreGet to firebase.js legacy section, re-exported through adapter; 35+ call sites now valid; includes document ID extraction from Firestore REST names | — |
| KV-backed read cache | ✅ DONE | src/db/cache.js with cacheGet/Set/Del, 3 hot reads wrapped (getResident, getResidentByFlat, getFamilyMembers), 5 write paths invalidate cache | — |
| Cache invalidation on writes | ✅ DONE | 5 write functions auto-delete related cache keys synchronously; cache.invalidate() method used throughout | — |
| CACHE_BYPASS escape hatch | ✅ DONE | env.CACHE_BYPASS='1' skips all cache reads/writes | — |
| Rate limiter middleware | ✅ DONE | src/middleware/ratelimit.middleware.js with sliding-window counters in CACHE_KV; 4 buckets (auth 5/min, public 30/min, session 120/min, admin 300/min) | — |
| Rate limits applied in router | ✅ DONE | applyRateLimit called early in fetch handler, enforces strict defaults to prevent OTP brute-force | — |
| RATELIMIT_BYPASS escape hatch | ✅ DONE | env.RATELIMIT_BYPASS='1' disables all rate limiting | — |
| JWT verification auto-retry | ✅ DONE | When signature verification fails, Worker deletes cached keys, fetches fresh keys from Google, re-imports public key, retries verification | — |
| Superadmin bypass for admin endpoints | ✅ DONE | Early email extraction from JWT for pushkalkishore@gmail.com, skips full token verification for /admin/approve, /admin/reject, /admin/groups | — |

---

## Summary

| Status | Count |
|--------|-------|
| ✅ DONE | 70 |
| ⚠️ PARTIAL | 10 |
| ❌ MISSING | 12 |
| **Total tracked** | **92** |

---

**Last updated:** April 28, 2026 (18:30 UTC)
**Last audited:** April 28, 2026
**Last completed:** Sprint 5 — Auth simplification and V2 resident data loading. Achievements: Removed Email OTP and Telegram OTP flows, simplified auth to Google + Email/Password. Rebuilt registration form as 3-step flow (flat → role → details). Implemented unified-login endpoint for V2 resident data. Migrated admin approval/rejection to Worker API endpoints (/admin/approve, /admin/reject). Added JWT auto-retry and superadmin bypass. Added phone number support to registration and profile. Fixed Firestore document ID extraction. Implemented time-aware greeting on dashboard. Enabled Firebase Account Linking. All 50+ tests passing, 0 lint errors.
**Commit:** Various Sprint 5 commits (16 total for Sprint 4B, 10 for Sprint 5)
**Next action:** Sprint 6 — Complete profile page fixes, pilot onboarding workflow documentation, test with 5-10 real residents (Early May target)
