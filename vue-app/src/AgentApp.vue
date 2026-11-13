<template>
  <main class="agent-app">
    <header class="agent-header">
      <button class="agent-brand" type="button" @click="router.push('/')">
        <span class="agent-mark"><img :src="b9Logo" alt="B9 logo" /></span>
        <span><strong>AGENT PORTAL</strong><small>Network management</small></span>
      </button>
      <div class="agent-header-actions">
        <span v-if="dashboard" class="agent-user">{{ dashboard.agent.username }}</span>
        <button type="button" class="agent-back" @click="router.push('/account')">Back to account</button>
      </div>
    </header>

    <section v-if="loading" class="agent-state"><span class="agent-spinner"></span><p>Loading agent portal…</p></section>
    <section v-else-if="error" class="agent-state agent-error" role="alert">
      <h1>Agent portal unavailable</h1><p>{{ error }}</p>
      <button type="button" @click="load">Try again</button>
    </section>
    <section v-else-if="!token" class="agent-state">
      <span class="agent-state-icon">↗</span>
      <span class="agent-eyebrow">B9 NETWORK</span>
      <h1>Agent program</h1>
      <p>Sign in to apply for an agent account or manage your approved player network.</p>
      <button type="button" class="agent-primary" @click="router.push('/')">Go to sign in</button>
    </section>
    <template v-else-if="agentStatus !== 'approved'">
      <section class="agent-apply">
        <span class="agent-eyebrow">B9 NETWORK · AGENT PROGRAM</span>
        <h1>Build and manage your player network.</h1>
        <p class="agent-lead">Apply to become an agent. The B9 team reviews every application before dashboard access is enabled.</p>
        <div v-if="application?.status === 'pending'" class="agent-review-state">
          <span class="agent-state-icon">◷</span>
          <div><strong>Application under review</strong><p>Submitted {{ formatDate(application.createdAt) }}. You’ll be able to manage players after approval.</p></div>
        </div>
        <div v-else-if="application?.status === 'rejected'" class="agent-review-state rejected">
          <span class="agent-state-icon">!</span>
          <div><strong>Application not approved</strong><p>{{ application.reviewNote || "You can update your details and apply again." }}</p></div>
        </div>
        <form v-if="application?.status !== 'pending'" class="agent-card agent-application-form" @submit.prevent="submitApplication">
          <div class="agent-card-heading"><div><span class="agent-eyebrow">APPLICATION</span><h2>Tell us about your operation</h2></div><span class="agent-lock">Admin approval required</span></div>
          <label>Business or network name<input v-model="applicationForm.businessName" required minlength="2" maxlength="120" placeholder="Your business name" /></label>
          <label>Relevant experience<textarea v-model="applicationForm.experience" maxlength="1000" rows="4" placeholder="Describe your experience managing player accounts"></textarea></label>
          <p v-if="error" class="agent-form-error" role="alert">{{ error }}</p>
          <button class="agent-primary" type="submit" :disabled="saving">{{ saving ? "Submitting…" : "Submit agent application" }}</button>
          <small class="agent-disclaimer">Funds remain subject to admin review. Commission is set manually; player limit approvals do not automatically update an external game provider.</small>
        </form>
      </section>
    </template>
    <template v-else-if="dashboard">
      <div class="agent-content">
        <section class="agent-welcome">
          <div><span class="agent-eyebrow">AGENT MANAGEMENT</span><h1>Welcome back, {{ dashboard.agent.username }}</h1><p>Manage your player accounts, submit fund requests, and review your network activity.</p></div>
          <span class="agent-approved"><i></i> Approved agent</span>
        </section>

        <section class="agent-stats" aria-label="Agent summary">
          <article class="agent-stat-card"><span>Available agent balance</span><strong>{{ currency }} {{ money(dashboard.agent.availableBalance) }}</strong><small>After pending player deposits and withdrawals</small></article>
          <article class="agent-stat-card"><span>Total active players</span><strong>{{ dashboard.agent.activePlayers }}</strong><small>{{ dashboard.players.length }} accounts managed</small></article>
          <article class="agent-stat-card"><span>Weekly net turnover</span><strong class="agent-unavailable">Unavailable</strong><small>{{ dashboard.agent.turnoverNote }}</small></article>
          <article class="agent-stat-card"><span>Pending commission</span><strong>{{ currency }} {{ money(dashboard.agent.pendingCommission) }}</strong><small>Manually entered by the B9 team</small></article>
        </section>

        <section class="agent-actions" aria-label="Agent quick actions">
          <button type="button" class="agent-primary" @click="playerModal = true"><span>＋</span>Create new player account</button>
          <button type="button" class="agent-secondary" @click="openRequest('player_deposit')"><span>↓</span>Transfer credits / deposit</button>
          <button type="button" class="agent-secondary" @click="openRequest('agent_withdrawal')"><span>↑</span>Withdraw funds</button>
        </section>

        <section class="agent-card">
          <div class="agent-card-heading"><div><span class="agent-eyebrow">YOUR NETWORK</span><h2>Player management</h2></div>
            <label class="agent-search"><span>⌕</span><input v-model="playerSearch" type="search" placeholder="Search username" aria-label="Search players" /></label>
          </div>
          <div class="agent-table-wrap">
            <table class="agent-table">
              <thead><tr><th>Username</th><th>Current balance</th><th>Last result</th><th>Account status</th><th>Player limit</th><th></th></tr></thead>
              <tbody>
                <tr v-for="player in filteredPlayers" :key="player.id">
                  <td><strong>{{ player.username }}</strong><small>Joined {{ formatDate(player.createdAt) }}</small></td>
                  <td>{{ currency }} {{ money(player.balance) }}</td>
                  <td><span v-if="player.lastResult" class="agent-result" :class="player.lastResult">{{ player.lastResult }}</span><span v-else class="agent-muted">No result data</span></td>
                  <td><span class="agent-status" :class="player.status">{{ player.status }}</span></td>
                  <td>{{ player.playerLimit ? `${currency} ${money(player.playerLimit)}` : "Not set" }}</td>
                  <td><button class="agent-limit-button" type="button" @click="selectedPlayer = player; limitModal = true">Adjust limit</button></td>
                </tr>
                <tr v-if="filteredPlayers.length === 0"><td colspan="6" class="agent-empty">No players match your search.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="agent-card">
          <div class="agent-card-heading"><div><span class="agent-eyebrow">ACCOUNT ACTIVITY</span><h2>Transaction ledger</h2></div>
            <div class="agent-date-filters"><label>From<input v-model="dateFrom" type="date" /></label><label>To<input v-model="dateTo" type="date" /></label></div>
          </div>
          <div class="agent-table-wrap">
            <table class="agent-table agent-ledger">
              <thead><tr><th>Date</th><th>Type</th><th>Player / details</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                <tr v-for="entry in filteredLedger" :key="entry.id">
                  <td>{{ formatDate(entry.createdAt) }}</td>
                  <td>{{ labelType(entry.type) }}</td>
                  <td>{{ entry.playerUsername || entry.periodLabel || entry.paymentReference || entry.note || "Agent account" }}</td>
                  <td>{{ currency }} {{ money(entry.amount) }}</td>
                  <td><span class="agent-status" :class="entry.status">{{ entry.status }}</span></td>
                </tr>
                <tr v-if="filteredLedger.length === 0"><td colspan="5" class="agent-empty">No ledger entries for this date range.</td></tr>
              </tbody>
            </table>
          </div>
          <p class="agent-footnote">All agent deposits, withdrawals, player transfers, and commission payouts are reviewed by an administrator before balances change.</p>
        </section>
      </div>
    </template>

    <div v-if="playerModal" class="agent-modal-backdrop" @click.self="playerModal = false">
      <form class="agent-modal" @submit.prevent="createPlayer">
        <button class="agent-modal-close" type="button" aria-label="Close" @click="playerModal = false">×</button>
        <span class="agent-eyebrow">PLAYER ACCOUNT</span><h2>Create a new player</h2>
        <label>Username<input v-model="playerForm.username" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_]+" autocomplete="off" /></label>
        <label>Temporary password<input v-model="playerForm.password" required minlength="8" maxlength="128" type="password" autocomplete="new-password" /></label>
        <label>Email (optional)<input v-model="playerForm.email" type="email" maxlength="254" /></label>
        <p v-if="error" class="agent-form-error">{{ error }}</p>
        <button class="agent-primary" type="submit" :disabled="saving">{{ saving ? "Creating…" : "Create player" }}</button>
      </form>
    </div>

    <div v-if="requestModal" class="agent-modal-backdrop" @click.self="requestModal = false">
      <form class="agent-modal" @submit.prevent="submitRequest">
        <button class="agent-modal-close" type="button" aria-label="Close" @click="requestModal = false">×</button>
        <span class="agent-eyebrow">ADMIN-REVIEWED REQUEST</span><h2>{{ requestTitle }}</h2>
        <label>Request type<select v-model="requestForm.type">
          <option value="agent_deposit">Deposit to agent balance</option>
          <option value="agent_withdrawal">Withdraw from agent balance</option>
          <option value="player_deposit">Deposit to player</option>
          <option value="player_withdrawal">Withdraw from player</option>
        </select></label>
        <label v-if="requestForm.type.startsWith('player_')">Player<select v-model="requestForm.playerId" required>
          <option value="">Select a player</option><option v-for="player in dashboard?.players" :key="player.id" :value="player.id">{{ player.username }}</option>
        </select></label>
        <label>Amount ({{ currency }})<input v-model.number="requestForm.amount" type="number" min="0.01" step="0.01" required /></label>
        <label>Payment method<input v-model="requestForm.paymentMethod" maxlength="100" placeholder="Bank, UPI, wallet…" /></label>
        <label>Reference / note<input v-model="requestForm.paymentReference" maxlength="150" placeholder="Transaction reference" /></label>
        <p v-if="error" class="agent-form-error">{{ error }}</p>
        <p class="agent-modal-note">This request remains pending until an administrator reviews it.</p>
        <button class="agent-primary" type="submit" :disabled="saving">{{ saving ? "Submitting…" : "Submit request" }}</button>
      </form>
    </div>

    <div v-if="limitModal && selectedPlayer" class="agent-modal-backdrop" @click.self="limitModal = false">
      <form class="agent-modal" @submit.prevent="submitLimitRequest">
        <button class="agent-modal-close" type="button" aria-label="Close" @click="limitModal = false">×</button>
        <span class="agent-eyebrow">PLAYER LIMIT</span><h2>Adjust {{ selectedPlayer.username }}</h2>
        <label>Requested limit ({{ currency }})<input v-model.number="limitForm.limit" type="number" min="0" step="0.01" required /></label>
        <label>Reason<textarea v-model="limitForm.reason" rows="3" maxlength="500"></textarea></label>
        <p v-if="error" class="agent-form-error">{{ error }}</p>
        <p class="agent-modal-note">Admin approval is required. Approved limits are recorded here; an external game-provider limit is not changed automatically.</p>
        <button class="agent-primary" type="submit" :disabled="saving">{{ saving ? "Submitting…" : "Request limit change" }}</button>
      </form>
    </div>
    <p v-if="notice" class="agent-toast" role="status">{{ notice }}</p>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useSessionStore } from "./stores/session";
