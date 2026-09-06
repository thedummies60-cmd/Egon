import { B, IT, type Stack } from "./blocks";

export interface Recipe {
  label: string;
  out: Stack;
  shape?: string[];
  map?: Record<string, number>;
  shapeless?: number[];
}

export const RECIPES: Recipe[] = [
  { label: "Oak Planks ×4", out: { id: B.PLANKS, count: 4 }, shapeless: [B.LOG] },
  { label: "Sticks ×4", out: { id: IT.STICK, count: 4 }, shape: ["P", "P"], map: { P: B.PLANKS } },
  { label: "Crafting Table", out: { id: B.TABLE, count: 1 }, shape: ["PP", "PP"], map: { P: B.PLANKS } },
  { label: "Furnace", out: { id: B.FURNACE, count: 1 }, shape: ["CCC", "C.C", "CCC"], map: { C: B.COBBLE } },
  { label: "Glass ×4", out: { id: B.GLASS, count: 4 }, shapeless: [B.SAND, B.SAND, B.SAND, B.SAND] },
  { label: "Stone Bricks ×4", out: { id: B.STONEBRICK, count: 4 }, shape: ["CC", "CC"], map: { C: B.COBBLE } },
  { label: "Bookshelf", out: { id: B.BOOKSHELF, count: 1 }, shape: ["PPP", "PPP"], map: { P: B.PLANKS } },
  { label: "TNT", out: { id: B.TNT, count: 1 }, shape: ["GSG", "SGS", "GSG"], map: { G: IT.GUNPOWDER, S: B.SAND } },
  { label: "Wooden Pickaxe", out: { id: IT.WPICK, count: 1 }, shape: ["PPP", ".S.", ".S."], map: { P: B.PLANKS, S: IT.STICK } },
  { label: "Wooden Sword", out: { id: IT.WSWORD, count: 1 }, shape: ["P", "P", "S"], map: { P: B.PLANKS, S: IT.STICK } },
  { label: "Wooden Axe", out: { id: IT.WAXE, count: 1 }, shape: ["PP", "PS", ".S"], map: { P: B.PLANKS, S: IT.STICK } },
  { label: "Stone Pickaxe", out: { id: IT.SPICK, count: 1 }, shape: ["CCC", ".S.", ".S."], map: { C: B.COBBLE, S: IT.STICK } },
  { label: "Stone Sword", out: { id: IT.SSWORD, count: 1 }, shape: ["C", "C", "S"], map: { C: B.COBBLE, S: IT.STICK } },
  { label: "Stone Axe", out: { id: IT.SAXE, count: 1 }, shape: ["CC", "CS", ".S"], map: { C: B.COBBLE, S: IT.STICK } },
  { label: "Iron Pickaxe", out: { id: IT.IPICK, count: 1 }, shape: ["III", ".S.", ".S."], map: { I: IT.IRON, S: IT.STICK } },
  { label: "Iron Sword", out: { id: IT.ISWORD, count: 1 }, shape: ["I", "I", "S"], map: { I: IT.IRON, S: IT.STICK } },
  { label: "Iron Axe", out: { id: IT.IAXE, count: 1 }, shape: ["II", "IS", ".S"], map: { I: IT.IRON, S: IT.STICK } },
  { label: "Diamond Pickaxe", out: { id: IT.DPICK, count: 1 }, shape: ["DDD", ".S.", ".S."], map: { D: IT.DIAMOND, S: IT.STICK } },
  { label: "Diamond Sword", out: { id: IT.DSWORD, count: 1 }, shape: ["D", "D", "S"], map: { D: IT.DIAMOND, S: IT.STICK } },
  { label: "Diamond Axe", out: { id: IT.DAXE, count: 1 }, shape: ["DD", "DS", ".S"], map: { D: IT.DIAMOND, S: IT.STICK } },
];

export function matchCraft(grid: (Stack | null)[], size: number): Recipe | null {
  const ids: number[] = [];
  for (let i = 0; i < size * size; i++) ids.push(grid[i] ? grid[i]!.id : 0);

  for (const r of RECIPES) {
    if (!r.shapeless) continue;
    const a = ids.filter((x) => x !== 0).sort((x, y) => x - y);
    const b = [...r.shapeless].sort((x, y) => x - y);
    if (a.length === b.length && a.every((v, i) => v === b[i])) return r;
  }

  let minR = size, maxR = -1, minC = size, maxC = -1;
  for (let rI = 0; rI < size; rI++)
    for (let cI = 0; cI < size; cI++)
      if (ids[rI * size + cI] !== 0) {
        if (rI < minR) minR = rI;
        if (rI > maxR) maxR = rI;
        if (cI < minC) minC = cI;
        if (cI > maxC) maxC = cI;
      }
  if (maxC < 0) return null;
  const h = maxR - minR + 1;
  const w = maxC - minC + 1;

  for (const r of RECIPES) {
    if (!r.shape || !r.map) continue;
    if (r.shape.length !== h) continue;
    const pw = Math.max(...r.shape.map((s) => s.length));
    if (pw !== w) continue;
    let ok = true;
    for (let i = 0; i < h && ok; i++)
      for (let j = 0; j < w && ok; j++) {
        const ch = r.shape[i][j] ?? ".";
        const expect = ch === "." ? 0 : r.map[ch] ?? 0;
        if (ids[(minR + i) * size + (minC + j)] !== expect) ok = false;
      }
    if (ok) return r;
  }
  return null;
}
