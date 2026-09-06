// Procedurally painted 16x16 pixel-art texture atlas + item icons.
import { B, BLOCKS, ICON_TILE, ITEMS, TILE_COLORS, isBlockId } from "./blocks";
import { mulberry32 } from "./util";

export const TILES_PER_ROW = 16;
const TILE = 16;

type Ctx = CanvasRenderingContext2D;
type Painter = (ctx: Ctx, rnd: () => number) => void;

const px = (ctx: Ctx, x: number, y: number, c: string) => {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, 1, 1);
};
const rect = (ctx: Ctx, x: number, y: number, w: number, h: number, c: string) => {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
};

function speckle(ctx: Ctx, rnd: () => number, base: string, cols: string[], n: number) {
  rect(ctx, 0, 0, 16, 16, base);
  for (let i = 0; i < n; i++) px(ctx, (rnd() * 16) | 0, (rnd() * 16) | 0, cols[(rnd() * cols.length) | 0]);
}

function blobs(ctx: Ctx, rnd: () => number, col: string, hi: string, n: number) {
  for (let i = 0; i < n; i++) {
    const x = 1 + ((rnd() * 12) | 0);
    const y = 1 + ((rnd() * 12) | 0);
    rect(ctx, x, y, 2, 2, col);
    if (rnd() < 0.6) px(ctx, x, y, hi);
  }
}

const stoneBase: Painter = (ctx, rnd) => {
  speckle(ctx, rnd, "#8f8f8f", ["#7c7c7c", "#a0a0a0", "#868686"], 46);
  for (let i = 0; i < 3; i++) rect(ctx, 1 + ((rnd() * 11) | 0), 1 + ((rnd() * 11) | 0), 2, 2, "#747474");
};

const planksBase: Painter = (ctx, rnd) => {
  speckle(ctx, rnd, "#b8945f", ["#ad8a56", "#c29e6a", "#a5824f"], 40);
  for (const y of [3, 7, 11, 15]) rect(ctx, 0, y, 16, 1, "#8a6a3c");
  const seams = [11, 3, 13, 7];
  for (let r = 0; r < 4; r++) rect(ctx, seams[r], r * 4, 1, 3, "#8a6a3c");
};

const cobbleBase: Painter = (ctx, rnd) => {
  rect(ctx, 0, 0, 16, 16, "#5c5c5c");
  for (let cy = 0; cy < 4; cy++)
    for (let cx = 0; cx < 4; cx++) {
      const g = 118 + ((rnd() * 36) | 0);
      rect(ctx, cx * 4, cy * 4, 4, 4, `rgb(${g},${g},${g})`);
      rect(ctx, cx * 4, cy * 4 + 3, 4, 1, "#4c4c4c");
      rect(ctx, cx * 4 + 3, cy * 4, 1, 4, "#565656");
      px(ctx, cx * 4, cy * 4, "#9a9a9a");
    }
};

const dirtBase: Painter = (ctx, rnd) =>
  speckle(ctx, rnd, "#96653f", ["#7d5334", "#a8764b", "#8a5c3a", "#6f4a2e"], 60);

const grassTop: Painter = (ctx, rnd) =>
  speckle(ctx, rnd, "#7cbd4f", ["#8fd05e", "#6bab42", "#79b74b", "#5d9e38"], 60);

const grassSide: Painter = (ctx, rnd) => {
  dirtBase(ctx, rnd);
  for (let x = 0; x < 16; x++) {
    const d = 2 + ((rnd() * 3) | 0);
    rect(ctx, x, 0, 1, d, rnd() < 0.5 ? "#6faf45" : "#7cbd4f");
    if (rnd() < 0.3) px(ctx, x, d, "#5d9e38");
  }
};

const snowSide: Painter = (ctx, rnd) => {
  dirtBase(ctx, rnd);
  for (let x = 0; x < 16; x++) {
    const d = 4 + ((rnd() * 3) | 0);
    rect(ctx, x, 0, 1, d, rnd() < 0.5 ? "#f4f8fb" : "#e6eef4");
  }
};

