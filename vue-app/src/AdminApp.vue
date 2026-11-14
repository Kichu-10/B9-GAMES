<template>
  <main v-if="!signedIn" class="admin-login">
    <div class="login-brand-panel">
      <img :src="b9Logo" alt="B9 Game" />
      <div>
        <span>CONTROL CENTER</span>
        <strong>B9 Game</strong>
      </div>
    </div>
    <form class="login-card" @submit.prevent="login">
      <div class="login-heading">
        <img class="login-heading-logo" :src="b9Logo" alt="B9 logo" />
        <div><h1>Welcome back</h1><p>Sign in to your administrator workspace</p></div>
      </div>
      <label>Username<input v-model="username" autocomplete="username" name="admin-username" placeholder="Enter admin username" required /></label>
      <label>Password<input v-model="password" type="password" autocomplete="current-password" name="admin-password" placeholder="Enter password" required /></label>
      <button class="login-button" type="submit" :disabled="loading">{{ loading ? "Authenticating..." : "Sign in securely" }}</button>
      <small v-if="error" class="login-error" role="alert">{{ error }}</small>
    </form>
  </main>

  <main v-else class="admin-shell">
    <AdminSidebar
      :tab="tab"
      :stats="stats"
      :open-ticket-count="openTicketCount"
      :agent-pending-count="pendingAgentReviews"
      :referral-pending-count="referralReviews.length"
      @select="selectTab"
      @logout="logout"
    />

    <section class="workspace">
      <header class="workspace-header">
        <div>
          <span>ADMIN CONTROL CENTER</span>
          <h1>{{ pageTitle }}</h1>
        </div>
        <div class="header-actions">
          <span class="live-status" aria-label="Automatic refresh enabled"><i></i> Auto-refresh</span>
          <span class="refresh-time" :title="`Last successful update at ${lastRefreshTime}`">Updated {{ lastRefreshTime }}</span>
          <button class="icon-button" type="button" aria-label="Refresh data" title="Refresh data" :disabled="refreshing" @click="refresh">
            <RefreshCw :size="17" :class="{ 'refresh-spinning': refreshing }" />
          </button>
        </div>
      </header>
      <p v-if="refreshError" class="refresh-error" role="alert">
        Could not refresh dashboard data: {{ refreshError }}
        <button type="button" @click="refresh">Try again</button>
      </p>
      <div
        v-if="adminFeedback"
        class="admin-feedback"
        :class="{ 'admin-feedback-error': adminFeedback.type === 'error' }"
        :role="adminFeedback.type === 'error' ? 'alert' : 'status'"
        aria-live="polite"
      >
        <span>{{ adminFeedback.message }}</span>
        <button type="button" aria-label="Dismiss message" @click="adminFeedback = null">Dismiss</button>
      </div>

    <section v-if="tab === 'overview'" class="overview-page">
      <section class="overview-welcome">
        <div>
          <span class="overview-eyebrow">YOUR PLATFORM AT A GLANCE</span>
          <h2>Welcome to your control center</h2>
          <p>Monitor account activity and take care of the items that need your attention.</p>
        </div>
        <div class="overview-welcome-actions">
          <span class="overview-security"><ShieldCheck :size="15" /> Admin workspace</span>
          <button type="button" class="overview-refresh" :disabled="refreshing" @click="refresh">
            <RefreshCw :size="15" :class="{ 'refresh-spinning': refreshing }" />
            {{ refreshing ? "Refreshing…" : "Refresh data" }}
          </button>
        </div>
      </section>
      <div class="stats-grid">
        <article class="stat-card users-card"><div class="stat-icon"><UsersRound :size="20" /></div><div><span>Total users</span><strong>{{ stats.totalUsers }}</strong><small>{{ stats.activeUsers }} active accounts</small></div></article>
        <article class="stat-card balance-card"><div class="stat-icon"><Wallet :size="20" /></div><div><span>Total balance</span><strong>Rs. {{ money(stats.totalBalance) }}</strong><small>Across all accounts</small></div></article>
        <article class="stat-card request-card"><div class="stat-icon"><ArrowLeftRight :size="20" /></div><div><span>Pending requests</span><strong>{{ stats.pendingRequests }}</strong><small>Awaiting review</small></div></article>
        <article class="stat-card kyc-card"><div class="stat-icon"><ShieldCheck :size="20" /></div><div><span>Pending KYC</span><strong>{{ stats.pendingKyc }}</strong><small>Identity reviews</small></div></article>
      </div>

    <section v-if="tab === 'overview'" class="panel overview-panel">
      <div class="overview-panel-heading">
        <div><span class="overview-eyebrow">ACTION CENTER</span><h2>Needs your attention</h2></div>
        <span class="overview-queue-total" :class="{ 'queue-clear': pendingActionCount === 0 }" role="status" aria-live="polite">
          {{ pendingActionCount ? `${pendingActionCount} items need attention` : "All caught up" }}
        </span>
      </div>
      <div class="overview-grid">
        <button type="button" class="overview-action-card" @click="selectTab('transactions')">
          <span class="overview-action-icon deposit"><ArrowLeftRight :size="18" /></span>
          <span class="overview-action-copy"><strong>Payment requests</strong><small>Deposits &amp; withdrawals</small></span>
          <b>{{ stats.pendingRequests }}</b>
          <ChevronRight :size="16" />
        </button>
        <button type="button" class="overview-action-card" @click="selectTab('kyc')">
          <span class="overview-action-icon verification"><ShieldCheck :size="18" /></span>
          <span class="overview-action-copy"><strong>KYC checks</strong><small>Identity reviews</small></span>
          <b>{{ stats.pendingKyc }}</b>
          <ChevronRight :size="16" />
        </button>
        <button type="button" class="overview-action-card" @click="selectTab('agents')">
          <span class="overview-action-icon agents"><Network :size="18" /></span>
          <span class="overview-action-copy"><strong>Agent operations</strong><small>Applications, funds and limits</small></span>
          <b>{{ pendingAgentReviews }}</b>
          <ChevronRight :size="16" />
        </button>
        <button type="button" class="overview-action-card" @click="selectTab('referrals')">
          <span class="overview-action-icon referral"><Gift :size="18" /></span>
          <span class="overview-action-copy"><strong>Referral rewards</strong><small>Reward decisions</small></span>
          <b>{{ referralReviews.length }}</b>
          <ChevronRight :size="16" />
        </button>
        <button type="button" class="overview-action-card" @click="selectTab('support')">
          <span class="overview-action-icon support"><LifeBuoy :size="18" /></span>
          <span class="overview-action-copy"><strong>Support inbox</strong><small>Open customer requests</small></span>
          <b>{{ openTicketCount }}</b>
          <ChevronRight :size="16" />
        </button>
      </div>
      <div class="overview-secondary-row">
        <span><CircleCheck :size="15" /> Approved withdrawals</span>
        <strong>Rs. {{ money(stats.approvedWithdrawals) }}</strong>
        <div class="quick-actions">
          <button type="button" @click="selectTab('results')"><Plus :size="15" /> Record result</button>
        </div>
      </div>
    </section>
    </section>

    <section v-if="tab === 'games'" class="panel game-management-panel">
      <div class="panel-heading">
        <div><h2>Game and Provider Management</h2><p>Only enabled games from enabled providers are published in the Games lobby.</p></div>
        <span class="provider-api-status" :class="{ configured: providerApiConfigured }">{{ providerApiConfigured ? "Provider API configured" : "Provider API not configured" }}</span>
      </div>
      <div class="stats-grid game-stats-grid">
        <article class="stat-card"><div><span>Total providers</span><strong>{{ gameStats.totalProviders }}</strong></div></article>
        <article class="stat-card"><div><span>Total available games</span><strong>{{ gameStats.availableGames }}</strong></div></article>
        <article class="stat-card"><div><span>Active games</span><strong>{{ gameStats.activeGames }}</strong></div></article>
        <article class="stat-card"><div><span>Disabled games</span><strong>{{ gameStats.disabledGames }}</strong></div></article>
      </div>

      <section class="game-management-block">
        <div class="panel-heading">
          <div><h3>Providers</h3><p>Upload a logo for each provider; it will appear in the customer Games filters. Provider API credentials are read from server environment variables and are never returned to the browser.</p></div>
          <button type="button" class="secondary" :disabled="providerCatalogLoading" @click="loadProviderSources">{{ providerCatalogLoading ? "Loading…" : "Add Provider" }}</button>
        </div>
        <div v-if="providerSources.length" class="toolbar game-provider-add">
          <select v-model="newProviderCode" aria-label="Available provider">
            <option value="">Select an available provider</option>
            <option v-for="source in availableProviderSources" :key="source.code" :value="source.code">{{ source.name }} ({{ source.code }})</option>
          </select>
          <input v-model="newProviderName" maxlength="120" placeholder="Display name (optional)" aria-label="Provider display name" />
          <button type="button" :disabled="!newProviderCode" @click="addGameProvider">Add provider</button>
        </div>
        <div v-for="provider in managedProviders" :key="provider.code" class="game-provider-row">
          <div><strong>{{ provider.code }}</strong><small>{{ provider.gameCount }} managed games</small></div>
          <div class="provider-logo-control">
            <img v-if="provider.logo" :src="provider.logo" :alt="`${provider.name} logo`" />
            <span v-else>{{ provider.code.slice(0, 2).toUpperCase() }}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              :aria-label="`Upload ${provider.name} logo`"
              :disabled="providerLogoUploading[provider.code]"
              @change="uploadProviderLogo(provider, $event)"
            />
          </div>
          <input v-model="provider.name" maxlength="120" :aria-label="`${provider.code} display name`" />
          <div class="provider-publish-control">
            <label class="game-enabled-control"><input v-model="provider.enabled" type="checkbox" :aria-label="`Enable ${provider.name} games in the public catalog`" /> {{ provider.enabled ? "Enabled" : "Disabled" }}</label>
            <small class="provider-publish-state" :class="{ disabled: !provider.enabled }">{{ provider.enabled ? "Provider games may be listed" : "Games are hidden from public catalog" }}</small>
          </div>
          <button type="button" class="secondary" @click="saveGameProvider(provider)">Save</button>
        </div>
        <p v-if="managedProviders.length === 0" class="empty">No providers added. Load the available HUIDU providers to add one.</p>
      </section>

      <section class="game-management-block">
        <div class="panel-heading">
          <div><h3>Add Game</h3><p>Games are imported from their provider and start disabled until explicitly published.</p></div>
          <button type="button" class="secondary" :disabled="!managedProviders.length || providerGamesLoading" @click="loadProviderGames">{{ providerGamesLoading ? "Loading…" : "Load provider games" }}</button>
        </div>
        <div class="toolbar game-provider-add">
          <select v-model="importProviderCode" aria-label="Provider for imported games" @change="providerCatalogGames = []; selectedProviderGameIds = []; importGameId = ''">
            <option value="">Choose provider</option>
            <option v-for="provider in managedProviders" :key="provider.code" :value="provider.code">{{ provider.name }}</option>
          </select>
          <select v-model="importGameId" aria-label="Game to add">
            <option value="">Choose provider game</option>
            <option v-for="game in providerCatalogGames" :key="game.id" :value="game.id">{{ game.name }} ({{ game.id }})</option>
          </select>
          <select v-model="importCategory" aria-label="Category for imported game">
            <option v-for="category in gameCategories" :key="category" :value="category">{{ category }}</option>
          </select>
          <label class="game-popular-control"><input v-model="importIsPopular" type="checkbox" /> Popular</label>
          <input v-model="importThumbnail" maxlength="500" placeholder="Game logo/art HTTPS URL (optional)" aria-label="Game logo or artwork URL" />
          <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload game logo or artwork" @change="setImportThumbnailFile" />
          <input v-model.number="importSortOrder" type="number" placeholder="Display order" aria-label="Display order" />
          <button type="button" :disabled="!importProviderCode || !importGameId" @click="importGame">Add Game</button>
        </div>
        <div v-if="providerCatalogGames.length" class="provider-game-selection">
          <label class="game-enabled-control">
            <input
              type="checkbox"
              :checked="allAvailableProviderGamesSelected"
              :disabled="!availableProviderCatalogGames.length || providerGamesImporting"
              @change="toggleAllProviderGames"
            />
            Select all available games ({{ availableProviderCatalogGames.length }})
          </label>
          <span>{{ selectedProviderGameIds.length }} selected</span>
          <button type="button" :disabled="!selectedProviderGameIds.length || providerGamesImporting" @click="importSelectedProviderGames">
            {{ providerGamesImporting ? "Adding…" : `Add selected (${selectedProviderGameIds.length})` }}
          </button>
          <div class="provider-game-list">
            <label v-for="game in providerCatalogGames" :key="game.id" class="provider-game-option">
              <input
                type="checkbox"
                :checked="selectedProviderGameIds.includes(game.id)"
                :disabled="game.status !== 0 || !/^[a-zA-Z0-9_-]{1,120}$/.test(game.id) || managedGameIds.has(game.id) || providerGamesImporting"
                @change="toggleProviderGame(game.id, $event)"
              />
              <span>{{ game.name }} ({{ game.id }})</span>
              <small v-if="game.status !== 0">Unavailable</small>
              <small v-else-if="managedGameIds.has(game.id)">Already added</small>
            </label>
          </div>
        </div>
      </section>

      <section class="game-management-block">
        <div class="panel-heading">
          <div><h3>Public Catalog</h3><p>Choose the exact number of games returned per page; users can scroll through further pages.</p></div>
          <form class="catalog-page-size" @submit.prevent="saveCatalogPageSize">
            <label>Games per page<input v-model.number="catalogPageSize" type="number" min="1" max="100" /></label>
            <button type="submit" class="secondary">Save</button>
          </form>
        </div>
        <div class="toolbar game-management-filters">
          <input v-model="managedGameSearch" type="search" placeholder="Search managed games" aria-label="Search games" />
          <select v-model="managedProviderFilter" aria-label="Filter by provider">
            <option value="">All providers</option>
            <option v-for="provider in managedProviders" :key="provider.code" :value="provider.code">{{ provider.name }}</option>
          </select>
          <select v-model="managedCategoryFilter" aria-label="Filter by category">
            <option value="">All categories</option>
            <option v-for="category in gameCategories" :key="category" :value="category">{{ category }}</option>
          </select>
        </div>
        <div class="game-bulk-toolbar">
          <label class="game-enabled-control">
            <input
              type="checkbox"
              :checked="allFilteredManagedGamesSelected"
              :disabled="!filteredManagedGames.length || bulkGamesUpdating"
              @change="toggleAllManagedGames"
            />
            Select all matching games ({{ filteredManagedGames.length }})
          </label>
          <span>{{ selectedManagedGameIds.length }} selected</span>
          <button type="button" class="secondary" :disabled="!selectedManagedGameIds.length || bulkGamesUpdating" @click="updateSelectedManagedGames(true)">
            Enable selected
          </button>
          <button type="button" class="secondary" :disabled="!selectedManagedGameIds.length || bulkGamesUpdating" @click="updateSelectedManagedGames(false)">
            Disable selected
          </button>
        </div>
        <p v-if="gameManagementMessage" class="form-message" role="status">{{ gameManagementMessage }}</p>
        <div class="game-management-table-wrap">
          <table class="game-management-table">
            <thead><tr><th>Select</th><th>Game</th><th>Provider</th><th>Category</th><th>Popular</th><th>Display order</th><th>Listing</th><th>Actions</th></tr></thead>
            <tbody>
              <tr v-for="game in filteredManagedGames" :key="game.id">
                <td><input type="checkbox" :checked="selectedManagedGameIds.includes(game.id)" :aria-label="`Select ${game.name}`" @change="toggleManagedGame(game.id, $event)" /></td>
                <td>
                  <img v-if="game.thumbnail" class="managed-game-thumbnail" :src="game.thumbnail" :alt="`${game.name} logo or artwork`" />
                  <span v-else class="managed-game-no-thumbnail">No game logo uploaded</span>
                  <input v-model="game.name" maxlength="160" :aria-label="`${game.name} name`" />
                  <input v-model="game.thumbnail" maxlength="500" placeholder="Game logo/art URL" :aria-label="`${game.name} logo or artwork URL`" />
                  <input type="file" accept="image/jpeg,image/png,image/webp" :aria-label="`Upload ${game.name} logo or artwork`" @change="uploadManagedThumbnail(game, $event)" />
                </td>
                <td>
                  <select v-model="game.providerCode" :aria-label="`${game.name} provider`">
                    <option v-for="provider in managedProviders" :key="provider.code" :value="provider.code">{{ provider.name }}</option>
                  </select>
                </td>
                <td>
                  <select v-model="game.category" :aria-label="`${game.name} category`">
                    <option v-for="category in gameCategories" :key="category" :value="category">{{ category }}</option>
                  </select>
                </td>
                <td><label class="game-enabled-control"><input v-model="game.isPopular" type="checkbox" :aria-label="`Mark ${game.name} as popular`" /> Popular</label></td>
                <td><input v-model.number="game.sortOrder" type="number" aria-label="Game display order" /></td>
                <td><label class="game-enabled-control"><input v-model="game.enabled" type="checkbox" :disabled="game.providerStatus !== 0" /> {{ game.enabled ? "Enabled" : "Disabled" }}</label></td>
                <td class="game-actions"><button type="button" class="secondary" @click="saveManagedGame(game)">Save</button><button type="button" class="reject" @click="removeManagedGame(game)">Remove</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="filteredManagedGames.length === 0" class="empty">No managed games match these filters.</p>
      </section>
    </section>

    <section v-if="tab === 'users'" class="panel">
      <div class="panel-heading">
        <div><h2>User management</h2><p>Search, filter, activate, suspend, or adjust an account balance.</p></div>
        <span class="user-result-count">{{ filteredUsers.length }} of {{ users.length }} accounts</span>
      </div>
      <div class="toolbar users-toolbar">
        <input v-model="userSearch" type="search" placeholder="Search username or email" aria-label="Search users" />
        <select v-model="countryFilter" aria-label="Filter country">
          <option value="">All countries</option>
          <option value="IN">India</option>
          <option value="PK">Pakistan</option>
        </select>
        <select v-model="userRoleFilter" aria-label="Filter account type">
          <option value="">All account types</option>
          <option value="user">Players</option>
          <option value="agent">Agents</option>
        </select>
        <select v-model="userStatusFilter" aria-label="Filter account status">
          <option value="">All account statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <select v-model="userKycFilter" aria-label="Filter identity verification status">
          <option value="">All verification statuses</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
          <option value="not_submitted">Not submitted</option>
        </select>
      </div>
      <article v-for="account in filteredUsers" :key="account.id" class="row">
        <div>
          <strong>{{ account.username }}</strong>
          <span>{{ account.email }} · {{ account.role === "agent" ? "Agent" : "Player" }} · {{ account.country === "PK" ? "Pakistan" : account.country === "IN" ? "India" : "Country not set" }}</span>
        </div>
        <div class="meta">Rs. {{ money(account.balance) }} · {{ account.status }}</div>
        <button class="secondary" @click="adjustBalance(account)">Adjust Balance</button>
        <button @click="toggleUser(account)">{{ account.status === "active" ? "Suspend" : "Activate" }}</button>
      </article>
      <p v-if="filteredUsers.length === 0" class="empty">No accounts match the selected filters.</p>
    </section>

    <section v-if="tab === 'agents'" class="panel agent-admin-panel">
      <div class="panel-heading"><div><h2>Agent operations</h2><p>Approve applications and review every balance, commission, and player-limit change.</p></div><button class="secondary" @click="loadAgentData">Refresh agents</button></div>
      <section class="agent-admin-block">
        <h3>Pending applications <span>{{ agentData.applications.length }}</span></h3>
        <article v-for="application in agentData.applications" :key="application.id" class="row agent-admin-row">
          <div><strong>{{ application.username }} · {{ application.businessName }}</strong><span>{{ application.email }} · {{ application.country }} · {{ formatAgentDate(application.createdAt) }}</span><span>{{ application.experience || "No experience details provided." }}</span></div>
          <div class="actions"><button type="button" @click="reviewAgentApplication(application, 'approved')">Approve</button><button type="button" class="reject" @click="reviewAgentApplication(application, 'rejected')">Reject</button></div>
        </article>
        <p v-if="agentData.applications.length === 0" class="empty">No agent applications are waiting for review.</p>
      </section>
      <section class="agent-admin-block">
        <h3>Fund requests <span>{{ agentData.requests.length }}</span></h3>
        <article v-for="request in agentData.requests" :key="request.id" class="row agent-admin-row">
          <div><strong>{{ agentRequestLabel(request.type) }} · {{ request.agentUsername }}<template v-if="request.playerUsername"> → {{ request.playerUsername }}</template></strong><span>{{ request.paymentMethod || "No payment method" }} · {{ request.paymentReference || request.note || "No reference" }} · {{ formatAgentDate(request.createdAt) }}</span></div>
          <div class="meta">Rs. {{ money(request.amount) }}</div>
          <div class="actions"><button type="button" @click="reviewAgentRequest(request, 'approved')">Approve</button><button type="button" class="reject" @click="reviewAgentRequest(request, 'rejected')">Reject</button></div>
        </article>
        <p v-if="agentData.requests.length === 0" class="empty">No fund requests are waiting for review.</p>
      </section>
      <section class="agent-admin-block">
        <h3>Manual commission <span>{{ agentData.commissions.length }}</span></h3>
        <article v-for="agent in agentData.agents" :key="`commission-${agent.id}`" class="row agent-admin-row">
          <div><strong>{{ agent.username }}</strong><span>{{ agent.country }} · Agent balance Rs. {{ money(agent.balance) }}</span></div>
          <button type="button" @click="addAgentCommission(agent)">Add commission</button>
        </article>
        <article v-for="commission in agentData.commissions" :key="commission.id" class="row agent-admin-row">
          <div><strong>{{ commission.agentUsername }} · {{ commission.periodLabel }}</strong><span>Rs. {{ money(commission.amount) }} · {{ formatAgentDate(commission.createdAt) }}</span></div>
          <div class="actions"><button type="button" @click="reviewAgentCommission(commission, 'paid')">Pay commission</button><button type="button" class="reject" @click="reviewAgentCommission(commission, 'rejected')">Reject</button></div>
        </article>
        <p v-if="agentData.agents.length === 0" class="empty">No approved agents yet.</p>
      </section>
      <section class="agent-admin-block">
        <h3>Player limit requests <span>{{ agentData.limits.length }}</span></h3>
        <article v-for="request in agentData.limits" :key="request.id" class="row agent-admin-row">
          <div><strong>{{ request.playerUsername }} · requested by {{ request.agentUsername }}</strong><span>Requested limit Rs. {{ money(request.limit) }} · {{ request.reason || "No reason supplied" }} · {{ formatAgentDate(request.createdAt) }}</span></div>
          <div class="actions"><button type="button" @click="reviewAgentLimit(request, 'approved')">Approve</button><button type="button" class="reject" @click="reviewAgentLimit(request, 'rejected')">Reject</button></div>
        </article>
        <p v-if="agentData.limits.length === 0" class="empty">No player limit changes are waiting for review.</p>
        <p class="agent-admin-note">Approving a limit records the account setting in B9; the current external game-provider integration does not automatically enforce it.</p>
      </section>
    </section>

    <section v-if="tab === 'referrals'" class="panel agent-admin-panel">
      <div class="panel-heading">
        <div><h2>Referral reward review</h2><p>Set the reward amount when approving a referral. Rewards are credited only after approval.</p></div>
        <button class="secondary" @click="loadReferralData">Refresh referrals</button>
      </div>
      <section class="agent-admin-block">
        <h3>Pending referrals <span>{{ referralReviews.length }}</span></h3>
        <article v-for="referral in referralReviews" :key="referral.id" class="row agent-admin-row">
          <div>
            <strong>{{ referral.referredUsername }} joined through {{ referral.referrerUsername }}</strong>
            <span>{{ referral.referrerCountry }} · {{ formatAgentDate(referral.createdAt) }}</span>
          </div>
          <div class="actions">
            <button type="button" @click="reviewReferral(referral, 'approved')">Approve &amp; credit</button>
            <button type="button" class="reject" @click="reviewReferral(referral, 'rejected')">Reject</button>
          </div>
        </article>
        <p v-if="referralReviews.length === 0" class="empty">No referral rewards are waiting for review.</p>
      </section>
    </section>

    <section v-if="tab === 'kyc'" class="panel">
      <h2>KYC Verification</h2>
      <article v-for="account in kycUsers" :key="account.id" class="kyc-row">
        <div>
          <strong>{{ account.fullName || account.username }}</strong>
          <span>{{ account.country === "PK" ? "Pakistan" : account.country === "IN" ? "India" : "Unknown country" }} · {{ account.documentType }} · {{ account.documentNumber }}</span>
          <span>Status: {{ account.kycStatus }}</span>
        </div>
        <div class="documents" v-if="account.kycDocuments">
          <button v-if="account.kycDocuments.front" @click="openDocument(account.kycDocuments.front)">Front</button>
          <button v-if="account.kycDocuments.back" @click="openDocument(account.kycDocuments.back)">Back</button>
          <button v-if="account.kycDocuments.selfie" @click="openDocument(account.kycDocuments.selfie)">Selfie</button>
        </div>
        <div v-if="account.kycStatus === 'pending'" class="actions">
          <button @click="reviewKyc(account.id, 'verified')">Verify</button>
          <button class="reject" @click="rejectKyc(account)">Reject</button>
        </div>
      </article>
      <p v-if="kycUsers.length === 0" class="empty">No KYC submissions</p>
    </section>

    <section v-if="tab === 'transactions'" class="panel">
      <div class="panel-heading"><div><h2>Transactions</h2><p>Deposits and withdrawal requests</p></div><button class="export-button" @click="exportTransactions">Export CSV</button></div>
      <p class="empty" role="note">Manual settlement: verify deposit funds have arrived before approving. Send a withdrawal to the verified destination before approving it; approval updates the internal wallet only.</p>
      <div class="toolbar transaction-toolbar">
        <input v-model="transactionSearch" type="search" placeholder="Search user or reference" aria-label="Search transactions" />
        <select v-model="transactionStatusFilter">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select v-model="transactionTypeFilter">
          <option value="">All types</option>
          <option value="deposit">Deposit</option>
          <option value="withdrawal">Withdrawal</option>
        </select>
      </div>
      <article v-for="item in filteredTransactions" :key="item.id" class="row">
        <div><strong>{{ item.username }}</strong><span>{{ item.type }} · Rs. {{ money(item.amount) }}</span></div>
        <div class="manual-details">
          <span v-if="item.paymentMethod">Method: {{ item.paymentMethod }}</span>
          <span v-if="item.paymentReference">Reference: {{ item.paymentReference }}</span>
          <span v-if="item.paymentNote">Note: {{ item.paymentNote }}</span>
          <button v-if="item.proofFile" class="proof-button" @click="openProof(item.proofFile)">View payment proof</button>
        </div>
        <div :class="item.status">{{ item.status }}</div>
        <div v-if="item.status === 'pending'" class="actions">
          <button @click="processTransaction(item, 'approved')">Approve</button>
          <button class="reject" @click="processTransaction(item, 'rejected')">Reject</button>
        </div>
      </article>
      <p v-if="filteredTransactions.length === 0" class="empty">No matching transactions</p>
    </section>

    <section v-if="tab === 'results'" class="panel">
      <h2>Record Game Result</h2>
      <form class="result-form" @submit.prevent="recordGameResult">
        <select v-model="resultUserId" required>
          <option value="" disabled>Select user</option>
          <option v-for="account in users" :key="account.id" :value="account.id">{{ account.username }} · Rs. {{ money(account.balance) }}</option>
        </select>
        <select v-model="resultCategory" required>
          <option value="bet">Bet</option>
          <option value="lottery">Lottery</option>
          <option value="game">Game</option>
        </select>
        <input v-model="resultGameName" placeholder="Game or event name" required />
        <select v-model="resultOutcome" required>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
        <input v-model.number="resultAmount" type="number" min="0" step="0.01" placeholder="Winnings amount" required />
        <input v-model="resultReference" placeholder="Provider reference (optional)" />
        <button type="submit" :disabled="resultLoading">{{ resultLoading ? "Recording..." : "Record Result" }}</button>
      </form>
      <small class="form-message">{{ resultMessage }}</small>
    </section>

    <section v-if="tab === 'activity'" class="panel">
      <h2>Administrator Activity</h2>
      <article v-for="log in activityLogs" :key="log.id" class="activity-row">
        <div><strong>{{ log.action.replaceAll("_", " ") }}</strong><span>{{ log.target }} · {{ log.details }}</span></div>
        <time>{{ formatDate(log.createdAt) }}</time>
      </article>
      <p v-if="activityLogs.length === 0" class="empty">No administrator activity yet</p>
    </section>

    <section v-if="tab === 'support'" class="panel">
      <div class="panel-heading"><div><h2>Support Inbox</h2><p>Customer account requests and assistance</p></div></div>
      <article v-for="ticket in supportTickets" :key="ticket.id" class="ticket-row">
        <div class="ticket-copy">
          <strong>{{ ticket.subject }}</strong>
          <span>{{ ticket.username }} · {{ formatDate(ticket.createdAt) }}</span>
          <p>{{ ticket.message }}</p>
        </div>
        <select :value="ticket.status" :disabled="supportUpdating[ticket.id]" @change="updateSupportTicket(ticket, ($event.target as HTMLSelectElement).value)">
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
        </select>
        <button @click="replyToSupportTicket(ticket)">Reply</button>
      </article>
      <p v-if="supportTickets.length === 0" class="empty">No support requests</p>
    </section>

    <section v-if="tab === 'promotions'" class="panel settings-panel">
      <div class="panel-heading"><div><h2>Member Promotions</h2><p>Create and control the offers displayed to signed-in members.</p></div></div>
      <form class="settings-form" @submit.prevent="savePlatformSettings">
        <section class="promotion-admin-section">
          <div class="promotion-admin-heading">
            <div><h3>Offers</h3><p>Only active offers are visible to signed-in users. Include eligibility, restrictions, and expiry in the terms.</p></div>
            <button type="button" class="secondary" :disabled="platformSettings.promotions.length >= 20" @click="addPromotion">Add offer</button>
          </div>
          <article v-for="(promotion, index) in platformSettings.promotions" :key="promotion.id" class="promotion-admin-card">
            <div class="promotion-admin-card-heading">
              <strong>Offer {{ index + 1 }}</strong>
              <button type="button" class="reject" @click="removePromotion(index)">Remove</button>
            </div>
            <label>Title<input v-model="promotion.title" maxlength="100" required placeholder="Offer title" /></label>
            <label>Description<textarea v-model="promotion.description" maxlength="500" rows="2" placeholder="Describe the offer"></textarea></label>
            <label>Reward description<input v-model="promotion.reward" maxlength="160" placeholder="Describe reward (avoid guarantees)" /></label>
            <label>Eligibility and terms<textarea v-model="promotion.terms" maxlength="1000" rows="3" placeholder="Eligibility, restrictions, expiry, and how to ask about the offer"></textarea></label>
            <label class="promotion-banner-upload">Banner artwork (JPEG, PNG, or WebP; up to 5 MB)
              <input type="file" accept="image/jpeg,image/png,image/webp" :disabled="bannerUploading[promotion.id]" @change="uploadPromotionBanner(promotion, $event)" />
              <small v-if="bannerUploading[promotion.id]">Uploading banner...</small>
              <img v-if="bannerPreview(promotion)" :src="bannerPreview(promotion)" :alt="`${promotion.title || 'Promotion'} banner preview`" />
            </label>
            <button
              v-if="promotion.bannerImage || bannerPreviewUrls[promotion.id]"
              type="button"
              class="promotion-banner-remove"
              :disabled="bannerUploading[promotion.id]"
              @click="removePromotionBanner(promotion)"
            >Remove banner</button>
            <label class="switch-row"><span><strong>Image contains complete offer design</strong><small>Use for a finished banner with text and button already included</small></span><input v-model="promotion.bannerIncludesText" type="checkbox" /></label>
            <label class="switch-row"><span><strong>Offer active</strong><small>Show this offer to signed-in users</small></span><input v-model="promotion.active" type="checkbox" /></label>
          </article>
          <p v-if="platformSettings.promotions.length === 0" class="empty">No offers configured. Add an offer to show it to members.</p>
        </section>
        <button class="primary-button" type="submit" :disabled="platformSettingsSaving">{{ platformSettingsSaving ? "Saving promotions…" : "Save promotions" }}</button>
      </form>
      <small class="form-message" role="status">{{ settingsMessage }}</small>
      <section class="promotion-admin-section rewards-admin-section">
        <div class="promotion-admin-heading">
          <div><h3>Rewards controls</h3><p>Set daily claim amounts, streak policy, VIP eligibility, and cashback policy.</p></div>
        </div>
        <form class="settings-form" @submit.prevent="saveRewardSettings">
          <label class="switch-row"><span><strong>Daily check-in enabled</strong><small>Allow users to claim the configured daily streak rewards</small></span><input v-model="rewardSettings.dailyEnabled" type="checkbox" /></label>
          <div class="reward-daily-amounts">
            <label v-for="(_, index) in rewardSettings.dailyRewards" :key="index">Day {{ index + 1 }} amount<input v-model.number="rewardSettings.dailyRewards[index]" type="number" min="0" max="100000000" step="0.01" required /></label>
          </div>
          <label>Daily reset time zone<input v-model.trim="rewardSettings.dailyResetTimezone" list="reward-timezones" required placeholder="UTC" /><datalist id="reward-timezones"><option value="UTC"></option><option value="Asia/Kathmandu"></option><option value="Asia/Kolkata"></option><option value="Asia/Karachi"></option></datalist></label>
          <label class="switch-row"><span><strong>Reset streak after a missed day</strong><small>When disabled, a missed day pauses rather than resets the streak</small></span><input v-model="rewardSettings.streakResetOnMissedDay" type="checkbox" /></label>
          <label class="switch-row"><span><strong>VIP levels enabled</strong><small>Display deposit-based VIP tier status and progress to members</small></span><input v-model="rewardSettings.vipEnabled" type="checkbox" /></label>
          <label>VIP deposit window (days)<input v-model.number="rewardSettings.vipWindowDays" type="number" min="1" max="365" step="1" required /></label>
          <label>Silver threshold<input v-model.number="rewardSettings.vipTiers.silver" type="number" min="0" max="100000000" step="0.01" required /></label>
          <label>Gold threshold<input v-model.number="rewardSettings.vipTiers.gold" type="number" min="0" max="100000000" step="0.01" required /></label>
          <label>Platinum threshold<input v-model.number="rewardSettings.vipTiers.platinum" type="number" min="0" max="100000000" step="0.01" required /></label>
          <label class="switch-row"><span><strong>Cashback configured active</strong><small>Admin control only; payouts remain paused until verified game settlement data is connected</small></span><input v-model="rewardSettings.cashbackEnabled" type="checkbox" /></label>
          <label>Cashback rate (%)<input v-model.number="rewardSettings.cashbackRate" type="number" min="0" max="100" step="0.01" required /></label>
          <label>Cashback weekly cap<input v-model.number="rewardSettings.cashbackWeeklyCap" type="number" min="0" max="100000000" step="0.01" required /></label>
          <button class="primary-button" type="submit" :disabled="rewardSettingsSaving">{{ rewardSettingsSaving ? "Saving rewards…" : "Save reward controls" }}</button>
        </form>
        <small class="form-message" role="status">{{ rewardSettingsMessage }}</small>
      </section>
      <section class="promotion-admin-section bonus-code-admin-section">
        <div class="promotion-admin-heading">
          <div><h3>Redeemable bonus codes</h3><p>Create fixed-value codes that members can redeem once into their Main Wallet.</p></div>
        </div>
        <form class="settings-form" @submit.prevent="createBonusCode">
          <label>Code<input v-model.trim="bonusCodeForm.code" required minlength="3" maxlength="32" pattern="[A-Za-z0-9_-]+" placeholder="B9WELCOME" /></label>
          <label>Wallet credit<input v-model.number="bonusCodeForm.amount" type="number" min="0.01" max="100000000" step="0.01" required /></label>
          <label>Expiry<input v-model="bonusCodeForm.expiresAt" type="datetime-local" required /></label>
          <label>Maximum redemptions (optional)<input v-model.number="bonusCodeForm.maxRedemptions" type="number" min="1" max="1000000" placeholder="Unlimited" /></label>
          <label>Terms<textarea v-model.trim="bonusCodeForm.terms" maxlength="1000" rows="2" required placeholder="Eligibility and any restrictions"></textarea></label>
          <button class="primary-button" type="submit" :disabled="bonusCodeSaving">{{ bonusCodeSaving ? "Creating code…" : "Create bonus code" }}</button>
        </form>
        <small class="form-message" role="status">{{ bonusCodeMessage }}</small>
        <article v-for="code in bonusCodes" :key="code.id" class="row bonus-code-row">
          <div><strong>{{ code.code }}</strong><span>Rs. {{ money(code.amount) }} · {{ code.redemptionCount }}{{ code.maxRedemptions ? ` / ${code.maxRedemptions}` : "" }} redemptions</span><small v-if="code.terms">{{ code.terms }}</small><small v-if="code.expiresAt">Expires {{ formatDate(code.expiresAt) }}</small></div>
          <span :class="code.active ? 'approved' : 'rejected'">{{ code.active ? "Active" : "Disabled" }}</span>
          <button type="button" class="secondary" :disabled="bonusCodeActionId === code.id" @click="toggleBonusCode(code)">{{ bonusCodeActionId === code.id ? "Saving…" : code.active ? "Disable" : "Activate" }}</button>
        </article>
        <p v-if="bonusCodes.length === 0" class="empty">No redeemable bonus codes have been created.</p>
      </section>
    </section>

    <section v-if="tab === 'settings'" class="panel settings-panel">
      <div class="panel-heading"><div><h2>Platform Settings</h2><p>Control customer-facing notices, support, payment instructions, and homepage display.</p></div></div>
      <form class="settings-form" @submit.prevent="savePlatformSettings">
        <label>Public announcement<textarea v-model="platformSettings.announcement" rows="3" placeholder="Announcement shown on the homepage"></textarea></label>
        <label>Support email<input v-model="platformSettings.supportEmail" type="email" placeholder="support@example.com" /></label>
        <label>Support phone<input v-model="platformSettings.supportPhone" placeholder="+91..." /></label>
        <label>Support hours<input v-model="platformSettings.supportHours" placeholder="24/7" /></label>
        <label class="switch-row"><span><strong>Maintenance mode</strong><small>Display maintenance notice without disabling the API</small></span><input v-model="platformSettings.maintenanceMode" type="checkbox" /></label>
        <section class="settings-control-group">
          <div class="promotion-admin-heading">
            <div><h3>Manual payment instructions</h3><p>These details appear in the member wallet. Confirm every destination before saving. Blank fields use the matching server environment value.</p></div>
          </div>
          <div class="settings-control-grid">
            <label>Bank name<input v-model.trim="platformSettings.bankName" maxlength="120" placeholder="Bank name" /></label>
            <label>Account holder name<input v-model.trim="platformSettings.accountName" maxlength="120" placeholder="Account name" /></label>
            <label>Account number<input v-model.trim="platformSettings.accountNumber" maxlength="80" autocomplete="off" placeholder="Account number" /></label>
            <label>IBAN<input v-model.trim="platformSettings.iban" maxlength="80" autocomplete="off" placeholder="IBAN" /></label>
            <label>UPI ID<input v-model.trim="platformSettings.upiId" maxlength="120" placeholder="name@bank" /></label>
            <label>Mobile wallet name<input v-model.trim="platformSettings.walletName" maxlength="80" placeholder="Wallet provider" /></label>
            <label>Mobile wallet number<input v-model.trim="platformSettings.walletNumber" maxlength="80" autocomplete="off" placeholder="Wallet number" /></label>
            <label class="settings-control-wide">Payment instructions<textarea v-model.trim="platformSettings.paymentInstructions" maxlength="1000" rows="3" placeholder="Explain how members should submit a payment request"></textarea></label>
          </div>
        </section>
        <section class="settings-control-group">
          <div class="promotion-admin-heading">
            <div><h3>Homepage display</h3><p>Manage the public homepage hero. The jackpot is a manually configured display amount, not a live pool; signed-in members continue to see active member offers.</p></div>
          </div>
          <div class="settings-control-grid">
            <label>Jackpot display amount (Rs.)<input v-model.number="platformSettings.jackpotAmount" type="number" min="0" max="1000000000000" step="0.01" required /></label>
            <label class="switch-row"><span><strong>Enable custom homepage banner</strong><small>Show when no signed-in member offer banner is active</small></span><input v-model="platformSettings.homepageBanner.active" type="checkbox" /></label>
            <label>Banner headline<input v-model.trim="platformSettings.homepageBanner.title" maxlength="100" placeholder="Welcome to B9 Games" /></label>
            <label>Button label<input v-model.trim="platformSettings.homepageBanner.buttonLabel" maxlength="32" placeholder="Explore games" /></label>
            <label class="settings-control-wide">Banner description<textarea v-model.trim="platformSettings.homepageBanner.description" maxlength="300" rows="2" placeholder="A short message for homepage visitors"></textarea></label>
            <label>Button destination
              <select v-model="platformSettings.homepageBanner.buttonLink">
                <option value="/games">Games</option>
                <option value="/wallet">Wallet</option>
                <option value="/promotions">Promotions</option>
                <option value="/rewards">Rewards</option>
              </select>
            </label>
            <label class="promotion-banner-upload settings-control-wide">Banner artwork (JPEG, PNG, or WebP; up to 5 MB)
              <input type="file" accept="image/jpeg,image/png,image/webp" :disabled="homepageBannerUploading" @change="uploadHomepageBanner" />
              <small v-if="homepageBannerUploading">Uploading homepage banner...</small>
              <img v-if="homepageBannerPreview()" :src="homepageBannerPreview()" alt="Homepage banner preview" />
            </label>
            <button type="button" class="secondary settings-control-wide" :disabled="homepageBannerSaving || homepageBannerUploading" @click="saveHomepageBannerSettings">
              {{ homepageBannerSaving ? "Saving homepage banner…" : "Save homepage banner settings" }}
            </button>
            <button
              v-if="platformSettings.homepageBanner.bannerImage || homepageBannerPreviewUrl"
              type="button"
              class="promotion-banner-remove settings-control-wide"
              :disabled="homepageBannerUploading"
              @click="removeHomepageBanner"
            >Remove banner</button>
            <label class="switch-row settings-control-wide"><span><strong>Artwork includes all banner text</strong><small>Use for a finished creative; otherwise the headline and button are overlaid</small></span><input v-model="platformSettings.homepageBanner.bannerIncludesText" type="checkbox" /></label>
          </div>
        </section>
        <button class="primary-button" type="submit" :disabled="platformSettingsSaving">{{ platformSettingsSaving ? "Saving settings…" : "Save platform settings" }}</button>
      </form>
      <small class="form-message" role="status">{{ settingsMessage }}</small>
      <p class="google-config-note">Google Sign-In is configured through the server environment variable <code>GOOGLE_CLIENT_ID</code>. Set the matching web client ID in your Google Cloud OAuth client and add your production domain to its authorized JavaScript origins. Restart the API after changing the value.</p>
    </section>
    <AdminActionDialog
      v-if="actionDialog"
      :open="true"
      :title="actionDialog.title"
      :description="actionDialog.description"
      :fields="actionDialog.fields"
      :confirm-label="actionDialog.confirmLabel"
      :danger="actionDialog.danger"
      :busy="actionDialogBusy"
      :error="actionDialogError"
      @cancel="closeActionDialog"
      @confirm="submitActionDialog"
    />
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef, watch } from "vue";
import {
  ArrowLeftRight,
  ChevronRight,
  CircleCheck,
  Gift,
  LifeBuoy,
  Network,
  Plus,
  RefreshCw,
  ShieldCheck,
  UsersRound,
  Wallet,
} from "lucide-vue-next";
import { useSessionStore } from "./stores/session";
import AdminActionDialog from "./components/AdminActionDialog.vue";
import AdminSidebar from "./components/AdminSidebar.vue";
import b9Logo from "./assets/b9-logo.webp";

