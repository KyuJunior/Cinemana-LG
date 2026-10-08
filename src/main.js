/**
 * Cinemana for LG webOS TV - Main Application Controller
 */

import 'whatwg-fetch';
import { CinemanaApi } from './api.js';
import { Storage } from './storage.js';
import { SpatialNavigation } from './navigation.js';
import { SubtitleRenderer } from './subtitles.js';

// Base URL configuration for custom domain and webOS relative paths
export const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
};

// Global Application State
const state = {
  currentRoute: 'home',
  previousRoute: 'home',
  banners: [],
  currentBannerIndex: 0,
  bannerInterval: null,
  latestMovies: [],
  moviesPage: 0,
  isLoadingMovies: false,
  latestSeries: [],
  seriesPage: 0,
  isLoadingSeries: false,
  videoGroups: [],
  activeDetailsVideo: null,
  activeDetailsEpisodes: [],
  selectedSeason: 1,
  activeStreams: [],
  currentStream: null,
  activeSubtitles: [],
  currentSubtitle: null,
  introInterval: null,
  isOsdVisible: true,
  osdTimer: null,
  saveProgressTimer: null,
  keyboardMode: 'en', // 'en' or 'ar'
  searchDebounceTimer: null,
  searchFilter: 'all',
  searchResults: { series: [], movies: [], all: [] },
  censorshipIntervals: [],
  isCensorEnabled: true,
  playbackSpeed: 1.0,
  activeSubtitlesMode: false,
  activePlayingItem: null,
};

// DOM Element Cache
const els = {
  sideDock: document.getElementById('side-dock'),
  mainContent: document.getElementById('main-content'),
  homeHeroContainer: document.getElementById('home-hero-container'),
  homeShelvesContainer: document.getElementById('home-shelves-container'),
  moviesGrid: document.getElementById('movies-grid'),
  moviesLoadMore: document.getElementById('movies-load-more'),
  seriesGrid: document.getElementById('series-grid'),
  seriesLoadMore: document.getElementById('series-load-more'),
  searchInput: document.getElementById('search-input'),
  searchClearBtn: document.getElementById('search-clear-btn'),
  virtualKeyboardContainer: document.getElementById('virtual-keyboard-container'),
  searchFilterTabs: document.getElementById('search-filter-tabs'),
  tabCountAll: document.getElementById('tab-count-all'),
  tabCountSeries: document.getElementById('tab-count-series'),
  tabCountMovies: document.getElementById('tab-count-movies'),
  searchStatusContainer: document.getElementById('search-status-container'),
  searchSectionsWrapper: document.getElementById('search-sections-wrapper'),
  searchSectionSeries: document.getElementById('search-section-series'),
  searchSeriesBadge: document.getElementById('search-series-badge'),
  searchSeriesGrid: document.getElementById('search-series-grid'),
  searchSectionMovies: document.getElementById('search-section-movies'),
  searchMoviesBadge: document.getElementById('search-movies-badge'),
  searchMoviesGrid: document.getElementById('search-movies-grid'),
  favoritesGrid: document.getElementById('favorites-grid'),
  detailsViewContainer: document.getElementById('details-view-container'),
  videoElement: document.getElementById('video-element'),
  subtitlesDisplay: document.getElementById('subtitles-display'),
  skipIntroBox: document.getElementById('skip-intro-box'),
  btnSkipIntro: document.getElementById('btn-skip-intro'),
  playerOsd: document.getElementById('player-osd'),
  playerTitleText: document.getElementById('player-title-text'),
  playerSubtitleText: document.getElementById('player-subtitle-text'),
  playerClockText: document.getElementById('player-clock-text'),
  btnPlayerBack: document.getElementById('btn-player-back'),
  btnPlayerPlayPause: document.getElementById('btn-player-play-pause'),
  ctrlIconPlay: document.getElementById('ctrl-icon-play'),
  ctrlIconPause: document.getElementById('ctrl-icon-pause'),
  btnPlayerPrevEp: document.getElementById('btn-player-prev-ep'),
  btnPlayerRewind: document.getElementById('btn-player-rewind'),
  btnPlayerForward: document.getElementById('btn-player-forward'),
  btnPlayerNextEp: document.getElementById('btn-player-next-ep'),
  btnPlayerRestart: document.getElementById('btn-player-restart'),
  playerTimeline: document.getElementById('player-timeline'),
  playerTimelineBuffer: document.getElementById('player-timeline-buffer'),
  playerTimelinePlayed: document.getElementById('player-timeline-played'),
  playerTimelineThumb: document.getElementById('player-timeline-thumb'),
  playerBottomMainBar: document.getElementById('player-bottom-main-bar'),
  btnPlayerFullscreen: document.getElementById('btn-player-fullscreen'),
  ctrlIconFullscreen: document.getElementById('ctrl-icon-fullscreen'),
  ctrlIconNormalscreen: document.getElementById('ctrl-icon-normalscreen'),
  btnPlayerSubsToggle: document.getElementById('btn-player-subs-toggle'),
  btnPlayerCensor: document.getElementById('btn-player-censor'),
  btnPlayerMore: document.getElementById('btn-player-more'),
  playerTimeDisplay: document.getElementById('player-time-display'),
  playerBottomSubsBar: document.getElementById('player-bottom-subs-bar'),
  btnSubBack: document.getElementById('btn-sub-back'),
  btnSubTrack: document.getElementById('btn-sub-track'),
  btnSubSize: document.getElementById('btn-sub-size'),
  btnSubSync: document.getElementById('btn-sub-sync'),
  btnSubColor: document.getElementById('btn-sub-color'),
  btnSubBg: document.getElementById('btn-sub-bg'),
  playerSubTimeDisplay: document.getElementById('player-sub-time-display'),
  modalMore: document.getElementById('modal-more'),
  btnCloseModalMore: document.getElementById('btn-close-modal-more'),
  btnMoreQuality: document.getElementById('btn-more-quality'),
  moreLabelQuality: document.getElementById('more-label-quality'),
  btnMoreSpeed: document.getElementById('btn-more-speed'),
  moreLabelSpeed: document.getElementById('more-label-speed'),
  modalQuality: document.getElementById('modal-quality'),
  modalQualityOptions: document.getElementById('modal-quality-options'),
  btnCloseModalQuality: document.getElementById('btn-close-modal-quality'),
  modalSubtitles: document.getElementById('modal-subtitles'),
  modalSubtitlesOptions: document.getElementById('modal-subtitles-options'),
  btnCloseModalSubtitles: document.getElementById('btn-close-modal-subtitles'),
  screenPlayer: document.getElementById('screen-player'),
  toast: document.getElementById('app-toast'),
};

// Initialize Spatial Navigation and Subtitles
const nav = new SpatialNavigation();
const userSettings = Storage.getSettings();
state.isCensorEnabled = userSettings.cutCensoredScenes !== false;
const subtitleEngine = new SubtitleRenderer(els.subtitlesDisplay, {
  fontSize: userSettings.subtitleFontSize || 28,
  fontColor: userSettings.subtitleFontColor || '#ffffff',
  bgStyle: userSettings.subtitleBgStyle || 'box',
});

/**
 * Toast Notification Utility
 */
let toastTimeout = null;
function showToast(message, duration = 3500) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    els.toast.classList.remove('visible');
  }, duration);
}

/**
 * Time Formatter (HH:MM:SS or MM:SS)
 */
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const totalSecs = Math.floor(seconds);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const pad = num => (num < 10 ? '0' + num : '' + num);
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Update Current Time in Player OSD
 */
function updateClock() {
  if (!els.playerClockText) return;
  const now = new Date();
  const pad = num => (num < 10 ? '0' + num : '' + num);
  const hrs = pad(now.getHours());
  const mins = pad(now.getMinutes());
  els.playerClockText.textContent = `${hrs}:${mins}`;
}
setInterval(updateClock, 30000);
updateClock();

/**
 * Route & Screen Navigation Manager
 */
