import { describe, it, expect } from 'vitest';
import { sanitizeForAdmin, sanitizeForResident, sanitizeForPublic, maskEmail, maskPhone, maskName } from '../../src/db/pii.js';

const testResident = {
  uid: 'uid-alpha',
  flatNumber: '1204',
  name: 'Test User',
  email: 'test.user@gmail.com',
  phone: '+919812345678',
  status: 'approved',
  loginMethod: 'google',
};

// Regexes that identify raw PII
const RAW_EMAIL = /[a-zA-Z0-9._-]+@(gmail|yahoo|outlook|hotmail)\.com/;
const RAW_PHONE = /\+?91\d{10}|\b\d{10}\b/;
const MASKED_PHONE_PATTERN = /\+91 \d{2}XXX X\d{4}/;

function jsonOf(obj) {
  return JSON.stringify(obj);
}

describe('PII leak — sanitizeForAdmin', () => {
  it('masks email', () => {
    const result = sanitizeForAdmin(testResident);
    expect(jsonOf(result)).not.toMatch(RAW_EMAIL);
    expect(result.email).toBe('t***@gmail.com');
  });

  it('masks phone to XXX format', () => {
    const result = sanitizeForAdmin(testResident);
    const s = jsonOf(result);
    expect(s).not.toMatch(/\+?91\d{10}/);
    expect(s).toMatch(MASKED_PHONE_PATTERN);
  });

  it('preserves full name for admin verification (Option C)', () => {
    const result = sanitizeForAdmin(testResident);
    expect(result.displayName).toBe('Test User');
  });

  it('preserves uid and flatNumber for admin actions', () => {
    const result = sanitizeForAdmin(testResident);
    expect(result.uid).toBe('uid-alpha');
    expect(result.flatNumber).toBe('1204');
  });
});

describe('PII leak — sanitizeForResident', () => {
  it('returns full data when requesting own record', () => {
    const result = sanitizeForResident(testResident, 'uid-alpha');
    expect(result.email).toBe('test.user@gmail.com');
    expect(result.phone).toBe('+919812345678');
  });

  it('masks when requesting someone else\'s record', () => {
    const result = sanitizeForResident(testResident, 'uid-beta');
    expect(jsonOf(result)).not.toMatch(RAW_EMAIL);
  });

  it('sanitizeForResident still masks names (Option C: unmask applies only to admin)', () => {
    const result = sanitizeForResident(testResident, 'uid-beta');
    expect(result.displayName).toBe('Test U.');
    expect(result.displayName).not.toBe('Test User');
  });
});

describe('PII leak — sanitizeForPublic', () => {
  it('exposes only flatNumber and masked displayName', () => {
    const result = sanitizeForPublic(testResident);
    expect(result.flatNumber).toBe('1204');
    expect(result.displayName).toBe('Test U.');
    expect(result.email).toBeUndefined();
    expect(result.phone).toBeUndefined();
    expect(result.uid).toBeUndefined();
  });
});

describe('PII leak — response-wide scans', () => {
  // Simulate what admin endpoint returns
  it('admin list response has no raw PII', () => {
    const listData = [testResident, { ...testResident, uid: 'uid-gamma', flatNumber: '1205' }];
    const masked = listData.map(sanitizeForAdmin);
    const serialized = jsonOf(masked);
    expect(serialized).not.toMatch(RAW_EMAIL);
    expect(serialized).not.toMatch(/\+?91\d{10}/);
    // Must still have uid and flatNumber for admin to act
    expect(serialized).toContain('uid-alpha');
    expect(serialized).toContain('1204');
  });

  // Simulate public vendor directory
  it('public vendor response has no raw PII', () => {
    const vendorList = [
      { uid: 'v1', flatNumber: '1301', name: 'Ramesh Kumar', email: 'ramesh@gmail.com', phone: '+919812345678' },
      { uid: 'v2', flatNumber: '1402', name: 'Priya Singh', email: 'priya@yahoo.com', phone: '+919876543210' }
    ];
    const masked = vendorList.map(sanitizeForPublic);
    const serialized = jsonOf(masked);
    expect(serialized).not.toMatch(RAW_EMAIL);
    expect(serialized).not.toMatch(/\+?91\d{10}/);
    expect(serialized).not.toContain('Ramesh Kumar');  // full name leaked
    expect(serialized).toContain('Ramesh K.');          // masked
  });
});