type AdminActionField = {
  name: string;
  label: string;
  type?: "text" | "number" | "textarea";
  initialValue?: string;
  min?: number;
  max?: number;
  step?: number | "any";
  maxLength?: number;
  required?: boolean;
  placeholder?: string;
  rows?: number;
};
type AdminActionConfig = {
  title: string;
  description?: string;
  confirmLabel: string;
  danger?: boolean;
  fields: AdminActionField[];
  successMessage: string;
};
type Account = {
  id: string; username: string; email: string; phone: string; country: string; role: string; balance: number; status: string;
  fullName: string; documentType: string; documentNumber: string; kycStatus: string; kycDocuments: Record<string, string>;
};
type AgentApplication = { id: string; username: string; email: string; country: string; businessName: string; experience: string; createdAt: string };
type AgentRequest = { id: string; type: string; agentUsername: string; playerUsername: string; paymentMethod: string; paymentReference: string; note: string; createdAt: string; amount: number };
type AgentCommission = { id: string; agentUsername: string; periodLabel: string; createdAt: string; amount: number };
type AgentLimitRequest = { id: string; agentUsername: string; playerUsername: string; reason: string; createdAt: string; limit: number };
type AgentRecord = { id: string; username: string; country: string; balance: number };
type AgentData = { applications: AgentApplication[]; agents: AgentRecord[]; requests: AgentRequest[]; commissions: AgentCommission[]; limits: AgentLimitRequest[] };
type ReferralReview = { id: string; createdAt: string; referrerId: string; referrerUsername: string; referrerCountry: string; referredUsername: string };
type Transaction = { id: string; username: string; type: string; amount: number; status: string; paymentMethod?: string; paymentReference?: string; paymentNote?: string; proofFile?: string; createdAt?: string };
type AuditLog = { id: string; action: string; target: string; details: string; createdAt: string };
type SupportTicket = { id: string; username: string; subject: string; message: string; status: string; reply: string; createdAt: string; updatedAt: string };
type Promotion = { id: string; title: string; description: string; reward: string; terms: string; active: boolean; bannerImage: string; bannerIncludesText: boolean };
type HomepageBanner = { active: boolean; title: string; description: string; buttonLabel: string; buttonLink: string; bannerImage: string; bannerIncludesText: boolean };
type BonusCode = { id: string; code: string; amount: number; terms: string; expiresAt: string | null; maxRedemptions: number | null; active: boolean; createdAt: string; redemptionCount: number };
type RewardSettings = {
  dailyEnabled: boolean; dailyRewards: number[]; dailyResetTimezone: string; streakResetOnMissedDay: boolean;
  vipEnabled: boolean; vipWindowDays: number; vipTiers: { silver: number; gold: number; platinum: number };
  cashbackEnabled: boolean; cashbackRate: number; cashbackWeeklyCap: number;
};
type ManagedProvider = { code: string; name: string; enabled: boolean; gameCount: number; logo: string };
type ManagedGame = {
  id: string; providerCode: string; provider: string; providerEnabled: boolean; externalId: string; name: string;
  thumbnail: string; category: string; isPopular: boolean; gameType: string; sortOrder: number; enabled: boolean; providerStatus: number;
};
type ProviderSource = { code: string; name: string };
type ProviderCatalogGame = { id: string; name: string; gameType: string; status: number };

