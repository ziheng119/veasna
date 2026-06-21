// config/db.js

const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// The pool will use the environment variables (PGUSER, PGHOST, PGDATABASE, PGPASSWORD, PGPORT)
// if they are set, or the connection object otherwise.
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  // --- Connection Pool Settings ---
  // Set the maximum number of clients in the pool.
  // This is important for handling concurrent connections.
  // We're setting it to 20 to handle the expected 15+ simultaneous users.
  max: 20,
  // Time in milliseconds to wait for a client from the pool before timing out.
  idleTimeoutMillis: 30000,
  // Time in milliseconds to wait for a connection to be established.
  connectionTimeoutMillis: 2000,
});

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('Database connected successfully');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
};

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Function to hash passwords before saving to the database
const hashPassword = async (password) => {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  return hashedPassword;
};

// Function to compare a submitted password with the stored hash
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Exporting the query function to be used by the API routes
module.exports = {
  query: (text, params) => pool.query(text, params),
  hashPassword,
  comparePassword,
  testConnection,
  pool,
};
