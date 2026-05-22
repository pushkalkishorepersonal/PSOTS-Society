# Identity Model — PSOTS Ecosystem

**Version:** v1.0
**Status:** Ready for Sprint 1 execution
**Last updated:** 2026-04-20
**Author:** Pushkal Kishore (design), assisted by Claude
**Target:** Sprints 1-12 (PSOTS identity refactor → pilot → launch → vendor system → post-launch features)

**Reference documents:**
- `docs/_legacy/PSOTS_FlatNumber_Logic.md` — canonical flat number format (required reading)
- `SPRINT_STATUS.md` — current sprint progress
- `CLAUDE.md` — operational guidance for Haiku Code

---

## Table of Contents

**Foundations**
- [0. Scope](#0-scope)
- [1. Problem being solved](#1-problem-being-solved)
- [2. Core model](#2-core-model)
- [3. Schema](#3-schema)

**Authentication & Access**
- [4. Authentication flow — login](#4-authentication-flow--login)
- [5. Registration flow — new user](#5-registration-flow--new-user)
- [6. Edge cases](#6-edge-cases)
- [7. Device trust](#7-device-trust)
- [8. Admin model](#8-admin-model)
- [9. Session cookie](#9-session-cookie)

**User Experience**
- [10. Profile page](#10-profile-page)
- [11. Dashboard](#11-dashboard)
- [12. Admin dashboard](#12-admin-dashboard)

**Integration & Migration**
- [13. Chhath Puja integration](#13-chhath-puja-integration)
- [14. Migration plan](#14-migration-plan)
- [15. Testing plan](#15-testing-plan)
- [16. What stays unchanged](#16-what-stays-unchanged)
- [17. Out of scope](#17-out-of-scope)

**Governance**
- [18. Sprint plan (Sprints 1-12)](#18-sprint-plan)
- [19. Locked decisions](#19-locked-decisions)
- [20. Parallel tracks](#20-parallel-tracks)
- [21. Open questions](#21-open-questions)

**Ecosystem Extensions**
- [22. Samiti multi-tenant model](#22-samiti-multi-tenant-model)
- [23. Vendor / Food Ordering Module](#23-vendor--food-ordering-module)

**Trust, Safety, and Operations (NEW in v1.0)**
- [24. Security & Abuse Prevention](#24-security--abuse-prevention)
- [25. Restoration Appeals](#25-restoration-appeals)
- [26. Privacy & Data Governance](#26-privacy--data-governance)
- [27. Operational Infrastructure](#27-operational-infrastructure)

**Reference**
- [28. Flat number format summary](#28-flat-number-format-summary)
- [29. Summary — what Haiku will build](#29-summary)

---

## 0. Scope

This design covers the **PSOTS ecosystem**:

- **society.psots.in** — Residents community platform (PSOTS Society)
- **chhath.psots.in** — Chhath Puja 2026 (5th annual neighborhood festival)
- **Future festivals**: Durga Puja, Ganesh Puja, Holi — planned for same ecosystem
- **Vendor/food ordering module** (Sprint 7-8)

Both current sites share:
- Unified identity (one login, works across both)
- Shared Resend email account
- Shared Cloudflare Worker infrastructure
- Shared Firebase project (after Chhath migration in Sprint 4)

They remain visually distinct but operate as one logical community platform.

**Multi-samiti support is baked in from day one.** Each festival can be organized by an independent samiti with its own organizers, payment method, and contributors while sharing the PSOTS login infrastructure (see Section 22).

## 1. Problem being solved

### Current pain points

**PSOTS Society:**
- Each auth method (Google, email OTP, Telegram OTP) creates separate resident record keyed by Firebase `uid`
- Multiple login methods → duplicate records for same person
- At 500+ residents × 2-3 login methods = 1000-1500 records for 500 people
- Admin panel becomes unusable
- Edits to one record don't reflect in others

**Chhath Puja:**
- Separate Firebase project (operational complexity)
- Apps Script Gmail for email (unreliable, spam risk)
- Fonnte via personal WhatsApp for invoicing (fragile, risky)
- Auth system doesn't share with PSOTS

### After refactor

- One identity system across both apps
- Residents have one record with multiple credentials
- Admin panel shows each person once
- Chhath invoicing uses Resend (reliable)
- Foundation for future apps (Holi, Ganesh Chaturthi, Durga Puja)
- Multi-samiti governance supported
- Trust/safety primitives baked in (appeals, rate limiting, audit logs)

## 2. Core model

### Core entities

- **Resident** — real human in a specific flat with a specific role. `residents/{residentId}`
- **Credential** — one auth method (Google/email/phone) for one resident. `credentials/{credentialId}`
- **Flat** — physical apartment with settings. `flats/{flatNumber}`
- **Device session** — one device trusted for a resident. `device_sessions/{deviceToken}`
- **Samiti** — independent festival organizing entity with own admins and payment. `samitis/{samitiId}` (Section 22)
- **Vendor** — food/service seller subscription record. `vendors/{vendorId}` (Section 23)

### Critical relationships

- One resident = one (person, flat) combination
- One resident has 1+ credentials
- One flat has 0 or 1 approved owner
- One flat has 0+ approved tenants
- Each primary resident has 0+ family members linked to them
- One credential can authorize access to multiple apps (psots, chhath, future)
- Each samiti has its own organizer residents (subset of PSOTS residents with samiti admin flag)
- Each vendor is a resident with vendor role flag

### Multi-flat ownership

Pushkal who owns flat `15167` (Tower 15 · Floor 16 · Unit 7) AND rents flat `8296` (Tower 8 · Floor 29 · Unit 6) has TWO resident records:
- `r_15167_...` with role `owner`
- `r_8296_...` with role `tenant`

Admin views filter by flat. Both records share the same underlying credentials (one login for the person, two resident records for the two tenancies).

## 3. Schema

**All flat numbers in examples below follow the canonical format documented in `docs/_legacy/PSOTS_FlatNumber_Logic.md`.**

### `residents/{residentId}`

```javascript
{
  residentId: "r_15167_a7b3c9",
  flatNumber: "15167",              // string, canonical format
  name: "Pushkal Kishore",
  email: "pushkalkishore@gmail.com",      // primary, login identifier
  phone: "+919482088904",                 // primary contact
  secondaryEmail: "pushkalk@tekion.com",  // optional backup
  secondaryPhone: null,                   // optional backup
  telegramUsername: "PushkalKishore",     // optional
  residentType: "owner",            // owner | tenant | family_of_owner | family_of_tenant
  role: "resident",                 // resident | vendor (reserved for future)
  status: "approved",               // pending | approved | rejected | removed
  isAdmin: false,
  linkedToResidentId: null,         // only for family_of_*
  apps: ["psots_society"],          // ["psots_society", "chhath_puja", ...]
  samitiRoles: [],                  // [{ samitiId, role: "admin" | "organizer" }]
  vendorId: null,                   // set if this resident is also a vendor
  privacySettings: {
    allowContact: true,
    emailOnContact: true,
    showFlat: true,
    showNameOnRecommendations: true,
    hideFromDirectory: false,
    blockedResidentIds: [],         // other residents they've blocked
  },
  createdAt, approvedAt, approvedBy,
  rejectedAt, rejectedBy, rejectionReason,
  removedAt, removedBy, removalReason,
  invitedByFlat: null,
}
```

**Field naming convention:** Primary contact fields have no prefix (`email`, `phone`). Optional backup fields use `secondary` prefix (`secondaryEmail`, `secondaryPhone`). Do NOT use `alternate`, `alt`, or other variants — Sprint 1 migration script normalizes all legacy records to this convention.

### `credentials/{credentialId}`

```javascript
{
  credentialId: "cred_xyz789",
  residentId: "r_15167_a7b3c9",
  type: "google",                   // google | email | telegram | whatsapp | sms
  identifier: "pushkalkishore@gmail.com",  // email or phone (E.164)
  firebaseUid: "abc123xyz",
  verifiedAt, lastUsedAt, createdAt,
}
```

**Index:** query by `(type, identifier)` powers login Case A. Also query by `identifier` alone for Case B (cross-method linking).

### `flats/{flatNumber}`

```javascript
{
  flatNumber: "15167",
  // Hybrid: stored on write, also parseable from flatNumber
  tower: 15,
  floor: 16,
  unit: 7,
  ownerResidentId: "r_15167_a7b3c9",  // null until owner registers
  hasTenants: false,                   // owner-controlled toggle
  maxFamilyMembers: 4,                 // admin-configurable per flat, default 4, ceiling 8
  tenantCount: 0, familyCount: 0,      // derived
  createdAt, updatedAt,
}
```

**Schema rationale (hybrid):** `tower`, `floor`, `unit` are cached at write time for efficient querying (e.g., "show all Tower 15 residents") while `flatNumber` remains the canonical identifier. Parse logic uses `parseFlatNumber()` from the flat service — see `docs/_legacy/PSOTS_FlatNumber_Logic.md`.

### `device_sessions/{deviceToken}`

```javascript
{
  deviceToken: "dev_xyz",
  residentId: "r_15167_a7b3c9",
  deviceName: "Chrome on iPhone",
  userAgent: "Mozilla/5.0 ...",
  ipAddress: "103.x.x.x",
  cityHint: "Bangalore",
  fingerprint: "...",
  createdAt, lastUsedAt,
  expiresAt: "2027-04-19T...",         // 1 year
  revoked: false, revokedAt, revokedBy,
}
```

## 4. Authentication flow — login

### Landing page — 3 buttons

```
[G]  Continue with Google
✉️   Continue with Email
📱  Continue with Phone (via Telegram)
```

Three separate full-width buttons, not tabs. Each initiates its own flow.

### Lookup logic

```
POST /auth/unified-login
  body: { type, identifier, firebaseToken }

Cases:
  A. Credential exists for (type, identifier) → log in to existing resident
  B. Credential doesn't exist for (type, identifier) BUT identifier matches 
     another credential on a different type → link new method to same resident
  C. No match anywhere → route to registration
```

### Status-based routing

- `approved` → dashboard
- `pending` → "awaiting approval" screen with resend-notification option
- `rejected` → rejection screen with appeal form (see Section 25)
- `removed` → removal screen with appeal form (see Section 25)

### Cross-subdomain cookie

```
Set-Cookie: psots_session=<sessionId>; Domain=.psots.in; Path=/;
            Secure; HttpOnly; SameSite=Lax
```

Login at society.psots.in automatically logs into chhath.psots.in and any future festival subdomain.

## 5. Registration flow — new user

### Screen after Case C

```
Welcome to PSOTS!

Flat number: [____________]
              e.g. 1011

I am registering as:
( ) Owner of this flat
( ) Tenant in this flat
( ) Family member of someone who lives here

[Continue]
```

**Flat input is a single text field** (decision locked by user — residents know their flat numbers from 6+ years of residence). Placeholder uses generic example `1011` (Tower 1 Floor 1 Unit 1 — smallest valid PSOTS flat), NOT a real resident's flat number.

**Client-side validation:** uses `flat.service.js` logic to validate format, reject invalid towers (6, 7, 13), reject floor 13, reject out-of-range floors/units per tower config.

### Validation rules

- **Flat number format:** must pass `validate()` in flat.service.js
- **Owner role:** reject if flat already has approved owner
- **Tenant role:** reject if flat's `hasTenants=false`
- **Family role:** reject if no approved primary in flat; reject if family count ≥ `flat.maxFamilyMembers`
- **Duplicate registration:** reject if identifier already has a credential on this flat

### Defense layers (even with single text input, errors are caught)

Per user's locked decision:

1. **Client-side validation** — flat.service.js catches format errors instantly
2. **Server-side validation** — same logic re-runs on Worker, can't bypass
3. **Admin approval** — every new registration hits admin queue, admin verifies identity
4. **Name visibility** — once registered, resident's name shows for their flat; community catches wrong-flat claims

### On submit

Create resident + credential atomically. Create flat doc if first. Notify approver (admin for owner/tenant, primary for family).

## 6. Edge cases

| # | Case | Handling |
|---|------|----------|
| 6.1 | Removed user tries to re-login | Appeal form shown (Section 25) |
| 6.2 | User deletes Google account, re-signs up with same email | Case B handles via email match |
| 6.3 | User has 2 Google accounts with different emails | Out of scope — post-launch self-service consolidation |
| 6.4 | User changes phone number | Manual admin update OR self-service credential add |
| 6.5 | Telegram user — phone sharing preferred | See Section 6.5 below |
| 6.6 | Family member without email | Phone-only credential, OTP login works |
| 6.7 | Owner tries to register as tenant of same flat | Validation blocks |
| 6.8 | Primary resident removed | Cascade family to "removed" |
| 6.9 | hasTenants turned OFF while tenants exist | Existing preserved, no new registrations |
| 6.10 | Flat ownership disputes | First registrant wins, admin investigates |
| 6.11 | Rejected user tries to re-register | Appeal form shown (Section 25) |

### 6.5 — Telegram authentication — phone sharing preferred

**Rationale:** Phone becomes the universal identifier across Telegram, WhatsApp (future), and SMS (future). Storing phone as the Telegram credential identifier enables automatic unification when WhatsApp integration launches, preventing duplicate accounts.

The `/verify` flow:

1. First-time user runs `/verify`
2. Bot sends message with two explicit button choices:
   ```
   Welcome to PSOTS!
   
   Share your phone number so we can link your account across 
   Google, Telegram, and (soon) WhatsApp — all one account.
   
   If you skip, your Telegram login stays separate from your 
   other logins. You can share phone later by running /verify again.
   
   [Share phone number (recommended)]
   [Continue without sharing]
   ```
3. User picks, OTP flow proceeds

**Phone-shared credential:**
- `type: "telegram"`, `identifier: "+919482088904"`
- Unifies with other phone-based credentials across methods (WhatsApp, SMS future)

**UserID-only credential:**
- `type: "telegram"`, `identifier: "telegram:123456789"`
- Siloed. Will not unify with future WhatsApp/SMS without manual linking

**Upgrade path:** Users can run `/verify` again later to switch from userID to phone-based credential. The old userID credential is replaced.

## 7. Device trust

**Three layers of trust:**

- **Layer 1 — Session** (90 days sliding, KV-backed). Expires on 90-day inactivity.
- **Layer 2 — Device trust** (1 year, Firestore). "This is my device" recognition.
- **Layer 3 — Credential** (forever, Firestore). Underlying auth identity.

### Flow — trusted device

```
User opens site → deviceToken cookie present
  → POST /auth/resume-device
  → Worker validates device_session
  → Creates fresh session
  → Dashboard loads (no login screen)
```

### Flow — new device

```
No deviceToken → login screen → user authenticates
  → Create session + device_session
  → Issue deviceToken cookie (1 year)
  → Email alert: "New sign-in from Chrome on iPhone, Bangalore"
  → Dashboard loads
```

### Flow — sign out all devices

```
Profile → Devices tab → "Sign out from all devices"
  → Delete all sessions for residentId
  → Mark all device_sessions revoked
  → Email confirmation
```

### Devices tab UI

```
Your devices

📱 iPhone · Chrome · This device          [Current]
   Last used: just now
   Bangalore · Since 18 Apr 2026

💻 MacBook · Safari                       [Sign out]
   Last used: 2 days ago
   Bangalore · Since 10 Apr 2026

[Sign out from all devices]
```

## 8. Admin model

Admin is a resident with `isAdmin: true`. No separate collection.

- **Superadmin** bootstrapped via env variable. New admins added by existing admins via admin panel action.
- **Samiti-specific admin rights** stored in `samitiRoles` array on resident (see Section 22).
- **Admin actions logged** to `admin_audit_log/` collection (Section 24).

## 9. Session cookie

```
psots_session=<sessionId>

KV: SESSIONS_KV/session:{sessionId} → { residentId, createdAt, expiresAt, lastActivityAt }
Scope: .psots.in (cross-subdomain)
TTL: 90 days sliding (extend on each request)
```

## 10. Profile page

**5 tabs:**

1. **Overview** — core info (name, flat, status, contact)
2. **Family** — add, approve, manage family members
3. **Devices** — see & manage devices (Section 7)
4. **Privacy** — consent toggles, block/mute, directory opt-out, data export
5. **Account** — login methods, linked credentials, download data, delete account

Horizontal tab bar. Mobile: scrollable tabs.

**Contact button on resident profiles (when viewing another resident):**
- Telegram deep link (primary) — `tg://resolve?domain={telegramUsername}`
- Request callback — sends email to target resident
- Email — respects `privacySettings.allowContact` toggle
- WhatsApp deep link (Sprint 6+ when phone sharing opt-in is built)

## 11. Dashboard

**3 zones:**

### Zone 1 — "Your Stuff" (conditional)
Only if pending actions exist. Hidden entirely if empty.

```
⚠️ 2 things need your attention
• Approve Priya's family request       [Approve] [Reject]
• Admin notice: Water supply           [Got it]
```

### Zone 2 — "Features"
Active + beta features. Personalized based on user's flats/apps.

### Zone 3 — "Coming Soon"
Roadmap teaser. Sets expectations.

**Mental health support links:** Footer includes discreet link to iCall helpline (1800-599-0019) and similar resources. No intrusive placement, but present for anyone who might need it.

## 12. Admin dashboard

**Hero section — 6 cards in 2 rows:**

### Row 1 — "Needs your attention" (red border for urgency)

```
┌──────────────────┬──────────────────┬──────────────────┐
│       3          │       1          │       0          │
│ 🔴 Pending       │ ⚖️ Appeals       │ 💬 Feedback      │
│    Approvals     │    Pending       │    Messages      │
└──────────────────┴──────────────────┴──────────────────┘
```

### Row 2 — "At a glance" (info only, gray border)

```
┌──────────────────┬──────────────────┬──────────────────┐
│     127          │      5           │      2           │
│ 👥 Total Active  │ 📈 New This Week │ 🚫 Group         │
│                  │                  │    Violations    │
└──────────────────┴──────────────────┴──────────────────┘
```

Each card clickable → filtered view of that queue.

**Below hero — 3 tabs:**
- **Residents** — approval queue, search, filter
- **Announcements** — post/manage
- **Group Moderation** — Telegram violations

**No AI bot in admin dashboard.** Action-required counters cover the workflow clearly.

## 13. Chhath Puja integration

### Shared auth
Session cookie scoped to `.psots.in` means login works on both subdomains automatically.

### First-time Chhath contributor
Their resident record's `apps` array gets `"chhath_puja"` added.

### Shared Firestore (single project)
- `residents/`, `credentials/`, `flats/` — shared
- `samitis/` — multi-tenant festival organizers (Section 22)
- `chhath_contributions/`, `chhath_volunteers/`, `chhath_subscriptions/`, `chhath_announcements/` — Chhath-specific

### Email via Resend
All Chhath invoicing moves from Apps Script Gmail → Resend. Uses `chhath@society.psots.in` sender address.

### WhatsApp
Drop Fonnte for launch. Use email only. Future: Interakt/AiSensy when volume justifies.

### Anonymous contributions preserved
Existing anonymous contribution flow on chhath.psots.in stays. Anonymous contributors don't create credentials. Receipt via entered email.

## 14. Migration plan

### Phase 1 (Sprint 1) — Prepare schema
- Add new adapter functions
- Keep old adapter functions for backward compat
- Write migration script (to be run at end of Sprint 4)
- Schema normalization: `alternatePhone` → `secondaryPhone`, `altEmail` → `secondaryEmail`

### Phase 2 (Sprint 2) — Deploy new auth endpoints
- `/auth/unified-login`
- `/auth/register`
- `/auth/resume-device`
- OTP rate limiting enforcement
- Old endpoints still work during transition

### Phase 3 (Sprint 3-4) — Frontend updates
- New login screen
- 3-zone dashboard
- Shared navbar
- 5-tab profile page
- Family approval UI rebuilt
- Admin panel 6-card hero
- Turnstile on registration/OTP/appeal forms
- chhath.psots.in portal reads new session cookie
- Chhath invoicing via Resend

### Phase 4 (End of Sprint 4) — Data migration
- Run migration script (residents, credentials, flats normalization)
- Consolidate Chhath Firebase into PSOTS Firebase
- Verify with test accounts
- Deprecate old auth endpoints (keep for 30 days grace)
- Delete old endpoints after Sprint 6 launch

## 15. Testing plan

### Unit tests
- Resident/credential/flat/device_session CRUD
- Credential lookup by (type, identifier)
- Credential lookup by identifier only
- Cross-subdomain cookie parsing
- Flat number parsing (all edge cases per `PSOTS_FlatNumber_Logic.md`)
- PII masking functions
- Rate limiter sliding window

### Integration tests
- All 3 login cases (A, B, C)
- All 3 registration types (owner/tenant/family)
- Rejection paths (removed, not approved, quota exceeded)
- Device trust resume
- New device email alert
- Appeal submission + admin review
- Rate limit triggering (OTP bombing scenario)

### Smoke tests
- End-to-end owner registration → approval → login
- Family invite → approval → login
- Same person logs in via 3 methods → single residentId
- Login at society → navigate to chhath → still logged in
- Remove resident → appeal → approve → re-login works

## 16. What stays unchanged

- PII masking (Option C — admins see full names; email, phone, secondary fields masked)
- KV sessions (carries residentId, 90-day sliding)
- Cache layer
- Invite system
- Telegram moderation bot
- Flat number format (canonical, documented separately)

## 17. Out of scope

**For Sprints 1-6:**
- Self-service credential management (post-launch)
- Cross-email unification (post-launch)
- Multi-flat session switcher (post-launch)
- SMS/WhatsApp as login methods (future, needs BSP)
- WhatsApp invoicing (dropped for launch)
- 2FA
- Account deletion (future)
- Payment gateway for Chhath (pending PSOTS Society registration)

**Deferred to Sprints 9+:**
- GCP integration (backups, heavy compute, BigQuery)
- Full AI features (resident-facing chat bot requires DPDP-compliant setup)
- Rule-based FAQ bot
- Verified vendor directory from Telegram scrape
- Multilingual support (revisit based on pilot feedback)

## 18. Sprint plan

| Sprint | Focus | Key deliverables |
|--------|-------|------------------|
| 1 | Identity foundation + device trust + rate limiting | Schema, adapters, migration script, KV rate limits, device_sessions |
| 2 | Unified login + registration + OTP protection | /auth/unified-login, /auth/register, OTP rate limits, brute force protection |
| 3 | PSOTS frontend + Turnstile + family/tenant rebuild | New login UI, 3-zone dashboard, 5-tab profile shell, Turnstile on forms |
| 4 | Profile tabs + Chhath migration + admin notices + privacy + appeals + 6-card hero + audit log + feature flags + Sentry | Large sprint; may split 4a/4b based on velocity |
| 5 | Pilot with 5-10 residents + threshold tuning | Real usage data, rate limit adjustments, bug fixes |
| 6 | Full PSOTS launch + Chhath ready + Event RSVP + Polls + Neighbor help + 30-day cooldown | Full platform live, Chhath 2026 operational |
| 7 | Vendor portal + Telegram ordering bot Phase 1 | /order flow, vendor schema, subscription model |
| 8 | Vendor operational readiness, onboard 5-10 vendors | 10 paying vendors, ₹990/mo revenue floor |
| 9+ | GCP backups + FAQ bot + Vendor directory (from Telegram scrape) + analytics | Operational maturity, post-launch features |

**Sprint 4 may split into 4a / 4b based on velocity.** That's fine. Roadmap is a guide, not a contract.

## 19. Locked decisions

| Decision | Value |
|----------|-------|
| Removed residents | Appeal form shown (7-day cooldown between appeals) |
| Multi-flat | One resident per (person, flat) |
| Admin | `isAdmin: true` flag |
| Login UX | 3 separate full-width buttons |
| Session | 90 days sliding |
| Email on new device | Always (override-able later) |
| Profile layout | 5 tabs |
| Welcome screen | Action Required card on dashboard |
| Device trust | Baked into Sprint 1 |
| Cross-subdomain | Cookie scoped to .psots.in |
| Telegram auth | Phone sharing preferred, userID fallback (user chooses) |
| Chhath integration | Sprint 4, after PSOTS refactor |
| Firestore | Single project, prefixed collections |
| Multi-app | `apps: []` field on resident |
| Multi-samiti | `samitis/` collection (Section 22) |
| Vendor ordering | Sprint 7-8, Telegram-first, email notifications (Section 23) |
| PII masking | Option C (full names to admins, email/phone masked) |
| Phone field naming | `phone` (primary) + `secondaryPhone` (optional) — no `alternatePhone` |
| Flat registration UX | Single text input (6+ year residents know their flats) |
| Flat schema | Hybrid — cached tower/floor/unit on write, parseable on read |
| maxFamilyMembers | Admin-configurable per flat, default 4, ceiling 8 |
| Admin dashboard | 6-card hero (3 action + 3 info), no AI assistant |
| Security rollout | Sprint 1-2 basics, Sprint 3-4 Turnstile invisible + email alerts, Sprint 5 tune from pilot |
| AI in platform | Not building resident chatbot; admin counters cover the need |
| Backups | Deferred until real user data exists (Sprint 6+) |
| GCP integration | Sprint 9+ |
| Account deletion | Privacy toggle now (Sprint 4), technical deletion later |
| Appeal cooldown | 7 days between submissions per resident |
| Turnstile | Invisible mode on registration/OTP/appeal/feedback forms |

## 20. Parallel tracks

These run alongside coding, user-driven:

- **PSOTS Society Act registration** — ~2-3 months, unlocks payment gateway for Chhath
- **Chhath Puja Samiti registration** — independent samiti under same platform
- **Payment gateway exploration** — defer until registration is active
- **Legal/CA consultation** — recommended before scaling Chhath contributions
- **Sponsorship outreach** — once samiti registration complete (Year 1 target: ₹70K-2L)
- **Domain strategy** — decide when/if to rename telegram.psots.in → api.psots.in
- **Ex RWA President preview** — share platform as individual contributor before wider rollout
- **Founding members for Chhath Samiti** — 7 members needed for Societies Act registration

## 21. Open questions

Not blocking. Defaults assumed:

- Exact wording for "new device" email alert (default: simple informational)
- Anonymous Chhath contributions create resident records? (default: no)
- Bulk admin import of residents? (default: no, manual entry)
- Dashboard tile color palette? (default: existing PSOTS palette)
- Admin-on-admin two-person rule for removals? (default: single admin, log all actions)

---

## 22. Samiti multi-tenant model

### Rationale

Pushkal manages Chhath Puja and can make unilateral decisions. Future festivals (Durga Puja, Ganesh Puja, Holi) will be organized by different groups with different leaders. Each group needs:

- Independent control over their own puja's operations
- Own payment method (their UPI, their bank account, their gateway)
- Own organizers (their admins, not PSOTS super-admins)
- Own contributors list, budget, announcements

While sharing the **PSOTS platform infrastructure** (login, residents, UI, Firestore, Worker).

### Schema

```javascript
samitis/{samitiId}
  samitiId: "samiti_chhath"
  name: "PSOTS Chhath Puja Samiti"
  description: "5-year running neighborhood Chhath festival"
  subdomain: "chhath.psots.in"
  organizerResidentIds: ["r_15167_abc", "r_4125_def", ...]
  adminResidentIds: ["r_15167_abc"]  // can modify samiti config
  paymentMethod: {
    type: "upi",                    // upi | gateway | bank_transfer
    upi: "pushkal@ybl",
    label: "Pay Pushkal Kishore (Chhath Organizer)"
  }
  paymentGateway: null,             // { type: "razorpay", keyId, accountId }
  registrationInfo: {
    registered: false,
    registrationNumber: null,
    certificate12A: null,
    certificate80G: null,
    panNumber: null
  }
  currentFestivalYear: 2026,
  apps: ["chhath_puja"],
  createdAt, updatedAt, createdBy
```

### Examples of future samitis

```
samiti_chhath       → chhath.psots.in      (Pushkal organizes)
samiti_durga        → durga.psots.in       (Sharma family organizes)
samiti_ganesh       → ganesh.psots.in      (someone else organizes)
samiti_holi         → holi.psots.in        (RWA cultural committee)
```

Each samiti is independent. Different organizers. Different money. Different rules. Same platform.

### How organizers use platform

1. Samiti admin logs in to society.psots.in (normal PSOTS login)
2. Gets access to samiti admin panel (because `samitiRoles` includes admin)
3. Configures payment method, adds organizers, manages contributors
4. Contributions from residents flow to samiti's configured payment (not platform's)
5. Transparency page auto-generated from samiti's contribution data

### Platform role

PSOTS does NOT:
- Touch samiti money
- Hold samiti funds
- Process payments on samiti's behalf
- Issue receipts for samiti (samiti uses its own receipt generator)

PSOTS DOES:
- Provide the website + login + UI
- Store contribution records (for transparency)
- Show contribution form + samiti's UPI QR
- Send email confirmations

### Pushkal's special role

Pushkal is samiti admin for Chhath Puja. Can configure Chhath samiti but NOT Durga Puja (unless their admins add him).

This creates clean separation: one person/group can organize festivals they care about without needing PSOTS platform owner's permission each time.

---

## 23. Vendor / Food Ordering Module

**Sprint 7-8.**

### Context

PSOTS has 5-10 regular food vendors (tiffin services, home cooks) and several occasional ones. Current ordering happens informally via WhatsApp/Telegram with no tracking, no structured menus, no reconciliation.

### Solution — Telegram-first ordering bot

**Architecture decision:** Telegram-first for launch (free, no BSP costs, validate demand). WhatsApp Business API added in Phase 2 once demand is proven.

### User flow (resident ordering)

```
User: /order → to PSOTS Telegram bot

Bot: Today's vendors:
  1. Aunty's Tiffin (South Indian) - 4 items
  2. Bhabhi's Kitchen (North Indian) - 6 items
  3. Priya's Bakery (Cakes) - 8 items

User: 1
Bot: Aunty's Tiffin menu for today:
  1. Dosa set (2 dosas + sambar + chutney) - ₹80
  2. Idli-vada combo - ₹90
  3. Mini meals (thali) - ₹120
  
  Reply: item_number x quantity
  Example: "1x2" for 2 dosa sets

User: 1x2
Bot: Order: 2 × Dosa set = ₹160
  Delivery to flat 15167?
  Reply YES to confirm.

User: YES
Bot: ✅ Order placed!
  Order #ORD-1234 for Aunty's Tiffin
  Pay ₹160 to: aunty@ybl
  [QR code]
  Aunty will message you when ready.
  
  Track order: /myorders
```

### User flow (vendor side)

```
🛒 New order #ORD-1234
From: Flat 15167 (Pushkal Kishore)
Items: 2 × Dosa set
Total: ₹160
Payment: Awaiting UPI to aunty@ybl

Reply:
/accept 1234  → confirm order
/reject 1234  → decline (reason required)
/ready 1234   → mark as ready for delivery
/delivered 1234 → mark as complete
```

### Payment flow

**Platform does NOT touch money.**

1. Order placed → Bot shows vendor's UPI ID + auto-generated QR
2. User pays vendor directly via any UPI app
3. User confirms payment in bot ("/paid 1234")
4. Vendor receives UPI credit notification on their phone
5. Vendor marks order as paid via bot (or auto-confirmed if UTR entered)

**Benefits:**
- Zero payment gateway cost
- Zero platform liability for money handling
- Vendor has full control of their own cash flow

### Schema

```javascript
vendors/{vendorId}
  vendorId: "vendor_aunty"
  residentId: "r_121012_xyz"        // vendor is also a PSOTS resident
  businessName: "Aunty's Tiffin"
  cuisine: "south_indian"
  description: "..."
  upiId: "aunty@ybl"
  deliveryAreas: ["tower_12", "tower_14"]
  operatingDays: ["mon", "tue", "wed", "thu", "fri"]
  operatingHours: { lunch: "11:00-13:00", dinner: "18:00-20:00" }
  isActive: true
  subscriptionStatus: "active",
  subscriptionExpiresAt: "2026-11-30T..."
  rating: 4.5
  createdAt, updatedAt

menus/{vendorId}/daily/{YYYY-MM-DD}
  items: [
    { id: "dosa_set", name: "Dosa set", price: 80, available: true, note: "..." },
  ]
  isPublished: true
  publishedAt: "2026-04-19T06:00:00Z"

orders/{orderId}
  orderId: "ORD-1234"
  residentId: "r_15167_abc"
  vendorId: "vendor_aunty"
  items: [{ itemId, name, quantity, price }]
  total: 160
  deliveryFlat: "15167"
  deliveryTime: "12:30"
  status: "placed",                // placed | accepted | ready | delivered | cancelled | disputed
  paymentStatus: "pending",        // pending | paid | refunded
  paymentMethod: "upi_direct",
  utr: null,
  placedAt, acceptedAt, readyAt, deliveredAt
  notes: ""

vendor_subscriptions/{vendorId}
  vendorId: "vendor_aunty"
  plan: "basic",                   // basic (₹99/mo) | premium (future)
  startDate: "2026-11-01"
  endDate: "2026-11-30"
  paymentsHistory: [
    { amount: 99, paidAt: "2026-11-01", utr: "..." }
  ]
  nextBillingDate: "2026-12-01"
  autoRenew: false
```

### Subscription model

**Vendor pays ₹99/month** to PSOTS (via UPI to platform admin — Pushkal for now).

**What vendor gets:** listed on vendor directory, menu management, automated order routing, reviews, order history, earnings summary.

**Break-even math:** 10 vendors × ₹99/month = ₹990/month gross. Costs ~₹0 (free tier). Net: ₹990/month.

### Phase 2 — WhatsApp integration

Conditions: 10+ paying vendors, clear elderly demand, ability to absorb ₹2,500-5,000/mo BSP cost (or raise subscription to ₹199).

### Out of scope (Phase 1)

Dine-in bookings, multiple deliveries per order, scheduled orders, discount codes, loyalty programs, multi-vendor cart.

---

## 24. Security & Abuse Prevention

**Phased rollout:**
- Sprint 1-2: Rate limiting basics, attempt tracking schema
- Sprint 3-4: Turnstile invisible mode on forms, email alerts for anomalies, admin audit log UI
- Sprint 5: Tune thresholds based on real pilot data

### Threat model

PSOTS is a society platform with ~2,100 flats and non-financial PII. Realistic attackers:
- Bored teenagers trying to enumerate
- Scrapers collecting contact info
- Opportunistic abusers (OTP bombing, harassment)

**Not the threat model:** state-level adversaries, organized crime. Design is "reasonable defense against casual abuse," not bank-grade.

### Rate limiting

**OTP request limits:**
- Max 5 OTP requests per hour per IP
- Max 3 OTPs per target identifier (email/phone) per hour — prevents victim bombing
- Max 50 OTPs per minute globally — prevents mass abuse

**OTP verification:**
- Max 5 verification attempts per OTP
- OTP invalidated after 5 failed attempts
- 15-minute OTP expiry (standard)
- Lock identifier for 30 minutes after 3 wrong attempts

**Login brute force:**
- Max 10 login attempts per IP per 5 minutes
- Max 5 login attempts per identifier per 15 minutes
- Exponential backoff: 2s, 4s, 8s, 16s after 5 failures

**Registration abuse:**
- Max 1 pending registration per email per 24 hours
- Max 1 pending registration per flat per 24 hours (for same role)
- Turnstile invisible mode on registration form
- Admin approval required before account becomes usable

**Appeal submissions:**
- 7-day cooldown per resident between appeals
- Max 10 appeals globally per hour (mass spam protection)
- Admin can flag abusive appeals → blocks future appeals from that identity

**Feedback/Contact Admin form:**
- Max 3 submissions per resident per 24 hours
- Content filtering: block excessive emoji/links/all-caps
- Turnstile CAPTCHA

### Cloudflare Turnstile (invisible mode)

Deployed on high-risk forms:
- Registration
- OTP request
- Appeal submission
- Feedback/Contact Admin

**Invisible mode only.** Most users never see a challenge. Only suspicious traffic gets challenged.

### Email alerts to admin

Triggered when any threshold hit:
- OTP requests > 100 in 10-min window
- Login failures > 50 per hour
- One IP > 200 requests per hour
- One identifier > 10 OTPs per hour → auto-lockout + alert

Alert format: plain-text email with action link. Admin dashboard also shows counters.

### Admin audit log

```javascript
admin_audit_log/{logId}
  logId: auto-generated
  adminResidentId: "r_15167_abc"
  action: "approve_resident" | "remove_resident" | "change_settings" | ...
  targetResidentId: "r_4125_xyz"
  targetFlat: "4125"
  reason: "Document verified"
  ipAddress: "103.x.x.x"
  userAgent: "..."
  timestamp: "2026-04-20T..."
```

Every admin action logged. Monthly review for patterns.

### Cloudflare WAF rules (free tier)

- Block known bad User-Agents
- Rate limit /api/* routes globally
- Bot Fight Mode enabled in Cloudflare dashboard
- Block countries with no expected traffic (configured post-pilot based on real data)

---

## 25. Restoration Appeals

**Removed/rejected residents can appeal via structured form.**

### Flow

1. Removed user tries to log in
2. System identifies status = "removed" or "rejected"
3. User sees appeal form with:
   - Pre-filled details (name, flat, removal date, reason if given)
   - Text field for appeal reason (500 char max)
   - Optional context field
   - Acknowledgment checkboxes
4. Submit creates `restoration_appeal` record
5. Admin gets email notification
6. Admin reviews in admin panel (alongside moderation history)
7. Admin: Approve → status changes to approved, user emailed
   Admin: Reject → stays removed, user emailed with reason
   Admin: Request info → user gets email with follow-up questions

**7-day cooldown between appeals per resident.**

### Form UX

```
⚠️ Your Account Was Removed

Your PSOTS account was deactivated on 15 March 2026.
Reason provided: "Rule violation"

If you believe this was an error or if you would like to appeal, 
you can raise a concern with the admin team below.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your Details (verified via Google):
  Name: Pushkal Kishore
  Flat: 15167
  Email: pushkalkishore@gmail.com
  Removed on: 15 March 2026

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Why should your account be restored?
[Please explain in a few sentences...          ]
(0 / 500 characters)

Any additional context (optional):
[                                              ]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

By submitting, you confirm:
☐ I understand admin review may take 5-7 days
☐ I agree to abide by community rules if restored

[Cancel]              [Submit Appeal]
```

### Schema

```javascript
restoration_appeals/{appealId}
  appealId: "appeal_abc123"
  residentId: "r_15167_xyz"
  submittedBy: "r_15167_xyz"
  submittedAt: "2026-04-20T..."
  reason: "I believe the rule violation was a misunderstanding..."
  additionalContext: "Was on vacation when Telegram post occurred..."
  status: "pending",              // pending | approved | rejected | info_requested
  reviewedBy: null,
  reviewedAt: null,
  reviewNotes: null,
  previousAppealAt: null,         // for 7-day cooldown enforcement
  flaggedAbusive: false,
  flaggedBy: null,
  flaggedAt: null
```

### Admin review UI

```
┌─────────────────────────────────────────────────┐
│  📬 Restoration Appeals (3 pending)              │
│                                                   │
│  🟡 Pushkal Kishore — Flat 15167                 │
│  Submitted: 2 hours ago                           │
│  Removed on: 15 March 2026                        │
│  Original reason: "Rule violation"                │
│                                                   │
│  Appeal reason:                                   │
│  "I believe the rule violation was a              │
│  misunderstanding..."                             │
│                                                   │
│  ▸ View resident's moderation history             │
│  ▸ View admin audit log for this resident         │
│                                                   │
│  [Reject]  [Request More Info]  [✅ Approve]     │
└─────────────────────────────────────────────────┘
```

Admin sees moderation history (Telegram violations, past warnings) alongside the appeal to make informed decisions.

### Abuse prevention

- Same auth required to appeal (no impersonation)
- 7-day cooldown enforced server-side
- Global rate limit: max 10 appeals per hour
- Admin can flag appeal as abusive → blocks future appeals from that identity forever

---

## 26. Privacy & Data Governance

### Privacy settings on resident record

```javascript
privacySettings: {
  allowContact: true,
  emailOnContact: true,
  showFlat: true,
  showNameOnRecommendations: true,
  hideFromDirectory: false,
  blockedResidentIds: [],
}
```

### Self-service privacy controls (Sprint 4)

**Profile → Privacy tab:**

- Toggle: Allow other residents to contact me
- Toggle: Show my flat number in directory
- Toggle: Hide me from resident directory entirely
- Block/mute specific residents (enter flat number or search)
- Download my data (GDPR-style export as JSON)
- Request account deletion (future — creates admin ticket)

### Admin access controls

**Option C PII masking (locked):**
- Admins see: full name, flat, status, access level
- Masked for admins: email (`p***@gmail.com`), phone (`+91 94XXX X8904`)
- Unmasked only on resident's own profile view
- Admin cannot bulk-export resident contact info

### DPDP 2023 compliance

India's Digital Personal Data Protection Act (2023) considerations:

- **Consent log** — track what resident agreed to at registration
- **Purpose statement** — every data field has stated reason for collection (in privacy policy)
- **Data retention** — removed residents kept for 1 year for appeal, then anonymized
- **Breach notification** — if PII leaked, admin alerted, affected users notified within 72 hours
- **Data subject rights** — export (Sprint 4), deletion (future), correction (via profile edit)

### Collections added for privacy

```javascript
user_blocks/{blockId}
  blockId: auto
  blockingResidentId: "r_15167_abc"
  blockedResidentId: "r_4125_xyz"
  reason: "harassment" | "spam" | "other"
  createdAt

abuse_reports/{reportId}
  reportId: auto
  reporterResidentId: "r_15167_abc"
  reportedResidentId: "r_4125_xyz"
  reportedContent: "reference to specific content"
  reason: "harassment" | "fraud" | "inappropriate" | "spam"
  status: "pending" | "actioned" | "dismissed"
  createdAt, reviewedAt, reviewedBy
```

---

## 27. Operational Infrastructure

### Feature flags

```javascript
feature_flags/{flagId}
  flagId: "enable_vendor_portal"
  enabled: false
  rolloutPercent: 0          // 0-100, for gradual rollouts
  enabledForResidentIds: []  // specific residents for beta
  description: "Vendor Telegram ordering module"
  createdAt, updatedAt
```

**Use cases:**
- Kill switch: disable feature instantly if misbehaving
- Gradual rollout: enable for 10% of users first
- Beta access: specific residents get early access
- Sprint safety: ship code dark, enable when ready

**Checked at endpoint level:** Worker reads feature flag before routing to feature code.

### Error tracking (Sentry free tier)

- Integrate `@sentry/cloudflare` in Worker
- Track: uncaught exceptions, unhandled promise rejections, slow endpoints (>1s)
- Sampling: 10% in production (free tier limit)
- Alerts: email admin on error rate spike
- Dashboards: daily error digest, top errors, affected users

**Free tier limits:** 5,000 errors/month. At PSOTS scale this is comfortable.

### Uptime monitoring

- UptimeRobot free tier: 50 monitors, 5-minute intervals
- Monitor: society.psots.in, chhath.psots.in, psots.in, telegram.psots.in
- Alert channels: email, Telegram notification to admin

### Backups (Sprint 6+)

**Deferred until real user data exists.**

When deployed:
- Cloud Scheduler triggers Cloud Function daily at 3 AM
- Exports Firestore to Google Cloud Storage
- 30-day retention rolling
- Alternative: Cloudflare R2 + Worker cron if keeping on Cloudflare-only stack

### Moderation admin UI (Sprint 4)

Admin tools for:
- View abuse reports queue
- Review flagged content
- Issue warnings
- Temporarily mute residents
- Remove residents (with mandatory reason)
- View appeal queue
- Audit log browser (filter by admin, by date, by action type)

---

## 28. Flat number format summary

**Canonical specification: `docs/_legacy/PSOTS_FlatNumber_Logic.md`**

### Format

```
flatNumber = {tower}{floor_padded_2digits}{unit}
```

- Tower: no padding (raw 1-17, excluding 6, 7, 13)
- Floor: ALWAYS 2 digits (padded with leading zero)
- Unit: raw (1 digit for most towers, 2 digits for towers 12, 14)

### Valid towers

`[1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 14, 15, 16, 17]`

Towers 6, 7, 13 do not exist.

### Skipped floors

`[13]` — no floor 13 in any tower.

### Tower config

| Tower | Max Floor | Max Unit |
|-------|-----------|----------|
| 1, 2, 3, 10, 11, 15, 16, 17 | 17 | 8 |
| 4 | 20 | 8 |
| 5 | 20 | 4 |
| 8, 9 | 29 | 8 |
| 12, 14 | 17 | 12 |

### Examples used throughout this document

- `15167` — Tower 15, Floor 16, Unit 7 (Pushkal's example flat)
- `4125` — Tower 4, Floor 12, Unit 5
- `8296` — Tower 8, Floor 29, Unit 6
- `121012` — Tower 12, Floor 10, Unit 12
- `1011` — Tower 1, Floor 1, Unit 1 (smallest valid flat, used as form placeholder)

### Parser behavior

Uses longest-prefix matching: `11178` matches Tower 11 (not Tower 1), because parser tries longest tower prefixes first.

### Total flat count

~2,084 flats across 14 towers (matches "2,100+ flats" public claim).

---

## 29. Summary

**Sprints 1-4:** Identity + auth + PSOTS frontend + Chhath migration + trust/safety primitives
**Sprints 5-6:** Pilot + full PSOTS launch + Chhath Puja festival support + community features
**Sprints 7-8:** Vendor portal + Telegram ordering + vendor onboarding
**Sprints 9+:** GCP backups, AI features (non-resident-facing), FAQ bot, vendor directory from scrape, analytics

**Total: 12+ sprints, expected over 3-4 months of weekends for Sprints 1-8, with 9+ as post-launch operational work.**

All schema slots reserved from Sprint 1 onwards so later sprints don't require refactor.

**Critical invariants:**

1. Flat numbers follow `docs/_legacy/PSOTS_FlatNumber_Logic.md` — never use ad-hoc parsing
2. Phone fields: `phone` (primary) + `secondaryPhone` (optional). Never `alternatePhone` in new code.
3. PII masking: Option C — admins see names, email/phone masked
4. Sessions cross-subdomain (`.psots.in`)
5. Rate limits enforced server-side, client UI provides friendly errors
6. Admin actions logged without exception
7. Appeals mandatory for removed users — no cold "contact admin" dead ends
8. No AI in resident-facing platform (Sprint 9+ revisit with DPDP-compliant setup)
9. Single text input for flat number, with client + server validation and admin verification as multi-layer defense
10. Feature flags used for all non-trivial features from Sprint 4 onwards
