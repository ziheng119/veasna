require('dotenv').config();

const db = require('../config/db');
const { hashPassword } = require('../config/db');
const { ensureUserRole } = require('../utils/ensureSchema');

async function seedAdminUser() {
  const adminUsername = (process.env.ADMIN_USERNAME || 'admin').trim();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD environment variable is required');
  }

  if (adminUsername.length < 3) {
    throw new Error('ADMIN_USERNAME must be at least 3 characters');
  }
  if (adminPassword.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters');
  }

  await db.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash TEXT;
  `);
  await ensureUserRole();
  const passwordHash = await hashPassword(adminPassword);

  const upsertQuery = `
    INSERT INTO users (username, password_hash, role, is_active)
    VALUES ($1, $2, 'admin', TRUE)
    ON CONFLICT ((LOWER(username)))
    DO UPDATE SET
      is_active = TRUE,
      role = 'admin',
      password_hash = COALESCE(users.password_hash, EXCLUDED.password_hash)
    RETURNING id, username, role, is_active, created_at;
  `;

  const { rows } = await db.query(upsertQuery, [adminUsername, passwordHash]);
  const user = rows[0];

  return user;
}

if (require.main === module) {
  seedAdminUser()
    .then((user) => {
      console.log(`Admin user ready: ${user.username} (id: ${user.id})`);
    })
    .catch((error) => {
      console.error('Failed to seed admin user:', error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.pool.end();
    });
}

module.exports = {
  seedAdminUser,
};
