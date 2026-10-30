const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { Client } = require("pg");
const path = require("path");
const fs = require("fs");
jest.mock("../config/db", () => ({
  query: jest.fn(),
  pool: { connect: jest.fn() },
}));
const db = require("../config/db");
(process.env.RUN_DB_TESTS === "1" ? describe : describe.skip)(
  "Create-only clinical records",
  () => {
    let client, app, previousSecret;
    const secret = "saved-record-test";
    const token = (role) =>
      jwt.sign({ id: role === "admin" ? 1 : 2, role }, secret);
    beforeAll(async () => {
      require("dotenv").config({ path: path.join(__dirname, "../.env") });
      previousSecret = process.env.JWT_SECRET;
      process.env.JWT_SECRET = secret;
      client = new Client({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectionTimeoutMillis: 3000,
      });
      await client.connect();
      await client.query(`SET search_path TO pg_temp;
   CREATE TEMP TABLE users (id INT PRIMARY KEY, username TEXT, role TEXT, is_active BOOLEAN);
   INSERT INTO users VALUES (1,'Admin','admin',TRUE),(2,'User','user',TRUE);
   CREATE TEMP TABLE visits (id INT PRIMARY KEY); INSERT INTO visits VALUES (1);
   CREATE TEMP TABLE visit_stations (visit_id INT, station TEXT, completed_at TIMESTAMP);`);
      const setup = fs
        .readFileSync(path.join(__dirname, "../db_setup.sql"), "utf8")
        .replace(/\r\n/g, "\n");
      for (const table of [
        "visual_acuity",
        "presenting_complaint",
        "history",
        "seva",
        "physiotherapy",
        "painpoints",
      ]) {
        const start = setup.indexOf("CREATE TABLE " + table + " (");
        const sql = setup.slice(start, setup.indexOf("\n);", start) + 3);
        await client.query(sql.replace("CREATE TABLE", "CREATE TEMP TABLE"));
      }
      db.query.mockImplementation((...args) => client.query(...args));
      db.pool.connect.mockResolvedValue({
        query: (...args) => client.query(...args),
        release() {},
      });
      app = express();
      app.use(express.json());
      app.use(require("../middleware/authorizeApi").authorizeApi);
      app.use("/triage", require("../routes/triage"));
      app.use("/visits", require("../routes/visits"));
      app.use("/tb", require("../routes/tb"));
    });
    afterAll(async () => {
      if (client) await client.end();
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    });
    test("users may flag suspected TB; changing or removing a flag requires admin", async () => {
      await client.query(`ALTER TABLE visits ADD COLUMN last_updated_by INT, ADD COLUMN last_updated_at TIMESTAMP;
   CREATE TEMP TABLE tb_screening (visit_id INT PRIMARY KEY, red_flags TEXT[] NOT NULL DEFAULT '{}', flag_notes TEXT NOT NULL DEFAULT '',
     status TEXT NOT NULL, doctor_notes TEXT NOT NULL DEFAULT '', flagged_by INT, reviewed_by INT, reviewed_at TIMESTAMP,
     last_updated_by INT, last_updated_at TIMESTAMP);`);
      const flag = (role, body) =>
        request(app)
          .post("/tb/1/flag")
          .set("Authorization", "Bearer " + token(role))
          .send(body);
      expect((await flag("user", { flagged: true, red_flags: ["fever"] })).body).toMatchObject({ flagged: true, red_flags: ["fever"] });
      const before = (await client.query("SELECT * FROM tb_screening")).rows;
      expect((await flag("user", { flagged: true, red_flags: ["night_sweats"] })).status).toBe(403);
      expect((await flag("user", { flagged: false })).status).toBe(403);
      expect((await client.query("SELECT * FROM tb_screening")).rows).toEqual(before);
      expect((await flag("admin", { flagged: false })).body).toMatchObject({ flagged: false, status: "cleared" });
      expect((await flag("user", { flagged: "yes" })).status).toBe(400);
      expect((await request(app).post("/tb/2/flag").set("Authorization", "Bearer " + token("admin")).send({ flagged: true })).status).toBe(404);
    });
    test.each([
      [
        "/triage/visual-acuity",
        "visual_acuity",
        {
          visit_id: 1,
          left_with_pinhole: "6/6",
          left_without_pinhole: "6/6",
          right_with_pinhole: "6/6",
          right_without_pinhole: "6/6",
          notes: "Initial",
        },
      ],
      [
        "/triage/presenting-complaint",
        "presenting_complaint",
        { visit_id: 1, history: "Initial" },
      ],
      ["/triage/history", "history", { visit_id: 1, past: "Initial" }],
      ["/visits/seva/1", "seva", { diagnosis: "Initial" }],
      [
        "/visits/physiotherapy/1",
        "physiotherapy",
        { notes: "Initial", painpoints: [{ xCoord: 1, yCoord: 2 }] },
      ],
    ])(
      "%s allows creation and denies subsequent user changes",
      async (url, table, body) => {
        const save = (role, payload) =>
          request(app)
            .post(url)
            .set("Authorization", "Bearer " + token(role))
            .send(payload);
        expect((await save("user", body)).status).toBe(200);
        const before = (await client.query("SELECT * FROM " + table)).rows;
        expect(
          (await save("user", { ...body, notes: "Changed", role: "admin" }))
            .status,
        ).toBe(403);
        expect((await client.query("SELECT * FROM " + table)).rows).toEqual(
          before,
        );
        expect(
          (await save("admin", { ...body, notes: "Admin change" })).status,
        ).toBe(200);
        expect(
          (await client.query("SELECT last_updated_by FROM " + table)).rows[0]
            .last_updated_by,
        ).toBe(1);
      },
    );
  },
);
