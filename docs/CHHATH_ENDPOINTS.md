# Chhath Puja API Endpoints

Reference guide for all Chhath integration endpoints deployed to `telegram.psots.in`.

---

## Overview

The Chhath Puja system is integrated into the unified PSOTS Worker with the following endpoints:
- **Contributions**: Record and view monetary contributions
- **Volunteers**: Register volunteers and track availability
- **Announcements**: Share event updates (admin only)
- **Logs**: Audit trail of all actions (admin only)

All endpoints require `Authorization: Bearer {idToken}` header except public GET endpoints.

---

## Endpoints

### POST /chhath/contribute
Record a monetary contribution to Chhath.

**Authentication:** Required (Bearer token)

**Request:**
```json
{
  "amount": 1000,
  "method": "upi",
  "description": "Chhath 2026 contribution"
}
```

**Parameters:**
- `amount` (required, number): Amount in INR
- `method` (optional, string): Payment method (upi, bank_transfer, cash, check). Default: upi
- `description` (optional, string): Contribution note/memo

**Response (201):**
```json
{
  "ok": true,
  "contributionId": "contrib_1714041600000_abc123def"
}
```

**Error Responses:**
- 401: Unauthorized (missing/invalid token)
- 400: amount_required or invalid amount
- 500: server_error

---

### GET /chhath/contributions
List all contributions (public read).

**Authentication:** Not required

**Query Parameters:** None

**Response (200):**
```json
{
  "ok": true,
  "contributions": [
    {
      "id": "contrib_1714041600000_abc123def",
      "amount": 1000,
      "date": "2026-04-25T10:30:00.000Z",
      "method": "upi",
      "verified": false
    }
  ]
}
```

**Error Responses:**
- 500: server_error

---

### POST /chhath/volunteer
Join as a volunteer for Chhath activities.

**Authentication:** Required (Bearer token)

**Request:**
```json
{
  "role": "coordinator",
  "activities": ["decoration", "event_management"],
  "contactPhone": "+919482088904"
}
```

**Parameters:**
- `role` (optional, string): Volunteer role (general, coordinator, logistics, decoration, etc.). Default: general
- `activities` (optional, array): List of activities
- `contactPhone` (optional, string): Phone for event coordinators

**Response (201):**
```json
{
  "ok": true,
  "volunteerId": "volunteer_1714041600000_xyz789"
}
```

**Error Responses:**
- 401: Unauthorized
- 500: server_error

---

### GET /chhath/volunteers
List all volunteers (public read).

**Authentication:** Not required

**Query Parameters:** None

**Response (200):**
```json
{
  "ok": true,
  "volunteers": [
    {
      "id": "volunteer_1714041600000_xyz789",
      "role": "coordinator",
      "status": "active",
      "joinedAt": "2026-04-25T10:30:00.000Z"
    }
  ]
}
```

**Error Responses:**
- 500: server_error

---

### POST /chhath/announcement
Create a Chhath event announcement (admin only).

**Authentication:** Required (Bearer token + admin privilege)

**Request:**
```json
{
  "title": "Chhath Puja 2026 Registration Open",
  "body": "Residents can now register as volunteers or make contributions for Chhath...",
  "type": "event"
}
```

**Parameters:**
- `title` (required, string): Announcement title
- `body` (required, string): Announcement body/content
- `type` (optional, string): Type (general, event, urgent, schedule). Default: general

**Response (201):**
```json
{
  "ok": true,
  "announcementId": "announce_1714041600000"
}
```

**Error Responses:**
- 401: Unauthorized
- 403: admin_only (not an admin)
- 400: title_and_body_required
- 500: server_error

---

## Testing with cURL

### Get Sample Firebase ID Token
First, authenticate with Firebase to get an ID token. This can be done via the login flow on `society.psots.in`.

Or for testing, create a test resident via:
```bash
curl -X POST https://telegram.psots.in/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "flatNumber": "15001",
    "email": "test@society.psots.in",
    "loginMethod": "email"
  }'
```

### Contribute
```bash
curl -X POST https://telegram.psots.in/chhath/contribute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{
    "amount": 500,
    "method": "upi",
    "description": "Test contribution"
  }'
```

### List Contributions
```bash
curl https://telegram.psots.in/chhath/contributions
```

### Register as Volunteer
```bash
curl -X POST https://telegram.psots.in/chhath/volunteer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{
    "role": "general",
    "activities": ["helping"],
    "contactPhone": "+919482088904"
  }'
```

### List Volunteers
```bash
curl https://telegram.psots.in/chhath/volunteers
```

### Create Announcement (Admin)
```bash
curl -X POST https://telegram.psots.in/chhath/announcement \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_ID_TOKEN" \
  -d '{
    "title": "Chhath Registration Open",
    "body": "Residents can now volunteer...",
    "type": "event"
  }'
```

---

## Database Schema

### chhath_contributions
```firestore
{
  ownerUid: string           // Resident UID
  amount: number             // Amount in INR
  currency: "INR"            // Currency (always INR)
  date: timestamp            // Contribution date
  method: string             // upi|bank_transfer|cash|check
  description: string        // Optional memo
  verified: boolean          // Admin verification flag
  createdAt: timestamp       // Record creation time
}
```

### chhath_volunteers
```firestore
{
  residentUid: string        // Resident UID
  role: string               // general|coordinator|logistics|decoration
  activities: array          // List of activity strings
  status: string             // active|inactive|completed
  joinedAt: timestamp        // When they joined
  notes: string              // Coordinator notes
  contactPhone: string       // Optional contact phone
}
```

### chhath_announcements
```firestore
{
  title: string              // Announcement title
  body: string               // Announcement content
  type: string               // general|event|urgent|schedule
  publishedAt: timestamp     // Publication time
  expiresAt: timestamp|null  // Optional expiration
  authorUid: string          // Admin who created it
  pinned: boolean            // Pin on top
}
```

### chhath_logs
```firestore
{
  action: string             // contribution_recorded|volunteer_joined|announcement_created
  uid: string                // User UID (or "system")
  timestamp: timestamp       // When action occurred
  amount: number|null        // For contributions
  role: string|null          // For volunteers
  title: string|null         // For announcements
}
```

---

## Firestore Security Rules

All collections follow these rules:

**chhath_contributions:**
- `read`: Signed-in users
- `create`: Owner only (ownerUid == uid)
- `update`: Admin or owner
- `delete`: Admin only

**chhath_volunteers:**
- `read`: Signed-in users
- `create`: Self registration (residentUid == uid)
- `update`: Admin or self
- `delete`: Admin only

**chhath_announcements:**
- `read`: Signed-in users
- `create`, `update`, `delete`: Admin only

**chhath_logs:**
- `read`: Admin only
- `create`: Worker service account
- `update`, `delete`: Never

---

## Migration

Historical Chhath data can be imported using the migration script:

```bash
# Dry run (no changes)
node scripts/migrate-chhath.js --dry-run

# Import from JSON file
node scripts/migrate-chhath.js --source=chhath_export.json

# Production import
node scripts/migrate-chhath.js
```

The script expects a JSON file with structure:
```json
{
  "contributions": [
    { "id": "c1", "ownerUid": "uid1", "amount": 500, "method": "upi", ... }
  ],
  "volunteers": [ ... ],
  "subscriptions": [ ... ],
  "announcements": [ ... ]
}
```

---

## Next Steps

- [ ] Set up Chhath contribution landing page (society.psots.in/chhath)
- [ ] Wire up Chhath Telegram bot commands
- [ ] Email notifications for contributions
- [ ] Volunteer assignment and task tracking
- [ ] October 2026: Enable Chhath Puja event mode
