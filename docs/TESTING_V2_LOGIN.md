# Testing V2 Login Fix

**Date:** April 30, 2026  
**Purpose:** Verify Google/Email login works with V2 schema

---

## Test Setup

**Prerequisites:**
1. Deploy Worker: `npx wrangler deploy`
2. Open browser: `https://society.psots.in/society/login.html`
3. Clear all cookies and localStorage
4. Have a test account registered via `/auth/register`

---

## Test Case 1: Google Login (Registered User)

**Steps:**
1. Click "Continue with Google"
2. Select Google account
3. Approve Google consent

**Expected Result:**
- ✅ Redirects to `/society/` dashboard
- ✅ No "stays on login page" bug
- ✅ Worker logs show: `Case A` or `Case B` (not `A-legacy`)
- ✅ Session created in KV

**Debug in Browser Console:**
```javascript
// Check if resident data loaded
localStorage.getItem('psots_device_token')
// Should see device token

// Check session
document.cookie
// Should see psots_session cookie
```

---

## Test Case 2: Google Login (Not Registered)

**Steps:**
1. Click "Continue with Google" with unregistered email
2. Approve Google consent

**Expected Result:**
- ✅ Shows message: "No account found. Please register."
- ✅ Registration form appears
- ✅ Worker logs show: `Case C - not_registered`

---

## Test Case 3: Email/Password Login

**Steps:**
1. Enter registered email
2. Enter password
3. Click "Sign In"

**Expected Result:**
- ✅ Redirects to `/society/` dashboard
- ✅ Shows "Welcome back!" message
- ✅ Worker logs show: `Case A` or `Case B`

---

## Test Case 4: Email Login (Pending Approval)

**Steps:**
1. Login with email that has `status: pending`

**Expected Result:**
- ✅ Shows: "Your registration is pending admin approval"
- ✅ Does NOT redirect to dashboard
- ✅ Worker logs show: `not_approved`

---

## Test Case 5: Auto-Redirect on Page Load

**Steps:**
1. Login successfully
2. Go back to `/society/login.html`

**Expected Result:**
- ✅ Automatically redirects to `/society/` dashboard
- ✅ No login form shown
- ✅ Worker API called on page load

---

## Debugging

**If login fails, check:**

1. **Browser Console:**
   ```javascript
   // Check Worker response
   fetch('https://telegram.psots.in/auth/unified-login', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': 'Bearer YOUR_ID_TOKEN'
     },
     body: JSON.stringify({
       type: 'google',
       identifier: 'your-email@gmail.com'
     })
   }).then(r => r.json()).then(console.log)
   ```

2. **Worker Logs:**
   ```bash
   npx wrangler tail
   ```

3. **Firestore Console:**
   - Check `residents/{residentId}` exists
   - Check `credentials/{credentialId}` exists
   - Check `residentId` format: `r_{flatNumber}_{timestamp}`

---

## Known Issues Fixed

- ✅ "Stays on login page" bug - FIXED (was calling `residentService.get(uid)` which doesn't exist in V2)
- ✅ Legacy fallback removed - Now V2 only
- ✅ Direct Firestore queries removed - All through Worker API

---

## Success Criteria

✅ All 5 test cases pass  
✅ No console errors  
✅ Worker logs show V2 case codes only (A, B, C, D - not A-legacy)  
✅ Login works within 2 seconds  
✅ Session persists across page reloads
