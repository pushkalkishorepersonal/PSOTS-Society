# End-to-End Testing Guide — Phase 2-3 Frontend Migration

## Prerequisites
- ✅ All frontend pages migrated to Worker API endpoints
- ✅ Worker endpoints deployed at https://telegram.psots.in (or running locally on localhost:8787)
- ✅ D1 database configured in wrangler.toml
- ✅ Firebase Auth configured (from previous setup)

---

## Part 1: Local Setup (Run Locally)

### Step 1: Start the Worker Dev Server
```bash
cd /home/user/PSOTS-Society
npm install  # if needed
npm run dev
```
This starts the Worker on `http://localhost:8787`

**Verify it's running:**
```bash
curl -s http://localhost:8787/society/carpooling
# Should return JSON response (with credentials: include)
```

### Step 2: Serve Frontend Pages Locally
In another terminal:
```bash
cd /home/user/PSOTS-Society
python3 -m http.server 8000
```
This serves the static pages on `http://localhost:8000`

### Step 3: Update WORKER_URL for Local Testing
Since the pages are hardcoded with `https://telegram.psots.in`, you have two options:

**Option A: Temporary Local Modification (for testing only)**
Edit the three pages temporarily:
```javascript
// Change from:
const WORKER_URL = 'https://telegram.psots.in';
// To:
const WORKER_URL = 'http://localhost:8787';
```

Files to modify:
- society/carpooling.html (line ~651)
- society/lostandfound.html (line ~149)
- society/recommendations.html (line ~379)

**Option B: Use Browser DevTools to Intercept (no code change)**
- Set local WORKER_URL via browser console before testing
- Or use a proxy tool (local-cors-proxy) to forward requests

---

## Part 2: Testing Flows

### Test 1: Authentication Gate
1. Open `http://localhost:8000/society/carpooling.html` in browser
2. ❌ Should show auth gate (not logged in)
3. Click "Sign In / Register"
4. Complete Firebase Auth flow (Google, Email OTP, or Telegram)
5. ✅ After auth, page should load carpooling form

### Test 2: Resident Approval State
1. After signing in, check resident status
2. If status !== 'approved':
   - ❌ Show warning: "Your registration is pending approval"
   - ❌ Hide post form
   - ✅ Show listings (read-only)
3. If status === 'approved':
   - ✅ Show post form
   - ✅ Show "Post Ride" button

### Test 3: List Carpooling Posts (GET /society/carpooling)
1. ✅ Page loads carpooling listings
2. ✅ Tab switching works (Offering ↔ Looking)
3. ✅ Empty state shows when no posts: "No ride offers posted yet"
4. Filter behavior:
   - GET /society/carpooling?type=offering
   - GET /society/carpooling?type=looking

**Expected Response:**
```json
{
  "ok": true,
  "posts": [
    {
      "id": "uuid-or-id",
      "type": "offering",
      "from": "PSOTS Main Gate",
      "to": "Koramangala",
      "date": "2026-05-31",
      "time": "08:00",
      "seats": 3,
      "status": "active",
      "posterFlat": "15167",
      "posterUid": "user-uid",
      ...
    }
  ]
}
```

### Test 4: Create Carpooling Post (POST /society/carpooling)
1. Fill in form:
   - Type: "Offering Ride"
   - From: "PSOTS Main Gate"
   - To: "Koramangala 4th Block"
   - Date: Today
   - Time: "08:00"
   - Seats: 3
   - Recurring: "One-time"
   - Notes: "Optional notes"
2. Click "Post Ride"
3. ✅ Toast shows: "Ride posted successfully!"
4. ✅ Form resets
5. ✅ Tab switches to "Offering Ride"
6. ✅ Your post appears in listings

**Expected POST Request:**
```json
{
  "type": "offering",
  "from": "PSOTS Main Gate",
  "to": "Koramangala 4th Block",
  "date": "2026-05-31",
  "time": "08:00",
  "seats": 3,
  "recurring": "one-time",
  "notes": "Optional notes",
  "posterFlat": "15167"
}
```

### Test 5: Update Carpooling Post (PUT /society/carpooling/:id)
1. Create a carpooling post (Test 4)
2. On your own post, click "Mark as Full"
3. ✅ Toast: "Marked as full"
4. ✅ Post status changes to "FULL" badge
5. Try "Cancel" button (if not full)
6. ✅ Status changes to "CANCELLED"

**Expected PUT Request:**
```json
{
  "status": "full"
}
// or
{
  "status": "cancelled"
}
```

### Test 6: Lost & Found Posts (Similar Flow)
1. Navigate to `/society/lostandfound.html`
2. Repeat Tests 1-5 for lost-found posts
3. Endpoints:
   - GET /society/lost-found?type=lost
   - GET /society/lost-found?type=found
   - POST /society/lost-found
   - PUT /society/lost-found/:id (mark resolved)

