> **ARCHIVED:** This file described an earlier implementation plan that has been superseded.
> Current implementation sequence: `/docs/PROMPTS.md`.
> Current architecture: `/docs/ARCHITECTURE.md`.

# PSOTS Society — Phase-wise Implementation Plan

**How to use this file:**
- Each phase has a START prompt and a VALIDATE prompt
- Always run START first, then VALIDATE before moving to next phase
- If VALIDATE fails, run the FIX prompt before proceeding
- Never skip a VALIDATE step — it protects the next phase from building on broken foundations
- Update /docs/FEATURE_STATUS.md and /docs/ROADMAP.md after each phase using PROMPT 2 from PROMPTS.md

---

## Before anything — session start

Run this at the beginning of every Claude Code session:

```
Read CLAUDE.md first, then read in order:
  /docs/DECISIONS.md
  /docs/PROMPTS.md
  /docs/FEATURE_STATUS.md
  /docs/ROADMAP.md

Tell me: last feature completed, next to build, any open questions.
Do not write any code yet.
```

---

## PHASE 2A — PII Masking
**Why first:** Admin can currently see full emails and phone numbers. Do not onboard any real residents until this is live.

### START

```
Read CLAUDE.md and /docs/DECISIONS.md first.

Use oh-my-claudecode:architect to plan, then oh-my-claudecode:executor to build.

TASK: Implement PII masking. This is CRITICAL — no real residents until live.

oh-my-claudecode:architect — plan the implementation:
  1. Locate where Firestore is currently called in Worker files
  2. Determine if src/db/adapter.js exists — if not, it must be created
  3. Plan where the 5 masking functions will live
  4. Identify every endpoint that returns resident data to admin or other residents
  Report back the plan before any code is written.

oh-my-claudecode:executor — implement:

PART A — Create or update src/db/adapter.js with these exact functions:

  function maskEmail(email) {
    if (!email) return '';
    const [local, domain] = email.split('@');
    return local[0] + '***@' + domain;
  }

  function maskPhone(phone) {
    if (!phone) return '';
    const clean = phone.replace(/\D/g, '').slice(-10);
    return '+91 ' + clean.slice(0,2) + 'XXX X' + clean.slice(-4);
  }

  function maskName(fullName) {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0];
    return parts[0] + ' ' + parts[parts.length-1][0] + '.';
  }

  function sanitizeForAdmin(resident) {
    return {
      uid: resident.uid,
      flatNumber: resident.flatNumber,
      displayName: maskName(resident.name || resident.firstName || ''),
      relation: resident.relation || '',
      accessLevel: resident.accessLevel || 'owner',
      loginMethod: resident.loginMethod || '',
      status: resident.status || 'pending',
      createdAt: resident.createdAt || '',
      email: maskEmail(resident.email || ''),
      phone: maskPhone(resident.phone || ''),
      invitedByFlat: resident.invitedByFlat || '',
    };
  }

  function sanitizeForResident(resident, requestingUid) {
    if (resident.uid === requestingUid) return resident;
    return sanitizeForAdmin(resident);
  }

PART B — Apply masking to these endpoints:
  GET /admin/residents — wrap every resident in sanitizeForAdmin()
  GET /family/list — use sanitizeForResident(resident, requestingUid)
  All invite_audit responses — mask joinerEmail and inviterEmail fields

PART C — Verify admin panel HTML does not display raw fields.
  Admin panel must use masked fields returned by endpoint, not raw Firestore data.

After completing, run oh-my-claudecode:git-master to commit:
  "feat: implement PII masking — maskEmail, maskPhone, maskName, sanitizeForAdmin"
```

### VALIDATE

```
Read CLAUDE.md first.

Use oh-my-claudecode:qa-tester to validate PII masking implementation.

VALIDATION CHECKLIST — test each item and report PASS or FAIL:

1. maskEmail function exists in codebase
   Test: maskEmail('pushkalkishore@gmail.com') → 'p***@gmail.com'

2. maskPhone function exists in codebase
   Test: maskPhone('9482088904') → '+91 94XXX X8904'

3. maskName function exists in codebase
   Test: maskName('Pushkal Kishore') → 'Pushkal K.'
   Test: maskName('Pushkal') → 'Pushkal' (single name, no masking)

4. sanitizeForAdmin returns masked object
   Test: email field in returned object is masked, not full email
   Test: phone field in returned object is masked, not full phone
   Test: displayName is masked name format

5. sanitizeForResident returns full data for own UID, masked for others
   Test: requesting own record → full email visible
   Test: requesting other resident → masked email only

6. GET /admin/residents endpoint applies sanitizeForAdmin() to every resident
   Check: no full email in API response

7. GET /family/list endpoint applies sanitizeForResident()
   Check: no full email in API response

8. invite_audit responses have masked emails
   Check: joinerEmail and inviterEmail are masked in all invite audit responses

9. Admin panel HTML displays masked data
   Check: no raw .email field rendered directly from Firestore in admin HTML files

REPORT: Count of PASS / FAIL.
If any FAIL — list exactly what is wrong and which file needs fixing.
Do NOT proceed to Phase 2B until all 9 checks PASS.
```

