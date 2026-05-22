# MySociety Migration — Claude Code Prompt v2
**PSOTS Platform · April 2026 · psots-society-25899**
**Single file · 4 phases · Stop after each phase if needed**

---

## STRICT RULES — READ BEFORE ANYTHING

**NEVER READ (too large):**
- `index.html`
- `src/index.js`
- Any file over 8000 tokens

**ALWAYS DO:**
- Read `CODEBASE_INDEX.md` first — always
- Use `grep` before reading any file
- Use `offset/limit` when reading large files
- Commit after each phase — never batch across phases
- Deploy firestore rules before pushing
- `git pull --rebase` before `git push`
- If quota is running low — stop, commit what's done, report what's remaining

---

## CONTEXT

**Two-domain architecture:**

| Domain | Purpose | Auth |
|--------|---------|------|
| `psots.in` | Public only. Hero, gallery, contacts, events. Single CTA → MySociety | None |
| `society.psots.in` | All resident features behind login | Required |

**Key decisions — do not second-guess these:**
- Flat ID format: keep existing logic (e.g. `15167`) — no change, purely numeric, NO letters or dashes
- Firebase project: keep `psots-society-25899` (existing data is test data, ignore)
- Login methods: keep Google OAuth + Telegram OTP + add Email OTP as third option
- Admin: superadmin = `pushkalkishore@gmail.com` + Telegram ID `989358143`
- Always check Firestore `admins` collection for additional admins — never hardcode
- No data migration needed

**⚠️ FLAT NUMBER FORMAT — NEVER CHANGE:**
Flat numbers follow this format: `{tower}{floor_padded}{unit}`
- Tower: no padding (1–17)
- Floor: **always 2 digits** — pad with leading zero if floor < 10 (e.g. floor 5 = `05`)
- Unit: no padding for towers with maxUnit ≤ 8 (1 digit); 2 digits for towers 12 and 14 (maxUnit = 12)
- Minimum flat number length is **4 digits** — no flat number can be 3 digits or less

Correct examples:
- Tower 15, Floor 16, Unit 7 = `15167` (floor 16, no padding needed)
- Tower 8, Floor 5, Unit 3 = `8053` (floor 5 padded to `05`)
- Tower 1, Floor 17, Unit 8 = `1178` (not `11718` — that would be Tower 11, Floor 17, Unit 8)
- Tower 11, Floor 17, Unit 8 = `11178`
- Tower 10, Floor 1, Unit 1 = `10011`
- Tower 12, Floor 10, Unit 11 = `121011` (unit 11 is naturally 2 digits — unit is NEVER padded)

The full logic is documented in `PSOTS_FlatNumber_Logic.md` in the repo root.
**Read `PSOTS_FlatNumber_Logic.md` before touching ANY flat number validation, registration, or display code.**

**⚠️ THE EXISTING `flat.service.js` MUST BE UPDATED to use floor padding:**
- `buildFlatNumber()`: change to `${parseInt(tower)}${String(parseInt(floor)).padStart(2,'0')}${parseInt(unit)}`
  — floor gets `padStart(2,'0')`, unit is NEVER padded
- `parseFlatNumber()`: floor segment is always exactly 2 digits — update slice logic accordingly
- `validate()`: add check — result must be ≥ 4 digits

**This is a breaking change if any existing Firestore data uses old 3-digit flat numbers.**
Before changing flat.service.js — run this check:
```bash
# Claude Code: search for any test/seed data with old format
grep -rn "\"853\"\|'853'\|flatNumber.*853" src/ | head -10
```
If existing Firestore documents used old format (e.g. `853`) — those are test records (confirmed by Pushkal, ignore existing data). Proceed with new format.
Firestore uses flatNumber as document ID in `flats/{flatNumber}` — new registrations will use padded format.

**⚠️ CRITICAL — ALL LOGIN METHODS MUST RESOLVE TO THE SAME UID:**
This is the most important rule in the entire codebase. A resident has ONE flat.
If they register via Google and later log in via Telegram OTP or Email OTP,
they must get the SAME Firebase UID — not a new one.
- Google login: UID is fixed by Firebase Auth — this is the baseline
- Telegram OTP (`verify-otp`): must query `residents` by `telegramId` → use their existing `uid` to mint custom token. If not found → return `not_registered`
- Email OTP (`verify-email-otp`): must query `residents` by `email` → use their existing `uid` to mint custom token. If not found → return `not_registered`
- Never mint a custom token for an unknown identity. Login ≠ Registration.
- If `not_registered` → frontend redirects to `/society/register.html`