import b9Logo from "./assets/b9-logo.webp";

type Application = { status: string; businessName: string; experience: string; createdAt: string; reviewNote: string };
type Player = { id: string; username: string; balance: number; status: string; lastResult: string; playerLimit: number; createdAt: string };
type LedgerEntry = { id: string; type: string; amount: number; status: string; createdAt: string; paymentReference?: string; playerUsername?: string; periodLabel?: string; note?: string };
type Dashboard = {
  agent: { username: string; country: string; currency: string; balance: number; availableBalance: number; pendingCommission: number; activePlayers: number; turnoverNote: string };
  players: Player[];
  ledger: LedgerEntry[];
};

const router = useRouter();
const session = useSessionStore();
const token = session.userToken;
const loading = ref(true);
const saving = ref(false);
const error = ref("");
const notice = ref("");
const application = ref<Application | null>(null);
const agentStatus = ref("");
const dashboard = ref<Dashboard | null>(null);
const applicationForm = ref({ businessName: "", experience: "" });
const playerForm = ref({ username: "", password: "", email: "" });
const requestForm = ref({ type: "player_deposit", playerId: "", amount: 0, paymentMethod: "", paymentReference: "" });
const limitForm = ref({ limit: 0, reason: "" });
const playerModal = ref(false);
const requestModal = ref(false);
const limitModal = ref(false);
const selectedPlayer = ref<Player | null>(null);
const playerSearch = ref("");
const dateFrom = ref("");
const dateTo = ref("");
const currency = computed(() => dashboard.value?.agent.currency || "INR");
const filteredPlayers = computed(() => {
  const search = playerSearch.value.trim().toLowerCase();
  return (dashboard.value?.players || []).filter((player) => !search || player.username.toLowerCase().includes(search));
});
const filteredLedger = computed(() => (dashboard.value?.ledger || []).filter((entry) => {
  const day = entry.createdAt.slice(0, 10);
  return (!dateFrom.value || day >= dateFrom.value) && (!dateTo.value || day <= dateTo.value);
}));
const requestTitle = computed(() => ({
  agent_deposit: "Deposit to agent balance",
  agent_withdrawal: "Withdraw agent funds",
  player_deposit: "Transfer credits to player",
  player_withdrawal: "Withdraw player funds",
}[requestForm.value.type] || "Create a fund request"));