### FIX (run only if VALIDATE fails)

```
Read CLAUDE.md first.

oh-my-claudecode:debugger — fix the failing PII masking checks.

Failing checks from VALIDATE: [PASTE FAILING CHECKS HERE]

For each failing check:
  1. Identify the exact file and line causing the failure
  2. Fix it
  3. Re-run the specific test to confirm it passes

After all fixes, run oh-my-claudecode:git-master:
  "fix: PII masking corrections — [list what was fixed]"

Then re-run the full VALIDATE prompt.
```

---

## PHASE 2B — DB Adapter Pattern
**Why second:** Required before Phase 3. Makes all future DB work clean and migration-ready.

### START

```
Read CLAUDE.md and /docs/DECISIONS.md first. Read the DB adapter decision carefully.

Use oh-my-claudecode:architect to plan, then oh-my-claudecode:executor to build.

oh-my-claudecode:architect — audit and plan:
  1. Find every file that imports Firebase or Firestore directly
  2. List every Firestore operation (get, set, update, delete, query) found
  3. Design the named export functions for adapter.js covering all operations
  4. Confirm the plan before any code is written

oh-my-claudecode:executor — implement:

STEP 1 — Create src/db/adapter.js
  Define named export functions for every Firestore operation found.
  For now, each function can directly contain the Firebase implementation.
  Use clear descriptive names:
    getResident(uid), getResidentByFlat(flatNumber), saveResident(data),
    updateResidentStatus(uid, status), listPendingResidents(),
    listResidents(filters), getFlat(flatNumber), saveFlat(data),
    getFamilyMembers(flatNumber), saveFamilyMember(flatNumber, memberData),
    updateFamilyMemberStatus(flatNumber, memberId, status),
    getInvite(token), saveInvite(data), updateInvite(token, updates),
    getViolations(chatId), saveViolation(data), updateViolation(data),
    getAdmins(), isAdmin(email), saveAuditLog(data)
    (add any others found in the codebase audit)

STEP 2 — Create src/db/firebase.js
  Move all Firebase/Firestore imports and SDK initialization into this file.
  adapter.js imports from firebase.js.
  No other file imports from firebase.js.

STEP 3 — Refactor all existing Worker files
  Replace every direct Firestore call with the adapter function.
  Worker files import from adapter.js only, never from firebase.js or firebase SDK.

STEP 4 — Do not touch:
  Firebase Auth imports — they stay wherever auth is handled (auth is never migrated)
  The masking functions added in Phase 2A — leave them exactly as they are

After completing, run oh-my-claudecode:git-master:
  "refactor: DB adapter pattern — all Firestore calls through src/db/adapter.js"
```

### VALIDATE

```
Read CLAUDE.md first.

Use oh-my-claudecode:security-reviewer and oh-my-claudecode:qa-tester to validate DB adapter.

VALIDATION CHECKLIST:

1. src/db/adapter.js exists and exports named functions
   Check: file exists, functions are named exports, not default export

2. src/db/firebase.js exists with Firebase/Firestore implementation
   Check: file exists, all Firestore SDK code lives here

3. No direct Firestore imports outside src/db/firebase.js
   Search entire codebase for: import.*firestore, require.*firestore, getFirestore(
   Result must be: only found in src/db/firebase.js

4. All Worker handler files import from adapter.js only
   Check: Worker route handlers use adapter functions, not raw Firestore calls

5. Firebase Auth imports are untouched
   Check: Google OAuth, Email OTP, Telegram OTP still import Firebase Auth directly
   (Auth is never migrated — this is correct behaviour)

6. PII masking functions from Phase 2A still work
   Quick test: sanitizeForAdmin still returns masked email

7. Functional test — resident registration flow still works end to end
   Trace: new resident → pending → admin sees in queue → approve → status updates

8. Functional test — family invite flow still works
   Trace: create invite → validate token → accept → member appears in family list

REPORT: PASS / FAIL for each.
If any FAIL — do not proceed. Fix and re-validate.
```

