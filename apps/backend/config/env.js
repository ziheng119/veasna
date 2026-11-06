// config/env.js
// Loads apps/backend's env files for the current mode, so development and the clinic network can
// use different addresses without editing files:
//   development (npm run dev):  .env.development, then .env
//   production  (npm start):    .env.production,  then .env
// .env holds settings shared by both modes (database, JWT_SECRET, PORT). A setting in the mode
// file wins over .env, and anything already set in the shell wins over both. Missing files are
// skipped, so an installation with only .env works as before.

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const BACKEND_DIR = path.join(__dirname, '..');

// npm start sets NODE_ENV=production (scripts/startProduction.js); anything else is development.
function envMode(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv === 'production' ? 'production' : 'development';
}

// Returns { mode, files }: the mode used and the files that were found, in load order.
function loadEnv({ dir = BACKEND_DIR, mode = envMode() } = {}) {
  // Fixed before loading, so a NODE_ENV line in a file cannot contradict the command's mode.
  if (!process.env.NODE_ENV) process.env.NODE_ENV = mode;
  const files = [`.env.${mode}`, '.env'].filter((name) => fs.existsSync(path.join(dir, name)));
  // dotenv never overwrites a variable that is already set, so the first file wins.
  for (const name of files) dotenv.config({ path: path.join(dir, name) });
  return { mode, files };
}

module.exports = { envMode, loadEnv };