**CSS variables — use these, do not read index.html:**
```css
--ink:#1a1208; --ink-soft:#3d2f1e;
--gold:#b8882a; --gold-light:#d4a84b; --gold-pale:#f0d898;
--cream:#faf6f0; --cream-dark:#f0e8d8; --white:#ffffff;
--muted:#8a7a6a; --border:rgba(160,130,90,0.22);
--jade:#1a4a3a; --jade-light:#2d6b54; --terra:#8b3a1a;
```
**Fonts:** Playfair Display (headings) + Nunito Sans (body)

---

## ════════════════════════════════════════
## PHASE 0 — Fix residentService.create() (Atomic Batch Write)
## Run this FIRST. Everything else depends on clean registration.
## Estimated: 1 short session · Safe with any quota level
## ════════════════════════════════════════

### STOP BEFORE STARTING — find the file:
```bash
grep -rn "residentService\|\.create\b" src/js/services/ | head -10
```

### What to fix in residentService.create():

**Step 1 — Add flat duplicate guard BEFORE any write:**
```javascript
const flatRef = doc(db, 'flats', flatNumber);
const flatSnap = await getDoc(flatRef);
if (flatSnap.exists()) {
  throw new Error(`Flat ${flatNumber} is already registered.`);
}
```

**Step 2 — Replace all sequential writes with writeBatch:**
```javascript
const batch = writeBatch(db);
batch.set(doc(db, 'residents', uid), residentData);
batch.set(doc(db, 'identities', uid), { flatNumber, memberId });
batch.set(doc(db, 'flats', flatNumber), { uid, memberId, linkedAt: serverTimestamp() });
await batch.commit();
```
All three writes succeed together or none do. No partial state possible.

**Step 3 — Wrap in try/catch:**
```javascript
try {
  // duplicate guard + batch.commit()
  return { success: true, uid, memberId };
} catch (err) {
  return { success: false, error: err.message };
}
```

**Step 4 — Verify resolveIdentity() and linkIdentity():**
- Both must read from `identities/{uid}` only — never directly from `residents` for identity resolution
- No changes needed if already correct — just confirm with grep

### Phase 0 commit:
```bash
git add src/js/services/
git commit -m "Phase 0: Atomic batch write + duplicate flat guard in residentService"
git pull --rebase origin main
git push origin main
```

---

## ⛔ STOP POINT 0
## Verify: residentService.create() uses writeBatch, flat duplicate guard in place
## ⛔

---

## ════════════════════════════════════════
## PHASE 1 — Strip psots.in + Email OTP Worker
## Estimated: 1 session · Safe to do with low quota
## ════════════════════════════════════════

### STOP BEFORE STARTING — confirm these files exist:
```bash
grep -n "nav-auth\|btnGoogle\|nav-mysociety" index.html | head -5
grep -n "verify-otp\|send-otp\|CORS" src/index.js | head -5
```
If either file is missing — stop and report.

---

### 1A — Strip auth from index.html

Use `grep` to find exact line numbers before editing. Never read whole file.

Remove these elements (grep for each before deleting):
- Entire `<script type="module">` Firebase auth block at bottom of body
- `nav-auth` div (contains Sign In, Join Community, Hi pill, dropdown)
- `id="nav-mysociety"` link from nav-links
- Any `_addAdminLink` function references
- Any `psots_nav_user` sessionStorage references

Keep untouched:
- Home | Events | Contacts nav links
- All page sections (home, events, contacts)
- Footer
- All CSS

Add single CTA button to nav (right side, before Chhath button):
```html
<a href="https://society.psots.in"
   style="display:flex;align-items:center;gap:7px;background:var(--jade);
          color:var(--gold-pale);padding:8px 18px;border-radius:9px;
          font-size:13px;font-weight:600;text-decoration:none;
          letter-spacing:0.2px;transition:all 0.2s;">
  🏘️ <span>MySociety</span>
</a>
```

Update hero buttons:
- Remove "Community Guide" button
- Keep "Emergency Contacts" button
- Change second button to:
```html
<a href="https://society.psots.in" class="btn-outline"
   style="text-decoration:none;display:inline-flex;align-items:center">
  Join MySociety →
</a>
```

