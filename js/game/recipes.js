/* ============================================================
 * recipes.js - crafting, smelting and furnace fuel.
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});

  const shaped = [];      // { rows, key, out, count }
  const shapeless = [];   // { items: [name...], out, count }

  function S(rows, key, out, count) { shaped.push({ rows: rows, key: key, out: out, count: count || 1 }); }
  function SL(items, out, count) { shapeless.push({ items: items, out: out, count: count || 1 }); }

  const WOODS = MC.WOOD_TYPES;
  const TOOLS = ['wooden', 'stone', 'iron', 'golden', 'diamond'];
  const TOOL_MAT = {
    wooden: 'oak_planks', stone: 'cobblestone', iron: 'iron_ingot',
    golden: 'gold_ingot', diamond: 'diamond'
  };

  /* ---- wood ---- */
  WOODS.forEach(function (w) {
    SL([w + '_log'], w + '_planks', 4);
    S(['##', '##'], { '#': w + '_planks' }, 'crafting_table', 1);
  });
  WOODS.forEach(function (w) {
    S(['#', '#'], { '#': w + '_planks' }, 'stick', 4);
  });

  /* ---- basics ---- */
  S(['###', '# #', '###'], { '#': 'cobblestone' }, 'furnace', 1);
  S(['###', '# #', '###'], { '#': 'oak_planks' }, 'chest', 1);
  S(['X', '#'], { X: 'coal', '#': 'stick' }, 'torch', 4);
  S(['X', '#'], { X: 'charcoal', '#': 'stick' }, 'torch', 4);
  S(['# #', '###', '# #'], { '#': 'stick' }, 'ladder', 3);
  S(['# #', ' # '], { '#': 'oak_planks' }, 'bowl', 4);
  S(['##', '##'], { '#': 'stone' }, 'stone_bricks', 4);
  S(['##', '##'], { '#': 'brick' }, 'bricks', 1);
  S(['##', '##'], { '#': 'sand' }, 'sandstone', 1);
  S(['##', '##'], { '#': 'red_sand' }, 'red_sandstone', 1);
  S(['###', '###', '###'], { '#': 'wheat' }, 'hay_block', 1);
  S(['##', '##'], { '#': 'string' }, 'white_wool', 1);
  S(['###', '###', '###'], { '#': 'melon_slice' }, 'melon', 1);
  S(['##', '##'], { '#': 'glowstone_dust' }, 'glowstone', 1);
  S(['X#X', '#X#', 'X#X'], { X: 'gunpowder', '#': 'sand' }, 'tnt', 1);
  S(['###', '#X#', '###'], { '#': 'oak_planks', X: 'book' }, 'bookshelf', 1);
  SL(['paper', 'paper', 'paper', 'leather'], 'book', 1);
  S(['###'], { '#': 'sugar_cane' }, 'paper', 3);
  SL(['sugar_cane'], 'sugar', 1);
  SL(['pumpkin', 'torch'], 'jack_o_lantern', 1);
  SL(['pumpkin', 'shears'], 'carved_pumpkin', 1);
  SL(['brown_mushroom', 'red_mushroom', 'bowl'], 'mushroom_stew', 1);
  S(['###'], { '#': 'wheat' }, 'bread', 1);
  SL(['wheat', 'wheat', 'sugar'], 'cookie', 8);
  S([' # ', '#X#', ' # '], { '#': 'iron_ingot', X: 'flint' }, 'flint_and_steel', 1);
  SL(['iron_ingot', 'flint'], 'flint_and_steel', 1);
  S(['# #', ' # '], { '#': 'iron_ingot' }, 'bucket', 1);
  S([' #', '# '], { '#': 'iron_ingot' }, 'shears', 1);
  S([' X#', 'X #', ' X#'], { X: 'stick', '#': 'string' }, 'bow', 1);
  S(['X', '#', 'F'], { X: 'flint', '#': 'stick', F: 'feather' }, 'arrow', 4);
  S(['##', '##'], { '#': 'stone_bricks' }, 'chiseled_stone_bricks', 4);
  S(['##', '##'], { '#': 'granite' }, 'polished_granite', 4);
  S(['##', '##'], { '#': 'diorite' }, 'polished_diorite', 4);
  S(['##', '##'], { '#': 'andesite' }, 'polished_andesite', 4);
  S(['##', '##'], { '#': 'sandstone' }, 'cut_sandstone', 4);
  SL(['cobblestone', 'moss_block'], 'mossy_cobblestone', 1);
  SL(['stone_bricks', 'moss_block'], 'mossy_stone_bricks', 1);
  SL(['clay_ball', 'clay_ball', 'clay_ball', 'clay_ball'], 'clay', 1);
  SL(['snowball', 'snowball', 'snowball', 'snowball'], 'snow_block', 1);

  /* ---- compact / uncompact ---- */
  const BLOCKS9 = [
    ['coal', 'coal_block'], ['iron_ingot', 'iron_block'], ['gold_ingot', 'gold_block'],
    ['diamond', 'diamond_block'], ['emerald', 'emerald_block'], ['lapis_lazuli', 'lapis_block'],
    ['redstone', 'redstone_block'], ['copper_ingot', 'copper_block']
  ];
  BLOCKS9.forEach(function (p) {
    S(['###', '###', '###'], { '#': p[0] }, p[1], 1);
    SL([p[1]], p[0], 9);
  });

  /* ---- tools, weapons, armour ---- */
  TOOLS.forEach(function (m) {
    const X = TOOL_MAT[m];
    S(['XXX', ' # ', ' # '], { X: X, '#': 'stick' }, m + '_pickaxe', 1);
    S(['XX', 'X#', ' #'], { X: X, '#': 'stick' }, m + '_axe', 1);
    S(['XX', '#X', '# '], { X: X, '#': 'stick' }, m + '_axe', 1);
    S(['X', '#', '#'], { X: X, '#': 'stick' }, m + '_shovel', 1);
    S(['XX', ' #', ' #'], { X: X, '#': 'stick' }, m + '_hoe', 1);
    S(['XX', '# ', '# '], { X: X, '#': 'stick' }, m + '_hoe', 1);
    S(['X', 'X', '#'], { X: X, '#': 'stick' }, m + '_sword', 1);
  });
  const ARMOR_MAT = { leather: 'leather', iron: 'iron_ingot', golden: 'gold_ingot', diamond: 'diamond' };
  Object.keys(ARMOR_MAT).forEach(function (m) {
    const X = ARMOR_MAT[m];
    S(['XXX', 'X X'], { X: X }, m + '_helmet', 1);
    S(['X X', 'XXX', 'XXX'], { X: X }, m + '_chestplate', 1);
    S(['XXX', 'X X', 'X X'], { X: X }, m + '_leggings', 1);
    S(['X X', 'X X'], { X: X }, m + '_boots', 1);
  });

  /* ---- wool dyeing (any wool + dye-ish item) ---- */
  const DYE_SOURCE = {
    red: 'poppy', yellow: 'dandelion', blue: 'lapis_lazuli', white: 'bone',
    green: 'cactus', brown: 'cocoa_beans', black: 'charcoal', pink: 'pink_tulip',
    orange: 'orange_tulip', light_blue: 'blue_orchid', magenta: 'allium', purple: 'allium'
  };
  Object.keys(DYE_SOURCE).forEach(function (c) {
    const src = DYE_SOURCE[c];
    if (!MC.thing(src)) return;
    SL(['white_wool', src], c + '_wool', 1);
  });

  /* ============================================================
   * matching
   * ============================================================ */

  function trim(grid, size) {
    let minX = size, minY = size, maxX = -1, maxY = -1;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (grid[y * size + x]) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return null;
    const w = maxX - minX + 1, h = maxY - minY + 1;
    const out = [];
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) row.push(grid[(minY + y) * size + (minX + x)]);
      out.push(row);
    }
    return { rows: out, w: w, h: h };
  }

  function keyLookup(key, ch) {
    if (ch === ' ') return null;
    return key[ch] || null;
  }

  function matchShaped(t, r) {
    const rh = r.rows.length, rw = r.rows[0].length;
    if (rh !== t.h || rw !== t.w) return false;
    for (let y = 0; y < rh; y++) {
      for (let x = 0; x < rw; x++) {
        const want = keyLookup(r.key, r.rows[y][x] || ' ');
        const got = t.rows[y][x];
        if (want === null && got === null) continue;
        if (want === null || got === null) return false;
        if (want !== got) return false;
      }
    }
    return true;
  }

  function matchShapeless(grid, r) {
    const have = grid.filter(function (n) { return n; }).slice();
    if (have.length !== r.items.length) return false;
    const want = r.items.slice();
    for (let i = 0; i < have.length; i++) {
      const j = want.indexOf(have[i]);
      if (j < 0) return false;
      want.splice(j, 1);
    }
    return true;
  }

  MC.recipes = {
    shaped: shaped,
    shapeless: shapeless,

    match: function (grid, size) {
      const t = trim(grid, size);
      if (!t) return null;
      for (let i = 0; i < shaped.length; i++) {
        const r = shaped[i];
        if (r.rows.length > size) continue;
        if (matchShaped(t, r)) return { name: r.out, count: r.count };
      }
      for (let i = 0; i < shapeless.length; i++) {
        if (matchShapeless(grid, shapeless[i])) {
          return { name: shapeless[i].out, count: shapeless[i].count };
        }
      }
      return null;
    },

    /* ---- smelting ---- */
    smelt: function (name) {
      const b = MC.blocks.byName[name];
      if (b && b.smelt) return { name: b.smelt.to, count: 1, xp: b.smelt.xp };
      const S2 = SMELT[name];
      return S2 ? { name: S2[0], count: 1, xp: S2[1] } : null;
    },

    fuel: function (name) {
      const t = MC.thing(name);
      if (!t) return 0;
      if (t.fuel) return t.fuel;
      if (t.isBlock && /planks|_log$|bookshelf|crafting_table|chest|wool/.test(name)) return 300;
      if (name === 'lava_bucket') return 20000;
      return 0;
    },

    /* every recipe that produces this item, for the recipe book */
    producing: function (name) {
      const out = [];
      for (let i = 0; i < shaped.length; i++) if (shaped[i].out === name) out.push({ type: 'shaped', r: shaped[i] });
      for (let i = 0; i < shapeless.length; i++) if (shapeless[i].out === name) out.push({ type: 'shapeless', r: shapeless[i] });
      return out;
    }
  };

  const SMELT = {
    raw_iron: ['iron_ingot', 0.7], raw_gold: ['gold_ingot', 1.0], raw_copper: ['copper_ingot', 0.7],
    beef: ['cooked_beef', 0.35], porkchop: ['cooked_porkchop', 0.35],
    chicken: ['cooked_chicken', 0.35], mutton: ['cooked_mutton', 0.35],
    potato: ['baked_potato', 0.35], clay_ball: ['brick', 0.3],
    sand: ['glass', 0.1], red_sand: ['glass', 0.1], cobblestone: ['stone', 0.1],
    stone: ['smooth_stone', 0.1], clay: ['terracotta', 0.35],
    oak_log: ['charcoal', 0.15], birch_log: ['charcoal', 0.15], spruce_log: ['charcoal', 0.15],
    jungle_log: ['charcoal', 0.15], acacia_log: ['charcoal', 0.15], dark_oak_log: ['charcoal', 0.15],
    coal_ore: ['coal', 0.1], iron_ore: ['iron_ingot', 0.7], gold_ore: ['gold_ingot', 1.0],
    copper_ore: ['copper_ingot', 0.7], diamond_ore: ['diamond', 1.0], emerald_ore: ['emerald', 1.0],
    lapis_ore: ['lapis_lazuli', 0.2], redstone_ore: ['redstone', 0.7],
    deepslate_iron_ore: ['iron_ingot', 0.7], deepslate_gold_ore: ['gold_ingot', 1.0],
    deepslate_diamond_ore: ['diamond', 1.0], deepslate_emerald_ore: ['emerald', 1.0],
    cactus: ['green_dye', 0.2], mud: ['terracotta', 0.1]
  };
  // drop entries whose product doesn't exist in this build
  Object.keys(SMELT).forEach(function (k) { if (!MC.thing(SMELT[k][0])) delete SMELT[k]; });
})();