---

## PHASE 2C — Family Approval by Primary Resident
**Why third:** Family members can currently join without owner approval. This is a trust model gap.

### START

```
Read CLAUDE.md and /docs/DECISIONS.md first.

Use oh-my-claudecode:architect to design, oh-my-claudecode:executor to build,
oh-my-claudecode:designer for the UI.

oh-my-claudecode:architect — design the approval flow:
  Current state: family member joins → stored as pending in flats/{flatNumber}/members
  Required: primary resident sees pending member → approves or rejects
  Design: endpoints needed, status transitions, email triggers
  Present design for confirmation before building.

oh-my-claudecode:executor — build:

PART A — Worker endpoints:
  POST /family/approve
    Auth: requires Firebase token of flat owner (not admin)
    Body: { flatNumber, memberId }
    Action: updates flats/{flatNumber}/members/{memberId} status to 'approved'
    Triggers: send approval confirmation email to family member

  POST /family/reject
    Auth: requires Firebase token of flat owner
    Body: { flatNumber, memberId, reason (optional) }
    Action: updates status to 'rejected', stores reason
    Triggers: send rejection notification to family member

PART B — My Family UI (profile page or dedicated tab):
  Show sections: Active family members | Pending approval | Rejected
  Each pending member shows: name, relation, joined date
  Approve button → calls POST /family/approve
  Reject button → calls POST /family/reject with optional reason

PART C — Admin notice (acknowledge or flag only — not an approval):
  When family member joins and is pending primary approval:
  Admin dashboard shows a notice: "New family member at Flat XXXXX — [name] ([relation])"
  Admin has two actions: Acknowledge (dismiss) | Flag (marks for follow-up)
  Admin does NOT have approve/reject — that belongs to primary resident only

PART D — Emails via Resend API:
  To approved family member: "You have been added to Flat XXXXX by [owner name]. Welcome."
  To rejected family member: "Your request to join Flat XXXXX was not approved. [reason if given]"

After completing, run oh-my-claudecode:git-master:
  "feat: family approval by primary resident — approve/reject endpoints + UI + emails"
```

### VALIDATE

```
Read CLAUDE.md first.

Use oh-my-claudecode:qa-tester to validate family approval flow.

VALIDATION CHECKLIST:

1. POST /family/approve endpoint exists and requires owner auth
   Test: call without token → 401 Unauthorized
   Test: call with admin token (not owner) → 403 Forbidden
   Test: call with correct owner token → 200, status updates to 'approved'

2. POST /family/reject endpoint exists and requires owner auth
   Same auth tests as above
   Test: call with owner token → 200, status updates to 'rejected'

3. Family member cannot access platform while status is pending
   Test: pending family member tries to load dashboard → blocked

4. Family member can access platform after approval
   Test: approved family member loads dashboard → succeeds

5. My Family UI shows pending members correctly
   Check: pending section shows member name, relation, joined date
   Check: approve and reject buttons are present and functional

6. Admin notice appears when family joins
   Check: admin dashboard shows notice for new pending family member
   Check: notice has Acknowledge and Flag buttons (not Approve/Reject)

7. Approval email delivered to family member
   Check: Resend API shows email sent after approval
   Check: email content contains flat number and owner name

8. Rejection email delivered with reason if provided
   Check: Resend API shows email sent after rejection

9. Admin approval flow for PRIMARY residents is unchanged
   Test: new primary resident registration still goes to admin for approval
   (admin approves primary residents, owner approves family — both must work)

REPORT: PASS / FAIL for each.
Do not proceed to Phase 2D until all 9 PASS.
```

---

## PHASE 2D — Complete Email Delivery + Onboarding Modal
**Why fourth:** Last piece of auth before residents can be safely onboarded.

### START

