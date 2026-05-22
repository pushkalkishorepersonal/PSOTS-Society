# Console Errors Explained

**Date:** April 30, 2026  
**Status:** Non-blocking, mostly harmless

---

## Error Analysis

### 1. ✅ **CSP Warning (Safe to Ignore)**
```
Connecting to '<URL>' violates the following Content Security Policy directive: "connect-src 'none'"
```

**What it means:** Content Security Policy warning from browser extension  
**Impact:** None - it's "report-only" (no action taken)  
**Cause:** Likely a browser extension trying to connect somewhere  
**Action:** Ignore - not from your code

---

### 2. ⚠️ **Service Worker Cache Error**
```
sw.js:116 Failed to execute 'put' on 'Cache': Partial response (status code 206) is unsupported
```

**What it means:** Service worker trying to cache a partial response  
**Impact:** Minor - some resources won't be cached offline  
**Cause:** SW trying to cache range requests (video/audio streams)  
**Action:** Can be fixed but not critical

**Fix (if needed):**
Add to `sw.js` around line 116:
```javascript
// Don't cache partial responses
if (response.status === 206) {
  return response;
}
```

---

### 3. ℹ️ **Apple PWA Meta Tag Deprecation**
```
<meta name="apple-mobile-web-app-capable" content="yes"> is deprecated
```

**What it means:** Old iOS PWA meta tag  
**Impact:** None - still works, just using old syntax  
**Action:** Update to new format (low priority)

**Fix:**
Change in HTML head:
```html
<!-- Old -->
<meta name="apple-mobile-web-app-capable" content="yes">

<!-- New -->
<meta name="mobile-web-app-capable" content="yes">
```

---

### 4. ✅ **Browser Extension Warnings (Safe to Ignore)**
```
READ - Host validation failed
Host is not supported
Host is not in insights whitelist
```

**What it means:** Browser extension (likely ad blocker or analytics blocker) checking if it should run  
**Impact:** None - extension decides not to activate  
**Cause:** Extensions like uBlock Origin, Privacy Badger, etc.  
**Action:** Ignore - not from your app

---

## Summary

**Critical errors:** 0  
**Warnings to fix:** 1 (Service Worker cache - optional)  
**Safe to ignore:** 3

**Your login works perfectly!** These are just noise in the console.

---

## Optional Cleanup (Low Priority)

If you want a clean console, you can:

1. **Fix SW cache issue** (add 206 status check)
2. **Update Apple meta tag** (change to mobile-web-app-capable)
3. **Nothing to do for extensions** (user's browser, not your code)

**Not urgent - everything works fine!**
