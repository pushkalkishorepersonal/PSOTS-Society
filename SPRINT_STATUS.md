# PSOTS Sprint Status

> **Single source of truth** for sprint progress. Complements the GitHub Projects board.  
> Updated at the start and end of each sprint.

**Current date:** 2026-05-11
**Current phase:** Sprint 5.5 in progress — Pilot Launch Preparation
**Next milestone:** Email testing complete, 10-15 pilot users onboarded (Mid May)

---

## Quick status

| Sprint | Status | Weekend | Commits |
|--------|--------|---------|---------|
| Pre-work | ✅ Complete | Apr 13-19 | Multiple |
| Sprint 1 | ✅ Complete | Apr 20-25 | 9 commits |
| Sprint 2 | ✅ Complete | Apr 25 | 2 commits |
| Sprint 3 | ✅ Complete | Apr 25 | 1 commit |
| Sprint 4A | ✅ Complete | Apr 25 | 1 commit |
| Sprint 4B | ✅ Complete | Apr 28 | 16 commits |
| Sprint 5 | ✅ Complete | Apr 28-May 3 | 14+ commits |
| Sprint 5.5 | 🔨 In Progress | May 3-11 | Pilot launch prep |
| Sprint 6 | 📋 Planned | June | — |
| Sprint 7-8 | 📋 Planned | Post-launch | — |

**Legend:**  
📋 Planned · 🎨 Designing · 🔨 In Progress · 🧪 Review · ✅ Complete · ❌ Deferred

---

## Pre-work — Infrastructure & Cleanup (Completed)

### What was built
- PII masking at route layer (Option C — admins see full names, contact masked)
- KV-backed sessions with sliding window
- Cache layer with invalidation
- Sliding-window rate limiting
- Adapter pattern for all DB access
- Profile URL standardization
- CI green with 51/51 tests, 0 lint errors
- Family UI disabled with "Coming Soon" messaging (during refactor)
- Tenant UI disabled with "Coming Soon" messaging (during refactor)
- Profile demo polish (layout, placeholders, Coming Soon banners)
- Landing page images restored and switched to relative paths

### Design artifacts created
- `docs/IDENTITY_MODEL.md` — canonical design spec, 23 sections
- `README.md` — reviewer-facing platform overview
- `docs/DECISIONS.md` — running log of architectural decisions
- `docs/FEATURE_STATUS.md` — per-feature current state

### Key commits (reverse chronological)
- `ef5ce10` — Switched psots.in images to relative paths
- `06ec2bc` — Restored landing page images
- `73d4552` — Profile demo polish
- `d50dd07` — Disabled tenant UI (Coming Soon)
- `c861786` — Disabled family UI (Coming Soon)
- `9ca50a3` — Added IDENTITY_MODEL design spec
- `5ca7f4a` — Profile URL standardization
- `4ba8bc8` — Adapter export fixes
- `37b28ec` — PII masking wired at routes

---

## Sprint 1 — Identity Foundation (Planned)

**Goal:** Build the residents + credentials + flats schema. Device trust schema. Adapter functions. Migration script skeleton.

**Scope:**
- New Firestore collections: `residents/`, `credentials/`, `flats/`, `device_sessions/`
- Adapter functions: createResident, getResidentByCredentialLookup, createCredential, linkCredentialToResident, etc.
- Migration script: `scripts/migrate-identity.js` (not yet run)
- Backward compatibility: old adapters still work during transition

**Prompt file:** `docs/prompts/PROMPT_sprint_1.md` (to be created)  
**Design reference:** `docs/IDENTITY_MODEL.md` Sections 2, 3, 7  
**Expected tokens:** 30-35k  
**Estimated time:** 1 weekend (2 focused sessions)

**Verification checklist:**
- [ ] All new collections accessible via adapter
- [ ] Migration script dry-runs without errors
- [ ] All 51 existing tests still pass
- [ ] Lint: 0 errors
- [ ] Wrangler: 0 warnings
- [ ] Manual smoke test: register a test resident via new schema works

**GitHub Issue:** #TBD  
**Status:** 📋 Planned  
**Started:** —  
**Completed:** —

---

## Sprint 2 — Unified Login Endpoints (Planned)

**Goal:** Build the 3 unified auth endpoints handling all login methods consistently.

**Scope:**
- `POST /auth/unified-login` — handles Cases A, B, C (existing / link new method / new user)
- `POST /auth/register` — completes registration for Case C with flat + role + name
- `POST /auth/resume-device` — trusted device auto-login
- KV session changes: 90-day sliding window, residentId-based
- Cross-subdomain cookie: scoped to `.psots.in`
- Old `/auth/*` endpoints still work (backward compat)