const oreTile = (col: string, hi: string): Painter => (ctx, rnd) => {
  stoneBase(ctx, rnd);
  blobs(ctx, rnd, col, hi, 6);
};

const PAINTERS: Record<number, Painter> = {
  0: grassTop,
  1: grassSide,
  2: dirtBase,
  3: stoneBase,
  4: cobbleBase,
  5: (ctx, rnd) => speckle(ctx, rnd, "#e7dca6", ["#d9cd92", "#f0e6b8", "#dfd298"], 50),
  6: (ctx, rnd) => {
    for (let x = 0; x < 16; x++) {
      const m = x % 4;
      const c = m === 0 ? "#55401f" : m === 3 ? "#7d603a" : "#6b5232";
      rect(ctx, x, 0, 1, 16, c);
    }
    for (let i = 0; i < 10; i++) px(ctx, (rnd() * 16) | 0, (rnd() * 16) | 0, "#4c3a1c");
  },
  7: (ctx, rnd) => {
    rect(ctx, 0, 0, 16, 16, "#6b5232");
    rect(ctx, 1, 1, 14, 14, "#a8894f");
    rect(ctx, 3, 3, 10, 10, "#8a6f3e");
    rect(ctx, 5, 5, 6, 6, "#b89a62");
    rect(ctx, 7, 7, 2, 2, "#6b5232");
    for (let i = 0; i < 6; i++) px(ctx, 2 + ((rnd() * 12) | 0), 2 + ((rnd() * 12) | 0), "#7d603a");
  },
  8: (ctx, rnd) => speckle(ctx, rnd, "#3e7a24", ["#2f6218", "#4c9130", "#285513", "#57a03a"], 80),
  9: planksBase,
  10: (ctx, rnd) => {
    ctx.clearRect(0, 0, 16, 16);
    rect(ctx, 0, 0, 16, 1, "#d6eef8"); rect(ctx, 0, 15, 16, 1, "#d6eef8");
    rect(ctx, 0, 0, 1, 16, "#d6eef8"); rect(ctx, 15, 0, 1, 16, "#d6eef8");
    px(ctx, 1, 1, "#ffffff"); px(ctx, 14, 1, "#ffffff");
    for (let i = 0; i < 5; i++) px(ctx, 3 + ((rnd() * 10) | 0), 3 + ((rnd() * 10) | 0), "rgba(255,255,255,0.65)");
    rect(ctx, 2, 2, 1, 4, "rgba(230,245,252,0.8)");
  },
  11: (ctx, rnd) => speckle(ctx, rnd, "#3b66c4", ["#4a78d4", "#2f55b0", "#4571cc"], 40),
  12: snowSide,
  13: (ctx, rnd) => speckle(ctx, rnd, "#f4f8fb", ["#e2ecf2", "#ffffff", "#dce8ef"], 40),
  14: (ctx, rnd) => {
    for (let x = 0; x < 16; x++) {
      const m = x % 4;
      rect(ctx, x, 0, 1, 16, m === 0 ? "#3c7726" : m === 2 ? "#57a438" : "#4a8f2f");
    }
    for (let i = 0; i < 8; i++) px(ctx, (rnd() * 16) | 0, (rnd() * 16) | 0, "#e8f5d8");
  },
  15: (ctx, rnd) => {
    rect(ctx, 0, 0, 16, 16, "#3c7726");
    rect(ctx, 1, 1, 14, 14, "#5ca63c");
    rect(ctx, 6, 6, 4, 4, "#4a8f2f");
  },
  16: (ctx, rnd) => {
    speckle(ctx, rnd, "#575757", ["#3d3d3d", "#6e6e6e", "#2f2f2f"], 40);
    for (let i = 0; i < 12; i++) rect(ctx, (rnd() * 14) | 0, (rnd() * 14) | 0, 2, 2, rnd() < 0.5 ? "#383838" : "#757575");
  },
  17: oreTile("#2b2b2b", "#454545"),
  18: oreTile("#d8af93", "#e8c8b0"),
  19: oreTile("#e8d44a", "#f8ee8a"),
  20: oreTile("#4aedd9", "#9ff5e8"),
  21: (ctx, rnd) => {
    speckle(ctx, rnd, "#8a7f76", ["#776d64", "#9c928a"], 30);
    for (let i = 0; i < 14; i++) rect(ctx, (rnd() * 14) | 0, (rnd() * 14) | 0, 2, 2, ["#9c928a", "#776d64", "#a59b92"][(rnd() * 3) | 0]);
  },
  22: (ctx, rnd) => {
    planksBase(ctx, rnd);
    rect(ctx, 0, 0, 16, 1, "#8a6a3c"); rect(ctx, 0, 15, 16, 1, "#8a6a3c");
    rect(ctx, 0, 0, 1, 16, "#8a6a3c"); rect(ctx, 15, 0, 1, 16, "#8a6a3c");
    rect(ctx, 5, 1, 1, 14, "#7c5c34"); rect(ctx, 10, 1, 1, 14, "#7c5c34");
    rect(ctx, 1, 5, 14, 1, "#7c5c34"); rect(ctx, 1, 10, 14, 1, "#7c5c34");
  },
  23: (ctx, rnd) => {
    planksBase(ctx, rnd);
    rect(ctx, 2, 2, 12, 12, "#7c5c34");
    rect(ctx, 3, 3, 10, 10, "#a5824f");
    rect(ctx, 7, 3, 1, 10, "#7c5c34"); rect(ctx, 3, 7, 10, 1, "#7c5c34");
  },
  24: (ctx, rnd) => {
    speckle(ctx, rnd, "#777777", ["#6a6a6a", "#868686"], 40);
    for (let i = 0; i < 4; i++) rect(ctx, (rnd() * 12) | 0, (rnd() * 12) | 0, 3, 2, "#606060");
  },
  25: (ctx, rnd) => {
    speckle(ctx, rnd, "#777777", ["#6a6a6a", "#868686"], 36);
    rect(ctx, 4, 6, 8, 8, "#2e2e2e");
    rect(ctx, 5, 7, 6, 6, "#3a3a3a");
    rect(ctx, 5, 11, 6, 2, "#f0a03a");
    px(ctx, 6, 10, "#e08830"); px(ctx, 9, 10, "#e08830");
  },
  26: (ctx, rnd) => {
    speckle(ctx, rnd, "#9a9a9a", ["#8f8f8f", "#a6a6a6"], 36);
    for (const y of [3, 7, 11, 15]) rect(ctx, 0, y, 16, 1, "#6d6d6d");
    const seams = [8, 2, 10, 5];
    for (let r = 0; r < 4; r++) rect(ctx, seams[r], r * 4, 1, 3, "#6d6d6d");
  },
  27: (ctx, rnd) => {
    planksBase(ctx, rnd);
    rect(ctx, 0, 2, 16, 11, "#5c4326");
    const bookCols = ["#a33c3c", "#3c7a3c", "#c9a24a", "#4a5f8a", "#8a5f3c", "#7a4a8a"];
    let x = 0;
    while (x < 16) {
      const w = 2 + ((rnd() * 2) | 0);
      rect(ctx, x, 3, Math.min(w, 16 - x), 9, bookCols[(rnd() * bookCols.length) | 0]);
      rect(ctx, x, 3, Math.min(w, 16 - x), 1, "rgba(255,255,255,0.25)");
      x += w + 1;
    }
  },
  28: (ctx, rnd) => {
    speckle(ctx, rnd, "#e6e6e6", ["#d8d8d8", "#f2f2f2", "#dedede"], 50);
    for (let i = 0; i < 8; i++) rect(ctx, ((rnd() * 13) | 0) + 1, ((rnd() * 13) | 0) + 1, 2, 2, "#dcdcdc");
  },
  29: (ctx) => {
    ctx.clearRect(0, 0, 16, 16);
    rect(ctx, 7, 8, 1, 6, "#3c7a24");
    px(ctx, 6, 10, "#4f9630"); px(ctx, 8, 12, "#4f9630");
    rect(ctx, 6, 4, 3, 3, "#d43c3c"); px(ctx, 7, 3, "#d43c3c");
    px(ctx, 7, 5, "#8a2020"); px(ctx, 6, 4, "#f07070");
  },
  30: (ctx) => {
    ctx.clearRect(0, 0, 16, 16);
    rect(ctx, 7, 8, 1, 6, "#3c7a24");
    px(ctx, 8, 11, "#4f9630");
    rect(ctx, 6, 4, 3, 3, "#e8d24a"); px(ctx, 7, 3, "#e8d24a");
    px(ctx, 7, 5, "#b8a22e");
  },
  31: (ctx, rnd) => {
    ctx.clearRect(0, 0, 16, 16);
    for (const bx of [2, 5, 8, 11, 13]) {
      const h = 6 + ((rnd() * 7) | 0);
      for (let y = 15; y > 15 - h; y--) px(ctx, bx + (rnd() < 0.25 ? 1 : 0), y, rnd() < 0.5 ? "#6da84a" : "#4f8a34");
    }
  },
  32: (ctx, rnd) => {
    for (let x = 0; x < 16; x++) {
      const m = x % 4;
      rect(ctx, x, 0, 1, 16, m === 3 ? "#a3570f" : m < 2 ? "#d0741c" : "#c46a15");
    }
    for (let i = 0; i < 6; i++) px(ctx, (rnd() * 16) | 0, (rnd() * 16) | 0, "#e08a2e");
  },
  33: (ctx) => {
    rect(ctx, 0, 0, 16, 16, "#b85f10");
    rect(ctx, 1, 1, 14, 14, "#d0741c");
    rect(ctx, 3, 3, 10, 10, "#c46a15");
    rect(ctx, 6, 6, 4, 4, "#b85f10");
    rect(ctx, 7, 6, 2, 3, "#6b4a1f");
  },
  34: (ctx, rnd) => {
    speckle(ctx, rnd, "#c8402c", ["#b03624", "#d44c36"], 30);
    rect(ctx, 0, 6, 16, 4, "#e8e4dc");
    const dark = "#2a2a2a";
    // T N T
    rect(ctx, 1, 7, 3, 1, dark); rect(ctx, 2, 7, 1, 3, dark);
    rect(ctx, 5, 7, 1, 3, dark); rect(ctx, 7, 7, 1, 3, dark); px(ctx, 6, 8, dark);
    rect(ctx, 9, 7, 3, 1, dark); rect(ctx, 10, 7, 1, 3, dark);
    rect(ctx, 13, 7, 2, 1, dark); rect(ctx, 13, 7, 1, 3, dark);
  },
  35: (ctx, rnd) => {
    speckle(ctx, rnd, "#b83a28", ["#a33020", "#c84634"], 26);
    rect(ctx, 6, 6, 4, 4, "#d8c8a0");
    px(ctx, 7, 7, "#3a3a3a"); px(ctx, 8, 8, "#3a3a3a");
  },
};

