import * as THREE from "three";
import { B, BLOCKS } from "./blocks";
import { CHUNK, HEIGHT, SEA, World } from "./world";
import { uvRect } from "./textures";

interface FaceDef {
  dir: [number, number, number];
  corners: [number, number, number][];
  shade: number;
}

const FACES: FaceDef[] = [
  { dir: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.62 },
  { dir: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.62 },
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0 },
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.5 },
  { dir: [0, 0, 1], corners: [[1, 0, 1], [0, 0, 1], [0, 1, 1], [1, 1, 1]], shade: 0.8 },
  { dir: [0, 0, -1], corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], shade: 0.8 },
];

const QUAD_IDX = [0, 1, 2, 0, 2, 3];

interface Buf {
  pos: number[];
  nor: number[];
  uv: number[];
  col: number[];
  idx: number[];
}

const newBuf = (): Buf => ({ pos: [], nor: [], uv: [], col: [], idx: [] });

function faceVisible(id: number, nId: number): boolean {
  if (nId === id) return false;
  if (nId === B.AIR) return true;
  const nd = BLOCKS[nId];
  if (!nd) return true;
  if (id === B.WATER) return false;
  if (nd.cross) return true;
  if (nd.transparent) return true;
  return false;
}

function pushQuad(buf: Buf, x: number, y: number, z: number, face: FaceDef, tile: number, r: number, g: number, b: number) {
  const [u0, v0, u1, v1] = uvRect(tile);
  const base = buf.pos.length / 3;
  const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  for (let i = 0; i < 4; i++) {
    const c = face.corners[i];
    buf.pos.push(x + c[0], y + c[1], z + c[2]);
    buf.nor.push(face.dir[0], face.dir[1], face.dir[2]);
    buf.uv.push(uvs[i][0], uvs[i][1]);
    buf.col.push(r, g, b);
  }
  for (const i of QUAD_IDX) buf.idx.push(base + i);
}

export function buildChunkMeshes(world: World, cx: number, cz: number): { solid: THREE.BufferGeometry | null; water: THREE.BufferGeometry | null } {
  const solid = newBuf();
  const water = newBuf();
  const data = world.chunks.get(World.key(cx, cz));
  if (!data) return { solid: null, water: null };

  const tintCache = new Map<number, [number, number, number]>();
  const tintFor = (lx: number, lz: number): [number, number, number] => {
    const k = lx + lz * 16;
    let t = tintCache.get(k);
    if (!t) {
      t = world.tintAt(cx * CHUNK + lx, cz * CHUNK + lz);
      tintCache.set(k, t);
    }
    return t;
  };

  for (let y = 0; y < HEIGHT; y++) {
    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const id = data[lx + lz * CHUNK + y * CHUNK * CHUNK];
        if (id === B.AIR) continue;
        const def = BLOCKS[id];
        if (!def) continue;
        const wx = cx * CHUNK + lx;
        const wz = cz * CHUNK + lz;

        if (def.cross) {
          const [tr, tg, tb] = id === B.TALLGRASS ? tintFor(lx, lz) : [1, 1, 1];
          const [u0, v0, u1, v1] = uvRect(def.tile[1], 0);
          for (const quad of [
            [[0.15, 0, 0.15], [0.85, 0, 0.85], [0.85, 1, 0.85], [0.15, 1, 0.15]],
            [[0.85, 0, 0.15], [0.15, 0, 0.85], [0.15, 1, 0.85], [0.85, 1, 0.15]],
          ]) {
            const base = solid.pos.length / 3;
            const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
            for (let i = 0; i < 4; i++) {
              solid.pos.push(wx + quad[i][0], y + quad[i][1], wz + quad[i][2]);
              solid.nor.push(0, 1, 0);
              solid.uv.push(uvs[i][0], uvs[i][1]);
              solid.col.push(tr, tg, tb);
            }
            for (const i of QUAD_IDX) solid.idx.push(base + i);
            for (const i of QUAD_IDX) solid.idx.push(base + i); // double-side via both windings
          }
          continue;
        }

        const tinted = id === B.GRASS || id === B.LEAVES;
        const [tr, tg, tb] = tinted ? tintFor(lx, lz) : [1, 1, 1];
        const target = id === B.WATER ? water : solid;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nId = world.getBlock(wx + face.dir[0], y + face.dir[1], wz + face.dir[2]);
          if (!faceVisible(id, nId)) continue;
          const tile = f === 2 ? def.tile[0] : f === 3 ? def.tile[2] : def.tile[1];
          const s = face.shade;
          let fr = tr * s, fg = tg * s, fb = tb * s;
          if (id === B.WATER) { fr = s; fg = s; fb = s; }
          // lower water surface slightly
          const dy = id === B.WATER && f === 2 ? -0.12 : 0;
          const base = target.pos.length / 3;
          const [u0, v0, u1, v1] = uvRect(tile);
          const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
          for (let i = 0; i < 4; i++) {
            const c = face.corners[i];
            target.pos.push(wx + c[0], y + c[1] + (c[1] === 1 ? dy : 0), wz + c[2]);
            target.nor.push(face.dir[0], face.dir[1], face.dir[2]);
            target.uv.push(uvs[i][0], uvs[i][1]);
            target.col.push(fr, fg, fb);
          }
          for (const i of QUAD_IDX) target.idx.push(base + i);
        }
      }
    }
  }

  const build = (buf: Buf): THREE.BufferGeometry | null => {
    if (buf.idx.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(buf.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(buf.nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(buf.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(buf.col, 3));
    g.setIndex(buf.idx);
    return g;
  };

  return { solid: build(solid), water: build(water) };
}

// re-export SEA so engine imports stay tidy
export const WATER_LEVEL = SEA;
