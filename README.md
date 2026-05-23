# PSOTS Society Platform

Community platform for Prestige Song of the South (PSOTS), Bangalore — 2,100+ flats across 14 towers.

## Live URLs

- **society.psots.in** — Main resident platform
- **telegram.psots.in** — API + Telegram bot (Cloudflare Worker)

## Stack

- **Frontend:** Cloudflare Pages (HTML/CSS/JS, no build step)
- **Backend:** Cloudflare Workers (src/index.js)
- **Database:** Firebase Firestore
- **Auth:** Firebase Auth (Google + Email/Password)
- **Email:** Resend API
- **Bot:** Telegram Bot API

## Quick Start (Developer)

See `docs/AJIT_ONBOARDING.md` for full developer guide.

## Key Docs

- `docs/AJIT_ONBOARDING.md` — Developer onboarding guide
- `docs/IDENTITY_MODEL.md` — Identity and schema design
- `docs/DECISIONS.md` — Architectural decisions log
- `SPRINT_STATUS.md` — Current sprint progress
- `ROADMAP.md` — Feature roadmap
- `FEATURE_STATUS.md` — Per-feature status

## Deploy

**Worker:**
```bash
npx wrangler deploy
```

**Frontend:** Auto-deploys via GitHub Actions on push to main

## Auth

Two methods supported:

- **Google OAuth** (primary)
- **Email/Password** (secondary)
- Telegram OTP preserved in `backup/telegram-email-otp` branch

## Contact

Pushkal Kishore — Telegram @pushkalkishore

---

**Last updated:** 2026-04-28
