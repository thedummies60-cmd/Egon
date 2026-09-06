// Tiny WebAudio synth for game feedback — no assets needed.
export class SFX {
  muted = false;
  private ctx: AudioContext | null = null;
  private noiseBuf: AudioBuffer | null = null;

  constructor() {
    try {
      this.muted = localStorage.getItem("mcw_muted") === "1";
    } catch {
      this.muted = false;
    }
  }

  toggleMuted(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem("mcw_muted", this.muted ? "1" : "0");
    } catch {
      /* ignore */
    }
    return this.muted;
  }

  private ensure(): AudioContext | null {
    if (this.muted) return null;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AC();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuf) return this.noiseBuf;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    return buf;
  }

  tone(freq: number, dur: number, type: OscillatorType = "square", vol = 0.12, slide = 0, delay = 0) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  noise(dur: number, vol = 0.18, freq = 900, delay = 0) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(freq, t0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  click() { this.tone(660, 0.06, "square", 0.06, -220); }
  hover() { this.tone(940, 0.035, "square", 0.025); }
  place() { this.tone(180, 0.09, "square", 0.1, -50); this.noise(0.06, 0.08, 620); }
  hurt() { this.tone(230, 0.22, "sawtooth", 0.11, -170); }
  pop() { this.tone(460, 0.09, "square", 0.07, 340); }
  eat() {
    this.noise(0.06, 0.14, 500, 0);
    this.noise(0.06, 0.14, 420, 0.14);
    this.noise(0.08, 0.14, 360, 0.28);
  }
  mobHit() { this.tone(150, 0.08, "square", 0.09, -70); this.noise(0.05, 0.07, 800); }
  fuse() { this.tone(1500, 0.4, "sawtooth", 0.035, -1100); }
  splash() { this.noise(0.25, 0.12, 700); }
  levelup() { this.tone(520, 0.12, "square", 0.08, 200); this.tone(780, 0.16, "square", 0.08, 200, 0.1); }

  breakBlock(kind: "stone" | "dirt" | "wood" | "sand" | "grass" | "glass" | "cloth") {
    switch (kind) {
      case "stone": this.noise(0.14, 0.2, 420); this.tone(120, 0.08, "square", 0.06, -40); break;
      case "wood": this.noise(0.1, 0.16, 700); this.tone(200, 0.07, "square", 0.06, -60); break;
      case "glass": this.tone(1300, 0.14, "triangle", 0.08, -900); this.noise(0.08, 0.06, 2400); break;
      case "cloth": this.noise(0.09, 0.1, 1100); break;
      case "sand": this.noise(0.12, 0.14, 900); break;
      case "grass": this.noise(0.11, 0.13, 1300); break;
      default: this.noise(0.12, 0.16, 520); this.tone(150, 0.07, "square", 0.05, -50);
    }
  }

  explosion() {
    this.noise(0.7, 0.4, 320);
    this.tone(70, 0.55, "sine", 0.28, -45);
    this.noise(0.3, 0.2, 900, 0.05);
  }
}
