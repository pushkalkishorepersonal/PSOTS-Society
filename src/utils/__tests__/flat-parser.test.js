import { describe, it, expect } from 'vitest';
import {
  parseFlatNumber,
  validateFlatNumber,
  buildFlatNumber,
  VALID_TOWERS,
  SKIPPED_FLOORS,
  TOWER_CONFIG,
} from '../flat-parser.js';

describe('parseFlatNumber', () => {
  it('parses valid flat numbers correctly', () => {
    expect(parseFlatNumber('15167')).toEqual({ tower: 15, floor: 16, unit: 7 });
    expect(parseFlatNumber('8053')).toEqual({ tower: 8, floor: 5, unit: 3 });
    expect(parseFlatNumber('121011')).toEqual({ tower: 12, floor: 10, unit: 11 });
    expect(parseFlatNumber('1011')).toEqual({ tower: 1, floor: 1, unit: 1 });
    expect(parseFlatNumber('1178')).toEqual({ tower: 1, floor: 17, unit: 8 });
    expect(parseFlatNumber('11178')).toEqual({ tower: 11, floor: 17, unit: 8 });
    expect(parseFlatNumber('10011')).toEqual({ tower: 10, floor: 1, unit: 1 });
  });

  it('returns null for invalid inputs', () => {
    expect(parseFlatNumber('853')).toBeNull(); // too short
    expect(parseFlatNumber('')).toBeNull();
    expect(parseFlatNumber(null)).toBeNull();
    expect(parseFlatNumber('abc')).toBeNull();
  });

  it('handles numeric input', () => {
    expect(parseFlatNumber(15167)).toEqual({ tower: 15, floor: 16, unit: 7 });
  });

  it('prioritizes longer tower prefixes', () => {
    // "11178" should parse as Tower 11, not Tower 1
    const result = parseFlatNumber('11178');
    expect(result.tower).toBe(11);
    expect(result.floor).toBe(17);
    expect(result.unit).toBe(8);
  });
});

describe('validateFlatNumber', () => {
  it('validates correct flat numbers', () => {
    const result = validateFlatNumber('15167');
    expect(result.valid).toBe(true);
    expect(result.parsed).toEqual({ tower: 15, floor: 16, unit: 7 });
  });

  it('rejects non-existent towers', () => {
    const result = validateFlatNumber('6123');
    expect(result.valid).toBe(false);
    // Tower 6 doesn't exist, so no valid tower matches at start of string
    // This results in format error, not tower error
    expect(result.error).toBeDefined();
  });

  it('rejects floor 13', () => {
    const result = validateFlatNumber('15134');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Floor 13');
  });

  it('rejects out-of-range floors', () => {
    const result = validateFlatNumber('15201');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('floors');
  });

  it('rejects out-of-range units', () => {
    const result = validateFlatNumber('5205');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('units');
  });

  it('rejects empty input', () => {
    const result = validateFlatNumber('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('required');
  });

  it('rejects too-short input', () => {
    const result = validateFlatNumber('853');
    expect(result.valid).toBe(false);
  });

  it('validates tower 5 with max 4 units', () => {
    const valid = validateFlatNumber('5204');
    expect(valid.valid).toBe(true);
    const invalid = validateFlatNumber('5205');
    expect(invalid.valid).toBe(false);
  });

  it('validates tower 12 with max 12 units', () => {
    const valid = validateFlatNumber('121012');
    expect(valid.valid).toBe(true);
    const invalid = validateFlatNumber('121013');
    expect(invalid.valid).toBe(false);
  });
});

describe('buildFlatNumber', () => {
  it('builds correct flat numbers', () => {
    expect(buildFlatNumber(15, 16, 7)).toBe('15167');
    expect(buildFlatNumber(8, 5, 3)).toBe('8053');
    expect(buildFlatNumber(1, 1, 1)).toBe('1011');
    expect(buildFlatNumber(12, 10, 11)).toBe('121011');
  });

  it('pads floor with leading zero', () => {
    expect(buildFlatNumber(1, 1, 1)).toBe('1011'); // floor 1 → "01"
    expect(buildFlatNumber(1, 9, 8)).toBe('1098'); // floor 9 → "09"
  });

  it('does not pad unit', () => {
    expect(buildFlatNumber(1, 1, 1)).toBe('1011'); // unit 1 → "1"
    expect(buildFlatNumber(12, 10, 11)).toBe('121011'); // unit 11 → "11"
  });
});

describe('round-trip conversion', () => {
  it('parse after build returns same values', () => {
    const tower = 15, floor = 16, unit = 7;
    const built = buildFlatNumber(tower, floor, unit);
    const parsed = parseFlatNumber(built);
    expect(parsed).toEqual({ tower, floor, unit });
  });
});

describe('constants', () => {
  it('has correct VALID_TOWERS', () => {
    expect(VALID_TOWERS).toContain(1);
    expect(VALID_TOWERS).toContain(12);
    expect(VALID_TOWERS).not.toContain(6);
    expect(VALID_TOWERS).not.toContain(7);
    expect(VALID_TOWERS).not.toContain(13);
  });

  it('has SKIPPED_FLOORS = [13]', () => {
    expect(SKIPPED_FLOORS).toEqual([13]);
  });

  it('TOWER_CONFIG has correct max values', () => {
    expect(TOWER_CONFIG[1].maxFloor).toBe(17);
    expect(TOWER_CONFIG[1].maxUnit).toBe(8);
    expect(TOWER_CONFIG[5].maxUnit).toBe(4);
    expect(TOWER_CONFIG[12].maxUnit).toBe(12);
  });
});
