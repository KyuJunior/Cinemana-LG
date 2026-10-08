/**
 * Cinemana API Client for LG webOS TV
 * Direct integration with Shabakaty Cinemana endpoints
 */

const BASE_URL = 'https://cinemana.shabakaty.com/api/android/';

// In-memory cache with expiration
const memoryCache = new Map();

function getFromCache(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
}

function putInCache(key, data, ttlMs = 10 * 60 * 1000) {
  memoryCache.set(key, {
    data,
    expiry: Date.now() + ttlMs,
  });
}

export function clearApiCache() {
  memoryCache.clear();
}

const defaultHeaders = {
  'Accept': 'application/json',
};

async function fetchJson(endpoint, cacheKey = null, ttlMs = 10 * 60 * 1000) {
  if (cacheKey) {
    const cached = getFromCache(cacheKey);
    if (cached) return cached;
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: defaultHeaders,
    });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const data = await response.json();
    if (cacheKey) {
      putInCache(cacheKey, data, ttlMs);
    }
    return data;
  } catch (err) {
    console.error(`Fetch failed for ${endpoint}:`, err);
    throw err;
  }
}

/**
 * Format raw Cinemana item into standardized VideoItem model
 */
export function formatVideoItem(raw) {
  if (!raw) return null;

  const categories = [];
  if (Array.isArray(raw.categories)) {
    for (const c of raw.categories) {
      if (typeof c === 'object' && c !== null) {
        if (c.en_title) categories.push(c.en_title);
        else if (c.ar_title) categories.push(c.ar_title);
      } else if (typeof c === 'string') {
        categories.push(c);
      }
    }
  }

  const en = (raw.en_title || raw.custom_en_title || '').trim();
  const ar = (raw.ar_title || raw.custom_ar_title || '').trim();
  const primaryTitle = en || ar || 'Untitled';
  const displayTitle = (en && ar && en !== ar) ? `${en} (${ar})` : primaryTitle;
  const secondaryTitle = (en && ar && en !== ar) ? ar : '';

  const isValidUrl = url => url && typeof url === 'string' && url.indexOf('http') === 0 && url.indexOf('loading.gif') === -1 && url.indexOf('defaultImages') === -1;

  let posterUrl = '';
  if (isValidUrl(raw.imgMediumThumbObjUrl)) {
    posterUrl = raw.imgMediumThumbObjUrl;
  } else if (isValidUrl(raw.imgObjUrl)) {
    posterUrl = raw.imgObjUrl;
  } else if (isValidUrl(raw.imgThumbObjUrl)) {
    posterUrl = raw.imgThumbObjUrl;
  } else if (raw.imgMediumThumb) {
    posterUrl = `https://cnth2.shabakaty.com/vascin-poster-images/${raw.imgMediumThumb}`;
  } else if (raw.img) {
    posterUrl = `https://cnth2.shabakaty.com/vascin-poster-images/${raw.img}`;
  }

  if (posterUrl && posterUrl.indexOf('.shabakaty.cc') !== -1) {
    posterUrl = posterUrl.replace('.shabakaty.cc', '.shabakaty.com');
  }

  let backdropUrl = posterUrl;
  if (isValidUrl(raw.imgObjUrl)) {
    backdropUrl = raw.imgObjUrl.replace('.shabakaty.cc', '.shabakaty.com');
  }

  const durationSec = parseFloat(raw.duration) || 0;
  let formattedDuration = '';
  if (durationSec > 0) {
    const totalMinutes = Math.round(durationSec / 60);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    formattedDuration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }

  return {
    id: String(raw.nb || raw.id || ''),
    primaryTitle,
    displayTitle,
    secondaryTitle,
    arTitle: ar,
    enTitle: en,
    arContent: raw.ar_content || '',
    enContent: raw.en_content || '',
    year: String(raw.year || ''),
    stars: String(raw.stars || '0.0'),
    rating: parseFloat(raw.stars) || 0.0,
    duration: String(raw.duration || '0'),
    formattedDuration,
    posterUrl,
    backdropUrl,
    isSeries: String(raw.kind || '1') === '2',
    kind: String(raw.kind || '1'),
    season: String(raw.season || '0'),
    episodeNumber: String(raw.episodeNummer || '0'),
    categories,
    trailer: raw.trailer || '',
  };
}

