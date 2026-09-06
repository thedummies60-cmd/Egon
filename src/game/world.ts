import { B, BLOCKS } from "./blocks";
import { fbm, hash2, mulberry32 } from "./util";

export const CHUNK = 16;
export const HEIGHT = 64;
export const SEA = 22;

export type Biome = "plains" | "forest" | "desert" | "snowy" | "mountain" | "beach" | "ocean";

const GRASS_TINT: Record<Biome, [number, number, number]> = {
  plains: [0.64, 0.8, 0.44],
  forest: [0.48, 0.7, 0.34],
  desert: [0.72, 0.8, 0.45],
  snowy: [0.62, 0.82, 0.56],
  mountain: [0.56, 0.72, 0.5],
  beach: [0.68, 0.8, 0.46],
  ocean: [0.5, 0.7, 0.45],
};

const BIOME_LIST: Biome[] = ["plains", "forest", "desert", "snowy", "mountain", "beach", "ocean"];

export class World {
  seed: number;
  chunks = new Map<string, Uint8Array>();
  edits = new Map<string, number>(); // "x,y,z" -> id (player modifications)

  constructor(seed: number) {
    this.seed = seed;
  }

  static key(cx: number, cz: number) {
    return cx + "," + cz;
  }

  // ---------- deterministic terrain math ----------

  groundHeight(wx: number, wz: number): number {
    const cont = fbm(wx * 0.0035, wz * 0.0035, 4, this.seed);
    const m = fbm(wx * 0.009 + 40, wz * 0.009, 5, this.seed + 7);
    const detail = fbm(wx * 0.06, wz * 0.06, 3, this.seed + 13);
    let h = 15 + cont * 13 + (detail - 0.5) * 6;
    const mm = Math.max(0, m - 0.6);
    h += mm * mm * 210;
    return Math.max(4, Math.min(HEIGHT - 10, Math.round(h)));
  }

  biomeAt(wx: number, wz: number): Biome {
    const h = this.groundHeight(wx, wz);
    if (h < SEA - 1) return "ocean";
    if (h <= SEA + 1) return "beach";
    const t = fbm(wx * 0.0022, wz * 0.0022, 3, this.seed + 21);
    if (h >= 44) return t < 0.48 ? "snowy" : "mountain";
    const moist = fbm(wx * 0.0027 + 99, wz * 0.0027, 3, this.seed + 29);
    if (t > 0.6 && moist < 0.45) return "desert";
    if (t < 0.33) return "snowy";
    if (moist > 0.57) return "forest";
    return "plains";
  }

  biomeIndex(b: Biome) {
    return BIOME_LIST.indexOf(b);
  }

  tintAt(wx: number, wz: number): [number, number, number] {
    return GRASS_TINT[this.biomeAt(wx, wz)];
  }

  private surfaceFor(bio: Biome, h: number, r: number): number {
    if (h < SEA) return B.SAND;
    if (bio === "beach" || bio === "desert") return B.SAND;
    if (bio === "snowy") return B.SNOWGRASS;
    if (bio === "mountain") {
      if (h >= 50) return B.SNOW;
      return r < 0.14 ? B.GRAVEL : B.STONE;
    }
    return B.GRASS;
  }

  // ---------- storage ----------

  getBlock(x: number, y: number, z: number): number {
    if (y < 0) return B.BEDROCK;
    if (y >= HEIGHT) return B.AIR;
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const c = this.chunks.get(World.key(cx, cz));
    if (!c) return B.AIR;
    const lx = x - cx * CHUNK;
    const lz = z - cz * CHUNK;
    return c[lx + lz * CHUNK + y * CHUNK * CHUNK];
  }

