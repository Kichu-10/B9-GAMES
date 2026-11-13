import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import dotenv from "dotenv";
import { currencyForCountry, displayCurrency } from "./services/game-provider.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
// ES module imports are evaluated before the entry point body runs, so
// index.js has not loaded .env.local yet when this module initialises. Load it
// here too, otherwise SQLITE_PATH from that file is silently ignored.
dotenv.config({ path: path.join(directory, "..", ".env.local") });
const sqliteFile = process.env.SQLITE_PATH || path.join(directory, "database.sqlite");
const legacyJsonFile = path.join(directory, "database.json");
fs.mkdirSync(path.dirname(sqliteFile), { recursive: true });

export const GAME_CATEGORIES = ["Mini Games", "Slots", "Fishing"];
const DEFAULT_REWARD_SETTINGS = {
  dailyEnabled: true,
  dailyRewards: [5, 10, 15, 20, 25, 30, 50],
  dailyResetTimezone: "UTC",
  streakResetOnMissedDay: true,
  vipEnabled: true,
  vipWindowDays: 30,
  vipTiers: { silver: 1000, gold: 5000, platinum: 25000 },
  cashbackEnabled: false,
  cashbackRate: 5,
  cashbackWeeklyCap: 50,
};
export const db = new DatabaseSync(sqliteFile);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
const previousUserColumns = db.prepare("PRAGMA table_info(users)").all().map((column) => column.name);
const previousTransactionColumns = db.prepare("PRAGMA table_info(transactions)").all().map((column) => column.name);
if (previousUserColumns.includes("data")) db.exec("ALTER TABLE users RENAME TO users_json_legacy;");
if (previousTransactionColumns.includes("data")) db.exec("ALTER TABLE transactions RENAME TO transactions_json_legacy;");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, username TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '', country TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'user',
    balance_cents INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active',
    email_verified INTEGER NOT NULL DEFAULT 0, phone_verified INTEGER NOT NULL DEFAULT 0,
    kyc_status TEXT NOT NULL DEFAULT 'not_submitted', full_name TEXT NOT NULL DEFAULT '',
    date_of_birth TEXT NOT NULL DEFAULT '', document_type TEXT NOT NULL DEFAULT '',
    document_number TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '',
    google_id TEXT NOT NULL DEFAULT '', google_picture_url TEXT NOT NULL DEFAULT '',
    avatar_path TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT '',
    last_login_at TEXT, kyc_reviewed_at TEXT, kyc_review_note TEXT NOT NULL DEFAULT '',
    failed_admin_attempts INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0,
    agent_owner_id TEXT NOT NULL DEFAULT '', agent_balance_cents INTEGER NOT NULL DEFAULT 0,
    player_limit_cents INTEGER NOT NULL DEFAULT 0, referral_code TEXT NOT NULL DEFAULT ''
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users(lower(username));
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

  CREATE TABLE IF NOT EXISTS referral_rewards (
    id TEXT PRIMARY KEY, referrer_user_id TEXT NOT NULL, referred_user_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending', reward_cents INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, reviewed_at TEXT, review_note TEXT NOT NULL DEFAULT '',
    FOREIGN KEY(referrer_user_id) REFERENCES users(id),
    FOREIGN KEY(referred_user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_referral_rewards_owner_status
    ON referral_rewards(referrer_user_id, status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_referral_rewards_pending ON referral_rewards(status, created_at);

  CREATE TABLE IF NOT EXISTS daily_reward_claims (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, claim_date TEXT NOT NULL,
    streak_day INTEGER NOT NULL, amount_cents INTEGER NOT NULL, created_at TEXT NOT NULL,
    UNIQUE(user_id, claim_date),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_daily_reward_claims_user_date
    ON daily_reward_claims(user_id, claim_date DESC);
  CREATE TABLE IF NOT EXISTS bonus_codes (
    id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE COLLATE NOCASE,
    amount_cents INTEGER NOT NULL, terms TEXT NOT NULL DEFAULT '',
    expires_at TEXT, max_redemptions INTEGER, active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS bonus_code_redemptions (
    id TEXT PRIMARY KEY, code_id TEXT NOT NULL, user_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL, created_at TEXT NOT NULL,
    UNIQUE(code_id, user_id),
    FOREIGN KEY(code_id) REFERENCES bonus_codes(id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_bonus_code_redemptions_code
    ON bonus_code_redemptions(code_id, created_at);
  CREATE TABLE IF NOT EXISTS reward_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    daily_enabled INTEGER NOT NULL DEFAULT 1,
    daily_rewards TEXT NOT NULL DEFAULT '[5,10,15,20,25,30,50]',
    daily_reset_timezone TEXT NOT NULL DEFAULT 'UTC',
    streak_reset_on_missed_day INTEGER NOT NULL DEFAULT 1,
    vip_enabled INTEGER NOT NULL DEFAULT 1,
    vip_window_days INTEGER NOT NULL DEFAULT 30,
    vip_tiers TEXT NOT NULL DEFAULT '{"silver":1000,"gold":5000,"platinum":25000}',
    cashback_enabled INTEGER NOT NULL DEFAULT 0,
    cashback_rate REAL NOT NULL DEFAULT 5,
    cashback_weekly_cap_cents INTEGER NOT NULL DEFAULT 5000
  );
  INSERT OR IGNORE INTO reward_settings (id) VALUES (1);

  CREATE TABLE IF NOT EXISTS agent_applications (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, business_name TEXT NOT NULL DEFAULT '',
    experience TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL, reviewed_at TEXT, review_note TEXT NOT NULL DEFAULT '',
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_agent_applications_status ON agent_applications(status, created_at);
  CREATE TABLE IF NOT EXISTS agent_requests (
    id TEXT PRIMARY KEY, agent_user_id TEXT NOT NULL, player_user_id TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL, amount_cents INTEGER NOT NULL, payment_method TEXT NOT NULL DEFAULT '',
    payment_reference TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL, processed_at TEXT, reviewer_note TEXT NOT NULL DEFAULT '',
    FOREIGN KEY(agent_user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_agent_requests_agent_created ON agent_requests(agent_user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_agent_requests_status ON agent_requests(status, created_at);
  CREATE TABLE IF NOT EXISTS agent_limit_requests (
    id TEXT PRIMARY KEY, agent_user_id TEXT NOT NULL, player_user_id TEXT NOT NULL,
    limit_cents INTEGER NOT NULL, reason TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL, processed_at TEXT, reviewer_note TEXT NOT NULL DEFAULT '',
    FOREIGN KEY(agent_user_id) REFERENCES users(id), FOREIGN KEY(player_user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_agent_limit_requests_status ON agent_limit_requests(status, created_at);
  CREATE TABLE IF NOT EXISTS agent_commissions (
    id TEXT PRIMARY KEY, agent_user_id TEXT NOT NULL, amount_cents INTEGER NOT NULL,
    period_label TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL, paid_at TEXT, reviewer_note TEXT NOT NULL DEFAULT '',
    FOREIGN KEY(agent_user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_agent_commissions_agent_status ON agent_commissions(agent_user_id, status);

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, username TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL, amount_cents INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL, payment_method TEXT NOT NULL DEFAULT '',
    payment_reference TEXT NOT NULL DEFAULT '', payment_note TEXT NOT NULL DEFAULT '',
    proof_file TEXT NOT NULL DEFAULT '', game_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT '', processed_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
  CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

  CREATE TABLE IF NOT EXISTS kyc_documents (
    user_id TEXT NOT NULL, kind TEXT NOT NULL, file_path TEXT NOT NULL,
    PRIMARY KEY(user_id, kind), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS otps (
    channel TEXT NOT NULL, destination TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL,
    PRIMARY KEY(channel, destination)
  );
  CREATE TABLE IF NOT EXISTS verifications (
    channel TEXT NOT NULL, destination TEXT NOT NULL, verified INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY(channel, destination)
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL,
    message TEXT NOT NULL, related_id TEXT NOT NULL DEFAULT '', is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications(user_id, created_at DESC, id DESC);
  CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, username TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
    reply TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY, admin_username TEXT NOT NULL DEFAULT '', action TEXT NOT NULL,
    target TEXT NOT NULL DEFAULT '', details TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS game_results (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, category TEXT NOT NULL, game_name TEXT NOT NULL DEFAULT '',
    outcome TEXT NOT NULL, amount_cents INTEGER NOT NULL DEFAULT 0, reference TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_game_results_user_created ON game_results(user_id, created_at DESC);
  CREATE TABLE IF NOT EXISTS platform_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    announcement TEXT NOT NULL DEFAULT '',
    maintenance_mode INTEGER NOT NULL DEFAULT 0,
    support_email TEXT NOT NULL DEFAULT '',
    support_phone TEXT NOT NULL DEFAULT '',
    support_hours TEXT NOT NULL DEFAULT '',
    promotions TEXT NOT NULL DEFAULT '[]',
    bank_name TEXT NOT NULL DEFAULT '',
    account_name TEXT NOT NULL DEFAULT '',
    account_number TEXT NOT NULL DEFAULT '',
    iban TEXT NOT NULL DEFAULT '',
    upi_id TEXT NOT NULL DEFAULT '',
    wallet_name TEXT NOT NULL DEFAULT '',
    wallet_number TEXT NOT NULL DEFAULT '',
    payment_instructions TEXT NOT NULL DEFAULT '',
    jackpot_display_cents INTEGER NOT NULL DEFAULT 1079900420
  );
  CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS ledger_entries (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, transaction_id TEXT,
    type TEXT NOT NULL, amount_cents INTEGER NOT NULL, balance_cents INTEGER NOT NULL,
    reference TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger_entries(user_id);
  CREATE INDEX IF NOT EXISTS idx_ledger_transaction ON ledger_entries(transaction_id);

  CREATE TABLE IF NOT EXISTS game_players (
    user_id TEXT PRIMARY KEY, player_id TEXT NOT NULL UNIQUE, currency TEXT NOT NULL,
    provider_created INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS game_wallet_transfers (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, player_id TEXT NOT NULL,
    currency TEXT NOT NULL, direction TEXT NOT NULL, amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL, provider_balance_cents INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_game_wallet_transfers_user ON game_wallet_transfers(user_id);
  CREATE INDEX IF NOT EXISTS idx_game_wallet_transfers_status ON game_wallet_transfers(status);
  CREATE INDEX IF NOT EXISTS idx_game_wallet_transfers_pending
    ON game_wallet_transfers(user_id, direction, created_at)
    WHERE status = 'pending';

  CREATE TABLE IF NOT EXISTS game_providers (
    code TEXT PRIMARY KEY, name TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0,
    logo TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS managed_games (
    id TEXT PRIMARY KEY, provider_code TEXT NOT NULL, external_id TEXT NOT NULL,
    name TEXT NOT NULL, normalized_name TEXT NOT NULL, thumbnail TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '', game_type TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 0,
    is_popular INTEGER NOT NULL DEFAULT 0, provider_status INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE(provider_code, external_id),
    UNIQUE(normalized_name),
    FOREIGN KEY(provider_code) REFERENCES game_providers(code)
  );
  CREATE INDEX IF NOT EXISTS idx_managed_games_public
    ON managed_games(enabled, provider_code, sort_order, name);
  CREATE TABLE IF NOT EXISTS game_catalog_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    page_size INTEGER NOT NULL DEFAULT 24
  );
  INSERT OR IGNORE INTO game_catalog_settings (id, page_size) VALUES (1, 24);
  CREATE TABLE IF NOT EXISTS game_categories (
    name TEXT PRIMARY KEY, sort_order INTEGER NOT NULL UNIQUE
  );
  INSERT OR IGNORE INTO game_categories (name, sort_order) VALUES
    ('Popular', 0), ('Mini Games', 1), ('Slots', 2), ('Fishing', 3);
`);
const userColumns = db.prepare("PRAGMA table_info(users)").all().map((column) => column.name);
if (!userColumns.includes("agent_owner_id")) {
  db.exec("ALTER TABLE users ADD COLUMN agent_owner_id TEXT NOT NULL DEFAULT '';");
}
if (!userColumns.includes("agent_balance_cents")) {
  db.exec("ALTER TABLE users ADD COLUMN agent_balance_cents INTEGER NOT NULL DEFAULT 0;");
}
if (!userColumns.includes("player_limit_cents")) {
  db.exec("ALTER TABLE users ADD COLUMN player_limit_cents INTEGER NOT NULL DEFAULT 0;");
}
if (!userColumns.includes("referral_code")) {
  db.exec("ALTER TABLE users ADD COLUMN referral_code TEXT NOT NULL DEFAULT '';");
}
const assignReferralCode = db.prepare("UPDATE users SET referral_code = ? WHERE id = ? AND referral_code = ''");
for (const user of db.prepare("SELECT id FROM users WHERE referral_code = ''").all()) {
  assignReferralCode.run(referralCodeForUser(user.id), user.id);
}
db.exec("CREATE INDEX IF NOT EXISTS idx_users_agent_owner ON users(agent_owner_id, status);");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code) WHERE referral_code != '';");
if (!userColumns.includes("avatar_path")) {
  db.exec("ALTER TABLE users ADD COLUMN avatar_path TEXT NOT NULL DEFAULT '';");
}
if (!userColumns.includes("google_picture_url")) {
  db.exec("ALTER TABLE users ADD COLUMN google_picture_url TEXT NOT NULL DEFAULT '';");
}
const platformSettingColumns = db.prepare("PRAGMA table_info(platform_settings)").all().map((column) => column.name);
for (const [column, definition] of Object.entries({
  promotions: "TEXT NOT NULL DEFAULT '[]'",
  bank_name: "TEXT NOT NULL DEFAULT ''",
  account_name: "TEXT NOT NULL DEFAULT ''",
  account_number: "TEXT NOT NULL DEFAULT ''",
  iban: "TEXT NOT NULL DEFAULT ''",
  upi_id: "TEXT NOT NULL DEFAULT ''",
  wallet_name: "TEXT NOT NULL DEFAULT ''",
  wallet_number: "TEXT NOT NULL DEFAULT ''",
  payment_instructions: "TEXT NOT NULL DEFAULT ''",
  jackpot_display_cents: "INTEGER NOT NULL DEFAULT 1079900420",
})) {
  if (!platformSettingColumns.includes(column)) {
    db.exec(`ALTER TABLE platform_settings ADD COLUMN ${column} ${definition};`);
  }
}
const rewardSettingColumns = db.prepare("PRAGMA table_info(reward_settings)").all().map((column) => column.name);
if (!rewardSettingColumns.includes("vip_enabled")) {
  db.exec("ALTER TABLE reward_settings ADD COLUMN vip_enabled INTEGER NOT NULL DEFAULT 1;");
}
const gamePlayerColumns = db.prepare("PRAGMA table_info(game_players)").all().map((column) => column.name);
if (!gamePlayerColumns.includes("provider_created")) {
  db.exec("ALTER TABLE game_players ADD COLUMN provider_created INTEGER NOT NULL DEFAULT 0;");
}
const managedGameColumns = db.prepare("PRAGMA table_info(managed_games)").all().map((column) => column.name);
if (!managedGameColumns.includes("is_popular")) {
  db.exec("ALTER TABLE managed_games ADD COLUMN is_popular INTEGER NOT NULL DEFAULT 0;");
}
const gameProviderColumns = db.prepare("PRAGMA table_info(game_providers)").all().map((column) => column.name);
if (!gameProviderColumns.includes("logo")) {
  db.exec("ALTER TABLE game_providers ADD COLUMN logo TEXT NOT NULL DEFAULT '';");
}
db.exec(`
  UPDATE managed_games
  SET category = CASE
    WHEN lower(category) LIKE '%fish%' OR lower(game_type) LIKE '%fish%' THEN 'Fishing'
    WHEN lower(category) LIKE '%slot%' OR lower(game_type) LIKE '%slot%' THEN 'Slots'
    WHEN lower(category) LIKE '%mini%' OR lower(game_type) LIKE '%mini%' THEN 'Mini Games'
    ELSE 'Mini Games'
  END
  WHERE category NOT IN ('Mini Games', 'Slots', 'Fishing');
`);

function cents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new TypeError("Money amount must be finite");
  const result = Math.round(amount * 100);
  if (!Number.isSafeInteger(result)) throw new RangeError("Money amount exceeds the supported range");
  return result;
}

export function referralCodeForUser(userId) {
  return `B9${createHash("sha256").update(String(userId)).digest("hex").slice(0, 10).toUpperCase()}`;
}

function dollars(value) {
  return Number((Number(value) / 100).toFixed(2));
}

function bool(value) {
  return value ? 1 : 0;
}

function rowUser(row) {
  return {
    id: row.id, username: row.username, phone: row.phone, email: row.email, country: row.country,
    passwordHash: row.password_hash, role: row.role, balance: dollars(row.balance_cents), status: row.status,
    emailVerified: Boolean(row.email_verified), phoneVerified: Boolean(row.phone_verified),
    kycStatus: row.kyc_status, fullName: row.full_name, dateOfBirth: row.date_of_birth,
    documentType: row.document_type, documentNumber: row.document_number, address: row.address,
    googleId: row.google_id, googlePictureUrl: row.google_picture_url, avatarPath: row.avatar_path,
    createdAt: row.created_at, lastLoginAt: row.last_login_at,
    kycReviewedAt: row.kyc_reviewed_at, kycReviewNote: row.kyc_review_note,
    failedAdminAttempts: row.failed_admin_attempts, lockedUntil: row.locked_until, kycDocuments: {},
    agentOwnerId: row.agent_owner_id || "", agentBalance: dollars(row.agent_balance_cents || 0),
    playerLimit: dollars(row.player_limit_cents || 0),
    referralCode: row.referral_code || "",
  };
}

function rowTransaction(row) {
  return {
    id: row.id, userId: row.user_id, username: row.username, type: row.type,
    amount: dollars(row.amount_cents), status: row.status, paymentMethod: row.payment_method,
    paymentReference: row.payment_reference, paymentNote: row.payment_note, proofFile: row.proof_file,
    gameName: row.game_name, createdAt: row.created_at, processedAt: row.processed_at,
  };
}

export function readUserById(id) {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!row) return undefined;
  const user = rowUser(row);
  for (const document of db.prepare("SELECT kind, file_path FROM kyc_documents WHERE user_id = ?").all(id)) {
    user.kycDocuments[document.kind] = document.file_path;
  }
  return user;
}

function legacyRead() {
  try {
    return JSON.parse(fs.readFileSync(legacyJsonFile, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new Error("Could not read legacy database.json", { cause: error });
  }
}

export function readPlatformSettings() {
  const settings = db.prepare("SELECT * FROM platform_settings WHERE id = 1").get();
  if (!settings) return {};
  return {
    announcement: settings.announcement,
    maintenanceMode: Boolean(settings.maintenance_mode),
    supportEmail: settings.support_email,
    supportPhone: settings.support_phone,
    supportHours: settings.support_hours,
    promotions: JSON.parse(settings.promotions || "[]"),
    bankName: settings.bank_name,
    accountName: settings.account_name,
    accountNumber: settings.account_number,
    iban: settings.iban,
    upiId: settings.upi_id,
    walletName: settings.wallet_name,
    walletNumber: settings.wallet_number,
    paymentInstructions: settings.payment_instructions,
    jackpotAmount: dollars(settings.jackpot_display_cents),
  };
}

export function readRewardSettings() {
  const row = db.prepare("SELECT * FROM reward_settings WHERE id = 1").get();
  if (!row) return { ...DEFAULT_REWARD_SETTINGS };
  return {
    dailyEnabled: Boolean(row.daily_enabled),
    dailyRewards: JSON.parse(row.daily_rewards || "[]"),
    dailyResetTimezone: row.daily_reset_timezone || "UTC",
    streakResetOnMissedDay: Boolean(row.streak_reset_on_missed_day),
    vipEnabled: Boolean(row.vip_enabled),
    vipWindowDays: Number(row.vip_window_days),
    vipTiers: JSON.parse(row.vip_tiers || "{}"),
    cashbackEnabled: Boolean(row.cashback_enabled),
    cashbackRate: Number(row.cashback_rate),
    cashbackWeeklyCap: dollars(row.cashback_weekly_cap_cents),
  };
}

export function writeRewardSettings(settings) {
  db.prepare(`
    UPDATE reward_settings SET daily_enabled = ?, daily_rewards = ?, daily_reset_timezone = ?,
      streak_reset_on_missed_day = ?, vip_enabled = ?, vip_window_days = ?, vip_tiers = ?,
      cashback_enabled = ?, cashback_rate = ?, cashback_weekly_cap_cents = ?
    WHERE id = 1
  `).run(
    bool(settings.dailyEnabled),
    JSON.stringify(settings.dailyRewards),
    settings.dailyResetTimezone,
    bool(settings.streakResetOnMissedDay),
    bool(settings.vipEnabled),
    settings.vipWindowDays,
    JSON.stringify(settings.vipTiers),
    bool(settings.cashbackEnabled),
    settings.cashbackRate,
    cents(settings.cashbackWeeklyCap),
  );
  return readRewardSettings();
}

export function readDb() {
  const result = {
    users: db.prepare("SELECT * FROM users ORDER BY rowid DESC").all().map(rowUser),
    transactions: db.prepare("SELECT * FROM transactions ORDER BY rowid DESC").all().map(rowTransaction),
    otps: db.prepare("SELECT * FROM otps").all().map((row) => ({
      channel: row.channel, destination: row.destination, codeHash: row.code_hash, expiresAt: row.expires_at,
    })),
    notifications: db.prepare("SELECT * FROM notifications ORDER BY rowid DESC").all().map((row) => ({
      id: row.id, userId: row.user_id, type: row.type, title: row.title, message: row.message,
      relatedId: row.related_id, read: Boolean(row.is_read), createdAt: row.created_at,
    })),
    supportTickets: db.prepare("SELECT * FROM support_tickets ORDER BY rowid DESC").all().map((row) => ({
      id: row.id, userId: row.user_id, username: row.username, subject: row.subject,
      message: row.message, status: row.status, reply: row.reply, createdAt: row.created_at, updatedAt: row.updated_at,
    })),
    auditLogs: db.prepare("SELECT * FROM audit_logs ORDER BY rowid DESC").all().map((row) => ({
      id: row.id, adminUsername: row.admin_username, action: row.action, target: row.target,
      details: row.details, createdAt: row.created_at,
    })),
    gameResults: db.prepare("SELECT * FROM game_results ORDER BY rowid DESC").all().map((row) => ({
      id: row.id, userId: row.user_id, category: row.category, gameName: row.game_name,
      outcome: row.outcome, amount: dollars(row.amount_cents), reference: row.reference, createdAt: row.created_at,
    })),
    platformSettings: readPlatformSettings(),
    verifications: {},
  };
  const usersById = new Map(result.users.map((user) => [user.id, user]));
  for (const row of db.prepare("SELECT * FROM kyc_documents").all()) {
    const user = usersById.get(row.user_id);
    if (user) user.kycDocuments[row.kind] = row.file_path;
  }
  for (const row of db.prepare("SELECT * FROM verifications").all()) {
    result.verifications[`${row.channel}:${row.destination}`] = Boolean(row.verified);
  }
  return result;
}

export function writeDb(source, referralSignup = null) {
  db.exec("BEGIN IMMEDIATE;");
  try {
    for (const table of ["kyc_documents", "notifications", "otps", "verifications", "support_tickets", "platform_settings"]) {
      db.exec(`DELETE FROM ${table};`);
    }

    const insertUser = db.prepare(`
      INSERT INTO users (id, username, phone, email, country, password_hash, role, balance_cents, status,
        email_verified, phone_verified, kyc_status, full_name, date_of_birth, document_type, document_number,
        address, google_id, google_picture_url, avatar_path, created_at, last_login_at, kyc_reviewed_at, kyc_review_note,
        failed_admin_attempts, locked_until, agent_owner_id, agent_balance_cents, player_limit_cents, referral_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        username = excluded.username, phone = excluded.phone, email = excluded.email, country = excluded.country,
        password_hash = excluded.password_hash,
        role = CASE WHEN users.role = 'agent' THEN users.role ELSE excluded.role END,
        balance_cents = users.balance_cents,
        status = excluded.status, email_verified = excluded.email_verified, phone_verified = excluded.phone_verified,
        kyc_status = excluded.kyc_status, full_name = excluded.full_name, date_of_birth = excluded.date_of_birth,
        document_type = excluded.document_type, document_number = excluded.document_number, address = excluded.address,
        google_id = excluded.google_id, google_picture_url = excluded.google_picture_url,
        avatar_path = excluded.avatar_path, created_at = excluded.created_at,
        last_login_at = excluded.last_login_at, kyc_reviewed_at = excluded.kyc_reviewed_at,
        kyc_review_note = excluded.kyc_review_note, failed_admin_attempts = excluded.failed_admin_attempts,
        locked_until = excluded.locked_until, agent_owner_id = users.agent_owner_id,
        agent_balance_cents = users.agent_balance_cents, player_limit_cents = users.player_limit_cents,
        referral_code = users.referral_code
    `);
    const insertKycDocument = db.prepare("INSERT INTO kyc_documents (user_id, kind, file_path) VALUES (?, ?, ?)");
    for (const user of source.users || []) {
      insertUser.run(
        String(user.id || ""), String(user.username || ""), String(user.phone || ""), String(user.email || ""),
        String(user.country || ""), String(user.passwordHash || ""), String(user.role || "user"), cents(user.balance || 0),
        String(user.status || "active"), bool(user.emailVerified), bool(user.phoneVerified),
        String(user.kycStatus || "not_submitted"), String(user.fullName || ""), String(user.dateOfBirth || ""),
        String(user.documentType || ""), String(user.documentNumber || ""), String(user.address || ""),
        String(user.googleId || ""), String(user.googlePictureUrl || ""), String(user.avatarPath || ""),
        String(user.createdAt || ""), user.lastLoginAt || null,
        user.kycReviewedAt || null, String(user.kycReviewNote || ""), Number(user.failedAdminAttempts || 0),
        Number(user.lockedUntil || 0), String(user.agentOwnerId || ""), cents(user.agentBalance || 0),
        cents(user.playerLimit || 0), String(user.referralCode || referralCodeForUser(user.id)),
      );
      for (const [kind, filePath] of Object.entries(user.kycDocuments || {})) {
        insertKycDocument.run(String(user.id), kind, String(filePath || ""));
      }
    }
    if (referralSignup?.referrerId) {
      db.prepare(`
        INSERT INTO referral_rewards (id, referrer_user_id, referred_user_id, status, created_at)
        VALUES (?, ?, ?, 'pending', ?)
      `).run(randomUUID(), String(referralSignup.referrerId), String(referralSignup.referredUserId), new Date().toISOString());
    }

    const insertTransaction = db.prepare(`
      INSERT INTO transactions (id, user_id, username, type, amount_cents, status, payment_method,
        payment_reference, payment_note, proof_file, game_name, created_at, processed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `);
    for (const item of source.transactions || []) {
      insertTransaction.run(
        String(item.id || ""), String(item.userId || ""), String(item.username || ""), String(item.type || ""),
        cents(item.amount || 0), String(item.status || "pending"), String(item.paymentMethod || ""),
        String(item.paymentReference || ""), String(item.paymentNote || ""), String(item.proofFile || ""),
        String(item.gameName || ""), String(item.createdAt || ""), item.processedAt || null,
      );
    }

    const insertOtp = db.prepare("INSERT INTO otps (channel, destination, code_hash, expires_at) VALUES (?, ?, ?, ?)");
    for (const item of source.otps || []) insertOtp.run(item.channel, item.destination, item.codeHash, Number(item.expiresAt));
    const insertVerification = db.prepare("INSERT INTO verifications (channel, destination, verified) VALUES (?, ?, ?)");
    for (const [key, verified] of Object.entries(source.verifications || {})) {
      const separator = key.indexOf(":");
      insertVerification.run(key.slice(0, separator), key.slice(separator + 1), bool(verified));
    }
    const insertNotification = db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, related_id, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of source.notifications || []) {
      insertNotification.run(item.id, item.userId, item.type, item.title, item.message, item.relatedId || "", bool(item.read), item.createdAt || "");
    }
    const insertTicket = db.prepare(`
      INSERT INTO support_tickets (id, user_id, username, subject, message, status, reply, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of source.supportTickets || []) {
      insertTicket.run(item.id, item.userId, item.username || "", item.subject, item.message, item.status || "open", item.reply || "", item.createdAt || "", item.updatedAt || "");
    }
    const insertAudit = db.prepare(`
      INSERT INTO audit_logs (id, admin_username, action, target, details, created_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `);
    for (const item of source.auditLogs || []) {
      insertAudit.run(item.id, item.adminUsername || "", item.action, item.target || "", item.details || "", item.createdAt || "");
    }
    const insertResult = db.prepare(`
      INSERT INTO game_results (id, user_id, category, game_name, outcome, amount_cents, reference, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `);
    for (const item of source.gameResults || []) {
      insertResult.run(item.id, item.userId, item.category, item.gameName || "", item.outcome, cents(item.amount || 0), item.reference || "", item.createdAt || "");
    }
    const settings = source.platformSettings || {};
    db.prepare(`
      INSERT INTO platform_settings (
        id, announcement, maintenance_mode, support_email, support_phone, support_hours, promotions,
        bank_name, account_name, account_number, iban, upi_id, wallet_name, wallet_number,
        payment_instructions, jackpot_display_cents
      )
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      String(settings.announcement || ""),
      bool(settings.maintenanceMode),
      String(settings.supportEmail || ""),
      String(settings.supportPhone || ""),
      String(settings.supportHours || ""),
      JSON.stringify(settings.promotions || []),
      String(settings.bankName || ""),
      String(settings.accountName || ""),
      String(settings.accountNumber || ""),
      String(settings.iban || ""),
      String(settings.upiId || ""),
      String(settings.walletName || ""),
      String(settings.walletNumber || ""),
      String(settings.paymentInstructions || ""),
      cents(settings.jackpotAmount ?? 10799004.2),
    );
    db.exec(`
      DELETE FROM audit_logs
      WHERE id NOT IN (SELECT id FROM audit_logs ORDER BY created_at DESC, rowid DESC LIMIT 1000)
    `);
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

export function toCents(amount) {
  return cents(amount);
}

export function fromCents(amount) {
  return dollars(amount);
}

function normalizedGameName(name) {
  return String(name).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function canonicalGameCategory(category, gameType = "") {
  if (GAME_CATEGORIES.includes(category)) return category;
  const value = String(category || gameType || "").toLowerCase();
  if (value.includes("fish")) return "Fishing";
  if (value.includes("slot")) return "Slots";
  if (value.includes("mini")) return "Mini Games";
  return "Mini Games";
}

function providerRow(row) {
  return {
    code: row.code,
    name: row.name,
    enabled: Boolean(row.enabled),
    logo: row.logo,
    gameCount: Number(row.game_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function gameRow(row) {
  return {
    id: row.id,
    providerCode: row.provider_code,
    provider: row.provider_name,
    providerEnabled: Boolean(row.provider_enabled),
    externalId: row.external_id,
    name: row.name,
    thumbnail: row.thumbnail,
    category: row.category,
    isPopular: Boolean(row.is_popular),
    gameType: row.game_type,
    sortOrder: row.sort_order,
    enabled: Boolean(row.enabled),
    providerStatus: row.provider_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listManagedProviders() {
  return db.prepare(`
    SELECT p.*, COUNT(g.id) AS game_count
    FROM game_providers p LEFT JOIN managed_games g ON g.provider_code = p.code
    GROUP BY p.code ORDER BY p.name COLLATE NOCASE
  `).all().map(providerRow);
}

export function getManagedProvider(code) {
  const row = db.prepare(`
    SELECT p.*, COUNT(g.id) AS game_count
    FROM game_providers p LEFT JOIN managed_games g ON g.provider_code = p.code
    WHERE p.code = ? GROUP BY p.code
  `).get(code);
  return row ? providerRow(row) : null;
}

export function saveManagedProvider({ code, name, enabled, logo }) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO game_providers (code, name, enabled, logo, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name,
      enabled = excluded.enabled,
      logo = CASE WHEN ? IS NULL THEN game_providers.logo ELSE excluded.logo END,
      updated_at = excluded.updated_at
  `).run(code, name, enabled ? 1 : 0, logo ?? "", now, now, logo ?? null);
  return getManagedProvider(code);
}

const managedGameSelect = `
  SELECT g.*, p.name AS provider_name, p.enabled AS provider_enabled
  FROM managed_games g JOIN game_providers p ON p.code = g.provider_code
`;

export function listManagedGames({ search = "", provider = "", category = "" } = {}) {
  const clauses = [];
  const parameters = [];
  if (search) {
    clauses.push("(g.name LIKE ? ESCAPE '\\' OR p.name LIKE ? ESCAPE '\\')");
    const escaped = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    parameters.push(escaped, escaped);
  }
  if (provider) {
    clauses.push("(g.provider_code = ? OR p.name = ?)");
    parameters.push(provider, provider);
  }
  if (category) {
    clauses.push("g.category = ?");
    parameters.push(category);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db.prepare(`${managedGameSelect} ${where} ORDER BY g.sort_order, g.name COLLATE NOCASE`)
    .all(...parameters).map(gameRow);
}

export function getManagedGame(id) {
  const row = db.prepare(`${managedGameSelect} WHERE g.id = ?`).get(id);
  return row ? gameRow(row) : null;
}

export function getPublicManagedGame(id) {
  const row = db.prepare(`
    ${managedGameSelect}
    WHERE g.id = ? AND g.enabled = 1 AND p.enabled = 1
  `).get(id);
  return row ? gameRow(row) : null;
}

export function addManagedGame({ providerCode, externalId, name, thumbnail = "", category = "Mini Games", gameType = "", sortOrder = 0, isPopular = false, enabled = false, providerStatus = 0 }) {
  const now = new Date().toISOString();
  const id = externalId;
  db.prepare(`
    INSERT INTO managed_games (
      id, provider_code, external_id, name, normalized_name, thumbnail, category,
      game_type, sort_order, enabled, is_popular, provider_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, providerCode, externalId, name, normalizedGameName(name), thumbnail, canonicalGameCategory(category, gameType),
    gameType, sortOrder, enabled ? 1 : 0, isPopular ? 1 : 0, providerStatus, now, now,
  );
  return getManagedGame(id);
}

export function updateManagedGame(id, updates) {
  const current = getManagedGame(id);
  if (!current) return null;
  const fields = {
    name: updates.name ?? current.name,
    thumbnail: updates.thumbnail ?? current.thumbnail,
    provider_code: updates.providerCode ?? current.providerCode,
    game_type: updates.gameType ?? current.gameType,
    provider_status: updates.providerStatus ?? current.providerStatus,
    category: canonicalGameCategory(updates.category ?? current.category, current.gameType),
    sort_order: updates.sortOrder ?? current.sortOrder,
    is_popular: updates.isPopular === undefined ? Number(current.isPopular) : updates.isPopular ? 1 : 0,
    enabled: updates.enabled === undefined ? Number(current.enabled) : updates.enabled ? 1 : 0,
  };
  db.prepare(`
    UPDATE managed_games
    SET provider_code = ?, name = ?, normalized_name = ?, thumbnail = ?, category = ?,
      game_type = ?, provider_status = ?, sort_order = ?, enabled = ?, is_popular = ?, updated_at = ?
    WHERE id = ?
  `).run(
    fields.provider_code, fields.name, normalizedGameName(fields.name), fields.thumbnail, fields.category,
    fields.game_type, fields.provider_status, fields.sort_order, fields.enabled, fields.is_popular,
    new Date().toISOString(), id,
  );
  return getManagedGame(id);
}

export function updateManagedGameEnabled(id, enabled) {
  return updateManagedGame(id, { enabled });
}

export function getGameCatalogPageSize() {
  return db.prepare("SELECT page_size FROM game_catalog_settings WHERE id = 1").get().page_size;
}

export function listGameCategories() {
  return db.prepare("SELECT name FROM game_categories ORDER BY sort_order").all().map((row) => row.name);
}

export function setGameCatalogPageSize(pageSize) {
  db.prepare("UPDATE game_catalog_settings SET page_size = ? WHERE id = 1").run(pageSize);
  return pageSize;
}

export function getGameManagementStats() {
  const providers = db.prepare("SELECT COUNT(*) AS count FROM game_providers").get().count;
  const totalGames = db.prepare("SELECT COUNT(*) AS count FROM managed_games").get().count;
  const availableGames = db.prepare("SELECT COUNT(*) AS count FROM managed_games WHERE provider_status = 0").get().count;
  const activeGames = db.prepare(`
    SELECT COUNT(*) AS count FROM managed_games g
    JOIN game_providers p ON p.code = g.provider_code
    WHERE g.enabled = 1 AND p.enabled = 1 AND g.provider_status = 0
  `).get().count;
  return {
    totalProviders: providers,
    totalGames,
    availableGames,
    activeGames,
    disabledGames: totalGames - activeGames,
  };
}

export function getPublicGameCatalog({ page = 1, search = "", provider = "", category = "", sort = "popular" } = {}) {
  const clauses = ["g.enabled = 1", "p.enabled = 1"];
  const parameters = [];
  if (search) {
    clauses.push("(g.name LIKE ? ESCAPE '\\' OR p.name LIKE ? ESCAPE '\\' OR g.category LIKE ? ESCAPE '\\')");
    const escaped = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    parameters.push(escaped, escaped, escaped);
  }
  if (provider) {
    clauses.push("(g.provider_code = ? OR p.name = ?)");
    parameters.push(provider, provider);
  }
  if (category === "Popular") {
    clauses.push("g.is_popular = 1");
  } else if (category === "PG Slot") {
    clauses.push("(g.category = 'Slots' OR lower(g.game_type) LIKE '%slot%' OR lower(p.name) LIKE '%pg%' OR lower(p.name) LIKE '%jili%' OR lower(p.name) LIKE '%pragmatic%')");
  } else if (category === "Spribe") {
    clauses.push("(lower(g.game_type) LIKE '%spribe%' OR lower(p.name) LIKE '%spribe%')");
  } else if (category === "InOut") {
    clauses.push("(lower(g.game_type) LIKE '%inout%' OR lower(p.name) LIKE '%inout%')");
  } else if (GAME_CATEGORIES.includes(category)) {
    clauses.push("g.category = ?");
    parameters.push(category);
  }
  const where = clauses.join(" AND ");
  const total = db.prepare(`
    SELECT COUNT(*) AS count FROM managed_games g
    JOIN game_providers p ON p.code = g.provider_code
    WHERE ${where}
  `).get(...parameters).count;
  const pageSize = getGameCatalogPageSize();
  const pageCount = Math.ceil(total / pageSize);
  const currentPage = Math.min(Math.max(1, page), Math.max(1, pageCount));
  const order = sort === "name"
    ? "g.name COLLATE NOCASE, g.sort_order"
    : sort === "provider"
      ? "p.name COLLATE NOCASE, g.sort_order, g.name COLLATE NOCASE"
      : "g.sort_order, g.name COLLATE NOCASE";
  const games = db.prepare(`
    ${managedGameSelect}
    WHERE ${where}
    ORDER BY ${order}
    LIMIT ? OFFSET ?
  `).all(...parameters, pageSize, (currentPage - 1) * pageSize).map((game) => ({
    id: game.id,
    name: game.name,
    provider: game.provider_name,
    providerCode: game.provider_code,
    gameType: game.game_type,
    category: game.category,
    isPopular: Boolean(game.is_popular),
    thumbnail: game.thumbnail,
    status: game.provider_status,
  }));
  const providers = db.prepare(`
    SELECT DISTINCT p.code, p.name, p.logo FROM game_providers p
    JOIN managed_games g ON g.provider_code = p.code
    WHERE p.enabled = 1 AND g.enabled = 1 ORDER BY p.name COLLATE NOCASE
  `).all().map((row) => ({ code: row.code, name: row.name, logo: row.logo }));
  const categories = db.prepare(`
    SELECT category FROM managed_games g
    JOIN game_providers p ON p.code = g.provider_code
    WHERE g.enabled = 1 AND p.enabled = 1
    GROUP BY category ORDER BY category COLLATE NOCASE
  `).all().map((row) => row.category);
  return { games, page: currentPage, pageSize, total, pageCount, hasMore: currentPage < pageCount, providers, categories };
}

export function reservedWithdrawalCents(userId) {
  return db.prepare(`
    SELECT COALESCE(SUM(amount_cents), 0) AS total FROM transactions
    WHERE user_id = ? AND type = 'withdrawal' AND status = 'pending'
  `).get(userId).total;
}

export function ensureGamePlayer(userId, currency, playerPrefix = process.env.HUIDU_PLAYER_PREFIX || "b9") {
  const user = db.prepare("SELECT id, status FROM users WHERE id = ?").get(userId);
  if (!user || user.status !== "active") throw new Error("Account unavailable");
  if (!/^[a-zA-Z0-9]{2,8}$/.test(playerPrefix)) throw new Error("HUIDU player prefix must contain 2–8 letters or numbers");
  const existing = db.prepare("SELECT player_id, currency, provider_created FROM game_players WHERE user_id = ?").get(userId);
  if (existing) {
    if (existing.currency !== currency) throw new Error("Game currency is already fixed for this account");
    if (existing.player_id.length > 20 || !/^[a-zA-Z0-9]{3,20}$/.test(existing.player_id)) {
      throw new Error("Existing game account name is incompatible with HUIDU; contact support before launching games");
    }
    return {
      playerId: existing.player_id,
      currency: existing.currency,
      providerCreated: Boolean(existing.provider_created),
    };
  }
  const suffixLength = 20 - playerPrefix.length;
  const playerId = `${playerPrefix}${createHash("sha256").update(userId).digest("hex").slice(0, suffixLength)}`;
  db.prepare("INSERT INTO game_players (user_id, player_id, currency, provider_created, created_at) VALUES (?, ?, ?, 0, ?)")
    .run(userId, playerId, currency, new Date().toISOString());
  return { playerId, currency, providerCreated: false };
}

export function markGamePlayerCreated(userId) {
  db.prepare("UPDATE game_players SET provider_created = 1 WHERE user_id = ?").run(userId);
}

export function getGamePlayer(userId) {
  const player = db.prepare(`
    SELECT player_id AS playerId, currency, provider_created AS providerCreated
    FROM game_players WHERE user_id = ?
  `).get(userId);
  return player ? { ...player, providerCreated: Boolean(player.providerCreated) } : null;
}

function transferRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    playerId: row.player_id,
    currency: row.currency,
    direction: row.direction,
    amountCents: row.amount_cents,
    status: row.status,
    providerBalanceCents: row.provider_balance_cents,
  };
}

export function findPendingGameWalletTransfer(userId, direction) {
  return transferRow(db.prepare(`
    SELECT * FROM game_wallet_transfers
    WHERE user_id = ? AND direction = ? AND status = 'pending'
    ORDER BY created_at LIMIT 1
  `).get(userId, direction));
}

export function getGameWalletTransfer(id) {
  return transferRow(db.prepare("SELECT * FROM game_wallet_transfers WHERE id = ?").get(id));
}

export function beginGameWalletTransfer({ id, userId, playerId, currency, direction, amountCents }) {
  if (!["in", "out"].includes(direction)) throw new TypeError("Invalid game wallet transfer direction");
  if (!Number.isSafeInteger(amountCents) || amountCents < 0 || (direction === "in" && amountCents <= 0)) {
    throw new TypeError("Invalid game wallet transfer amount");
  }
  db.exec("BEGIN IMMEDIATE;");
  try {
    const previous = db.prepare("SELECT * FROM game_wallet_transfers WHERE id = ?").get(id);
    if (previous) {
      if (previous.user_id !== userId || previous.player_id !== playerId || previous.currency !== currency ||
          previous.direction !== direction || (direction === "in" && previous.amount_cents !== amountCents)) {
        throw new Error("Conflicting game wallet transfer");
      }
      db.exec("COMMIT;");
      return transferRow(previous);
    }
    const pending = db.prepare("SELECT id FROM game_wallet_transfers WHERE user_id = ? AND status = 'pending'").get(userId);
    if (pending) throw new Error("Another game wallet transfer is still pending");
    const user = db.prepare("SELECT balance_cents, status FROM users WHERE id = ?").get(userId);
    const player = db.prepare("SELECT player_id, currency FROM game_players WHERE user_id = ?").get(userId);
    if (!user || user.status !== "active") throw new Error("Account unavailable");
    if (!player || player.player_id !== playerId || player.currency !== currency) throw new Error("Game player not found");
    const now = new Date().toISOString();
    if (direction === "in") {
      const available = user.balance_cents - reservedWithdrawalCents(userId);
      if (available < amountCents) throw new Error("Insufficient available balance");
      const next = user.balance_cents - amountCents;
      db.prepare("UPDATE users SET balance_cents = ? WHERE id = ?").run(next, userId);
      db.prepare(`
        INSERT INTO ledger_entries (id, user_id, transaction_id, type, amount_cents, balance_cents, reference, created_at)
        VALUES (?, ?, ?, 'debit', ?, ?, ?, ?)
      `).run(randomUUID(), userId, id, -amountCents, next, "Transfer to game wallet", now);
    }
    db.prepare(`
      INSERT INTO game_wallet_transfers (
        id, user_id, player_id, currency, direction, amount_cents, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(id, userId, playerId, currency, direction, amountCents, now, now);
    db.exec("COMMIT;");
    return transferRow(db.prepare("SELECT * FROM game_wallet_transfers WHERE id = ?").get(id));
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

export function completeGameWalletTransfer({ id, amountCents, providerBalanceCents }) {
  if (![amountCents, providerBalanceCents].every(Number.isSafeInteger) || amountCents < 0 || providerBalanceCents < 0) {
    throw new TypeError("Invalid provider transfer response");
  }
  db.exec("BEGIN IMMEDIATE;");
  try {
    const transfer = db.prepare("SELECT * FROM game_wallet_transfers WHERE id = ?").get(id);
    if (!transfer) throw new Error("Game wallet transfer not found");
    if (transfer.status === "completed") {
      db.exec("COMMIT;");
      return { transfer: transferRow(transfer), balance: dollars(db.prepare("SELECT balance_cents FROM users WHERE id = ?").get(transfer.user_id).balance_cents) };
    }
    if (transfer.status !== "pending") throw new Error("Game wallet transfer is not pending");
    if (transfer.direction === "in" && transfer.amount_cents !== amountCents) {
      throw new Error("Provider transfer amount does not match the reserved amount");
    }

    if (transfer.direction === "out") {
      const user = db.prepare("SELECT balance_cents FROM users WHERE id = ? AND status = 'active'").get(transfer.user_id);
      if (!user) throw new Error("Account unavailable");
      const next = user.balance_cents + amountCents;
      if (!Number.isSafeInteger(next)) throw new RangeError("Provider balance exceeds the supported range");
      if (amountCents > 0) {
        db.prepare("UPDATE users SET balance_cents = ? WHERE id = ?").run(next, transfer.user_id);
        db.prepare(`
          INSERT INTO ledger_entries (id, user_id, transaction_id, type, amount_cents, balance_cents, reference, created_at)
          VALUES (?, ?, ?, 'credit', ?, ?, ?, ?)
        `).run(randomUUID(), transfer.user_id, id, amountCents, next, "Return from game wallet", new Date().toISOString());
      }
    }
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE game_wallet_transfers SET status = 'completed', amount_cents = ?, provider_balance_cents = ?, updated_at = ?
      WHERE id = ? AND status = 'pending'
    `).run(amountCents, providerBalanceCents, now, id);
    const balance = db.prepare("SELECT balance_cents FROM users WHERE id = ?").get(transfer.user_id).balance_cents;
    db.exec("COMMIT;");
    return { transfer: { ...transferRow(transfer), amountCents, status: "completed", providerBalanceCents }, balance: dollars(balance) };
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

export function failGameWalletTransfer(id) {
  db.exec("BEGIN IMMEDIATE;");
  try {
    const transfer = db.prepare("SELECT * FROM game_wallet_transfers WHERE id = ?").get(id);
    if (!transfer) throw new Error("Game wallet transfer not found");
    if (transfer.status !== "pending") {
      db.exec("COMMIT;");
      return transferRow(transfer);
    }
    if (transfer.direction === "in") {
      const user = db.prepare("SELECT balance_cents FROM users WHERE id = ?").get(transfer.user_id);
      if (!user) throw new Error("Account unavailable");
      const next = user.balance_cents + transfer.amount_cents;
      db.prepare("UPDATE users SET balance_cents = ? WHERE id = ?").run(next, transfer.user_id);
      db.prepare(`
        INSERT INTO ledger_entries (id, user_id, transaction_id, type, amount_cents, balance_cents, reference, created_at)
        VALUES (?, ?, ?, 'credit', ?, ?, ?, ?)
      `).run(randomUUID(), transfer.user_id, id, transfer.amount_cents, next, "Failed game transfer refund", new Date().toISOString());
    }
    db.prepare("UPDATE game_wallet_transfers SET status = 'failed', updated_at = ? WHERE id = ? AND status = 'pending'")
      .run(new Date().toISOString(), id);
    db.exec("COMMIT;");
    return { ...transferRow(transfer), status: "failed" };
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

export function changeBalance({ userId, amount, type, transactionId = null, reference = "" }) {
  if (!["credit", "debit"].includes(type)) throw new TypeError("Balance change type must be credit or debit");
  db.exec("BEGIN IMMEDIATE;");
  try {
    const row = db.prepare("SELECT balance_cents FROM users WHERE id = ?").get(userId);
    if (!row) throw new Error("User not found");
    const delta = cents(amount);
    if (delta <= 0) throw new TypeError("Balance changes must be positive");
    const next = row.balance_cents + (type === "credit" ? delta : -delta);
    if (next < 0) throw new Error("Insufficient balance");
    if (type === "debit" && next < reservedWithdrawalCents(userId)) {
      throw new Error("Insufficient available balance");
    }
    db.prepare("UPDATE users SET balance_cents = ? WHERE id = ?").run(next, userId);
    db.prepare(`
      INSERT INTO ledger_entries (id, user_id, transaction_id, type, amount_cents, balance_cents, reference, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), userId, transactionId, type, type === "credit" ? delta : -delta, next, reference, new Date().toISOString());
    db.exec("COMMIT;");
    return dollars(next);
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

export function createWithdrawalRequest(transaction, notification) {
  db.exec("BEGIN IMMEDIATE;");
  try {
    const user = db.prepare("SELECT balance_cents, status, kyc_status FROM users WHERE id = ?").get(transaction.userId);
    if (!user || user.status !== "active") throw new Error("Account unavailable");
    if (user.kyc_status !== "verified") throw new Error("Complete KYC verification before requesting a withdrawal");
    const reserved = reservedWithdrawalCents(transaction.userId);
    if (user.balance_cents - reserved < cents(transaction.amount)) throw new Error("Insufficient available balance");
    db.prepare(`
      INSERT INTO transactions (id, user_id, username, type, amount_cents, status, payment_method,
        payment_reference, payment_note, proof_file, game_name, created_at, processed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(transaction.id, transaction.userId, transaction.username, transaction.type, cents(transaction.amount), "pending",
      transaction.paymentMethod || "", transaction.paymentReference || "", transaction.paymentNote || "",
      transaction.proofFile || "", "", transaction.createdAt);
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, related_id, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `).run(notification.id, notification.userId, notification.type, notification.title, notification.message, notification.relatedId || "", notification.createdAt);
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

export function decideTransaction({ transactionId, status, adminUsername }) {
  db.exec("BEGIN IMMEDIATE;");
  try {
    const row = db.prepare("SELECT * FROM transactions WHERE id = ?").get(transactionId);
    if (!row) throw new Error("Request not found");
    if (row.status !== "pending") throw new Error("Request already processed");
    const user = db.prepare("SELECT id, username, country, balance_cents, kyc_status FROM users WHERE id = ?").get(row.user_id);
    if (!user) throw new Error("User not found");
    let balance = dollars(user.balance_cents);
    if (status === "approved") {
      if (user.kyc_status !== "verified") throw new Error("KYC verification is required before approving deposits or withdrawals");
      const delta = row.amount_cents * (row.type === "deposit" ? 1 : -1);
      balance = dollars(user.balance_cents + delta);
      if (balance < 0) throw new Error("Insufficient balance to approve this withdrawal");
      db.prepare("UPDATE users SET balance_cents = ? WHERE id = ?").run(user.balance_cents + delta, user.id);
      db.prepare(`
        INSERT INTO ledger_entries (id, user_id, transaction_id, type, amount_cents, balance_cents, reference, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), user.id, row.id, delta >= 0 ? "credit" : "debit", delta, user.balance_cents + delta, row.payment_reference || row.id, new Date().toISOString());
    }
    const processedAt = new Date().toISOString();
    db.prepare("UPDATE transactions SET status = ?, processed_at = ? WHERE id = ? AND status = 'pending'").run(status, processedAt, row.id);
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, related_id, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `).run(randomUUID(), user.id, row.type, `${row.type === "deposit" ? "Deposit" : "Withdrawal"} ${status}`,
      `Your request for ${displayCurrency(currencyForCountry(user.country))} ${dollars(row.amount_cents).toLocaleString("en-US")} was ${status}.`, row.id, processedAt);
    db.prepare(`
      INSERT INTO audit_logs (id, admin_username, action, target, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), adminUsername, `${row.type.toUpperCase()}_${status.toUpperCase()}`, user.username,
      `${displayCurrency(currencyForCountry(user.country))} ${dollars(row.amount_cents).toLocaleString("en-US")}`, processedAt);
    db.exec("COMMIT;");
    return { transactionId: row.id, balance };
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

export function backupSqlite(backupDir) {
  fs.mkdirSync(backupDir, { recursive: true });
  db.exec("PRAGMA wal_checkpoint(FULL);");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destination = path.join(backupDir, `database-${stamp}.sqlite`);
  fs.copyFileSync(sqliteFile, destination);
  const retention = Math.max(1, Number(process.env.DB_BACKUP_RETENTION || 14));
  const backups = fs.readdirSync(backupDir).filter((name) => /^database-.*\.sqlite$/.test(name)).sort().reverse();
  for (const old of backups.slice(retention)) fs.unlinkSync(path.join(backupDir, old));
  return destination;
}

function migrateLegacyJson() {
  const legacyTables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);
  const hasLegacyRows = legacyTables.includes("users_json_legacy") || legacyTables.includes("transactions_json_legacy");
  if (hasLegacyRows) {
    const users = legacyTables.includes("users_json_legacy")
      ? db.prepare("SELECT data FROM users_json_legacy ORDER BY rowid").all().map((row) => JSON.parse(row.data))
      : [];
    const transactions = legacyTables.includes("transactions_json_legacy")
      ? db.prepare("SELECT data FROM transactions_json_legacy ORDER BY rowid").all().map((row) => JSON.parse(row.data))
      : [];
    const state = {};
    for (const row of db.prepare("SELECT key, value FROM app_state").all()) state[row.key] = JSON.parse(row.value);
    writeDb({ ...state, users, transactions });
    db.exec("DELETE FROM app_state;");
    if (legacyTables.includes("transactions_json_legacy")) db.exec("DROP TABLE transactions_json_legacy;");
    if (legacyTables.includes("users_json_legacy")) db.exec("DROP TABLE users_json_legacy;");
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    `);
    return;
  }
  if (db.prepare("SELECT COUNT(*) AS count FROM users").get().count > 0) return;
  const legacy = legacyRead();
  if (legacy) writeDb(legacy);
}

migrateLegacyJson();
