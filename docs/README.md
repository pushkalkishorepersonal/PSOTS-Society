# Identity Model — PSOTS Ecosystem

**Status:** Design approved, ready for Sprint 1
**Last updated:** 2026-04-19
**Author:** Pushkal Kishore (design), assisted by Claude
**Target:** Sprints 1-8 (PSOTS identity refactor + Chhath integration + vendor system)

---

## 0. Scope — What this covers

This design is for the **PSOTS ecosystem**:

- **society.psots.in** — Residents community platform (PSOTS Society)
- **chhath.psots.in** — Chhath Puja 2026 (5th annual neighborhood festival)
- Future festivals and community events planned for same ecosystem (Durga Puja, Ganesh Puja, Holi, etc.)
- Future vendor/food ordering module (Sprint 7-8)

Both current sites share:
- Unified identity (one login, works across both)
- Shared Resend email account
- Shared Cloudflare Worker infrastructure
- Shared Firebase project (after Chhath migration)

They remain visually distinct but operate as one logical community platform.

Multi-samiti support is baked in from day one — each festival can be organized by an independent samiti with its own organizers, payment method, and contributors while sharing the PSOTS login infrastructure.

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
- Foundation for future apps (Holi, Ganesh Chaturthi, Durga Puja, etc.)
- Multi-samiti governance supported

## 2. Core model

### Core entities

- **Resident** — real human in a specific flat with a specific role. `residents/{residentId}`
- **Credential** — one auth method (Google/email/phone) for one resident. `credentials/{credentialId}`
- **Flat** — physical apartment with settings. `flats/{flatNumber}`
- **Samiti** — independent festival organizing entity with own admins and payment. `samitis/{samitiId}` (Section 21)
- **Vendor** — food/service seller subscription record. `vendors/{vendorId}` (Section 22)

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

Pushkal who owns flat 1204 AND rents flat 1807 has TWO resident records: `r_1204_...` (owner) and `r_1807_...` (tenant). Admin views filter by flat.

## 3. Schema

### `residents/{residentId}`

```javascript
{
  residentId: "r_1204_a7b3c9",
  flatNumber: "1204",
  name: "Pushkal Kishore",
  primaryEmail: "pushkal@gmail.com",
  primaryPhone: "+919812345678",
  role: "owner",                   // owner | tenant | family_of_owner | family_of_tenant
  status: "approved",              // pending | approved | rejected | removed
  isAdmin: false,
  linkedToResidentId: null,        // only for family_of_*
  apps: ["psots_society"],         // ["psots_society", "chhath_puja", ...]
  samitiRoles: [],                 // [{ samitiId, role: "admin" | "organizer" }]
  vendorId: null,                  // set if this resident is also a vendor
  createdAt, approvedAt, approvedBy, rejectedAt, rejectedBy,
  rejectionReason, removedAt, removedBy, removalReason,
  accessLevel: "owner",            // legacy, backward compat
  invitedByFlat: null,
}
```

### `credentials/{credentialId}`

```javascript
{
  credentialId: "cred_xyz789",
  residentId: "r_1204_a7b3c9",
  type: "google",                  // google | email | telegram | whatsapp | sms
  identifier: "pushkal@gmail.com", // email or phone (E.164)
  firebaseUid: "abc123xyz",
  verifiedAt, lastUsedAt, createdAt,
}
```

**Index:** query by `(type, identifier)` powers login.

### `flats/{flatNumber}`

```javascript
{
  flatNumber: "1204",
  ownerResidentId: "r_1204_a7b3c9", // null until owner registers
  hasTenants: false,                 // owner-controlled toggle
  maxFamilyMembers: 4,
  tenantCount: 0, familyCount: 0,    // derived
  createdAt, updatedAt,
}
```

### `device_sessions/{deviceToken}`

```javascript
{
  deviceToken: "dev_xyz",
  residentId: "r_1204_a7b3c9",
  deviceName: "Chrome on iPhone",
  ipAddress: "103.x.x.x",
  cityHint: "Bangalore",
  fingerprint: "...",
  createdAt, lastUsedAt,
  expiresAt: "2027-04-19T...",       // 1 year
  revoked: false, revokedAt, revokedBy,
}
```

