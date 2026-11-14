<template>
  <div class="page-frame" :class="[`page-${currentPage}`, { 'game-active': currentPage === 'games' && Boolean(activeGame), 'deposit-active': (currentPage === 'wallet' || (currentPage === 'account' && profileSection === 'wallet')) && signedIn && walletRequestType === 'deposit' }]">
    <PublicHeader
      :logo="b9Logo"
      :balance-label="signedIn ? `${currencyLabel} ${formatMoney(balance)}` : '--'"
      @open-menu="modal = 'menu'"
      @home="navigateTo('/')"
      @deposit="navigateTo('/wallet')"
      @toggle-search="toggleGameSearch"
    />
    <nav class="desktop-nav" aria-label="Main navigation">
      <button v-for="item in pageLinks" :key="item.path" :class="{ active: route.path === item.path }" @click="navigateTo(item.path)">
        {{ item.label }}
      </button>
      <button v-if="!signedIn" class="desktop-auth" @click="showAuth">Sign in</button>
      <button v-else class="desktop-auth" @click="toggleSignIn">Sign out</button>
    </nav>

    <main class="content">
      <template v-if="currentPage === 'home'">
      <section
        v-if="homepageBanner.active && homepageBanner.imageUrl"
        class="homepage-custom-banner"
        :class="{ 'homepage-custom-banner--creative': homepageBanner.bannerIncludesText }"
        aria-label="Homepage banner"
      >
        <img class="homepage-custom-banner-image" :src="homepageBanner.imageUrl" alt="" loading="eager" fetchpriority="high" decoding="async" />
        <div v-if="!homepageBanner.bannerIncludesText" class="homepage-custom-banner-copy">
          <h2>{{ homepageBanner.title || "Welcome to B9 Games" }}</h2>
          <p v-if="homepageBanner.description">{{ homepageBanner.description }}</p>
          <button v-if="homepageBanner.buttonLink" class="homepage-custom-banner-button" @click="navigateTo(homepageBanner.buttonLink)">
            {{ homepageBanner.buttonLabel || "Explore games" }}
          </button>
        </div>
        <button
          v-else-if="homepageBanner.buttonLink"
          type="button"
          class="homepage-custom-banner-full-link"
          :aria-label="homepageBanner.buttonLabel || homepageBanner.title || 'Explore B9 Games'"
          @click="navigateTo(homepageBanner.buttonLink)"
        ></button>
      </section>

      <BonusBanner
        v-else
        :slides="bannerSlides"
        :active-index="homeBannerIndex"
        @claim="navigateTo('/wallet')"
        @navigate="navigateTo"
        @slide-change="changeBannerSlide"
      />
      <section v-if="maintenanceMode" class="maintenance-banner" role="status">
        Scheduled maintenance is active. Transactions and support may experience delays.
      </section>

      <section class="jackpot" aria-label="Jackpot">
        <img :src="jackpotBanner" alt="JACKPOT" class="jackpot-banner" />
        <div class="jackpot-value">{{ jackpot.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</div>
      </section>

      <section class="announcement" aria-label="Latest announcement">
        <Volume2 class="announcement-volume" :size="20" :stroke-width="2.6" />
        <p>{{ platformAnnouncement }}</p>
        <button class="inbox-button" :aria-label="unreadCount ? `Open notifications, ${unreadCount} unread` : 'Open notifications'" @click="openInbox">
          <Bell :size="23" />
          <span v-if="unreadCount > 0" class="inbox-badge">{{ unreadCount > 99 ? "99+" : unreadCount }}</span>
        </button>
      </section>

      <nav class="categories" aria-label="Game categories">
        <button class="category-arrow" aria-label="Scroll categories left" @click="scrollCategories(-1)"><ChevronLeft :size="22" /></button>
        <div ref="homeCategoryList" class="category-list">
          <button
            v-for="category in homeCategoryItems"
            :key="category.label"
            type="button"
            class="category"
            :class="{ selected: homeSelectedCategory === category.label }"
            :aria-label="category.label"
            :aria-pressed="homeSelectedCategory === category.label"
            @click="selectHomeCategory(category.label)"
          >
            <span class="category-icon category-icon-brand">
              <img :src="category.logo" :alt="category.logoAlt" class="category-image" />
            </span>
            <span class="category-label">{{ category.label }}</span>
          </button>
        </div>
        <button class="category-arrow" aria-label="Scroll categories right" @click="scrollCategories(1)"><ChevronRight :size="22" /></button>
      </nav>

      <section class="game-category-sections home-game-sections" aria-label="Games by category">
        <article
          v-for="section in gameSections"
          :id="homeSectionId(section.category)"
          :key="section.category"
          class="game-category-section"
        >
          <header class="game-category-heading home-game-category-heading">
            <h2>
              <component :is="homeSectionIcon(section.category)" :size="21" aria-hidden="true" />
              {{ section.title }}
            </h2>
            <div class="home-game-category-actions">
              <button
                type="button"
                class="home-category-arrow"
                :aria-label="`Previous ${section.title} games`"
                @click="scrollHomeGameStrip(section.category, -1)"
              ><ChevronLeft :size="19" /></button>
              <button
                type="button"
                class="home-category-arrow"
                :aria-label="`Next ${section.title} games`"
                @click="scrollHomeGameStrip(section.category, 1)"
              ><ChevronRight :size="19" /></button>
              <button type="button" class="home-view-all" @click="showAllCategory(section.category)">
                View All
              </button>
            </div>
          </header>
          <div v-if="section.loading && section.games.length === 0" class="home-game-strip home-game-skeletons" role="status" :aria-label="`Loading ${section.title}`">
            <span v-for="index in 6" :key="index" class="home-game-skeleton"></span>
          </div>
          <div v-else-if="section.error" class="catalog-error" role="alert">
            <p>{{ section.error }}</p>
            <button type="button" @click="retryGameSection(section)">Try again</button>
          </div>
          <div
            v-else-if="section.games.length"
            :ref="(element) => setHomeGameStrip(section.category, element)"
            class="home-game-strip"
            :aria-label="section.title"
          >
            <article
              v-for="game in section.games"
              :key="game.id"
              class="game-card home-game-card"
              :class="{ 'game-unavailable': game.status !== 0, 'home-game-card-no-art': !game.thumbnail }"
              role="button"
              tabindex="0"
              :aria-label="game.status === 0 ? `Play ${game.name}` : `${game.name} unavailable`"
              :aria-disabled="game.status !== 0 || launchingGameId === game.id"
              @click="play(game)"
              @keydown.enter="play(game)"
              @keydown.space.prevent="play(game)"
            >
              <img v-if="game.thumbnail" :src="game.thumbnail" :alt="game.name" loading="lazy" decoding="async" />
              <div class="game-shade" />
              <span v-if="game.isPopular" class="home-popular-badge"><Flame :size="11" fill="currentColor" /> Hot</span>
              <span class="game-name">{{ launchingGameId === game.id ? "Opening..." : game.name }}</span>
              <span v-if="game.status !== 0" class="game-status">{{ game.status === 1 ? "Maintenance" : "Unavailable" }}</span>
              <button
                class="favorite-button"
                :aria-label="favorites.includes(game.id) ? 'Remove favorite' : 'Add favorite'"
                @click.stop="toggleFavorite(game.id)"
              ><Star :size="17" :fill="favorites.includes(game.id) ? 'currentColor' : 'none'" /></button>
            </article>
          </div>
          <p v-else class="empty-state">No active games are assigned to {{ section.title.toLowerCase() }}.</p>
          <div
            v-if="section.page > 0 && section.page < section.pageCount"
            :ref="(element) => observeHomeSectionSentinel(section.category, element)"
            class="home-section-load-sentinel"
            :data-game-category="section.category"
            aria-hidden="true"
          ></div>
          <div v-if="section.loading && section.games.length > 0" class="home-section-loading" role="status">
            <span class="loading-spinner" aria-hidden="true"></span>
            <span>Loading more games…</span>
          </div>
        </article>
      </section>

      <button
        v-if="showBackToTop"
        type="button"
        class="home-back-to-top"
        aria-label="Back to top"
        @click="scrollHomeToTop"
      ><ArrowUp :size="21" /></button>

      </template>

      <section v-if="currentPage === 'games' && activeGame" class="game-player">
        <div class="game-player-heading">
          <button type="button" class="game-back-button" :disabled="returningGameFunds" @click="closeGame">
            <ChevronLeft :size="18" />
            {{ returningGameFunds ? "Returning game funds…" : "Back to Games" }}
          </button>
          <div class="game-player-title">
            <span class="eyebrow">{{ activeGame.provider }}</span>
            <h1>{{ activeGame.name }}</h1>
          </div>
          <button type="button" class="game-fullscreen-button" @click="toggleGameFullscreen">
            {{ gameFullscreen ? "Exit fullscreen" : "Fullscreen" }}
          </button>
        </div>
        <div ref="gamePlayerFrame" class="game-player-frame">
          <iframe
            v-if="activeGameUrl"
            :src="activeGameUrl"
            :title="`${activeGame.name} game`"
            allow="autoplay; fullscreen; gamepad"
            allowfullscreen
            @load="handleGameFrameLoad"
            @error="handleGameFrameError"
          />
          <div v-if="gameFrameLoading" class="game-frame-status" role="status">
            <span class="loading-spinner" aria-hidden="true"></span>
            <span>Loading {{ activeGame.name }}…</span>
          </div>
          <div v-if="gameFrameError" class="game-frame-error" role="alert">
            <strong>Could not load the game here</strong>
            <p>{{ gameFrameError }}</p>
            <button type="button" class="primary-button" @click="openGameWithProvider">Open with HUIDU</button>
          </div>
        </div>
        <div class="game-player-help">
          <p>If the embedded game is blank or blocked, HUIDU’s documented launch method is to open its returned game URL directly.</p>
          <button v-if="!gameFrameError" type="button" class="game-provider-launch" @click="openGameWithProvider">Open with HUIDU</button>
        </div>
      </section>

      <section v-if="currentPage === 'games' && !activeGame" class="game-lobby">
        <section v-if="maintenanceMode" class="maintenance-banner" role="status">
          Scheduled maintenance is active. Transactions and support may experience delays.
        </section>
        <label class="game-lobby-search">
          <input ref="gameLobbySearchInput" v-model="query" type="search" placeholder="Search" aria-label="Search games" />
          <button v-if="query" type="button" aria-label="Clear search" @click="query = ''"><X :size="17" /></button>
          <Search :size="20" aria-hidden="true" />
        </label>
        <nav class="game-lobby-tabs" aria-label="Game filters" role="tablist">
          <button
            v-for="tab in gameLobbyTabs"
            :key="tab.id"
            type="button"
            role="tab"
            :aria-selected="gameLobbyTab === tab.id"
            :class="{ active: gameLobbyTab === tab.id }"
            @click="selectGameLobbyTab(tab.id)"
          >{{ tab.label }}</button>
        </nav>
        <div class="game-lobby-layout">
          <aside class="game-provider-sidebar" aria-label="Game providers">
            <p class="game-provider-sidebar-title">Providers</p>
            <button
              type="button"
              class="game-provider-option"
              :class="{ active: !selectedProvider }"
              aria-label="Show all providers"
              :aria-pressed="!selectedProvider"
              @click="selectGameProvider('')"
            >
              <span class="game-provider-logo game-provider-all"><Gamepad2 :size="21" /></span>
              <span>All</span>
            </button>
            <button
              v-for="provider in gameProviders"
              :key="provider.code"
              type="button"
              class="game-provider-option"
              :class="{ active: selectedProvider === provider.code }"
              :aria-label="`Show ${provider.name} games`"
              :aria-pressed="selectedProvider === provider.code"
              @click="selectGameProvider(provider.code)"
            >
              <span class="game-provider-logo" :class="{ 'game-provider-logo-dark': gameProviderLogoUsesDarkBackground(provider) }">
                <img v-if="gameProviderLogo(provider)" :src="gameProviderLogo(provider)" alt="" loading="lazy" decoding="async" />
                <Gamepad2 v-else :size="16" aria-hidden="true" />
              </span>
              <span>{{ provider.name }}</span>
            </button>
            <p v-if="!gameProviders.length" class="game-provider-empty">Providers appear when games are available.</p>
          </aside>
          <div class="game-lobby-main">
            <section v-if="showGameSections" class="game-category-sections lobby-category-sections" aria-label="Games by category">
              <article v-for="section in gameSections" :key="section.category" class="game-category-section">
                <header class="game-category-heading">
                  <h2><component :is="homeSectionIcon(section.category)" :size="20" />{{ section.title }}</h2>
                  <button type="button" :aria-label="`View all ${section.title.toLowerCase()}`" @click="showAllCategory(section.category)">
                    View All <ChevronRight :size="17" />
                  </button>
                </header>
                <p v-if="section.loading && !section.games.length" class="empty-state" role="status">Loading {{ section.title.toLowerCase() }}…</p>
                <div v-else-if="section.error" class="catalog-error" role="alert">
                  <p>{{ section.error }}</p>
                  <button type="button" @click="retryGameSection(section)">Try again</button>
                </div>
                <template v-else>
                  <div v-if="section.games.length" class="game-grid lobby-game-grid" :aria-label="section.title">
                    <article
                      v-for="game in section.games"
                      :key="game.id"
                      class="game-card lobby-game-card"
                      :class="{ 'game-unavailable': game.status !== 0, 'lobby-card-no-thumbnail': !game.thumbnail }"
                      role="button"
                      tabindex="0"
                      :aria-label="game.status === 0 ? `Play ${game.name}` : `${game.name} unavailable`"
                      :aria-disabled="game.status !== 0 || launchingGameId === game.id"
                      @click="play(game)"
                      @keydown.enter="play(game)"
                      @keydown.space.prevent="play(game)"
                    >
                      <img v-if="game.thumbnail" :src="game.thumbnail" :alt="game.name" loading="lazy" decoding="async" />
                      <span v-if="game.isPopular" class="lobby-hot-badge">Hot</span>
                      <span class="lobby-game-name">{{ launchingGameId === game.id ? "Opening..." : game.name }}</span>
                      <button class="favorite-button" :aria-label="favorites.includes(game.id) ? 'Remove favorite' : 'Add favorite'" @click.stop="toggleFavorite(game.id)">
                        <Star :size="17" :fill="favorites.includes(game.id) ? 'currentColor' : 'none'" />
                      </button>
                    </article>
                  </div>
                  <p v-else-if="!section.loading" class="game-lobby-empty">No enabled games in {{ section.title }}{{ selectedProvider ? " for this provider" : "" }}.</p>
                  <div
                    v-if="section.page > 0 && section.page < section.pageCount"
                    :ref="(element) => observeHomeSectionSentinel(section.category, element)"
                    class="home-section-load-sentinel"
                    :data-game-category="section.category"
                    aria-hidden="true"
                  ></div>
                  <div v-if="section.loading && section.games.length" class="home-section-loading" role="status">
                    <span class="loading-spinner" aria-hidden="true"></span> Loading more games…
                  </div>
                </template>
              </article>
            </section>
            <section v-else-if="showGameCatalog" class="game-lobby-results" aria-label="Games">
              <header class="game-lobby-results-heading">
                <h1>{{ query ? "Search results" : `${selectedCategory} Games` }}</h1>
                <span v-if="gameCatalogTotal">{{ gameCatalogTotal }} games</span>
              </header>
              <p v-if="gamesLoading && !games.length" class="game-lobby-empty" role="status">Loading enabled games…</p>
              <div v-else-if="gamesError" class="catalog-error" role="alert">
                <p>{{ gamesError }}</p>
                <button type="button" @click="loadGames">Try again</button>
              </div>
              <div v-else-if="games.length" class="game-grid lobby-game-grid">
                <article
                  v-for="game in games"
                  :key="game.id"
                  class="game-card lobby-game-card"
                  :class="{ 'game-unavailable': game.status !== 0, 'lobby-card-no-thumbnail': !game.thumbnail }"
                  role="button"
                  tabindex="0"
                  :aria-label="game.status === 0 ? `Play ${game.name}` : `${game.name} unavailable`"
                  :aria-disabled="game.status !== 0 || launchingGameId === game.id"
                  @click="play(game)"
                  @keydown.enter="play(game)"
                  @keydown.space.prevent="play(game)"
                >
                  <img v-if="game.thumbnail" :src="game.thumbnail" :alt="game.name" loading="lazy" decoding="async" />
                  <span v-if="game.isPopular" class="lobby-hot-badge">Hot</span>
                  <span class="lobby-game-name">{{ launchingGameId === game.id ? "Opening..." : game.name }}</span>
                  <button class="favorite-button" :aria-label="favorites.includes(game.id) ? 'Remove favorite' : 'Add favorite'" @click.stop="toggleFavorite(game.id)">
                    <Star :size="17" :fill="favorites.includes(game.id) ? 'currentColor' : 'none'" />
                  </button>
                </article>
              </div>
              <p v-else-if="!gamesLoading" class="game-lobby-empty">No enabled games match your filters.</p>
              <div v-if="gamesLoading && games.length" class="games-loading-more" role="status"><span class="loading-spinner" aria-hidden="true"></span> Loading more games…</div>
              <div v-if="!gamesLoading && !gamesError && hasMoreGames" ref="gamesLoadSentinel" class="games-load-sentinel" aria-hidden="true"></div>
              <div v-if="!gamesLoading && !gamesError && games.length > 0 && !hasMoreGames" class="games-end-message" role="status">You’ve reached the end of the game list.</div>
            </section>
            <section v-else class="game-lobby-results" :aria-label="gameLobbyTab === 'recent' ? 'Recently played games' : 'Favorite games'">
              <header class="game-lobby-results-heading">
                <h1>{{ gameLobbyTab === "recent" ? "Recently Played" : "Favorites" }}</h1>
                <span>{{ filteredLobbyGames.length }} games</span>
              </header>
              <div v-if="filteredLobbyGames.length" class="game-grid lobby-game-grid">
                <article
                  v-for="game in filteredLobbyGames"
                  :key="game.id"
                  class="game-card lobby-game-card"
                  :class="{ 'game-unavailable': game.status !== 0, 'lobby-card-no-thumbnail': !game.thumbnail }"
                  role="button"
                  tabindex="0"
                  :aria-label="game.status === 0 ? `Play ${game.name}` : `${game.name} unavailable`"
                  :aria-disabled="game.status !== 0 || launchingGameId === game.id"
                  @click="play(game)"
                  @keydown.enter="play(game)"
                  @keydown.space.prevent="play(game)"
                >
                  <img v-if="game.thumbnail" :src="game.thumbnail" :alt="game.name" loading="lazy" decoding="async" />
                  <span v-if="game.isPopular" class="lobby-hot-badge">Hot</span>
                  <span class="lobby-game-name">{{ game.name }}</span>
                  <button class="favorite-button" :aria-label="favorites.includes(game.id) ? 'Remove favorite' : 'Add favorite'" @click.stop="toggleFavorite(game.id)">
                    <Star :size="17" :fill="favorites.includes(game.id) ? 'currentColor' : 'none'" />
                  </button>
                </article>
              </div>
              <p v-else class="game-lobby-empty">{{ query || selectedProvider ? "No games match your filters." : gameLobbyTab === "recent" ? "Games you play will appear here." : "Tap a star on a game to add it to Favorites." }}</p>
            </section>
          </div>
        </div>
      </section>

      <section v-else-if="currentPage === 'promotions'" class="page-section promotions-page">
        <div v-if="!signedIn" class="signed-out-card">
          <Gift :size="30" />
          <h2>Sign in to view promotions</h2>
          <p>Member offers are available to signed-in users and may have eligibility requirements.</p>
          <button class="primary-button" @click="showAuth">Sign in</button>
        </div>
        <p v-else-if="promotionsLoading" class="empty-state">Loading offers...</p>
        <p v-else-if="promotionsError" class="empty-state">{{ promotionsError }}</p>
        <template v-else>
          <article v-if="activePromotions[0]" class="promotion-feature-card">
            <span class="promotion-feature-icon"><Gift :size="20" /></span>
            <div class="promotion-feature-copy">
              <span>FEATURED OFFER</span>
              <strong>{{ activePromotions[0].title }}</strong>
              <small>{{ activePromotions[0].description || activePromotions[0].reward || "Review the offer terms for details." }}</small>
            </div>
            <button type="button" class="promotion-feature-action" @click="openPromotionAction(activePromotions[0])">
              {{ promotionMentionsDeposit(activePromotions[0]) ? "Deposit now" : "Ask about offer" }}
              <ChevronRight :size="16" />
            </button>
          </article>

          <nav class="promotion-filter-tabs" aria-label="Filter promotions">
            <button type="button" :class="{ active: promotionFilter === 'all' }" :aria-pressed="promotionFilter === 'all'" @click="promotionFilter = 'all'">
              All offers <span>{{ activePromotions.length }}</span>
            </button>
            <button type="button" :class="{ active: promotionFilter === 'deposit' }" :aria-pressed="promotionFilter === 'deposit'" @click="promotionFilter = 'deposit'">
              Deposit offers <span>{{ depositPromotions.length }}</span>
            </button>
            <button type="button" :class="{ active: promotionFilter === 'other' }" :aria-pressed="promotionFilter === 'other'" @click="promotionFilter = 'other'">
              Other offers <span>{{ otherPromotions.length }}</span>
            </button>
          </nav>

          <div v-if="visiblePromotions.length" class="promotion-grid">
            <article v-for="(promotion, index) in visiblePromotions" :key="promotion.id" class="promotion-banner" :class="{ 'promotion-full-creative': promotion.bannerIncludesText && promotion.bannerUrl }">
              <template v-if="promotion.bannerIncludesText && promotion.bannerUrl">
                <button class="promotion-complete-link" :aria-label="`Ask about ${promotion.title}`" @click="askAboutPromotion(promotion)">
                  <img class="promotion-banner-complete" :src="promotion.bannerUrl" alt="" :loading="index === 0 ? 'eager' : 'lazy'" decoding="async" />
                </button>
                <div class="promotion-full-details">
                  <h2>{{ promotion.title }}</h2>
                  <p v-if="promotion.description">{{ promotion.description }}</p>
                  <p v-if="promotion.terms" class="promotion-terms">{{ promotion.terms }}</p>
                  <button class="primary-button" @click="askAboutPromotion(promotion)">Ask about this offer</button>
                </div>
              </template>
              <template v-else>
                <img v-if="promotion.bannerUrl" class="promotion-banner-art" :src="promotion.bannerUrl" alt="" :loading="index === 0 ? 'eager' : 'lazy'" decoding="async" />
                <div class="promotion-banner-copy">
                  <span class="promotion-number">ACTIVE OFFER {{ String(index + 1).padStart(2, "0") }}</span>
                  <span v-if="promotion.reward" class="promotion-value">{{ promotion.reward }}</span>
                  <h2>{{ promotion.title }}</h2>
                  <p v-if="promotion.description">{{ promotion.description }}</p>
                  <p v-if="promotion.terms" class="promotion-terms">{{ promotion.terms }}</p>
                  <button class="primary-button" @click="askAboutPromotion(promotion)">Ask about this offer</button>
                </div>
              </template>
            </article>
          </div>
          <p v-else-if="activePromotions.length === 0" class="empty-state">There are no active offers right now.</p>
          <p v-else class="empty-state">There are no {{ promotionFilter === "deposit" ? "deposit" : "other" }} offers right now.</p>

          <button type="button" class="promotion-rewards-link" @click="navigateTo('/rewards')">
            <span class="promotion-rewards-icon"><BadgeCheck :size="20" /></span>
            <span><strong>VIP &amp; daily rewards</strong><small>Check your tier, daily streak, and rewards</small></span>
            <ChevronRight :size="19" />
          </button>

        </template>
      </section>

      <section v-else-if="currentPage === 'wallet' || (currentPage === 'account' && ['wallet', 'withdrawal'].includes(profileSection))" class="page-section wallet-page">
        <nav class="profile-tabs" aria-label="Wallet sections" role="tablist">
          <button type="button" role="tab" :aria-selected="profileSection === 'withdrawal'" :class="{ active: profileSection === 'withdrawal' }" @click="selectAccountSection('withdrawal')"><ArrowDownLeft :size="16" />Withdraw</button>
          <button type="button" role="tab" :aria-selected="profileSection === 'wallet'" :class="{ active: profileSection === 'wallet' }" @click="selectAccountSection('wallet')"><Wallet :size="16" />Wallet</button>
        </nav>
        <div v-if="!signedIn" class="signed-out-card">
          <Wallet :size="30" />
          <h2>Sign in to manage your wallet</h2>
          <p>Your balance and payment activity are available after signing in.</p>
          <button class="primary-button" @click="showAuth">Sign in</button>
        </div>
        <template v-else>
          <section class="wallet-balance-card" aria-label="Wallet balances">
            <div class="wallet-balance-main">
              <span class="wallet-balance-label">Main wallet</span>
              <strong class="wallet-balance-value">{{ currencyLabel }} {{ formatAmount(balance) }}</strong>
              <span class="wallet-balance-note">Available to deposit into games or withdraw</span>
            </div>
            <div class="wallet-balance-split">
              <div class="wallet-balance-sub">
                <span class="wallet-balance-label">Game wallet</span>
                <strong>{{ gameWalletLoading ? "Checking…" : `${gameWalletDisplayCurrency} ${formatAmount(gameWalletBalance)}` }}</strong>
                <small>Winnings stay here until you move them back</small>
              </div>
              <button class="wallet-transfer-button" :disabled="gameWalletLoading || returningGameFunds" @click="returnGameFunds">
                <ArrowDownLeft :size="16" />
                {{ returningGameFunds ? "Returning…" : "Move to Main Wallet" }}
              </button>
            </div>
          </section>

          <section class="wallet-workspace" :class="{ 'wallet-deposit-workspace': walletRequestType === 'deposit' }">
            <header class="wallet-workspace-heading">
              <div class="wallet-payment-title">
                <button type="button" class="wallet-back-button" aria-label="Back to account" @click="navigateTo('/account')"><ChevronLeft :size="19" /></button>
                <h2>{{ walletRequestType === "deposit" ? "Deposit" : "Withdraw" }}</h2>
              </div>
            </header>
            <p v-if="walletKycVerified && walletRequestType === 'withdrawal'" class="wallet-hint">Requests are reviewed by an administrator before your balance changes.</p>
            <div v-if="!walletKycVerified" class="wallet-kyc-gate" role="status">
              <ShieldCheck :size="22" />
              <div>
                <strong>Identity verification required</strong>
                <p v-if="user?.kycStatus === 'pending'">Your documents are under review. Deposits and withdrawals will be available after an administrator verifies your identity.</p>
                <p v-else-if="user?.kycStatus === 'rejected'">Your previous submission was not approved. Update your documents and submit them again to enable deposits and withdrawals.</p>
                <p v-else>Complete identity verification and wait for administrator approval before making deposits or withdrawals.</p>
              </div>
              <button v-if="user?.kycStatus !== 'pending'" type="button" class="wallet-kyc-button" @click="openKyc">
                {{ user?.kycStatus === 'rejected' ? 'Resubmit KYC' : 'Verify identity' }}
                <ChevronRight :size="15" />
              </button>
              <span v-else class="wallet-kyc-pending">Under review</span>
            </div>

            <template v-if="walletKycVerified">
            <section v-if="walletRequestType === 'deposit'" class="wallet-deposit-methods" aria-label="Payment method">
              <span class="wallet-field-label">Payment method</span>
              <div v-if="depositPaymentMethods.length" class="wallet-deposit-method-options">
                <button
                  v-for="method in depositPaymentMethods"
                  :key="method"
                  type="button"
                  :aria-pressed="selectedDepositMethod === method"
                  :class="{ chosen: selectedDepositMethod === method }"
                  @click="selectDepositPaymentMethod(method)"
                >
                  <img class="wallet-provider-logo" :src="method === 'PhonePe' ? phonePeLogo : paytmLogo" :alt="`${method} logo`" />
                  <span>{{ method }}</span>
                </button>
              </div>
            </section>

            <section v-if="walletRequestType === 'deposit'" class="wallet-deposit-channel" aria-label="Payment channel">
              <span class="wallet-field-label">Payment channel</span>
              <button type="button" class="wallet-deposit-channel-chip" :aria-expanded="showDepositPaymentDetails" @click="showDepositPaymentDetails = !showDepositPaymentDetails">
                <Check :size="15" />{{ selectedDepositMethod }} QR<ChevronRight :size="15" />
              </button>
            </section>

            <section v-if="walletRequestType === 'deposit' && showDepositPaymentDetails" class="wallet-deposit-details">
              <span class="wallet-field-label">Transfer to these details</span>
              <div class="wallet-payment-card deposit-payment-card">
                <div class="wallet-payment-heading">
                  <span class="wallet-payment-icon"><Landmark :size="19" /></span>
                  <div>
                    <strong>{{ paymentDetails.bankName }}</strong>
                    <small>Send your payment to the details below.</small>
                  </div>
                </div>
                <dl v-if="paymentDetailRows().length" class="wallet-payment-rows">
                  <div v-for="row in paymentDetailRows()" :key="row.label" class="wallet-payment-row">
                    <dt>{{ row.label }}</dt>
                    <dd>
                      <span>{{ row.value }}</span>
                      <button type="button" class="wallet-copy-button" :aria-label="`Copy ${row.label}`" @click="copyField(row.label, row.value)">
                        <Check v-if="copiedField === row.label" :size="14" />
                        <Copy v-else :size="14" />
                      </button>
                    </dd>
                  </div>
                </dl>
                <p v-else class="wallet-payment-empty">Bank, UPI, and wallet details are not configured yet.</p>
                <p v-if="paymentDetails.instructions" class="wallet-payment-instructions">{{ paymentDetails.instructions }}</p>
              </div>
            </section>

            <form class="wallet-form" :class="{ 'wallet-deposit-form': walletRequestType === 'deposit' }" novalidate @submit.prevent="submitWalletRequest">
              <div class="wallet-field" :class="{ 'wallet-deposit-amount': walletRequestType === 'deposit' }">
                <span class="wallet-field-label">{{ walletRequestType === 'deposit' ? `Deposit amount (${currencyLabel})` : `Amount (${currencyLabel})` }}</span>
                <div class="amount-options">
                  <button v-for="preset in (walletRequestType === 'deposit' ? [100, 300, 500, 1000, 2000, 5000, 10000, 20000, 30000, 50000] : [500, 1000, 5000, 10000])" :key="preset" type="button" :aria-pressed="amount === String(preset)" :class="{ chosen: amount === String(preset) }" @click="amount = String(preset)">
                    {{ preset.toLocaleString() }}
                  </button>
                </div>
                <label class="wallet-input-shell">
                  <span class="wallet-input-prefix">{{ currencyLabel }}</span>
                  <input v-model="amount" type="number" min="100" :max="walletRequestType === 'deposit' ? 50000 : 100000000" inputmode="numeric" :placeholder="walletRequestType === 'deposit' ? '100 - 50,000' : 'Enter an amount'" :aria-label="`${walletRequestType === 'deposit' ? 'Deposit' : 'Request'} amount in ${currencyLabel}`" @input="amount = amount.replace(/\D/g, '')" />
                </label>
              </div>

              <div v-if="walletRequestType === 'withdrawal'" class="wallet-field">
                <span class="wallet-field-label">Withdrawal destination</span>
                <label class="wallet-input-shell">
                  <Smartphone :size="16" />
                  <input v-model="paymentMethod" placeholder="Withdrawal destination (bank, UPI, wallet)" aria-label="Withdrawal destination" />
                </label>
              </div>

              <div v-if="walletRequestType === 'deposit' && depositDetailsExpanded" class="wallet-field">
                <span class="wallet-field-label">Transaction reference</span>
                <label class="wallet-input-shell">
                  <input ref="depositReferenceInput" v-model="paymentReference" placeholder="Transaction or payment reference" aria-label="Transaction reference" required />
                </label>
              </div>

              <div v-if="walletRequestType === 'withdrawal' || depositDetailsExpanded" class="wallet-field">
                <span class="wallet-field-label">{{ walletRequestType === 'deposit' ? 'Note (optional)' : 'Destination details' }}</span>
                <textarea v-model="paymentNote" class="manual-note" rows="3" :placeholder="walletRequestType === 'withdrawal' ? 'Account number, IFSC, UPI ID, or wallet details' : 'Anything the reviewer should know'" :aria-label="walletRequestType === 'withdrawal' ? 'Destination details' : 'Note'" />
              </div>

              <div v-if="walletRequestType === 'deposit' && depositDetailsExpanded" class="wallet-field">
                <span class="wallet-field-label">Payment proof</span>
                <label class="wallet-file-drop">
                  <CircleCheck v-if="paymentProofName" :size="18" />
                  <Copy v-else :size="18" />
                  <span>{{ paymentProofName || "Upload receipt or screenshot" }}</span>
                  <input type="file" accept="image/jpeg,image/png,application/pdf" @change="setPaymentProof" required />
                </label>
              </div>

              <template v-if="walletRequestType === 'deposit'">
                <button v-if="!depositDetailsExpanded" type="button" class="wallet-deposit-help" @click="askAboutDeposit">
                  <span>Deposit sent but not showing?</span><strong>Report it <ChevronRight :size="15" /></strong>
                </button>
                <div v-if="depositDetailsExpanded" class="wallet-deposit-help">
                  <span>Deposit sent but not showing?</span><button type="button" @click="askAboutDeposit">Report it <ChevronRight :size="15" /></button>
                </div>
                <div class="wallet-deposit-footer">
                  <button v-if="!depositDetailsExpanded" class="wallet-deposit-submit" type="button" :disabled="walletSubmitting" @click="continueDeposit">
                    Deposit
                  </button>
                  <button v-else class="wallet-deposit-submit" type="submit" :disabled="walletSubmitting">
                    {{ walletSubmitting ? "Submitting…" : "Submit Deposit Request" }}
                  </button>
                </div>
              </template>

              <button v-if="walletRequestType === 'withdrawal'" class="primary-button full-button" type="submit" :disabled="walletSubmitting">
                {{ walletSubmitting ? "Submitting…" : "Submit Withdrawal Request" }}
              </button>
            </form>
            </template>
          </section>

          <section v-if="walletRequestType === 'withdrawal'" class="wallet-workspace transaction-panel">
            <header class="wallet-workspace-heading">
              <div><span class="eyebrow">ACTIVITY</span><h2>Recent transactions</h2></div>
              <button class="wallet-refresh" type="button" :disabled="transactionLoading" @click="loadWalletTransactions">Refresh</button>
            </header>
            <p v-if="transactionLoading" class="empty-state">Loading transaction history…</p>
            <p v-else-if="walletTransactions.length === 0" class="empty-state">No wallet transactions yet. Your deposits and withdrawals will appear here.</p>
            <ul v-else class="transaction-items">
              <li v-for="transaction in walletTransactions" :key="transaction.id" class="transaction-item">
                <span class="transaction-icon" :class="transaction.type">
                  <ArrowDownLeft v-if="transaction.type === 'deposit'" :size="17" />
                  <ArrowUpRight v-else :size="17" />
                </span>
                <div class="transaction-body">
                  <strong>{{ transaction.type === "deposit" ? "Deposit" : "Withdrawal" }}</strong>
                  <small>{{ formatShortDate(transaction.createdAt) }}</small>
                  <small v-if="transaction.paymentMethod">via {{ transaction.paymentMethod }}</small>
                  <small v-if="transaction.paymentReference" class="transaction-reference">Ref {{ transaction.paymentReference }}</small>
                </div>
                <div class="transaction-amount">
                  <strong>{{ currencyLabel }} {{ formatAmount(transaction.amount) }}</strong>
                  <span class="transaction-status" :class="transaction.status">
                    <Clock3 v-if="transaction.status === 'pending'" :size="11" />
                    <CircleCheck v-else-if="transaction.status === 'approved'" :size="11" />
                    <CircleAlert v-else :size="11" />
                    {{ statusLabel(transaction.status) }}
                  </span>
                </div>
              </li>
            </ul>
          </section>
        </template>
      </section>

      <section v-else-if="(currentPage === 'account' && profileSection === 'profile') || currentPage === 'rewards'" class="page-section account-page">
        <div v-if="currentPage === 'rewards'" class="page-heading page-heading-simple">
          <h1>Rewards</h1>
        </div>
        <nav v-if="currentPage === 'account' && !signedIn" class="profile-tabs" aria-label="Account sections" role="tablist">
          <button type="button" role="tab" aria-selected="false" @click="selectAccountSection('withdrawal')"><ArrowDownLeft :size="16" />Withdraw</button>
          <button type="button" role="tab" aria-selected="false" @click="selectAccountSection('wallet')"><Wallet :size="16" />Wallet</button>
        </nav>
        <nav v-if="currentPage === 'rewards'" class="rewards-tabs" aria-label="Reward categories" role="tablist">
          <button type="button" role="tab" :aria-selected="rewardsTab === 'daily'" :class="{ active: rewardsTab === 'daily' }" @click="rewardsTab = 'daily'"><CalendarDays :size="16" />Daily</button>
          <button type="button" role="tab" :aria-selected="rewardsTab === 'vip'" :class="{ active: rewardsTab === 'vip' }" @click="rewardsTab = 'vip'"><BadgeCheck :size="16" />VIP</button>
          <button type="button" role="tab" :aria-selected="rewardsTab === 'code'" :class="{ active: rewardsTab === 'code' }" @click="rewardsTab = 'code'"><ShieldCheck :size="16" />Bonus code</button>
          <button type="button" role="tab" :aria-selected="rewardsTab === 'referrals'" :class="{ active: rewardsTab === 'referrals' }" @click="rewardsTab = 'referrals'"><Users :size="16" />Referral code</button>
        </nav>
        <template v-if="signedIn">
          <template v-if="currentPage === 'rewards'">
            <p v-if="rewardsLoading && !rewardsDashboard" class="empty-state">Loading your rewards…</p>
            <p v-else-if="rewardsError && !rewardsDashboard" class="empty-state" role="alert">{{ rewardsError }}</p>
            <template v-else-if="rewardsDashboard">
              <section v-if="rewardsTab === 'daily'" class="daily-rewards-section">
                <div class="daily-rewards-banner">
                  <h2>Daily rewards</h2>
                  <p>Check in each day to keep your 7-day streak going.</p>
                </div>
                <article class="daily-checkin-card">
                  <div class="daily-checkin-heading">
                    <span class="daily-checkin-icon"><CalendarDays :size="26" /></span>
                    <div><h2>Daily check-in</h2><p>{{ rewardsDashboard.daily.claimedToday ? "Today's reward has been claimed." : !rewardsDashboard.daily.depositEligible ? `An approved deposit of ${currencyLabel} ${formatAmount(rewardsDashboard.daily.minimumDeposit)} is required to unlock check-in.` : `Day ${rewardsDashboard.daily.claimDay} of 7 is ready to claim.` }}</p></div>
                    <strong class="daily-streak-count">{{ rewardsDashboard.daily.streakDays }}/7</strong>
                  </div>
                  <div class="daily-reward-days" aria-label="Seven day reward streak">
                    <div
                      v-for="(reward, index) in rewardsDashboard.daily.rewards"
                      :key="index"
                      class="daily-reward-day"
                      :class="{
                        claimed: (rewardsDashboard.daily.claimedToday && index + 1 <= rewardsDashboard.daily.claimDay)
                          || (rewardsDashboard.daily.claimable && index + 1 < rewardsDashboard.daily.claimDay),
                        current: index + 1 === rewardsDashboard.daily.claimDay,
                      }"
                    >
                      <span>{{ (rewardsDashboard.daily.claimedToday && index + 1 <= rewardsDashboard.daily.claimDay) || (rewardsDashboard.daily.claimable && index + 1 < rewardsDashboard.daily.claimDay) ? "✓" : index + 1 }}</span>
                      <small>+{{ currencyLabel }} {{ formatAmount(reward) }}</small>
                    </div>
                  </div>
                  <button class="daily-claim-button" type="button" :disabled="!rewardsDashboard.daily.claimable || dailyClaiming" @click="claimDailyReward">
                    {{ dailyClaiming ? "Claiming…" : !rewardsDashboard.daily.enabled ? "Daily rewards unavailable" : rewardsDashboard.daily.claimedToday ? "Claimed today" : !rewardsDashboard.daily.depositEligible ? "Deposit to unlock" : `Claim Day ${rewardsDashboard.daily.claimDay}` }}
                  </button>
                  <button v-if="rewardsDashboard.daily.enabled && !rewardsDashboard.daily.claimedToday && !rewardsDashboard.daily.depositEligible" class="avatar-upload-button" type="button" @click="selectAccountSection('wallet')">Go to Wallet</button>
                  <p class="daily-reset-note">{{ rewardsDashboard.daily.streakResetOnMissedDay ? "A missed day resets your streak to Day 1." : "A missed day pauses your streak." }} Claims reset at midnight {{ rewardsDashboard.daily.resetTimezone }}.</p>
                  <p v-if="dailyClaimError" class="referral-feedback error" role="alert">{{ dailyClaimError }}</p>
                </article>
              </section>

              <section v-else-if="rewardsTab === 'vip'" class="rewards-content-card vip-rewards-card">
                <div class="rewards-content-heading"><BadgeCheck :size="22" /><div><h2>B9 VIP status</h2><p>Your tier is based on successful deposits in the last {{ rewardsDashboard.vip.windowDays }} days.</p></div></div>
                <p v-if="!rewardsDashboard.vip.enabled" class="cashback-unavailable-note">VIP levels are currently disabled by the platform.</p>
                <template v-else>
                <div class="vip-tier-summary">
                  <span class="vip-tier-badge"><BadgeCheck :size="20" />{{ rewardsDashboard.vip.tier }}</span>
                  <div><small>Eligible deposits · last 30 days</small><strong>{{ currencyLabel }} {{ formatAmount(rewardsDashboard.vip.totalDeposits) }}</strong></div>
                </div>
                <template v-if="rewardsDashboard.vip.nextTier">
                  <div class="vip-progress-label"><span>{{ rewardsDashboard.vip.tier }}</span><span>{{ rewardsDashboard.vip.nextTier }}</span></div>
                  <div class="vip-progress-track" role="progressbar" :aria-valuenow="Math.round(rewardsDashboard.vip.progress)" aria-valuemin="0" aria-valuemax="100"><span :style="{ width: `${rewardsDashboard.vip.progress}%` }"></span></div>
                  <p class="referral-review-note">{{ currencyLabel }} {{ formatAmount(rewardsDashboard.vip.remaining) }} in eligible deposits to reach {{ rewardsDashboard.vip.nextTier }}.</p>
                </template>
                <p v-else class="referral-review-note">You have reached the highest listed tier.</p>
                <p class="referral-review-note">VIP status currently displays your tier and progress. No additional cash perks are configured.</p>
                </template>
              </section>

              <section v-else-if="rewardsTab === 'code'" class="rewards-content-card">
                <div class="rewards-content-heading"><ShieldCheck :size="22" /><div><h2>Redeem a bonus code</h2><p>Each code can be redeemed once per account. Credits go to your Main Wallet.</p></div></div>
                <form class="bonus-code-redeem-form" @submit.prevent="previewBonusCode">
                  <label for="member-bonus-code">Bonus code</label>
                  <div><input id="member-bonus-code" v-model="bonusCodeInput" autocomplete="off" maxlength="32" required placeholder="Enter your code" @input="clearBonusCodePreview" /><button class="primary-button" type="submit" :disabled="bonusCodeChecking || bonusCodeRedeeming">{{ bonusCodeChecking ? "Checking…" : "Check code" }}</button></div>
                </form>
                <p v-if="bonusCodeError" class="referral-feedback error" role="alert">{{ bonusCodeError }}</p>
                <p v-else-if="bonusCodeMessage" class="referral-feedback success" role="status">{{ bonusCodeMessage }}</p>
                <section v-if="bonusCodePreview" class="bonus-code-preview">
                  <div><strong>{{ bonusCodePreview.code }}</strong><span>{{ currencyLabel }} {{ formatAmount(bonusCodePreview.amount) }} Main Wallet credit</span></div>
                  <p>{{ bonusCodePreview.terms }}</p>
                  <small>Expires {{ new Date(bonusCodePreview.expiresAt).toLocaleString() }}. One redemption per account.</small>
                  <button class="primary-button" type="button" :disabled="bonusCodeRedeeming" @click="redeemBonusCode">{{ bonusCodeRedeeming ? "Redeeming…" : "Confirm and redeem" }}</button>
                </section>
              </section>

              <section v-else class="account-profile-card referral-card">
                <div class="referral-card-heading">
                  <div class="account-profile-head">
                    <Gift :size="18" />
                    <div><strong>Invite friends</strong><small>Share your referral code and earn rewards when friends join.</small></div>
                  </div>
                  <div class="referral-reward-summary">
                    <span>{{ referralData?.pendingCount ?? 0 }} pending</span>
                    <strong>{{ currencyLabel }} {{ formatAmount(referralData?.approvedRewards ?? 0) }} approved</strong>
                  </div>
                </div>
                <div class="referral-code-box">
                  <span>Your referral code</span>
                  <strong>{{ referralData?.code || user?.referralCode || "Loading…" }}</strong>
                </div>
                <p class="referral-review-note">Referral rewards are credited to your wallet after admin review.</p>
                <div class="referral-card-actions">
                  <button type="button" class="avatar-upload-button" :disabled="!referralData?.code" @click="copyReferralLink">Copy invite link</button>
                  <button type="button" class="avatar-upload-button" :disabled="!referralData?.code" @click="shareReferralLink">Share</button>
                </div>
                <div class="referral-list-heading">
                  <strong>Invitation list</strong>
                  <span>{{ referralData?.referrals.length ?? 0 }} invited</span>
                </div>
                <p v-if="referralLoading" class="referral-feedback" role="status">Loading referral activity…</p>
                <p v-else-if="referralError" class="referral-feedback error" role="alert">{{ referralError }}</p>
                <div v-else-if="referralData?.referrals.length" class="referral-list">
                  <div v-for="referral in referralData.referrals" :key="referral.id" class="referral-list-row">
                    <div>
                      <strong>{{ referral.username }}</strong>
                      <small>Joined {{ formatMemberSince(referral.createdAt) }}</small>
                      <small v-if="referral.reviewNote">{{ referral.reviewNote }}</small>
                    </div>
                    <span class="referral-status" :class="referral.status">{{ formatReferralStatus(referral.status) }}</span>
                    <strong v-if="referral.status === 'approved'">{{ currencyLabel }} {{ formatAmount(referral.reward) }}</strong>
                  </div>
                </div>
                <p v-else-if="!referralLoading" class="referral-feedback">No referrals yet. Share your invite link to get started.</p>
              </section>
            </template>
          </template>
          <template v-else-if="profileSection === 'profile'">
          <div class="account-hero-row">
            <button
              type="button"
              class="account-hero"
              :aria-label="`Open profile options for ${user?.username || 'your account'}`"
              aria-haspopup="dialog"
              :aria-expanded="modal === 'profile-actions'"
              @click="openProfileActions"
            >
              <div class="account-avatar">
                <img v-if="displayedAvatarUrl" :src="displayedAvatarUrl" alt="Profile picture" @error="handleAvatarError" />
                <span v-else>{{ user?.username?.slice(0, 1).toUpperCase() || "U" }}</span>
              </div>
              <div class="account-hero-identity">
                <span class="account-hero-label">Signed in as</span>
                <strong>{{ user?.username }}</strong>
                <small>{{ user?.email || "No email linked" }}</small>
                <div class="account-badges">
                  <span class="account-badge neutral">
                    <CalendarDays :size="12" />
                    Joined {{ formatMemberSince(user?.createdAt) }}
                  </span>
                </div>
              </div>
            </button>
          </div>

          <section class="account-balance-card" aria-label="Available balance">
            <span class="account-balance-icon"><Wallet :size="20" /></span>
            <div class="account-balance-copy">
              <span>Available balance</span>
              <small>Main wallet</small>
            </div>
            <strong>{{ currencyLabel }} {{ formatAmount(balance) }}</strong>
          </section>

          <nav v-if="currentPage === 'account'" class="profile-tabs" aria-label="Wallet actions">
            <button type="button" @click="selectAccountSection('withdrawal')">Withdraw</button>
            <button type="button" @click="selectAccountSection('wallet')"><Wallet :size="16" />Wallet</button>
          </nav>

          <section class="profile-shortcuts" aria-label="Account shortcuts">
            <h2 class="account-group-title">Quick access</h2>
            <div class="profile-shortcut-grid">
              <button
                v-for="(shortcut, index) in profileShortcuts"
                :key="shortcut.action"
                type="button"
                class="profile-shortcut"
                :class="`shortcut-tone-${index % 8}`"
                @click="handleProfileShortcut(shortcut.action)"
              >
                <span class="profile-shortcut-icon"><component :is="shortcut.icon" :size="21" :stroke-width="1.9" /></span>
                <strong>{{ shortcut.title }}</strong>
              </button>
            </div>
          </section>

          </template>

          <button v-if="currentPage === 'account'" class="sign-out-button" @click="toggleSignIn"><LogOut :size="19" />Sign out</button>
        </template>
        <div v-else class="signed-out-card">
          <component :is="currentPage === 'rewards' ? Gift : UserRound" :size="30" />
          <h2>{{ currentPage === "rewards" ? "Sign in to view your rewards" : "Sign in to your account" }}</h2>
          <p>{{ currentPage === "rewards" ? "Sign in to claim daily rewards, redeem bonus codes, and track referrals." : "Access your profile, verification status, saved games, and messages." }}</p>
          <button class="primary-button" @click="showAuth">Sign in or create account</button>
        </div>
      </section>
    </main>

    <BottomNav
      :active-page="route.path"
      @navigate="navigateTo"
    />

    <div v-if="modal" class="modal-backdrop" :class="{ 'notification-backdrop': modal === 'inbox' }" @click="modal = null">
      <section class="modal-sheet" :class="{ 'notification-dialog': modal === 'inbox' }" role="dialog" aria-modal="true" :aria-label="modalTitle" @click.stop>
        <div class="modal-heading">
          <h2>{{ modalTitle }}</h2>
          <button class="close-button" aria-label="Close dialog" @click="modal = null"><X :size="22" /></button>
        </div>

        <form v-if="modal === 'game-funding'" class="modal-content auth-form" @submit.prevent="launchSelectedGame">
          <p>Your Game Wallet is empty. Choose how much to move from your Main Wallet to {{ selectedGame?.name || "this game" }}. Bets and winnings are handled in your Game Wallet. If it already has funds next time, the game opens using that balance without asking for another transfer.</p>
          <p><strong>Main Wallet:</strong> {{ currencyLabel }} {{ formatMoney(balance) }}</p>
          <div v-if="balance < 100" class="game-funding-shortfall" role="status">
            <strong>At least {{ currencyLabel }} 100 is needed to start.</strong>
            <span>Add funds to your Main Wallet, then return to play.</span>
            <button type="button" class="primary-button full-button" @click="navigateTo('/wallet')">Open wallet</button>
          </div>
          <template v-else>
          <label>
            <span>Amount to use for this game (minimum {{ currencyLabel }} 100)</span>
            <input v-model="gameFundingAmount" type="number" min="100" :max="Math.min(Math.floor(balance * 100) / 100, 100000000)" step="0.01" inputmode="decimal" required />
          </label>
          <p class="auth-configuration-note">Only the amount you choose is transferred. Pending withdrawals are not available for game funding.</p>
          <button class="primary-button full-button" type="submit" :disabled="launchingGameId !== null">
            {{ launchingGameId ? "Opening game..." : "Continue to game" }}
          </button>
          </template>
        </form>

        <form v-else-if="modal === 'auth'" class="modal-content auth-form" @submit.prevent="submitAuth">
          <div class="wallet-tabs">
            <button type="button" :class="{ active: authMode === 'login' }" @click="authMode = 'login'">Sign In</button>
            <button type="button" :class="{ active: authMode === 'register' }" @click="authMode = 'register'">Register</button>
          </div>
          <select v-model="authCountry" :aria-label="authMode === 'login' ? 'Country for Google Sign-In' : 'Country'" :required="authMode === 'register'">
            <option value="">{{ authMode === "login" ? "Select country for Google Sign-In" : "Select country" }}</option>
            <option value="IN">India</option>
            <option value="PK">Pakistan</option>
          </select>
          <div v-if="googleClientId" id="google-signin-button" class="google-signin-button" />
          <p v-else class="auth-configuration-note">Google Sign-In is not configured for this site.</p>
          <div class="auth-divider"><span>{{ authMode === "login" ? "or sign in with username" : "or create account with email" }}</span></div>
          <input v-model="authUsername" autocomplete="username" placeholder="Username" aria-label="Username" required minlength="3" />
          <template v-if="authMode === 'register'">
            <input v-model="authEmail" type="email" autocomplete="email" placeholder="Gmail or email address" aria-label="Email address" required />
            <input v-model="authReferralCode" type="text" autocomplete="off" autocapitalize="characters" maxlength="12" placeholder="Referral code (optional)" aria-label="Referral code (optional)" />
          </template>
          <input v-model="authPassword" type="password" autocomplete="current-password" placeholder="Password" aria-label="Password" required minlength="6" />
          <button class="primary-button full-button" type="submit" :disabled="authLoading">
            {{ authLoading ? "Please wait..." : authMode === "login" ? "Sign In" : "Create Account" }}
          </button>
        </form>

        <ul v-else-if="modal === 'menu'" class="menu-list">
          <li class="menu-section-label">My account</li>
          <li><button @click="navigateTo('/account')"><UserRound :size="20" />Profile &amp; account</button></li>
          <li><button @click="selectAccountSection('wallet')"><Wallet :size="20" />Wallet &amp; deposits</button></li>
          <li><button @click="selectAccountSection('withdrawal')"><ArrowDownLeft :size="20" />Withdraw</button></li>
          <li><button @click="openTransactionHistory()"><Mail :size="20" />Transaction history</button></li>
          <li v-if="signedIn && user?.kycStatus !== 'verified'"><button @click="openKyc"><UserRound :size="20" />KYC verification</button></li>
          <li class="menu-section-label">Discover</li>
          <li><button @click="showFavorites"><Star :size="20" />My favorites</button></li>
          <li><button @click="navigateTo('/promotions')"><Gift :size="20" />Promotions</button></li>
          <li><button @click="openInbox"><Bell :size="20" />Notifications</button></li>
          <li class="menu-section-label">Game categories</li>
          <li v-for="category in categories" :key="category">
            <button @click="selectCategory(category); navigateTo('/games')"><Flame :size="20" />{{ category }}</button>
          </li>
          <li class="menu-section-label">Support</li>
          <li><button @click="modal = 'support'"><Mail :size="20" />Help &amp; support</button></li>
          <li v-if="signedIn"><button @click="toggleSignIn"><LogOut :size="20" />Sign out</button></li>
        </ul>

        <div v-else-if="modal === 'transactions'" class="modal-content transaction-list">
          <div class="transaction-filter" role="group" aria-label="Filter transaction history">
            <button type="button" :class="{ active: transactionFilter === 'all' }" @click="transactionFilter = 'all'">All</button>
            <button type="button" :class="{ active: transactionFilter === 'deposit' }" @click="transactionFilter = 'deposit'">Deposits</button>
            <button type="button" :class="{ active: transactionFilter === 'withdrawal' }" @click="transactionFilter = 'withdrawal'">Withdrawals</button>
          </div>
          <p v-if="transactionLoading" class="bonus-note">Loading transaction history...</p>
          <p v-else-if="visibleWalletTransactions.length === 0" class="empty-state">No {{ transactionFilter === 'all' ? 'wallet' : transactionFilter }} records yet.</p>
          <article v-for="transaction in visibleWalletTransactions" :key="transaction.id" class="transaction-card">
            <div>
              <strong>{{ transaction.type === "deposit" ? "Deposit" : "Withdrawal" }}</strong>
              <small>{{ formatDate(transaction.createdAt) }}</small>
              <small v-if="transaction.paymentMethod">Method: {{ transaction.paymentMethod }}</small>
              <small v-if="transaction.paymentReference">Reference: {{ transaction.paymentReference }}</small>
            </div>
            <div class="transaction-result">
              <strong>{{ currencyLabel }} {{ formatMoney(transaction.amount) }}</strong>
              <span :class="transaction.status">{{ transaction.status }}</span>
            </div>
          </article>
        </div>

        <div v-else-if="modal === 'favorites'" class="modal-content favorites-list">
          <p v-if="favoriteNames === 'None yet'" class="empty-state">You have no favorite games yet.</p>
          <button
            v-for="game in games.filter((item) => favorites.includes(item.id))"
            :key="game.id"
            class="favorite-game"
            @click="play(game)"
          >
            <img :src="game.provider.toLowerCase().includes('pg') || game.gameType.toLowerCase().includes('slot') ? slot : fish" :alt="game.name" />
            <span><strong>{{ game.name }}</strong><small>{{ game.provider }}</small></span>
          </button>
        </div>

        <div v-else-if="modal === 'support'" class="modal-content support-content">
          <p>For account, deposit, withdrawal, or KYC help:</p>
          <button class="support-row" @click="openInbox"><Mail :size="20" /><span><strong>Message center</strong><small>View account notices</small></span></button>
          <button v-if="signedIn && user?.kycStatus !== 'verified'" class="support-row" @click="openKyc"><UserRound :size="20" /><span><strong>KYC assistance</strong><small>Review document requirements</small></span></button>
          <button class="support-row" @click="modal = 'profile'"><UserRound :size="20" /><span><strong>Account details</strong><small>Review your profile</small></span></button>
          <div class="ticket-form">
            <input v-model="supportSubject" maxlength="100" placeholder="Subject" :disabled="!signedIn" />
            <textarea v-model="supportMessage" maxlength="1000" rows="3" placeholder="Describe your issue" :disabled="!signedIn"></textarea>
            <button class="primary-button" :disabled="supportLoading || !signedIn" @click="submitSupportTicket">{{ signedIn ? (supportLoading ? "Sending..." : "Send support request") : "Sign in to contact support" }}</button>
          </div>
        </div>

        <div v-else-if="modal === 'promo'" class="modal-content promo-list">
          <article v-for="promotion in activePromotions" :key="promotion.id" class="promo-card">
            <div>
              <strong>{{ promotion.title }}</strong>
              <p>{{ promotion.description }} {{ promotion.reward }}</p>
            </div>
            <button class="primary-button" @click="askAboutPromotion(promotion)">Ask support</button>
          </article>
        </div>

        <div v-else-if="modal === 'profile-actions'" class="modal-content profile-actions">
          <p>Choose what you’d like to do with your profile.</p>
          <button type="button" class="support-row" @click="openProfile">
            <UserRound :size="20" />
            <span><strong>View profile</strong><small>Review your account details and verification status</small></span>
            <ChevronRight :size="18" />
          </button>
          <label class="support-row profile-change-option" :class="{ uploading: avatarUploading }">
            <UserRound :size="20" />
            <span><strong>{{ avatarUploading ? "Uploading picture…" : "Change profile picture" }}</strong><small>JPEG, PNG, or WebP · up to 3 MB</small></span>
            <input type="file" accept="image/jpeg,image/png,image/webp" :disabled="avatarUploading" @change="uploadProfilePicture" />
          </label>
        </div>

        <div v-else-if="modal === 'profile'" class="modal-content profile-info">
          <div class="profile-picture-editor">
            <div class="profile-avatar-preview">
              <img v-if="displayedAvatarUrl" :src="displayedAvatarUrl" alt="Your profile picture" @error="handleAvatarError" />
              <span v-else>{{ user?.username?.slice(0, 1).toUpperCase() || "U" }}</span>
            </div>
            <strong class="profile-name">{{ user?.username || "Guest" }}</strong>
            <span class="profile-badge" :class="user?.kycStatus === 'verified' ? 'ok' : 'warn'">
              <BadgeCheck v-if="user?.kycStatus === 'verified'" :size="12" />
              <ShieldCheck v-else :size="12" />
              {{ kycBadgeLabel(user?.kycStatus) }}
            </span>
            <label class="avatar-upload-button" :class="{ uploading: avatarUploading }">
              <UserRound :size="18" />
              {{ avatarUploading ? "Uploading picture…" : displayedAvatarUrl ? "Change profile picture" : "Upload profile picture" }}
              <input type="file" accept="image/jpeg,image/png,image/webp" :disabled="avatarUploading" @change="uploadProfilePicture" />
            </label>
            <small class="upload-hint">JPEG, PNG, or WebP · up to 3 MB</small>
          </div>

          <section class="profile-section">
            <h3>Wallet</h3>
            <dl class="profile-rows">
              <div><dt>Available balance</dt><dd>{{ currencyLabel }} {{ formatAmount(balance) }}</dd></div>
            </dl>
          </section>

          <section class="profile-section">
            <h3>Contact</h3>
            <dl class="profile-rows">
              <div><dt>Email</dt><dd>{{ user?.email || "Not set" }}</dd></div>
              <div><dt>Phone</dt><dd>{{ user?.phone || "Not set" }}</dd></div>
              <div><dt>Country</dt><dd>{{ user?.country === "PK" ? "Pakistan" : user?.country === "IN" ? "India" : user?.country === "NP" ? "Nepal" : "Not set" }}</dd></div>
            </dl>
          </section>

          <section class="profile-section">
            <h3>Account</h3>
            <dl class="profile-rows">
              <div><dt>Username</dt><dd>{{ user?.username || "Guest" }}</dd></div>
              <div><dt>Status</dt><dd>{{ user?.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : "Unknown" }}</dd></div>
              <div><dt>Member since</dt><dd>{{ formatMemberSince(user?.createdAt) }}</dd></div>
              <div><dt>Verification</dt><dd>{{ kycBadgeLabel(user?.kycStatus) }}</dd></div>
              <div><dt>Favorite games</dt><dd>{{ favoriteNames }}</dd></div>
            </dl>
          </section>

          <button v-if="user?.kycStatus !== 'verified'" class="primary-button full-button" @click="modal = 'kyc'">Complete KYC verification</button>
        </div>

        <form v-else-if="modal === 'kyc'" class="modal-content kyc-form" @submit.prevent="submitKyc">
          <p class="kyc-note">Provide identity details matching your India or Pakistan documents.</p>
          <select v-model="kycCountry" required>
            <option value="">Select country</option>
            <option value="IN">India</option>
            <option value="PK">Pakistan</option>
          </select>
          <input v-model="kycFullName" placeholder="Full legal name" required />
          <input v-model="kycDob" type="date" aria-label="Date of birth" required />
          <select v-model="kycDocumentType" required>
            <option value="">Select document</option>
            <option v-if="kycCountry === 'IN'" value="aadhaar">Aadhaar</option>
            <option v-if="kycCountry === 'IN'" value="pan">PAN Card</option>
            <option v-if="kycCountry === 'IN'" value="passport">Indian Passport</option>
            <option v-if="kycCountry === 'PK'" value="cnic">CNIC</option>
            <option v-if="kycCountry === 'PK'" value="passport">Pakistan Passport</option>
          </select>
          <input v-model="kycDocumentNumber" placeholder="Document number" required />
          <input v-model="kycAddress" placeholder="Residential address" required />
          <label>Front of document<input type="file" accept="image/jpeg,image/png,application/pdf" @change="setKycFile('front', $event)" required /></label>
          <label v-if="kycCountry === 'PK' && kycDocumentType === 'cnic'">Back of document<input type="file" accept="image/jpeg,image/png,application/pdf" @change="setKycFile('back', $event)" required /></label>
          <label>Selfie holding document<input type="file" accept="image/jpeg,image/png" @change="setKycFile('selfie', $event)" required /></label>
          <button class="primary-button full-button" type="submit" :disabled="kycLoading">{{ kycLoading ? "Submitting..." : "Submit KYC" }}</button>
        </form>

        <div v-else-if="modal === 'inbox'" class="message-list">
          <div class="notification-summary">
            <span class="notification-summary-icon"><Bell :size="18" /></span>
            <span><strong>Account notifications</strong><small>Updates about your account and wallet</small></span>
            <b>{{ inboxMessages.length }}</b>
          </div>
          <p v-if="inboxLoading" class="empty-state notification-status">Loading notifications...</p>
          <p v-else-if="inboxError" class="empty-state notification-status" role="alert">{{ inboxError }}</p>
          <p v-else-if="inboxMessages.length === 0" class="notification-empty">
            <span><Bell :size="21" /></span>
            <strong>You’re all caught up</strong>
            <small>New account and wallet updates will appear here.</small>
          </p>
          <article
            v-for="message in inboxMessages"
            :key="message.id"
            class="inbox-message"
            :class="{ unread: !message.read, [`inbox-${message.type}`]: true }"
          >
            <span class="notification-item-icon"><Bell :size="17" /></span>
            <div class="inbox-message-heading">
              <strong>{{ message.title }}<i v-if="!message.read" class="notification-unread-dot" aria-label="Unread"></i></strong>
              <time>{{ formatDate(message.createdAt) }}</time>
            </div>
            <p>{{ message.message }}</p>
          </article>
        </div>
      </section>
    </div>

    <div v-if="notice" class="toast" role="status">{{ notice }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, toRef, watch, type ComponentPublicInstance } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useSessionStore } from "./stores/session";
