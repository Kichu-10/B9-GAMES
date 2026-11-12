import express from "express";
import { db, fromCents, readUserById } from "../database.js";
import { authenticate } from "../middleware/auth.js";

export function createReferralsRouter() {
  const router = express.Router();
  router.use(authenticate);
  router.get("/", (req, res) => {
    const user = readUserById(req.user.id);
    if (!user || user.status !== "active") return res.status(403).json({ error: "Account unavailable" });
    const referrals = db.prepare(`
      SELECT r.id, r.status, r.reward_cents, r.created_at, r.reviewed_at, r.review_note,
        u.username AS referred_username
      FROM referral_rewards r JOIN users u ON u.id = r.referred_user_id
      WHERE r.referrer_user_id = ? ORDER BY r.created_at DESC LIMIT 300
    `).all(user.id).map((row) => ({
      id: row.id,
      username: row.referred_username,
      status: row.status,
      reward: fromCents(row.reward_cents),
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at,
      reviewNote: row.review_note,
    }));
    const totals = db.prepare(`
      SELECT COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_count,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN reward_cents ELSE 0 END), 0) AS approved_reward_cents
      FROM referral_rewards WHERE referrer_user_id = ?
    `).get(user.id);
    res.setHeader("Cache-Control", "no-store, private");
    res.json({
      code: user.referralCode,
      referrals,
      pendingCount: totals.pending_count,
      approvedRewards: fromCents(totals.approved_reward_cents),
    });
  });
  return router;
}
