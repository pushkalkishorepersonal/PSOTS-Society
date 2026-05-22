# PSOTS Redesign — Final Haiku Prompt Sequence (tailored to actual repo)

**Repo profile (what Haiku should assume):**
- Worker code lives in `src/` (currently `index.js`, `store.js`, `telegram.js`, `templates.js`)
- Frontend JS lives in `js/` (already has `core/`, `services/`, `pages/`, `components/`, `utils/`, `config/`)
- HTML pages live in root + `society/`
- CSS lives in `css/`
- Docs live in `/docs/` — but root also has ~14 legacy markdown files (to be consolidated in Prompt 0A)
- Deploy: GitHub Actions → Cloudflare Pages + Workers
- KV already bound: `VIOLATIONS`, `AUDIT_LOG`. Need to add `SESSIONS_KV` and `CACHE_KV` in Prompt 5 and 6.
- Firebase used BOTH in Worker (server: `firebase-admin`) AND frontend (client: `firebase`). Adapter treats them as two separate backends — see Prompt 3.
- No real users. Refactor boldly on a branch, verify, merge.

**Branch strategy:**
- Create branch `refactor/architecture-v3` at start of Prompt 0A.
- All prompts commit to this branch.
- Only merge to `main` after Prompt 8 completes AND Phase 2 smoke test passes.

**Before EVERY prompt, tell Haiku this one-liner:**
> Read `/docs/ARCHITECTURE.md`, `/docs/DECISIONS.md`, `/docs/FEATURE_STATUS.md`, `/docs/ROADMAP.md`, and `/docs/CURRENT_STATE.md` (if exists) first. Then start. Stop and ask if anything conflicts with the repo as it exists today.

---

## DOC_SYNC block (referenced by every prompt)

```
DOC_SYNC — run as the final step of every prompt:

1. /docs/FEATURE_STATUS.md
   - Find every row affected.
   - Update Status (DONE / PARTIAL / MISSING).
   - Update Notes with file paths touched (use actual paths, not generic ones).
   - Update Blocker column (— if cleared, specific if still blocked).
   - If this unblocked other rows, update their blocker column.
   - Update Summary counts at bottom.
   - Update "Last audited" date and "Next action" line.

2. /docs/ROADMAP.md
   - If feature moved to DONE: add to "Completed" with today's date.
   - If in progress: update "In Progress" table.
   - Update footer: Last updated, Last completed, Next to build.
   - If any Open question got resolved, move it to DECISIONS.md.

3. /docs/ARCHITECTURE.md
   - New collections/fields → update schema.
   - New Worker routes → update routes table.
   - New adapter functions → update adapter contract.
   - No structural change → add "Last reviewed: YYYY-MM-DD" line at top of affected section.

4. /docs/DECISIONS.md
   - Only if this prompt made a NEW decision.
   - Format: short heading + date + decision + reason. One paragraph.
   - Skip if no new decision.

5. Commit format:
   "type: short summary

   Code: list of files changed
   Docs: FEATURE_STATUS + ROADMAP [+ ARCHITECTURE] [+ DECISIONS]"

6. After commit, print:
   - What code changed
   - What docs changed
   - Updated DONE / PARTIAL / MISSING counts
   - Next prompt to run
   - Any new open questions
```

---

## PROMPT 0A — Cleanup, archive, consolidate

```
Read /docs/ARCHITECTURE.md, /docs/DECISIONS.md, /docs/FEATURE_STATUS.md, /docs/ROADMAP.md first.

TASK: Clean up the repo surface before any refactor. Zero logic changes.

Create branch:
  git checkout -b refactor/architecture-v3

STEP 1 — Move non-code assets out of repo root.

Create /archive/ folder (gitignored via new entry in .gitignore).
Move into /archive/:
  All IMG_20260322_*.jpg files (25 images)
  Ganapati.png
  GitHub.vscode-github-actions-0.31.3.vsix
  FETCH_HEAD
  All PDFs in root:
    ListofPenalties*.pdf
    Prestige Song of the South Phase-2.pdf
    PSOTS - Brochure-min.pdf
    PSOTS - PHASE 1 Occupnacy Certificate.pdf
    PSOTS - PHASE II Occupancy Certificate.pdf
    PSOTS TG Owners Group Etiquettes.pdf
    PSOTS_RulesofResidency_Final_*.pdf
    PSOTS-DODByelawsd8db14b35b5a_*.pdf

Add /archive/ to .gitignore so these don't come back.

STEP 2 — Consolidate markdown sprawl.

Create /docs/_legacy/ and move these into it:
  ADMIN_GUIDE.md
  ARCHITECTURE_AND_ROADMAP.md
  BOT_DOCUMENTATION.md
  CODEBASE_INDEX.md
  EMAIL_USAGE.md
  GEMINI.md
  MEMBER_GUIDE.md
  MySociety_Migration_Prompt.md
  PSOTS_FlatNumber_Logic.md
  PSOTS_PLATFORM_ROADMAP.md
  REDESIGN_SUMMARY.md
  SESSION_2026-04-20_SUNDAY.md
  TECHNICAL_ENCYCLOPEDIA.md

KEEP at root:
  README.md
  CLAUDE.md

DELETE (obsolete — already superseded by /docs/):
  (none for now — move to _legacy instead, safer)

Update README.md — short version only. Keep 10 lines max:
  Title, one-line description, link to /docs/ARCHITECTURE.md, link to /docs/ROADMAP.md,
  deploy command, contact info. Nothing else.

STEP 3 — Audit duplicate files.

Run:
  find . -name "device.js" -not -path "./node_modules/*" -not -path "./promo-video/*"
  find . -name "admin.html" -not -path "./node_modules/*"
  find . -name "firebase.js" -not -path "./node_modules/*" -not -path "./promo-video/*"

Report any duplicates. Do NOT delete yet — flag in /docs/_refactor_targets.md under section "Duplicate files to reconcile".

STEP 4 — Classify Python scripts.

Add /scripts/README.md that notes:
  "One-time utility scripts. Not part of deployed application. Python 3."

STEP 5 — Leave promo-video/ alone.
  It's a standalone Remotion project. Do not touch it.

Then run DOC_SYNC:
  FEATURE_STATUS.md → add new row "Repo cleanup (Phase 0A)" = DONE. Notes: "Root cleaned, docs consolidated, archive folder created."
  ROADMAP.md → add to Completed.
  ARCHITECTURE.md → no structural change, add "Last reviewed" line to section 3 (folder structure).
  DECISIONS.md → add new decision:
    "Repo hygiene policy — YYYY-MM-DD
    Decision: Non-code assets (images, PDFs, .vsix) live in /archive/ (gitignored).
    Legacy docs live in /docs/_legacy/. Only CLAUDE.md and README.md remain at root.
    Reason: Haiku and future maintainers need a clean surface. Root should be navigable in 10 seconds."

Commit per DOC_SYNC rule 5.
```