import PublicHeader from "./components/PublicHeader.vue";
import BottomNav from "./components/BottomNav.vue";
import BonusBanner from "./components/BonusBanner.vue";
import {
  ArrowDownLeft, ArrowUp, ArrowUpRight, BadgeCheck, Bell, CalendarDays, Check, ChevronLeft,
  ChevronRight, CircleAlert, CircleCheck, Clock3, Copy, Fish, Flame, Gamepad2, Gift,
  Landmark, LifeBuoy, LogOut, Mail, Search, ShieldCheck, Smartphone, Spade, Star,
  UserRound, Users, Volume2, Wallet, X,
} from "lucide-vue-next";
import fish from "./assets/g-fish.webp";
import slot from "./assets/g-slot.webp";
import b9Logo from "./assets/b9-logo.webp";
import jackpotBanner from "./assets/jackpot-banner.webp";
import popularCategoryLogo from "./assets/category-icons/01_popular.png";
import pgSlotCategoryLogo from "./assets/category-icons/02_pg_slot.png";
import spribeCategoryLogo from "./assets/category-icons/03_spribe.png";
import fishingCategoryLogo from "./assets/category-icons/04_fishing.png";
import inOutCategoryLogo from "./assets/category-icons/05_inout.png";
import pgSoftLogo from "./assets/provider-logos/pgsoft.png";
import inOutLogo from "./assets/provider-logos/inout.svg";
import phonePeLogo from "./assets/provider-logos/phonepe.png";
import paytmLogo from "./assets/provider-logos/paytm.png";

