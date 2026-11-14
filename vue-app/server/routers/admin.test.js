import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { after, test } from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "b9-admin-test-"));
process.env.SQLITE_PATH = path.join(tempDir, "admin.sqlite");
process.env.JWT_SECRET = "admin-test-secret";

const [{ db }, { createAdminRouter }] = await Promise.all([
  import("../database.js"),
  import("./admin.js"),
]);

const app = express();
app.use(express.json());
app.use("/api/admin", createAdminRouter(path.join(tempDir, "uploads")));

const adminId = randomUUID();
const userId = randomUUID();
db.prepare(`
  INSERT INTO users (id, username, role, status, created_at)
  VALUES (?, 'admin-queue-test', 'admin', 'active', ?)
`).run(adminId, new Date().toISOString());
db.prepare(`
  INSERT INTO users (id, username, role, status, created_at)
  VALUES (?, 'queue-test-user', 'user', 'active', ?)
`).run(userId, new Date().toISOString());
const adminToken = jwt.sign({ id: adminId }, process.env.JWT_SECRET);

after(() => {
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("admin transaction and support queues include records beyond the former 100-item cap", async () => {
  const firstTransactionId = randomUUID();
  const firstTicketId = randomUUID();
  const now = new Date().toISOString();
  const addTransaction = db.prepare(`
    INSERT INTO transactions (id, user_id, username, type, amount_cents, status, created_at)
    VALUES (?, ?, 'queue-test-user', 'deposit', 100, 'pending', ?)
  `);
  const addTicket = db.prepare(`
    INSERT INTO support_tickets (id, user_id, username, subject, message, status, created_at, updated_at)
    VALUES (?, ?, 'queue-test-user', 'Queue test', 'Test message', 'open', ?, ?)
  `);

  for (let index = 0; index < 101; index += 1) {
    addTransaction.run(index === 0 ? firstTransactionId : randomUUID(), userId, now);
    addTicket.run(index === 0 ? firstTicketId : randomUUID(), userId, now, now);
  }

  const transactions = await request(app)
    .get("/api/admin/transactions")
    .set("Authorization", `Bearer ${adminToken}`)
    .expect(200);
  const tickets = await request(app)
    .get("/api/admin/support")
    .set("Authorization", `Bearer ${adminToken}`)
    .expect(200);

  assert.equal(transactions.body.transactions.length, 101);
  assert.equal(transactions.body.transactions.some((item) => item.id === firstTransactionId), true);
  assert.equal(tickets.body.tickets.length, 101);
  assert.equal(tickets.body.tickets.some((item) => item.id === firstTicketId), true);
});

test("admin can save and upload homepage banner content", async () => {
  const homepageBanner = {
    active: true,
    title: "Welcome",
    description: "Explore new games",
    buttonLabel: "Play now",
    buttonLink: "/games",
    bannerImage: "",
    bannerIncludesText: false,
  };
  await request(app)
    .patch("/api/admin/settings")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ homepageBanner: { ...homepageBanner, buttonLink: "https://example.com" }, promotions: [] })
    .expect(400);

  db.prepare(`
    INSERT INTO platform_settings (id, promotions) VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET promotions = excluded.promotions
  `).run(JSON.stringify([{ id: "draft-offer", title: "" }]));
  const saved = await request(app)
    .patch("/api/admin/homepage/banner/settings")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(homepageBanner)
    .expect(200);
  assert.deepEqual(saved.body.homepageBanner, homepageBanner);

  const uploaded = await request(app)
    .post("/api/admin/homepage/banner")
    .set("Authorization", `Bearer ${adminToken}`)
    .attach("banner", Buffer.from([0xff, 0xd8, 0xff, 0x00]), { filename: "homepage.jpg", contentType: "image/jpeg" })
    .expect(200);
  const filename = uploaded.body.homepageBanner.bannerImage;
  assert.match(filename, /^homepage-[a-f0-9-]+\.jpg$/i);
  assert.equal(fs.existsSync(path.join(tempDir, "uploads", "homepage-banners", filename)), true);

  homepageBanner.bannerImage = "";
  const removed = await request(app)
    .patch("/api/admin/homepage/banner/settings")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(homepageBanner)
    .expect(200);
  assert.deepEqual(removed.body.settings.homepageBanner, homepageBanner);
  assert.equal(fs.existsSync(path.join(tempDir, "uploads", "homepage-banners", filename)), false);
});
