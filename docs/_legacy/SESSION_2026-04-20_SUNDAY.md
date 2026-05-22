# PSOTS Society — Sunday Claude Code Session
## Complete Task List & Prompts

**Start command:**
```bash
cd ~/Documents/Playground/PSOTS
claude
```
Start with fresh full quota. Paste parts in order. Commit after each part.

---

## PART 0 — Bug Fixes First (15 mins)

```
Fix these bugs. Read CLAUDE.md first.

BUG 1 — Marketplace nav subtitle:
grep -n "nav-brand-sub\|Registration\|subtitle" society/marketplace.html | head -10
Remove "Registration" subtitle — should be empty or "PSOTS Society"

BUG 2 — Admin panel residents sort (flat 15167 missing):
grep -n "loadResidents\|sort\|createdAt" society/admin.html | head -15
Fix sort to handle Firestore Timestamp format:
residents.sort((a,b) => {
  const aTime = a.createdAt?.toMillis?.() || (a.createdAt?.seconds || 0) * 1000;
  const bTime = b.createdAt?.toMillis?.() || (b.createdAt?.seconds || 0) * 1000;
  return bTime - aTime;
});

BUG 3 — L&F Telegram warning too alarming:
grep -n "No Telegram\|warn" society/lostandfound.html | head -5
If no telegram BUT has email → info message not warning
If neither → gentle suggestion not scary warning

BUG 4 — Admin panel JS broken (filterResidents/switchTab not defined):
grep -n "function filterResidents\|function switchTab\|window.filterResidents\|window.switchTab" society/admin.html | head -10
If script is type="module" — expose on window:
window.filterResidents = filterResidents;
window.switchTab = switchTab;

BUG 5 — Sign out not working on profile page:
grep -n "signOut\|sign-out\|signout" society/profile.html | head -10
Fix sign out to call Firebase signOut() and redirect to login page.

git add society/marketplace.html society/admin.html society/lostandfound.html society/profile.html
git commit -m "Fix: marketplace subtitle, admin sort, L&F warning, admin JS, sign out"
git pull --rebase origin main && git push origin main
```

---

## PART 1 — Admin Settings Tab (20 mins)

```
Read CLAUDE.md first. Only touch society/admin.html.

Add Settings tab to admin panel — superadmin only.
New tab after Manage Admins.

Tab shows two sections:

CONTACT SETTINGS (reads/writes Firestore settings/contact):
  Admin Name: [Pushkal Kishore]
  WhatsApp: [919482088904]
  Telegram: [@pushkalkishore]
  Email: [pushkalkishore@gmail.com]

PLATFORM SETTINGS (reads/writes Firestore settings/platform):
  Site Name: [PSOTS Society]
  Approval time: [48] hours
  Maintenance mode: [OFF toggle]

[Save Settings] → writes to Firestore settings collection
Only visible when currentAdminDoc.isSuperadmin === true

All API calls use Authorization Bearer idToken.
Read from Firestore directly using existing db import.

git add society/admin.html
git commit -m "Feature: Admin Settings tab — edit contact and platform settings from UI"
git pull --rebase origin main && git push origin main
```

---

## PART 2 — Marketplace via Bot DM Flow (45 mins)

```
Read CLAUDE.md first. Only touch src/index.js.

Build marketplace listing via Telegram bot DM.
User sends /sell to @psots_telegram_bot privately.

Conversation state machine:
State stored in KV: _bot_state_{userId} with TTL 10 minutes

Steps:
1. /sell → "What are you selling? (item name)"
2. User replies → "What's the price? (₹ amount or 'Free')"
3. User replies → "Category? Reply with number:
   1. Electronics  2. Furniture  3. Clothing
   4. Vehicle  5. Services  6. Other"
4. User replies → "Condition?
   1. New  2. Like New  3. Good  4. Fair"
5. User replies → "Add a description (optional — or reply 'skip')"
6. User replies → Bot shows preview:

   📦 [Item Name]
   ₹[Price] · [Category] · [Condition]
   [Description]
   Posted by: Flat [flatNumber]
   
   Post this listing?
   ✅ Yes  ✏️ Edit  ❌ Cancel

On Yes:
- Write to Firestore marketplace_listings via service account (firestoreSet helper)
- React ✅ to confirmation message
- Reply: "✅ Listed! View at society.psots.in/society/marketplace"
- Notify admin group -1001328126394: "🛒 New listing: [Item] ₹[Price] by Flat [flat]"

On Edit → restart from step 1 keeping chatId
On Cancel → delete KV state, reply "Listing cancelled."

IMPORTANT — Buy/Sell group rules (for FUTURE use, not now):
- Bot is NOT admin in Buy/Sell group -1001257269381 currently
- Do NOT add bot to that group until public launch
- When public launch, enforce:
  1. Flat number required in post
  2. Max 1 post per week per user
  3. PSOTS items only (Gemini checks)
  4. Extract listing → post to website automatically

npx wrangler deploy
git add src/index.js
git commit -m "Feature: marketplace bot DM flow — /sell command with conversation state"
git pull --rebase origin main && git push origin main
```