---

## PROMPT 0B — Inventory current behaviour (source of truth)

```
Read /docs/ARCHITECTURE.md, /docs/DECISIONS.md, /docs/FEATURE_STATUS.md, /docs/ROADMAP.md first.

TASK: Create /docs/CURRENT_STATE.md — the authoritative snapshot of what the code does today.
Zero code changes. This is a read-only audit.

For each of the sections below, READ the actual source files (use the exact paths) and write what's there.

SECTION 1 — Worker routes (from src/index.js)
  For every route handler in src/index.js, record:
    Method | Path | Auth required | Handler function name | What it does (1 line)
  Format as a markdown table.

SECTION 2 — Worker helper modules
  src/store.js — list every exported function with a 1-line description.
  src/telegram.js — list every exported function with a 1-line description.
  src/templates.js — list every exported template.

SECTION 3 — Frontend services (js/services/*.service.js)
  For each service file, list exported functions with 1-line descriptions.

SECTION 4 — Frontend pages (js/pages/*/index.js)
  For each page, list what services it imports and what Firebase calls it makes directly.

SECTION 5 — Firestore collections used
  Grep for collection('...') and doc('...') across src/ and js/.
  List every unique collection name found, with which files read/write it.

SECTION 6 — Environment variables + secrets
  Read wrangler.toml and .env.example (if exists).
  Read .github/workflows/deploy.yml.
  List every env var or secret name referenced.

SECTION 7 — KV usage
  Grep for VIOLATIONS and AUDIT_LOG in src/.
  Document key patterns used (e.g., "violations:{chatId}:{userId}").

SECTION 8 — External integrations
  Search for fetch() calls to external URLs across src/.
  List every external service hit (Telegram API, Resend, Firebase, Gemini, etc.).
  Record the environment variable that holds the credential.

SECTION 9 — Cron / scheduled tasks
  From wrangler.toml triggers.crons, list schedules.
  From src/index.js scheduled() handler, record what runs.

SECTION 10 — Known behaviour that MUST NOT BREAK
  Based on sections 1-9, write a "Do Not Break" checklist:
    - Google login flow
    - Email OTP flow
    - Telegram OTP flow
    - Telegram bot moderation
    - Admin approval queue
    - Scheduled cron job (if any)
  Each item: what to manually test after each refactor prompt.

Save as /docs/CURRENT_STATE.md. This file is referenced by every subsequent prompt.

Then run DOC_SYNC:
  FEATURE_STATUS.md → add new row "Current state inventory (Phase 0B)" = DONE.
  ROADMAP.md → add to Completed.
  ARCHITECTURE.md → section 9 routes table: reconcile with SECTION 1 of CURRENT_STATE.md. If routes differ, the CURRENT_STATE is truth — update ARCHITECTURE.md.
  DECISIONS.md → no new decision.

Commit per DOC_SYNC rule 5.

At the end, print a one-paragraph summary:
  "The platform currently has X routes, uses Y Firestore collections, Z external integrations.
  The most critical flow to preserve is: ___.
  The most at-risk behaviour during refactor is: ___."
```

---

## PROMPT 0C — Baseline tests, ESLint, CI guardrails

```
Read /docs/ARCHITECTURE.md, /docs/DECISIONS.md, /docs/CURRENT_STATE.md first.

TASK: Establish quality gates BEFORE any code refactor starts.

STEP 1 — Add Vitest for unit tests.

Update package.json:
  Add devDependencies:
    "vitest": "^1.6.0"
  Add scripts:
    "test": "vitest run"
    "test:watch": "vitest"
    "test:coverage": "vitest run --coverage"

Create vitest.config.js:
  export default {
    test: {
      environment: 'node',
      include: ['**/*.test.js'],
      exclude: ['node_modules', 'promo-video', 'archive'],
    }
  };

Create /tests/ folder with /tests/README.md explaining:
  - Unit tests live next to source (*.test.js) OR in /tests/unit/
  - Smoke tests live in /tests/smoke/
  - Run locally: npm test
  - CI runs on every push.

STEP 2 — Add ESLint (minimal ruleset for solo maintainer).

Install:
  npm install --save-dev eslint @eslint/js

Create eslint.config.mjs at repo root:
  import js from '@eslint/js';
  export default [
    js.configs.recommended,
    {
      ignores: ['node_modules', 'promo-video', 'archive', 'docs', '.omc', 'scripts'],
      languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
      rules: {
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        'no-console': 'off',
        'prefer-const': 'warn',
      }
    }
  ];

Add to package.json scripts:
  "lint": "eslint src/ js/ --max-warnings 100"

STEP 3 — Add architectural lint check.

Create /scripts/check-architecture.js:
  Purpose: fail CI if Firebase is imported outside src/db/.
  Logic (in plain Node, no deps):
    Walk src/ and js/ recursively.
    For each .js file, read content.
    If file path is NOT in [src/db/firebase.js, src/db/firebase-admin.js] AND content contains "from 'firebase" or "from 'firebase-admin":
      Print offending file + line.
    If any offenders found, exit 1.

Add to package.json scripts:
  "check:arch": "node scripts/check-architecture.js"

IMPORTANT: In this prompt, check:arch will FAIL because adapter doesn't exist yet.
That is expected. The script exists now so Prompt 4 can verify its own success.
Add a comment at top of check-architecture.js:
  // This script will fail until Prompt 4 (refactor imports) completes. That is by design.

STEP 4 — Update GitHub Actions.

Edit .github/workflows/deploy.yml — add a test+lint job that runs BEFORE deploy:

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint
      - run: npm test
      # check:arch is commented out until Prompt 4 completes
      # - run: npm run check:arch

  deploy:
    needs: quality
    # ... existing deploy steps

STEP 5 — Write 5 baseline smoke tests (do not test behaviour yet — just wire them up).

Create /tests/unit/smoke.test.js:
  import { describe, it, expect } from 'vitest';
  describe('smoke', () => {
    it('math works', () => { expect(1+1).toBe(2); });
    it('string concat works', () => { expect('a'+'b').toBe('ab'); });
    it('arrays work', () => { expect([1,2,3].length).toBe(3); });
    it('objects work', () => { expect({a:1}.a).toBe(1); });
    it('async works', async () => { expect(await Promise.resolve(5)).toBe(5); });
  });

Run: npm test
Confirm all 5 pass.
Run: npm run lint
Confirm it exits 0 (may have warnings, but no errors).

Then run DOC_SYNC:
  FEATURE_STATUS.md → add rows under new "Quality gates" section:
    "Vitest setup" = DONE
    "ESLint config" = DONE
    "Architecture lint check (scripts/check-architecture.js)" = DONE (will pass after Prompt 4)
    "CI quality job in deploy.yml" = DONE
  ROADMAP.md → add "Quality gates" to Completed. Update footer: Next to build = "Folder restructure (Prompt 1)".
  ARCHITECTURE.md → add a new section 15 "Quality Gates" listing all 4 mechanisms above.
  DECISIONS.md → add decision:
    "Quality gates before refactor — YYYY-MM-DD
    Decision: Vitest + ESLint + architecture lint check + GitHub Actions quality job are installed BEFORE any code refactor.
    Reason: Refactoring without tests/lint guarantees regressions. Quality gates catch them in CI instead of production."

Commit per DOC_SYNC rule 5.
```

