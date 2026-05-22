# 🔧 Fix "Pending Approval" Issue

## Problem
Lost & Found and Carpooling pages show:
> ⏳ Your registration is pending approval. You can view listings but cannot post until verified.

## Cause
Your account `status` field in Firestore is **NOT** set to `'approved'`.

## Solution

### Method 1: Via Admin Panel (EASIEST) ✅

1. Go to: https://society.psots.in/society/admin
2. Click the **"Residents"** tab in the navigation
3. Find your account (`pushkalkishore@gmail.com`)
4. Click the **"✅ Approve"** button next to your name

After approval:
- Your status will change from `'pending'` → `'approved'`
- You'll be able to post on Lost & Found
- You'll be able to post on Carpooling
- You'll get a blue verification badge ✓

---

### Method 2: Browser Console (ADVANCED)

**Use this if you don't see yourself in the Residents tab**

1. Go to: https://society.psots.in/society/lostandfound
2. Open DevTools (`F12` or `Cmd+Option+I` on Mac)
3. Go to **Console** tab
4. **Step 1: Check your current status** - Paste this and press Enter:

```javascript
(async () => {
  const user = firebase.auth().currentUser;
  if (!user) return console.log('❌ Not logged in');
  
  const db = firebase.firestore();
  const snap = await db.collection('residents').where('email', '==', user.email).get();
  
  if (snap.empty) {
    console.log('❌ No resident document found for', user.email);
    return;
  }
  
  const doc = snap.docs[0];
  const data = doc.data();
  console.log('📋 Current Resident Status:', {
    id: doc.id,
    name: data.name,
    email: data.email,
    status: data.status,  // ← This should be 'approved'
    flatNumber: data.flatNumber,
    approvedAt: data.approvedAt
  });
})();
```

5. **Step 2: If status is NOT 'approved', run this** - Paste and press Enter:

```javascript
(async () => {
  const user = firebase.auth().currentUser;
  if (!user) return console.log('❌ Not logged in');
  
  const db = firebase.firestore();
  const snap = await db.collection('residents').where('email', '==', user.email).get();
  
  if (snap.empty) {
    console.log('❌ No resident document found');
    return;
  }
  
  const doc = snap.docs[0];
  console.log('Before update - Status:', doc.data().status);
  
  // Update to approved
  await doc.ref.update({ 
    status: 'approved',
    approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
    approvedBy: 'self (superadmin)',
    isActive: true
  });
  
  console.log('✅ Status updated to APPROVED! Refresh the page now.');
})();
```

6. **Refresh the page** (`Cmd+R` or `Ctrl+R`)
7. You should now see the posting form!

---

## What Changed?

The `status` field in your Firestore `residents` document is updated:
- **Before**: `status: 'pending'`
- **After**: `status: 'approved'`

Both **lostandfound.html** and **carpooling.html** check:
```javascript
const isApproved = resident?.status === 'approved';
```

Only when `isApproved === true` do they show the posting form.

---

## Still Not Working?

Make sure you're logged in with: **pushkalkishore@gmail.com**

Check console for errors:
1. Open DevTools (F12)
2. Console tab
3. Look for any red errors

If you see "No resident document found", you need to complete registration first.