**Design reference:** `docs/IDENTITY_MODEL.md` Sections 4, 5, 9  
**Expected tokens:** 25-30k  
**Estimated time:** 1 weekend

**Status:** 📋 Planned

---

## Sprint 3 — PSOTS Frontend (Planned)

**Goal:** Rebuild PSOTS Society UI with identity-aware components.

**Scope:**
- Login screen: 3-button design (Google / Email / Phone via Telegram)
- Registration screen: flat number + role selector
- Shared navbar component (applied across all pages)
- 3-zone dashboard (Your Stuff / Features / Coming Soon)
- Family member management UI rebuilt on new schema (replaces Coming Soon)
- Tenant invite UI rebuilt on new schema (replaces Coming Soon)

**Design reference:** `docs/IDENTITY_MODEL.md` Sections 5, 10, 11  
**Expected tokens:** 30-35k  
**Estimated time:** 1 weekend

**Status:** 📋 Planned

---

## Sprint 4 — Profile + Chhath Puja Integration (Planned)

**Goal:** Polished profile page with 5 tabs. Migrate Chhath Puja to unified auth.

**Scope:**
- Profile 5-tab layout: Overview / Family / Devices / Privacy / Account
- Device management UI (live in Devices tab)
- Admin notices system
- Migrate chhath.psots.in auth from Apps Script to unified Worker
- Migrate Chhath email from Apps Script Gmail to Resend
- Consolidate Chhath Firebase into PSOTS Firebase with `chhath_` prefix

**Design reference:** `docs/IDENTITY_MODEL.md` Sections 10, 12, 13, 21  
**Expected tokens:** 30-35k  
**Estimated time:** 1 weekend

**Status:** 📋 Planned

---

## Sprint 5 — Auth Simplification & V2 Resident Loading (Complete)

**Goal:** Simplify auth to Google + Email/Password. Fix V2 resident data loading. Prepare for pilot.

**Achievements (Apr 28-May 3):**
- Registration page rebuilt (society/register.html) with 3-step flat → role → details flow
- Google OAuth + Email/Password auth implemented (Telegram removed to backup branch)
- Hybrid auth system (js/core/hybrid-auth.js) simplified — Firebase only
- Admin approval via Worker API (/admin/approve, /admin/reject) — both endpoints support V2 residentId
- Firestore document ID fix in firestoreQuery — _id field now included for all query results
- JWT superadmin bypass for admin endpoints (/admin/groups, /admin/approve, /admin/reject)
- Recursive Firestore serialization fix — handles nested stringValue/mapValue/arrayValue correctly
- V2 resident data loading via /auth/unified-login endpoint — both frontend pages and SocietyNav now fetch proper resident data
- Time-aware personalized greeting in dashboard (morning/afternoon/evening/night)
- Password reset email with PSOTS branding
- Account linking enabled in Firebase Console (prevents duplicate accounts with same email)
- Phone number support added (optional field in registration, displayed in profile)
- Profile modal centering fixed with proper CSS and dark overlay
- Phone editing via new POST /resident/update-profile endpoint
- "Add phone" link functional and opens modal with auto-focus
- **Mobile hamburger menu** — bottom sheet navigation with organized sections (May 3)
- **Internal tabs fix** — Mod Config and other sub-tabs now visible on mobile (May 3)
- **Security headers added** — CSP, X-Frame-Options, XSS Protection, etc. (May 3)
- **Pre-launch security audit** — comprehensive review completed (May 3)

**Key commits:**
- cb0d079 — feat: Add phone number support and fix profile hero visibility
- 77a0cf9 — fix: Center profile modal and add phone number editing
- 4ac526b — docs: update sprint status and decisions for April 28 sprint
- 868cfe0 — Add mobile hamburger menu with bottom sheet navigation
- d27dac6 — Fix hamburger menu visibility - position above bottom nav
- f98c88e — Fix mobile menu event handling - pass event object to switchTabFromMobile
- 1dbb7b2 — Fix internal tabs visibility - only hide main navigation, keep sub-tabs visible
- (pending) — Add comprehensive security headers and pre-launch audit

**Status:** ✅ Complete
**Started:** 2026-04-25
**Completed:** 2026-05-03

---

## Sprint 5.5 — Pilot Launch Preparation (In Progress)

**Goal:** Test email delivery, fix pending approval issues, document complete status, prepare for 10-15 pilot users.

**Scope:**
- Email delivery verification in Resend dashboard (all 5 flows)
- Fix pending approval status issue (documented in FIX_PENDING_STATUS.md)
- Create comprehensive PROJECT_STATUS_CHECKLIST.md
- Test registration → approval workflow end-to-end
- Prepare pilot user onboarding materials
- Monitor infrastructure usage on free tiers