Update footer Portal column:
- `Community Guide` → `<a href="https://society.psots.in/guide">Community Guide</a>`
- Add `<li><a href="https://society.psots.in">MySociety</a></li>`
- Remove all `residents.html` references

Remove `<!-- GUIDE PAGE -->` section entirely:
```bash
grep -n "GUIDE PAGE\|page-guide" index.html
# Then remove entire block
```

---

### 1B — Add Email OTP endpoints to Worker

```bash
grep -n "verify-otp\|endpoint\|if (endpoint" src/index.js | head -20
```

Add these two endpoints after the existing `/verify-otp` block.

**⚠️ IMPORTANT for both endpoints:**
Both must resolve an EXISTING resident's UID — never create a new identity.
Look at the existing `/verify-otp` endpoint for the exact `mintFirebaseToken()` pattern and replicate it exactly.

**POST /auth/send-email-otp:**
```javascript
if (endpoint === 'auth/send-email-otp') {
  const body = await request.json().catch(() => ({}));
  const { email } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_email' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  // Rate limit: max 3 per hour
  const rlKey = `email_ratelimit_${email}`;
  const rlVal = await env.VIOLATIONS.get(rlKey);
  const rlCount = rlVal ? parseInt(rlVal) : 0;
  if (rlCount >= 3) {
    return new Response(JSON.stringify({ ok: false, error: 'rate_limited' }),
      { status: 429, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
  await env.VIOLATIONS.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });

  // ⚠️ Check resident exists in Firestore by email — use existing Firestore admin pattern
  // If not found → return { ok: false, error: 'not_registered' }
  // Do NOT generate OTP for unknown emails

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expires = Date.now() + 15 * 60 * 1000;
  await env.VIOLATIONS.put(`email_otp_${email}`,
    JSON.stringify({ otp, used: false, expires }),
    { expirationTtl: 900 });

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'otp@society.psots.in',
      to: email,
      subject: 'Your MySociety login code',
      html: `<p>Your MySociety OTP is <strong>${otp}</strong>.</p>
             <p>Valid for 15 minutes. Do not share this code.</p>`,
    }),
  });

  if (!resendRes.ok) {
    return new Response(JSON.stringify({ ok: false, error: 'email_failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  return new Response(JSON.stringify({ ok: true }),
    { headers: { 'Content-Type': 'application/json', ...CORS } });
}
```

**POST /auth/verify-email-otp:**
```javascript
if (endpoint === 'auth/verify-email-otp') {
  const body = await request.json().catch(() => ({}));
  const { email, otp } = body;

  if (!email || !otp) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  const stored = await env.VIOLATIONS.get(`email_otp_${email}`);
  if (!stored) {
    return new Response(JSON.stringify({ ok: false, error: 'otp_expired' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  const { otp: storedOtp, used, expires } = JSON.parse(stored);

  if (used) {
    return new Response(JSON.stringify({ ok: false, error: 'otp_used' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
  if (Date.now() > expires) {
    return new Response(JSON.stringify({ ok: false, error: 'otp_expired' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
  if (otp !== storedOtp) {
    return new Response(JSON.stringify({ ok: false, error: 'otp_invalid' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  await env.VIOLATIONS.put(`email_otp_${email}`,
    JSON.stringify({ otp: storedOtp, used: true, expires }),
    { expirationTtl: 900 });

  // ⚠️ CRITICAL: Look up EXISTING resident uid by email from Firestore
  // Use the same Firestore admin pattern as existing /verify-otp endpoint
  // If resident not found → return { ok: false, error: 'not_registered' }
  // Mint Firebase custom token using existing mintFirebaseToken(uid) function
  // Return { ok: true, token: customToken }
}
```

**POST /resident/feedback — Website/bot feedback only (Firestore only, NO email):**

⚠️ Resend is used ONLY for OTP, welcome emails, and notifications.
Feedback does NOT send any email. It stores in Firestore only.
Admin reads it from the admin panel.