let atlasCanvas: HTMLCanvasElement | null = null;

export function getAtlasCanvas(): HTMLCanvasElement {
  if (atlasCanvas) return atlasCanvas;
  const c = document.createElement("canvas");
  c.width = TILES_PER_ROW * TILE;
  c.height = TILES_PER_ROW * TILE;
  const ctx = c.getContext("2d")!;
  for (const key of Object.keys(PAINTERS)) {
    const t = Number(key);
    const tx = t % TILES_PER_ROW;
    const ty = Math.floor(t / TILES_PER_ROW);
    ctx.save();
    ctx.translate(tx * TILE, ty * TILE);
    ctx.beginPath();
    ctx.rect(0, 0, TILE, TILE);
    ctx.clip();
    PAINTERS[t](ctx, mulberry32(t * 7919 + 17));
    ctx.restore();
  }
  atlasCanvas = c;
  return c;
}

export function uvRect(tile: number, pad = 0.02): [number, number, number, number] {
  const tx = tile % TILES_PER_ROW;
  const ty = Math.floor(tile / TILES_PER_ROW);
  const s = 1 / TILES_PER_ROW;
  return [tx * s + pad * s, 1 - (ty + 1) * s + pad * s, (tx + 1) * s - pad * s, 1 - ty * s - pad * s];
}