```
Read CLAUDE.md first.

oh-my-claudecode:executor — implement two things:

PART A — Email delivery verification and fixes:
  Test every transactional email by sending a real email to pushkalkishore@gmail.com:
    1. Welcome email (on new registration)
    2. Approval confirmation (primary resident approved)
    3. Rejection notification (primary resident rejected with reason)
    4. Device alert (new device login detected)
    5. Family invite email (sent to family member's email)
    6. Family approval confirmation (family member approved)
  For each: check Resend API dashboard, confirm delivery, fix any that fail.
  Document which pass and which needed fixing.

PART B — First-login onboarding modal:
  Show on first login after approval. Dismissable. Stored in localStorage so it shows once.
  Four steps shown as a checklist — resident can click each or skip:
    Step 1: Add your Telegram username (link to profile settings)
    Step 2: Invite a family member (link to My Family QR code generator)
    Step 3: Explore the marketplace (link to marketplace page)
    Step 4: Check today's food vendors (link to food page — placeholder for now)
  Progress indicator showing X of 4 complete.
  "Skip for now" button at bottom.
  After all 4 done or skipped: "You are all set! Welcome to PSOTS Society."

After completing, run oh-my-claudecode:git-master:
  "feat: email delivery verified, first-login onboarding modal"
```

### VALIDATE

```
Read CLAUDE.md first.

Use oh-my-claudecode:qa-tester to validate Phase 2D.

VALIDATION CHECKLIST:

1. All 6 transactional emails send successfully
   Check Resend API dashboard for each email type — all show Delivered status

2. Welcome email content is correct
   Check: contains flat number, resident name, "pending approval" message

3. Onboarding modal appears on first login after approval
   Test: approved resident logs in for first time → modal shows

4. Onboarding modal does NOT appear on second login
   Test: dismiss modal → log out → log back in → modal does not show

5. Onboarding modal does NOT appear for pending residents
   Test: pending resident logs in → no modal (not yet approved)

6. All 4 onboarding steps show correct links
   Check: each step links to correct page

7. Skip button works — modal dismissed permanently
   Test: click skip → modal gone → re-login → still gone

8. Completing all 4 steps shows success message

REPORT: PASS / FAIL.
Phase 2 is COMPLETE when all checks pass.
Run PROMPTS.md Prompt 2 with: "Phase 2 complete — PII masking, DB adapter, family approval, email delivery, onboarding modal"
```

---

## PHASE 3A — Telegram Food Ordering
**Why now:** Foodies group has 1,224 members and 5 years of daily activity. Prove the vendor model here before building the website version. Zero acquisition cost.

### START

```
Read CLAUDE.md and /docs/DECISIONS.md first.

Use oh-my-claudecode:architect to design the full flow, then oh-my-claudecode:executor to build.

oh-my-claudecode:architect — design:
  Map the complete flow from vendor setup to resident order to vendor confirmation.
  Design the Firestore collections needed: vendors, menus, orders.
  Design the Telegram inline keyboard structure for browsing and ordering.
  Present before building.

oh-my-claudecode:executor — build:

PART A — Vendor onboarding:
  Vendor DMs @psots_telegram_bot with /vendor
  Bot asks: flat number, name, WhatsApp number
  Bot stores vendor in vendors/{vendorId} collection via adapter.saveVendor()
  Vendor gets confirmation: "You are registered. Now set your menu with /menu"

PART B — Menu management:
  /menu command → bot shows current menu with edit options
  Vendor can add item: name, price, unit (per plate, per kg, per piece)
  Vendor can toggle item availability on/off
  Vendor can update price
  All stored in vendors/{vendorId}/menu/{itemId}

PART C — Resident ordering flow (inline keyboard):
  Resident sends /food in the Foodies group OR DMs the bot
  Bot shows inline keyboard with active vendors today (buttons, one per vendor)
  Resident taps vendor → bot shows today's menu as inline buttons with prices
  Resident taps items to add to cart (bot tracks cart in memory per chat session)
  Resident taps "Confirm order" → bot shows order summary + confirm button
  On confirm:
    Bot DMs vendor: "New order from Flat [XXXXX] — [items] — Total ₹[amount]"
    Bot confirms to resident: "[Vendor name] has received your order. They will confirm shortly."
    Order stored in orders/{orderId} via adapter.saveOrder()

PART D — Vendor confirmation:
  Vendor replies to order DM with "confirm" or "ready by [time]"
  Bot notifies resident: "[Vendor name] confirmed your order. Ready by [time]."
  Order status updated in Firestore.

PART E — Vendor subscriber broadcast:
  /broadcast command for vendors
  Bot asks: message text
  Bot sends message to all residents who have ordered from this vendor in last 30 days
  (subscriber list = unique residents from orders collection for this vendorId)

PART F — Weekly vendor analytics (automated):
  Every Monday 8 AM, Cloudflare Workers cron job triggers
  For each active vendor, compute: total orders this week, top 3 items, total revenue
  Bot DMs each vendor their weekly summary

After completing, run oh-my-claudecode:git-master:
  "feat: Telegram food ordering — vendor onboarding, menu, inline ordering, broadcast, weekly analytics"
```