```javascript
if (endpoint === 'resident/feedback') {
  const body = await request.json().catch(() => ({}));
  const { type, message, flatNumber, residentName, residentEmail } = body;
  // type: 'website_bug' | 'website_suggestion' | 'bot_issue' | 'bot_suggestion'
  // ⚠️ Society complaints (maintenance, parking, security) → MyGate, not here

  if (!message || !type) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  // Rate limit: max 5 per hour per uid
  const rlKey = `feedback_rl_${residentEmail}`;
  const rlVal = await env.VIOLATIONS.get(rlKey);
  const rlCount = rlVal ? parseInt(rlVal) : 0;
  if (rlCount >= 5) {
    return new Response(JSON.stringify({ ok: false, error: 'rate_limited' }),
      { status: 429, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
  await env.VIOLATIONS.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });

  // Store in Firestore only — no email sent
  // Use existing Firestore admin pattern from codebase
  // Collection: feedback/{auto-id}
  // Fields: type, message, flatNumber, residentName, residentEmail, createdAt, status: 'new'

  return new Response(JSON.stringify({ ok: true }),
    { headers: { 'Content-Type': 'application/json', ...CORS } });
}
```

**Update CORS:**
```bash
grep -n "psots.in\|Access-Control-Allow-Origin" src/index.js | head -5
```
Add `https://society.psots.in` to allowed origins alongside existing `https://psots.in`.

---

### 1C — Phase 1 commit
```bash
git add index.html src/index.js
git commit -m "Phase 1: Strip auth from psots.in + email OTP + feedback endpoint"
git pull --rebase origin main
git push origin main
```

---

## ⛔ STOP POINT 1
## - psots.in nav has no auth elements
## - psots.in has MySociety CTA button
## - Worker has /auth/send-email-otp and /auth/verify-email-otp
## - Both endpoints resolve EXISTING uid — never create new identity
## ⛔

---

## ════════════════════════════════════════
## PHASE 2 — Create society/ folder (all resident pages)
## Estimated: 1 full session · Do NOT start with low quota
## ════════════════════════════════════════

### STOP BEFORE STARTING:
```bash
grep -n "nav-auth\|btnGoogle" index.html | head -3   # Should return nothing
grep -n "send-email-otp\|verify-email-otp" src/index.js | head -3   # Should return 2 lines
```

### 2A — Create /society folder
```bash
mkdir -p society
```
Files: `login.html`, `index.html`, `register.html`, `profile.html`,
`marketplace.html`, `guide.html`, `lostandfound.html`, `carpooling.html`

### 2B — Shared society nav (use on ALL society pages)
```html
<nav id="societyNav">
  <a class="nav-brand" href="/society/">
    <div class="nav-logo">PS</div>
    <div>
      <div class="nav-brand-name">MySociety</div>
      <div class="nav-brand-sub">Prestige Song of the South</div>
    </div>
  </a>
  <div class="nav-links" id="societyNavLinks">
    <a class="nav-link" href="/society/">Dashboard</a>
    <a class="nav-link" href="/society/marketplace.html">Marketplace</a>
    <a class="nav-link" href="/society/guide.html">Guide</a>
    <a class="nav-link" href="/society/lostandfound.html">Lost & Found</a>
    <a class="nav-link" href="/society/carpooling.html">Carpooling</a>
  </div>
  <div id="society-auth" style="display:flex;align-items:center;gap:8px">
    <!-- Populated by auth check script -->
  </div>
  <a href="https://psots.in" style="font-size:12px;color:var(--muted);
     text-decoration:none;padding:6px 10px">← psots.in</a>
</nav>
```

### 2C — society/login.html
Three tabs: Google | Telegram OTP | Email OTP
- All three on `not_registered` error → redirect to `/society/register.html`
- On success → `signInWithCustomToken` → redirect to `?redirect` param or `/society/`

### 2D — society/index.html (Dashboard)
Auth required. Shows: resident hero bar, feature tiles (2x2), notice board (latest 3 from `announcements`), pending-user amber info box.

### 2E — society/register.html
4-step flow: Login → Flat details → Personal details → Privacy → Submit via `residentService.create()` (atomic after Phase 0).

### 2F — society/profile.html
Existing profile content + family members section + invite link generator.

Also add **Contact Admin** section at the bottom of profile page:
```
[PLATFORM FEEDBACK]
Heading: "Report a bug or suggest a feature"
Subtext: "For society issues (maintenance, parking, security) → use MyGate."

Type dropdown:
  🐛 Website Bug
  💡 Website Suggestion
  🤖 Bot Issue
  🤖 Bot Suggestion

Message textarea (max 500 chars, show char counter)
Submit button → POST WORKER_URL/resident/feedback

On success: jade success box "Thank you! Your feedback has been recorded."
On rate_limited: amber box "You've submitted too many times. Try again in an hour."
On error: red box "Could not submit. Please try again."
```

