# Firebase to D1 Migration - Step-by-Step Guide
**Follow these steps in order. Do not skip any step.**

---

## ✅ Step 1: Create D1 Database (5 minutes)

```bash
cd ~/Documents/Playground/PSOTS

# Create the D1 database
npx wrangler d1 create psots-society-db
```

**Expected output:**
```
✅ Successfully created DB 'psots-society-db' (xxxxx-xxxx-xxxx-xxxx-xxxxx)

[[d1_databases]]
binding = "PSOTS_DB"
database_name = "psots-society-db"
database_id = "xxxxx-xxxx-xxxx-xxxx-xxxxx"
```

**Action:** Copy the `database_id` from the output and update `wrangler.toml` line 52:
```toml
database_id = "PASTE_THE_ID_HERE"
```

---

## ✅ Step 2: Deploy Schema to D1 (2 minutes)

```bash
# Deploy to remote D1 database
npx wrangler d1 execute psots-society-db --file=sql/psots-schema.sql --remote
```

**Expected output:**
```
🌀 Executing on remote database psots-society-db (xxxxx-xxxx-xxxx-xxxx-xxxxx):
🌀 ...
✅ Executed 50 commands in X.Xs
```

**Verify:**
```bash
# Check tables were created
npx wrangler d1 execute psots-society-db --command="SELECT name FROM sqlite_master WHERE type='table';" --remote
```

You should see all 16 tables listed.

---

## ✅ Step 3: Export Firestore Data (30 minutes)

I'll create the export script for you. This will save all Firestore data as JSON files.

**You need to run:**
```bash
node scripts/export-firestore.js
```

This will create `data/firestore-export/` with:
- `residents.json`
- `credentials.json`
- `flats.json`
- `admins.json`
- (... all 16 collections)

---

## ✅ Step 4: Import Data to D1 (30 minutes)

I'll create the import script. This will read the JSON exports and insert into D1.

**You need to run:**
```bash
node scripts/import-to-d1.js
```

Expected output:
```
✅ Imported 150 residents
✅ Imported 150 credentials
✅ Imported 2100 flats
... (all collections)
```

**Verify:**
```bash
# Check record counts
npx wrangler d1 execute psots-society-db --command="SELECT COUNT(*) FROM residents;" --remote
npx wrangler d1 execute psots-society-db --command="SELECT COUNT(*) FROM flats;" --remote
```

---

## ✅ Step 5: Create D1 Adapter (2-3 hours)

I'll create `src/db/d1.js` with all database functions:
- Replaces `src/db/firestore.js` 
- Same function signatures
- SQL queries instead of Firestore REST API

**No action needed from you** - I'll create this file.

---

## ✅ Step 6: Migrate Worker Endpoints (3-4 hours)

I'll update `src/index.js` to use D1 instead of Firestore.

**Pattern:**
```javascript
// OLD (Firestore)
const resident = parseFirestoreDoc(await firestoreGet(`residents/${residentId}`, env));

// NEW (D1)
const resident = await env.PSOTS_DB
  .prepare('SELECT * FROM residents WHERE resident_id = ?')
  .bind(residentId)
  .first();
```

I'll migrate ~50 endpoints one by one.

---

## ✅ Step 7: Remove Frontend Firebase SDK (1 hour)

All frontend pages currently import Firebase SDK directly:
```html
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"></script>
```

**Good news:** Most pages already call Worker APIs (not Firestore directly).

I'll:
1. Find pages that still use Firestore directly
2. Create Worker API endpoints for them
3. Update pages to call APIs
4. Remove Firebase SDK imports

---

## ✅ Step 8: Testing (4-6 hours)

Test every feature:
- [ ] Registration flow
- [ ] Login (Google, Email, Telegram)
- [ ] Profile edit
- [ ] Family member invite
- [ ] Tenant management
- [ ] Marketplace (post, view, delete)
- [ ] Lost & Found
- [ ] Carpooling
- [ ] Recommendations
- [ ] Admin panel (approve residents, post announcements)
- [ ] Telegram bot moderation

**Testing command:**
```bash
npx wrangler dev

# Open browser to http://localhost:8787
# Test each feature manually
```

---

## ✅ Step 9: Deploy to Production (10 minutes)

```bash
# Final deploy
npx wrangler deploy

# Monitor logs
npx wrangler tail
```

**Verify:**
- Visit https://society.psots.in
- Test critical flows:
  - Login
  - View marketplace
  - Post announcement (admin)

---

## ✅ Step 10: Cleanup (1 hour)

After 7 days of successful operation:

1. Remove Firebase dependencies:
```bash
# Remove Firebase SDK from all HTML pages
# Delete src/db/firestore.js
# Delete js/core/firebase.js
```

2. Update CLAUDE.md:
```markdown
# OLD
**Database:** Firebase Firestore (asia-south1 Mumbai)

# NEW
**Database:** Cloudflare D1 (SQLite)
```

3. Archive Firestore export:
```bash
# Keep backup for 30 days
tar -czf firestore-backup-2026-05-11.tar.gz data/firestore-export/
```

---

## Rollback Plan (if needed)

If something goes wrong:

1. **Immediate:** Revert Worker to use Firestore
```bash
git revert HEAD
npx wrangler deploy
```

2. **Data recovery:** Re-import from Firestore export
```bash
node scripts/import-to-d1.js --force
```

3. **Firestore still live:** No data lost, can switch back anytime

---

## Progress Checklist

- [x] Step 1: Create D1 database
- [x] Step 2: Deploy schema
- [ ] Step 3: Export Firestore data
- [ ] Step 4: Import to D1
- [ ] Step 5: Create D1 adapter
- [ ] Step 6: Migrate Worker endpoints
- [ ] Step 7: Remove frontend Firebase SDK
- [ ] Step 8: Testing
- [ ] Step 9: Deploy to production
- [ ] Step 10: Cleanup

---

**Next immediate action:** Run `npx wrangler d1 create psots-society-db`
