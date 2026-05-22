# PSOTS Platform - Complete Architecture & Roadmap

**Date**: April 9, 2026  
**Status**: Phase 1 Complete (Unified Community Ecosystem)  
**Next Phase**: News Management & Event Calendars

---

## TABLE OF CONTENTS

1. [Current State](#current-state)
2. [Consolidation Strategy](#consolidation-strategy)
3. [Future Architecture](#future-architecture)
4. [Implementation Roadmap](#implementation-roadmap)
5. [Technology Stack](#technology-stack)
6. [Deployment Guide](#deployment-guide)

---

## CURRENT STATE

### What's Live
- ✅ **Telegram Moderation Bot** - Real-time message moderation in PSOTS group
- ✅ **Admin Dashboard** - Keyword management, violation tracking, admin management
- ✅ **Google OAuth** - Secure authentication for admins
- ✅ **KV Storage** - Persistent data in Cloudflare Workers KV

### Current Infrastructure
```
telegram.psots.in       → psots-telegram-bot-v2 (Cloudflare Worker)
psots.in               → psots (Cloudflare Pages + custom domain)
chhathpuja.psots.in    → psots-chhathpuja (Cloudflare Pages)
```

### Current Features
- Real-time keyword-based message detection
- Violation tracking (user violations, count, history)
- Admin email-based role management
- Customizable action responses (warn, mute, kick, ban)
- User appeal system (via Telegram DM)
- Stats dashboard (messages scanned, violations, users tracked)

---

## CONSOLIDATION STRATEGY

### Goal
Consolidate all domains (telegram.psots.in, psots.in, chhathpuja.psots.in) under **ONE unified Worker** for easier management and better code organization.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   PSOTS UNIFIED WORKER                      │
│                  (psots-platform-unified)                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ROUTE HANDLER (based on domain + path)                    │
│  ├── telegram.psots.in/* → Telegram Bot Handler            │
│  ├── psots.in/* → Main Platform Handler                    │
│  └── chhathpuja.psots.in/* → Event Page Handler            │
│                                                             │
│  SHARED MODULES                                            │
│  ├── auth.js - Google OAuth, JWT validation                │
│  ├── db.js - Database operations (future PostgreSQL)       │
│  ├── kv.js - Cloudflare KV operations                      │
│  ├── middleware/ - CORS, logging, error handling           │
│  └── utils/ - Shared utilities                             │
│                                                             │
│  KV NAMESPACES (Shared)                                    │
│  ├── VIOLATIONS - Moderation violations                    │
│  ├── NEWS - News articles (future)                         │
│  ├── MARKETPLACE - Listings (future)                       │
│  ├── ADMIN_EMAILS - Admin list                             │
│  ├── AUDIT_LOG - Change tracking                           │
│  └── ADMIN_PINS - PIN fallback (deprecated)                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         ↓
    Environment Variables
    ├── GOOGLE_CLIENT_ID
    ├── TELEGRAM_BOT_TOKEN
    ├── TELEGRAM_ADMIN_ID
    └── DATABASE_URL (future)
```

### File Structure
```
psots-unified-worker/
├── src/
│   ├── index.js                 (Main entry point - route handler)
│   ├── handlers/
│   │   ├── telegram.js          (telegram.psots.in routes)
│   │   ├── main.js              (psots.in routes)
│   │   └── events.js            (chhathpuja.psots.in routes)
│   ├── auth/
│   │   ├── google-oauth.js
│   │   ├── jwt.js
│   │   └── rbac.js              (Role-based access control)
│   ├── db/
│   │   ├── kv-store.js          (Current Cloudflare KV)
│   │   └── postgres.js          (Future database)
│   ├── middleware/
│   │   ├── cors.js
│   │   ├── logging.js
│   │   ├── auth-check.js
│   │   └── error-handler.js
│   ├── utils/
│   │   ├── formatting.js
│   │   ├── validation.js
│   │   └── helpers.js
│   └── dashboard/
│       ├── telegram-dashboard.html
│       ├── news-dashboard.html
│       ├── marketplace-dashboard.html
│       └── admin-dashboard.html
├── wrangler.toml                (Unified config)
├── package.json
└── README.md
```

### Implementation Steps

**Step 1: Create Unified Worker**
```bash
npx wrangler create psots-platform-unified --type javascript
```

**Step 2: Migrate Current Telegram Code**
- Move src/index.js logic into `handlers/telegram.js`
- Extract auth logic into `auth/`
- Extract KV operations into `db/kv-store.js`

**Step 3: Create Routing Logic (src/index.js)**
```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const domain = url.hostname;

    // Route by domain
    if (domain.includes('telegram')) {
      return handleTelegram(request, env, ctx);
    } else if (domain.includes('chhathpuja')) {
      return handleEvents(request, env, ctx);
    } else {
      return handleMainPlatform(request, env, ctx);
    }
  }
};
```

**Step 4: Update Cloudflare Routes**
```
telegram.psots.in/*    → psots-platform-unified
psots.in/*             → psots-platform-unified
chhathpuja.psots.in/*  → psots-platform-unified
```

**Step 5: Delete Old Workers**
- Delete psots-telegram-bot-v2
- Keep Pages workers as backup initially

---

## FUTURE ARCHITECTURE

### Phase 2-4: Multi-Role Platform Expansion

The current Telegram bot will become **ONE module** within a larger platform:

```
┌──────────────────────────────────────────────────────────────┐
│              PSOTS UNIFIED PLATFORM                          │
│         (Separate Frontend + API Backend)                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  BACKEND API (Node.js + Express)                           │
│  ├── /api/auth/* - Google OAuth + JWT                       │
│  ├── /api/telegram/* - Moderation API                       │
│  ├── /api/news/* - News CRUD + Bunsell sync                │
│  ├── /api/marketplace/* - Listings + Bunsell integration   │
│  ├── /api/admin/* - User & role management                  │
│  └── /webhook/telegram - Violation webhooks                 │
│                                                              │
│  FRONTEND (React/Next.js)                                   │
│  ├── Dashboard (role-based)                                 │
│  │   ├── Super Admin - Full system control                  │
│  │   ├── Telegram Moderator - Violations + appeals          │
│  │   ├── News Manager - Article editor                      │
│  │   └── Marketplace Manager - Listing manager              │
│  ├── Public Site                                            │
│  │   ├── News archive                                       │
│  │   ├── Marketplace listings                               │
│  │   └── Event pages (Chhath Puja, etc.)                   │
│  └── Admin Controls                                         │
│      ├── User management                                    │
│      ├── Role assignment                                    │
│      ├── Audit logs                                         │
│      └── System settings                                    │
│                                                              │
│  DATABASE (PostgreSQL)                                      │
│  ├── users, roles, permissions                              │
│  ├── violations, appeals                                    │
│  ├── news_articles, marketplace_listings                    │
│  ├── keywords, moderation_settings                          │
│  └── audit_logs, sync_logs                                  │
│                                                              │
│  EXTERNAL INTEGRATIONS                                      │
│  ├── Telegram API - Moderation                              │
│  ├── Bunsell API - Marketplace sync                         │
│  ├── PSOTS.in API - Push listings                          │
│  └── Google OAuth - Authentication                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Role-Based Access

```
┌─────────────────────────────────────────────────────────────┐
│  ROLE          │  PERMISSIONS                                │
├─────────────────────────────────────────────────────────────┤
│ Super Admin    │ All access - system control                 │
│ Telegram Mod   │ Manage violations, appeals, keywords        │
│ News Manager   │ Create/edit/publish news articles           │
│ Marketplace Mgr│ Manage listings, sync Bunsell               │
└─────────────────────────────────────────────────────────────┘
```

---

## IMPLEMENTATION ROADMAP

### PHASE 1: CONSOLIDATION (Week 1)
**Goal**: Merge all workers into one, cleaner codebase

- [ ] Create unified worker (`psots-platform-unified`)
- [ ] Migrate Telegram bot code
- [ ] Set up routing by domain
- [ ] Update Cloudflare routes
- [ ] Test all domains work
- [ ] Delete old workers
- [ ] Document the new structure

**Outcome**: Single worker managing all domains, easier to maintain

---

### PHASE 2: NEWS MANAGEMENT (Weeks 2-3)
**Goal**: Add news article creation and publishing

- [ ] Design database schema (PostgreSQL migration)
- [ ] Create news CRUD API endpoints
- [ ] Build news editor UI (React component with TipTap)
- [ ] Implement publishing workflow (draft → schedule → publish)
- [ ] Create public news page
- [ ] Add Bunsell feed sync capability
- [ ] Audit logging for news operations

**Outcome**: News managers can create and publish articles

---

### PHASE 3: MARKETPLACE INTEGRATION (Weeks 4-5)
**Goal**: Manage listings, integrate with Bunsell and PSOTS.in

- [ ] Design marketplace listing schema
- [ ] Create listing CRUD endpoints
- [ ] Build Bunsell API client
- [ ] Implement automatic sync (every 6 hours)
- [ ] Create marketplace listing UI
- [ ] Integrate with PSOTS.in marketplace API
- [ ] Build marketplace manager dashboard
- [ ] Image upload & management

**Outcome**: Marketplace managers can manage listings and sync with Bunsell

---

### PHASE 4: ADMIN CONTROLS & RBAC (Weeks 6-7)
**Goal**: Multi-role system with proper access control

- [ ] Implement role-based access control (RBAC)
- [ ] Create user management interface
- [ ] Build role assignment system
- [ ] Implement permission checks on all endpoints
- [ ] Create admin dashboard
- [ ] Build audit log viewer
- [ ] Set up system settings panel
- [ ] Email notifications for violations

**Outcome**: Fully featured multi-role admin platform

---

### PHASE 5: POLISH & LAUNCH (Week 8)
**Goal**: Production-ready deployment

- [ ] Performance optimization
- [ ] Security audit
- [ ] UI/UX polish
- [ ] Mobile responsiveness
- [ ] Documentation
- [ ] Deploy to production
- [ ] Monitor and iterate

**Outcome**: Live, stable, multi-role platform

---

## TECHNOLOGY STACK

### Current (Telegram Bot)
- **Runtime**: Cloudflare Workers (JavaScript)
- **Storage**: Cloudflare KV (key-value)
- **Auth**: Google OAuth 2.0 + Custom JWT

### Future (Full Platform)
- **Backend**: Node.js 20+ + Express.js
- **Database**: PostgreSQL (Supabase or self-hosted)
- **ORM**: Prisma
- **Frontend**: React 18+ + Next.js 14
- **Styling**: Tailwind CSS + shadcn/ui
- **Editor**: TipTap (rich text for news)
- **Hosting**: Vercel (frontend) + Railway/Render (backend)
- **Storage**: Cloudflare R2 (images)
- **Auth**: JWT + Google OAuth
- **Monitoring**: Sentry + Vercel Analytics

---

## DEPLOYMENT GUIDE

### Current Deployment
```
1. Code pushed to GitHub
2. GitHub Actions triggers wrangler deploy
3. Code deployed to Cloudflare Workers
4. Domain routed to worker
```

### Future Deployment
```
1. Backend code → GitHub
   ↓
   GitHub Actions → Deploy to Railway/Render
   
2. Frontend code → GitHub
   ↓
   GitHub Actions → Deploy to Vercel
   
3. Database migrations → Applied automatically
4. Environment variables → Managed via CI/CD
5. API + Frontend → Both live and synced
```

---

## NEXT STEPS

### Immediate (This Week)
1. ✅ Consolidate workers into unified structure
2. ✅ Ensure all domains work correctly
3. ✅ Delete old workers
4. ✅ Test admin dashboard thoroughly

### Next Week
1. Plan database schema (PostgreSQL)
2. Set up development environment (Node.js + Express)
3. Implement news article CRUD
4. Build news editor UI

### Future Milestones
- Month 2: Marketplace + Bunsell integration
- Month 3: Full RBAC + admin controls
- Month 4: Launch to production

---

## ARCHITECTURE DECISIONS

### Why Consolidate Workers?
- **Easier management**: Single codebase for all domains
- **Shared utilities**: Auth, middleware, error handling
- **Better scaling**: Single deployment, unified config
- **Cost effective**: One worker instead of many

### Why PostgreSQL Over KV?
- **Structured data**: Complex schemas (users, roles, permissions)
- **Transactions**: ACID compliance for reliability
- **Querying**: Better for complex queries (news, marketplace)
- **Scalability**: Better for growth

### Why React/Next.js?
- **Full-stack framework**: Frontend + API in one
- **SSR/SSG**: Better SEO for news articles
- **Performance**: Code splitting, lazy loading
- **Developer experience**: Excellent tooling

---

## CONTACTS & RESOURCES

- **GitHub**: pushkalkishorepersonal/psots
- **Cloudflare Dashboard**: https://dash.cloudflare.com/
- **Telegram Group**: @PSOTS_Society
- **Admin Email**: pushkalkishore@gmail.com

---

**Last Updated**: April 7, 2026  
**Maintained By**: Pushkal Kishore  
**Status**: Ready for Phase 2
