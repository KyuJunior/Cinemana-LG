/**
 * Local Storage & User State Persistence for Cinemana webOS TV
 */

const STORAGE_KEYS = {
  FAVORITES: 'cinemana_favorites',
  HISTORY: 'cinemana_playback_history',
  SETTINGS: 'cinemana_user_settings',
};

const DEFAULT_SETTINGS = {
  preferredQuality: '1080p',
  parentalLevel: 0,
  preferredLanguage: 'ar',
  cutCensoredScenes: true,
  subtitleFontSize: 28,
  subtitleFontColor: '#ffffff',
  subtitleBgStyle: 'box',
};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error(`Error reading ${key} from localStorage:`, e);
    return fallback;
  }
}

function writeJson(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error writing ${key} to localStorage:`, e);
  }
}

export const Storage = {
  getSettings() {
    return { ...DEFAULT_SETTINGS, ...readJson(STORAGE_KEYS.SETTINGS, {}) };
  },

  updateSettings(partial) {
    const current = this.getSettings();
    const updated = { ...current, ...partial };
    writeJson(STORAGE_KEYS.SETTINGS, updated);
    return updated;
  },

  getFavorites() {
    return readJson(STORAGE_KEYS.FAVORITES, []);
  },

  isFavorite(id) {
    const list = this.getFavorites();
    return list.some(item => String(item.id) === String(id));
  },

  toggleFavorite(video) {
    if (!video || !video.id) return false;
    const list = this.getFavorites();
    const index = list.findIndex(item => String(item.id) === String(video.id));
    let isNowFav = false;

    if (index >= 0) {
      list.splice(index, 1);
      isNowFav = false;
    } else {
      list.unshift(video);
      isNowFav = true;
    }

    writeJson(STORAGE_KEYS.FAVORITES, list);
    return isNowFav;
  },

  getHistory() {
    return readJson(STORAGE_KEYS.HISTORY, []);
  },

  getSavedPosition(videoId) {
    if (!videoId) return 0;
    const history = this.getHistory();
    const match = history.find(h => String(h.videoId) === String(videoId));
    return match ? (match.positionSeconds || 0) : 0;
  },

  savePlaybackProgress(video, positionSeconds, totalDurationSeconds) {
    if (!video || !video.id) return;
    if (positionSeconds < 10 || totalDurationSeconds < 60) return;

    let history = this.getHistory();
    // Filter out previous entry for this video
    history = history.filter(h => String(h.videoId) !== String(video.id));

    // Prepend fresh record
    history.unshift({
      videoId: String(video.id),
      video,
      positionSeconds: Math.floor(positionSeconds),
      totalDurationSeconds: Math.floor(totalDurationSeconds),
      timestamp: Date.now(),
    });

    // Limit history length to 40 items
    if (history.length > 40) {
      history = history.slice(0, 40);
    }

    writeJson(STORAGE_KEYS.HISTORY, history);
  },

  clearHistory() {
    writeJson(STORAGE_KEYS.HISTORY, []);
  },

  clearAllData() {
    localStorage.removeItem(STORAGE_KEYS.FAVORITES);
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
  },
};
