// Synthetische Retro-Sounds über die Web Audio API – keine Audiodateien nötig.

import { loadPref, savePref } from './storage.js';

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = loadPref('muted', false);
    this.volume = 0.55;
    this.thrustOn = false;
    this.ufoVoice = null;
  }

  /** Muss in einem User-Gesture-Handler aufgerufen werden (iOS/Safari). */
  unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) {
      // iOS 16.4+: auch bei Stummschalter abspielen
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* egal */ }

      const ctx = (this.ctx = new AC());
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      this.master.connect(comp).connect(ctx.destination);

      // Weißes Rauschen (2 s) für Explosionen & Schub
      const len = ctx.sampleRate * 2;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      // Dauerhafter Schub-Kanal (Rauschen → Tiefpass → Gain 0)
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      lp.Q.value = 2;
      this.thrustGain = ctx.createGain();
      this.thrustGain.gain.value = 0;
      src.connect(lp).connect(this.thrustGain).connect(this.master);
      src.start();

      // iOS-Unlock: stiller Puffer
      const silent = ctx.createBufferSource();
      silent.buffer = ctx.createBuffer(1, 1, 22050);
      silent.connect(ctx.destination);
      silent.start(0);
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  get ready() {
    return this.ctx && this.ctx.state === 'running';
  }

  toggleMute() {
    this.muted = !this.muted;
    savePref('muted', this.muted);
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    return this.muted;
  }

  // ---------- Bausteine ----------

  tone(type, f0, f1, dur, vol = 0.2, delay = 0) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  noise(dur, vol, f0, f1, delay = 0, type = 'lowpass') {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.03);
  }

  // ---------- Spielsounds ----------

  fire() {
    this.tone('square', 1500, 220, 0.1, 0.09);
    this.tone('triangle', 900, 120, 0.12, 0.08);
  }

  ufoFire() {
    this.tone('sawtooth', 1000, 260, 0.16, 0.07);
  }

  explode(size) {
    const dur = [0, 0.28, 0.48, 0.75][size];
    this.noise(dur, 0.35 + size * 0.12, [0, 2600, 1600, 1000][size], 60);
    this.tone('sine', [0, 160, 110, 75][size], 28, dur, 0.35);
  }

  ufoExplode() {
    this.noise(0.8, 0.6, 3500, 80);
    this.tone('square', 600, 40, 0.6, 0.12);
  }

  shipExplode() {
    this.noise(1.4, 0.8, 4000, 40);
    this.tone('sawtooth', 320, 25, 1.2, 0.2);
    this.tone('sine', 90, 20, 1.0, 0.45);
  }

  hyperspace() {
    this.tone('sine', 180, 2200, 0.28, 0.16);
    this.tone('triangle', 2200, 180, 0.3, 0.1, 0.06);
  }

  extraLife() {
    [660, 880, 1100, 1320].forEach((f, i) => this.tone('square', f, f, 0.09, 0.07, i * 0.09));
  }

  waveStart() {
    [330, 440, 550].forEach((f, i) => this.tone('triangle', f, f * 1.01, 0.14, 0.12, i * 0.1));
  }

  gameOver() {
    [440, 370, 311, 220].forEach((f, i) => this.tone('triangle', f, f * 0.98, 0.3, 0.14, i * 0.22));
  }

  /** "Herzschlag" im Hintergrund – zwei abwechselnde tiefe Töne. */
  beat(high) {
    const f = high ? 82 : 68;
    this.tone('square', f, f * 0.9, 0.11, 0.16);
    this.tone('sine', f * 2, f * 1.8, 0.09, 0.12);
  }

  thrust(on) {
    if (!this.ctx || on === this.thrustOn) return;
    this.thrustOn = on;
    this.thrustGain.gain.setTargetAtTime(on ? 0.4 : 0, this.ctx.currentTime, on ? 0.03 : 0.06);
  }

  /** Sirenenton, solange ein UFO unterwegs ist. */
  ufo(on, small = false) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (!on) {
      if (this.ufoVoice) {
        const v = this.ufoVoice;
        this.ufoVoice = null;
        v.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        v.osc.stop(ctx.currentTime + 0.3);
        v.lfo.stop(ctx.currentTime + 0.3);
      }
      return;
    }
    if (this.ufoVoice || !this.ready) return;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = small ? 950 : 520;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = small ? 9 : 4.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = small ? 160 : 90;
    lfo.connect(lfoGain).connect(osc.frequency);
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(0.035, ctx.currentTime, 0.05);
    osc.connect(g).connect(this.master);
    osc.start();
    lfo.start();
    this.ufoVoice = { osc, lfo, g };
  }

  stopLoops() {
    this.thrust(false);
    this.ufo(false);
  }
}
