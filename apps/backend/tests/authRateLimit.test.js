const express = require("express");
const request = require("supertest");
const createAuthRateLimit = require("../middleware/authRateLimit");

test("navigation profile checks do not exhaust the credential limit", async () => {
  const app = express();
  app.use("/api/auth", createAuthRateLimit());
  app.get("/api/auth/me", (_req, res) => res.sendStatus(200));
  app.post("/api/auth/login", (_req, res) => res.sendStatus(401));
  app.post("/api/auth/register", (_req, res) => res.sendStatus(201));
  for (let i = 0; i < 35; i++) {
    await request(app).get("/api/auth/me").expect(200);
  }
  for (let i = 0; i < 30; i++) {
    await request(app).post("/api/auth/login").expect(401);
  }
  await request(app).post("/api/auth/login").expect(429);
  await request(app).post("/api/auth/register").expect(429);
  await request(app).get("/api/auth/me").expect(200);
});