---

## PROMPT 1 — Folder restructure (Worker only)

```
Read /docs/ARCHITECTURE.md, /docs/DECISIONS.md, /docs/CURRENT_STATE.md first.

TASK: Restructure the Worker code to match Architecture v3 sections 3 and 9.

The Worker today has 4 files in src/. After this prompt it will have the layered structure.

Create folders:
  src/routes/
  src/middleware/
  src/services/
  src/db/
  src/constants/
  src/utils/

STEP 1 — Split src/index.js by route group.

Using CURRENT_STATE.md SECTION 1 as reference, move handlers by group:

  /auth/*                   → src/routes/auth.routes.js
  /device/*                 → src/routes/device.routes.js
  /invite/*                 → src/routes/invite.routes.js
  /family/*                 → src/routes/family.routes.js
  /admin/*                  → src/routes/admin.routes.js
  /resident/*               → src/routes/resident.routes.js
  /vendor/*  (if exists)    → src/routes/vendor.routes.js
  /order/*   (if exists)    → src/routes/order.routes.js
  /webhook/telegram         → src/routes/telegram.routes.js
  /notify-registration      → src/routes/notify.routes.js

Each routes file exports:
  export async function handleXxx(request, env, ctx) { ... }

src/index.js becomes a thin router:
  Reads path + method, dispatches to the right handler.
  Top of file: imports all route handlers.
  ~50 lines max.

STEP 2 — Extract shared helpers.

  Move store.js logic → src/db/firebase.js (Firebase calls only)
                       → src/services/{resident,family,invite,admin,...}.service.js (business logic)
  Move telegram.js → src/services/telegram.service.js
  Move templates.js → src/services/templates.service.js

STEP 3 — Move what's movable, leave logic untouched.

This prompt is a STRUCTURAL move only. Do NOT rewrite logic. Just relocate and update import paths.

STEP 4 — Run verification.

  npm run lint      → should pass with warnings only
  npm test          → baseline smoke tests should still pass
  wrangler deploy --dry-run   → should compile without errors

If wrangler dry-run fails, fix imports until it passes.

STEP 5 — Track Firebase import locations for Prompt 4.

  grep -rn "from 'firebase\|from 'firebase-admin" src/ js/ --include="*.js" > docs/_refactor_targets.md

  Header: "Files importing Firebase directly. Target of Prompt 4 refactor."

Then run DOC_SYNC:
  FEATURE_STATUS.md → add rows:
    "Worker routes split by group" = DONE
    "src/services/ layer created" = DONE
    "src/db/ folder created" = DONE (adapter.js still missing — Prompt 3)
  ROADMAP.md → update In Progress: "Folder restructure" = DONE. Next = "PII masking module".
  ARCHITECTURE.md → section 3 (folder structure): update to match what was actually created.
  DECISIONS.md → no new decision.

Commit per DOC_SYNC rule 5.
```

---

## PROMPT 2 — Build src/db/pii.js + tests

