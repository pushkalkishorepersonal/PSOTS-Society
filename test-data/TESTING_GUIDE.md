# 🧪 Complete Testing Guide - Registration Flows

**Date:** April 30, 2026  
**Purpose:** Test all registration types with dummy data

---

## 📋 **Test Accounts Overview**

| Type | Name | Email | Flat | Document | Lease Dates |
|------|------|-------|------|----------|-------------|
| Owner | Pushkal Kishore | pushkal.test@gmail.com | 15167 | Ownership doc | N/A |
| Family | Sneha Kishore | sneha.test@gmail.com | 15167 | None | N/A |
| Tenant 1 | Ramesh Kumar | ramesh.kumar.test@gmail.com | 15167 | Lease agreement | 01/05/2026 - 30/04/2027 |
| Tenant 2 | Arjun Patel | arjun.patel.test@gmail.com | 8053 | Lease agreement | 01/06/2026 - 31/05/2027 |

---

## 🔧 **Prerequisites**

### **Step 1: Convert HTML to PDF**

Open each lease agreement HTML file in browser and save as PDF:

1. **Tenant 1 Lease:**
   - Open `PSOTS/test-data/LEASE_AGREEMENT_TENANT1.html` in Chrome
   - Press `Cmd + P` (Mac) or `Ctrl + P` (Windows)
   - Select "Save as PDF"
   - Save as `LEASE_AGREEMENT_TENANT1.pdf`

2. **Tenant 2 Lease:**
   - Open `PSOTS/test-data/LEASE_AGREEMENT_TENANT2.html` in Chrome
   - Save as PDF: `LEASE_AGREEMENT_TENANT2.pdf`

### **Step 2: Create Test Gmail Accounts** (Optional)

**Option A:** Use Gmail + aliases (Easiest)
- If your email is `pushkalkishore@gmail.com`
- Use: `pushkalkishore+tenant1@gmail.com`
- Gmail ignores everything after `+`
- All emails go to same inbox

**Option B:** Create separate test accounts
- Go to gmail.com
- Create: `ramesh.kumar.test@gmail.com`
- Create: `arjun.patel.test@gmail.com`

---

## ✅ **Test Flow 1: Owner Registration**

### **Test Case: Owner with Ownership Document**

**Persona:** Pushkal Kishore (Owner of Flat 15167)

**Steps:**
1. Go to `https://society.psots.in/society/register.html`
2. Click **"Continue with Google"**
3. Select: `pushkal.test@gmail.com` (or use your actual email)
4. **Step 2: Flat Details**
   - Flat Number: `15167`
   - Resident Type: **Owner** ✅
   - Click "Continue"
5. **Step 3: Personal Details**
   - Name: `Pushkal Kishore`
   - Email: (pre-filled)
   - Phone: `+91 98765 43210`
6. **Upload Ownership Document:**
   - Upload your actual PSOTS maintenance invoice
   - Wait for AI verification
   - Should show: ✅ "Verified & Approved instantly!"
7. Click **"Complete Registration"**
8. Should redirect to dashboard

**Expected Result:**
- Status: `approved`
- residentType: `owner`
- No lease dates

---

## ✅ **Test Flow 2: Family Member Registration**

### **Test Case: Family member (no document needed)**

**Persona:** Sneha Kishore (Wife, same flat 15167)

**Steps:**
1. **Logout** from owner account (or use incognito)
2. Go to `https://society.psots.in/society/register.html`
3. Click **"Continue with Google"**
4. Select: `sneha.test@gmail.com` (or `pushkal+family@gmail.com`)
5. **Step 2: Flat Details**
   - Flat Number: `15167`
   - Resident Type: Initially shows "Owner"
   - Click "Continue"
   - **System detects flat already has owner**
   - "Owner" option should be **disabled**
   - Auto-selects: **Family Member** ✅
6. **Step 3: Personal Details**
   - Name: `Sneha Kishore`
   - Phone: `+91 87654 32100`
   - **NO document upload section shown!** ✅
7. Click **"Complete Registration"**

**Expected Result:**
- Status: `pending` (needs admin approval)
- residentType: `family`
- No lease dates
- No document required

---

## ✅ **Test Flow 3: Tenant Registration (Lease Agreement)**

### **Test Case: Tenant with lease upload**

**Persona:** Ramesh Kumar (Tenant, Flat 15167)