// ---------------- item icons ----------------

const IP: Record<string, Painter> = {
  stick: (ctx) => {
    for (let i = 0; i < 10; i++) {
      px(ctx, 3 + i, 13 - i, "#8a6a3c");
      px(ctx, 4 + i, 13 - i, "#6b5232");
      px(ctx, 3 + i, 12 - i, "#6b5232");
    }
    px(ctx, 13, 3, "#a8894f");
  },
  coal: (ctx) => {
    rect(ctx, 6, 4, 4, 1, "#2e2e2e"); rect(ctx, 5, 5, 6, 1, "#2e2e2e");
    rect(ctx, 4, 6, 8, 4, "#2e2e2e"); rect(ctx, 5, 10, 6, 1, "#2e2e2e");
    px(ctx, 6, 6, "#5a5a5a"); px(ctx, 8, 7, "#4a4a4a"); px(ctx, 5, 8, "#1e1e1e");
  },
  ingot: (ctx) => ingotPaint(ctx, "#d8d8d8", "#a0a0a0", "#f0f0f0"),
  ingot_iron: (ctx) => ingotPaint(ctx, "#dcdcdc", "#9c9c9c", "#f4f4f4"),
  ingot_gold: (ctx) => ingotPaint(ctx, "#e8d44a", "#b09a2e", "#f8ee8a"),
  diamond: (ctx) => {
    const rows = [
      [6, 9], [5, 10], [4, 11], [5, 10], [6, 9], [7, 8],
    ];
    rows.forEach((r, i) => rect(ctx, r[0], 4 + i, r[1] - r[0] + 1, 1, "#4aedd9"));
    rect(ctx, 4, 6, 8, 1, "#2aa89a");
    px(ctx, 6, 4, "#b0fff2"); px(ctx, 9, 5, "#9ff5e8"); px(ctx, 7, 8, "#2aa89a");
  },
  apple: (ctx) => {
    rect(ctx, 6, 4, 4, 1, "#d43c3c"); rect(ctx, 5, 5, 6, 1, "#d43c3c");
    rect(ctx, 4, 6, 8, 4, "#d43c3c"); rect(ctx, 5, 10, 6, 1, "#d43c3c");
    rect(ctx, 6, 11, 4, 1, "#a32828");
    px(ctx, 5, 6, "#f07070"); px(ctx, 6, 5, "#f07070");
    rect(ctx, 7, 2, 1, 2, "#6b4a1f"); px(ctx, 8, 2, "#4f9630"); px(ctx, 9, 2, "#4f9630");
  },
  pork: (ctx) => meatPaint(ctx, "#f0a0a0", "#c07878", "#f8d8d0"),
  beef: (ctx) => meatPaint(ctx, "#b85450", "#8a3a38", "#d47a72"),
  chicken: (ctx) => {
    meatPaint(ctx, "#f0c8b8", "#c09888", "#f8e4dc");
    rect(ctx, 10, 10, 2, 2, "#f4f4f4"); rect(ctx, 12, 12, 2, 2, "#f4f4f4");
  },
  gunpowder: (ctx, rnd) => {
    rect(ctx, 4, 11, 8, 2, "#6e6e6e"); rect(ctx, 5, 9, 6, 2, "#7e7e7e"); rect(ctx, 6, 7, 4, 2, "#6e6e6e");
    for (let i = 0; i < 8; i++) px(ctx, 4 + ((rnd() * 8) | 0), 7 + ((rnd() * 6) | 0), "#9a9a9a");
  },
};