```
Read /docs/ARCHITECTURE.md section 6 and /docs/DECISIONS.md first.

TASK: Create src/db/pii.js with masking functions + real unit tests.

Create src/db/pii.js:

export function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const [local, domain] = email.split('@');
  if (!local || !domain) return '';
  return local[0] + '***@' + domain;
}

export function maskPhone(phone) {
  if (!phone) return '';
  const clean = String(phone).replace(/\D/g, '').slice(-10);
  if (clean.length < 10) return '';
  return '+91 ' + clean.slice(0,2) + 'XXX X' + clean.slice(-4);
}

export function maskName(fullName) {
  if (!fullName || typeof fullName !== 'string') return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return parts[0] + ' ' + parts[parts.length-1][0] + '.';
}

export function sanitizeForAdmin(r) {
  if (!r) return null;
  return {
    uid: r.uid,
    flatNumber: r.flatNumber,
    displayName: maskName(r.name || r.firstName || ''),
    email: maskEmail(r.email || ''),
    phone: maskPhone(r.phone || ''),
    relation: r.relation || '',
    accessLevel: r.accessLevel || 'owner',
    loginMethod: r.loginMethod || '',
    status: r.status || 'pending',
    createdAt: r.createdAt || '',
    invitedByFlat: r.invitedByFlat || '',
  };
}

export function sanitizeForResident(r, requestingUid) {
  if (!r) return null;
  if (r.uid === requestingUid) return r;
  return sanitizeForAdmin(r);
}

export function sanitizeForPublic(r) {
  if (!r) return null;
  return {
    flatNumber: r.flatNumber,
    displayName: maskName(r.name || ''),
  };
}

Create src/db/pii.test.js:

import { describe, it, expect } from 'vitest';
import {
  maskEmail, maskPhone, maskName,
  sanitizeForAdmin, sanitizeForResident, sanitizeForPublic
} from './pii.js';

describe('maskEmail', () => {
  it('masks gmail', () => expect(maskEmail('[email protected]')).toBe('p***@gmail.com'));
  it('handles empty', () => expect(maskEmail('')).toBe(''));
  it('handles malformed', () => expect(maskEmail('notanemail')).toBe(''));
  it('handles null', () => expect(maskEmail(null)).toBe(''));
});

describe('maskPhone', () => {
  it('masks indian', () => expect(maskPhone('+919480948904')).toBe('+91 94XXX X8904'));
  it('masks 10-digit', () => expect(maskPhone('9480948904')).toBe('+91 94XXX X8904'));
  it('handles too-short', () => expect(maskPhone('123')).toBe(''));
  it('handles empty', () => expect(maskPhone('')).toBe(''));
});

describe('maskName', () => {
  it('masks two-part', () => expect(maskName('Pushkal Kishore')).toBe('Pushkal K.'));
  it('masks three-part', () => expect(maskName('Pushkal Kishore Raj')).toBe('Pushkal R.'));
  it('keeps single', () => expect(maskName('Pushkal')).toBe('Pushkal'));
  it('handles empty', () => expect(maskName('')).toBe(''));
});

describe('sanitizeForResident', () => {
  const me = { uid: 'u1', name: 'Test User', email: '[email protected]', flatNumber: '101' };
  it('returns full for own uid', () => {
    expect(sanitizeForResident(me, 'u1').email).toBe('[email protected]');
  });
  it('masks for others', () => {
    expect(sanitizeForResident(me, 'u2').email).toBe('t***@x.com');
  });
});

describe('sanitizeForPublic', () => {
  it('only exposes flat + masked name', () => {
    const result = sanitizeForPublic({ uid: 'u1', name: 'Test User', email: '[email protected]', phone: '9999999999', flatNumber: '101' });
    expect(result).toEqual({ flatNumber: '101', displayName: 'Test U.' });
    expect(result.email).toBeUndefined();
    expect(result.phone).toBeUndefined();
  });
});

Run: npm test
All tests must pass.

Then run DOC_SYNC:
  FEATURE_STATUS.md → flip to DONE:
    maskEmail(), maskPhone(), maskName(), sanitizeForAdmin(), sanitizeForResident()
    Add new row: "sanitizeForPublic()" = DONE
  Wiring rows stay MISSING — those are Prompt 7.
  Update Summary counts.
  ROADMAP.md → PII masking functions = DONE. Wiring still pending.
  ARCHITECTURE.md → section 6: flip function statuses to ✅. Wiring rows unchanged.
  DECISIONS.md → no new decision.

Commit per DOC_SYNC rule 5.
```

---

## PROMPT 3 — Adapter shell with return-shape contract

```
Read /docs/ARCHITECTURE.md section 4 and /docs/DECISIONS.md first.

TASK: Create src/db/adapter.js as a pass-through shell over src/db/firebase.js.
No behaviour changes. This establishes the contract.

STEP 1 — Create src/db/firebase.js.

Move Firebase-admin calls currently in src/services/*.service.js into src/db/firebase.js.
Each function returns:
  Reads: { data, error }   where error is null on success
  Writes: { ok, id, error } where ok is true on success

Example pattern:

  import admin from 'firebase-admin';
  import { initFirebaseAdmin } from './firebase-init.js';

  const db = () => initFirebaseAdmin().firestore();

  export async function getResident(uid) {
    try {
      const snap = await db().collection('residents').doc(uid).get();
      if (!snap.exists) return { data: null, error: null };
      return { data: { uid, ...snap.data() }, error: null };
    } catch (e) {
      return { data: null, error: e.message };
    }
  }

  export async function saveResident(data) {
    try {
      const uid = data.uid;
      await db().collection('residents').doc(uid).set(data, { merge: true });
      return { ok: true, id: uid, error: null };
    } catch (e) {
      return { ok: false, id: null, error: e.message };
    }
  }

Create src/db/firebase-init.js — single place that initialises firebase-admin with env credentials.
Services must NOT initialise Firebase themselves after this prompt.

STEP 2 — Create src/db/adapter.js.

  import * as backend from './firebase.js';

  // Residents
  export const getResident = (uid) => backend.getResident(uid);
  export const getResidentByFlat = (flatNumber) => backend.getResidentByFlat(flatNumber);
  export const listResidents = (opts) => backend.listResidents(opts);
  export const saveResident = (data) => backend.saveResident(data);
  export const updateResidentStatus = (uid, status, reason) => backend.updateResidentStatus(uid, status, reason);

  // Family
  export const getFamilyMembers = (flatNumber) => backend.getFamilyMembers(flatNumber);
  export const getFamilyMember = (flatNumber, memberId) => backend.getFamilyMember(flatNumber, memberId);
  export const saveFamilyMember = (flatNumber, data) => backend.saveFamilyMember(flatNumber, data);
  export const updateFamilyMemberStatus = (flatNumber, memberId, status) => backend.updateFamilyMemberStatus(flatNumber, memberId, status);
  export const deleteFamilyMember = (flatNumber, memberId) => backend.deleteFamilyMember(flatNumber, memberId);

  // Tenants
  export const getTenant = (tenantId) => backend.getTenant(tenantId);
  export const getTenantByFlat = (flatNumber) => backend.getTenantByFlat(flatNumber);
  export const saveTenant = (data) => backend.saveTenant(data);
  export const updateTenantStatus = (tenantId, status) => backend.updateTenantStatus(tenantId, status);
  export const getTenantFamily = (tenantId) => backend.getTenantFamily(tenantId);
  export const saveTenantFamilyMember = (tenantId, data) => backend.saveTenantFamilyMember(tenantId, data);

  // Invites
  export const saveInvite = (data) => backend.saveInvite(data);
  export const getInvite = (token) => backend.getInvite(token);
  export const updateInviteStatus = (token, status) => backend.updateInviteStatus(token, status);
  export const logInviteAudit = (data) => backend.logInviteAudit(data);
  export const listInviteAudit = (opts) => backend.listInviteAudit(opts);

  // Vendors & Orders
  export const getVendor = (flatNumber) => backend.getVendor(flatNumber);
  export const listVendors = (opts) => backend.listVendors(opts);
  export const saveVendor = (data) => backend.saveVendor(data);
  export const getVendorMenu = (flatNumber) => backend.getVendorMenu(flatNumber);
  export const saveVendorMenuItem = (flatNumber, data) => backend.saveVendorMenuItem(flatNumber, data);
  export const saveOrder = (data) => backend.saveOrder(data);
  export const getOrder = (orderId) => backend.getOrder(orderId);
  export const listVendorOrders = (flatNumber, opts) => backend.listVendorOrders(flatNumber, opts);
  export const listBuyerOrders = (flatNumber, opts) => backend.listBuyerOrders(flatNumber, opts);

  // Devices
  export const getDevice = (token) => backend.getDevice(token);
  export const saveDevice = (data) => backend.saveDevice(data);
  export const listResidentDevices = (uid) => backend.listResidentDevices(uid);

  // Violations (Telegram)
  export const getViolations = (chatId, userId) => backend.getViolations(chatId, userId);
  export const incrementViolation = (chatId, userId, details) => backend.incrementViolation(chatId, userId, details);
  export const listChatViolations = (chatId, opts) => backend.listChatViolations(chatId, opts);

  // Audit
  export const logAudit = (event) => backend.logAudit(event);

For any function not yet implemented in firebase.js, add a stub:
  export async function NAME(...args) { return { error: 'NOT_IMPLEMENTED' }; }

STEP 3 — Verify.

  npm run lint → pass
  npm test → pass
  wrangler deploy --dry-run → pass

Then run DOC_SYNC:
  FEATURE_STATUS.md → flip to DONE:
    "src/db/adapter.js created"
    "src/db/firebase.js (isolated implementation)"
  The row "No direct Firebase imports outside adapter" stays MISSING (Prompt 4).
  ROADMAP.md → DB adapter = PARTIAL (shell done, refactor pending).
  ARCHITECTURE.md → section 4 is the spec — no structural change, add "Last reviewed" line.
  DECISIONS.md → no new decision.

Commit per DOC_SYNC rule 5.
```

