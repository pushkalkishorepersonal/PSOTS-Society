#!/usr/bin/env node
// Extract routes from src/index.js and create separate route files

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const indexPath = path.join(projectRoot, 'src', 'index.js');
const routesDir = path.join(projectRoot, 'src', 'routes');

// Ensure routes directory exists
if (!fs.existsSync(routesDir)) {
  fs.mkdirSync(routesDir, { recursive: true });
}

const content = fs.readFileSync(indexPath, 'utf8');
const lines = content.split('\n');

// Find the fetch handler boundaries
let fetchStart = -1;
let fetchEnd = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('async fetch(request, env)')) {
    fetchStart = i;
  }
  if (fetchStart > -1 && lines[i].includes('async scheduled(event, env, ctx)')) {
    fetchEnd = i;
    break;
  }
}

if (fetchStart < 0) {
  console.error('Could not find fetch handler');
  process.exit(1);
}

console.log(`Fetch handler: lines ${fetchStart + 1} to ${fetchEnd}`);

// Extract route groups by looking for pathname checks
const routeGroups = {
  static: [],
  otp: [],
  flat: [],
  auth: [],
  resident: [],
  notify: [],
  admin: [],
  user: [],
  invite: [],
  family: [],
  tenant: [],
  device: [],
  recommendations: [],
  contact: [],
};

for (let i = fetchStart; i < fetchEnd; i++) {
  const line = lines[i];

  if (line.includes("pathname === '/'") || line.includes("pathname === '/index.html'") ||
      line.includes("pathname === '/market'") || line.includes("pathname === '/handbook'") ||
      line.includes("pathname === '/events'") || line.includes("pathname === '/user'")) {
    routeGroups.static.push(i);
  } else if (line.includes("pathname === '/send-otp'") || line.includes("pathname === '/verify-otp'")) {
    routeGroups.otp.push(i);
  } else if (line.includes("pathname === '/flat/")) {
    routeGroups.flat.push(i);
  } else if (line.includes("pathname === '/auth/")) {
    routeGroups.auth.push(i);
  } else if (line.includes("pathname === '/resident/")) {
    routeGroups.resident.push(i);
  } else if (line.includes("pathname === '/notify-")) {
    routeGroups.notify.push(i);
  } else if (line.includes("pathname === '/admin/")) {
    routeGroups.admin.push(i);
  } else if (line.includes("pathname === '/user/")) {
    routeGroups.user.push(i);
  } else if (line.includes("pathname === '/invite/")) {
    routeGroups.invite.push(i);
  } else if (line.includes("pathname === '/family/")) {
    routeGroups.family.push(i);
  } else if (line.includes("pathname === '/tenant/")) {
    routeGroups.tenant.push(i);
  } else if (line.includes("pathname === '/device/")) {
    routeGroups.device.push(i);
  } else if (line.includes("pathname === '/recommendations/")) {
    routeGroups.recommendations.push(i);
  } else if (line.includes("pathname === '/contact/")) {
    routeGroups.contact.push(i);
  }
}

console.log('\nRoute groups found:');
Object.entries(routeGroups).forEach(([group, lines]) => {
  if (lines.length > 0) {
    console.log(`  ${group}: ${lines.length} route checks`);
    lines.forEach(lineNum => {
      const trimmed = content.split('\n')[lineNum].trim().substring(0, 60);
      console.log(`    Line ${lineNum + 1}: ${trimmed}`);
    });
  }
});

console.log('\n✓ Analysis complete. Next steps:');
console.log('  1. Create src/routes/*.routes.js files with handlers');
console.log('  2. Rewrite src/index.js as a thin router');
console.log('  3. Run: npm run lint && npm run test');
