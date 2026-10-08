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
  constructor(containerElement, initialOptions = {}) {
    this.container = containerElement;
    this.cues = [];
    this.activeCue = null;
    this.enabled = true;

    this.fontSize = initialOptions.fontSize || 28;
    this.fontColor = initialOptions.fontColor || '#ffffff';
    this.bgStyle = initialOptions.bgStyle || 'box'; // 'box', 'shadow', 'solid', 'none'
    this.syncOffset = initialOptions.syncOffset || 0; // seconds

    this.fontSizes = [
      { size: 22, label: 'صغير / Small (22px)' },
      { size: 28, label: 'متوسط / Medium (28px)' },
      { size: 34, label: 'كبير / Large (34px)' },
      { size: 42, label: 'كبير جداً / Extra Large (42px)' },
    ];

    this.fontColors = [
      { hex: '#ffffff', label: 'أبيض / White' },
      { hex: '#facc15', label: 'أصفر ذهبي / Yellow' },
      { hex: '#38bdf8', label: 'أزرق سماوي / Cyan' },
      { hex: '#4ade80', label: 'أخضر / Green' },
    ];

    this.bgStyles = [
      { id: 'box', label: 'مستطيل معتم / Translucent Box' },
      { id: 'shadow', label: 'ظل عريض / Outline Shadow' },
      { id: 'solid', label: 'خلفية سوداء / Solid Black' },
      { id: 'none', label: 'نص خالص / None' },
    ];

    this.syncOffsets = [
      { offset: -2, label: '-2.0 ثانية' },
      { offset: -1, label: '-1.0 ثانية' },
      { offset: -0.5, label: '-0.5 ثانية' },
      { offset: 0, label: '0.0 ثانية (افتراضي)' },
      { offset: 0.5, label: '+0.5 ثانية' },
      { offset: 1, label: '+1.0 ثانية' },
      { offset: 2, label: '+2.0 ثانية' },
    ];
  }

  setOptions(opts = {}) {
    if (opts.fontSize) this.fontSize = opts.fontSize;
    if (opts.fontColor) this.fontColor = opts.fontColor;
    if (opts.bgStyle) this.bgStyle = opts.bgStyle;
    if (typeof opts.syncOffset === 'number') this.syncOffset = opts.syncOffset;
    this.renderCurrentCue();
  }

  cycleFontSize() {
    const idx = this.fontSizes.findIndex(s => s.size === this.fontSize);
    const nextIdx = (idx + 1) % this.fontSizes.length;
    this.fontSize = this.fontSizes[nextIdx].size;
    this.renderCurrentCue();
    return this.fontSizes[nextIdx];
  }

  cycleFontColor() {
    const idx = this.fontColors.findIndex(c => c.hex.toLowerCase() === this.fontColor.toLowerCase());
    const nextIdx = (idx + 1) % this.fontColors.length;
    this.fontColor = this.fontColors[nextIdx].hex;
    this.renderCurrentCue();
    return this.fontColors[nextIdx];
  }

  cycleBgStyle() {
    const idx = this.bgStyles.findIndex(b => b.id === this.bgStyle);
    const nextIdx = (idx + 1) % this.bgStyles.length;
    this.bgStyle = this.bgStyles[nextIdx].id;
    this.renderCurrentCue();
    return this.bgStyles[nextIdx];
  }

  cycleSyncOffset() {
    const idx = this.syncOffsets.findIndex(o => Math.abs(o.offset - this.syncOffset) < 0.1);
    const nextIdx = (idx + 1) % this.syncOffsets.length;
    this.syncOffset = this.syncOffsets[nextIdx].offset;
    return this.syncOffsets[nextIdx];
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

    const adjustedTime = currentTime + this.syncOffset;

    // Check if current active cue is still valid
    if (this.activeCue && adjustedTime >= this.activeCue.start && adjustedTime <= this.activeCue.end) {
      return;
    }

    // Binary search or find matching cue
    const current = this.cues.find(cue => adjustedTime >= cue.start && adjustedTime <= cue.end);

    if (current !== this.activeCue) {
      this.activeCue = current;
      this.renderCurrentCue();
    }
  }

  renderCurrentCue() {
    if (!this.container) return;
    if (!this.activeCue || !this.enabled) {
      this.container.innerHTML = '';
      return;
    }

    const current = this.activeCue;
    const isArabic = /[\u0600-\u06FF]/.test(current.text);
    const dirAttr = isArabic ? 'dir="rtl" style="direction: rtl;' : 'dir="ltr" style="direction: ltr;';

    let bgCss = '';
    if (this.bgStyle === 'box') {
      bgCss = 'background: rgba(0, 0, 0, 0.78); text-shadow: 0 2px 4px #000, 0 0 6px rgba(0,0,0,0.8); box-shadow: 0 4px 14px rgba(0,0,0,0.7); padding: 4px 18px; border-radius: 6px;';
    } else if (this.bgStyle === 'solid') {
      bgCss = 'background: #000000; text-shadow: none; box-shadow: 0 4px 14px rgba(0,0,0,0.9); padding: 4px 18px; border-radius: 6px;';
    } else if (this.bgStyle === 'shadow') {
      bgCss = 'background: transparent; text-shadow: 0 2px 4px #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 12px rgba(0,0,0,0.95); box-shadow: none; padding: 2px 8px;';
    } else {
      bgCss = 'background: transparent; text-shadow: none; box-shadow: none; padding: 0;';
    }

    const inlineStyle = `${dirAttr} font-size: ${this.fontSize}px; color: ${this.fontColor}; ${bgCss}"`;
    this.container.innerHTML = `<span class="sub-line" ${inlineStyle}>${this.escapeHtml(current.text).replace(/\n/g, '<br/>')}</span>`;
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