  isSolidAt(x: number, y: number, z: number, missingIsSolid = false): boolean {
    if (y < 0) return true;
    if (y >= HEIGHT) return false;
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const c = this.chunks.get(World.key(cx, cz));
    if (!c) return missingIsSolid;
    const id = c[x - cx * CHUNK + (z - cz * CHUNK) * CHUNK + y * CHUNK * CHUNK];
    return id !== B.AIR && BLOCKS[id]?.solid === true;
  }

  setBlock(x: number, y: number, z: number, id: number): boolean {
    if (y < 1 || y >= HEIGHT) return false;
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const c = this.chunks.get(World.key(cx, cz));
    if (!c) return false;
    const lx = x - cx * CHUNK;
    const lz = z - cz * CHUNK;
    c[lx + lz * CHUNK + y * CHUNK * CHUNK] = id;
    this.edits.set(x + "," + y + "," + z, id);
    if (this.edits.size > 60000) {
      // prune oldest (map keeps insertion order)
      const first = this.edits.keys().next().value;
      if (first !== undefined) this.edits.delete(first);
    }
    return true;
  }

  heightAt(x: number, z: number): number {
    for (let y = HEIGHT - 1; y >= 0; y--) {
      const id = this.getBlock(x, y, z);
      if (id !== B.AIR && id !== B.WATER && BLOCKS[id]?.solid) return y + 1;
    }
    return SEA + 1;
  }

  // ---------- generation ----------

