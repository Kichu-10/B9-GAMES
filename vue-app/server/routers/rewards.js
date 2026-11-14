import express from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, fromCents, readRewardSettings, readUserById, toCents } from "../database.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const bonusCodeSchema = z.object({
  code: z.string().trim().min(3).max(32).regex(/^[A-Z0-9_-]+$/i),
});
const DAILY_CHECKIN_MINIMUM_DEPOSIT = 500;

function hasQualifyingDailyDeposit(userId) {
  return Boolean(db.prepare(`
    SELECT id FROM transactions
    WHERE user_id = ? AND type = 'deposit' AND status = 'approved' AND amount_cents >= ?
    LIMIT 1
  `).get(userId, toCents(DAILY_CHECKIN_MINIMUM_DEPOSIT)));
}

function dateInTimezone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function previousUtcDate(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function getDailyRewardState(userId, settings, now = new Date()) {
  const today = dateInTimezone(now, settings.dailyResetTimezone);
  const dailyRewards = settings.dailyRewards;
  const depositEligible = hasQualifyingDailyDeposit(userId);
  const lastClaim = db.prepare(`
    SELECT claim_date AS claimDate, streak_day AS streakDay, amount_cents AS amountCents
    FROM daily_reward_claims WHERE user_id = ? ORDER BY claim_date DESC LIMIT 1
  `).get(userId);
  const claimedToday = lastClaim?.claimDate === today;
  const continuesStreak = lastClaim?.claimDate === previousUtcDate(today);
  const claimDay = claimedToday
    ? lastClaim.streakDay
    : lastClaim
      && (continuesStreak || !settings.streakResetOnMissedDay)
      && lastClaim.streakDay < dailyRewards.length
      ? lastClaim.streakDay + 1
      : 1;
  const history = db.prepare(`
    SELECT claim_date AS claimDate, streak_day AS day, amount_cents AS amountCents
    FROM daily_reward_claims WHERE user_id = ? ORDER BY claim_date DESC LIMIT 7
  `).all(userId).map((claim) => ({
    claimDate: claim.claimDate,
    day: claim.day,
    amount: fromCents(claim.amountCents),
  }));
  return {
    today,
    claimedToday,
    enabled: settings.dailyEnabled,
    depositEligible,
    minimumDeposit: DAILY_CHECKIN_MINIMUM_DEPOSIT,
    claimable: settings.dailyEnabled && depositEligible && !claimedToday,
    claimDay,
    claimAmount: dailyRewards[claimDay - 1],
    streakDays: claimedToday || continuesStreak || (lastClaim && !settings.streakResetOnMissedDay)
      ? lastClaim.streakDay
      : 0,
    resetTimezone: settings.dailyResetTimezone,
    streakResetOnMissedDay: settings.streakResetOnMissedDay,
    rewards: dailyRewards,
    history,
  };
}

function getVipState(userId, settings, now = new Date()) {
  const since = new Date(now.getTime() - settings.vipWindowDays * 24 * 60 * 60 * 1000).toISOString();
  const totalCents = Number(db.prepare(`
    SELECT COALESCE(SUM(amount_cents), 0) AS total
    FROM transactions
    WHERE user_id = ? AND type = 'deposit' AND status = 'approved'
      AND processed_at >= ?
  `).get(userId, since).total);
  const totalDeposits = fromCents(totalCents);
  const vipTiers = [
    { name: "Bronze", threshold: 0 },
    { name: "Silver", threshold: settings.vipTiers.silver },
    { name: "Gold", threshold: settings.vipTiers.gold },
    { name: "Platinum", threshold: settings.vipTiers.platinum },
  ];
  let tierIndex = 0;
  for (let index = 1; index < vipTiers.length; index += 1) {
    if (totalDeposits >= vipTiers[index].threshold) tierIndex = index;
  }
  const currentTier = vipTiers[tierIndex];
  const nextTier = vipTiers[tierIndex + 1] || null;
  const previousThreshold = currentTier.threshold;
  const progress = nextTier
    ? Math.min(100, Math.max(0, ((totalDeposits - previousThreshold) / (nextTier.threshold - previousThreshold)) * 100))
    : 100;
  return {
    enabled: settings.vipEnabled,
    tier: currentTier.name,
    totalDeposits,
    nextTier: nextTier?.name || null,
    nextThreshold: nextTier?.threshold || null,
    remaining: nextTier ? Math.max(0, nextTier.threshold - totalDeposits) : 0,
    progress,
    windowDays: settings.vipWindowDays,
    tiers: vipTiers,
  };
}

function creditWallet({ userId, amountCents, reference, now }) {
  const updated = db.prepare(`
    UPDATE users SET balance_cents = balance_cents + ?
    WHERE id = ? AND status = 'active'
  `).run(amountCents, userId);
  if (updated.changes !== 1) throw new Error("Account unavailable");
  const user = db.prepare("SELECT balance_cents FROM users WHERE id = ?").get(userId);
  db.prepare(`
    INSERT INTO ledger_entries (id, user_id, transaction_id, type, amount_cents, balance_cents, reference, created_at)
    VALUES (?, ?, NULL, 'credit', ?, ?, ?, ?)
  `).run(randomUUID(), userId, amountCents, user.balance_cents, reference, now);
  return fromCents(user.balance_cents);
}

export function createRewardsRouter() {
  const router = express.Router();
  router.use(authenticate);

  router.get("/", (req, res) => {
    const user = readUserById(req.user.id);
    if (!user || user.status !== "active") return res.status(403).json({ error: "Account unavailable" });
    const settings = readRewardSettings();
    res.setHeader("Cache-Control", "no-store, private");
    return res.json({
      daily: getDailyRewardState(user.id, settings),
      vip: getVipState(user.id, settings),
      cashback: {
        enabled: false,
        configuredEnabled: settings.cashbackEnabled,
        rate: settings.cashbackRate,
        weeklyCap: settings.cashbackWeeklyCap,
        message: "Cashback is unavailable until verified game settlement data is connected.",
      },
    });
  });

  router.post("/bonus-codes/preview", validate(bonusCodeSchema), (req, res) => {
    const user = readUserById(req.user.id);
    if (!user || user.status !== "active") return res.status(403).json({ error: "Account unavailable" });
    const now = new Date().toISOString();
    const code = db.prepare(`
      SELECT id, code, amount_cents AS amountCents, terms, expires_at AS expiresAt,
        max_redemptions AS maxRedemptions, active
      FROM bonus_codes WHERE code = ? COLLATE NOCASE
    `).get(req.body.code.toUpperCase());
    if (!code || !code.active || code.expiresAt <= now) {
      return res.status(404).json({ error: "This bonus code is invalid or expired" });
    }
    if (db.prepare(`
      SELECT id FROM bonus_code_redemptions WHERE code_id = ? AND user_id = ?
    `).get(code.id, req.user.id)) {
      return res.status(409).json({ error: "You have already redeemed this bonus code" });
    }
    const redemptions = Number(db.prepare(`
      SELECT COUNT(*) AS count FROM bonus_code_redemptions WHERE code_id = ?
    `).get(code.id).count);
    if (code.maxRedemptions !== null && redemptions >= code.maxRedemptions) {
      return res.status(409).json({ error: "This bonus code has reached its redemption limit" });
    }
    return res.json({
      code: code.code,
      amount: fromCents(code.amountCents),
      terms: code.terms,
      expiresAt: code.expiresAt,
    });
  });

  router.post("/daily/claim", (req, res) => {
    const user = readUserById(req.user.id);
    if (!user || user.status !== "active") return res.status(403).json({ error: "Account unavailable" });

    const now = new Date();
    let claimDate = "";
    let response;
    db.exec("BEGIN IMMEDIATE");
    try {
      const currentUser = db.prepare("SELECT status FROM users WHERE id = ?").get(req.user.id);
      if (currentUser?.status !== "active") {
        db.exec("ROLLBACK");
        return res.status(403).json({ error: "Account unavailable" });
      }
      const settings = readRewardSettings();
      if (!settings.dailyEnabled) {
        db.exec("ROLLBACK");
        return res.status(409).json({ error: "Daily rewards are currently disabled" });
      }
      if (!hasQualifyingDailyDeposit(req.user.id)) {
        db.exec("ROLLBACK");
        return res.status(403).json({
          error: `An approved deposit of at least ${DAILY_CHECKIN_MINIMUM_DEPOSIT} is required to claim daily check-in`,
        });
      }
      claimDate = dateInTimezone(now, settings.dailyResetTimezone);
      const existingClaim = db.prepare(`
        SELECT id FROM daily_reward_claims WHERE user_id = ? AND claim_date = ?
      `).get(req.user.id, claimDate);
      if (existingClaim) {
        db.exec("ROLLBACK");
        return res.status(409).json({ error: "Today's daily reward has already been claimed" });
      }
      const previousClaim = db.prepare(`
        SELECT claim_date AS claimDate, streak_day AS streakDay
        FROM daily_reward_claims WHERE user_id = ? ORDER BY claim_date DESC LIMIT 1
      `).get(req.user.id);
      const streakDay = previousClaim?.claimDate === previousUtcDate(claimDate)
        && previousClaim.streakDay < settings.dailyRewards.length
        ? previousClaim.streakDay + 1
        : previousClaim && !settings.streakResetOnMissedDay
          && previousClaim.streakDay < settings.dailyRewards.length
          ? previousClaim.streakDay + 1
          : 1;
      const amountCents = toCents(settings.dailyRewards[streakDay - 1]);
      const claimId = randomUUID();
      db.prepare(`
        INSERT INTO daily_reward_claims (id, user_id, claim_date, streak_day, amount_cents, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(claimId, req.user.id, claimDate, streakDay, amountCents, now.toISOString());
      const balance = creditWallet({
        userId: req.user.id,
        amountCents,
        reference: `Daily reward day ${streakDay}`,
        now: now.toISOString(),
      });
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, related_id, is_read, created_at)
        VALUES (?, ?, 'daily_reward', 'Daily reward credited', ?, ?, 0, ?)
      `).run(randomUUID(), req.user.id,
        `${fromCents(amountCents).toFixed(2)} has been credited for Day ${streakDay}.`,
        claimId, now.toISOString());
      db.exec("COMMIT");
      response = { day: streakDay, amount: fromCents(amountCents), balance };
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return res.status(201).json(response);
  });

  router.post("/bonus-codes/redeem", validate(bonusCodeSchema), (req, res) => {
    const user = readUserById(req.user.id);
    if (!user || user.status !== "active") return res.status(403).json({ error: "Account unavailable" });
    const codeText = req.body.code.toUpperCase();
    const now = new Date();
    let response;
    db.exec("BEGIN IMMEDIATE");
    try {
      const currentUser = db.prepare("SELECT status FROM users WHERE id = ?").get(req.user.id);
      if (currentUser?.status !== "active") {
        db.exec("ROLLBACK");
        return res.status(403).json({ error: "Account unavailable" });
      }
      const code = db.prepare(`
        SELECT id, code, amount_cents AS amountCents, terms, expires_at AS expiresAt,
          max_redemptions AS maxRedemptions, active
        FROM bonus_codes WHERE code = ? COLLATE NOCASE
      `).get(codeText);
      if (!code || !code.active || (code.expiresAt && code.expiresAt <= now.toISOString())) {
        db.exec("ROLLBACK");
        return res.status(404).json({ error: "This bonus code is invalid or expired" });
      }
      const existing = db.prepare(`
        SELECT id FROM bonus_code_redemptions WHERE code_id = ? AND user_id = ?
      `).get(code.id, req.user.id);
      if (existing) {
        db.exec("ROLLBACK");
        return res.status(409).json({ error: "You have already redeemed this bonus code" });
      }
      const redemptions = Number(db.prepare(`
        SELECT COUNT(*) AS count FROM bonus_code_redemptions WHERE code_id = ?
      `).get(code.id).count);
      if (code.maxRedemptions !== null && redemptions >= code.maxRedemptions) {
        db.exec("ROLLBACK");
        return res.status(409).json({ error: "This bonus code has reached its redemption limit" });
      }
      const redemptionId = randomUUID();
      db.prepare(`
        INSERT INTO bonus_code_redemptions (id, code_id, user_id, amount_cents, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(redemptionId, code.id, req.user.id, code.amountCents, now.toISOString());
      const balance = creditWallet({
        userId: req.user.id,
        amountCents: code.amountCents,
        reference: `Bonus code ${code.code}`,
        now: now.toISOString(),
      });
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, related_id, is_read, created_at)
        VALUES (?, ?, 'bonus_code', 'Bonus code redeemed', ?, ?, 0, ?)
      `).run(randomUUID(), req.user.id,
        `${fromCents(code.amountCents).toFixed(2)} has been credited to your Main Wallet.`,
        redemptionId, now.toISOString());
      db.exec("COMMIT");
      response = {
        amount: fromCents(code.amountCents),
        balance,
        terms: code.terms,
      };
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return res.status(201).json(response);
  });

  return router;
}