function navigateToRoute(route, pushState = true) {
  if (state.currentRoute === route && route !== 'details' && route !== 'player') return;

  const previousScreen = document.getElementById(`screen-${state.currentRoute}`);
  if (previousScreen) {
    previousScreen.classList.remove('active');
  }

  // Handle exiting player if leaving player route
  if (state.currentRoute === 'player' && route !== 'player') {
    exitPlayer();
  }

  state.previousRoute = state.currentRoute;
  state.currentRoute = route;

  const targetScreen = document.getElementById(`screen-${route}`);
  if (targetScreen) {
    targetScreen.classList.add('active');
  }

  // Update Side Dock active button
  document.querySelectorAll('#side-dock .nav-item').forEach(btn => {
    if (btn.getAttribute('data-route') === route) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (pushState && route !== 'details' && route !== 'player') {
    window.location.hash = `#${route}`;
  }

  // Focus management on route change
  if (route === 'home') {
    const heroBtn = document.querySelector('#home-hero-container .btn-primary');
    if (heroBtn) nav.setFocus(heroBtn);
    else nav.setFocus('#nav-btn-home');
  } else if (route === 'movies') {
    loadMovies();
    setTimeout(() => {
      const firstCard = els.moviesGrid.querySelector('.video-card');
      if (firstCard) nav.setFocus(firstCard);
    }, 200);
  } else if (route === 'series') {
    loadSeries();
    setTimeout(() => {
      const firstCard = els.seriesGrid.querySelector('.video-card');
      if (firstCard) nav.setFocus(firstCard);
    }, 200);
  } else if (route === 'search') {
    if (els.searchInput) els.searchInput.focus();
  } else if (route === 'favorites') {
    renderFavorites();
  } else if (route === 'settings') {
    syncSettingsUI();
    const firstOption = document.querySelector('#settings-quality-group button');
    if (firstOption) nav.setFocus(firstOption);
  } else if (route === 'terms') {
    nav.setFocus('#btn-terms-back');
  } else if (route === 'privacy') {
    nav.setFocus('#btn-privacy-back');
  }
}

/**
 * Helper to build standard video card HTML
 */
function createVideoCard(video, index = 0) {
  const card = document.createElement('div');
  card.className = 'video-card focusable';
  card.tabIndex = 0;
  card.setAttribute('data-id', video.id);

  const title = video.primaryTitle || video.displayTitle || video.enTitle || video.arTitle || 'Untitled';
  const ratingText = video.rating > 0 ? video.rating.toFixed(1) : '';
  const yearText = video.year || '';
  const kindText = video.isSeries ? 'مسلسل / Series' : (video.formattedDuration || 'فيلم / Movie');

  card.innerHTML = `
    <div class="poster-container">
      ${video.posterUrl ? `<img src="${video.posterUrl}" alt="${title}" class="poster-img" loading="lazy" onerror="this.style.display='none'">` : ''}
      <div class="poster-placeholder" style="${video.posterUrl ? 'display:none;' : ''}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36">
          <rect width="18" height="18" x="3" y="3" rx="2"/>
          <path d="M7 3v18"/>
          <path d="M17 3v18"/>
        </svg>
      </div>
      ${ratingText ? `
        <div class="rating-badge">
          <svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <span>${ratingText}</span>
        </div>
      ` : ''}
      <div class="quality-tag">${video.isSeries ? 'مسلسل' : 'فيلم'}</div>
    </div>
    <div class="card-info">
      <div class="card-title" title="${title}">${title}</div>
      <div class="card-meta">
        ${yearText ? `<span>${yearText}</span>` : ''}
        <span>${kindText}</span>
      </div>
    </div>
  `;

  card.addEventListener('click', () => {
    openDetails(video);
  });

  return card;
}

/**
 * Render Featured Hero Banner
 */
function renderHeroBanner() {
  if (!state.banners.length) return;
  const video = state.banners[state.currentBannerIndex];
  if (!video) return;

  const savedPos = Storage.getSavedPosition(video.id);
  const playLabel = savedPos > 15 ? 'استئناف المشاهدة / Resume' : 'مشاهدة الآن / Watch Now';

  els.homeHeroContainer.innerHTML = `
    <div class="hero-banner">
      <img src="${video.backdropUrl || video.posterUrl}" alt="${video.primaryTitle}" class="hero-backdrop" onerror="this.src='./assets/cinemana_banner.png'">
      <div class="hero-overlay">
        <div class="hero-badge-row">
          <span class="badge badge-gold">
            <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            ${video.rating > 0 ? video.rating.toFixed(1) : '8.5'}
          </span>
          ${video.year ? `<span class="badge">${video.year}</span>` : ''}
          ${video.formattedDuration ? `<span class="badge">${video.formattedDuration}</span>` : ''}
          ${video.isSeries ? `<span class="badge badge-crimson">مسلسل / Series</span>` : ''}
          ${video.categories.slice(0, 3).map(c => `<span class="badge">${c}</span>`).join('')}
        </div>
        <div class="hero-title-box">
          <h1 class="hero-title-primary">${video.arTitle || video.enTitle}</h1>
          ${video.enTitle && video.arTitle && video.enTitle !== video.arTitle ? `<h2 class="hero-title-secondary">${video.enTitle}</h2>` : ''}
          <p class="hero-overview">${video.displayOverview || 'شاهد أحدث الإنتاجات السينمائية العالمية والعربية بدقة عالية وبدون انقطاع على شبكتي سينمانا.'}</p>
        </div>
        <div class="hero-actions">
          <button id="hero-btn-play" class="btn btn-primary focusable">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <span>${playLabel}</span>
          </button>
          <button id="hero-btn-details" class="btn btn-secondary focusable">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <span>تفاصيل العمل / Details</span>
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('hero-btn-play').addEventListener('click', () => {
    startPlayback(video);
  });

  document.getElementById('hero-btn-details').addEventListener('click', () => {
    openDetails(video);
  });
}

/**
 * Start Auto Rotating Hero Banner
 */
function startBannerTimer() {
  clearInterval(state.bannerInterval);
  state.bannerInterval = setInterval(() => {
    if (state.currentRoute === 'home' && state.banners.length > 1) {
      // Only slide if user is near top
      const homeScreen = document.getElementById('screen-home');
      if (homeScreen && homeScreen.scrollTop < 250) {
        state.currentBannerIndex = (state.currentBannerIndex + 1) % state.banners.length;
        renderHeroBanner();
      }
    }
  }, 12000);
}

/**
 * Render Shelf Section
 */
function renderShelf(title, items) {
  if (!items || !items.length) return null;

  const section = document.createElement('section');
  section.className = 'shelf-section';

  const header = document.createElement('div');
  header.className = 'shelf-header';
  header.innerHTML = `<h2 class="shelf-title">${title}</h2>`;

  const track = document.createElement('div');
  track.className = 'shelf-track';

  items.forEach((item, index) => {
    track.appendChild(createVideoCard(item, index));
  });

  section.appendChild(header);
  section.appendChild(track);
  return section;
}

/**
 * Load Initial Home Content
 */
async function loadHomeContent() {
  const userSettings = Storage.getSettings();
  const level = userSettings.parentalLevel || 0;

  try {
    const [banners, movies, series, groups] = await Promise.all([
      CinemanaApi.getBanners(level).catch(e => { console.warn('Banners error:', e); return []; }),
      CinemanaApi.getLatestMovies(0, 20, level).catch(e => { console.warn('Movies error:', e); return []; }),
      CinemanaApi.getLatestSeries(0, 20, level).catch(e => { console.warn('Series error:', e); return []; }),
      CinemanaApi.getVideoGroups('ar', level).catch(e => { console.warn('Groups error:', e); return []; }),
    ]);

    state.banners = banners;
    state.latestMovies = movies;
    state.latestSeries = series;
    state.videoGroups = groups;

    renderHeroBanner();
    startBannerTimer();

    els.homeShelvesContainer.innerHTML = '';

    // 1. Latest Movies Shelf
    const moviesShelf = renderShelf('أحدث الأفلام / Latest Movies', movies);
    if (moviesShelf) els.homeShelvesContainer.appendChild(moviesShelf);

    // 2. Latest Series Shelf
    const seriesShelf = renderShelf('أحدث المسلسلات / Latest TV Series', series);
    if (seriesShelf) els.homeShelvesContainer.appendChild(seriesShelf);

    // 3. Curated Shabakaty Groups Shelves
    groups.forEach(group => {
      const shelf = renderShelf(group.title, group.items);
      if (shelf) els.homeShelvesContainer.appendChild(shelf);
    });

  } catch (err) {
    console.error('Failed to load home content:', err);
    els.homeShelvesContainer.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48" style="color: var(--accent-crimson);">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p>تعذر الاتصال بشبكة سينمانا. يرجى التأكد من اتصال التلفزيون بشبكة المزود المحلي.</p>
        <button id="btn-retry-home" class="btn btn-primary focusable" style="margin-top: 14px;">إعادة المحاولة / Retry</button>
      </div>
    `;
    const retryBtn = document.getElementById('btn-retry-home');
    if (retryBtn) {
      retryBtn.addEventListener('click', loadHomeContent);
      nav.setFocus(retryBtn);
    }
  }
}

/**
 * Load Movies Grid View
 */
async function loadMovies(page = 0) {
  if (state.isLoadingMovies) return;
  state.isLoadingMovies = true;
  state.moviesPage = page;

  if (page === 0) {
    els.moviesGrid.innerHTML = `
      <div class="spinner-container" style="grid-column: 1/-1;">
        <div class="spinner"></div>
      </div>
    `;
  }

  const userSettings = Storage.getSettings();
  try {
    const movies = await CinemanaApi.getLatestMovies(page, 30, userSettings.parentalLevel);
    if (page === 0) els.moviesGrid.innerHTML = '';

    movies.forEach(item => {
      els.moviesGrid.appendChild(createVideoCard(item));
    });

    if (page === 0 && movies.length > 0) {
      const first = els.moviesGrid.querySelector('.video-card');
      if (first) nav.setFocus(first);
    }

    els.moviesLoadMore.innerHTML = `
      <button id="btn-load-more-movies" class="btn btn-secondary focusable" style="padding: 12px 36px;">
        تحميل المزيد من الأفلام / Load More
      </button>
    `;
    const btn = document.getElementById('btn-load-more-movies');
    if (btn) {
      btn.addEventListener('click', () => loadMovies(state.moviesPage + 1));
    }
  } catch (e) {
    console.error('Error loading movies:', e);
  } finally {
    state.isLoadingMovies = false;
  }
}

/**
 * Load Series Grid View
 */
async function loadSeries(page = 0) {
  if (state.isLoadingSeries) return;
  state.isLoadingSeries = true;
  state.seriesPage = page;

  if (page === 0) {
    els.seriesGrid.innerHTML = `
      <div class="spinner-container" style="grid-column: 1/-1;">
        <div class="spinner"></div>
      </div>
    `;
  }

  const userSettings = Storage.getSettings();
  try {
    const series = await CinemanaApi.getLatestSeries(page, 30, userSettings.parentalLevel);
    if (page === 0) els.seriesGrid.innerHTML = '';

    series.forEach(item => {
      els.seriesGrid.appendChild(createVideoCard(item));
    });

    if (page === 0 && series.length > 0) {
      const first = els.seriesGrid.querySelector('.video-card');
      if (first) nav.setFocus(first);
    }

    els.seriesLoadMore.innerHTML = `
      <button id="btn-load-more-series" class="btn btn-secondary focusable" style="padding: 12px 36px;">
        تحميل المزيد من المسلسلات / Load More
      </button>
    `;
    const btn = document.getElementById('btn-load-more-series');
    if (btn) {
      btn.addEventListener('click', () => loadSeries(state.seriesPage + 1));
    }
  } catch (e) {
    console.error('Error loading series:', e);
  } finally {
    state.isLoadingSeries = false;
  }
}

/**
 * Render Favorites Screen
 */
function renderFavorites() {
  const favorites = Storage.getFavorites();
  els.favoritesGrid.innerHTML = '';

  if (!favorites.length) {
    els.favoritesGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1; padding: 100px 20px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" style="color: var(--accent-gold);">
          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
        </svg>
        <h2 style="font-size: 20px; color: #ffffff;">لا توجد عناصر مضافة للمفضلة</h2>
        <p>يمكنك إضافة أي فيلم أو مسلسل إلى المفضلة بالضغط على زر المفضلة في صفحة العمل.</p>
      </div>
    `;
    return;
  }

  favorites.forEach(item => {
    els.favoritesGrid.appendChild(createVideoCard(item));
  });

  const firstFav = els.favoritesGrid.querySelector('.video-card');
  if (firstFav) nav.setFocus(firstFav);
}

/**
 * Open Video Details View (Modal Overlay)
 */
async function openDetails(video) {
  state.activeDetailsVideo = video;
  document.getElementById('screen-details').classList.add('active');

  const isFav = Storage.isFavorite(video.id);
  const savedPos = Storage.getSavedPosition(video.id);
  const playBtnText = savedPos > 15 ? 'استئناف المشاهدة / Resume' : 'مشاهدة الآن / Watch Now';

  els.detailsViewContainer.innerHTML = `
    <div class="details-hero">
      <img src="${video.backdropUrl || video.posterUrl}" class="details-backdrop-bg" alt="${video.primaryTitle}">
      <div class="details-backdrop-gradient"></div>

      <div class="details-content-box">
        <div class="details-poster-box">
          <img src="${video.posterUrl}" alt="${video.primaryTitle}" onerror="this.src='./assets/cinemana_logo.png'">
        </div>

        <div class="details-info-box">
          <div class="details-meta-row">
            <span class="badge badge-gold">
              <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              ${video.rating > 0 ? video.rating.toFixed(1) : '8.5'}
            </span>
            ${video.year ? `<span class="badge">${video.year}</span>` : ''}
            ${video.formattedDuration ? `<span class="badge">${video.formattedDuration}</span>` : ''}
            ${video.isSeries ? `<span class="badge badge-crimson">مسلسل / Series</span>` : ''}
            ${video.categories.map(c => `<span class="badge">${c}</span>`).join('')}
          </div>

          <h1 class="details-title-ar">${video.arTitle || video.enTitle}</h1>
          ${video.enTitle && video.arTitle && video.enTitle !== video.arTitle ? `<h2 class="details-title-en">${video.enTitle}</h2>` : ''}

          <p class="details-overview">${video.displayOverview || 'لا يوجد وصف متوفر لهذا العمل حاليا.'}</p>

          <div class="details-actions-row">
            <button id="btn-details-play" class="btn btn-primary focusable">
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              <span>${playBtnText}</span>
            </button>

            <button id="btn-details-fav" class="btn btn-secondary focusable">
              <svg viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" width="18" height="18" style="color: var(--accent-gold);">
                <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
              </svg>
              <span id="label-fav-status">${isFav ? 'في المفضلة / Saved' : 'إضافة للمفضلة / Save'}</span>
            </button>

            <button id="btn-details-back" class="btn btn-secondary focusable">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              <span>رجوع / Back</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Series Episodes Section if applicable -->
    <div id="details-episodes-section" class="episodes-section" style="${video.isSeries ? '' : 'display:none;'}">
      <h2 class="shelf-title" style="margin-bottom: 14px;">الحلقات والمواسم / Episodes</h2>
      <div id="details-seasons-bar" class="seasons-bar"></div>
      <div id="details-episodes-track" class="episodes-track">
        <div class="spinner-container" style="min-height: 120px;">
          <div class="spinner"></div>
        </div>
      </div>
    </div>

    <!-- Related Titles Shelf -->
    <div id="details-related-section" style="padding-top: 10px;"></div>
  `;

  // Attach button events
  const playBtn = document.getElementById('btn-details-play');
  const favBtn = document.getElementById('btn-details-fav');
  const backBtn = document.getElementById('btn-details-back');

  playBtn.addEventListener('click', () => startPlayback(video));
  backBtn.addEventListener('click', closeDetails);

  favBtn.addEventListener('click', () => {
    const isNowFav = Storage.toggleFavorite(video);
    favBtn.querySelector('svg').setAttribute('fill', isNowFav ? 'currentColor' : 'none');
    document.getElementById('label-fav-status').textContent = isNowFav ? 'في المفضلة / Saved' : 'إضافة للمفضلة / Save';
    showToast(isNowFav ? 'تمت إضافة العمل إلى المفضلة' : 'تمت إزالة العمل من المفضلة');
  });

  nav.setFocus(playBtn);

  // Push back handler
  nav.pushBackHandler(closeDetails);

  // Load episodes if series, and related titles
  loadDetailsExtras(video);
}

/**
 * Load Seasons, Episodes & Related Titles for Details Screen
 */
async function loadDetailsExtras(video) {
  try {
    const userSettings = Storage.getSettings();
    const relatedPromise = CinemanaApi.getRelatedVideos(video.id, video.isSeries, userSettings.parentalLevel);

    let seasons = [];
    let episodes = [];
    if (video.isSeries) {
      [seasons, episodes] = await Promise.all([
        CinemanaApi.getSeasons(video.id),
        CinemanaApi.getEpisodes(video.id),
      ]);
      state.activeDetailsEpisodes = episodes;

      const seasonsBar = document.getElementById('details-seasons-bar');
      if (seasonsBar && seasons.length > 0) {
        seasonsBar.innerHTML = '';
        seasons.forEach((seasonNum, idx) => {
          const btn = document.createElement('button');
          btn.className = `season-btn focusable ${idx === 0 ? 'active' : ''}`;
          btn.textContent = `الموسم ${seasonNum} / S${seasonNum}`;
          btn.addEventListener('click', () => {
            seasonsBar.querySelectorAll('.season-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderEpisodesForSeason(seasonNum);
          });
          seasonsBar.appendChild(btn);
        });
        renderEpisodesForSeason(seasons[0]);
      }
    }

    const related = await relatedPromise;
    const relatedSection = document.getElementById('details-related-section');
    if (relatedSection && related.length > 0) {
      const relatedShelf = renderShelf('أعمال مشابهة / More Like This', related);
      if (relatedShelf) relatedSection.appendChild(relatedShelf);
    }
  } catch (err) {
    console.error('Error loading details extras:', err);
  }
}

/**
 * Render Episode Cards for a selected season
 */
function renderEpisodesForSeason(seasonNum) {
  const track = document.getElementById('details-episodes-track');
  if (!track) return;
  track.innerHTML = '';

  const filtered = state.activeDetailsEpisodes.filter(ep => {
    const s = parseInt(ep.season, 10);
    return isNaN(s) || s === seasonNum;
  });

  if (!filtered.length) {
    track.innerHTML = `<p style="color: var(--text-muted); padding: 20px;">لا توجد حلقات متوفرة لهذا الموسم.</p>`;
    return;
  }

  filtered.forEach(ep => {
    const card = document.createElement('div');
    card.className = 'episode-card focusable';
    card.tabIndex = 0;
    card.innerHTML = `
      <div class="thumb-box">
        <img src="${ep.thumbUrl || state.activeDetailsVideo.backdropUrl || './assets/cinemana_logo.png'}" alt="${ep.title}" onerror="this.src='./assets/cinemana_logo.png'">
        <div class="ep-number-tag">الحلقة ${ep.episodeNumber}</div>
      </div>
      <div class="ep-info" title="${ep.title}">
        <span>${ep.title}</span>
      </div>
    `;

    card.addEventListener('click', () => {
      const epVideo = {
        ...state.activeDetailsVideo,
        id: ep.id,
        arTitle: `${state.activeDetailsVideo.arTitle} - حلقة ${ep.episodeNumber}`,
        enTitle: `${state.activeDetailsVideo.enTitle} - Ep ${ep.episodeNumber}`,
        episodeNumber: ep.episodeNumber,
        season: ep.season,
      };
      startPlayback(epVideo);
    });

    track.appendChild(card);
  });
}

function closeDetails() {
  document.getElementById('screen-details').classList.remove('active');
  state.activeDetailsVideo = null;
  state.activeDetailsEpisodes = [];
  nav.popBackHandler(closeDetails);

  // Return focus to active screen
  const target = nav.findFirstContentFocusable() || document.getElementById('nav-btn-home');
  if (target) nav.setFocus(target);
  return true;
}

/**
 * Video Player Lifecycle & Playback Engine
 */
/**
 * Video Player Lifecycle & Playback Engine
 */
async function startPlayback(video) {
  state.currentRoute = 'player';
  state.activePlayingItem = video;
  document.getElementById('screen-player').classList.add('active');

  // Title & Subtitle Styling matching Reference TV UI
  const isSeriesItem = video.season || video.episodeNumber || (state.activeDetailsVideo && state.activeDetailsVideo.isSeries);
  if (isSeriesItem) {
    const s = video.season || state.selectedSeason || 1;
    const ep = video.episodeNumber || 1;
    els.playerTitleText.textContent = video.enTitle || video.primaryTitle || 'Cinemana Stream';
    els.playerSubtitleText.textContent = `الموسم ${s} - الحلقة ${ep}`;
    if (els.btnPlayerPrevEp) els.btnPlayerPrevEp.classList.remove('disabled');
    if (els.btnPlayerNextEp) els.btnPlayerNextEp.classList.remove('disabled');
  } else {
    els.playerTitleText.textContent = video.enTitle || video.primaryTitle || 'Cinemana Stream';
    const subParts = [video.arTitle, video.year].filter(Boolean);
    els.playerSubtitleText.textContent = subParts.join(' • ');
    if (els.btnPlayerPrevEp) els.btnPlayerPrevEp.classList.add('disabled');
    if (els.btnPlayerNextEp) els.btnPlayerNextEp.classList.add('disabled');
  }

  // Ensure bottom bar starts in standard controls mode
  if (els.playerBottomMainBar) els.playerBottomMainBar.style.display = 'flex';
  if (els.playerBottomSubsBar) els.playerBottomSubsBar.style.display = 'none';
  state.activeSubtitlesMode = false;

  updateCensorButtonState();
  showOsd(true);
  subtitleEngine.clear();

  try {
    showToast('جاري تحضير البث المباشر...', 2000);
    const [streams, subs, intro, censor] = await Promise.all([
      CinemanaApi.getVideoStreams(video.id),
      CinemanaApi.getSubtitles(video.id),
      CinemanaApi.getIntroInterval(video.id),
      CinemanaApi.getCensorshipIntervals(video.id),
    ]);

    if (!streams.length) {
      showToast('عذرا، لم يتم العثور على روابط تشغيل لهذا العمل على شبكتك.');
      exitPlayer();
      return;
    }

    state.activeStreams = streams;
    state.activeSubtitles = subs;
    state.introInterval = intro;
    state.censorshipIntervals = censor || [];

    if (state.censorshipIntervals.length > 0 && state.isCensorEnabled) {
      showToast(`✂️ تم تفعيل القص الذكي (${state.censorshipIntervals.length} مقاطع غير لائقة)`, 3000);
    }

    // Pick stream matching user preferred quality
    const settings = Storage.getSettings();
    let chosenStream = streams.find(s => s.resolution.toLowerCase().includes(settings.preferredQuality.toLowerCase())) || streams[0];
    state.currentStream = chosenStream;
    if (els.moreLabelQuality) els.moreLabelQuality.textContent = chosenStream.resolution || 'Auto';

    // Subtitle setup (default to Arabic if available)
    if (subs.length > 0) {
      const arSub = subs.find(s => s.type === 'ar') || subs[0];
      state.currentSubtitle = arSub;
      await subtitleEngine.loadTrack(arSub.fileUrl);
    } else {
      state.currentSubtitle = null;
      subtitleEngine.clear();
    }

    // Apply playback speed
    if (els.videoElement) {
      els.videoElement.src = chosenStream.videoUrl;
      els.videoElement.playbackRate = state.playbackSpeed || 1.0;
    }

    const savedPos = Storage.getSavedPosition(video.id);
    if (savedPos > 10) {
      els.videoElement.currentTime = savedPos;
      showToast(`تم استئناف المشاهدة من ${formatTime(savedPos)}`);
    }

    await els.videoElement.play();
    updatePlayPauseState(true);

    // Start progress saving loop
    clearInterval(state.saveProgressTimer);
    state.saveProgressTimer = setInterval(() => {
      if (els.videoElement && !els.videoElement.paused && els.videoElement.duration > 60) {
        Storage.savePlaybackProgress(video, els.videoElement.currentTime, els.videoElement.duration);
      }
    }, 8000);

    // Reset aspect ratio classes and fullscreen button icons
    if (els.videoElement) els.videoElement.classList.remove('fit-cover', 'fit-fill');
    if (els.ctrlIconFullscreen) els.ctrlIconFullscreen.style.display = 'block';
    if (els.ctrlIconNormalscreen) els.ctrlIconNormalscreen.style.display = 'none';

    // Register back handler
    nav.pushBackHandler(exitPlayer);
    nav.setFocus(els.btnPlayerPlayPause);

  } catch (err) {
    console.error('Playback initialization error:', err);
    showToast('حدث خطأ أثناء تحميل الفيديو.');
    exitPlayer();
  }
}

function updateCensorButtonState() {
  if (!els.btnPlayerCensor) return;
  if (state.isCensorEnabled) {
    els.btnPlayerCensor.classList.add('active');
  } else {
    els.btnPlayerCensor.classList.remove('active');
  }
}

function hideOsd() {
  clearTimeout(state.osdTimer);
  els.playerOsd.classList.remove('visible');
  state.isOsdVisible = false;
}

function exitPlayer() {
  hideOsd();
  if (els.videoElement) {
    if (state.activePlayingItem && els.videoElement.duration > 60) {
      Storage.savePlaybackProgress(state.activePlayingItem, els.videoElement.currentTime, els.videoElement.duration);
    }
    els.videoElement.pause();
    els.videoElement.classList.remove('fit-cover', 'fit-fill');
    els.videoElement.removeAttribute('src');
    els.videoElement.load();
  }

  clearInterval(state.saveProgressTimer);
  subtitleEngine.clear();
  document.getElementById('screen-player').classList.remove('active');
  nav.popBackHandler(exitPlayer);

  state.currentRoute = state.previousRoute || 'home';
  const targetScreen = document.getElementById(`screen-${state.currentRoute}`);
  if (targetScreen) targetScreen.classList.add('active');

  const focusTarget = nav.findFirstContentFocusable() || document.getElementById('nav-btn-home');
  if (focusTarget) nav.setFocus(focusTarget);
  return true;
}

function updatePlayPauseState(isPlaying) {
  if (isPlaying) {
    if (els.ctrlIconPlay) els.ctrlIconPlay.style.display = 'none';
    if (els.ctrlIconPause) els.ctrlIconPause.style.display = 'block';
  } else {
    if (els.ctrlIconPlay) els.ctrlIconPlay.style.display = 'block';
    if (els.ctrlIconPause) els.ctrlIconPause.style.display = 'none';
  }
}

function showOsd(autoHide = true) {
  els.playerOsd.classList.add('visible');
  state.isOsdVisible = true;
  clearTimeout(state.osdTimer);

  // If focus is outside OSD, ensure Play/Pause button is focused
  if (!nav.currentFocused || !els.playerOsd.contains(nav.currentFocused)) {
    nav.setFocus(els.btnPlayerPlayPause);
  }

  if (autoHide) {
    state.osdTimer = setTimeout(() => {
      if (els.videoElement && !els.videoElement.paused) {
        hideOsd();
      }
    }, 4500);
  }
}

// Player Video Events
let lastCensorSkippedIndex = -1;
els.videoElement.addEventListener('timeupdate', () => {
  const current = els.videoElement.currentTime;
  const total = els.videoElement.duration || 0;

  const curStr = formatTime(current);
  const totStr = formatTime(total);
  const timeFormatted = `${curStr} / ${totStr}`;
  if (els.playerTimeDisplay) els.playerTimeDisplay.textContent = timeFormatted;
  if (els.playerSubTimeDisplay) els.playerSubTimeDisplay.textContent = timeFormatted;

  if (total > 0 && els.playerTimelinePlayed) {
    const pct = (current / total) * 100;
    els.playerTimelinePlayed.style.width = `${pct}%`;
  }

  // Update Subtitles
  subtitleEngine.update(current);

  // Check Intro Skipping Interval
  if (state.introInterval && current >= state.introInterval.start && current <= state.introInterval.end) {
    els.skipIntroBox.classList.add('visible');
  } else {
    els.skipIntroBox.classList.remove('visible');
  }

  // Automatic Age-Restricted Scene Cutting (Censorship Skip)
  if (state.isCensorEnabled && state.censorshipIntervals && state.censorshipIntervals.length > 0) {
    for (let i = 0; i < state.censorshipIntervals.length; i++) {
      const inv = state.censorshipIntervals[i];
      if (current >= (inv.start - 0.2) && current < inv.end) {
        if (lastCensorSkippedIndex !== i) {
          lastCensorSkippedIndex = i;
          els.videoElement.currentTime = inv.end + 0.1;
          showToast(`✂️ تم تخطي مشهد غير لائق (${formatTime(inv.start)} - ${formatTime(inv.end)})`, 2500);
        }
        break;
      }
    }
  }
});

els.videoElement.addEventListener('progress', () => {
  if (els.videoElement.buffered.length > 0 && els.videoElement.duration > 0 && els.playerTimelineBuffer) {
    const end = els.videoElement.buffered.end(els.videoElement.buffered.length - 1);
    const pct = (end / els.videoElement.duration) * 100;
    els.playerTimelineBuffer.style.width = `${pct}%`;
  }
});

els.videoElement.addEventListener('play', () => updatePlayPauseState(true));
els.videoElement.addEventListener('pause', () => updatePlayPauseState(false));

els.videoElement.addEventListener('ended', () => {
  updatePlayPauseState(false);
  showOsd(false);
  showToast('انتهى العرض.');
});

// Play / Pause Button
if (els.btnPlayerPlayPause) {
  els.btnPlayerPlayPause.addEventListener('click', () => {
    if (els.videoElement.paused) {
      els.videoElement.play();
    } else {
      els.videoElement.pause();
    }
    showOsd(true);
  });
}

// Rewind 10s
if (els.btnPlayerRewind) {
  els.btnPlayerRewind.addEventListener('click', () => {
    els.videoElement.currentTime = Math.max(0, els.videoElement.currentTime - 10);
    showOsd(true);
  });
}

// Forward 10s
if (els.btnPlayerForward) {
  els.btnPlayerForward.addEventListener('click', () => {
    els.videoElement.currentTime = Math.min(els.videoElement.duration || 0, els.videoElement.currentTime + 10);
    showOsd(true);
  });
}

// Restart from Beginning
if (els.btnPlayerRestart) {
  els.btnPlayerRestart.addEventListener('click', () => {
    if (els.videoElement) {
      els.videoElement.currentTime = 0;
      els.videoElement.play();
      showToast('تمت إعادة التشغيل من البداية');
      showOsd(true);
    }
  });
}

// Episode Navigation (Next / Previous Episode)
function playAdjacentEpisode(direction) {
  if (!state.activeDetailsEpisodes || state.activeDetailsEpisodes.length === 0) {
    showToast('لا توجد حلقات أخرى متوفرة');
    return;
  }
  const curId = state.activePlayingItem ? state.activePlayingItem.id : null;
  const curIdx = state.activeDetailsEpisodes.findIndex(ep => String(ep.id) === String(curId));
  if (curIdx === -1) {
    showToast('تعذر تحديد الحلقة الحالية');
    return;
  }
  const targetIdx = curIdx + direction;
  if (targetIdx < 0) {
    showToast('هذه هي الحلقة الأولى');
    return;
  }
  if (targetIdx >= state.activeDetailsEpisodes.length) {
    showToast('هذه هي الحلقة الأخيرة');
    return;
  }
  const nextEp = state.activeDetailsEpisodes[targetIdx];
  const epVideo = {
    ...state.activeDetailsVideo,
    id: nextEp.id,
    arTitle: `${state.activeDetailsVideo ? state.activeDetailsVideo.arTitle : ''} - حلقة ${nextEp.episodeNumber}`,
    enTitle: `${state.activeDetailsVideo ? state.activeDetailsVideo.enTitle : ''} - Ep ${nextEp.episodeNumber}`,
    episodeNumber: nextEp.episodeNumber,
    season: nextEp.season || state.selectedSeason,
  };
  startPlayback(epVideo);
}

if (els.btnPlayerPrevEp) {
  els.btnPlayerPrevEp.addEventListener('click', () => playAdjacentEpisode(-1));
}

if (els.btnPlayerNextEp) {
  els.btnPlayerNextEp.addEventListener('click', () => playAdjacentEpisode(1));
}

// Skip Intro Action Banner
if (els.btnSkipIntro) {
  els.btnSkipIntro.addEventListener('click', () => {
    if (state.introInterval) {
      els.videoElement.currentTime = state.introInterval.end;
      els.skipIntroBox.classList.remove('visible');
      showToast('تم تخطي المقدمة');
    }
  });
}

if (els.btnPlayerBack) {
  els.btnPlayerBack.addEventListener('click', exitPlayer);
}

// Cutting Age-Restricted Scenes Button (Scissors ✂️)
if (els.btnPlayerCensor) {
  els.btnPlayerCensor.addEventListener('click', () => {
    state.isCensorEnabled = !state.isCensorEnabled;
    updateCensorButtonState();
    Storage.updateSettings({ cutCensoredScenes: state.isCensorEnabled });
    if (state.isCensorEnabled) {
      showToast('✂️ تم تفعيل تخطي المقاطع غير اللائقة');
    } else {
      showToast('تم إيقاف تخطي المقاطع غير اللائقة');
    }
    showOsd(true);
  });
}

// Subtitles Toolbar Toggle (Swap between Standard Bar and Subtitles Customization Bar)
function setSubtitleToolbarMode(isSubs) {
  state.activeSubtitlesMode = isSubs;
  if (isSubs) {
    if (els.playerBottomMainBar) els.playerBottomMainBar.style.display = 'none';
    if (els.playerBottomSubsBar) els.playerBottomSubsBar.style.display = 'flex';
    nav.setFocus(els.btnSubTrack);
  } else {
    if (els.playerBottomSubsBar) els.playerBottomSubsBar.style.display = 'none';
    if (els.playerBottomMainBar) els.playerBottomMainBar.style.display = 'flex';
    nav.setFocus(els.btnPlayerSubsToggle);
  }
  showOsd(true);
}

if (els.btnPlayerSubsToggle) {
  els.btnPlayerSubsToggle.addEventListener('click', () => setSubtitleToolbarMode(true));
}
if (els.btnSubBack) {
  els.btnSubBack.addEventListener('click', () => setSubtitleToolbarMode(false));
}

// Subtitle Font Size Cycling
if (els.btnSubSize) {
  els.btnSubSize.addEventListener('click', () => {
    const nextSize = subtitleEngine.cycleFontSize();
    Storage.updateSettings({ subtitleFontSize: nextSize.size });
    showToast(`حجم خط الترجمة: ${nextSize.label}`);
    showOsd(true);
  });
}

// Subtitle Timing / Sync Cycling
if (els.btnSubSync) {
  els.btnSubSync.addEventListener('click', () => {
    const nextSync = subtitleEngine.cycleSyncOffset();
    showToast(`توقيت الترجمة: ${nextSync.label}`);
    showOsd(true);
  });
}

// Subtitle Font Color Cycling
if (els.btnSubColor) {
  els.btnSubColor.addEventListener('click', () => {
    const nextColor = subtitleEngine.cycleFontColor();
    Storage.updateSettings({ subtitleFontColor: nextColor.hex });
    showToast(`لون الترجمة: ${nextColor.label}`);
    showOsd(true);
  });
}

// Subtitle Background / Contrast Style Cycling
if (els.btnSubBg) {
  els.btnSubBg.addEventListener('click', () => {
    const nextBg = subtitleEngine.cycleBgStyle();
    Storage.updateSettings({ subtitleBgStyle: nextBg.id });
    showToast(`نمط خلفية الترجمة: ${nextBg.label}`);
    showOsd(true);
  });
}

// More Options Modal (Quality & Playback Speed)
if (els.btnPlayerMore) {
  els.btnPlayerMore.addEventListener('click', () => {
    if (els.moreLabelQuality) {
      els.moreLabelQuality.textContent = state.currentStream ? state.currentStream.resolution : 'Auto';
    }
    if (els.moreLabelSpeed) {
      els.moreLabelSpeed.textContent = `${state.playbackSpeed || 1.0}x`;
    }
    els.modalMore.classList.add('active');
    nav.pushBackHandler(closeMoreModal);
    const firstBtn = els.modalMore.querySelector('.modal-option-btn');
    if (firstBtn) nav.setFocus(firstBtn);
  });
}

function closeMoreModal() {
  els.modalMore.classList.remove('active');
  nav.popBackHandler(closeMoreModal);
  nav.setFocus(els.btnPlayerMore);
  return true;
}
if (els.btnCloseModalMore) els.btnCloseModalMore.addEventListener('click', closeMoreModal);

if (els.btnMoreQuality) {
  els.btnMoreQuality.addEventListener('click', () => {
    closeMoreModal();
    openQualityModal();
  });
}

if (els.btnMoreSpeed) {
  els.btnMoreSpeed.addEventListener('click', () => {
    const speeds = [1.0, 1.25, 1.5, 2.0, 0.75];
    const curIdx = speeds.findIndex(s => Math.abs(s - (state.playbackSpeed || 1.0)) < 0.05);
    const nextIdx = (curIdx + 1) % speeds.length;
    state.playbackSpeed = speeds[nextIdx];
    if (els.videoElement) els.videoElement.playbackRate = state.playbackSpeed;
    if (els.moreLabelSpeed) els.moreLabelSpeed.textContent = `${state.playbackSpeed}x`;
    showToast(`سرعة التشغيل: ${state.playbackSpeed}x`);
  });
}

// Quality Selector Modal
function openQualityModal() {
  els.modalQualityOptions.innerHTML = '';
  state.activeStreams.forEach(stream => {
    const btn = document.createElement('button');
    const isCur = state.currentStream && state.currentStream.resolution === stream.resolution;
    btn.className = `modal-option-btn focusable ${isCur ? 'active' : ''}`;
    btn.innerHTML = `
      <span>${stream.resolution} (${stream.container.toUpperCase()})</span>
      ${isCur ? '<span>✓</span>' : ''}
    `;
    btn.addEventListener('click', () => {
      if (state.currentStream !== stream) {
        const curTime = els.videoElement.currentTime;
        state.currentStream = stream;
        if (els.moreLabelQuality) els.moreLabelQuality.textContent = stream.resolution;
        els.videoElement.src = stream.videoUrl;
        els.videoElement.currentTime = curTime;
        els.videoElement.playbackRate = state.playbackSpeed || 1.0;
        els.videoElement.play();
        showToast(`تم تغيير الجودة إلى ${stream.resolution}`);
      }
      closeQualityModal();
    });
    els.modalQualityOptions.appendChild(btn);
  });

  els.modalQuality.classList.add('active');
  nav.pushBackHandler(closeQualityModal);
  const firstOpt = els.modalQualityOptions.querySelector('.modal-option-btn');
  if (firstOpt) nav.setFocus(firstOpt);
}

function closeQualityModal() {
  els.modalQuality.classList.remove('active');
  nav.popBackHandler(closeQualityModal);
  nav.setFocus(els.btnPlayerMore);
  return true;
}
if (els.btnCloseModalQuality) els.btnCloseModalQuality.addEventListener('click', closeQualityModal);

// Subtitle Selector Modal (Triggered from [CC] button in Subtitles Toolbar)
function openSubtitlesModal() {
  els.modalSubtitlesOptions.innerHTML = '';

  // "Off" option
  const offBtn = document.createElement('button');
  const isOff = !state.currentSubtitle;
  offBtn.className = `modal-option-btn focusable ${isOff ? 'active' : ''}`;
  offBtn.innerHTML = `<span>إيقاف الترجمة / Off</span>${isOff ? '<span>✓</span>' : ''}`;
  offBtn.addEventListener('click', () => {
    state.currentSubtitle = null;
    subtitleEngine.clear();
    showToast('تم إيقاف الترجمة');
    closeSubtitleModal();
  });
  els.modalSubtitlesOptions.appendChild(offBtn);

  // Available tracks
  state.activeSubtitles.forEach(sub => {
    const btn = document.createElement('button');
    const isCur = state.currentSubtitle && state.currentSubtitle.id === sub.id;
    btn.className = `modal-option-btn focusable ${isCur ? 'active' : ''}`;
    btn.innerHTML = `<span>${sub.label}</span>${isCur ? '<span>✓</span>' : ''}`;
    btn.addEventListener('click', async () => {
      state.currentSubtitle = sub;
      await subtitleEngine.loadTrack(sub.fileUrl);
      showToast(`تم تفعيل ترجمة ${sub.label}`);
      closeSubtitleModal();
    });
    els.modalSubtitlesOptions.appendChild(btn);
  });

  els.modalSubtitles.classList.add('active');
  nav.pushBackHandler(closeSubtitleModal);
  const firstOpt = els.modalSubtitlesOptions.querySelector('.modal-option-btn');
  if (firstOpt) nav.setFocus(firstOpt);
}

if (els.btnSubTrack) {
  els.btnSubTrack.addEventListener('click', openSubtitlesModal);
}

function closeSubtitleModal() {
  els.modalSubtitles.classList.remove('active');
  nav.popBackHandler(closeSubtitleModal);
  nav.setFocus(els.btnSubTrack || els.btnPlayerSubsToggle);
  return true;
}
if (els.btnCloseModalSubtitles) els.btnCloseModalSubtitles.addEventListener('click', closeSubtitleModal);

// Remote Media Key Bindings
nav.on('mediaKey', ({ key }) => {
  if (state.currentRoute !== 'player') return;
  showOsd(true);
  if (key === 'Play') els.videoElement.play();
  else if (key === 'Pause') els.videoElement.pause();
  else if (key === 'PlayPause') {
    if (els.videoElement.paused) els.videoElement.play();
    else els.videoElement.pause();
  }
  else if (key === 'Rewind') els.videoElement.currentTime = Math.max(0, els.videoElement.currentTime - 10);
  else if (key === 'FastForward') els.videoElement.currentTime = Math.min(els.videoElement.duration || 0, els.videoElement.currentTime + 10);
});

/**
 * Fullscreen / Aspect Ratio Toggle
 */
function toggleFullscreenMode() {
  const video = els.videoElement;
  if (!video) return;

  // Attempt standard webOS / HTML5 fullscreen API
  try {
    const doc = document;
    const isFull = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement;
    if (!isFull) {
      if (doc.documentElement.requestFullscreen) {
        doc.documentElement.requestFullscreen();
      } else if (doc.documentElement.webkitRequestFullscreen) {
        doc.documentElement.webkitRequestFullscreen();
      }
    }
  } catch (_) {}

  // Cycle video fit mode: contain -> cover (zoom) -> fill (stretch) -> contain
  if (video.classList.contains('fit-cover')) {
    video.classList.remove('fit-cover');
    video.classList.add('fit-fill');
    if (els.ctrlIconFullscreen) els.ctrlIconFullscreen.style.display = 'none';
    if (els.ctrlIconNormalscreen) els.ctrlIconNormalscreen.style.display = 'block';
    showToast('وضع العرض: تمديد ملء الشاشة (Stretch)');
  } else if (video.classList.contains('fit-fill')) {
    video.classList.remove('fit-fill');
    if (els.ctrlIconFullscreen) els.ctrlIconFullscreen.style.display = 'block';
    if (els.ctrlIconNormalscreen) els.ctrlIconNormalscreen.style.display = 'none';
    showToast('وضع العرض: الحجم الأصلي (Fit)');
  } else {
    video.classList.add('fit-cover');
    if (els.ctrlIconFullscreen) els.ctrlIconFullscreen.style.display = 'none';
    if (els.ctrlIconNormalscreen) els.ctrlIconNormalscreen.style.display = 'block';
    showToast('وضع العرض: تكبير ملء الشاشة (Zoom Fill)');
  }

  showOsd(true);
}

if (els.btnPlayerFullscreen) {
  els.btnPlayerFullscreen.addEventListener('click', toggleFullscreenMode);
}

// Click and Keyboard navigation on timeline track
if (els.playerTimeline) {
  els.playerTimeline.addEventListener('click', (e) => {
    if (!els.videoElement || !els.videoElement.duration) return;
    const rect = els.playerTimeline.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    els.videoElement.currentTime = pct * els.videoElement.duration;
    showOsd(true);
  });

  els.playerTimeline.addEventListener('keydown', (e) => {
    if (e.keyCode === 37) { // Left (rewind 10s)
      els.videoElement.currentTime = Math.max(0, els.videoElement.currentTime - 10);
      showOsd(true);
      e.preventDefault();
      e.stopPropagation();
    } else if (e.keyCode === 39) { // Right (forward 10s)
      els.videoElement.currentTime = Math.min(els.videoElement.duration || 0, els.videoElement.currentTime + 10);
      showOsd(true);
      e.preventDefault();
      e.stopPropagation();
    }
  });
}

// Magic Remote cursor & click wake-up handlers on player
if (els.screenPlayer) {
  els.screenPlayer.addEventListener('mousemove', () => {
    const isPlayerActive = state.currentRoute === 'player' || els.screenPlayer.classList.contains('active');
    if (isPlayerActive) {
      showOsd(true);
    }
  });

  els.screenPlayer.addEventListener('click', (e) => {
    const isPlayerActive = state.currentRoute === 'player' || els.screenPlayer.classList.contains('active');
    if (!isPlayerActive) return;
    const interactive = e.target.closest('button, .osd-ctrl-btn, .osd-timeline-track, .modal-box');
    if (!interactive) {
      const isOsdVisible = els.playerOsd && els.playerOsd.classList.contains('visible');
      if (!isOsdVisible) {
        showOsd(true);
      } else {
        if (els.videoElement.paused) {
          els.videoElement.play();
        } else {
          els.videoElement.pause();
        }
        showOsd(true);
      }
    }
  });
}

// Global High-Priority Player Remote Key Listener (Capture Phase)
window.addEventListener('keydown', (e) => {
  const isPlayerActive = state.currentRoute === 'player' || (els.screenPlayer && els.screenPlayer.classList.contains('active'));
  if (!isPlayerActive) return;

  let key = e.key;
  const keyCode = e.keyCode;

  if (!key || key === 'undefined') {
    if (keyCode === 38) key = 'ArrowUp';
    else if (keyCode === 40) key = 'ArrowDown';
    else if (keyCode === 37) key = 'ArrowLeft';
    else if (keyCode === 39) key = 'ArrowRight';
    else if (keyCode === 13) key = 'Enter';
    else if (keyCode === 27 || keyCode === 461 || keyCode === 8) key = 'Escape';
    else if (keyCode === 415) key = 'Play';
    else if (keyCode === 19) key = 'Pause';
    else if (keyCode === 179 || keyCode === 10252) key = 'PlayPause';
    else if (keyCode === 412) key = 'Rewind';
    else if (keyCode === 417) key = 'FastForward';
  }
  if (key === 'Up') key = 'ArrowUp';
  if (key === 'Down') key = 'ArrowDown';
  if (key === 'Left') key = 'ArrowLeft';
  if (key === 'Right') key = 'ArrowRight';
  if (key === 'Esc' || keyCode === 461) key = 'Escape';

  // If a modal dialog is open, let modal handle navigation
  if (els.modalQuality.classList.contains('active') || els.modalSubtitles.classList.contains('active')) {
    return;
  }

  const isOsdVisible = els.playerOsd && els.playerOsd.classList.contains('visible');

  // Handle Back / Return key
  if (key === 'Escape') {
    if (isOsdVisible) {
      e.preventDefault();
      e.stopPropagation();
      hideOsd();
      return;
    }
    // If OSD is already hidden, allow default SpatialNavigation back handler to exit player
    return;
  }

  // Handle Media keys directly
  if (['Play', 'Pause', 'PlayPause', 'Rewind', 'FastForward'].includes(key) || [415, 19, 179, 412, 417, 10252].includes(keyCode)) {
    showOsd(true);
    if (key === 'Play' || keyCode === 415) els.videoElement.play();
    else if (key === 'Pause' || keyCode === 19) els.videoElement.pause();
    else if (key === 'PlayPause' || keyCode === 179 || keyCode === 10252) {
      if (els.videoElement.paused) els.videoElement.play();
      else els.videoElement.pause();
    }
    else if (key === 'Rewind' || keyCode === 412) els.videoElement.currentTime = Math.max(0, els.videoElement.currentTime - 10);
    else if (key === 'FastForward' || keyCode === 417) els.videoElement.currentTime = Math.min(els.videoElement.duration || 0, els.videoElement.currentTime + 10);
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  // If OSD is currently hidden: ANY remote key (OK/Enter, D-pad arrows) wakes up OSD immediately
  if (!isOsdVisible) {
    e.preventDefault();
    e.stopPropagation();
    showOsd(true);
    nav.setFocus(els.btnPlayerPlayPause);
    return;
  }

  // If OSD is visible and user is on timeline track, allow seeking with Left/Right
  if (nav.currentFocused === els.playerTimeline) {
    if (key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      els.videoElement.currentTime = Math.max(0, els.videoElement.currentTime - 10);
      showOsd(true);
      return;
    }
    if (key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      els.videoElement.currentTime = Math.min(els.videoElement.duration || 0, els.videoElement.currentTime + 10);
      showOsd(true);
      return;
    }
  }

  // Keep OSD alive while interacting
  showOsd(true);
}, true);

/**
 * Virtual On-Screen TV Keyboard
 */
const KEYBOARDS = {
  en: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
    ['AR', 'SPACE', 'BACKSPACE', 'SEARCH'],
  ],
  ar: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'د'],
    ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط'],
    ['ئ', 'ء', 'ؤ', 'ر', 'لا', 'ى', 'ة', 'و', 'ز', 'ظ'],
    ['EN', 'SPACE', 'BACKSPACE', 'SEARCH'],
  ],
};

function renderVirtualKeyboard() {
  const container = els.virtualKeyboardContainer;
  if (!container) return;
  container.innerHTML = '';

  const layout = KEYBOARDS[state.keyboardMode];
  layout.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'keyboard-row';

    row.forEach(key => {
      const keyBtn = document.createElement('button');
      keyBtn.className = 'key-btn focusable';

      if (key === 'SPACE') {
        keyBtn.classList.add('space-key');
        keyBtn.textContent = 'مسافة / Space';
        keyBtn.addEventListener('click', () => {
          els.searchInput.value += ' ';
          triggerSearch();
        });
      } else if (key === 'BACKSPACE') {
        keyBtn.classList.add('wide');
        keyBtn.textContent = 'حذف / Delete';
        keyBtn.addEventListener('click', () => {
          els.searchInput.value = els.searchInput.value.slice(0, -1);
          triggerSearch();
        });
      } else if (key === 'SEARCH') {
        keyBtn.classList.add('wide', 'btn-primary');
        keyBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
          <span>بحث / Search</span>
        `;
        keyBtn.addEventListener('click', () => {
          executeSearchNow();
        });
      } else if (key === 'AR' || key === 'EN') {
        keyBtn.classList.add('wide');
        keyBtn.textContent = key === 'AR' ? 'العربية' : 'English';
        keyBtn.addEventListener('click', () => {
          state.keyboardMode = state.keyboardMode === 'en' ? 'ar' : 'en';
          renderVirtualKeyboard();
        });
      } else {
        keyBtn.textContent = key;
        keyBtn.addEventListener('click', () => {
          els.searchInput.value += key.toLowerCase();
          triggerSearch();
        });
      }

      rowEl.appendChild(keyBtn);
    });

    container.appendChild(rowEl);
  });
}

