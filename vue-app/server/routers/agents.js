import express from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, fromCents, readUserById, toCents } from "../database.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const applicationSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  experience: z.string().trim().max(1000).default(""),
});
const playerSchema = z.object({
  username: z.string().trim().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(128),
  email: z.string().trim().email().max(254).or(z.literal("")).default(""),
});
const requestSchema = z.object({
  type: z.enum(["agent_deposit", "agent_withdrawal", "player_deposit", "player_withdrawal"]),
  playerId: z.string().trim().max(80).default(""),
  amount: z.number().finite().min(0.01).max(100000000),
  paymentMethod: z.string().trim().max(100).default(""),
  paymentReference: z.string().trim().max(150).default(""),
  note: z.string().trim().max(500).default(""),
});
const limitRequestSchema = z.object({
  limit: z.number().finite().min(0).max(100000000),
  reason: z.string().trim().max(500).default(""),
});

function agentAccount(req, res, next) {
  const user = readUserById(req.user.id);
  if (!user || user.status !== "active") return res.status(403).json({ error: "Account unavailable" });
  if (user.role !== "agent") return res.status(403).json({ error: "An approved agent account is required" });
  req.agent = user;
  next();
}

function availableAgentCents(agentId) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(amount_cents), 0) AS reserved
    FROM agent_requests
    WHERE agent_user_id = ? AND status = 'pending'
      AND type IN ('player_deposit', 'agent_withdrawal')
  `).get(agentId);
  const agent = db.prepare("SELECT agent_balance_cents FROM users WHERE id = ?").get(agentId);
  return Math.max(0, Number(agent?.agent_balance_cents || 0) - Number(row?.reserved || 0));
}

function publicPlayer(row) {
  return {
    id: row.id,
    username: row.username,
    balance: fromCents(row.balance_cents),
    status: row.status,
    lastResult: row.last_result || "",
    playerLimit: fromCents(row.player_limit_cents || 0),
    createdAt: row.created_at,
  };
}

function dashboardData(agent) {
  const players = db.prepare(`
    SELECT u.id, u.username, u.balance_cents, u.status, u.player_limit_cents, u.created_at,
      (SELECT gr.outcome FROM game_results gr WHERE gr.user_id = u.id
       ORDER BY gr.created_at DESC, gr.rowid DESC LIMIT 1) AS last_result
    FROM users u WHERE u.agent_owner_id = ?
    ORDER BY u.created_at DESC
  `).all(agent.id).map(publicPlayer);
  const pendingCommission = db.prepare(`
    SELECT COALESCE(SUM(amount_cents), 0) AS amount
    FROM agent_commissions WHERE agent_user_id = ? AND status = 'pending'
  `).get(agent.id);
  const requests = db.prepare(`
    SELECT r.id, r.type, r.amount_cents, r.status, r.payment_method, r.payment_reference,
      r.note, r.created_at, r.processed_at, u.username AS player_username
    FROM agent_requests r LEFT JOIN users u ON u.id = r.player_user_id
    WHERE r.agent_user_id = ? ORDER BY r.created_at DESC LIMIT 300
  `).all(agent.id).map((row) => ({
    id: row.id, type: row.type, amount: fromCents(row.amount_cents), status: row.status,
    paymentMethod: row.payment_method, paymentReference: row.payment_reference,
    note: row.note, playerUsername: row.player_username || "", createdAt: row.created_at,
    processedAt: row.processed_at,
  }));
  const commissions = db.prepare(`
    SELECT id, amount_cents, period_label, status, created_at, paid_at
    FROM agent_commissions WHERE agent_user_id = ? ORDER BY created_at DESC LIMIT 100
  `).all(agent.id).map((row) => ({
    id: row.id, type: "commission", amount: fromCents(row.amount_cents),
    periodLabel: row.period_label, status: row.status, createdAt: row.created_at,
    processedAt: row.paid_at,
  }));
  return {
    agent: {
      id: agent.id, username: agent.username, country: agent.country,
      currency: agent.country === "PK" ? "PKR" : "INR",
      balance: agent.agentBalance,
      availableBalance: fromCents(availableAgentCents(agent.id)),
      pendingCommission: fromCents(pendingCommission.amount),
      activePlayers: players.filter((player) => player.status === "active").length,
      weeklyTurnover: null,
      turnoverAvailable: false,
      turnoverNote: "Unavailable until a verified provider wager feed is connected.",
    },
    players,
    ledger: [...requests, ...commissions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 300),
  };
}

function addAudit(username, action, target, details) {
  db.prepare(`
    INSERT INTO audit_logs (id, admin_username, action, target, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), username, action, target, details, new Date().toISOString());
  db.prepare(`
    DELETE FROM audit_logs
    WHERE id NOT IN (SELECT id FROM audit_logs ORDER BY created_at DESC, rowid DESC LIMIT 1000)
  `).run();
}