function ingotPaint(ctx: Ctx, c1: string, c2: string, c3: string) {
  rect(ctx, 3, 9, 10, 4, c2);
  rect(ctx, 3, 8, 10, 2, c1);
  rect(ctx, 4, 6, 8, 2, c3);
  px(ctx, 4, 8, c3); px(ctx, 12, 12, "#00000033");
}

function meatPaint(ctx: Ctx, c1: string, c2: string, c3: string) {
  rect(ctx, 5, 4, 6, 2, c1); rect(ctx, 4, 6, 8, 4, c1); rect(ctx, 5, 10, 6, 2, c1);
  rect(ctx, 4, 6, 1, 4, c2); rect(ctx, 5, 11, 6, 1, c2);
  px(ctx, 6, 5, c3); px(ctx, 7, 7, c3); px(ctx, 9, 6, c2);
}

function toolPaint(ctx: Ctx, kind: "sword" | "pickaxe" | "axe", mat: string, dark: string) {
  if (kind === "sword") {
    for (let i = 0; i < 9; i++) {
      px(ctx, 4 + i, 11 - i, dark);
      px(ctx, 5 + i, 11 - i, mat);
      px(ctx, 5 + i, 10 - i, dark);
    }
    px(ctx, 13, 2, mat);
    px(ctx, 3, 10, "#8a6a3c"); px(ctx, 5, 12, "#8a6a3c");
    px(ctx, 2, 12, "#6b5232"); px(ctx, 3, 13, "#6b5232"); px(ctx, 2, 13, "#4c3a1c");
  } else if (kind === "pickaxe") {
    rect(ctx, 2, 2, 12, 2, mat);
    rect(ctx, 2, 4, 2, 2, mat); rect(ctx, 12, 4, 2, 2, mat);
    rect(ctx, 2, 2, 12, 1, dark);
    rect(ctx, 7, 4, 2, 10, "#8a6a3c"); px(ctx, 8, 13, "#6b5232");
  } else {
    rect(ctx, 7, 4, 2, 10, "#8a6a3c"); px(ctx, 8, 13, "#6b5232");
    rect(ctx, 8, 2, 5, 3, mat); rect(ctx, 10, 5, 3, 2, mat);
    rect(ctx, 8, 2, 5, 1, dark); px(ctx, 6, 2, mat); px(ctx, 5, 3, mat);
  }
}

