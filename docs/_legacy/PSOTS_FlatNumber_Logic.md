# PSOTS Flat Number Logic Reference
**Source: js/config/constants.js + js/services/flat.service.js**
**Last updated: April 14, 2026 — floor padding rule added**

---

## Flat Number Format

```
flatNumber = {tower}{floor_padded}{unit}
```

- **Tower:** no padding — raw integer (1–17)
- **Floor:** always **2 digits** — pad with leading zero if floor < 10
- **Unit:** 1 digit for towers with maxUnit ≤ 8; 2 digits for towers 12 and 14 (maxUnit = 12)
- **Minimum length: 4 digits** — no flat number can be 3 digits or fewer

**Correct examples:**
| Tower | Floor | Unit | flatNumber | Notes |
|-------|-------|------|------------|-------|
| 1  | 17 | 8  | `1178`   | floor 17 no padding, unit 1-digit |
| 1  | 1  | 1  | `1011`   | floor 01 padded, minimum 4 digits |
| 8  | 5  | 3  | `8053`   | floor 05 padded |
| 9  | 29 | 8  | `9298`   | floor 29 no padding |
| 10 | 1  | 1  | `10011`  | Tower 10, floor 01 padded |
| 11 | 17 | 8  | `11178`  | Tower 11, floor 17 |
| 12 | 10 | 11 | `121011` | Tower 12, floor 10, unit 11 (no padding on unit) |
| 15 | 16 | 7  | `15167`  | floor 16 no padding |

**Old (incorrect) examples — do not use:**
- Tower 8, Floor 5, Unit 3 = ~~`853`~~ → correct is `8053`
- Tower 1, Floor 17, Unit 8 = ~~`11718`~~ → correct is `1178` (Tower 11 would be `11178`)

---

## Tower Configuration

| Tower | Max Floor | Max Unit | Notes |
|-------|-----------|----------|-------|
| 1  | 17 | 8  | |
| 2  | 17 | 8  | |
| 3  | 17 | 8  | |
| 4  | 20 | 8  | |
| 5  | 20 | 4  | Fewer units per floor |
| 8  | 29 | 8  | Tallest towers |
| 9  | 29 | 8  | Tallest towers |
| 10 | 17 | 8  | |
| 11 | 17 | 8  | |
| 12 | 17 | 12 | More units per floor |
| 14 | 17 | 12 | More units per floor |
| 15 | 17 | 8  | |
| 16 | 17 | 8  | |
| 17 | 17 | 8  | |

**Missing towers:** 6, 7, 13 — do not exist in PSOTS
**VALID_TOWERS:** [1,2,3,4,5,8,9,10,11,12,14,15,16,17]
**SKIPPED_FLOORS:** [13] — floor 13 does not exist in any tower

---

## Validation Rules

```javascript
validate(tower, floor, unit) {
  // Rule 1: Tower must be in VALID_TOWERS
  if (!VALID_TOWERS.includes(tower))
    → error: "Tower X does not exist in PSOTS."

  // Rule 2: Floor 13 is skipped in all towers
  if (SKIPPED_FLOORS.includes(floor))
    → error: "Floor 13 does not exist in any PSOTS tower."

  // Rule 3: Floor must be within tower's range
  if (floor < 1 || floor > TOWERS[tower].maxFloor)
    → error: "Tower X has floors 1–Y (skipping floor 13)."

  // Rule 4: Unit must be within tower's range
  if (unit < 1 || unit > TOWERS[tower].maxUnit)
    → error: "Tower X has units 1–Y per floor."

  // Rule 5: Result must be at least 4 digits
  const flatNumber = buildFlatNumber(tower, floor, unit);
  if (flatNumber.length < 4)
    → error: "Invalid flat number — must be at least 4 digits."

  return flatNumber;
}
```

---

## Build Flat Number

```javascript
buildFlatNumber(tower, floor, unit) {
  const t = parseInt(tower);
  const f = String(parseInt(floor)).padStart(2, '0');  // Floor always 2 digits
  const u = String(parseInt(unit));                     // Unit NEVER padded — raw integer
  return `${t}${f}${u}`;
}
```

---

## Parse Flat Number (reverse lookup)

```javascript
parseFlatNumber(flatNumber) {
  // Try each valid tower prefix, longest first
  // to avoid Tower 1 matching Tower 10/11/12/14/15/16/17
  for tower in VALID_TOWERS sorted descending:
    if flatNumber.startsWith(String(tower)):
      remainder = flatNumber after tower prefix
      // Floor is always exactly 2 digits
      floorStr = remainder.slice(0, 2)
      floor = parseInt(floorStr)
      // Unit is remaining digits
      unitStr = remainder.slice(2)
      unit = parseInt(unitStr)
      return { tower, floor, unit }
}
```

**Floor is always 2 digits** — slice positions are fixed after stripping the tower prefix.