### VALIDATE

```
Read CLAUDE.md first.

Use oh-my-claudecode:qa-tester to validate Telegram food ordering.

VALIDATION CHECKLIST:

1. Vendor onboarding works end to end
   Test: DM /vendor to bot → complete onboarding → vendor appears in Firestore

2. Menu management works
   Test: /menu command → add item → item appears in menu
   Test: toggle item off → item not shown in ordering flow

3. /food command shows active vendors
   Test: resident sends /food → inline keyboard appears with vendor buttons

4. Ordering flow completes successfully
   Test: tap vendor → see menu → add items → confirm → order saved in Firestore

5. Vendor receives order DM
   Test: complete order → vendor's Telegram gets the DM with flat number and items

6. Resident receives confirmation
   Test: complete order → resident gets confirmation message

7. Vendor confirmation updates order status
   Test: vendor replies "confirm" → resident gets notification → order status updated

8. Broadcast sends to subscribers
   Test: /broadcast → message sent to residents who ordered from this vendor

9. Weekly analytics cron runs without error
   Test: trigger cron manually → vendor receives DM with order summary

10. Orders stored correctly in Firestore via adapter
    Check: orders/{orderId} document has flatNumber, vendorId, items, total, status, timestamp

REPORT: PASS / FAIL.
Do not proceed to Phase 3B until all 10 PASS.
```

---

## PHASE 3B — Website Food Market
**Why after 3A:** Build the website version only after the Telegram model is proven and vendors are comfortable with the system.

### START

```
Read CLAUDE.md and /docs/DECISIONS.md first.

Use oh-my-claudecode:designer to design the UI first, then oh-my-claudecode:executor to build.

oh-my-claudecode:designer — design vendor profile and browse pages:
  Vendor card: photo, name, flat number, category, rating, open status, WhatsApp button
  Browse page: grid of vendor cards, filter by category and availability
  Vendor detail page: full menu, items with photos, WhatsApp order button
  Present design for confirmation before building.

oh-my-claudecode:executor — build:

PART A — Vendor profile page:
  URL: society.psots.in/society/food/vendor/[vendorId]
  Shows: vendor name, flat, photo, description, open hours, rating, WhatsApp number
  Menu section: items with price, unit, availability, optional photo
  "Order via WhatsApp" button generates pre-filled wa.me message:
    wa.me/91[phone]?text=[encoded order text with items and flat number]

PART B — Browse vendors page:
  URL: society.psots.in/society/food/
  Grid of vendor cards showing active vendors
  Filter: All | Veg | Non-Veg | Sweets | Tiffin | Other
  Availability filter: Today only toggle
  Search by vendor name

PART C — Occasional seller credit system:
  Separate from monthly subscription
  Occasional seller pays per-post: ₹10/post
  Credit packs: 5 credits for ₹50, 10 credits for ₹90
  Credits stored in vendors/{vendorId} creditBalance field
  When occasional seller posts a listing: 1 credit deducted
  Listing active for 24 hours (food items) or 7 days (marketplace items)
  When balance reaches 1 credit: bot DMs vendor "You have 1 credit left. Top up?"
  Natural upgrade nudge: if vendor uses more than 10 credits in a month,
    show: "You've used ₹100 in credits this month. Monthly plan at ₹99 saves you ₹1+."

PART D — Vendor dashboard (website):
  URL: society.psots.in/society/food/dashboard (requires vendor login)
  Menu management: add/edit/delete items, toggle availability, upload photos via R2
  Order management: incoming orders table with status (pending/confirmed/delivered)
  Subscriber count: how many residents have ordered from them
  This is the same data as the Telegram bot manages — synced via Firestore

PART E — Rating system:
  After order status = delivered, resident gets a prompt to rate
  1–5 stars + optional comment
  Rating stored in vendors/{vendorId}/ratings/{ratingId}
  Average rating shown on vendor card and profile

After completing, run oh-my-claudecode:git-master:
  "feat: website food market — browse, vendor profiles, WhatsApp ordering, credits, dashboard, ratings"
```

### VALIDATE