## 4. Authentication flow — login

### Landing page — 3 buttons

```
[G]  Continue with Google
✉️   Continue with Email
📱  Continue with Phone (Telegram OTP)
```

### Lookup logic

```
POST /auth/unified-login
  body: { type, identifier, firebaseToken }

Cases:
  A. Credential exists for (type, identifier) → log in
  B. Credential doesn't exist but identifier matches another credential
      → link new method to same resident
  C. No match anywhere → route to registration
```

### Status-based routing

- `approved` → dashboard
- `pending` → "awaiting approval" screen
- `rejected` | `removed` → "contact admin" screen (no login)

### Cross-subdomain cookie

```
Set-Cookie: psots_session=<sessionId>; Domain=.psots.in; Path=/;
            Secure; HttpOnly; SameSite=Lax
```

Login at society.psots.in automatically logs into chhath.psots.in.

## 5. Registration flow — new user

### Screen after Case C

```
Welcome to PSOTS!

Flat number: [____]

I am:
( ) Owner of this flat
( ) Tenant in this flat
( ) Family member of someone who lives here

[Continue]
```

### Validation rules

- Owner: reject if flat already has approved owner
- Tenant: reject if flat's `hasTenants=false`
- Family: reject if no approved primary in flat; reject if family count ≥ maxFamilyMembers

### On submit

Create resident + credential atomically, create flat doc if first, notify approver (admin for owner/tenant, primary for family).

## 6. Edge cases

| # | Case | Handling |
|---|------|----------|
| 6.1 | Removed user tries to re-login | 403 "contact admin", no re-registration |
| 6.2 | User deletes Google account, re-signs up | Case B handles via email match |
| 6.3 | User has 2 Google accounts with different emails | Out of scope — post-launch self-service consolidation |
| 6.4 | User changes phone number | Manual admin update OR self-service credential add |
| 6.5 | Telegram user — phone sharing preferred | See dedicated section below |
| 6.6 | Family member without email | Phone-only credential, OTP login works |
| 6.7 | Owner tries to register as tenant of same flat | Validation blocks |
| 6.8 | Primary resident removed | Cascade family to "removed" |
| 6.9 | hasTenants turned OFF while tenants exist | Existing preserved, no new registrations |
| 6.10 | Flat ownership disputes | First registrant wins, admin investigates |

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
- `type: "telegram"`, `identifier: "+919812345678"`
- Unifies with other phone-based credentials across methods (WhatsApp, SMS future)

**UserID-only credential:**
- `type: "telegram"`, `identifier: "telegram:123456789"`
- Siloed. Will not unify with future WhatsApp/SMS without manual linking

**Upgrade path:** Users can run `/verify` again later to switch from userID to phone-based credential. The old userID credential is replaced.

## 7. Device trust (3 layers)

**Layer 1 — Session** (90 days sliding, KV-backed). Expires on 90-day inactivity.  
**Layer 2 — Device trust** (1 year, Firestore). "This is my device" recognition.  
**Layer 3 — Credential** (forever, Firestore). Underlying auth identity.

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

Superadmin bootstrapped via env variable. New admins added by existing admins via admin panel action.

Samiti-specific admin rights are stored in `samitiRoles` array on resident (see Section 21).

## 9. Session cookie

```
psots_session=<sessionId>

KV: SESSIONS_KV/session:{sessionId} → { residentId, createdAt, expiresAt }
Scope: .psots.in (cross-subdomain)
TTL: 90 days sliding
```

## 10. Profile page — 5 tabs

1. **Overview** — core info
2. **Family** — add, approve, manage (currently disabled with "Coming Soon" until Sprint 3)
3. **Devices** — see & manage devices (Section 7)
4. **Privacy** — consent toggles, data export
5. **Account** — login methods, data, delete

Horizontal tab bar. Mobile: scrollable tabs.

