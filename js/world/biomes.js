/* ============================================================
 * biomes.js - biome table + climate lookup.
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});

  const list = [];
  const byName = {};

  function biome(name, o) {
    const b = {
      id: list.length,
      name: name,
      display: o.display || name.replace(/_/g, ' ').replace(/\b\w/g, function (m) { return m.toUpperCase(); }),
      surface: o.surface || 'grass_block',
      filler: o.filler || 'dirt',
      fillerDepth: o.fillerDepth === undefined ? 3 : o.fillerDepth,
      underwater: o.underwater || 'dirt',
      grass: o.grass || 0x91bd59,
      foliage: o.foliage || 0x77ab2f,
      water: o.water || 0x3f76e4,
      temperature: o.temperature === undefined ? 0.5 : o.temperature,
      downfall: o.downfall === undefined ? 0.4 : o.downfall,
      trees: o.trees || null,            // [[type, weight], ...]
      treeChance: o.treeChance || 0,     // per column probability
      grassChance: o.grassChance || 0,
      flowerChance: o.flowerChance || 0,
      flowers: o.flowers || ['dandelion', 'poppy'],
      cactusChance: o.cactusChance || 0,
      deadBushChance: o.deadBushChance || 0,
      sugarCaneChance: o.sugarCaneChance || 0,
      pumpkinChance: o.pumpkinChance || 0,
      melonChance: o.melonChance || 0,
      mushroomChance: o.mushroomChance || 0,
      boulderChance: o.boulderChance || 0,
      lilyChance: o.lilyChance || 0,
      snow: !!o.snow,
      ice: !!o.ice,
      ocean: !!o.ocean,
      river: !!o.river,
      terracottaBands: !!o.terracottaBands,
      mobs: o.mobs || ['sheep', 'cow', 'pig', 'chicken'],
      music: o.music || 'calm'
    };
    list.push(b);
    byName[name] = b;
    return b;
  }

  const FLOWERS_PLAINS = ['dandelion', 'poppy', 'azure_bluet', 'oxeye_daisy', 'cornflower',
                          'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip'];

  /* ---------------- oceans & rivers ---------------- */
  biome('deep_ocean', { ocean: true, surface: 'gravel', filler: 'gravel', underwater: 'gravel', grass: 0x8eb971, foliage: 0x71a74d, water: 0x3d57d6, mobs: [] });
  biome('ocean', { ocean: true, surface: 'sand', filler: 'sand', underwater: 'sand', grass: 0x8eb971, foliage: 0x71a74d, mobs: [] });
  biome('warm_ocean', { ocean: true, surface: 'sand', filler: 'sand', underwater: 'sand', water: 0x43d5ee, temperature: 0.9, grass: 0xbfb755, foliage: 0xaea42a, mobs: [] });
  biome('frozen_ocean', { ocean: true, surface: 'gravel', filler: 'gravel', underwater: 'gravel', water: 0x3938c9, temperature: 0, snow: true, ice: true, grass: 0x80b497, foliage: 0x60a17b, mobs: [] });
  biome('river', { river: true, surface: 'sand', filler: 'sand', underwater: 'sand', grass: 0x8eb971, foliage: 0x71a74d, mobs: [] });
  biome('beach', { surface: 'sand', filler: 'sand', fillerDepth: 4, underwater: 'sand', grass: 0xbfb755, foliage: 0xaea42a, temperature: 0.8, mobs: ['pig', 'chicken'] });
  biome('stony_shore', { surface: 'stone', filler: 'stone', underwater: 'stone', grass: 0x8eb971, foliage: 0x71a74d, mobs: [] });
  biome('snowy_beach', { surface: 'snow_block', filler: 'sand', underwater: 'sand', snow: true, temperature: 0.05, grass: 0x80b497, foliage: 0x60a17b, mobs: ['rabbit'] });

  /* ---------------- temperate ---------------- */
  biome('plains', {
    grass: 0x91bd59, foliage: 0x77ab2f, treeChance: 0.006, trees: [['oak', 8], ['birch', 1]],
    grassChance: 0.34, flowerChance: 0.045, flowers: FLOWERS_PLAINS, pumpkinChance: 0.0016,
    mobs: ['sheep', 'cow', 'pig', 'chicken', 'horse']
  });
  biome('sunflower_plains', {
    grass: 0x8eb971, foliage: 0x71a74d, treeChance: 0.004, trees: [['oak', 1]],
    grassChance: 0.4, flowerChance: 0.14, flowers: ['dandelion', 'oxeye_daisy', 'cornflower'],
    mobs: ['sheep', 'cow', 'pig', 'chicken']
  });
  biome('forest', {
    grass: 0x79c05a, foliage: 0x59ae30, treeChance: 0.085, trees: [['oak', 6], ['birch', 2], ['big_oak', 1]],
    grassChance: 0.24, flowerChance: 0.035, flowers: FLOWERS_PLAINS, mushroomChance: 0.004,
    mobs: ['sheep', 'cow', 'pig', 'chicken', 'wolf']
  });
  biome('birch_forest', {
    grass: 0x88bb67, foliage: 0x6ba941, treeChance: 0.085, trees: [['birch', 1]],
    grassChance: 0.24, flowerChance: 0.03, mushroomChance: 0.004,
    mobs: ['sheep', 'cow', 'pig', 'chicken']
  });
  biome('dark_forest', {
    grass: 0x507a32, foliage: 0x59ae30, treeChance: 0.15, trees: [['dark_oak', 6], ['oak', 2], ['big_oak', 1]],
    grassChance: 0.2, flowerChance: 0.02, mushroomChance: 0.02, boulderChance: 0.002,
    mobs: ['sheep', 'cow', 'wolf']
  });
  biome('flower_forest', {
    grass: 0x79c05a, foliage: 0x59ae30, treeChance: 0.03, trees: [['oak', 4], ['birch', 1]],
    grassChance: 0.2, flowerChance: 0.3, flowers: FLOWERS_PLAINS.concat(['allium', 'blue_orchid', 'lily_of_the_valley']),
    mobs: ['sheep', 'cow', 'pig', 'chicken', 'rabbit']
  });
  biome('swamp', {
    surface: 'grass_block', filler: 'dirt', underwater: 'mud',
    grass: 0x6a7039, foliage: 0x6a7039, water: 0x617b64, downfall: 0.9,
    treeChance: 0.035, trees: [['swamp_oak', 1]], grassChance: 0.3, lilyChance: 0.06,
    mushroomChance: 0.02, flowerChance: 0.01, flowers: ['blue_orchid'],
    mobs: ['sheep', 'cow', 'chicken']
  });
  biome('meadow', {
    grass: 0x83bb6d, foliage: 0x63a948, treeChance: 0.002, trees: [['oak', 1]],
    grassChance: 0.5, flowerChance: 0.16, flowers: FLOWERS_PLAINS,
    mobs: ['sheep', 'cow', 'horse', 'rabbit']
  });

  /* ---------------- cold ---------------- */
  biome('taiga', {
    grass: 0x86b783, foliage: 0x68a464, temperature: 0.25,
    treeChance: 0.1, trees: [['spruce', 1]], grassChance: 0.2, flowerChance: 0.01,
    mushroomChance: 0.01, mobs: ['sheep', 'wolf', 'rabbit', 'pig']
  });
  biome('old_growth_taiga', {
    surface: 'podzol', grass: 0x86b783, foliage: 0x68a464, temperature: 0.25,
    treeChance: 0.14, trees: [['mega_spruce', 3], ['spruce', 4]], grassChance: 0.25,
    mushroomChance: 0.03, boulderChance: 0.003, mobs: ['sheep', 'wolf', 'rabbit']
  });
  biome('snowy_plains', {
    surface: 'snow_block', snow: true, ice: true, temperature: 0,
    grass: 0x80b497, foliage: 0x60a17b, treeChance: 0.002, trees: [['spruce', 1]],
    grassChance: 0.02, mobs: ['rabbit', 'polar_bear']
  });
  biome('snowy_taiga', {
    surface: 'snow_block', snow: true, ice: true, temperature: 0,
    grass: 0x80b497, foliage: 0x60a17b, treeChance: 0.08, trees: [['spruce', 1]],
    grassChance: 0.05, mobs: ['rabbit', 'wolf']
  });
  biome('ice_spikes', {
    surface: 'snow_block', filler: 'packed_ice', snow: true, ice: true, temperature: 0,
    grass: 0x80b497, foliage: 0x60a17b, mobs: ['rabbit']
  });
  biome('grove', {
    surface: 'snow_block', snow: true, temperature: 0.1, grass: 0x80b497, foliage: 0x60a17b,
    treeChance: 0.09, trees: [['spruce', 1]], mobs: ['rabbit', 'wolf']
  });

  /* ---------------- hot ---------------- */
  biome('desert', {
    surface: 'sand', filler: 'sand', fillerDepth: 5, underwater: 'sand',
    grass: 0xbfb755, foliage: 0xaea42a, temperature: 1, downfall: 0,
    cactusChance: 0.012, deadBushChance: 0.02, mobs: ['rabbit']
  });
  biome('savanna', {
    grass: 0xbfb755, foliage: 0xaea42a, temperature: 0.9, downfall: 0.1,
    treeChance: 0.012, trees: [['acacia', 1]], grassChance: 0.4, deadBushChance: 0.004,
    mobs: ['sheep', 'cow', 'horse', 'chicken']
  });
  biome('jungle', {
    grass: 0x59c93c, foliage: 0x30bb0b, temperature: 0.95, downfall: 0.9,
    treeChance: 0.16, trees: [['jungle', 5], ['mega_jungle', 2], ['oak', 1]],
    grassChance: 0.5, melonChance: 0.006, flowerChance: 0.01, mushroomChance: 0.01,
    mobs: ['pig', 'chicken', 'parrot', 'cow']
  });
  biome('bamboo_jungle', {
    grass: 0x59c93c, foliage: 0x30bb0b, temperature: 0.95, downfall: 0.9,
    treeChance: 0.09, trees: [['jungle', 1]], grassChance: 0.6,
    mobs: ['pig', 'chicken', 'panda']
  });
  biome('badlands', {
    surface: 'red_sand', filler: 'terracotta', fillerDepth: 4, underwater: 'red_sand',
    terracottaBands: true, grass: 0x90814d, foliage: 0x9e814d, temperature: 1, downfall: 0,
    deadBushChance: 0.012, cactusChance: 0.002, mobs: []
  });
  biome('eroded_badlands', {
    surface: 'red_sand', filler: 'terracotta', fillerDepth: 3, underwater: 'red_sand',
    terracottaBands: true, grass: 0x90814d, foliage: 0x9e814d, temperature: 1, downfall: 0,
    deadBushChance: 0.014, mobs: []
  });
  biome('mushroom_fields', {
    surface: 'mycelium', grass: 0x55c93f, foliage: 0x2bbb0f, temperature: 0.9,
    mushroomChance: 0.16, treeChance: 0.004, trees: [['oak', 1]], mobs: ['mooshroom']
  });

  /* ---------------- mountains ---------------- */
  biome('windswept_hills', {
    surface: 'grass_block', filler: 'dirt', grass: 0x8ab689, foliage: 0x6da36b,
    treeChance: 0.012, trees: [['spruce', 2], ['oak', 1]], grassChance: 0.12,
    boulderChance: 0.006, mobs: ['sheep', 'goat']
  });
  biome('stony_peaks', {
    surface: 'stone', filler: 'stone', grass: 0x8ab689, foliage: 0x6da36b,
    temperature: 0.3, mobs: ['goat']
  });
  biome('jagged_peaks', {
    surface: 'snow_block', filler: 'stone', snow: true, temperature: 0,
    grass: 0x80b497, foliage: 0x60a17b, mobs: ['goat']
  });
  biome('snowy_slopes', {
    surface: 'snow_block', filler: 'stone', snow: true, temperature: 0,
    grass: 0x80b497, foliage: 0x60a17b, mobs: ['goat', 'rabbit']
  });

  MC.biomes = {
    list: list,
    byName: byName,
    get: function (id) { return list[id] || list[0]; },
    idOf: function (n) { return byName[n] ? byName[n].id : 0; }
  };
})();