type Modal = "menu" | "promo" | "profile" | "profile-actions" | "inbox" | "auth" | "kyc" | "transactions" | "favorites" | "support" | "game-funding" | null;
type AuthUser = { id: string; username: string; phone: string; email: string; country: string; kycStatus: string; role: "user" | "agent" | "admin"; balance: number; status: string; createdAt: string; lastLoginAt: string | null; googlePictureUrl?: string; referralCode?: string };
type WalletTransaction = { id: string; type: "deposit" | "withdrawal"; amount: number; status: string; createdAt: string; paymentMethod?: string; paymentReference?: string; paymentNote?: string };
type ProfileShortcutAction = "wallet" | "withdrawal" | "promotions" | "transactions" | "profile" | "security" | "notifications" | "favorites" | "support";
type Referral = { id: string; username: string; status: string; reward: number; createdAt: string; reviewedAt: string | null; reviewNote: string };
type ReferralData = { code: string; referrals: Referral[]; pendingCount: number; approvedRewards: number };
type RewardsDashboard = {
  daily: {
    today: string; claimedToday: boolean; depositEligible: boolean; minimumDeposit: number; claimable: boolean; claimDay: number; claimAmount: number;
    enabled: boolean; streakDays: number; rewards: number[]; resetTimezone: string; streakResetOnMissedDay: boolean;
    history: { claimDate: string; day: number; amount: number }[];
  };
  vip: {
    enabled: boolean; tier: string; totalDeposits: number; nextTier: string | null; nextThreshold: number | null;
    remaining: number; progress: number; windowDays: number; tiers: { name: string; threshold: number }[];
  };
  cashback: { enabled: boolean; configuredEnabled: boolean; rate: number; weeklyCap: number; message: string };
};
type RewardsTab = "daily" | "vip" | "code" | "referrals";
type PaymentDetails = { bankName: string; accountName: string; accountNumber: string; iban: string; upiId: string; walletName: string; walletNumber: string; instructions: string };
type InboxMessage = { id: string; type: string; title: string; message: string; read: boolean; createdAt: string };
type Promotion = { id: string; title: string; description: string; reward: string; terms: string; active: boolean; bannerImage?: string; bannerUrl?: string; bannerIncludesText?: boolean };
type Game = {
  id: string;
  name: string;
  provider: string;
  providerCode: string;
  gameType: string;
  status: number;
  category?: string;
  isPopular?: boolean;
  thumbnail?: string;
};
type GameProvider = { code: string; name: string; logo?: string };
type GameCategoryItem = {
  label: string;
  logo: string;
  logoAlt: string;
};
type HomeCategoryItem = GameCategoryItem & { section: string };
type GameLobbyTab = "all" | "hot" | "recent" | "favorites";
type GameSection = {
  category: string;
  title: string;
  games: Game[];
  loading: boolean;
  error: string;
  page: number;
  pageCount: number;
  total: number;
};

const gameSort = ref<"popular" | "name" | "provider">("popular");
const selectedProvider = ref("");
const pageLinks = [
  { path: "/", label: "Home" },
  { path: "/games", label: "Games" },
  { path: "/promotions", label: "Promotions" },
  { path: "/account", label: "Account" },
];
const baseCategoryItems: GameCategoryItem[] = [
  { label: "Popular", logo: popularCategoryLogo, logoAlt: "Popular games" },
  { label: "PG Slot", logo: pgSlotCategoryLogo, logoAlt: "PG Slot logo" },
  { label: "Spribe", logo: spribeCategoryLogo, logoAlt: "Spribe logo" },
  { label: "Fishing", logo: fishingCategoryLogo, logoAlt: "Fishing games" },
  { label: "InOut", logo: inOutCategoryLogo, logoAlt: "InOut logo" },
];
const gameCategories = baseCategoryItems;
const homeCategoryItems: HomeCategoryItem[] = [
  { label: "Popular", logo: popularCategoryLogo, logoAlt: "Popular games", section: "Popular" },
  { label: "PG Slot", logo: pgSlotCategoryLogo, logoAlt: "PG Slot logo", section: "Slots" },
  { label: "Spribe", logo: spribeCategoryLogo, logoAlt: "Spribe logo", section: "Mini Games" },
  { label: "Fishing", logo: fishingCategoryLogo, logoAlt: "Fishing games", section: "Fishing" },
  { label: "InOut", logo: inOutCategoryLogo, logoAlt: "InOut logo", section: "Mini Games" },
];
const homeSectionIcons: Record<string, typeof Flame> = {
  Popular: Flame,
  "Mini Games": Gamepad2,
  Slots: Spade,
  Fishing: Fish,
};
const selectedCategory = ref<string>("Popular");
const categories = computed(() => gameCategories.map((category) => category.label));
const games = ref<Game[]>([]);
const gameProviders = ref<GameProvider[]>([]);
const knownGames = ref<Game[]>([]);
const recentGames = ref<Game[]>([]);
const gameLobbyTab = ref<GameLobbyTab>("all");
const gameLobbyTabs: Array<{ id: GameLobbyTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "hot", label: "Hot" },
  { id: "recent", label: "Recent" },
  { id: "favorites", label: "Favorites" },
];
const gameLobbySearchInput = ref<HTMLInputElement | null>(null);
const gameSections = ref<GameSection[]>([
  { category: "Popular", title: "Popular Games", games: [], loading: false, error: "", page: 0, pageCount: 0, total: 0 },
  { category: "Mini Games", title: "Mini Games", games: [], loading: false, error: "", page: 0, pageCount: 0, total: 0 },
  { category: "Slots", title: "Slot Games", games: [], loading: false, error: "", page: 0, pageCount: 0, total: 0 },
  { category: "Fishing", title: "Fishing Games", games: [], loading: false, error: "", page: 0, pageCount: 0, total: 0 },
]);
const gameSectionsLoading = ref(false);
const homeSelectedCategory = ref("Popular");
const homeCategoryList = ref<HTMLElement | null>(null);
const homeGameStrips = new Map<string, HTMLElement>();
const homeSectionSentinels = new Map<string, Element>();
let homeSectionObserver: IntersectionObserver | undefined;
const showBackToTop = ref(false);
const gameSectionRequestIds = new Map<string, number>();
const showAllGames = ref(false);
const gamesLoading = ref(true);
const gamesError = ref("");
const gameCatalogTotal = ref(0);
const gameCatalogPage = ref(0);
const gameCatalogPageCount = ref(0);
const gamesLoadSentinel = ref<HTMLElement | null>(null);
let gamesLoadObserver: IntersectionObserver | undefined;
let gamesRequestId = 0;
let gameFilterReloadTimer: ReturnType<typeof setTimeout> | undefined;
const launchingGameId = ref<string | null>(null);
const selectedGame = ref<Game | null>(null);
const gameFundingAmount = ref("");
const activeGame = ref<Game | null>(null);
const activeGameUrl = ref("");
const gamePlayerFrame = ref<HTMLElement | null>(null);
const gameFrameLoading = ref(false);
const gameFrameError = ref("");
const gameFullscreen = ref(false);
let gameFrameLoadTimer: ReturnType<typeof setTimeout> | undefined;
const balance = ref(8891.2);
const jackpot = ref(10799004.2);
const homepageBanner = ref({
  active: false,
  title: "",
  description: "",
  buttonLabel: "",
  buttonLink: "/games",
  imageUrl: "",
  bannerIncludesText: false,
});
const favorites = ref<string[]>([]);
const query = ref("");
const modal = ref<Modal>(null);
const signedIn = ref(false);
const amount = ref("1000");
const notice = ref("");
const session = useSessionStore();
const token = toRef(session, "userToken");
const route = useRoute();
const router = useRouter();
const user = ref<AuthUser | null>(null);
const currencyCode = computed(() => {
  if (user.value?.country === "IN") return "INR";
  if (user.value?.country === "PK") return "PKR";
  if (user.value?.country === "NP") return "NPR";
  return "";
});
const currencyLabel = computed(() => displayCurrency(currencyCode.value));
const gameWalletDisplayCurrency = computed(() => displayCurrency(gameWalletCurrency.value || currencyCode.value));
const avatarUrl = ref("");
const displayedAvatarUrl = computed(() => avatarUrl.value || user.value?.googlePictureUrl || "");
const avatarLoading = ref(false);
const avatarUploading = ref(false);
const authMode = ref<"login" | "register">("login");
const authUsername = ref("");
const authEmail = ref("");
const authPassword = ref("");
const authReferralCode = ref("");
const authCountry = ref("");
const authLoading = ref(false);
const kycCountry = ref("");
const kycFullName = ref("");
const kycDob = ref("");
const kycDocumentType = ref("");
const kycDocumentNumber = ref("");
const kycAddress = ref("");
const kycLoading = ref(false);
const kycFiles = ref<Record<string, File | undefined>>({});
const walletRequestType = ref<"deposit" | "withdrawal">("deposit");
const depositDetailsExpanded = ref(false);
const showDepositPaymentDetails = ref(false);
const depositReferenceInput = ref<HTMLInputElement | null>(null);
const walletTransactions = ref<WalletTransaction[]>([]);
const transactionLoading = ref(false);
const transactionFilter = ref<"all" | "deposit" | "withdrawal">("all");
const visibleWalletTransactions = computed(() => transactionFilter.value === "all"
  ? walletTransactions.value
  : walletTransactions.value.filter((transaction) => transaction.type === transactionFilter.value));
const referralData = ref<ReferralData | null>(null);
const referralLoading = ref(false);
const referralError = ref("");
const rewardsDashboard = ref<RewardsDashboard | null>(null);
const rewardsLoading = ref(false);
const rewardsError = ref("");
const dailyClaimError = ref("");
const rewardsTab = ref<RewardsTab>("daily");
const dailyClaiming = ref(false);
const bonusCodeInput = ref("");
const bonusCodePreview = ref<{ code: string; amount: number; terms: string; expiresAt: string } | null>(null);
const bonusCodeChecking = ref(false);
const bonusCodeRedeeming = ref(false);
const bonusCodeMessage = ref("");
const bonusCodeError = ref("");
const paymentMethod = ref("");
const paymentReference = ref("");
const paymentNote = ref("");
const paymentProof = ref<File | undefined>();
const paymentProofName = ref("");
const walletSubmitting = ref(false);
const paymentDetails = ref<PaymentDetails>({
  bankName: "", accountName: "", accountNumber: "", iban: "", upiId: "", walletName: "", walletNumber: "", instructions: "",
});
const depositPaymentMethods = ["PhonePe", "Paytm"] as const;
const selectedDepositMethod = ref<(typeof depositPaymentMethods)[number]>("PhonePe");
watch(selectedDepositMethod, (method) => {
  paymentMethod.value = method;
}, { immediate: true });
function selectDepositPaymentMethod(method: (typeof depositPaymentMethods)[number]): void {
  selectedDepositMethod.value = method;
}
let paymentDetailsRequest: Promise<void> | undefined;
const gameWalletBalance = ref(0);
const gameWalletCurrency = ref("");
const gameWalletLoading = ref(false);
const returningGameFunds = ref(false);
const inboxMessages = ref<InboxMessage[]>([]);
const unreadCount = ref(0);
const inboxLoading = ref(false);
const inboxError = ref("");
const platformAnnouncement = ref("Welcome to B9 Game. Play responsibly and review applicable terms.");
const supportSubject = ref("");
const supportMessage = ref("");
const supportLoading = ref(false);
const profileShortcuts: { title: string; icon: typeof Wallet; action: ProfileShortcutAction }[] = [
  { title: "Wallet", icon: Wallet, action: "wallet" },
  { title: "Withdraw", icon: ArrowDownLeft, action: "withdrawal" },
  { title: "Promotions", icon: Gift, action: "promotions" },
  { title: "Transactions", icon: ArrowUpRight, action: "transactions" },
  { title: "Profile details", icon: UserRound, action: "profile" },
  { title: "Identity verification", icon: ShieldCheck, action: "security" },
  { title: "Notifications", icon: Bell, action: "notifications" },
  { title: "Favorites", icon: Star, action: "favorites" },
  { title: "Help & support", icon: LifeBuoy, action: "support" },
];
const maintenanceMode = ref(false);
const promotions = ref<Promotion[]>([]);
const promotionsLoading = ref(false);
const promotionsError = ref("");
const homeBannerIndex = ref(0);
const promotionFilter = ref<"all" | "deposit" | "other">("all");
const googleClientId = ref("");
let inboxTimer: ReturnType<typeof setInterval> | undefined;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
let googleScriptPromise: Promise<void> | undefined;
let googleInitialized = false;
let referralRequestId = 0;
let rewardsRequestId = 0;

const currentPage = computed(() => route.path.slice(1) || "home");
const profileSection = computed(() => {
  if (route.path === "/rewards") return "rewards";
  if (route.path === "/wallet") return "wallet";
  const section = route.query.section;
  return section === "wallet" || section === "withdrawal" ? section : "profile";
});
const pageMetadata = computed(() => {
  const metadata: Record<string, { title: string; description: string }> = {
    home: {
      title: "B9 Game",
      description: "Play popular games and discover promotions at B9 Game.",
    },
    games: {
      title: "Games | B9 Game",
      description: "Browse the game lobby, explore categories, and find games at B9 Game.",
    },
    promotions: {
      title: "Promotions | B9 Game",
      description: "Explore current member promotions and offer terms at B9 Game.",
    },
    wallet: {
      title: "Wallet | B9 Game",
      description: "Manage your B9 Game balance, deposits, withdrawals, and transactions.",
    },
    withdrawal: {
      title: "Withdraw | B9 Game",
      description: "Request a withdrawal from your B9 Game wallet and review recent activity.",
    },
    rewards: {
      title: "Rewards | B9 Game",
      description: "Share your B9 Game invite code and track referrals and reward approvals.",
    },
    account: {
      title: "Account | B9 Game",
      description: "Manage your B9 Game account, profile, and verification details.",
    },
  };
  if (currentPage.value === "account" && profileSection.value === "wallet") return metadata.wallet;
  if (currentPage.value === "account" && profileSection.value === "withdrawal") return metadata.withdrawal;
  return metadata[currentPage.value] || metadata.home;
});
const activePromotions = computed(() => promotions.value.filter((promotion) => promotion.active));
const depositPromotions = computed(() => activePromotions.value.filter(promotionMentionsDeposit));
const otherPromotions = computed(() => activePromotions.value.filter((promotion) => !promotionMentionsDeposit(promotion)));
const visiblePromotions = computed(() => {
  if (promotionFilter.value === "deposit") return depositPromotions.value;
  if (promotionFilter.value === "other") return otherPromotions.value;
  return activePromotions.value;
});
const showGameSections = computed(() => currentPage.value === "games"
  && !activeGame.value
  && gameLobbyTab.value === "all"
  && !showAllGames.value
  && !query.value.trim());
const showGameCatalog = computed(() => currentPage.value === "games"
  && !activeGame.value
  && (gameLobbyTab.value === "hot" || (gameLobbyTab.value === "all" && !showGameSections.value)));
const filteredLobbyGames = computed(() => {
  const source = gameLobbyTab.value === "recent"
    ? recentGames.value
    : knownGames.value.filter((game) => favorites.value.includes(game.id));
  const normalizedQuery = query.value.trim().toLowerCase();
  return source.filter((game) =>
    (!selectedProvider.value || game.providerCode === selectedProvider.value)
    && (!normalizedQuery || game.name.toLowerCase().includes(normalizedQuery)),
  );
});
const bannerSlides = [
  { id: "bonus", label: "first deposit bonus" },
  { id: "games", label: "games" },
  { id: "promotions", label: "promotions" },
  { id: "wallet", label: "wallet" },
];
const walletKycVerified = computed(() => user.value?.kycStatus === "verified");
const hasMoreGames = computed(() => gameCatalogPage.value < gameCatalogPageCount.value);

watch([currentPage, gamesLoadSentinel, hasMoreGames, gamesLoading, gamesError], async ([page]) => {
  gamesLoadObserver?.disconnect();
  gamesLoadObserver = undefined;
  if (page !== "games" || !gamesLoadSentinel.value || !hasMoreGames.value || gamesLoading.value || gamesError.value) return;
  await nextTick();
  if (!gamesLoadSentinel.value) return;
  gamesLoadObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      displayNextGamesBatch();
    }
  }, { rootMargin: "200px 0px" });
  gamesLoadObserver.observe(gamesLoadSentinel.value);
}, { flush: "post" });

watch([selectedCategory, selectedProvider, query, gameSort, gameLobbyTab], () => {
  if (currentPage.value === "home") return;
  if (gameFilterReloadTimer) clearTimeout(gameFilterReloadTimer);
  gameFilterReloadTimer = setTimeout(() => {
    if (currentPage.value !== "games") return;
    if (gameLobbyTab.value === "all" && !showAllGames.value && !query.value.trim()) {
      resetGameSections();
      void loadGameSections();
    } else if (gameLobbyTab.value === "hot" || showAllGames.value || query.value.trim()) {
      void loadGames();
    }
  }, query.value ? 250 : 0);
});
const modalTitle = computed(() => {
  if (modal.value === "game-funding") return "Choose game funding";
  if (modal.value === "promo") return "Promotions";
  if (modal.value === "auth") return authMode.value === "login" ? "Sign In" : "Create Account";
  if (modal.value === "kyc") return "KYC Verification";
  if (modal.value === "transactions") return transactionFilter.value === "deposit"
    ? "Deposit Records"
    : transactionFilter.value === "withdrawal" ? "Withdrawal Records" : "Transaction History";
  if (modal.value === "favorites") return "My Favorites";
  if (modal.value === "support") return "Help & Support";
  if (modal.value === "profile-actions") return "Profile";
  if (modal.value === "profile") return "Profile & Account";
  if (modal.value === "menu") return "Menu";
  if (modal.value === "inbox") return "Notifications";
  return modal.value ?? "";
});
const favoriteNames = computed(() => {
  const names = games.value.filter((game) => favorites.value.includes(game.id)).map((game) => game.name);
  return names.length ? names.join(", ") : "None yet";
});

watch(pageMetadata, (metadata) => {
  document.title = metadata.title;
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute("content", metadata.description);
}, { immediate: true });

watch([modal, authMode, googleClientId], () => {
  if (modal.value === "auth" && googleClientId.value) {
    window.setTimeout(() => {
      void googleLogin().catch((error: unknown) => notify(error instanceof Error ? error.message : "Could not load Google Sign-In"));
    }, 0);
  }
});

watch(() => route.query.ref, (code) => {
  if (typeof code === "string" && /^B9[A-F0-9]{10}$/i.test(code)) {
    authReferralCode.value = code.toUpperCase();
  }
}, { immediate: true });

watch(() => [route.path, signedIn.value] as const, ([, isSignedIn]) => {
  if (isSignedIn) void loadPromotions();
  else promotions.value = [];
});

watch(() => [route.path, signedIn.value] as const, ([path, isSignedIn]) => {
  if (path === "/rewards" && isSignedIn) {
    void loadReferralData();
    void loadRewardsDashboard();
  } else {
    referralRequestId += 1;
    referralData.value = null;
    referralLoading.value = false;
    rewardsRequestId += 1;
    rewardsDashboard.value = null;
    rewardsLoading.value = false;
  }
});

watch(() => route.path, (path) => {
  if (path === "/rewards") rewardsTab.value = "daily";
});

watch(profileSection, (section) => {
  if (section !== "wallet" && section !== "withdrawal") return;
  walletRequestType.value = section === "withdrawal" ? "withdrawal" : "deposit";
  depositDetailsExpanded.value = false;
  showDepositPaymentDetails.value = false;
}, { immediate: true });

watch(() => [route.path, profileSection.value, signedIn.value] as const, ([path, section, isSignedIn]) => {
  if ((path === "/wallet" || (path === "/account" && (section === "wallet" || section === "withdrawal"))) && isSignedIn) {
    void refreshGameWallet();
    if (section === "withdrawal") void loadWalletTransactions();
  }
});

watch(() => [route.path, profileSection.value] as const, ([path, section]) => {
  if (path === "/wallet" || (path === "/account" && section === "wallet")) void loadPaymentDetails();
  if (path !== "/games" && activeGame.value) void closeGame();
  if (path === "/games" && !activeGame.value) {
    if (gameLobbyTab.value === "hot" || showAllGames.value || query.value.trim()) void loadGames();
    else void loadGameSections();
  }
  else if (path === "/") void loadGameSections();
});