```
Read CLAUDE.md first.

Use oh-my-claudecode:qa-tester and oh-my-claudecode:security-reviewer.

VALIDATION CHECKLIST:

1. Browse page loads all active vendors
   Test: open society.psots.in/society/food/ → vendor grid shows

2. Category filters work
   Test: filter Veg → only veg vendors shown

3. Vendor profile page shows correct menu
   Test: open vendor profile → items, prices, availability correct

4. WhatsApp order button generates correct wa.me link
   Test: click order button → wa.me link opens WhatsApp with pre-filled message
   Check: message contains flat number, item names, quantities, total

5. Occasional seller credit deduction works
   Test: occasional seller posts listing → credit balance decreases by 1

6. Low credit alert triggers at 1 credit remaining
   Test: reduce credits to 1 → vendor receives DM alert

7. Upgrade nudge shows at 10+ credits used in month
   Test: use 11 credits → upgrade message shown

8. Vendor dashboard shows correct orders
   Test: place order via Telegram → order appears in website dashboard

9. Rating submission works
   Test: mark order delivered → resident gets rating prompt → submit rating → avg updates

10. Vendor photo upload works (Cloudflare R2)
    Test: upload item photo → photo appears on browse page

11. Security: vendor can only see their own orders and dashboard
    Test: vendor A cannot access vendor B's dashboard

REPORT: PASS / FAIL.
Phase 3 is COMPLETE when all 11 PASS.
Run PROMPTS.md Prompt 2: "Phase 3 complete — Telegram ordering + website food market"
```

---

## PHASE 4 — Carpool
**After Phase 3 is stable.**

### START

```
Read CLAUDE.md and /docs/DECISIONS.md first.

oh-my-claudecode:architect — design the matching algorithm:
  Resident A offers ride: destination area, time, days, seats, fuel cost
  Resident B requests ride: destination area, time window, days
  Match logic: overlapping destination area + overlapping time window + same days
  Design Firestore structure for rides, requests, matches, groups
  Present before building.

oh-my-claudecode:executor — build:

PART A — Ride offer (driver):
  Form: destination area (dropdown of major IT corridors near PSOTS), departure time,
    seats available (1–6), days of week (checkboxes), fuel cost per seat,
    recurring toggle (daily vs one-time), women-only seats toggle
  Stored in rides/{rideId}: all fields + flatNumber + status='active'

PART B — Ride request (passenger):
  Form: destination area, time window (±30 min), days needed
  System queries rides collection for matches
  Shows matched drivers with flat number, tower, time, cost, seats
  "Request seat" button → creates rideRequests/{requestId}

PART C — Match and connect:
  On request submitted → driver gets Telegram DM: "Ride request from Flat [XXXXX]"
  Driver can accept or decline via bot inline button
  On accept: both residents get each other's wa.me link
    Message: "Your carpool with Flat [XXXXX] is confirmed. Connect on WhatsApp to coordinate."

PART D — Recurring ride groups:
  After first successful match, driver can create a ride group
  Ride group = standing daily arrangement — shown as 'Active group' on seat board
  Members: driver + accepted passengers (up to seat limit)

PART E — Daily seat board:
  society.psots.in/society/carpooling/
  Live view of all rides leaving PSOTS today
  Shows: vendor time, destination, seats left, tower
  Sorted by departure time

PART F — Fuel split calculator:
  On ride offer form and on match confirmation
  Input: origin (PSOTS gate), destination (auto from dropdown), fuel price per litre
  Output: suggested per-seat cost in ₹
  Informational only — no payment processing

PART G — Women-only seat option:
  Driver marks seats as women-only
  Only female flat-verified residents can see and request those seats
  Gender stored in resident profile (optional field, verified by flat ownership)

PART H — CO2 leaderboard:
  Monthly calculation: for each completed carpool trip, estimate CO2 saved
  Formula: (seats filled × average car emission per km × route distance) vs solo car
  Shown on homepage: "PSOTS saved X kg CO2 this month through carpooling"
  Top 5 drivers shown with CO2 contribution

After completing, run oh-my-claudecode:git-master:
  "feat: carpool — ride offers, requests, matching, seat board, fuel split, CO2 leaderboard"
```

### VALIDATE

