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
        CREATE TEMP TABLE users (id INT PRIMARY KEY, username TEXT, role TEXT, is_active BOOLEAN, screening_date DATE, permissions TEXT[]);
        INSERT INTO users (id, username, role, is_active) VALUES (${ADMIN_ID},'admin','admin',TRUE),(${USER_ID},'user','user',TRUE);
        CREATE TEMP TABLE patients (id INT PRIMARY KEY); INSERT INTO patients VALUES (1), (2);`);
      // Real table definitions, so constraints match production.
      const setup = fs
        .readFileSync(path.join(__dirname, "../db_setup.sql"), "utf8")
        .replace(/\r\n/g, "\n");
      for (const table of ["visits", "tb_screening", "vitals", "hef"]) {
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
      await client.query(`TRUNCATE visits, tb_screening, vitals, hef RESTART IDENTITY CASCADE;
        INSERT INTO visits (patient_id, queue_no, visit_date, last_updated_by)
          VALUES (1, '1', '2026-10-01', ${USER_ID}), (2, '2', '2026-10-01', ${USER_ID});`);
    });

    afterAll(async () => {
      if (client) await client.end();
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    });

    test.each([
      ["/visits/1", { sticker_colour: "gold" }],
      ["/visits/1/vitals", { vitals }],
      ["/visits/1/tb", { flag_notes: "x" }],
    ])("users can correct %s on today's visit, attributed to them", async (url, body) => {
      // Accounts other than the admin only change the visits of the day (utils/dayScope.js).
      await client.query(`UPDATE visits SET visit_date = '${require("../utils/queueNumber").currentVisitDate()}' WHERE id = 1`);
      expect((await put(url.replace("/visits/1", "/visits/2"), body, "user")).status).toBe(403); // another day's visit
      if (url.endsWith("/tb")) {
        await client.query(`INSERT INTO tb_screening (visit_id, red_flags, status, flagged_by, last_updated_by)
          VALUES (1, '{fever}', 'suspected', ${ADMIN_ID}, ${ADMIN_ID})`);
      }
      const res = await put(url, body, "user");
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).toContain(`"last_updated_by":${USER_ID}`);
    });

    test("only an admin can delete a visit", async () => {
      const remove = (role) => request(app).delete("/visits/2").set("Authorization", "Bearer " + token(role));
      expect((await remove("user")).status).toBe(403);
      expect((await client.query("SELECT id FROM visits WHERE id = 2")).rows).toHaveLength(1);
    });

    test("visit details are corrected and attributed to the admin", async () => {
      const res = await put("/visits/1", { queue_no: "b7", visit_date: "2026-10-02" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ queue_no: "B7", visit_date: "2026-10-02", last_updated_by: ADMIN_ID });
      expect(res.body).not.toHaveProperty("location_id");
    });

    test("the sticker colour can be set, changed and cleared on its own", async () => {
      expect((await put("/visits/1", { sticker_colour: "gold" })).body).toMatchObject({ queue_no: "1", sticker_colour: "gold", last_updated_by: ADMIN_ID });
      expect((await put("/visits/1", { queue_no: "1" })).body.sticker_colour).toBe("gold");
      expect((await put("/visits/1", { sticker_colour: "tartan" })).status).toBe(400);
      expect((await put("/visits/1", { sticker_colour: null })).body.sticker_colour).toBeNull();
    });

    test("a number ahead of the sequence is rejected, so later numbers do not skip", async () => {
      // Visits 1 and 2 hold numbers 1 and 2; leaving visit 1 out, the next number is 3.
      const res = await put("/visits/1", { queue_no: "23" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/ahead of the next number, 3.*e\.g\. 2A/);
      expect((await put("/visits/1", { queue_no: "4A" })).status).toBe(400);
      expect((await client.query("SELECT queue_no FROM visits WHERE id = 1")).rows[0].queue_no).toBe("1");
    });

    test("numbers within the sequence and suffixes of issued numbers are allowed", async () => {
      expect((await put("/visits/1", { queue_no: "2a" })).body.queue_no).toBe("2A");
      expect((await put("/visits/1", { queue_no: "3" })).body.queue_no).toBe("3");
    });

    test("an unchanged older number is kept when other details are saved", async () => {
      await client.query(`INSERT INTO visits (patient_id, queue_no, visit_date, last_updated_by)
        VALUES (3, '50', '2026-10-01', ${USER_ID})`);
      expect((await put("/visits/3", { queue_no: "50", visit_date: "2026-10-01" })).status).toBe(200);
    });

    test("a queue number already used on the date is rejected", async () => {
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
      [{ location_id: 2 }], // locations are gone; only the location given is nothing to save
      [{}],
    ])("invalid visit details %j are rejected", async (body) => {
      expect((await put("/visits/1", body)).status).toBe(400);
    });

    test("unknown visits are reported", async () => {
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

    test("the NSSF answers can be corrected; left out they keep their value", async () => {
      const nssf = async () => (await client.query("SELECT has_nssf, uses_hef_nssf FROM hef WHERE visit_id = 1")).rows[0];
      const hef = { know_of_hef: true, has_hef: true, notes: "" };
      expect((await put("/visits/1/vitals", { hef: { ...hef, has_nssf: true, uses_hef_nssf: false } })).status).toBe(200);
      expect(await nssf()).toEqual({ has_nssf: true, uses_hef_nssf: false });
      await put("/visits/1/vitals", { hef: { ...hef, uses_hef_nssf: null } });
      expect(await nssf()).toEqual({ has_nssf: true, uses_hef_nssf: null });
      expect((await put("/visits/1/vitals", { hef: { ...hef, has_nssf: "yes" } })).status).toBe(400);
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
        const redFlags = ["fever", "night_sweats", "weight_loss"];
        const res = await put("/visits/1/tb", { red_flags: redFlags, flag_notes: "Fixed", doctor_notes: "Seen" });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ red_flags: redFlags, flag_notes: "Fixed", status: "suspected", last_updated_by: ADMIN_ID });
      });

      test("a flag cannot be changed to fewer than 3 red flags", async () => {
        const res = await put("/visits/1/tb", { red_flags: ["fever", "night_sweats"] });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/3 or more red flags/);
        expect((await client.query("SELECT red_flags FROM tb_screening")).rows[0].red_flags).toEqual(["fever"]);
        // Removing the flag is still allowed whatever the count.
        expect((await put("/visits/1/tb", { red_flags: ["fever"], status: "cleared" })).status).toBe(200);
        expect((await put("/visits/1/tb", { status: "suspected" })).status).toBe(400);
      });

      test("an older flag with fewer red flags keeps them when only notes change", async () => {
        const res = await put("/visits/1/tb", { red_flags: ["fever"], status: "suspected", doctor_notes: "Seen" });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ red_flags: ["fever"], doctor_notes: "Seen" });
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
