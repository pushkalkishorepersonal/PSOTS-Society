#!/usr/bin/env node
// scripts/add-pwa-tags.js — adds PWA meta tags to society/*.html pages

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const SOCIETY_DIR = './society';
const EXCLUDE = ['login.html', 'register.html', 'join.html', 'admin.html'];

const HEAD_TAGS = `  <link rel="manifest" href="/society/manifest.json"/>
  <meta name="theme-color" content="#1a4a3a"/>
  <meta name="apple-mobile-web-app-capable" content="yes"/>
  <meta name="apple-mobile-web-app-status-bar-style" content="default"/>
  <meta name="apple-mobile-web-app-title" content="PSOTS"/>
  <link rel="apple-touch-icon" href="/assets/psots-icon-192.png"/>
`;

const SCRIPT_TAG = '<script src="/society/js/pwa-init.js" defer></script>\n';

const files = readdirSync(SOCIETY_DIR)
  .filter(f => f.endsWith('.html') && !EXCLUDE.includes(f));

let updated = 0, skipped = 0;
for (const file of files) {
  const path = join(SOCIETY_DIR, file);
  let content = readFileSync(path, 'utf8');

  if (content.includes('rel="manifest"')) {
    console.log(`SKIP (already PWA): ${file}`);
    skipped++;
    continue;
  }

  const iconMatch = content.match(/(<link rel="icon"[^>]*>)/);
  if (!iconMatch) {
    console.log(`SKIP (no <link rel="icon">): ${file}`);
    skipped++;
    continue;
  }
  content = content.replace(iconMatch[1], iconMatch[1] + '\n' + HEAD_TAGS.trimEnd());

  if (!content.includes('</body>')) {
    console.log(`SKIP (no </body>): ${file}`);
    skipped++;
    continue;
  }
  content = content.replace('</body>', SCRIPT_TAG + '</body>');

  writeFileSync(path, content);
  console.log(`UPDATED: ${file}`);
  updated++;
}

console.log(`\nDone. Updated ${updated}, skipped ${skipped}.`);