---

## PROMPT 4 — Refactor all Firebase imports to use adapter

```
Read /docs/_refactor_targets.md, /docs/ARCHITECTURE.md, /docs/DECISIONS.md first.

TASK: Replace every direct Firebase import in services and routes with adapter imports.

Scope:
  - Worker-side (src/): use src/db/adapter.js
  - Frontend-side (js/): frontend Firebase client SDK stays, but wrap in js/core/db.js
    (frontend cannot use firebase-admin — client SDK is correct for browser)

For Worker files listed in /docs/_refactor_targets.md that are under src/:
  1. Remove imports from 'firebase-admin' or direct backend files.
  2. Add: import * as db from '../db/adapter.js' (adjust path)
  3. Replace raw calls with adapter function calls.
  4. Handle { data, error } and { ok, id, error } return shapes.

Example before:
  import admin from 'firebase-admin';
  const snap = await admin.firestore().collection('residents').doc(uid).get();

Example after:
  import * as db from '../db/adapter.js';
  const { data, error } = await db.getResident(uid);
  if (error) return Response.json({ error }, { status: 500 });

For frontend files under js/:
  1. Create js/core/db.js — thin wrapper over js/core/firebase.js (which uses firebase client SDK).
  2. Export the same function names as src/db/adapter.js where applicable.
  3. Migrate js/services/*.service.js and js/pages/*/index.js to import from js/core/db.js.
  4. Keep js/core/firebase.js as the only place that imports 'firebase' directly.

Do this file-by-file. After each file:
  node -c <file>   OR   npm run lint

After all files done:
  npm run check:arch   → must now exit 0
  npm test             → must pass
  wrangler deploy --dry-run → must pass

STEP 2 — Enable architecture check in CI.

Edit .github/workflows/deploy.yml:
  Uncomment the `- run: npm run check:arch` line under the quality job.

STEP 3 — Smoke test key flows against CURRENT_STATE.md "Do Not Break" checklist.
  Don't deploy yet. Just reason through each flow with the new import structure and confirm logic is unchanged.

Then run DOC_SYNC:
  FEATURE_STATUS.md → flip to DONE:
    "No direct Firebase imports outside adapter"
    "src/db/firebase.js (isolated implementation)" (full done now)
    "Architecture lint check (scripts/check-architecture.js)" → update Notes: "Passing in CI"
  Update Summary counts.
  ROADMAP.md → Move "DB adapter layer" from In Progress to Completed. Update footer: Next = "KV session layer".
  ARCHITECTURE.md → section 6 DB Adapter table: flip every row to ✅.
  DECISIONS.md → no new decision.
  Delete /docs/_refactor_targets.md.

Commit per DOC_SYNC rule 5.
```

---

## PROMPT 5 — KV-backed sessions

