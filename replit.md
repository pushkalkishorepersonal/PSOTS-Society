# Workspace

## Overview

PSOTS - Prestige Song of the South community portal. A full-stack web application for residents of the Prestige Song of the South apartment complex in Bangalore (2,300 flats, 14 towers: 1,2,3,4,5,8,9,10,11,12,14,15,16,17). Domain: psots.in

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild
- **Frontend**: React + Vite, Tailwind CSS, shadcn/ui, React Query, Framer Motion, Wouter

## Features

- **Notice Board** - Pinned/regular notices filterable by tower and category; 60-day auto-archive (non-pinned)
- **Events** - Community events with RSVP button, attendee counts, upcoming/past separation
- **Marketplace** - Self-managed classifieds (sell/buy/rent/free) with 30-day auto-expiry; Mark Sold / Close Ad buttons
- **Emergency Contacts** - Click-to-call contacts with search; official PSOTSAOA channels (Helpdesk, EC, Finance) as static section
- **Community Guide** (/guide) - Resident handbook sourced from official PSOTS Rules of Residency v2.0 (Oct 2025): official channels, 4-level escalation path, daily rules (vehicles, waste, conduct), all 25+ amenity timings/rules (The Opera Clubhouse), penalty quick reference table
- **Home Dashboard** - Real PSOTS hero photo (sunset), pinned notices, upcoming events, recent listings, photo gallery, Telegram bot CTA, community stats (2,300+ families, 14 towers, 33 acres, 25+ amenities, 24/7 security)
- **Telegram Bot** (@psots_telegram_bot) - Commands: /notice, /event, /sell, /buy, /free, /rules, /mylistings, /sold <id>, /close <id>; group moderation
- **Auto-scheduler** - Runs every 6 hours; archives old notices, expires old listings
- **Real Photos** - 8 actual PSOTS resident photos used across site (hero, gallery, Telegram section)

## Telegram Bot — Multi-Group Support

Each group the bot joins can be configured independently. Configuration is stored in the `bot_groups` DB table and cached in memory. Strikes are persisted in `bot_strikes` (never wiped on restart).

### Admin Setup Commands (group admins only)
| Command | Action |
|---|---|
| `/setup` | Show preset options |
| `/setup general` | Apply general residents group preset (full moderation, all commands) |
| `/setup marketplace` | Apply marketplace preset (ads allowed, only sell/buy/free commands) |
| `/setup announcements` | Apply read-only channel preset (delete all non-admin messages) |
| `/groupinfo` | Show all current settings for this group |
| `/groupset <rule> on\|off` | Toggle any individual rule |

### Toggleable Rules (via /groupset)
`ads` `forwards` `links` `social` `political` `religious` `communal` `flood` `caps` `cmd_notice` `cmd_event` `cmd_sell`

### User Commands (availability depends on group config)
| Command | Action |
|---|---|
| `/notice Title \| Message` | Post a notice to psots.in |
| `/event Title \| Date \| Venue \| Description` | Post an event |
| `/sell Title \| Price \| Tower \| Phone \| Description` | List item for sale |
| `/buy Title \| Tower \| Description` | Post a wanted ad |
| `/free Title \| Tower \| Description` | Give something away |
| `/mylistings` | See your active listings |
| `/sold <ID>` | Mark your listing as sold |
| `/close <ID>` | Remove your listing |
| `/rules` | Show group-specific etiquettes |
| `/mystatus` | Check your own persistent strike count |

### Admin Moderation Commands
| Command | Action |
|---|---|
| `/warn @user` | Issue a manual warning |
| `/unmute <userId>` | Unmute a user and reset their strikes |
| `/strikes <userId>` | Check a user's strike count |
| `/resetstrikes <userId>` | Clear a user's strikes |

## Tower Numbers
IMPORTANT: Always use [1,2,3,4,5,8,9,10,11,12,14,15,16,17] — never sequential 1-14.

## Structure

```text
artifacts/
  api-server/        Express API + Telegram bot + scheduler (port $PORT)
    src/
      app.ts         Express app + routes
      bot.ts         Telegram bot (all commands + moderation)
      scheduler.ts   Auto-archive/expire scheduler
      index.ts       Server entry + bot + scheduler startup
  psots/             React + Vite frontend
    src/
      pages/         Home, NoticeBoard, Events, Marketplace, Contacts
      components/    Layout (navbar+footer), Forms (modals)
    public/
      images/        Real PSOTS photos (hero-bg.jpg, aerial-day.jpg, etc.)
  mockup-sandbox/    Design preview server
lib/
  db/                Drizzle schema (notices, events, listings, contacts)
  api-spec/          OpenAPI spec
  api-client-react/  Auto-generated React Query hooks (from Orval)
```

## Guardrails & Security

- **Flat number** required on all post forms (notices, events, listings) — creates resident accountability without public exposure
- **Community PIN** required for Notice Board posts — defaults to `PSOTS2025`; set `COMMUNITY_PIN` env var to change it. Distribute this code to residents via Society Office.
- **IP rate limiting** — max 8 POST requests per IP per hour across all create endpoints

## Bot Moderation Engine

Hard violations (message deleted + strike): foul/abusive language (English/Hindi/Kannada/Tamil), personal attacks, threats, privacy breach, contextual ads (price+phone in same msg), promotional links (WhatsApp groups, other Telegram groups), political content, religious debates, communal/divisive topics, forwarded channel posts, forwarded group posts, external URLs.

Soft violations (gentle reminder only): social greetings, excessive caps, flood/rapid-fire messages.

Strike system: 3 hard strikes → 1-hour mute. Strikes reset after mute. Admins can manually warn, unmute, check, and reset strikes.

New member welcome message sent automatically when someone joins the group.

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `TELEGRAM_BOT_TOKEN` - Bot token for @psots_telegram_bot
- `COMMUNITY_PIN` - Access code for posting notices (default: `PSOTS2025`)
- `PORT` - Server port (auto-assigned per artifact)
