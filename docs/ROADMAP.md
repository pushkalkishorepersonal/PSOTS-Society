# PSOTS Society — Roadmap

---

## ✅ Completed

- [April 28] Sprint 5 — Auth simplification and V2 resident data loading (16+10 commits) — Removed Email OTP and Telegram OTP flows, simplified to Google + Email/Password. Rebuilt registration form as 3-step flat → role → details flow. Implemented unified-login endpoint for both old (uid) and new (residentId) schema residents. Migrated admin approval/rejection to Worker API endpoints. Added JWT auto-retry and superadmin bypass. Added phone number support to registration and profile. Fixed Firestore document ID extraction for admin panel. Implemented time-aware greeting on dashboard. Enabled Firebase Account Linking. All tests passing, 0 lint errors.
- [April 18] PII masking wired (Prompt 7) — Masking functions imported from src/db/pii.js, applied at 4 key routes (/admin/residents, /family/list, /invite/validate, /invite/accept audit). 9 PII-leak smoke tests verify no raw email/phone leaks. Tests 41 → 50, 0 lint errors.
- [April 18] Cache layer + rate limiting (Prompt 6) — KV-backed read cache wrapping 3 hot reads (60-70% Firestore reduction), sliding-window rate limiting (auth 5/min, public 30/min, session 120/min, admin 300/min), 15 tests passing
- [April 18] DB adapter refactoring (Phase 2 task 2.5) — js/core/db.js wrapper, all services migrated (resident, admin, marketplace, flat, rateLimit), architecture check passing and enabled in CI
- [April 18] Quality gates infrastructure — Vitest, ESLint, architecture lint check, GitHub Actions CI job
- [April 18] Current state inventory (Phase 0B) — /docs/CURRENT_STATE.md with all routes, services, collections, integrations
- [April 18] Repo cleanup (Phase 0A) — 28 images, 8 PDFs, 13 legacy docs consolidated, README condensed
- [April 28] Google OAuth login — fully implemented with Firebase Auth, Firebase Console account linking enabled
- [April 28] Email/Password login — Firebase createUserWithEmailAndPassword, password reset via sendPasswordReset() with PSOTS branding
- [April 28] Resident registration form — rebuilt as 3-step flow (flat selection → role selection → personal details)
- [April 28] Admin approval workflow — POST /admin/approve endpoint, sends confirmation email, supports both old and new schema
- [April 28] Admin rejection workflow — POST /admin/reject endpoint with reasonCategory + reasonNote, sends rejection email
- [April 28] Device trust system — localStorage UUIDs, GET /device/check quick return, email notification on new device login
- [April 28] Password reset email — Firebase sendPasswordReset() with PSOTS branding
- [April 28] Phone number support — optional field in registration, stored in resident profile, displayed in profile page
- [April 28] Time-aware greeting — Good morning/afternoon/evening/night based on system time
- Device trust system — quick return on known devices
- Identity resolution — multi-provider linking, flat ownership
- Firestore security rules — role-based access control
- Admin panel core — resident list, filter, approval UI
- Audit logging — all admin actions logged
- Privacy policy page (society/privacy.html)
- Telegram bot infrastructure — OTP delivery, group handling
- Gemini-powered moderation — context-aware violation detection
- Violation tracking — mute/ban actions, appeal submission
- Email infrastructure — Resend API integrated, templates ready
- Community pages live — Marketplace, Carpool, Lost & Found, Jobs, Recommendations

---

## ⚠️ In Progress — before pilot onboarding (Early May target)

| Task | Status | Blocker |
|------|--------|---------|
| Profile page polish | ✅ DONE | Hero heading fixed, resident data loads, phone field added, modal centering fixed, phone editing via Worker endpoint |
| Pilot onboarding workflow | ⚠️ PARTIAL | Documentation drafted, need: 5-10 test residents, feedback collection, bug fixes from real usage |
| Email delivery verification | ⚠️ UNTESTED | All transactional emails exist but delivery not confirmed in Resend dashboard |
| Family approval endpoints | ❌ MISSING | POST /family/approve and /family/reject needed for full Phase 2 close |
| Admin notice UI for family/tenant joins | ❌ MISSING | No acknowledge/flag UI for admin notices |
| First-login onboarding modal | ❌ MISSING | No onboarding UI exists, deferred to Phase 3 |

