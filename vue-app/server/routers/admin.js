import express from "express";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { z } from "zod";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  addManagedGame,
  changeBalance,
  db,
  decideTransaction,
  getGameCatalogPageSize,
  getGameManagementStats,
  getManagedGame,
  getManagedProvider,
  listGameCategories,
  listManagedGames,
  listManagedProviders,
  readDb,
  readRewardSettings,
  saveManagedProvider,
  setGameCatalogPageSize,
  toCents,
  updateManagedGame,
  updateManagedGameEnabled,
  writeDb,
  writeRewardSettings,
} from "../database.js";
import { approveTransaction } from "../services/wallet.js";
import { logger } from "../config/logger.js";
import {
  GameProviderError,
  currencyForCountry,
  displayCurrency,
  isHuiduConfigured,
  listAvailableProviderSources,
  listGamesFromProviderCode,
} from "../services/game-provider.js";

const transactionDecisionSchema = z.object({ status: z.enum(["approved", "rejected"]) });
const agentDecisionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(500).default(""),
});
const agentCommissionSchema = z.object({
  amount: z.number().finite().min(0.01).max(100000000),
  periodLabel: z.string().trim().min(1).max(80),
});
const agentCommissionDecisionSchema = z.object({
  status: z.enum(["paid", "rejected"]),
  note: z.string().trim().max(500).default(""),
});
const agentLimitDecisionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(500).default(""),
});
const referralDecisionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  amount: z.number().finite().min(0.01).max(100000000).optional(),
  note: z.string().trim().max(500).default(""),
}).refine((value) => value.status !== "approved" || value.amount !== undefined, {
  message: "An approved reward requires an amount",
  path: ["amount"],
});
const bonusCodeSchema = z.object({
  code: z.string().trim().min(3).max(32).regex(/^[A-Z0-9_-]+$/i),
  amount: z.number().finite().min(0.01).max(100000000),
  terms: z.string().trim().min(1).max(1000),
  expiresAt: z.string().trim().min(1).max(40),
  maxRedemptions: z.number().int().min(1).max(1000000).nullable().optional().default(null),
}).refine((value) => Number.isFinite(Date.parse(value.expiresAt)), {
  message: "Enter a valid expiry date",
  path: ["expiresAt"],
});
const bonusCodeActiveSchema = z.object({ active: z.boolean() });
const rewardSettingsSchema = z.object({
  dailyEnabled: z.boolean(),
  dailyRewards: z.array(z.number().finite().min(0).max(100000000)).length(7),
  dailyResetTimezone: z.string().trim().min(1).max(100).refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid time zone"),
  streakResetOnMissedDay: z.boolean(),
  vipEnabled: z.boolean(),
  vipWindowDays: z.number().int().min(1).max(365),
  vipTiers: z.object({
    silver: z.number().finite().min(0).max(100000000),
    gold: z.number().finite().min(0).max(100000000),
    platinum: z.number().finite().min(0).max(100000000),
  }).refine((tiers) => tiers.silver < tiers.gold && tiers.gold < tiers.platinum, {
    message: "VIP thresholds must increase from Silver to Gold to Platinum",
  }),
  cashbackEnabled: z.boolean(),
  cashbackRate: z.number().finite().min(0).max(100),
  cashbackWeeklyCap: z.number().finite().min(0).max(100000000),
});
const userUpdateSchema = z.object({
  status: z.enum(["active", "suspended"]).optional(),
  balance: z.number().finite().min(0).max(100000000).optional(),
  reason: z.string().trim().max(500).optional(),
}).refine((value) => value.status !== undefined
  || value.balance !== undefined, "Provide a user update");
