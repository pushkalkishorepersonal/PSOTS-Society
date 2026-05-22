# Firebase to Cloudflare D1 Migration Plan
**Date:** May 11, 2026  
**Status:** Planning Phase  
**Estimated Effort:** 3-5 days full migration

---

## Migration Overview

### Current Architecture
- **Database:** Firebase Firestore (asia-south1 Mumbai)
- **Auth:** Firebase Auth (Google, Email OTP, Telegram OTP)
- **Backend Access:** 
  - Frontend: Firebase Client SDK (CDN)
  - Worker: Firestore REST API with service account

### Target Architecture
- **Database:** Cloudflare D1 (SQLite)
- **Auth:** Keep Firebase Auth (only used for authentication, not data)
- **Backend Access:**
  - Frontend: Worker API endpoints (no direct DB access)
  - Worker: D1 SQL queries

### Why Migrate?
1. **Cost:** D1 is free up to 5GB, Firestore charges per read/write
2. **Speed:** D1 is colocated with Workers (no Mumbai → global latency)
3. **Simplicity:** SQL is simpler than Firestore REST API
4. **Consistency:** Chhath module already uses D1 successfully

---

## Firestore Collections Inventory

### Core Collections (20 total)
| Collection | Records | Purpose | Migration Priority |
|------------|---------|---------|-------------------|
| `residents` | ~150 | Resident profiles | **P0 - Critical** |
| `flats` | ~2100 | Flat ownership | **P0 - Critical** |
| `credentials` | ~150 | Login credentials (v2 schema) | **P0 - Critical** |
| `identities` | ~150 | Multi-login mapping (legacy) | **P1 - High** |
| `admins` | ~5 | Admin permissions | **P0 - Critical** |
| `marketplace_listings` | ~50 | Buy/Sell posts | **P1 - High** |
| `lost_found` | ~30 | Lost & Found posts | **P1 - High** |
| `carpooling` | ~20 | Carpooling offers | **P1 - High** |
| `recommendations` | ~40 | Vendor recommendations | **P1 - High** |
| `announcements` | ~25 | Community announcements | **P1 - High** |
| `jobs` | ~10 | Job postings | **P2 - Medium** |
| `feedback` | ~15 | User feedback | **P2 - Medium** |
| `settings` | ~3 | Platform settings | **P0 - Critical** |
| `group_settings` | ~2 | Telegram bot config | **P2 - Medium** |
| `violations` | ~50 | Moderation violations | **P2 - Medium** |
| `invites` | ~10 | Family invite tokens | **P1 - High** |
| `invite_audit` | ~50 | Invite audit log | **P2 - Medium** |
| `device_sessions` | ~200 | Device trust sessions | **P1 - High** |
| `tenants` | ~5 | Tenant records | **P1 - High** |
| `tenant_family_requests` | ~2 | Tenant family approvals | **P1 - High** |

### Chhath Collections (Already in D1)
- `chhath_contributions`, `chhath_volunteers`, `chhath_subscriptions`, `chhath_announcements`
- **Action:** Keep in D1, no migration needed

---

## D1 Schema Design

### Table Naming Convention
- Use `snake_case` for table names (SQL standard)
- Map Firestore collection names directly: `residents` → `residents`
- Preserve field names where possible for easy mapping

### Primary Keys Strategy
- Use TEXT primary keys matching Firestore document IDs
- Example: `residentId TEXT PRIMARY KEY` (was Firestore doc ID)
- Enables zero-friction data sync during migration

### Timestamps Strategy
- Use ISO 8601 strings (TEXT): `2026-05-11T14:30:00Z`
- Matches Firestore timestamp format
- Enables easy date comparisons: `WHERE createdAt > '2026-01-01'`

### JSON Columns
- Use JSON type for nested objects (permissions, privacy settings)
- Example: `privacySettings TEXT CHECK(json_valid(privacySettings))`
- Query with JSON functions: `json_extract(privacySettings, '$.allowContact')`

---

## Migration Phases

### Phase 1: Schema Creation (Day 1)
- [x] Create `sql/psots-schema.sql` with all tables
- [ ] Test schema locally with `wrangler d1 execute`
- [ ] Deploy to production D1 database

### Phase 2: Data Export (Day 1-2)
- [ ] Create `scripts/export-firestore-to-json.js`
- [ ] Export all P0/P1 collections to JSON files
- [ ] Validate data integrity (counts, required fields)

### Phase 3: Data Import (Day 2)
- [ ] Create `scripts/import-json-to-d1.js`
- [ ] Import to local D1 first (test)
- [ ] Import to production D1
- [ ] Verify record counts match Firestore

### Phase 4: Worker API Migration (Day 2-3)
- [ ] Create `src/db/d1.js` adapter (SQL query builder)
- [ ] Migrate all Worker endpoints from Firestore to D1
- [ ] Keep Firestore adapter as fallback during testing

### Phase 5: Frontend Migration (Day 3-4)
- [ ] All frontend calls already go through Worker APIs
- [ ] No frontend changes needed (architecture benefit!)
- [ ] Test all features with D1 backend

### Phase 6: Testing & Rollout (Day 4-5)
- [ ] Full regression testing of all features
- [ ] Deploy to production
- [ ] Monitor for 24 hours
- [ ] Mark Firestore as read-only backup

### Phase 7: Cleanup (Day 5+)
- [ ] Remove Firebase SDK from frontend (CDN imports)
- [ ] Remove `src/db/firestore.js` adapter
- [ ] Update CLAUDE.md documentation
- [ ] Archive Firestore export as backup

---

## Risk Mitigation

### Data Loss Prevention
- **Backup:** Export all Firestore data before migration
- **Dual-write:** Optionally write to both Firestore + D1 during testing
- **Rollback:** Keep Firestore live for 30 days post-migration

### Feature Downtime
- **Staging test:** Migrate to staging first
- **Feature flags:** Use env vars to toggle D1 vs Firestore
- **Incremental:** Migrate one collection at a time

### Query Performance
- **Indexes:** Create indexes for common queries
- **Pagination:** Limit queries to 100 records max
- **Caching:** Use KV for frequently read data (settings)

---

## Next Steps

1. **Review this plan** with team/stakeholder
2. **Create D1 schema** (`sql/psots-schema.sql`)
3. **Build export script** (`scripts/export-firestore-to-json.js`)
4. **Test locally** with sample data
5. **Deploy incrementally** starting with non-critical collections

---

*Last updated: May 11, 2026*
