# Email Usage Reference — PSOTS Resident Management System

**Last updated:** April 14, 2026

## Overview

The PSOTS system uses **Resend** email API for transactional email notifications. All email sending is handled by Cloudflare Worker endpoints to avoid exposing API credentials on the client side.

---

## Email Endpoints

### 1. POST /notify-registration
**Purpose:** Admin notification when new resident registers  
**Caller:** `js/services/resident.service.js` — called after successful registration  
**Trigger:** New resident submission during registration flow  

**Request Body:**
```json
{
  "name": "John Doe",
  "flatNumber": "15167",
  "residentType": "owner",
  "email": "john@example.com",
  "phone": "+91 98765 43210"
}
```

**Response:**
```json
{ "ok": true }
```

**Implementation Details:**
- Location: `src/index.js` lines ~301-318
- Sends **Telegram notification** to admin (not email)
- Currently uses Telegram bot API, not Resend
- Future enhancement: Add Resend email to admin instead

---

### 2. POST /marketplace/contact-seller
**Purpose:** Buyer contacts seller about marketplace listing via email  
**Caller:** `js/pages/marketplace/index.js` — triggered from contact modal form  
**Trigger:** User fills "Contact Seller" form and clicks "Send Message"  

**Request Body:**
```json
{
  "buyerName": "Jane Smith",
  "buyerEmail": "jane@example.com",
  "message": "Is this item still available? Can I see more photos?",
  "sellerEmail": "seller@example.com",
  "sellerName": "John Doe",
  "listingTitle": "Sony 43-inch TV"
}
```

**Response:**
```json
{ "ok": true }
```

**Email Sent (via Resend):**
- **From:** `contact@psots.in`
- **To:** Seller's email (extracted from listing)
- **Subject:** `New inquiry about "[listing title]" on Marketplace`
- **Template:** HTML with buyer message, buyer email, and call-to-action