### Test 7: Recommendations Page
1. Navigate to `/society/recommendations.html`
2. View recommendations by category (Doctors, Home Services, etc.)
3. ✅ Search box filters by name
4. Create recommendation:
   - Category: "Doctors"
   - Name: "Dr. Sharma"
   - Phone: "9980123456"
   - Rating: "5 stars"
   - Description: "Excellent service"
5. ✅ Toast: "Recommendation submitted for approval!"

**Expected POST Request:**
```json
{
  "name": "Dr. Sharma",
  "category": "doctors",
  "phone": "9980123456",
  "rating": 5,
  "description": "Excellent service"
}
```

---

## Part 3: Browser DevTools Verification

Open DevTools (F12) → Network tab to verify:

### Carpooling Requests
- GET http://localhost:8787/society/carpooling?type=offering
  - Status: 200
  - Response: JSON with posts array

- POST http://localhost:8787/society/carpooling
  - Status: 200
  - Headers: `credentials: 'include'`
  - Response: `{ "ok": true, "id": "..." }`

- PUT http://localhost:8787/society/carpooling/post-id
  - Status: 200
  - Body: `{ "status": "full" }`
  - Response: `{ "ok": true }`

### Check CORS Headers
Every response should include:
```
access-control-allow-credentials: true
access-control-allow-origin: http://localhost:8000
```

---

## Part 4: Authentication Verification

### Check Auth Flow
1. Open DevTools → Application → Cookies
2. After login, should see:
   - Firebase auth tokens in localStorage (from Firebase SDK)
   - OR psots_session cookie (from OAuth flow)

3. When making requests, check Authorization header:
   ```
   Authorization: Bearer <id-token>
   // OR
   Cookie: psots_session=<session-id>
   ```

---

## Part 5: Error Cases (Probe Testing)

### Test Missing Auth
1. Try POST to /society/carpooling without auth
2. ❌ Should get 401 or redirect to login

### Test Invalid Category
1. GET /society/recommendations?category=invalid
2. ❌ Should return empty array or error

### Test Malformed Data
1. POST /society/carpooling with missing `from` field
2. ❌ Should get validation error from Worker

### Test Unauthenticated User
1. Clear localStorage (logout)
2. Try to POST a carpooling ride
3. ❌ Should show "Sign in to continue" or 401 error

---

## Part 6: Approval Flow (if not approved)

### Step 1: Register as New Resident
1. Sign up with new email
2. Fill in flat number: 15167
3. Submit registration
4. ✅ Status should be "pending"

### Step 2: Admin Approves You
1. Go to `/society/admin.html` (as admin user)
2. Navigate to "Resident Approvals" tab
3. Find your pending registration
4. Click "Approve"
5. ✅ Notification sent via email/Telegram

### Step 3: Test Post Creation (Now Approved)
1. Reload carpooling page
2. ✅ Post form now visible
3. Create a carpooling post
4. ✅ Post appears in listings

---

## Part 7: Complete User Journey (First Onboarding)

1. ✅ Sign up as new resident
2. ⏳ Wait for admin approval (or use dev account)
3. ✅ Go to Carpooling → Post a ride offer
4. ✅ Go to Lost & Found → Report lost keys
5. ✅ Go to Recommendations → Recommend doctor
6. ✅ Go to Marketplace → List item for sale
7. ✅ Test "Contact Resident" button on other posts
8. ✅ Check that your profile shows your posts

---

## Deployment Checklist (When Ready for Production)

- [ ] `npm run deploy` (requires CLOUDFLARE_API_TOKEN)
- [ ] Worker deployed to https://telegram.psots.in
- [ ] Pages still reference: `const WORKER_URL = 'https://telegram.psots.in'`
- [ ] Test pages at https://society.psots.in
- [ ] Verify auth redirects to https://society.psots.in/login.html
- [ ] Check that cookies are set correctly on .psots.in domain
- [ ] Run `/verify` against production to confirm all flows work

---

## Troubleshooting

### "CORS error" or "Failed to fetch"
- Check that Worker is running: `curl http://localhost:8787/society/carpooling`
- Verify `credentials: 'include'` is in fetch request
- Check browser console for specific error message

### "Redirect to login"
- User not authenticated or token expired
- Check localStorage for auth tokens
- Check Firebase Auth configuration

### "Empty listings"
- Database may not have any posts yet (expected on first run)
- Check Network tab to see if GET returned 200 with empty posts array

### "Cannot POST"
- User not approved (check resident.status in database)
- Token expired
- Missing required fields in request

---

## Success Criteria

You can consider Phase 2-3 complete when:
- ✅ All three pages load without errors
- ✅ Can create posts via Worker API
- ✅ Can view listings from database
- ✅ Can update posts (mark full, cancel, resolve)
- ✅ Auth gate shows correctly for unauthenticated users
- ✅ Contact resident modal works
- ✅ All Network requests show 200 status codes
- ✅ CORS headers are correct
- ✅ You can onboard yourself as first resident user

Next phases:
- Phase 4: Profile page migration (family, tenants, device trust)
- Phase 5: Admin panel migration
- Phase 6: Final Firestore cleanup