```
Read /docs/ARCHITECTURE.md sections 7 and 9, /docs/DECISIONS.md first.

TASK: Replace Firebase ID token verification with KV-backed session cookies.

STEP 1 — Create KV namespace.

Tell user to run locally:
  wrangler kv:namespace create SESSIONS_KV
Paste returned id into wrangler.toml under [[kv_namespaces]]:
  [[kv_namespaces]]
  binding = "SESSIONS_KV"
  id = "<paste_here>"

STEP 2 — src/utils/tokens.js:

  export function generateSessionId() {
    return crypto.randomUUID() + '-' + Date.now().toString(36);
  }

STEP 3 — src/db/sessions.js:

  const TTL = 60 * 60 * 24 * 30; // 30 days

  export async function createSession(env, uid, metadata) {
    try {
      const sessionId = crypto.randomUUID() + '-' + Date.now().toString(36);
      const value = JSON.stringify({ uid, ...metadata, createdAt: Date.now(), lastSeen: Date.now() });
      await env.SESSIONS_KV.put(`session:${sessionId}`, value, { expirationTtl: TTL });
      return { ok: true, sessionId, error: null };
    } catch (e) { return { ok: false, sessionId: null, error: e.message }; }
  }

  export async function getSession(env, sessionId) {
    try {
      const raw = await env.SESSIONS_KV.get(`session:${sessionId}`);
      if (!raw) return { data: null, error: null };
      return { data: JSON.parse(raw), error: null };
    } catch (e) { return { data: null, error: e.message }; }
  }

  export async function touchSession(env, sessionId) {
    try {
      const { data } = await getSession(env, sessionId);
      if (!data) return { ok: false };
      data.lastSeen = Date.now();
      await env.SESSIONS_KV.put(`session:${sessionId}`, JSON.stringify(data), { expirationTtl: TTL });
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  export async function deleteSession(env, sessionId) {
    try {
      await env.SESSIONS_KV.delete(`session:${sessionId}`);
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  }

Add to src/db/adapter.js:
  import * as sessions from './sessions.js';
  export const createSession = (env, uid, meta) => sessions.createSession(env, uid, meta);
  export const getSession = (env, id) => sessions.getSession(env, id);
  export const touchSession = (env, id) => sessions.touchSession(env, id);
  export const deleteSession = (env, id) => sessions.deleteSession(env, id);

STEP 4 — src/middleware/auth.middleware.js:

  import * as db from '../db/adapter.js';

  export async function requireSession(request, env) {
    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(/psots_session=([^;]+)/);
    if (!match) return { error: 'NO_SESSION', status: 401 };
    const { data, error } = await db.getSession(env, match[1]);
    if (error || !data) return { error: 'INVALID_SESSION', status: 401 };
    await db.touchSession(env, match[1]);
    return { user: data };
  }

  export async function requireAdmin(request, env) {
    const session = await requireSession(request, env);
    if (session.error) return session;
    if (session.user.role !== 'admin') return { error: 'FORBIDDEN', status: 403 };
    return session;
  }

STEP 5 — Update auth routes (src/routes/auth.routes.js):

After successful Google/Email/Telegram OTP verification, call:
  const { sessionId } = await db.createSession(env, uid, { flatNumber, role });
  Set response header:
    'Set-Cookie': `psots_session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`

Add POST /auth/logout:
  Read cookie → db.deleteSession → return Set-Cookie that expires immediately.

STEP 6 — Update all routes that currently verify Firebase ID tokens.

Replace token verification with the new middleware:
  const session = await requireSession(request, env);
  if (session.error) return Response.json({ error: session.error }, { status: session.status });
  const user = session.user;

STEP 7 — Write unit tests in src/db/sessions.test.js.

Mock env.SESSIONS_KV with a simple Map and test:
  - createSession returns sessionId
  - getSession retrieves it
  - deleteSession removes it
  - getSession of deleted returns null

STEP 8 — Verify.
  npm test   → new tests pass
  npm run lint → pass
  wrangler deploy --dry-run → pass

Then run DOC_SYNC:
  FEATURE_STATUS.md → add rows:
    "KV-backed session cookies" = DONE
    "requireSession middleware" = DONE
    "requireAdmin middleware" = DONE
    "POST /auth/logout" = DONE
  ROADMAP.md → "KV session layer" = Completed. Next = "Cache + rate limiting".
  ARCHITECTURE.md → section 7 no change. Section 9 routes table: add /auth/logout.
  DECISIONS.md → add decision:
    "KV-backed session cookies — YYYY-MM-DD
    Decision: Sessions live in Cloudflare KV, not Firebase ID tokens.
    Reason: Firebase Auth verify adds 80-150ms per request. KV reads are 5-10ms and free at PSOTS scale.
    Firebase Auth still validates initial OAuth — only the session layer moved."

Commit per DOC_SYNC rule 5.
```

---

## PROMPT 6 — Cache layer + rate limiting

```
Read /docs/ARCHITECTURE.md sections 8 and 10, /docs/DECISIONS.md first.

TASK: Add read cache and rate limiting.

STEP 1 — KV namespace.

Tell user to run:
  wrangler kv:namespace create CACHE_KV
Paste id into wrangler.toml:
  [[kv_namespaces]]
  binding = "CACHE_KV"
  id = "<paste>"

STEP 2 — src/db/cache.js:

  export async function cacheGet(env, key) {
    try { const raw = await env.CACHE_KV.get(key); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  }

  export async function cacheSet(env, key, value, ttlSec) {
    try { await env.CACHE_KV.put(key, JSON.stringify(value), { expirationTtl: ttlSec }); }
    catch {}
  }

  export async function cacheDel(env, key) {
    try { await env.CACHE_KV.delete(key); } catch {}
  }

STEP 3 — Wrap reads in adapter.js.

For these functions, wrap with cache (in adapter, not in firebase.js):

  getResident(env, uid):
    const cached = await cacheGet(env, `resident:${uid}`);
    if (cached) return { data: cached, error: null };
    const result = await backend.getResident(uid);
    if (result.data) await cacheSet(env, `resident:${uid}`, result.data, 300);
    return result;

  Same pattern for:
    getResidentByFlat     cache key: resident:flat:{flat}     TTL 300
    getFamilyMembers      cache key: family:{flat}            TTL 120
    listVendors({active:true})  cache key: vendor:list:active  TTL 600
    getVendorMenu         cache key: vendor:menu:{flat}       TTL 300

For matching writes, invalidate BEFORE write:
  saveResident(data): cacheDel(env, `resident:${data.uid}`); cacheDel(env, `resident:flat:${data.flatNumber}`);
  updateResidentStatus(uid, ...): cacheDel(env, `resident:${uid}`);
  saveFamilyMember(flat, ...): cacheDel(env, `family:${flat}`);
  updateFamilyMemberStatus(flat, ...): cacheDel(env, `family:${flat}`);
  saveVendor(data): cacheDel(env, `vendor:list:active`); cacheDel(env, `vendor:menu:${data.flatNumber}`);
  saveVendorMenuItem(flat, ...): cacheDel(env, `vendor:menu:${flat}`);

STEP 4 — src/middleware/ratelimit.middleware.js:

  export async function rateLimit(env, identifier, bucket, maxPerMinute) {
    const window = Math.floor(Date.now() / 60000);
    const key = `rl:${bucket}:${identifier}:${window}`;
    const current = parseInt(await env.CACHE_KV.get(key) || '0', 10);
    if (current >= maxPerMinute) return { allowed: false };
    await env.CACHE_KV.put(key, String(current + 1), { expirationTtl: 120 });
    return { allowed: true };
  }

STEP 5 — Apply rate limits in src/index.js router.

  Before dispatching to handler:
    if (path.startsWith('/auth/'))       limit = await rateLimit(env, ip, 'auth', 5);
    else if (!session)                   limit = await rateLimit(env, ip, 'public', 30);
    else if (path.startsWith('/admin/')) limit = await rateLimit(env, session.uid, 'admin', 300);
    else                                 limit = await rateLimit(env, sessionId, 'session', 120);
    if (!limit.allowed) return Response.json({ error: 'RATE_LIMIT' }, { status: 429 });

  Skip rate limit for /webhook/telegram (shared-secret authenticated).

STEP 6 — Tests.

Create src/db/cache.test.js:
  Test cacheGet/Set/Del with mock env.CACHE_KV.

Create src/middleware/ratelimit.test.js:
  Test that rateLimit denies after N requests in same window.

STEP 7 — Verify.
  npm test → pass
  npm run lint → pass
  wrangler deploy --dry-run → pass

Then run DOC_SYNC:
  FEATURE_STATUS.md → add rows:
    "KV cache layer (src/db/cache.js)" = DONE
    "Cache invalidation on writes" = DONE
    "Rate limiting middleware" = DONE
    "Rate limits applied in router" = DONE
  ROADMAP.md → "Cache + rate limiting" = Completed. Next = "PII wiring at routes".
  ARCHITECTURE.md → sections 8 and 10 are the spec, no structural change.
  DECISIONS.md → no new decision.

Commit per DOC_SYNC rule 5.
```

