# Family & Tenant Login Flow - Complete Guide

**Status:** ✅ Working  
**Date:** April 30, 2026

---

## 🎯 **How It Works**

Family members and tenants get their **own independent accounts** with their own Google/Email login credentials. They do NOT share the owner's login.

---

## 📋 **Complete User Journey**

### **Scenario: Jyoti Sinha (Owner) + Family Member**

**Flat 15167:**
- **Owner:** Jyoti Sinha (jyoti@gmail.com)
- **Family Member:** Rahul Sinha (rahul@gmail.com)

---

## 🔐 **Step-by-Step Flow**

### **Step 1: Owner Registration**

1. Jyoti goes to `/society/register.html`
2. Clicks "Continue with Google" → selects jyoti@gmail.com
3. Selects "Owner"
4. Enters flat 15167
5. Uploads ownership document (maintenance invoice)
6. Document verified → Status: **approved** ✅

**Database:**
```
credentials/cred_google_jyoti@gmail.com_xxx
  - residentId: r_15167_123
  - type: google
  - identifier: jyoti@gmail.com

residents/r_15167_123
  - name: Jyoti Sinha
  - flatNumber: 15167
  - residentType: owner
  - status: approved

flats/15167
  - ownerResidentId: r_15167_123
```

---

### **Step 2: Family Member Registration**

1. Rahul goes to `/society/register.html`
2. Clicks "Continue with Google" → selects rahul@gmail.com
3. Enters flat 15167
4. Selects "Owner" initially
5. System checks: `GET /flat/15167` → { hasOwner: true }
6. System **disables "Owner" option**, auto-selects "Family Member"
7. Shows message: "This flat already has owner. Are you family or tenant?"
8. Rahul confirms "Family Member"
9. Continues to Step 3
10. **NO document upload shown** (family doesn't need docs)
11. Submits registration
12. Status: **pending** ⏳ (waiting for admin/owner approval)

**Database:**
```
credentials/cred_google_rahul@gmail.com_xxx
  - residentId: r_15167_456  ← New separate account!
  - type: google
  - identifier: rahul@gmail.com

residents/r_15167_456
  - name: Rahul Sinha
  - flatNumber: 15167
  - residentType: family
  - status: pending  ← Needs approval
```

---

### **Step 3: Admin Approval**

Admin sees Rahul's pending registration and approves it:

```
residents/r_15167_456
  - status: pending → approved ✅
```

---

### **Step 4: Family Member Login**

1. Rahul goes to `/society/login.html`
2. Clicks "Continue with Google"
3. Selects **rahul@gmail.com** (his own account)
4. Backend flow:
   ```
   POST /auth/unified-login
   {
     type: "google",
     identifier: "rahul@gmail.com"
   }
   
   Worker looks up:
   1. Find credential: cred_google_rahul@gmail.com_xxx
   2. Get residentId: r_15167_456
   3. Load resident: residents/r_15167_456
   4. Check status: approved ✅
   5. Create session
   6. Return success!
   ```
5. Redirected to dashboard ✅

---

## 🔑 **Key Points**

### **Each User Gets Their Own:**
- ✅ Unique Google/Email account
- ✅ Unique credential record
- ✅ Unique residentId
- ✅ Independent login

### **What's Shared:**
- ✅ Same flatNumber (15167)
- ✅ Same flat record reference
- ✅ Can see each other in family members list

---

## 📊 **Data Structure Example**

```javascript
// Flat 15167 with 3 residents

flats/15167
  - ownerResidentId: r_15167_owner
  - familyCount: 2

credentials/cred_google_jyoti@gmail.com_xxx
  → residentId: r_15167_owner

credentials/cred_google_rahul@gmail.com_yyy
  → residentId: r_15167_family1

credentials/cred_email_tenant@gmail.com_zzz
  → residentId: r_15167_tenant1

residents/r_15167_owner
  - name: Jyoti Sinha
  - residentType: owner
  - status: approved

residents/r_15167_family1
  - name: Rahul Sinha
  - residentType: family
  - status: approved

residents/r_15167_tenant1
  - name: Tenant Name
  - residentType: tenant
  - status: pending
```

---

## ✅ **Login Methods Supported**

| User Type | Login Method | Document Required? | Approval Needed? |
|-----------|-------------|-------------------|-----------------|
| Owner | Google | ✅ Yes | AI verifies |
| Owner | Email/Password | ✅ Yes | AI verifies |
| Family | Google | ❌ No | Admin approves |
| Family | Email/Password | ❌ No | Admin approves |
| Tenant | Google | ❌ No | Admin approves |
| Tenant | Email/Password | ❌ No | Admin approves |

---

## 🧪 **Testing**

### **Test Family Member Registration:**
1. Use a different Google account (not your main one)
2. Go to register page
3. Enter flat 15167
4. Should auto-select "Family Member"
5. No document upload shown
6. Submit → Status: pending

### **Test Family Member Login (Before Approval):**
1. Try to login with that Google account
2. Should see: "Your registration is pending approval"

### **Test Family Member Login (After Approval):**
1. Approve in admin panel
2. Login with that Google account
3. Should access dashboard successfully!

---

## 🎯 **Summary**

✅ Family/Tenant registration works  
✅ Each gets their own Google/Email credential  
✅ No document upload needed for family/tenant  
✅ Login works independently after approval  
✅ All accounts linked to same flat  

**The system is fully functional for multi-user flats!** 🚀
