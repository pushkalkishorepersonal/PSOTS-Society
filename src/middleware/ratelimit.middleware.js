/**
 * src/middleware/ratelimit.middleware.js — Sliding-window rate limiter.
 *
 * Uses CACHE_KV for counter storage. Window is 1 minute.
 *
 * Bypass: set RATELIMIT_BYPASS=1 in wrangler.toml vars.
 * Skip: /webhook/telegram (shared-secret authenticated separately).
 *
 * Buckets:
 *   - auth      — 5/min per IP (OTP endpoints, strict)
 *   - public    — 30/min per IP (unauthenticated)
 *   - session   — 120/min per session uid (authenticated users)
 *   - admin     — 300/min per admin uid (privileged)
 *
 * Policy: fail open on error. Availability > strict security at this stage.
 */

function bypassed(env) {
  return env?.RATELIMIT_BYPASS === '1';
}

export async function rateLimit(env, bucket, identifier, maxPerMinute) {
  if (bypassed(env) || !env?.CACHE_KV) {
    return { allowed: true, remaining: maxPerMinute, resetAt: Date.now() + 60000 };
  }

  const windowStart = Math.floor(Date.now() / 60000);
  const key = `rl:${bucket}:${identifier}:${windowStart}`;

  try {
    const current = parseInt((await env.CACHE_KV.get(key)) || '0', 10);
    if (current >= maxPerMinute) {
      return { allowed: false, remaining: 0, resetAt: (windowStart + 1) * 60000 };
    }
    await env.CACHE_KV.put(key, String(current + 1), { expirationTtl: 120 });
    return {
      allowed: true,
      remaining: maxPerMinute - current - 1,
      resetAt: (windowStart + 1) * 60000
    };
  } catch (e) {
    console.error(`rateLimit error for bucket=${bucket} id=${identifier}:`, e.message);
    return { allowed: true, remaining: maxPerMinute, resetAt: Date.now() + 60000 };
  }
}

export async function applyRateLimit(request, env, sessionUid) {
  const url = new URL(request.url);
  const path = url.pathname;
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';

  if (path === '/webhook/telegram') return null;

  // Check for superadmin bypass on specific endpoints
  if (path === '/auth/unified-login' || path.startsWith('/admin/')) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const parts = token.split('.');
      try {
        let p = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (p.length % 4) p += '=';
        const decoded = JSON.parse(atob(p));
        if (decoded.email === 'pushkalkishore@gmail.com') {
          return null;
        }
      } catch (_) {}
    }
  }

  let check;
  if (path === '/auth/unified-login') {
    // Higher limit for unified-login (called on every page load)
    check = await rateLimit(env, 'unified-login', sessionUid || clientIp, 60);
  } else if (path.startsWith('/auth/')) {
    check = await rateLimit(env, 'auth', clientIp, 5);
  } else if (path.startsWith('/admin/') && sessionUid) {
    check = await rateLimit(env, 'admin', sessionUid, 300);
  } else if (sessionUid) {
    check = await rateLimit(env, 'session', sessionUid, 120);
  } else {
    check = await rateLimit(env, 'public', clientIp, 30);
  }

  if (!check.allowed) {
    return new Response(
      JSON.stringify({ error: 'rate_limit_exceeded', resetAt: check.resetAt }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((check.resetAt - Date.now()) / 1000))
        }
      }
    );
  }

  return null;
}
