# Data Migration Scripts

Scripts to migrate PSOTS Society from Firebase Firestore to Cloudflare D1.

---

## Quick Start

```bash
# 1. Setup Firebase credentials
# See FIREBASE_SETUP.md for detailed instructions
export FIREBASE_SERVICE_ACCOUNT=$(cat firebase-service-account.json)

# 2. Create D1 database
npx wrangler d1 create psots-society-db
# Copy the database_id to wrangler.toml

# 3. Deploy schema
npx wrangler d1 execute psots-society-db --file=sql/psots-schema.sql --remote

# 4. Export Firestore data
npm run migrate:export

# 5. Import to D1 (dry run first to verify)
npm run migrate:import:dry

# 6. Import to D1 (actual)
npm run migrate:import
```

---

## Scripts

### `export-firestore.js`

Exports all Firestore collections to JSON files.

**Usage:**
```bash
node scripts/export-firestore.js
# or
npm run migrate:export
```

**Output:**
- Creates `data/firestore-export/` directory
- One JSON file per collection
- `_summary.json` with export metadata

**Collections exported:**
- residents (150 records)
- credentials (150 records)
- flats (2100 records)
- admins (5 records)
- marketplace_listings (50 records)
- lost_found (30 records)
- carpooling (20 records)
- recommendations (40 records)
- announcements (25 records)
- device_sessions (200 records)
- invites (10 records)
- feedback (15 records)
- jobs (10 records)
- ... (20 collections total)

---

### `import-to-d1.js`

Imports JSON exports to Cloudflare D1 database.

**Usage:**
```bash
# Dry run (show SQL without executing)
node scripts/import-to-d1.js --dry-run

# Import all collections
node scripts/import-to-d1.js

# Import specific collection only
node scripts/import-to-d1.js --collection=residents

# Custom batch size
node scripts/import-to-d1.js --batch-size=50
```

**Options:**
- `--dry-run` - Show SQL without executing
- `--collection=X` - Import only specific collection
- `--batch-size=N` - Batch size for inserts (default: 100)

**Requirements:**
- Firestore export must be completed first
- D1 database must exist
- Schema must be deployed

---

## Data Transformation

The scripts handle these transformations:

### Timestamps
```javascript
// Firestore
{ createdAt: Timestamp(1715443200) }

// D1
{ created_at: '2026-05-11T14:30:00Z' }
```

### Boolean Values
```javascript
// Firestore
{ isAdmin: true }

// D1
{ is_admin: 1 }
```

### JSON Fields
```javascript
// Firestore (nested object)
{ privacySettings: { allowContact: true, showFlat: true } }

// D1 (JSON string)
{ privacy_settings: '{"allowContact":true,"showFlat":true}' }
```

### Field Name Mapping
```javascript
// Firestore (camelCase)
residentId, flatNumber, createdAt

// D1 (snake_case)
resident_id, flat_number, created_at
```

---

## Verification

After import, verify record counts match:

```bash
# Get Firestore counts (from export summary)
cat data/firestore-export/_summary.json

# Get D1 counts
npx wrangler d1 execute psots-society-db --command="
  SELECT 'residents' as table_name, COUNT(*) as count FROM residents
  UNION ALL
  SELECT 'credentials', COUNT(*) FROM credentials
  UNION ALL
  SELECT 'flats', COUNT(*) FROM flats
  UNION ALL
  SELECT 'admins', COUNT(*) FROM admins
" --remote
```

---

## Rollback

If something goes wrong:

```bash
# Clear all data from D1
npx wrangler d1 execute psots-society-db --command="
  DELETE FROM residents;
  DELETE FROM credentials;
  DELETE FROM flats;
  -- ... (all tables)
" --remote

# Re-deploy schema
npx wrangler d1 execute psots-society-db --file=sql/psots-schema.sql --remote

# Re-import
npm run migrate:import
```

---

## Troubleshooting

### "FIREBASE_SERVICE_ACCOUNT not set"
See `FIREBASE_SETUP.md`

### "Collection X has no mapper defined"
Edit `import-to-d1.js` and add mapper for that collection

### "UNIQUE constraint failed"
Run dry-run first to check for duplicate IDs:
```bash
npm run migrate:import:dry
```

### "No such table: X"
Deploy schema first:
```bash
npx wrangler d1 execute psots-society-db --file=sql/psots-schema.sql --remote
```

---

## Files Created

```
data/
└── firestore-export/
    ├── residents.json
    ├── credentials.json
    ├── flats.json
    ├── admins.json
    ├── marketplace_listings.json
    ├── lost_found.json
    ├── carpooling.json
    ├── recommendations.json
    ├── announcements.json
    ├── device_sessions.json
    ├── invites.json
    ├── feedback.json
    ├── jobs.json
    └── _summary.json
```

---

*Last updated: May 11, 2026*
