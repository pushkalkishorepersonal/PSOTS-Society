# D1 Migration - Quick Start

**Status:** ✅ Ready for execution  
**Last Updated:** May 11, 2026

---

## 🚀 Quick Start (5 minutes)

### Option A: Test Locally (Recommended First)

```bash
# 1. Set Firebase credentials
export FIREBASE_SERVICE_ACCOUNT=$(cat firebase-service-account.json)

# 2. Run migration
./scripts/migrate-to-d1.sh local

# 3. Start dev server  
npx wrangler dev --local-protocol https

# 4. Test endpoint
curl -k -X POST https://localhost:8788/flat/check \
  -H "Content-Type: application/json" \
  -d '{"flatNumber":"15167"}'
```

### Option B: Deploy to Production

⚠️ **Only after local testing passes!**

```bash
./scripts/migrate-to-d1.sh remote
npx wrangler deploy
```

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| **`D1_MIGRATION_GUIDE.md`** | 📖 Complete step-by-step guide |
| **`D1_MIGRATION_COMPLETE_SUMMARY.md`** | 📊 What was done + results |
| **`D1_MIGRATION_AUDIT.md`** | 🔍 Technical analysis |
| **`D1_MIGRATION_PHASE2_COMPLETE.md`** | ⚙️  Adapter changes |
| **`D1_MIGRATION_TEST_RESULTS.md`** | ✅ Test results |

---

## ✅ What's Ready

- [x] D1 schema (`sql/psots-schema.sql`)
- [x] D1 adapter with 11 collection support
- [x] Export script (`scripts/export-firestore.js`)
- [x] Import script (`scripts/import-to-d1.js`)
- [x] Automated migration (`scripts/migrate-to-d1.sh`)
- [x] Test data (`test-seed.sql`)
- [x] All documentation

---

## 🎯 What You Need to Do

### Before Production:

1. **Test locally** - Run `./scripts/migrate-to-d1.sh local`
2. **Verify endpoints** - Test login, flat check, admin functions
3. **Check data** - Ensure all records migrated correctly
4. **Have rollback plan** - Be ready to revert if needed

### For Production:

1. **Backup Firestore** - Data already exported in step 1
2. **Run migration** - `./scripts/migrate-to-d1.sh remote`
3. **Deploy Worker** - `npx wrangler deploy`
4. **Monitor** - Watch Cloudflare dashboard for errors

---

## 🆘 Quick Troubleshooting

### Issue: Script fails with "FIREBASE_SERVICE_ACCOUNT not set"

```bash
export FIREBASE_SERVICE_ACCOUNT=$(cat firebase-service-account.json)
```

### Issue: "table already exists" error

```bash
npx wrangler d1 execute psots-society-db --local --command "DROP TABLE IF EXISTS residents CASCADE"
```

### Issue: Need to rollback production

Edit `src/index.js` line 21:
```javascript
// Change to:
import { firestoreGet, firestoreSet, firestoreQuery } from './db/firestore.js';
```

Then: `npx wrangler deploy`

---

## 📊 Migration Checklist

```
Phase 1: Local Testing
[ ] Export Firestore data
[ ] Apply D1 schema locally
[ ] Import data to local D1
[ ] Start dev server
[ ] Test /flat/check endpoint
[ ] Test login flow
[ ] Test admin operations

Phase 2: Production
[ ] Backup verified
[ ] Apply D1 schema remotely
[ ] Import data to remote D1
[ ] Deploy Worker
[ ] Test production endpoints
[ ] Monitor for 24 hours
```

---

## 🎉 Success Criteria

You'll know it's working when:

✅ Worker starts without errors  
✅ `/flat/check` returns correct data  
✅ Login flow works  
✅ Dashboard loads  
✅ No "Firestore" errors in logs  
✅ Response times < 20ms (vs 200ms before)

---

## 📞 Support

If you need help:

1. Check `D1_MIGRATION_GUIDE.md` for detailed steps
2. Review error logs in Wrangler dashboard
3. Test locally first before touching production
4. Have rollback plan ready

---

**Start here:** `./scripts/migrate-to-d1.sh local` 🚀
