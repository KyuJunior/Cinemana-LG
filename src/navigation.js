/**
 * Spatial Navigation Engine for LG webOS TV
 * Complete D-pad & Magic Remote management
 */

function getClosest(el, selector) {
  if (!el) return null;
  if (typeof el.closest === 'function') {
    try {
      var res = el.closest(selector);
      if (res) return res;
    } catch (_) {}
  }
  var curr = el;
  while (curr && curr.nodeType === 1) {
    if (typeof curr.matches === 'function') {
      try {
        if (curr.matches(selector)) return curr;
      } catch (_) {}
    }
    curr = curr.parentElement;
  }
  return null;
}

export class SpatialNavigation {
  constructor() {
    this.currentFocused = null;
    this.isNavigating = false;
    this.listeners = new Map();
    this.backHandlers = [];

    this.onKeyDown = this.handleKeyDown.bind(this);
    this.onMouseMove = this.handleMouseMove.bind(this);
  }

  init() {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('mousemove', this.onMouseMove, { passive: true });
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('mousemove', this.onMouseMove);
  }

  pushBackHandler(handler) {
    this.backHandlers.push(handler);
  }

  popBackHandler(handler = null) {
    if (handler) {
      const idx = this.backHandlers.indexOf(handler);
      if (idx !== -1) this.backHandlers.splice(idx, 1);
    } else {
      this.backHandlers.pop();
    }
  }

  getFocusableElements(container = document) {
    const selector = '.focusable:not([disabled]):not([data-nav-disabled="true"])';
    const all = Array.from(container.querySelectorAll(selector));
    return all.filter(el => {
      // Must be visible
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    });
  }

  setFocus(element, scrollIntoView = true) {
    if (!element) return;
    if (typeof element === 'string') {
      element = document.querySelector(element);
    }
    if (!element) return;

    if (this.currentFocused && this.currentFocused !== element) {
      this.currentFocused.classList.remove('focused');
      this.currentFocused.blur();
    }

    this.currentFocused = element;
    element.classList.add('focused');
    element.focus();

    if (scrollIntoView) {
      this.ensureVisible(element);
    }

    this.emit('focusChange', element);
  }

  ensureVisible(element) {
    try {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    } catch (_) {
      try {
        element.scrollIntoView(false);
      } catch (__) {}
    }
  }

  getCurrentFocused() {
    if (!this.currentFocused || !document.body.contains(this.currentFocused)) {
      const candidates = this.getFocusableElements();
      if (candidates.length > 0) {
        this.setFocus(candidates[0]);
      }
    }
    return this.currentFocused;
  }

  handleMouseMove(e) {
    try {
      const target = e.target ? getClosest(e.target, '.focusable') : null;
      if (target && target !== this.currentFocused) {
        this.setFocus(target, false);
      }
    } catch (_) {}
  }