const session = useSessionStore();
const token = toRef(session, "adminToken");
const signedIn = ref(Boolean(token.value));
const username = ref("");
const password = ref("");
const loading = ref(false);
const error = ref("");
const adminFeedback = ref<{ message: string; type: "success" | "error" } | null>(null);
const actionDialog = ref<AdminActionConfig | null>(null);
const actionDialogBusy = ref(false);
const actionDialogError = ref("");
let actionDialogHandler: ((values: Record<string, string>) => Promise<void>) | null = null;
const tab = ref<"overview" | "games" | "users" | "agents" | "referrals" | "kyc" | "transactions" | "results" | "activity" | "support" | "promotions" | "settings">("overview");
const stats = ref({ totalUsers: 0, activeUsers: 0, totalBalance: 0, pendingRequests: 0, indiaUsers: 0, pakistanUsers: 0, pendingKyc: 0, approvedDeposits: 0, approvedWithdrawals: 0 });
const users = ref<Account[]>([]);
const transactions = ref<Transaction[]>([]);
const agentData = ref<AgentData>({ applications: [], agents: [], requests: [], commissions: [], limits: [] });
const referralReviews = ref<ReferralReview[]>([]);
const activityLogs = ref<AuditLog[]>([]);
const userSearch = ref("");
const countryFilter = ref("");
const userRoleFilter = ref("");
const userStatusFilter = ref("");
const userKycFilter = ref("");
const transactionSearch = ref("");
const transactionStatusFilter = ref("");
const transactionTypeFilter = ref("");
const resultUserId = ref("");
const resultCategory = ref<"bet" | "lottery" | "game">("game");
const resultGameName = ref("");
const resultOutcome = ref<"won" | "lost">("won");
const resultAmount = ref(0);
const resultReference = ref("");
const resultLoading = ref(false);
const resultMessage = ref("");
const lastRefreshTime = ref("just now");
const refreshing = ref(false);
const refreshError = ref("");
const supportTickets = ref<SupportTicket[]>([]);
const supportUpdating = ref<Record<string, boolean>>({});
const managedProviders = ref<ManagedProvider[]>([]);
const providerLogoUploading = ref<Record<string, boolean>>({});
const managedGames = ref<ManagedGame[]>([]);
const gameCategories = ["Mini Games", "Slots", "Fishing"];
const gameStats = ref({ totalProviders: 0, totalGames: 0, availableGames: 0, activeGames: 0, disabledGames: 0 });
const catalogPageSize = ref(24);
const providerApiConfigured = ref(false);
const providerSources = ref<ProviderSource[]>([]);
const providerCatalogLoading = ref(false);
const newProviderCode = ref("");
const newProviderName = ref("");
const importProviderCode = ref("");
const providerCatalogGames = ref<ProviderCatalogGame[]>([]);
const providerGamesLoading = ref(false);
const providerGamesImporting = ref(false);
const selectedProviderGameIds = ref<string[]>([]);
const importGameId = ref("");
const importCategory = ref("Mini Games");
const importIsPopular = ref(false);
const importThumbnail = ref("");
const importThumbnailFile = ref<File | null>(null);
const importSortOrder = ref(0);
const managedGameSearch = ref("");
const managedProviderFilter = ref("");
const managedCategoryFilter = ref("");
const selectedManagedGameIds = ref<string[]>([]);
const bulkGamesUpdating = ref(false);
const gameManagementMessage = ref("");
const managedGameIds = computed(() => new Set(managedGames.value.map((game) => game.id)));
const availableProviderSources = computed(() => providerSources.value.filter(
  (source) => !managedProviders.value.some((provider) => provider.code === source.code),
));
const availableProviderCatalogGames = computed(() => providerCatalogGames.value.filter(
  (game) => game.status === 0
    && /^[a-zA-Z0-9_-]{1,120}$/.test(game.id)
    && !managedGameIds.value.has(game.id),
));
const allAvailableProviderGamesSelected = computed(() => availableProviderCatalogGames.value.length > 0
  && availableProviderCatalogGames.value.every((game) => selectedProviderGameIds.value.includes(game.id)));
const filteredManagedGames = computed(() => managedGames.value.filter((game) => {
  const search = managedGameSearch.value.trim().toLowerCase();
  return (!search || `${game.name} ${game.provider} ${game.category}`.toLowerCase().includes(search))
    && (!managedProviderFilter.value || game.providerCode === managedProviderFilter.value)
    && (!managedCategoryFilter.value || game.category === managedCategoryFilter.value);
}));
const allFilteredManagedGamesSelected = computed(() => filteredManagedGames.value.length > 0
  && filteredManagedGames.value.every((game) => selectedManagedGameIds.value.includes(game.id)));
const openTicketCount = computed(() => supportTickets.value.filter((ticket) => ticket.status !== "resolved").length);
const pendingAgentReviews = computed(() => agentData.value.applications.length
  + agentData.value.requests.length
  + agentData.value.commissions.length
  + agentData.value.limits.length);
const pendingActionCount = computed(() => stats.value.pendingRequests
  + stats.value.pendingKyc
  + pendingAgentReviews.value
  + referralReviews.value.length
  + openTicketCount.value);
const platformSettings = ref({
  announcement: "",
  maintenanceMode: false,
  supportEmail: "",
  supportPhone: "",
  supportHours: "24/7",
  bankName: "",
  accountName: "",
  accountNumber: "",
  iban: "",
  upiId: "",
  walletName: "",
  walletNumber: "",
  paymentInstructions: "",
  jackpotAmount: 10799004.2,
  homepageBanner: {
    active: false,
    title: "",
    description: "",
    buttonLabel: "Explore games",
    buttonLink: "/games",
    bannerImage: "",
    bannerIncludesText: false,
  } as HomepageBanner,
  promotions: [] as Promotion[],
});
const bonusCodes = ref<BonusCode[]>([]);
const bonusCodeForm = ref({ code: "", amount: 1, terms: "", expiresAt: "", maxRedemptions: "" });
const bonusCodeMessage = ref("");
const bonusCodeSaving = ref(false);
const bonusCodeActionId = ref("");
const rewardSettings = ref<RewardSettings>({
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
});
const rewardSettingsMessage = ref("");
const rewardSettingsSaving = ref(false);
const settingsMessage = ref("");
const platformSettingsSaving = ref(false);
const bannerUploading = ref<Record<string, boolean>>({});
const bannerPreviewUrls = ref<Record<string, string>>({});
const homepageBannerUploading = ref(false);
const homepageBannerSaving = ref(false);
const homepageBannerPreviewUrl = ref("");
let refreshTimer: number | undefined;

watch([managedGameSearch, managedProviderFilter, managedCategoryFilter], () => {
  selectedManagedGameIds.value = [];
});
const kycUsers = computed(() => users.value.filter((account) => account.kycStatus !== "not_submitted"));
const filteredUsers = computed(() => {
  const search = userSearch.value.trim().toLowerCase();
  return users.value.filter((account) => {
    const matchesCountry = !countryFilter.value || account.country === countryFilter.value;
    const matchesRole = !userRoleFilter.value || account.role === userRoleFilter.value;
    const matchesStatus = !userStatusFilter.value || account.status === userStatusFilter.value;
    const matchesKyc = !userKycFilter.value || account.kycStatus === userKycFilter.value;
    const matchesSearch = !search || account.username.toLowerCase().includes(search) || account.email.toLowerCase().includes(search);
    return matchesCountry && matchesRole && matchesStatus && matchesKyc && matchesSearch;
  });
});
const filteredTransactions = computed(() => {
  const search = transactionSearch.value.trim().toLowerCase();
  return transactions.value.filter((item) => {
    const matchesStatus = !transactionStatusFilter.value || item.status === transactionStatusFilter.value;
    const matchesType = !transactionTypeFilter.value || item.type === transactionTypeFilter.value;
    const matchesSearch = !search || item.username.toLowerCase().includes(search) || String(item.paymentReference || "").toLowerCase().includes(search) || item.id.toLowerCase().includes(search);
    return matchesStatus && matchesType && matchesSearch;
  });
});
const pageTitle = computed(() => ({
  overview: "Operations Overview",
  games: "Game and Provider Management",
  users: "User Management",
  agents: "Agent operations",
  referrals: "Referral reward review",
  kyc: "KYC Verification",
  transactions: "Transactions",
  results: "Game Results",
  activity: "Administrator Activity",
  support: "Support Inbox",
  promotions: "Member Promotions",
  settings: "Platform Settings",
}[tab.value]));

function selectTab(value: string) {
  const allowedTabs = ["overview", "games", "users", "agents", "referrals", "kyc", "transactions", "results", "activity", "support", "promotions", "settings"] as const;
  if (allowedTabs.includes(value as (typeof allowedTabs)[number])) {
    tab.value = value as (typeof allowedTabs)[number];
    if (tab.value === "games") void loadGameManagement();
    if (tab.value === "referrals") void loadReferralData();
    if (tab.value === "promotions") {
      void loadBonusCodes();
      void loadRewardSettings();
    }
  }
}

function reportAdminError(error: unknown, fallback: string): void {
  adminFeedback.value = {
    message: error instanceof Error ? error.message : fallback,
    type: "error",
  };
}

function openActionDialog(
  config: AdminActionConfig,
  handler: (values: Record<string, string>) => Promise<void>,
): void {
  if (actionDialogBusy.value) return;
  adminFeedback.value = null;
  actionDialogError.value = "";
  actionDialogHandler = handler;
  actionDialog.value = config;
}

function closeActionDialog(): void {
  if (actionDialogBusy.value) return;
  actionDialog.value = null;
  actionDialogHandler = null;
  actionDialogError.value = "";
}

async function submitActionDialog(values: Record<string, string>): Promise<void> {
  if (!actionDialogHandler || actionDialogBusy.value || !actionDialog.value) return;
  const handler = actionDialogHandler;
  const config = actionDialog.value;
  actionDialogBusy.value = true;
  actionDialogError.value = "";
  try {
    await handler(values);
    actionDialog.value = null;
    actionDialogHandler = null;
    adminFeedback.value = { message: config.successMessage, type: "success" };
  } catch (caught) {
    actionDialogError.value = caught instanceof Error ? caught.message : "The action could not be completed.";
  } finally {
    actionDialogBusy.value = false;
  }
}

