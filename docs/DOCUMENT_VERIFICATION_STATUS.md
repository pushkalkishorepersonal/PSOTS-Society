# Document Verification System - Status & Testing

**Last Updated:** May 3, 2026  
**Status:** ⚠️ **NEEDS TESTING** - Implementation complete, Gemini extraction untested

---

## 🔍 System Overview

### What's Built
The document verification system uses Gemini 2.5 Flash Lite to extract ownership/tenancy information from uploaded documents during registration.

### How It Works

1. **User uploads document** (registration page, step 3)
2. **Frontend sends to Worker** → `POST /resident/verify-document`
3. **Worker sends to Gemini Vision API** with detailed prompt
4. **Gemini extracts structured JSON** with owner name, flat number, society name
5. **Worker validates** extracted data against user input
6. **Three possible outcomes:**
   - ✅ **`verified`** - All checks pass, auto-approve
   - ⚠️ **`manual_review`** - Partial match, needs admin review
   - ❌ **`invalid_document`** - Failed extraction or mismatch

---

## 📂 Implementation Details

### Frontend (Registration Page)
**File:** `society/register.html`

**Document Upload Section:**
- Lines 439-498: Upload UI with file input
- Line 1131-1258: `handleDocUpload()` function
- Supports PDF, JPG, PNG (max 5MB)
- Shows animated verification checklist
- Updates button state based on verification result

**UI States:**
- "Upload document to continue" (no upload)
- "Verifying..." (processing)
- "Complete Registration ✅" (verified)
- "Submit for Admin Review" (manual review needed)

### Backend Endpoint
**File:** `src/index.js`  
**Endpoint:** `POST /resident/verify-document`  
**Lines:** 5553-5778

**Request Body:**
```json
{
  "base64Document": "...",
  "mimeType": "application/pdf",
  "residentName": "Pushkal Kishore",
  "flatNumber": "15167",
  "residentId": "r_15167_xxx",
  "residentType": "owner" | "tenant"
}
```

**Gemini Prompts:**

#### For Ownership Documents (lines 5609-5649):
```
EXTRACT THESE DETAILS:
1. Society name ("Prestige Song of the South" / "PSOTS")
2. Flat number (from "House :" or "Unit :")
3. Owner name (from "Owner :" label)
4. Document type (invoice/receipt)

Return JSON:
{
  "ownerName": "...",
  "flatNumber": "...",
  "societyName": "...",
  "documentType": "maintenance_invoice | payment_receipt",
  "confidence": "high | medium | low"
}
```

#### For Lease Agreements (lines 5572-5607):
```
EXTRACT THESE DETAILS:
1. Property address (PSOTS + flat number)
2. Tenant name
3. Owner/Landlord name
4. Lease duration (start/end dates)
5. Rent amount

Return JSON:
{
  "tenantName": "...",
  "ownerName": "...",
  "flatNumber": "...",
  "societyName": "...",
  "leaseStartDate": "DD/MM/YYYY",
  "leaseEndDate": "DD/MM/YYYY",
  "rentAmount": "...",
  "documentType": "lease_agreement",
  "confidence": "high | medium | low"
}
```

### Validation Logic (lines 5683-5730)

**Checks performed:**
1. ✅ **Society match:** Contains "prestige song"
2. ✅ **Flat number match:** Extracted number === input number
3. ✅ **Owner name fuzzy match:** Word-based matching

**Verification Results:**
- **`verified`** - All checks pass + high confidence
- **`manual_review`** - Partial match or medium confidence  
  → Stored in KV `_verify_pending_{residentId}` for 48 hours
- **`invalid_document`** - Failed extraction or low confidence

### Admin Review Panel
**File:** `society/admin.html`

**Tab:** "Verify Docs" (lines 1302-1307)
- Lists all pending verifications from KV
- Shows extracted data vs expected data
- Admin can view document, approve, or reject

**Functions:**
- `loadVerifyDocs()` - Line 3874
- `viewDocument(residentId)` - Line 3921
- `approveVerification(residentId)` - Line 3943
- `rejectVerification(residentId)` - Line 3966

**Admin Endpoints:**
- `GET /admin/pending-verifications` - Line 6247
- `GET /admin/verify-document` - Line 6291
- `POST /admin/approve-verification` - Line 6333
- `POST /admin/reject-verification` - Line 6386

---

## ⚠️ CRITICAL ISSUE: Gemini Extraction Untested

### The Problem
You mentioned: **"last gemini was not reading the docs properly"**

This suggests the Gemini Vision API is:
1. ❌ **Not extracting data correctly** from maintenance invoices
2. ❌ **Returning incorrect JSON format**
3. ❌ **Missing key fields** like owner name or flat number
4. ❌ **Low confidence** on documents that should be high confidence

