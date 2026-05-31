# PSOTS Society — Project State Index

**Last Updated:** 2026-05-31  
**Current Branch:** `claude/relaxed-heisenberg-WFFXw`  
**Working Directory:** `/home/user/PSOTS-Society`

---

## 🎯 Project Goal

Migrate PSOTS Society frontend from Firebase Firestore client-side reads/writes to a secure **Worker + D1 + cookie-native auth** architecture. Seven pages currently read Firestore; we're migrating them in phases.

**Auth Model:** Direct Google OAuth via Worker (PKCE flow) → HttpOnly session cookie on `.psots.in` → D1 lookups. No Firebase for authenticated users.

---

## ✅ Completed Phases

### Phase 0: OAuth Foundation + Auth Infrastructure
**Status:** ✅ MERGED (PR #9)  
**Branch:** `claude/google-oauth-clean` → merged to `main` (commit 6e61bdb)  
**Changes:**
- Worker: Direct Google OAuth (`/auth/google/start`, `/auth/google/callback`)
- Worker: `/auth/me` endpoint with `isAdmin` flag
- Worker: `resolveAuth(request, env)` helper — accepts cookie OR Firebase Bearer token
- Auth modules: `hybrid-auth.js` and `auth.js` both updated to cookie-first pattern
- Frontend: `login.html` uses Google OAuth button
- Frontend: `register.html` shows document check failures clearly
- CORS: Credentialed preflight for `/auth/*` and `/society/*` paths

**Key Files Modified:**
- `src/index.js` — OAuth routes, resolveAuth helper, /auth/me endpoint
- `js/core/hybrid-auth.js` — cookie-first setupHybridAuth()
- `js/core/auth.js` — cookie-first _bootCookieSession()
- `js/components/shared/SocietyNav.js` — cookie-first boot
- `society/login.html` — Google OAuth button
- `society/register.html` — doc check feedback

**Deployment:**
- ✅ `npx wrangler deploy` completed
- ✅ Worker secrets set: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`
- ✅ Google Console: Redirect URI `https://login.society.psots.in/auth/google/callback`
- ✅ DNS: `login.society.psots.in` CNAME → `society.psots.in`

### Phase 1: Dashboard Migration (Announcements + Marketplace)
**Status:** ✅ MERGED (PR #9, same PR)  
**Changes:**
- Worker: Added `GET /society/announcements` — lists from D1
- Worker: Added `GET /society/marketplace` — lists from D1 with filters
- Frontend: `society/index.html` — replaced Firestore `getDocs()` with `/society/announcements` fetch
- Frontend: Dashboard stats now fetch from Worker endpoints
- XSS Fix: Wrapped all user data in `escapeHTML()` before innerHTML

**Key Files Modified:**
- `src/index.js` — announcements and marketplace D1 query functions
- `society/index.html` — dashboard loader

**D1 Tables Used:**
- `announcements` (existing)
- `marketplace_listings` (existing)

---

## 🔄 In-Progress Phase

### Phase 2-3: Carpooling, Lost & Found, Recommendations Migration
**Status:** 🔄 HALF DONE — Worker endpoints ✅, frontend migrations 🔄 (branch: `claude/relaxed-heisenberg-WFFXw`)  
**Target Pages:**
1. `society/carpooling.html` — list/create/update carpooling offers
2. `society/lostandfound.html` — list/create found & lost items
3. `society/recommendations.html` — list recommendations (read-only, data from bulk imports)

**What's Done:**
- [x] Worker endpoints implemented (commits 9af272c, b3b579b):
  - GET/POST `/society/carpooling` (with type filter)
  - PUT/DELETE `/society/carpooling/:id`
  - GET/POST `/society/lost-found` (with type filter)
  - PUT/DELETE `/society/lost-found/:id`
  - GET `/society/announcements` (admin-only POST)
  - GET `/society/marketplace` (with category filter, CRUD operations)
  - GET `/society/recommendations` (with category filter)
- [x] resolveAuth() helper — cookie-first, falls back to Firebase Bearer token
- [x] DB functions added: createCarpoolingPost, updateCarpoolingPost, deleteCarpoolingPost
- [x] CORS configuration updated for /society/* (credentialed, not wildcard)

**Still Needed:**
- [ ] Update frontend pages:
  - [ ] `society/carpooling.html` — remove Firestore, use Worker endpoints
  - [ ] `society/lostandfound.html` — remove Firestore, use Worker endpoints
  - [ ] `society/recommendations.html` — remove Firestore, use Worker endpoints
  - Apply `escapeHTML()` to user data before innerHTML
  - Update forms to POST to `/society/` endpoints with credentials: 'include'

**Known Issues:**
- Announcements/marketplace endpoints added but dashboard not yet migrated to use them (Phase 1 follow-up)
- Recommendations can't store all fields in D1 yet (drive photos, ratings, etc.) — DEFERRED to Phase 4 schema update
- All /society/* endpoints exist but frontend pages haven't been updated yet

---

## 📋 Pending Phases

### Phase 4: Jobs Page + Schema Update
**Status:** ⏱️ PENDING  
**Pages:** `society/jobs.html`  
**Schema Issues:** D1 `jobs` table missing fields for drive attachments, job details  
**Work:** Add D1 migration to expand schema, then migrate page  

### Phase 5: Profile Page (My Family, My Tenants, Device Trust)
**Status:** ⏱️ PENDING  
**Pages:** `society/profile.html`  
**Complexity:** High — handles family approval flow, tenant management, device sessions  
**Work:** Add Device Trust D1 table, create all endpoints, migrate page  

### Phase 6: Admin Panel
**Status:** ⏱️ PENDING  
**Pages:** `society/admin.html`  
**Complexity:** Highest — multiple views, approval workflows, violation management  
**Work:** Multiple Worker endpoints, complex auth checks  

### Phase 7: Firebase Cleanup
**Status:** ⏱️ PENDING  
**Work:** After all 7 pages migrated, remove Firestore client-side imports, finalize auth  

---

## 🔑 Key Architecture Decisions Made

1. **Cookie-Native Auth**: Direct Google OAuth → HttpOnly `psots_session` cookie → all subsequent requests auto-authenticated
2. **Dual-Auth Bridge**: `resolveAuth()` accepts cookie OR Firebase Bearer token so mid-migration pages work
3. **No Firebase for OAuth Users**: OAuth users never touch Firebase; they get cookie session only
4. **D1 as Source of Truth**: All reads from D1, not Firestore (even for existing data)
5. **Worker as Proxy**: Frontend NEVER queries D1 directly; Worker validates auth, normalizes response
6. **Field Normalization**: D1 tables use snake_case; Worker returns camelCase via `parseD1Row()`
7. **No Backfill Needed**: All test data, fresh D1 database, no Firestore→D1 migration required

---

## 📊 D1 Tables Currently Used

| Table | Status | Fields | Notes |
|-------|--------|--------|-------|
| `residents` | ✅ | uid, email, name, flat_number, is_admin, status | Core identity |
| `sessions` | ✅ | token, uid, expires_at, ip_city | Cookie sessions |
| `announcements` | ✅ | id, title, description, created_at, created_by | Phase 1 done |
| `marketplace_listings` | ✅ | id, category, title, description, price, contact, created_by | Phase 1 done |
| `carpooling` | ❌ | TBD | Phase 2-3 pending |
| `lost_found` | ❌ | TBD | Phase 2-3 pending |
| `recommendations` | ⚠️ | category, vendor, description | Phase 2-3 pending; schema incomplete |
| `jobs` | ⚠️ | title, description, contact | Phase 4 pending; missing attachments |
| `device_sessions` | ❌ | token, uid, trusted, first_seen, last_seen | Phase 5 pending |
| `family_members` | ❌ | uid, family_uid, status, relation | Phase 5 pending |
| `tenants` | ❌ | uid, tenant_uid, status | Phase 5 pending |

---

## 🐛 Known Issues & Blockers

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| Recommendations schema incomplete | Medium | Deferred | Can't store all fields; Phase 4 migration will fix |
| Jobs schema incomplete | Medium | Deferred | Missing drive attachment fields; Phase 4 migration will fix |
| Admin panel complexity | High | Pending | 800+ lines; needs careful migration with auth checks |
| Telegram bot reader | Unknown | Pending | Bot reads Firestore directly; verify before Phase 7 cleanup |

---

## 🧪 Testing Checklist (Before Each Phase)

- [ ] Run locally: `npm start` (if applicable)
- [ ] Auth flow: Test Google OAuth login → verify cookie set
- [ ] Worker deployed: `npx wrangler deploy`
- [ ] API endpoints: Test fetch + credentials: 'include'
- [ ] XSS prevention: All user data wrapped in escapeHTML()
- [ ] Firestore rules: Still correct (no new writes)
- [ ] CORS: Preflight works for credentialed requests
- [ ] Data consistency: D1 data matches expected output
- [ ] Flat numbers: Verify all flat numbers remain plain (no Tower/Floor/Unit)

---

## 🚀 Deployment Checklist (Before Each Merge)

1. **Worker**: `npx wrangler deploy` (if src/index.js changed)
2. **Firestore**: `firebase deploy --only firestore:rules` (if firestore.rules changed)
3. **Indexes**: `firebase deploy --only firestore:indexes` (if firestore.indexes.json changed)
4. **Git**: `git add -A && git commit -m "..."` → `git pull --rebase origin main` → `git push origin claude/relaxed-heisenberg-WFFXw`
5. **PR**: Create PR against main, wait for CI, address review comments
6. **Merge**: After approval, merge to main (auto-deploy to Cloudflare Pages)

---

## 📝 Environment Variables & Secrets

**Worker Secrets (set via `npx wrangler secret put`):**
- ✅ `GOOGLE_OAUTH_CLIENT_ID` — set in Phase 0
- ✅ `GOOGLE_OAUTH_CLIENT_SECRET` — set in Phase 0
- `FIREBASE_SA_EMAIL` — Firebase service account
- `FIREBASE_SA_KEY` — Firebase service account private key (if still needed)
- `RESEND_API_KEY` — Email API
- `GEMINI_API_KEY` — LLM for moderation
- `BOT_TOKEN` — Telegram bot token
- `ADMIN_WHATSAPP` — Admin contact

**D1 Bindings:**
- `PSOTS_DB` — Main database (id: d9a7cf00-94a2-4204-9166-142d801a8953)

**KV Bindings:**
- `SESSIONS_KV` — OAuth cookie sessions
- `VIOLATIONS` — User violation tracking
- `AUDIT_LOG` — Admin access logs
- `CACHE_KV` — General cache
- `RATE_LIMITS_KV` — Rate limiting

---

## 🔗 Key Files by Concern

### Auth (Cookie & OAuth)
- `js/core/auth.js` — session tracking (legacy, still used by some pages)
- `js/core/hybrid-auth.js` — cookie-first auth (modern, used by dashboard, profile, jobs, admin)
- `src/index.js` — Worker OAuth routes + resolveAuth() helper
- `society/login.html` — Google OAuth button
- `society/auth/google-callback.html` — OAuth callback handler

### Database Helpers
- `src/db.js` (if exists) — D1 query helpers
- `src/index.js` — Inline D1 functions (announcements, marketplace, etc.)

### Frontend Pages
- `society/index.html` — Dashboard (Phase 1 ✅)
- `society/carpooling.html` — Carpooling (Phase 2-3 🔄)
- `society/lostandfound.html` — Lost & Found (Phase 2-3 🔄)
- `society/recommendations.html` — Recommendations (Phase 2-3 🔄)
- `society/jobs.html` — Jobs (Phase 4 ⏱️)
- `society/profile.html` — Profile (Phase 5 ⏱️)
- `society/admin.html` — Admin Panel (Phase 6 ⏱️)

### Config & Rules
- `CLAUDE.md` — Project rules & terminology
- `firestore.rules` — Firestore security (being phased out)
- `firestore.indexes.json` — Firestore indexes (being phased out)
- `wrangler.toml` — Worker config (D1, KV, routes)

---

## 📌 Quick Session Start Checklist

Before you start each session:

1. [ ] Read this file (CODEBASE_INDEX.md)
2. [ ] Check git status: `git status`
3. [ ] Check current branch: `git branch`
4. [ ] Verify branch is up to date: `git fetch origin && git log --oneline -3`
5. [ ] Review what phase you're working on (see "In-Progress" section above)
6. [ ] Run tests/build if applicable
7. [ ] Confirm which files you WILL and WILL NOT touch

---

## 📌 Quick Session End Checklist

Before you commit at the end of each session:

1. [ ] Run post-flight checks from CLAUDE.md
2. [ ] Update this file (CODEBASE_INDEX.md) with new progress
3. [ ] Commit with clear message: `git commit -m "message"`
4. [ ] Push to branch: `git push origin claude/relaxed-heisenberg-WFFXw`
5. [ ] If created PR: link it and note any blockers
6. [ ] If merged PR: update "Completed Phases" section above

---

## 🎓 Example: How to Use This File

**Scenario 1: Mid-session context switch**
- Check "In-Progress Phase" section to remember what you were doing
- Check "What Needs to be Done" checklist for next step

**Scenario 2: Next session starts**
- Read "In-Progress Phase" → "What Needs to be Done"
- Verify you're on correct branch
- Continue from where you left off

**Scenario 3: Blocked by unknown issue**
- Check "Known Issues & Blockers" section
- Check "Key Architecture Decisions" to understand *why* things are designed this way

---

**Remember:** This file is your memory. Update it as you complete work. Future sessions will read it to pick up where you left off.