function addPromotion() {
  if (platformSettings.value.promotions.length >= 20) return;
  platformSettings.value.promotions.push({
    id: `promotion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    description: "",
    reward: "",
    terms: "",
    bannerImage: "",
    bannerIncludesText: false,
    active: true,
  });
}

function removePromotion(index: number) {
  const [removed] = platformSettings.value.promotions.splice(index, 1);
  if (removed) clearBannerPreview(removed.id);
}

function bannerPreview(promotion: Promotion): string {
  return bannerPreviewUrls.value[promotion.id]
    || (promotion.bannerImage ? `/api/promotions/${encodeURIComponent(promotion.id)}/banner` : "");
}

function clearBannerPreview(promotionId: string): void {
  const preview = bannerPreviewUrls.value[promotionId];
  if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
  delete bannerPreviewUrls.value[promotionId];
}

async function uploadPromotionBanner(promotion: Promotion, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  bannerUploading.value[promotion.id] = true;
  settingsMessage.value = "";
  const form = new FormData();
  form.append("banner", file);
  try {
    if (!promotion.title.trim()) throw new Error("Enter an offer title before uploading its banner.");
    const validation = promotionValidationError();
    if (validation) throw new Error(validation);
    const saved = await api("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify(platformSettings.value),
    });
    platformSettings.value = { ...platformSettings.value, ...saved.settings };
    const savedPromotion = platformSettings.value.promotions.find((item) => item.id === promotion.id);
    if (!savedPromotion) {
      throw new Error("Save this offer before uploading its banner.");
    }
    const headers = new Headers();
    if (token.value) headers.set("Authorization", `Bearer ${token.value}`);
    const response = await fetch(`/api/admin/promotions/${encodeURIComponent(promotion.id)}/banner`, {
      method: "POST",
      headers,
      body: form,
    });
    handleUnauthorized(response);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not upload promotion banner");
    clearBannerPreview(promotion.id);
    savedPromotion.bannerImage = data.promotion.bannerImage;
    bannerPreviewUrls.value[promotion.id] = URL.createObjectURL(file);
    settingsMessage.value = "Banner uploaded. Save promotions to publish the offer.";
  } catch (caught) {
    settingsMessage.value = caught instanceof Error ? caught.message : "Could not upload promotion banner";
  } finally {
    bannerUploading.value[promotion.id] = false;
  }
}

function homepageBannerPreview(): string {
  return homepageBannerPreviewUrl.value
    || (platformSettings.value.homepageBanner.bannerImage ? "/api/platform/homepage-banner" : "");
}

function clearHomepageBannerPreview(): void {
  if (homepageBannerPreviewUrl.value.startsWith("blob:")) URL.revokeObjectURL(homepageBannerPreviewUrl.value);
  homepageBannerPreviewUrl.value = "";
}

async function persistHomepageBannerSettings(): Promise<void> {
  const saved = await api("/api/admin/homepage/banner/settings", {
    method: "PATCH",
    body: JSON.stringify(platformSettings.value.homepageBanner),
  });
  platformSettings.value.homepageBanner = {
    ...platformSettings.value.homepageBanner,
    ...saved.homepageBanner,
  };
}

async function saveHomepageBannerSettings(): Promise<void> {
  if (homepageBannerSaving.value || homepageBannerUploading.value) return;
  homepageBannerSaving.value = true;
  settingsMessage.value = "";
  try {
    await persistHomepageBannerSettings();
    settingsMessage.value = "Homepage banner settings saved.";
  } catch (caught) {
    settingsMessage.value = caught instanceof Error ? caught.message : "Could not save homepage banner settings";
  } finally {
    homepageBannerSaving.value = false;
  }
}

async function uploadHomepageBanner(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  homepageBannerUploading.value = true;
  settingsMessage.value = "";
  const form = new FormData();
  form.append("banner", file);
  try {
    await persistHomepageBannerSettings();
      ...saved.settings,
      homepageBanner: { ...platformSettings.value.homepageBanner, ...saved.settings.homepageBanner },
    };
    const headers = new Headers();
    if (token.value) headers.set("Authorization", `Bearer ${token.value}`);
    const response = await fetch("/api/admin/homepage/banner", { method: "POST", headers, body: form });
    handleUnauthorized(response);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not upload homepage banner");
    clearHomepageBannerPreview();
    platformSettings.value.homepageBanner.bannerImage = data.homepageBanner.bannerImage;
    homepageBannerPreviewUrl.value = URL.createObjectURL(file);
    settingsMessage.value = "Homepage banner uploaded and platform settings saved.";
  } catch (caught) {
    settingsMessage.value = caught instanceof Error ? caught.message : "Could not upload homepage banner";
  } finally {
    homepageBannerUploading.value = false;
  }
}

async function removeHomepageBanner(): Promise<void> {
  if (homepageBannerUploading.value) return;
  const previousImage = platformSettings.value.homepageBanner.bannerImage;
  homepageBannerUploading.value = true;
  settingsMessage.value = "";
  try {
    platformSettings.value.homepageBanner.bannerImage = "";
    const saved = await api("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify(platformSettings.value),
    });
    platformSettings.value = {
      ...platformSettings.value,
      ...saved.settings,
      homepageBanner: { ...platformSettings.value.homepageBanner, ...saved.settings.homepageBanner },
    };
    clearHomepageBannerPreview();
    settingsMessage.value = "Homepage banner removed.";
  } catch (caught) {
    platformSettings.value.homepageBanner.bannerImage = previousImage;
    settingsMessage.value = caught instanceof Error ? caught.message : "Could not remove homepage banner";
  } finally {
    homepageBannerUploading.value = false;
  }
}

async function api(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (token.value) headers.set("Authorization", "Bearer " + token.value);
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  handleUnauthorized(response);
  if (!response.ok) {
    const error = new Error(data.error || "Request failed");
    Object.assign(error, { status: response.status });
    throw error;
  }
  return data;
}

function handleUnauthorized(response: Response): void {
  if (response.status === 401 && signedIn.value) logout();
}

async function loadGameManagement() {
  try {
    const data = await api("/api/admin/game-management");
    managedProviders.value = data.providers;
    managedGames.value = data.games;
    selectedManagedGameIds.value = [];
    gameStats.value = data.stats;
    catalogPageSize.value = data.pageSize;
    providerApiConfigured.value = data.providerApiConfigured;
    gameManagementMessage.value = "";
  } catch (caught) {
    gameManagementMessage.value = caught instanceof Error ? caught.message : "Could not load game management";
  }
}

async function loadProviderSources() {
  providerCatalogLoading.value = true;
  gameManagementMessage.value = "";
  try {
    const data = await api("/api/admin/game-management/provider-catalog");
    providerSources.value = data.providers;
    providerApiConfigured.value = data.providerApiConfigured;
    if (availableProviderSources.value.length === 0) gameManagementMessage.value = "No new providers are currently available from HUIDU.";
  } catch (caught) {
    gameManagementMessage.value = caught instanceof Error ? caught.message : "Could not load available providers";
  } finally {
    providerCatalogLoading.value = false;
  }
}

async function addGameProvider() {
  try {
    await api("/api/admin/game-management/providers", {
      method: "POST",
      body: JSON.stringify({ code: newProviderCode.value, name: newProviderName.value || undefined }),
    });
    newProviderCode.value = "";
    newProviderName.value = "";
    await loadGameManagement();
    gameManagementMessage.value = "Provider added disabled. Enable it when its games are ready to publish.";
  } catch (caught) {
    gameManagementMessage.value = caught instanceof Error ? caught.message : "Could not add provider";
  }
}

async function saveGameProvider(provider: ManagedProvider) {
  try {
    await api(`/api/admin/game-management/providers/${encodeURIComponent(provider.code)}`, {
      method: "PATCH",
      body: JSON.stringify({ name: provider.name, enabled: provider.enabled }),
    });
    await loadGameManagement();
    gameManagementMessage.value = "Provider settings saved.";
  } catch (caught) {
    gameManagementMessage.value = caught instanceof Error ? caught.message : "Could not save provider";
  }
}

async function loadProviderGames() {
  if (!importProviderCode.value) {
    gameManagementMessage.value = "Choose a provider first.";
    return;
  }
  providerGamesLoading.value = true;
  gameManagementMessage.value = "";
  importGameId.value = "";
  selectedProviderGameIds.value = [];
  try {
    const data = await api(`/api/admin/game-management/providers/${encodeURIComponent(importProviderCode.value)}/catalog`);
    providerCatalogGames.value = data.games;
    if (data.games.length === 0) gameManagementMessage.value = "This provider has no games available to import.";
  } catch (caught) {
    gameManagementMessage.value = caught instanceof Error ? caught.message : "Could not load provider games";
  } finally {
    providerGamesLoading.value = false;
  }
}

function toggleAllProviderGames(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  selectedProviderGameIds.value = checked
    ? availableProviderCatalogGames.value.map((game) => game.id)
    : [];
}

function toggleProviderGame(gameId: string, event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  selectedProviderGameIds.value = checked
    ? [...selectedProviderGameIds.value, gameId]
    : selectedProviderGameIds.value.filter((id) => id !== gameId);
}

async function importSelectedProviderGames() {
  if (!importProviderCode.value || !selectedProviderGameIds.value.length) return;
  providerGamesImporting.value = true;
  gameManagementMessage.value = "";
  try {
    const data = await api("/api/admin/game-management/games/bulk", {
      method: "POST",
      body: JSON.stringify({
        providerCode: importProviderCode.value,
        externalIds: selectedProviderGameIds.value,
      }),
    });
    selectedProviderGameIds.value = [];
    await loadGameManagement();
    await loadProviderGames();
    gameManagementMessage.value = data.skippedCount
      ? `Added ${data.importedCount} games disabled. Skipped ${data.skippedCount} unavailable or duplicate games.`
      : `Added ${data.importedCount} games disabled. Enable them in the table when ready to publish.`;
  } catch (caught) {
    gameManagementMessage.value = caught instanceof Error ? caught.message : "Could not add selected games";
  } finally {
    providerGamesImporting.value = false;
  }
}

function toggleAllManagedGames(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  selectedManagedGameIds.value = checked
    ? filteredManagedGames.value.map((game) => game.id)
    : [];
}

function toggleManagedGame(gameId: string, event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  selectedManagedGameIds.value = checked
    ? [...selectedManagedGameIds.value, gameId]
    : selectedManagedGameIds.value.filter((id) => id !== gameId);
}

async function updateSelectedManagedGames(enabled: boolean) {
  if (!selectedManagedGameIds.value.length) return;
  bulkGamesUpdating.value = true;
  gameManagementMessage.value = "";
  try {
    const data = await api("/api/admin/game-management/bulk-enabled", {
      method: "PATCH",
      body: JSON.stringify({ gameIds: selectedManagedGameIds.value, enabled }),
    });
    selectedManagedGameIds.value = [];
    await loadGameManagement();
    gameManagementMessage.value = `${data.updatedCount} selected games ${enabled ? "enabled" : "disabled"}.`;
  } catch (caught) {
    gameManagementMessage.value = caught instanceof Error ? caught.message : "Could not update selected games";
  } finally {
    bulkGamesUpdating.value = false;
  }
}

async function importGame() {
  let importedGameId = "";
  try {
    const data = await api("/api/admin/game-management/games", {
      method: "POST",
      body: JSON.stringify({
        providerCode: importProviderCode.value,
        externalId: importGameId.value,
        category: importCategory.value,
        isPopular: importIsPopular.value,
        thumbnail: importThumbnail.value,
        sortOrder: Number(importSortOrder.value),
      }),
    });
    importedGameId = data.game.id;
    if (importThumbnailFile.value) {
      try {
        await uploadGameThumbnail(importedGameId, importThumbnailFile.value);
      } catch (caught) {
        await loadGameManagement();
        gameManagementMessage.value = `Game added, but its thumbnail upload failed: ${caught instanceof Error ? caught.message : "upload error"}. You can upload it from the game row.`;
        importGameId.value = "";
        importThumbnailFile.value = null;
        return;
      }
    }
    importGameId.value = "";
    importCategory.value = "Mini Games";
    importIsPopular.value = false;
    importThumbnail.value = "";
    importThumbnailFile.value = null;
    importSortOrder.value = 0;
    await loadGameManagement();
    gameManagementMessage.value = "Game added disabled. Enable it in the table when ready to publish.";
  } catch (caught) {
    if (importedGameId) await loadGameManagement();
    gameManagementMessage.value = caught instanceof Error ? caught.message : "Could not add game";
  }
}

async function saveManagedGame(game: ManagedGame) {
  try {
    await api(`/api/admin/game-management/games/${encodeURIComponent(game.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        providerCode: game.providerCode,
        name: game.name,
        thumbnail: game.thumbnail,
        category: game.category,
        isPopular: game.isPopular,
        sortOrder: Number(game.sortOrder),
        enabled: game.enabled,
      }),
    });
    await loadGameManagement();
    gameManagementMessage.value = "Game settings saved.";
  } catch (caught) {
    gameManagementMessage.value = caught instanceof Error ? caught.message : "Could not save game";
  }
}

function setImportThumbnailFile(event: Event) {
  importThumbnailFile.value = (event.target as HTMLInputElement).files?.[0] || null;
}

async function uploadGameThumbnail(gameId: string, file: File) {
  const form = new FormData();
  form.append("thumbnail", file);
  const headers = new Headers();
  if (token.value) headers.set("Authorization", `Bearer ${token.value}`);
  const response = await fetch(`/api/admin/game-management/games/${encodeURIComponent(gameId)}/thumbnail`, {
    method: "POST",
    headers,
    body: form,
  });
  handleUnauthorized(response);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not upload game thumbnail");
  return data.game as ManagedGame;
}

async function uploadManagedThumbnail(game: ManagedGame, event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    await uploadGameThumbnail(game.id, file);
    await loadGameManagement();
    gameManagementMessage.value = `Thumbnail updated for ${game.name}.`;
  } catch (caught) {
    gameManagementMessage.value = caught instanceof Error ? caught.message : "Could not upload game thumbnail";
  } finally {
    input.value = "";
  }
}

async function uploadProviderLogo(provider: ManagedProvider, event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  providerLogoUploading.value[provider.code] = true;
  try {
    const form = new FormData();
    form.append("logo", file);
    const headers = new Headers();
    if (token.value) headers.set("Authorization", `Bearer ${token.value}`);
    const response = await fetch(`/api/admin/game-management/providers/${encodeURIComponent(provider.code)}/logo`, {
      method: "POST",
      headers,
      body: form,
    });
    handleUnauthorized(response);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not upload provider logo");
    await loadGameManagement();
    gameManagementMessage.value = `Logo updated for ${provider.name}.`;
  } catch (caught) {
    gameManagementMessage.value = caught instanceof Error ? caught.message : "Could not upload provider logo";
  } finally {
    providerLogoUploading.value[provider.code] = false;
    input.value = "";
  }
}

function removeManagedGame(game: ManagedGame): void {
  openActionDialog({
    title: "Remove game from catalog",
    description: `Remove ${game.name} from the public game listing? Its provider record will be kept.`,
    confirmLabel: "Remove game",
    danger: true,
    fields: [],
    successMessage: "Game removed from the public listing.",
  }, async () => {
    await api(`/api/admin/game-management/games/${encodeURIComponent(game.id)}`, { method: "DELETE" });
    await loadGameManagement();
    gameManagementMessage.value = "Game disabled from the public listing; its provider record was retained.";
  });
}

async function saveCatalogPageSize() {
  try {
    const data = await api("/api/admin/game-management/catalog-settings", {
      method: "PATCH",
      body: JSON.stringify({ pageSize: Number(catalogPageSize.value) }),
    });
    catalogPageSize.value = data.pageSize;
    gameManagementMessage.value = `Public catalog page size set to ${data.pageSize} games.`;
  } catch (caught) {
    gameManagementMessage.value = caught instanceof Error ? caught.message : "Could not update catalog page size";
  }
}

async function login() {
  loading.value = true;
  error.value = "";
  try {
    const data = await api("/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: username.value, password: password.value }),
    });
    token.value = data.token;
    localStorage.setItem("b9_admin_token", data.token);
    signedIn.value = true;
    password.value = "";
    await refresh();
    await loadGameManagement();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : "Login failed";
  } finally {
    loading.value = false;
  }
}

function logout() {
  token.value = "";
  localStorage.removeItem("b9_admin_token");
  signedIn.value = false;
}