Pre-fill `flatNumber`, `residentName`, `residentEmail` from existing auth session — resident should not need to type their details.
No email is sent. Feedback is stored in Firestore `feedback` collection and visible to admin in the admin panel.

### 2G — Move existing pages
Copy `guide.html`, `marketplace.html`, `lostandfound.html`, `carpooling.html` → `society/` folder. Update nav, auth, internal links. Verify `../../js/` import paths resolve.

### 2H — Phase 2 commit
```bash
git add society/
git commit -m "Phase 2: Create society/ folder with all resident pages"
git pull --rebase origin main
git push origin main
```

---

## ⛔ STOP POINT 2
## - society/ folder has all 8 pages
## - Login has all 3 options with not_registered handling
## - Dashboard shows announcements from Firestore
## ⛔

---

## ════════════════════════════════════════
## PHASE 3 — Routing, cleanup, final wiring
## Estimated: 1 light session
## ════════════════════════════════════════

### 3A — society/_redirects
```
/society              /society/index.html        200
/society/login        /society/login.html         200
/society/register     /society/register.html      200
/society/dashboard    /society/index.html         200
/society/marketplace  /society/marketplace.html   200
/society/guide        /society/guide.html         200
/society/lostandfound /society/lostandfound.html  200
/society/carpooling   /society/carpooling.html    200
/society/profile      /society/profile.html       200
/society/admin        /society/admin.html         200
```

### 3B — /_redirects at repo root
```
/residents    /society/register.html    301
/profile      /society/profile.html     301
/marketplace  /society/marketplace.html 301
/guide        /society/guide.html       301
```

### 3C — Remove old root-level pages
```bash
ls society/guide.html society/marketplace.html   # Verify exist first
git rm guide.html marketplace.html lostandfound.html carpooling.html
git rm residents.html society.html profile.html
# DO NOT remove: index.html, admin.html (admin.html replaced in Phase 4)
```

### 3D — Update CODEBASE_INDEX.md
Add architecture summary, society/ file list, Worker endpoints, admin access rules.

### 3E — Deploy + commit
```bash
firebase deploy --only firestore:rules --project psots-society-25899
git add .
git commit -m "Phase 3: Routing, redirects, cleanup"
git pull --rebase origin main
git push origin main
```

---

## ⛔ STOP POINT 3
## - psots.in loads with no auth, MySociety CTA visible
## - Old root pages return 301 redirects
## - society/login.html works with all 3 login methods
## ⛔

---

## ════════════════════════════════════════
## PHASE 4 — Unified Admin Panel (society.psots.in/admin)
## Replaces telegram.psots.in/admin entirely
## Estimated: 1 full session · Do NOT start with low quota
## ════════════════════════════════════════

### What this phase does:
Merges the existing Telegram group moderation panel (currently at telegram.psots.in/admin)
with resident management and announcement posting into one admin panel
at society.psots.in/admin.html.

After verified, the old /admin route in the Worker is removed.
telegram.psots.in/admin will 404 — this is intentional.

### STOP BEFORE STARTING — read existing admin panel:
```bash
grep -n "admin\|/admin\|Community Lobby" src/index.js | head -20
grep -n "getChat\|getChatAdministrators\|banChatMember\|restrictChatMember" src/index.js | head -20
```
Understand the existing Telegram API call patterns before writing new ones.

---

### 4A — Access control (two-tier)

**Tier 1 — Superadmin** (`pushkalkishore@gmail.com` / TG ID `989358143`):
- Full access: all 3 tabs (Residents + Announcements + ALL groups)
- Also check Firestore `admins` collection for additional superadmins

**Tier 2 — Group Admin** (Telegram group admins):
- Access: Group Moderation tab only, their group only
- No resident management, no announcements
- Status verified live via Telegram API `getChatAdministrators`