**Steps:**
1. **Logout** (or new incognito window)
2. Go to `https://society.psots.in/society/register.html`
3. Click **"Continue with Google"**
4. Select: `ramesh.kumar.test@gmail.com`
5. **Step 2: Flat Details**
   - Flat Number: `15167`
   - Resident Type: **Tenant** ✅
   - Click "Continue"
6. **Step 3: Personal Details**
   - Name: `Ramesh Kumar`
   - Phone: `+91 87654 32109`
7. **Upload Lease Agreement:**
   - Title shows: "Upload Lease Agreement *"
   - Description: "Upload your rental/lease agreement with owner..."
   - Upload: `LEASE_AGREEMENT_TENANT1.pdf`
   - Wait for AI processing
   - Should extract:
     - Tenant Name: Ramesh Kumar ✅
     - Flat: 15167 ✅
     - Society: Prestige Song of the South ✅
     - Lease Start: 01/05/2026 ✅
     - Lease End: 30/04/2027 ✅
   - Result: ✅ "Verified & Approved!" (if all matches)
8. Click **"Complete Registration"**

**Expected Result:**
- Status: `approved`
- residentType: `tenant`
- leaseStartDate: `01/05/2026`
- leaseEndDate: `30/04/2027`
- rentAmount: `35000`

---

## ✅ **Test Flow 4: Second Tenant (Different Flat)**

### **Test Case: Another tenant, different flat**

**Persona:** Arjun Patel (Tenant, Flat 8053)

**Steps:**
1. **Logout**
2. Go to registration page
3. Google auth: `arjun.patel.test@gmail.com`
4. Flat: `8053`
5. Type: **Tenant**
6. Name: `Arjun Patel`
7. Upload: `LEASE_AGREEMENT_TENANT2.pdf`
8. AI should extract:
   - Tenant: Arjun Patel ✅
   - Flat: 8053 ✅
   - Society: PSOTS ✅
   - Start: 01/06/2026 ✅
   - End: 31/05/2027 ✅
9. Complete registration

**Expected Result:**
- Status: `approved`
- Lease: 01/06/2026 to 31/05/2027

---

## 🔍 **Verify in Firebase Console**

After each registration, check Firestore:

1. Go to: https://console.firebase.google.com/
2. Select project: `psots-society-25899`
3. Go to **Firestore Database**
4. Check collections:

### **Check `residents` collection:**

```
residents/r_15167_xxx (Owner)
  - name: "Pushkal Kishore"
  - residentType: "owner"
  - status: "approved"
  - flatNumber: "15167"

residents/r_15167_yyy (Family)
  - name: "Sneha Kishore"
  - residentType: "family"
  - status: "pending"
  - flatNumber: "15167"

residents/r_15167_zzz (Tenant 1)
  - name: "Ramesh Kumar"
  - residentType: "tenant"
  - status: "approved"
  - flatNumber: "15167"
  - leaseStartDate: "01/05/2026"
  - leaseEndDate: "30/04/2027"
  - rentAmount: "35000"

residents/r_8053_aaa (Tenant 2)
  - name: "Arjun Patel"
  - residentType: "tenant"
  - flatNumber: "8053"
  - leaseStartDate: "01/06/2026"
  - leaseEndDate: "31/05/2027"
```

### **Check `credentials` collection:**

```
credentials/cred_google_pushkal.test@gmail.com_xxx
  → residentId: r_15167_xxx

credentials/cred_google_ramesh.kumar.test@gmail.com_yyy
  → residentId: r_15167_zzz
```

---

## 🧪 **Advanced Tests**

### **Test: Wrong Document (Should Fail)**
1. Register as tenant
2. Upload ownership doc instead of lease
3. Should show error: "Could not find lease dates"

### **Test: Expired Lease (Future)**
Create lease with:
- End date: 01/01/2026 (past date)
- Should trigger immediate warning

### **Test: Login After Registration**
1. Logout
2. Go to `/society/login.html`
3. Click "Continue with Google"
4. Select tenant email
5. Should login successfully
6. Dashboard should show lease expiry date

---

## 📊 **Success Criteria**

✅ Owner: Document verified, approved  
✅ Family: No document, pending status  
✅ Tenant 1: Lease extracted, dates stored  
✅ Tenant 2: Different flat, also works  
✅ All can login independently  
✅ Firestore has correct data  

---

**Ready to test! Start with Test Flow 1.** 🚀
