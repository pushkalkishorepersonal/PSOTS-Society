# Quick Start Guide - Testing Login

**Date:** April 30, 2026  
**Status:** Ready for Testing

---

## ✅ What Was Fixed

1. **Login bug fixed** - No more "stays on login page" issue
2. **Admin bypass added** - Your email `pushkalkishore@gmail.com` gets auto-approved without document
3. **V2 schema migration** - All auth now uses modern schema

---

## 🚀 How to Test (Step by Step)

### Step 1: Clear Your Browser

**Important:** Clear all data first!

1. Open Chrome
2. Press `Cmd+Shift+Delete` (Mac) or `Ctrl+Shift+Delete` (Windows)
3. Select:
   - ✅ Cookies and other site data
   - ✅ Cached images and files
4. Time range: **All time**
5. Click "Clear data"

---

### Step 2: Register Your Account

1. Go to: `https://society.psots.in/society/login.html`

2. You should see the registration form pre-filled with:
   - Name: Pushkal Kishore
   - Phone: +919482088904
   - Email: pushkalkishore@gmail.com
   - Flat: 15167

3. **Check the agreement checkbox**

4. **Click "Continue with Google"**

5. **Select your Google account** (pushkalkishore@gmail.com)

6. **Approve Google consent** if prompted

---

### Step 3: What Should Happen

**Expected Flow:**
1. ✅ Google popup opens
2. ✅ You select your account
3. ✅ Shows message: "Registration complete! Redirecting to dashboard..."
4. ✅ Redirects to `/society/` dashboard
5. ✅ You see your name and profile

**If it works:** 🎉 Login is fixed!

---

### Step 4: Test Login (After Registration)

1. Sign out from dashboard
2. Go back to: `https://society.psots.in/society/login.html`
3. Click "Continue with Google"
4. Should redirect immediately to dashboard

---

## 🔍 If Something Goes Wrong

### Check Browser Console

Press `F12` or `Cmd+Option+J` and look for errors.

**Common issues:**

**1. "Continue with Google" button doesn't work**
- Check console for errors
- Make sure you checked the agreement checkbox
- Try refreshing the page

**2. Still shows registration form after Google login**
- Check console - look for `/auth/register` response
- Share the error message with me

**3. Server error messages**
- Check the exact error text
- Share it with me

---

## 🐛 Debug Commands

If issues persist, paste this in browser console **after** clicking Google button:

```javascript
// Check current auth state
auth.currentUser ? console.log('Logged in:', auth.currentUser.email) : console.log('Not logged in')

// Test registration endpoint
auth.currentUser.getIdToken().then(token => {
  fetch('https://telegram.psots.in/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'google',
      identifier: 'pushkalkishore@gmail.com',
      name: 'Pushkal Kishore',
      flatNumber: '15167',
      phone: '+919482088904',
      email: 'pushkalkishore@gmail.com',
      firebaseToken: token,
      residentType: 'owner',
      verificationMethod: 'admin_bypass'
    })
  }).then(r => r.json()).then(console.log)
})
```

---

## ✅ Success Checklist

- [ ] Cleared browser cache
- [ ] Checked agreement checkbox
- [ ] Clicked "Continue with Google"
- [ ] Google popup opened
- [ ] Selected pushkalkishore@gmail.com account
- [ ] Saw "Registration complete!" message
- [ ] Redirected to `/society/` dashboard
- [ ] Can see my profile/name

---

## 📞 Next Steps After Success

Once login works:

1. ✅ Test logout and login again
2. ✅ Verify profile page works
3. ✅ Ready for pilot onboarding!

---

**Let me know the result!**