async function refresh() {
  if (refreshing.value || !signedIn.value) return;
  refreshing.value = true;
  refreshError.value = "";
  try {
    const results = await Promise.allSettled([
      api("/api/admin/stats"),
      api("/api/admin/users"),
      api("/api/admin/transactions"),
      api("/api/admin/activity"),
      api("/api/admin/support"),
      api("/api/admin/settings"),
      api("/api/admin/agents"),
      api("/api/admin/referrals"),
    ] as const);
    const [statsResult, usersResult, transactionsResult, activityResult, supportResult, settingsResult, agentsResult, referralsResult] = results;
    if (results.some((result) => result.status === "rejected"
      && result.reason instanceof Error
      && "status" in result.reason
      && result.reason.status === 401)) {
      logout();
      return;
    }

    const failures: string[] = [];
    function updateResult<T>(result: PromiseSettledResult<T>, name: string, update: (data: T) => void): void {
      if (result.status === "fulfilled") {
        update(result.value);
      } else {
        failures.push(`${name}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
      }
    }
    updateResult(statsResult, "statistics", (data) => { stats.value = data; });
    updateResult(usersResult, "users", (data) => { users.value = data.users; });
    updateResult(transactionsResult, "transactions", (data) => { transactions.value = data.transactions; });
    updateResult(activityResult, "activity", (data) => { activityLogs.value = data.logs; });
    updateResult(supportResult, "support", (data) => { supportTickets.value = data.tickets; });
    updateResult(settingsResult, "settings", (data) => { platformSettings.value = { ...platformSettings.value, ...data.settings }; });
    updateResult(agentsResult, "agents", (data) => { agentData.value = data; });
    updateResult(referralsResult, "referrals", (data) => { referralReviews.value = data.referrals; });
    refreshError.value = failures.length ? failures.join(" · ") : "";
    if (tab.value === "games") await loadGameManagement();
    if (tab.value === "promotions") await Promise.all([loadBonusCodes(), loadRewardSettings()]);
    lastRefreshTime.value = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch (caught) {
    if (caught instanceof Error && "status" in caught && caught.status === 401) {
      logout();
      return;
    }
    refreshError.value = caught instanceof Error ? caught.message : "Could not refresh dashboard data.";
  } finally {
    refreshing.value = false;
  }
}

async function loadAgentData() {
  try {
    agentData.value = await api("/api/admin/agents");
  } catch (error) {
    reportAdminError(error, "Could not load agent operations.");
  }
}

async function loadReferralData() {
  try {
    const data = await api("/api/admin/referrals");
    referralReviews.value = data.referrals;
  } catch (error) {
    reportAdminError(error, "Could not load referral rewards.");
  }
}

async function loadBonusCodes() {
  try {
    const data = await api("/api/admin/bonus-codes");
    bonusCodes.value = data.codes;
  } catch (error) {
    bonusCodeMessage.value = error instanceof Error ? error.message : "Could not load bonus codes.";
  }
}

async function loadRewardSettings() {
  try {
    const data = await api("/api/admin/rewards/settings");
    rewardSettings.value = {
      ...data.settings,
      dailyRewards: [...data.settings.dailyRewards],
      vipTiers: { ...data.settings.vipTiers },
    };
  } catch (error) {
    rewardSettingsMessage.value = error instanceof Error ? error.message : "Could not load reward controls.";
  }
}

async function saveRewardSettings() {
  rewardSettingsSaving.value = true;
  rewardSettingsMessage.value = "";
  try {
    const data = await api("/api/admin/rewards/settings", {
      method: "PATCH",
      body: JSON.stringify(rewardSettings.value),
    });
    rewardSettings.value = {
      ...data.settings,
      dailyRewards: [...data.settings.dailyRewards],
      vipTiers: { ...data.settings.vipTiers },
    };
    rewardSettingsMessage.value = "Reward controls saved.";
  } catch (error) {
    rewardSettingsMessage.value = error instanceof Error ? error.message : "Could not save reward controls.";
  } finally {
    rewardSettingsSaving.value = false;
  }
}

async function createBonusCode() {
  bonusCodeSaving.value = true;
  bonusCodeMessage.value = "";
  try {
    const expiresAt = bonusCodeForm.value.expiresAt
      ? new Date(bonusCodeForm.value.expiresAt).toISOString()
      : "";
    await api("/api/admin/bonus-codes", {
      method: "POST",
      body: JSON.stringify({
        code: bonusCodeForm.value.code,
        amount: bonusCodeForm.value.amount,
        terms: bonusCodeForm.value.terms,
        expiresAt,
        maxRedemptions: bonusCodeForm.value.maxRedemptions
          ? Number(bonusCodeForm.value.maxRedemptions)
          : null,
      }),
    });
    bonusCodeForm.value = { code: "", amount: 1, terms: "", expiresAt: "", maxRedemptions: "" };
    bonusCodeMessage.value = "Bonus code created.";
    await loadBonusCodes();
  } catch (error) {
    bonusCodeMessage.value = error instanceof Error ? error.message : "Could not create bonus code.";
  } finally {
    bonusCodeSaving.value = false;
  }
}

async function toggleBonusCode(code: BonusCode) {
  bonusCodeActionId.value = code.id;
  bonusCodeMessage.value = "";
  try {
    await api(`/api/admin/bonus-codes/${encodeURIComponent(code.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !code.active }),
    });
    await loadBonusCodes();
    bonusCodeMessage.value = `Bonus code ${code.active ? "disabled" : "activated"}.`;
  } catch (error) {
    bonusCodeMessage.value = error instanceof Error ? error.message : "Could not update bonus code.";
  } finally {
    bonusCodeActionId.value = "";
  }
}

function reviewReferral(referral: ReferralReview, status: "approved" | "rejected"): void {
  const fields: AdminActionField[] = status === "approved"
    ? [{
      name: "amount",
      label: "Reward amount (Rs.)",
      type: "number",
      min: 0.01,
      max: 100000000,
      step: 0.01,
    }]
    : [{
      name: "note",
      label: "Reason for rejection (optional)",
      type: "textarea",
      maxLength: 500,
      required: false,
    }];
  openActionDialog({
    title: status === "approved" ? "Approve referral reward" : "Reject referral",
    description: status === "approved"
      ? `Confirm the reward amount for ${referral.referrerUsername}. Approval credits the reward to their wallet.`
      : `Reject the referral for ${referral.referrerUsername}.`,
    confirmLabel: status === "approved" ? "Approve & credit" : "Reject referral",
    danger: status === "rejected",
    fields,
    successMessage: status === "approved" ? "Referral approved and reward credited." : "Referral rejected.",
  }, async (values) => {
    const amount = Number(values.amount);
    if (status === "approved" && (!Number.isFinite(amount) || amount < 0.01 || amount > 100000000)) {
      throw new Error("Enter a valid reward amount.");
    }
    await api(`/api/admin/referrals/${referral.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
        ...(status === "approved" ? { amount } : {}),
        note: values.note || "",
      }),
    });
    await refresh();
  });
}

function toggleUser(account: Account): void {
  const status = account.status === "active" ? "suspended" : "active";
  openActionDialog({
    title: status === "suspended" ? "Suspend account" : "Reactivate account",
    description: status === "suspended"
      ? `Suspend ${account.username}? They will no longer be able to use their account.`
      : `Restore account access for ${account.username}?`,
    confirmLabel: status === "suspended" ? "Suspend account" : "Reactivate account",
    danger: status === "suspended",
    fields: [],
    successMessage: status === "suspended" ? "Account suspended." : "Account reactivated.",
  }, async () => {
    await api(`/api/admin/users/${account.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await refresh();
  });
}

function formatAgentDate(value: string): string {
  return value ? new Date(value).toLocaleString() : "—";
}

function agentRequestLabel(type: string): string {
  return ({
    agent_deposit: "Agent deposit",
    agent_withdrawal: "Agent withdrawal",
    player_deposit: "Player deposit",
    player_withdrawal: "Player withdrawal",
  } as Record<string, string>)[type] || type;
}

function reviewAgentApplication(application: AgentApplication, status: "approved" | "rejected"): void {
  openActionDialog({
    title: status === "approved" ? "Approve agent application" : "Reject agent application",
    description: `${status === "approved" ? "Approve" : "Reject"} ${application.username}'s application for ${application.businessName}?`,
    confirmLabel: status === "approved" ? "Approve application" : "Reject application",
    danger: status === "rejected",
    fields: [],
    successMessage: status === "approved" ? "Agent application approved." : "Agent application rejected.",
  }, async () => {
    await api(`/api/admin/agents/applications/${application.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await refresh();
  });
}

function reviewAgentRequest(request: AgentRequest, status: "approved" | "rejected"): void {
  openActionDialog({
    title: status === "approved" ? "Approve agent transaction" : "Reject agent transaction",
    description: `${request.type.replaceAll("_", " ")} for ${request.agentUsername} · Rs. ${money(request.amount)}. ${
      status === "approved" ? "Verify the transaction details before approving." : "This will decline the request."
    }`,
    confirmLabel: status === "approved" ? "Approve transaction" : "Reject transaction",
    danger: status === "rejected",
    fields: status === "rejected"
      ? [{ name: "note", label: "Reason for rejection (optional)", type: "textarea", maxLength: 500, required: false }]
      : [],
    successMessage: status === "approved" ? "Agent transaction approved." : "Agent transaction rejected.",
  }, async (values) => {
    await api(`/api/admin/agents/requests/${request.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, note: values.note || "" }),
    });
    await refresh();
  });
}

function addAgentCommission(agent: AgentRecord): void {
  openActionDialog({
    title: `Add commission for ${agent.username}`,
    description: "Create a pending commission record. It will not be paid until separately approved.",
    confirmLabel: "Create commission",
    fields: [
      { name: "amount", label: "Commission amount (Rs.)", type: "number", min: 0.01, max: 100000000, step: 0.01 },
      { name: "periodLabel", label: "Period or description", maxLength: 80, placeholder: "For example, Week of Nov 10" },
    ],
    successMessage: "Commission created as pending.",
  }, async (values) => {
    const amount = Number(values.amount);
    if (!Number.isFinite(amount) || amount < 0.01 || amount > 100000000) {
      throw new Error("Enter a valid commission amount.");
    }
    const periodLabel = values.periodLabel.trim();
    if (!periodLabel) throw new Error("Enter a commission period or description.");
    await api(`/api/admin/agents/${agent.id}/commissions`, {
      method: "POST",
      body: JSON.stringify({ amount, periodLabel }),
    });
    await refresh();
  });
}

function reviewAgentCommission(commission: AgentCommission, status: "paid" | "rejected"): void {
  openActionDialog({
    title: status === "paid" ? "Pay agent commission" : "Reject agent commission",
    description: `${status === "paid" ? "Mark" : "Reject"} the Rs. ${money(commission.amount)} commission for ${commission.agentUsername} (${commission.periodLabel})?`,
    confirmLabel: status === "paid" ? "Mark as paid" : "Reject commission",
    danger: status === "rejected",
    fields: status === "rejected"
      ? [{ name: "note", label: "Reason for rejection (optional)", type: "textarea", maxLength: 500, required: false }]
      : [],
    successMessage: status === "paid" ? "Commission marked as paid." : "Commission rejected.",
  }, async (values) => {
    await api(`/api/admin/agents/commissions/${commission.id}`, {
      method: "PATCH", body: JSON.stringify({ status, note: values.note || "" }),
    });
    await refresh();
  });
}

function reviewAgentLimit(request: AgentLimitRequest, status: "approved" | "rejected"): void {
  openActionDialog({
    title: status === "approved" ? "Approve player limit" : "Reject player limit",
    description: `${status === "approved" ? "Approve" : "Reject"} the Rs. ${money(request.limit)} limit request for ${request.playerUsername}?`,
    confirmLabel: status === "approved" ? "Approve limit" : "Reject limit",
    danger: status === "rejected",
    fields: status === "rejected"
      ? [{ name: "note", label: "Reason for rejection (optional)", type: "textarea", maxLength: 500, required: false }]
      : [],
    successMessage: status === "approved" ? "Player limit request approved." : "Player limit request rejected.",
  }, async (values) => {
    await api(`/api/admin/agents/limits/${request.id}`, {
      method: "PATCH", body: JSON.stringify({ status, note: values.note || "" }),
    });
    await refresh();
  });
}

function processTransaction(transaction: Transaction, status: "approved" | "rejected"): void {
  openActionDialog({
    title: status === "approved" ? "Approve payment request" : "Reject payment request",
    description: `${transaction.type} for ${transaction.username} · Rs. ${money(transaction.amount)}. ${
      status === "approved"
        ? "Verify the deposit arrived or send the withdrawal before approving. This only updates the internal wallet."
        : "This will decline the payment request."
    }`,
    confirmLabel: status === "approved" ? "Approve request" : "Reject request",
    danger: status === "rejected",
    fields: [],
    successMessage: status === "approved" ? "Payment request approved." : "Payment request rejected.",
  }, async () => {
    await api(`/api/admin/transactions/${transaction.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    await refresh();
  });
}

function adjustBalance(account: Account): void {
  openActionDialog({
    title: `Adjust ${account.username}'s balance`,
    description: `Current balance: Rs. ${money(account.balance)}. The change will be recorded in the wallet ledger.`,
    confirmLabel: "Save balance",
    fields: [
      { name: "balance", label: "New wallet balance (Rs.)", type: "number", min: 0, max: 100000000, step: 0.01, initialValue: String(account.balance) },
      { name: "reason", label: "Adjustment reason", type: "textarea", maxLength: 500, initialValue: "Administrator balance correction" },
    ],
    successMessage: "Wallet balance updated.",
  }, async (values) => {
    const balance = Number(values.balance);
    if (!Number.isFinite(balance) || balance < 0 || balance > 100000000) {
      throw new Error("Enter a valid balance between Rs. 0 and Rs. 100,000,000.");
    }
    const reason = values.reason.trim() || "Manual adjustment";
    await api(`/api/admin/users/${account.id}`, {
      method: "PATCH",
      body: JSON.stringify({ balance, reason }),
    });
    await refresh();
  });
}

function rejectKyc(account: Account): void {
  reviewKyc(account.id, "rejected", "Document details do not match the submitted information");
}

async function openProof(filename: string): Promise<void> {
  await openPrivateDocument(`/uploads/${encodeURIComponent(filename)}`, "Could not open payment proof.");
}

async function openPrivateDocument(url: string, fallback: string): Promise<void> {
  const documentWindow = window.open("about:blank", "_blank");
  if (!documentWindow) {
    reportAdminError(new Error("Allow pop-ups for this site to view the document."), fallback);
    return;
  }
  documentWindow.opener = null;
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token.value}` } });
    handleUnauthorized(response);
    if (!response.ok) throw new Error(`${fallback} (HTTP ${response.status})`);
    const documentUrl = URL.createObjectURL(await response.blob());
    documentWindow.location.replace(documentUrl);
    window.setTimeout(() => URL.revokeObjectURL(documentUrl), 60000);
  } catch (caught) {
    documentWindow.close();
    reportAdminError(caught, fallback);
  }
}

function reviewKyc(id: string, status: "verified" | "rejected", initialNote = ""): void {
  const account = users.value.find((user) => user.id === id);
  openActionDialog({
    title: status === "verified" ? "Verify identity documents" : "Reject identity verification",
    description: status === "verified"
      ? `Verify the submitted identity documents for ${account?.username || "this account"}?`
      : `Reject the identity documents for ${account?.username || "this account"}.`,
    confirmLabel: status === "verified" ? "Verify documents" : "Reject verification",
    danger: status === "rejected",
    fields: status === "rejected"
      ? [{
        name: "note",
        label: "Reason for rejection",
        type: "textarea",
        maxLength: 1000,
        required: false,
        initialValue: initialNote,
      }]
      : [],
    successMessage: status === "verified" ? "Identity verification approved." : "Identity verification rejected.",
  }, async (values) => {
    await api(`/api/admin/users/${id}/kyc`, {
      method: "PATCH",
      body: JSON.stringify({ status, note: values.note || "" }),
    });
    await refresh();
  });
}

async function recordGameResult() {
  if (!resultUserId.value || !resultGameName.value.trim()) {
    resultMessage.value = "Select a user and enter the game or event name.";
    return;
  }
  if (!Number.isFinite(resultAmount.value) || resultAmount.value < 0) {
    resultMessage.value = "Enter a valid winnings amount.";
    return;
  }
  resultLoading.value = true;
  resultMessage.value = "";
  try {
    await api("/api/admin/game-results", {
      method: "POST",
      body: JSON.stringify({
        userId: resultUserId.value,
        category: resultCategory.value,
        gameName: resultGameName.value.trim(),
        outcome: resultOutcome.value,
        amount: resultAmount.value,
        reference: resultReference.value.trim(),
      }),
    });
    resultMessage.value = "Result recorded and the user's wallet/inbox updated.";
    resultGameName.value = "";
    resultAmount.value = 0;
    resultReference.value = "";
    await refresh();
  } catch (caught) {
    resultMessage.value = caught instanceof Error ? caught.message : "Could not record result";
  } finally {
    resultLoading.value = false;
  }
}

async function openDocument(url: string): Promise<void> {
  await openPrivateDocument(url, "Could not open identity document.");
}

function money(value: number) {
  return Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

function formatDate(value: string) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function replyToSupportTicket(ticket: SupportTicket): void {
  openActionDialog({
    title: `Reply to ${ticket.username}`,
    description: ticket.subject,
    confirmLabel: "Send reply",
    fields: [{
      name: "reply",
      label: "Reply",
      type: "textarea",
      maxLength: 3000,
      initialValue: ticket.reply || "",
    }],
    successMessage: "Support reply sent.",
  }, async (values) => {
    await api(`/api/admin/support/${ticket.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: ticket.status, reply: values.reply }),
    });
    await refresh();
  });
}

