# PSOTS Society — Decision Log

All significant product and technical decisions recorded here with date and reason.
Claude Code reads this to avoid re-suggesting already-decided things.

---

## Architectural Decisions

### Quality Gates Before Refactoring — April 18, 2026

Decision: Vitest (unit tests) + ESLint (code standards) + architecture lint check (Firebase isolation) + GitHub Actions CI quality job are installed BEFORE any code refactoring begins.

Reason: Refactoring without tests/lint guarantees regressions. Quality gates catch them in CI instead of production. Single developer → automated safeguards are critical.

Implementation: 
- vitest.config.js + /tests/unit/smoke.test.js (5 baseline tests)
- eslint.config.mjs with separate configs for src/ (Worker) and js/ (browser)
- scripts/check-architecture.js enforces Firebase imports only in src/db/
- .github/workflows/deploy.yml updated: quality job runs before deploy, blocks merge on failures
- npm test, npm run lint, npm run check:arch all pass locally and in CI
- Architecture check passes immediately (all Firebase imports already isolated)

---

### Repo Hygiene Policy — April 18, 2026

Decision: Non-code assets live in `/archive/` (gitignored). Legacy documentation in `/docs/_legacy/`. Only `CLAUDE.md` and `README.md` at root.

Reason: Clean repository surface improves navigation, reduces cognitive load for future maintainers, makes root navigable in 10 seconds.

Implementation: Moved 28 images, 8 PDFs, .vsix file to `/archive/`. Moved 13 legacy markdown docs to `/docs/_legacy/`. Updated `.gitignore` and `README.md`.

---

### DB Adapter Pattern — April 2026
Decision: All DB operations go through src/db/adapter.js only. No direct Firebase imports elsewhere.
Reason: Enables migration by changing one file instead of 30+.
Rule: firebase.js = implementation. adapter.js = what application imports.
Migration path: create supabase.js with same signatures, change one import in adapter.js.
Firebase Auth exception: never migrated. Free, stable, trusted.

### DB Migration Trigger — April 2026
Decision: Do not migrate from Firebase now.
Reason: Free tier covers PSOTS scale 12-18 months. Migration = 3-6 months work.
Trigger: Firebase bill exceeds Rs 1500/month OR food orders exceed 500/day.
Hybrid option at Phase 3: add Supabase free tier for orders/billing only. Keep Firebase for identity.

