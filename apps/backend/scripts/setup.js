// scripts/setup.js

require('../server.js')
const db = require('../config/db');
const fs = require('fs');
const path = require('path');

async function runSetup() {
  console.log('🔧 Veasna Backend Setup');
  console.log('========================\n');

  // Check if .env exists
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('.env file not found!');
    console.log('Please create a .env file with your database configuration.');
    process.exit(1);
  }

  // Test database connection
  console.log('Testing database connection...');
  const dbConnected = await db.testConnection();
  
  if (!dbConnected) {
    console.error('Database connection failed!');
    console.log('\nPlease check:');
    console.log('1. PostgreSQL is running');
    console.log('2. Database credentials in .env are correct');
    console.log('3. Database "veasna_backend" exists');
    console.log('4. User has proper permissions');
    process.exit(1);
  }

  // Test basic queries
  console.log('Database connected successfully');
  console.log('Testing basic queries...');
  
  try {
    // Test users table
    await db.query('SELECT COUNT(*) FROM users');
    console.log('Users table accessible');
    
    // Test patients table
    await db.query('SELECT COUNT(*) FROM patients');
    console.log('Patients table accessible');
    
    // Test vitals table
    await db.query('SELECT COUNT(*) FROM vitals');
    console.log('Vitals table accessible');
    
  } catch (error) {
    console.error('Database tables not found!');
    console.log('Please run the database setup script:');
    console.log('psql -U your_user -d veasna_backend -f db_setup.sql');
    process.exit(1);
  }

  console.log('\nSetup completed successfully!');
  console.log('\nNext steps:');
  console.log('1. Start the server: npm run dev');
  console.log('2. Test the API: curl http://localhost:3000/health');
  console.log('3. Create your first user: POST /api/users (body: { "username": "yourname" })');
}

runSetup().catch(console.error); 