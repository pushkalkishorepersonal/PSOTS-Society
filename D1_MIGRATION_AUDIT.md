# D1 Migration Audit - Firestore Usage Analysis

**Date:** May 11, 2026  
**Status:** Analysis Complete

---

## Summary

Found **157 Firestore-related calls** in `src/index.js`. Most are already using the D1 adapter compatibility layer.

---

## Good News! ✅

**Most endpoints are already compatible!** They're using:
- `db.firestoreGet()` - from `adapter-d1.js`
- `db.firestoreSet()` - from `adapter-d1.js`  
- `firestoreQuery()` - imported from `adapter-d1.js`

These functions are **compatibility wrappers** that translate Firestore-style calls to D1 queries.

---

## Compatibility Layer Coverage

The D1 adapter provides compatibility for these collections:

### ✅ Fully Supported:
- `residents` - CRUD operations working
- `credentials` - Basic support (needs compound key handling)
- `flats` - Basic support
- `admins` - Read operations

### ⚠️ Partially Supported:
- `settings` - Read/write working
- `group_settings` - Needs implementation
- `violations` - Needs implementation  
- `device_sessions` - Needs implementation

### ❌ Not Supported Yet:
- `forwarded_analysis` - Not in D1 schema
- `invites` - Not in D1 schema
- `tenants` - Not in D1 schema
- `tenant_family_requests` - Not in D1 schema
- `admin_access_log` - Not in D1 schema
- `announcements` - In schema but no adapter functions
- `marketplace_listings` - In schema but adapter incomplete

---

## Required Actions

### 1. Extend D1 Adapter ⚠️

Need to add compatibility layer support for:

**High Priority:**
- [ ] `invites` collection
- [ ] `tenants` collection  
- [ ] `tenant_family_requests` collection
- [ ] `device_sessions` collection
- [ ] `group_settings` collection
- [ ] `violations` collection

**Medium Priority:**
- [ ] `announcements` collection
- [ ] `admin_access_log` collection
- [ ] `forwarded_analysis` collection

### 2. Check D1 Schema Completeness 📋

Verify all tables exist in `sql/psots-schema.sql`:
- [ ] invites table
- [ ] tenants table
- [ ] tenant_family_requests table
- [ ] device_sessions table
- [ ] group_settings table
- [ ] violations table
- [ ] announcements table
- [ ] admin_access_log table
- [ ] forwarded_analysis table

### 3. Fix Direct D1 Access 🔧

Some endpoints call D1 directly instead of using adapter. Need to standardize.

---

## Endpoint Categories

### Category A: Working with D1 ✅
- `/flat/check` - TESTED & WORKING
- Basic resident lookups using `db.firestoreGet('residents/...')`

### Category B: Need Adapter Extensions ⚠️
- `/auth/unified-login` - needs credentials support
- `/auth/register` - needs resident creation
- `/invite/*` - needs invites table support
- `/family/*` - needs family management
- `/tenant/*` - needs tenant management
- Admin endpoints - need various collections

### Category C: Complex (May Need Refactoring) 🔄
- Telegram bot moderation - uses violations, group_settings
- Analytics - uses forwarded_analysis
- Audit logging - uses admin_access_log

---

## Recommendations

### Option 1: Incremental Migration (Recommended)
1. Keep Firestore for unsupported collections temporarily
2. Migrate high-value endpoints first (auth, residents, flats)
3. Gradually add D1 support for other collections
4. Use feature flags to switch collections individually

### Option 2: Complete Migration (Riskier)
1. Add all missing tables to D1 schema
2. Implement full adapter compatibility
3. Migrate all data at once
4. Big-bang deployment

### Option 3: Hybrid Forever
1. Keep Firestore for low-volume collections (logs, analytics)
2. Use D1 for high-traffic collections (residents, sessions)
3. Accept two databases long-term

---

## Next Steps

**Recommended Approach:**

1. **Audit D1 Schema** - Check what tables already exist
2. **Add Missing Tables** - Create schema for invites, tenants, etc.
3. **Extend Adapter** - Add compatibility for missing collections
4. **Test Core Flows** - Login, registration, flat check
5. **Data Migration** - Export Firestore → Import D1
6. **Deploy Incrementally** - Use feature flags

---

## Estimated Effort

| Task | Complexity | Time | Priority |
|------|-----------|------|----------|
| Schema audit | Low | 30min | High |
| Add missing tables | Medium | 2hrs | High |
| Extend adapter | High | 4-6hrs | High |
| Data migration script | Medium | 2-3hrs | Medium |
| Frontend updates | Low-Med | 2-3hrs | Medium |
| Testing | High | 4-6hrs | High |
| **Total** | | **15-20hrs** | |

---

## Status: Phase 1 Complete ✅

Next: Move to Phase 2 - Extend D1 Adapter