**Auth check function (add to admin.html):**
```javascript
async function checkAdminAccess(user) {
  if (user.email === 'pushkalkishore@gmail.com') return { role: 'superadmin' };

  const adminDoc = await getDoc(doc(db, 'admins', user.uid));
  if (adminDoc.exists()) return { role: 'superadmin' };

  // Check if Telegram group admin
  // Get user's telegramId from residents/{uid}
  // Call WORKER_URL/admin/check-admin?telegramId={id}
  // Returns { isAdmin: true, groups: [groupId1, groupId2] }
  // If isAdmin → return { role: 'group_admin', allowedGroups: [...] }

  return { role: 'none' };  // redirect to /society/
}
```

---

### 4B — Create society/admin.html (three tabs)

**Tab 1 — Residents** (superadmin only — hide tab for group admins)

```
[Filter: All | Pending | Approved | Rejected]
[Table: Flat | Name | Email | Reg. Date | Status | Actions]
[Actions: ✅ Approve | ❌ Reject (for pending rows)]
```

Approve:
```javascript
await updateDoc(doc(db, 'residents', uid), {
  status: 'approved',
  approvedBy: currentUser.email,
  approvedAt: serverTimestamp()
});
```

Reject: same but `status: 'rejected'`.

---

**Tab 2 — Announcements** (superadmin only — hide tab for group admins)

```
[Post New Announcement]
  Title input + Body textarea + Post button

[Past Announcements]
  Title | Posted date | Posted by | 🗑️ Delete
```

Post:
```javascript
await addDoc(collection(db, 'announcements'), {
  title, body,
  createdAt: serverTimestamp(),
  postedBy: currentUser.email
});
```

---

**Tab 3 — Group Moderation** (both tiers — superadmin sees all groups, group admin sees only their group)

```
[Group dropdown] — superadmin: all groups | group admin: their group only

[Group info card: name | member count | bot status]

[Member search by name/username]

[Member list: Avatar | Name | Username | Role | Actions]
  🔇 Mute (24h)
  🚫 Ban
  ⚠️ Warn (stored in Firestore, auto-ban at 3 warnings)
  👁️ Warning count badge
```

Warn + auto-ban logic:
```javascript
const warningRef = doc(db, 'warnings', groupId, 'members', String(userId));
const snap = await getDoc(warningRef);
const count = snap.exists() ? snap.data().count + 1 : 1;
await setDoc(warningRef, {
  count,
  lastWarning: serverTimestamp(),
  warnedBy: currentUser.email
});
if (count >= 3) {
  // Trigger ban via WORKER_URL/admin/ban
}
```

---

**Tab 4 — Resident Feedback** (superadmin only — hide for group admins)

```
[Filter: All | New | Reviewed]

[Feedback table]
  Type | Flat | Resident | Message (truncated) | Received | Status | Actions

[Actions per row:]
  👁️ View full message (expand inline)
  ✅ Mark as Reviewed
```

Data source: Firestore `feedback` collection, ordered by `createdAt` descending.

Mark reviewed:
```javascript
await updateDoc(doc(db, 'feedback', docId), {
  status: 'reviewed',
  reviewedBy: currentUser.email,
  reviewedAt: serverTimestamp()
});
```

Note: Feedback is platform-only (website bugs, suggestions, bot issues).
Society complaints are handled via MyGate — not stored here.
To follow up with a resident, use their email shown in the row directly from Gmail.

---

### 4C — Add admin API endpoints to Worker

```bash
grep -n "if (endpoint" src/index.js | head -20
# Insert after existing endpoints
```

Add auth verification helper:
```javascript
async function verifyAdminRequest(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;
  const idToken = authHeader.replace('Bearer ', '');
  // Use existing verifyFirebaseToken() pattern from codebase
  // Return { uid, email } or null
}
```

**GET /admin/groups:**
- Verify requester is admin
- Return list of all groups bot manages (from KV or config)
- For each group call Telegram `getChat` to get name + member count

**GET /admin/members?groupId=X:**
- Verify requester has access to groupId
- Call Telegram `getChatAdministrators` for admin list
- Return members with role info

**POST /admin/mute:**
```javascript
// Body: { groupId, userId, duration: 86400 }
// Verify access to groupId
await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/restrictChatMember`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: groupId,
    user_id: userId,
    permissions: { can_send_messages: false },
    until_date: Math.floor(Date.now() / 1000) + duration
  })
});
```

**POST /admin/ban:**
```javascript
// Body: { groupId, userId }
// Verify access to groupId
await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/banChatMember`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: groupId, user_id: userId })
});
```