---

## PART 3 — Group Reactions (20 mins)

```
Read CLAUDE.md first.

PART A — Admin UI: Add Reactions sub-tab to Group Moderation in society/admin.html.

Sub-tab layout:
[☑ Enable auto reactions]

Reaction rules table:
Keyword/phrase | React with emoji | [Remove]
[+ Add Rule]

Pre-filled defaults:
"happy birthday" → 🎂
"congratulations" → 🎉
"welcome" → 👋
"thank you" → 🙏
"good morning" → ☀️

Save → POST /admin/group-settings with reactions config + auth token

PART B — Worker: add reaction logic in src/index.js message handler.
Store rules in KV: _reactions_{chatId}
When message arrives → check rules → call Telegram setMessageReaction API

npx wrangler deploy
git add society/admin.html src/index.js
git commit -m "Feature: group reactions — auto-react to keywords per group"
git pull --rebase origin main && git push origin main
```

---

## PART 4 — Recommendations Page (30 mins)

```
Read CLAUDE.md first.

Create society/recommendations.html — new page.

Category tabs:
🏥 Doctors | 🍽 Restaurants | 🔧 Services | 👶 Classes | 🚗 Transport | 🌿 Other

Contact card design:
┌─────────────────────────────────┐
│ 🔧 Raju Plumbing Works          │
│ Plumber · Recommended by 8      │
│ ⭐⭐⭐⭐⭐                        │
│ "Fixed geyser same day"         │
│ [📞 Call]  [💬 WhatsApp]        │
└─────────────────────────────────┘

Features:
- Search by name or category
- Any approved resident can submit recommendation (+ Add button)
- Admin approves before showing publicly
- WhatsApp button: wa.me/91{phone}
- Call button: tel:{phone}
- No booking, no payment — contact only

Firestore collection: recommendations
Fields: name, category, phone, description, rating(1-5),
        recommendedBy(flatNumber), approvedBy, status(pending/approved),
        createdAt

Add to SocietyNav.js as 6th link: "Recommendations"
Add to footer on all pages.

Bot integration in src/index.js:
If message contains "good doctor", "recommend", "suggest", "near PSOTS",
"good plumber", "good restaurant" → bot replies with top 3 from recommendations
Read from Firestore using firestoreGet helper.

CRITICAL: Flat numbers always plain — never Tower/Floor/Unit breakdown.

npx wrangler deploy
git add society/recommendations.html js/components/shared/SocietyNav.js src/index.js society/
git commit -m "Feature: Recommendations page with contact cards + bot integration"
git pull --rebase origin main && git push origin main
```

---

## PART 5 — Resident Violation Portal on Profile (20 mins)

```
Read CLAUDE.md first. Only touch society/profile.html.

Add section to profile page: MY MODERATION RECORD

For each group resident has violations in:
━━━ PSOTS - पुरवईया बयार ━━━
Violations: 2  Status: Active member

Violation history (last 30 days):
Apr 7 · Buy/Sell Content · Message removed · Warning sent
Apr 8 · Buy/Sell Content · Message removed · Warning sent

[📝 Submit Appeal]
  Group: [dropdown]
  What happened: [textarea]
  [Submit Appeal]

Appeal status shown: Pending review / ✅ Resolved by admin

Data: GET /user/violations?userId={telegramId} from Worker
Needs resident's Telegram ID — read from residents/{uid}.telegramUsername

Update all bot DM links in src/index.js:
Change: telegram.psots.in/user?id=X
To: society.psots.in/society/profile

npx wrangler deploy
git add society/profile.html src/index.js
git commit -m "Feature: resident violation portal on profile + update bot DM links"
git pull --rebase origin main && git push origin main
```

---

## PART 5B — Family Member Invitation — QR Code + Email OTP (30 mins)

