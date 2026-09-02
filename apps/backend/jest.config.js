module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/helpers/loadEnv.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/closePool.js'],
  globalSetup: '<rootDir>/tests/helpers/globalSetup.js',
  // One shared test database — run serially so files don't race on its rows/schema.
  maxWorkers: 1,
  testTimeout: 15000,
  collectCoverageFrom: [
    'routes/**/*.js',
    'config/**/*.js',
    'middleware/**/*.js',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
};
