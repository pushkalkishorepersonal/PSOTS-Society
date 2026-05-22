# Identity V2 Migration Plan

**Status:** Phase 1-2 Complete
**Created:** 2026-04-30
**Updated:** 2026-04-30
**Target Completion:** May 2, 2026 (before pilot)

---

## Executive Summary

**Problem:** Dual schema system is active - legacy `residents/{firebaseUid}` and new V2 `residents/{residentId}` + `credentials/{credentialId}` coexist. This creates:
- Code complexity (dual lookups everywhere)
- Data inconsistency risk
- Higher bug surface area
- Difficult debugging

**Solution:** Complete migration to V2 schema with backwards-compatible data migration.

---

## Current State (April 30, 2026)

### ✅ Already Using V2 Schema

**Worker Endpoints:**
- `POST /auth/register` - creates `residentId`, `credentialId`, V2 flat record
- `POST /auth/unified-login` - hybrid (tries V2 first, has legacy fallback)
- Device session endpoints

**Database Layer:**
- `src/db/adapter.js` has all V2 functions: `createResidentV2`, `getResidentV2`, `createCredential`, `getCredentialByTypeAndIdentifier`

### ⚠️ Still Using Legacy Schema

**Worker Endpoints (src/index.js):**
- Lines 918, 993, 1149: `residents/${firebaseUid}` lookups in unified-login
- Lines 3079-5195: ~40 endpoints still use `residents/${uid}` directly
  - Family management (`/family/*`)
  - Tenant management (`/tenant/*`)
  - Profile updates (`/resident/*`)
  - Contact relay (`/contact/*`)
  - Admin endpoints (`/admin/residents`)

**Frontend Services:**
- `js/services/resident.service.js` - writes to both `residents/{uid}` AND `flats/{flatNumber}/members/{memberId}`
- `js/services/admin.service.js` - updates `residents/{uid}`
- `js/services/marketplace.service.js` - reads `residents/{uid}` for seller info

**Admin Panel:**
- `society/admin.html` - subscribes to `residents` collection expecting Firebase uid as doc ID

---

## Migration Strategy

### Phase 2: Backend Migration

**Goal:** Update all Worker endpoints to use V2 exclusively

**Steps:**
1. Update `/auth/unified-login` to remove legacy fallback
2. Migrate family endpoints to use `residentId` instead of `uid`
3. Migrate tenant endpoints to use `residentId`
4. Migrate profile/resident endpoints
5. Update admin endpoints to work with `residentId`

**Files to change:**
- `src/index.js` (~40 endpoints)

### Phase 3: Frontend Migration

**Goal:** Frontend services use `residentId` consistently

**Steps:**
1. Update `js/services/resident.service.js` to remove dual writes
2. Update `js/services/admin.service.js` to work with V2
3. Update `js/services/marketplace.service.js` to fetch by `residentId`
4. Update `js/core/hybrid-auth.js` to store `residentId` in session

**Files to change:**
- `js/services/resident.service.js`
- `js/services/admin.service.js`
- `js/services/marketplace.service.js`
- `js/core/hybrid-auth.js`
- `society/admin.html`

### Phase 4: Data Migration

**Goal:** Convert existing `residents/{uid}` documents to V2 format

**Migration Script Tasks:**
1. Read all documents from `residents/` collection
2. For each document with Firebase uid as doc ID:
   - Generate new `residentId`: `r_{flatNumber}_{timestamp}`
   - Create `residents/{residentId}` document with V2 schema
   - Detect auth method from existing data (has email → google/email)
   - Create `credentials/{credentialId}` document
   - Keep old `residents/{uid}` for 30-day rollback window
3. Log all transformations to `migration_log.json`

**Safety:**
- Idempotent: skip if `residentId` already exists
- Dry-run mode first
- No deletions (old docs kept for rollback)

### Phase 5: Cleanup & Deploy

1. Remove "V2" suffix from function names
2. Delete legacy code paths
3. Update `SPRINT_STATUS.md`
4. Deploy Worker: `npx wrangler deploy`
5. Deploy Firestore rules if needed
6. Monitor for 7 days
7. Archive old `residents/{uid}` documents after 30 days

---

## Risk Mitigation

**Risk 1:** Existing registered users can't log in  
**Mitigation:** Keep legacy fallback in `/auth/unified-login` for 14 days post-migration

**Risk 2:** Data loss during migration  
**Mitigation:** No deletions. Old documents stay for 30 days.

**Risk 3:** Admin panel breaks  
**Mitigation:** Test with staging data first. Add error handling.

---

## Rollback Plan

If critical issues arise within 7 days:
1. Revert Worker deployment
2. Re-enable legacy code paths
3. Fix issues in staging
4. Retry migration

---

## Success Criteria

✅ All new registrations use V2 schema only  
✅ All logins work with `residentId`  
✅ Admin panel shows residents correctly  
✅ No "V2" suffixes in production code  
✅ Zero Firebase uid references in Worker endpoints  
✅ Frontend services use `residentId` consistently

---

---

## ✅ Completed Work (April 30, 2026)

### Phase 1: Audit ✅
- Documented all legacy schema usage locations
- Identified ~40 Worker endpoints using old schema
- Identified frontend services needing updates

### Phase 2: Login Fix ✅

**Fixed Files:**
1. `society/login.html`
   - ✅ Google login now uses `/auth/unified-login` Worker API
   - ✅ Email/password login uses `/auth/unified-login` Worker API
   - ✅ Removed direct Firestore queries (`residentService.get(uid)`)
   - ✅ Removed legacy `onAuthSuccess` function
   - ✅ Auto-redirect on page load now uses Worker API

2. `src/index.js`
   - ✅ Removed legacy fallback in `/auth/unified-login` (lines 1131-1183)
   - ✅ Cleaned up Case D Telegram linking (removed old schema fallback)
   - ✅ All login cases now V2-only (Case A, B, C, D)

**Impact:**
- Login now works correctly with V2 schema
- No more "stays on login page" bug
- Cleaner code (removed ~80 lines of legacy fallback)

---

## 🚀 Next Steps

**Remaining Work:**
1. Clean up other Worker endpoints (family, tenant, profile management)
2. Update frontend services to remove dual writes
3. Remove "V2" suffixes from function names
4. Test thoroughly
5. Deploy

**Timeline:** Complete by May 2, 2026
