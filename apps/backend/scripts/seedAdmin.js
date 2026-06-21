require('dotenv').config();

const db = require('../config/db');

async function seedAdminUser() {
  const adminUsername = (process.env.ADMIN_USERNAME || 'admin').trim();

  if (adminUsername.length < 3) {
    throw new Error('ADMIN_USERNAME must be at least 3 characters');
  }

  const upsertQuery = `
    INSERT INTO users (username, is_active)
    VALUES ($1, TRUE)
    ON CONFLICT ((LOWER(username)))
    DO UPDATE SET is_active = TRUE
    RETURNING id, username, is_active, created_at;
  `;

  const { rows } = await db.query(upsertQuery, [adminUsername]);
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
