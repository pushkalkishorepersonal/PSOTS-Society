import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('math works', () => {
    expect(1 + 1).toBe(2);
  });

  it('string concat works', () => {
    expect('a' + 'b').toBe('ab');
  });

  it('arrays work', () => {
    expect([1, 2, 3].length).toBe(3);
  });

  it('objects work', () => {
    expect({ a: 1 }.a).toBe(1);
  });

  it('async works', async () => {
    expect(await Promise.resolve(5)).toBe(5);
  });
});