---

## Phase 2 — Finish auth and registration (target: weeks 1–3)

**Remaining priority items:**

1. **Family approval endpoints** — POST /family/approve, POST /family/reject, owner-side UI in My Family tab.
2. **Admin notice UI** — acknowledge or flag when family/tenant joins. One-click, not a blocking workflow.
3. **Email verification** — send test emails through every flow, confirm delivery in Resend dashboard.
4. **Onboarding modal** — first-login checklist: add Telegram username, invite family, explore marketplace.

*(PII masking and DB adapter completed in pre-work)*

---

## Phase 2B — Identity & Verification (target: Sprint 6–7)

**Build resident ownership verification and delegation system.**

- **Context-aware Gemini moderation** — Per-group settings for keyword detection, admin controls for rules/actions, trained on PSOTS community norms
- **Document ownership verification** — Resident uploads maintenance invoice or property deed (3+ pages). Gemini extracts and validates owner name + flat number. Auto-approve on match, admin review on mismatch. Auto-purge documents after 30 days.
- **Ownership delegation model** — Legal owner verified via document. Can delegate flat management to family member. Delegate gets full admin privileges for that flat only.
- **Tenant verification** — Owner approval mandatory gate for tenants. Optional rent agreement upload for verified tenant badge in community.
- **Role-based access control** — Verification level + flat role determines permissions. Unverified = read-only access. Verified = full community access. Flat Admin = community + flat management privileges.
- **Poll voting system** — One vote per flat. Poll creator sets eligibility: all residents, owners+family only, or admins only. First eligible voter from flat locks the vote.
- **Account linking UI** — Profile page → "Link Telegram" button. Post-Google-login flow to add Telegram as second sign-in method. Telegram-first users enter email to find and link existing account.

---

## Phase 3A — Telegram food ordering (target: weeks 4–6)

**Build on Telegram first. Prove the vendor model before building the website version.**

The Foodies Telegram group has 1,224 members, 38 posts/day, 5 years of continuous activity. The audience is already there. Build here first.

- Bot command `/food` or inline menu button in the group
- Vendor list as inline keyboard — only active vendors shown
- Tap vendor → today's menu as inline buttons with prices
- Tap items to add to cart, confirm order
- Bot DMs vendor with order details (flat number, items, total)
- Vendor replies "confirm" → resident notified of confirmation
- All orders logged to Firestore under orders/{orderId}
- Vendor gets weekly auto-DM on Monday: top items, total orders, peak hours

**Vendor subscription model starts Month 7 (6-month free period first):**
- Daily vendors: ₹99/month flat subscription
- Occasional sellers: ₹10/post credit pack (₹50 for 5, ₹90 for 10), credits never expire
- Auto-nudge: if seller uses >10 credits in a month, show monthly plan savings
- WhatsApp add-on: ₹49/month opt-in, only when WhatsApp API threshold is met

---

## Phase 3B — Website food market (target: weeks 7–9)

After Telegram ordering is proven with real orders:

- Vendor profile pages on website
- Product listings with availability toggle and photo (Cloudflare R2)
- WhatsApp order button via wa.me pre-filled link — zero API cost
- Vendor order dashboard on website — pending / confirmed / delivered
- Rating system — buyer rates after delivery
- Billing management — vendor subscription status, credit balance

---

## Phase 4 — Carpool (target: month 3–4)

**Competitive edge: flat-verified neighbours, single gate pickup, zero commission, women-only option.**

- Ride offer: destination area, time, seats, days, fuel cost per seat
- Ride request: destination, time window, days needed — auto-match
- Match connects via wa.me link — no in-app chat needed
- Recurring ride groups — set once, standing daily arrangement
- Daily seat board — all rides leaving PSOTS today
- Fuel split calculator — informational, no wallet, no commission
- Women-only seat toggle — only female verified residents can request
- Community CO2 leaderboard — monthly total, shown on homepage

