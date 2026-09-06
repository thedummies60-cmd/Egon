// ---------- deterministic RNG & noise ----------

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x: number, y: number, seed: number): number {
  let h = seed >>> 0;
  h = Math.imul(h ^ Math.imul(x | 0, 374761393), 1274126177);
  h = Math.imul(h ^ Math.imul(y | 0, 668265263), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

export function vnoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  const u = smooth(xf);
  const v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, y: number, octaves: number, seed: number): number {
  let f = 0;
  let amp = 0.5;
  let tot = 0;
  for (let i = 0; i < octaves; i++) {
    f += amp * vnoise(x, y, seed + i * 131);
    tot += amp;
    x *= 2.02;
    y *= 2.02;
    amp *= 0.5;
  }
  return f / tot;
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------- world save metadata ----------

export type GameMode = "survival" | "creative";

export interface WorldMeta {
  name: string;
  seed: number;
  mode: GameMode;
  created: number;
  lastPlayed: number;
}

const WORLDS_KEY = "mcw_worlds_v1";

export function loadWorlds(): WorldMeta[] {
  try {
    const raw = localStorage.getItem(WORLDS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WorldMeta[];
  } catch {
    return [];
  }
}

export function saveWorlds(worlds: WorldMeta[]) {
  try {
    localStorage.setItem(WORLDS_KEY, JSON.stringify(worlds));
  } catch {
    /* storage full — ignore */
  }
}

export function saveKey(seed: number) {
  return "mcw_save_" + seed;
}
