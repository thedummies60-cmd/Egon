/* ============================================================
 * mesher.js - turns a chunk of voxels into GPU-ready geometry.
 * Face culling + per-vertex ambient occlusion + smooth lighting.
 *
 * Vertex layout (stride 20 bytes):
 *   0  : 3 x uint16   position, 1/16 block units, chunk-local
 *   6  : 2 x uint16   texture coords, normalised
 *   10 : 4 x uint8    skyLight, blockLight, ao, wave
 *   14 : 4 x uint8    tint rgb + pad
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});
  const B = MC.blocks;
  const CX = MC.CHUNK.X, CZ = MC.CHUNK.Z, CY = MC.CHUNK.Y;
  const idx = MC.idx;

  const STRIDE = 20;
  const MAX_QUADS_PER_SEG = 16384;   // keeps us inside 16-bit index range
  MC.MESH = { STRIDE: STRIDE, MAX_QUADS_PER_SEG: MAX_QUADS_PER_SEG };

  /* face basis: normal, tangent, bitangent, and the corner the quad starts at */
  const FACES = [
    { n: [1, 0, 0], t: [0, 0, -1], b: [0, 1, 0], o: [1, 0, 1], shade: 0.80 },  // +X
    { n: [-1, 0, 0], t: [0, 0, 1], b: [0, 1, 0], o: [0, 0, 0], shade: 0.80 },  // -X
    { n: [0, 1, 0], t: [1, 0, 0], b: [0, 0, -1], o: [0, 1, 1], shade: 1.00 },  // +Y
    { n: [0, -1, 0], t: [1, 0, 0], b: [0, 0, 1], o: [0, 0, 0], shade: 0.55 },  // -Y
    { n: [0, 0, 1], t: [1, 0, 0], b: [0, 1, 0], o: [0, 0, 1], shade: 0.66 },  // +Z
    { n: [0, 0, -1], t: [-1, 0, 0], b: [0, 1, 0], o: [1, 0, 0], shade: 0.66 }   // -Z
  ];
  const FACE_NAME = ['side', 'side', 'top', 'bottom', 'side', 'side'];

  /* ---- per-block face texture indices, resolved once ---- */
  let FACE_UV = null;      // [blockId*6 + face] -> Float32Array uv
  let OVERLAY_UV = null;   // grass fringe
  let CULL_SAME = null;    // hide the seam between two identical blocks
  let WAVE = null;         // how much this block sways

  function initTables() {
    const n = B.list.length;
    FACE_UV = new Array(n * 6);
    OVERLAY_UV = new Array(n);
    CULL_SAME = new Uint8Array(n);
    WAVE = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const blk = B.list[i];
      for (let f = 0; f < 6; f++) {
        let name;
        const t = blk.tex;
        if (typeof t === 'string') name = t;
        else {
          const fn = FACE_NAME[f];
          if (fn === 'top') name = t.top || t.side || t.all;
          else if (fn === 'bottom') name = t.bottom || t.side || t.all;
          else name = t.side || t.all;
          // "front" faces point south (-Z) by default
          if (f === 5 && t.front) name = t.front;
        }
        FACE_UV[i * 6 + f] = MC.atlas.uv[name] || MC.atlas.uv.white;
      }
      OVERLAY_UV[i] = blk.overlay ? MC.atlas.uv[blk.overlay] : null;
      CULL_SAME[i] = (blk.render === 'liquid' || /glass|_ice$|^ice$/.test(blk.name)) ? 1 : 0;
      if (blk.render === 'cross' && blk.name !== 'torch' && blk.name !== 'ladder') WAVE[i] = 26;
      if (blk.name === 'water') WAVE[i] = 18;
      if (/leaves/.test(blk.name)) WAVE[i] = 10;
    }
  }
  MC.initMeshTables = initTables;

  /* ---- growable scratch buffers, reused across every chunk ---- */
  function Scratch(quads) {
    this.cap = quads;
    this.buf = new ArrayBuffer(quads * 4 * STRIDE);
    this.u8 = new Uint8Array(this.buf);
    this.u16 = new Uint16Array(this.buf);
    this.quads = 0;
  }
  Scratch.prototype.reset = function () { this.quads = 0; };
  Scratch.prototype.ensure = function (extra) {
    if (this.quads + extra <= this.cap) return;
    let cap = this.cap;
    while (cap < this.quads + extra) cap *= 2;
    const nb = new ArrayBuffer(cap * 4 * STRIDE);
    new Uint8Array(nb).set(this.u8.subarray(0, this.quads * 4 * STRIDE));
    this.buf = nb; this.u8 = new Uint8Array(nb); this.u16 = new Uint16Array(nb);
    this.cap = cap;
  };
  Scratch.prototype.data = function () {
    return new Uint8Array(this.buf, 0, this.quads * 4 * STRIDE);
  };

  const solidScratch = new Scratch(4096);
  const waterScratch = new Scratch(1024);

  /* light curve: matches Minecraft's falloff closely enough */
  const LIGHT_CURVE = new Uint8Array(16);
  for (let i = 0; i < 16; i++) LIGHT_CURVE[i] = Math.round(255 * Math.pow(0.8, 15 - i));

  const AO_LEVELS = [Math.round(255 * 0.46), Math.round(255 * 0.68), Math.round(255 * 0.85), 255];

  /* ============================================================
   * Mesher
   * ============================================================ */
  function Mesher(world) {
    this.world = world;
    if (!FACE_UV) initTables();
    this.grassCol = new Int32Array(CX * CZ);
    this.foliageCol = new Int32Array(CX * CZ);
    this.waterCol = new Int32Array(CX * CZ);
  }

  // blend biome colours over a 3x3 area so borders don't hard-cut
  Mesher.prototype.prepColours = function (chunk) {
    const world = this.world;
    const bx = chunk.cx * CX, bz = chunk.cz * CZ;
    for (let z = 0; z < CZ; z++) {
      for (let x = 0; x < CX; x++) {
        let gr = 0, gg = 0, gb = 0, fr = 0, fg = 0, fb = 0, wr = 0, wg = 0, wb = 0, n = 0;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const bio = world.biomeAt(bx + x + dx * 3, bz + z + dz * 3);
            gr += (bio.grass >> 16) & 255; gg += (bio.grass >> 8) & 255; gb += bio.grass & 255;
            fr += (bio.foliage >> 16) & 255; fg += (bio.foliage >> 8) & 255; fb += bio.foliage & 255;
            wr += (bio.water >> 16) & 255; wg += (bio.water >> 8) & 255; wb += bio.water & 255;
            n++;
          }
        }
        const i = z * CX + x;
        this.grassCol[i] = (((gr / n) | 0) << 16) | (((gg / n) | 0) << 8) | ((gb / n) | 0);
        this.foliageCol[i] = (((fr / n) | 0) << 16) | (((fg / n) | 0) << 8) | ((fb / n) | 0);
        this.waterCol[i] = (((wr / n) | 0) << 16) | (((wg / n) | 0) << 8) | ((wb / n) | 0);
      }
    }
  };

  Mesher.prototype.build = function (chunk) {
    const world = this.world, T = B.T;
    const blocks = chunk.blocks, light = chunk.light;
    const bx = chunk.cx * CX, bz = chunk.cz * CZ;
    solidScratch.reset();
    waterScratch.reset();
    this.prepColours(chunk);

    // neighbour chunks, fetched once
    const nc = [
      world.getChunk(chunk.cx + 1, chunk.cz), world.getChunk(chunk.cx - 1, chunk.cz),
      null, null,
      world.getChunk(chunk.cx, chunk.cz + 1), world.getChunk(chunk.cx, chunk.cz - 1)
    ];

    const self = this;
    // block id at chunk-local coords, crossing into neighbours when needed
    function at(x, y, z) {
      if (y < 0) return 1;
      if (y >= CY) return 0;
      if (x >= 0 && x < CX && z >= 0 && z < CZ) return blocks[idx(x, y, z)];
      const c = world.chunks.get(((bx + x) >> 4) + ',' + ((bz + z) >> 4));
      if (!c) return 0;
      return c.blocks[idx((bx + x) & 15, y, (bz + z) & 15)];
    }
    function lightAt(x, y, z) {
      if (y < 0 || y >= CY) return y >= CY ? 0xf0 : 0;
      if (x >= 0 && x < CX && z >= 0 && z < CZ) return light[idx(x, y, z)];
      const c = world.chunks.get(((bx + x) >> 4) + ',' + ((bz + z) >> 4));
      if (!c) return 0xf0;
      return c.light[idx((bx + x) & 15, y, (bz + z) & 15)];
    }

    const maxY = Math.min(CY - 1, chunk.maxY + 1);
    for (let y = 0; y <= maxY; y++) {
      for (let z = 0; z < CZ; z++) {
        for (let x = 0; x < CX; x++) {
          const id = blocks[idx(x, y, z)];
          if (id === 0) continue;
          const rt = T.render[id];
          if (rt === 0) continue;
          if (rt === 2) { this.emitCross(chunk, x, y, z, id, at, lightAt); continue; }
          if (rt === 3) { this.emitLiquid(chunk, x, y, z, id, at, lightAt); continue; }
          this.emitCube(chunk, x, y, z, id, at, lightAt);
        }
      }
    }

    return {
      solid: solidScratch.data(),
      solidQuads: solidScratch.quads,
      water: waterScratch.data(),
      waterQuads: waterScratch.quads
    };
  };

  /* ---- writes one quad; corners are given in the face's (t,b) basis ---- */
  function writeQuad(s, px, py, pz, face, uv, lights, aos, tint, wave, flip) {
    s.ensure(1);
    const base = s.quads * 4 * STRIDE;
    const u16 = s.u16, u8 = s.u8;
    const f = FACES[face];
    const o = f.o, t = f.t, b = f.b;
    const u0 = uv[0] * 65535, v0 = uv[1] * 65535, u1 = uv[2] * 65535, v1 = uv[3] * 65535;
    // corner order: (0,0) (1,0) (1,1) (0,1)
    const CA = [0, 1, 1, 0], CB = [0, 0, 1, 1];
    // flipping the diagonal when AO is uneven avoids the classic seam artefact
    const order = flip ? [1, 2, 3, 0] : [0, 1, 2, 3];
    for (let k = 0; k < 4; k++) {
      const i = order[k];
      const a = CA[i], c = CB[i];
      const vx = px + o[0] + t[0] * a + b[0] * c;
      const vy = py + o[1] + t[1] * a + b[1] * c;
      const vz = pz + o[2] + t[2] * a + b[2] * c;
      const off = base + k * STRIDE;
      const h = off >> 1;
      u16[h] = (vx * 16) | 0;
      u16[h + 1] = (vy * 16) | 0;
      u16[h + 2] = (vz * 16) | 0;
      u16[h + 3] = (u0 + (u1 - u0) * a) | 0;
      u16[h + 4] = (v0 + (v1 - v0) * (1 - c)) | 0;
      u8[off + 10] = lights[i] >> 8;          // sky
      u8[off + 11] = lights[i] & 255;         // block
      u8[off + 12] = aos[i];
      u8[off + 13] = wave;
      u8[off + 14] = tint[0];
      u8[off + 15] = tint[1];
      u8[off + 16] = tint[2];
      u8[off + 17] = 255;
    }
    s.quads++;
  }

  // fractional-height quad (water surface, plant crosses) needs raw corners
  function writeFreeQuad(s, verts, uv, lights, aos, tint, wave) {
    s.ensure(1);
    const base = s.quads * 4 * STRIDE;
    const u16 = s.u16, u8 = s.u8;
    const u0 = uv[0] * 65535, v0 = uv[1] * 65535, u1 = uv[2] * 65535, v1 = uv[3] * 65535;
    const CA = [0, 1, 1, 0], CB = [0, 0, 1, 1];
    for (let k = 0; k < 4; k++) {
      const off = base + k * STRIDE, h = off >> 1;
      u16[h] = (verts[k * 3] * 16) | 0;
      u16[h + 1] = (verts[k * 3 + 1] * 16) | 0;
      u16[h + 2] = (verts[k * 3 + 2] * 16) | 0;
      u16[h + 3] = (u0 + (u1 - u0) * CA[k]) | 0;
      u16[h + 4] = (v0 + (v1 - v0) * (1 - CB[k])) | 0;
      u8[off + 10] = lights[k] >> 8;
      u8[off + 11] = lights[k] & 255;
      u8[off + 12] = aos[k];
      u8[off + 13] = wave;
      u8[off + 14] = tint[0]; u8[off + 15] = tint[1]; u8[off + 16] = tint[2];
      u8[off + 17] = 255;
    }
    s.quads++;
  }

  const tmpLights = new Uint32Array(4);
  const tmpAO = new Uint8Array(4);
  const tmpTint = new Uint8Array(3);
  const overlayTint = new Uint8Array(3);

  Mesher.prototype.tintFor = function (id, x, z, face) {
    const blk = B.list[id];
    const ci = z * CX + x;
    let col = 0xffffff;
    if (blk.tint === MC.TINT.GRASS) col = this.grassCol[ci];
    else if (blk.tint === MC.TINT.FOLIAGE) col = this.foliageCol[ci];
    else if (blk.tint === MC.TINT.WATER) col = this.waterCol[ci];
    if (blk.tint !== 0 && blk.tintFaces === 'top' && face !== 2) col = 0xffffff;
    tmpTint[0] = (col >> 16) & 255; tmpTint[1] = (col >> 8) & 255; tmpTint[2] = col & 255;
    return tmpTint;
  };

  /* ---------------- solid cube ---------------- */
  Mesher.prototype.emitCube = function (chunk, x, y, z, id, at, lightAt) {
    const T = B.T;
    const blk = B.list[id];
    const overlayUV = OVERLAY_UV[id];
    for (let f = 0; f < 6; f++) {
      const fc = FACES[f];
      const nx = x + fc.n[0], ny = y + fc.n[1], nz = z + fc.n[2];
      const nid = at(nx, ny, nz);
      if (T.opaque[nid]) continue;
      if (nid === id && CULL_SAME[id]) continue;
      // don't draw the underside of a block resting on the world floor
      if (ny < 0) continue;

      this.faceLightAO(x, y, z, f, at, lightAt, fc.shade);
      const tint = this.tintFor(id, x, z, f);
      const flip = (tmpAO[0] + tmpAO[2]) < (tmpAO[1] + tmpAO[3]);
      writeQuad(solidScratch, x, y, z, f, FACE_UV[id * 6 + f], tmpLights, tmpAO, tint, 0, flip);

      // grass fringe on the four sides, always tinted like the top face
      if (overlayUV && f !== 2 && f !== 3) {
        const col = this.grassCol[z * CX + x];
        overlayTint[0] = (col >> 16) & 255;
        overlayTint[1] = (col >> 8) & 255;
        overlayTint[2] = col & 255;
        writeOverlay(x, y, z, f, overlayUV, tmpLights, tmpAO, overlayTint);
      }
    }
  };

  function writeOverlay(x, y, z, f, uv, lights, aos, tint) {
    const fc = FACES[f];
    // nudge the fringe out of the face to avoid z-fighting
    const e = 0.002;
    const verts = [];
    const CA = [0, 1, 1, 0], CB = [0, 0, 1, 1];
    for (let k = 0; k < 4; k++) {
      verts.push(
        x + fc.o[0] + fc.t[0] * CA[k] + fc.b[0] * CB[k] + fc.n[0] * e,
        y + fc.o[1] + fc.t[1] * CA[k] + fc.b[1] * CB[k] + fc.n[1] * e,
        z + fc.o[2] + fc.t[2] * CA[k] + fc.b[2] * CB[k] + fc.n[2] * e
      );
    }
    writeFreeQuad(solidScratch, verts, uv, lights, aos, tint, 0);
  }

  /* ---------------- smooth light + AO for one face ---------------- */
  Mesher.prototype.faceLightAO = function (x, y, z, f, at, lightAt, shade) {
    const T = B.T;
    const fc = FACES[f];
    const nx = x + fc.n[0], ny = y + fc.n[1], nz = z + fc.n[2];
    const t = fc.t, b = fc.b;
    const CA = [0, 1, 1, 0], CB = [0, 0, 1, 1];
    for (let k = 0; k < 4; k++) {
      const du = CA[k] * 2 - 1, dv = CB[k] * 2 - 1;
      const s1x = nx + t[0] * du, s1y = ny + t[1] * du, s1z = nz + t[2] * du;
      const s2x = nx + b[0] * dv, s2y = ny + b[1] * dv, s2z = nz + b[2] * dv;
      const cx = s1x + b[0] * dv, cy = s1y + b[1] * dv, cz = s1z + b[2] * dv;
      const o1 = T.opaque[at(s1x, s1y, s1z)] ? 1 : 0;
      const o2 = T.opaque[at(s2x, s2y, s2z)] ? 1 : 0;
      const oc = T.opaque[at(cx, cy, cz)] ? 1 : 0;
      const level = (o1 && o2) ? 0 : (3 - (o1 + o2 + oc));
      tmpAO[k] = (AO_LEVELS[level] * shade) | 0;

      // smooth lighting: average the open cells around this vertex
      let sky = 0, blk = 0, n = 0;
      const cells = [[nx, ny, nz], [s1x, s1y, s1z], [s2x, s2y, s2z], [cx, cy, cz]];
      for (let c = 0; c < 4; c++) {
        const p = cells[c];
        if (T.opaque[at(p[0], p[1], p[2])]) continue;
        const L = lightAt(p[0], p[1], p[2]);
        sky += L >> 4; blk += L & 15; n++;
      }
      if (n === 0) { const L = lightAt(nx, ny, nz); sky = L >> 4; blk = L & 15; n = 1; }
      tmpLights[k] = (LIGHT_CURVE[Math.round(sky / n)] << 8) | LIGHT_CURVE[Math.round(blk / n)];
    }
  };

  /* ---------------- cross-shaped plants ---------------- */
  Mesher.prototype.emitCross = function (chunk, x, y, z, id, at, lightAt) {
    const L = lightAt(x, y, z);
    const lv = (LIGHT_CURVE[L >> 4] << 8) | LIGHT_CURVE[L & 15];
    for (let k = 0; k < 4; k++) { tmpLights[k] = lv; tmpAO[k] = 255; }
    const tint = this.tintFor(id, x, z, 2);
    const uv = FACE_UV[id * 6];
    const wave = WAVE[id];
    const m = 0.1464;   // inset so the diagonals fit inside the block
    const planes = [
      [x + m, y, z + m, x + 1 - m, y, z + 1 - m],
      [x + 1 - m, y, z + m, x + m, y, z + 1 - m]
    ];
    for (let p = 0; p < 2; p++) {
      const q = planes[p];
      const front = [q[0], y, q[2], q[3], y, q[5], q[3], y + 1, q[5], q[0], y + 1, q[2]];
      const back = [q[3], y, q[5], q[0], y, q[2], q[0], y + 1, q[2], q[3], y + 1, q[5]];
      writeFreeQuad(solidScratch, front, uv, tmpLights, tmpAO, tint, wave);
      writeFreeQuad(solidScratch, back, uv, tmpLights, tmpAO, tint, wave);
    }
  };

  /* ---------------- liquids ---------------- */
  Mesher.prototype.emitLiquid = function (chunk, x, y, z, id, at, lightAt) {
    const T = B.T;
    const above = at(x, y + 1, z);
    const surface = (above !== id);
    const top = surface ? 0.885 : 1.0;
    const uv = FACE_UV[id * 6];
    const isWater = B.list[id].name === 'water';
    const scratch = isWater ? waterScratch : solidScratch;
    const wave = isWater ? WAVE[id] : 0;

    for (let f = 0; f < 6; f++) {
      const fc = FACES[f];
      const nx = x + fc.n[0], ny = y + fc.n[1], nz = z + fc.n[2];
      const nid = at(nx, ny, nz);
      if (T.opaque[nid]) continue;
      if (nid === id) continue;
      if (ny < 0) continue;
      if (f === 3 && T.render[nid] === 3) continue;

      const L = lightAt(nx, ny, nz);
      const lv = (LIGHT_CURVE[L >> 4] << 8) | LIGHT_CURVE[L & 15];
      const sh = (fc.shade * 255) | 0;
      for (let k = 0; k < 4; k++) { tmpLights[k] = lv; tmpAO[k] = sh; }
      const tint = this.tintFor(id, x, z, f);

      if (top === 1.0) {
        writeQuad(scratch, x, y, z, f, uv, tmpLights, tmpAO, tint, wave, false);
      } else {
        // build the quad by hand so the surface can sit below the block top
        const o = fc.o, t = fc.t, b = fc.b;
        const verts = [];
        const CA = [0, 1, 1, 0], CB = [0, 0, 1, 1];
        for (let k = 0; k < 4; k++) {
          let vy = y + o[1] + t[1] * CA[k] + b[1] * CB[k];
          if (vy > y + top) vy = y + top;
          verts.push(
            x + o[0] + t[0] * CA[k] + b[0] * CB[k],
            vy,
            z + o[2] + t[2] * CA[k] + b[2] * CB[k]
          );
        }
        writeFreeQuad(scratch, verts, uv, tmpLights, tmpAO, tint, f === 2 ? wave : 0);
      }
    }
  };

  MC.Mesher = Mesher;
})();
