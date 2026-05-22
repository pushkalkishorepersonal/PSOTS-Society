# PSOTS Test Suite

## Test Organization

### Unit Tests
- Location: `**/*.test.js` (next to source) or `/tests/unit/`
- Run: `npm test`
- Watch mode: `npm test:watch`
- Coverage: `npm test:coverage`

### Smoke Tests
- Location: `/tests/smoke/`
- Purpose: Wire-level tests to verify basic functionality
- Verifies: No syntax errors, imports load, basic flows work

### Running Tests

**Local:**
```bash
npm test                 # Run all tests once
npm test:watch          # Watch mode (re-run on changes)
npm test:coverage       # Generate coverage report
```

**CI:**
- Runs on every push to main (before deploy)
- Must pass for deployment to proceed
- See `.github/workflows/deploy.yml` for config

## Test Standards

- **No external API calls** — mock Firestore, Telegram, Resend
- **No environment secrets** — use fixtures
- **Fast** — each test < 100ms
- **Deterministic** — no flaky timing
- **Clear names** — describe what is being tested, not how

## Known Test Limitations

- Vitest runs in Node environment only (browser APIs need jsdom import)
- Firebase SDK uses Firestore REST API (no Emulator needed for tests)
- Worker routes not yet tested (requires Miniflare)

## Next Steps (Future)

1. Add API endpoint tests with mocked Worker environment
2. Add Firestore security rules tests
3. Add integration tests for critical flows
4. Add E2E tests (Playwright) for UI paths