### Why This Blocks Launch
- Users uploading valid documents will be **sent to manual review**
- Admin queue will be **flooded** with false manual reviews
- **Poor user experience** - instant approval won't work
- **Admin burden** - reviewing every single document manually

---

## 🧪 Testing Plan

### Test Documents Needed
Create test PDFs with known data:

1. **✅ Perfect Case** - Clear MyGate maintenance invoice
   - Society: "Prestige Song of the South"
   - Flat: "15167"  
   - Owner: "Pushkal Kishore"
   - Should return: `verified`

2. **⚠️ Partial Match** - Invoice with slightly different name
   - Society: "Prestige Song of the South"
   - Flat: "15167"
   - Owner: "P Kishore" (partial name)
   - Should return: `manual_review`

3. **❌ Invalid** - Wrong society document
   - Society: "Different Society"
   - Should return: `invalid_document`

4. **Lease Agreement** (for tenants)
   - Property: "PSOTS Flat 15167"
   - Tenant: "John Doe"
   - Landlord: "Pushkal Kishore"
   - Start Date: "01/01/2026"
   - End Date: "31/12/2026"
   - Should return: `verified`

### Testing Steps

1. **Create Test Documents**
   - Use existing test documents in `/test-data/` folder
   - Or create new PDFs with clear text

2. **Test via Registration Flow**
   ```
   1. Go to https://society.psots.in/register.html
   2. Complete Step 1 (flat selection)
   3. Complete Step 2 (select "Owner")
   4. Upload test document
   5. Watch console for Gemini response
   6. Verify result matches expectation
   ```

3. **Test via Direct API Call**
   ```bash
   # Convert PDF to base64
   base64 test_document.pdf > doc.b64
   
   # Test endpoint
   curl -X POST https://telegram.psots.in/resident/verify-document \
     -H "Content-Type: application/json" \
     -d '{
       "base64Document": "..." (paste from doc.b64),
       "mimeType": "application/pdf",
       "residentName": "Pushkal Kishore",
       "flatNumber": "15167",
       "residentType": "owner"
     }'
   ```

4. **Check Console Logs**
   ```
   wrangler tail --format=pretty
   ```
   Look for: `/resident/verify-document: r_xxx -> verified` logs

5. **Verify Admin Panel**
   - If result = `manual_review`, check admin panel
   - "Verify Docs" tab should show pending verification
   - View document, check extracted data

---

## 🐛 Common Gemini Issues & Fixes

### Issue 1: Gemini returns markdown instead of JSON
**Symptom:** Response like ` ```json\n{...}\n``` `
**Fix:** Prompt says "no markdown, no backticks" but Gemini might ignore
**Solution:** Strip markdown in code (lines 5676-5680)
```javascript
const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
// Add: responseText.replace(/```json|```/g, '').trim()
extracted = JSON.parse(responseText);
```

### Issue 2: Gemini confidence always "low"
**Symptom:** All documents return `confidence: "low"`
**Fix:** Prompt might be unclear about confidence criteria
**Solution:** Update prompt with explicit confidence rules

### Issue 3: Flat number extraction includes "Tower 15-"
**Symptom:** `flatNumber: "Tower 15-15167"` instead of `"15167"`
**Fix:** Prompt says extract ONLY final number
**Solution:** Add post-processing to strip "Tower" prefix

### Issue 4: Name matching too strict
**Symptom:** "Pushkal Kishore" vs "Mr Pushkal Kishore" = mismatch
**Fix:** `fuzzyNameMatch()` should handle titles
**Solution:** Strip titles (Mr, Mrs, Dr) before comparison

---

## 📝 Recommendations

### Before Pilot Launch

1. ✅ **Test with 5 real documents**
   - 3 maintenance invoices (yours + volunteers)
   - 2 lease agreements (if you have tenants)

2. ✅ **Verify Gemini API working**
   - Check Gemini API key in Worker env
   - Verify quota/billing status
   - Test with curl first (bypass UI)

3. ✅ **Add debug logging**
   - Log full Gemini response (temporarily)
   - Log extracted vs expected values
   - Log confidence scores

4. ✅ **Fallback to manual review**
   - If Gemini fails, ALWAYS return `manual_review`
   - Never block user with `invalid_document`
   - Admin can fix extraction errors

### After Testing

- Update prompts based on results
- Adjust confidence thresholds
- Add more document types if needed
- Consider OCR pre-processing for scanned docs

---

**Next Steps:**
1. Test with YOUR OWN maintenance invoice first
2. Check console logs for Gemini response
3. Report back results - I'll help fix extraction issues
4. Only after Gemini works → launch pilot

**Status:** ⚠️ **BLOCKED - NEEDS GEMINI TESTING BEFORE LAUNCH**
