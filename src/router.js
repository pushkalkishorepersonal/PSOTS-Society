// src/router.js — Central route dispatcher
// Maps (method, pathname) to route handlers

import { handleStaticPages } from './routes/static.routes.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function router(request, env, ctx) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  // Static pages (no auth required)
  const staticResp = await handleStaticPages(pathname, request, env);
  if (staticResp) return staticResp;

  // TODO: Dispatch other route groups here
  // - OTP routes (/send-otp, /verify-otp)
  // - Auth routes (/auth/*)
  // - Resident routes (/resident/*)
  // - Admin routes (/admin/*)
  // - Family routes (/family/*)
  // - Tenant routes (/tenant/*)
  // - Device routes (/device/*)
  // - Invite routes (/invite/*)
  // - Contact routes (/contact/*)
  // - Recommendations routes (/recommendations/*)

  return new Response(JSON.stringify({ error: 'not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
