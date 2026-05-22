# 🚀 Quick Setup - Firebase Service Account

Your `firebase-service-account.json` is on Desktop. Let's set it up in 3 simple commands.

---

## ✅ **Option 1: Automated Setup (Easiest)**

Just run this one command:

```bash
cd ~/Documents/Playground/PSOTS
bash scripts/setup-firebase-env.sh
```

This will:
1. ✅ Find the file on Desktop
2. ✅ Copy it to project root
3. ✅ Set environment variable
4. ✅ Add to your shell profile (so it persists)

---

## ✅ **Option 2: Manual Setup (3 commands)**

If the automated script doesn't work, do this manually:

```bash
# 1. Go to project directory
cd ~/Documents/Playground/PSOTS

# 2. Copy file from Desktop
cp ~/Desktop/firebase-service-account.json .

# 3. Set environment variable for current terminal
export FIREBASE_SERVICE_ACCOUNT=$(cat firebase-service-account.json)

# 4. Verify it's set
echo $FIREBASE_SERVICE_ACCOUNT | head -c 50
```

Expected output: `{"type":"service_account","project_id":"psots-so...`

---

## 🔄 **Make it Permanent (For Future Terminals)**

Add this to your `~/.zshrc` or `~/.bashrc`:

```bash
# Open your shell config
nano ~/.zshrc

# Add this line at the end:
export FIREBASE_SERVICE_ACCOUNT=$(cat ~/Documents/Playground/PSOTS/firebase-service-account.json 2>/dev/null || echo '')

# Save (Ctrl+O, Enter, Ctrl+X)

# Reload
source ~/.zshrc
```

---

## ✅ **Verify Setup**

```bash
# Check if environment variable is set
node -e "console.log(process.env.FIREBASE_SERVICE_ACCOUNT ? '✅ Set correctly' : '❌ Not set')"
```

Expected output: `✅ Set correctly`

---

## 🎯 **Next Steps**

Once environment variable is set, proceed with database setup:

```bash
# Step 1: Create D1 database
npx wrangler d1 create psots-society-db

# Copy the database_id from output and update wrangler.toml line 52

# Step 2: Deploy schema
npx wrangler d1 execute psots-society-db --file=sql/psots-schema.sql --remote

# Step 3: Export data from Firestore
npm run migrate:export

# Step 4: Import data to D1
npm run migrate:import
```

---

## ❓ **Troubleshooting**

### "Permission denied"
```bash
chmod +x scripts/setup-firebase-env.sh
bash scripts/setup-firebase-env.sh
```

### "File not found on Desktop"
Check if the file is really on Desktop:
```bash
ls -la ~/Desktop/firebase-service-account.json
```

If it's elsewhere, update the path:
```bash
cp /path/to/firebase-service-account.json ~/Documents/Playground/PSOTS/
```

### "Environment variable not persisting"
It only lasts for current terminal session. To make permanent, add to `~/.zshrc` as shown above.

---

## 🔒 **Security Note**

⚠️ **The `firebase-service-account.json` file contains secrets!**

- ✅ It's already in `.gitignore` (won't be committed)
- ✅ Never share this file publicly
- ✅ Delete it after migration is complete (optional)

---

**Choose Option 1 or Option 2 above and let me know if you need help!** 🚀