**Implementation Details:**
- Location: `src/index.js` lines ~320-358
- Uses Resend API with `env.RESEND_API_KEY`
- Email sending is non-blocking (errors are caught but don't fail the request)
- Seller can reply directly to buyer's email

---

## Email Service Configuration

### Resend API Setup

**API Endpoint:** `https://api.resend.com/emails`

**Required Environment Variables:**
```
RESEND_API_KEY = <your-resend-api-key>
```

**Configuration Location:** `wrangler.toml` or Cloudflare Worker environment secrets

**Headers Required:**
```
Authorization: Bearer {RESEND_API_KEY}
Content-Type: application/json
```

---

## Email Templates

### Template 1: Marketplace Contact Email

**Sent To:** Seller's email address  
**Triggered By:** Buyer clicks "Email" button on listing + submits message

**Template Variables:**
- `{sellerName}` — Seller's full name
- `{listingTitle}` — Product/item name
- `{buyerName}` — Buyer's full name
- `{buyerEmail}` — Buyer's email for reply
- `{message}` — Buyer's inquiry message

**HTML Template:**
```html
<p>Hi {sellerName},</p>
<p><strong>{buyerName}</strong> is interested in your listing "<strong>{listingTitle}</strong>".</p>
<p><strong>Message:</strong></p>
<blockquote>{message}</blockquote>
<p><strong>Buyer's Email:</strong> {buyerEmail}</p>
<p style="margin-top: 20px; font-size: 12px; color: #666;">
  Reply directly to {buyerEmail} to continue the conversation.
</p>
```

---

## Data Flow Diagram

```
User (Buyer) on Marketplace
    ↓
Clicks "Email" button on listing
    ↓
Contact Seller modal opens
    ↓
Fills message + clicks "Send Message"
    ↓
js/pages/marketplace/index.js handleContact()
    ↓
POST /marketplace/contact-seller (Cloudflare Worker)
    ↓
Resend API → Send email to seller
    ↓
Response: { ok: true }
    ↓
Toast: "Message sent! The seller will contact you soon."
```

---

## Adding New Email Endpoints

To add a new email endpoint:

### Step 1: Create Worker Endpoint
Edit `src/index.js` and add a new route:

```javascript
// POST /marketplace/notify-buyer { buyerEmail, message, listingTitle }
if (pathname === '/marketplace/notify-buyer' && request.method === 'POST') {
  try {
    const { buyerEmail, message, listingTitle } = await request.json();
    
    const resendApiKey = env.RESEND_API_KEY;
    if (resendApiKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'contact@psots.in',
          to: buyerEmail,
          subject: `Your inquiry about "${listingTitle}"`,
          html: `<p>Hi,</p><p>Your message has been sent to the seller.</p>`
        })
      });
    }
    
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', ...CORS }
    });
  } catch (e) {
    console.error('Error:', e);
    return new Response(JSON.stringify({ ok: true }),  {
      headers: { 'Content-Type': 'application/json', ...CORS }
    });
  }
}
```

### Step 2: Call from Client
From `js/pages/marketplace/index.js` or any client page:

```javascript
await fetch('https://telegram.psots.in/marketplace/notify-buyer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    buyerEmail: user.email,
    message: 'Your message here',
    listingTitle: 'Item title'
  })
});
```

### Step 3: Handle Errors Gracefully
Always wrap email sends in try-catch and allow the feature to succeed even if email fails:

```javascript
// Non-blocking email send
fetch('https://telegram.psots.in/your-endpoint', { ... })
  .catch(() => {}); // Silently fail if email service is down
```

---

## Email Sending Best Practices

1. **Non-Blocking:** Never block user actions on email sending
2. **Error Handling:** Email failures should not prevent feature functionality
3. **Verification:** Always verify email addresses before storing/sending
4. **Rate Limiting:** Consider rate limits for bulk email scenarios
5. **Templates:** Keep email HTML templates simple and responsive
6. **Sender Address:** Always use a verified domain (e.g., `contact@psots.in`)

---

## Environment Variables

Required variables for email functionality:

```
# Resend API Key for email sending
RESEND_API_KEY=<your-resend-api-key>

# Worker URL (used by client to call endpoints)
WORKER_URL=https://telegram.psots.in
```

---

## Testing Email Endpoints

### Test Marketplace Contact Email

```bash
curl -X POST https://telegram.psots.in/marketplace/contact-seller \
  -H "Content-Type: application/json" \
  -d '{
    "buyerName": "Test User",
    "buyerEmail": "test@example.com",
    "message": "Is this available?",
    "sellerEmail": "seller@test.com",
    "sellerName": "Seller Name",
    "listingTitle": "Test Item"
  }'
```

Expected response:
```json
{ "ok": true }
```

---

## Monitoring & Debugging

### Check Email Sending Logs
- Resend dashboard: https://resend.com/dashboard
- Cloudflare Worker logs: https://dash.cloudflare.com/

### Common Issues

| Issue | Solution |
|-------|----------|
| `RESEND_API_KEY` not found | Set env var in `wrangler.toml` or Cloudflare secrets |
| Email not received | Check spam folder, verify sender domain, check Resend logs |
| "Failed to send message" toast | Check browser console for CORS errors, verify request format |

---

## Future Enhancements

1. **Admin Registration Notification** — Switch from Telegram to email
2. **Approval/Rejection Emails** — Notify residents when registration is reviewed
3. **Listing Expiration Alerts** — Email sellers 3 days before listing expires
4. **Bulk Email Campaigns** — For community announcements
5. **Email Unsubscribe** — Add unsubscribe links to emails

---

## Related Files

- **Worker:** `src/index.js` (email endpoints)
- **Service:** `js/services/marketplace.service.js` (stores seller email)
- **UI:** `society/marketplace.html` (contact modal)
- **Handler:** `js/pages/marketplace/index.js` (contact form logic)
- **Config:** `wrangler.toml` (environment secrets)

---

For questions or updates, contact the development team.
