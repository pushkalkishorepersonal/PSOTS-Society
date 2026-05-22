import * as db from '../db/adapter.js';

export async function requireSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/psots_session=([^;]+)/);
  if (!match) return { error: 'NO_SESSION', status: 401 };
  const { data, error } = await db.getSession(env, match[1]);
  if (error || !data) return { error: 'INVALID_SESSION', status: 401 };
  await db.touchSession(env, match[1]);
  return { user: data };
}

export async function requireAdmin(request, env) {
  const session = await requireSession(request, env);
  if (session.error) return session;
  if (session.user.role !== 'admin') return { error: 'FORBIDDEN', status: 403 };
  return session;
}