---

## PROMPT 7 — Wire PII masking at every route

```
Read /docs/ARCHITECTURE.md section 6, /docs/DECISIONS.md, /docs/CURRENT_STATE.md first.

TASK: Apply PII masking at every route that returns resident data.

src/routes/admin.routes.js:
  GET /admin/residents:
    import { sanitizeForAdmin } from '../db/pii.js';
    const { data } = await db.listResidents(filters);
    return Response.json(data.map(sanitizeForAdmin));
  GET /admin/violations:
    Apply same pattern to embedded resident data.

src/routes/family.routes.js:
  GET /family/list:
    import { sanitizeForResident } from '../db/pii.js';
    const session = ctx.user;
    const { data } = await db.getFamilyMembers(env, session.flatNumber);
    return Response.json(data.map(m => sanitizeForResident(m, session.uid)));

src/routes/invite.routes.js:
  GET /invite/validate:
    import { sanitizeForPublic, maskEmail } from '../db/pii.js';
    return Response.json(sanitizeForPublic(invite.data));
  All invite_audit responses:
    Map joinerEmail → maskEmail(joinerEmail)
    Map inviterEmail → maskEmail(inviterEmail)

src/routes/vendor.routes.js:
  GET /vendor/list:
    return Response.json(data.map(sanitizeForPublic));
  GET /vendor/:flatNum:
    Return vendor with sanitizeForPublic applied.

src/routes/resident.routes.js:
  GET /resident/me:
    Return raw if session.uid === resident.uid (self-view).
    Otherwise sanitizeForResident(resident, session.uid).

Write smoke test tests/smoke/pii.smoke.test.js:

  import { describe, it, expect } from 'vitest';

  // Mock adapter + session to inject test data
  // For each endpoint, call the handler with a non-admin session.
  // Parse the JSON response body.
  // Assert it does NOT contain:
  //   - any '@gmail.com' or '@yahoo.com' as a FULL email
  //   - any 10-digit phone with no X's in it
  //   - any full-name with last word > 1 char

  // If assertion fails, print the offending field for debug.

  describe('PII leak smoke test', () => {
    it('GET /admin/residents never returns raw email', ...);
    it('GET /family/list masks other members', ...);
    it('GET /vendor/list only exposes public fields', ...);
    it('GET /invite/validate returns only public fields', ...);
    it('GET /resident/me returns full for self, masked for others', ...);
  });

Run: npm test → all must pass.

Then run DOC_SYNC:
  FEATURE_STATUS.md → flip to DONE ALL of these:
    GET /admin/residents uses masking
    GET /family/list uses masking
    Invite audit responses mask PII
    Admin panel shows masked email/phone/name
    Resident sees own full PII on profile
    GET /vendor/list masks (new row)
  Update Summary counts — expect big jump in DONE.
  ROADMAP.md → Move "PII masking" from In Progress to Completed. Remove "blocks resident onboarding" warning.
  Update footer: Next = "Family approval endpoints (Prompt 8)".
  ARCHITECTURE.md → section 6 masking table: flip every row to ✅.
  DECISIONS.md → no new decision.

Commit per DOC_SYNC rule 5.
```

---

## PROMPT 8 — Family approval endpoints + admin notice UI

