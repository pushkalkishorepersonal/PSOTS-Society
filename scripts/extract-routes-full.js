#!/usr/bin/env node
// Full route extraction with code generation

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const indexPath = path.join(projectRoot, 'src', 'index.js');
const routesDir = path.join(projectRoot, 'src', 'routes');

// Route group definitions: { group: { start: lineNum, end: lineNum, routes: ['...'] } }
const ROUTE_GROUPS = {
  static: { start: 784, end: 792, routes: ['/', '/index.html', '/market', '/handbook', '/events', '/user'] },
  otp: { start: 798, end: 851, routes: ['/send-otp', '/verify-otp'] },
  flat: { start: 853, end: 889, routes: ['/flat/check'] },
  auth: { start: 891, end: 1033, routes: ['/auth/send-email-otp', '/auth/verify-email-otp', '/auth/link-email'] },
  resident: { start: 1035, end: 4034, routes: ['/resident/feedback', '/resident/registration-confirmation', '/resident/privacy-settings', '/resident/my-access-log', '/resident/delete-account'] },
  notify: { start: 1067, end: 1086, routes: ['/notify-registration'] },
  admin: { start: 1088, end: 4137, routes: ['/admin/*'] },
  invite: { start: 2155, end: 2621, routes: ['/invite/create', '/invite/send-email', '/invite/accept'] },
  family: { start: 2623, end: 2764, routes: ['/family/list', '/family/approve', '/family/reject'] },
  tenant: { start: 2766, end: 3417, routes: ['/tenant/add', '/tenant/list', '/tenant/revoke', '/tenant/family/request', '/tenant/family/decide', '/tenant/family/pending'] },
  device: { start: 3420, end: 3559, routes: ['/device/register', '/device/revoke'] },
  recommendations: { start: 3561, end: 3950, routes: ['/recommendations/*'] },
  contact: { start: 3952, end: 4034, routes: ['/contact/send', '/contact/check-limit'] },
  user: { start: 1752, end: 1792, routes: ['/user/violations'] },
};

const content = fs.readFileSync(indexPath, 'utf8');
const lines = content.split('\n');

// Ensure routes directory exists
if (!fs.existsSync(routesDir)) {
  fs.mkdirSync(routesDir, { recursive: true });
}

console.log('Route extraction blueprint:\n');
Object.entries(ROUTE_GROUPS).forEach(([group, config]) => {
  const routeLines = lines.slice(config.start - 1, config.end);
  const routeCode = routeLines.join('\n');
  console.log(`${group}: lines ${config.start}-${config.end} (${routeLines.length} lines)`);
  console.log(`  Routes: ${config.routes.join(', ')}`);
  console.log(`  Code sample: ${routeCode.substring(0, 80)}...`);
  console.log();
});

console.log('\n✓ Blueprint ready. Manual extraction required:');
console.log('  For each group, create src/routes/{group}.routes.js');
console.log('  Export: export async function handle{Group}(pathname, request, env, ctx) { ... }');
console.log('  Include all route logic from lines {start}-{end}');