watch([signedIn, () => route.path, modal], ([isSignedIn, path, activeModal]) => {
  if (!isSignedIn) {
    clearAvatarUrl();
    return;
  }
  if (path === "/account" || activeModal === "profile") {
    void loadProfilePicture().catch((error: unknown) => notify(error instanceof Error ? error.message : "Could not load profile picture"));
  }
});

onMounted(async () => {
  document.addEventListener("fullscreenchange", handleFullscreenChange);
  window.addEventListener("scroll", handleHomeScroll, { passive: true });
  homeSectionObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const category = (entry.target as HTMLElement).dataset.gameCategory;
      if (category) void loadNextGameSection(category);
    }
  }, { rootMargin: "240px 0px" });
  if ((currentPage.value === "games" && !showAllGames.value) || currentPage.value === "home") void loadGameSections();
  else void loadGames();
  token.value = localStorage.getItem("b9_token") || "";
  if (currentPage.value === "wallet" || (currentPage.value === "account" && profileSection.value === "wallet")) void loadPaymentDetails();
  if (currentPage.value === "account" && profileSection.value === "withdrawal" && signedIn.value) {
    void refreshGameWallet();
    void loadWalletTransactions();
  }
  const settingsRequest = fetch("/api/platform/settings")
    .then((response) => {
      if (!response.ok) throw new Error("Could not load platform settings");
      return response.json();
    })
    .then((settings) => {
      if (settings.announcement) platformAnnouncement.value = settings.announcement;
      maintenanceMode.value = Boolean(settings.maintenanceMode);
      if (typeof settings.jackpotAmount === "number" && Number.isFinite(settings.jackpotAmount)) {
        jackpot.value = settings.jackpotAmount;
      }
      if (settings.homepageBanner) {
        homepageBanner.value = { ...homepageBanner.value, ...settings.homepageBanner };
      }
      googleClientId.value = settings.googleClientId || "";
    })
    .catch(() => {
      // Keep the built-in announcement when platform settings are unavailable.
    });
  const sessionRequest = token.value ? restoreSession() : Promise.resolve();
  await Promise.all([settingsRequest, sessionRequest]);
  if (signedIn.value) {
    startInboxPolling();
    void showUnreadNotifications();
  }
});
onUnmounted(() => {
  document.removeEventListener("fullscreenchange", handleFullscreenChange);
  window.removeEventListener("scroll", handleHomeScroll);
  homeSectionObserver?.disconnect();
  homeSectionObserver = undefined;
  homeGameStrips.clear();
  homeSectionSentinels.clear();
  gamesLoadObserver?.disconnect();
  if (gameFilterReloadTimer) clearTimeout(gameFilterReloadTimer);
  gamesRequestId += 1;
  clearGameFrameLoadTimer();
  if (noticeTimer) clearTimeout(noticeTimer);
  if (inboxTimer) clearInterval(inboxTimer);
  clearAvatarUrl();
});

async function loadPaymentDetails(): Promise<void> {
  if (paymentDetailsRequest) return paymentDetailsRequest;
  paymentDetailsRequest = (async () => {
    try {
      const response = await fetch("/api/payment/details");
      if (!response.ok) throw new Error("Could not load payment details");
      paymentDetails.value = await response.json();
    } catch {
      paymentDetails.value.instructions = "Transfer the exact amount, then submit the payment reference and proof.";
      paymentDetailsRequest = undefined;
    }
  })();
  await paymentDetailsRequest;
}

async function api(path: string, options: RequestInit = {}): Promise<any> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token.value) headers.set("Authorization", "Bearer " + token.value);
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function restoreSession(): Promise<void> {
  try {
    const data = await api("/api/auth/me");
    user.value = data.user;
    signedIn.value = true;
    balance.value = data.user.balance;
  } catch {
    localStorage.removeItem("b9_token");
    token.value = "";
    signedIn.value = false;
    user.value = null;
  }
}

function clearAvatarUrl(): void {
  if (avatarUrl.value) URL.revokeObjectURL(avatarUrl.value);
  avatarUrl.value = "";
}

function handleAvatarError(): void {
  if (avatarUrl.value) clearAvatarUrl();
  else if (user.value) user.value.googlePictureUrl = "";
}

async function loadProfilePicture(): Promise<void> {
  const sessionToken = token.value;
  if (!sessionToken || avatarLoading.value) return;
  avatarLoading.value = true;
  try {
    const response = await fetch("/api/auth/profile/avatar", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (token.value !== sessionToken) return;
    if (response.status === 404) {
      clearAvatarUrl();
      return;
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Could not load profile picture");
    }
    const nextUrl = URL.createObjectURL(await response.blob());
    if (token.value !== sessionToken) {
      URL.revokeObjectURL(nextUrl);
      return;
    }
    clearAvatarUrl();
    avatarUrl.value = nextUrl;
  } finally {
    avatarLoading.value = false;
  }
}

async function uploadProfilePicture(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    notify("Choose a JPEG, PNG, or WebP image");
    input.value = "";
    return;
  }
  if (file.size > 3 * 1024 * 1024) {
    notify("Profile pictures must be 3 MB or smaller");
    input.value = "";
    return;
  }
  const form = new FormData();
  form.append("avatar", file);
  avatarUploading.value = true;
  try {
    await api("/api/auth/profile/avatar", { method: "POST", body: form });
    await loadProfilePicture();
    if (modal.value === "profile-actions") modal.value = null;
    notify("Profile picture updated");
  } catch (error) {
    notify(error instanceof Error ? error.message : "Could not update profile picture");
  } finally {
    avatarUploading.value = false;
    input.value = "";
  }
}

async function refreshInbox(): Promise<void> {
  if (!signedIn.value || !token.value) return;
  try {
    const data = await api("/api/inbox");
    inboxMessages.value = data.notifications || [];
    unreadCount.value = Number(data.unreadCount || 0);
    inboxError.value = "";
  } catch (error) {
    inboxError.value = error instanceof Error ? error.message : "Could not refresh inbox";
  }
}

function startInboxPolling(): void {
  if (inboxTimer) clearInterval(inboxTimer);
  void refreshInbox();
  inboxTimer = setInterval(() => {
    if (document.visibilityState === "visible") void refreshInbox();
  }, 5000);
}

async function showUnreadNotifications(): Promise<void> {
  await refreshInbox();
  if (unreadCount.value > 0 && modal.value === null) await openInbox();
}

