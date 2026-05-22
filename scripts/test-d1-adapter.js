#!/usr/bin/env node
/**
 * scripts/test-d1-adapter.js
 * 
 * Quick test to verify D1 adapter is working correctly.
 * Run this after data migration is complete.
 * 
 * Usage:
 *   npx wrangler dev   # Start dev server
 *   # Then in another terminal:
 *   node scripts/test-d1-adapter.js
 */

const BASE_URL = 'http://localhost:8787';

// ANSI colors for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(status, message) {
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : 'ℹ️';
  const color = status === 'pass' ? colors.green : status === 'fail' ? colors.red : colors.blue;
  console.log(`${color}${icon} ${message}${colors.reset}`);
}

async function testEndpoint(name, url, expectedStatus = 200) {
  try {
    const response = await fetch(url);
    
    if (response.status !== expectedStatus) {
      log('fail', `${name}: Expected ${expectedStatus}, got ${response.status}`);
      return false;
    }
    
    const data = await response.json().catch(() => null);
    
    if (!data) {
      log('fail', `${name}: No JSON response`);
      return false;
    }
    
    log('pass', `${name}: ${response.status} OK`);
    return true;
  } catch (error) {
    log('fail', `${name}: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('\n🧪 Testing D1 Adapter\n');
  console.log(`Base URL: ${BASE_URL}\n`);
  
  const tests = [
    // Chhath API (already using D1)
    {
      name: 'Chhath Stats',
      url: `${BASE_URL}/api/chhath/stats`
    },
    {
      name: 'Chhath Contributors',
      url: `${BASE_URL}/api/chhath/contributors`
    },
    
    // PSOTS API (will use D1 after migration)
    // Note: These will fail until src/index.js is updated to use D1
    // Uncomment after Phase 5 (Worker endpoint migration) is complete
    
    // {
    //   name: 'List Residents (Admin)',
    //   url: `${BASE_URL}/api/residents`,
    //   requiresAuth: true
    // },
    // {
    //   name: 'Get Settings',
    //   url: `${BASE_URL}/api/settings/contact`
    // },
    // {
    //   name: 'List Announcements',
    //   url: `${BASE_URL}/api/announcements`
    // }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const result = await testEndpoint(test.name, test.url, test.expectedStatus);
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`Total: ${tests.length} tests`);
  log('pass', `Passed: ${passed}`);
  if (failed > 0) {
    log('fail', `Failed: ${failed}`);
  }
  console.log('='.repeat(50) + '\n');
  
  if (failed > 0) {
    console.log('💡 Tip: Make sure `npx wrangler dev` is running\n');
    process.exit(1);
  } else {
    console.log('🎉 All tests passed!\n');
  }
}

// Check if dev server is running
async function checkDevServer() {
  try {
    await fetch(BASE_URL);
    return true;
  } catch {
    return false;
  }
}

// Main
(async () => {
  const isRunning = await checkDevServer();
  
  if (!isRunning) {
    log('fail', 'Dev server not running');
    console.log('\n💡 Start the dev server first:\n');
    console.log('   npx wrangler dev\n');
    process.exit(1);
  }
  
  await runTests();
})();
