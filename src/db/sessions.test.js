import { describe, it, expect, beforeEach } from 'vitest';
import { createSession, getSession, deleteSession, touchSession } from './sessions.js';

class MockKV {
  constructor() {
    this.store = new Map();
  }

  async put(key, value) {
    this.store.set(key, value);
  }

  async get(key) {
    return this.store.get(key) || null;
  }

  async delete(key) {
    this.store.delete(key);
  }
}

describe('sessions.js', () => {
  let mockEnv;

  beforeEach(() => {
    mockEnv = { SESSIONS_KV: new MockKV() };
  });

  it('createSession returns sessionId', async () => {
    const result = await createSession(mockEnv, 'uid123', { flatNumber: 15167, role: 'resident' });
    expect(result.ok).toBe(true);
    expect(result.sessionId).toBeDefined();
    expect(result.error).toBeNull();
  });

  it('getSession retrieves created session', async () => {
    const created = await createSession(mockEnv, 'uid123', { flatNumber: 15167, role: 'resident' });
    const retrieved = await getSession(mockEnv, created.sessionId);
    expect(retrieved.data).toBeDefined();
    expect(retrieved.data.uid).toBe('uid123');
    expect(retrieved.data.flatNumber).toBe(15167);
  });

  it('deleteSession removes session', async () => {
    const created = await createSession(mockEnv, 'uid123', { flatNumber: 15167, role: 'resident' });
    await deleteSession(mockEnv, created.sessionId);
    const retrieved = await getSession(mockEnv, created.sessionId);
    expect(retrieved.data).toBeNull();
  });

  it('getSession returns null for missing session', async () => {
    const result = await getSession(mockEnv, 'nonexistent');
    expect(result.data).toBeNull();
  });

  it('touchSession updates lastSeen', async () => {
    const created = await createSession(mockEnv, 'uid123', { flatNumber: 15167, role: 'resident' });
    const createdData = await getSession(mockEnv, created.sessionId);
    await touchSession(mockEnv, created.sessionId);
    const touchedData = await getSession(mockEnv, created.sessionId);
    expect(touchedData.data.lastSeen).toBeGreaterThanOrEqual(createdData.data.lastSeen);
  });

  it('touchSession returns false for missing session', async () => {
    const result = await touchSession(mockEnv, 'nonexistent');
    expect(result.ok).toBe(false);
  });
});
