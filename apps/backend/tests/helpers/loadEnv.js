// jest `setupFiles` entry: runs before each test file is loaded, before
// `require('../server')` (and therefore before the pg pool is created).
require('./testEnv').applyTestEnv();
