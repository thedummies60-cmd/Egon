/* ============================================================
 * noise.js - seeded PRNG, Perlin noise, fBm, domain helpers
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});

  /* ---------------- deterministic PRNG (mulberry32) ---------------- */
  function RNG(seed) {
    this.s = (seed >>> 0) || 1;
  }
  RNG.prototype.next = function () {
    let t = (this.s += 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  RNG.prototype.int = function (n) { return (this.next() * n) | 0; };
  RNG.prototype.range = function (a, b) { return a + this.next() * (b - a); };
  RNG.prototype.intRange = function (a, b) { return a + ((this.next() * (b - a + 1)) | 0); };
  RNG.prototype.chance = function (p) { return this.next() < p; };
  RNG.prototype.pick = function (arr) { return arr[(this.next() * arr.length) | 0]; };
  RNG.prototype.shuffle = function (arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (this.next() * (i + 1)) | 0;
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  MC.RNG = RNG;

  // string -> 32 bit hash, so worlds can be seeded by name
  MC.hashSeed = function (str) {
    let h = 2166136261 >>> 0;
    str = String(str);
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  // Cheap deterministic hash of 3 integers -> [0,1)
  MC.hash3 = function (x, y, z, seed) {
    let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 1274126177) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  /* ---------------- Perlin noise (2D & 3D) ---------------- */
  function Perlin(seed) {
    const rng = new RNG(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    rng.shuffle(p);
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  const GRAD3 = new Float32Array([
    1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
    1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
    0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1
  ]);

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

  Perlin.prototype.noise2 = function (x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const p = this.perm, pm = this.permMod12;
    const aa = pm[p[X] + Y], ab = pm[p[X] + Y + 1];
    const ba = pm[p[X + 1] + Y], bb = pm[p[X + 1] + Y + 1];
    const g = GRAD3;
    const n00 = g[aa * 3] * xf + g[aa * 3 + 1] * yf;
    const n10 = g[ba * 3] * (xf - 1) + g[ba * 3 + 1] * yf;
    const n01 = g[ab * 3] * xf + g[ab * 3 + 1] * (yf - 1);
    const n11 = g[bb * 3] * (xf - 1) + g[bb * 3 + 1] * (yf - 1);
    const x1 = n00 + u * (n10 - n00);
    const x2 = n01 + u * (n11 - n01);
    return (x1 + v * (x2 - x1)) * 1.4142;
  };

  Perlin.prototype.noise3 = function (x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y), zf = z - Math.floor(z);
    const u = fade(xf), v = fade(yf), w = fade(zf);
    const p = this.perm, pm = this.permMod12, g = GRAD3;
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    function dot(gi, a, b, c) { return g[gi * 3] * a + g[gi * 3 + 1] * b + g[gi * 3 + 2] * c; }
    const n000 = dot(pm[AA], xf, yf, zf);
    const n100 = dot(pm[BA], xf - 1, yf, zf);
    const n010 = dot(pm[AB], xf, yf - 1, zf);
    const n110 = dot(pm[BB], xf - 1, yf - 1, zf);
    const n001 = dot(pm[AA + 1], xf, yf, zf - 1);
    const n101 = dot(pm[BA + 1], xf - 1, yf, zf - 1);
    const n011 = dot(pm[AB + 1], xf, yf - 1, zf - 1);
    const n111 = dot(pm[BB + 1], xf - 1, yf - 1, zf - 1);
    const x00 = n000 + u * (n100 - n000);
    const x10 = n010 + u * (n110 - n010);
    const x01 = n001 + u * (n101 - n001);
    const x11 = n011 + u * (n111 - n011);
    const y0 = x00 + v * (x10 - x00);
    const y1 = x01 + v * (x11 - x01);
    return (y0 + w * (y1 - y0)) * 1.1547;
  };

  // fractal brownian motion
  Perlin.prototype.fbm2 = function (x, y, octaves, lac, gain) {
    lac = lac === undefined ? 2 : lac;
    gain = gain === undefined ? 0.5 : gain;
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise2(x * freq, y * freq);
      norm += amp;
      amp *= gain; freq *= lac;
    }
    return sum / norm;
  };

  Perlin.prototype.fbm3 = function (x, y, z, octaves, lac, gain) {
    lac = lac === undefined ? 2 : lac;
    gain = gain === undefined ? 0.5 : gain;
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise3(x * freq, y * freq, z * freq);
      norm += amp;
      amp *= gain; freq *= lac;
    }
    return sum / norm;
  };

  // ridged noise - good for mountain ridges and cave tunnels
  Perlin.prototype.ridged2 = function (x, y, octaves) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * (1 - Math.abs(this.noise2(x * freq, y * freq)));
      norm += amp;
      amp *= 0.5; freq *= 2;
    }
    return sum / norm;
  };

  MC.Perlin = Perlin;
})();