### KV Cache Design — April 18, 2026
Decision: Cache only 3 read functions (getResident, getResidentByFlat, getFamilyMembers). Not vendor/menu (don't exist yet). Not generic firestoreQuery helpers (unbounded cache keys).
Reason: 3 functions cover ~90% of hot-path Firestore reads. Projected 60-70% reduction at 4k users peak. Vendor caching added in Phase 3A when vendor data is live.
TTLs: resident 5min, resident-by-flat 5min, family 2min. Writes invalidate synchronously; TTL is safety net for missed invalidations.
Escape hatch: env.CACHE_BYPASS='1' for debugging.

### Rate Limit Defaults — April 18, 2026
Decision: Strict defaults. auth 5/min per IP, public 30/min per IP, session 120/min per session uid, admin 300/min per admin uid.
Reason: Zero real users. Strict is safe baseline. Loosen later on real usage data. Prevents OTP brute-force and admin abuse before they happen.
Escape hatch: env.RATELIMIT_BYPASS='1' if dev locks themselves out.
Skip: /webhook/telegram — shared-secret auth, separate rate limit concern.

### PII Masking Applied at Response Boundary — April 18, 2026
Decision: PII masking is applied at the response boundary in route handlers, not inside the adapter or service layer.
Reason: Masking is a presentation concern (who is allowed to SEE this data), not a data concern (what's in the database). Masking inside adapter/services would make it impossible to build admin tools that legitimately need raw data (e.g., a future Cloudflare Workflow that emails residents — it needs actual email addresses).
Rule: Whenever a route returns resident, family, tenant, or vendor data, it MUST call one of: `sanitizeForAdmin()`, `sanitizeForResident()`, `sanitizeForPublic()`, or a field-level mask (`maskEmail()`/`maskPhone()`/`maskName()`). Smoke tests in `tests/smoke/pii-leak.smoke.test.js` enforce this.
Implementation: Masking functions in `src/db/pii.js`. Applied at 4 key routes:
- GET /admin/residents — sanitizeForAdmin on response list
- GET /family/list — sanitizeForResident per member (caller-aware)
- GET /invite/validate — maskName on inviterName (public endpoint)

### Disable Family UI During Identity Refactor — April 19, 2026
Decision: Hide invite/approve/reject family UI behind "Coming Soon" messaging rather than leaving broken buttons visible.
Reason: `/invite/create` endpoint currently returns 500. Family flow being rebuilt in Sprint 3 (identity refactor). Better UX to show intentional "Coming Soon" than unintentional "server_error".
Scope: profile.html button + loadFamilyMembers() early-return + pending approvals section hidden. No backend changes.
Restore: When Sprint 3 rebuilds family UI with new identity model, revert this commit or replace disabled calls in profile.html.

### Disable Tenant UI During Identity Refactor — April 19, 2026
Decision: Hide tenant invite/add/approve UI behind "Coming Soon" messaging.
Reason: `/tenant/add` and `/decide` endpoints returning 403. Tenant flow being rebuilt in Sprint 3 alongside family and owner registration using unified `/auth/register` endpoint. Same pattern as family UI disable (commit c861786).
Scope: profile.html "Add Tenant" button + loadMyTenants() and loadPendingApprovals() early-returns. No backend changes. No admin.html changes needed (tenant mgmt filtered by API response).
Restore: Sprint 3 rebuilds tenant flow with unified registration endpoint.

### Profile Demo Polish — April 19, 2026
Decision: Pre-demo UI cleanup on profile.html to hide unfinished states (device management, data access history) and remove leftover loading text.
Reason: Preparing for RWA/reviewer demo. Platform in mid-refactor but should not look incomplete or broken to stakeholders.
Scope: profile.html only
- Remove "Loading tenants…" placeholder text (leftover after tenant UI disable)
- Replace "My Devices" section with Coming Soon banner + hide devicesList
- Replace "Data Access History" section with Coming Soon banner + hide accessLogContainer
- Add early-return to loadDevicesList() to prevent console noise
No backend changes.
Restore: Device management ships in Sprint 1. Data access history when feature completes.

### PII Masking Refinement — Option C — April 18, 2026

Decision: Admin panel shows FULL resident names (refined from masked "First L." format). Email and phone remain masked.

Reason: Admin verification workflow depends on matching registrants against a 500-person WhatsApp community. Masked first-name-only format made this impractical — admin couldn't distinguish between two "Rajesh K." entries or verify strangers. Names in a residential society aren't really private anyway (doorplates, directory, delivery names, WhatsApp).

Scope: ONLY admin view (`sanitizeForAdmin`). All other views unchanged:
- Resident-to-resident (`sanitizeForResident` for non-matching UID): still mask names ("Pushkal K.")
- Public listings (`sanitizeForPublic`): still mask names
- Self view: unchanged, full data

Email and phone remain masked in all three views. Those are the high-value PII.

Implementation: 1 line changed in src/db/pii.js, updated tests, added regression test for resident-to-resident masking.

### Infrastructure Stack — April 2026
Decision: Cloudflare only. No Vercel, Railway, or Render.
Reason: Single platform, single billing, single dashboard.

---

## Product Decisions

### No RWA Territory — April 2026
Decision: Never build features requiring RWA admin, guard, or management approval.
Reason: Individual contributor project. RWA involvement = political dependency.
Permanent out of scope: Maintenance tracker, visitor gate pass, facility booking, official notices, society voting, parking.

### Residents Never Pay — April 2026
Decision: Residents never charged for any feature, ever.
Reason: Community utility not a product. Trust is the product in Year 1.

### Vendor Pricing — April 2026
Decision: Three tiers:
- Daily vendors: Rs 99/month (menu + orders + analytics + broadcast)
- Occasional sellers: Rs 10/post credits (Rs 50 for 5, Rs 90 for 10), never expire
- WhatsApp add-on: Rs 49/month opt-in only — trigger: 30+ paying vendors AND 1000+ active users
Auto-upgrade nudge: if >10 credits used in a month show monthly plan savings.

### Founder Funding — April 2026
Decision: Fund infra personally 6 months minimum, up to 12 months.
Reason: 6 months free builds trust money cannot buy.
Vendor grace period: Month 7 onwards subscriptions start.
Self-sustaining target: Month 11-12.

### Revenue Principle — April 2026
Decision: Charge only actual infra cost. No profit. No markup. Surplus to community events.
Pricing formula: Total monthly cost divided by active daily vendors, rounded to nearest Rs 10.

### WhatsApp Migration Trigger — April 2026
Decision: No WhatsApp API until 30+ paying vendors AND 1000+ active users simultaneously.
Current approach: Free wa.me links for Phase 3. Zero API cost.

### Telegram-First for Food Ordering — April 2026
Decision: Build Telegram ordering (Phase 3A) before website version (Phase 3B).
Reason: Foodies group has 1224 members, 38 posts/day, 5 years active. Audience is already there.

### Family as Sub-Documents — April 2026
Decision: Family members are sub-documents under flat. Not separate Firebase accounts.
Reason: One login per flat. Simpler auth. Cleaner structure.

### No SMS OTP — April 2026
Decision: SMS-based phone OTP will not be used.
Reason: Rs 0.85-1 per OTP. Email OTP = Rs 0. Telegram OTP covers non-email residents.

### PII Masking — April 2026
Decision: Admins never see full resident PII. Only resident sees their own full data.
Rules: Email = p***@gmail.com. Phone = +91 94XXX X8904. Name = Pushkal K.
File: src/db/pii.js
CRITICAL: Do not onboard real residents until PII masking is live.

### Doc Housekeeping — April 18, 2026

Decision: Archived CURRENT_STATE.md and IMPLEMENTATION_PHASES.md to /docs/_legacy/. Deleted _refactor_targets.md. Replaced PROMPTS.md with tailored 11-prompt sequence (done manually on main before this prompt). Footers on FEATURE_STATUS.md and ROADMAP.md corrected to reflect post-lint + workflow-removal state.

Reason: Stale docs were pointing Haiku at obsolete instructions. Cleanup keeps the five live docs (ARCHITECTURE, DECISIONS, FEATURE_STATUS, ROADMAP, PROMPTS) as the single source of truth.

### Adapter Export Audit — April 18, 2026

Decision: Every `db.X(...)` call site in src/index.js must have a corresponding export in src/db/adapter.js. Verification happens at Wrangler build time (emits "Import will always be undefined" warnings if missing).

Reason: Prompts 4.5 and 5 added backend functions (firestoreGet, createSession et al.) but forgot to re-export through the adapter. These silently failed in production — no error thrown, just undefined returned. Wrangler caught this during deploy; lint and tests did not.

Rule: Any future prompt adding a function to src/db/firebase.js or src/db/sessions.js MUST also add the re-export to src/db/adapter.js in the same commit. Wrangler dry-run must show zero "will always be undefined" warnings before merge.

### Canonical WORKER_URL Constant in Frontend — April 18, 2026

Decision: Each frontend HTML file in society/ declares `const WORKER_URL = 'https://telegram.psots.in';` once at the top of the main script block. All fetch() calls use `${WORKER_URL}/path` via template literals.

Reason: A broken `${workerUrl}` reference in profile.html was silently breaking family list loading. Upstream cause: inconsistency between WORKER_BASE/workerUrl/hardcoded URLs scattered across the file. Single canonical constant prevents regressions and makes future subdomain migration a one-line change per file.

Rule: Any new frontend file must use WORKER_URL pattern, not hardcoded strings, not a different constant name. When migration triggers (telegram.psots.in → api.psots.in), only the const declaration changes; all fetch() calls remain intact.

Implementation: profile.html standardized — 1 canonical `const WORKER_URL`, 23 template literal `${WORKER_URL}` references, 0 hardcoded strings or undefined variables.

### Auth Simplification — April 28, 2026

Decision: Remove Email OTP and Telegram OTP flows. Simplify to Google OAuth + Email/Password only.

Reason: Three auth methods created auth decision paralysis (which method should UI prompt?). OTP flows required additional infrastructure (Telegram bot for OTP delivery, email templates). During Sprint 5, Firebase Auth with password reset proved simpler and more reliable. OTP branches kept for future reference but removed from main user path.

Implementation:
- Removed all OTP UI flows from login.html and register.html
- Removed Email OTP and Telegram OTP backend endpoints (preserved in backup/telegram-email-otp branch)
- js/core/hybrid-auth.js simplified from 162 lines to 75 lines (Firebase Auth only)
- Register form rebuilt as 3-step flow: flat selection → role selection → personal details
- Password reset via Firebase sendPasswordReset() with PSOTS-branded email
- All OTP functions, templates, and bot interactions moved to backup branch for future exploration

Backup branch: backup/telegram-email-otp — contains full OTP implementations if needed later.

### Firebase Account Linking — April 28, 2026

Decision: Enable Firebase Account Linking in Firebase Console to prevent duplicate accounts with same email.

Reason: When resident tries to sign in with email after previously signing in with Google (same email), Firebase throws auth/account-exists-with-different-credential error. Account linking prevents this conflict by allowing one resident to have multiple sign-in methods linked to the same account.

Implementation:
- Firebase Console: Authentication → Sign-in method → Email/Password + Google OAuth → Enable account linking
- login.html: detect auth/account-exists-with-different-credential error and prompt resident to use original sign-in method
- Error message: "This email is registered with Google. Please use Continue with Google to sign in."

### Admin Approval via Worker API — April 28, 2026

Decision: Migrate admin approval/rejection from direct Firestore writes to Worker API endpoints (/admin/approve, /admin/reject).

Reason: Worker endpoints allow centralized validation, email notification logic, and future audit trail without duplicating logic in frontend. Endpoints support both old (Firebase uid) and new (residentId) schema formats. Enables superadmin bypass (pushkalkishore@gmail.com) for testing during development.

Implementation:
- POST /admin/approve: accepts residentId, updates status to APPROVED, sends confirmation email to resident
- POST /admin/reject: accepts residentId + reasonCategory + reasonNote, updates status to REJECTED, sends rejection email
- Both endpoints: JWT verification with auto-retry on key rotation, early email extraction for superadmin bypass
- society/admin.html: approveResident() and rejectResident() call Worker endpoints instead of updateDoc()
- Supports both resident._id (old schema) and resident.residentId (new schema) in API calls

### V2 Resident Data Loading — April 28, 2026

Decision: Implement unified-login endpoint to fetch resident data supporting both old (Firebase uid) and new (residentId) schema formats.

Reason: During Sprint 5, residents were registered with new residentId format (r_flatNumber_timestamp) while some legacy residents still had uid-based records. Single unified-login endpoint handles both cases, making UI code version-agnostic.

Implementation:
- POST /auth/unified-login: accepts type (google|email) + identifier, returns resident data with all fields populated
- Hybrid auth: js/core/hybrid-auth.js calls unified-login after Firebase auth succeeds
- Frontend pages (index.html, profile.html, admin.html): fetch resident data via unified-login instead of manual Firestore queries
- SocietyNav component: uses resident.name from unified-login for proper greeting (not Firebase displayName)
- Returns: residentId, name, flatNumber, residentType, status, email, phone

---

## Open Questions — need decision before Phase 3

1. Should family members have full platform access (food, carpool) or limited? Affects Firestore rules.
2. Should tenants see other tenants in the building?
3. Onboarding modal timing: first login or first time opening each feature?
4. Vendor billing: manual UPI link now, automate Year 2?
5. Email bounce: retry logic or rely on Resend monitoring?