export const CinemanaApi = {
  /**
   * Fetch featured banners for Hero showcase
   */
  async getBanners(level = 0) {
    const cacheKey = `banners_${level}`;
    const raw = await fetchJson(`banner/level/${level}`, cacheKey, 15 * 60 * 1000);
    if (!Array.isArray(raw)) return [];
    return raw.map(formatVideoItem).filter(Boolean);
  },

  /**
   * Fetch curated shelves / video groups
   */
  async getVideoGroups(lang = 'ar', level = 0) {
    const cacheKey = `groups_${lang}_${level}`;
    const raw = await fetchJson(`videoGroups/lang/${lang}/level/${level}`, cacheKey, 15 * 60 * 1000);
    if (!raw || !Array.isArray(raw.groups)) return [];

    return raw.groups
      .map(group => ({
        id: String(group.id || ''),
        arTitle: group.group_ar_title || '',
        enTitle: group.group_en_title || '',
        title: group.group_ar_title || group.group_en_title || 'Featured Group',
        items: Array.isArray(group.video) ? group.video.map(formatVideoItem).filter(Boolean) : [],
      }))
      .filter(g => g.items.length > 0);
  },

  /**
   * Fetch latest movies
   */
  async getLatestMovies(page = 0, itemsPerPage = 30, level = 0) {
    const cacheKey = `movies_${page}_${itemsPerPage}_${level}`;
    const raw = await fetchJson(`latestMovies/level/${level}/itemsPerPage/${itemsPerPage}/page/${page}/`, cacheKey, 5 * 60 * 1000);
    if (!Array.isArray(raw)) return [];
    return raw.map(formatVideoItem).filter(Boolean);
  },

  /**
   * Fetch latest series
   */
  async getLatestSeries(page = 0, itemsPerPage = 30, level = 0) {
    const cacheKey = `series_${page}_${itemsPerPage}_${level}`;
    const raw = await fetchJson(`latestSeries/level/${level}/itemsPerPage/${itemsPerPage}/page/${page}/`, cacheKey, 5 * 60 * 1000);
    if (!Array.isArray(raw)) return [];
    return raw.map(formatVideoItem).filter(Boolean);
  },

  /**
   * Fetch full metadata for title
   */
  async getVideoDetails(id) {
    const cacheKey = `details_${id}`;
    const raw = await fetchJson(`allVideoInfo/id/${id}`, cacheKey, 20 * 60 * 1000);
    return formatVideoItem(raw);
  },

  /**
   * Fetch playable video streams with qualities (2160p, 1080p, 720p, etc.)
   */
  async getVideoStreams(id) {
    const cacheKey = `streams_${id}`;
    const raw = await fetchJson(`transcoddedFiles/id/${id}`, cacheKey, 15 * 60 * 1000);
    if (!Array.isArray(raw)) return [];

    const getRank = res => {
      const r = (res || '').toLowerCase();
      if (r.includes('2160') || r.includes('4k')) return 2160;
      if (r.includes('1080')) return 1080;
      if (r.includes('720')) return 720;
      if (r.includes('480')) return 480;
      if (r.includes('360')) return 360;
      if (r.includes('240')) return 240;
      return 0;
    };

    const streams = raw.map(item => ({
      name: item.name || '',
      resolution: item.resolution || '720p',
      container: item.container || 'mp4',
      fileName: item.transcoddedFileName || '',
      videoUrl: item.videoUrl || '',
      qualityRank: getRank(item.resolution),
    })).filter(s => !!s.videoUrl);

    streams.sort((a, b) => b.qualityRank - a.qualityRank);
    return streams;
  },

  /**
   * Fetch subtitle tracks (Arabic, English SRT and VTT files)
   */
  async getSubtitles(id) {
    const cacheKey = `subs_${id}`;
    const raw = await fetchJson(`translationFiles/id/${id}`, cacheKey, 30 * 60 * 1000);
    const tracks = [];

    if (raw && Array.isArray(raw.translations)) {
      for (const t of raw.translations) {
        if (!t || !t.file) continue;
        const type = (t.type || '').toLowerCase();
        const ext = (t.extention || t.extension || 'srt').toLowerCase();
        let label = 'Other';
        if (type === 'ar' || (t.name && t.name.toLowerCase().includes('arab'))) {
          label = 'Arabic (العربية)';
        } else if (type === 'en' || (t.name && t.name.toLowerCase().includes('engl'))) {
          label = 'English';
        } else if (t.name) {
          label = t.name;
        }

        tracks.push({
          id: t.id || tracks.length,
          name: t.name || label,
          label,
          type,
          extension: ext,
          fileUrl: t.file,
        });
      }
    }

    return tracks;
  },

  /**
   * Fetch seasons list for series
   */
  async getSeasons(id) {
    const cacheKey = `seasons_${id}`;
    const raw = await fetchJson(`videoSeasonNumber/id/${id}`, cacheKey, 30 * 60 * 1000);
    if (!Array.isArray(raw)) return [1];

    const seasons = [];
    for (const item of raw) {
      const s = parseInt(item.season, 10);
      if (!isNaN(s) && !seasons.includes(s)) {
        seasons.push(s);
      }
    }
    seasons.sort((a, b) => a - b);
    return seasons.length > 0 ? seasons : [1];
  },

  /**
   * Fetch episodes list for series
   */
  async getEpisodes(id) {
    const cacheKey = `episodes_${id}`;
    const raw = await fetchJson(`videoSeason/id/${id}`, cacheKey, 30 * 60 * 1000);
    if (!Array.isArray(raw)) return [];

    const episodes = raw.map(ep => {
      let thumbUrl = '';
      if (ep.imgMediumThumbObjUrl && ep.imgMediumThumbObjUrl.startsWith('http')) {
        thumbUrl = ep.imgMediumThumbObjUrl;
      } else if (ep.imgObjUrl && ep.imgObjUrl.startsWith('http')) {
        thumbUrl = ep.imgObjUrl;
      } else if (ep.img) {
        thumbUrl = `https://cnth2.shabakaty.com/vascin-poster-images/${ep.img}`;
      }

      return {
        id: String(ep.nb || ''),
        season: String(ep.season || '1'),
        episodeNumber: String(ep.episodeNummer || '1'),
        arTitle: ep.ar_title || '',
        enTitle: ep.en_title || '',
        title: ep.en_title || ep.ar_title || `Episode ${ep.episodeNummer || '1'}`,
        arContent: ep.ar_content || '',
        enContent: ep.en_content || '',
        duration: String(ep.duration || '0'),
        thumbUrl,
      };
    });

    episodes.sort((a, b) => {
      const epA = parseInt(a.episodeNumber, 10) || 0;
      const epB = parseInt(b.episodeNumber, 10) || 0;
      return epA - epB;
    });

    return episodes;
  },

  /**
   * Fetch related titles
   */
  async getRelatedVideos(id, isSeries = false, level = 0) {
    const cacheKey = `related_${id}_${isSeries}_${level}`;
    const kind = isSeries ? '2' : '1';
    const raw = await fetchJson(`relatedVideos/id/${id}/kind/${kind}/level/${level}`, cacheKey, 20 * 60 * 1000);
    if (!Array.isArray(raw)) return [];
    return raw.map(formatVideoItem).filter(Boolean);
  },

  /**
   * Search titles by text query for a specific type ('series' or 'movies')
   */
  async searchType(query, type = 'movies', level = 0, pagesCount = 2) {
    const q = (query || '').trim();
    if (!q) return [];
    try {
      const encoded = encodeURIComponent(q);
      const pagePromises = [];
      for (let p = 0; p < pagesCount; p++) {
        pagePromises.push(
          fetchJson(`AdvancedSearch?level=${level}&videoTitle=${encoded}&staffTitle=${encoded}&type=${type}&page=${p}`, null, 0)
            .catch(() => [])
        );
      }

      const results = await Promise.all(pagePromises);
      const map = new Map();
      for (let p = 0; p < results.length; p++) {
        const pageItems = results[p];
        if (Array.isArray(pageItems)) {
          for (let i = 0; i < pageItems.length; i++) {
            const raw = pageItems[i];
            if (raw && (raw.nb || raw.id)) {
              const item = formatVideoItem(raw);
              if (item) map.set(item.id, item);
            }
          }
        }
      }

      const allItems = [];
      map.forEach(item => { allItems.push(item); });
      if (allItems.length === 0) return [];

      const qLower = q.toLowerCase();
      const qWords = qLower.split(/[\s:,\-_]+/).filter(w => w.length > 0);

      function scoreItem(item) {
        const en = (item.enTitle || '').toLowerCase();
        const ar = (item.arTitle || '').toLowerCase();
        let score = 0;

        if (en === qLower || ar === qLower) score += 3000;
        if (en.indexOf(qLower) === 0 || ar.indexOf(qLower) === 0) score += 1500;
        const enWords = en.split(/[\s:,\-_]+/);
        const arWords = ar.split(/[\s:,\-_]+/);
        if (enWords.indexOf(qLower) !== -1 || arWords.indexOf(qLower) !== -1) score += 900;
        if (en.indexOf(qLower) !== -1 || ar.indexOf(qLower) !== -1) score += 600;
        if (qWords.length > 1) {
          const allInEn = qWords.every(w => en.indexOf(w) !== -1);
          const allInAr = qWords.every(w => ar.indexOf(w) !== -1);
          if (allInEn || allInAr) score += 800;
        }
        const year = parseInt(item.year, 10);
        if (!isNaN(year) && year > 1900) score += Math.min(Math.max(year - 1980, 0), 45);
        if (item.rating > 0) score += Math.round(item.rating * 5);

        return score;
      }

      allItems.sort((a, b) => {
        const diff = scoreItem(b) - scoreItem(a);
        if (diff !== 0) return diff;
        return (parseInt(b.year, 10) || 0) - (parseInt(a.year, 10) || 0);
      });

      const titleMatches = allItems.filter(i => {
        const en = (i.enTitle || '').toLowerCase();
        const ar = (i.arTitle || '').toLowerCase();
        return en.indexOf(qLower) !== -1 || ar.indexOf(qLower) !== -1 || (qWords.length > 1 && qWords.some(w => en.indexOf(w) !== -1 || ar.indexOf(w) !== -1));
      });

      return titleMatches.length > 0 ? titleMatches : allItems;
    } catch (e) {
      console.error(`Search type ${type} error:`, e);
      return [];
    }
  },

  /**
   * Search titles by text query returning separate series and movies collections
   */
  async search(query, level = 0, pagesCount = 2) {
    const q = (query || '').trim();
    if (!q) return { series: [], movies: [], all: [] };
    const cacheKey = `search_dual_${q.toLowerCase()}_${level}_${pagesCount}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const [series, movies] = await Promise.all([
        this.searchType(q, 'series', level, pagesCount).catch(() => []),
        this.searchType(q, 'movies', level, pagesCount).catch(() => []),
      ]);

      const result = {
        series,
        movies,
        all: [...series, ...movies],
      };
      putInCache(cacheKey, result, 10 * 60 * 1000);
      return result;
    } catch (e) {
      console.error('AdvancedSearch error:', e);
      return { series: [], movies: [], all: [] };
    }
  },

  /**
   * Fetch intro skipping intervals
   */
  async getIntroInterval(id) {
    const cacheKey = `intro_${id}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const rawInfo = await fetchJson(`allVideoInfo/id/${id}`, null, 0);
      if (rawInfo && typeof rawInfo === 'object') {
        if (rawInfo.skippingDurations && typeof rawInfo.skippingDurations === 'object') {
          const starts = rawInfo.skippingDurations.start;
          const ends = rawInfo.skippingDurations.end;
          if (Array.isArray(starts) && Array.isArray(ends) && starts.length > 0 && ends.length > 0) {
            const start = parseFloat(starts[0]);
            const end = parseFloat(ends[0]);
            if (!isNaN(start) && !isNaN(end) && end > start) {
              const res = { start, end };
              putInCache(cacheKey, res, 45 * 60 * 1000);
              return res;
            }
          }
        }
      }
    } catch (_) {}

    try {
      const rawSkip = await fetchJson(`skippingDurations/id/${id}`, null, 0);
      if (rawSkip && typeof rawSkip === 'object') {
        const starts = rawSkip.start;
        const ends = rawSkip.end;
        if (Array.isArray(starts) && Array.isArray(ends) && starts.length > 0 && ends.length > 0) {
          const start = parseFloat(starts[0]);
          const end = parseFloat(ends[0]);
          if (!isNaN(start) && !isNaN(end) && end > start) {
            const res = { start, end };
            putInCache(cacheKey, res, 45 * 60 * 1000);
            return res;
          }
        }
      }
    } catch (_) {}

    return null;
  },

  /**
   * Fetch censorship / sensitive scene cutting intervals
   * Returns array of { start: number, end: number }
   */
  async getCensorshipIntervals(id) {
    const cacheKey = `censor_${id}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const rawSkip = await fetchJson(`skippingDurations/id/${id}`, null, 0);
      if (rawSkip && typeof rawSkip === 'object') {
        const starts = rawSkip.start;
        const ends = rawSkip.end;
        if (Array.isArray(starts) && Array.isArray(ends) && starts.length > 0 && ends.length > 0) {
          const intervals = [];
          const count = Math.min(starts.length, ends.length);
          for (let i = 0; i < count; i++) {
            const start = parseFloat(starts[i]);
            const end = parseFloat(ends[i]);
            if (!isNaN(start) && !isNaN(end) && end > start) {
              intervals.push({ start, end });
            }
          }
          if (intervals.length > 0) {
            putInCache(cacheKey, intervals, 60 * 60 * 1000);
            return intervals;
          }
        }
      }
    } catch (_) {}

    try {
      const rawInfo = await fetchJson(`allVideoInfo/id/${id}`, null, 0);
      if (rawInfo && typeof rawInfo === 'object' && rawInfo.skippingDurations) {
        const starts = rawInfo.skippingDurations.start;
        const ends = rawInfo.skippingDurations.end;
        if (Array.isArray(starts) && Array.isArray(ends) && starts.length > 0 && ends.length > 0) {
          const intervals = [];
          const count = Math.min(starts.length, ends.length);
          for (let i = 0; i < count; i++) {
            const start = parseFloat(starts[i]);
            const end = parseFloat(ends[i]);
            if (!isNaN(start) && !isNaN(end) && end > start) {
              intervals.push({ start, end });
            }
          }
          if (intervals.length > 0) {
            putInCache(cacheKey, intervals, 60 * 60 * 1000);
            return intervals;
          }
        }
      }
    } catch (_) {}

    return [];
  },
};
