# 🚀 Quick Test Reference Card

## 📁 **Files Created**

```
PSOTS/test-data/
├── LEASE_AGREEMENT_TENANT1.html      ← Source HTML
├── LEASE_AGREEMENT_TENANT1.pdf       ← ✅ Ready to upload
├── LEASE_AGREEMENT_TENANT2.html      ← Source HTML  
├── LEASE_AGREEMENT_TENANT2.pdf       ← ✅ Ready to upload
├── TESTING_GUIDE.md                  ← Full step-by-step guide
├── QUICK_REFERENCE.md                ← This file
└── convert-to-pdf.sh                 ← PDF converter
```

---

## 🧪 **Test Accounts**

### **Owner (Your Main Account)**
```
Email: pushkalkishore@gmail.com (your actual email)
Flat: 15167
Type: Owner
Document: Your actual PSOTS maintenance invoice
Expected: Approved immediately ✅
```

### **Family Member**
```
Email: pushkalkishore+family@gmail.com (alias - same inbox)
Flat: 15167
Type: Family Member
Document: None needed
Expected: Pending approval ⏳
```

### **Tenant 1 (Same flat as owner)**
```
Name: Ramesh Kumar
Email: pushkalkishore+tenant1@gmail.com (alias)
Flat: 15167
Type: Tenant
Document: LEASE_AGREEMENT_TENANT1.pdf
Lease: 01/05/2026 to 30/04/2027
Expected: Approved with lease dates ✅
```

### **Tenant 2 (Different flat)**
```
Name: Arjun Patel
Email: pushkalkishore+tenant2@gmail.com (alias)
Flat: 8053
Type: Tenant
Document: LEASE_AGREEMENT_TENANT2.pdf
Lease: 01/06/2026 to 31/05/2027
Expected: Approved with lease dates ✅
```

---

## ⚡ **Quick Test Steps**

### **Test 1: Owner (5 min)**
1. Go to: https://society.psots.in/society/register.html
2. Google login with your email
3. Flat: 15167, Type: Owner
4. Upload your actual invoice
5. ✅ Should approve instantly

### **Test 2: Family (3 min)**
1. Logout or use incognito
2. Google login: `youremail+family@gmail.com`
3. Flat: 15167, Type: Family
4. System disables "Owner", forces "Family"
5. No document upload shown
6. ⏳ Status: Pending

### **Test 3: Tenant (5 min)**
1. Logout or incognito
2. Google login: `youremail+tenant1@gmail.com`
3. Flat: 15167, Type: Tenant
4. Upload: `LEASE_AGREEMENT_TENANT1.pdf`
5. AI extracts dates
6. ✅ Should approve with lease tracking

---

## 🔍 **What to Check**

### **In Frontend:**
- ✅ Owner sees document upload
- ✅ Family sees NO document upload
- ✅ Tenant sees "Upload Lease Agreement"
- ✅ Flat 15167 disables "Owner" for new users
- ✅ AI shows extracted lease dates

### **In Firestore:**
```
Go to: console.firebase.google.com
Project: psots-society-25899
Database: Firestore

Check residents/ collection:
- Owner has: status=approved, residentType=owner
- Family has: status=pending, residentType=family
- Tenant has: status=approved, residentType=tenant, 
              leaseStartDate, leaseEndDate
```

### **In Worker Logs:**
```
Go to: dash.cloudflare.com
Workers & Pages → psots-telegram-bot-v2
Real-time Logs → Look for:
- "verify-document: tenant → verified"
- Extracted lease dates logged
```

---

## 🎯 **Expected AI Extraction**

### **Tenant 1 Lease:**
```json
{
  "tenantName": "Ramesh Kumar",
  "flatNumber": "15167",
  "societyName": "Prestige Song of the South",
  "leaseStartDate": "01/05/2026",
  "leaseEndDate": "30/04/2027",
  "rentAmount": "35000",
  "confidence": "high"
}
```

### **Tenant 2 Lease:**
```json
{
  "tenantName": "Arjun Patel",
  "flatNumber": "8053",
  "societyName": "Prestige Song of the South",
  "leaseStartDate": "01/06/2026",
  "leaseEndDate": "31/05/2027",
  "rentAmount": "28000",
  "confidence": "high"
}
```

---

## 🐛 **Troubleshooting**

### **PDF not recognized:**
- Open HTML in browser
- Manual Save as PDF (Cmd+P)
- Make sure text is selectable (not image)

### **Email alias not working:**
- Use actual separate Gmail accounts
- Or use your main email for all tests
- Data won't conflict (different residentIds)

### **Flat already has owner error:**
- Perfect! It's working
- System correctly detected existing owner
- Should auto-select "Family" or "Tenant"

### **AI can't extract dates:**
- Check PDF has actual text (not scanned image)
- Try uploading HTML directly (some systems support it)
- Worst case: Manual review by admin

---

## 📧 **Gmail Alias Trick**

```
Your email: pushkalkishore@gmail.com

Create aliases (all go to same inbox):
- pushkalkishore+owner@gmail.com
- pushkalkishore+family@gmail.com
- pushkalkishore+tenant1@gmail.com
- pushkalkishore+tenant2@gmail.com

Gmail ignores the +xxx part!
But Firestore treats them as different users ✅
```

---

## ⏱️ **Estimated Testing Time**

- Owner registration: **5 min**
- Family registration: **3 min**
- Tenant 1 registration: **5 min**
- Tenant 2 registration: **5 min**
- Firestore verification: **5 min**

**Total: ~25 minutes** for complete test suite

---

## ✅ **Success Checklist**

- [ ] Owner registered and approved
- [ ] Family registered (pending)
- [ ] Tenant 1 registered with lease dates
- [ ] Tenant 2 registered (different flat)
- [ ] All 4 credentials created in Firestore
- [ ] Lease dates visible in Firestore
- [ ] Can login with all 4 accounts
- [ ] Dashboard shows lease expiry for tenants

---

**Start with TESTING_GUIDE.md for detailed steps!** 🚀
