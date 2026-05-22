/**
 * src/db/cache.js — KV-backed read cache for the adapter layer.
 *
 * Transparent wrapper: call sites in the adapter do not know caching exists.
 *
 * Bypass for debugging: set CACHE_BYPASS=1 in wrangler.toml vars to skip
 * all reads and writes.
 *
 * Key convention: `<collection>:<identifier>` or `<collection>:<field>:<value>`
 *   Examples: `resident:abc123`, `resident:flat:1204`, `family:1204`
 *
 * TTLs are short (2-10 minutes). Invalidation happens on matching writes;
 * TTL is a safety net for missed invalidations.
 */

function bypassed(env) {
  return env?.CACHE_BYPASS === '1';
}

export async function cacheGet(env, key) {
  if (bypassed(env) || !env?.CACHE_KV) return null;
  try {
    const raw = await env.CACHE_KV.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error(`cacheGet error for key=${key}:`, e.message);
    return null;
  }
}

export async function cacheSet(env, key, value, ttlSec) {
  if (bypassed(env) || !env?.CACHE_KV) return;
  try {
    const ttl = Math.max(60, ttlSec || 300);
    await env.CACHE_KV.put(key, JSON.stringify(value), { expirationTtl: ttl });
  } catch (e) {
    console.error(`cacheSet error for key=${key}:`, e.message);
  }
}

export async function cacheDel(env, key) {
  if (bypassed(env) || !env?.CACHE_KV) return;
  try {
    await env.CACHE_KV.delete(key);
  } catch (e) {
    console.error(`cacheDel error for key=${key}:`, e.message);
  }
}
