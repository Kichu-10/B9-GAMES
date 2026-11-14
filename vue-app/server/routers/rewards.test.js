import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { after, test } from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "b9-rewards-test-"));
process.env.SQLITE_PATH = path.join(tempDir, "rewards.sqlite");
process.env.JWT_SECRET = "rewards-test-secret";

const [{ db, readPlatformSettings }, { createRewardsRouter }, { createAdminRouter }] = await Promise.all([
  import("../database.js"),
  import("./rewards.js"),
  import("./admin.js"),
]);

const app = express();
app.use(express.json());
app.use("/api/rewards", createRewardsRouter());
app.use("/api/admin", createAdminRouter(path.join(tempDir, "uploads")));

const userId = randomUUID();
const secondUserId = randomUUID();
const thirdUserId = randomUUID();
const fourthUserId = randomUUID();
const fifthUserId = randomUUID();
const adminId = randomUUID();
const tokenFor = (id) => jwt.sign({ id }, process.env.JWT_SECRET);
const userToken = tokenFor(userId);
const secondUserToken = tokenFor(secondUserId);
const thirdUserToken = tokenFor(thirdUserId);
const fourthUserToken = tokenFor(fourthUserId);
const fifthUserToken = tokenFor(fifthUserId);
const adminToken = tokenFor(adminId);

function addUser(id, username, role = "user") {
  db.prepare(`
    INSERT INTO users (id, username, country, role, balance_cents, status, created_at, referral_code)
    VALUES (?, ?, 'NP', ?, 1000, 'active', ?, ?)
  `).run(id, username, role, new Date().toISOString(), `B9${id.replaceAll("-", "").slice(0, 10).toUpperCase()}`);
}

function addApprovedDeposit(id, username, amountCents = 50000) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO transactions (id, user_id, username, type, amount_cents, status, created_at, processed_at)
    VALUES (?, ?, ?, 'deposit', ?, 'approved', ?, ?)
  `).run(randomUUID(), id, username, amountCents, now, now);
}

addUser(userId, "reward-user");
addUser(secondUserId, "second-user");
addUser(thirdUserId, "third-user");
addUser(fourthUserId, "fourth-user");
addUser(fifthUserId, "fifth-user");
addUser(adminId, "reward-admin", "admin");
addApprovedDeposit(thirdUserId, "third-user");
addApprovedDeposit(fourthUserId, "fourth-user");
db.prepare(`
  INSERT INTO transactions (id, user_id, username, type, amount_cents, status, created_at, processed_at)
  VALUES (?, ?, 'reward-user', 'deposit', 500000, 'approved', ?, ?)
`).run(randomUUID(), userId, new Date().toISOString(), new Date().toISOString());

after(() => {
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("daily check-in requires an approved deposit of at least 500", async () => {
  const initialDashboard = await request(app)
    .get("/api/rewards")
    .set("Authorization", `Bearer ${fifthUserToken}`)
    .expect(200);
  assert.equal(initialDashboard.body.daily.minimumDeposit, 500);
  assert.equal(initialDashboard.body.daily.depositEligible, false);
  assert.equal(initialDashboard.body.daily.claimable, false);
  await request(app)
    .post("/api/rewards/daily/claim")
    .set("Authorization", `Bearer ${fifthUserToken}`)
    .send({})
    .expect(403);

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO transactions (id, user_id, username, type, amount_cents, status, created_at, processed_at)
    VALUES (?, ?, 'fifth-user', 'deposit', ?, 'pending', ?, NULL)
  `).run(randomUUID(), fifthUserId, 50000, now);
  db.prepare(`
    INSERT INTO transactions (id, user_id, username, type, amount_cents, status, created_at, processed_at)
    VALUES (?, ?, 'fifth-user', 'deposit', ?, 'approved', ?, ?)
  `).run(randomUUID(), fifthUserId, 49900, now, now);

  const belowMinimumDashboard = await request(app)
    .get("/api/rewards")
    .set("Authorization", `Bearer ${fifthUserToken}`)
    .expect(200);
  assert.equal(belowMinimumDashboard.body.daily.depositEligible, false);
  assert.equal(belowMinimumDashboard.body.daily.claimable, false);

  db.prepare(`
    INSERT INTO transactions (id, user_id, username, type, amount_cents, status, created_at, processed_at)
    VALUES (?, ?, 'fifth-user', 'deposit', ?, 'approved', ?, ?)
  `).run(randomUUID(), fifthUserId, 50000, now, now);
  const eligibleDashboard = await request(app)
    .get("/api/rewards")
    .set("Authorization", `Bearer ${fifthUserToken}`)
    .expect(200);
  assert.equal(eligibleDashboard.body.daily.depositEligible, true);
  assert.equal(eligibleDashboard.body.daily.claimable, true);
  await request(app)
    .post("/api/rewards/daily/claim")
    .set("Authorization", `Bearer ${fifthUserToken}`)
    .send({})
    .expect(201);
});

