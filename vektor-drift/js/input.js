// Tastatur- und Multitouch-Eingabe.
// Touch: Jeder Finger wird pro Event neu per elementFromPoint ausgewertet,
// dadurch kann man mit dem Daumen zwischen Buttons wischen.

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'thrust', KeyW: 'thrust',
  Space: 'fire', KeyK: 'fire', ControlLeft: 'fire',
  ArrowDown: 'hyper', KeyS: 'hyper', KeyH: 'hyper', ShiftLeft: 'hyper', ShiftRight: 'hyper',
  KeyP: 'pause', Escape: 'pause',
  KeyM: 'mute',
  Enter: 'start',
};

export class Input {
  constructor() {
    this.keys = new Set();
    this.touch = new Set();
    this.edges = new Set();
    this.activeEls = new Set();
    this.onGesture = null; // z. B. Audio-Unlock
    this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (this.isTouch) document.body.classList.add('touch');

    window.addEventListener('keydown', (e) => this.#key(e, true));
    window.addEventListener('keyup', (e) => this.#key(e, false));
    window.addEventListener('blur', () => this.reset());

    const opts = { passive: false };
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
      document.addEventListener(type, (e) => this.#touch(e), opts);
    }

    // Maus/Desktop: Klick auf Buttons bzw. Canvas
    document.addEventListener('mousedown', (e) => {
      this.onGesture?.();
      if (e.target.closest('#name-entry')) return;
      const el = e.target.closest('[data-action]');
      if (el) this.edges.add(el.dataset.action);
      else this.edges.add('tap');
    });
  }

  #key(e, down) {
    if (e.target && e.target.tagName === 'INPUT') return;
    const action = KEYMAP[e.code];
    if (!action) return;
    e.preventDefault();
    if (down) {
      this.onGesture?.();
      if (!this.keys.has(action) && !e.repeat) this.edges.add(action);
      this.keys.add(action);
    } else {
      this.keys.delete(action);
    }
  }

  #touch(e) {
    // Formular (Highscore-Name) normal bedienbar lassen
    if (e.target.closest && e.target.closest('#name-entry')) return;
    e.preventDefault();
    if (e.type === 'touchend' || e.type === 'touchstart') this.onGesture?.();

    const now = new Set();
    const els = new Set();
    for (const t of e.touches) {
      const hit = document.elementFromPoint(t.clientX, t.clientY);
      const el = hit && hit.closest('[data-action]');
      if (el) {
        now.add(el.dataset.action);
        els.add(el);
      }
    }
    if (e.type === 'touchstart') {
      // Tipp ins freie Spielfeld → "tap" (z. B. Spiel starten)
      for (const t of e.changedTouches) {
        const hit = document.elementFromPoint(t.clientX, t.clientY);
        if (!hit || !hit.closest('[data-action]')) this.edges.add('tap');
      }
    }
    for (const a of now) if (!this.touch.has(a)) this.edges.add(a);
    this.touch = now;

    for (const el of this.activeEls) if (!els.has(el)) el.classList.remove('active');
    for (const el of els) el.classList.add('active');
    this.activeEls = els;
  }

  down(action) {
    return this.keys.has(action) || this.touch.has(action);
  }

  consume(action) {
    const had = this.edges.has(action);
    this.edges.delete(action);
    return had;
  }

  endFrame() {
    this.edges.clear();
  }

  reset() {
    this.keys.clear();
    this.touch.clear();
    for (const el of this.activeEls) el.classList.remove('active');
    this.activeEls.clear();
  }
}