**GET /admin/check-admin?telegramId=X:**
- Check if telegramId is admin in any managed group via `getChatAdministrators`
- Return `{ isAdmin: bool, groups: [groupIds] }`

All admin endpoints: add `society.psots.in` to CORS allowed origins.

---

### 4D — Remove old admin UI from Worker

```bash
grep -n "Community Lobby\|psots-admin\|Select a Community" src/index.js | head -10
```

Once society/admin.html is live and verified working:
- Remove the `/admin` HTML-serving route from `src/index.js`
- Worker becomes API-only — no HTML serving
- `telegram.psots.in/admin` will return 404 — expected, no redirect needed

---

### 4E — Firestore rules update

Add to firestore.rules:
```
match /warnings/{groupId}/members/{userId} {
  allow read, write: if isAdmin();
}
match /admins/{uid} {
  allow read: if request.auth != null;
  allow write: if isSuperAdmin();
}
match /feedback/{docId} {
  allow read, write: if isSuperAdmin();
  allow create: if request.auth != null;  // Any logged-in resident can submit
}

function isAdmin() {
  return isSuperAdmin() ||
    exists(/databases/$(database)/documents/admins/$(request.auth.uid));
}
function isSuperAdmin() {
  return request.auth.token.email == 'pushkalkishore@gmail.com';
}
```

---

### 4F — Cleanup (run after all phases verified working)

```bash
# Remove old root-level pages that were NOT removed in Phase 3
# (anything still in repo root that now lives under society/)
git rm -f admin.html 2>/dev/null || true

# Remove any temp files, build artifacts, or leftover migration files
find . -name "*.tmp" -o -name "*.bak" -o -name ".DS_Store" | xargs git rm -f 2>/dev/null || true

# Remove any old society.html if still present
git rm -f society.html 2>/dev/null || true
```

Update CODEBASE_INDEX.md — add final state:
- All 4 phases complete date
- New Worker endpoints: `/auth/send-email-otp`, `/auth/verify-email-otp`, `/resident/feedback`, `/admin/groups`, `/admin/members`, `/admin/mute`, `/admin/ban`, `/admin/check-admin`
- Removed: old `/admin` HTML route from Worker
- Feedback: Firestore `feedback` collection + email to pushkalkishore@gmail.com via Resend

---

### 4G — Phase 4 final commit
```bash
firebase deploy --only firestore:rules --project psots-society-25899

git add society/admin.html src/index.js firestore.rules CODEBASE_INDEX.md
git commit -m "Phase 4: Unified admin panel — residents, announcements, group moderation, feedback"
git pull --rebase origin main
git push origin main
```

---

## ⛔ STOP POINT 4 — ALL PHASES COMPLETE
## Final verification:
## - society.psots.in/admin loads, redirects to login if not authenticated
## - Superadmin sees: Residents + Announcements + Group Moderation + Feedback tabs
## - Group admin sees: Group Moderation tab only (their group only)
## - Approve/reject updates Firestore residents collection
## - Announcements post to Firestore and appear on society/index.html dashboard
## - Mute/ban calls Worker endpoints and executes Telegram API action
## - Warn stores in Firestore warnings collection, auto-bans at 3 warnings
## - Resident feedback form on profile page sends email + stores in Firestore
## - Admin feedback tab shows all submissions, mark-reviewed works
## - telegram.psots.in/admin returns 404 (old panel removed from Worker)
## - Repo is clean — no leftover .tmp, .bak, old root pages
## - CODEBASE_INDEX.md reflects final state
## ⛔

---

## Architecture Summary (post all phases)

```
psots.in                    → public, no auth, MySociety CTA
society.psots.in            → resident portal (login required)
society.psots.in/admin      → unified admin panel (2-tier access)
telegram.psots.in           → Worker API only (bot + OTP + admin endpoints)
telegram.psots.in/admin     → 404 (removed)
```

**Duplicate flat protection (Phase 0):**
- `flats/{flatNumber}` checked before any Firestore write
- All 3 writes atomic via writeBatch — no partial state
- All 3 login methods (Google / Telegram OTP / Email OTP) resolve to same UID
- Login ≠ Registration. Unknown identity = not_registered error.

---

*MySociety — Built for Prestige Song of the South*
*society.psots.in | psots.in | @psots_telegram_bot*
*Last updated: April 14, 2026*