test("daily claims, VIP progress, bonus code limits, and admin controls are enforced", async () => {
  const firstDashboard = await request(app)
    .get("/api/rewards")
    .set("Authorization", `Bearer ${userToken}`)
    .expect(200);
  assert.equal(firstDashboard.body.daily.claimDay, 1);
  assert.equal(firstDashboard.body.daily.claimAmount, 5);
  assert.equal(firstDashboard.body.cashback.enabled, false);
  assert.equal(firstDashboard.body.vip.tier, "Gold");
  await request(app)
    .get("/api/admin/rewards/settings")
    .set("Authorization", `Bearer ${userToken}`)
    .expect(403);

  const dailyClaim = await request(app)
    .post("/api/rewards/daily/claim")
    .set("Authorization", `Bearer ${userToken}`)
    .send({})
    .expect(201);
  assert.equal(dailyClaim.body.day, 1);
  assert.equal(dailyClaim.body.amount, 5);
  assert.equal(dailyClaim.body.balance, 15);

  await request(app)
    .post("/api/rewards/daily/claim")
    .set("Authorization", `Bearer ${userToken}`)
    .send({})
    .expect(409);

  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayText = yesterday.toISOString().slice(0, 10);
  db.prepare(`
    INSERT INTO daily_reward_claims (id, user_id, claim_date, streak_day, amount_cents, created_at)
    VALUES (?, ?, ?, 4, 2500, ?)
  `).run(randomUUID(), secondUserId, yesterdayText, `${yesterdayText}T12:00:00.000Z`);
  const streakDashboard = await request(app)
    .get("/api/rewards")
    .set("Authorization", `Bearer ${secondUserToken}`)
    .expect(200);
  assert.equal(streakDashboard.body.daily.claimDay, 5);
  assert.equal(streakDashboard.body.daily.claimAmount, 25);

  const missedDay = new Date();
  missedDay.setUTCDate(missedDay.getUTCDate() - 3);
  const missedDayText = missedDay.toISOString().slice(0, 10);
  db.prepare(`
    INSERT INTO daily_reward_claims (id, user_id, claim_date, streak_day, amount_cents, created_at)
    VALUES (?, ?, ?, 6, 3000, ?)
  `).run(randomUUID(), thirdUserId, missedDayText, `${missedDayText}T12:00:00.000Z`);
  const resetDashboard = await request(app)
    .get("/api/rewards")
    .set("Authorization", `Bearer ${thirdUserToken}`)
    .expect(200);
  assert.equal(resetDashboard.body.daily.claimDay, 1);
  const concurrentClaims = await Promise.all([
    request(app).post("/api/rewards/daily/claim").set("Authorization", `Bearer ${thirdUserToken}`).send({}),
    request(app).post("/api/rewards/daily/claim").set("Authorization", `Bearer ${thirdUserToken}`).send({}),
  ]);
  assert.deepEqual(concurrentClaims.map((response) => response.status).sort(), [201, 409]);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM ledger_entries WHERE user_id = ?").get(thirdUserId).count,
    1,
  );

  const createdCode = await request(app)
    .post("/api/admin/bonus-codes")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      code: "WEEKLY10",
      amount: 10,
      terms: "One use per account.",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      maxRedemptions: 1,
    })
    .expect(201);
  assert.equal(createdCode.body.code, "WEEKLY10");
  const codeList = await request(app)
    .get("/api/admin/bonus-codes")
    .set("Authorization", `Bearer ${adminToken}`)
    .expect(200);
  assert.equal(codeList.body.codes[0].redemptionCount, 0);

  const preview = await request(app)
    .post("/api/rewards/bonus-codes/preview")
    .set("Authorization", `Bearer ${userToken}`)
    .send({ code: "WEEKLY10" })
    .expect(200);
  assert.equal(preview.body.amount, 10);
  assert.equal(preview.body.terms, "One use per account.");

  const redemption = await request(app)
    .post("/api/rewards/bonus-codes/redeem")
    .set("Authorization", `Bearer ${userToken}`)
    .send({ code: "weekly10" })
    .expect(201);
  assert.equal(redemption.body.amount, 10);
  assert.equal(redemption.body.balance, 25);

  await request(app)
    .post("/api/rewards/bonus-codes/redeem")
    .set("Authorization", `Bearer ${userToken}`)
    .send({ code: "WEEKLY10" })
    .expect(409);
  await request(app)
    .post("/api/rewards/bonus-codes/redeem")
    .set("Authorization", `Bearer ${secondUserToken}`)
    .send({ code: "WEEKLY10" })
    .expect(409);

  await request(app)
    .patch(`/api/admin/bonus-codes/${createdCode.body.id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ active: false })
    .expect(200);
  await request(app)
    .post("/api/rewards/bonus-codes/redeem")
    .set("Authorization", `Bearer ${secondUserToken}`)
    .send({ code: "WEEKLY10" })
    .expect(404);

  const updatedSettings = await request(app)
    .patch("/api/admin/rewards/settings")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      dailyEnabled: true,
      dailyRewards: [11, 12, 13, 14, 15, 16, 17],
      dailyResetTimezone: "Asia/Kathmandu",
      streakResetOnMissedDay: false,
      vipEnabled: true,
      vipWindowDays: 60,
      vipTiers: { silver: 1100, gold: 5500, platinum: 27500 },
      cashbackEnabled: true,
      cashbackRate: 7.5,
      cashbackWeeklyCap: 75,
    })
    .expect(200);
  assert.equal(updatedSettings.body.settings.dailyRewards[0], 11);
  assert.equal(updatedSettings.body.settings.dailyResetTimezone, "Asia/Kathmandu");

  const configuredDashboard = await request(app)
    .get("/api/rewards")
    .set("Authorization", `Bearer ${fourthUserToken}`)
    .expect(200);
  assert.equal(configuredDashboard.body.daily.claimAmount, 11);
  assert.equal(configuredDashboard.body.daily.streakResetOnMissedDay, false);
  assert.equal(configuredDashboard.body.vip.windowDays, 60);
  assert.equal(configuredDashboard.body.cashback.enabled, false);
  assert.equal(configuredDashboard.body.cashback.configuredEnabled, true);
  assert.equal(configuredDashboard.body.cashback.rate, 7.5);
  assert.equal(configuredDashboard.body.cashback.weeklyCap, 75);

  const configuredClaim = await request(app)
    .post("/api/rewards/daily/claim")
    .set("Authorization", `Bearer ${fourthUserToken}`)
    .send({})
    .expect(201);
  assert.equal(configuredClaim.body.amount, 11);

  await request(app)
    .patch("/api/admin/rewards/settings")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      dailyEnabled: false,
      dailyRewards: [11, 12, 13, 14, 15, 16, 17],
      dailyResetTimezone: "UTC",
      streakResetOnMissedDay: true,
      vipEnabled: true,
      vipWindowDays: 60,
      vipTiers: { silver: 1100, gold: 5500, platinum: 27500 },
      cashbackEnabled: false,
      cashbackRate: 7.5,
      cashbackWeeklyCap: 75,
    })
    .expect(200);
  await request(app)
    .patch("/api/admin/rewards/settings")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      dailyEnabled: true,
      dailyRewards: [11, 12, 13, 14, 15, 16, 17],
      dailyResetTimezone: "not-a-timezone",
      streakResetOnMissedDay: false,
      vipEnabled: true,
      vipWindowDays: 60,
      vipTiers: { silver: 1100, gold: 5500, platinum: 27500 },
      cashbackEnabled: false,
      cashbackRate: 7.5,
      cashbackWeeklyCap: 75,
    })
    .expect(400);
  await request(app)
    .post("/api/rewards/daily/claim")
    .set("Authorization", `Bearer ${secondUserToken}`)
    .send({})
    .expect(409);

  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM ledger_entries WHERE user_id = ?").get(userId).count,
    2,
  );
});

test("admin can persist customer payment details and the homepage jackpot display", async () => {
  const updatedSettings = {
    announcement: "Scheduled maintenance tonight",
    maintenanceMode: true,
    supportEmail: "help@example.com",
    supportPhone: "+977 9800000000",
    supportHours: "9:00-18:00",
    bankName: "Example Bank",
    accountName: "B9 Operations",
    accountNumber: "123456789",
    iban: "NP00EXAMPLE123",
    upiId: "b9@example",
    walletName: "Example Wallet",
    walletNumber: "9800000000",
    paymentInstructions: "Include your username in the transfer note.",
    jackpotAmount: 123456.78,
    promotions: [],
  };
  const response = await request(app)
    .patch("/api/admin/settings")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(updatedSettings)
    .expect(200);

  assert.equal(response.body.settings.bankName, "Example Bank");
  assert.equal(response.body.settings.jackpotAmount, 123456.78);
  assert.equal(readPlatformSettings().accountNumber, "123456789");
  assert.equal(readPlatformSettings().paymentInstructions, "Include your username in the transfer note.");

  await request(app)
    .patch("/api/admin/settings")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ ...updatedSettings, jackpotAmount: -1 })
    .expect(400);

  assert.equal(readPlatformSettings().jackpotAmount, 123456.78);
});
