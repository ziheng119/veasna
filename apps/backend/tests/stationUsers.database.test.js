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
      INSERT INTO users (username,role) VALUES ('triage_doctor','triage'),('clinic_admin','admin');
      CREATE TEMP TABLE audit (author INT REFERENCES users(id)); INSERT INTO audit VALUES (1);`);
    db.query.mockImplementation((...args)=>client.query(...args));
    db.pool.connect.mockResolvedValue({query:(...args)=>client.query(...args),release(){}});
    app=express(); app.use(express.json()); app.use(require('../middleware/authorizeApi').authorizeApi);
    app.use('/auth',require('../routes/session')); app.all('*',(_req,res)=>res.sendStatus(200));
  });
  afterAll(async()=>{if(client) await client.end(); if(previousSecret===undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET=previousSecret;});
  test('only two active accounts, hashed configured passwords, preserved historical attribution and stable IDs on rerun', async()=>{
    const first=await setupAccounts();
    expect(first.map(account=>account.username)).toEqual(['admin','user']);
    for(const account of first){
      const stored=(await client.query('SELECT * FROM users WHERE id=$1',[account.id])).rows[0];
      expect(stored.password_hash).not.toBe(account.username);
      const login=await request(app).post('/auth/login').send({username:account.username,password:account.username === 'admin' ? 'admin12345' : 'user'});
      expect(login.status).toBe(200); expect(login.body.user.role).toBe(account.username);
    }
    expect((await setupAccounts()).map(account=>account.id)).toEqual(first.map(account=>account.id));
    expect((await client.query('SELECT username FROM users WHERE is_active=TRUE ORDER BY username')).rows).toEqual([{username:'admin'},{username:'user'}]);
    expect((await client.query('SELECT u.username FROM audit a JOIN users u ON u.id=a.author')).rows).toEqual([{username:'triage_doctor'}]);
    const oldToken=jwt.sign({id:1,role:'admin'},secret);
    expect((await request(app).get('/queue').set('Authorization','Bearer '+oldToken)).status).toBe(403);
  });
  test.each(['admin','user'])('%s cannot add accounts through either API',async username=>{
    const login=await request(app).post('/auth/login').send({username,password:username === 'admin' ? 'admin12345' : 'user'});
    for(const url of ['/auth/register','/users']) expect((await request(app).post(url).set('Authorization','Bearer '+login.body.token).send({username:'extra',password:'extra-password',role:'admin'})).status).toBe(403);
    expect((await request(app).get('/analytics').set('Authorization','Bearer '+login.body.token)).status).toBe(200);
    expect((await request(app).put('/patient/1').set('Authorization','Bearer '+login.body.token)).status).toBe(username==='admin'?200:403);
  });
});
