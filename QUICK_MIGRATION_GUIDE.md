# 🚀 Quick Migration Command Reference

**Copy-paste these commands in order. No modifications needed.**

---

## Prerequisites (One-time setup)

```bash
cd ~/Documents/Playground/PSOTS

# Get Firebase service account JSON from Firebase Console
# Save as firebase-service-account.json in project root

# Set environment variable
export FIREBASE_SERVICE_ACCOUNT=$(cat firebase-service-account.json)
```

---

## Step 1: Create & Configure D1 Database

```bash
# Create database
npx wrangler d1 create psots-society-db
```

**Output will show:**
```
database_id = "xxxxx-xxxx-xxxx-xxxx-xxxxx"
```

**Action:** Copy the ID and update `wrangler.toml` line 52

---

## Step 2: Deploy Schema

```bash
# Deploy schema to D1
npx wrangler d1 execute psots-society-db --file=sql/psots-schema.sql --remote
```

**Expected:** `✅ Executed 50+ commands in X.Xs`

---

## Step 3: Export from Firestore

```bash
# Export all collections to JSON
npm run migrate:export
```

**Expected:** Creates `data/firestore-export/` with 20 JSON files

---

## Step 4: Import to D1

```bash
# Dry run first (verify SQL)
npm run migrate:import:dry

# Actual import
npm run migrate:import
```

**Expected:** `✅ Imported X records` for each collection

---

## Step 5: Verify Data

```bash
# Check record counts
npx wrangler d1 execute psots-society-db --command="
  SELECT 
    (SELECT COUNT(*) FROM residents) as residents,
    (SELECT COUNT(*) FROM credentials) as credentials,
    (SELECT COUNT(*) FROM flats) as flats,
    (SELECT COUNT(*) FROM admins) as admins
" --remote
```

**Expected:** Counts should match Firestore

---

## Step 6: Test Locally

```bash
# Start local dev server
npx wrangler dev
```

**Test:** http://localhost:8787/api/chhath/stats (should return data)

---

## Step 7: Deploy to Production

```bash
# Deploy Worker
npx wrangler deploy

# Monitor logs
npx wrangler tail
```

---

## Troubleshooting Commands

```bash
# Check if Firebase env var is set
echo $FIREBASE_SERVICE_ACCOUNT | head -c 50

# List all D1 databases
npx wrangler d1 list

# Check tables in D1
npx wrangler d1 execute psots-society-db --command="SELECT name FROM sqlite_master WHERE type='table'" --remote

# View export summary
cat data/firestore-export/_summary.json | head -20

# Clear all D1 data (for re-import)
npx wrangler d1 execute psots-society-db --command="DELETE FROM residents; DELETE FROM credentials; DELETE FROM flats;" --remote
```

---

## If Something Goes Wrong

```bash
# Rollback Worker deployment
git log --oneline | head -5  # Find last good commit
git revert HEAD
npx wrangler deploy

# Re-import data
npm run migrate:export  # Fresh export
npm run migrate:import  # Fresh import
```

---

## Progress Checklist

- [ ] Firebase service account JSON downloaded
- [ ] Environment variable set
- [ ] D1 database created
- [ ] `wrangler.toml` updated with database ID
- [ ] Schema deployed
- [ ] Firestore data exported
- [ ] Data imported to D1
- [ ] Record counts verified
- [ ] Local testing complete
- [ ] Deployed to production
- [ ] Production testing complete

---

**Current Status:** Schema created ✅ | Export/Import scripts ready ✅ | Next: Create D1 database

**Estimated Time:** 2-3 hours total (mostly waiting for imports)

**Support:** See `scripts/MIGRATION_README.md` for detailed documentation