```
Read CLAUDE.md first.

Build family member invitation system with two methods:
QR Code (when physically together) and Email OTP (when apart).

SECURITY MODEL:
- Primary resident generates invite for their flat only
- Invite token expires in 10 minutes — one time use
- Family member MUST register on their OWN device
- Primary resident cannot complete registration on behalf of family member
- Prevents misuse: vendor/stranger won't scan a QR or check a random email

FIRESTORE — new collection:
invites/{token}:
  flatNumber: "15167"
  invitedBy: uid (primary resident)
  inviterName: "Pushkal Kishore"
  relation: "spouse/parent/child/sibling/other"
  createdAt: timestamp
  expiresAt: timestamp + 10 minutes
  used: false
  usedBy: null

FIRESTORE RULES — add to firestore.rules:
match /invites/{token} {
  allow read: if true;
  allow create: if isSignedIn();
  allow update: if true;
}
firebase deploy --only firestore:rules --project psots-society-25899

WORKER ENDPOINTS — add to src/index.js:

POST /invite/generate (requires auth token)
  Body: { flatNumber, relation, inviterName }
  → Generate crypto random token (32 chars)
  → Save to Firestore invites/{token} with 10 min expiry
  → Return: { token, url: "https://society.psots.in/society/join.html?token={token}" }

GET /invite/validate?token=xxx (no auth)
  → Read invites/{token} from Firestore
  → Check: not expired AND used === false
  → Return: { valid: true/false, flatNumber, inviterName, relation, expired, alreadyUsed }

POST /invite/use (requires auth token)
  Body: { token }
  → Validate token one more time
  → Mark used: true, usedBy: uid in Firestore
  → Add entry to residents/{primaryUid}/family/{newUid}:
    { name, relation, uid, joinedAt }
  → Return: { ok: true }

NEW PAGE — society/join.html (no login required):
Uses same cream/jade/gold design system.
No SocietyNav needed — standalone page.

Shows:
"🏠 You've been invited!

[InviterName] has invited you to join
PSOTS Society as their [relation]
Flat [flatNumber]

Complete your profile:
Your Name: [text input]

How do you want to sign in?
[Continue with Google]
[Use Email OTP]
[Use Telegram OTP]"

On successful login:
→ Call POST /invite/use with token + auth token
→ Show: "✅ Welcome to PSOTS Society! You're now linked to Flat [flatNumber]"
→ Redirect to dashboard after 3 seconds

If token expired:
→ Show: "⏰ This invitation has expired. Ask [inviterName] to send a new one."

If token already used:
→ Show: "✅ This invitation has already been used."

PROFILE PAGE — add Family Members section to society/profile.html:
After Resident Information section, add:

━━━ 👨‍👩‍👧 Family Members ━━━

[List existing family members]:
  Avatar | Name | Relation | Status (active/invited) | [Remove]

If none: "No family members added yet."

[+ Add Family Member] button → opens modal:

MODAL — Choose invitation method:
┌──────────────────────┐  ┌──────────────────────┐
│  📱 QR Code          │  │  📧 Email Invite      │
│                      │  │                      │
│  Show QR to your     │  │  Send invite link    │
│  family member to    │  │  to their email      │
│  scan — best when    │  │  — best when not     │
│  you're together     │  │  physically present  │
└──────────────────────┘  └──────────────────────┘

QR CODE FLOW:
1. Select relation: [Spouse/Parent/Child/Sibling/Other]
2. Click Generate QR
3. POST /invite/generate → get token + URL
4. Generate QR using qrcode.js CDN (already available):
   https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js
5. Show QR code image (200x200px) on screen
6. Show countdown timer (10:00 → 0:00)
7. Show URL below QR for manual copy
8. Poll every 5 seconds: GET /invite/validate?token=xxx
   → If used: true → show "✅ [Name] has joined!" → close modal → refresh family list
   → If expired → show "⏰ QR expired. Generate a new one." → show Generate button again

EMAIL INVITE FLOW:
1. Select relation: [Spouse/Parent/Child/Sibling/Other]
2. Enter family member's email address
3. Click Send Invite
4. POST /invite/generate → get token + URL
5. Send branded invite email via Resend from noreply@society.psots.in:
   Subject: "[InviterName] invited you to join PSOTS Society"
   Jade green header, gold CTA button: "Join PSOTS Society — Flat [flatNumber]"
   Body: "You've been invited by [InviterName] to join PSOTS Society
          as their [relation] for Flat [flatNumber].
          This invite expires in 10 minutes."
   Button: links to society.psots.in/society/join.html?token={token}
6. Show: "✅ Invite sent to [email]! Ask them to click the link."
7. Poll every 10 seconds for 10 minutes
   → If used → show "✅ [email] has joined!" → close modal → refresh family list

ADMIN NOTIFICATION FLOW:
When family member successfully joins via invite:
→ Create document in Firestore admin_notifications/{autoId}:
  type: "family_member_added"
  flatNumber: "15167"
  primaryResidentName: "Pushkal Kishore"
  primaryResidentUid: uid
  familyMemberName: name from join form
  relation: "spouse/parent/child/sibling/other"
  addedAt: timestamp
  acknowledged: false
  acknowledgedBy: null
  acknowledgedAt: null

ADMIN PANEL CHANGES — add to society/admin.html Residents tab:

1. Yellow badge on Residents tab if unacknowledged notifications exist:
   "👨‍👩‍👧 2 family additions pending review"

2. Section above residents list: "FAMILY MEMBER ADDITIONS"
   Only shows if unacknowledged notifications exist.

   Each card:
   ┌────────────────────────────────────────────┐
   │ 👨‍👩‍👧 New Family Member Added               │
   │ Flat 15167 — Pushkal Kishore               │
   │ Added: Priya Kishore (Spouse)              │
   │ Joined: 15 Apr 2026, 3:45 PM              │
   │                                            │
   │ [✅ Acknowledge]  [🗑 Remove Member]        │
   └────────────────────────────────────────────┘

3. Acknowledge button:
   → Updates admin_notifications/{id}: acknowledged: true,
     acknowledgedBy: adminUid, acknowledgedAt: timestamp
   → Card disappears from pending list
   → No action taken on the family member account

4. Remove Member button:
   → Confirmation: "Remove [name] from Flat [flatNumber]?"
   → Deletes residents/{primaryUid}/family/{familyUid}
   → Updates admin_notifications/{id}: acknowledged: true, removed: true
   → Sends notification email to primary resident:
     "Admin has removed [name] from your family members list.
      Contact admin if this is an error."

FIRESTORE RULES — add:
match /admin_notifications/{id} {
  allow read: if isAdmin();
  allow create: if isSignedIn();
  allow update: if isAdmin();
}

npx wrangler deploy
firebase deploy --only firestore:rules --project psots-society-25899
git add society/profile.html society/join.html society/admin.html src/index.js firestore.rules
git commit -m "Feature: family member invitation — QR code, email invite, admin notification flow"
git pull --rebase origin main && git push origin main
```

