# PSOTS Ecosystem: Technical Encyclopedia

## 1. Project Overview
The **PSOTS Ecosystem** is a unified, resident-led community management platform designed for the **Prestige Song of the South (PSOTS)** society. It transitions a traditionally monolithic moderation bot into a multi-group, role-based cockpit that manages Telegram communities, marketplace listings, and society-wide documentation.

### Core Objectives
*   **Decentralized Governance**: Shifting from "One God Admin" to a resident-managed multi-admin structure.
*   **Security & Sovereignty**: Isolated per-group violation tracking and configuration to prevent cross-community interference.
*   **Ecosystem Integration**: Bridging Telegram chat data with a premium web dashboard and AI-powered marketplace parsing.

---

## 2. Technology Stack
The platform is built on modern "Edge" infrastructure for maximum performance and zero cold starts.

*   **Runtime**: Cloudflare Workers (ES Modules / JS Standard).
*   **Storage**: Cloudflare Workers KV (Highly consistent key-value store for profiles, rules, and audit logs).
*   **Frontend**: Vanilla JS (ES6+) with premium CSS (Dark mode, glassmorphism, dynamic animations).
*   **Authentication**: Google OAuth 2.0 (Role-Verified).
*   **APIs**: Telegram Bot API 7.0+, Gemini Pro 1.5 (for marketplace parsing).
*   **Routing**: Custom logic-based router in `index.js`.

---

## 3. Critical Code Modules
The codebase is modularized for scalability and ease of auditing.

### `src/index.js` (The Brain)
*   **Webhook Handler**: Processes real-time updates from Telegram.
*   **RBAC Engine**: Dynamically filters accessible community tiles based on admin email.
*   **API Router**: Manages endpoints for violation resets, keyword updates, and diagnostic status.
*   **Registration**: Implements the "Auto-Discovery" logic that registers new groups upon the `/start` command.

### `src/templates.js` (The Shell)
*   **Lobby View**: A high-end grid of authorized community tiles with real society logos.
*   **Admin Dashboard**: The "Mission Control" center for per-group moderation metrics.
*   **Group Identity Proxy**: Facilitates secure rendering of Telegram group photos via a worker-side proxy.

### `src/store.js` (The Ledger)
*   **Violation Logic**: Manages the `user_{chatId}_{userId}` keyspace to ensure history is isolated per community.
*   **Configuration Manager**: Handles global vs. group-specific settings (Keywords, thresholds, admin lists).

### `src/telegram.js` (The Bridge)
*   Standardized interface for Bot API interactions (`sendMessage`, `restrictMember`, `getChat`).

---

## 4. Operational Logic & Data Hierarchy
### Group Registration & Tiles
1.  Bot is added to a Telegram group.
2.  Admin sends `/start`.
3.  Worker fetches group metadata (Photo, Title) and registers it in the `_groups` KV bucket.
4.  Lobby renders a branded tile for that group for all authorized admins.

### Rule-Based Moderation
*   **Keywords**: Configurable across 10 categories (Spam, Political, Abuse, etc.).
*   **Tiered Penalties**:
    *   *Violation 1-2*: Private warning DM.
    *   *Violation 3*: Admin notification.
    *   *Violation 5*: Temporary restriction (Mute).
    *   *Violation 10*: Permanent escalation (Ban/Kick).

---

## 5. File System Index
A strategic map of all codebase assets.

### 📂 Source Files
*   `src/index.js` - Main entry and routing.
*   `src/templates.js` - Frontend HTML/JS/CSS.
*   `src/store.js` - Data persistence methods.
*   `src/telegram.js` - Bot API wrappers.

### 📂 Configuration
*   `wrangler.toml` - Worker bindings and KV configuration.
*   `package.json` - Build scripts (`npm run deploy`).
*   `.gitignore` - Environment protection.

### 📂 Legal & Community (PDFs)
*   `PSOTS_RulesofResidency_Final.pdf` - Primary rulebook.
*   `PSOTS-DODByelaws.pdf` - Society Constitutional documents.
*   `PSOTS TG Owners Group Etiquettes.pdf` - Digital code of conduct.
*   `OC_PHASE_*.pdf` - Official occupancy certificates.

### 📂 Documentation
*   `CODEBASE_INDEX.md` - Quick-reference file map.
*   `ARCHITECTURE_AND_ROADMAP.md` - Evolution vision.
*   `ADMIN_GUIDE.md` - Manual for moderators.
*   `TECHNICAL_ENCYCLOPEDIA.md` - (This document).

---
*Last Technical Audit: 2026-04-12*  
*Custodian: Pushkal Kishore*