**Unit is never padded — raw integer always:**
- Tower 12, Floor 1, Unit 1 = `12011` (unit = `1`, not `01`)
- Tower 12, Floor 1, Unit 12 = `120112` (unit = `12`, naturally 2 digits)
- Tower 14, Floor 1, Unit 1 = `14011`
- All other towers: unit 1–8, always 1 digit

**Parse examples:**
```
"15167"  → prefix "15", remainder "167"  → floor="16", unit="7"   → T15 F16 U7
"8053"   → prefix "8",  remainder "053"  → floor="05"→5, unit="3" → T8  F5  U3
"121011" → prefix "12", remainder "1011" → floor="10", unit="11"  → T12 F10 U11
"1011"   → prefix "1",  remainder "011"  → floor="01"→1, unit="1" → T1  F1  U1
"1178"   → prefix "1",  remainder "178"  → floor="17", unit="8"   → T1  F17 U8
"11178"  → prefix "11", remainder "178"  → floor="17", unit="8"   → T11 F17 U8
"10011"  → prefix "10", remainder "011"  → floor="01"→1, unit="1" → T10 F1  U1
```

**Why no collision between Tower 1 and Tower 11:**
- Tower 1, Floor 17, Unit 8 = `1178` (5 chars after tower = `178`, floor=`17`, unit=`8`)
- Tower 11, Floor 1, Unit 1 = `11011` — starts with `11`, parser matches Tower 11 first ✅
- Parser tries longest tower prefix first — Tower 11 (`11`) is matched before Tower 1 (`1`) for any string starting with `11`

---

## Flat Number Range Examples (updated)

| Tower | Floor Range | Units/Floor | First Flat | Last Flat | Notes |
|-------|------------|-------------|------------|-----------|-------|
| 1  | 1-17 (skip 13) | 1-8  | `1011` | `1178`   | |
| 2  | 1-17 (skip 13) | 1-8  | `2011` | `2178`   | |
| 3  | 1-17 (skip 13) | 1-8  | `3011` | `3178`   | |
| 4  | 1-20 (skip 13) | 1-8  | `4011` | `4208`   | |
| 5  | 1-20 (skip 13) | 1-4  | `5011` | `5204`   | 4 units only |
| 8  | 1-29 (skip 13) | 1-8  | `8011` | `8298`   | |
| 9  | 1-29 (skip 13) | 1-8  | `9011` | `9298`   | |
| 10 | 1-17 (skip 13) | 1-8  | `10011` | `10178` | |
| 11 | 1-17 (skip 13) | 1-8  | `11011` | `11178` | |
| 12 | 1-17 (skip 13) | 1-12 | `12011` | `121712` | 12 units, unit NOT padded |
| 14 | 1-17 (skip 13) | 1-12 | `14011` | `141712` | 12 units, unit NOT padded |
| 15 | 1-17 (skip 13) | 1-8  | `15011` | `15178` | |
| 16 | 1-17 (skip 13) | 1-8  | `16011` | `16178` | |
| 17 | 1-17 (skip 13) | 1-8  | `17011` | `17178` | |

---

## Total Flat Count Estimate

```
Towers 1,2,3,10,11,15,16,17: 8 towers × 16 floors × 8 units = 1,024
Tower 4:                       1 tower  × 19 floors × 8 units = 152
Tower 5:                       1 tower  × 19 floors × 4 units = 76
Towers 8,9:                    2 towers × 28 floors × 8 units = 448
Towers 12,14:                  2 towers × 16 floors × 12 units = 384
─────────────────────────────────────────────────────────────────
Total ≈ 2,084 flats  (matches "2,100+ flats" claim)
```

---

## Source Files

| File | Purpose |
|------|---------|
| `js/config/constants.js` lines 15-35 | Tower config, VALID_TOWERS, SKIPPED_FLOORS |
| `js/services/flat.service.js` | validate(), buildFlatNumber(), parseFlatNumber() |
| `js/components/resident/FlatSelector.js` | UI component using flat.service.js |

---

## Important Note for Claude Code

The flat number format changed on April 14, 2026:
- **Old format:** `{tower}{floor}{unit}` — no floor padding → produced 3-digit numbers like `853`
- **New format:** `{tower}{floor_padded}{unit}` — floor always 2 digits → minimum 4 digits, e.g. `8053`

**When updating flat.service.js:**
1. Update `buildFlatNumber()` — add `padStart(2, '0')` to floor
2. Update `parseFlatNumber()` — floor is always 2-digit slice (positions 0–1 of remainder)
3. Update `validate()` — add minimum 4-digit length check
4. Existing Firestore test data with old format can be ignored (confirmed by admin)

The flat number is:
- Firestore document ID in `flats/{flatNumber}`
- Stored in `identities/{uid}.flatNumber`
- Referenced throughout admin panel, profile, status views

To display to a user, use `parseFlatNumber()` → show "Tower 8 · Floor 5 · Unit 3"
Never change the stored numeric format itself.
