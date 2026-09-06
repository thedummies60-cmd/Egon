/* ============================================================
 * audio.js - every sound is synthesised with WebAudio, so the
 * game still ships with no asset files.
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});

  function Audio2() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.volume = 0.7;
    this.noiseBuf = null;
    this.lastStep = 0;
  }

  Audio2.prototype.init = function () {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    try { this.ctx = new AC(); } catch (e) { this.enabled = false; return; }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    // one second of white noise, reused by every percussive sound
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  };

  Audio2.prototype.resume = function () {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  };

  Audio2.prototype.setVolume = function (v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  };

  Audio2.prototype.noise = function (dur, gain, filterType, freq, q, sweepTo) {
    if (!this.enabled || !this.ctx || this.volume <= 0) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filterType || 'bandpass';
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t + dur);
    f.Q.value = q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  };

  Audio2.prototype.tone = function (freq, dur, gain, type, sweepTo) {
    if (!this.enabled || !this.ctx || this.volume <= 0) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  };

  const MAT = {
    stone: { f: 1400, q: 1.2, d: 0.12, g: 0.16 },
    gravel: { f: 900, q: 0.9, d: 0.13, g: 0.16 },
    sand: { f: 700, q: 0.7, d: 0.15, g: 0.13 },
    wood: { f: 1000, q: 2.2, d: 0.11, g: 0.18 },
    grass: { f: 1700, q: 0.8, d: 0.11, g: 0.12 },
    glass: { f: 3200, q: 3.0, d: 0.10, g: 0.16 },
    wool: { f: 500, q: 0.6, d: 0.13, g: 0.10 },
    snow: { f: 2200, q: 0.7, d: 0.10, g: 0.11 },
    water: { f: 900, q: 0.5, d: 0.16, g: 0.10 },
    lava: { f: 300, q: 0.5, d: 0.30, g: 0.14 }
  };

  Audio2.prototype.dig = function (mat) {
    const m = MAT[mat] || MAT.stone;
    this.noise(m.d * 0.8, m.g * 0.55, 'bandpass', m.f * (0.85 + Math.random() * 0.3), m.q);
  };
  Audio2.prototype.break_ = function (mat) {
    const m = MAT[mat] || MAT.stone;
    this.noise(m.d * 1.6, m.g, 'bandpass', m.f * (0.9 + Math.random() * 0.3), m.q, m.f * 0.45);
    if (mat === 'glass') this.noise(0.22, 0.14, 'highpass', 2600, 1);
  };
  Audio2.prototype.place = function (mat) {
    const m = MAT[mat] || MAT.stone;
    this.noise(m.d, m.g * 0.85, 'bandpass', m.f * 0.8, m.q, m.f * 0.6);
  };
  Audio2.prototype.step = function (mat) {
    const now = performance.now();
    if (now - this.lastStep < 120) return;
    this.lastStep = now;
    const m = MAT[mat] || MAT.stone;
    this.noise(0.075, m.g * 0.4, 'bandpass', m.f * (0.7 + Math.random() * 0.35), m.q * 0.8);
  };

  Audio2.prototype.play = function (name, gain) {
    gain = gain === undefined ? 0.3 : gain;
    switch (name) {
      case 'click': this.tone(880, 0.05, gain * 0.5, 'square', 660); break;
      case 'jump': this.noise(0.06, gain * 0.4, 'bandpass', 900, 1); break;
      case 'hurt': this.tone(320, 0.22, gain, 'sawtooth', 120); break;
      case 'hit': this.noise(0.09, gain, 'bandpass', 600, 1.4, 260); break;
      case 'pop': this.tone(760, 0.09, gain, 'sine', 1400); break;
      case 'xp': this.tone(1180, 0.11, gain, 'sine', 1760); break;
      case 'craft': this.tone(560, 0.08, gain, 'triangle', 840);
        this.tone(760, 0.1, gain * 0.6, 'triangle', 1140); break;
      case 'open': this.noise(0.14, gain * 0.6, 'bandpass', 700, 1.8, 420); break;
      case 'levelup':
        this.tone(660, 0.14, gain, 'triangle');
        setTimeout(() => this.tone(990, 0.22, gain, 'triangle'), 110);
        break;
      case 'explode':
        this.noise(0.85, gain * 1.5, 'lowpass', 900, 0.6, 60);
        this.tone(90, 0.6, gain, 'sawtooth', 28);
        break;
      case 'splash': this.noise(0.28, gain, 'bandpass', 1400, 0.8, 500); break;
      case 'fizz': this.noise(0.5, gain * 0.7, 'highpass', 2200, 0.7, 900); break;
      case 'eat': this.noise(0.09, gain * 0.5, 'bandpass', 500, 1.5); break;
      case 'bow': this.noise(0.16, gain * 0.5, 'highpass', 1400, 0.8, 600); break;
      case 'death': this.tone(300, 0.7, gain, 'sawtooth', 60); break;
      default: break;
    }
  };

  /* --- ambient mob noises, spaced out so they don't get annoying --- */
  Audio2.prototype.mob = function (type, gain) {
    gain = gain || 0.2;
    switch (type) {
      case 'pig': this.tone(210, 0.16, gain, 'sawtooth', 150); break;
      case 'cow': case 'mooshroom': this.tone(150, 0.5, gain, 'sawtooth', 110); break;
      case 'sheep': this.tone(420, 0.32, gain, 'square', 330); break;
      case 'chicken': this.tone(880, 0.1, gain, 'square', 1180); break;
      case 'zombie': this.tone(120, 0.55, gain, 'sawtooth', 90); break;
      case 'skeleton': this.noise(0.16, gain, 'bandpass', 1800, 4); break;
      case 'creeper': this.noise(0.5, gain, 'highpass', 2400, 0.8, 1200); break;
      case 'spider': this.noise(0.2, gain, 'bandpass', 2600, 2.5); break;
      case 'enderman': this.tone(70, 0.7, gain, 'sawtooth', 210); break;
      case 'wolf': this.tone(260, 0.26, gain, 'sawtooth', 180); break;
      case 'horse': this.tone(180, 0.4, gain, 'sawtooth', 260); break;
      case 'villager': this.tone(300, 0.2, gain, 'square', 240); break;
      default: this.tone(300, 0.14, gain * 0.6, 'triangle'); break;
    }
  };

  MC.Audio = Audio2;
})();
