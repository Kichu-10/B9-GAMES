<template>
  <aside class="sidebar">
    <div class="brand">
      <img :src="b9Logo" alt="" />
      <div><strong>B9 Game</strong><span>Admin Control</span></div>
    </div>
    <nav class="side-nav" aria-label="Admin navigation">
      <section class="nav-group">
        <h2 class="nav-group-title">Workspace</h2>
        <button :class="{ active: tab === 'overview' }" :aria-current="tab === 'overview' ? 'page' : undefined" aria-label="Overview" title="Overview" @click="$emit('select', 'overview')"><LayoutDashboard class="nav-icon" /><span class="nav-label">Overview</span></button>
      </section>
      <section class="nav-group">
        <h2 class="nav-group-title">Platform</h2>
        <button :class="{ active: tab === 'games' }" :aria-current="tab === 'games' ? 'page' : undefined" aria-label="Games" title="Games" @click="$emit('select', 'games')"><Gamepad2 class="nav-icon" /><span class="nav-label">Games</span></button>
        <button :class="{ active: tab === 'results' }" :aria-current="tab === 'results' ? 'page' : undefined" aria-label="Game Results" title="Game Results" @click="$emit('select', 'results')"><Trophy class="nav-icon" /><span class="nav-label">Game Results</span></button>
      </section>
      <section class="nav-group">
        <h2 class="nav-group-title">Accounts</h2>
        <button :class="{ active: tab === 'users' }" :aria-current="tab === 'users' ? 'page' : undefined" aria-label="Users" title="Users" @click="$emit('select', 'users')"><UsersRound class="nav-icon" /><span class="nav-label">Users</span><b>{{ stats.totalUsers }}</b></button>
        <button :class="{ active: tab === 'agents' }" :aria-current="tab === 'agents' ? 'page' : undefined" aria-label="Agents" title="Agents" @click="$emit('select', 'agents')"><Network class="nav-icon" /><span class="nav-label">Agents</span><b v-if="agentPendingCount">{{ agentPendingCount }}</b></button>
        <button :class="{ active: tab === 'kyc' }" :aria-current="tab === 'kyc' ? 'page' : undefined" aria-label="KYC Review" title="KYC Review" @click="$emit('select', 'kyc')"><ShieldCheck class="nav-icon" /><span class="nav-label">KYC Review</span><b v-if="stats.pendingKyc">{{ stats.pendingKyc }}</b></button>
      </section>
      <section class="nav-group">
        <h2 class="nav-group-title">Operations</h2>
        <button :class="{ active: tab === 'transactions' }" :aria-current="tab === 'transactions' ? 'page' : undefined" aria-label="Transactions" title="Transactions" @click="$emit('select', 'transactions')"><ArrowLeftRight class="nav-icon" /><span class="nav-label">Transactions</span><b v-if="stats.pendingRequests">{{ stats.pendingRequests }}</b></button>
        <button :class="{ active: tab === 'support' }" :aria-current="tab === 'support' ? 'page' : undefined" aria-label="Support" title="Support" @click="$emit('select', 'support')"><LifeBuoy class="nav-icon" /><span class="nav-label">Support</span><b v-if="openTicketCount">{{ openTicketCount }}</b></button>
      </section>
      <section class="nav-group">
        <h2 class="nav-group-title">Engagement</h2>
        <button :class="{ active: tab === 'promotions' }" :aria-current="tab === 'promotions' ? 'page' : undefined" aria-label="Promotions" title="Promotions" @click="$emit('select', 'promotions')"><Megaphone class="nav-icon" /><span class="nav-label">Promotions</span></button>
        <button :class="{ active: tab === 'referrals' }" :aria-current="tab === 'referrals' ? 'page' : undefined" aria-label="Referrals" title="Referrals" @click="$emit('select', 'referrals')"><Gift class="nav-icon" /><span class="nav-label">Referrals</span><b v-if="referralPendingCount">{{ referralPendingCount }}</b></button>
      </section>
      <section class="nav-group">
        <h2 class="nav-group-title">System</h2>
        <button :class="{ active: tab === 'activity' }" :aria-current="tab === 'activity' ? 'page' : undefined" aria-label="Activity" title="Activity" @click="$emit('select', 'activity')"><Clock3 class="nav-icon" /><span class="nav-label">Activity</span></button>
        <button :class="{ active: tab === 'settings' }" :aria-current="tab === 'settings' ? 'page' : undefined" aria-label="Settings" title="Settings" @click="$emit('select', 'settings')"><Settings2 class="nav-icon" /><span class="nav-label">Settings</span></button>
      </section>
    </nav>
    <div class="sidebar-user">
      <div class="avatar">AD</div>
      <div><strong>Administrator</strong><span><i></i> Online</span></div>
      <button title="Sign out" aria-label="Sign out" @click="$emit('logout')"><LogOut :size="17" /></button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import {
  ArrowLeftRight,
  Clock3,
  Gamepad2,
  Gift,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  Network,
  Settings2,
  ShieldCheck,
  UsersRound,
  Trophy,
} from "lucide-vue-next";
import b9Logo from "../assets/b9-logo.webp";

defineProps<{
  tab: string;
  stats: { totalUsers: number; pendingKyc: number; pendingRequests: number };
  openTicketCount: number;
  agentPendingCount: number;
  referralPendingCount: number;
}>();
defineEmits<{ select: [tab: string]; logout: [] }>();
</script>