## 11. Dashboard — 3 zones

### Zone 1 — "Your Stuff" (conditional)
Only if pending actions exist. Hidden entirely if empty.

```
⚠️ 2 things need your attention
• Approve Priya's family request       [Approve] [Reject]
• Admin notice: Water supply           [Got it]
```

### Zone 2 — "Features"
Active + beta features.

### Zone 3 — "Coming Soon"
Roadmap teaser.

## 12. Chhath Puja integration

### Shared auth
Session cookie scoped to `.psots.in` means login works on both subdomains automatically.

### First-time Chhath contributor
Their resident record's `apps` array gets `"chhath_puja"` added.

### Shared Firestore (single project)
- `residents/`, `credentials/`, `flats/` — shared
- `samitis/` — multi-tenant festival organizers (Section 21)
- `chhath_contributions/`, `chhath_volunteers/`, `chhath_subscriptions/`, `chhath_announcements/` — Chhath-specific

### Email via Resend
All Chhath invoicing moves from Apps Script Gmail → Resend.

### WhatsApp
Drop Fonnte for launch. Use email only. Future: Interakt/AiSensy when volume justifies.

### Anonymous contributions preserved
Existing anonymous contribution flow on chhath.psots.in stays. Anonymous contributors don't create credentials. Receipt via entered email.

## 13. Migration plan

### Phase 1 (Sprint 1) — Prepare schema
- Add new adapter functions
- Keep old adapter functions for backward compat
- Write migration script

### Phase 2 (Sprint 2) — Deploy new auth endpoints
- `/auth/unified-login`
- `/auth/register`
- `/auth/resume-device`
- Old endpoints still work during transition

### Phase 3 (Sprint 3-4) — Frontend updates
- New login screen, dashboard, profile, navbar
- chhath.psots.in portal reads new session cookie
- Chhath invoicing via Resend

### Phase 4 (End of Sprint 4) — Data migration
- Run migration script
- Consolidate Chhath Firebase into PSOTS Firebase
- Verify with test accounts
- Delete old auth endpoints

## 14. Testing plan

### Unit tests
- Resident/credential/flat/device_session CRUD
- Credential lookup by (type, identifier)
- Credential lookup by identifier only
- Cross-subdomain cookie parsing

### Integration tests
- All 3 login cases (A, B, C)
- All 3 registration types (owner/tenant/family)
- Rejection paths (removed, not approved, quota exceeded)
- Device trust resume
- New device email alert

### Smoke tests
- End-to-end owner registration → approval → login
- Family invite → approval → login
- Same person logs in via 3 methods → single residentId
- Login at society → navigate to chhath → still logged in

## 15. What stays unchanged

- PII masking (Option C — admins see full names, email/phone masked)
- KV sessions (carries residentId, 90-day sliding)
- Cache layer
- Rate limiting
- Invite system
- Telegram bot

## 16. Out of scope for this refactor

- Self-service credential management (post-launch)
- Cross-email unification (post-launch)
- Multi-flat session switcher (post-launch)
- SMS/WhatsApp as login methods (future, needs BSP)
- WhatsApp invoicing (dropped for launch)
- 2FA (future)
- Account deletion (future)
- Payment gateway for Chhath (pending PSOTS Society registration)

## 17. Sprint plan

| Sprint | Work | Haiku tokens | Weekend |
|--------|------|--------------|---------|
| 1 | Identity data model + device trust schema + adapter functions + migration script | 30-35k | 1 |
| 2 | Unified login + registration endpoints + KV session changes | 25-30k | 2 |
| 3 | PSOTS frontend: login + 3-zone dashboard + shared navbar + family approval UI | 30-35k | 3 |
| 4 | Profile 5-tabs + Chhath migration (auth + Resend + Firestore merge) + admin notices | 30-35k | 4 |
| 5 | PSOTS pilot (5-10 residents) + bug fixes from real usage | testing | 5 |
| 6 | Full PSOTS launch + Chhath Puja ready for Oct 2026 | operational | 6 |
| 7 | Vendor portal + Telegram ordering bot (Phase 1 of vendor module, Section 22) | 30-35k | 7 |
| 8 | Vendor operational readiness, onboard 5-10 vendors | operational | 8 |

