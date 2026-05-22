# ✅ Simple Testing Steps (Updated - May 1, 2026)

**All bugs fixed! Ready to test.**

---

## 🎯 **What We Fixed:**

1. ✅ "Applying as: Owner" now shows correct type (Owner/Tenant/Family)
2. ✅ Duplicate registration prevented - redirects to login if already registered
3. ✅ Better PDF extraction (still testing)

---

## 📋 **Test 1: Family Member Registration (Easiest!)**

**Why start here:** No document upload needed, tests core flow.

### **Steps:**

**1. Go to registration page:**
```
https://society.psots.in/society/register.html
```

**2. Click:** "Register with Email"

**3. Enter details:**
```
Email: family1@test.com
Password: Test123456
Confirm: Test123456
```

**4. Click:** "Create Account" → Continue

**5. Step 2 - Flat Details:**
```
Flat Number: 15167
Resident Type: Family Member (select this)
```

**6. Click:** "Continue →"

**7. Step 3 - Your Details:**
```
Check: Should show "Applying as: Family Member" ✅
Name: Sneha Kishore
Email: (pre-filled)
Phone: 87654 32100
```

**8. Notice:** NO document upload section! ✅

**9. Click:** "Complete Registration"

**10. Success!** 🎉

### **Expected Result:**
- Status: Pending (needs admin approval)
- No document required
- Can login later with family1@test.com

---

## 📋 **Test 2: Try to Register Again (Duplicate Check)**

**Purpose:** Test if system prevents duplicate registration.

### **Steps:**

**1. Logout or refresh page**

**2. Go to registration again**

**3. Click:** "Register with Email"

**4. Enter SAME email:**
```
Email: family1@test.com
Password: Test123456
```

**5. Click:** "Create Account"

### **Expected Result:**
- ✅ Shows: "You already have an account! Redirecting to login..."
- ✅ Auto-redirects to login page after 2 seconds
- ✅ Won't let you create duplicate account

**This proves the duplicate prevention works!** 🎯

---

## 📋 **Test 3: Login with Existing Account**

**Purpose:** Test if you can login with the account you created.

### **Steps:**

**1. Go to login page:**
```
https://society.psots.in/society/login.html
```

**2. Click:** "Sign in with Email"

**3. Enter:**
```
Email: family1@test.com
Password: Test123456
```

**4. Click:** "Sign In"

### **Expected Result:**
- ✅ Login successful
- ✅ Redirects to dashboard
- ✅ Shows your profile (pending approval status)

---

## 📋 **Test 4: Owner Registration (With Document)**

**Skip this if you don't have your PSOTS invoice handy.**

### **Steps:**

**1. Go to registration (new email!):**
```
Email: owner1@test.com
Password: Test123456
```

**2. Step 2:**
```
Flat: 15167
Type: Owner (select this)
```

**3. Step 3:**
```
Check: Should show "Applying as: Owner" ✅
Name: Pushkal Kishore
Phone: 98765 43210
```

**4. Upload your actual PSOTS maintenance invoice**

**5. Complete registration**

### **Expected Result:**
- If invoice verified → Approved instantly
- If can't verify → Pending review
- Either way, account created!

---

## 📋 **Test 5: Tenant Registration (With Lease - Optional)**

**Only if you want to test lease tracking.**

### **Steps:**

**1. New registration:**
```
Email: tenant1@test.com
Password: Test123456
```

**2. Step 2:**
```
Flat: 15167
Type: Tenant (select this)
```

**3. Step 3:**
```
Check: Should show "Applying as: Tenant" ✅
Name: Ramesh Kumar
Phone: 87654 32109
```

**4. Upload:** `PSOTS/test-data/LEASE_AGREEMENT_TENANT1.pdf`

**5. If AI can't read it:**
- Click "Upload document to continue" (gray button)
- Submits for manual review
- Still creates account!

**6. Complete registration**

### **Expected Result:**
- Account created
- Status: Pending review (if AI can't extract dates)
- Admin can manually add lease dates later

---

## ✅ **Success Checklist:**

After all tests:

- [ ] Family member registered (no document) ✅
- [ ] Duplicate registration blocked ✅
- [ ] Login works with test account ✅
- [ ] "Applying as:" shows correct type ✅
- [ ] Can create multiple accounts with different emails ✅

---

## 🎯 **Recommended Testing Order:**

1. **Test 1:** Family registration (2 min) ← **Start here!**
2. **Test 2:** Duplicate check (1 min)
3. **Test 3:** Login test (1 min)
4. **Test 4:** Owner (optional - 5 min)
5. **Test 5:** Tenant (optional - 5 min)

---

## 💡 **Important Notes:**

### **Email Addresses:**
Use different emails for each test:
- `family1@test.com` - Family member
- `owner1@test.com` - Owner
- `tenant1@test.com` - Tenant

### **Password:**
Use same password for all: `Test123456`

### **Flat Number:**
Use `15167` for all tests (or your actual flat)

### **No Real Emails Needed:**
- `xxx@test.com` doesn't need to exist
- You won't receive emails (but Firestore will have data)
- You can still login with these fake emails!

---

## 🚀 **Ready to Start?**

**Estimated time:** 5 minutes for basic tests

**Start with Test 1** (Family Member) - it's the easiest and proves everything works!

Let me know when you complete Test 1! 🎉
