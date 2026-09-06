/* ============================================================
 * worldgen.js - infinite terrain: climate -> height -> biome,
 * caves, ores, then surface decoration (trees, plants, lakes).
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});
  const B = MC.blocks;
  const clamp = MC.math.clamp;

  const CX = 16, CZ = 16, CY = 160, SEA = 64;
  MC.CHUNK = { X: CX, Z: CZ, Y: CY, SEA: SEA, SIZE: CX * CZ * CY };
  MC.idx = function (x, y, z) { return (y << 8) | (z << 4) | x; };

  function WorldGen(seed) {
    this.seed = seed >>> 0;
    const s = this.seed;
    const P = MC.Perlin;
    this.nContinent = new P(s + 1);
    this.nErosion = new P(s + 2);
    this.nTemp = new P(s + 3);
    this.nHumid = new P(s + 4);
    this.nWeird = new P(s + 5);
    this.nDetail = new P(s + 6);
    this.nCave1 = new P(s + 7);
    this.nCave2 = new P(s + 8);
    this.nCheese = new P(s + 9);
    this.nRiver = new P(s + 10);
    this.nDeep = new P(s + 11);
    this.nBand = new P(s + 12);
    this.nSurface = new P(s + 13);

    // ids cached once - the inner loops run millions of times
    this.ID = {
      air: 0,
      stone: B.idOf('stone'), dirt: B.idOf('dirt'), grass: B.idOf('grass_block'),
      sand: B.idOf('sand'), red_sand: B.idOf('red_sand'), gravel: B.idOf('gravel'),
      water: B.idOf('water'), lava: B.idOf('lava'), bedrock: B.idOf('bedrock'),
      deepslate: B.idOf('deepslate'), snow: B.idOf('snow_block'), ice: B.idOf('ice'),
      packed_ice: B.idOf('packed_ice'), clay: B.idOf('clay'), sandstone: B.idOf('sandstone'),
      terracotta: B.idOf('terracotta'), coarse: B.idOf('coarse_dirt'),
      andesite: B.idOf('andesite'), granite: B.idOf('granite'), diorite: B.idOf('diorite'),
      tuff: B.idOf('tuff'), calcite: B.idOf('calcite'), moss: B.idOf('moss_block'),
      mud: B.idOf('mud'), podzol: B.idOf('podzol'), mycelium: B.idOf('mycelium')
    };

    // badlands terracotta banding, precomputed per y
    this.bands = new Uint16Array(CY);
    const brng = new MC.RNG(s + 99);
    const palette = ['terracotta', 'orange_terracotta', 'yellow_terracotta', 'white_terracotta',
                     'brown_terracotta', 'red_terracotta', 'light_gray_terracotta'];
    for (let y = 0; y < CY; y++) this.bands[y] = B.idOf('terracotta');
    let y = 0;
    while (y < CY) {
      const h = 1 + brng.int(4);
      const col = B.idOf(brng.pick(palette));
      for (let k = 0; k < h && y + k < CY; k++) this.bands[y + k] = col;
      y += h + brng.int(3);
    }
  }

  /* ---------------- climate & height ---------------- */

  WorldGen.prototype.climate = function (x, z, out) {
    out = out || {};
    out.cont = this.nContinent.fbm2(x * 0.00135, z * 0.00135, 4);
    out.ero = this.nErosion.fbm2(x * 0.0009 + 41.3, z * 0.0009 - 17.7, 3);
    out.temp = this.nTemp.fbm2(x * 0.00095 - 88.1, z * 0.00095 + 12.9, 3);
    out.humid = this.nHumid.fbm2(x * 0.0011 + 210.5, z * 0.0011 + 77.2, 3);
    out.weird = this.nWeird.fbm2(x * 0.0042, z * 0.0042, 2);
    // rivers: thin valleys where a low-frequency field crosses zero
    const rv = this.nRiver.fbm2(x * 0.0016 + 500.0, z * 0.0016 - 500.0, 2);
    out.river = 1 - clamp(Math.abs(rv) / 0.055, 0, 1);
    return out;
  };

  WorldGen.prototype.heightAt = function (x, z, cl) {
    cl = cl || this.climate(x, z);
    const cont = cl.cont, ero = cl.ero;
    let h;
    if (cont < -0.42) h = 26 + (cont + 1) * 32;              // deep ocean
    else if (cont < -0.16) h = 44.5 + (cont + 0.42) * 48;    // ocean
    else if (cont < 0.02) h = 57 + (cont + 0.16) * 44;       // shelf / coast
    else h = 65 + (cont - 0.02) * 22;                        // inland

    // mountains grow where erosion is low and the land is well inland
    const inland = clamp((cont - 0.02) * 3.4, 0, 1);
    const mountain = Math.max(0, -ero - 0.05) * inland;
    const peak = this.nDetail.ridged2(x * 0.0034, z * 0.0034, 3);
    h += mountain * (60 + peak * 62) * (0.65 + cl.weird * 0.35);

    // local roughness, stronger on mountains
    const rough = 2.2 + mountain * 26 + inland * 2.5;
    h += this.nDetail.fbm2(x * 0.021, z * 0.021, 4) * rough;
    h += this.nDetail.noise2(x * 0.075, z * 0.075) * 1.1;

    // river carving (not in the deep ocean, and it fades out on peaks)
    if (cl.river > 0 && cont > -0.35) {
      const strength = cl.river * cl.river * clamp((h - SEA + 8) / 14, 0, 1);
      h = h - strength * (h - (SEA - 4.5)) * 0.92;
      cl.riverStrength = strength;
    } else cl.riverStrength = 0;

    return h;
  };

  /* ---------------- biome choice ---------------- */

  WorldGen.prototype.biomeAt = function (x, z, h, cl) {
    const bn = MC.biomes.byName;
    cl = cl || this.climate(x, z);
    const t = cl.temp, hu = cl.humid, w = cl.weird, cont = cl.cont;

    if (h < SEA - 1.5) {
      if (cl.riverStrength > 0.35 && cont > -0.16) return bn.river;
      if (cont < -0.42) return t < -0.45 ? bn.frozen_ocean : bn.deep_ocean;
      if (t < -0.45) return bn.frozen_ocean;
      if (t > 0.55) return bn.warm_ocean;
      return bn.ocean;
    }

    // shorelines
    if (h < SEA + 2.2) {
      if (cl.riverStrength > 0.3) return bn.river;
      if (t < -0.45) return bn.snowy_beach;
      const steep = Math.abs(this.nDetail.noise2(x * 0.02, z * 0.02));
      if (cl.ero < -0.35 && steep > 0.4) return bn.stony_shore;
      return bn.beach;
    }

    // high ground
    if (h > 132) return t < 0.1 ? bn.jagged_peaks : bn.stony_peaks;
    if (h > 116) return t < 0.25 ? bn.snowy_slopes : bn.stony_peaks;
    if (h > 100) {
      if (t < 0.15) return bn.grove;
      if (hu > 0.15) return bn.meadow;
      return bn.windswept_hills;
    }
    if (h > 88 && cl.ero < -0.2) return t < 0.05 ? bn.snowy_slopes : bn.windswept_hills;

    // rare mushroom islands, far out to sea
    if (cont < 0.06 && w > 0.72 && hu > 0.3) return bn.mushroom_fields;

    // frozen
    if (t < -0.45) {
      if (w > 0.6) return bn.ice_spikes;
      return hu > 0.05 ? bn.snowy_taiga : bn.snowy_plains;
    }
    // cold
    if (t < -0.12) {
      if (hu > 0.35) return bn.old_growth_taiga;
      return hu > -0.1 ? bn.taiga : bn.snowy_plains;
    }
    // temperate
    if (t < 0.28) {
      if (hu > 0.42 && h < SEA + 7) return bn.swamp;
      if (hu > 0.42) return bn.dark_forest;
      if (hu > 0.1) return w > 0.55 ? bn.flower_forest : bn.forest;
      if (hu > -0.15) return w > 0.4 ? bn.birch_forest : bn.plains;
      return w > 0.55 ? bn.sunflower_plains : bn.plains;
    }
    // warm
    if (t < 0.6) {
      if (hu > 0.4) return bn.jungle;
      if (hu > 0.05) return bn.forest;
      return bn.plains;
    }
    // hot
    if (hu > 0.42) return w > 0.5 ? bn.bamboo_jungle : bn.jungle;
    if (hu > 0.0) return bn.savanna;
    if (w > 0.45) return cl.ero < -0.25 ? bn.eroded_badlands : bn.badlands;
    return bn.desert;
  };

  /* ---------------- density / caves ---------------- */

  WorldGen.prototype.isCave = function (x, y, z, h) {
    if (y < 2 || y > h - 2) return false;
    // spaghetti tunnels: intersection of two near-zero ridged fields
    const a = Math.abs(this.nCave1.noise3(x * 0.0165, y * 0.026, z * 0.0165));
    if (a < 0.072) {
      const b = Math.abs(this.nCave2.noise3(x * 0.0165 + 91.7, y * 0.026 - 33.3, z * 0.0165 + 12.4));
      if (b < 0.072) return true;
    }
    // big cheese caverns, deeper down
    if (y < 62) {
      const c = this.nCheese.fbm3(x * 0.0092, y * 0.017, z * 0.0092, 3);
      const bias = 0.60 + Math.max(0, (y - 20) / 120) * 0.22;
      if (c > bias) return true;
    }
    return false;
  };

  /* ---------------- terrain fill ---------------- */

  WorldGen.prototype.generateChunk = function (chunk) {
    const blocks = chunk.blocks;
    const ID = this.ID;
    const baseX = chunk.cx * CX, baseZ = chunk.cz * CZ;
    const heights = chunk.heights || (chunk.heights = new Int16Array(CX * CZ));
    const biomeMap = chunk.biomeMap || (chunk.biomeMap = new Uint8Array(CX * CZ));
    const cl = {};
    const rng = new MC.RNG(MC.hashSeed(chunk.cx + ':' + chunk.cz + ':' + this.seed));

    for (let z = 0; z < CZ; z++) {
      for (let x = 0; x < CX; x++) {
        const wx = baseX + x, wz = baseZ + z;
        this.climate(wx, wz, cl);
        const hf = this.heightAt(wx, wz, cl);
        const h = clamp(Math.round(hf), 1, CY - 6);
        const biome = this.biomeAt(wx, wz, hf, cl);
        const ci = z * CX + x;
        heights[ci] = h;
        biomeMap[ci] = biome.id;

        const deepStart = 22 + this.nDeep.noise2(wx * 0.05, wz * 0.05) * 4;
        const surfaceId = B.idOf(biome.surface);
        const fillerId = B.idOf(biome.filler);
        const underwaterId = B.idOf(biome.underwater);
        const submerged = h < SEA;
        const topId = submerged ? underwaterId : surfaceId;
        const fillDepth = biome.fillerDepth;

        for (let y = 0; y <= h; y++) {
          let id;
          if (y === 0) id = ID.bedrock;
          else if (y < 4 && rng.next() < (4 - y) * 0.28) id = ID.bedrock;
          else if (y < deepStart) id = ID.deepslate;
          else id = ID.stone;

          // stone variety pockets
          if (id === ID.stone) {
            const v = this.nSurface.noise3(wx * 0.045, y * 0.045, wz * 0.045);
            if (v > 0.62) id = ID.granite;
            else if (v < -0.66) id = ID.diorite;
            else if (v > 0.44 && v < 0.5) id = ID.andesite;
          } else if (id === ID.deepslate) {
            const v = this.nSurface.noise3(wx * 0.05 + 9, y * 0.05, wz * 0.05 + 9);
            if (v > 0.68) id = ID.tuff;
            else if (v < -0.72) id = ID.calcite;
          }

          if (y > h - 1) id = topId;
          else if (y > h - 1 - fillDepth) {
            if (biome.terracottaBands && h > SEA + 3) id = this.bands[clamp(y, 0, CY - 1)];
            else id = fillerId;
          }

          if (this.isCave(wx, y, wz, h)) {
            id = y < 9 ? ID.lava : ID.air;
          }
          blocks[MC.idx(x, y, z)] = id;
        }

        // water / ice above the terrain, up to sea level
        if (h < SEA) {
          for (let y = h + 1; y <= SEA; y++) blocks[MC.idx(x, y, z)] = ID.water;
          if (biome.ice) blocks[MC.idx(x, SEA, z)] = ID.ice;
        } else if (biome.snow) {
          // a dusting of snow on exposed ground
          if (blocks[MC.idx(x, h, z)] !== ID.ice) blocks[MC.idx(x, h, z)] = ID.snow;
        }
      }
    }

    this.placeOres(chunk, rng);
    chunk.generated = true;
  };

  /* ---------------- ores ---------------- */

  const ORES = [
    { name: 'coal_ore', deep: null, tries: 20, size: 14, min: 5, max: 130 },
    { name: 'iron_ore', deep: 'deepslate_iron_ore', tries: 16, size: 9, min: 2, max: 110 },
    { name: 'copper_ore', deep: null, tries: 10, size: 10, min: 20, max: 96 },
    { name: 'gold_ore', deep: 'deepslate_gold_ore', tries: 5, size: 8, min: 2, max: 40 },
    { name: 'redstone_ore', deep: 'deepslate_redstone_ore', tries: 8, size: 8, min: 2, max: 26 },
    { name: 'lapis_ore', deep: 'deepslate_lapis_ore', tries: 3, size: 7, min: 2, max: 34 },
    { name: 'diamond_ore', deep: 'deepslate_diamond_ore', tries: 3, size: 7, min: 2, max: 20 },
    { name: 'emerald_ore', deep: 'deepslate_emerald_ore', tries: 2, size: 3, min: 40, max: 130 },
    { name: 'gravel', deep: null, tries: 6, size: 26, min: 10, max: 90 },
    { name: 'dirt', deep: null, tries: 8, size: 26, min: 10, max: 110 },
    { name: 'granite', deep: null, tries: 5, size: 30, min: 5, max: 80 },
    { name: 'andesite', deep: null, tries: 5, size: 30, min: 5, max: 80 },
    { name: 'diorite', deep: null, tries: 5, size: 30, min: 5, max: 80 }
  ];

  WorldGen.prototype.placeOres = function (chunk, rng) {
    const blocks = chunk.blocks, ID = this.ID;
    const heights = chunk.heights;
    for (let o = 0; o < ORES.length; o++) {
      const spec = ORES[o];
      const id = B.idOf(spec.name);
      const deepId = spec.deep ? B.idOf(spec.deep) : id;
      const isEmerald = spec.name === 'emerald_ore';
      for (let t = 0; t < spec.tries; t++) {
        if (isEmerald && rng.next() > 0.35) continue;
        const ox = rng.int(CX), oz = rng.int(CZ);
        const maxY = Math.min(spec.max, heights[oz * CX + ox] - 2);
        if (maxY <= spec.min) continue;
        const oy = spec.min + rng.int(maxY - spec.min);
        const n = 2 + rng.int(spec.size);
        let px = ox, py = oy, pz = oz;
        for (let k = 0; k < n; k++) {
          if (px >= 0 && px < CX && pz >= 0 && pz < CZ && py > 0 && py < CY) {
            const i = MC.idx(px, py, pz);
            const cur = blocks[i];
            if (cur === ID.stone || cur === ID.deepslate || cur === ID.granite ||
                cur === ID.andesite || cur === ID.diorite || cur === ID.tuff) {
              blocks[i] = (cur === ID.deepslate) ? deepId : id;
            }
          }
          px += rng.int(3) - 1; py += rng.int(3) - 1; pz += rng.int(3) - 1;
        }
      }
    }
  };

  /* ============================================================
   * decoration - runs after the terrain of a chunk exists.
   * Anything landing outside the chunk is deferred to the world.
   * ============================================================ */

  WorldGen.prototype.decorate = function (chunk, world) {
    const rng = new MC.RNG(MC.hashSeed('deco:' + chunk.cx + ':' + chunk.cz + ':' + this.seed));
    const baseX = chunk.cx * CX, baseZ = chunk.cz * CZ;
    const self = this;
    const set = function (wx, wy, wz, id, soft) {
      world.setGenBlock(wx, wy, wz, id, soft);
    };

    for (let z = 0; z < CZ; z++) {
      for (let x = 0; x < CX; x++) {
        const wx = baseX + x, wz = baseZ + z;
        const ci = z * CX + x;
        const h = chunk.heights[ci];
        const biome = MC.biomes.get(chunk.biomeMap[ci]);
        if (h >= CY - 8) continue;
        const groundId = chunk.blocks[MC.idx(x, h, z)];
        const above = chunk.blocks[MC.idx(x, h + 1, z)];
        const onLand = h >= SEA && above === 0;
        const grassy = groundId === self.ID.grass || groundId === self.ID.podzol ||
                       groundId === self.ID.mycelium || groundId === B.idOf('moss_block');

        /* --- trees --- */
        if (onLand && biome.treeChance > 0 && rng.next() < biome.treeChance && grassy) {
          const type = weighted(rng, biome.trees);
          self.tree(type, wx, h + 1, wz, rng, set);
          continue;
        }
        /* --- boulders --- */
        if (onLand && biome.boulderChance && rng.next() < biome.boulderChance) {
          const r = 1 + rng.int(2);
          const moss = B.idOf('mossy_cobblestone'), cob = B.idOf('cobblestone');
          for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy + dz * dz > r * r + 1) continue;
            set(wx + dx, h + dy + 1, wz + dz, rng.chance(0.4) ? moss : cob, true);
          }
          continue;
        }
        /* --- cactus --- */
        if (onLand && biome.cactusChance && rng.next() < biome.cactusChance && groundId === self.ID.sand) {
          const n = 1 + rng.int(3);
          const cact = B.idOf('cactus');
          for (let k = 0; k < n; k++) set(wx, h + 1 + k, wz, cact, true);
          continue;
        }
        /* --- sugar cane, beside water --- */
        if (onLand && (groundId === self.ID.sand || grassy) && rng.next() < 0.07) {
          if (world.nearWater(wx, h, wz)) {
            const n = 1 + rng.int(3);
            const cane = B.idOf('sugar_cane');
            for (let k = 0; k < n; k++) set(wx, h + 1 + k, wz, cane, true);
            continue;
          }
        }
        /* --- pumpkins / melons --- */
        if (onLand && grassy && biome.pumpkinChance && rng.next() < biome.pumpkinChance) {
          set(wx, h + 1, wz, B.idOf('pumpkin'), true); continue;
        }
        if (onLand && grassy && biome.melonChance && rng.next() < biome.melonChance) {
          set(wx, h + 1, wz, B.idOf('melon'), true); continue;
        }
        /* --- flowers --- */
        if (onLand && grassy && biome.flowerChance && rng.next() < biome.flowerChance) {
          set(wx, h + 1, wz, B.idOf(rng.pick(biome.flowers)), true); continue;
        }
        /* --- mushrooms --- */
        if (onLand && biome.mushroomChance && rng.next() < biome.mushroomChance) {
          set(wx, h + 1, wz, B.idOf(rng.chance(0.6) ? 'brown_mushroom' : 'red_mushroom'), true); continue;
        }
        /* --- dead bushes --- */
        if (onLand && biome.deadBushChance && rng.next() < biome.deadBushChance) {
          set(wx, h + 1, wz, B.idOf('dead_bush'), true); continue;
        }
        /* --- grass & ferns --- */
        if (onLand && grassy && biome.grassChance && rng.next() < biome.grassChance) {
          const tall = rng.chance(0.12);
          if (tall) {
            set(wx, h + 1, wz, B.idOf('tall_grass'), true);
            set(wx, h + 2, wz, B.idOf('tall_grass'), true);
          } else {
            set(wx, h + 1, wz, B.idOf(biome.temperature < 0.35 && rng.chance(0.3) ? 'fern' : 'short_grass'), true);
          }
          continue;
        }
        /* --- lily pads --- */
        if (biome.lilyChance && h < SEA && rng.next() < biome.lilyChance) {
          if (chunk.blocks[MC.idx(x, SEA, z)] === self.ID.water) {
            set(wx, SEA + 1, wz, B.idOf('lily_pad'), true);
          }
        }
      }
    }

    /* --- ice spikes --- */
    if (MC.biomes.get(chunk.biomeMap[8 * CX + 8]).name === 'ice_spikes' && rng.chance(0.35)) {
      const sx = baseX + rng.int(CX), sz = baseZ + rng.int(CZ);
      const sh = world.surfaceHeight(sx, sz);
      const hgt = 6 + rng.int(14);
      const pid = B.idOf('packed_ice');
      for (let k = 0; k < hgt; k++) {
        const r = Math.max(0, 2 - Math.floor(k / (hgt / 3)));
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) + Math.abs(dz) > r) continue;
          set(sx + dx, sh + 1 + k, sz + dz, pid, true);
        }
      }
    }
    chunk.decorated = true;
  };

  function weighted(rng, pairs) {
    let total = 0;
    for (let i = 0; i < pairs.length; i++) total += pairs[i][1];
    let r = rng.next() * total;
    for (let i = 0; i < pairs.length; i++) {
      r -= pairs[i][1];
      if (r <= 0) return pairs[i][0];
    }
    return pairs[0][0];
  }

  /* ---------------- tree shapes ---------------- */

  WorldGen.prototype.tree = function (type, x, y, z, rng, set) {
    const wood = {
      oak: 'oak', big_oak: 'oak', swamp_oak: 'oak', birch: 'birch',
      spruce: 'spruce', mega_spruce: 'spruce', jungle: 'jungle',
      mega_jungle: 'jungle', acacia: 'acacia', dark_oak: 'dark_oak'
    }[type] || 'oak';
    const log = B.idOf(wood + '_log');
    const leaf = B.idOf(wood + '_leaves');

    function blob(cx, cy, cz, rx, ry, corners) {
      for (let dy = -ry; dy <= ry; dy++) {
        for (let dz = -rx; dz <= rx; dz++) {
          for (let dx = -rx; dx <= rx; dx++) {
            const d = (dx * dx + dz * dz) / (rx * rx + 0.1) + (dy * dy) / (ry * ry + 0.1);
            if (d > 1.05) continue;
            if (!corners && Math.abs(dx) === rx && Math.abs(dz) === rx && rng.chance(0.6)) continue;
            set(cx + dx, cy + dy, cz + dz, leaf, true);
          }
        }
      }
    }

    if (type === 'oak' || type === 'birch' || type === 'swamp_oak') {
      const h = (type === 'birch' ? 6 : 5) + rng.int(type === 'swamp_oak' ? 3 : 3);
      for (let k = 0; k < h; k++) set(x, y + k, z, log);
      blob(x, y + h - 1, z, 2, 2, false);
      set(x, y + h, z, leaf, true);
      if (type === 'swamp_oak') {
        // hanging vines
        const vine = B.idOf('vine');
        for (let i = 0; i < 6; i++) {
          const vx = x + rng.intRange(-2, 2), vz = z + rng.intRange(-2, 2);
          const len = 1 + rng.int(4);
          for (let k = 0; k < len; k++) set(vx, y + h - 2 - k, vz, vine, true);
        }
      }
      return;
    }

    if (type === 'big_oak') {
      const h = 8 + rng.int(5);
      for (let k = 0; k < h; k++) {
        set(x, y + k, z, log);
        if (k > 3 && rng.chance(0.35)) {
          const bx = x + rng.intRange(-1, 1), bz = z + rng.intRange(-1, 1);
          set(bx, y + k, bz, log, true);
          blob(bx, y + k + 1, bz, 2, 1, false);
        }
      }
      blob(x, y + h, z, 3, 2, false);
      blob(x, y + h + 2, z, 2, 1, false);
      return;
    }

    if (type === 'spruce' || type === 'mega_spruce') {
      const mega = type === 'mega_spruce';
      const h = mega ? 14 + rng.int(8) : 7 + rng.int(5);
      const w = mega ? 2 : 1;
      for (let k = 0; k < h; k++) {
        for (let dz = 0; dz < w; dz++) for (let dx = 0; dx < w; dx++) set(x + dx, y + k, z + dz, log);
      }
      let r = mega ? 4 : 3;
      const start = mega ? 6 : 2;
      for (let k = start; k < h + 2; k++) {
        const layer = (k - start) % 4;
        const rr = Math.max(0, r - Math.floor((k - start) / 3.5) + (layer === 0 ? 1 : 0));
        for (let dz = -rr; dz <= rr + w - 1; dz++) for (let dx = -rr; dx <= rr + w - 1; dx++) {
          if (Math.abs(dx) + Math.abs(dz) > rr + 1) continue;
          if (dx >= 0 && dx < w && dz >= 0 && dz < w && k < h) continue;
          set(x + dx, y + k, z + dz, leaf, true);
        }
      }
      set(x, y + h + 2, z, leaf, true);
      return;
    }

    if (type === 'jungle' || type === 'mega_jungle') {
      const mega = type === 'mega_jungle';
      const h = mega ? 16 + rng.int(10) : 8 + rng.int(6);
      const w = mega ? 2 : 1;
      for (let k = 0; k < h; k++)
        for (let dz = 0; dz < w; dz++) for (let dx = 0; dx < w; dx++) set(x + dx, y + k, z + dz, log);
      blob(x, y + h, z, mega ? 4 : 3, 2, false);
      if (mega) {
        blob(x + 1, y + h - 4, z + 1, 3, 1, false);
        const vine = B.idOf('vine');
        for (let i = 0; i < 14; i++) {
          const vx = x + rng.intRange(-4, 4), vz = z + rng.intRange(-4, 4);
          const len = 2 + rng.int(7);
          for (let k = 0; k < len; k++) set(vx, y + h - 2 - k, vz, vine, true);
        }
      }
      return;
    }

    if (type === 'acacia') {
      const h = 5 + rng.int(3);
      for (let k = 0; k < h; k++) set(x, y + k, z, log);
      const dx = rng.chance(0.5) ? 1 : -1, dz = rng.chance(0.5) ? 1 : -1;
      let bx = x, bz = z;
      for (let k = 0; k < 3; k++) {
        bx += dx; bz += (k % 2) ? dz : 0;
        set(bx, y + h + k - 1, bz, log, true);
      }
      // flat umbrella canopy
      for (let dzz = -3; dzz <= 3; dzz++) for (let dxx = -3; dxx <= 3; dxx++) {
        if (Math.abs(dxx) + Math.abs(dzz) > 4) continue;
        set(bx + dxx, y + h + 2, bz + dzz, leaf, true);
        if (Math.abs(dxx) + Math.abs(dzz) < 3) set(bx + dxx, y + h + 3, bz + dzz, leaf, true);
      }
      return;
    }

    if (type === 'dark_oak') {
      const h = 6 + rng.int(3);
      for (let k = 0; k < h; k++)
        for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) set(x + dx, y + k, z + dz, log);
      for (let dzz = -3; dzz <= 4; dzz++) for (let dxx = -3; dxx <= 4; dxx++) {
        const d = Math.abs(dxx - 0.5) + Math.abs(dzz - 0.5);
        if (d > 4.6) continue;
        set(x + dxx, y + h, z + dzz, leaf, true);
        if (d < 3.2) set(x + dxx, y + h + 1, z + dzz, leaf, true);
        if (d < 2.2) set(x + dxx, y + h - 1, z + dzz, leaf, true);
      }
      return;
    }
  };

  MC.WorldGen = WorldGen;
})();