async function openInbox(): Promise<void> {
  if (requireSignIn()) return;
  modal.value = "inbox";
  inboxLoading.value = true;
  inboxError.value = "";
  await refreshInbox();
  try {
    await api("/api/inbox/read", { method: "PATCH", body: "{}" });
    unreadCount.value = 0;
    inboxMessages.value = inboxMessages.value.map((message) => ({ ...message, read: true }));
  } catch (error) {
    inboxError.value = error instanceof Error ? error.message : "Could not mark inbox messages as read";
  } finally {
    inboxLoading.value = false;
  }
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

// Wallet / Account / Profile use a fixed two-decimal format so amounts read like
// a bank statement (12,500.50) instead of dropping the trailing zero.
function formatAmount(value: number): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0.00";
  return numeric.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatMemberSince(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function statusLabel(status: string): string {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") return "Completed";
  if (normalized === "pending") return "Under review";
  if (normalized === "rejected") return "Declined";
  return normalized || "Unknown";
}

function kycBadgeLabel(status?: string): string {
  const normalized = String(status || "not_submitted");
  if (normalized === "verified") return "Verified";
  if (normalized === "pending") return "In review";
  if (normalized === "rejected") return "Rejected";
  return "Not verified";
}

const copiedField = ref("");
let copiedTimer: ReturnType<typeof setTimeout> | undefined;

async function copyField(label: string, value: string): Promise<void> {
  const text = String(value || "").trim();
  if (!text) return;
  const legacyCopy = (): boolean => {
    try {
      const helper = document.createElement("textarea");
      helper.value = text;
      helper.setAttribute("readonly", "");
      helper.style.position = "fixed";
      helper.style.top = "-1000px";
      helper.style.opacity = "0";
      document.body.appendChild(helper);
      helper.select();
      helper.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(helper);
      return ok;
    } catch {
      return false;
    }
  };

  let copied = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch {
    copied = false;
  }
  if (!copied) copied = legacyCopy();

  if (copied) {
    copiedField.value = label;
    if (copiedTimer) clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => { copiedField.value = ""; }, 1800);
  } else {
    notify(`${label}: ${text}`);
  }
}

function paymentDetailRows(): Array<{ label: string; value: string }> {
  const details = paymentDetails.value;
  return [
    { label: "Account name", value: details.accountName },
    { label: "Account number", value: details.accountNumber },
    { label: "IBAN", value: details.iban },
    { label: "UPI ID", value: details.upiId },
    { label: details.walletName || "Wallet", value: details.walletNumber },
  ].filter((row) => Boolean(String(row.value || "").trim()));
}
function displayCurrency(currency: string): string {
  return currency === "INR" || currency === "NPR" ? "Rs." : currency;
}
function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
}
function notify(message: string): void {
  notice.value = message;
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.value = ""; }, 3000);
}
async function submitSupportTicket(): Promise<void> {
  if (!signedIn.value) {
    modal.value = "auth";
    return;
  }
  if (!supportSubject.value.trim() || !supportMessage.value.trim()) {
    notify("Enter both a subject and support message");
    return;
  }
  supportLoading.value = true;
  try {
    await api("/api/support/tickets", {
      method: "POST",
      body: JSON.stringify({ subject: supportSubject.value.trim(), message: supportMessage.value.trim() }),
    });
    supportSubject.value = "";
    supportMessage.value = "";
    notify("Support request sent successfully");
  } catch (error) {
    notify(error instanceof Error ? error.message : "Could not send support request");
  } finally {
    supportLoading.value = false;
  }
}
function requireSignIn(): boolean {
  if (signedIn.value) return false;
  notify("Please sign in first");
  modal.value = "auth";
  return true;
}
async function loadGameSections(): Promise<void> {
  gameSectionsLoading.value = true;
  try {
    await Promise.all(gameSections.value
      .filter((section) => section.page === 0 || section.error)
      .map((section) => loadGameSection(section, section.page === 0 ? 1 : section.page + 1)));
  } finally {
    gameSectionsLoading.value = false;
  }
}
function resetGameSections(): void {
  for (const section of gameSections.value) {
    gameSectionRequestIds.set(section.category, (gameSectionRequestIds.get(section.category) || 0) + 1);
    section.games = [];
    section.page = 0;
    section.pageCount = 0;
    section.total = 0;
    section.loading = false;
    section.error = "";
  }
}
function rememberGames(items: Game[]): void {
  const byId = new Map(knownGames.value.map((game) => [game.id, game]));
  for (const game of items) byId.set(game.id, game);
  knownGames.value = [...byId.values()];
}
async function loadGameSection(section: GameSection, page: number): Promise<void> {
  if (section.loading) return;
  const requestId = (gameSectionRequestIds.get(section.category) || 0) + 1;
  gameSectionRequestIds.set(section.category, requestId);
  section.loading = true;
  section.error = "";
  try {
    const parameters = new URLSearchParams({
      page: String(page),
      category: section.category,
      provider: currentPage.value === "games" ? selectedProvider.value : "",
      search: currentPage.value === "games" ? query.value.trim() : "",
      sort: "popular",
    });
    const data = await api(`/api/games?${parameters.toString()}`);
    if (gameSectionRequestIds.get(section.category) !== requestId) return;
    const responseGames = Array.isArray(data.games) ? data.games as Game[] : [];
    if (Array.isArray(data.providers)) gameProviders.value = data.providers;
    rememberGames(responseGames);
    const existingIds = new Set(page === 1 ? [] : section.games.map((game) => game.id));
    const uniquePageGames = responseGames.filter((game) => {
      if (existingIds.has(game.id)) return false;
      existingIds.add(game.id);
      return true;
    });
    section.games = page === 1
      ? uniquePageGames
      : [...section.games, ...uniquePageGames];
    section.page = Number.isInteger(data.page) ? data.page : page;
    section.pageCount = Number.isInteger(data.pageCount) ? data.pageCount : section.page;
    section.total = Number.isFinite(data.total) ? data.total : section.games.length;
  } catch (error) {
    if (gameSectionRequestIds.get(section.category) === requestId) {
      section.error = error instanceof Error ? error.message : `Could not load ${section.title.toLowerCase()}.`;
    }
  } finally {
    if (gameSectionRequestIds.get(section.category) === requestId) section.loading = false;
  }
}
async function loadNextGameSection(category: string): Promise<void> {
  const section = gameSections.value.find((item) => item.category === category);
  if (!section || section.loading || section.error || section.page >= section.pageCount) return;
  await loadGameSection(section, section.page + 1);
}
function retryGameSection(section: GameSection): void {
  void loadGameSection(section, section.page === 0 ? 1 : section.page + 1);
}
async function loadGames(): Promise<void> {
  const requestId = ++gamesRequestId;
  gamesLoading.value = true;
  gamesError.value = "";
  games.value = [];
  gameCatalogPage.value = 0;
  gameCatalogPageCount.value = 0;
  gameCatalogTotal.value = 0;
  const parameters = new URLSearchParams({
    page: "1",
    category: currentPage.value === "games" && !showAllGames.value ? "" : selectedCategory.value,
    provider: selectedProvider.value,
    search: query.value.trim(),
    sort: gameSort.value,
  });
  try {
    const data = await api(`/api/games?${parameters.toString()}`);
    if (requestId !== gamesRequestId) return;
    games.value = Array.isArray(data.games) ? data.games : [];
    if (Array.isArray(data.providers)) gameProviders.value = data.providers;
    rememberGames(games.value);
    gameCatalogPage.value = Number.isInteger(data.page) ? data.page : 1;
    gameCatalogPageCount.value = Number.isInteger(data.pageCount) ? data.pageCount : (games.value.length ? 1 : 0);
    gameCatalogTotal.value = Number.isFinite(data.total) ? data.total : games.value.length;
  } catch (error) {
    if (requestId === gamesRequestId) {
      gamesError.value = error instanceof Error ? error.message : "Games are temporarily unavailable. Please try again later.";
    }
  } finally {
    if (requestId === gamesRequestId) gamesLoading.value = false;
  }
}
async function displayNextGamesBatch(): Promise<void> {
  if (gamesLoading.value || gamesError.value || !hasMoreGames.value) return;
  const requestId = gamesRequestId;
  const nextPage = gameCatalogPage.value + 1;
  gamesLoading.value = true;
  const parameters = new URLSearchParams({
    page: String(nextPage),
    category: currentPage.value === "games" && !showAllGames.value ? "" : selectedCategory.value,
    provider: selectedProvider.value,
    search: query.value.trim(),
    sort: gameSort.value,
  });
  try {
    const data = await api(`/api/games?${parameters.toString()}`);
    if (requestId !== gamesRequestId) return;
    const seen = new Set(games.value.map((game) => game.id));
    const nextGames = Array.isArray(data.games) ? data.games as Game[] : [];
    const uniqueNextGames = nextGames.filter((game) => !seen.has(game.id));
    games.value = [...games.value, ...uniqueNextGames];
    rememberGames(uniqueNextGames);
    gameCatalogPage.value = Number.isInteger(data.page) ? data.page : nextPage;
    gameCatalogPageCount.value = Number.isInteger(data.pageCount) ? data.pageCount : gameCatalogPage.value;
    gameCatalogTotal.value = Number.isFinite(data.total) ? data.total : games.value.length;
  } catch (error) {
    if (requestId === gamesRequestId) gamesError.value = error instanceof Error ? error.message : "Could not load more games.";
  } finally {
    if (requestId === gamesRequestId) gamesLoading.value = false;
  }
}
async function loadPromotions(): Promise<void> {
  if (!signedIn.value) return;
  promotionsLoading.value = true;
  promotionsError.value = "";
  try {
    const data = await api("/api/promotions");
    promotions.value = data.promotions;
  } catch (error) {
    promotions.value = [];
    promotionsError.value = error instanceof Error ? error.message : "Could not load promotions";
  } finally {
    promotionsLoading.value = false;
  }
}
async function navigateTo(path: string): Promise<void> {
  modal.value = null;
  if (path !== "/games" && activeGame.value) await closeGame();
  await router.push(path);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
async function selectAccountSection(section: "profile" | "wallet" | "withdrawal"): Promise<void> {
  if (section !== "profile") {
    walletRequestType.value = section === "withdrawal" ? "withdrawal" : "deposit";
    depositDetailsExpanded.value = false;
    showDepositPaymentDetails.value = false;
  }
  const query = section === "profile" ? {} : { section };
  await router.push({ path: "/account", query });
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function changeBannerSlide(index: number): void {
  homeBannerIndex.value = index;
}
function toggleGameSearch(): void {
  if (route.path !== "/games") {
    void navigateTo("/games").then(() => nextTick(() => gameLobbySearchInput.value?.focus()));
    return;
  }
  gameLobbySearchInput.value?.focus();
}
async function refreshGameWallet(): Promise<boolean> {
  if (!signedIn.value) return false;
  gameWalletLoading.value = true;
  try {
    const data = await api("/api/games/wallet");
    gameWalletBalance.value = Number(data.balance || 0);
    gameWalletCurrency.value = data.currency || currencyCode.value;
    return true;
  } catch (error) {
    notify(error instanceof Error ? error.message : "Could not check the game wallet");
    return false;
  } finally {
    gameWalletLoading.value = false;
  }
}
async function returnGameFunds(): Promise<void> {
  if (returningGameFunds.value) return;
  returningGameFunds.value = true;
  try {
    const data = await api("/api/games/wallet/return", { method: "POST", body: "{}" });
    gameWalletBalance.value = Number(data.remainingGameBalance || 0);
    balance.value = data.balance;
    if (user.value) user.value.balance = data.balance;
    if (data.amount > 0) {
      notify(data.transactionId
        ? `${displayCurrency(data.currency)} ${formatMoney(data.amount)} returned · Ref ${data.transactionId}`
        : `${displayCurrency(data.currency)} ${formatMoney(data.amount)} returned, but no transaction reference was provided. Contact support.`);
    } else {
      notify("No game funds remained to return");
    }
  } catch (error) {
    notify(error instanceof Error ? error.message : "Could not return game funds");
    await refreshGameWallet();
  } finally {
    returningGameFunds.value = false;
  }
}
function selectCategory(category: string): void {
  selectedCategory.value = category;
  query.value = "";
  selectedProvider.value = "";
}
function showAllCategory(category: string): void {
  const categoryChanged = selectedCategory.value !== category;
  gameLobbyTab.value = "all";
  selectedCategory.value = category;
  query.value = "";
  gameSort.value = "popular";
  showAllGames.value = true;
  if (route.path !== "/games") {
    void navigateTo("/games");
    return;
  }
  if (!categoryChanged) void loadGames();
}
function selectGameLobbyTab(tab: GameLobbyTab): void {
  gameLobbyTab.value = tab;
  if (tab === "all") {
    showAllGames.value = false;
    selectedCategory.value = "Popular";
    resetGameSections();
    void loadGameSections();
  } else if (tab === "hot") {
    showAllGames.value = true;
    selectedCategory.value = "Popular";
  } else {
    showAllGames.value = false;
  }
}
function selectGameProvider(providerCode: string): void {
  selectedProvider.value = providerCode;
}
function gameProviderLogo(provider: GameProvider): string | undefined {
  if (provider.logo) return provider.logo;
  const providerName = `${provider.code} ${provider.name}`;
  if (/\bspribe\b/i.test(providerName)) return spribeCategoryLogo;
  if (/\bin[\s-]*out\b/i.test(providerName)) return inOutLogo;
  if (/\bpg(?:\s*(?:soft|slot))?\b/i.test(providerName)) return pgSoftLogo;
  return undefined;
}
function gameProviderLogoUsesDarkBackground(provider: GameProvider): boolean {
  if (provider.logo) return false;
  return /\bin[\s-]*out\b/i.test(`${provider.code} ${provider.name}`);
}
function homeSectionId(category: string): string {
  return `home-games-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}
function homeSectionIcon(category: string): typeof Flame {
  return homeSectionIcons[category] || Gamepad2;
}
function selectHomeCategory(category: string): void {
  const item = homeCategoryItems.find((candidate) => candidate.label === category);
  if (!item) return;
  homeSelectedCategory.value = category;
  document.getElementById(homeSectionId(item.section))?.scrollIntoView({ behavior: "smooth", block: "start" });
}
function scrollCategories(direction: number): void {
  const list = homeCategoryList.value;
  if (!list) return;
  const selectedIndex = homeCategoryItems.findIndex((category) => category.label === homeSelectedCategory.value);
  const currentIndex = selectedIndex < 0 ? 0 : selectedIndex;
  const nextIndex = (currentIndex + direction + homeCategoryItems.length) % homeCategoryItems.length;
  selectHomeCategory(homeCategoryItems[nextIndex].label);
  list.querySelectorAll<HTMLButtonElement>(".category")[nextIndex]?.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
    inline: "center",
  });
}
function setHomeGameStrip(category: string, element: Element | ComponentPublicInstance | null): void {
  if (element instanceof HTMLElement) homeGameStrips.set(category, element);
  else homeGameStrips.delete(category);
}
function scrollHomeGameStrip(category: string, direction: number): void {
  const strip = homeGameStrips.get(category);
  if (!strip) return;
  strip.scrollBy({ left: Math.max(strip.clientWidth * 0.85, 180) * direction, behavior: "smooth" });
}
function observeHomeSectionSentinel(category: string, element: Element | ComponentPublicInstance | null): void {
  const previous = homeSectionSentinels.get(category);
  const target = element instanceof Element ? element : null;
  if (previous && previous !== target) homeSectionObserver?.unobserve(previous);
  if (!target) {
    homeSectionSentinels.delete(category);
    return;
  }
  target.setAttribute("data-game-category", category);
  homeSectionSentinels.set(category, target);
  homeSectionObserver?.observe(target);
}
function handleHomeScroll(): void {
  showBackToTop.value = window.scrollY > 420;
}
function scrollHomeToTop(): void {
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function toggleFavorite(id: string): void {
  favorites.value = favorites.value.includes(id)
    ? favorites.value.filter((favorite) => favorite !== id)
    : [...favorites.value, id];
}
async function play(game: Game): Promise<void> {
  if (requireSignIn()) return;
  if (game.status !== 0) {
    notify("This game is currently unavailable");
    return;
  }
  if (launchingGameId.value !== null) return;
  selectedGame.value = game;
  launchingGameId.value = game.id;
  try {
    if (!await refreshGameWallet()) return;
    launchingGameId.value = null;
    if (gameWalletBalance.value > 0) {
      await launchGame(game, 0);
      return;
    }
    openGameFunding(game);
  } finally {
    launchingGameId.value = null;
  }
}
function openGameFunding(game: Game): void {
  selectedGame.value = game;
  gameFundingAmount.value = "";
  modal.value = "game-funding";
}
async function launchSelectedGame(): Promise<void> {
  const game = selectedGame.value;
  const amountToFund = Number(gameFundingAmount.value);
  const maxAmount = Math.min(Math.floor(balance.value * 100) / 100, 100_000_000);
  if (!game || !Number.isFinite(amountToFund) || amountToFund < 100 || amountToFund > maxAmount) {
    notify(`Choose an amount from ${currencyLabel.value} 100 to ${currencyLabel.value} ${formatMoney(maxAmount)}`);
    return;
  }
  await launchGame(game, amountToFund);
}
async function launchGame(game: Game, amountToFund: number): Promise<void> {
  if (launchingGameId.value !== null) return;
  launchingGameId.value = game.id;
  try {
    const platform = window.matchMedia("(max-width: 760px)").matches ? 2 : 1;
    const data = await api(`/api/games/${encodeURIComponent(game.id)}/launch`, {
      method: "POST",
      body: JSON.stringify({ amount: amountToFund, platform }),
    });
    if (typeof data.gameUrl !== "string") throw new Error("The provider returned an invalid game URL");
    let gameUrl: string;
    try {
      const parsedGameUrl = new URL(data.gameUrl);
      if (parsedGameUrl.protocol !== "https:") throw new Error("Invalid URL protocol");
      gameUrl = parsedGameUrl.toString();
    } catch {
      throw new Error("The provider returned an invalid game URL");
    }
    balance.value = Number(data.balance);
    if (user.value) user.value.balance = balance.value;
    gameWalletBalance.value = Number(data.gameWalletBalance);
    gameWalletCurrency.value = currencyCode.value;
    recentGames.value = [game, ...recentGames.value.filter((recent) => recent.id !== game.id)].slice(0, 30);
    modal.value = null;
    if (route.path !== "/games") await router.push("/games");
    activeGame.value = game;
    activeGameUrl.value = gameUrl;
    gameFrameLoading.value = true;
    gameFrameError.value = "";
    clearGameFrameLoadTimer();
    gameFrameLoadTimer = setTimeout(() => {
      if (gameFrameLoading.value) {
        gameFrameLoading.value = false;
        gameFrameError.value = "The provider did not finish loading the embedded game. Its frame policy may prevent in-site playback.";
      }
    }, 20_000);
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    if (amountToFund === 0 && error instanceof Error && error.message.includes("No Game Wallet balance")) {
      openGameFunding(game);
    } else {
      notify(error instanceof Error ? error.message : "Unable to play");
    }
  } finally {
    launchingGameId.value = null;
  }
}
function clearGameFrameLoadTimer(): void {
  if (gameFrameLoadTimer) clearTimeout(gameFrameLoadTimer);
  gameFrameLoadTimer = undefined;
}
function handleGameFrameLoad(): void {
  clearGameFrameLoadTimer();
  gameFrameLoading.value = false;
  gameFrameError.value = "";
}
function handleGameFrameError(): void {
  clearGameFrameLoadTimer();
  gameFrameLoading.value = false;
  gameFrameError.value = "The browser could not load this game inside the website. HUIDU may require its documented direct-launch method.";
}
function handleFullscreenChange(): void {
  gameFullscreen.value = document.fullscreenElement === gamePlayerFrame.value;
}
async function toggleGameFullscreen(): Promise<void> {
  const playerFrame = gamePlayerFrame.value;
  if (!playerFrame) return;
  try {
    if (document.fullscreenElement === playerFrame) await document.exitFullscreen();
    else await playerFrame.requestFullscreen();
  } catch (error) {
    notify(error instanceof Error ? `Fullscreen could not be opened: ${error.message}` : "Fullscreen is not available in this browser");
  }
}
function openGameWithProvider(): void {
  if (!activeGameUrl.value) {
    notify("The provider has not returned a game URL");
    return;
  }
  window.location.assign(activeGameUrl.value);
}
async function closeGame(): Promise<void> {
  const hadActiveGame = Boolean(activeGame.value);
  clearGameFrameLoadTimer();
  activeGame.value = null;
  activeGameUrl.value = "";
  gameFrameLoading.value = false;
  gameFrameError.value = "";
  await nextTick();
  if (hadActiveGame && signedIn.value && await refreshGameWallet()) {
    notify("Game closed. Remaining funds and winnings stay in your Game Wallet.");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}
async function submitWalletRequest(): Promise<void> {
  if (!walletKycVerified.value) {
    notify("Complete KYC verification and wait for approval before requesting a deposit or withdrawal");
    return;
  }
  const value = Number(amount.value);
  if (!value || value < 100) {
    notify(`Minimum ${walletRequestType.value === "deposit" ? "deposit" : "withdrawal"} is ${currencyLabel.value} 100`);
    return;
  }
  if (walletRequestType.value === "deposit" && value > 50000) {
    notify(`Maximum deposit is ${currencyLabel.value} 50,000`);
    return;
  }
  if (!paymentMethod.value.trim()) {
    notify(walletRequestType.value === "withdrawal" ? "Enter your withdrawal destination" : "Enter the payment method");
    return;
  }
  if (walletRequestType.value === "withdrawal" && paymentNote.value.trim().length < 6) {
    notify("Enter valid bank, UPI, or wallet account details");
    return;
  }
  if (walletRequestType.value === "deposit" && !paymentReference.value.trim()) {
    notify("Enter the payment or transaction reference");
    return;
  }
  if (walletRequestType.value === "deposit" && !paymentProof.value) {
    notify("Upload the payment receipt or screenshot");
    return;
  }
  const form = new FormData();
  form.append("type", walletRequestType.value);
  form.append("amount", String(value));
  form.append("paymentMethod", paymentMethod.value.trim());
  form.append("paymentReference", paymentReference.value.trim());
  form.append("paymentNote", paymentNote.value.trim());
  if (paymentProof.value) form.append("proof", paymentProof.value);
  walletSubmitting.value = true;
  try {
    await api("/api/wallet/request", {
      method: "POST",
      body: form,
    });
    modal.value = null;
    paymentMethod.value = "";
    paymentReference.value = "";
    paymentNote.value = "";
    paymentProof.value = undefined;
    paymentProofName.value = "";
    notify(`${walletRequestType.value === "deposit" ? "Deposit" : "Withdrawal"} request submitted for admin approval`);
  } catch (error) {
    notify(error instanceof Error ? error.message : "Request failed");
  } finally {
    walletSubmitting.value = false;
  }
}
async function continueDeposit(): Promise<void> {
  if (!walletKycVerified.value) {
    notify("Complete KYC verification and wait for approval before requesting a deposit");
    return;
  }
  const value = Number(amount.value);
  if (!value || value < 100 || value > 50000) {
    notify(`Enter a deposit amount between ${currencyLabel.value} 100 and 50,000`);
    return;
  }
  if (!paymentMethod.value.trim()) {
    notify("Choose or enter the payment method used");
    return;
  }
  depositDetailsExpanded.value = true;
  await nextTick();
  depositReferenceInput.value?.focus();
}
function askAboutDeposit(): void {
  supportSubject.value = "Deposit not showing in wallet";
  supportMessage.value = "I submitted a deposit, but it is not showing in my wallet. Please help me check its status.";
  modal.value = "support";
}
function askAboutPromotion(promotion: Promotion): void {
  if (requireSignIn()) return;
  supportSubject.value = `Promotion question: ${promotion.title}`.slice(0, 100);
  supportMessage.value = `Please confirm the eligibility and terms for the "${promotion.title}" offer.`;
  modal.value = "support";
}
function promotionMentionsDeposit(promotion: Promotion): boolean {
  return [promotion.title, promotion.description, promotion.reward, promotion.terms]
    .some((value) => value.toLowerCase().includes("deposit"));
}
function openPromotionAction(promotion: Promotion): void {
  if (!promotionMentionsDeposit(promotion)) {
    askAboutPromotion(promotion);
    return;
  }
  walletRequestType.value = "deposit";
  depositDetailsExpanded.value = false;
  showDepositPaymentDetails.value = false;
  void navigateTo("/wallet");
}
async function googleLogin(): Promise<void> {
  const clientId = googleClientId.value;
  if (!clientId) {
    notify("Google Sign-In is not configured");
    return;
  }
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript && (window as { google?: unknown }).google) {
        resolve();
        return;
      }
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("Could not load Google Sign-In")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Could not load Google Sign-In"));
      document.head.appendChild(script);
    });
  }
  await googleScriptPromise;
  const google = (window as unknown as {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }).google;
  if (!google?.accounts?.id) return;
  if (!googleInitialized) {
    google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        try {
          if (!authCountry.value) throw new Error("Select India or Pakistan before Google Sign-In");
          const data = await api("/api/auth/google", {
            method: "POST",
            body: JSON.stringify({
              credential: response.credential,
              country: authCountry.value,
              referralCode: authMode.value === "register" ? authReferralCode.value || undefined : undefined,
            }),
          });
          token.value = data.token;
          localStorage.setItem("b9_token", data.token);
          user.value = data.user;
          signedIn.value = true;
          balance.value = data.user.balance;
          modal.value = null;
          startInboxPolling();
          void showUnreadNotifications();
          authReferralCode.value = "";
          notify(`Welcome, ${data.user.username}!`);
        } catch (error) {
          notify(error instanceof Error ? error.message : "Google sign-in failed");
        }
      },
    });
    googleInitialized = true;
  }
  const buttonParent = document.querySelector<HTMLElement>("#google-signin-button");
  if (buttonParent) {
    buttonParent.replaceChildren();
    google.accounts.id.renderButton(buttonParent, {
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "pill",
      width: 280,
    });
  }
}
function setKycFile(field: "front" | "back" | "selfie", event: Event): void {
  const input = event.target as HTMLInputElement;
  kycFiles.value[field] = input.files?.[0];
}
function setPaymentProof(event: Event): void {
  const input = event.target as HTMLInputElement;
  paymentProof.value = input.files?.[0];
  paymentProofName.value = input.files?.[0]?.name || "";
}
async function submitKyc(): Promise<void> {
  if (!signedIn.value) return;
  if (!kycCountry.value || !kycFullName.value || !kycDob.value || !kycDocumentType.value || !kycDocumentNumber.value) {
    notify("Complete all KYC fields");
    return;
  }
  if (!kycFiles.value.front || !kycFiles.value.selfie || (kycCountry.value === "PK" && kycDocumentType.value === "cnic" && !kycFiles.value.back)) {
    notify("Upload the required identity documents");
    return;
  }
  const form = new FormData();
  form.append("country", kycCountry.value);
  form.append("fullName", kycFullName.value);
  form.append("dateOfBirth", kycDob.value);
  form.append("documentType", kycDocumentType.value);
  form.append("documentNumber", kycDocumentNumber.value);
  form.append("address", kycAddress.value);
  if (kycFiles.value.front) form.append("front", kycFiles.value.front);
  if (kycFiles.value.back) form.append("back", kycFiles.value.back);
  if (kycFiles.value.selfie) form.append("selfie", kycFiles.value.selfie);
  kycLoading.value = true;
  try {
    const headers = new Headers();
    if (token.value) headers.set("Authorization", "Bearer " + token.value);
    const response = await fetch("/api/auth/kyc", { method: "POST", headers, body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "KYC submission failed");
    user.value = data.user;
    modal.value = null;
    notify("KYC submitted for admin review");
  } catch (error) {
    notify(error instanceof Error ? error.message : "KYC submission failed");
  } finally {
    kycLoading.value = false;
  }
}
async function submitAuth(): Promise<void> {
  authLoading.value = true;
  try {
    const path = authMode.value === "login" ? "/api/auth/login" : "/api/auth/register";
    const data = await api(path, {
      method: "POST",
      body: JSON.stringify({
        username: authUsername.value,
        email: authEmail.value,
        password: authPassword.value,
        country: authMode.value === "register" ? authCountry.value : undefined,
        referralCode: authMode.value === "register" ? authReferralCode.value || undefined : undefined,
      }),
    });
    token.value = data.token;
    localStorage.setItem("b9_token", data.token);
    user.value = data.user;
    signedIn.value = true;
    balance.value = data.user.balance;
    modal.value = null;
    startInboxPolling();
    void showUnreadNotifications();
    authPassword.value = "";
    if (authMode.value === "register") {
      authCountry.value = "";
      authReferralCode.value = "";
    }
    notify(authMode.value === "login" ? `Welcome back, ${data.user.username}!` : "Account created successfully");
  } catch (error) {
    notify(error instanceof Error ? error.message : "Authentication failed");
  } finally {
    authLoading.value = false;
  }
}
function toggleSignIn(): void {
  if (signedIn.value) {
    if (activeGame.value) {
      void closeGame().finally(signOut);
      return;
    }
    signOut();
  } else {
    authMode.value = "login";
    modal.value = "auth";
  }
}
function signOut(): void {
  token.value = "";
  localStorage.removeItem("b9_token");
  signedIn.value = false;
  user.value = null;
  balance.value = 0;
  referralData.value = null;
  unreadCount.value = 0;
  inboxMessages.value = [];
  if (inboxTimer) clearInterval(inboxTimer);
  notify("Signed out");
}
function openProfile(): void {
  if (!requireSignIn()) modal.value = "profile";
}
function openProfileActions(): void {
  if (!requireSignIn()) modal.value = "profile-actions";
}
async function openTransactionHistory(filter: "all" | "deposit" | "withdrawal" = "all"): Promise<void> {
  if (requireSignIn()) return;
  transactionFilter.value = filter;
  modal.value = "transactions";
  await loadWalletTransactions();
}
async function loadWalletTransactions(): Promise<void> {
  if (!signedIn.value) return;
  transactionLoading.value = true;
  try {
    const data = await api("/api/wallet/transactions");
    walletTransactions.value = data.transactions || [];
  } catch (error) {
    walletTransactions.value = [];
    notify(error instanceof Error ? error.message : "Could not load transaction history");
  } finally {
    transactionLoading.value = false;
  }
}
function handleProfileShortcut(action: ProfileShortcutAction): void {
  switch (action) {
    case "wallet":
      void selectAccountSection("wallet");
      break;
    case "withdrawal":
      void selectAccountSection("withdrawal");
      break;
    case "promotions":
      navigateTo("/promotions");
      break;
    case "transactions":
      void openTransactionHistory();
      break;
    case "profile":
      openProfileActions();
      break;
    case "security":
      openKyc();
      break;
    case "notifications":
      void openInbox();
      break;
    case "favorites":
      showFavorites();
      break;
    case "support":
      modal.value = "support";
      break;
  }
}
function openKyc(): void {
  if (requireSignIn()) return;
  modal.value = "kyc";
}
function showFavorites(): void {
  modal.value = "favorites";
}
function showAuth(): void {
  authMode.value = "login";
  modal.value = "auth";
}
async function loadReferralData(): Promise<void> {
  if (!signedIn.value) return;
  const requestId = ++referralRequestId;
  const requestToken = token.value;
  referralLoading.value = true;
  referralError.value = "";
  try {
    const data = await api("/api/referrals");
    if (requestId === referralRequestId && signedIn.value && token.value === requestToken) {
      referralData.value = data;
    }
  } catch (error) {
    if (requestId === referralRequestId && token.value === requestToken) {
      referralError.value = error instanceof Error ? error.message : "Could not load referral activity";
    }
  } finally {
    if (requestId === referralRequestId) referralLoading.value = false;
  }
}

async function loadRewardsDashboard(force = false): Promise<boolean> {
  if (!signedIn.value || (!force && route.path !== "/rewards")) return false;
  const requestId = ++rewardsRequestId;
  const requestToken = token.value;
  rewardsLoading.value = true;
  rewardsError.value = "";
  try {
    const data = await api("/api/rewards");
    if (requestId === rewardsRequestId && signedIn.value && token.value === requestToken) {
      rewardsDashboard.value = data;
      return true;
    }
    return false;
  } catch (error) {
    if (requestId === rewardsRequestId && token.value === requestToken) {
      rewardsError.value = error instanceof Error ? error.message : "Could not load rewards";
    }
    return false;
  } finally {
    if (requestId === rewardsRequestId) rewardsLoading.value = false;
  }
}

async function claimDailyReward(): Promise<void> {
  if (!rewardsDashboard.value?.daily.claimable || dailyClaiming.value) return;
  dailyClaiming.value = true;
  dailyClaimError.value = "";
  try {
    const result = await api("/api/rewards/daily/claim", { method: "POST" });
    balance.value = result.balance;
    if (user.value) user.value.balance = result.balance;
    notify(`${currencyLabel.value} ${formatAmount(result.amount)} daily reward credited`);
    await loadRewardsDashboard(route.path === "/rewards");
  } catch (error) {
    dailyClaimError.value = error instanceof Error ? error.message : "Could not claim today's reward";
    await loadRewardsDashboard(route.path === "/rewards");
  } finally {
    dailyClaiming.value = false;
  }
}

async function redeemBonusCode(): Promise<void> {
  const code = bonusCodePreview.value?.code;
  if (!code || bonusCodeRedeeming.value) return;
  bonusCodeRedeeming.value = true;
  bonusCodeError.value = "";
  bonusCodeMessage.value = "";
  try {
    const result = await api("/api/rewards/bonus-codes/redeem", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    balance.value = result.balance;
    if (user.value) user.value.balance = result.balance;
    bonusCodeInput.value = "";
    bonusCodePreview.value = null;
    bonusCodeMessage.value = `${currencyLabel.value} ${formatAmount(result.amount)} credited to your Main Wallet.`;
    notify("Bonus code redeemed successfully");
  } catch (error) {
    bonusCodeError.value = error instanceof Error ? error.message : "Could not redeem this bonus code";
  } finally {
    bonusCodeRedeeming.value = false;
  }
}

async function previewBonusCode(): Promise<void> {
  const code = bonusCodeInput.value.trim().toUpperCase();
  if (!code || bonusCodeChecking.value || bonusCodeRedeeming.value) return;
  bonusCodeChecking.value = true;
  bonusCodeError.value = "";
  bonusCodeMessage.value = "";
  bonusCodePreview.value = null;
  try {
    bonusCodePreview.value = await api("/api/rewards/bonus-codes/preview", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  } catch (error) {
    bonusCodeError.value = error instanceof Error ? error.message : "Could not check this bonus code";
  } finally {
    bonusCodeChecking.value = false;
  }
}

function clearBonusCodePreview(): void {
  bonusCodePreview.value = null;
  bonusCodeError.value = "";
  bonusCodeMessage.value = "";
}

function referralLink(): string {
  return `${window.location.origin}/?ref=${encodeURIComponent(referralData.value?.code || "")}`;
}
async function copyReferralLink(): Promise<void> {
  if (!referralData.value?.code) return;
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable in this browser");
    await navigator.clipboard.writeText(referralLink());
    notify("Referral invite link copied");
  } catch (error) {
    notify(error instanceof Error ? error.message : "Could not copy referral invite link");
  }
}
async function shareReferralLink(): Promise<void> {
  if (!referralData.value?.code) return;
  const url = referralLink();
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Join me on B9 Game",
        text: `Use my referral code ${referralData.value.code} to join B9 Game.`,
        url,
      });
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") notify(error.message);
    }
    return;
  }
  await copyReferralLink();
}
function formatReferralStatus(status: string): string {
  return ({ pending: "Pending review", approved: "Reward credited", rejected: "Not approved" } as Record<string, string>)[status] || status;
}
</script>

<style>
:root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #355342;
  background: #edf3ee;
  font-synthesis: none;
  font-optical-sizing: auto;
  font-smooth: always;
  -webkit-tap-highlight-color: transparent;
}
* { box-sizing: border-box; }
html { min-width: 320px; min-height: 100%; background: #edf3ee; scroll-behavior: smooth; }
body { margin: 0; min-height: 100vh; min-height: 100dvh; }
button, input, select, textarea { font: inherit; }
button { cursor: pointer; -webkit-tap-highlight-color: transparent; }
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
  outline: 3px solid rgb(30 159 82 / 55%);
  outline-offset: 3px;
}
.page-frame {
  width: min(100%, 1440px);
  min-height: 100vh;
  min-height: 100dvh;
  margin: 0 auto;
  padding-bottom: calc(86px + env(safe-area-inset-bottom));
  overflow: clip;
  background: #f5f8f5;
  box-shadow: 0 0 42px rgb(34 70 45 / 7%);
}
.desktop-nav { display: none; }
.topbar {
  position: sticky;
  z-index: 6;
  top: 0;
  display: flex;
  min-height: 64px;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  color: #fff;
  background: #159447;
  box-shadow: 0 4px 16px rgb(19 99 49 / 14%);
}
.header-icon { display: grid; flex: 0 0 auto; place-items: center; padding: 0; border: 0; color: inherit; background: none; }
.menu-button { width: 25px; }
.public-brand {
  display: flex;
  width: 112px;
  min-width: 112px;
  height: 48px;
  flex: 0 0 112px;
  align-items: center;
  gap: 6px;
  color: white;
  text-decoration: none;
}
.brand-emblem {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  object-fit: cover;
  border: 2px solid #159447;
  border-radius: 10px;
  background: #159447;
}
.brand-wordmark {
  display: block;
  overflow: visible;
  white-space: nowrap;
  font-size: 17px;
  font-weight: 900;
  letter-spacing: -.6px;
}
.header-actions { display: flex; min-width: 0; flex: 1; align-items: center; justify-content: flex-end; gap: 5px; }
.balance-button {
  display: flex;
  height: 38px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 8px;
  border: 0;
  border-radius: 12px;
  color: #344c3c;
  background: white;
  white-space: nowrap;
}
.balance-button { min-width: 0; padding: 0 7px; }
.wallet-icon { flex: 0 0 auto; color: #20aa5b; fill: #20aa5b; }
.balance-value { color: #b66b35; font-size: clamp(11px, 3.2vw, 14px); font-weight: 750; font-variant-numeric: tabular-nums; }
.add-icon { display: grid; width: 21px; height: 21px; flex: 0 0 auto; place-items: center; border-radius: 50%; color: white; background: #26b76b; }
.search-button { width: 25px; }
.search-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 9px 14px 12px;
  background: #20b763;
}
.search-input-icon, .clear-search { flex: 0 0 auto; color: #fff; }
.search-wrap input { width: 100%; padding: 9px 12px; border: 0; border-radius: 10px; outline: none; color: #273f31; background: #fff; }
.clear-search { display: grid; place-items: center; padding: 2px; border: 0; background: none; }
.content { display: flex; width: min(100%, 1320px); flex-direction: column; gap: 13px; margin: 0 auto; padding: 13px 13px 20px; }
.homepage-custom-banner { position: relative; max-height: 320px; aspect-ratio: 1240 / 520; overflow: hidden; border-radius: 20px; color: #fff; background: #075e35; box-shadow: 0 3px 12px rgb(32 98 51 / 5%); }
.homepage-custom-banner::after { position: absolute; inset: 0; content: ""; background: linear-gradient(90deg, rgb(3 63 31 / 82%) 0%, rgb(3 63 31 / 42%) 54%, transparent 100%); pointer-events: none; }
.homepage-custom-banner--creative::after { display: none; }
.homepage-custom-banner-image { display: block; width: 100%; height: 100%; object-fit: cover; }
.homepage-custom-banner-copy { position: absolute; z-index: 1; inset: 0 auto 0 0; display: flex; width: min(68%, 680px); flex-direction: column; align-items: flex-start; justify-content: center; gap: 8px; padding: clamp(16px, 5vw, 52px); text-shadow: 0 1px 5px rgb(0 40 18 / 38%); }
.homepage-custom-banner-copy h2 { margin: 0; font-size: clamp(21px, 5vw, 42px); font-weight: 850; line-height: 1.08; }
.homepage-custom-banner-copy p { max-width: 520px; margin: 0; font-size: clamp(12px, 2.4vw, 17px); line-height: 1.45; }
.homepage-custom-banner-button { min-height: 38px; margin-top: 5px; padding: 8px 18px; border: 0; border-radius: 999px; color: #075e35; background: #fff; font: inherit; font-size: 13px; font-weight: 800; text-shadow: none; cursor: pointer; }
.homepage-custom-banner-full-link { position: absolute; z-index: 1; inset: 0; width: 100%; height: 100%; border: 0; background: transparent; cursor: pointer; }
.homepage-custom-banner-full-link:focus-visible { outline: 3px solid #fff; outline-offset: -5px; }
@media (max-width: 767px) {
  /* Reserve the strip at the bottom of the banner for the slide controls. */
  .hero-copy { padding-bottom: 46px; }
  .homepage-custom-banner-copy { width: 76%; gap: 6px; padding: 12px 16px; }
  .homepage-custom-banner-copy h2 { font-size: clamp(17px, 5.4vw, 28px); }
  .homepage-custom-banner-copy p { font-size: clamp(11px, 3.2vw, 14px); }
  .homepage-custom-banner-button { min-height: 32px; padding: 6px 13px; font-size: 11px; }
}
@media (max-width: 430px) {
  /* Room for the slide controls without crowding the claim button. */
  .hero { aspect-ratio: auto; min-height: 172px; }
}
@media (max-width: 360px) {
  /* Narrow phones cannot fit the copy plus the slide controls at the default
     ratio, so give the banner a floor height instead of clipping the title. */
  .hero { aspect-ratio: auto; min-height: 196px; }
  .hero-copy { padding-bottom: 54px; }
  .hero-nav { right: 9px; bottom: 7px; left: 9px; gap: 6px; }
  .hero-arrow { width: 24px; height: 24px; }
  .hero-dots { padding: 5px 7px; gap: 5px; }
  .hero-dots button { width: 6px; height: 6px; }
  .hero-dots button.selected { width: 15px; }
}
.welcome-banner { position: relative; display: block; min-height: 0; aspect-ratio: 1240 / 520; overflow: hidden; padding: 0; border: 2px solid #159447; border-radius: 25px; color: white; background: #075e35; }
.welcome-banner::before { display: none; }
.welcome-banner-image { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: cover; object-position: center; }
.welcome-banner-copy { display: none; }
.welcome-banner .eyebrow { color: #9af0b4; }
.welcome-banner h1 { margin: 6px 0; color: white; font-size: clamp(21px, 6vw, 32px); }
.welcome-banner p { max-width: 560px; margin: 0; color: rgb(255 255 255 / 88%); font-size: 13px; line-height: 1.5; }
.welcome-banner .primary-button { position: absolute; z-index: 2; right: 12%; bottom: 13%; min-height: 42px; flex: 0 0 auto; border: 0; border-radius: 999px; background: #32bc68; box-shadow: none; }
.announcement { display: flex; min-height: 43px; align-items: center; gap: 10px; padding: 5px 7px 5px 14px; border-radius: 14px; color: #426d51; background: #e7f4e9; }
.announcement-volume { flex: 0 0 auto; color: #36a564; fill: #36a564; }
.announcement p { flex: 1; overflow: hidden; margin: 0; font-size: clamp(11px, 3.4vw, 14px); white-space: nowrap; text-overflow: ellipsis; }
.inbox-button { position: relative; display: grid; width: 38px; height: 38px; flex: 0 0 auto; place-items: center; border: 0; border-radius: 10px; color: white; background: #17a854; }
.inbox-badge { position: absolute; top: -6px; right: -7px; min-width: 18px; height: 18px; padding: 0 4px; border: 2px solid white; border-radius: 999px; color: white; background: #df3f4b; font-size: 9px; font-weight: 800; line-height: 14px; }
.categories { display: flex; min-height: 96px; align-items: center; padding: 8px 7px 6px; border: 1px solid #edf1ed; border-radius: 19px; background: white; box-shadow: 0 5px 18px rgb(27 88 47 / 5%); }
.category-arrow { display: grid; width: 24px; flex: 0 0 24px; place-items: center; padding: 0; border: 0; color: #8d9991; background: none; }
.category-list { display: flex; flex: 1; justify-content: space-around; gap: 2px; overflow-x: auto; scrollbar-width: none; }
.category-list::-webkit-scrollbar { display: none; }
.category { display: flex; min-width: 56px; flex: 1; flex-direction: column; align-items: center; justify-content: flex-end; gap: 4px; padding: 0; border: 0; color: #707b73; background: none; font-size: 12px; }
.category-icon { display: grid; width: 56px; height: 39px; place-items: center; color: #16994d; }
.category-icon-brand { padding: 4px; border: 1px solid #edf1ed; border-radius: 8px; background: #fff; }
.category-image { display: block; width: 100%; height: 100%; object-fit: contain; }
.category:first-child .category-icon svg { fill: currentColor; stroke: #16994d; }
.category-label { padding: 0 3px 5px; border-bottom: 2px solid transparent; white-space: nowrap; }
.category.selected .category-label { border-color: #27a95c; color: #315940; font-weight: 700; }
.category-mark { display: grid; place-items: center; color: #13a356; font-size: 23px; font-weight: 900; line-height: 1; }
.category-mark.pg-slot { width: 30px; height: 30px; border-radius: 50% 50% 45% 45%; color: #fff; background: #18a657; font-size: 13px; letter-spacing: -1px; }
.spribe-mark { width: 56px; height: 29px; overflow: visible; fill: none; stroke: #129b50; stroke-width: 2; stroke-linecap: square; stroke-linejoin: miter; }
.spribe-mark > path:not(.digit-divider) { stroke-width: 2.8; }
.spribe-mark > .digit-divider { stroke-width: 1; }
.category-mark.inout { font-size: 23px; font-style: italic; letter-spacing: -3px; }
.pg-slot-mark { width: 34px; height: 34px; filter: drop-shadow(0 2px 2px rgb(21 142 74 / 12%)); }
.jackpot {
  position: relative;
  aspect-ratio: 3.16 / 1;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.jackpot-banner {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
  object-position: center;
}
.jackpot-value {
  position: absolute;
  z-index: 2;
  left: 50%;
  bottom: 24%;
  width: 52%;
  padding: 3px 6px;
  transform: translateX(-50%);
  color: #17683a;
  font-size: clamp(13px, 4vw, 21px);
  font-weight: 900;
  line-height: 1;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.game-player { display: flex; flex-direction: column; gap: 12px; }
.game-player-heading { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
.game-player-heading h1 { margin: 3px 0 0; color: #284b35; font-size: clamp(20px, 5vw, 30px); }
.game-back-button { display: inline-flex; min-height: 40px; align-items: center; gap: 5px; padding: 7px 12px; border: 1px solid #dfe8e0; border-radius: 10px; color: #355342; background: #fff; font-weight: 700; }
.game-fullscreen-button { min-height: 40px; padding: 7px 12px; border: 0; border-radius: 10px; color: #fff; background: #168446; font-weight: 700; white-space: nowrap; }
.game-player-frame { position: relative; width: 100%; height: min(68vh, 760px); min-height: 340px; overflow: hidden; border: 1px solid #dfe8e0; border-radius: 15px; background: #101914; box-shadow: 0 6px 24px rgb(22 54 31 / 12%); }
.page-frame.game-active .game-player-frame:fullscreen { width: 100vw; height: 100vh; height: 100dvh; min-height: 0; max-height: none; border: 0; border-radius: 0; box-shadow: none; }
.page-frame.game-active .game-player-frame:fullscreen::backdrop { background: #101914; }
.game-player-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: #101914; }
.game-frame-status, .game-frame-error { position: absolute; z-index: 1; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px; color: #fff; background: rgb(16 25 20 / 94%); text-align: center; }
.game-frame-status { flex-direction: row; }
.game-frame-status .loading-spinner { width: 24px; height: 24px; flex: 0 0 auto; border-color: rgb(255 255 255 / 28%); border-top-color: #69d991; }
.game-frame-error strong { font-size: 18px; }
.game-frame-error p { max-width: 560px; margin: 0; color: rgb(255 255 255 / 82%); line-height: 1.5; }
.game-frame-error .primary-button { min-height: 42px; }
.game-player-help { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 13px 15px; border: 1px solid #e8eee8; border-radius: 12px; background: #fff; }
.game-player-help p { flex: 1 1 280px; margin: 0; color: #68796d; font-size: 13px; line-height: 1.5; }
.game-provider-launch { min-height: 40px; padding: 8px 13px; border: 0; border-radius: 9px; color: #fff; background: #168446; font-size: 13px; font-weight: 700; }
.game-category-sections { display: grid; gap: 18px; }
.game-category-section { min-width: 0; padding: 14px 12px 16px; border: 1px solid #edf1ed; border-radius: 18px; background: #fff; box-shadow: 0 5px 18px rgb(31 72 43 / 4%); }
.game-category-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.game-category-heading h2 { margin: 0; color: #284b35; font-size: clamp(17px, 4vw, 22px); }
.game-category-heading button { display: inline-flex; min-height: 36px; align-items: center; gap: 3px; padding: 6px 9px; border: 0; border-radius: 9px; color: #168446; background: #eaf6ed; font-size: 12px; font-weight: 750; white-space: nowrap; }
.game-category-strip { display: flex; gap: 11px; overflow-x: auto; padding: 2px 2px 10px; scroll-snap-type: x mandatory; scrollbar-width: thin; }
.game-category-strip .game-card { width: clamp(145px, 42vw, 205px); flex: 0 0 auto; scroll-snap-align: start; }
.page-frame.game-active { display: flex; width: 100%; height: 100vh; height: 100dvh; min-height: 0; flex-direction: column; padding-bottom: 0; overflow: hidden; }
.page-frame.game-active .topbar { flex: 0 0 auto; }
.page-frame.game-active .desktop-nav, .page-frame.game-active .bottom-nav, .page-frame.game-active .search-wrap { display: none; }
.page-frame.game-active .content { width: 100%; max-width: none; min-height: 0; flex: 1 1 auto; gap: 0; margin: 0; padding: 8px max(8px, env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left)); overflow: hidden; }
.page-frame.game-active .game-player { min-height: 0; flex: 1 1 auto; gap: 8px; }
.page-frame.game-active .game-player-heading { display: grid; min-width: 0; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 8px; }
.page-frame.game-active .game-player-heading h1 { overflow: hidden; font-size: clamp(15px, 4vw, 22px); text-overflow: ellipsis; white-space: nowrap; }
.page-frame.game-active .game-player-frame { height: auto; min-height: 0; flex: 1 1 auto; border-radius: 10px; box-shadow: none; }
.page-frame.game-active .game-player-help { display: none; }
.catalog-error button, .catalog-empty button { padding: 8px 12px; border: 0; border-radius: 9px; color: #197744; background: #e7f4e9; font-size: 12px; font-weight: 700; }
.catalog-error, .catalog-empty { padding: 20px; border: 1px solid #f0dfc0; border-radius: 14px; color: #795b27; background: #fffaf0; text-align: center; }
.catalog-error p, .catalog-empty p { margin: 0 0 12px; }
.catalog-empty h2 { margin: 0 0 8px; color: #355342; font-size: 18px; }
.games-panel { padding: 14px 12px 16px; border: 1px solid #edf1ed; border-radius: 20px; background: white; box-shadow: 0 5px 18px rgb(31 72 43 / 4%); }
.games-panel-full { padding: 18px; }
.section-heading { display: flex; align-items: center; justify-content: space-between; margin: 0 4px 10px; }
.section-heading h2 { display: flex; align-items: center; gap: 7px; margin: 0; color: #385e46; font-size: 16px; font-weight: 750; }
.section-flame { color: #169b4d; }
.view-all { display: flex; align-items: center; gap: 4px; padding: 6px 10px; border: 0; border-radius: 99px; color: #50765b; background: #edf6ed; font-size: 12px; }
.game-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.page-games .game-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 14px; }
.games-loading-more, .games-end-message { display: flex; min-height: 48px; align-items: center; justify-content: center; gap: 9px; color: #63806b; font-size: 13px; }
.games-load-sentinel { width: 100%; height: 1px; }
.loading-spinner { width: 17px; height: 17px; border: 2px solid #d5e8d8; border-top-color: #159447; border-radius: 50%; animation: game-spinner .7s linear infinite; }
.games-load-error { margin-top: 12px; }
@keyframes game-spinner { to { transform: rotate(360deg); } }
.page-home .game-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; }
.game-card { position: relative; aspect-ratio: .9; overflow: hidden; border: 1px solid rgb(20 70 35 / 8%); border-radius: 17px; background: #138841; cursor: pointer; isolation: isolate; box-shadow: 0 5px 13px rgb(28 69 39 / 10%); transition: transform .18s ease, box-shadow .18s ease; }
.game-card:active { transform: scale(.985); }
.game-card > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .22s ease; }
.game-card:hover > img { transform: scale(1.04); }
.game-shade { position: absolute; z-index: 1; inset: 0; background: linear-gradient(180deg, rgb(0 25 10 / 16%) 0%, transparent 34%, rgb(0 24 12 / 44%) 100%); }
.game-card.fortune-card > img { filter: none; }
.game-brand { position: absolute; z-index: 2; top: 9px; left: 8px; color: white; font-size: clamp(8px, 2.4vw, 11px); font-weight: 900; text-decoration: underline; text-shadow: 0 1px 3px rgb(0 0 0 / 40%); }
.game-art-title { position: absolute; z-index: 2; right: 3px; bottom: 27px; left: 3px; color: white; font-size: clamp(12px, 4vw, 20px); font-style: italic; font-weight: 1000; line-height: .95; text-align: center; text-shadow: 1px 2px 2px #1d2220, -1px -1px 1px rgb(255 255 255 / 55%); }
.game-name { position: absolute; z-index: 2; right: 4px; bottom: 7px; left: 4px; color: white; font-size: 12px; font-weight: 700; text-align: center; text-shadow: 0 1px 3px rgb(0 0 0 / 55%); }
.game-status { position: absolute; z-index: 3; top: 50%; left: 50%; padding: 6px 10px; border-radius: 999px; background: rgb(0 0 0 / 75%); color: white; font-size: 11px; font-weight: 700; transform: translate(-50%, -50%); }
.game-unavailable { cursor: not-allowed; }
.game-unavailable > img { filter: grayscale(.8) brightness(.65); }
.favorite-button { position: absolute; z-index: 3; top: 7px; right: 7px; display: grid; width: 27px; height: 27px; place-items: center; padding: 0; border: 0; border-radius: 50%; color: #267c48; background: white; box-shadow: 0 2px 6px rgb(0 0 0 / 12%); }
.favorite-button svg { fill: none; }
.favorite-button[aria-label="Remove favorite"] svg { fill: currentColor; }
.favorite-button svg, .bottom-nav button > svg, .header-icon svg, .inbox-button svg { display: block; flex-shrink: 0; }
.game-card:focus-visible { outline: 3px solid #26a85c; outline-offset: 3px; }
.bottom-nav button { line-height: 1.2; }
.empty-state { padding: 20px 0; color: #6d786f; text-align: center; font-size: 13px; }
.bottom-nav {
  position: fixed;
  z-index: 5;
  bottom: 0;
  left: 50%;
  display: flex;
  width: 100%;
  min-height: 76px;
  align-items: flex-end;
  justify-content: space-around;
  padding: 9px 12px calc(8px + env(safe-area-inset-bottom));
  border: 1px solid #edf1ed;
  border-radius: 22px 22px 0 0;
  background: rgb(255 255 255 / 97%);
  box-shadow: 0 -5px 22px rgb(32 79 46 / 10%);
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
  transform: translateX(-50%);
}
.bottom-nav button { display: flex; min-width: 48px; flex-direction: column; align-items: center; gap: 3px; padding: 0; border: 0; color: #9da69f; background: none; font-size: 10px; }
.bottom-nav button > svg { stroke-width: 2; }
.bottom-nav button.active-nav { color: #159a4b; }
.bottom-nav .wallet-circle { display: grid; width: 53px; height: 53px; margin-top: -28px; margin-bottom: 1px; place-items: center; border-radius: 50%; color: #fff; background: #1caf58; box-shadow: 0 3px 8px rgb(29 126 62 / 20%); }
.modal-backdrop { position: fixed; z-index: 10; inset: 0; display: flex; align-items: flex-end; justify-content: center; background: rgb(17 35 23 / 55%); }
.modal-sheet { width: min(100%, 480px); max-height: 82vh; overflow-y: auto; padding: 18px 18px calc(28px + env(safe-area-inset-bottom)); border-radius: 25px 25px 0 0; background: white; }
.notification-backdrop { align-items: center; padding: 16px; background: rgb(7 22 13 / 78%); -webkit-backdrop-filter: blur(9px); backdrop-filter: blur(9px); }
.modal-sheet.notification-dialog { width: min(460px, 100%); max-height: min(88vh, 720px); padding: 18px; border: 1px solid #426b4e; border-radius: 24px; color: #f3fbf4; background: radial-gradient(ellipse at 50% 0%, #1d3d29 0%, #102719 56%, #09170e 100%); box-shadow: 0 24px 80px rgb(0 0 0 / 48%); }
.modal-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.modal-heading h2 { margin: 0; color: #315940; font-size: 19px; text-transform: capitalize; }
.notification-dialog .modal-heading { position: relative; justify-content: center; margin-bottom: 16px; padding: 4px 46px 14px; border-bottom: 1px solid rgb(205 234 211 / 14%); }
.notification-dialog .modal-heading h2 { color: #f4fbf5; font-size: 21px; font-weight: 850; text-align: center; text-transform: none; }
.close-button { display: grid; width: 32px; height: 32px; place-items: center; border: 0; border-radius: 50%; color: #59665d; background: #f0f5f0; }
.notification-dialog .close-button { position: absolute; top: 0; right: 0; width: 38px; height: 38px; border: 1px solid rgb(209 236 215 / 20%); color: #eff8f0; background: rgb(255 255 255 / 8%); }
.modal-content { display: flex; flex-direction: column; gap: 12px; }
.game-funding-shortfall { display: flex; flex-direction: column; gap: 8px; padding: 14px; border: 1px solid #f0dfc0; border-radius: 12px; color: #795b27; background: #fffaf0; font-size: 13px; line-height: 1.45; }
.game-funding-shortfall span { color: #7b725f; }
.bonus-note { margin: 0; padding: 9px; border-radius: 9px; color: #267c36; background: #e5f3e3; font-size: 13px; }
.game-wallet-panel { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px; border: 1px solid #dce9df; border-radius: 10px; background: #f7fbf7; }
.game-wallet-panel > div { display: grid; gap: 3px; }
.game-wallet-panel strong { color: #315940; font-size: 13px; }
.game-wallet-panel small { color: #667469; font-size: 12px; }
.game-wallet-panel button { flex: 0 0 auto; padding: 9px 11px; border: 0; border-radius: 9px; color: white; background: #188546; font-size: 12px; font-weight: 700; }
.game-wallet-panel button:disabled { opacity: .6; }
.amount-options { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.amount-options button { padding: 9px 3px; border: 1px solid #d5ded6; border-radius: 9px; background: white; font-size: 13px; }
.amount-options button.chosen { border-color: #319d42; background: #e5f3e3; font-weight: 700; }
.amount-input { width: 100%; padding: 11px 14px; border: 1px solid #d5ded6; border-radius: 12px; outline-color: #27a95c; }
.manual-payment-details { padding: 11px; border-radius: 10px; background: #edf5ef; }
.manual-payment-details p { margin: 5px 0 0; font-size: 12px; overflow-wrap: anywhere; }
.manual-payment-details p span { color: #718076; }
.manual-payment-details small { display: block; margin-top: 7px; color: #667469; line-height: 1.45; }
.manual-note { width: 100%; resize: vertical; padding: 11px 14px; border: 1px solid #d5ded6; border-radius: 12px; font-family: inherit; outline-color: #27a95c; }
.payment-proof-label { display: flex; flex-direction: column; gap: 6px; color: #536358; font-size: 12px; }
.payment-proof-label input { min-height: 42px; padding: 7px; border: 1px dashed #d5ded6; border-radius: 10px; }
.primary-button { border: 0; border-radius: 999px; padding: 8px 14px; color: white; background: #23ae5e; font-weight: 650; }
.page-section { display: flex; flex-direction: column; gap: 14px; padding: 8px 2px 18px; }
.page-heading { padding: 12px 4px 4px; }
.page-heading h1 { margin: 4px 0 6px; color: #233d2d; font-size: clamp(26px, 7vw, 36px); letter-spacing: -.04em; }
.page-heading p { max-width: 560px; margin: 0; color: #748078; font-size: 14px; line-height: 1.5; }
.eyebrow { color: #23944f; font-size: 10px; font-weight: 800; letter-spacing: .12em; }
.promotions-page { gap: 16px; }
.promotion-feature-card { display: flex; align-items: center; gap: 14px; padding: 16px; border: 1px solid #dcebdd; border-radius: 17px; background: #f3faf4; }
.promotion-feature-icon { display: grid; width: 42px; height: 42px; flex: 0 0 42px; place-items: center; border-radius: 13px; color: #218c49; background: #e2f2e5; }
.promotion-feature-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 4px; }
.promotion-feature-copy > span { color: #248b4b; font-size: 9px; font-weight: 850; letter-spacing: .12em; }
.promotion-feature-copy strong { overflow: hidden; color: #254331; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.promotion-feature-copy small { display: -webkit-box; overflow: hidden; color: #718077; font-size: 11px; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.promotion-feature-action { display: inline-flex; min-height: 40px; flex: 0 0 auto; align-items: center; justify-content: center; gap: 5px; padding: 0 13px; border: 0; border-radius: 999px; color: white; background: #218f4b; font-size: 11px; font-weight: 750; cursor: pointer; }
.promotion-filter-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; padding: 5px; border: 1px solid #e4ece5; border-radius: 14px; background: #f5f8f5; }
.promotion-filter-tabs button { display: flex; min-width: 0; min-height: 40px; align-items: center; justify-content: center; gap: 7px; padding: 7px 10px; border: 1px solid transparent; border-radius: 10px; color: #748078; background: transparent; font-size: 11px; font-weight: 700; cursor: pointer; }
.promotion-filter-tabs button.active { border-color: #dcebdd; color: #247e43; background: white; box-shadow: 0 2px 6px rgb(34 75 46 / 7%); }
.promotion-filter-tabs button span { min-width: 21px; padding: 2px 5px; border-radius: 999px; color: #64746a; background: #edf2ed; font-size: 10px; text-align: center; }
.promotion-rewards-link { display: flex; min-height: 68px; align-items: center; gap: 12px; padding: 12px 15px; border: 1px solid #e1ebe2; border-radius: 15px; color: #345240; background: white; text-align: left; cursor: pointer; }
.promotion-rewards-icon { display: grid; width: 38px; height: 38px; flex: 0 0 38px; place-items: center; border-radius: 12px; color: #258b4a; background: #ebf6ed; }
.promotion-rewards-link > span:nth-child(2) { display: flex; flex: 1; flex-direction: column; gap: 3px; }
.promotion-rewards-link strong { font-size: 12px; }
.promotion-rewards-link small { color: #7a887f; font-size: 10px; }
.promotion-rewards-link > svg { color: #849188; }
.promotion-grid { display: grid; gap: 12px; }
.promotion-banner { position: relative; display: flex; min-height: 225px; align-items: center; overflow: hidden; border-radius: 18px; color: white; background: radial-gradient(circle at 85% 15%, rgb(91 206 115 / 50%), transparent 36%), linear-gradient(120deg, #075e35, #128647 68%, #20a85b); }
.promotion-banner::after { position: absolute; inset: 0; content: ""; background: linear-gradient(90deg, rgb(3 63 31 / 94%) 0%, rgb(3 63 31 / 78%) 46%, rgb(3 63 31 / 5%) 100%); pointer-events: none; }
.promotion-banner-art { position: absolute; inset: 0 0 0 auto; width: 55%; height: 100%; object-fit: cover; }
.promotion-full-creative { display: grid; min-height: 0; align-items: stretch; aspect-ratio: auto; background: transparent; }
.promotion-full-creative::after { display: none; }
.promotion-complete-link { position: relative; display: block; width: 100%; aspect-ratio: 393 / 168; padding: 0; border: 0; border-radius: 18px; overflow: hidden; background: transparent; cursor: pointer; }
.promotion-banner-complete { display: block; width: 100%; height: 100%; object-fit: cover; }
.promotion-full-details { padding: 16px; border: 1px solid #e6eee8; border-radius: 12px; background: white; }
.promotion-full-details h2 { margin: 0 0 6px; color: #284534; }
.promotion-full-details p { color: #728078; font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
.promotion-banner-copy { position: relative; z-index: 1; display: flex; width: min(64%, 700px); flex-direction: column; align-items: flex-start; padding: 22px clamp(18px, 5vw, 38px); }
.promotion-number { margin-bottom: 5px; color: #b7efc7; font-size: 10px; font-weight: 850; letter-spacing: .12em; }
.promotion-value { position: relative; z-index: 1; color: #ffe66d; font-size: clamp(22px, 5vw, 36px); font-weight: 900; }
.promotion-banner h2 { position: relative; z-index: 1; margin: 3px 0 4px; color: white; font-size: clamp(18px, 4vw, 26px); }
.promotion-banner p { margin: 0 0 8px; color: rgb(255 255 255 / 90%); font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
.promotion-amount { margin-bottom: 14px; color: #ad7432; font-size: 12px; font-weight: 750; }
.promotion-banner .promotion-terms { padding-top: 8px; border-top: 1px solid rgb(255 255 255 / 25%); font-size: 11px; }
.auth-configuration-note { margin: 0; padding: 10px; border-radius: 9px; color: #758179; background: #f3f6f3; font-size: 11px; text-align: center; }
.wallet-summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.wallet-summary { display: flex; min-width: 0; flex-direction: column; align-items: flex-start; gap: 7px; padding: 15px; border: 1px solid #e1ebe2; border-radius: 16px; background: white; }
.wallet-summary > span { color: #738078; font-size: 12px; font-weight: 650; }
.wallet-summary > strong { color: #203d2a; font-size: clamp(18px, 5vw, 25px); overflow-wrap: anywhere; }
.wallet-summary > small { color: #8a968e; font-size: 11px; }
.main-wallet-summary { color: white; border: 0; background: linear-gradient(135deg, #148b48, #24b362); }
.main-wallet-summary > span, .main-wallet-summary > strong, .main-wallet-summary > small { color: white; }
.wallet-workspace { display: flex; flex-direction: column; gap: 12px; padding: 16px; border: 1px solid #e1ebe2; border-radius: 16px; background: white; }
.wallet-workspace-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.wallet-workspace-heading h2 { margin: 3px 0 0; color: #2b4534; font-size: 17px; }
.wallet-workspace .wallet-tabs { min-width: 150px; }
.wallet-workspace .wallet-tabs button { padding: 8px; }
.bonus-note { margin: 0; color: #758179; font-size: 12px; line-height: 1.45; }
.wallet-form { display: grid; gap: 9px; }
.text-action { padding: 5px 0; border: 0; color: #228b4b; background: none; font-size: 12px; font-weight: 750; text-align: left; }
.text-action:disabled { opacity: .6; }
.signed-out-card { display: flex; min-height: 240px; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 26px; border: 1px solid #e1ebe2; border-radius: 18px; background: white; text-align: center; }
.signed-out-card > svg { color: #259752; }
.signed-out-card h2 { margin: 2px 0 0; color: #2b4534; font-size: 19px; }
.signed-out-card p { max-width: 350px; margin: 0 0 6px; color: #748078; font-size: 13px; line-height: 1.5; }
.transaction-list { max-height: none; }
.account-card { display: flex; align-items: center; gap: 12px; padding: 16px; border: 1px solid #e1ebe2; border-radius: 16px; background: white; }
.account-balance { display: flex; min-height: 64px; align-items: center; gap: 10px; padding: 12px 16px; border: 1px solid #d5e9d8; border-radius: 14px; color: #248b4b; background: linear-gradient(110deg, #f1fbf2, #ffffff); }
.account-balance > span { flex: 1; color: #617469; font-size: 13px; font-weight: 650; }
.account-balance > strong { color: #205a37; font-size: 18px; font-variant-numeric: tabular-nums; }
.account-avatar, .profile-avatar-preview { display: grid; overflow: hidden; flex: 0 0 auto; place-items: center; border-radius: 50%; color: white; background: #24a85a; font-weight: 800; }
.account-avatar { width: 60px; height: 60px; font-size: 24px; }
.account-avatar img, .profile-avatar-preview img { width: 100%; height: 100%; object-fit: cover; }
.avatar-upload-button { display: flex; width: fit-content; min-height: 42px; align-items: center; justify-content: center; gap: 8px; padding: 8px 13px; border: 1px solid #d5e7d8; border-radius: 11px; color: #248b4b; background: white; font-size: 12px; font-weight: 700; cursor: pointer; }
.avatar-upload-button.uploading { opacity: .65; cursor: wait; }
.avatar-upload-button input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; clip-path: inset(50%); }
.profile-picture-editor { display: flex; flex-direction: column; align-items: center; gap: 9px; padding-bottom: 12px; border-bottom: 1px solid #e8eee8; }
.profile-avatar-preview { width: 88px; height: 88px; font-size: 36px; }
.upload-hint { color: #87948b; font-size: 11px; }
.account-identity { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 3px; }
.account-identity > span, .account-identity > small { overflow: hidden; color: #758179; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.account-identity > strong { overflow: hidden; color: #2b4534; text-overflow: ellipsis; }
.account-action-grid { display: grid; gap: 8px; }
.account-action-grid > button { display: flex; min-height: 66px; align-items: center; gap: 12px; padding: 11px 13px; border: 1px solid #e1ebe2; border-radius: 13px; color: #299251; background: white; text-align: left; }
.account-action-grid > button > span { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 3px; }
.account-action-grid strong { color: #2b4534; font-size: 13px; }
.account-action-grid small { overflow: hidden; color: #78847c; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.sign-out-button { display: flex; min-height: 44px; align-items: center; justify-content: center; gap: 8px; border: 1px solid #eddddd; border-radius: 12px; color: #a74d4d; background: #fff9f9; font-weight: 700; }
.full-button { width: 100%; padding: 12px; }
.menu-list, .message-list { margin: 0; padding: 0; list-style: none; }
.menu-list li + li, .message-list li + li { margin-top: 5px; }
.menu-list button { display: flex; width: 100%; align-items: center; gap: 12px; padding: 10px; border: 0; border-radius: 9px; color: #355342; text-align: left; background: white; }
.menu-list button:hover { background: #e5f3e3; }
.menu-list .menu-section-label {
  margin: 6px 4px 2px;
  padding: 0;
  color: #89958d;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.promo-list { gap: 8px; }
.promo-card { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px; border-radius: 12px; background: #e5f3e3; }
.promo-card p { margin: 3px 0 0; color: #707b73; font-size: 12px; }
.promo-card .primary-button { padding: 7px 12px; font-size: 12px; }
.profile-info p { margin: 0; font-size: 14px; }
.message-list { display: grid; max-height: min(65vh, 520px); gap: 10px; overflow-y: auto; }
.notification-summary { display: flex; align-items: center; gap: 10px; margin-bottom: 2px; padding: 12px; border: 1px solid #42664b; border-radius: 14px; background: linear-gradient(155deg, #193724, #10271a); }
.notification-summary-icon { display: grid; width: 36px; height: 36px; flex: 0 0 auto; place-items: center; border-radius: 11px; color: #d7eadb; background: #315a3b; }
.notification-summary > span:nth-child(2) { display: grid; flex: 1; gap: 3px; }
.notification-summary strong { color: #e6f2e8; font-size: 12px; }
.notification-summary small { color: #b4c7b8; font-size: 11px; }
.notification-summary > b { display: grid; min-width: 27px; height: 27px; place-items: center; padding: 0 6px; border-radius: 999px; color: #e5f4e8; background: #315a3b; font-size: 11px; }
.inbox-message { position: relative; display: grid; grid-template-columns: 34px minmax(0, 1fr); align-items: start; column-gap: 10px; row-gap: 4px; padding: 12px; border: 1px solid #344d39; border-left: 3px solid #637968; border-radius: 12px; background: linear-gradient(155deg, #172c1d, #102117); }
.inbox-message.unread { border-color: #66836b; border-left-color: #8dbd94; background: linear-gradient(155deg, #284a30, #1d3b27); }
.notification-item-icon { display: grid; width: 32px; height: 32px; grid-row: span 2; place-items: center; border: 1px solid #435c48; border-radius: 10px; color: #afc5b3; background: #223b29; }
.inbox-message.unread .notification-item-icon { border-color: #759d7b; color: #e1f1e4; background: #315b3a; }
.inbox-message-heading { display: flex; min-width: 0; align-items: flex-start; justify-content: space-between; gap: 8px; }
.inbox-message-heading strong { color: #e6f0e7; font-size: 12px; line-height: 1.45; }
.inbox-message-heading time { flex: 0 0 auto; color: #a9b9ac; font-size: 10px; }
.inbox-message p { grid-column: 2; margin: 0; color: #c2d0c4; font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.notification-unread-dot { display: inline-block; width: 7px; height: 7px; margin-left: 7px; border-radius: 50%; background: #a5d6ac; vertical-align: 1px; }
.notification-empty { display: grid; min-height: 170px; justify-items: center; align-content: center; gap: 8px; margin: 0; padding: 20px; border: 1px dashed #42664b; border-radius: 14px; color: #b5c7b8; background: rgb(16 39 26 / 72%); text-align: center; }
.notification-empty > span { display: grid; width: 44px; height: 44px; place-items: center; border-radius: 14px; color: #dcecdf; background: #315a3b; }
.notification-empty strong { color: #e4f0e6; font-size: 14px; }
.notification-empty small { color: #b4c7b8; font-size: 11px; }
.notification-status { margin: 0; padding: 20px; border: 1px solid #344d39; border-radius: 12px; color: #c2d0c4; background: #14281a; }
.inbox-bet, .inbox-lottery, .inbox-game { border-left-color: #e7a52a; }
.transaction-list { max-height: 420px; overflow-y: auto; }
.transaction-card { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; border-radius: 11px; background: #edf5ef; }
.transaction-card > div { display: flex; flex-direction: column; gap: 3px; }
.transaction-card small { color: #7b887f; font-size: 11px; }
.transaction-result { align-items: flex-end; }
.transaction-result span { border-radius: 999px; padding: 3px 7px; font-size: 10px; text-transform: capitalize; background: #e7ece8; }
.transaction-result span.approved { color: #1d7a40; background: #d9f0df; }
.transaction-result span.rejected { color: #a33a3a; background: #f4dddd; }
.transaction-result span.pending { color: #886b20; background: #f5eccb; }
.favorites-list { gap: 8px; }
.favorite-game { display: flex; width: 100%; align-items: center; gap: 10px; padding: 8px; border: 1px solid #dce5de; border-radius: 11px; text-align: left; background: white; }
.favorite-game img { width: 54px; height: 54px; border-radius: 9px; object-fit: cover; }
.favorite-game span { display: flex; flex-direction: column; }
.favorite-game small { color: #839087; }
.support-content { gap: 8px; }
.support-content > p { margin: 0; color: #667469; font-size: 13px; }
.support-row { display: flex; width: 100%; align-items: center; gap: 10px; padding: 11px; border: 0; border-radius: 10px; text-align: left; background: #edf5ef; color: #355342; }
.support-row span { display: flex; min-width: 0; flex: 1; flex-direction: column; }
.support-row small { color: #829087; }
.profile-actions > p { margin: 0; color: #748078; font-size: 13px; }
.profile-actions .support-row { min-height: 64px; border: 1px solid #e1ebe2; cursor: pointer; }
.profile-change-option { position: relative; }
.profile-change-option.uploading { opacity: .65; cursor: wait; }
.profile-change-option input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; clip-path: inset(50%); }
.ticket-form { display: grid; gap: 7px; margin-top: 4px; }
.ticket-form input, .ticket-form textarea {
  width: 100%; border: 1px solid #dce7df; border-radius: 10px; background: white; color: #355342; outline: none;
}
.ticket-form input { height: 42px; padding: 0 11px; }
.ticket-form textarea { resize: vertical; padding: 10px 11px; font-family: inherit; }
.ticket-form input:focus, .ticket-form textarea:focus { border-color: #5dbb80; box-shadow: 0 0 0 3px rgb(50 153 93 / 8%); }
.maintenance-banner { margin-bottom: 10px; padding: 10px 12px; border: 1px solid #f1c76b; border-radius: 10px; color: #7a5710; background: #fff8e7; font-size: 12px; font-weight: 700; text-align: center; }
.toast { position: fixed; z-index: 20; bottom: 88px; left: 50%; max-width: calc(100vw - 32px); padding: 10px 16px; border-radius: 99px; color: white; background: #27382b; box-shadow: 0 4px 16px rgb(0 0 0 / 20%); text-align: center; font-size: 13px; transform: translateX(-50%); }
.wallet-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.wallet-tabs button { padding: 10px; border: 1px solid #d5ded6; border-radius: 10px; color: #536358; background: white; }
.wallet-tabs button.active { border-color: #25a95b; color: #1b7d43; background: #e7f4e9; font-weight: 750; }
.auth-form input { width: 100%; padding: 12px 14px; border: 1px solid #d5ded6; border-radius: 12px; color: #273f31; background: #fff; color-scheme: light; outline-color: #27a95c; }
.auth-form input::placeholder { color: #89968d; opacity: 1; }
.primary-button:disabled { opacity: .65; cursor: wait; }
.auth-form select, .kyc-form select, .kyc-form input { width: 100%; min-height: 42px; padding: 10px 12px; border: 1px solid #d5ded6; border-radius: 10px; background: white; outline-color: #27a95c; }
.google-signin-button { display: flex; width: 100%; min-height: 44px; align-items: center; justify-content: center; }
.auth-divider { display: flex; align-items: center; gap: 8px; color: #718076; font-size: 11px; }
.auth-divider::before, .auth-divider::after { content: ""; height: 1px; flex: 1; background: #dfe7e0; }
.verification-row { display: grid; grid-template-columns: 92px 1fr 64px; gap: 7px; }
.verification-row input { width: 100%; min-height: 40px; padding: 8px; border: 1px solid #d5ded6; border-radius: 9px; }
.secondary-button, .verify-button { border: 0; border-radius: 9px; color: white; font-size: 12px; }
.secondary-button { background: #5b7965; } .verify-button { background: #23a85a; }
.kyc-note { margin: 0; padding: 9px; border-radius: 9px; color: #267c36; background: #e5f3e3; font-size: 12px; }
.kyc-form label { display: flex; flex-direction: column; gap: 5px; color: #536358; font-size: 12px; }
.kyc-form label input { padding: 7px; border-style: dashed; }
@media (max-width: 479px) {
  .amount-options { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .page-home .game-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .page-games .game-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 11px; }
  .game-card { border-radius: 15px; }
  .game-art-title { font-size: clamp(16px, 5vw, 22px); }
  .game-name { font-size: 12px; }
  .verification-row { grid-template-columns: 1fr 1fr; }
  .verification-row input { grid-column: 1 / -1; }
  .modal-sheet { max-height: calc(100dvh - 12px); }
  .transaction-card { align-items: flex-start; }
  .account-card { gap: 9px; padding: 12px; }
  .account-card .text-action { flex: 0 0 auto; }
  .avatar-upload-button { max-width: 100%; }
  .inbox-message-heading { flex-wrap: wrap; }
  .promo-card { align-items: flex-start; }
  .welcome-banner { min-height: 0; aspect-ratio: 1240 / 520; border-radius: 16px; }
  .welcome-banner::before { display: none; }
  .welcome-banner-image { object-position: center; }
  .welcome-banner-copy { display: none; }
  .bottom-nav { padding-right: max(8px, env(safe-area-inset-right)); padding-left: max(8px, env(safe-area-inset-left)); }
  .bottom-nav button { min-width: 48px; min-height: 48px; }
}
@media (min-width: 480px) and (max-width: 759px) {
  .page-frame { width: 100%; }
  .content { padding-right: 20px; padding-left: 20px; }
  .page-home .game-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .page-games .game-grid { grid-template-columns: repeat(auto-fill, minmax(155px, 1fr)); gap: 12px; }
}
@media (min-width: 480px) {
  .page-frame { min-height: 100vh; }
}
@media (min-width: 760px) {
  .game-player { gap: 16px; }
  .game-player-heading { flex-direction: row; align-items: center; gap: 18px; }
  .game-player-frame { height: min(76vh, 860px); min-height: 500px; border-radius: 19px; }
  .game-category-sections { gap: 22px; }
  .game-category-section { padding: 18px; border-radius: 20px; }
  .game-category-strip { gap: 14px; }
  .game-category-strip .game-card { width: 205px; }
  body { background: radial-gradient(ellipse at top, #f8fbf8 0%, #eaf1eb 80%); }
  .page-frame {
    width: 100%;
    margin: 0 auto;
    border-radius: 0;
    background: #f5f8f5;
  }
  .desktop-nav { position: sticky; top: 78px; z-index: 5; display: flex; min-height: 60px; align-items: center; gap: 7px; padding: 0 clamp(24px, 5vw, 72px); border-bottom: 1px solid #e8eee8; background: rgb(255 255 255 / 96%); box-shadow: 0 3px 12px rgb(34 91 51 / 5%); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); }
  .desktop-nav button { min-height: 40px; padding: 9px 15px; border: 0; border-radius: 9px; color: #64736a; background: transparent; font-size: 14px; font-weight: 650; }
  .desktop-nav button.active { color: #168446; background: #eaf6ed; }
  .desktop-nav .desktop-auth { margin-left: auto; color: #fff; background: #22a85a; }
  .menu-button { display: none; }
  .topbar { height: 78px; gap: 14px; padding: 8px clamp(24px, 5vw, 72px) 12px; }
  .brand-emblem { width: 46px; height: 46px; flex-basis: 46px; }
  .public-brand { width: 150px; min-width: 150px; flex-basis: 150px; gap: 9px; }
  .brand-wordmark { font-size: 23px; }
  .header-actions { max-width: none; flex: 0 0 auto; gap: 10px; margin-left: auto; }
  .balance-button { height: 42px; }
  .search-wrap { padding-right: clamp(20px, 4vw, 52px); padding-left: clamp(20px, 4vw, 52px); }
  .content { width: min(100%, 1320px); gap: 20px; margin: 0 auto; padding: 26px clamp(24px, 5vw, 72px) 42px; }
  .promo-frame { padding: 0; }
  .hero { height: clamp(280px, 27vw, 380px); min-height: 280px; max-height: none; aspect-ratio: auto; }
  .hero-copy { min-height: 0; padding-right: clamp(24px, 5vw, 64px); padding-left: clamp(24px, 5vw, 64px); }
  .hero-title { font-size: clamp(20px, 2.2vw, 30px); }
  .hero-title strong { font-size: clamp(40px, 5vw, 68px); }
  .hero-subtitle { font-size: clamp(14px, 1.3vw, 18px); }
  .hero-with-art .hero-copy { max-width: 64%; }
  .hero-art { width: 48%; object-position: center; }
  .welcome-banner { min-height: 0; }
  .homepage-custom-banner { max-height: none; }
  .categories { min-height: 118px; padding-right: 18px; padding-left: 18px; }
  .category-list { justify-content: center; gap: clamp(12px, 2vw, 28px); }
  .category { max-width: 140px; min-width: 80px; }
  .category-icon { width: 56px; }
  .category-label { font-size: 13px; }
  .jackpot { max-height: 400px; }
  .page-home .game-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .page-games .game-grid { grid-template-columns: repeat(auto-fill, minmax(175px, 1fr)); gap: 16px; }
  .game-card { border-radius: 19px; }
  .games-panel { padding: 20px; border-radius: 22px; }
  .section-heading { margin-bottom: 14px; }
  .section-heading h2 { font-size: 19px; }
  .promotion-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
  .account-action-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .modal-backdrop { align-items: center; }
  .modal-sheet { width: min(640px, calc(100% - 48px)); max-height: 88vh; border-radius: 24px; }
  .bottom-nav { display: none; }
  .page-frame { padding-bottom: 20px; }
  .promotion-banner { min-height: 270px; align-items: flex-start; }
  .promotion-full-creative { min-height: 0; }
  .promotion-banner-art { width: 52%; }
  .promotion-banner-copy { width: 76%; padding: 16px; }
  .wallet-summary-grid { gap: 14px; }
  .page-section { gap: 18px; padding-right: 4px; padding-left: 4px; }
}
@media (min-width: 1100px) {
  .content { width: min(100%, 1360px); }
  .game-grid { grid-template-columns: repeat(auto-fill, minmax(185px, 1fr)); gap: 18px; }
}
@media (max-width: 370px) {
  .topbar { gap: 4px; padding-right: 8px; padding-left: 8px; }
  .menu-button { width: 23px; }
  .public-brand { width: 112px; min-width: 112px; flex-basis: 112px; }
  .brand-emblem { width: 34px; height: 34px; flex-basis: 34px; }
  .brand-wordmark { font-size: 14px; }
  .header-actions { gap: 4px; }
  .balance-button { gap: 4px; padding: 0 5px; }
  .search-button { width: 22px; }
  .search-button svg { width: 21px; }
  .content { gap: 10px; padding-right: 9px; padding-left: 9px; }
  .categories { min-height: 82px; }
  .category { min-width: 56px; font-size: 11px; }
  .jackpot { border-radius: 0; box-shadow: none; }
  .jackpot-value { bottom: 24%; font-size: 12px; }
  .game-grid { gap: 8px; }
  .wallet-summary-grid { grid-template-columns: 1fr; }
  .wallet-workspace-heading { align-items: flex-start; flex-direction: column; }
  .wallet-workspace .wallet-tabs { width: 100%; }
}
@media (max-width: 350px) {
  .public-brand { width: 40px; min-width: 40px; flex-basis: 40px; }
  .brand-wordmark { display: none; }
}
.home-game-sections { gap: 13px; }
.page-home .game-category-section { min-width: 0; padding: 12px 10px 11px; scroll-margin-top: 86px; }
.home-game-category-heading { margin-bottom: 10px; }
.home-game-category-heading h2 { display: flex; min-width: 0; align-items: center; gap: 7px; font-size: clamp(15px, 4vw, 19px); }
.home-game-category-heading h2 svg { flex: 0 0 auto; color: #169b4d; }
.home-game-category-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 5px; }
.home-category-arrow { display: grid; width: 31px; height: 31px; place-items: center; padding: 0; border: 1px solid #dfe8e0; border-radius: 9px; color: #52715c; background: #f4f8f4; }
.home-view-all { min-height: 31px; padding: 0 9px; border: 0; border-radius: 9px; color: #168446; background: #eaf6ed; font-size: 11px; font-weight: 800; white-space: nowrap; }
.home-game-strip { display: grid; grid-auto-columns: calc((100% - 40px) / 6); grid-auto-flow: column; gap: 8px; overflow-x: auto; padding: 1px 1px 5px; scroll-snap-type: x mandatory; scrollbar-width: none; overscroll-behavior-inline: contain; }
@media (max-width: 759px) {
  /* Two rows of three cards: 3 columns x 2 rows per view, columns flow
     horizontally so the prev/next arrows still page through the rest. */
  .home-game-strip {
    grid-auto-columns: calc((100% - 16px) / 3);
    grid-template-rows: repeat(2, auto);
  }
}
.home-game-strip::-webkit-scrollbar { display: none; }
.home-game-card { width: 100%; min-width: 0; aspect-ratio: .86; border-radius: 13px; scroll-snap-align: start; }
.home-game-card > img { object-fit: cover; }
.home-game-card .game-name { bottom: 8px; font-size: clamp(10px, 2.8vw, 13px); }
.home-game-card-no-art .game-name { top: 50%; bottom: auto; transform: translateY(-50%); font-size: clamp(12px, 3.2vw, 15px); }
.home-popular-badge { position: absolute; z-index: 3; top: 6px; left: 6px; display: inline-flex; align-items: center; gap: 3px; padding: 4px 6px; border-radius: 999px; color: #fff; background: #e9952c; font-size: 9px; font-weight: 850; }
.page-home .favorite-button { top: 6px; right: 6px; width: 26px; height: 26px; }
.home-game-skeletons { pointer-events: none; }
.home-game-skeleton { aspect-ratio: .86; border-radius: 13px; background: linear-gradient(105deg, #e6eee7 20%, #f7faf7 38%, #e6eee7 58%); background-size: 220% 100%; animation: home-skeleton-shimmer 1.25s linear infinite; }
@keyframes home-skeleton-shimmer { to { background-position-x: -220%; } }
.home-section-load-sentinel { height: 1px; }
.home-section-loading { display: flex; min-height: 28px; align-items: center; justify-content: center; gap: 7px; color: #718076; font-size: 11px; }
.home-back-to-top { position: fixed; z-index: 7; right: max(14px, env(safe-area-inset-right)); bottom: calc(91px + env(safe-area-inset-bottom)); display: grid; width: 44px; height: 44px; place-items: center; padding: 0; border: 1px solid #d5e5d8; border-radius: 15px; color: #fff; background: #159447; box-shadow: 0 6px 18px rgb(20 70 35 / 20%); transition: transform .18s ease, background .18s ease; }
.home-back-to-top:hover { transform: translateY(-2px); background: #127d3d; }
@media (min-width: 760px) {
  .home-game-sections { gap: 18px; }
  .page-home .game-category-section { padding: 18px; border-radius: 20px; }
  .home-game-strip { grid-auto-columns: calc((100% - 48px) / 7); gap: 8px; }
  .home-game-card { border-radius: 16px; }
  .home-game-category-heading h2 { font-size: 20px; }
  .home-category-arrow { width: 35px; height: 35px; }
  .home-view-all { min-height: 35px; padding: 0 12px; font-size: 12px; }
  .home-back-to-top { right: max(24px, calc((100vw - 1360px) / 2)); bottom: 25px; width: 48px; height: 48px; }
}
.page-games { color: #355342; background: #f5f8f5; }
.page-games .topbar { background: #159447; box-shadow: 0 4px 16px rgb(19 99 49 / 14%); }
.page-games .desktop-nav { border-color: #e8eee8; background: rgb(255 255 255 / 96%); box-shadow: 0 3px 12px rgb(34 91 51 / 5%); }
.page-games .desktop-nav button { color: #64736a; }
.page-games .desktop-nav button.active { color: #168446; background: #eaf6ed; }
.page-games .content { width: min(100%, 1440px); min-width: 0; gap: 12px; background: #f5f8f5; }
.game-lobby { display: grid; min-width: 0; gap: 12px; }
.game-lobby-search { display: flex; min-width: 0; min-height: 46px; align-items: center; gap: 10px; padding: 0 14px; border: 1px solid #d5e8d8; border-radius: 999px; color: #63806b; background: #fff; }
.game-lobby-search input { width: 100%; min-width: 0; height: 44px; padding: 0; border: 0; outline: 0; color: #273f31; background: transparent; font-size: 14px; }
.game-lobby-search input::placeholder { color: #819187; opacity: 1; }
.game-lobby-search input::-webkit-search-cancel-button { filter: none; }
.game-lobby-search button { display: grid; width: 25px; height: 25px; flex: 0 0 auto; place-items: center; padding: 0; border: 0; border-radius: 50%; color: #168446; background: #eaf6ed; }
.game-lobby-search svg { flex: 0 0 auto; color: #168446; }
.game-lobby-search:focus-within { border-color: #26a85c; box-shadow: 0 0 0 3px rgb(38 168 92 / 12%); }
.game-lobby-tabs { display: flex; min-width: 0; gap: 7px; overflow-x: auto; padding: 1px 1px 4px; scrollbar-width: none; }
.game-lobby-tabs::-webkit-scrollbar { display: none; }
.game-lobby-tabs button { min-width: 66px; min-height: 36px; padding: 0 13px; border: 1px solid #d5e8d8; border-radius: 10px; color: #50765b; background: #edf6ed; font-size: 12px; font-weight: 750; transition: background .18s ease, color .18s ease, transform .18s ease; }
.game-lobby-tabs button.active { border-color: #168446; color: #fff; background: #168446; }
.game-lobby-tabs button:active { transform: scale(.97); }
.game-lobby-layout { display: grid; min-width: 0; grid-template-columns: 78px minmax(0, 1fr); align-items: start; gap: 9px; }
.game-provider-sidebar { position: sticky; top: 76px; display: flex; max-height: calc(100dvh - 92px); min-width: 0; flex-direction: column; gap: 7px; overflow-y: auto; padding: 7px 5px 9px; border: 1px solid #edf1ed; border-radius: 14px; background: #fff; scrollbar-width: thin; scrollbar-color: #b6d8bd transparent; }
.game-provider-sidebar-title { margin: 0 0 2px; color: #63806b; font-size: 9px; font-weight: 850; text-align: center; text-transform: uppercase; letter-spacing: .06em; }
.game-provider-option { display: flex; min-width: 0; min-height: 63px; flex-direction: column; align-items: center; justify-content: center; gap: 5px; padding: 6px 3px; border: 1px solid #d5e8d8; border-radius: 10px; color: #50765b; background: #edf6ed; font-size: 9px; font-weight: 700; line-height: 1.15; text-align: center; overflow-wrap: anywhere; transition: color .18s ease, background .18s ease; }
.game-provider-option.active { border-color: #168446; color: #fff; background: #168446; }
.game-provider-logo { display: grid; width: 36px; height: 29px; flex: 0 0 auto; place-items: center; border: 1px solid rgb(22 132 70 / 14%); border-radius: 9px; color: #197744; background: #fff; font-size: 10px; font-weight: 900; }
.game-provider-logo-dark { border-color: #22352a; background: #22352a; }
.game-provider-logo img { width: 100%; height: 100%; border-radius: inherit; object-fit: contain; }
.game-provider-option.active .game-provider-logo { border-color: rgb(255 255 255 / 25%); color: #fff; background: rgb(255 255 255 / 12%); }
.game-provider-empty { margin: 4px 0; color: #63806b; font-size: 9px; line-height: 1.4; text-align: center; }
.game-lobby-main { min-width: 0; }
.lobby-category-sections { display: grid; min-width: 0; gap: 11px; }
.page-games .game-category-section { min-width: 0; padding: 10px 8px; border: 1px solid #edf1ed; border-radius: 14px; background: #fff; box-shadow: 0 5px 18px rgb(31 72 43 / 4%); }
.page-games .game-category-heading { gap: 4px; margin-bottom: 8px; }
.page-games .game-category-heading h2 { display: flex; min-width: 0; align-items: center; gap: 5px; color: #284b35; font-size: clamp(13px, 3.4vw, 18px); }
.page-games .game-category-heading h2 svg { flex: 0 0 auto; color: #169b4d; }
.page-games .game-category-heading > button { min-height: 29px; padding: 5px 7px; color: #168446; background: #eaf6ed; font-size: 10px; }
.lobby-game-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
.lobby-game-card { min-width: 0; aspect-ratio: .86; border: 1px solid rgb(20 70 35 / 8%); border-radius: 11px; background: #138841; box-shadow: 0 4px 12px rgb(28 69 39 / 10%); transition: transform .18s ease, box-shadow .18s ease; }
.lobby-game-card > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .22s ease; }
.lobby-game-card:hover > img { transform: scale(1.05); }
.lobby-game-card:hover { transform: translateY(-2px); box-shadow: 0 8px 18px rgb(28 69 39 / 18%); }
.lobby-game-card::after { position: absolute; z-index: 1; inset: 30% 0 0; content: ""; background: linear-gradient(transparent, rgb(0 24 12 / 60%)); pointer-events: none; }
.lobby-card-no-thumbnail::after { display: none; }
.lobby-game-name { position: absolute; z-index: 2; right: 3px; bottom: 6px; left: 3px; display: -webkit-box; overflow: hidden; color: #fff; font-size: clamp(9px, 2.4vw, 12px); font-weight: 750; line-height: 1.2; text-align: center; text-overflow: ellipsis; text-shadow: 0 1px 4px rgb(0 0 0 / 65%); -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.lobby-card-no-thumbnail .lobby-game-name { top: 50%; bottom: auto; transform: translateY(-50%); font-size: clamp(11px, 3vw, 14px); }
.page-games .favorite-button { top: 5px; right: 5px; width: 25px; height: 25px; color: #267c48; }
.lobby-hot-badge { position: absolute; z-index: 3; top: 5px; left: 5px; padding: 3px 5px; border-radius: 99px; color: #fff; background: #e05b35; font-size: 8px; font-weight: 900; }
.game-lobby-results { min-width: 0; padding: 10px 8px; border: 1px solid #edf1ed; border-radius: 14px; background: #fff; }
.game-lobby-results-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.game-lobby-results-heading h1 { margin: 0; color: #284b35; font-size: 17px; }
.game-lobby-results-heading span { color: #63806b; font-size: 11px; }
.game-lobby-empty { grid-column: 1 / -1; margin: 0; padding: 24px 8px; color: #6d786f; font-size: 12px; text-align: center; }
.page-games .games-loading-more { color: #63806b; }
.page-games .loading-spinner { border-color: #d5e8d8; border-top-color: #159447; }
.page-games .empty-state { color: #6d786f; }
@media (min-width: 480px) {
  .game-lobby-layout { grid-template-columns: 96px minmax(0, 1fr); gap: 12px; }
  .game-provider-sidebar { gap: 8px; padding: 9px 7px; border-radius: 16px; }
  .game-provider-option { min-height: 69px; font-size: 10px; }
  .lobby-game-grid { gap: 9px; }
  .page-games .game-category-section, .game-lobby-results { padding: 13px; }
}
@media (min-width: 760px) {
  .page-games .content { gap: 17px; padding: 22px clamp(20px, 4vw, 48px) 42px; }
  .game-lobby { gap: 14px; }
  .game-lobby-search { min-height: 52px; }
  .game-lobby-search input { height: 50px; font-size: 15px; }
  .game-lobby-tabs button { min-width: 78px; min-height: 40px; font-size: 13px; }
  .game-lobby-layout { grid-template-columns: 152px minmax(0, 1fr); gap: 16px; }
  .game-provider-sidebar { top: 95px; max-height: calc(100dvh - 115px); gap: 9px; padding: 12px 10px; border-radius: 18px; }
  .game-provider-sidebar-title { font-size: 11px; }
  .game-provider-option { min-height: 72px; flex-direction: row; justify-content: flex-start; gap: 9px; padding: 8px; border-radius: 12px; font-size: 11px; text-align: left; }
  .game-provider-logo { width: 36px; height: 36px; border-radius: 10px; font-size: 11px; }
  .lobby-category-sections { gap: 14px; }
  .page-games .game-category-section, .game-lobby-results { padding: 16px; border-radius: 18px; }
  .page-games .game-category-heading { margin-bottom: 12px; }
  .page-games .game-category-heading h2 { gap: 8px; font-size: 19px; }
  .page-games .game-category-heading > button { min-height: 34px; padding: 7px 10px; font-size: 11px; }
  .lobby-game-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 11px; }
  .lobby-game-card { border-radius: 14px; }
  .lobby-game-name { bottom: 9px; font-size: 12px; }
  .page-games .favorite-button { width: 29px; height: 29px; }
  .lobby-hot-badge { top: 7px; left: 7px; font-size: 9px; }
  .game-lobby-results-heading h1 { font-size: 20px; }
}
@media (min-width: 1100px) {
  .game-lobby-layout { grid-template-columns: 176px minmax(0, 1fr); gap: 20px; }
  .lobby-game-grid { grid-template-columns: repeat(auto-fill, minmax(145px, 1fr)); gap: 14px; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    transition-duration: .01ms !important;
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
  }
}

/* ---------- Wallet (professional layout) ---------- */
.wallet-page .page-heading, .account-page .page-heading { padding-bottom: 2px; }
.wallet-balance-card { display: grid; gap: 0; overflow: hidden; border: 1px solid #dfeae0; border-radius: 20px; background: white; box-shadow: 0 1px 2px rgb(24 63 38 / 4%); }
.wallet-balance-main { display: flex; flex-direction: column; gap: 4px; padding: 20px 20px 18px; background: linear-gradient(135deg, #16a34a 0%, #128a41 100%); color: #fff; }
.wallet-balance-label { font-size: 12px; font-weight: 650; letter-spacing: .04em; text-transform: uppercase; opacity: .85; }
.wallet-balance-value { font-size: clamp(26px, 7vw, 34px); font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
.wallet-balance-note { font-size: 12px; opacity: .8; }
.wallet-balance-split { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 15px 18px; }
.wallet-balance-sub { display: flex; min-width: 0; flex: 1 1 160px; flex-direction: column; gap: 3px; }
.wallet-balance-sub .wallet-balance-label { color: #6d7a71; text-transform: none; letter-spacing: 0; font-weight: 600; }
.wallet-balance-sub strong { color: #1f3d2a; font-size: 20px; font-variant-numeric: tabular-nums; }
.wallet-balance-sub small { color: #8a968e; font-size: 11px; }
.wallet-transfer-button { display: inline-flex; align-items: center; gap: 6px; padding: 9px 13px; border: 1px solid #cfe6d4; border-radius: 11px; color: #15773f; background: #f0f8f2; font-size: 12px; font-weight: 700; }
.wallet-transfer-button:disabled { opacity: .6; }

.wallet-hint { margin: 0; padding: 9px 12px; border-radius: 11px; color: #5d6b61; background: #f2f7f3; font-size: 12px; }
.wallet-kyc-gate { display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid #f0dfb8; border-radius: 14px; color: #896219; background: #fffaf0; }
.wallet-kyc-gate > svg { flex: 0 0 auto; color: #bb8525; }
.wallet-kyc-gate > div { min-width: 0; flex: 1; }
.wallet-kyc-gate strong { display: block; color: #654a16; font-size: 13px; }
.wallet-kyc-gate p { margin: 4px 0 0; color: #806b43; font-size: 11.5px; line-height: 1.5; }
.wallet-kyc-button { display: inline-flex; min-height: 36px; flex: 0 0 auto; align-items: center; justify-content: center; gap: 4px; padding: 0 10px; border: 1px solid #e8d39e; border-radius: 9px; color: #725317; background: white; font-size: 11px; font-weight: 750; cursor: pointer; }
.wallet-kyc-button:hover { background: #fffdf7; }
.wallet-kyc-pending { flex: 0 0 auto; padding: 6px 9px; border-radius: 999px; color: #896219; background: #f8edcf; font-size: 10px; font-weight: 750; }
.wallet-kyc-button:focus-visible { outline: 3px solid rgb(187 133 37 / 25%); outline-offset: 2px; }
.wallet-payment-card { display: grid; gap: 10px; padding: 14px; border: 1px solid #dde9df; border-radius: 14px; background: #fbfdfb; }
.wallet-payment-heading { display: flex; align-items: flex-start; gap: 9px; color: #1f7a45; }
.wallet-payment-heading > svg { flex: 0 0 auto; margin-top: 1px; }
.wallet-payment-heading strong { display: block; color: #23412f; font-size: 14px; }
.wallet-payment-heading small { color: #7b887f; font-size: 11.5px; line-height: 1.4; }
.wallet-payment-rows { display: grid; gap: 1px; margin: 0; overflow: hidden; border: 1px solid #e5eee7; border-radius: 11px; background: #e5eee7; }
.wallet-payment-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 11px; background: white; }
.wallet-payment-row dt { color: #7b887f; font-size: 11.5px; font-weight: 600; }
.wallet-payment-row dd { display: flex; min-width: 0; align-items: center; gap: 7px; margin: 0; }
.wallet-payment-row dd > span { overflow: hidden; color: #22392c; font-size: 13px; font-weight: 650; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; text-overflow: ellipsis; }
.wallet-copy-button { display: grid; flex: 0 0 auto; width: 26px; height: 26px; place-items: center; padding: 0; border: 1px solid #dde8df; border-radius: 8px; color: #2c8b52; background: #f4faf5; }
.wallet-copy-button:hover { background: #e8f5eb; }
.wallet-payment-empty { margin: 0; color: #7b887f; font-size: 12px; }
.wallet-payment-instructions { margin: 0; padding-top: 2px; color: #5d6b61; font-size: 12px; line-height: 1.5; }
.wallet-deposit-workspace { gap: 16px; padding: 0 0 20px; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.wallet-deposit-workspace .wallet-workspace-heading { min-height: 60px; margin: 0 -16px; padding: 9px 16px; border-bottom: 1px solid #e6eee7; background: #fff; }
.wallet-payment-title { display: flex; min-width: 0; align-items: center; gap: 10px; }
.wallet-payment-title h2 { margin: 0; color: #233d2d; font-size: 19px; font-weight: 750; }
.wallet-back-button { display: grid; width: 36px; height: 36px; flex: 0 0 auto; place-items: center; border: 1px solid #e0e9e1; border-radius: 50%; color: #4a6251; background: #f7faf7; }
.wallet-back-button:hover { border-color: #bfdbc5; color: #168548; background: #eef7f0; }
.wallet-deposit-methods { display: grid; gap: 8px; }
.wallet-deposit-method-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.wallet-deposit-method-options button { display: flex; min-width: 0; min-height: 54px; align-items: center; justify-content: center; gap: 8px; padding: 9px 10px; border: 1px solid #dfe9e1; border-radius: 12px; color: #5b6d60; background: #fbfdfb; font-size: 12px; font-weight: 700; transition: border-color .16s ease, background .16s ease, color .16s ease; }
.wallet-deposit-method-options button > svg { flex: 0 0 auto; color: #27854a; }
.wallet-deposit-method-options button > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wallet-deposit-method-options button:hover { border-color: #afd3b7; color: #176f3b; background: #f4faf5; }
.wallet-deposit-method-options button.chosen { border-color: #72bb85; color: #176f3b; background: #eaf6ed; box-shadow: inset 0 0 0 1px rgb(22 133 72 / 8%); }
.wallet-deposit-method-empty { margin: 0; color: #7b887f; font-size: 11px; }
.wallet-deposit-channel, .wallet-deposit-details { display: grid; gap: 8px; }
.wallet-provider-logo { width: 34px; height: 34px; flex: 0 0 auto; border-radius: 50%; object-fit: contain; }
.wallet-deposit-channel-chip { display: inline-flex; width: min(50%, 300px); min-height: 48px; align-items: center; gap: 7px; padding: 7px 14px; border: 1px solid #cfe5d3; border-radius: 12px; color: #176f3b; background: #edf7ef; font-size: 12px; font-weight: 700; }
.wallet-deposit-channel-chip svg:last-child { margin-left: auto; transition: transform .16s ease; }
.wallet-deposit-channel-chip[aria-expanded="true"] svg:last-child { transform: rotate(90deg); }
.deposit-payment-card { gap: 10px; padding: 13px; border-color: #e2ebe3; background: #fbfdfb; }
.deposit-payment-card .wallet-payment-heading { align-items: center; gap: 9px; }
.wallet-payment-icon { display: grid; width: 34px; height: 34px; flex: 0 0 auto; place-items: center; border-radius: 10px; color: #168548; background: #e8f5eb; }
.wallet-deposit-form { gap: 12px; }
.wallet-deposit-form .manual-note { border-color: #d5ded6; color: #22392c; background: white; }
.wallet-deposit-amount .amount-options { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 7px; }
.wallet-deposit-amount .amount-options button { min-width: 0; min-height: 38px; padding: 7px 2px; border-color: #dfebe1; border-radius: 10px; color: #4a6251; background: #fbfdfb; font-size: 11px; font-weight: 650; transition: border-color .16s ease, background .16s ease, color .16s ease; }
.wallet-deposit-amount .amount-options button:hover { border-color: #acd2b5; background: #f3faf4; }
.wallet-deposit-amount .amount-options button.chosen { border-color: #72bb85; color: #176f3b; background: #eaf6ed; box-shadow: inset 0 0 0 1px rgb(22 133 72 / 8%); }
.wallet-method-selected { width: 100%; padding: 12px 0; color: #22392c; font-size: 14px; }
.wallet-deposit-help { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 12px; padding: 11px 13px; border: 1px solid #e4eee6; border-radius: 12px; color: #758279; background: #fbfdfb; font-size: 12px; text-align: left; }
.wallet-deposit-help strong { display: inline-flex; align-items: center; gap: 3px; color: #188147; font-size: 12px; }
.wallet-deposit-help button { display: inline-flex; align-items: center; gap: 4px; padding: 0; color: #188147; background: transparent; font-size: 12px; font-weight: 750; }
.wallet-deposit-help:hover { border-color: #c7dfcc; background: #f6fbf7; }
.wallet-deposit-footer { position: fixed; z-index: 12; bottom: 0; left: 50%; width: min(100%, 720px); margin: 0; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: linear-gradient(to top, #fff 78%, rgb(255 255 255 / 0%)); transform: translateX(-50%); }
.wallet-deposit-submit { width: 100%; min-height: 54px; padding: 12px 18px; border: 0; border-radius: 999px; color: #fff; background: linear-gradient(110deg, #168548, #22a653); box-shadow: 0 5px 15px rgb(22 133 72 / 22%); font-size: 15px; font-weight: 800; }
.wallet-deposit-submit:hover:not(:disabled) { background: linear-gradient(110deg, #13783f, #1d984a); box-shadow: 0 7px 19px rgb(22 133 72 / 28%); }
.wallet-deposit-submit:disabled { cursor: not-allowed; opacity: .6; }
.deposit-active .bottom-nav { display: none; }
.deposit-active .wallet-page { padding-bottom: 94px; }

.wallet-field { display: flex; flex-direction: column; gap: 6px; }
.wallet-field-label { color: #5d6b61; font-size: 12px; font-weight: 700; }
.wallet-input-shell { display: flex; align-items: center; gap: 8px; padding: 0 13px; border: 1px solid #d5ded6; border-radius: 12px; background: white; }
.wallet-input-shell:focus-within { border-color: #27a95c; box-shadow: 0 0 0 3px rgb(39 169 92 / 12%); }
.wallet-input-shell > svg { flex: 0 0 auto; color: #7b887f; }
.wallet-input-shell > input { width: 100%; padding: 12px 0; border: 0; outline: 0; background: transparent; font-size: 14px; color: #22392c; }
.wallet-input-prefix { flex: 0 0 auto; color: #7b887f; font-size: 13px; font-weight: 700; }
.wallet-file-drop { display: flex; align-items: center; gap: 9px; padding: 12px 13px; border: 1px dashed #c9dccd; border-radius: 12px; color: #4f6b59; background: #f8fbf8; font-size: 12.5px; cursor: pointer; }
.wallet-file-drop:hover { border-color: #7fc196; background: #f2f9f3; }
.wallet-file-drop > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wallet-file-drop input { display: none; }

.profile-tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; padding: 5px; border: 1px solid #e1ebe2; border-radius: 14px; background: white; }
.profile-tabs button { display: flex; min-height: 40px; align-items: center; justify-content: center; gap: 7px; border: 0; border-radius: 10px; color: #728078; background: transparent; font-size: 12px; font-weight: 750; }
.profile-tabs button.active { color: white; background: #168548; box-shadow: 0 2px 6px rgb(22 133 72 / 15%); }
.wallet-workspace .wallet-tabs button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; }
.transaction-panel .wallet-workspace-heading { align-items: flex-start; }
.wallet-refresh { padding: 7px 12px; border: 1px solid #dde8df; border-radius: 10px; color: #2c8b52; background: #f4faf5; font-size: 12px; font-weight: 700; }
.wallet-refresh:disabled { opacity: .6; }
.transaction-items { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.transaction-item { display: flex; align-items: center; gap: 11px; padding: 12px; border: 1px solid #e8efe9; border-radius: 13px; background: #fbfdfb; }
.transaction-icon { display: grid; flex: 0 0 auto; width: 34px; height: 34px; place-items: center; border-radius: 11px; }
.transaction-icon.deposit { color: #15773f; background: #e4f4e8; }
.transaction-icon.withdrawal { color: #a1591c; background: #fbefdf; }
.transaction-body { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
.transaction-body strong { color: #22392c; font-size: 13.5px; }
.transaction-body small { overflow: hidden; color: #7b887f; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.transaction-reference { font-variant-numeric: tabular-nums; }
.transaction-amount { display: flex; flex: 0 0 auto; flex-direction: column; align-items: flex-end; gap: 4px; }
.transaction-amount strong { color: #1f3d2a; font-size: 13.5px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.transaction-status { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 750; background: #eef1ef; }
.transaction-status.approved { color: #1d7a40; background: #dcf2e2; }
.transaction-status.rejected { color: #a33a3a; background: #f7dede; }
.transaction-status.pending { color: #8a6a17; background: #f8efcc; }

/* ---------- Account (professional layout) ---------- */
.account-hero-row { display: grid; grid-template-columns: minmax(0, 1fr); align-items: stretch; gap: 12px; }
.account-hero { display: flex; width: 100%; align-items: center; gap: 14px; padding: 18px; border: 1px solid #dfeae0; border-radius: 20px; color: inherit; background: white; font: inherit; text-align: left; cursor: pointer; transition: border-color .16s ease, box-shadow .16s ease; }
.account-hero:hover { border-color: #bfdcc6; box-shadow: 0 5px 16px rgb(31 72 43 / 5%); }
.account-hero .account-avatar { width: 68px; height: 68px; font-size: 27px; }
.account-hero-identity { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
.account-hero-label { color: #8a968e; font-size: 11px; font-weight: 650; letter-spacing: .04em; text-transform: uppercase; }
.account-hero-identity > strong { overflow: hidden; color: #1f3d2a; font-size: 19px; text-overflow: ellipsis; white-space: nowrap; }
.account-hero-identity > small { overflow: hidden; color: #7b887f; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.account-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.account-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 999px; font-size: 10.5px; font-weight: 750; }
.account-badge.ok { color: #1d7a40; background: #dcf2e2; }
.account-badge.warn { color: #8a6a17; background: #f8efcc; }
.account-badge.neutral { color: #5d6b61; background: #eff3f0; }
.account-balance-card { display: flex; align-items: center; gap: 12px; padding: 15px 17px; border: 1px solid #d5e9d8; border-radius: 17px; background: linear-gradient(135deg, #f4fbf6 0%, #ecf8ef 100%); }
.account-balance-icon { display: grid; width: 40px; height: 40px; place-items: center; border-radius: 12px; color: #15773f; background: #dcf2e2; }
.account-balance-copy { display: flex; flex: 1; flex-direction: column; gap: 1px; }
.account-balance-copy > span { color: #3c5a48; font-size: 13px; font-weight: 700; }
.account-balance-copy > small { color: #8a968e; font-size: 11px; }
.account-balance-card > strong { color: #176b3c; font-size: 20px; font-variant-numeric: tabular-nums; }
.account-profile-card { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 11px; padding: 14px 16px; border: 1px solid #e4ece5; border-radius: 16px; background: white; }
.account-profile-head { display: flex; align-items: center; gap: 10px; color: #2c8b52; }
.account-profile-head strong { display: block; color: #22392c; font-size: 13.5px; }
.account-profile-head small { color: #8a968e; font-size: 11px; }
.account-picture-card { flex-direction: row; align-items: center; justify-content: space-between; }
.rewards-tabs { display: flex; flex-wrap: wrap; overflow: visible; gap: 7px; padding: 5px; border: 1px solid #e1ebe2; border-radius: 15px; background: white; }
.rewards-tabs button { display: inline-flex; min-height: 40px; flex: 0 0 auto; align-items: center; justify-content: center; gap: 7px; padding: 0 13px; border: 0; border-radius: 10px; color: #6b7b70; background: transparent; font-size: 12px; font-weight: 750; white-space: nowrap; }
.rewards-tabs button.active { color: white; background: #168548; box-shadow: 0 2px 6px rgb(22 133 72 / 15%); }
.daily-rewards-section { display: grid; gap: 13px; }
.daily-rewards-banner { min-height: 142px; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 6px; padding: 22px; border: 1px solid #d5e9d8; border-radius: 18px; background: linear-gradient(115deg, #f1faf3, #fff 62%, #e8f5eb); }
.daily-rewards-banner .eyebrow { color: #528264; font-size: 10px; font-weight: 800; letter-spacing: .1em; }
.daily-rewards-banner h2 { margin: 0; color: #214b31; font-size: 22px; }
.daily-rewards-banner p { margin: 0; color: #6f7e73; font-size: 13px; }
.daily-checkin-card, .rewards-content-card { display: grid; gap: 15px; padding: 18px; border: 1px solid #dbe8dd; border-radius: 18px; background: white; box-shadow: 0 6px 20px rgb(31 72 43 / 4%); }
.daily-checkin-heading { display: flex; min-width: 0; align-items: center; gap: 12px; }
.daily-checkin-icon { display: grid; width: 52px; height: 52px; flex: 0 0 auto; place-items: center; border-radius: 15px; color: #187b43; background: #e7f4e9; }
.daily-checkin-heading > div { min-width: 0; flex: 1; }
.daily-checkin-heading h2, .rewards-content-heading h2 { margin: 0; color: #264b33; font-size: 17px; }
.daily-checkin-heading p, .rewards-content-heading p { margin: 3px 0 0; color: #7a887e; font-size: 12px; line-height: 1.45; }
.daily-streak-count { padding: 5px 10px; border: 1px solid #d7e9da; border-radius: 999px; color: #227745; background: #f2faf3; font-size: 13px; white-space: nowrap; }
.daily-reward-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 7px; }
.daily-reward-day { display: flex; min-width: 0; flex-direction: column; align-items: center; gap: 6px; color: #88948b; }
.daily-reward-day > span { display: grid; width: 36px; height: 36px; place-items: center; border: 1px solid #e0e9e1; border-radius: 50%; color: #68786d; background: #f8faf8; font-size: 12px; font-weight: 800; }
.daily-reward-day.current > span { border: 2px solid #168548; color: #168548; background: #f0f9f2; box-shadow: 0 0 0 3px #e4f3e7; }
.daily-reward-day.claimed > span { border-color: #168548; color: white; background: #168548; }
.daily-reward-day small { overflow: hidden; max-width: 100%; color: #748278; font-size: 9px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.daily-claim-button { min-height: 48px; border: 0; border-radius: 13px; color: white; background: linear-gradient(110deg, #168548, #29a45a); box-shadow: 0 4px 11px rgb(22 133 72 / 18%); font-size: 14px; font-weight: 800; }
.daily-claim-button:disabled { color: #718076; background: #edf2ee; box-shadow: none; cursor: not-allowed; }
.daily-reset-note { margin: -5px 0 0; color: #849087; font-size: 10px; text-align: center; }
.rewards-content-heading { display: flex; align-items: center; gap: 11px; color: #27864e; }
.rewards-content-heading > div { min-width: 0; }
.rewards-offer-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; }
.rewards-offer-card { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 14px; border: 1px solid #e1ebe2; border-radius: 14px; background: #fbfdfb; }
.rewards-offer-card > strong { color: #294b36; font-size: 14px; }
.rewards-offer-card p, .rewards-offer-card small { margin: 0; color: #77857b; font-size: 11px; line-height: 1.5; }
.rewards-offer-card > span { color: #208048; font-size: 12px; font-weight: 750; }
.rewards-offer-card .avatar-upload-button { margin-top: auto; }
.cashback-unavailable-note { margin: 0; padding: 13px; border: 1px solid #dce9de; border-radius: 12px; color: #43664d; background: #f3faf4; font-size: 12px; line-height: 1.5; }
.vip-tier-summary { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 15px; border: 1px solid #dce9de; border-radius: 14px; background: #f7fbf7; }
.vip-tier-badge { display: inline-flex; align-items: center; gap: 7px; color: #187b43; font-size: 18px; font-weight: 800; }
.vip-tier-summary > div { display: flex; flex-direction: column; gap: 3px; text-align: right; }
.vip-tier-summary small { color: #7b887f; font-size: 10px; }
.vip-tier-summary strong { color: #264b33; font-size: 15px; }
.vip-progress-label { display: flex; justify-content: space-between; color: #6f7e73; font-size: 10px; font-weight: 750; }
.vip-progress-track { overflow: hidden; height: 9px; border-radius: 99px; background: #e8efe9; }
.vip-progress-track > span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #168548, #61b875); transition: width .25s ease; }
.bonus-code-redeem-form { display: grid; gap: 7px; }
.bonus-code-redeem-form > label { color: #4a6150; font-size: 12px; font-weight: 700; }
.bonus-code-redeem-form > div { display: flex; gap: 8px; }
.bonus-code-redeem-form input { min-width: 0; min-height: 44px; flex: 1; padding: 9px 12px; border: 1px solid #d7e4d9; border-radius: 11px; color: #284b35; background: white; font-size: 13px; }
.bonus-code-redeem-form .primary-button { flex: 0 0 auto; }
.bonus-code-preview { display: grid; gap: 9px; padding: 13px; border: 1px solid #d4e7d8; border-radius: 13px; background: #f5fbf6; }
.bonus-code-preview > div { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px; }
.bonus-code-preview > div strong { color: #245537; font-size: 14px; letter-spacing: .04em; }
.bonus-code-preview > div span { color: #1d7a40; font-size: 12px; font-weight: 750; }
.bonus-code-preview p, .bonus-code-preview small { margin: 0; color: #718076; font-size: 11px; line-height: 1.5; }
.referral-card { display: grid; align-items: stretch; justify-content: stretch; gap: 12px; }
.referral-card-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.referral-list-heading { display: flex; align-items: center; justify-content: space-between; padding-top: 12px; border-top: 1px solid #e7eee8; }
.referral-list-heading strong { color: #324d3b; font-size: 13px; }
.referral-list-heading span { color: #7b887f; font-size: 11px; }
.referral-reward-summary { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; color: #748077; font-size: 11px; }
.referral-reward-summary strong { color: #187640; font-size: 12px; }
.referral-code-box { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding: 11px 13px; border: 1px dashed #b6d8bf; border-radius: 12px; background: #f5fbf6; }
.referral-code-box span { color: #718076; font-size: 11px; }
.referral-code-box strong { color: #185e34; font-size: 17px; letter-spacing: .08em; }
.referral-review-note, .referral-feedback { margin: 0; color: #718076; font-size: 11px; line-height: 1.5; }
.referral-feedback.error { color: #b34646; }
.referral-feedback.success { color: #187b43; }
.referral-card-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.referral-card-actions .avatar-upload-button { min-height: 38px; margin: 0; }
.referral-card-actions button:disabled { cursor: not-allowed; opacity: .55; }
.referral-list { display: grid; gap: 6px; }
.referral-list-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 9px 10px; border-radius: 10px; background: #f7faf7; }
.referral-list-row > div { min-width: 90px; flex: 1; }
.referral-list-row strong { color: #324d3b; font-size: 11px; }
.referral-list-row small { display: block; margin-top: 3px; color: #8a968e; font-size: 10px; }
.referral-status { font-size: 10px; font-weight: 750; }
.referral-status.pending { color: #a97924; }
.referral-status.approved { color: #23834a; }
.referral-status.rejected { color: #b85b5b; }
.account-group { display: flex; flex-direction: column; gap: 8px; }
.account-group-title { margin: 2px 0 0 2px; color: #7b887f; font-size: 11px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
.profile-shortcuts { display: flex; flex-direction: column; gap: 10px; }
.profile-shortcut-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.profile-shortcut { display: flex; min-width: 0; min-height: 100px; flex-direction: column; align-items: center; justify-content: center; gap: 9px; padding: 11px 6px; border: 1px solid #e4ece5; border-radius: 17px; color: #294b36; background: linear-gradient(160deg, #fff 20%, #f8fbf8); box-shadow: 0 5px 15px rgb(31 72 43 / 4%); transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease; }
.profile-shortcut:hover { transform: translateY(-2px); border-color: #b9d8c0; box-shadow: 0 8px 18px rgb(31 72 43 / 8%); }
.profile-shortcut:focus-visible { outline: 3px solid #26a85c; outline-offset: 2px; }
.profile-shortcut-icon { display: grid; width: 43px; height: 43px; place-items: center; border-radius: 14px; color: #168448; background: #e8f5eb; }
.profile-shortcut strong { max-width: 100%; color: #385341; font-size: 11px; font-weight: 700; line-height: 1.25; text-align: center; overflow-wrap: anywhere; }
.profile-shortcut.shortcut-tone-1 .profile-shortcut-icon, .profile-shortcut.shortcut-tone-5 .profile-shortcut-icon { color: #138047; background: #e6f4ea; }
.profile-shortcut.shortcut-tone-2 .profile-shortcut-icon, .profile-shortcut.shortcut-tone-6 .profile-shortcut-icon { color: #9a6a18; background: #fbf3dc; }
.profile-shortcut.shortcut-tone-3 .profile-shortcut-icon, .profile-shortcut.shortcut-tone-7 .profile-shortcut-icon { color: #267293; background: #e6f2f7; }
.profile-shortcut.shortcut-tone-4 .profile-shortcut-icon { color: #a44c49; background: #f9ecea; }
.transaction-filter { display: flex; gap: 7px; padding-bottom: 4px; }
.transaction-filter button { min-height: 34px; padding: 6px 12px; border: 1px solid #e3ebe4; border-radius: 999px; color: #607066; background: white; font-size: 12px; font-weight: 700; }
.transaction-filter button.active { border-color: #c4e3cc; color: #16763f; background: #eaf6ed; }
.account-page .account-action-grid { gap: 8px; }
.account-page .account-action-grid > button { min-height: 62px; padding: 12px 14px; border-radius: 15px; background: white; transition: border-color .16s ease, background .16s ease; }
.account-page .account-action-grid > button:hover { border-color: #bfdcc6; background: #fafdfa; }
.account-page .account-action-grid > button > svg:first-child { color: #2c8b52; }
.account-page .account-action-grid > button > svg:last-child { color: #b6c4ba; }
.account-page .sign-out-button { margin-top: 4px; }

/* ---------- Profile modal ---------- */
.profile-info { gap: 14px; }
.profile-name { color: #1f3d2a; font-size: 17px; }
.profile-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 999px; font-size: 10.5px; font-weight: 750; }
.profile-badge.ok { color: #1d7a40; background: #dcf2e2; }
.profile-badge.warn { color: #8a6a17; background: #f8efcc; }
.profile-section { display: flex; flex-direction: column; gap: 7px; }
.profile-section h3 { margin: 0; color: #7b887f; font-size: 11px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
.profile-rows { display: grid; gap: 1px; margin: 0; overflow: hidden; border: 1px solid #e8efe9; border-radius: 12px; background: #e8efe9; }
.profile-rows > div { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 10px 12px; background: white; }
.profile-rows dt { flex: 0 0 auto; color: #7b887f; font-size: 12px; }
.profile-rows dd { margin: 0; overflow: hidden; color: #22392c; font-size: 13px; font-weight: 650; text-align: right; text-overflow: ellipsis; }
@media (max-width: 540px) {
  .wallet-kyc-gate { align-items: flex-start; flex-wrap: wrap; }
  .wallet-kyc-gate > div { flex-basis: calc(100% - 38px); }
  .wallet-kyc-button, .wallet-kyc-pending { margin-left: 34px; }
  .wallet-deposit-amount .amount-options { gap: 5px; }
  .wallet-deposit-amount .amount-options button { padding-right: 1px; padding-left: 1px; font-size: 10px; }
}
@media (max-width: 640px) {
  .account-picture-card { flex-direction: row; align-items: center; justify-content: space-between; }
}
@media (max-width: 420px) {
  .profile-shortcut-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
  .profile-shortcut { min-height: 86px; flex-direction: row; justify-content: flex-start; padding: 11px; text-align: left; }
  .profile-shortcut-icon { width: 39px; height: 39px; flex: 0 0 auto; }
  .profile-shortcut strong { text-align: left; }
  .daily-checkin-card, .rewards-content-card { padding: 13px; }
  .daily-reward-days { gap: 3px; }
  .daily-reward-day > span { width: 31px; height: 31px; }
  .daily-reward-day small { font-size: 8px; }
  .bonus-code-redeem-form > div { flex-direction: column; }
}
@media (min-width: 760px) {
  .wallet-page .page-section, .account-page .page-section { gap: 16px;   }
  .wallet-balance-card { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); }
  .wallet-balance-main { padding: 26px; }
  .wallet-balance-split { border-left: 1px solid #e8efe9; }
  .account-page .account-action-grid { grid-template-columns: 1fr 1fr; }
}

/* Shared storefront polish */
.topbar {
  border-bottom: 1px solid rgb(255 255 255 / 14%);
  background: linear-gradient(110deg, #11863f, #159447 58%, #1ba354);
  box-shadow: 0 8px 22px rgb(19 99 49 / 16%);
}
.balance-button {
  box-shadow: 0 2px 8px rgb(7 71 31 / 12%);
  transition: transform .18s ease, box-shadow .18s ease;
}
.balance-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 5px 12px rgb(7 71 31 / 18%);
}
.desktop-nav {
  border-bottom-color: #e2ebe4;
  box-shadow: 0 5px 16px rgb(34 91 51 / 7%);
}
.desktop-nav button {
  transition: color .18s ease, background .18s ease, transform .18s ease;
}
.desktop-nav button:hover:not(.active) {
  color: #168446;
  background: #f2f8f3;
}
.content {
  gap: clamp(13px, 2vw, 20px);
}
.announcement {
  min-height: 52px;
  border: 1px solid #dcecdf;
  background: linear-gradient(105deg, #eaf6ec, #f3faf4);
}
.inbox-button {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  box-shadow: 0 3px 8px rgb(21 132 66 / 18%);
  transition: transform .18s ease, background .18s ease;
}
.inbox-button:hover {
  transform: translateY(-1px);
  background: #128c48;
}
.categories {
  border-color: #e5ede6;
  box-shadow: 0 7px 22px rgb(27 88 47 / 6%);
}
.category {
  min-height: 64px;
  border-radius: 13px;
  transition: color .18s ease, background .18s ease;
}
.category:hover,
.category.selected {
  background: #f1f8f2;
}
.category.selected .category-label {
  border-color: transparent;
  color: #168446;
}
.jackpot {
  border: 1px solid #e4eee5;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 7px 22px rgb(27 88 47 / 6%);
}
.game-category-section {
  border-color: #e5ede6;
  box-shadow: 0 8px 24px rgb(31 72 43 / 5%);
  transition: box-shadow .18s ease, border-color .18s ease;
}
.page-home .game-category-section > .empty-state {
  margin: 0;
  padding: 17px 12px;
  border: 1px dashed #dce8de;
  border-radius: 13px;
  background: #f8fbf8;
  line-height: 1.5;
}
.home-game-card {
  border-color: rgb(20 70 35 / 11%);
  box-shadow: 0 6px 16px rgb(28 69 39 / 13%);
}
.home-game-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 22px rgb(28 69 39 / 20%);
}
.page-heading {
  padding-top: 16px;
}
.page-heading .eyebrow {
  display: inline-block;
  margin-bottom: 2px;
}
.bottom-nav {
  min-height: 82px;
  align-items: center;
  padding-top: 8px;
  border-color: #e8eee9;
  box-shadow: 0 -7px 24px rgb(32 79 46 / 9%);
}
.bottom-nav button {
  min-height: 54px;
  flex: 1;
  justify-content: center;
  gap: 4px;
  border-radius: 14px;
  font-size: 11px;
  font-weight: 600;
  transition: color .18s ease, background .18s ease, transform .18s ease;
}
.bottom-nav button.active-nav {
  color: #168446;
  background: #edf7ef;
}
.bottom-nav button:active {
  transform: scale(.96);
}
.page-section {
  gap: clamp(14px, 2vw, 19px);
}
@media (min-width: 760px) {
  .page-home .game-category-section:hover {
    border-color: #d7e8da;
    box-shadow: 0 10px 28px rgb(31 72 43 / 8%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .balance-button,
  .inbox-button,
  .desktop-nav button,
  .category,
  .game-category-section,
  .home-game-card,
  .bottom-nav button {
    transition: none;
  }
}

/* Consistent layouts and controls across account, wallet, rewards, and offers */
.page-section {
  width: 100%;
  max-width: 1080px;
  align-self: center;
  gap: clamp(16px, 2.2vw, 22px);
  padding: 8px 0 28px;
}
.page-heading {
  padding: 18px 2px 5px;
}
.page-heading h1 {
  font-size: clamp(28px, 5vw, 40px);
  letter-spacing: -.045em;
  line-height: 1.08;
}
.page-heading p {
  max-width: 62ch;
  font-size: 14px;
  line-height: 1.6;
}
.page-heading-simple {
  padding-top: 10px;
  padding-bottom: 0;
}
.page-heading-simple h1 {
  margin: 0;
}
.page-section > .empty-state {
  margin: 0;
  padding: 28px 18px;
  border: 1px solid #e4ece5;
  border-radius: 16px;
  color: #64736a;
  background: #fff;
  box-shadow: 0 5px 16px rgb(31 72 43 / 4%);
  line-height: 1.55;
}
.profile-tabs,
.rewards-tabs {
  border-color: #e2ebe3;
  border-radius: 16px;
  box-shadow: 0 4px 14px rgb(31 72 43 / 4%);
}
.profile-tabs button,
.rewards-tabs button {
  min-height: 43px;
  border-radius: 11px;
  transition: color .18s ease, background .18s ease, box-shadow .18s ease;
}
.profile-tabs button:not(.active):hover,
.rewards-tabs button:not(.active):hover {
  color: #168446;
  background: #f2f8f3;
}
.profile-tabs button.active,
.rewards-tabs button.active {
  background: linear-gradient(110deg, #168548, #229b53);
  box-shadow: 0 3px 9px rgb(22 133 72 / 18%);
}
@media (max-width: 480px) {
  .rewards-tabs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .rewards-tabs button {
    width: 100%;
    min-width: 0;
    padding-right: 8px;
    padding-left: 8px;
  }
}
.account-hero,
.account-profile-card,
.account-balance-card,
.wallet-balance-card,
.wallet-workspace,
.daily-checkin-card,
.rewards-content-card {
  border-color: #e2ebe3;
  box-shadow: 0 6px 20px rgb(31 72 43 / 5%);
}
.account-hero {
  min-height: 126px;
  padding: clamp(16px, 2.4vw, 23px);
}
.account-hero .account-avatar {
  box-shadow: 0 0 0 4px #eff7f0;
}
.account-balance-card {
  min-height: 94px;
  border-radius: 18px;
}
.account-balance-card > strong {
  font-size: clamp(18px, 3vw, 22px);
  font-variant-numeric: tabular-nums;
}
.account-group {
  gap: 11px;
}
.account-group-title {
  margin-left: 1px;
  color: #526d5b;
  font-size: 12px;
  letter-spacing: .06em;
}
.profile-shortcut {
  border-color: #e3ebe4;
  background: #fff;
  box-shadow: 0 4px 14px rgb(31 72 43 / 4%);
}
.profile-shortcut:hover {
  transform: translateY(-2px);
  border-color: #c7dfcc;
  box-shadow: 0 8px 20px rgb(31 72 43 / 8%);
}
.account-page .account-action-grid > button {
  min-height: 68px;
  border-color: #e3ebe4;
  box-shadow: 0 3px 12px rgb(31 72 43 / 3%);
}
.account-page .account-action-grid > button:hover {
  transform: translateY(-1px);
  border-color: #c7dfcc;
  background: #f9fcf9;
  box-shadow: 0 6px 16px rgb(31 72 43 / 6%);
}
.wallet-balance-card {
  border-radius: 21px;
}
.wallet-balance-main {
  background: linear-gradient(120deg, #147d40, #159447 58%, #1da254);
}
.wallet-balance-split {
  background: #fff;
}
.wallet-transfer-button,
.wallet-copy-button,
.wallet-refresh,
.wallet-kyc-button,
.avatar-upload-button {
  transition: border-color .18s ease, color .18s ease, background .18s ease, transform .18s ease;
}
.wallet-transfer-button:hover:not(:disabled),
.wallet-copy-button:hover,
.wallet-refresh:hover:not(:disabled),
.wallet-kyc-button:hover,
.avatar-upload-button:hover {
  transform: translateY(-1px);
  border-color: #a9d2b3;
  background: #edf7ef;
}
.wallet-workspace {
  gap: 15px;
  padding: clamp(15px, 2.2vw, 22px);
  border-radius: 20px;
}
.wallet-payment-card,
.transaction-item,
.rewards-offer-card {
  border-color: #e4ece5;
  background: #fff;
  transition: border-color .18s ease, box-shadow .18s ease;
}
.transaction-item:hover,
.rewards-offer-card:hover {
  border-color: #cbded0;
  box-shadow: 0 5px 14px rgb(31 72 43 / 5%);
}
.wallet-input-shell,
.bonus-code-redeem-form input,
.auth-form input,
.auth-form select,
.kyc-form select,
.kyc-form input {
  border-color: #dce7de;
  transition: border-color .18s ease, box-shadow .18s ease;
}
.wallet-input-shell:focus-within,
.bonus-code-redeem-form input:focus,
.auth-form input:focus,
.auth-form select:focus,
.kyc-form select:focus,
.kyc-form input:focus {
  border-color: #55ad70;
  box-shadow: 0 0 0 3px rgb(39 169 92 / 11%);
}
.daily-rewards-banner {
  border-color: #d7e9da;
  background: linear-gradient(115deg, #eaf6ed, #fff 58%, #f0f8f1);
}
.daily-checkin-card,
.rewards-content-card {
  border-radius: 20px;
}
.daily-claim-button,
.primary-button,
.wallet-transfer-button {
  transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
}
.daily-claim-button:hover:not(:disabled),
.primary-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgb(22 133 72 / 19%);
}
.promotion-banner,
.promotion-complete-link {
  border-radius: 21px;
}
.promotion-full-details {
  border-color: #e2ebe3;
  border-radius: 16px;
}
.signed-out-card {
  border-color: #e2ebe3;
  box-shadow: 0 6px 20px rgb(31 72 43 / 5%);
}
@media (max-width: 640px) {
  .page-section {
    padding-bottom: 20px;
  }
  .promotion-feature-card {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr);
  }
  .promotion-feature-action {
    grid-column: 1 / -1;
    width: 100%;
  }
  .promotion-filter-tabs button {
    gap: 4px;
    padding-right: 5px;
    padding-left: 5px;
    font-size: 10px;
  }
  .account-hero-row {
    gap: 10px;
  }
  .account-hero {
    min-height: 112px;
  }
  .account-profile-card {
    padding: 13px;
  }
  .wallet-workspace-heading {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .wallet-workspace .wallet-tabs {
    width: 100%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .profile-tabs button,
  .rewards-tabs button,
  .wallet-transfer-button,
  .wallet-copy-button,
  .wallet-refresh,
  .wallet-kyc-button,
  .avatar-upload-button,
  .transaction-item,
  .rewards-offer-card,
  .daily-claim-button,
  .primary-button {
    transition: none;
  }
}
</style>