function renderSearchSections() {
  const filter = state.searchFilter;
  const hasSeries = state.searchResults.series && state.searchResults.series.length > 0;
  const hasMovies = state.searchResults.movies && state.searchResults.movies.length > 0;

  // Update active state on tab buttons
  document.querySelectorAll('.search-tab-btn').forEach(btn => {
    if (btn.getAttribute('data-filter') === filter) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (filter === 'series') {
    if (els.searchSectionSeries) els.searchSectionSeries.style.display = hasSeries ? 'flex' : 'none';
    if (els.searchSectionMovies) els.searchSectionMovies.style.display = 'none';
  } else if (filter === 'movies') {
    if (els.searchSectionSeries) els.searchSectionSeries.style.display = 'none';
    if (els.searchSectionMovies) els.searchSectionMovies.style.display = hasMovies ? 'flex' : 'none';
  } else {
    // 'all' -> show both sections if they have items
    if (els.searchSectionSeries) els.searchSectionSeries.style.display = hasSeries ? 'flex' : 'none';
    if (els.searchSectionMovies) els.searchSectionMovies.style.display = hasMovies ? 'flex' : 'none';
  }
}

function clearSearchResults() {
  els.searchInput.value = '';
  state.searchResults = { series: [], movies: [], all: [] };
  state.searchFilter = 'all';
  if (els.searchFilterTabs) els.searchFilterTabs.style.display = 'none';
  if (els.searchStatusContainer) els.searchStatusContainer.innerHTML = '';
  if (els.searchSectionSeries) els.searchSectionSeries.style.display = 'none';
  if (els.searchSectionMovies) els.searchSectionMovies.style.display = 'none';
  if (els.searchSeriesGrid) els.searchSeriesGrid.innerHTML = '';
  if (els.searchMoviesGrid) els.searchMoviesGrid.innerHTML = '';
}

async function executeSearchNow() {
  clearTimeout(state.searchDebounceTimer);
  const q = els.searchInput.value.trim();
  if (!q) {
    clearSearchResults();
    return;
  }

  const settings = Storage.getSettings();
  if (els.searchFilterTabs) els.searchFilterTabs.style.display = 'none';
  if (els.searchSectionSeries) els.searchSectionSeries.style.display = 'none';
  if (els.searchSectionMovies) els.searchSectionMovies.style.display = 'none';
  if (els.searchSeriesGrid) els.searchSeriesGrid.innerHTML = '';
  if (els.searchMoviesGrid) els.searchMoviesGrid.innerHTML = '';

  els.searchStatusContainer.innerHTML = `
    <div class="spinner-container" style="padding: 40px 0;">
      <div class="spinner"></div>
      <p style="color: var(--text-secondary); font-size: 14px; margin-top: 12px;">جاري البحث عن "${q}"...</p>
    </div>
  `;

  try {
    const results = await CinemanaApi.search(q, settings.parentalLevel);
    state.searchResults = results;
    const series = results.series || [];
    const movies = results.movies || [];
    const total = series.length + movies.length;

    if (total === 0) {
      els.searchStatusContainer.innerHTML = `
        <div class="empty-state" style="padding: 60px 20px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" style="color: var(--text-muted);">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
          <h2 style="font-size: 18px; color: #ffffff;">لم يتم العثور على نتائج لـ "${q}"</h2>
          <p>تأكد من كتابة اسم العمل بشكل صحيح أو جرب البحث باللغة الإنجليزية أو العربية.</p>
        </div>
      `;
      if (els.searchFilterTabs) els.searchFilterTabs.style.display = 'none';
      return;
    }

    // Clear spinner status
    els.searchStatusContainer.innerHTML = '';

    // Update counts & badges
    if (els.tabCountAll) els.tabCountAll.textContent = total;
    if (els.tabCountSeries) els.tabCountSeries.textContent = series.length;
    if (els.tabCountMovies) els.tabCountMovies.textContent = movies.length;
    if (els.searchSeriesBadge) els.searchSeriesBadge.textContent = series.length;
    if (els.searchMoviesBadge) els.searchMoviesBadge.textContent = movies.length;

    // Populate Series section
    series.forEach(item => {
      els.searchSeriesGrid.appendChild(createVideoCard(item));
    });

    // Populate Movies section
    movies.forEach(item => {
      els.searchMoviesGrid.appendChild(createVideoCard(item));
    });

    // Show filter tabs bar and render the two sections
    if (els.searchFilterTabs) els.searchFilterTabs.style.display = 'flex';
    renderSearchSections();

  } catch (e) {
    console.error('Search error:', e);
    els.searchStatusContainer.innerHTML = `
      <div class="empty-state">
        <p style="color: var(--accent-crimson);">حدث خطأ أثناء إجراء البحث.</p>
      </div>
    `;
  }
}

function triggerSearch() {
  clearTimeout(state.searchDebounceTimer);
  const q = els.searchInput.value.trim();
  if (!q) {
    clearSearchResults();
    return;
  }

  state.searchDebounceTimer = setTimeout(() => {
    executeSearchNow();
  }, 450);
}

els.searchInput.addEventListener('input', triggerSearch);
els.searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    executeSearchNow();
  }
});

