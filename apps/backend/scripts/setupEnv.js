// scripts/setupEnv.js  (run from the project folder: npm run setup:env)
// Creates each missing env file from its .example template, for the backend and the web app:
//   .env               shared backend settings (database, JWT_SECRET, PORT)
//   .env.development   npm run dev: everything on this laptop (localhost)
//   .env.production    npm run build / npm start: devices on the clinic network
// Existing files are never changed. See docs/performance-and-lan.md#development-and-clinic-settings.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const FILES = {
  'apps/backend': ['.env', '.env.development', '.env.production'],
  'apps/frontend': ['.env.development', '.env.production'],
};

// Next.js reads .env.local in every mode, and it wins over .env.development/.env.production.
function backendUrlInEnvLocal(root = ROOT) {
  const file = path.join(root, 'apps/frontend/.env.local');
  return fs.existsSync(file) && /^\s*NEXT_PUBLIC_BACKEND_URL\s*=/m.test(fs.readFileSync(file, 'utf8'));
}

// Returns { created, kept, warnings }, with paths relative to root.
function setupEnv(root = ROOT) {
  const created = [];
  const kept = [];
  for (const [app, names] of Object.entries(FILES)) {
    for (const name of names) {
      const target = path.join(root, app, name);
      const relative = `${app}/${name}`;
      if (fs.existsSync(target)) {
        kept.push(relative);
      } else {
        fs.copyFileSync(`${target}.example`, target);
        created.push(relative);
      }
    }
  }
  const warnings = backendUrlInEnvLocal(root)
    ? ['apps/frontend/.env.local sets NEXT_PUBLIC_BACKEND_URL, which overrides both .env.development and ' +
       '.env.production. Delete that line and put the address in the mode file instead.']
    : [];
  return { created, kept, warnings };
}

if (require.main === module) {
  const { created, kept, warnings } = setupEnv();
  for (const file of created) console.log(`Created ${file}`);
  for (const file of kept) console.log(`Kept    ${file} (already exists)`);
  for (const warning of warnings) console.warn(`\n⚠ ${warning}`);
  if (created.includes('apps/backend/.env')) {
    console.log('\nNext: fill in the database settings and JWT_SECRET in apps/backend/.env.');
  }
}

module.exports = { setupEnv, backendUrlInEnvLocal };
