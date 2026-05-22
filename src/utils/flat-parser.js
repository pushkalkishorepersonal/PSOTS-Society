/**
 * src/utils/flat-parser.js — Canonical flat number parsing
 * Reference: docs/_legacy/PSOTS_FlatNumber_Logic.md
 *
 * This module is the single source of truth for parsing PSOTS flat
 * numbers into tower/floor/unit components. New code uses this.
 * Legacy code in src/index.js (line 38) has an inline copy that
 * remains untouched in Sprint 1a for backward compat.
 */

export const VALID_TOWERS = [1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 14, 15, 16, 17];
export const SKIPPED_FLOORS = [13];

export const TOWER_CONFIG = {
  1: { maxFloor: 17, maxUnit: 8 },
  2: { maxFloor: 17, maxUnit: 8 },
  3: { maxFloor: 17, maxUnit: 8 },
  4: { maxFloor: 20, maxUnit: 8 },
  5: { maxFloor: 20, maxUnit: 4 },
  8: { maxFloor: 29, maxUnit: 8 },
  9: { maxFloor: 29, maxUnit: 8 },
  10: { maxFloor: 17, maxUnit: 8 },
  11: { maxFloor: 17, maxUnit: 8 },
  12: { maxFloor: 17, maxUnit: 12 },
  14: { maxFloor: 17, maxUnit: 12 },
  15: { maxFloor: 17, maxUnit: 8 },
  16: { maxFloor: 17, maxUnit: 8 },
  17: { maxFloor: 17, maxUnit: 8 },
};

/**
 * Parse a flat number string into tower, floor, unit components.
 * Uses longest-prefix matching to handle 2-digit towers (11, 12, 14-17).
 *
 * @param {string|number} flatNumber - e.g. "15167", "8053", "121011"
 * @returns {{tower: number, floor: number, unit: number} | null}
 */
export function parseFlatNumber(flatNumber) {
  const flatStr = String(flatNumber).trim();
  if (!flatStr || flatStr.length < 4) return null;

  const sortedTowers = [...VALID_TOWERS].sort(
    (a, b) => String(b).length - String(a).length
  );

  for (const tower of sortedTowers) {
    const towerStr = String(tower);
    if (flatStr.startsWith(towerStr)) {
      const remainder = flatStr.slice(towerStr.length);
      if (remainder.length < 3) continue;

      const floorStr = remainder.slice(0, 2);
      const unitStr = remainder.slice(2);

      const floor = parseInt(floorStr, 10);
      const unit = parseInt(unitStr, 10);

      if (isNaN(floor) || isNaN(unit)) continue;

      return { tower, floor, unit };
    }
  }
  return null;
}

/**
 * Validate a flat number against tower config + format rules.
 *
 * @param {string|number} flatNumber
 * @returns {{valid: boolean, error?: string, parsed?: {tower, floor, unit}}}
 */
export function validateFlatNumber(flatNumber) {
  const flatStr = String(flatNumber).trim();
  if (!flatStr) {
    return { valid: false, error: 'Flat number is required.' };
  }
  if (flatStr.length < 4) {
    return { valid: false, error: 'Flat number must be at least 4 digits.' };
  }

  const parsed = parseFlatNumber(flatStr);
  if (!parsed) {
    return { valid: false, error: `Flat number format is invalid. Example: 15167 (Tower 15, Floor 16, Unit 7).` };
  }

  const { tower, floor, unit } = parsed;

  if (!VALID_TOWERS.includes(tower)) {
    return { valid: false, error: `Tower ${tower} does not exist in PSOTS.` };
  }

  if (SKIPPED_FLOORS.includes(floor)) {
    return { valid: false, error: `Floor 13 does not exist in any PSOTS tower.` };
  }

  const config = TOWER_CONFIG[tower];
  if (floor < 1 || floor > config.maxFloor) {
    return { valid: false, error: `Tower ${tower} has floors 1–${config.maxFloor} (skipping floor 13).` };
  }

  if (unit < 1 || unit > config.maxUnit) {
    return { valid: false, error: `Tower ${tower} has units 1–${config.maxUnit} per floor.` };
  }

  return { valid: true, parsed };
}

/**
 * Build a flat number from tower, floor, unit components (inverse of parse).
 * Used primarily for testing and validation, not typically in main code.
 *
 * @param {number} tower
 * @param {number} floor
 * @param {number} unit
 * @returns {string} e.g. "15167"
 */
export function buildFlatNumber(tower, floor, unit) {
  const t = String(parseInt(tower, 10));
  const f = String(parseInt(floor, 10)).padStart(2, '0');
  const u = String(parseInt(unit, 10));
  return `${t}${f}${u}`;
}
