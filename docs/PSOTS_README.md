# PSOTS Platform — Overview

**A resident-first community platform for PSOTS Society**

---

## What is this?

A web application + Telegram bot ecosystem built specifically for residents of Prestige Song of the South (PSOTS), Bangalore. Designed to complement (not replace) existing communication channels with structured, persistent, and privacy-focused features.

**Live sites:**
- `society.psots.in` — Main resident platform
- `chhath.psots.in` — Chhath Puja community event portal
- `telegram.psots.in` — Backend services
- `psots.in` — Landing page + Rules of Residence guide

---

## Core Philosophy

**"Telegram for conversation. PSOTS for records."**

Telegram groups are great for real-time chat but terrible for:
- Finding information 6 months later
- Knowing who actually said yes/no to something
- Running transparent festival finances
- Reaching residents who don't use Telegram

PSOTS fills these gaps without trying to compete with Telegram's strengths.

---

## Who it's for

**All residents of PSOTS** — owners, tenants, family members.

No distinction in access. No exclusions. One platform, everyone welcome.

---

## Features (Current + Planned)

### Currently Live

- Resident registration (Google / Email OTP / Telegram OTP)
- Admin verification queue
- Telegram moderation bot with rule enforcement
- PII masking (residents' emails/phones are hidden from each other)
- Basic profile management

### In Active Development (next 6-8 weeks)

- **Unified login** across PSOTS + Chhath Puja (one account, both sites)
- **Device management** (see all logged-in devices, sign out remotely)
- **Family member management** (primary approves family additions)
- **3-zone dashboard** (pending actions + features + roadmap)
- **Admin notices** (structured announcements with acknowledgment tracking)

### Planned for launch (2-3 months out)

- Chhath Puja integration with shared login
- Resend email notifications (reliable, no spam)
- Vendor food ordering via Telegram bot (5-10 PSOTS food vendors)

### Future (6+ months)

- Marketplace (buy/sell structured from Telegram)
- Community knowledge base (doctors, services, tiffin — searchable)
- Event platform for all PSOTS festivals (Durga, Ganesh, Holi)
- WhatsApp Business API integration

---

## Privacy & Safety

- PII (email, phone) masked from other residents
- Admins see unmasked names for verification, but masked contact info
- No data sold or shared outside PSOTS
- Residents can delete their data (planned post-launch)
- Open source — code is publicly auditable on GitHub

---

## Cost Structure

### For residents: **FREE**

Always. No subscriptions. No paywalls.

### For the platform (Year 1)

- Cloudflare Workers/Pages: Free tier (up to 100K requests/day)
- Firebase: Free tier (up to 50K reads, 20K writes/day)
- Firestore storage: Free tier (1 GB)
- Resend emails: Free tier (3,000/month)
- Domain: ~₹800/year

**Expected monthly cost at PSOTS scale (500-800 daily active residents): ₹0**

If usage exceeds free tier (unlikely short-term): ₹500-2,000/month absorbed personally by Pushkal.

### Future (Year 2+)

If platform grows beyond free tier consistently, options:
- Continue personal funding (current plan)
- Society-level funding from RWA maintenance
- Vendor subscriptions (₹99/month from food vendors)

No resident contributions needed.

---

## Multi-Samiti Support

PSOTS is designed to support multiple independent festival organizing groups (samitis), each with their own:
- Organizers / admins
- Payment method (their UPI, their bank)
- Contributors / budget / announcements
- Subdomain (chhath.psots.in, durga.psots.in, etc.)

Platform provides shared infrastructure. Each samiti operates independently.

Example:
- **Chhath Puja Samiti** → Pushkal organizes, UPI to Pushkal's account
- **Durga Puja Samiti** → Different organizers, different payment
- **Ganesh Puja Samiti** → Yet another group

Platform does NOT hold money, process payments, or issue receipts for samitis. Each samiti uses its own payment collection.

---

## Who's behind this?

**Individual contributor project** by Pushkal Kishore (resident, Flat 1204, Tower/Block info).

Built in personal time, at personal cost, for community benefit.

**Not affiliated with:**
- PSOTSAOA / RWA
- EC (Executive Committee)
- Any specific resident group

**Intended to remain neutral** — no political affiliations, no side-taking on society disputes.

---

## What I'm asking from RWA / Residents

### Short-term (now)

- **Awareness** — let residents know this exists
- **Feedback** — what features would actually help you?
- **Early testers** — 5-10 residents willing to try pilot version

### Medium-term (6 months)

- **Endorsement** (optional) — if RWA sees value, a simple nod of approval
- **Referrals** — introduce new residents / onboarding to the platform

### Long-term (1 year+)

- **Possibly society-level sponsorship** if usage is high and value is proven
- **Nothing required** if residents prefer to just use it as-is

### Explicitly NOT asking for

- Money from residents
- RWA endorsement as official platform
- Replacement of any existing RWA functions
- Authority to make decisions on society matters

---

## Development Status

**Current phase:** Identity refactor (Sprint 1 of 8)

**Timeline:**
- Sprints 1-4 (next 4 weekends): Identity + login + dashboard + Chhath integration
- Sprints 5-6 (2-3 weeks): Pilot with 5-10 residents, bug fixes, full launch
- Sprints 7-8 (2 weekends): Vendor ordering system

**Expected full launch:** ~2-3 months from now.

---

## Technical Details (for reference)

- **Frontend:** HTML/CSS/JavaScript, hosted on Cloudflare Pages
- **Backend:** Cloudflare Workers (serverless), Firebase Firestore (database)
- **Auth:** Firebase Auth + Telegram Bot API
- **Email:** Resend
- **Repository:** GitHub (public, open source)
- **Deployment:** Automated via GitHub Actions

---

## Known Issues (being fixed)

- Family member invitation flow is currently disabled with "Coming Soon" while being rebuilt
- Device management section is placeholder until Sprint 1 completes
- Some pages have inconsistent navigation (being unified in Sprint 3)

These are intentional, under active development, and do not affect the core demo.

---

## Questions / Feedback

Contact: [your preferred contact method]  
Platform feedback welcomed at any time.

---

**Last updated:** 2026-04-19