## 18. Decisions locked in

| Decision | Value |
|----------|-------|
| Removed residents | Cannot re-login |
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
| Multi-samiti | `samitis/` collection (Section 21) |
| Vendor ordering | Sprint 7-8, Telegram-first, email notifications (Section 22) |

## 19. Parallel tracks (not Haiku work)

These run in parallel with coding, user-driven:

- **PSOTS Society Act registration** — ~2-3 months process, unlocks payment gateway for Chhath
- **Chhath Puja Samiti registration** — independent samiti under same platform
- **Payment gateway exploration** — defer until registration is active
- **Legal/CA consultation** — recommended before scaling Chhath contributions
- **Sponsorship outreach** — once samiti registration complete
- **Domain strategy** — decide when/if to rename telegram.psots.in → api.psots.in

## 20. Open questions — user can revisit anytime

Not blocking. Defaults assumed:

- Exact wording for "new device" email alert (default: simple informational)
- Anonymous Chhath contributions create resident records? (default: no)
- Bulk admin import of residents? (default: no, manual entry)
- Dashboard tile color palette? (default: existing PSOTS palette)

---

## 21. Samiti multi-tenant model

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
  organizerResidentIds: ["r_1204_abc", "r_1305_def", ...]
  adminResidentIds: ["r_1204_abc"]  // can modify samiti config
  paymentMethod: {
    type: "upi",                    // upi | gateway | bank_transfer
    upi: "pushkal@ybl",
    label: "Pay Pushkal Kishore (Chhath Organizer)"
  }
  // Optional gateway config (once registered)
  paymentGateway: null,             // { type: "razorpay", keyId, accountId }
  // Optional samiti registration info
  registrationInfo: {
    registered: false,              // true after Societies Act registration
    registrationNumber: null,       // e.g., "SOC/2026/BLR/1234"
    certificate12A: null,           // once 80G/12A approved
    certificate80G: null,
    panNumber: null
  }
  currentFestivalYear: 2026,
  apps: ["chhath_puja"],            // which app this samiti powers
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
- Show contribution form + vendor's UPI QR
- Send email confirmations

### Pushkal's special role

Pushkal is samiti admin for Chhath Puja. Can configure Chhath samiti but NOT Durga Puja (unless their admins add him).

This creates clean separation: one person/group can organize festivals they care about without needing PSOTS platform owner's permission each time.

---

## 22. Vendor / Food Ordering Module (Sprint 7-8)

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
  Delivery to flat 1204?
  Reply YES to confirm.

User: YES
Bot: ✅ Order placed!
  Order #ORD-1234 for Aunty's Tiffin
  Pay ₹160 to: pushkal@ybl
  [QR code]
  Aunty will message you when ready.
  
  Track order: /myorders
```

### User flow (vendor side)

Vendor gets notification in their Telegram:

```
🛒 New order #ORD-1234
From: Flat 1204 (Pushkal Kishore)
Items: 2 × Dosa set
Total: ₹160
Payment: Awaiting UPI to pushkal@ybl

Reply:
/accept 1234  → confirm order
/reject 1234  → decline (reason required)
/ready 1234   → mark as ready for delivery
/delivered 1234 → mark as complete
```

Vendor web portal (optional, Phase 1.5):

- Daily menu management (add/edit items, prices, availability)
- Order queue (pending, accepted, ready, delivered)
- Customer history, favorites, repeat orders
- Earnings summary

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
- Works without any registration/compliance on platform side

### Schema

```javascript
vendors/{vendorId}
  vendorId: "vendor_abc"
  residentId: "r_1205_xyz"        // vendor is also a PSOTS resident
  businessName: "Aunty's Tiffin"
  cuisine: "south_indian"
  description: "..."
  upiId: "aunty@ybl"
  deliveryAreas: ["tower_a", "tower_b"]
  operatingDays: ["mon", "tue", "wed", "thu", "fri"]
  operatingHours: { lunch: "11:00-13:00", dinner: "18:00-20:00" }
  isActive: true
  subscriptionStatus: "active",    // active | expired | paused
  subscriptionExpiresAt: "2026-11-30T..."
  rating: 4.5                      // derived from reviews
  createdAt, updatedAt

