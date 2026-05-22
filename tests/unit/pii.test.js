import { describe, it, expect } from 'vitest';
import {
  maskEmail,
  maskPhone,
  maskName,
  sanitizeForAdmin,
  sanitizeForResident,
  sanitizeForPublic,
} from '../../src/db/pii.js';

describe('maskEmail', () => {
  it('masks gmail', () => expect(maskEmail('pushkal@gmail.com')).toBe('p***@gmail.com'));
  it('handles empty', () => expect(maskEmail('')).toBe(''));
  it('handles malformed', () => expect(maskEmail('notanemail')).toBe(''));
  it('handles null', () => expect(maskEmail(null)).toBe(''));
});

describe('maskPhone', () => {
  it('masks indian', () => expect(maskPhone('+919480948904')).toBe('+91 94XXX X8904'));
  it('masks 10-digit', () => expect(maskPhone('9480948904')).toBe('+91 94XXX X8904'));
  it('handles too-short', () => expect(maskPhone('123')).toBe(''));
  it('handles empty', () => expect(maskPhone('')).toBe(''));
});

describe('maskName', () => {
  it('masks two-part', () => expect(maskName('Pushkal Kishore')).toBe('Pushkal K.'));
  it('masks three-part', () => expect(maskName('Pushkal Kishore Raj')).toBe('Pushkal R.'));
  it('keeps single', () => expect(maskName('Pushkal')).toBe('Pushkal'));
  it('handles empty', () => expect(maskName('')).toBe(''));
});

describe('sanitizeForResident', () => {
  const me = { uid: 'u1', name: 'Test User', email: 'test@x.com', flatNumber: '101' };
  it('returns full for own uid', () => {
    expect(sanitizeForResident(me, 'u1').email).toBe('test@x.com');
  });
  it('masks for others', () => {
    expect(sanitizeForResident(me, 'u2').email).toBe('t***@x.com');
  });
});

describe('sanitizeForPublic', () => {
  it('only exposes flat + masked name', () => {
    const result = sanitizeForPublic({
      uid: 'u1',
      name: 'Test User',
      email: 'test@x.com',
      phone: '9999999999',
      flatNumber: '101',
    });
    expect(result).toEqual({ flatNumber: '101', displayName: 'Test U.' });
    expect(result.email).toBeUndefined();
    expect(result.phone).toBeUndefined();
  });
});
