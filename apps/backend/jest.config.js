module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/helpers/loadEnv.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/closePool.js'],
  globalSetup: '<rootDir>/tests/helpers/globalSetup.js',
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
