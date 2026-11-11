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
   CREATE TEMP TABLE patients (id INT PRIMARY KEY); INSERT INTO patients VALUES (1);
   CREATE TEMP TABLE visits (id INT PRIMARY KEY, patient_id INT, visit_date DATE);
   INSERT INTO visits VALUES (1, 1, '${require("../utils/queueNumber").currentVisitDate()}');
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
        "consultation",
        "referral",
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
    test.each([
      ["/triage/visual-acuity", "visual_acuity", { visit_id: 1, notes: "First" }],
      ["/triage/presenting-complaint", "presenting_complaint", { visit_id: 1, history: "First" }],
      ["/triage/history", "history", { visit_id: 1, past: "First" }],
      ["/visits/seva/1", "seva", { diagnosis: "First" }],
      ["/visits/physiotherapy/1", "physiotherapy", { notes: "First", painpoints: [] }],
      ["/visits/dental/1", "dental", { notes: "First" }],
      ["/visits/consultation/1", "consultation", { notes: "First" }],
      ["/visits/referral/1", "referral", { reason: "First" }],
    ])("%s: a save from a form opened before another device saved is refused (409)", async (url, table, body) => {
      await client.query(`TRUNCATE ${table} CASCADE`);
      const field = Object.keys(body).find((key) => !["visit_id", "painpoints"].includes(key));
      const save = (changes) => request(app).post(url).set("Authorization", "Bearer " + token("user")).send({ ...body, ...changes });
      const version = async () => (await client.query(`SELECT last_updated_at FROM ${table}`)).rows[0].last_updated_at.toISOString();
      const text = async () => (await client.query(`SELECT ${field} FROM ${table}`)).rows[0][field];

      expect((await save({ expected_updated_at: null })).status).toBe(200); // first entry: no record yet
      const seen = await version();
      expect((await save({ [field]: "Other device", expected_updated_at: seen })).status).toBe(200);
      // This form still has the version from before the other device saved.
      const stale = await save({ [field]: "Stale", expected_updated_at: seen });
      expect(stale.status).toBe(409);
      expect(stale.body.error).toMatch(/saved on another device after you opened it/);
      expect(new Date(stale.body.last_updated_at).toISOString()).toBe(await version());
      expect(await text()).toBe("Other device");
      // A form that saw no record, when there is one now, is refused too.
      expect((await save({ [field]: "Stale", expected_updated_at: null })).status).toBe(409);
      // With the current version it saves; an app that sends none keeps "the later save wins".
      expect((await save({ [field]: "Mine", expected_updated_at: await version() })).status).toBe(200);
      expect((await save({ [field]: "Older app" })).status).toBe(200);
      expect(await text()).toBe("Older app");
      expect((await save({ expected_updated_at: "yesterday" })).status).toBe(400);
    });
    test.each([
      ["/triage/history", "history", { visit_id: 1, past: "First" }],
      ["/visits/consultation/1", "consultation", { notes: "First" }],
      ["/visits/dental/1", "dental", { notes: "First" }],
    ])("%s: of several devices saving the same version at once, only the first is kept", async (url, table, body) => {
      await client.query(`TRUNCATE ${table} CASCADE`);
      const field = Object.keys(body).find((key) => key !== "visit_id");
      const save = (changes) => request(app).post(url).set("Authorization", "Bearer " + token("user")).send({ ...body, ...changes });
      // Two forms opened before anything was saved, then five opened on the same saved version.
      const firsts = await Promise.all([1, 2].map((n) => save({ [field]: `New ${n}`, expected_updated_at: null })));
      expect(firsts.map((r) => r.status).sort()).toEqual([200, 409]);
      const seen = (await client.query(`SELECT last_updated_at FROM ${table}`)).rows[0].last_updated_at.toISOString();
      const saves = await Promise.all([1, 2, 3, 4, 5].map((n) => save({ [field]: `Device ${n}`, expected_updated_at: seen })));
      const kept = saves.filter((r) => r.status === 200);
      expect(kept).toHaveLength(1);
      expect(saves.filter((r) => r.status === 409)).toHaveLength(4);
      expect((await client.query(`SELECT ${field} FROM ${table}`)).rows[0][field]).toBe(kept[0].body[field]);
    });
    test("a referral save or delete gives this device the notes' new version, so its next notes save goes through", async () => {
      await client.query("TRUNCATE consultation, referral CASCADE");
      const as = (method, url, body) => request(app)[method](url).set("Authorization", "Bearer " + token("admin")).send(body);
      const notes = await as("post", "/visits/consultation/1", { notes: "Seen", expected_updated_at: null });
      // Saving the referral also marks the consultation as needing one, which changes its version.
      const referral = await as("post", "/visits/referral/1", { reason: "Glasses", expected_updated_at: null });
      expect(referral.status).toBe(200);
      expect(referral.body.consultation_updated_at).not.toBe(notes.body.last_updated_at);
      expect((await as("post", "/visits/consultation/1", { notes: "Old version", expected_updated_at: notes.body.last_updated_at })).status).toBe(409);
      const saved = await as("post", "/visits/consultation/1", { notes: "Later", expected_updated_at: referral.body.consultation_updated_at });
      expect(saved.status).toBe(200);

      const removed = await as("delete", "/visits/referral/1");
      expect(removed.status).toBe(200);
      expect((await as("post", "/visits/consultation/1", { notes: "After delete", expected_updated_at: removed.body.consultation_updated_at })).status).toBe(200);
      // A referral without saved notes: there is no consultation version to pass on.
      await client.query("TRUNCATE consultation CASCADE");
      expect((await as("post", "/visits/referral/1", { reason: "Alone" })).body.consultation_updated_at).toBeNull();
    });
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