const kycReviewSchema = z.object({ status: z.enum(["verified", "rejected"]), note: z.string().trim().max(1000).optional().default("") });
const homepageBannerSchema = z.object({
  active: z.boolean().default(false),
  title: z.string().trim().max(100).default(""),
  description: z.string().trim().max(300).default(""),
  buttonLabel: z.string().trim().max(32).default(""),
  buttonLink: z.enum(["/games", "/wallet", "/promotions", "/rewards"]).default("/games"),
  bannerImage: z.string().trim().max(100).regex(/^(|homepage-[a-f0-9-]+\.(jpg|png|webp))$/i).default(""),
  bannerIncludesText: z.boolean().default(false),
});
const settingsSchema = z.object({
  announcement: z.string().trim().max(500).default(""),
  maintenanceMode: z.boolean().default(false),
  supportEmail: z.string().trim().email().or(z.literal("")).default(""),
  supportPhone: z.string().trim().max(40).default(""),
  supportHours: z.string().trim().max(100).default(""),
  bankName: z.string().trim().max(120).default(""),
  accountName: z.string().trim().max(120).default(""),
  accountNumber: z.string().trim().max(80).default(""),
  iban: z.string().trim().max(80).default(""),
  upiId: z.string().trim().max(120).default(""),
  walletName: z.string().trim().max(80).default(""),
  walletNumber: z.string().trim().max(80).default(""),
  paymentInstructions: z.string().trim().max(1000).default(""),
  jackpotAmount: z.number().finite().min(0).max(1000000000000).default(10799004.2),
  homepageBanner: homepageBannerSchema.default({}),
  promotions: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).default(""),
    reward: z.string().trim().max(160).default(""),
    terms: z.string().trim().max(1000).default(""),
    bannerImage: z.string().trim().max(100).regex(/^(|promotion-[a-f0-9-]+\.(jpg|png|webp))$/i).default(""),
    bannerIncludesText: z.boolean().default(false),
    active: z.boolean().default(true),
  })).max(20).default([]),
});
const gameResultSchema = z.object({
  userId: z.string().min(1),
  category: z.enum(["bet", "lottery", "game"]),
  gameName: z.string().trim().max(100).optional().default(""),
  outcome: z.enum(["won", "lost"]),
  amount: z.coerce.number().finite().min(0).max(100000000),
  reference: z.string().trim().max(150).optional().default(""),
});
const providerCodeSchema = z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const managedProviderSchema = z.object({
  code: providerCodeSchema,
  name: z.string().trim().min(1).max(120).optional(),
  enabled: z.boolean().optional().default(false),
});
const providerUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
}).refine((value) => value.name !== undefined || value.enabled !== undefined, "Provide provider changes");
function validThumbnail(value) {
  return !value || (value.startsWith("/") && !value.startsWith("//")) || /^https:\/\//i.test(value);
}
const gameImportSchema = z.object({
  providerCode: providerCodeSchema,
  externalId: z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/),
  category: z.enum(["Mini Games", "Slots", "Fishing"]).optional().default("Mini Games"),
  isPopular: z.boolean().optional().default(false),
  thumbnail: z.string().trim().max(500).optional().default("").refine(
    validThumbnail,
    "Thumbnail must be an HTTPS URL or a site-relative path",
  ),
  sortOrder: z.number().int().min(-100000).max(100000).optional().default(0),
});
const bulkGameImportSchema = z.object({
  providerCode: providerCodeSchema,
  externalIds: z.array(z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/)).min(1).max(500)
    .refine((ids) => new Set(ids).size === ids.length, "Game IDs must be unique"),
});
const gameUpdateSchema = z.object({
  providerCode: providerCodeSchema.optional(),
  name: z.string().trim().min(1).max(160).optional(),
  thumbnail: z.string().trim().max(500).optional().refine(
    (value) => value === undefined || validThumbnail(value),
    "Thumbnail must be an HTTPS URL or a site-relative path",
  ),
  category: z.enum(["Mini Games", "Slots", "Fishing"]).optional(),
  sortOrder: z.number().int().min(-100000).max(100000).optional(),
  isPopular: z.boolean().optional(),
  enabled: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "Provide game changes");
const bulkGameEnabledSchema = z.object({
  gameIds: z.array(z.string().trim().min(1).max(120)).min(1).max(500)
    .refine((ids) => new Set(ids).size === ids.length, "Game IDs must be unique"),
  enabled: z.boolean(),
});
const catalogSettingsSchema = z.object({
  pageSize: z.number().int().min(1).max(100),
});

function normalizedGameName(name) {
  return String(name).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function recordGameManagementAudit(adminUserId, action, target, details) {
  const admin = db.prepare("SELECT username FROM users WHERE id = ?").get(adminUserId);
  db.prepare(`
    INSERT INTO audit_logs (id, admin_username, action, target, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), admin?.username || "admin", action, target, details, new Date().toISOString());
  db.prepare(`
    DELETE FROM audit_logs
    WHERE id NOT IN (SELECT id FROM audit_logs ORDER BY created_at DESC, rowid DESC LIMIT 1000)
  `).run();
}

function recordAgentAudit(adminUserId, action, target, details = "") {
  const admin = db.prepare("SELECT username FROM users WHERE id = ?").get(adminUserId);
  db.prepare(`
    INSERT INTO audit_logs (id, admin_username, action, target, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), admin?.username || "admin", action, target, details, new Date().toISOString());
  db.prepare(`
    DELETE FROM audit_logs
    WHERE id NOT IN (SELECT id FROM audit_logs ORDER BY created_at DESC, rowid DESC LIMIT 1000)
  `).run();
}

function catalogFailure(res, error, fallback) {
  if (error instanceof GameProviderError) {
    return res.status(error.status).json({ error: error.message, ...(error.code === undefined ? {} : { code: error.code }) });
  }
  logger.error("admin_game_management_failed", { error: error instanceof Error ? error.message : String(error) });
  return res.status(502).json({ error: fallback });
}

function addAudit(db, adminUsername, action, target, details = "") {
  db.auditLogs ||= [];
  db.auditLogs.unshift({ id: randomUUID(), adminUsername, action, target, details, createdAt: new Date().toISOString() });
  db.auditLogs.length = Math.min(db.auditLogs.length, 1000);
}

function addNotification(db, userId, type, title, message, relatedId = "") {
  db.notifications ||= [];
  db.notifications.unshift({
    id: randomUUID(), userId, type, title, message, relatedId, read: false, createdAt: new Date().toISOString(),
  });
  db.notifications.length = Math.min(db.notifications.length, 1000);
}

function publicUser(user) {
  const { passwordHash, avatarPath, ...safeUser } = user;
  return safeUser;
}

function identifyPromotionImage(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
  return "";
}

export function createAdminRouter(uploadDir) {
  const router = express.Router();
  const promotionImageDir = path.join(uploadDir, "promotion-banners");
  const homepageImageDir = path.join(uploadDir, "homepage-banners");
  const gameThumbnailDir = path.join(uploadDir, "game-thumbnails");
  const providerLogoDir = path.join(uploadDir, "provider-logos");
  fs.mkdirSync(promotionImageDir, { recursive: true });
  fs.mkdirSync(homepageImageDir, { recursive: true });
  fs.mkdirSync(gameThumbnailDir, { recursive: true });
  fs.mkdirSync(providerLogoDir, { recursive: true });
  function removeHomepageBannerImage(filename) {
    if (!filename) return;
    try {
      fs.rmSync(path.join(homepageImageDir, path.basename(filename)), { force: true });
    } catch (error) {
      logger.warn("homepage_banner_cleanup_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const uploadPromotionImage = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, callback) => callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)),
  });
  const uploadGameThumbnail = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, callback) => callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)),
  });
  const uploadProviderLogo = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, callback) => callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)),
  });
  router.use((req, res, next) => req.path === "/auth/login" ? next() : authenticate(req, res, next));
  router.use((req, res, next) => req.path === "/auth/login" ? next() : requireAdmin(req, res, next));

  router.get("/agents", (_req, res) => {
    const applications = db.prepare(`
      SELECT a.id, a.user_id AS userId, a.business_name AS businessName, a.experience, a.status,
        a.created_at AS createdAt, u.username, u.email, u.country
      FROM agent_applications a JOIN users u ON u.id = a.user_id
      WHERE a.status = 'pending' ORDER BY a.created_at ASC
    `).all();
    const agents = db.prepare(`
      SELECT id, username, email, country, agent_balance_cents AS balanceCents
      FROM users WHERE role = 'agent' ORDER BY username COLLATE NOCASE
    `).all().map((row) => ({ ...row, balance: row.balanceCents / 100 }));
    const requests = db.prepare(`
      SELECT r.id, r.agent_user_id AS agentUserId, r.player_user_id AS playerUserId,
        r.type, r.amount_cents AS amountCents, r.payment_method AS paymentMethod,
        r.payment_reference AS paymentReference, r.note, r.created_at AS createdAt,
        a.username AS agentUsername, p.username AS playerUsername
      FROM agent_requests r JOIN users a ON a.id = r.agent_user_id
      LEFT JOIN users p ON p.id = r.player_user_id
      WHERE r.status = 'pending' ORDER BY r.created_at ASC
    `).all().map((row) => ({ ...row, amount: row.amountCents / 100 }));
    const commissions = db.prepare(`
      SELECT c.id, c.agent_user_id AS agentUserId, c.amount_cents AS amountCents,
        c.period_label AS periodLabel, c.created_at AS createdAt, u.username AS agentUsername
      FROM agent_commissions c JOIN users u ON u.id = c.agent_user_id
      WHERE c.status = 'pending' ORDER BY c.created_at ASC
    `).all().map((row) => ({ ...row, amount: row.amountCents / 100 }));
    const limits = db.prepare(`
      SELECT l.id, l.agent_user_id AS agentUserId, l.player_user_id AS playerUserId,
        l.limit_cents AS limitCents, l.reason, l.created_at AS createdAt,
        a.username AS agentUsername, p.username AS playerUsername
      FROM agent_limit_requests l JOIN users a ON a.id = l.agent_user_id
      JOIN users p ON p.id = l.player_user_id
      WHERE l.status = 'pending' ORDER BY l.created_at ASC
    `).all().map((row) => ({ ...row, limit: row.limitCents / 100 }));
    res.json({ applications, agents, requests, commissions, limits });
  });

  router.get("/referrals", (_req, res) => {
    const referrals = db.prepare(`
      SELECT r.id, r.status, r.created_at AS createdAt,
        u.id AS referrerId, u.username AS referrerUsername, u.country AS referrerCountry,
        referred.username AS referredUsername
      FROM referral_rewards r
      JOIN users u ON u.id = r.referrer_user_id
      JOIN users referred ON referred.id = r.referred_user_id
      WHERE r.status = 'pending'
      ORDER BY r.created_at ASC LIMIT 500
    `).all();
    res.json({ referrals });
  });

  router.patch("/referrals/:id", validate(referralDecisionSchema), (req, res) => {
    const now = new Date().toISOString();
    const amountCents = req.body.status === "approved" ? toCents(req.body.amount) : 0;
    let auditTarget = "";
    let auditDetails = "";
    db.exec("BEGIN IMMEDIATE");
    try {
      const referral = db.prepare(`
        SELECT r.id, r.status, r.referrer_user_id AS referrerUserId,
          u.username AS referrerUsername, u.status AS referrerStatus,
          referred.username AS referredUsername
        FROM referral_rewards r
        JOIN users u ON u.id = r.referrer_user_id
        JOIN users referred ON referred.id = r.referred_user_id
        WHERE r.id = ?
      `).get(req.params.id);
      if (!referral) {
        db.exec("ROLLBACK");
        return res.status(404).json({ error: "Referral reward not found" });
      }
      if (referral.status !== "pending") {
        db.exec("ROLLBACK");
        return res.status(409).json({ error: "This referral reward has already been reviewed" });
      }
      if (req.body.status === "approved" && referral.referrerStatus !== "active") {
        db.exec("ROLLBACK");
        return res.status(409).json({ error: "Suspended accounts cannot receive referral rewards" });
      }
      const updated = db.prepare(`
        UPDATE referral_rewards
        SET status = ?, reward_cents = ?, reviewed_at = ?, review_note = ?
        WHERE id = ? AND status = 'pending'
      `).run(req.body.status, amountCents, now, req.body.note, referral.id);
      if (updated.changes !== 1) {
        db.exec("ROLLBACK");
        return res.status(409).json({ error: "This referral reward has already been reviewed" });
      }
      if (req.body.status === "approved") {
        const credited = db.prepare(`
          UPDATE users SET balance_cents = balance_cents + ?
          WHERE id = ? AND status = 'active'
        `).run(amountCents, referral.referrerUserId);
        if (credited.changes !== 1) throw new Error("Could not credit the referral reward");
        const balance = db.prepare("SELECT balance_cents FROM users WHERE id = ?").get(referral.referrerUserId);
        db.prepare(`
          INSERT INTO ledger_entries (id, user_id, transaction_id, type, amount_cents, balance_cents, reference, created_at)
          VALUES (?, ?, NULL, 'credit', ?, ?, ?, ?)
        `).run(randomUUID(), referral.referrerUserId, amountCents, balance.balance_cents,
          `Referral reward from ${referral.referredUsername}`, now);
      }
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, related_id, is_read, created_at)
        VALUES (?, ?, 'referral_reward', ?, ?, ?, 0, ?)
      `).run(
        randomUUID(),
        referral.referrerUserId,
        req.body.status === "approved" ? "Referral reward credited" : "Referral reward reviewed",
        req.body.status === "approved"
          ? `Your referral reward of ${(amountCents / 100).toFixed(2)} has been credited to your wallet.`
          : `Your referral reward for ${referral.referredUsername} was not approved.${req.body.note ? ` ${req.body.note}` : ""}`,
        referral.id,
        now,
      );
      auditTarget = referral.referrerUsername;
      auditDetails = `Referred user ${referral.referredUsername}; amount ${(amountCents / 100).toFixed(2)}. ${req.body.note}`;
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    recordAgentAudit(req.user.id, `REFERRAL_REWARD_${req.body.status.toUpperCase()}`, auditTarget, auditDetails);
    return res.json({ status: req.body.status, amount: amountCents / 100 });
  });

  router.get("/rewards/settings", (_req, res) => {
    return res.json({ settings: readRewardSettings() });
  });

  router.patch("/rewards/settings", validate(rewardSettingsSchema), (req, res) => {
    const settings = writeRewardSettings(req.body);
    recordAgentAudit(req.user.id, "REWARD_SETTINGS_UPDATED", "Reward settings",
      `Daily ${settings.dailyEnabled ? "enabled" : "disabled"}; VIP window ${settings.vipWindowDays} days; cashback ${settings.cashbackEnabled ? "configured active" : "disabled"}`);
    return res.json({ settings });
  });

  router.get("/bonus-codes", (_req, res) => {
    const codes = db.prepare(`
      SELECT c.id, c.code, c.amount_cents AS amountCents, c.terms,
        c.expires_at AS expiresAt, c.max_redemptions AS maxRedemptions,
        c.active, c.created_at AS createdAt,
        COUNT(r.id) AS redemptionCount
      FROM bonus_codes c
      LEFT JOIN bonus_code_redemptions r ON r.code_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `).all().map((code) => ({
      id: code.id,
      code: code.code,
      amount: code.amountCents / 100,
      terms: code.terms,
      expiresAt: code.expiresAt,
      maxRedemptions: code.maxRedemptions,
      active: Boolean(code.active),
      createdAt: code.createdAt,
      redemptionCount: code.redemptionCount,
    }));
    return res.json({ codes });
  });

  router.post("/bonus-codes", validate(bonusCodeSchema), (req, res) => {
    const code = req.body.code.toUpperCase();
    const id = randomUUID();
    const now = new Date().toISOString();
    const expiresAt = new Date(req.body.expiresAt).toISOString();
    if (expiresAt && expiresAt <= now) return res.status(400).json({ error: "Expiry date must be in the future" });
    try {
      db.prepare(`
        INSERT INTO bonus_codes
          (id, code, amount_cents, terms, expires_at, max_redemptions, active, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(id, code, toCents(req.body.amount), req.body.terms, expiresAt,
        req.body.maxRedemptions, req.user.id, now);
    } catch (error) {
      if (error?.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return res.status(409).json({ error: "A bonus code with this value already exists" });
      }
      throw error;
    }
    recordAgentAudit(req.user.id, "BONUS_CODE_CREATED", code,
      `Amount ${req.body.amount}; max redemptions ${req.body.maxRedemptions ?? "unlimited"}; expires ${expiresAt || "never"}`);
    return res.status(201).json({ id, code, amount: req.body.amount, expiresAt, active: true });
  });

  router.patch("/bonus-codes/:id", validate(bonusCodeActiveSchema), (req, res) => {
    const code = db.prepare("SELECT code FROM bonus_codes WHERE id = ?").get(req.params.id);
    if (!code) return res.status(404).json({ error: "Bonus code not found" });
    db.prepare("UPDATE bonus_codes SET active = ? WHERE id = ?").run(req.body.active ? 1 : 0, req.params.id);
    recordAgentAudit(req.user.id, req.body.active ? "BONUS_CODE_ACTIVATED" : "BONUS_CODE_DEACTIVATED", code.code);
    return res.json({ id: req.params.id, active: req.body.active });
  });

  router.patch("/agents/applications/:id", validate(agentDecisionSchema), (req, res) => {
    const application = db.prepare(`
      SELECT a.user_id, a.status, u.username, u.status AS accountStatus
      FROM agent_applications a JOIN users u ON u.id = a.user_id WHERE a.id = ?
    `).get(req.params.id);
    if (!application) return res.status(404).json({ error: "Agent application not found" });
    if (application.status !== "pending") return res.status(409).json({ error: "This application has already been reviewed" });
    if (req.body.status === "approved" && application.accountStatus !== "active") {
      return res.status(409).json({ error: "Suspended accounts cannot be approved as agents" });
    }
    const now = new Date().toISOString();
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(`
        UPDATE agent_applications SET status = ?, reviewed_at = ?, review_note = ? WHERE id = ?
      `).run(req.body.status, now, req.body.note, req.params.id);
      if (req.body.status === "approved") {
        db.prepare("UPDATE users SET role = 'agent' WHERE id = ?").run(application.user_id);
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    recordAgentAudit(req.user.id, `AGENT_APPLICATION_${req.body.status.toUpperCase()}`, application.username, req.body.note);
    res.json({ status: req.body.status });
  });

  router.patch("/agents/requests/:id", validate(agentDecisionSchema), (req, res) => {
    const request = db.prepare(`
      SELECT r.*, a.username AS agent_username, a.status AS agent_status,
        p.username AS player_username, p.status AS player_status, p.kyc_status AS player_kyc_status
      FROM agent_requests r JOIN users a ON a.id = r.agent_user_id
      LEFT JOIN users p ON p.id = r.player_user_id WHERE r.id = ?
    `).get(req.params.id);
    if (!request) return res.status(404).json({ error: "Agent request not found" });
    if (request.status !== "pending") return res.status(409).json({ error: "This request has already been reviewed" });
    if (req.body.status === "approved" && request.agent_status !== "active") {
      return res.status(409).json({ error: "Suspended agent accounts cannot receive transactions" });
    }
    if (req.body.status === "approved" && request.type.startsWith("player_") && request.player_kyc_status !== "verified") {
      return res.status(409).json({ error: "Player KYC verification is required before approving agent deposits or withdrawals" });
    }
    if (req.body.status === "approved" && request.player_user_id && request.player_status !== "active") {
      return res.status(409).json({ error: "Suspended player accounts cannot receive transactions" });
    }
    const now = new Date().toISOString();
    db.exec("BEGIN IMMEDIATE");
    try {
      if (req.body.status === "approved") {
        if (request.type === "agent_deposit") {
          db.prepare("UPDATE users SET agent_balance_cents = agent_balance_cents + ? WHERE id = ?")
            .run(request.amount_cents, request.agent_user_id);
        } else if (request.type === "agent_withdrawal") {
          const result = db.prepare(`
            UPDATE users SET agent_balance_cents = agent_balance_cents - ?
            WHERE id = ? AND agent_balance_cents >= ?
          `).run(request.amount_cents, request.agent_user_id, request.amount_cents);
          if (result.changes !== 1) throw new Error("Agent balance is insufficient to approve this withdrawal");
        } else if (request.type === "player_deposit") {
          const debited = db.prepare(`
            UPDATE users SET agent_balance_cents = agent_balance_cents - ?
            WHERE id = ? AND agent_balance_cents >= ?
          `).run(request.amount_cents, request.agent_user_id, request.amount_cents);
          if (debited.changes !== 1) throw new Error("Agent balance is insufficient to approve this player deposit");
          db.prepare("UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?")
            .run(request.amount_cents, request.player_user_id);
        } else if (request.type === "player_withdrawal") {
          const debited = db.prepare(`
            UPDATE users SET balance_cents = balance_cents - ?
            WHERE id = ? AND balance_cents >= ?
          `).run(request.amount_cents, request.player_user_id, request.amount_cents);
          if (debited.changes !== 1) throw new Error("Player balance is insufficient to approve this withdrawal");
          db.prepare("UPDATE users SET agent_balance_cents = agent_balance_cents + ? WHERE id = ?")
            .run(request.amount_cents, request.agent_user_id);
        } else {
          throw new Error("Unsupported agent request type");
        }
        if (request.type.startsWith("player_")) {
          const player = db.prepare("SELECT username FROM users WHERE id = ?").get(request.player_user_id);
          db.prepare(`
            INSERT INTO transactions (id, user_id, username, type, amount_cents, status, payment_method,
              payment_reference, payment_note, created_at, processed_at)
            VALUES (?, ?, ?, ?, ?, 'approved', 'Agent', ?, ?, ?, ?)
          `).run(randomUUID(), request.player_user_id, player.username,
            request.type === "player_deposit" ? "deposit" : "withdrawal",
            request.amount_cents, request.payment_reference, request.note, now, now);
        }
      }
      db.prepare(`
        UPDATE agent_requests SET status = ?, processed_at = ?, reviewer_note = ? WHERE id = ?
      `).run(req.body.status, now, req.body.note, req.params.id);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      if (error instanceof Error && /balance is insufficient/.test(error.message)) {
        return res.status(409).json({ error: error.message });
      }
      throw error;
    }
    recordAgentAudit(req.user.id, `AGENT_REQUEST_${req.body.status.toUpperCase()}`,
      request.player_username || request.agent_username, `${request.type} ${request.amount_cents / 100}; ${req.body.note}`);
    res.json({ status: req.body.status });
  });

  router.post("/agents/:agentId/commissions", validate(agentCommissionSchema), (req, res) => {
    const agent = db.prepare("SELECT id, username, role, status FROM users WHERE id = ?").get(req.params.agentId);
    if (!agent || agent.role !== "agent") return res.status(404).json({ error: "Agent account not found" });
    if (agent.status !== "active") return res.status(409).json({ error: "Suspended agents cannot receive commission" });
    const id = randomUUID();
    db.prepare(`
      INSERT INTO agent_commissions (id, agent_user_id, amount_cents, period_label, status, created_at)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `).run(id, agent.id, toCents(req.body.amount), req.body.periodLabel, new Date().toISOString());
    recordAgentAudit(req.user.id, "AGENT_COMMISSION_CREATED", agent.username,
      `${req.body.periodLabel}: ${req.body.amount}`);
    res.status(201).json({ id, status: "pending" });
  });

  router.patch("/agents/commissions/:id", validate(agentCommissionDecisionSchema), (req, res) => {
    const commission = db.prepare(`
      SELECT c.*, u.username, u.status AS agent_status
      FROM agent_commissions c JOIN users u ON u.id = c.agent_user_id WHERE c.id = ?
    `).get(req.params.id);
    if (!commission) return res.status(404).json({ error: "Commission record not found" });
    if (commission.status !== "pending") return res.status(409).json({ error: "This commission was already reviewed" });
    if (req.body.status === "paid" && commission.agent_status !== "active") {
      return res.status(409).json({ error: "Suspended agents cannot receive commission" });
    }
    const now = new Date().toISOString();
    db.exec("BEGIN IMMEDIATE");
    try {
      if (req.body.status === "paid") {
        db.prepare("UPDATE users SET agent_balance_cents = agent_balance_cents + ? WHERE id = ?")
          .run(commission.amount_cents, commission.agent_user_id);
      }
      db.prepare(`
        UPDATE agent_commissions SET status = ?, paid_at = ?, reviewer_note = ? WHERE id = ?
      `).run(req.body.status, req.body.status === "paid" ? now : null, req.body.note, req.params.id);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    recordAgentAudit(req.user.id, `AGENT_COMMISSION_${req.body.status.toUpperCase()}`, commission.username,
      `${commission.period_label}: ${commission.amount_cents / 100}; ${req.body.note}`);
    res.json({ status: req.body.status });
  });

  router.patch("/agents/limits/:id", validate(agentLimitDecisionSchema), (req, res) => {
    const request = db.prepare(`
      SELECT l.*, a.username AS agent_username, p.username AS player_username
      FROM agent_limit_requests l JOIN users a ON a.id = l.agent_user_id
      JOIN users p ON p.id = l.player_user_id WHERE l.id = ?
    `).get(req.params.id);
    if (!request) return res.status(404).json({ error: "Player limit request not found" });
    if (request.status !== "pending") return res.status(409).json({ error: "This limit request has already been reviewed" });
    const now = new Date().toISOString();
    db.exec("BEGIN IMMEDIATE");
    try {
      if (req.body.status === "approved") {
        db.prepare("UPDATE users SET player_limit_cents = ? WHERE id = ? AND agent_owner_id = ?")
          .run(request.limit_cents, request.player_user_id, request.agent_user_id);
      }
      db.prepare(`
        UPDATE agent_limit_requests SET status = ?, processed_at = ?, reviewer_note = ? WHERE id = ?
      `).run(req.body.status, now, req.body.note, req.params.id);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    recordAgentAudit(req.user.id, `AGENT_LIMIT_${req.body.status.toUpperCase()}`, request.player_username,
      `Agent ${request.agent_username}; limit ${request.limit_cents / 100}; ${req.body.note}`);
    res.json({ status: req.body.status });
  });

  router.get("/promotions/:id/banner", (req, res) => {
    const promotion = (readDb().platformSettings?.promotions || []).find((item) => item.id === req.params.id);
    if (!promotion?.bannerImage) return res.status(404).json({ error: "Promotion banner not found" });
    const filename = path.basename(promotion.bannerImage);
    const filePath = path.join(promotionImageDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Promotion banner not found" });
    res.setHeader("Cache-Control", "private, no-store");
    res.type(path.extname(filename));
    res.sendFile(filePath, { dotfiles: "deny" }, (error) => {
      if (error && !res.headersSent) res.status(error.statusCode || 500).json({ error: "Could not load promotion banner" });
    });
  });

  router.post("/promotions/:id/banner", (req, res, next) => {
    uploadPromotionImage.single("banner")(req, res, (error) => {
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "Promotion banners must be 5 MB or smaller" });
      }
      if (error) return next(error);
      next();
    });
  }, (req, res) => {
    const db = readDb();
    const promotion = (db.platformSettings?.promotions || []).find((item) => item.id === req.params.id);
    if (!promotion) return res.status(404).json({ error: "Promotion not found" });
    if (!req.file) return res.status(400).json({ error: "Upload a valid JPEG, PNG, or WebP banner image" });

    const extension = identifyPromotionImage(req.file.buffer);
    if (!extension) return res.status(400).json({ error: "The banner is not a valid JPEG, PNG, or WebP image" });

    const previousImage = promotion.bannerImage;
    promotion.bannerImage = `promotion-${randomUUID()}.${extension}`;
    fs.writeFileSync(path.join(promotionImageDir, promotion.bannerImage), req.file.buffer, { flag: "wx" });
    try {
      const admin = db.users.find((item) => item.id === req.user.id);
      addAudit(db, admin?.username || "admin", "PROMOTION_BANNER_UPLOADED", promotion.title || promotion.id, "Promotion banner artwork updated");
      writeDb(db);
    } catch (error) {
      fs.rmSync(path.join(promotionImageDir, promotion.bannerImage), { force: true });
      throw error;
    }

    if (previousImage && previousImage !== promotion.bannerImage) {
      try {
        fs.rmSync(path.join(promotionImageDir, path.basename(previousImage)), { force: true });
      } catch (error) {
        logger.warn("promotion_banner_cleanup_failed", {
          promotionId: promotion.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    res.json({ promotion });
  });

  router.post("/homepage/banner", (req, res, next) => {
    uploadPromotionImage.single("banner")(req, res, (error) => {
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "Homepage banners must be 5 MB or smaller" });
      }
      if (error) return next(error);
      next();
    });
  }, (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Upload a valid JPEG, PNG, or WebP banner image" });
    const extension = identifyPromotionImage(req.file.buffer);
    if (!extension) return res.status(400).json({ error: "The banner is not a valid JPEG, PNG, or WebP image" });

    const db = readDb();
    db.platformSettings ||= {};
    db.platformSettings.homepageBanner ||= {
      active: false,
      title: "",
      description: "",
      buttonLabel: "",
      buttonLink: "/games",
      bannerImage: "",
      bannerIncludesText: false,
    };
    const banner = db.platformSettings.homepageBanner;
    const previousImage = banner.bannerImage;
    banner.bannerImage = `homepage-${randomUUID()}.${extension}`;
    const imagePath = path.join(homepageImageDir, banner.bannerImage);
    fs.writeFileSync(imagePath, req.file.buffer, { flag: "wx" });
    try {
      const admin = db.users.find((item) => item.id === req.user.id);
      addAudit(db, admin?.username || "admin", "HOMEPAGE_BANNER_UPLOADED", "Homepage banner", "Homepage banner artwork updated");
      writeDb(db);
    } catch (error) {
      fs.rmSync(imagePath, { force: true });
      throw error;
    }

    if (previousImage && previousImage !== banner.bannerImage) {
      removeHomepageBannerImage(previousImage);
    }
    res.json({ homepageBanner: banner });
  });

  router.patch("/homepage/banner/settings", validate(homepageBannerSchema), (req, res) => {
    const db = readDb();
    db.platformSettings ||= {};
    const previousImage = db.platformSettings.homepageBanner?.bannerImage || "";
    db.platformSettings.homepageBanner = req.body;
  });

  router.get("/game-management", (_req, res) => {
    const providers = listManagedProviders();
    const games = listManagedGames();
    res.json({
      providers,
      games,
      categories: listGameCategories(),
      stats: getGameManagementStats(),
      pageSize: getGameCatalogPageSize(),
      providerApiConfigured: isHuiduConfigured(),
    });
  });

  router.get("/game-management/provider-catalog", async (_req, res) => {
    try {
      const providers = await listAvailableProviderSources();
      res.json({
        providers: providers.map(({ code, name }) => ({ code, name: name || code })),
        providerApiConfigured: true,
      });
    } catch (error) {
      catalogFailure(res, error, "Could not load available providers");
    }
  });

  router.post("/game-management/providers", validate(managedProviderSchema), async (req, res) => {
    try {
      const sources = await listAvailableProviderSources();
      const source = sources.find((provider) => provider.code === req.body.code);
      if (!source) return res.status(400).json({ error: "Select a provider available from HUIDU" });
      const provider = saveManagedProvider({
        code: source.code,
        name: req.body.name || source.name || source.code,
        enabled: req.body.enabled,
      });
      recordGameManagementAudit(req.user.id, "GAME_PROVIDER_SAVED", provider.name, `Provider ${provider.enabled ? "enabled" : "added disabled"}`);
      res.status(201).json({ provider });
    } catch (error) {
      catalogFailure(res, error, "Could not add game provider");
    }
  });

  router.patch("/game-management/providers/:code", validate(providerUpdateSchema), (req, res) => {
    const existing = getManagedProvider(req.params.code);
    if (!existing) return res.status(404).json({ error: "Game provider not found" });
    const provider = saveManagedProvider({
      code: existing.code,
      name: req.body.name || existing.name,
      enabled: req.body.enabled ?? existing.enabled,
    });
    try {
      recordGameManagementAudit(
        req.user.id,
        "GAME_PROVIDER_UPDATED",
        provider.name,
        `Provider ${provider.enabled ? "enabled" : "disabled"}`,
      );
      res.json({ provider });
    } catch (error) {
      logger.error("admin_game_provider_audit_failed", { providerCode: provider.code, error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "Provider was updated, but its audit record could not be saved" });
    }
  });

  router.post("/game-management/providers/:code/logo", (req, res, next) => {
    uploadProviderLogo.single("logo")(req, res, (error) => {
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "Provider logos must be 3 MB or smaller" });
      }
      if (error) return next(error);
      next();
    });
  }, async (req, res) => {
    const provider = getManagedProvider(req.params.code);
    if (!provider) return res.status(404).json({ error: "Game provider not found" });
    if (!req.file) return res.status(400).json({ error: "Upload a valid JPEG, PNG, or WebP logo" });

    const extension = identifyPromotionImage(req.file.buffer);
    if (!extension) return res.status(400).json({ error: "The logo is not a valid JPEG, PNG, or WebP image" });

    const filename = `${randomUUID()}.${extension}`;
    const filePath = path.join(providerLogoDir, filename);
    const logoUrl = `/api/games/providers/${encodeURIComponent(provider.code)}/logo/${filename}`;
    let logoUpdated = false;
    try {
      await fs.promises.writeFile(filePath, req.file.buffer, { flag: "wx" });
      const updatedProvider = saveManagedProvider({
        code: provider.code,
        name: provider.name,
        enabled: provider.enabled,
        logo: logoUrl,
      });
      logoUpdated = true;
      recordGameManagementAudit(req.user.id, "GAME_PROVIDER_LOGO_UPDATED", provider.name, "Provider logo uploaded");
      if (provider.logo.startsWith(`/api/games/providers/${encodeURIComponent(provider.code)}/logo/`)) {
        const oldFilename = path.basename(provider.logo);
        if (oldFilename !== filename) {
          await fs.promises.rm(path.join(providerLogoDir, oldFilename), { force: true }).catch((error) => {
            logger.warn("admin_provider_logo_cleanup_failed", { providerCode: provider.code, error: error instanceof Error ? error.message : String(error) });
          });
        }
      }
      res.json({ logo: logoUrl, provider: updatedProvider });
    } catch (error) {
      if (!logoUpdated) await fs.promises.rm(filePath, { force: true });
      logger.error("admin_provider_logo_upload_failed", { providerCode: provider.code, error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        error: logoUpdated
          ? "Provider logo was updated, but its audit record could not be saved"
          : "Could not update provider logo",
      });
    }
  });

  router.get("/game-management/providers/:code/catalog", async (req, res) => {
    if (!getManagedProvider(req.params.code)) return res.status(404).json({ error: "Game provider not found" });
    try {
      res.json({ games: await listGamesFromProviderCode(req.params.code) });
    } catch (error) {
      catalogFailure(res, error, "Could not load games from this provider");
    }
  });

  router.post("/game-management/games", validate(gameImportSchema), async (req, res) => {
    const provider = getManagedProvider(req.body.providerCode);
    if (!provider) return res.status(404).json({ error: "Add this provider before importing its games" });
    try {
      const sourceGames = await listGamesFromProviderCode(provider.code);
      const sourceGame = sourceGames.find((game) => game.id === req.body.externalId);
      if (!sourceGame) return res.status(400).json({ error: "Select a game available from the chosen provider" });
      const game = addManagedGame({
        providerCode: provider.code,
        externalId: sourceGame.id,
        name: sourceGame.name,
        thumbnail: req.body.thumbnail,
        category: req.body.category,
        isPopular: req.body.isPopular,
        gameType: sourceGame.gameType,
        sortOrder: req.body.sortOrder,
        enabled: false,
        providerStatus: sourceGame.status,
      });
      recordGameManagementAudit(req.user.id, "GAME_IMPORTED", game.name, `Imported from ${provider.name}; disabled until explicitly enabled`);
      res.status(201).json({ game });
    } catch (error) {
      if (String(error?.code || "").startsWith("ERR_SQLITE_CONSTRAINT") || String(error?.message || "").includes("constraint failed")) {
        return res.status(409).json({ error: "This game or a game with the same name is already managed" });
      }
      catalogFailure(res, error, "Could not add game");
    }
  });

  router.post("/game-management/games/bulk", validate(bulkGameImportSchema), async (req, res) => {
    const provider = getManagedProvider(req.body.providerCode);
    if (!provider) return res.status(404).json({ error: "Add this provider before importing its games" });
    try {
      const sourceGames = await listGamesFromProviderCode(provider.code);
      const sourceGamesById = new Map(sourceGames.map((game) => [game.id, game]));
      const missingGames = req.body.externalIds.filter((id) => !sourceGamesById.has(id));
      if (missingGames.length) return res.status(400).json({ error: "One or more selected games are not available from this provider" });

      const existingGames = listManagedGames();
      const existingIds = new Set(existingGames.map((game) => game.id));
      const existingNames = new Set(existingGames.map((game) => normalizedGameName(game.name)));
      const candidates = [];
      const skippedGames = [];
      for (const id of req.body.externalIds) {
        const game = sourceGamesById.get(id);
        if (game.status !== 0) {
          skippedGames.push({ id, name: game.name, reason: "unavailable" });
        } else if (existingIds.has(id)) {
          skippedGames.push({ id, name: game.name, reason: "already managed" });
        } else if (existingNames.has(normalizedGameName(game.name))) {
          skippedGames.push({ id, name: game.name, reason: "duplicate game name" });
        } else {
          existingIds.add(id);
          existingNames.add(normalizedGameName(game.name));
          candidates.push(game);
        }
      }

      const admin = db.prepare("SELECT username FROM users WHERE id = ?").get(req.user.id);
      const maxSortOrder = db.prepare("SELECT MAX(sort_order) AS value FROM managed_games WHERE provider_code = ?")
        .get(provider.code)?.value;
      let sortOrder = Number.isInteger(maxSortOrder) ? maxSortOrder : -1;
      const insertAudit = db.prepare(`
        INSERT INTO audit_logs (id, admin_username, action, target, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      db.exec("BEGIN IMMEDIATE");
      try {
        for (const game of candidates) {
          const type = game.gameType.toLowerCase();
          addManagedGame({
            providerCode: provider.code,
            externalId: game.id,
            name: game.name,
            category: type.includes("fish") ? "Fishing" : type.includes("slot") ? "Slots" : "Mini Games",
            gameType: game.gameType,
            sortOrder: ++sortOrder,
            enabled: false,
            providerStatus: game.status,
          });
          insertAudit.run(
            randomUUID(),
            admin?.username || "admin",
            "GAME_IMPORTED",
            game.name,
            `Bulk imported from ${provider.name}; disabled until explicitly enabled`,
            new Date().toISOString(),
          );
        }
        db.exec("DELETE FROM audit_logs WHERE id NOT IN (SELECT id FROM audit_logs ORDER BY created_at DESC, rowid DESC LIMIT 1000)");
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }

      res.status(candidates.length ? 201 : 200).json({
        importedCount: candidates.length,
        skippedCount: skippedGames.length,
        skippedGames,
        games: candidates.map((game) => getManagedGame(game.id)),
      });
    } catch (error) {
      if (String(error?.code || "").startsWith("ERR_SQLITE_CONSTRAINT") || String(error?.message || "").includes("constraint failed")) {
        return res.status(409).json({ error: "One or more selected games are already managed" });
      }
      logger.error("admin_managed_games_bulk_import_failed", { providerCode: provider.code, error: error instanceof Error ? error.message : String(error) });
      catalogFailure(res, error, "Could not import selected games");
    }
  });

  router.patch("/game-management/games/:id", validate(gameUpdateSchema), async (req, res) => {
    const existing = getManagedGame(req.params.id);
    if (!existing) return res.status(404).json({ error: "Managed game not found" });
    if (req.body.enabled === true && existing.providerStatus !== 0) {
      return res.status(409).json({ error: "This provider currently reports the game as unavailable" });
    }
    let selectedSourceGame;
    if (req.body.providerCode && req.body.providerCode !== existing.providerCode) {
      const provider = getManagedProvider(req.body.providerCode);
      if (!provider) return res.status(404).json({ error: "Select a managed game provider" });
      try {
        const sourceGames = await listGamesFromProviderCode(provider.code);
        selectedSourceGame = sourceGames.find((game) => game.id === existing.externalId);
        if (!selectedSourceGame) {
          return res.status(400).json({ error: "The selected provider does not have this game ID" });
        }
      } catch (error) {
        return catalogFailure(res, error, "Could not verify the selected game provider");
      }
      if (req.body.enabled === true && selectedSourceGame.status !== 0) {
        return res.status(409).json({ error: "The selected provider reports this game as unavailable" });
      }
    }
    try {
      const game = updateManagedGame(existing.id, {
        ...req.body,
        ...(selectedSourceGame ? {
          gameType: selectedSourceGame.gameType,
          providerStatus: selectedSourceGame.status,
        } : {}),
      });
      recordGameManagementAudit(req.user.id, "GAME_UPDATED", game.name, `Game ${game.enabled ? "enabled" : "disabled or updated"}`);
      res.json({ game });
    } catch (error) {
      if (String(error?.code || "").startsWith("ERR_SQLITE_CONSTRAINT") || String(error?.message || "").includes("constraint failed")) {
        return res.status(409).json({ error: "A managed game with this name already exists" });
      }
      logger.error("admin_managed_game_update_failed", { gameId: existing.id, error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "Could not update game" });
    }
  });

  router.patch("/game-management/bulk-enabled", validate(bulkGameEnabledSchema), (req, res) => {
    const games = req.body.gameIds.map((id) => getManagedGame(id));
    if (games.some((game) => !game)) return res.status(404).json({ error: "One or more selected games were not found" });
    if (req.body.enabled && games.some((game) => game.providerStatus !== 0)) {
      return res.status(409).json({ error: "Unavailable provider games cannot be enabled" });
    }
    const changedGames = games.filter((game) => game.enabled !== req.body.enabled);
    if (!changedGames.length) return res.json({ updatedCount: 0, enabled: req.body.enabled });

    const admin = db.prepare("SELECT username FROM users WHERE id = ?").get(req.user.id);
    const updatedAt = new Date().toISOString();
    const updateGame = db.prepare("UPDATE managed_games SET enabled = ?, updated_at = ? WHERE id = ?");
    const insertAudit = db.prepare(`
      INSERT INTO audit_logs (id, admin_username, action, target, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    try {
      db.exec("BEGIN IMMEDIATE");
      for (const game of changedGames) {
        updateGame.run(req.body.enabled ? 1 : 0, updatedAt, game.id);
        insertAudit.run(
          randomUUID(),
          admin?.username || "admin",
          req.body.enabled ? "GAME_ENABLED" : "GAME_DISABLED",
          game.name,
          `Bulk ${req.body.enabled ? "enabled" : "disabled"} from game management`,
          updatedAt,
        );
      }
      db.exec("DELETE FROM audit_logs WHERE id NOT IN (SELECT id FROM audit_logs ORDER BY created_at DESC, rowid DESC LIMIT 1000)");
      db.exec("COMMIT");
      res.json({ updatedCount: changedGames.length, enabled: req.body.enabled });
    } catch (error) {
      try {
        db.exec("ROLLBACK");
      } catch (rollbackError) {
        logger.error("admin_managed_games_bulk_rollback_failed", { error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError) });
      }
      logger.error("admin_managed_games_bulk_update_failed", { enabled: req.body.enabled, error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "Could not update selected games" });
    }
  });

  router.post("/game-management/games/:id/thumbnail", (req, res, next) => {
    uploadGameThumbnail.single("thumbnail")(req, res, (error) => {
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "Game thumbnails must be 3 MB or smaller" });
      }
      if (error) return next(error);
      next();
    });
  }, async (req, res) => {
    const game = getManagedGame(req.params.id);
    if (!game) return res.status(404).json({ error: "Managed game not found" });
    if (!req.file) return res.status(400).json({ error: "Upload a valid JPEG, PNG, or WebP thumbnail" });
    const extension = identifyPromotionImage(req.file.buffer);
    if (!extension) return res.status(400).json({ error: "The thumbnail is not a valid JPEG, PNG, or WebP image" });

    const filename = `${randomUUID()}.${extension}`;
    const filePath = path.join(gameThumbnailDir, filename);
    const thumbnailUrl = `/api/games/${encodeURIComponent(game.id)}/thumbnail/${filename}`;
    let thumbnailUpdated = false;
    try {
      await fs.promises.writeFile(filePath, req.file.buffer, { flag: "wx" });
      const updatedGame = updateManagedGame(game.id, { thumbnail: thumbnailUrl });
      if (!updatedGame) throw new Error("Managed game disappeared during thumbnail upload");
      thumbnailUpdated = true;
      recordGameManagementAudit(req.user.id, "GAME_THUMBNAIL_UPDATED", game.name, "Game thumbnail uploaded");
      if (game.thumbnail.startsWith(`/api/games/${encodeURIComponent(game.id)}/thumbnail/`)) {
        const oldFilename = path.basename(game.thumbnail);
        if (oldFilename !== filename) {
          await fs.promises.rm(path.join(gameThumbnailDir, oldFilename), { force: true }).catch((error) => {
            logger.warn("admin_game_thumbnail_cleanup_failed", { gameId: game.id, error: error instanceof Error ? error.message : String(error) });
          });
        }
      }
      res.json({ thumbnail: thumbnailUrl, game: getManagedGame(game.id) });
    } catch (error) {
      if (!thumbnailUpdated) await fs.promises.rm(filePath, { force: true });
      logger.error("admin_game_thumbnail_upload_failed", { gameId: game.id, error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        error: thumbnailUpdated
          ? "Thumbnail was updated, but its audit record could not be saved"
          : "Could not update game thumbnail",
      });
    }
  });

  router.delete("/game-management/games/:id", (req, res) => {
    const existing = getManagedGame(req.params.id);
    if (!existing) return res.status(404).json({ error: "Managed game not found" });
    try {
      const game = updateManagedGameEnabled(existing.id, false);
      recordGameManagementAudit(req.user.id, "GAME_REMOVED_FROM_PUBLIC_LIST", game.name, "Game disabled; provider and game records retained");
      res.json({ game });
    } catch (error) {
      logger.error("admin_managed_game_disable_failed", { gameId: existing.id, error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "Could not remove game from the public listing" });
    }
  });

  router.patch("/game-management/catalog-settings", validate(catalogSettingsSchema), (req, res) => {
    const pageSize = setGameCatalogPageSize(req.body.pageSize);
    try {
      recordGameManagementAudit(req.user.id, "GAME_CATALOG_PAGE_SIZE_UPDATED", "Public game catalog", `Page size set to ${pageSize}`);
      res.json({ pageSize });
    } catch (error) {
      logger.error("admin_game_catalog_settings_audit_failed", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "Catalog page size was updated, but its audit record could not be saved" });
    }
  });

  router.get("/stats", (_req, res) => {
    const db = readDb();
    const users = db.users.filter((item) => item.role !== "admin");
    const approvedDeposits = db.transactions.filter((item) => item.type === "deposit" && item.status === "approved");
    const approvedWithdrawals = db.transactions.filter((item) => item.type === "withdrawal" && item.status === "approved");
    res.json({
      totalUsers: users.length,
      activeUsers: users.filter((item) => item.status === "active").length,
      totalBalance: Number(users.reduce((sum, item) => sum + item.balance, 0).toFixed(2)),
      pendingRequests: db.transactions.filter((item) => item.status === "pending").length,
      indiaUsers: users.filter((item) => item.country === "IN").length,
      pakistanUsers: users.filter((item) => item.country === "PK").length,
      pendingKyc: users.filter((item) => item.kycStatus === "pending").length,
      approvedDeposits: Number(approvedDeposits.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2)),
      approvedWithdrawals: Number(approvedWithdrawals.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2)),
    });
  });
  router.get("/activity", (_req, res) => res.json({ logs: readDb().auditLogs.slice(0, 100) }));
  router.get("/settings", (_req, res) => {
    const settings = readDb().platformSettings || {};
    res.json({
      settings: {
        ...settings,
        bankName: settings.bankName || process.env.MANUAL_PAYMENT_BANK_NAME || "Admin will provide bank details",
        accountName: settings.accountName || process.env.MANUAL_PAYMENT_ACCOUNT_NAME || "",
        accountNumber: settings.accountNumber || process.env.MANUAL_PAYMENT_ACCOUNT_NUMBER || "",
        iban: settings.iban || process.env.MANUAL_PAYMENT_IBAN || "",
        upiId: settings.upiId || process.env.MANUAL_PAYMENT_UPI_ID || "",
        walletName: settings.walletName || process.env.MANUAL_PAYMENT_WALLET_NAME || "",
        walletNumber: settings.walletNumber || process.env.MANUAL_PAYMENT_WALLET_NUMBER || "",
        paymentInstructions: settings.paymentInstructions
          || process.env.MANUAL_PAYMENT_INSTRUCTIONS
          || "Transfer the exact amount, then submit the request with your payment reference and proof.",
        jackpotAmount: settings.jackpotAmount ?? 10799004.2,
      },
    });
  });
  router.patch("/settings", validate(settingsSchema), (req, res) => {
    const db = readDb();
    const previousBannerImages = (db.platformSettings?.promotions || [])
      .map((promotion) => promotion.bannerImage)
      .filter(Boolean);
    const previousHomepageImage = db.platformSettings?.homepageBanner?.bannerImage || "";
    db.platformSettings = req.body;
    const admin = db.users.find((item) => item.id === req.user.id);
    addAudit(db, admin?.username || "admin", "SETTINGS_UPDATED", "Platform settings", "Platform content, support, payment, and display settings updated");
    writeDb(db);
    const retainedBannerImages = new Set(db.platformSettings.promotions.map((promotion) => promotion.bannerImage).filter(Boolean));
    for (const filename of previousBannerImages) {
      if (retainedBannerImages.has(filename)) continue;
      try {
        fs.rmSync(path.join(promotionImageDir, path.basename(filename)), { force: true });
      } catch (error) {
        logger.warn("promotion_banner_cleanup_failed", {
          filename: path.basename(filename),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (previousHomepageImage && previousHomepageImage !== db.platformSettings.homepageBanner.bannerImage) {
      try {
        fs.rmSync(path.join(homepageImageDir, path.basename(previousHomepageImage)), { force: true });
      } catch (error) {
        logger.warn("homepage_banner_cleanup_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    res.json({ settings: db.platformSettings });
  });
  router.get("/users", (_req, res) => res.json({ users: readDb().users.filter((item) => item.role !== "admin").map(publicUser) }));
  router.get("/transactions", (_req, res) => res.json({ transactions: readDb().transactions }));

  router.patch("/users/:id", validate(userUpdateSchema), (req, res) => {
    const db = readDb();
    const user = db.users.find((item) => item.id === req.params.id);
    if (!user || user.role === "admin") return res.status(404).json({ error: "User not found" });
    const admin = db.users.find((item) => item.id === req.user.id);
    if (req.body.status) {
      user.status = req.body.status;
      addAudit(db, admin?.username || "admin", "USER_STATUS_CHANGED", user.username, `Status changed to ${req.body.status}`);
    }
    if (req.body.balance !== undefined) {
      const previousBalance = user.balance;
      const diff = Number((req.body.balance - previousBalance).toFixed(2));
      if (diff !== 0) {
        try {
          user.balance = changeBalance({
            userId: user.id,
            amount: Math.abs(diff),
            type: diff > 0 ? "credit" : "debit",
            reference: req.body.reason || "Manual adjustment",
          });
        } catch (error) {
          return res.status(400).json({ error: error instanceof Error ? error.message : "Balance adjustment failed" });
        }
      }
      const currency = displayCurrency(currencyForCountry(user.country));
      addAudit(db, admin?.username || "admin", "BALANCE_ADJUSTED", user.username, `${currency} ${previousBalance} -> ${currency} ${user.balance}; ${req.body.reason || "Manual adjustment"}`);
    }
    writeDb(db);
    res.json({ user: publicUser(user) });
  });

  router.patch("/users/:id/kyc", validate(kycReviewSchema), (req, res) => {
    const db = readDb();
    const user = db.users.find((item) => item.id === req.params.id && item.role !== "admin");
    if (!user) return res.status(404).json({ error: "User not found" });
    const admin = db.users.find((item) => item.id === req.user.id);
    user.kycStatus = req.body.status;
    user.kycReviewedAt = new Date().toISOString();
    user.kycReviewNote = req.body.note;
    addAudit(db, admin?.username || "admin", req.body.status === "verified" ? "KYC_VERIFIED" : "KYC_REJECTED", user.username, req.body.note);
    addNotification(
      db,
      user.id,
      "kyc",
      req.body.status === "verified" ? "KYC verification approved" : "KYC verification rejected",
      req.body.status === "verified" ? "Your identity verification has been approved." :
        `Your identity verification was rejected${req.body.note ? `: ${req.body.note}` : "."}`,
    );
    writeDb(db);
    res.json({ user: publicUser(user) });
  });

  router.get("/support", (_req, res) => res.json({ tickets: readDb().supportTickets }));
  router.patch("/support/:id", validate(z.object({
    status: z.enum(["open", "pending", "resolved"]),
    reply: z.string().trim().max(3000).optional().default(""),
  })), (req, res) => {
    const db = readDb();
    const ticket = db.supportTickets.find((item) => item.id === req.params.id);
    if (!ticket) return res.status(404).json({ error: "Support ticket not found" });
    ticket.status = req.body.status;
    ticket.reply = req.body.reply;
    ticket.updatedAt = new Date().toISOString();
    const user = db.users.find((item) => item.id === ticket.userId);
    if (user && ticket.reply) addNotification(db, user.id, "support", "Support reply received", ticket.reply, ticket.id);
    const admin = db.users.find((item) => item.id === req.user.id);
    addAudit(db, admin?.username || "admin", "SUPPORT_TICKET_UPDATED", ticket.username, `${ticket.status} · ${ticket.subject}`);
    writeDb(db);
    res.json({ ticket });
  });

  router.patch("/transactions/:id", validate(transactionDecisionSchema), (req, res) => {
    try {
      const result = req.body.status === "approved"
        ? approveTransaction(req.params.id, req.user.id)
        : decideTransaction({ transactionId: req.params.id, status: req.body.status, adminUsername: req.user.id });
      logger.info("wallet_transaction_processed", {
        transactionId: result.transactionId, status: req.body.status, adminId: req.user.id,
      });
      const transaction = readDb().transactions.find((item) => item.id === result.transactionId);
      res.json({ transaction, balance: result.balance });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transaction decision failed";
      const status = message === "Request already processed" ? 409 :
        message === "Request not found" || message === "User not found" ? 404 : 409;
      res.status(status).json({ error: message });
    }
  });

  router.post("/game-results", validate(gameResultSchema), (req, res) => {
    const db = readDb();
    const user = db.users.find((item) => item.id === req.body.userId && item.role !== "admin");
    if (!user) return res.status(404).json({ error: "User not found" });
    const admin = db.users.find((item) => item.id === req.user.id);
    const eventId = req.body.reference || randomUUID();
    const winnings = req.body.outcome === "won" ? req.body.amount : 0;
    if (winnings > 0) {
      user.balance = changeBalance({
        userId: user.id, amount: winnings, type: "credit", transactionId: eventId, reference: eventId,
      });
    }
    db.transactions.unshift({
      id: eventId, userId: user.id, username: user.username, type: req.body.category,
      amount: winnings, status: req.body.outcome, gameName: req.body.gameName || req.body.category,
      createdAt: new Date().toISOString(),
    });
    addNotification(
      db,
      user.id,
      req.body.category,
      `${req.body.gameName || req.body.category} ${req.body.outcome}`,
      winnings ? `You won ${displayCurrency(currencyForCountry(user.country))} ${winnings.toLocaleString("en-US")} and the amount has been added to your wallet.` :
        `Your ${req.body.category} result was recorded as no win.`,
      eventId,
    );
    addAudit(db, admin?.username || "admin", "GAME_RESULT_RECORDED", user.username,
      `${req.body.category} · ${req.body.gameName || req.body.category} · ${req.body.outcome} · ${displayCurrency(currencyForCountry(user.country))} ${winnings} · Ref: ${eventId}`);
    writeDb(db);
    res.status(201).json({ message: "Game result recorded", user: publicUser(user) });
  });

  return router;
}