---

## PART 6 — Events Page (if quota allows)

```
Read CLAUDE.md first.

Create society/events.html — new page.

Layout:
- Upcoming events section (sorted by date)
- Past events section
- Each event: title, date/time, location, organizer, description
- RSVP button → saves to Firestore events/{eventId}/rsvps/{uid}
- RSVP count shown on card

Admin panel — add Events to Announcements tab or new tab:
- Post event: title, description, date, time, location
- Delete event

Firestore: events collection
Fields: title, description, date, time, location,
        organizer, flatNumber, createdBy, status, rsvpCount

Add to SocietyNav and footer.

git add society/events.html society/admin.html js/components/shared/SocietyNav.js
git commit -m "Feature: Events page with RSVP"
git pull --rebase origin main && git push origin main
```

---

## PART 7 — Community Blogs (if quota allows)

```
Read CLAUDE.md first.

Create society/blogs.html — new page.

Categories:
📋 Society Updates | 🔧 Resident Tips | 🎉 Community Stories
📍 Local Area Guide | 🏛 RWA Updates

Features:
- Admin writes and publishes
- Approved resident can submit (admin approves before publishing)
- Author credit: name + flat number (optional)
- Search by category or keyword
- Blog card: title, excerpt, author, date, category tag

Firestore: blogs collection
Fields: title, content, excerpt, category, authorName,
        authorFlat, publishedBy, status, createdAt

Add to SocietyNav and footer.

git add society/blogs.html js/components/shared/SocietyNav.js
git commit -m "Feature: Community blogs page"
git pull --rebase origin main && git push origin main
```

---

## Session Notes

### Priority Order
1. Part 0 — Bug fixes (always first)
2. Parts 1-5 — Core features
3. Part 5B — Family member invitation (important UX feature)
4. Parts 6-7 — Bonus if quota allows

### Token Saving Strategy
- Group Moderation UI already complete ✅ — do not rebuild
- Commit after every part — never lose work
- Stop and report remaining quota if running low
- Parts 6 and 7 are bonus — skip if quota tight

