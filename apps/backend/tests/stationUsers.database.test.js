const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const path = require('path');
const { Client } = require('pg');
jest.mock('../config/db', () => ({
  query: jest.fn(), pool: { connect: jest.fn() },
  hashPassword: password => require('bcrypt').hash(password, 4),
  comparePassword: (password, hash) => require('bcrypt').compare(password, hash),
}));
const db = require('../config/db');
const { setupAccounts } = require('../scripts/setupAccounts');
(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Fixed deployment accounts', () => {
  let client, app, previousSecret;
  const secret = 'fixed-accounts-test';
  beforeAll(async () => {
    require('dotenv').config({path:path.join(__dirname,'../.env')});
    previousSecret=process.env.JWT_SECRET; process.env.JWT_SECRET=secret;
    client = new Client({host:process.env.DB_HOST,port:process.env.DB_PORT,database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,connectionTimeoutMillis:3000});
    await client.connect();
    await client.query(`SET search_path TO pg_temp;
      CREATE TEMP TABLE users (id SERIAL PRIMARY KEY, username TEXT, password_hash TEXT, role TEXT DEFAULT 'user', is_active BOOLEAN DEFAULT TRUE);
      CREATE UNIQUE INDEX test_username ON users (LOWER(username));
      INSERT INTO users (username,role) VALUES ('triage_doctor','triage'),('clinic_admin','admin'),('user','user');
      CREATE TEMP TABLE audit (author INT REFERENCES users(id)); INSERT INTO audit VALUES (1),(3);`);
    db.query.mockImplementation((...args)=>client.query(...args));
    db.pool.connect.mockResolvedValue({query:(...args)=>client.query(...args),release(){}});
    app=express(); app.use(express.json()); app.use(require('../middleware/authorizeApi').authorizeApi);
    app.use('/auth',require('../routes/session')); app.all('*',(_req,res)=>res.sendStatus(200));
  });
  afterAll(async()=>{if(client) await client.end(); if(previousSecret===undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET=previousSecret;});
  test('only the admin stays active; the shared user and older accounts are retired, not deleted', async()=>{
    // A screening-day account is how everyone else signs in; setup leaves it alone.
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS screening_date DATE");
    await client.query("INSERT INTO users (username,password_hash,role,screening_date) VALUES ('dec13village',$1,'user','2026-12-13')", [await db.hashPassword('ilovebtb')]);
    const first=await setupAccounts();
    expect(first.map(account=>account.username)).toEqual(['admin']);
    const stored=(await client.query('SELECT * FROM users WHERE id=$1',[first[0].id])).rows[0];
    expect(stored.password_hash).not.toBe('admin12345');
    const login=await request(app).post('/auth/login').send({username:'admin',password:'admin12345'});
    expect(login.status).toBe(200); expect(login.body.user.role).toBe('admin');
    expect((await request(app).post('/auth/login').send({username:'user',password:'user'})).status).not.toBe(200);
    expect((await setupAccounts()).map(account=>account.id)).toEqual(first.map(account=>account.id));
    expect((await client.query('SELECT username FROM users WHERE is_active=TRUE ORDER BY username')).rows).toEqual([{username:'admin'},{username:'dec13village'}]);
    expect((await client.query('SELECT u.username FROM audit a JOIN users u ON u.id=a.author ORDER BY a.author')).rows).toEqual([{username:'triage_doctor'},{username:'user'}]);
    const oldToken=jwt.sign({id:1,role:'admin'},secret);
    expect((await request(app).get('/queue').set('Authorization','Bearer '+oldToken)).status).toBe(403);
  });
  test('the retire migration disables only the shared user sign-in and can run again', async()=>{
    const migration=require('fs').readFileSync(path.join(__dirname,'../migrations/022_retire_shared_user_account.sql'),'utf8');
    await client.query("UPDATE users SET is_active=TRUE WHERE username='user'");
    await client.query(migration); await client.query(migration);
    expect((await client.query("SELECT is_active FROM users WHERE username='user'")).rows[0].is_active).toBe(false);
    expect((await client.query("SELECT is_active FROM users WHERE username IN ('admin','dec13village')")).rows.every(row=>row.is_active)).toBe(true);
  });
  test('admin cannot add accounts through either older API', async()=>{
    const login=await request(app).post('/auth/login').send({username:'admin',password:'admin12345'});
    for(const url of ['/auth/register','/users']) expect((await request(app).post(url).set('Authorization','Bearer '+login.body.token).send({username:'extra',password:'extra-password',role:'admin'})).status).toBe(403);
    expect((await request(app).get('/analytics').set('Authorization','Bearer '+login.body.token)).status).toBe(200);
  });
});