els.searchClearBtn.addEventListener('click', () => {
  clearSearchResults();
  els.searchInput.focus();
});

// Category Filter Tabs Click Handlers
document.querySelectorAll('.search-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const filter = btn.getAttribute('data-filter') || 'all';
    state.searchFilter = filter;
    renderSearchSections();
  });
});

/**
 * Settings UI Synchronization
 */
function syncSettingsUI() {
  const current = Storage.getSettings();

  // Quality pills
  document.querySelectorAll('#settings-quality-group .pill-option').forEach(btn => {
    if (btn.getAttribute('data-quality') === current.preferredQuality) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Parental filter pills
  document.querySelectorAll('#settings-parental-group .pill-option').forEach(btn => {
    if (parseInt(btn.getAttribute('data-level'), 10) === current.parentalLevel) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Settings Button Handlers
document.querySelectorAll('#settings-quality-group .pill-option').forEach(btn => {
  btn.addEventListener('click', () => {
    const val = btn.getAttribute('data-quality');
    Storage.updateSettings({ preferredQuality: val });
    syncSettingsUI();
    showToast(`تم تعيين الجودة المفضلة إلى ${val}`);
  });
});

document.querySelectorAll('#settings-parental-group .pill-option').forEach(btn => {
  btn.addEventListener('click', () => {
    const val = parseInt(btn.getAttribute('data-level'), 10);
    Storage.updateSettings({ parentalLevel: val });
    syncSettingsUI();
    showToast('تم تحديث إعدادات التقييم العائلي');
    // Refresh home to reflect filter
    loadHomeContent();
  });
});

document.getElementById('btn-clear-history').addEventListener('click', () => {
  Storage.clearHistory();
  showToast('تم مسح سجل المشاهدة بنجاح');
});

document.getElementById('btn-clear-all').addEventListener('click', () => {
  Storage.clearAllData();
  syncSettingsUI();
  showToast('تمت إعادة ضبط جميع البيانات');
});

document.getElementById('btn-open-terms').addEventListener('click', () => {
  navigateToRoute('terms');
});

document.getElementById('btn-open-privacy').addEventListener('click', () => {
  navigateToRoute('privacy');
});

document.getElementById('btn-terms-back').addEventListener('click', () => {
  navigateToRoute('settings');
});

document.getElementById('btn-privacy-back').addEventListener('click', () => {
  navigateToRoute('settings');
});

// Setup Navigation Route Click Listeners
document.querySelectorAll('[data-route]').forEach(el => {
  el.addEventListener('click', e => {
    const route = el.getAttribute('data-route');
    if (route) {
      e.preventDefault();
      navigateToRoute(route);
    }
  });
});

// Handle browser URL Hash changes
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '') || 'home';
  if (hash !== state.currentRoute && hash !== 'details' && hash !== 'player') {
    navigateToRoute(hash, false);
  }
});

/**
 * App Initialization
 */
function init() {
  console.log('Starting Cinemana LG webOS Client...');

  // Initialize Spatial Navigation
  nav.init();

  // Expand side dock when focused, collapse when focus leaves
  nav.on('focusChange', el => {
    if (!el || !els.sideDock) return;
    const inDock = el.closest ? el.closest('#side-dock') : (el.id === 'side-dock' || el.classList.contains('nav-item'));
    if (inDock) {
      els.sideDock.classList.add('expanded');
    } else {
      els.sideDock.classList.remove('expanded');
    }
  });

  // Render Virtual Keyboard
  renderVirtualKeyboard();

  // Parse initial route from Hash
  const initialHash = window.location.hash.replace('#', '') || 'home';
  navigateToRoute(initialHash, false);

  // Load home data
  loadHomeContent();

  // WebOS TV back button handler
  nav.on('back', () => {
    if (state.currentRoute !== 'home') {
      navigateToRoute('home');
    } else {
      // User is on home root, trigger platform back
      if (window.webOS && typeof window.webOS.platformBack === 'function') {
        window.webOS.platformBack();
      }
    }
  });

  // WebOS TV Color Key Shortcuts (Red 403, Green 404, Yellow 405, Blue 406)
  nav.on('colorKey', ({ color }) => {
    if (color === 'red') {
      // Red: Quick Search
      if (state.currentRoute !== 'player') {
        navigateToRoute('search');
        if (els.searchInput) els.searchInput.focus();
        showToast('🔴 الانتقال السريع: البحث');
      }
    } else if (color === 'green') {
      // Green: Favorites Quick Action
      const detailsOpen = document.getElementById('screen-details').classList.contains('active');
      if (detailsOpen && state.activeDetailsVideo) {
        const isFav = Storage.toggleFavorite(state.activeDetailsVideo);
        const favBtn = document.getElementById('btn-details-fav');
        if (favBtn) {
          favBtn.classList.toggle('active', isFav);
          favBtn.innerHTML = isFav
            ? `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> إزالة من المفضلة`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> إضافة للمفضلة`;
        }
        showToast(isFav ? '🟢 تمت الإضافة إلى المفضلة' : '🟢 تمت الإزالة من المفضلة');
      } else if (state.currentRoute !== 'player') {
        navigateToRoute('favorites');
        showToast('🟢 الانتقال السريع: المفضلة');
      }
    } else if (color === 'yellow') {
      // Yellow: Subtitles in Player / Keyboard Layout in Search
      if (state.currentRoute === 'player') {
        setSubtitleToolbarMode(!state.activeSubtitlesMode);
        showToast('🟡 تبديل شريط الترجمة');
      } else if (state.currentRoute === 'search') {
        state.keyboardMode = state.keyboardMode === 'en' ? 'ar' : 'en';
        renderVirtualKeyboard();
        showToast(`🟡 تبديل لغة لوحة المفاتيح إلى ${state.keyboardMode === 'ar' ? 'العربية' : 'English'}`);
      }
    } else if (color === 'blue') {
      // Blue: Cut Sensitive Scenes in Player / Quick Settings in Navigation
      if (state.currentRoute === 'player') {
        state.isCensorEnabled = !state.isCensorEnabled;
        updateCensorButtonState();
        Storage.updateSettings({ cutCensoredScenes: state.isCensorEnabled });
        showToast(state.isCensorEnabled ? '🔵 ✂️ تم تفعيل قص المشاهد غير اللائقة' : '🔵 تم إيقاف قص المشاهد غير اللائقة');
        showOsd(true);
      } else {
        navigateToRoute('settings');
        showToast('🔵 الانتقال السريع: الإعدادات');
      }
    }
  });

  // WebOS App Lifecycle: Background & Foreground Visibility Management
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (els.videoElement && !els.videoElement.paused) {
        els.videoElement.pause();
        state.wasPlayingBeforeHidden = true;
      }
      clearInterval(state.saveProgressTimer);
    } else {
      if (state.wasPlayingBeforeHidden && els.videoElement && state.currentRoute === 'player') {
        els.videoElement.play();
        state.wasPlayingBeforeHidden = false;
      }
    }
  });

  // WebOS App Launch & Relaunch Deep Linking
  function handleWebOSLaunchParams(params) {
    if (!params) return;
    try {
      const parsed = typeof params === 'string' ? JSON.parse(params) : params;
      const targetId = parsed.videoId || parsed.contentId || parsed.id;
      if (targetId) {
        showToast('جاري فتح المحتوى المطلوب...');
        CinemanaApi.getVideoDetails(targetId).then(video => {
          if (video) openDetails(video);
        }).catch(err => console.error('Deep link launch error:', err));
      }
    } catch (_) {}
  }

  document.addEventListener('webOSLaunch', e => handleWebOSLaunchParams(e.detail));
  document.addEventListener('webOSRelaunch', e => handleWebOSLaunchParams(e.detail));

  // Luna Service Bus: Network Connectivity Watcher
  if (window.webOS && window.webOS.service) {
    try {
      window.webOS.service.request('luna://com.webos.service.connectionmanager/', {
        method: 'getStatus',
        parameters: { subscribe: true },
        onSuccess: function(res) {
          if (res && typeof res.isInternetConnectionAvailable === 'boolean') {
            if (!res.isInternetConnectionAvailable) {
              showToast('⚠️ انقطع اتصال التلفزيون بالإنترنت', 5000);
            }
          }
        },
        onFailure: function(_) {}
      });
    } catch (_) {}
  }
}

// Start app on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
