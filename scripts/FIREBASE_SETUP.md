# Firebase Service Account Setup

To export data from Firestore, you need a Firebase service account JSON file.

## Step 1: Get Service Account JSON

1. Go to https://console.firebase.google.com/
2. Select project: **psots-society-25899**
3. Click ⚙️ (Settings) → Project settings
4. Go to **Service accounts** tab
5. Click **Generate new private key**
6. Save the JSON file as `firebase-service-account.json`

## Step 2: Set Environment Variable

### Option A: Export to shell (temporary, expires when you close terminal)

```bash
export FIREBASE_SERVICE_ACCOUNT=$(cat firebase-service-account.json)
```

### Option B: Create .env file (recommended)

Create a file named `.env` in the project root:

```bash
# .env
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"psots-society-25899",...}'
```

Then load it before running scripts:

```bash
source .env
npm run migrate:export
```

### Option C: Add to shell profile (permanent)

Add to `~/.zshrc` or `~/.bashrc`:

```bash
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
```

Then reload:

```bash
source ~/.zshrc
```

## Step 3: Verify Setup

```bash
node -e "console.log(process.env.FIREBASE_SERVICE_ACCOUNT ? '✅ Set' : '❌ Not set')"
```

Expected output: `✅ Set`

## Step 4: Run Export

```bash
npm run migrate:export
```

Expected output:
```
🚀 Starting Firestore Export

📦 Exporting residents...
   ✅ Exported 150 records to residents.json

📦 Exporting credentials...
   ✅ Exported 150 records to credentials.json

... (all collections)

✅ Export complete! Files saved to: data/firestore-export
```

---

## Security Notes

- ⚠️ **Never commit `firebase-service-account.json` to git**
- ⚠️ **Never share the service account JSON publicly**
- ✅ The `.gitignore` already excludes this file
- ✅ Delete the file after migration is complete

---

## Troubleshooting

### Error: "FIREBASE_SERVICE_ACCOUNT environment variable not set"

**Fix:** Follow Step 2 above

### Error: "Permission denied"

**Fix:** Make sure the service account has "Firebase Admin" role:
1. Go to https://console.cloud.google.com/iam-admin/iam?project=psots-society-25899
2. Find the service account email
3. Click Edit → Add role → Firebase Admin
4. Save

### Error: "Cannot find module 'firebase-admin'"

**Fix:** Install dependencies:
```bash
npm install
```