### Buy/Sell Group — DO NOT Until Public Launch
- ❌ Do NOT add bot to -1001257269381 (Buy/Sell group)
- ❌ Do NOT give bot admin access in that group
- ❌ Do NOT enforce rules there until 50+ active platform users
- ✅ Bot DM /sell flow is safe to build (private conversations only)

### Family Member QR Code — Key Security Points
- QR code valid 10 minutes only — one time use only
- Family member MUST register on their own device
- Primary resident cannot register on behalf of family member
- Vendor/stranger won't scan a random QR → invite just expires harmlessly
- Uses qrcode.js from cdnjs.cloudflare.com — no npm needed
- Poll every 5 seconds to detect when family member joins

### Critical Rules (always apply)
- Flat numbers always plain (e.g. 15167) — NEVER Tower/Floor/Unit breakdown
- Bot can NEVER ban users — ban is always admin decision
- Gemini always defaults to PASS on any API error
- firebase deploy --only firestore:rules before git push when rules change
- npx wrangler deploy before git push when src/index.js changes
- Never read src/index.js in full — grep only with line ranges

### Before Sunday — Manual Tasks
- [ ] Copy updated SUNDAY_SESSION_TASKS.md to repo
- [ ] Test full registration flow end to end in incognito
- [ ] Export transparent PNG logo from Canva → replace assets/psots-logo.png
- [ ] Meet Secretary Vinayak in person before announcing to main group
- [ ] Send revival message to original 15-member team
- [ ] Verify Firestore resident record shows correctly on profile page
- [ ] Add developer reviewer as GitHub collaborator

---

*Updated: April 15, 2026*
*Platform: PSOTS Society — society.psots.in*

---

## Data Research Findings (April 16, 2026)

### Foodies Group — Full History (Nov 2020 → Apr 2026)
- Total messages: 74,148 (84,366 raw)
- Active since: November 2020 — 5+ years
- Unique senders: 1,224
- Peak year: 2025 (15,000+ messages)
- Top vendor (Sumit): 4,459 posts over 5 years = daily poster
- 42% posts mention prices
- 54% posts have photos
- Consistent 1,000+ posts/month every single month

### Key Vendor Insights
Top 5 daily vendors (5-year commitment):
1. Sumit — 4,459 posts
2. Sivagami Arunachalam — 4,304 posts
3. Jayashree Rakkhit — 3,546 posts
4. Manisha R — 3,036 posts
5. Sai Madhuri — 2,570 posts

### Revenue Confidence
These vendors have posted daily for 5 years with zero tools.
₹99/month vendor dashboard = confirmed viable product.

### Extracted Data Ready for Platform
- 12 verified service contacts (maids, carpenter, tailor, agents)
- 8 wiki topic areas (property tax, E-Khata, RC renewal etc.)
- 7 carpooling requests
- Contact cards ready to pre-populate on launch day

### Buy/Sell Group
- Download in progress (April 16, 2026)
- Full history being downloaded
- YoY trend analysis pending


---

## Phase 2 — EC Broadcast Auto-Sync (GitHub Actions)

### Why GitHub Actions
- Free forever (2,000 minutes/month, we use ~60)
- Already have GitHub repo
- No server, no Mac needed
- Manual trigger + scheduled cron
- If it fails → fallback to Google Cloud Run

### Files to create:
.github/workflows/ec-sync.yml

### GitHub Secrets needed:
TELEGRAM_API_ID: 39473525
TELEGRAM_API_HASH: 85ce37722f46053d8d77f2d8518fff19
TELEGRAM_SESSION: (export session string from local)
FIREBASE_SA_EMAIL: (existing)
FIREBASE_SA_KEY: (existing)

### Workflow:
Trigger: 
  - Schedule: every 6 hours
  - Manual: workflow_dispatch (from admin panel button)

Steps:
  1. pip install telegram-download-chat firebase-admin
  2. Run sync script for EC group (-1001712710510)
  3. Compare with existing Firestore ec_sync collection
  4. Save new messages as status: "pending"
  5. Done — admin reviews in panel

### Admin Panel:
New button in Announcements tab:
"🔄 Sync EC Broadcast"
→ Calls Worker: POST /admin/sync-ec
→ Worker calls GitHub API to trigger workflow
→ Shows: "Sync started — check back in 2 minutes"

New sub-tab: "EC Pending"
Shows all pending EC messages
Admin clicks Publish → becomes community announcement
Admin clicks Dismiss → archived

### Fallback:
If GitHub Actions causes issues → 
migrate same script to Google Cloud Run
Same Python script, different trigger
Zero rework needed