async function updateSupportTicket(ticket: SupportTicket, status: string) {
  if (supportUpdating.value[ticket.id]) return;
  supportUpdating.value[ticket.id] = true;
  try {
    await api(`/api/admin/support/${ticket.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, reply: ticket.reply }),
    });
    await refresh();
    adminFeedback.value = { message: "Support ticket status updated.", type: "success" };
  } catch (caught) {
    reportAdminError(caught, "Could not update support ticket status.");
  } finally {
    supportUpdating.value[ticket.id] = false;
  }
}

async function savePlatformSettings() {
  if (platformSettingsSaving.value) return;
  settingsMessage.value = "";
  const validation = promotionValidationError();
  if (validation) {
    settingsMessage.value = validation;
    return;
  }
  platformSettingsSaving.value = true;
  try {
    await api("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify(platformSettings.value),
    });
    settingsMessage.value = "Platform settings saved successfully.";
  } catch (caught) {
    settingsMessage.value = caught instanceof Error ? caught.message : "Could not save settings";
  } finally {
    platformSettingsSaving.value = false;
  }
}

/**
 * The settings endpoint validates the whole offer list, so a single incomplete
 * offer blocks every save and banner upload. Report which one is incomplete
 * instead of surfacing the raw schema message.
 */
function promotionValidationError(): string {
  const offers = platformSettings.value.promotions;
  const missingTitle = offers
    .map((promotion, index) => ({ promotion, index }))
    .filter(({ promotion }) => !String(promotion.title || "").trim());
  if (missingTitle.length) {
    const labels = missingTitle.map(({ index }) => `Offer ${index + 1}`).join(", ");
    return `${labels} ${missingTitle.length === 1 ? "needs" : "need"} a title before promotions can be saved or their banners uploaded.`;
  }
  return "";
}

async function removePromotionBanner(promotion: Promotion) {
  settingsMessage.value = "";
  const previousImage = promotion.bannerImage;
  bannerUploading.value[promotion.id] = true;
  try {
    if (!previousImage) {
      clearBannerPreview(promotion.id);
      settingsMessage.value = "Banner removed.";
      return;
    }
    const validation = promotionValidationError();
    if (validation) throw new Error(validation);
    promotion.bannerImage = "";
    const saved = await api("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify(platformSettings.value),
    });
    platformSettings.value = { ...platformSettings.value, ...saved.settings };
    clearBannerPreview(promotion.id);
    settingsMessage.value = "Banner removed. The offer keeps its text and settings.";
  } catch (caught) {
    promotion.bannerImage = previousImage;
    settingsMessage.value = caught instanceof Error ? caught.message : "Could not remove banner";
  } finally {
    bannerUploading.value[promotion.id] = false;
  }
}

function exportTransactions() {
  const header = ["ID", "Username", "Type", "Amount", "Status", "Method", "Reference", "Created"];
  const rows = filteredTransactions.value.map((item) => [
    item.id,
    item.username,
    item.type,
    String(item.amount),
    item.status,
    item.paymentMethod || "",
    item.paymentReference || "",
    item.createdAt || "",
  ]);
  const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `b9-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

onMounted(() => {
  if (signedIn.value) {
    refresh();
    void loadGameManagement();
    refreshTimer = window.setInterval(refresh, 30000);
  }
});

onUnmounted(() => {
  if (refreshTimer) window.clearInterval(refreshTimer);
  for (const preview of Object.values(bannerPreviewUrls.value)) {
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
  }
  clearHomepageBannerPreview();
});
</script>

<style>
:root { font-family: Inter, system-ui, sans-serif; color: #27382b; background: #edf4ef; }
* { box-sizing: border-box; }
body { margin: 0; }
.admin-login { min-height: 100vh; display: grid; place-items: center; padding: 20px; }
.login-card { width: min(380px, 100%); display: flex; flex-direction: column; gap: 12px; padding: 28px; border-radius: 18px; background: white; box-shadow: 0 12px 40px rgb(20 60 34 / 12%); }
.login-card img { width: 54px; height: 54px; object-fit: cover; border-radius: 10px; }
.login-card h1 { margin: 4px 0 0; }
.login-card p { margin: 0 0 4px; color: #718076; }
.login-card input { height: 46px; padding: 0 12px; border: 1px solid #d5ded6; border-radius: 10px; outline-color: #20a85a; }
.login-card button { height: 46px; border: 0; border-radius: 10px; color: white; background: #159a4b; font-weight: 750; }
.login-card small { color: #b54a4a; }
.admin-shell { min-height: 100vh; max-width: 1100px; margin: 0 auto; padding: 18px; }
.admin-shell header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.admin-shell header div { display: flex; flex-direction: column; }
.admin-shell header span { color: #718076; font-size: 12px; }
.admin-shell header button { padding: 9px 13px; border: 0; border-radius: 9px; color: white; background: #315940; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.stats article { display: flex; min-height: 92px; flex-direction: column; justify-content: center; padding: 14px; border-radius: 13px; background: white; box-shadow: 0 4px 16px rgb(20 60 34 / 6%); }
.stats strong { font-size: 22px; }
.stats span { margin-top: 4px; color: #718076; font-size: 12px; }
.admin-shell nav { display: flex; gap: 7px; margin: 16px 0 10px; }
.admin-shell nav button { padding: 9px 14px; border: 0; border-radius: 9px; color: #59665d; background: white; }
.admin-shell nav button.active { color: white; background: #159a4b; }
.panel { display: flex; flex-direction: column; gap: 8px; padding: 14px; border-radius: 14px; background: white; }
.panel h2 { margin: 0 0 5px; font-size: 17px; }
.toolbar { display: grid; grid-template-columns: 1fr 180px; gap: 8px; margin-bottom: 4px; }
.users-toolbar { grid-template-columns: minmax(200px, 1.5fr) repeat(4, minmax(130px, 1fr)); }
.toolbar input, .toolbar select { height: 42px; padding: 0 10px; border: 1px solid #d5ded6; border-radius: 9px; background: white; }
.user-result-count { padding: 7px 10px; border: 1px solid #e4ecf1; border-radius: 999px; color: #698093; background: #f7fafc; font-size: 10px; font-weight: 750; white-space: nowrap; }
.transaction-toolbar { grid-template-columns: 1fr 150px 150px; }
.overview-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.overview-grid article { display: flex; min-height: 86px; flex-direction: column; justify-content: center; padding: 12px; border-radius: 10px; background: #f4f7f4; }
.overview-grid span { color: #718076; font-size: 12px; }
.overview-grid strong { margin-top: 5px; font-size: 18px; }
.quick-actions { display: flex; gap: 8px; margin-top: 12px; }
.quick-actions button, .secondary { background: #315940 !important; }
.result-form { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.result-form input, .result-form select { height: 42px; min-width: 0; padding: 0 10px; border: 1px solid #d5ded6; border-radius: 9px; background: white; }
.result-form button { grid-column: 1 / -1; height: 44px; border: 0; border-radius: 9px; color: white; background: #159a4b; font-weight: 700; }
.form-message { margin-top: 8px; color: #526258; }
.activity-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px; border-radius: 10px; background: #f4f7f4; }
.activity-row strong { display: block; font-size: 13px; }
.activity-row span, .activity-row time { margin-top: 3px; color: #718076; font-size: 11px; }
.activity-row time { white-space: nowrap; }
.row, .kyc-row { display: flex; min-height: 58px; align-items: center; gap: 10px; padding: 9px; border-radius: 10px; background: #f4f7f4; }
.row > div:first-child, .kyc-row > div:first-child { min-width: 0; flex: 1; }
.row strong, .row span, .kyc-row strong, .kyc-row span { display: block; }
.row span, .kyc-row span { margin-top: 2px; color: #718076; font-size: 11px; }
.meta { color: #536358; font-size: 12px; }
.row button, .kyc-row button, .documents button { padding: 8px 10px; border: 0; border-radius: 8px; color: white; background: #159a4b; cursor: pointer; }
.actions { display: flex; gap: 5px; }
.actions .reject { background: #b85b5b; }
.manual-details { flex: 1.5; min-width: 180px; }
.manual-details span { overflow-wrap: anywhere; }
.manual-details .proof-button { margin-top: 6px; padding: 6px 8px; font-size: 11px; }
.documents { display: flex; gap: 5px; }
.pending { color: #b47b20; } .approved, .verified { color: #23834a; } .rejected { color: #b85b5b; }
.pending, .approved, .rejected, .verified { font-size: 12px; text-transform: capitalize; }
.empty { color: #718076; text-align: center; }
.agent-admin-panel { gap: 18px; }
.agent-admin-block { display: flex; flex-direction: column; gap: 8px; padding-top: 15px; border-top: 1px solid #e9eeeb; }
.agent-admin-block h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 3px; font-size: 14px; }
.agent-admin-block h3 span { min-width: 20px; padding: 2px 6px; border-radius: 999px; color: #087b4b; background: #e8f6ef; font-size: 10px; text-align: center; }
.agent-admin-row { align-items: center; }
.agent-admin-note { margin: 2px 0 0; color: #718076; font-size: 11px; line-height: 1.5; }
@media (max-width: 700px) {
  .stats { grid-template-columns: repeat(2, 1fr); }
  .row, .kyc-row { align-items: flex-start; flex-wrap: wrap; }
  .overview-grid { grid-template-columns: repeat(2, 1fr); }
  .transaction-toolbar, .result-form { grid-template-columns: 1fr; }
  .result-form button { grid-column: auto; }
  .quick-actions { flex-wrap: wrap; }
}

/* Professional control-center presentation */
:root { font-family: Inter, "Segoe UI", system-ui, sans-serif; color: #172033; background: #f3f6f8; }
.admin-login {
  position: relative; min-height: 100vh; display: grid; grid-template-columns: minmax(300px, 0.9fr) minmax(380px, 1.1fr);
  place-items: center; padding: 0; background: radial-gradient(circle at 20% 10%, #eefbf5 0, transparent 35%), #f7faf9;
}
.login-brand-panel { position: absolute; left: 5.5%; top: 7%; display: flex; align-items: center; gap: 12px; }
.login-brand-panel img { width: 46px; height: 46px; border-radius: 12px; object-fit: cover; box-shadow: 0 8px 24px rgb(12 91 57 / 18%); }
.login-brand-panel div { display: flex; flex-direction: column; }
.login-brand-panel span { color: #829087; font-size: 9px; font-weight: 800; letter-spacing: 1.7px; }
.login-brand-panel strong { margin-top: 2px; font-size: 17px; }
.login-card {
  grid-column: 2; width: min(430px, calc(100% - 40px)); gap: 18px; padding: 38px; border: 1px solid rgb(29 68 48 / 8%);
  border-radius: 20px; box-shadow: 0 24px 70px rgb(30 67 48 / 12%);
}
.login-heading { display: flex; align-items: center; gap: 14px; margin-bottom: 5px; }
.login-heading-logo { width: 72px; height: 72px; flex: 0 0 auto; border-radius: 18px; object-fit: cover; }
.login-heading h1 { font-size: 25px; letter-spacing: -0.5px; }
.login-heading p { margin-top: 4px; font-size: 13px; }
.login-card label { display: flex; flex-direction: column; gap: 7px; color: #4b5a51; font-size: 12px; font-weight: 750; }
.login-card input { width: 100%; height: 48px; border: 1px solid #dfe7e2; border-radius: 10px; background: #fbfdfc; }
.login-card input:focus { border-color: #25a66c; box-shadow: 0 0 0 4px rgb(37 166 108 / 9%); outline: none; }
.login-button, .login-card button.login-button { height: 48px; margin-top: 2px; border-radius: 10px; background: linear-gradient(135deg, #12a866, #087b4b); box-shadow: 0 10px 20px rgb(8 123 75 / 16%); }
.login-error { color: #b54a4a !important; }
.admin-shell { width: 100%; max-width: none; min-height: 100vh; display: grid; grid-template-columns: 238px minmax(0, 1fr); margin: 0; padding: 0; background: #f4f7f9; }
.sidebar { position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; padding: 24px 16px 16px; border-right: 1px solid #e7edf0; background: #fff; }
.brand { display: flex; align-items: center; gap: 11px; padding: 0 8px 22px; border-bottom: 1px solid #edf1f0; }
.brand img { width: 42px; height: 42px; border-radius: 11px; object-fit: cover; }
.brand div { display: flex; flex-direction: column; }
.brand strong { font-size: 15px; }
.brand span { margin-top: 2px; color: #8a9690; font-size: 11px; }
.side-nav { display: flex; flex-direction: column; gap: 13px; margin: 18px 0; }
.nav-group { display: flex; flex-direction: column; gap: 3px; }
.nav-group-title { margin: 0 0 3px; padding: 0 12px; color: #789184; font-size: 9px; font-weight: 800; letter-spacing: 1.1px; text-transform: uppercase; }
.side-nav button { width: 100%; min-height: 45px; display: flex; align-items: center; gap: 10px; padding: 0 12px; border: 0; border-radius: 10px; color: #66736c; background: transparent; font-size: 13px; font-weight: 650; text-align: left; cursor: pointer; }
.side-nav button > span { width: 22px; color: #98a49e; font-size: 16px; text-align: center; }
.side-nav button b { margin-left: auto; min-width: 21px; height: 21px; display: grid; place-items: center; border-radius: 20px; color: #087b4b; background: #e8f6ef; font-size: 10px; }
.side-nav button.active { color: #087b4b; background: #eaf7f1; box-shadow: inset 3px 0 0 #0da768; }
.side-nav button.active > span { color: #0da768; }
.sidebar-user { display: grid; grid-template-columns: 38px 1fr 28px; align-items: center; gap: 9px; margin-top: auto; padding: 11px 8px; border-top: 1px solid #edf1f0; }
.avatar { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 50%; color: white; background: linear-gradient(145deg, #243d33, #0e9a60); font-size: 11px; font-weight: 800; }
.sidebar-user > div:nth-child(2) { display: flex; flex-direction: column; }
.sidebar-user strong { font-size: 12px; }
.sidebar-user span { margin-top: 3px; color: #89968f; font-size: 10px; }
.sidebar-user span i, .live-status i { width: 7px; height: 7px; display: inline-block; margin-right: 4px; border-radius: 50%; background: #20b96f; }
.sidebar-user button { width: 28px; height: 28px; border: 0; border-radius: 8px; color: #89968f; background: #f2f5f4; }
.workspace { min-width: 0; padding: 0 30px 36px; overflow: hidden; }
.workspace-header { height: 104px; display: flex; align-items: center; justify-content: space-between; margin: 0; border-bottom: 1px solid #e7edf0; }
.workspace-header > div:first-child { display: flex; flex-direction: column; }
.workspace-header > div:first-child > span { color: #9aa6a0; font-size: 9px; font-weight: 850; letter-spacing: 1.5px; }
.workspace-header h1 { margin: 5px 0 0; color: #172033; font-size: 24px; letter-spacing: -0.6px; }
.header-actions { display: flex; align-items: center; gap: 10px; }
.header-actions .live-status { height: 28px; display: flex; align-items: center; padding: 0 9px; border-radius: 20px; color: #5d7568; background: #eaf7ef; font-size: 10px; font-weight: 800; }
.refresh-time { color: #98a49e; font-size: 11px; }
.icon-button { width: 36px; height: 36px; border: 1px solid #e2e8e5 !important; border-radius: 9px !important; color: #65736b !important; background: white !important; cursor: pointer; }
.icon-button:disabled, .overview-refresh:disabled { cursor: wait; opacity: .7; }
.refresh-spinning { animation: admin-refresh-spin .8s linear infinite; }
@keyframes admin-refresh-spin { to { transform: rotate(360deg); } }
.refresh-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 12px 0 0; padding: 11px 14px; border: 1px solid #f0d4d4; border-radius: 10px; color: #9c3d3d; background: #fff6f6; font-size: 12px; }
.refresh-error button { flex: 0 0 auto; padding: 6px 10px; border: 1px solid #e8caca; border-radius: 7px; color: #963c3c; background: white; font-size: 11px; font-weight: 700; }
.admin-feedback { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 12px 0 0; padding: 11px 14px; border: 1px solid #cfe7d7; border-radius: 10px; color: #176b43; background: #f0faf3; font-size: 12px; }
.admin-feedback-error { border-color: #f0d4d4; color: #9c3d3d; background: #fff6f6; }
.admin-feedback button { flex: 0 0 auto; padding: 6px 10px; border: 1px solid currentColor; border-radius: 7px; color: inherit; background: white; font-size: 11px; font-weight: 700; }
@media (prefers-reduced-motion: reduce) { .refresh-spinning { animation-duration: 2s; } }
.overview-page { display: block; }
.stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-top: 24px; }
.stat-card { min-height: 128px; display: flex; align-items: center; gap: 13px; padding: 18px; border: 1px solid #edf1ef; border-radius: 14px; background: white; box-shadow: 0 7px 24px rgb(38 69 52 / 5%); }
.stat-card .stat-icon { width: 43px; height: 43px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 12px; font-size: 17px; font-weight: 850; }
.users-card .stat-icon { color: #1d8ad8; background: #edf7fd; }
.balance-card .stat-icon { color: #079c5b; background: #eaf8f1; }
.request-card .stat-icon { color: #d68a1e; background: #fff5e7; }
.kyc-card .stat-icon { color: #7357d5; background: #f1edff; }
.stat-card div:last-child { min-width: 0; display: flex; flex-direction: column; }
.stat-card span { color: #89968f; font-size: 11px; }
.stat-card strong { margin: 5px 0 3px; overflow: hidden; color: #1d2934; font-size: clamp(20px, 2vw, 27px); letter-spacing: -0.7px; text-overflow: ellipsis; white-space: nowrap; }
.stat-card small { color: #9aa69f; font-size: 10px; }
.panel, .overview-panel { margin-top: 18px; border: 1px solid #edf1ef; border-radius: 14px; background: white; box-shadow: 0 7px 24px rgb(38 69 52 / 4%); }
.panel { padding: 20px; }
.overview-panel { padding: 20px; }
.panel h2 { font-size: 16px; }
.overview-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.overview-grid article { min-height: 90px; border: 1px solid #eef2f0; background: #fafcfb; }
.quick-actions { margin-top: 14px; }
.quick-actions button { height: 38px; padding: 0 14px; border: 0; border-radius: 9px; color: white; background: #087b4b !important; font-size: 12px; font-weight: 750; }
.panel-heading { display: flex; align-items: center; justify-content: space-between; }
.panel-heading p { margin: 4px 0 0; color: #9aa69f; font-size: 11px; }
.export-button { height: 36px; padding: 0 12px; border: 1px solid #dfe7e2 !important; border-radius: 8px !important; color: #526158 !important; background: white !important; font-size: 11px; }
.toolbar { margin-top: 14px; }
.toolbar input, .toolbar select, .result-form input, .result-form select { border-radius: 8px; border-color: #e4eae7; }
.row, .kyc-row { min-height: 70px; border: 1px solid #edf1ef; background: #fff; }
.row:hover, .kyc-row:hover, .activity-row:hover { border-color: #dfe8e3; background: #fbfdfc; }
.row button, .kyc-row button, .documents button { height: 34px; border-radius: 8px; font-size: 11px; }
.activity-row { border: 1px solid #edf1ef; background: white; }
.result-form { margin-top: 14px; }
.ticket-row { display: grid; grid-template-columns: minmax(0, 1fr) 120px 80px; align-items: center; gap: 10px; padding: 14px; border: 1px solid #edf1ef; border-radius: 12px; background: white; }
.ticket-copy strong { display: block; font-size: 13px; }
.ticket-copy span { display: block; margin-top: 3px; color: #92a098; font-size: 10px; }
.ticket-copy p { margin: 7px 0 0; color: #59665f; font-size: 12px; }
.ticket-row select { height: 38px; border: 1px solid #e1e8e4; border-radius: 8px; background: white; }
.ticket-row button { height: 38px; border: 0; border-radius: 8px; color: white; background: #087b4b; }
.settings-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
.settings-form label { display: flex; flex-direction: column; gap: 7px; color: #5a685f; font-size: 12px; font-weight: 750; }
.settings-form label:first-child, .settings-form .switch-row, .settings-form .primary-button { grid-column: 1 / -1; }
.settings-form input, .settings-form textarea, .settings-form select { width: 100%; border: 1px solid #e1e8e4; border-radius: 9px; background: white; padding: 10px; font-family: inherit; }
.settings-form input, .settings-form select { height: 42px; }
.settings-form textarea { resize: vertical; }
.settings-control-group { display: grid; grid-column: 1 / -1; gap: 12px; padding: 16px; border: 1px solid #e5ece7; border-radius: 14px; background: #fbfdfb; }
.settings-control-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.settings-control-grid .settings-control-wide { grid-column: 1 / -1; }
.settings-control-group .promotion-admin-heading p { max-width: 720px; }
.promotion-admin-section { display: grid; grid-column: 1 / -1; gap: 10px; padding-top: 14px; border-top: 1px solid #e8eeea; }
.rewards-admin-section .reward-daily-amounts { display: grid; grid-column: 1 / -1; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.rewards-admin-section .reward-daily-amounts label { min-width: 0; }
.rewards-admin-section .reward-daily-amounts input { min-width: 0; }
.promotion-admin-heading, .promotion-admin-card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.promotion-admin-heading h3 { margin: 0; color: #344a3c; font-size: 15px; }
.promotion-admin-heading p { max-width: 520px; margin: 4px 0 0; color: #87948b; font-size: 11px; line-height: 1.5; }
.promotion-admin-card { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; padding: 12px; border: 1px solid #e7ede9; border-radius: 12px; background: #fbfdfb; }
.promotion-admin-card-heading, .promotion-admin-card label:first-of-type, .promotion-admin-card label:nth-of-type(4), .promotion-admin-card .switch-row { grid-column: 1 / -1; }
.promotion-admin-card-heading { align-items: center; }
.promotion-admin-card label { display: flex; flex-direction: column; gap: 6px; color: #5a685f; font-size: 11px; font-weight: 700; }
.promotion-admin-card input, .promotion-admin-card textarea { width: 100%; padding: 9px; border: 1px solid #e1e8e4; border-radius: 8px; background: white; font: inherit; }
.promotion-admin-card input { min-height: 38px; }
.promotion-admin-card textarea { resize: vertical; }
.promotion-admin-card .promotion-banner-upload { grid-column: 1 / -1; }
.promotion-banner-upload img { width: min(100%, 520px); max-height: 220px; border-radius: 10px; object-fit: cover; }
.promotion-admin-card .switch-row { flex-direction: row; }
.promotion-banner-remove { grid-column: 1 / -1; justify-self: start; min-height: 34px; padding: 7px 13px; border: 1px solid #f0d5d5; border-radius: 9px; color: #a33a3a; background: #fdf3f3; font-size: 11.5px; font-weight: 700; }
.promotion-banner-remove:hover { background: #fbe7e7; }
.promotion-banner-remove:disabled { opacity: .6; }
.game-management-panel { display: grid; gap: 18px; }
.game-management-panel > .panel-heading { gap: 12px; }
.game-management-panel h3 { margin: 0; color: #344a3c; font-size: 15px; }
.provider-api-status { padding: 7px 10px; border-radius: 99px; color: #975e15; background: #fff5e7; font-size: 10px; font-weight: 750; white-space: nowrap; }
.provider-api-status.configured { color: #087b4b; background: #eaf8f1; }
.game-stats-grid { margin-top: 0; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.game-stats-grid .stat-card { min-height: 92px; }
.game-management-block { display: grid; gap: 12px; padding-top: 16px; border-top: 1px solid #e8eeea; }
.game-provider-add { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; margin-top: 0; }
.provider-game-selection { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 10px; padding-top: 12px; border-top: 1px solid #e8eeea; }
.provider-game-list { display: grid; grid-column: 1 / -1; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 12px; max-height: 280px; overflow-y: auto; padding: 8px; border: 1px solid #edf1ef; border-radius: 8px; }
.provider-game-option { display: flex; min-width: 0; align-items: center; gap: 7px; color: #526158; font-size: 11px; }
.provider-game-option span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.provider-game-option small { flex: 0 0 auto; color: #8d9992; font-size: 9px; }
.provider-game-option input, .provider-game-selection > label input { width: 16px; height: 16px; flex: 0 0 auto; }
.provider-game-selection > span, .game-bulk-toolbar > span { color: #77847c; font-size: 11px; }
.provider-game-selection > button, .game-bulk-toolbar > button { min-height: 36px; padding: 0 12px; border: 0; border-radius: 8px; color: white; background: #087b4b; font-size: 11px; font-weight: 750; }
.provider-game-selection > button:disabled, .game-bulk-toolbar > button:disabled { cursor: not-allowed; opacity: .55; }
.game-provider-add input, .game-provider-add select, .game-management-filters input, .game-management-filters select { min-width: 0; height: 40px; padding: 0 10px; border: 1px solid #e1e8e4; border-radius: 8px; background: #fff; font: inherit; }
.game-provider-add input[type="file"], .game-management-table input[type="file"] { height: auto; min-height: 36px; padding: 6px; font-size: 10px; }
.game-management-table select { width: 100%; min-width: 100px; height: 36px; padding: 0 7px; border: 1px solid #e1e8e4; border-radius: 7px; background: #fff; font: inherit; font-size: 11px; }
.game-popular-control { display: inline-flex; align-items: center; gap: 5px; color: #5a685f; font-size: 11px; white-space: nowrap; }
.game-popular-control input { width: 16px; height: 16px; }
.game-provider-add button { min-height: 40px; padding: 0 14px; border: 0; border-radius: 8px; color: #fff; background: #087b4b; font-size: 11px; font-weight: 750; }
.game-provider-row { display: grid; grid-template-columns: minmax(100px, 1fr) 120px minmax(140px, 2fr) auto auto; align-items: center; gap: 10px; padding: 10px; border: 1px solid #edf1ef; border-radius: 10px; }
.game-provider-row > div { display: grid; gap: 3px; }
.game-provider-row .provider-publish-control { gap: 4px; }
.provider-publish-state { color: #43835a !important; }
.provider-publish-state.disabled { color: #a56d32 !important; }
.game-provider-row .provider-logo-control { display: flex; min-width: 0; align-items: center; gap: 7px; }
.provider-logo-control img, .provider-logo-control > span { display: grid; width: 36px; height: 36px; flex: 0 0 auto; place-items: center; border: 1px solid #e1e8e4; border-radius: 8px; color: #087b4b; background: #f0f7f2; font-size: 11px; font-weight: 850; object-fit: contain; }
.provider-logo-control input[type="file"] { width: 100%; min-width: 0; font-size: 9px; }
.game-provider-row small, .game-management-table td small { display: block; color: #8d9992; font-size: 10px; }
.game-provider-row > input, .game-management-table input { width: 100%; min-width: 80px; height: 36px; padding: 0 8px; border: 1px solid #e1e8e4; border-radius: 7px; background: white; font: inherit; }
.managed-game-thumbnail { display: block; width: 72px; height: 48px; margin-bottom: 6px; border-radius: 6px; background: #f0f7f2; object-fit: contain; }
.managed-game-no-thumbnail { display: block; margin-bottom: 6px; color: #8d9992; font-size: 10px; }
.game-enabled-control { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; color: #5a685f; font-size: 11px; }
.game-enabled-control input { width: 16px; height: 16px; }
.catalog-page-size { display: flex; align-items: end; gap: 8px; }
.catalog-page-size label { display: grid; gap: 4px; color: #637168; font-size: 10px; }
.catalog-page-size input { width: 100px; height: 36px; padding: 0 8px; border: 1px solid #e1e8e4; border-radius: 7px; }
.catalog-page-size button { height: 36px; }
.game-management-filters { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; margin-top: 0; }
.game-bulk-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.game-bulk-toolbar > button.secondary { border: 1px solid #dfe7e2; color: #526158; background: white; }
.game-management-table-wrap { overflow-x: auto; border: 1px solid #edf1ef; border-radius: 10px; }
.game-management-table { width: 100%; min-width: 820px; border-collapse: collapse; text-align: left; }
.game-management-table th { padding: 10px; color: #87948b; background: #f8faf9; font-size: 10px; text-transform: uppercase; }
.game-management-table td { padding: 9px; border-top: 1px solid #edf1ef; vertical-align: middle; font-size: 11px; }
.game-management-table td:first-child { width: 38px; }
.game-management-table td:first-child input[type="checkbox"] { width: 16px; height: 16px; min-width: 16px; }
.game-management-table td:nth-child(2) { width: 30%; }
.game-management-table td:nth-child(2) input + input { margin-top: 5px; }
.game-actions { display: flex; gap: 6px; }
.game-actions button, .game-provider-row button { min-height: 34px; padding: 0 9px; font-size: 10px; }
.game-management-panel .form-message { color: #087b4b; }
.google-config-note { margin: 12px 0 0; color: #77847c; font-size: 11px; line-height: 1.6; }
.google-config-note code { overflow-wrap: anywhere; }
.switch-row { flex-direction: row !important; align-items: center; justify-content: space-between; padding: 12px; border: 1px solid #edf1ef; border-radius: 10px; }
.switch-row span { display: flex; flex-direction: column; }
.switch-row small { margin-top: 3px; color: #98a49e; font-weight: 500; }
.switch-row input { width: 18px !important; height: 18px !important; }
@media (max-width: 980px) {
  .admin-shell { grid-template-columns: 78px minmax(0, 1fr); }
  .sidebar { padding-inline: 10px; }
  .brand { justify-content: center; padding-inline: 0; }
  .brand div, .side-nav button:not(.active) b, .side-nav button { font-size: 0; }
  .brand div, .sidebar-user > div:nth-child(2), .sidebar-user button { display: none; }
  .side-nav button { justify-content: center; padding: 0; font-size: 0; }
  .side-nav button > span { font-size: 16px; }
  .side-nav button b { position: absolute; margin: -24px 0 0 28px; display: grid; font-size: 9px; }
  .sidebar-user { display: flex; justify-content: center; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .game-stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 700px) {
  .admin-login { grid-template-columns: 1fr; }
  .login-brand-panel { left: 20px; }
  .login-card { grid-column: 1; width: calc(100% - 32px); padding: 26px 20px; }
  .admin-shell { grid-template-columns: 1fr; }
  .sidebar { position: fixed; z-index: 20; top: auto; bottom: 0; width: 100%; height: 68px; display: block; padding: 7px; border-top: 1px solid #e3eae6; border-right: 0; }
  .brand, .sidebar-user { display: none; }
  .side-nav { height: 54px; display: flex; flex-direction: row; gap: 2px; margin: 0; overflow-x: auto; }
  .side-nav button { min-width: 62px; }
  .side-nav button { height: 54px; min-height: 54px; display: grid; place-items: center; align-content: center; gap: 2px; }
  .side-nav button > span { font-size: 16px; }
  .side-nav button b { display: none; }
  .side-nav button.active { box-shadow: none; }
  .workspace { padding: 0 14px 86px; }
  .workspace-header { height: 82px; }
  .workspace-header h1 { font-size: 20px; }
  .refresh-time { display: none; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; margin-top: 14px; }
  .stat-card { min-height: 112px; align-items: flex-start; gap: 9px; padding: 12px; }
  .stat-card .stat-icon { width: 36px; height: 36px; }
  .stat-card strong { font-size: 18px; }
  .overview-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .game-provider-row { grid-template-columns: minmax(0, 1fr) minmax(100px, 1fr); }
  .game-provider-row .provider-logo-control { grid-column: 1 / -1; }
  .game-provider-add, .game-management-filters { grid-template-columns: 1fr; }
  .game-management-panel > .panel-heading { align-items: flex-start; flex-direction: column; }
  .transaction-toolbar { grid-template-columns: 1fr !important; }
  .workspace { padding: 0 12px calc(84px + env(safe-area-inset-bottom)); }
  .workspace-header { height: 72px; margin-bottom: 0; }
  .workspace-header h1 { font-size: 18px; }
  .workspace-header > div:first-child > span { font-size: 8px; }
  .header-actions { gap: 5px; }
  .header-actions .live-status { padding: 0 7px; }
  .panel { padding: 12px; }
  .toolbar { grid-template-columns: 1fr !important; }
  .toolbar input, .toolbar select { width: 100%; min-width: 0; }
  .row, .kyc-row { width: 100%; align-items: stretch; }
  .row > div, .kyc-row > div { width: 100%; flex-basis: auto; }
  .row .actions, .kyc-row .actions, .row button, .kyc-row button { flex: 1; }
  .manual-details, .documents { width: 100%; min-width: 100%; }
  .documents { flex-wrap: wrap; }
  .documents button { flex: 1; }
  .activity-row { align-items: flex-start; }
  .ticket-row { grid-template-columns: 1fr; }
  .ticket-row select, .ticket-row button { width: 100%; }
  .settings-form { grid-template-columns: 1fr; }
  .settings-form label, .settings-form label:first-child, .settings-form .switch-row, .settings-form .primary-button { grid-column: 1; }
  .settings-control-group { grid-column: 1; padding: 13px; }
  .settings-control-grid { grid-template-columns: 1fr; }
  .settings-control-grid .settings-control-wide { grid-column: 1; }
  .promotion-admin-section { grid-column: 1; }
  .rewards-admin-section .reward-daily-amounts { grid-column: 1; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .promotion-admin-card { grid-template-columns: 1fr; }
  .promotion-admin-card-heading, .promotion-admin-card label:first-of-type, .promotion-admin-card label:nth-of-type(4), .promotion-admin-card .promotion-banner-upload, .promotion-admin-card .switch-row { grid-column: 1; }
  .quick-actions button { flex: 1; min-width: 120px; }
}
@media (max-width: 420px) {
  .stats-grid { grid-template-columns: 1fr; }
  .overview-grid { grid-template-columns: 1fr; }
  .stat-card { min-height: 92px; align-items: center; }
  .stat-card strong { font-size: 17px; }
  .login-card { padding: 22px 16px; }
  .login-heading { align-items: flex-start; }
  .login-heading h1 { font-size: 21px; }
}
.sidebar { padding: 20px 12px 14px; }
.side-nav { min-height: 0; flex: 1; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #e2ebe5 transparent; }
.side-nav button { position: relative; flex: 0 0 auto; transition: color .16s ease, background .16s ease, transform .16s ease; }
.side-nav button:hover { color: #087b4b; background: #f3f9f5; }
.side-nav button:focus-visible, .overview-refresh:focus-visible, .overview-action-card:focus-visible, .quick-actions button:focus-visible { outline: 3px solid rgb(16 168 104 / 30%); outline-offset: 2px; }
.side-nav button .nav-icon { width: 18px; height: 18px; flex: 0 0 18px; color: #829087; stroke-width: 1.8; }
.side-nav button .nav-label { width: auto; color: inherit; font-size: 12px; text-align: left; }
.side-nav button.active .nav-icon { color: #0da768; }
.side-nav button.active { font-weight: 750; }
.overview-welcome { position: relative; display: flex; min-height: 154px; align-items: center; justify-content: space-between; gap: 20px; margin-top: 20px; overflow: hidden; padding: 25px 28px; border: 1px solid #dfeee5; border-radius: 18px; background: radial-gradient(ellipse at 85% 0%, rgb(31 182 117 / 14%), transparent 42%), linear-gradient(115deg, #fff 0%, #f4fbf7 100%); box-shadow: 0 12px 32px rgb(34 80 54 / 5%); }
.overview-welcome::after { position: absolute; right: 12%; bottom: -96px; width: 220px; height: 220px; border: 1px solid rgb(13 167 104 / 8%); border-radius: 50%; content: ""; pointer-events: none; }
.overview-welcome h2 { margin: 8px 0 5px; color: #14251c; font-size: clamp(21px, 2.4vw, 29px); letter-spacing: -.8px; }
.overview-welcome p { margin: 0; color: #708077; font-size: 12px; line-height: 1.6; }
.overview-eyebrow { color: #0b9860; font-size: 9px; font-weight: 850; letter-spacing: 1.45px; }
.overview-welcome-actions { z-index: 1; display: flex; flex: 0 0 auto; flex-direction: column; align-items: flex-end; gap: 10px; }
.overview-security { display: inline-flex; align-items: center; gap: 6px; color: #73827a; font-size: 10px; font-weight: 700; }
.overview-security svg { color: #0e9c61; }
.overview-refresh { display: inline-flex; height: 38px; align-items: center; justify-content: center; gap: 7px; padding: 0 13px; border: 1px solid #d8e9de; border-radius: 9px; color: #087b4b; background: white; font-size: 11px; font-weight: 750; cursor: pointer; transition: background .16s ease, transform .16s ease; }
.overview-refresh:hover { transform: translateY(-1px); background: #f2faf5; }
.stats-grid { gap: 13px; margin-top: 16px; }
.stat-card { position: relative; min-width: 0; min-height: 120px; overflow: hidden; border-color: #e9efec; transition: transform .18s ease, box-shadow .18s ease; }
.stat-card:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgb(38 69 52 / 9%); }
.stat-card .stat-icon { width: 44px; height: 44px; }
.stat-card strong { font-size: clamp(18px, 1.8vw, 25px); }
.stat-card span { color: #627168; font-weight: 700; }
.overview-panel { margin-top: 16px; padding: 22px; }
.overview-panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.overview-panel-heading h2 { margin: 5px 0 0; color: #17251d; font-size: 17px; letter-spacing: -.25px; }
.overview-queue-total { flex: 0 0 auto; padding: 7px 10px; border: 1px solid #f1e4c9; border-radius: 999px; color: #90651e; background: #fff9ed; font-size: 10px; font-weight: 750; }
.overview-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 17px; }
.overview-action-card { min-width: 0; min-height: 74px; display: flex; align-items: center; gap: 11px; padding: 12px; border: 1px solid #e9efec; border-radius: 12px; color: #27372e; background: #fff; text-align: left; cursor: pointer; transition: border-color .16s ease, background .16s ease, transform .16s ease, box-shadow .16s ease; }
.overview-action-card:hover { transform: translateY(-1px); border-color: #cde6d7; background: #fbfefc; box-shadow: 0 7px 18px rgb(38 69 52 / 6%); }
.overview-action-icon { width: 38px; height: 38px; display: grid; flex: 0 0 38px; place-items: center; border-radius: 11px; }
.overview-action-icon.deposit { color: #11835a; background: #eaf8f1; }
.overview-action-icon.verification { color: #7357d5; background: #f1edff; }
.overview-action-icon.referral { color: #ce4a7c; background: #fff0f5; }
.overview-action-copy { min-width: 0; display: flex; flex: 1; flex-direction: column; gap: 4px; }
.overview-action-copy strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.overview-action-copy small { color: #929e97; font-size: 10px; }
.overview-action-card > b { min-width: 27px; height: 27px; display: grid; flex: 0 0 auto; place-items: center; border-radius: 9px; color: #52635a; background: #f1f5f2; font-size: 11px; }
.overview-action-card > svg:last-child { flex: 0 0 auto; color: #a4b0a9; }
.overview-secondary-row { min-height: 46px; display: flex; align-items: center; gap: 8px; margin-top: 16px; padding-top: 13px; border-top: 1px solid #edf1ef; }
.overview-secondary-row > span { display: inline-flex; align-items: center; gap: 7px; color: #79867f; font-size: 11px; }
.overview-secondary-row > span svg { color: #159a66; }
.overview-secondary-row > strong { color: #34493c; font-size: 12px; }
.overview-secondary-row .quick-actions { margin: 0 0 0 auto; }
.overview-secondary-row .quick-actions button { display: inline-flex; align-items: center; gap: 6px; height: 34px; }
.brand img { box-shadow: 0 5px 15px rgb(12 91 57 / 12%); }
.brand strong { color: #19271f; }
.brand span { letter-spacing: .15px; }
@media (max-width: 980px) {
  .side-nav button .nav-label { display: none; }
  .nav-group-title { display: none; }
}
@media (max-width: 700px) {
  .side-nav { flex: initial; scrollbar-width: none; }
  .nav-group { display: contents; }
  .side-nav button { width: 68px; min-width: 68px; flex: 0 0 68px; padding: 0 6px; }
  .side-nav button .nav-icon { width: 17px; height: 17px; }
  .side-nav button .nav-label { display: block; color: inherit; font-size: 9px; font-weight: 650; line-height: 1; text-align: center; white-space: nowrap; }
  .overview-welcome { min-height: auto; align-items: flex-start; margin-top: 12px; padding: 18px 16px; }
  .overview-welcome p { max-width: 410px; font-size: 11px; }
  .overview-welcome-actions { align-items: flex-end; }
  .overview-security { display: none; }
  .overview-refresh { height: 34px; padding: 0 9px; font-size: 10px; }
  .overview-panel { padding: 16px; }
  .overview-secondary-row { flex-wrap: wrap; }
}
@media (max-width: 420px) {
  .overview-welcome { flex-direction: column; gap: 12px; }
  .overview-welcome-actions { width: 100%; align-items: flex-start; }
  .overview-grid { grid-template-columns: 1fr; }
  .overview-secondary-row { align-items: center; }
  .overview-secondary-row .quick-actions { width: 100%; margin: 4px 0 0; }
}
.admin-shell { background: radial-gradient(ellipse at 86% 0%, rgb(96 142 246 / 6%), transparent 30%), #f4f7fb; }
.sidebar { color: #ecf5ef; border-right-color: #164531; background: linear-gradient(180deg, #103a29 0%, #0c3022 55%, #09291e 100%); box-shadow: 8px 0 30px rgb(11 49 33 / 6%); }
.brand { border-bottom-color: rgb(255 255 255 / 10%); }
.brand strong { color: #f3fbf5; }
.brand span { color: #a4c1ad; }
.side-nav { scrollbar-color: #2a6447 transparent; }
.admin-shell .side-nav button { min-height: 45px; padding: 0 12px; border: 0; border-radius: 10px; color: #b7cdbd; background: transparent; }
.side-nav button .nav-icon { color: #8fb19b; }
.admin-shell .side-nav button:hover { color: #fff; background: rgb(255 255 255 / 8%); }
.admin-shell .side-nav button.active { color: #fff; background: linear-gradient(100deg, #176b43, #168356); box-shadow: inset 3px 0 0 #83e3a8, 0 7px 18px rgb(3 23 14 / 16%); }
.admin-shell .side-nav button.active .nav-label { color: #fff; }
.side-nav button.active .nav-icon { color: #a7f0bf; }
.side-nav button b { color: #105637; background: #c9f5d6; }
.nav-group-title { color: #8eaf9a; }
.sidebar-user { border-top-color: rgb(255 255 255 / 12%); }
.sidebar-user strong { color: #eef7f0; }
.sidebar-user span { color: #9ab6a3; }
.sidebar-user span i { background: #6de19b; box-shadow: 0 0 0 3px rgb(109 225 155 / 13%); }
.sidebar-user button { color: #b8d0c0; background: rgb(255 255 255 / 9%); cursor: pointer; }
.sidebar-user button:hover { color: #fff; background: rgb(255 255 255 / 16%); }
.avatar { color: #153f2a; background: linear-gradient(145deg, #c0f1d0, #52c47b); }
.workspace-header { background: rgb(255 255 255 / 78%); border-bottom-color: #e5ebf2; }
.workspace-header > div:first-child > span { color: #6d8294; }
.workspace-header h1 { color: #172a3d; }
.header-actions .live-status { color: #177445; background: #e5f8ec; }
.icon-button { box-shadow: 0 3px 9px rgb(34 54 74 / 5%); transition: transform .16s ease, box-shadow .16s ease; }
.icon-button:hover { transform: translateY(-1px); box-shadow: 0 6px 15px rgb(34 54 74 / 10%); }
.users-card { background: linear-gradient(135deg, #fff 54%, #f0f8ff) !important; border-color: #dfedfb; }
.balance-card { background: linear-gradient(135deg, #fff 54%, #eefaf3) !important; border-color: #dcefe3; }
.request-card { background: linear-gradient(135deg, #fff 54%, #fff7eb) !important; border-color: #f4e7d2; }
.kyc-card { background: linear-gradient(135deg, #fff 54%, #f5f1ff) !important; border-color: #e7e0fb; }
.users-card .stat-icon { color: #2672c9; background: linear-gradient(145deg, #eaf5ff, #d9eaff); }
.balance-card .stat-icon { color: #128552; background: linear-gradient(145deg, #e7f8ee, #d3f0de); }
.request-card .stat-icon { color: #b77813; background: linear-gradient(145deg, #fff3dc, #ffe9bf); }
.kyc-card .stat-icon { color: #7354c9; background: linear-gradient(145deg, #f1ebff, #e4d9ff); }
.panel, .overview-panel { border-color: #e5ebf2; box-shadow: 0 10px 28px rgb(33 55 78 / 5%); }
.panel h2, .panel h3 { color: #20354a; }
.panel-heading p { color: #7d8d9c; }
.row, .kyc-row, .activity-row, .ticket-row { border-color: #e7edf3; border-radius: 12px; background: #fcfdff; transition: border-color .16s ease, background .16s ease, box-shadow .16s ease; }
.row:hover, .kyc-row:hover, .activity-row:hover { border-color: #cfe0ee; background: #f8fbff; box-shadow: 0 5px 16px rgb(34 70 102 / 5%); }
.row strong, .kyc-row strong, .ticket-copy strong, .activity-row strong { color: #20354a; }
.row span, .kyc-row span, .activity-row span, .activity-row time, .ticket-copy span { color: #718497; }
.toolbar input, .toolbar select, .result-form input, .result-form select, .ticket-row select, .settings-form input, .settings-form textarea, .settings-form select { border-color: #dce5ed; transition: border-color .16s ease, box-shadow .16s ease; }
.toolbar input:focus, .toolbar select:focus, .result-form input:focus, .result-form select:focus, .ticket-row select:focus, .settings-form input:focus, .settings-form textarea:focus, .settings-form select:focus { border-color: #5aa8dc; box-shadow: 0 0 0 3px rgb(55 145 206 / 12%); outline: none; }
.row button, .kyc-row button, .documents button, .result-form button, .ticket-row button, .quick-actions button { background: linear-gradient(135deg, #18aa70, #087b55) !important; box-shadow: 0 4px 11px rgb(8 123 75 / 14%); transition: transform .15s ease, box-shadow .15s ease, filter .15s ease; }
.row button:hover, .kyc-row button:hover, .documents button:hover, .result-form button:hover, .ticket-row button:hover, .quick-actions button:hover { transform: translateY(-1px); box-shadow: 0 7px 15px rgb(8 123 75 / 20%); filter: saturate(1.08); }
.row .reject, .kyc-row .reject, .actions .reject, .reject { color: #fff; background: linear-gradient(135deg, #ed7770, #c54652) !important; box-shadow: 0 4px 11px rgb(197 70 82 / 14%); }
.row .reject:hover, .kyc-row .reject:hover, .actions .reject:hover, .reject:hover { box-shadow: 0 7px 15px rgb(197 70 82 / 22%); }
.secondary { color: #fff !important; background: linear-gradient(135deg, #647feb, #5362c9) !important; box-shadow: 0 4px 11px rgb(83 98 201 / 15%); }
.secondary:hover { filter: saturate(1.1); }
.export-button { color: #526a7d !important; background: linear-gradient(135deg, #fff, #f3f8fc) !important; }
.pending { color: #95620e; background: #fff1d2; }
.approved, .verified { color: #157247; background: #dcf5e6; }
.rejected { color: #ae3947; background: #fde4e4; }
.pending, .approved, .rejected, .verified { width: fit-content; padding: 6px 9px; border-radius: 999px; font-size: 10px; font-weight: 800; }
.empty { padding: 18px 12px; border: 1px dashed #dce6ee; border-radius: 12px; color: #718497; background: #f8fbfd; }
.agent-admin-block { border-top-color: #e4ebf1; }
.agent-admin-block h3 span { color: #5362c9; background: #eef0ff; }
.overview-welcome { border-color: #dbeee2; background: radial-gradient(ellipse at 88% 5%, rgb(69 133 245 / 10%), transparent 33%), radial-gradient(ellipse at 3% 100%, rgb(38 181 121 / 10%), transparent 38%), linear-gradient(115deg, #fff 0%, #f5fbf7 100%); }
.overview-eyebrow { color: #137e91; }
.overview-queue-total { border-color: #f0dfbd; color: #91611a; background: linear-gradient(120deg, #fff8e9, #fff1d3); }
.overview-action-icon.deposit { color: #147d63; background: linear-gradient(145deg, #e4f8ef, #ccefe0); }
.overview-action-icon.verification { color: #7053c7; background: linear-gradient(145deg, #f0ebff, #e1d8ff); }
.overview-action-icon.referral { color: #c14277; background: linear-gradient(145deg, #fff0f6, #ffdeeb); }
.overview-action-icon.agents { color: #4359a6; background: linear-gradient(145deg, #eef1ff, #dce3ff); }
.overview-action-icon.support { color: #117d8b; background: linear-gradient(145deg, #e6f8fa, #d1eff2); }
.overview-action-card > b { color: #354c5d; background: #edf3f7; }
.overview-secondary-row > span svg { color: #159a66; }
.side-nav button:focus-visible, .overview-refresh:focus-visible, .overview-action-card:focus-visible, .quick-actions button:focus-visible, .row button:focus-visible, .kyc-row button:focus-visible, .secondary:focus-visible { outline: 3px solid rgb(73 150 215 / 35%); outline-offset: 2px; }
@media (max-width: 700px) {
  .sidebar { border-top-color: #1d563b; background: linear-gradient(90deg, #103a29, #0b2f22); box-shadow: 0 -8px 24px rgb(5 33 22 / 16%); }
  .admin-shell .side-nav button { padding: 0 6px; }
  .admin-shell .side-nav button.active { background: linear-gradient(180deg, #176b43, #168356); }
  .workspace-header { background: rgb(255 255 255 / 92%); }
}
.admin-shell .workspace { background: radial-gradient(ellipse at 92% 10%, rgb(91 131 231 / 7%), transparent 26%), radial-gradient(ellipse at 5% 38%, rgb(27 174 118 / 5%), transparent 24%), #f5f8fc; }
.admin-shell .workspace-header { min-height: 104px; padding: 0 4px; background: linear-gradient(110deg, rgb(255 255 255 / 96%), rgb(247 251 255 / 92%)); }
.admin-shell .workspace-header h1 { font-size: clamp(21px, 2vw, 26px); font-weight: 780; letter-spacing: -.75px; }
.admin-shell .workspace-header > div:first-child > span { color: #438d8a; }
.admin-shell .workspace-header .header-actions { padding: 8px 10px; border: 1px solid #e5edf5; border-radius: 12px; background: rgb(255 255 255 / 82%); box-shadow: 0 4px 14px rgb(37 69 98 / 4%); }
.admin-shell .workspace-header .icon-button { border-color: #dce7f1 !important; color: #52718d !important; }
.admin-shell .workspace .panel,
.admin-shell .workspace .overview-panel {
  position: relative;
  border: 1px solid #e1eaf2;
  border-top: 3px solid #80c4b0;
  border-radius: 17px;
  background:
    radial-gradient(ellipse at 100% 0%, rgb(104 151 230 / 7%), transparent 29%),
    linear-gradient(145deg, #fff 0%, #fff 58%, #fbfdff 100%);
  box-shadow: 0 12px 30px rgb(39 71 102 / 6%), 0 2px 6px rgb(39 71 102 / 3%);
}
.admin-shell .workspace .panel h2,
.admin-shell .workspace .panel h3 { color: #20374c; letter-spacing: -.25px; }
.admin-shell .workspace .panel > h2 { margin: 0 0 4px; padding-bottom: 12px; border-bottom: 1px solid #e9eff5; }
.admin-shell .workspace .panel-heading { gap: 16px; }
.admin-shell .workspace .panel-heading h2,
.admin-shell .workspace .panel-heading h3 { position: relative; }
.admin-shell .workspace .panel-heading > div > p { max-width: 740px; color: #74879a; line-height: 1.55; }
.admin-shell .workspace .game-management-panel { gap: 20px; }
.admin-shell .workspace .game-management-panel > .panel-heading {
  margin: -20px -20px 0;
  padding: 18px 20px;
  border-bottom: 1px solid #e7eef5;
  border-radius: 14px 14px 0 0;
  background: linear-gradient(110deg, #f7fbff, #f5fbf8 70%, #fbf8ff);
}
.admin-shell .workspace .game-management-panel > .panel-heading h2 { color: #1f3a50; font-size: 18px; }
.admin-shell .workspace .game-stats-grid { gap: 11px; }
.admin-shell .workspace .game-stats-grid .stat-card {
  min-height: 96px;
  border-color: #e5edf4;
  border-radius: 13px;
  background: linear-gradient(145deg, #fff, #f8fbff);
  box-shadow: 0 5px 16px rgb(38 69 98 / 4%);
}
.admin-shell .workspace .game-stats-grid .stat-card:nth-child(2) { border-color: #dcefe5; background: linear-gradient(145deg, #fff, #f4fbf7); }
.admin-shell .workspace .game-stats-grid .stat-card:nth-child(3) { border-color: #e7e1fb; background: linear-gradient(145deg, #fff, #f8f6ff); }
.admin-shell .workspace .game-stats-grid .stat-card:nth-child(4) { border-color: #f3e7d5; background: linear-gradient(145deg, #fff, #fffaf3); }
.admin-shell .workspace .game-management-block {
  gap: 13px;
  padding: 17px;
  border: 1px solid #e7edf4;
  border-top: 2px solid #b8d9eb;
  border-radius: 14px;
  background: linear-gradient(145deg, #fff 0%, #fff 65%, #f8fbff 100%);
  box-shadow: 0 5px 18px rgb(39 71 102 / 3%);
}
.admin-shell .workspace .game-management-block:nth-of-type(3) { border-top-color: #a9dec1; }
.admin-shell .workspace .game-management-block:nth-of-type(4) { border-top-color: #c8b9ef; }
.admin-shell .workspace .game-management-block > .panel-heading { align-items: flex-start; }
.admin-shell .workspace .game-management-block h3 { color: #26445c; font-size: 14px; }
.admin-shell .workspace .provider-api-status { border: 1px solid #f0dfbb; background: linear-gradient(135deg, #fff9eb, #fff2d6); }
.admin-shell .workspace .provider-api-status.configured { border-color: #ccebd8; color: #13744a; background: linear-gradient(135deg, #effbf3, #ddf5e6); }
.admin-shell .workspace .game-management-panel button { min-height: 36px; border-radius: 9px; font-family: inherit; font-size: 11px; font-weight: 750; line-height: 1.25; }
.admin-shell .workspace .game-management-panel button:disabled { filter: grayscale(.15); box-shadow: none; }
.admin-shell .workspace .game-provider-add button,
.admin-shell .workspace .provider-game-selection > button,
.admin-shell .workspace .game-management-panel .game-actions button:not(.reject) {
  border: 1px solid #138457;
  color: #fff;
  background: linear-gradient(135deg, #1ca96f, #087752);
  box-shadow: 0 4px 11px rgb(8 123 75 / 14%);
}
.admin-shell .workspace .game-management-panel .secondary {
  min-height: 36px;
  padding: 0 13px;
  border: 1px solid #cbd9fa !important;
  color: #4257a7 !important;
  background: linear-gradient(135deg, #f7f8ff, #e9edff) !important;
  box-shadow: 0 3px 9px rgb(83 98 201 / 8%);
}
.admin-shell .workspace .game-management-panel .secondary:hover { border-color: #aebef2 !important; background: linear-gradient(135deg, #eef1ff, #dfe5ff) !important; }
.admin-shell .workspace .game-management-panel .game-actions .reject { border: 1px solid #e9c2c6; }
.admin-shell .workspace .game-management-panel input:not([type="checkbox"]):not([type="file"]),
.admin-shell .workspace .game-management-panel select,
.admin-shell .workspace .game-management-panel textarea,
.admin-shell .workspace .catalog-page-size input {
  border-color: #dce6ee;
  border-radius: 9px;
  color: #30475b;
  background-color: #fff;
  box-shadow: inset 0 1px 2px rgb(31 56 78 / 3%);
}
.admin-shell .workspace .game-management-panel input:focus,
.admin-shell .workspace .game-management-panel select:focus,
.admin-shell .workspace .catalog-page-size input:focus { border-color: #73b5d3; box-shadow: 0 0 0 3px rgb(73 164 193 / 12%); outline: none; }
.admin-shell .workspace .game-management-table-wrap { border-color: #e0e9f1; box-shadow: 0 4px 14px rgb(35 68 98 / 3%); }
.admin-shell .workspace .game-management-table th { color: #536e84; background: linear-gradient(100deg, #eff6fc, #f3f8f6); }
.admin-shell .workspace .game-management-table td { border-top-color: #e9eff4; }
.admin-shell .workspace .game-management-table tbody tr:nth-child(even) { background: #fbfdff; }
.admin-shell .workspace .game-management-table tbody tr:hover { background: #f1f8fc; }
.admin-shell .workspace .game-provider-row { border-color: #e3ebf2; background: linear-gradient(110deg, #fff, #f8fbfd); }
.admin-shell .workspace .provider-game-list { border-color: #e3ebf2; background: #fbfdff; }
.admin-shell .workspace .game-bulk-toolbar { padding: 10px 12px; border: 1px solid #e4ecf3; border-radius: 11px; background: linear-gradient(100deg, #f8fbfd, #f5f9ff); }
.admin-shell .workspace .overview-panel { border-top-color: #91b6ea; }
.admin-shell .workspace .overview-action-card { border-color: #e2eaf2; background: linear-gradient(140deg, #fff, #fbfdff); }
.admin-shell .workspace .overview-action-card:hover { border-color: #b7d7e7; background: linear-gradient(140deg, #fff, #f4faf9); }
.admin-shell .workspace .overview-action-copy strong { color: #274158; }
@media (max-width: 700px) {
  .admin-shell .workspace { background: radial-gradient(ellipse at 92% 5%, rgb(91 131 231 / 7%), transparent 30%), #f5f8fc; }
  .admin-shell .workspace-header { min-height: 72px; padding: 0; }
  .admin-shell .workspace .game-management-panel > .panel-heading { margin: -12px -12px 0; padding: 15px 12px; }
  .admin-shell .workspace .game-management-block { padding: 12px; }
}
.admin-shell .workspace {
  min-width: 0;
  min-height: 100vh;
  overflow: visible;
}
.admin-shell .sidebar {
  height: 100vh;
  height: 100dvh;
}
.admin-shell .side-nav {
  padding: 2px 3px;
  overscroll-behavior: contain;
}
.admin-shell .nav-group {
  padding-top: 7px;
}
.admin-shell .nav-group + .nav-group {
  border-top: 1px solid rgb(255 255 255 / 7%);
}
.admin-shell .nav-group-title {
  padding: 0 12px;
  font-size: 9px;
  line-height: 1.4;
}
.admin-shell .side-nav button {
  min-height: 43px;
  border-radius: 9px;
}
.admin-shell .side-nav button .nav-icon {
  stroke-width: 1.9;
}
.admin-shell .workspace-header {
  position: sticky;
  z-index: 15;
  top: 0;
  min-height: 88px;
  backdrop-filter: blur(14px);
  box-shadow: 0 5px 18px rgb(34 54 74 / 3%);
}
.admin-shell .workspace-header .header-actions {
  gap: 9px;
}
.admin-shell .workspace-header .live-status {
  min-height: 30px;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid #d5efdf;
}
.admin-shell .workspace-header .live-status i {
  box-shadow: 0 0 0 3px rgb(32 185 111 / 12%);
}
.admin-shell .overview-welcome {
  margin-top: 18px;
}
.admin-shell .workspace .overview-action-card {
  min-height: 82px;
  padding: 13px;
}
.admin-shell .workspace .overview-queue-total {
  border-color: #e2eaf0;
  color: #607789;
  background: #f5f8fb;
}
.admin-shell .workspace .overview-queue-total.queue-clear {
  border-color: #cfe9d9;
  color: #167447;
  background: #eff9f2;
}
.admin-shell .workspace .users-toolbar {
  grid-template-columns: minmax(200px, 1.5fr) repeat(4, minmax(125px, 1fr));
  gap: 9px;
  margin: 18px 0 12px;
}
.admin-shell .workspace .users-toolbar input,
.admin-shell .workspace .users-toolbar select {
  min-width: 0;
  height: 42px;
  border-color: #dce5ed;
  border-radius: 10px;
  color: #30475b;
  background: #fff;
}
.admin-shell .workspace .user-result-count {
  border-color: #e2eaf0;
  color: #607789;
  background: #f7fafc;
}
.admin-shell .workspace .row button,
.admin-shell .workspace .kyc-row button,
.admin-shell .workspace .documents button,
.admin-shell .workspace .ticket-row button {
  min-height: 38px;
  height: auto;
  padding: 0 12px;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 700;
}
.admin-shell .workspace .panel-heading {
  align-items: flex-start;
  gap: 14px;
}
.admin-shell .workspace .panel-heading h2 {
  margin: 0;
  font-size: 17px;
  line-height: 1.35;
}
.admin-shell .workspace .panel-heading p {
  max-width: 68ch;
  margin-top: 5px;
  line-height: 1.55;
}
.admin-shell button:focus-visible,
.admin-shell a:focus-visible,
.admin-shell input:focus-visible,
.admin-shell select:focus-visible,
.admin-shell textarea:focus-visible {
  outline: 3px solid rgb(73 150 215 / 35%);
  outline-offset: 2px;
}
.admin-login .login-card {
  max-width: 430px;
  border-color: #e2ebe5;
  background: rgb(255 255 255 / 96%);
  box-shadow: 0 24px 70px rgb(30 67 48 / 10%);
}
.admin-login .login-card button:disabled {
  cursor: wait;
  opacity: .7;
}
.admin-login .login-error {
  padding: 10px 12px;
  border: 1px solid #f0d4d4;
  border-radius: 9px;
  background: #fff6f6;
}
@media (max-width: 1100px) {
  .admin-shell .workspace .users-toolbar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .admin-shell .workspace .users-toolbar input {
    grid-column: 1 / -1;
  }
}
@media (max-width: 700px) {
  .admin-shell .sidebar {
    height: calc(68px + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
  }
  .admin-shell .side-nav {
    height: 54px;
    padding: 0;
  }
  .admin-shell .side-nav button {
    min-height: 54px;
    border-radius: 10px;
    scroll-snap-align: center;
  }
  .admin-shell .workspace-header {
    min-height: 72px;
    backdrop-filter: blur(12px);
  }
  .admin-shell .workspace .overview-action-card {
    min-height: 72px;
    padding: 10px;
  }
  .admin-shell .workspace .users-toolbar {
    grid-template-columns: 1fr;
  }
  .admin-shell .workspace .users-toolbar input {
    grid-column: auto;
  }
  .admin-shell .workspace .panel-heading {
    align-items: flex-start;
  }
}
@media (prefers-reduced-motion: reduce) {
  .admin-shell *,
  .admin-login * {
    scroll-behavior: auto !important;
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
</style>