**Current Status (May 11, 2026):**
- ✅ PROJECT_STATUS_CHECKLIST.md created - comprehensive 86/101 feature tracking
- ✅ SPRINT_STATUS.md updated to reflect current phase
- ✅ All 346 tests passing, 0 lint errors
- ✅ Document verification working with Gemini + Workers AI fallback
- ✅ Single-page registration form added (register-simple.html)
- ✅ Cleanup tools added for test data management
- ⚠️ Email delivery testing - PENDING (CRITICAL)
- ⚠️ Pending approval issue - documented workaround exists

**Key Commits:**
- 27aa61a — Add Cloudflare Workers AI fallback for document OCR
- 9a49b26 — Replace multi-step register with single-page version
- 195ee57 — Fix document verification - always accept for manual review
- 2923ffd — Add data inspection tool (check-data.html)
- 95d46f6 — Add cleanup endpoint and tool to delete test data
- 5d76dc2 — Don't create Firebase account until AFTER document upload

**Blockers Identified:**
1. Email delivery untested - requires Resend dashboard verification (30 min task)
2. Pending approval status issue - workaround exists, needs permanent fix (15 min task)

**Status:** 🔨 In Progress
**Started:** 2026-05-03
**Target Completion:** 2026-05-11 (Today!)

**Success Criteria:**
- [ ] All 5 email flows tested and verified in Resend dashboard
- [ ] Pending approval issue resolved
- [ ] End-to-end registration → approval flow tested
- [ ] Infrastructure usage monitored (staying in free tiers)
- [ ] Pilot onboarding materials ready
- [ ] 10-15 pilot users invited

---

## Sprint 6 — Full Launch (Planned)

**Goal:** PSOTS Society goes live for all 2,100 flats. Chhath Puja ready for Oct 2026.

**Scope:**
- Announcement to PSOTS community
- Onboarding support for new residents
- Monitor scaling (stay within free tier)
- Chhath Puja feature flag ready to enable in Oct

**Status:** 📋 Planned  
**Target:** June 2026

---

## Sprint 7-8 — Vendor Ordering System (Planned)

**Goal:** Telegram-based ordering system with vendor portal.

**Scope (Sprint 7):**
- Vendor portal for profile + menu management
- Telegram bot `/order` command flow
- Order schema + routing
- Email notifications (Resend)

**Scope (Sprint 8):**
- Vendor onboarding (5-10 vendors)
- ₹99/month subscription tracking
- Vendor feedback and polish

**Design reference:** `docs/IDENTITY_MODEL.md` Section 22  
**Status:** 📋 Planned  
**Target:** 2-3 months post-PSOTS launch

---

## Parallel tracks (non-coding work by Pushkal)

These run alongside sprints but are not tracked as sprint deliverables:

- 🟡 **PSOTS Society Act registration** — needs 7 founding members, ~₹10-15K, 3-4 weeks
- 🟡 **Chhath Puja Samiti registration** — similar process, independent entity
- 🟡 **Developer onboarding** — adding collaborator to private repo
- 🟡 **RWA/community feedback** — presenting to Ex-President and RWA members
- 📋 **CA consultation** — recommended before scaling Chhath contributions
- 📋 **Sponsorship outreach** — after samiti registration complete

Legend: 📋 Not started · 🟡 In progress · ✅ Complete

---

## Design decisions locked in

See `docs/IDENTITY_MODEL.md` Section 18 for the full list. Key ones:

- Identity model: residents + credentials + flats, opaque IDs never equal uid
- Multi-flat ownership: one resident record per (person, flat)
- Admin = `isAdmin: true` flag on resident (no separate collection)
- Login UX: 3 separate buttons (Google / Email / Telegram-phone)
- Session: 90-day sliding window, `.psots.in` scoped cookie
- Telegram: phone sharing preferred, userID fallback (user chooses)
- Chhath integration: Sprint 4, not before
- Firestore: single project, prefixed collections (`residents/`, `chhath_contributions/`, etc.)
- Multi-samiti governance: each festival has independent organizer team and payment
- Vendor ordering: Sprint 7-8, Telegram-first, direct UPI payments

---

## How to update this file

**At start of sprint:**
- Change status to 🎨 Designing (if designing) or 🔨 In Progress (if ready to code)
- Fill in `Started: YYYY-MM-DD`

**At end of sprint:**
- Change status to ✅ Complete
- Fill in `Completed: YYYY-MM-DD`
- Add key commit hashes
- Note any scope changes or deferrals

**Between sprints:**
- Update parallel tracks as they progress
- Move any items that slipped to next sprint
- Add new items discovered during the sprint to upcoming sprints

---

**Last updated:** 2026-05-11