---

## Phase 5 — Community features (target: month 4–5)

- Notice board — resident posts (events, tips, info) — not RWA notices
- Informal polls — community sentiment, one vote per flat, not official
- Lost and found — post with photo, auto-notify same tower
- Emergency contacts directory — community-curated, not officially endorsed

---

## Phase 6 — Telegram integration (target: month 6+)

- Bot commands for platform: /food, /carpool, /lost, /market
- Buy/sell Telegram group → marketplace auto-sync: bot detects listing posts, extracts item + price + photo, creates draft listing. Admin one-click approves.
- Two-way sync (selective): platform post appears in linked Telegram group

---

## Permanent out of scope

These will never be built — individual contributor project, no RWA dependency:

| Feature | Reason |
|---------|--------|
| Maintenance request tracker | Requires management workflow |
| Visitor gate pass | Requires guard-side integration |
| Facility booking (pool, clubhouse) | Requires RWA admin management |
| Official RWA notices | Must come from official channels |
| Society voting (AGM, elections) | Requires legal compliance |
| Parking management | Requires barrier/plate recognition |

---

## Revenue model

**Principle: platform funds its own infra cost. No profit. No charges to residents ever.**

| Source | Amount | When |
|--------|--------|------|
| Daily vendor subscription | ₹99/month per vendor | Month 7 onwards (after 6-month free period) |
| Occasional seller credits | ₹10/post (₹50 for 5, ₹90 for 10) | Month 7 onwards |
| WhatsApp add-on | ₹49/month per vendor | Only when 30+ paying vendors AND 1,000+ active users |
| AdSense (festival pages) | ₹500–1,000/month | Year 1–2 gap coverage |
| Founder funding | ₹85–200/month | Months 1–6, extended to 12 if needed |

**Self-sustaining target: Month 11–12** (conservative — 10 daily vendors + occasional sellers + AdSense)

**WhatsApp migration trigger:** 30 paying vendors AND 1,000+ active users simultaneously. Before that threshold, WhatsApp API cost exceeds vendor revenue from the add-on.

---

## Infrastructure cost per user tier

| Users | Firebase | Cloudflare | Email | Total/month |
|-------|----------|------------|-------|-------------|
| 0–1,000 | ₹0 | ₹0 | ₹0 | ₹85 (domain only) |
| 1,000–1,500 | ₹200–400 | ₹0 | ₹200 | ₹485–685 |
| 1,500–2,000 | ₹400–800 | ₹0 | ₹200 | ₹685–1,085 |
| 2,000–2,100 | ₹600–1,200 | ₹0 | ₹400 | ₹1,085–1,685 |

**DB migration trigger:** Firebase bill exceeds ₹1,500/month → migrate data layer to Supabase. Auth stays in Firebase permanently.

---

## Footer

**Last updated:** April 28, 2026 (18:30 UTC)
**Last completed:** Sprint 5 — Auth simplification and V2 resident data loading (completed Apr 28). Achievements: Removed Email OTP and Telegram OTP flows. Simplified auth to Google + Email/Password. Rebuilt registration as 3-step flow. Implemented unified-login endpoint for V2 resident data. Migrated admin approval/rejection to Worker API. Added JWT auto-retry and superadmin bypass. Added phone number support. Fixed Firestore document ID extraction. Implemented time-aware greeting. Enabled Firebase Account Linking.
**Next to build:** Sprint 6 — Complete profile page polish, pilot onboarding workflow documentation, test with 5-10 real residents (target: Early May). Then family approval endpoints + admin notice UI (closes Phase 2, unblocks full launch).
**Open questions:**
1. Should family members have full platform access or limited? (Affects food market and carpool permission model)
2. Should tenants see other tenants in the same building?
3. Onboarding modal — on first login or first time opening each feature?
4. Email bounce retry logic — implement or rely on Resend dashboard monitoring?
5. Vendor subscription billing — manual UPI link for now, automate in Year 2?
