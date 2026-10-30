// Admin corrections to saved visits (routes/visitEdits.js) against real PostgreSQL temp tables.
// Run with RUN_DB_TESTS=1 and a configured apps/backend/.env.
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

const ADMIN_ID = 1;
const USER_ID = 2;

(process.env.RUN_DB_TESTS === "1" ? describe : describe.skip)(
  "Admin visit record edits",
  () => {
    let client, app, previousSecret;
    const secret = "visit-edits-test";
    const token = (role) =>
      jwt.sign({ id: role === "admin" ? ADMIN_ID : USER_ID, role }, secret);
    const put = (url, body, role = "admin") =>
      request(app).put(url).set("Authorization", "Bearer " + token(role)).send(body);
    const vitals = {
      height: 150, weight: 50, bmi: 22.2, below_3rd_percentile: false,
      bp_systolic: 120, bp_diastolic: 80, temperature: 36.8, notes: "Corrected",
    };

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
        INSERT INTO users VALUES (${ADMIN_ID},'admin','admin',TRUE),(${USER_ID},'user','user',TRUE);`);
      // Real table definitions, so constraints match production.
      const setup = fs
        .readFileSync(path.join(__dirname, "../db_setup.sql"), "utf8")
        .replace(/\r\n/g, "\n");
      for (const table of ["locations", "visits", "tb_screening", "vitals", "hef"]) {
        const start = setup.indexOf("CREATE TABLE " + table + " (");
        let sql = setup.slice(start, setup.indexOf("\n);", start) + 3);
        // Visits reference patients, which these tests do not need.
        if (table === "visits") sql = sql.replace(/REFERENCES patients\(id\)\s+ON DELETE CASCADE ON UPDATE CASCADE/, "");
        await client.query(sql.replace("CREATE TABLE", "CREATE TEMP TABLE"));
      }
      db.query.mockImplementation((...args) => client.query(...args));
      db.pool.connect.mockImplementation(async () => ({
        query: (...args) => client.query(...args),
        release() {},
      }));
      app = express();
      app.use(express.json());
      app.use(require("../middleware/authorizeApi").authorizeApi);
      app.use("/visits", require("../routes/visitEdits"));
    });

    beforeEach(async () => {
      await client.query(`TRUNCATE visits, locations, tb_screening, vitals, hef RESTART IDENTITY CASCADE;
        INSERT INTO locations (name) VALUES ('North'), ('South');
        INSERT INTO visits (patient_id, location_id, queue_no, visit_date, last_updated_by)
          VALUES (1, 1, '1', '2026-10-01', ${USER_ID}), (2, 1, '2', '2026-10-01', ${USER_ID});`);
    });

    afterAll(async () => {
      if (client) await client.end();
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    });

    test.each([
      ["/visits/1", { queue_no: "5" }],
      ["/visits/1/vitals", { vitals }],
      ["/visits/1/tb", { flag_notes: "x" }],
    ])("users cannot use %s", async (url, body) => {
      expect((await put(url, body, "user")).status).toBe(403);
    });

    test("visit details are corrected and attributed to the admin", async () => {
      const res = await put("/visits/1", { queue_no: "7a", visit_date: "2026-10-02", location_id: 2 });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ queue_no: "7A", visit_date: "2026-10-02", location_id: 2, last_updated_by: ADMIN_ID });
    });

    test("a queue number already used at the location and date is rejected", async () => {
      const res = await put("/visits/1", { queue_no: "2" });
      expect(res.status).toBe(409);
      const { rows } = await client.query("SELECT queue_no FROM visits WHERE id = 1");
      expect(rows[0].queue_no).toBe("1");
    });

    test("queue numbers may contain letters, e.g. A12", async () => {
      const res = await put("/visits/1", { queue_no: "a12" });
      expect(res.status).toBe(200);
      expect(res.body.queue_no).toBe("A12");
    });

    test.each([
      [{ queue_no: "A-1" }],
      [{ queue_no: "ABC" }],
      [{ queue_no: "12345678901" }],
      [{ visit_date: "2026-02-30" }],
      [{ location_id: 0 }],
      [{}],
    ])("invalid visit details %j are rejected", async (body) => {
      expect((await put("/visits/1", body)).status).toBe(400);
    });

    test("unknown locations and visits are reported", async () => {
      expect((await put("/visits/1", { location_id: 99 })).status).toBe(400);
      expect((await put("/visits/99", { queue_no: "3" })).status).toBe(404);
    });

    test("vitals and HEF are created or updated together", async () => {
      const res = await put("/visits/1/vitals", { vitals, hef: { know_of_hef: true, has_hef: false, notes: "" } });
      expect(res.status).toBe(200);
      const again = await put("/visits/1/vitals", { vitals: { ...vitals, weight: 55 } });
      expect(again.status).toBe(200);
      const { rows } = await client.query("SELECT weight, last_updated_by FROM vitals WHERE visit_id = 1");
      expect(rows).toEqual([{ weight: "55", last_updated_by: ADMIN_ID }]);
      expect((await client.query("SELECT has_hef FROM hef WHERE visit_id = 1")).rows[0].has_hef).toBe(false);
    });

    test("invalid vitals leave the record unchanged", async () => {
      expect((await put("/visits/1/vitals", { vitals: { ...vitals, height: -1 } })).status).toBe(400);
      expect((await put("/visits/1/vitals", { hef: { know_of_hef: "yes", has_hef: true } })).status).toBe(400);
      expect((await client.query("SELECT 1 FROM vitals")).rows).toHaveLength(0);
    });

    describe("TB screening", () => {
      beforeEach(() => client.query(
        `INSERT INTO tb_screening (visit_id, red_flags, status, flagged_by, last_updated_by)
         VALUES (1, '{fever}', 'suspected', ${USER_ID}, ${USER_ID})`,
      ));

      test("red flags and notes can be corrected while the visit is open", async () => {
        const res = await put("/visits/1/tb", { red_flags: ["fever", "night_sweats"], flag_notes: "Fixed", doctor_notes: "Seen" });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ red_flags: ["fever", "night_sweats"], flag_notes: "Fixed", status: "suspected", last_updated_by: ADMIN_ID });
      });

      test("the flag can be removed while the visit is open, and is attributed", async () => {
        const res = await put("/visits/1/tb", { status: "cleared" });
        expect(res.status).toBe(200);
        const { rows } = await client.query("SELECT status, reviewed_by, reviewed_at FROM tb_screening");
        expect(rows[0]).toMatchObject({ status: "cleared", reviewed_by: ADMIN_ID });
        expect(rows[0].reviewed_at).not.toBeNull();
      });

      test("unflagged visits and unknown results are rejected", async () => {
        expect((await put("/visits/2/tb", { flag_notes: "x" })).status).toBe(404);
        expect((await put("/visits/1/tb", { status: "removed" })).status).toBe(400);
      });
    });
  },
);
