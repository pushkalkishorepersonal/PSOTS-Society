#!/usr/bin/env node

// This script will fail until Prompt 4 (refactor imports) completes. That is by design.
// Purpose: Enforce architectural rule that Firebase is imported only from src/db/
// Exit 1 if any file outside src/db/ imports from 'firebase' or 'firebase-admin'

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADAPTER_PATHS = ['src/db/firebase.js', 'src/db/firebase-admin.js'];
const FORBIDDEN_IMPORTS = ['firebase', 'firebase-admin'];
const SEARCH_DIRS = ['src', 'js'];

let violations = [];

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!['node_modules', 'archive', 'promo-video'].includes(file)) {
        walkDir(fullPath);
      }
    } else if (file.endsWith('.js')) {
      checkFile(fullPath);
    }
  }
}

function checkFile(filePath) {
  // Skip adapter files themselves
  if (ADAPTER_PATHS.some(p => filePath.endsWith(p))) return;

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    for (const forbiddenImport of FORBIDDEN_IMPORTS) {
      if (line.includes(`from '${forbiddenImport}`) || line.includes(`from "${forbiddenImport}`)) {
        violations.push({
          file: filePath,
          line: lineNum,
          content: line.trim(),
          import: forbiddenImport
        });
      }
    }
  });
}

// Walk source directories
SEARCH_DIRS.forEach(dir => walkDir(dir));

if (violations.length > 0) {
  console.error('\n❌ Architecture violation: Firebase imported outside src/db/\n');
  violations.forEach(v => {
    console.error(`${v.file}:${v.line}`);
    console.error(`  ${v.content}`);
  });
  process.exit(1);
} else {
  console.log('✓ Architecture check passed: All Firebase imports in src/db/');
  process.exit(0);
}
