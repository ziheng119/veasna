// Centralized test environment defaults.
// Required by jest `setupFiles` (per test file) and by `globalSetup`
// (once, before the suite) so both run against the same throwaway database.
//
// Override any value with the matching TEST_* env var, e.g. TEST_DB_NAME.

function applyTestEnv() {
  process.env.NODE_ENV = 'test';

  process.env.DB_NAME = process.env.TEST_DB_NAME || 'veasna_test';
  process.env.DB_USER = process.env.TEST_DB_USER || process.env.DB_USER || 'veasna_app';
  process.env.DB_PASSWORD =
    process.env.TEST_DB_PASSWORD || process.env.DB_PASSWORD || 'change_me';
  process.env.DB_HOST = process.env.TEST_DB_HOST || process.env.DB_HOST || 'localhost';
  process.env.DB_PORT = process.env.TEST_DB_PORT || process.env.DB_PORT || '5432';

  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-not-for-production';

  // Disable the general API rate limiter and give the auth limiter plenty of
  // headroom so a full suite run never trips it.
  process.env.OFFLINE_MODE = 'true';
  process.env.AUTH_RATE_LIMIT_MAX = process.env.AUTH_RATE_LIMIT_MAX || '100000';

  // Guard: never let the suite point at a real database.
  if (!/test/i.test(process.env.DB_NAME)) {
    throw new Error(
      `Refusing to run tests against database "${process.env.DB_NAME}" — the name must contain "test". ` +
        `Set TEST_DB_NAME to a throwaway database.`
    );
  }
}

module.exports = { applyTestEnv };
