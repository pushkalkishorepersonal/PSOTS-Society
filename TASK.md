# Current Task: Rewrite Login & Registration Flow

## Goal
Delete all existing registration pages and build a new unified auth flow from scratch.

## Files to DELETE
- society/login.html — delete entirely
- society/register.html — delete entirely

## Files to CREATE

### 1. society/login.html — Entry Point
- Single input: flat number
- POST /auth/unified-login → check if flat exists in D1
  - If flat NOT found → "No resident found. Register?" → go to register.html
  - If flat found, pending → "Awaiting approval" message
  - If flat found, approved → show login options (Google or SMS OTP)
- Login options for existing residents:
  - Google OAuth → GET /auth/google/start
  - SMS OTP via MSG91 widget → GET /auth/msg91-config
- On success → redirect to /society/index.html (profile)

### 2. society/register.html — New Resident Flow

**Step 1: Identity**
- Fields: Full Name, Flat Number, Resident Type (Owner / Tenant / Family)
- Validate flat number format
- Check flat not already occupied via /auth/unified-login

**Step 2: Document Upload + Verification**
- Upload document photo (agreement / ID proof)
- POST /resident/verify-document → AI OCR verification
- If name matches document → proceed to Step 3
- If mismatch → forward to admin for manual review, show "pending review" screen

**Step 3: Dual Auth Binding**
- If user chooses Google:
  - Complete Google OAuth → GET /auth/google/start
  - ALSO require SMS OTP verification (MSG91 widget) to bind phone
  - Both must succeed to complete registration
- If user chooses SMS OTP:
  - Complete SMS OTP via MSG91 widget
  - ALSO require email entry (mandatory)
  - Send email OTP via POST /auth/send-email-otp to verify email
  - Both must succeed to complete registration
- On success:
  - POST /notify-registration → notify admin
  - Redirect to /society/index.html with "pending approval" state

## Worker Endpoints Used
- POST /auth/unified-login — flat number lookup (check exists/status)
- GET /auth/msg91-config — get MSG91 widget config
- GET /auth/google/start — start Google OAuth
- GET /auth/google/callback — handle OAuth callback
- POST /auth/sms-login — complete SMS OTP login
- POST /resident/verify-document — OCR document verification
- POST /auth/send-email-otp — send email OTP for binding
- POST /auth/verify-email-otp — verify email OTP
- POST /notify-registration — notify admin of new registration
- POST /admin/notify-registration — send admin approval email

## Design Rules
- Flat numbers always plain (e.g., 15167) — never Tower/Floor/Unit breakdown
- Design tokens: --jade #1a4a3a, --gold #b8882a, --cream #faf6f0
- Fonts: Nunito Sans (body), Playfair Display (headings)
- All Worker endpoints protected with Bearer token where applicable
- escapeHTML() on all user-supplied content rendered to DOM
- No Firebase Auth SDK — use Worker session cookies + D1

## Branch
All work on: claude/relaxed-heisenberg-WFFXw