menus/{vendorId}/daily/{YYYY-MM-DD}
  items: [
    { id: "dosa_set", name: "Dosa set", price: 80, available: true, note: "..." },
    ...
  ]
  isPublished: true
  publishedAt: "2026-04-19T06:00:00Z"

orders/{orderId}
  orderId: "ORD-1234"
  residentId: "r_1204_abc"
  vendorId: "vendor_aunty"
  items: [{ itemId, name, quantity, price }]
  total: 160
  deliveryFlat: "1204"
  deliveryTime: "12:30"
  status: "placed",                // placed | accepted | ready | delivered | cancelled | disputed
  paymentStatus: "pending",        // pending | paid | refunded
  paymentMethod: "upi_direct",
  utr: null,                       // user-entered transaction ref
  placedAt, acceptedAt, readyAt, deliveredAt
  notes: ""

vendor_subscriptions/{vendorId}
  vendorId: "vendor_abc"
  plan: "basic",                   // basic (₹99/mo) | premium (future)
  startDate: "2026-11-01"
  endDate: "2026-11-30"
  paymentMethod: "upi",
  paymentsHistory: [
    { amount: 99, paidAt: "2026-11-01", utr: "..." }
  ]
  nextBillingDate: "2026-12-01"
  autoRenew: false
```

### Subscription model

**Vendor pays ₹99/month** to PSOTS (via UPI to platform admin — Pushkal for now).

**What vendor gets:**
- Listed on PSOTS vendor directory
- Daily menu management
- Automated order routing via Telegram bot
- Customer reviews and ratings
- Order history and analytics

**What platform covers:**
- Infrastructure costs (Cloudflare Workers, Firebase — free tier)
- Bot maintenance
- Feature development

**Break-even math:**
- At 10 vendors × ₹99/month = ₹990/month gross
- Costs: ~₹0 (free tier for 500 orders/day easily)
- Net revenue: ₹990/month covers any ad-hoc costs

### Phase 2 — WhatsApp integration (only after proven demand)

Conditions for adding WhatsApp Business API:
- 10+ active paying vendors (₹990/month floor)
- Clear user demand from elderly/non-Telegram users
- Ability to absorb ₹2,500-5,000/month BSP cost (or raise subscription to ₹199)

When triggered:
- Onboard via Interakt or AiSensy
- Build WhatsApp menu-driven interface matching Telegram bot
- Keep Telegram bot active (dual channel)
- Users get same ordering experience regardless of channel

### Target users

- **Young professionals** (Telegram-active) — primary users at launch
- **Elderly/homemakers** (WhatsApp-only) — secondary, reached in Phase 2
- **Mixed household** — WhatsApp for family, Telegram for tech-savvy members

### Notifications (Phase 1 — launch)

- In-app dashboard order status
- Email for order confirmation
- Telegram bot for order updates
- NO WhatsApp at launch (cost-deferred to Phase 2)

### Out of scope (Phase 1)

- Dine-in table bookings
- Multiple deliveries per order
- Scheduled/recurring orders
- Vendor promotional tools / discount codes
- Customer loyalty programs
- Multi-vendor cart (one vendor per order for Phase 1)

---

## 23. Summary — what Haiku will build

**Sprints 1-4:** Identity + auth + PSOTS frontend + Chhath migration  
**Sprints 5-6:** Pilot + full PSOTS launch + Chhath Puja festival support  
**Sprints 7-8:** Vendor portal + Telegram ordering + vendor onboarding

**Total: 8 sprints, expected over 2-3 months of weekends.**

All schema slots reserved from Sprint 1 onwards so later sprints don't require refactor.