```
Read /docs/ARCHITECTURE.md, /docs/DECISIONS.md, /docs/FEATURE_STATUS.md first.

TASK: Build the endpoints and UI to complete Phase 2.

STEP 1 — src/routes/family.routes.js — add three handlers:

  POST /family/approve
    Auth: requireSession + owner check
    Body: { memberId }
    Flow:
      - Verify session.flatNumber owns this flat (session.uid === flat.ownerUid)
      - db.updateFamilyMemberStatus(flatNumber, memberId, 'approved')
      - cacheDel(env, `family:${flatNumber}`)
      - notify.sendFamilyApprovalEmail(member.email, { flatNumber })
      - db.logAudit({ action: 'family.approve', flatNumber, memberId, by: session.uid, ts: Date.now() })
    Response: { ok: true }

  POST /family/reject
    Body: { memberId, reason }
    Same auth. Flow mirrors approve with 'rejected' status and rejection email.

  DELETE /family/:memberId
    Same auth.
    Flow: db.deleteFamilyMember + cacheDel + logAudit.
    Response: { ok: true }

STEP 2 — src/services/notify.service.js — add:

  sendFamilyApprovalEmail(to, { flatNumber })
  sendFamilyRejectionEmail(to, reason)

Use existing Resend integration pattern. Simple templates:
  Approval: "Hi, your request to join flat {flatNumber} on PSOTS Society has been approved. Log in at society.psots.in."
  Rejection: "Hi, your request to join flat {flatNumber} was not approved. Reason: {reason}. Contact the primary resident if you have questions."

STEP 3 — society/profile.html (or society/family.html if exists — check first).

Add a "Pending Family Members" section that:
  - Fetches GET /family/list
  - Filters where status === 'pending'
  - For each: shows name (masked for others, full if own), renders Approve + Reject + Remove buttons
  - On click: fetch() to POST /family/approve or /family/reject (with reason prompt) or DELETE /family/{id}
  - Refreshes list after action

STEP 4 — src/routes/admin.routes.js — add:

  GET /admin/notices
    Auth: requireAdmin
    Query invite_audit where action === 'joined' AND ackedBy is null.
    Return list, each row sanitizeForAdmin applied to joiner fields.

  POST /admin/notices/:id/ack
    Auth: requireAdmin
    Update invite_audit doc: ackedBy = session.uid, ackedAt = Date.now()
    Response: { ok: true }

STEP 5 — society/admin.html (update existing).

Add a "Notices" tab next to "Residents" and "Violations":
  - Fetches GET /admin/notices
  - Shows each notice with masked joiner email + flat number + date
  - Button: "Acknowledge" → POST /admin/notices/{id}/ack → removes from list

STEP 6 — Tests.

tests/smoke/family-approval.smoke.test.js:
  - Mock POST /family/approve with wrong uid (not owner) → 403
  - Mock POST /family/approve with correct owner → 200 + status updated
  - Mock DELETE /family/:id without owner → 403

Run: npm test → pass.

STEP 7 — Final verification.

  npm run lint → pass
  npm run check:arch → pass
  npm test → pass
  wrangler deploy --dry-run → pass

Then run DOC_SYNC:
  FEATURE_STATUS.md → flip to DONE:
    "Primary sees pending family tab"
    "Primary resident approves family member"
    "Primary resident rejects family member"
    "Approved family member gets email"
    "Admin acknowledges or flags family notice"
    Add new rows DONE:
      "GET /admin/notices", "POST /admin/notices/:id/ack"
      "DELETE /family/:memberId"
  Update Summary counts.
  ROADMAP.md → Move "Family approval by primary resident" and "Admin notice UI" to Completed.
  Update footer: Last completed = "Family approval + admin notices", Next = "Onboarding modal + email delivery verification + tenant flow completion".
  ARCHITECTURE.md → section 9 routes table: confirm /family/approve, /family/reject, DELETE /family/:memberId, /admin/notices, /admin/notices/:id/ack are present.
  DECISIONS.md → no new decision.

Commit per DOC_SYNC rule 5.

FINAL STEP — Phase 2 completion report:

Print:
  - % of Phase 2 complete (based on FEATURE_STATUS counts)
  - Remaining Phase 2 items (onboarding modal, email delivery verification, tenant flow)
  - Safe to onboard real residents? YES/NO — yes only if both PII masking AND family approval show DONE.
  - Recommended next action.

Then merge to main:
  git checkout main
  git merge refactor/architecture-v3
  git push origin main

GitHub Actions will deploy to production. Monitor Wrangler logs for 1 hour.
```

---

## Execution sequence (the checklist)

Run in this exact order. Do NOT skip, do NOT reorder.

| # | Prompt | What it does | Gate before running |
|---|--------|--------------|---------------------|
| 0A | Cleanup & archive | Remove root junk, consolidate docs | None — run first |
| 0B | Inventory current state | Create /docs/CURRENT_STATE.md | 0A complete |
| 0C | Quality gates | Vitest + ESLint + CI + arch check | 0B complete |
| 1 | Folder restructure | Worker split into routes/services/db | 0C complete, CI passing |
| 2 | pii.js + tests | Masking functions with unit tests | 1 complete |
| 3 | Adapter shell | adapter.js + firebase.js contract | 1 complete (2 not required) |
| 4 | Refactor imports | All Firebase goes through adapter | 3 complete |
| 5 | KV sessions | Replace Firebase ID token verify | 4 complete |
| 6 | Cache + rate limit | KV cache in adapter + middleware | 5 complete |
| 7 | Wire PII at routes | Apply masks at every endpoint | 2 + 6 complete |
| 8 | Family approval + notices | Close Phase 2 | 7 complete |

## Key operational rules

1. **One prompt per Haiku session.** Close the chat between prompts. This forces Haiku to re-read the docs at the start of each prompt — which is what keeps drift low.
2. **Never skip DOC_SYNC.** If Haiku commits without updating docs, push back: "You missed DOC_SYNC. Update FEATURE_STATUS, ROADMAP, ARCHITECTURE (if relevant), DECISIONS (if relevant), then re-commit."
3. **Stop if CI fails.** Do not move to the next prompt if `npm test` or `wrangler deploy --dry-run` is broken. Fix first.
4. **Branch discipline.** Everything happens on `refactor/architecture-v3`. Merge to `main` only after Prompt 8 passes.
5. **Stuck? Upload the specific file.** If Haiku gets lost on Prompt 4 (import refactor is the riskiest), zip up the specific route file it's struggling with and ask Haiku to do just that one file.

## Token budget estimate

Each prompt is ~600-1500 tokens when pasted into Haiku. Haiku's response + tool use will consume 5000-30000 tokens per prompt depending on complexity.

| Prompt | Estimated Haiku tokens |
|--------|------------------------|
| 0A | 5-10k (mostly file moves) |
| 0B | 15-25k (reads every source file) |
| 0C | 8-12k (new config files) |
| 1 | 30-50k (biggest — splits index.js) |
| 2 | 5-8k (small module + tests) |
| 3 | 15-25k (adapter + firebase.js scaffold) |
| 4 | 40-80k (refactor across many files — highest risk) |
| 5 | 20-30k (sessions + middleware) |
| 6 | 20-30k (cache + rate limit) |
| 7 | 15-25k (PII wiring) |
| 8 | 25-40k (new endpoints + UI) |

**Total estimate: 200-335k Haiku tokens across all 11 prompts.** Expect 3-4 Haiku sessions per prompt if it gets stuck. Budget accordingly.
