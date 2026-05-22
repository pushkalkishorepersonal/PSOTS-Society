# PSOTS Society — Gemini CLI Rules
# Read this file at the start of EVERY session

---

## Project Overview
- **Platform:** PSOTS Society — society.psots.in
- **Purpose:** Resident portal for Prestige Song of the South, Bangalore (2100+ flats, 14 towers)
- **Repo:** ~/Documents/Playground/PSOTS (private)
- **Superadmin:** pushkalkishore@gmail.com / Telegram: @pushkalkishore

---

## Architecture
```
psots.in                    → Public homepage
society.psots.in/society/   → Resident portal (login required)
society.psots.in/society/admin → Admin panel (RBAC)
telegram.psots.in           → Cloudflare Worker API
@psots_telegram_bot         → Telegram bot
```

## Tech Stack
- **Frontend:** Vanilla JS ES modules, no framework, no bundler
- **Database:** Firebase Firestore (psots-society-25899, asia-south1)
- **Auth:** Firebase Auth — Google + Email OTP + Telegram OTP
- **Hosting:** Cloudflare Pages (auto-deploy from main branch)
- **Worker:** Cloudflare Workers (src/index.js) → telegram.psots.in
- **AI:** Gemini 1.5 Flash (message moderation)
- **Email:** Resend API

---

## When to Use Gemini vs Claude Code

### Use Gemini CLI for:
- Simple bug fixes (single file, CSS, text changes)
- README and documentation updates
- Small UI tweaks
- Renaming/rebranding across files
- Adding footer links, small HTML changes
- Quick grep/search tasks

### Use Claude Code CLI for:
- Complex multi-file features
- New pages from scratch
- Architecture decisions
- Debugging tricky issues
- Worker endpoint development
- Tasks requiring deep codebase understanding

---

## Deployment Commands
```bash
# Worker (run after ANY src/index.js change)
npx wrangler deploy

# Firestore rules
firebase deploy --only firestore:rules --project psots-society-25899

# Firestore indexes
firebase deploy --only firestore:indexes --project psots-society-25899

# Git (always in this order)
git add -A && git commit -m "message" && git pull --rebase origin main && git push origin main
```

---

## CRITICAL RULES — Never violate these

### File Size Limits
- `src/index.js` is 1400+ lines — NEVER read in full, grep only with line ranges
- `society/admin.html` is 800+ lines — grep for specific sections only
- Use `sed -n 'START,ENDp'` for reading specific line ranges

### Flat Number Rules
- Flat numbers always plain: `15167` not `Tower 15, Floor 16, Unit 7`
- Never add Tower/Floor/Unit breakdown in UI, emails, or logs
- Never split flat numbers into components

### Bot Rules
- Bot can NEVER ban users — ban is always admin decision
- Gemini AI always defaults to PASS on API error
- Do NOT add bot to Buy/Sell group until public launch

### Code Rules
- Never modify `residentService.create()` or `resolveIdentity()`
- Firebase version pinned to `10.12.0` across all CDN imports
- All Worker endpoints need `Authorization: Bearer {idToken}` header
- Always `firebase deploy` before `git push` when rules change
- Always `npx wrangler deploy` before `git push` when src/index.js changes

---

## Pre-Flight Check (run BEFORE every task)
1. State which files you WILL touch
2. State which files you will NOT touch
3. Confirm flat numbers will stay plain
4. Confirm src/index.js will be grepped only

## Post-Flight Check (run AFTER every task)
1. No dead code left behind
2. No console.log() or debug statements
3. No duplicate functions
4. No commented-out old code
5. All new variables actually used
6. Commit message is descriptive
7. npx wrangler deploy run if src/index.js changed
8. firebase deploy run if firestore.rules changed

---

## Anti-Clutter Rules
- Remove old code you replaced — never comment it out
- Remove debug statements before committing
- Remove unused CSS classes and imports
- Never leave TODO comments in production code
- One function does one thing — never combine unrelated logic

---

## Language & Terminology
Always use these terms:
- "Flat number" not "unit" or "apartment"
- "Resident" not "user" or "member"
- "Admin" not "administrator"
- "PSOTS Society" not "MySociety"
- "Approve/Reject" not "Accept/Decline"
- All UI text in English only
- Error messages: friendly, no technical jargon
- Button labels: action verbs (Save, Submit, Approve, Cancel)

---

## Programming Languages Supported

### JavaScript (Primary)
- ES modules only — no CommonJS require()
- Async/await for all async operations
- No jQuery, no React, no bundler
- Firebase SDK v10.12.0 from CDN
- Vanilla DOM manipulation only

### Python (Utility Scripts)
Use ONLY for: bulk imports, data migration, CSV processing, reports
Location: /scripts/ folder
Run: `python3 scripts/filename.py`
Libraries: firebase-admin, pandas, requests
Never use Python for frontend or Worker code

### Bash/Shell (Automation)
Use for: deployment scripts, bulk operations
Always add `set -e` at top (exit on error)
Keep scripts simple — one task per script

### JSON (Config)
- firestore.rules — Firestore security rules
- firestore.indexes.json — Firestore indexes
- wrangler.toml — Cloudflare Worker config

---

## Design Tokens
```css
--jade: #1a4a3a          /* Primary green */
--jade-light: #2d6b57    /* Hover */
--gold: #b8882a          /* Accent */
--cream: #faf6f0         /* Background */
--cream-dark: #f0e8db    /* Footer */
--ink: #1a1208           /* Text */
--muted: #8a7a6a         /* Secondary text */
--border: rgba(160,130,90,0.22)
```
Font: Nunito Sans (body), Playfair Display (headings)

---

## Known Firestore Collections
```
residents, flats, admins, announcements,
marketplace_listings, lost_found, carpooling,
feedback, group_settings, violations,
moderation_logs, recommendations, events,
blogs, settings
```

---

## Admin Contact (from Firestore settings/contact)
```
adminName:      Pushkal Kishore
adminWhatsapp:  919482088904
adminTelegram:  pushkalkishore
adminEmail:     pushkalkishore@gmail.com
```

---

## Rate Limits to Know
- Email OTP: 10 per hour per email
- Gemini API: called only when violation detected
- Resend API: free tier limits apply

---

## Common Grep Commands
```bash
# Find function in Worker
grep -n "function_name\|endpoint_name" src/index.js | head -10

# Read specific lines
sed -n '100,150p' src/index.js

# Find in all society pages
grep -rn "search_term" society/ | head -10

# Find in JS components
grep -n "search_term" js/components/shared/SocietyNav.js
```

---

## Session Checklist
- [ ] Read GEMINI.md (this file)
- [ ] Check git status before starting
- [ ] State files to be touched
- [ ] Commit after every task
- [ ] Deploy Worker if src/index.js changed
- [ ] No debug code left behind

---

*Last updated: April 15, 2026*
*Platform: PSOTS Society — society.psots.in*