```
Read CLAUDE.md first.

Use oh-my-claudecode:qa-tester to validate carpool.

VALIDATION CHECKLIST:

1. Ride offer creation saves correctly
   Test: create offer → appears in seat board

2. Ride request matching finds correct offers
   Test: request Whitefield 9 AM → shows only matching Whitefield 9 AM offers

3. Women-only filter works
   Test: male resident cannot see or request women-only seats

4. Driver receives Telegram DM on request
   Test: submit request → driver gets DM with inline accept/decline buttons

5. Accept triggers wa.me link exchange
   Test: driver accepts → both parties get WhatsApp links

6. Seat board shows today's rides correctly
   Test: create ride for today → appears on seat board with correct time and seats

7. Recurring group shows as active
   Test: create ride group → shows as 'Active group' on seat board

8. Fuel split calculator gives reasonable output
   Test: PSOTS to Whitefield (~15 km) → suggested cost is in ₹30–80 range per seat

9. CO2 leaderboard calculates and displays
   Test: complete 3 carpool trips → CO2 leaderboard shows calculation

10. Security: resident cannot modify another resident's ride offer
    Test: try to edit another resident's ride → blocked

REPORT: PASS / FAIL.
Phase 4 COMPLETE when all 10 PASS.
Run PROMPTS.md Prompt 2: "Phase 4 complete — carpool"
```

---

## PHASE 5 — Community Features
**Notice board, lost & found, emergency contacts, marketplace, jobs.**

### START

```
Read CLAUDE.md first.

oh-my-claudecode:executor — build all 5 community features. Pages exist as shells.
Add the backend and functional frontend to each.

FEATURE 1 — Notice board:
  Resident posts a notice: title, body (rich text), category (Event/Info/For Sale/Other), optional photo
  All approved residents can post — not just admins
  Notices shown in reverse chronological order
  Filter by category
  Same-tower notices highlighted with a badge
  No RWA notices — this is resident-to-resident only

FEATURE 2 — Lost and found (page exists at society/lostandfound.html):
  Post: item name, description, photo, found/lost toggle, flat number, date
  When lost post is created: auto-notify all residents in same tower via Telegram bot
  Notification: "@psots_telegram_bot: Lost item reported in Tower [X]: [item]. Contact Flat [XXXXX]."
  Mark as resolved button — removes from active listing

FEATURE 3 — Emergency contacts directory:
  Community-curated list of trusted service providers
  Categories: Plumber, Electrician, Carpenter, Pest Control, Maid Agency, Driver
  Any resident can add an entry: name, phone, category, area served, notes
  Other residents can upvote (thumbs up) — sorted by upvotes
  Replaces the daily "anyone know a good plumber?" messages in Telegram groups

FEATURE 4 — Marketplace (page exists at society/marketplace.html):
  Post item for sale/free: title, description, price (or free), photos, category, flat number
  Categories: Electronics, Furniture, Books, Clothes, Kids Items, Other
  Item expires after 30 days (or sooner if marked sold)
  Contact seller via wa.me link (same pattern as food market)
  Filter by category, price range, free only toggle

FEATURE 5 — Jobs board (page exists at society/jobs.html):
  Resident posts: company name, role title, description, apply link or contact email
  Optional: remote/hybrid/on-site, approximate salary range
  Resident's flat number and tower shown (builds trust — it's a real neighbour's referral)
  Expires after 60 days

After completing, run oh-my-claudecode:git-master:
  "feat: community features — notice board, lost & found, emergency contacts, marketplace, jobs"
```

### VALIDATE

```
Read CLAUDE.md first.

oh-my-claudecode:qa-tester — validate all 5 community features.

VALIDATION CHECKLIST:

1. Notice board — post appears immediately after creation
2. Notice board — category filter works
3. Notice board — same-tower notices have tower badge
4. Lost and found — post created → tower residents get Telegram notification
5. Lost and found — mark resolved removes from active list
6. Emergency contacts — entry added → sorted by upvotes
7. Emergency contacts — upvote increments count
8. Marketplace — post created → appears in listings
9. Marketplace — WhatsApp contact button generates correct wa.me link
10. Marketplace — 30-day expiry works (or can be tested with 30-minute expiry in staging)
11. Jobs board — post created → appears in listings
12. Jobs board — flat number and tower visible on each post
13. Security — resident cannot delete another resident's post
14. Security — only approved residents can post (pending or unapproved cannot)

REPORT: PASS / FAIL.
Phase 5 COMPLETE when all 14 PASS.
Run PROMPTS.md Prompt 2: "Phase 5 complete — all community features"
```

---

## PHASE 6 — Telegram Integration (bot evolution)
**Buy/sell group → marketplace auto-sync. This is the key self-managing feature.**

### START

