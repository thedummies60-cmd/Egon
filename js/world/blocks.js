/* ============================================================
 * blocks.js - the block registry.
 * Every block gets a numeric id (what chunks store) plus the
 * physical / visual / mining properties the rest of the game reads.
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});

  const list = [];          // index == id
  const byName = Object.create(null);

  const TINT = { NONE: 0, GRASS: 1, FOLIAGE: 2, WATER: 3 };
  MC.TINT = TINT;

  function def(name, o) {
    o = o || {};
    const b = {
      id: list.length,
      name: name,
      display: o.display || name.replace(/_/g, ' ').replace(/\b\w/g, function (m) { return m.toUpperCase(); }),
      tex: o.tex || name,
      render: o.render || 'cube',       // cube | cross | liquid | none
      solid: o.solid !== undefined ? o.solid : true,
      opaque: o.opaque !== undefined ? o.opaque : (o.render ? false : true),
      lightFilter: o.lightFilter || 0,  // extra light lost passing through
      light: o.light || 0,              // light emitted
      hardness: o.hardness === undefined ? 1 : o.hardness,
      tool: o.tool || null,
      level: o.level || 0,              // tool tier needed to drop anything
      drop: o.drop === undefined ? name : o.drop,
      dropCount: o.dropCount || 1,
      tint: o.tint || TINT.NONE,
      tintFaces: o.tintFaces || 'all',
      overlay: o.overlay || null,       // side overlay texture (grass fringe)
      gravity: !!o.gravity,
      replaceable: !!o.replaceable,
      collide: o.collide !== undefined ? o.collide : (o.render === 'cross' || o.render === 'liquid' ? false : true),
      liquid: o.render === 'liquid',
      group: o.group || 'building',
      fuel: o.fuel || 0,                // furnace burn ticks
      smelt: o.smelt || null,           // { to: name, xp: n }
      sound: o.sound || 'stone',
      flammable: !!o.flammable,
      needsSupport: !!o.needsSupport,   // breaks if the block below is removed
      hidden: !!o.hidden,               // kept out of the creative menu
      unbreakable: !!o.unbreakable,
      itemTex: o.itemTex || null,
      maxStack: o.maxStack || 64
    };
    list.push(b);
    byName[name] = b;
    return b;
  }

  /* ---------------- air ---------------- */
  def('air', { render: 'none', solid: false, opaque: false, collide: false, replaceable: true, hardness: 0, drop: null, hidden: true });

  /* ---------------- stone family ---------------- */
  def('stone', { hardness: 1.5, tool: 'pickaxe', level: 1, drop: 'cobblestone', smelt: { to: 'stone', xp: 0.1 } });
  def('granite', { hardness: 1.5, tool: 'pickaxe', level: 1 });
  def('polished_granite', { hardness: 1.5, tool: 'pickaxe', level: 1 });
  def('diorite', { hardness: 1.5, tool: 'pickaxe', level: 1 });
  def('polished_diorite', { hardness: 1.5, tool: 'pickaxe', level: 1 });
  def('andesite', { hardness: 1.5, tool: 'pickaxe', level: 1 });
  def('polished_andesite', { hardness: 1.5, tool: 'pickaxe', level: 1 });
  def('cobblestone', { hardness: 2, tool: 'pickaxe', level: 1, smelt: { to: 'stone', xp: 0.1 } });
  def('mossy_cobblestone', { hardness: 2, tool: 'pickaxe', level: 1 });
  def('deepslate', { hardness: 3, tool: 'pickaxe', level: 1, drop: 'cobbled_deepslate' });
  def('cobbled_deepslate', { hardness: 3.5, tool: 'pickaxe', level: 1 });
  def('deepslate_bricks', { hardness: 3.5, tool: 'pickaxe', level: 1 });
  def('tuff', { hardness: 1.5, tool: 'pickaxe', level: 1 });
  def('calcite', { hardness: 0.75, tool: 'pickaxe', level: 1 });
  def('bedrock', { hardness: -1, unbreakable: true, drop: null, group: 'misc' });
  def('obsidian', { hardness: 50, tool: 'pickaxe', level: 4 });
  def('netherrack', { hardness: 0.4, tool: 'pickaxe', level: 1, sound: 'stone' });
  def('magma', { hardness: 0.5, tool: 'pickaxe', level: 1, light: 3, tex: 'magma', display: 'Magma Block' });

  /* ---------------- earth ---------------- */
  def('grass_block', {
    tex: { top: 'grass_top', bottom: 'dirt', side: 'dirt' },
    overlay: 'grass_side_overlay',
    tint: TINT.GRASS, tintFaces: 'top',
    hardness: 0.6, tool: 'shovel', drop: 'dirt', sound: 'grass', group: 'nature'
  });
  def('dirt', { hardness: 0.5, tool: 'shovel', sound: 'gravel', group: 'nature' });
  def('coarse_dirt', { hardness: 0.5, tool: 'shovel', sound: 'gravel', group: 'nature' });
  def('rooted_dirt', { hardness: 0.5, tool: 'shovel', sound: 'gravel', group: 'nature' });
  def('mud', { hardness: 0.5, tool: 'shovel', sound: 'gravel', group: 'nature' });
  def('podzol', { tex: { top: 'podzol_top', bottom: 'dirt', side: 'podzol_side' }, hardness: 0.5, tool: 'shovel', drop: 'dirt', sound: 'grass', group: 'nature' });
  def('mycelium', { tex: { top: 'mycelium_top', bottom: 'dirt', side: 'mycelium_side' }, hardness: 0.5, tool: 'shovel', drop: 'dirt', sound: 'grass', group: 'nature' });
  def('moss_block', { hardness: 0.4, tool: 'hoe', sound: 'grass', group: 'nature' });
  def('farmland', { tex: { top: 'farmland', bottom: 'dirt', side: 'dirt' }, hardness: 0.6, tool: 'shovel', drop: 'dirt', sound: 'gravel', group: 'nature', hidden: true });
  def('gravel', { hardness: 0.6, tool: 'shovel', gravity: true, sound: 'gravel', group: 'nature' });
  def('clay', { hardness: 0.6, tool: 'shovel', drop: 'clay_ball', dropCount: 4, sound: 'gravel', group: 'nature' });
  def('sand', { hardness: 0.5, tool: 'shovel', gravity: true, sound: 'sand', group: 'nature', smelt: { to: 'glass', xp: 0.1 } });
  def('red_sand', { hardness: 0.5, tool: 'shovel', gravity: true, sound: 'sand', group: 'nature', smelt: { to: 'glass', xp: 0.1 } });
  def('snow_block', { tex: 'snow', hardness: 0.2, tool: 'shovel', sound: 'snow', group: 'nature' });

  /* ---------------- sandstone / terracotta ---------------- */
  def('sandstone', { tex: { top: 'sandstone_top', bottom: 'sandstone_bottom', side: 'sandstone_side' }, hardness: 0.8, tool: 'pickaxe', level: 1 });
  def('cut_sandstone', { tex: { top: 'sandstone_top', bottom: 'sandstone_top', side: 'cut_sandstone' }, hardness: 0.8, tool: 'pickaxe', level: 1 });
  def('chiseled_sandstone', { tex: { top: 'sandstone_top', bottom: 'sandstone_top', side: 'chiseled_sandstone' }, hardness: 0.8, tool: 'pickaxe', level: 1 });
  def('red_sandstone', { tex: { top: 'red_sandstone_top', bottom: 'red_sandstone_bottom', side: 'red_sandstone_side' }, hardness: 0.8, tool: 'pickaxe', level: 1 });
  ['terracotta', 'white_terracotta', 'orange_terracotta', 'yellow_terracotta', 'brown_terracotta',
   'red_terracotta', 'light_gray_terracotta', 'purple_terracotta', 'cyan_terracotta'].forEach(function (n) {
    def(n, { hardness: 1.25, tool: 'pickaxe', level: 1 });
  });

  /* ---------------- ores & mineral blocks ---------------- */
  def('coal_ore', { hardness: 3, tool: 'pickaxe', level: 1, drop: 'coal', group: 'nature', smelt: { to: 'coal', xp: 0.1 } });
  def('iron_ore', { hardness: 3, tool: 'pickaxe', level: 2, drop: 'raw_iron', group: 'nature', smelt: { to: 'iron_ingot', xp: 0.7 } });
  def('copper_ore', { hardness: 3, tool: 'pickaxe', level: 2, drop: 'raw_copper', dropCount: 3, group: 'nature', smelt: { to: 'copper_ingot', xp: 0.7 } });
  def('gold_ore', { hardness: 3, tool: 'pickaxe', level: 3, drop: 'raw_gold', group: 'nature', smelt: { to: 'gold_ingot', xp: 1 } });
  def('redstone_ore', { hardness: 3, tool: 'pickaxe', level: 3, drop: 'redstone', dropCount: 4, light: 0, group: 'nature' });
  def('lapis_ore', { hardness: 3, tool: 'pickaxe', level: 2, drop: 'lapis_lazuli', dropCount: 6, group: 'nature' });
  def('diamond_ore', { hardness: 3, tool: 'pickaxe', level: 3, drop: 'diamond', group: 'nature' });
  def('emerald_ore', { hardness: 3, tool: 'pickaxe', level: 3, drop: 'emerald', group: 'nature' });
  def('deepslate_coal_ore', { hardness: 4.5, tool: 'pickaxe', level: 1, drop: 'coal', group: 'nature' });
  def('deepslate_iron_ore', { hardness: 4.5, tool: 'pickaxe', level: 2, drop: 'raw_iron', group: 'nature' });
  def('deepslate_gold_ore', { hardness: 4.5, tool: 'pickaxe', level: 3, drop: 'raw_gold', group: 'nature' });
  def('deepslate_redstone_ore', { hardness: 4.5, tool: 'pickaxe', level: 3, drop: 'redstone', dropCount: 4, group: 'nature' });
  def('deepslate_lapis_ore', { hardness: 4.5, tool: 'pickaxe', level: 2, drop: 'lapis_lazuli', dropCount: 6, group: 'nature' });
  def('deepslate_diamond_ore', { hardness: 4.5, tool: 'pickaxe', level: 3, drop: 'diamond', group: 'nature' });
  def('deepslate_emerald_ore', { hardness: 4.5, tool: 'pickaxe', level: 3, drop: 'emerald', group: 'nature' });
  def('coal_block', { hardness: 5, tool: 'pickaxe', level: 1, fuel: 1600 });
  def('iron_block', { hardness: 5, tool: 'pickaxe', level: 1 });
  def('gold_block', { hardness: 3, tool: 'pickaxe', level: 3 });
  def('diamond_block', { hardness: 5, tool: 'pickaxe', level: 3 });
  def('emerald_block', { hardness: 5, tool: 'pickaxe', level: 3 });
  def('lapis_block', { hardness: 3, tool: 'pickaxe', level: 1 });
  def('redstone_block', { hardness: 5, tool: 'pickaxe', level: 1 });
  def('copper_block', { hardness: 3, tool: 'pickaxe', level: 1 });
  def('quartz_block', { hardness: 0.8, tool: 'pickaxe', level: 1 });
  def('bone_block', { hardness: 2, tool: 'pickaxe', level: 1 });

  /* ---------------- wood ---------------- */
  const WOODS = ['oak', 'birch', 'spruce', 'jungle', 'acacia', 'dark_oak'];
  MC.WOOD_TYPES = WOODS;
  WOODS.forEach(function (w) {
    def(w + '_log', {
      tex: { top: w + '_log_top', bottom: w + '_log_top', side: w + '_log_side' },
      hardness: 2, tool: 'axe', sound: 'wood', group: 'nature', flammable: true, fuel: 300,
      smelt: { to: 'charcoal', xp: 0.15 }
    });
    def(w + '_planks', { hardness: 2, tool: 'axe', sound: 'wood', flammable: true, fuel: 300 });
    def(w + '_leaves', {
      opaque: false, render: 'cube', lightFilter: 1, tint: TINT.FOLIAGE,
      hardness: 0.2, tool: 'shears', drop: null, sound: 'grass', group: 'nature', flammable: true
    });
    def(w + '_sapling', {
      render: 'cross', solid: false, opaque: false, collide: false, needsSupport: true,
      hardness: 0, sound: 'grass', group: 'nature', flammable: true
    });
  });
  def('azalea_leaves', { opaque: false, lightFilter: 1, tint: TINT.FOLIAGE, hardness: 0.2, tool: 'shears', drop: null, sound: 'grass', group: 'nature' });
  def('bookshelf', { tex: { top: 'oak_planks', bottom: 'oak_planks', side: 'bookshelf' }, hardness: 1.5, tool: 'axe', drop: 'book', dropCount: 3, sound: 'wood', flammable: true, fuel: 300 });

  /* ---------------- wool ---------------- */
  Object.keys(MC.DYES).forEach(function (k) {
    def(k + '_wool', { hardness: 0.8, tool: 'shears', sound: 'wool', flammable: true, group: 'building' });
  });

  /* ---------------- glass / ice / light ---------------- */
  def('glass', { opaque: false, hardness: 0.3, drop: null, sound: 'glass' });
  def('ice', { opaque: false, lightFilter: 1, hardness: 0.5, tool: 'pickaxe', drop: null, sound: 'glass', group: 'nature' });
  def('packed_ice', { hardness: 0.5, tool: 'pickaxe', drop: null, sound: 'glass', group: 'nature' });
  def('blue_ice', { hardness: 2.8, tool: 'pickaxe', drop: null, sound: 'glass', group: 'nature' });
  def('glowstone', { light: 15, hardness: 0.3, drop: 'glowstone_dust', dropCount: 3, sound: 'glass' });
  def('sea_lantern', { light: 15, hardness: 0.3, sound: 'glass' });
  def('sponge', { hardness: 0.6, tool: 'hoe', group: 'misc' });

  /* ---------------- built blocks ---------------- */
  def('bricks', { hardness: 2, tool: 'pickaxe', level: 1 });
  def('stone_bricks', { hardness: 1.5, tool: 'pickaxe', level: 1 });
  def('mossy_stone_bricks', { hardness: 1.5, tool: 'pickaxe', level: 1 });
  def('cracked_stone_bricks', { hardness: 1.5, tool: 'pickaxe', level: 1 });
  def('chiseled_stone_bricks', { hardness: 1.5, tool: 'pickaxe', level: 1 });
  def('nether_bricks', { hardness: 2, tool: 'pickaxe', level: 1 });
  def('hay_block', { tex: { top: 'hay_top', bottom: 'hay_top', side: 'hay_side' }, hardness: 0.5, sound: 'grass', flammable: true, group: 'nature' });
  def('tnt', { tex: { top: 'tnt_top', bottom: 'tnt_bottom', side: 'tnt_side' }, hardness: 0, sound: 'grass', group: 'misc' });
  def('crafting_table', {
    tex: { top: 'crafting_table_top', bottom: 'oak_planks', side: 'crafting_table_side', front: 'crafting_table_front' },
    hardness: 2.5, tool: 'axe', sound: 'wood', flammable: true, fuel: 300, group: 'misc'
  });
  def('furnace', {
    tex: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front' },
    hardness: 3.5, tool: 'pickaxe', level: 1, group: 'misc'
  });
  def('furnace_lit', {
    tex: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front_on' },
    hardness: 3.5, tool: 'pickaxe', level: 1, light: 13, drop: 'furnace', hidden: true
  });
  def('chest', {
    tex: { top: 'chest_top', bottom: 'chest_top', side: 'chest_side', front: 'chest_front' },
    hardness: 2.5, tool: 'axe', sound: 'wood', flammable: true, fuel: 300, group: 'misc'
  });
  def('ladder', { render: 'cross', opaque: false, solid: false, collide: false, hardness: 0.4, tool: 'axe', sound: 'wood', group: 'misc' });
  def('torch', {
    render: 'cross', solid: false, opaque: false, collide: false, light: 14,
    hardness: 0, needsSupport: true, sound: 'wood', group: 'misc'
  });

  /* ---------------- crops & plants ---------------- */
  def('cactus', {
    tex: { top: 'cactus_top', bottom: 'cactus_bottom', side: 'cactus_side' },
    opaque: false, hardness: 0.4, sound: 'grass', group: 'nature', needsSupport: true
  });
  def('sugar_cane', {
    render: 'cross', solid: false, opaque: false, collide: false, hardness: 0,
    needsSupport: true, sound: 'grass', group: 'nature', tint: TINT.FOLIAGE
  });
  def('pumpkin', { tex: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side' }, hardness: 1, tool: 'axe', sound: 'wood', group: 'nature' });
  def('carved_pumpkin', { tex: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side', front: 'pumpkin_face' }, hardness: 1, tool: 'axe', sound: 'wood', group: 'nature' });
  def('jack_o_lantern', { tex: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side', front: 'jack_o_lantern' }, light: 15, hardness: 1, tool: 'axe', sound: 'wood', group: 'nature' });
  def('melon', { tex: { top: 'melon_top', bottom: 'melon_top', side: 'melon_side' }, hardness: 1, tool: 'axe', drop: 'melon_slice', dropCount: 5, sound: 'wood', group: 'nature' });
  def('short_grass', {
    render: 'cross', solid: false, opaque: false, collide: false, replaceable: true,
    tint: TINT.GRASS, hardness: 0, drop: null, needsSupport: true, sound: 'grass', group: 'nature', flammable: true
  });
  def('fern', {
    render: 'cross', solid: false, opaque: false, collide: false, replaceable: true,
    tint: TINT.GRASS, hardness: 0, drop: null, needsSupport: true, sound: 'grass', group: 'nature'
  });
  def('tall_grass', {
    tex: 'tall_grass_top', render: 'cross', solid: false, opaque: false, collide: false, replaceable: true,
    tint: TINT.GRASS, hardness: 0, drop: null, needsSupport: true, sound: 'grass', group: 'nature'
  });
  def('dead_bush', { render: 'cross', solid: false, opaque: false, collide: false, hardness: 0, drop: 'stick', needsSupport: true, sound: 'grass', group: 'nature' });
  def('vine', { render: 'cross', solid: false, opaque: false, collide: false, tint: TINT.FOLIAGE, hardness: 0.2, drop: null, sound: 'grass', group: 'nature' });
  ['dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip',
   'white_tulip', 'pink_tulip', 'oxeye_daisy', 'cornflower', 'lily_of_the_valley'].forEach(function (f) {
    def(f, { render: 'cross', solid: false, opaque: false, collide: false, hardness: 0, needsSupport: true, sound: 'grass', group: 'nature' });
  });
  def('brown_mushroom', { render: 'cross', solid: false, opaque: false, collide: false, light: 1, hardness: 0, needsSupport: true, sound: 'grass', group: 'nature' });
  def('red_mushroom', { render: 'cross', solid: false, opaque: false, collide: false, hardness: 0, needsSupport: true, sound: 'grass', group: 'nature' });
  def('wheat', {
    tex: 'wheat_3', render: 'cross', solid: false, opaque: false, collide: false,
    hardness: 0, drop: 'wheat', needsSupport: true, sound: 'grass', hidden: true
  });

  /* ---------------- liquids (always last-ish, they are special) ---------------- */
  def('water', {
    tex: 'water_still', render: 'liquid', solid: false, opaque: false, collide: false,
    replaceable: true, lightFilter: 1, tint: TINT.WATER, hardness: -1, unbreakable: true,
    drop: null, group: 'misc', sound: 'water'
  });
  def('lava', {
    tex: 'lava_still', render: 'liquid', solid: false, opaque: false, collide: false,
    replaceable: true, lightFilter: 0, light: 15, hardness: -1, unbreakable: true,
    drop: null, group: 'misc', sound: 'lava'
  });

  /* ------------------------------------------------------------------ */
  const B = {};
  list.forEach(function (b) { B[b.name.toUpperCase()] = b.id; });

  MC.blocks = {
    list: list,
    byName: byName,
    ID: B,
    get: function (id) { return list[id] || list[0]; },
    idOf: function (name) { const b = byName[name]; return b ? b.id : 0; },
    isOpaque: function (id) { return list[id].opaque; },
    isSolid: function (id) { return list[id].collide; },
    isLiquid: function (id) { return list[id].liquid; },
    isAir: function (id) { return id === 0; },
    count: function () { return list.length; }
  };

  // fast lookup arrays - the mesher and the physics loop hammer these
  MC.blocks.buildTables = function () {
    const n = list.length;
    const opaque = new Uint8Array(n), solid = new Uint8Array(n), light = new Uint8Array(n);
    const filter = new Uint8Array(n), render = new Uint8Array(n), tint = new Uint8Array(n);
    const RMAP = { none: 0, cube: 1, cross: 2, liquid: 3 };
    for (let i = 0; i < n; i++) {
      opaque[i] = list[i].opaque ? 1 : 0;
      solid[i] = list[i].collide ? 1 : 0;
      light[i] = list[i].light;
      filter[i] = list[i].lightFilter;
      render[i] = RMAP[list[i].render];
      tint[i] = list[i].tint;
    }
    MC.blocks.T = { opaque, solid, light, filter, render, tint };
    return MC.blocks.T;
  };
  MC.blocks.buildTables();
})();
