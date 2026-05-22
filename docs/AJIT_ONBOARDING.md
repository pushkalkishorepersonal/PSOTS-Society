# PSOTS Platform — Developer Review Guide
**For:** Ajit Kumar Satpathy  
**From:** Pushkal Kishore  
**Date:** April 28, 2026  
**Repo:** github.com/pushkalkishorepersonal/psots (private — request access)

---

## What is this?

A community platform for Prestige Song of the South (PSOTS), Bangalore — 2,100+ flats across 14 towers. Built as a solo project on personal time. Not affiliated with RWA.

**Live URLs:**
- `society.psots.in` — Main resident platform
- `telegram.psots.in` — Cloudflare Worker (API + Telegram bot)
- `society.psots.in/register.html` — New resident registration
- `society.psots.in/society/login` — Login

**Stack:** Cloudflare Pages (frontend) + Cloudflare Workers (API) + Firebase Firestore (DB) + Firebase Auth (Google + Email/Password) + Resend (email)

---

## Current State — What Works Today

| Feature | Status | Notes |
|---------|--------|-------|
| Google login | ✅ Working | Primary auth method |
| Email/Password login | ✅ Working | Secondary auth method |
| New resident registration | ✅ Working | 3-step flow |
| Admin approval | ✅ Working | Via Worker API |
| Dashboard | ✅ Working | Time-aware greeting, correct resident data |
| Profile page | ✅ Working | Name, flat, email, phone display |
| Password reset | ✅ Working | Goes to spam (Firebase branding issue) |
| Admin panel | ✅ Working | Approve/reject/suspend/delete residents |
| Telegram bot | ✅ Working | Group moderation bot live |

---

## What to Test First

**Step 1:** Register at `society.psots.in/register.html`
- Use Google login OR email + password
- Enter your flat number (any valid PSOTS flat)
- Enter your name

**Step 2:** Tell Pushkal — he'll approve from admin panel

**Step 3:** Login at `society.psots.in/society/login`
- Dashboard should load with your name and flat
- Profile should show your details

**Step 4:** Check these pages work:
- Dashboard (`/society/`)
- Profile (`/society/profile`)
- Marketplace, Carpool, Lost & Found, Jobs pages (UI only, no backend yet)

---

## Architecture Overview

```
Browser
  ↓
Cloudflare Pages (society.psots.in)
  HTML/CSS/JS — no build step, plain files
  ↓
Cloudflare Worker (telegram.psots.in)
  src/index.js — all API endpoints (~5000 lines)
  src/db/adapter.js — all Firestore operations
  src/db/firestore.js — Firestore REST API wrapper
  src/db/pii.js — PII masking functions
  ↓
Firebase Firestore (psots-society-25899)
  residents/, credentials/, flats/, device_sessions/
  chhath_contributions/, chhath_volunteers/, etc.
```

**Key files:**
- `src/index.js` — Worker router + all endpoints
- `src/db/adapter.js` — DB adapter (all DB calls go through here)
- `society/login.html` — Login page
- `society/register.html` — Registration page
- `society/index.html` — Dashboard
- `society/profile.html` — Profile page
- `society/admin.html` — Admin panel
- `js/core/hybrid-auth.js` — Auth helper used by all pages

---

## Identity Model (Important)

Two schemas exist in Firestore simultaneously:

**Old schema** (pre-April 2026):
```
residents/Tba5qgFFKLYgOZG9QPK3Vuz3LfI3   ← Firebase UID as doc ID
  name, email, phone, flatNumber, status
```

**New V2 schema** (current):
```
residents/r_15167_1777273688590           ← custom residentId
  name, flatNumber, status, residentType

credentials/cred_google_email_timestamp
  type, identifier (email), residentId → links to resident
```

All new registrations use V2 schema. The `unified-login` endpoint handles both transparently.

---

## Known Issues (Need Your Input)

### 1. Telegram + Email OTP Login (Branched)
**Branch:** `backup/telegram-email-otp`

Both were removed because they had bugs:
- Email OTP: `signInWithCustomToken` failing (Firebase token format issue)
- Telegram OTP: Session-based auth not syncing with Firebase Auth state — dashboard kept bouncing back to login

**What we need from you:**
- Review the backup branch
- Is `signInWithCustomToken` the right approach for Email OTP?
- What's the correct pattern for non-Firebase-Auth session management?
- Should we use Firebase Custom Auth with a proper token generation on Worker side?

### 2. `hybrid-auth.js` Rate Limiting
Every page load calls `POST /auth/unified-login` to fetch resident data. This is hitting the rate limiter (5 req/min). The endpoint is being used as both auth AND data fetch — not ideal.

**What we need from you:**
- Should there be a separate `GET /resident/me` endpoint that's less rate-limited?
- Or should resident data be cached in localStorage/sessionStorage after first fetch?

### 3. `residentService.js` — Old Service Layer
`js/services/resident.service.js` uses old Firestore client SDK directly and has `cache.delete` errors. The new auth flow bypasses it but it's still imported in some places.

**What we need from you:**
- Should we migrate this to use the Worker API (`/resident/profile` endpoint) or keep Firestore client SDK?

---

## Code Quality Notes

- No TypeScript — plain ES modules
- No build step — Cloudflare Pages deploys static HTML/JS directly
- Worker uses Wrangler 4.x
- Firebase pinned to `10.12.0`
- ESLint configured, 0 lint errors
- Some legacy code in `src/index.js` (~5000 lines) — could be split into modules

---

## What's Coming Next (Sprint 6-7)

1. **Context-aware Gemini moderation** — Telegram groups
2. **Document verification** — Owner uploads maintenance invoice, Gemini validates, auto-purge
3. **Ownership delegation** — Legal owner can delegate to family member
4. **Tenant verification flow**
5. **Role-based access** — verified/unverified/flat-admin tiers
6. **Poll voting** — one per flat
7. **Marketplace listings** — buy/sell
8. **Carpool matching**
9. **Food ordering via Telegram bot**

---

## Quick Commands

```bash
# Deploy Worker
npx wrangler deploy

# Watch Worker logs live
npx wrangler tail --format pretty

# Clear JWT key cache (if auth breaks)
npx wrangler kv key delete --binding=VIOLATIONS "_jwt_keys" --remote

# Check secrets
npx wrangler secret list
```

---

## Questions for You

1. Email OTP — what's the correct pattern with Firebase Auth?
2. Telegram login — how to properly bridge session cookie with Firebase Auth state?
3. `hybrid-auth.js` — better pattern for resident data fetching without rate limit issues?
4. `src/index.js` at 5000+ lines — worth splitting into modules now or post-launch?
5. Any security concerns you spot in the Worker auth flow?

---

**Contact:** Pushkal Kishore — Telegram @PushkalKishore  
**Admin panel access:** Ask Pushkal to approve your registration and grant admin role