```
Read CLAUDE.md and /docs/DECISIONS.md first.

oh-my-claudecode:architect — design the buy/sell sync pipeline:
  Bot monitors the PSOTS buy/sell Telegram group
  When a message matches a listing pattern (item + price + optional photo):
    Extract: item name, price, description, photo if attached
    Create draft listing in marketplace collection with status='draft'
    Admin gets a notice: "New listing detected from Telegram: [item] ₹[price]"
    Admin clicks Approve → listing goes live. Decline → listing discarded.
  Design the pattern matching logic and Firestore structure.
  Present before building.

oh-my-claudecode:executor — build:

PART A — Bot commands for platform features:
  /food → shows today's active vendors (inline keyboard, same as Phase 3A)
  /carpool → shows today's available rides leaving PSOTS
  /lost → shows last 5 lost & found posts from same building
  /jobs → shows latest 3 job postings from residents

PART B — Buy/sell group → marketplace auto-sync:
  Add buy/sell group chat ID to bot configuration
  Bot receives all messages from this group (privacy mode disabled for this group)
  Pattern detection using Gemini (already integrated in telegram.js):
    Detect if message looks like a listing: has price (₹ or Rs), has item description
    If photo attached: extract and store reference
  On detection: create marketplace/{listingId} with status='draft', source='telegram'
  Admin dashboard shows Draft listings queue with Approve/Decline buttons
  On approve: status → 'active', listing appears on website marketplace
  On decline: status → 'rejected', no further action

PART C — Telegram group cards on website:
  Each community hub page shows linked Telegram group
  Card shows: group name, approximate member count, purpose, link to join
  Updates member count weekly via Telegram API getChat call

After completing, run oh-my-claudecode:git-master:
  "feat: Telegram integration — bot commands, buy/sell auto-sync, group cards"
```

### VALIDATE

```
Read CLAUDE.md first.

oh-my-claudecode:qa-tester — validate Telegram integration.

VALIDATION CHECKLIST:

1. /food command shows today's vendors correctly
2. /carpool command shows today's available rides
3. /lost shows recent lost & found posts
4. /jobs shows recent job postings
5. Buy/sell group message detected as listing
   Test: send "Selling Sony headphones ₹1500, good condition" → bot detects as listing
6. Draft listing created in Firestore with status=draft
7. Admin dashboard shows draft listing in queue
8. Admin approve → listing appears live on marketplace website
9. Admin decline → listing does not appear, status=rejected
10. Non-listing message not detected as listing
    Test: send "Anyone free this weekend?" → no draft listing created
11. Telegram group cards show on correct hub pages
12. Group member count displays correctly

REPORT: PASS / FAIL.
Phase 6 COMPLETE when all 12 PASS.
Run PROMPTS.md Prompt 2: "Phase 6 complete — Telegram integration and auto-sync"
```

---

## Final check — full platform review

Run this after all phases are complete, before announcing to residents.

```
Read CLAUDE.md, /docs/DECISIONS.md, /docs/FEATURE_STATUS.md first.

Run these agents in sequence:

oh-my-claudecode:security-reviewer — full security audit:
  Check all endpoints require correct auth
  Check no PII exposed in any API response
  Check Firestore rules match the auth logic in Worker
  Check no secrets or tokens in code or comments
  Report all issues found.

oh-my-claudecode:code-reviewer — code quality review:
  Check DB adapter pattern is followed everywhere
  Check no direct Firestore imports outside src/db/firebase.js
  Check error handling on all endpoints
  Check all emails have fallback if Resend API fails
  Report issues found.

oh-my-claudecode:qa-tester — end to end flow test:
  Test the complete new resident journey: register → pending → admin approves → onboarding → explore
  Test the complete vendor journey: onboard → set menu → receive order → confirm → deliver → get rating
  Test the complete carpool journey: post ride → request received → accept → wa.me exchange
  Report any broken flows.

oh-my-claudecode:document-specialist — sync all docs:
  Run PROMPTS.md Prompt 1 (full audit)
  Ensure FEATURE_STATUS.md, ARCHITECTURE.md, ROADMAP.md all reflect final state
  Commit: "docs: final pre-launch audit — all phases complete"

oh-my-claudecode:git-master — final commit:
  Tag the release: git tag v1.0.0 -m "PSOTS Society Platform — Phase 1-6 complete"
  Push all tags.
```

---

*Keep this file in /docs/IMPLEMENTATION_PHASES.md*
*Reference it at the start of each build session*
