# Sprint 3 Testing Plan — PSOTS Frontend UI Rebuild

## Test Environment
- Access: https://society.psots.in/society/login.html
- Clear localStorage/sessionStorage before each test (DevTools → Application)
- Test on multiple devices/browsers if possible

---

## 1. Quick-Return Login Flow ✓

### Test Case 1.1: First Login (New Device)
1. Go to login page → No quick-return shown (correct)
2. Sign in via Google/Email/Telegram
3. Verify:
   - ✓ Device token stored in localStorage
   - ✓ Resident info in sessionStorage
   - ✓ Redirected to dashboard

### Test Case 1.2: Second Visit (Same Device)
1. Clear cookies/session but keep localStorage device token
2. Reload login page
3. Verify:
   - ✓ Quick-return card appears
   - ✓ Shows device emoji (📱/💻 etc.)
   - ✓ Shows device label (e.g., "iPhone · Safari")
   - ✓ Shows location (e.g., "Last active in Bangalore")
   - ✓ "One tap to continue" button visible
4. Click continue → Dashboard loads instantly

### Test Case 1.3: Quick-Return Fallback
1. Keep device token but delete resident from sessionStorage
2. Click quick-return continue
3. Verify:
   - ✓ Falls back to normal login
   - ✓ No error messages

---

## 2. Dashboard Device Display ✓

### Test Case 2.1: Current Device Card
1. After login, go to dashboard
2. Look for "Your Stuff" zone
3. Verify device card shows:
   - ✓ Correct device emoji (🔐 or specific device type)
   - ✓ Device label (e.g., "iPhone · Safari")
   - ✓ Location info (e.g., "Location: Bangalore")
   - ✓ "Manage Devices" link works → goes to profile.html#devices

### Test Case 2.2: Device Info Persistence
1. Reload dashboard
2. Verify device info still displays correctly (from sessionStorage)

---

## 3. SocietyNav Component ✓

### Test Case 3.1: Navbar Display
1. Check top of dashboard
2. Verify navbar shows:
   - ✓ PSOTS logo on left
   - ✓ Resident name and flat number in center
   - ✓ "Sign Out" button on right
   - ✓ Responsive design (collapse on mobile)

### Test Case 3.2: Navbar Functionality
1. Click resident name → Should highlight/no action (info display)
2. Click "Sign Out" → Logs out, redirects to login
3. Verify:
   - ✓ sessionStorage cleared
   - ✓ localStorage device token removed
   - ✓ Firebase session cleared

---

## 4. Multi-Device Scenario ✓

### Test Case 4.1: Two Devices
1. **Device A (Desktop):**
   - Sign in via Google
   - Note device label
   - Go to dashboard

2. **Device B (Mobile or Incognito):**
   - Sign in via Email
   - Quick-return should NOT appear (different device)
   - Sign in normally
   - Dashboard shows Device B info

3. **Device A (Revisit):**
   - Reload/revisit
   - Quick-return appears with Device A info
   - Dashboard shows Device A info

### Test Case 4.2: Device Revocation (Profile → My Devices)
1. Go to profile.html#devices
2. Find current device in list
3. Click "Revoke" button
4. Current device should be marked as revoked
5. Next login should show normal login (not quick-return)

---

## 5. Dashboard 3-Zone Layout ✓

### Test Case 5.1: Zone Organization
1. Verify three clear zones:
   - **Zone 1: "Your Stuff"** (top)
     - Current device card
     - (Later: quick stats)
   
   - **Zone 2: "Features"** (middle)
     - Quick action chips (Marketplace, Lost & Found, etc.)
     - Stats grid (announcements, listings, events)
     - Featured features section
   
   - **Zone 3: "Community"** (bottom)
     - Latest announcements
     - (Future: events, blog posts)

2. Verify zones have visual separators (border-top lines)

---

## 6. Family & Tenant UIs (Already Activated)

### Test Case 6.1: Family Members Tab
1. Go to profile.html
2. Click "Family" tab
3. Verify:
   - ✓ Tab visible and active
   - ✓ Family members list displays
   - ✓ "Add Family Member" button works
   - ✓ Approval flow visible if pending

### Test Case 6.2: Tenants Tab
1. Go to profile.html
2. Click "Tenants" tab
3. Verify:
   - ✓ Tab visible and active
   - ✓ Tenant list displays
   - ✓ "Add Tenant" button works
   - ✓ Approval flow visible if pending

---

## 7. Mobile Responsiveness

### Test Case 7.1: Mobile Login
1. Login on mobile/tablet
2. Verify:
   - ✓ Quick-return responsive
   - ✓ Device label readable
   - ✓ Continue button tappable

### Test Case 7.2: Mobile Dashboard
1. View dashboard on mobile
2. Verify:
   - ✓ 3-zone layout stacks vertically
   - ✓ Device card readable
   - ✓ Navbar responsive (logo only on mobile)
   - ✓ Touch-friendly spacing

---

## Pass Criteria
- [ ] Quick-return flow works end-to-end
- [ ] Device emoji displays correctly for different device types
- [ ] Location info shows in quick-return and dashboard
- [ ] SocietyNav displays on all pages with correct info
- [ ] 3-zone dashboard layout organized and responsive
- [ ] Family/Tenant tabs visible and functional
- [ ] No console errors or warnings
- [ ] Multi-device scenarios work correctly
- [ ] Mobile responsive on all viewport sizes

---

## Known Limitations (By Design)
- Device emoji is generated client-side (not 100% accurate for all devices)
- ipCity comes from Worker geolocation (IP-based, not GPS)
- Device revocation doesn't invalidate localStorage token immediately (cleared on next login attempt)
