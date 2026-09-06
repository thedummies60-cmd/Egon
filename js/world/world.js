/* ============================================================
 * world.js - chunk storage, block access, and the light engine.
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});
  const B = MC.blocks;
  const CX = MC.CHUNK.X, CZ = MC.CHUNK.Z, CY = MC.CHUNK.Y, SEA = MC.CHUNK.SEA;
  const idx = MC.idx;

  /* ============================================================
   * Chunk
   * ============================================================ */
  function Chunk(cx, cz) {
    this.cx = cx; this.cz = cz;
    this.key = cx + ',' + cz;
    this.blocks = new Uint16Array(CX * CZ * CY);
    this.light = new Uint8Array(CX * CZ * CY);   // hi nibble = sky, lo = block
    this.heights = new Int16Array(CX * CZ);      // terrain surface used by worldgen
    this.skyFloor = new Int16Array(CX * CZ);     // lowest y reached by open sky
    this.biomeMap = new Uint8Array(CX * CZ);
    this.generated = false;
    this.decorated = false;
    this.lit = false;
    this.dirty = true;          // needs a mesh rebuild
    this.mesh = null;
    this.edits = null;          // Map idx -> id, the player's changes
    this.entities = [];
    this.tiles = null;          // Map idx -> tile entity data (chests, furnaces)
    this.maxY = 0;              // highest non-air block, lets the mesher skip sky
  }

  Chunk.prototype.get = function (x, y, z) {
    if (y < 0 || y >= CY) return 0;
    return this.blocks[idx(x, y, z)];
  };
  Chunk.prototype.set = function (x, y, z, id) {
    if (y < 0 || y >= CY) return;
    this.blocks[idx(x, y, z)] = id;
    if (id !== 0 && y > this.maxY) this.maxY = y;
  };
  Chunk.prototype.getSky = function (x, y, z) {
    if (y >= CY) return 15;
    if (y < 0) return 0;
    return this.light[idx(x, y, z)] >> 4;
  };
  Chunk.prototype.getBlockLight = function (x, y, z) {
    if (y < 0 || y >= CY) return 0;
    return this.light[idx(x, y, z)] & 15;
  };
  Chunk.prototype.recomputeMaxY = function () {
    let m = 0;
    for (let y = CY - 1; y >= 0; y--) {
      let any = false;
      const base = y << 8;
      for (let i = 0; i < 256; i++) if (this.blocks[base + i] !== 0) { any = true; break; }
      if (any) { m = y; break; }
    }
    this.maxY = m;
  };
  Chunk.prototype.recordEdit = function (i, id) {
    if (!this.edits) this.edits = new Map();
    this.edits.set(i, id);
  };
  MC.Chunk = Chunk;

  /* ============================================================
   * World
   * ============================================================ */
  function World(seed, opts) {
    opts = opts || {};
    this.seed = seed >>> 0;
    this.gen = new MC.WorldGen(this.seed);
    this.chunks = new Map();
    this.pending = new Map();     // "cx,cz" -> [[x,y,z,id,soft], ...] deferred decoration
    this.skyQueue = [];           // light BFS work lists
    this.skyRemove = [];
    this.blockQueue = [];
    this.blockRemove = [];
    this.genQueue = [];
    this.time = 0;                // 0..1 day fraction
    this.dayLength = opts.dayLength || 900;   // seconds for a full day
    this.tickAccum = 0;
    this.entities = [];
    this.savedEdits = opts.edits || null;     // key -> {idxString: id}
    this.T = B.T;
  }

  World.prototype.key = function (cx, cz) { return cx + ',' + cz; };
  World.prototype.getChunk = function (cx, cz) { return this.chunks.get(cx + ',' + cz); };
  World.prototype.hasChunk = function (cx, cz) { return this.chunks.has(cx + ',' + cz); };

  World.prototype.chunkAtBlock = function (wx, wz) {
    return this.chunks.get((wx >> 4) + ',' + (wz >> 4));
  };

  /* ---------------- block access ---------------- */

  World.prototype.getBlock = function (wx, wy, wz) {
    if (wy < 0 || wy >= CY) return 0;
    const c = this.chunks.get((wx >> 4) + ',' + (wz >> 4));
    if (!c) return 0;
    return c.blocks[idx(wx & 15, wy, wz & 15)];
  };

  // like getBlock but tells the mesher "this chunk isn't loaded"
  World.prototype.getBlockOrNull = function (wx, wy, wz) {
    if (wy < 0 || wy >= CY) return wy < 0 ? 1 : 0;
    const c = this.chunks.get((wx >> 4) + ',' + (wz >> 4));
    if (!c) return -1;
    return c.blocks[idx(wx & 15, wy, wz & 15)];
  };

  World.prototype.isSolid = function (wx, wy, wz) {
    return this.T.solid[this.getBlock(wx, wy, wz)] === 1;
  };

  World.prototype.biomeAt = function (wx, wz) {
    const c = this.chunks.get((wx >> 4) + ',' + (wz >> 4));
    if (!c) return MC.biomes.get(0);
    return MC.biomes.get(c.biomeMap[(wz & 15) * CX + (wx & 15)]);
  };

  World.prototype.surfaceHeight = function (wx, wz) {
    const c = this.chunks.get((wx >> 4) + ',' + (wz >> 4));
    if (c && c.generated) return c.heights[(wz & 15) * CX + (wx & 15)];
    return Math.round(this.gen.heightAt(wx, wz));
  };

  // highest non-air block, used for spawning things on top of the world
  World.prototype.topSolid = function (wx, wz) {
    const c = this.chunks.get((wx >> 4) + ',' + (wz >> 4));
    if (!c) return -1;
    const lx = wx & 15, lz = wz & 15;
    for (let y = Math.min(CY - 1, c.maxY + 1); y >= 0; y--) {
      const id = c.blocks[idx(lx, y, lz)];
      if (id !== 0 && this.T.solid[id]) return y;
    }
    return -1;
  };

  World.prototype.nearWater = function (wx, wy, wz) {
    const w = B.idOf('water');
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (this.getBlock(wx + dx, wy, wz + dz) === w) return true;
    }
    return false;
  };

  /* ---- worldgen writes: defer anything outside a loaded chunk ---- */
  World.prototype.setGenBlock = function (wx, wy, wz, id, soft) {
    if (wy < 0 || wy >= CY) return;
    const ck = (wx >> 4) + ',' + (wz >> 4);
    const c = this.chunks.get(ck);
    if (c && c.generated) {
      const i = idx(wx & 15, wy, wz & 15);
      if (soft && c.blocks[i] !== 0) return;   // don't overwrite existing terrain
      c.blocks[i] = id;
      if (wy > c.maxY) c.maxY = wy;
      c.dirty = true;
      return;
    }
    let arr = this.pending.get(ck);
    if (!arr) { arr = []; this.pending.set(ck, arr); }
    arr.push(wx, wy, wz, id, soft ? 1 : 0);
  };

  World.prototype.applyPending = function (chunk) {
    const arr = this.pending.get(chunk.key);
    if (!arr) return;
    for (let i = 0; i < arr.length; i += 5) {
      const wy = arr[i + 1];
      if (wy < 0 || wy >= CY) continue;
      const bi = idx(arr[i] & 15, wy, arr[i + 2] & 15);
      if (arr[i + 4] && chunk.blocks[bi] !== 0) continue;
      chunk.blocks[bi] = arr[i + 3];
      if (wy > chunk.maxY) chunk.maxY = wy;
    }
    this.pending.delete(chunk.key);
  };

  /* ============================================================
   * chunk lifecycle
   * ============================================================ */

  World.prototype.createChunk = function (cx, cz) {
    const key = cx + ',' + cz;
    let c = this.chunks.get(key);
    if (c) return c;
    c = new Chunk(cx, cz);
    this.chunks.set(key, c);
    this.gen.generateChunk(c);
    c.recomputeMaxY();
    this.applyPending(c);

    // replay the player's saved edits for this chunk
    if (this.savedEdits && this.savedEdits[key]) {
      const e = this.savedEdits[key];
      c.edits = new Map();
      for (const k in e) {
        const i = +k;
        c.blocks[i] = e[k];
        c.edits.set(i, e[k]);
        const y = i >> 8;
        if (e[k] !== 0 && y > c.maxY) c.maxY = y;
      }
    }
    return c;
  };

  World.prototype.decorateChunk = function (c) {
    if (c.decorated) return;
    this.gen.decorate(c, this);
    // decoration of neighbours may have queued blocks for us
    this.applyPending(c);
    c.recomputeMaxY();
    c.decorated = true;
    c.dirty = true;
  };

  World.prototype.unloadChunk = function (key) {
    const c = this.chunks.get(key);
    if (!c) return null;
    this.chunks.delete(key);
    return c;
  };

  /* ============================================================
   * lighting
   * ============================================================ */

  World.prototype.getSkyLight = function (wx, wy, wz) {
    if (wy >= CY) return 15;
    if (wy < 0) return 0;
    const c = this.chunks.get((wx >> 4) + ',' + (wz >> 4));
    if (!c) return 15;
    return c.light[idx(wx & 15, wy, wz & 15)] >> 4;
  };
  World.prototype.getBlockLight = function (wx, wy, wz) {
    if (wy < 0 || wy >= CY) return 0;
    const c = this.chunks.get((wx >> 4) + ',' + (wz >> 4));
    if (!c) return 0;
    return c.light[idx(wx & 15, wy, wz & 15)] & 15;
  };
  World.prototype.setSkyLight = function (wx, wy, wz, v) {
    const c = this.chunks.get((wx >> 4) + ',' + (wz >> 4));
    if (!c) return;
    const i = idx(wx & 15, wy, wz & 15);
    c.light[i] = (c.light[i] & 15) | (v << 4);
    c.dirty = true;
  };
  World.prototype.setBlockLight = function (wx, wy, wz, v) {
    const c = this.chunks.get((wx >> 4) + ',' + (wz >> 4));
    if (!c) return;
    const i = idx(wx & 15, wy, wz & 15);
    c.light[i] = (c.light[i] & 0xf0) | v;
    c.dirty = true;
  };

  // how much light is lost entering this block (16 == fully blocked)
  World.prototype.opacity = function (id) {
    if (this.T.opaque[id]) return 16;
    return Math.max(1, this.T.filter[id]);
  };

  // Column pass: pour sunlight straight down, then queue the cliff faces
  // where it has to spread sideways.
  World.prototype.initSkyLight = function (c) {
    const blocks = c.blocks, light = c.light, T = this.T;
    const baseX = c.cx * CX, baseZ = c.cz * CZ;
    for (let z = 0; z < CZ; z++) {
      for (let x = 0; x < CX; x++) {
        let level = 15;
        let y = CY - 1;
        for (; y >= 0; y--) {
          const i = idx(x, y, z);
          const id = blocks[i];
          if (T.opaque[id]) break;
          const f = T.filter[id];
          if (f > 0) level = Math.max(0, level - f);
          light[i] = (light[i] & 15) | (level << 4);
          if (level === 0) break;
        }
        c.skyFloor[z * CX + x] = y + 1;
      }
    }
    // seed horizontal spreading only where a neighbouring column is taller
    const q = this.skyQueue;
    for (let z = 0; z < CZ; z++) {
      for (let x = 0; x < CX; x++) {
        const floor = c.skyFloor[z * CX + x];
        let hi = floor;
        for (let d = 0; d < 4; d++) {
          const nx = x + [1, -1, 0, 0][d], nz = z + [0, 0, 1, -1][d];
          let nf;
          if (nx >= 0 && nx < CX && nz >= 0 && nz < CZ) nf = c.skyFloor[nz * CX + nx];
          else {
            const nc = this.chunks.get(((baseX + nx) >> 4) + ',' + ((baseZ + nz) >> 4));
            nf = nc && nc.lit ? nc.skyFloor[((baseZ + nz) & 15) * CX + ((baseX + nx) & 15)] : floor;
          }
          if (nf > hi) hi = nf;
        }
        for (let y = floor; y < Math.min(hi + 1, CY); y++) {
          q.push(baseX + x, y, baseZ + z);
        }
      }
    }
    // light emitters in this chunk
    const bq = this.blockQueue;
    for (let y = 0; y <= c.maxY; y++) {
      for (let z = 0; z < CZ; z++) for (let x = 0; x < CX; x++) {
        const i = idx(x, y, z);
        const e = T.light[blocks[i]];
        if (e > 0) {
          c.light[i] = (c.light[i] & 0xf0) | e;
          bq.push(baseX + x, y, baseZ + z);
        }
      }
    }
    c.lit = true;
  };

  const NX = [1, -1, 0, 0, 0, 0];
  const NY = [0, 0, 1, -1, 0, 0];
  const NZ = [0, 0, 0, 0, 1, -1];

  World.prototype.processLight = function (budget) {
    let work = budget;
    const T = this.T;

    // --- sky light removal ---
    while (this.skyRemove.length && work > 0) {
      const wz = this.skyRemove.pop(), wy = this.skyRemove.pop(), wx = this.skyRemove.pop();
      const old = this.skyRemove.pop();
      work -= 6;
      for (let d = 0; d < 6; d++) {
        const nx = wx + NX[d], ny = wy + NY[d], nz = wz + NZ[d];
        if (ny < 0 || ny >= CY) continue;
        const nl = this.getSkyLight(nx, ny, nz);
        if (nl === 0) continue;
        const goingDown = (d === 3);
        if (nl < old || (goingDown && old === 15 && nl === 15)) {
          this.setSkyLight(nx, ny, nz, 0);
          this.skyRemove.push(nl, nx, ny, nz);
        } else if (nl >= old) {
          this.skyQueue.push(nx, ny, nz);
        }
      }
    }

    // --- sky light spread ---
    while (this.skyQueue.length && work > 0) {
      const wz = this.skyQueue.pop(), wy = this.skyQueue.pop(), wx = this.skyQueue.pop();
      work -= 6;
      const level = this.getSkyLight(wx, wy, wz);
      if (level <= 0) continue;
      for (let d = 0; d < 6; d++) {
        const nx = wx + NX[d], ny = wy + NY[d], nz = wz + NZ[d];
        if (ny < 0 || ny >= CY) continue;
        const nc = this.chunks.get((nx >> 4) + ',' + (nz >> 4));
        if (!nc || !nc.lit) continue;
        const ni = idx(nx & 15, ny, nz & 15);
        const nid = nc.blocks[ni];
        if (T.opaque[nid]) continue;
        const filt = Math.max(1, T.filter[nid]);
        // straight down from full daylight keeps its strength
        const target = (d === 3 && level === 15 && T.filter[nid] === 0) ? 15 : level - filt;
        if (target <= 0) continue;
        if ((nc.light[ni] >> 4) < target) {
          nc.light[ni] = (nc.light[ni] & 15) | (target << 4);
          nc.dirty = true;
          this.skyQueue.push(nx, ny, nz);
        }
      }
    }

    // --- block light removal ---
    while (this.blockRemove.length && work > 0) {
      const wz = this.blockRemove.pop(), wy = this.blockRemove.pop(), wx = this.blockRemove.pop();
      const old = this.blockRemove.pop();
      work -= 6;
      for (let d = 0; d < 6; d++) {
        const nx = wx + NX[d], ny = wy + NY[d], nz = wz + NZ[d];
        if (ny < 0 || ny >= CY) continue;
        const nl = this.getBlockLight(nx, ny, nz);
        if (nl === 0) continue;
        if (nl < old) {
          this.setBlockLight(nx, ny, nz, 0);
          this.blockRemove.push(nl, nx, ny, nz);
        } else {
          this.blockQueue.push(nx, ny, nz);
        }
      }
    }

    // --- block light spread ---
    while (this.blockQueue.length && work > 0) {
      const wz = this.blockQueue.pop(), wy = this.blockQueue.pop(), wx = this.blockQueue.pop();
      work -= 6;
      const level = this.getBlockLight(wx, wy, wz);
      if (level <= 1) continue;
      for (let d = 0; d < 6; d++) {
        const nx = wx + NX[d], ny = wy + NY[d], nz = wz + NZ[d];
        if (ny < 0 || ny >= CY) continue;
        const nc = this.chunks.get((nx >> 4) + ',' + (nz >> 4));
        if (!nc || !nc.lit) continue;
        const ni = idx(nx & 15, ny, nz & 15);
        const nid = nc.blocks[ni];
        if (T.opaque[nid]) continue;
        const target = level - Math.max(1, T.filter[nid]);
        if (target <= 0) continue;
        if ((nc.light[ni] & 15) < target) {
          nc.light[ni] = (nc.light[ni] & 0xf0) | target;
          nc.dirty = true;
          this.blockQueue.push(nx, ny, nz);
        }
      }
    }
    return budget - work;
  };

  /* ============================================================
   * player edits
   * ============================================================ */

  World.prototype.setBlock = function (wx, wy, wz, id, record) {
    if (wy < 0 || wy >= CY) return false;
    const c = this.chunks.get((wx >> 4) + ',' + (wz >> 4));
    if (!c) return false;
    const lx = wx & 15, lz = wz & 15;
    const i = idx(lx, wy, lz);
    const old = c.blocks[i];
    if (old === id) return false;
    c.blocks[i] = id;
    if (record !== false) c.recordEdit(i, id);
    if (id !== 0 && wy > c.maxY) c.maxY = wy;

    const T = this.T;

    /* --- sky light --- */
    const oldSky = c.light[i] >> 4;
    if (T.opaque[id] && !T.opaque[old]) {
      // new blocker: tear down the light it swallowed
      if (oldSky > 0) {
        c.light[i] = c.light[i] & 15;
        this.skyRemove.push(oldSky, wx, wy, wz);
      }
      // everything below this column loses its sunlight column
      const floorIdx = lz * CX + lx;
      if (wy >= c.skyFloor[floorIdx]) {
        for (let y = wy - 1; y >= 0; y--) {
          const j = idx(lx, y, lz);
          const s = c.light[j] >> 4;
          if (s === 0) break;
          c.light[j] = c.light[j] & 15;
          this.skyRemove.push(s, wx, y, wz);
          if (T.opaque[c.blocks[j]]) break;
        }
        c.skyFloor[floorIdx] = wy + 1;
      }
    } else if (!T.opaque[id] && T.opaque[old]) {
      // opened up: pull light in from every neighbour
      for (let d = 0; d < 6; d++) {
        this.skyQueue.push(wx + NX[d], wy + NY[d], wz + NZ[d]);
        this.blockQueue.push(wx + NX[d], wy + NY[d], wz + NZ[d]);
      }
      const floorIdx = lz * CX + lx;
      if (wy + 1 === c.skyFloor[floorIdx]) {
        // sunlight can now reach further down
        let y = wy;
        while (y >= 0 && !T.opaque[c.blocks[idx(lx, y, lz)]]) {
          const j = idx(lx, y, lz);
          c.light[j] = (c.light[j] & 15) | (15 << 4);
          this.skyQueue.push(wx, y, wz);
          y--;
        }
        c.skyFloor[floorIdx] = y + 1;
      }
    }

    /* --- block light --- */
    const oldEmit = T.light[old], newEmit = T.light[id];
    const curBlock = c.light[i] & 15;
    if (oldEmit > 0 || (curBlock > 0 && T.opaque[id])) {
      c.light[i] = c.light[i] & 0xf0;
      this.blockRemove.push(Math.max(oldEmit, curBlock), wx, wy, wz);
    }
    if (newEmit > 0) {
      c.light[i] = (c.light[i] & 0xf0) | newEmit;
      this.blockQueue.push(wx, wy, wz);
    }
    if (!T.opaque[id]) {
      for (let d = 0; d < 6; d++) this.blockQueue.push(wx + NX[d], wy + NY[d], wz + NZ[d]);
    }

    /* --- mark meshes dirty (including neighbours on a chunk border) --- */
    c.dirty = true;
    if (lx === 0) this.markDirty(c.cx - 1, c.cz);
    if (lx === 15) this.markDirty(c.cx + 1, c.cz);
    if (lz === 0) this.markDirty(c.cx, c.cz - 1);
    if (lz === 15) this.markDirty(c.cx, c.cz + 1);
    return true;
  };

  World.prototype.markDirty = function (cx, cz) {
    const c = this.chunks.get(cx + ',' + cz);
    if (c) c.dirty = true;
  };

  /* ============================================================
   * time of day
   * ============================================================ */
  World.prototype.tick = function (dt) {
    this.time = (this.time + dt / this.dayLength) % 1;
  };

  // 0 at midnight, 1 at midday
  World.prototype.sunAmount = function () {
    const a = Math.cos((this.time - 0.5) * Math.PI * 2);
    return MC.math.clamp(a * 0.5 + 0.5, 0, 1);
  };
  World.prototype.dayLight = function () {
    const s = this.sunAmount();
    return MC.math.clamp(0.06 + Math.pow(s, 0.55) * 0.94, 0.06, 1);
  };
  World.prototype.isNight = function () { return this.sunAmount() < 0.25; };

  World.prototype.sunDir = function (out) {
    const a = (this.time - 0.25) * Math.PI * 2;
    out[0] = Math.cos(a) * 0.34;
    out[1] = Math.sin(a);
    out[2] = Math.sin(a) * 0.18 + Math.cos(a) * 0.42;
    return MC.math.vec3.normalize(out, out);
  };

  /* ---------------- serialisation of player edits ---------------- */
  World.prototype.exportEdits = function () {
    const out = {};
    this.chunks.forEach(function (c, key) {
      if (!c.edits || c.edits.size === 0) return;
      const o = {};
      c.edits.forEach(function (v, k) { o[k] = v; });
      out[key] = o;
    });
    if (this.savedEdits) {
      // keep edits for chunks that have since been unloaded
      for (const k in this.savedEdits) if (!out[k]) out[k] = this.savedEdits[k];
    }
    return out;
  };

  MC.World = World;
})();