  generate(cx: number, cz: number) {
    const key = World.key(cx, cz);
    if (this.chunks.has(key)) return;
    const data = new Uint8Array(CHUNK * CHUNK * HEIGHT);
    const seed = this.seed;

    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const wx = cx * CHUNK + lx;
        const wz = cz * CHUNK + lz;
        const h = this.groundHeight(wx, wz);
        const bio = this.biomeAt(wx, wz);
        const surf = this.surfaceFor(bio, h, hash2(wx, wz, seed + 3));
        const sub = bio === "desert" || bio === "beach" || surf === B.SAND ? B.SAND : B.DIRT;

        for (let y = 0; y <= h; y++) {
          let id: number;
          if (y === 0) id = B.BEDROCK;
          else if (y === 1 && hash2(wx + y, wz, seed + 5) < 0.5) id = B.BEDROCK;
          else if (y === h) id = surf;
          else if (y >= h - 3) id = sub;
          else id = B.STONE;
          data[lx + lz * CHUNK + y * CHUNK * CHUNK] = id;
        }
        if (h < SEA) {
          for (let y = h + 1; y <= SEA; y++) data[lx + lz * CHUNK + y * CHUNK * CHUNK] = B.WATER;
        }
      }
    }

    // ore veins
    const rnd = mulberry32((seed ^ Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663)) >>> 0);
    const vein = (ore: number, tries: number, minY: number, maxY: number, len: number) => {
      for (let t = 0; t < tries; t++) {
        let x = cx * CHUNK + ((rnd() * CHUNK) | 0);
        let y = minY + ((rnd() * (maxY - minY)) | 0);
        let z = cz * CHUNK + ((rnd() * CHUNK) | 0);
        for (let s = 0; s < len; s++) {
          const lx = x - cx * CHUNK;
          const lz = z - cz * CHUNK;
          if (lx >= 0 && lx < CHUNK && lz >= 0 && lz < CHUNK && y > 1 && y < HEIGHT) {
            const i = lx + lz * CHUNK + y * CHUNK * CHUNK;
            if (data[i] === B.STONE) data[i] = ore;
          } else break;
          x += ((rnd() * 3) | 0) - 1;
          y += ((rnd() * 3) | 0) - 1;
          z += ((rnd() * 3) | 0) - 1;
        }
      }
    };
    vein(B.COAL_ORE, 8, 4, 46, 6);
    vein(B.IRON_ORE, 6, 3, 34, 5);
    vein(B.GOLD_ORE, 2, 3, 18, 4);
    if (rnd() < 0.8) vein(B.DIAMOND_ORE, 1, 2, 13, 4);
    vein(B.GRAVEL, 2, 4, 42, 8);

    const place = (wx: number, y: number, wz: number, id: number, onlyAir: boolean) => {
      const lx = wx - cx * CHUNK;
      const lz = wz - cz * CHUNK;
      if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || y < 1 || y >= HEIGHT) return;
      const i = lx + lz * CHUNK + y * CHUNK * CHUNK;
      if (!onlyAir || data[i] === B.AIR) data[i] = id;
    };

    // trees & cacti (region expanded so canopies crossing borders stay deterministic)
    for (let wz2 = cz * CHUNK - 3; wz2 < cz * CHUNK + CHUNK + 3; wz2++) {
      for (let wx2 = cx * CHUNK - 3; wx2 < cx * CHUNK + CHUNK + 3; wx2++) {
        const bio = this.biomeAt(wx2, wz2);
        const h = this.groundHeight(wx2, wz2);
        const surf = this.surfaceFor(bio, h, hash2(wx2, wz2, seed + 3));

        if (bio === "desert") {
          if (hash2(wx2, wz2, seed + 79) < 0.006 && surf === B.SAND && h >= SEA) {
            const ch = 2 + ((hash2(wx2, wz2, seed + 80) * 2) | 0);
            for (let y = h + 1; y <= h + ch; y++) place(wx2, y, wz2, B.CACTUS, true);
          }
          continue;
        }

        let p = 0;
        if (bio === "forest") p = 0.021;
        else if (bio === "plains") p = 0.004;
        else if (bio === "snowy") p = 0.011;
        if (p === 0 || hash2(wx2, wz2, seed + 77) >= p) continue;
        if (surf !== B.GRASS && surf !== B.SNOWGRASS) continue;

        const trunk = 4 + ((hash2(wx2, wz2, seed + 78) * 3) | 0);
        const top = h + trunk;
        for (let ly = top - 2; ly <= top + 1; ly++) {
          const r = ly > top - 1 ? 1 : 2;
          for (let dx = -r; dx <= r; dx++)
            for (let dz = -r; dz <= r; dz++) {
              if (Math.abs(dx) === r && Math.abs(dz) === r && hash2(wx2 + dx + ly, wz2 + dz, seed + 81) < 0.5) continue;
              place(wx2 + dx, ly, wz2 + dz, B.LEAVES, true);
            }
        }
        for (let y = h + 1; y <= top; y++) place(wx2, y, wz2, B.LOG, true);
      }
    }

    // flowers, tall grass, pumpkins (own columns only)
    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const wx = cx * CHUNK + lx;
        const wz = cz * CHUNK + lz;
        const h = this.groundHeight(wx, wz);
        const surf = data[lx + lz * CHUNK + h * CHUNK * CHUNK];
        const i1 = lx + lz * CHUNK + (h + 1) * CHUNK * CHUNK;
        if (h + 1 >= HEIGHT) continue;
        if (surf === B.GRASS) {
          const r = hash2(wx, wz, seed + 91);
          const bio = this.biomeAt(wx, wz);
          if (r < 0.05) data[i1] = B.TALLGRASS;
          else if (r < 0.056) data[i1] = B.ROSE;
          else if (r < 0.062) data[i1] = B.DANDELION;
          if (hash2(wx, wz, seed + 92) < 0.0008 && (bio === "plains" || bio === "forest")) data[i1] = B.PUMPKIN;
        }
      }
    }

    // apply player edits
    for (const [k, id] of this.edits) {
      const parts = k.split(",");
      const x = Number(parts[0]);
      const y = Number(parts[1]);
      const z = Number(parts[2]);
      if (Math.floor(x / CHUNK) === cx && Math.floor(z / CHUNK) === cz && y >= 0 && y < HEIGHT) {
        data[x - cx * CHUNK + (z - cz * CHUNK) * CHUNK + y * CHUNK * CHUNK] = id;
      }
    }

    this.chunks.set(key, data);
  }
}
