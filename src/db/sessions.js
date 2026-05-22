const TTL = 60 * 60 * 24 * 30; // 30 days

export async function createSession(env, uid, metadata) {
  try {
    const sessionId = crypto.randomUUID() + '-' + Date.now().toString(36);
    const value = JSON.stringify({ uid, ...metadata, createdAt: Date.now(), lastSeen: Date.now() });
    await env.SESSIONS_KV.put(`session:${sessionId}`, value, { expirationTtl: TTL });
    return { ok: true, sessionId, error: null };
  } catch (e) {
    return { ok: false, sessionId: null, error: e.message };
  }
}

export async function getSession(env, sessionId) {
  try {
    const raw = await env.SESSIONS_KV.get(`session:${sessionId}`);
    if (!raw) return { data: null, error: null };
    return { data: JSON.parse(raw), error: null };
  } catch (e) {
    return { data: null, error: e.message };
  }
}

export async function touchSession(env, sessionId) {
  try {
    const { data } = await getSession(env, sessionId);
    if (!data) return { ok: false };
    data.lastSeen = Date.now();
    await env.SESSIONS_KV.put(`session:${sessionId}`, JSON.stringify(data), { expirationTtl: TTL });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function deleteSession(env, sessionId) {
  try {
    await env.SESSIONS_KV.delete(`session:${sessionId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