function money(value: number): string {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(value: string): string {
  return value ? new Date(value).toLocaleDateString() : "—";
}
function labelType(value: string): string {
  return ({
    agent_deposit: "Agent deposit",
    agent_withdrawal: "Agent withdrawal",
    player_deposit: "Player deposit",
    player_withdrawal: "Player withdrawal",
    commission: "Commission",
  } as Record<string, string>)[value] || value;
}
async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
async function load(): Promise<void> {
  loading.value = true;
  error.value = "";
  if (!token) {
    loading.value = false;
    return;
  }
  try {
    const data = await api("/api/agents/me");
    application.value = data.application;
    agentStatus.value = data.role === "agent" ? "approved" : data.application?.status || "";
    if (agentStatus.value === "approved") {
      dashboard.value = await api("/api/agents/dashboard");
    }
    if (application.value) {
      applicationForm.value.businessName = application.value.businessName;
      applicationForm.value.experience = application.value.experience;
    }
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : "Could not load agent portal.";
  } finally {
    loading.value = false;
  }
}
async function submitApplication(): Promise<void> {
  await perform(async () => {
    await api("/api/agents/apply", { method: "POST", body: JSON.stringify(applicationForm.value) });
    application.value = { ...applicationForm.value, status: "pending", createdAt: new Date().toISOString(), reviewNote: "" };
    agentStatus.value = "pending";
    notify("Application submitted for review");
  });
}
async function createPlayer(): Promise<void> {
  await perform(async () => {
    await api("/api/agents/players", { method: "POST", body: JSON.stringify(playerForm.value) });
    playerForm.value = { username: "", password: "", email: "" };
    playerModal.value = false;
    await loadDashboard();
    notify("Player account created");
  });
}
function openRequest(type: string): void {
  requestForm.value = { type, playerId: "", amount: 0, paymentMethod: "", paymentReference: "" };
  error.value = "";
  requestModal.value = true;
}
async function submitRequest(): Promise<void> {
  await perform(async () => {
    await api("/api/agents/requests", { method: "POST", body: JSON.stringify(requestForm.value) });
    requestModal.value = false;
    await loadDashboard();
    notify("Request submitted for admin review");
  });
}
async function submitLimitRequest(): Promise<void> {
  if (!selectedPlayer.value) return;
  await perform(async () => {
    await api(`/api/agents/players/${selectedPlayer.value?.id}/limit-requests`, {
      method: "POST", body: JSON.stringify(limitForm.value),
    });
    limitModal.value = false;
    limitForm.value = { limit: 0, reason: "" };
    await loadDashboard();
    notify("Limit change requested");
  });
}
async function loadDashboard(): Promise<void> {
  dashboard.value = await api("/api/agents/dashboard");
}
async function perform(action: () => Promise<void>): Promise<void> {
  saving.value = true;
  error.value = "";
  try {
    await action();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : "Action could not be completed.";
  } finally {
    saving.value = false;
  }
}
function notify(message: string): void {
  notice.value = message;
  window.setTimeout(() => {
    if (notice.value === message) notice.value = "";
  }, 3500);
}
onMounted(() => {
  document.title = "Agent Portal | B9 Game";
  void load();
});
</script>

<style>
.agent-app { min-height: 100vh; color: #e8eee9; background: #0c1110; font-family: Inter, "Segoe UI", system-ui, sans-serif; }
.agent-header { position: sticky; z-index: 4; top: 0; display: flex; min-height: 72px; align-items: center; justify-content: space-between; gap: 16px; padding: 0 max(22px, calc((100vw - 1240px) / 2)); border-bottom: 1px solid #222a27; background: rgb(12 17 16 / 94%); backdrop-filter: blur(14px); }
.agent-brand, .agent-header-actions { display: flex; align-items: center; gap: 12px; }
.agent-brand { padding: 0; border: 0; color: inherit; background: transparent; text-align: left; cursor: pointer; }
.agent-brand > span:last-child { display: flex; flex-direction: column; gap: 3px; }
.agent-mark { display: grid; width: 42px; height: 42px; place-items: center; overflow: hidden; border: 1px solid #276443; border-radius: 13px; background: #163321; }
.agent-mark img { display: block; width: 32px; height: 32px; object-fit: contain; }
.agent-brand strong { font-size: 11px; letter-spacing: .13em; }
.agent-brand small, .agent-user { color: #89968f; font-size: 11px; }
.agent-back { padding: 9px 13px; border: 1px solid #303936; border-radius: 9px; color: #dce5df; background: #151c19; font-size: 11px; cursor: pointer; }
.agent-content { width: min(1240px, calc(100% - 40px)); display: flex; flex-direction: column; gap: 18px; margin: 0 auto; padding: 40px 0 70px; }
.agent-welcome { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; }
.agent-welcome h1, .agent-apply h1 { margin: 8px 0; color: #f3f6f3; font-size: clamp(24px, 4vw, 35px); letter-spacing: -.04em; }
.agent-welcome p, .agent-lead { max-width: 700px; margin: 0; color: #98a49d; font-size: 13px; line-height: 1.65; }
.agent-eyebrow { color: #60d487; font-size: 9px; font-weight: 850; letter-spacing: .14em; }
.agent-approved { display: inline-flex; align-items: center; gap: 7px; padding: 8px 11px; border: 1px solid #24583a; border-radius: 999px; color: #8de2a5; background: #14251a; font-size: 10px; white-space: nowrap; }
.agent-approved i { width: 6px; height: 6px; border-radius: 50%; background: #56d77e; box-shadow: 0 0 12px #56d77e; }
.agent-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.agent-stat-card, .agent-card { border: 1px solid #222b27; border-radius: 15px; background: linear-gradient(145deg, #151c19, #111714); }
.agent-stat-card { display: flex; min-height: 130px; flex-direction: column; justify-content: center; gap: 8px; padding: 18px; }
.agent-stat-card > span { color: #9eaaa3; font-size: 11px; }
.agent-stat-card > strong { color: #f1f5f2; font-size: clamp(20px, 2.4vw, 27px); letter-spacing: -.03em; }
.agent-stat-card small { color: #75827a; font-size: 10px; line-height: 1.5; }
.agent-stat-card .agent-unavailable { color: #a3aca6; font-size: 18px; }
.agent-actions { display: flex; flex-wrap: wrap; gap: 9px; }
.agent-primary, .agent-secondary { min-height: 42px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 15px; border-radius: 9px; font-size: 11px; font-weight: 750; cursor: pointer; }
.agent-primary { border: 1px solid #41bc6b; color: #06120a; background: linear-gradient(135deg, #80ec9d, #47c972); box-shadow: 0 8px 20px rgb(65 188 107 / 12%); }
.agent-primary:disabled { opacity: .58; cursor: wait; }
.agent-secondary { border: 1px solid #303b35; color: #e1e9e3; background: #161e19; }
.agent-secondary:hover, .agent-back:hover, .agent-limit-button:hover { border-color: #51ba72; }
.agent-primary > span, .agent-secondary > span { font-size: 18px; line-height: 1; }
.agent-card { overflow: hidden; padding: 18px; }
.agent-card-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.agent-card-heading h2, .agent-modal h2 { margin: 5px 0 0; color: #f0f4f1; font-size: 17px; }
.agent-lock { color: #8c9991; font-size: 10px; }
.agent-search { width: min(280px, 45%); height: 38px; display: flex; align-items: center; gap: 7px; padding: 0 11px; border: 1px solid #303934; border-radius: 9px; color: #718078; background: #0e1411; }
.agent-search input { width: 100%; min-width: 0; border: 0; outline: 0; color: #e8eee9; background: transparent; font-size: 11px; }
.agent-search input::placeholder { color: #718078; }
.agent-table-wrap { width: 100%; overflow-x: auto; }
.agent-table { width: 100%; border-collapse: collapse; text-align: left; white-space: nowrap; }
.agent-table th { padding: 10px 11px; border-bottom: 1px solid #2a332e; color: #7f8c84; font-size: 9px; font-weight: 750; letter-spacing: .07em; text-transform: uppercase; }
.agent-table td { padding: 13px 11px; border-bottom: 1px solid #202824; color: #cdd6d0; font-size: 11px; }
.agent-table tr:last-child td { border-bottom: 0; }
.agent-table td:first-child { display: table-cell; }
.agent-table td:first-child strong, .agent-table td:first-child small { display: block; }
.agent-table td:first-child strong { color: #eef3ef; font-size: 11px; }
.agent-table td:first-child small { margin-top: 4px; color: #78857d; font-size: 9px; }
.agent-result { padding: 4px 7px; border-radius: 99px; font-size: 9px; text-transform: capitalize; }
.agent-result.won { color: #8ce2a4; background: #183421; }
.agent-result.lost { color: #f09999; background: #351f21; }
.agent-muted, .agent-empty { color: #718078 !important; }
.agent-status { display: inline-flex; padding: 4px 7px; border-radius: 99px; color: #a9b5ad; background: #232a26; font-size: 9px; text-transform: capitalize; }
.agent-status.active, .agent-status.approved, .agent-status.paid { color: #91e4a8; background: #183421; }
.agent-status.suspended, .agent-status.rejected { color: #f4a1a1; background: #361f21; }
.agent-status.pending { color: #edcc81; background: #332b1b; }
.agent-limit-button { padding: 7px 9px; border: 1px solid #303b35; border-radius: 7px; color: #dce6df; background: #17201a; font-size: 9px; cursor: pointer; }
.agent-empty { padding: 26px !important; text-align: center; }
.agent-date-filters { display: flex; gap: 9px; }
.agent-date-filters label { display: flex; align-items: center; gap: 6px; color: #89968f; font-size: 9px; }
.agent-date-filters input { width: 130px; height: 32px; padding: 0 7px; border: 1px solid #303934; border-radius: 7px; color: #dce4de; background: #0e1411; color-scheme: dark; font: inherit; }
.agent-footnote, .agent-disclaimer { margin: 12px 0 0; color: #77847c; font-size: 9px; line-height: 1.6; }
.agent-apply { width: min(760px, calc(100% - 40px)); margin: 8vh auto; }
.agent-lead { margin: 0 0 26px; }
.agent-application-form { display: flex; flex-direction: column; gap: 14px; }
.agent-application-form > label, .agent-modal > label { display: flex; flex-direction: column; gap: 7px; color: #b7c1ba; font-size: 10px; font-weight: 700; }
.agent-application-form input, .agent-application-form textarea, .agent-modal input, .agent-modal textarea, .agent-modal select { width: 100%; min-height: 42px; padding: 10px 11px; border: 1px solid #303934; border-radius: 8px; outline: 0; color: #edf2ee; background: #0e1411; font: inherit; resize: vertical; }
.agent-application-form input:focus, .agent-application-form textarea:focus, .agent-modal input:focus, .agent-modal textarea:focus, .agent-modal select:focus { border-color: #49b86c; box-shadow: 0 0 0 3px rgb(73 184 108 / 10%); }
.agent-review-state { display: flex; align-items: center; gap: 13px; margin: 20px 0; padding: 16px; border: 1px solid #38402e; border-radius: 12px; background: #1b1c16; }
.agent-review-state.rejected { border-color: #573031; background: #241719; }
.agent-review-state > div > strong { color: #ecf1ed; font-size: 12px; }
.agent-review-state p { margin: 5px 0 0; color: #9aa59e; font-size: 10px; line-height: 1.5; }
.agent-state { min-height: 65vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 11px; padding: 24px; text-align: center; }
.agent-state h1 { margin: 0; color: #f0f4f1; font-size: 25px; }
.agent-state p { max-width: 450px; margin: 0 0 8px; color: #9ba69f; font-size: 12px; line-height: 1.6; }
.agent-state-icon { display: grid; width: 38px; height: 38px; flex: 0 0 auto; place-items: center; border: 1px solid #326b45; border-radius: 11px; color: #81e49b; background: #193322; font-size: 18px; }
.agent-state button:not(.agent-primary) { padding: 10px 14px; border: 1px solid #39433d; border-radius: 8px; color: #e9eee9; background: #17201a; }
.agent-error .agent-state-icon { color: #f09a9a; border-color: #6a3838; background: #301c1d; }
.agent-spinner { width: 24px; height: 24px; border: 2px solid #303b35; border-top-color: #5dde81; border-radius: 50%; animation: agent-spin .8s linear infinite; }
@keyframes agent-spin { to { transform: rotate(360deg); } }
.agent-modal-backdrop { position: fixed; z-index: 9; inset: 0; display: grid; place-items: center; overflow-y: auto; padding: 20px; background: rgb(0 0 0 / 72%); backdrop-filter: blur(5px); }
.agent-modal { position: relative; width: min(440px, 100%); display: flex; flex-direction: column; gap: 12px; padding: 25px; border: 1px solid #344038; border-radius: 16px; background: #151c19; box-shadow: 0 25px 90px rgb(0 0 0 / 50%); }
.agent-modal-close { position: absolute; top: 11px; right: 12px; width: 30px; height: 30px; border: 1px solid #303934; border-radius: 8px; color: #b4beb7; background: #101612; font-size: 20px; cursor: pointer; }
.agent-modal-note { margin: 0; color: #87948c; font-size: 9px; line-height: 1.5; }
.agent-form-error { margin: 0; color: #ff9a9a; font-size: 10px; }
.agent-toast { position: fixed; z-index: 11; right: 20px; bottom: 20px; padding: 12px 16px; border: 1px solid #34764a; border-radius: 10px; color: #c8f6d2; background: #172d1d; box-shadow: 0 14px 35px rgb(0 0 0 / 30%); font-size: 11px; }
@media (max-width: 900px) { .agent-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) {
  .agent-header { min-height: 62px; padding: 0 14px; }
  .agent-brand small, .agent-user { display: none; }
  .agent-back { padding: 8px; font-size: 10px; }
  .agent-content { width: calc(100% - 24px); gap: 12px; padding-top: 22px; }
  .agent-welcome { align-items: flex-start; flex-direction: column; }
  .agent-welcome h1 { font-size: 25px; }
  .agent-stats { gap: 8px; }
  .agent-stat-card { min-height: 112px; padding: 12px; }
  .agent-stat-card > span { font-size: 10px; }
  .agent-stat-card > strong { font-size: 19px; }
  .agent-stat-card small { font-size: 9px; }
  .agent-actions > button { flex: 1 1 100%; }
  .agent-card { padding: 13px; }
  .agent-card-heading { align-items: flex-start; flex-direction: column; }
  .agent-search { width: 100%; }
  .agent-date-filters { width: 100%; }
  .agent-date-filters label { flex: 1; }
  .agent-date-filters input { width: 100%; min-width: 0; }
  .agent-table { min-width: 730px; }
  .agent-ledger { min-width: 600px; }
  .agent-apply { width: calc(100% - 24px); margin: 28px auto; }
}
.agent-app { color: #2b4032; background: #f3f8f4; }
.agent-header { border-bottom-color: #e2ece4; background: rgb(255 255 255 / 94%); box-shadow: 0 3px 14px rgb(30 74 43 / 4%); }
.agent-brand { color: #1d3827; }
.agent-mark { width: 44px; height: 44px; border-color: #cfe5d4; border-radius: 12px; background: #168747; box-shadow: 0 4px 10px rgb(21 130 65 / 15%); }
.agent-mark img { width: 100%; height: 100%; object-fit: cover; }
.agent-brand strong { color: #234331; }
.agent-brand small, .agent-user { color: #79887d; }
.agent-back { border-color: #dce8df; color: #287044; background: #f5faf6; }
.agent-back:hover, .agent-limit-button:hover { border-color: #7fc593; background: #eef8f0; }
.agent-content { color: #2b4032; }
.agent-welcome h1, .agent-apply h1 { color: #1f3a29; }
.agent-welcome p, .agent-lead { color: #6f7e73; }
.agent-eyebrow { color: #178247; }
.agent-approved { border-color: #cde8d3; color: #187640; background: #edf8ef; }
.agent-approved i { background: #28a853; box-shadow: 0 0 10px rgb(40 168 83 / 40%); }
.agent-stat-card, .agent-card { border-color: #e0ebe2; background: linear-gradient(145deg, #fff, #f8fbf8); box-shadow: 0 8px 24px rgb(33 71 43 / 5%); }
.agent-stat-card > span { color: #66776b; }
.agent-stat-card > strong { color: #1e6038; }
.agent-stat-card small { color: #7c8b80; }
.agent-stat-card .agent-unavailable { color: #7d8a80; }
.agent-primary { border-color: #148546; color: #fff; background: linear-gradient(135deg, #25a957, #14763e); box-shadow: 0 7px 17px rgb(21 132 66 / 17%); }
.agent-primary:hover { background: linear-gradient(135deg, #1d9a4c, #106b37); }
.agent-secondary { border-color: #d7e8da; color: #237342; background: #f5faf6; }
.agent-secondary:hover { border-color: #87c99a; background: #edf8f0; }
.agent-card-heading h2, .agent-modal h2 { color: #234331; }
.agent-lock { color: #75847a; }
.agent-search { border-color: #dce8df; color: #748479; background: #fff; }
.agent-search input { color: #263d2e; }
.agent-search input::placeholder { color: #92a096; }
.agent-table th { border-bottom-color: #e2ebe4; color: #78877c; }
.agent-table td { border-bottom-color: #edf2ee; color: #43574a; }
.agent-table td:first-child strong { color: #254331; }
.agent-table td:first-child small { color: #829087; }
.agent-result.won { color: #177540; background: #e8f6eb; }
.agent-result.lost { color: #b24c4c; background: #fbeeee; }
.agent-muted, .agent-empty { color: #829087 !important; }
.agent-status { color: #59695e; background: #edf2ee; }
.agent-status.active, .agent-status.approved, .agent-status.paid { color: #187540; background: #e8f6eb; }
.agent-status.suspended, .agent-status.rejected { color: #a84545; background: #fbeeee; }
.agent-status.pending { color: #916514; background: #fff5dc; }
.agent-limit-button { border-color: #d7e8da; color: #237342; background: #f5faf6; }
.agent-date-filters label { color: #748479; }
.agent-date-filters input { border-color: #dce8df; color: #314a38; background: #fff; color-scheme: light; }
.agent-footnote, .agent-disclaimer { color: #7b897f; }
.agent-application-form > label, .agent-modal > label { color: #44594a; }
.agent-application-form input, .agent-application-form textarea, .agent-modal input, .agent-modal textarea, .agent-modal select { border-color: #d7e4da; color: #273e2e; background: #fff; }
.agent-application-form input::placeholder, .agent-application-form textarea::placeholder, .agent-modal input::placeholder, .agent-modal textarea::placeholder { color: #94a097; }
.agent-application-form input:focus, .agent-application-form textarea:focus, .agent-modal input:focus, .agent-modal textarea:focus, .agent-modal select:focus { border-color: #3ba35c; box-shadow: 0 0 0 3px rgb(59 163 92 / 13%); }
.agent-review-state { border-color: #d8e9dc; background: #f7fbf7; }
.agent-review-state.rejected { border-color: #f0d7d7; background: #fff7f7; }
.agent-review-state > div > strong { color: #2a4332; }
.agent-review-state p { color: #718076; }
.agent-state h1 { color: #1f3a29; }
.agent-state p { color: #6f7e73; }
.agent-state-icon { border-color: #cce5d2; color: #198047; background: #eaf6ed; }
.agent-state button:not(.agent-primary) { border-color: #d7e4da; color: #287044; background: #fff; }
.agent-error .agent-state-icon { color: #b44d4d; border-color: #efd1d1; background: #fff1f1; }
.agent-spinner { border-color: #d5e8d9; border-top-color: #168747; }
.agent-modal-backdrop { background: rgb(24 43 29 / 43%); }
.agent-modal { border-color: #e0ebe2; background: #fff; box-shadow: 0 25px 80px rgb(26 56 34 / 20%); }
.agent-modal-close { border-color: #dce8df; color: #526457; background: #f5faf6; }
.agent-modal-note { color: #78877c; }
.agent-form-error { color: #b34242; }
.agent-toast { border-color: #cbe4d0; color: #1d6738; background: #f0faf2; box-shadow: 0 12px 30px rgb(34 73 43 / 14%); }
@media (prefers-reduced-motion: reduce) {
  .agent-spinner { animation-duration: 2s; }
}
</style>
