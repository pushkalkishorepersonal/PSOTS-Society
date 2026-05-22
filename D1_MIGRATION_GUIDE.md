# Complete D1 Migration Guide

**Date:** May 11, 2026  
**Status:** Ready for Execution

---

## Overview

This guide walks you through the complete migration from Firebase Firestore to Cloudflare D1 for the PSOTS Society platform.

**Estimated Time:** 2-4 hours (including testing)

---

## Prerequisites

Before starting, ensure you have:

- [x] ✅ Firestore service account JSON (`firebase-service-account.json`)
- [x] ✅ Wrangler CLI installed (`npx wrangler --version`)
- [x] ✅ Node.js 18+ installed
- [x] ✅ D1 adapter extended (Phase 2 complete)
- [ ] Cloudflare account with D1 access
- [ ] Backup of production Firestore data

---

## Migration Steps

### Phase 1: Local Testing (REQUIRED)

Test the entire migration on your local machine first:

#### 1. Export Firestore Data

```bash
# Set Firebase credentials (choose one method)

# Method A: Using JSON file
cp path/to/firebase-service-account.json ./firebase-service-account.json

# Method B: Using environment variable
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'

# Export all collections
node scripts/export-firestore.js
```

**Output:** JSON files in `data/firestore-export/`

**Verify:** Check `data/firestore-export/_summary.json` for record counts

---

#### 2. Apply D1 Schema Locally

```bash
# Apply schema to local D1
npx wrangler d1 execute psots-society-db --local --file=sql/psots-schema.sql
```

**Output:** Should say "57 commands executed successfully"

---

#### 3. Import Data to Local D1

```bash
# Import all data
node scripts/import-to-d1.js --local

# OR import specific collection
node scripts/import-to-d1.js --local --collection=residents

# Dry run (no actual writes)
node scripts/import-to-d1.js --local --dry-run
```

**Output:** Progress bar showing records imported per collection

---

#### 4. Verify Local Data

```bash
# Check resident count
npx wrangler d1 execute psots-society-db --local --command "SELECT COUNT(*) FROM residents"

# Check a specific resident
npx wrangler d1 execute psots-society-db --local --command "SELECT * FROM residents WHERE email = 'pushkal@gmail.com'"

# Check credentials
npx wrangler d1 execute psots-society-db --local --command "SELECT COUNT(*) FROM credentials"
```

---

#### 5. Test Worker Locally

```bash
# Start dev server
npx wrangler dev --local-protocol https

# In another terminal, test endpoints
curl -k -X POST https://localhost:8788/flat/check \
  -H "Content-Type: application/json" \
  -d '{"flatNumber":"15167"}'

# Expected: {"exists": true, "status": "occupied", "ownerFirstName": "..."}
```

**Test These Critical Flows:**
- [ ] Flat check endpoint
- [ ] Login flow (send OTP, verify OTP)
- [ ] Resident lookup
- [ ] Credential verification

---

### Phase 2: Remote/Production Migration

⚠️ **ONLY proceed if local testing is 100% successful**

#### 1. Backup Firestore

```bash
# Export production data (already done in Phase 1)
# Keep the JSON files safe!
```

---

#### 2. Apply Schema to Remote D1

```bash
# Apply to production D1
npx wrangler d1 execute psots-society-db --remote --file=sql/psots-schema.sql
```

---

#### 3. Import Data to Remote D1

```bash
# Import all data to production
node scripts/import-to-d1.js --remote

# This will take several minutes
# Monitor for errors
```

---

#### 4. Verify Remote Data

```bash
# Check record counts
npx wrangler d1 execute psots-society-db --remote --command "SELECT COUNT(*) FROM residents"

# Compare with Firestore export summary
cat data/firestore-export/_summary.json | grep residents
```

**Important:** Counts should match!

---

#### 5. Deploy Worker

```bash
# Deploy the Worker with D1 adapter
npx wrangler deploy

# Monitor deploy logs for errors
```

---

#### 6. Production Testing

```bash
# Test live endpoints
curl https://society.psots.in/flat/check \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"flatNumber":"15167"}'
```

**Critical Tests:**
- [ ] Flat check
- [ ] Login (full flow)
- [ ] Dashboard loads
- [ ] Admin panel works

---

## Automated Migration

For convenience, use the all-in-one script:

```bash
# Local migration (testing)
./scripts/migrate-to-d1.sh local

# Production migration
./scripts/migrate-to-d1.sh remote
```

---

## Rollback Plan

If something goes wrong:

### Option 1: Quick Rollback (Firestore)

```bash
# Revert src/index.js to use Firestore
# Change line 20-21:
# FROM: import { firestoreGet, firestoreSet, firestoreQuery } from './db/adapter-d1.js';
# TO:   import { firestoreGet, firestoreSet, firestoreQuery } from './db/firestore.js';

# Redeploy
npx wrangler deploy
```

### Option 2: Keep Both Databases

Add a feature flag to switch between Firestore and D1:

```javascript
const USE_D1 = env.USE_D1 || false;
const db = USE_D1 ? './db/adapter-d1.js' : './db/firestore.js';
```

---

## Troubleshooting

### Issue: Export fails with "Permission denied"

**Solution:** Check Firebase service account has Firestore read permissions

### Issue: Import fails with "table already exists"

**Solution:** Drop tables first:
```bash
npx wrangler d1 execute psots-society-db --local --command "DROP TABLE IF EXISTS residents CASCADE"
```

### Issue: Foreign key constraint errors

**Solution:** Import order matters. The script handles this automatically, but if manual:
1. residents
2. credentials  
3. flats
4. (others)

### Issue: Local D1 data not persisting

**Solution:** Wrangler stores local D1 in `.wrangler/state/`. Don't delete this folder!

---

## Next Steps After Migration

1. **Monitor Performance** - Check Worker metrics in Cloudflare dashboard
2. **Test All Features** - Go through every page/feature
3. **Update Frontend** - (Phase 4) Remove Firebase SDK from HTML files
4. **Remove Firestore** - After 30 days of stable D1, consider removing Firestore dependency

---

## Migration Checklist

- [ ] Phase 1: Local export complete
- [ ] Phase 1: Local schema applied
- [ ] Phase 1: Local import complete
- [ ] Phase 1: Local testing passed
- [ ] Phase 2: Remote schema applied
- [ ] Phase 2: Remote import complete
- [ ] Phase 2: Record counts verified
- [ ] Phase 2: Worker deployed
- [ ] Phase 2: Production testing passed
- [ ] Phase 3: Frontend updated (optional)
- [ ] Rollback plan tested

---

**Ready to migrate? Start with Phase 1 (Local Testing)!**
