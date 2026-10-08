/**
 * Subtitle Parsing & Rendering Engine for webOS TV
 * Supports both SRT and WebVTT formats with RTL Arabic support
 */

function parseTime(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.trim().replace(',', '.').split(':');
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  } else if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return 0;
}

export function parseSrtOrVtt(content) {
  if (!content) return [];
  const cues = [];
  // Normalize line endings
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    let timeLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timeLineIndex = i;
        break;
      }
    }

    if (timeLineIndex === -1) continue;

    const timeParts = lines[timeLineIndex].split('-->');
    if (timeParts.length !== 2) continue;

    const start = parseTime(timeParts[0].trim().split(' ')[0]);
    const end = parseTime(timeParts[1].trim().split(' ')[0]);

    if (isNaN(start) || isNaN(end) || end <= start) continue;

    // Remaining lines are subtitle text
    const textLines = lines.slice(timeLineIndex + 1);
    const cleanText = textLines
      .join('\n')
      .replace(/<[^>]+>/g, '') // strip HTML/formatting tags
      .trim();

    if (cleanText) {
      cues.push({ start, end, text: cleanText });
    }
  }

  // Sort cues by start timestamp
  cues.sort((a, b) => a.start - b.start);
  return cues;
}

export class SubtitleRenderer {
  constructor(containerElement) {
    this.container = containerElement;
    this.cues = [];
    this.activeCue = null;
    this.enabled = true;
  }

  async loadTrack(trackUrl) {
    this.clear();
    if (!trackUrl) {
      this.cues = [];
      return;
    }

    try {
      const res = await fetch(trackUrl);
      if (!res.ok) throw new Error(`Subtitle HTTP error ${res.status}`);
      const text = await res.text();
      this.cues = parseSrtOrVtt(text);
      console.log(`Loaded ${this.cues.length} subtitle cues from ${trackUrl}`);
    } catch (err) {
      console.error('Failed to load subtitle track:', err);
      this.cues = [];
    }
  }

  update(currentTime) {
    if (!this.enabled || !this.cues.length) {
      if (this.container && this.container.innerHTML !== '') {
        this.container.innerHTML = '';
      }
      this.activeCue = null;
      return;
    }

    // Check if current active cue is still valid
    if (this.activeCue && currentTime >= this.activeCue.start && currentTime <= this.activeCue.end) {
      return;
    }

    // Binary search or find matching cue
    const current = this.cues.find(cue => currentTime >= cue.start && currentTime <= cue.end);

    if (current !== this.activeCue) {
      this.activeCue = current;
      if (this.container) {
        if (current) {
          // Detect Arabic characters for direction styling
          const isArabic = /[\u0600-\u06FF]/.test(current.text);
          const dirAttr = isArabic ? 'dir="rtl" style="direction: rtl;"' : 'dir="ltr"';
          this.container.innerHTML = `<span class="sub-line" ${dirAttr}>${this.escapeHtml(current.text).replace(/\n/g, '<br/>')}</span>`;
        } else {
          this.container.innerHTML = '';
        }
      }
    }
  }

  escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  setEnabled(val) {
    this.enabled = val;
    if (!val && this.container) {
      this.container.innerHTML = '';
      this.activeCue = null;
    }
  }

  clear() {
    this.cues = [];
    this.activeCue = null;
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
