// src/routes/static.routes.js — Static HTML page handlers

import { EVENTS_HTML, GRAND_LOBBY_HTML, MARKETPLACE_HTML, HANDBOOK_HTML, USER_PANEL } from '../templates.js';

export async function handleStaticPages(pathname, request, env) {
  if (pathname === '/' || pathname === '/index.html') {
    return new Response(GRAND_LOBBY_HTML(env.GOOGLE_CLIENT_ID), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
  if (pathname === '/market') {
    return new Response(MARKETPLACE_HTML, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  if (pathname === '/handbook') {
    return new Response(HANDBOOK_HTML, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  if (pathname === '/events') {
    return new Response(EVENTS_HTML, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  if (pathname === '/user' || pathname === '/user/') {
    return new Response(USER_PANEL, {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  return null; // Not a static route
}