const MAT_COLORS: Record<string, [string, string]> = {
  wood: ["#b8945f", "#8f6f3e"],
  stone: ["#a6a6a6", "#757575"],
  iron: ["#e0e0e0", "#a8a8a8"],
  diamond: ["#4aedd9", "#2aa89a"],
};

for (const m of Object.keys(MAT_COLORS)) {
  const [a, b] = MAT_COLORS[m];
  IP["sword_" + m] = (ctx) => toolPaint(ctx, "sword", a, b);
  IP["pick_" + m] = (ctx) => toolPaint(ctx, "pickaxe", a, b);
  IP["axe_" + m] = (ctx) => toolPaint(ctx, "axe", a, b);
}

const iconCache = new Map<number, string>();

export function getIcon(id: number): string {
  const hit = iconCache.get(id);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext("2d")!;
  if (isBlockId(id)) {
    const def = BLOCKS[id];
    const tile = ICON_TILE[id] ?? def.tile[1];
    const tx = tile % TILES_PER_ROW;
    const ty = Math.floor(tile / TILES_PER_ROW);
    ctx.drawImage(getAtlasCanvas(), tx * 16, ty * 16, 16, 16, 0, 0, 16, 16);
  } else {
    const icon = ITEMS[id]?.icon ?? "coal";
    const painter = IP[icon] ?? IP.coal;
    painter(ctx, mulberry32(id * 31 + 7));
  }
  const url = c.toDataURL();
  iconCache.set(id, url);
  return url;
}

export function blockParticleColor(blockId: number): string {
  const def = BLOCKS[blockId];
  if (!def) return "#888888";
  const tile = ICON_TILE[blockId] ?? def.tile[1];
  return TILE_COLORS[tile] ?? "#888888";
}

// keep tree-shaking honest for the B import used in docs/examples
export const ATLAS_BLOCK_COUNT = Object.keys(B).length;