  handleKeyDown(e) {
    let key = e.key;
    const keyCode = e.keyCode;

    // Normalize webOS remote key codes
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

    // Broadcast media keys
    if (['Play', 'Pause', 'PlayPause', 'Rewind', 'FastForward'].includes(key) || [415, 19, 179, 412, 417, 10252].includes(keyCode)) {
      this.emit('mediaKey', { key, keyCode, event: e });
      return;
    }

    // Handle Back / Escape
    if (key === 'Escape') {
      e.preventDefault();
      if (this.backHandlers.length > 0) {
        const topHandler = this.backHandlers[this.backHandlers.length - 1];
        const handled = topHandler();
        if (handled) return;
      }
      this.emit('back', e);
      return;
    }

    // Handle Enter / Click
    if (key === 'Enter') {
      const focused = this.getCurrentFocused();
      if (focused) {
        e.preventDefault();
        focused.click();
      }
      return;
    }

    // Directional keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      // If typing inside an input and left/right is pressed, allow cursor navigation
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
          return;
        }
      }

      e.preventDefault();
      this.navigateDirection(key);
    }
  }

  navigateDirection(direction) {
    const current = this.getCurrentFocused();
    if (!current) {
      const candidates = this.getFocusableElements();
      if (candidates.length > 0) this.setFocus(candidates[0]);
      return;
    }

    // Custom explicit navigation overrides via data attributes
    const overrideAttr = {
      ArrowUp: 'data-nav-up',
      ArrowDown: 'data-nav-down',
      ArrowLeft: 'data-nav-left',
      ArrowRight: 'data-nav-right',
    }[direction];

    if (overrideAttr && current.getAttribute(overrideAttr)) {
      const targetSelector = current.getAttribute(overrideAttr);
      const target = document.querySelector(targetSelector);
      if (target) {
        this.setFocus(target);
        return;
      }
    }

    // Check if in side dock navigating right
    if (getClosest(current, '#side-dock') && direction === 'ArrowRight') {
      const contentTarget = this.findFirstContentFocusable();
      if (contentTarget) {
        this.setFocus(contentTarget);
        return;
      }
    }

    // Find best spatial neighbor
    const candidates = this.getFocusableElements().filter(el => el !== current);
    const next = this.findNearestElement(current, candidates, direction);

    if (next) {
      this.setFocus(next);
    } else {
      // If moving left from first column in content area, jump to side navigation dock
      if (direction === 'ArrowLeft' && !getClosest(current, '#side-dock') && !getClosest(current, '#screen-player')) {
        const activeNav = document.querySelector('#side-dock .nav-item.active') || document.querySelector('#side-dock .nav-item');
        if (activeNav) {
          this.setFocus(activeNav);
        }
      }
    }
  }

  findFirstContentFocusable() {
    const activeScreen = document.querySelector('.screen.active');
    if (!activeScreen) return null;
    const items = this.getFocusableElements(activeScreen).filter(el => !getClosest(el, '#side-dock'));
    return items.length > 0 ? items[0] : null;
  }

  findNearestElement(current, candidates, direction) {
    const currentRect = current.getBoundingClientRect();
    const currentCenter = {
      x: currentRect.left + currentRect.width / 2,
      y: currentRect.top + currentRect.height / 2,
    };

    let bestElement = null;
    let minDistance = Infinity;

    for (const target of candidates) {
      const targetRect = target.getBoundingClientRect();
      const targetCenter = {
        x: targetRect.left + targetRect.width / 2,
        y: targetRect.top + targetRect.height / 2,
      };

      const dx = targetCenter.x - currentCenter.x;
      const dy = targetCenter.y - currentCenter.y;

      let isValidDirection = false;
      let primaryDiff = 0;
      let secondaryDiff = 0;

      switch (direction) {
        case 'ArrowUp':
          isValidDirection = dy < -4 && currentRect.top >= targetRect.bottom - 10;
          primaryDiff = Math.abs(dy);
          secondaryDiff = Math.abs(dx);
          break;
        case 'ArrowDown':
          isValidDirection = dy > 4 && targetRect.top >= currentRect.bottom - 10;
          primaryDiff = Math.abs(dy);
          secondaryDiff = Math.abs(dx);
          break;
        case 'ArrowLeft':
          isValidDirection = dx < -4 && currentRect.left >= targetRect.right - 10;
          primaryDiff = Math.abs(dx);
          secondaryDiff = Math.abs(dy);
          break;
        case 'ArrowRight':
          isValidDirection = dx > 4 && targetRect.left >= currentRect.right - 10;
          primaryDiff = Math.abs(dx);
          secondaryDiff = Math.abs(dy);
          break;
      }

      if (isValidDirection) {
        // Weighted Manhattan distance prioritizing primary direction alignment
        const distance = primaryDiff + secondaryDiff * 2.2;
        if (distance < minDistance) {
          minDistance = distance;
          bestElement = target;
        }
      }
    }

    return bestElement;
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
  }

  off(event, handler) {
    if (!this.listeners.has(event)) return;
    const list = this.listeners.get(event);
    const idx = list.indexOf(handler);
    if (idx !== -1) list.splice(idx, 1);
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    for (const handler of this.listeners.get(event)) {
      handler(data);
    }
  }
}
