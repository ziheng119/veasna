// jest `setupFilesAfterEnv` entry: registers an afterAll hook in every test
// file so the pg pool is drained and the worker exits cleanly.

const db = require('../../config/db');

afterAll(async () => {
  try {
    await db.pool.end();
  } catch (err) {
    // Pool already ended or never opened — nothing to clean up.
  }
});
