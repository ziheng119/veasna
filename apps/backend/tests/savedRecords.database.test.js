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
  "Saved clinical records",
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
   CREATE TEMP TABLE users (id INT PRIMARY KEY, username TEXT, role TEXT, is_active BOOLEAN, screening_date DATE);
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
        "dental",
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
    });
    afterAll(async () => {
      if (client) await client.end();
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
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
      ["/visits/dental/1", "dental", { notes: "Initial", referral_needed: true }],
    ])(
      "%s: users create the record and can change it afterwards, like admins",
      async (url, table, body) => {
        const save = (role, payload) =>
          request(app)
            .post(url)
            .set("Authorization", "Bearer " + token(role))
            .send(payload);
        // The free-text field each form saves (notes, history, past, diagnosis).
        const field = "notes" in body ? "notes" : Object.keys(body).find((key) => key !== "visit_id");
        const saved = async () => (await client.query("SELECT * FROM " + table)).rows;
        expect((await save("user", body)).status).toBe(200);
        expect(await saved()).toHaveLength(1);
        // Doctors add what they find later at other stations (utils/permissions.js canEditSavedRecords).
        expect((await save("user", { ...body, [field]: "User change" })).status).toBe(200);
        expect((await saved())[0]).toMatchObject({ [field]: "User change", last_updated_by: 2 });
        expect((await save("admin", { ...body, [field]: "Admin change" })).status).toBe(200);
        const [row] = await saved();
        expect(row).toMatchObject({ [field]: "Admin change", last_updated_by: 1 });
        // Still one record per visit.
        expect(await saved()).toHaveLength(1);
      },
    );
    test("with glasses readings are optional and saved with the pinhole readings", async () => {
      const save = (url, body) =>
        request(app).post(url).set("Authorization", "Bearer " + token("admin")).send(body);
      expect((await save("/triage/visual-acuity", { visit_id: 1, left_with_glasses: "glasses" })).status).toBe(400);
      expect((await save("/triage/visual-acuity", { visit_id: 1, left_without_pinhole: "20/40", left_with_glasses: "20 / 25" })).status).toBe(200);
      expect((await client.query("SELECT left_without_pinhole, left_with_glasses, right_with_glasses FROM visual_acuity")).rows[0])
        .toEqual({ left_without_pinhole: "20/40", left_with_glasses: "20/25", right_with_glasses: null });
      expect((await save("/visits/seva/1", { diagnosis: "Cataract", right_with_glasses_new: "20/30" })).status).toBe(200);
      const seva = (await request(app).get("/visits/seva/1").set("Authorization", "Bearer " + token("admin"))).body;
      expect(seva).toMatchObject({ right_with_glasses_new: "20/30", left_with_glasses_new: null });
    });
  },
);
