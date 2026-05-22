# PROMPT — Disable family features with "Coming Soon" messaging

Read `/docs/ARCHITECTURE.md` briefly.

## Goal

Family member features in profile.html are broken and being rebuilt in Sprint 3 of the identity refactor. Hide active functionality behind "Coming Soon" messaging so reviewers don't trigger broken flows, but signal that the feature is planned.

This is a UI-only change. No backend modifications.

## Branch

```
git checkout main
git pull --rebase origin main
git checkout -b fix/disable-family-ui
```

## Pre-check

```
git status                                              # clean
grep -n "openInviteModal\|+ Invite Family" society/profile.html | head -10
```

You should see the "+ Invite Family Member" button around line 244 and the `openInviteModal()` function somewhere.

## Step 1 — Replace the invite button's click handler

In `society/profile.html`, find the "+ Invite Family Member" button (around line 244):

```html
<button onclick="openInviteModal()">+ Invite Family Member</button>
```

Replace with:

```html
<button onclick="showFamilyComingSoon()" style="opacity: 0.7;">+ Invite Family Member · Coming Soon</button>
```

## Step 2 — Add the coming-soon function

In the main script block, add a new function near the top of function definitions:

```javascript
function showFamilyComingSoon() {
  alert('Family member management is being rebuilt and will be available in the pilot launch (~4 weeks). Thanks for your patience!');
}
```

If there's an existing modal/toast system on the page, use that instead of `alert()` for consistency. Otherwise `alert()` is fine.

## Step 3 — Add explanation note under Family Members heading

Find the "Family Members" section (around line 240 — the `<h2>👥 Family Members</h2>` heading):

Immediately after the heading, add:

```html
<div style="background:#fff8e1; border-left:4px solid #f59e0b; padding:12px; margin:12px 0; border-radius:4px;">
  <p style="margin:0; font-size:13px; color:#78350f;">
    <strong>⏳ Coming Soon</strong> — We're rebuilding family member management with a cleaner approval flow. This feature will be back in the next few weeks.
  </p>
</div>
```

## Step 4 — Hide pending approvals section if empty

Find `<div id="pendingFamilyApprovals"` (around line 322). 

Change its initial state to be visually hidden/empty (keep the div for JavaScript compatibility but it won't show anything). Add `style="display:none;"` to it:

```html
<div id="pendingFamilyApprovals" style="display:none; margin-bottom:20px;"></div>
```

## Step 5 — Disable tenant family request modal button (if visible)

Find the `familyRequestModal` and `submitFamilyRequest()` references.

Find the button that opens this modal (search for anything that calls `openFamilyRequestModal()` or triggers the modal). Replace its onclick to call `showFamilyComingSoon()` instead.

If you can't find a clear caller, that's fine — skip this step.

## Step 6 — Disable the loadFamilyMembers fetch to prevent errors

Find the `loadFamilyMembers()` function (around line 621). To prevent the function from hitting broken endpoints and polluting the console with errors, add an early return at the very top:

```javascript
async function loadFamilyMembers() {
  // Family feature disabled during refactor — coming soon
  return;
  
  // ... existing function body stays below (dead code during refactor)
}
```

This keeps the function defined (so other code doesn't break) but makes it a no-op.

## Verification

```
# Visual check — open profile.html in a browser via localhost if possible
# Or just grep to confirm changes

grep -n "Coming Soon" society/profile.html     # should show at least 2 hits
grep -n "showFamilyComingSoon" society/profile.html  # should show 1 definition + 1 caller
grep -n "return;" society/profile.html  # should include the loadFamilyMembers early return

# Lint still passes (society/ isn't linted, but tests shouldn't break)
npm test 2>&1 | tail -5       # expected: 51/51 passing
npm run lint 2>&1 | tail -3   # expected: 0 errors, ~235 warnings

# Wrangler still deploys cleanly
npx wrangler deploy --dry-run 2>&1 | grep -E "WARNING|error" | head -5
# expected: empty
```

## DOC_SYNC

### `/docs/FEATURE_STATUS.md`

Find family-related rows and mark them with "⏳ Coming Soon (UI disabled)" instead of DONE or IN PROGRESS.

Add a note at the top or near Family section:
```
**Note:** Family member features are UI-disabled as of YYYY-MM-DD during identity refactor. 
Will be rebuilt in Sprint 3. See IDENTITY_MODEL.md Section 5 for new design.
```

### `/docs/DECISIONS.md`

Add:
```
### Disable family UI during refactor — YYYY-MM-DD
Decision: Hide invite/approve/reject family UI behind "Coming Soon" messaging rather than leaving broken buttons visible.
Reason: `/invite/create` currently returns 500. Family flow being rebuilt in Sprint 3 (identity refactor). Better UX to show intentional "Coming Soon" than unintentional "server_error".
Scope: profile.html button + loadFamilyMembers no-op + pending approvals hidden.
Restore: When Sprint 3 rebuilds family UI with new identity model, un-disable these components.
```

## Commit

```
git add society/profile.html docs/
git commit -m "chore: disable family UI with 'Coming Soon' during identity refactor

Family invite/approve/reject flow has broken /invite/create endpoint (500 error)
and is being rebuilt in Sprint 3 of identity refactor. Hide UI behind Coming
Soon messaging so reviewers don't trigger broken flows.

Changes (profile.html only):
- Replace invite button onclick with 'Coming Soon' alert
- Add explanation banner under Family Members heading
- Hide pending approvals section by default
- Early-return in loadFamilyMembers() to prevent console errors

No backend changes. No test changes. Pure UI freeze.

To restore: revert this commit or replace disabled calls when Sprint 3 completes.

Docs: DECISIONS + FEATURE_STATUS"
git push origin fix/disable-family-ui
```

## Merge after verification

```
git checkout main
git merge fix/disable-family-ui
git push origin main
```

Watch GitHub Actions — expected green deploy.

## Report

- Buttons changed to Coming Soon: yes/no
- loadFamilyMembers disabled: yes/no
- Tests pass: 51/51
- Lint: 0 errors
- Wrangler: 0 warnings
- Ready to merge: yes/no
- Next action: User can show platform to reviewers without family-related errors appearing