export function createAgentsRouter() {
  const router = express.Router();
  router.use(authenticate);

  router.get("/me", (req, res) => {
    const user = readUserById(req.user.id);
    if (!user || user.status !== "active") return res.status(403).json({ error: "Account unavailable" });
    const application = db.prepare(`
      SELECT id, business_name, experience, status, created_at, review_note
      FROM agent_applications WHERE user_id = ?
    `).get(user.id);
    res.json({
      role: user.role,
      application: application ? {
        id: application.id, businessName: application.business_name, experience: application.experience,
        status: application.status, createdAt: application.created_at, reviewNote: application.review_note,
      } : null,
    });
  });

  router.post("/apply", validate(applicationSchema), (req, res) => {
    const user = readUserById(req.user.id);
    if (!user || user.status !== "active") return res.status(403).json({ error: "Account unavailable" });
    if (user.role !== "user") return res.status(409).json({ error: "This account cannot apply for agent access" });
    const current = db.prepare("SELECT status FROM agent_applications WHERE user_id = ?").get(user.id);
    if (current?.status === "pending") return res.status(409).json({ error: "Your application is already under review" });
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO agent_applications (id, user_id, business_name, experience, status, created_at, reviewed_at, review_note)
      VALUES (?, ?, ?, ?, 'pending', ?, NULL, '')
      ON CONFLICT(user_id) DO UPDATE SET business_name = excluded.business_name,
        experience = excluded.experience, status = 'pending', created_at = excluded.created_at,
        reviewed_at = NULL, review_note = ''
    `).run(randomUUID(), user.id, req.body.businessName, req.body.experience, now);
    addAudit(user.username, "AGENT_APPLICATION_SUBMITTED", user.username, req.body.businessName);
    res.status(201).json({ status: "pending" });
  });

  router.get("/dashboard", agentAccount, (req, res) => res.json(dashboardData(req.agent)));

  router.post("/players", agentAccount, validate(playerSchema), async (req, res) => {
    const username = req.body.username;
    if (db.prepare("SELECT 1 FROM users WHERE lower(username) = lower(?)").get(username)) {
      return res.status(409).json({ error: "Username already exists" });
    }
    const email = req.body.email.toLowerCase();
    if (email && db.prepare("SELECT 1 FROM users WHERE lower(email) = lower(?)").get(email)) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const now = new Date().toISOString();
    const playerId = randomUUID();
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    db.prepare(`
      INSERT INTO users (id, username, email, country, password_hash, role, balance_cents, status, kyc_status,
        agent_owner_id, created_at)
      VALUES (?, ?, ?, ?, ?, 'user', 0, 'active', 'not_submitted', ?, ?)
    `).run(playerId, username, email, req.agent.country, passwordHash, req.agent.id, now);
    addAudit(req.agent.username, "AGENT_PLAYER_CREATED", username, `Agent ${req.agent.username} created a player account`);
    res.status(201).json({ player: { id: playerId, username, balance: 0, status: "active", lastResult: "", playerLimit: 0, createdAt: now } });
  });

  router.post("/requests", agentAccount, validate(requestSchema), (req, res) => {
    const amountCents = toCents(req.body.amount);
    const playerType = req.body.type.startsWith("player_");
    let player = null;
    if (playerType) {
      player = db.prepare("SELECT id, username, country, status, kyc_status, balance_cents FROM users WHERE id = ? AND agent_owner_id = ?")
        .get(req.body.playerId, req.agent.id);
      if (!player) return res.status(404).json({ error: "Player account not found" });
      if (player.country !== req.agent.country) return res.status(400).json({ error: "Player and agent currencies must match" });
      if (player.status !== "active") return res.status(409).json({ error: "Transactions are not available for suspended players" });
      if (player.kyc_status !== "verified") {
        return res.status(403).json({ error: "The player must complete KYC verification and receive approval before agent deposits or withdrawals" });
      }
    } else if (req.body.playerId) {
      return res.status(400).json({ error: "This request must not include a player account" });
    }
    if (["player_deposit", "agent_withdrawal"].includes(req.body.type)) {
      if (amountCents > availableAgentCents(req.agent.id)) {
        return res.status(409).json({ error: "Amount exceeds the agent's available balance after pending requests" });
      }
    }
    if (req.body.type === "player_withdrawal") {
      const reserved = db.prepare(`
        SELECT COALESCE(SUM(amount_cents), 0) AS amount FROM agent_requests
        WHERE player_user_id = ? AND type = 'player_withdrawal' AND status = 'pending'
      `).get(player.id);
      if (amountCents > Number(player.balance_cents) - Number(reserved.amount)) {
        return res.status(409).json({ error: "Amount exceeds the player's available balance after pending withdrawals" });
      }
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO agent_requests (id, agent_user_id, player_user_id, type, amount_cents, payment_method,
        payment_reference, note, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(id, req.agent.id, player?.id || "", req.body.type, amountCents, req.body.paymentMethod,
      req.body.paymentReference, req.body.note, now);
    addAudit(req.agent.username, "AGENT_FUNDS_REQUESTED", player?.username || req.agent.username,
      `${req.body.type} ${req.body.amount} requested`);
    res.status(201).json({ id, status: "pending" });
  });

  router.post("/players/:playerId/limit-requests", agentAccount, validate(limitRequestSchema), (req, res) => {
    const player = db.prepare("SELECT id, username FROM users WHERE id = ? AND agent_owner_id = ?")
      .get(req.params.playerId, req.agent.id);
    if (!player) return res.status(404).json({ error: "Player account not found" });
    const pending = db.prepare(`
      SELECT 1 FROM agent_limit_requests WHERE player_user_id = ? AND status = 'pending'
    `).get(player.id);
    if (pending) return res.status(409).json({ error: "A limit change is already awaiting review for this player" });
    const id = randomUUID();
    db.prepare(`
      INSERT INTO agent_limit_requests (id, agent_user_id, player_user_id, limit_cents, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, req.agent.id, player.id, toCents(req.body.limit), req.body.reason, new Date().toISOString());
    addAudit(req.agent.username, "AGENT_LIMIT_REQUESTED", player.username, `Requested limit ${req.body.limit}`);
    res.status(201).json({ id, status: "pending" });
  });

  return router;
}
