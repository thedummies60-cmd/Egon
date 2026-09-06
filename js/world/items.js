/* ============================================================
 * items.js - non-block items + their procedural pixel art.
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});
  const P = MC.paint;
  const shade = P.shade, mix = P.mix;

  const IT = {};                 // name -> painter(canvas)
  MC.itemTextures = IT;

  /* ============ shared drawing pieces ============ */

  // diagonal wooden handle running bottom-left -> top-right
  function handle(c, col) {
    const d = shade(col, 0.7), l = shade(col, 1.2);
    for (let i = 0; i < 9; i++) {
      const x = 3 + i, y = 12 - i;
      c.set(x, y, col); c.set(x, y + 1, d); c.set(x + 1, y, l);
    }
  }

  // build a metal-head tool: art is drawn in the top-right corner
  function tool(art, headCol, stickCol) {
    return function (c) {
      c.clear();
      const pal = {
        H: headCol, D: shade(headCol, 0.72), L: shade(headCol, 1.22), M: shade(headCol, 0.9)
      };
      handle(c, stickCol || 0x9a7548);
      c.art(art, pal, 2, 1);
      c.outline(0x2a2018);
    };
  }

  const PICK_ART = [
    '  HHHH LHHHH  ',
    ' HLLLHHHHLLLH ',
    ' HDDMHLLHMDDH ',
    '  DD  HH  DD  ',
    '      MD      '
  ];
  const AXE_ART = [
    '     LHHHH ',
    '    HHHHHHH',
    '   HHLLHHHH',
    '   HDDHHHHH',
    '    HDDHHH ',
    '     HDDH  ',
    '      DD   '
  ];
  const SHOVEL_ART = [
    '      LHHH  ',
    '      HLHHH ',
    '      HHHHH ',
    '      HDHHH ',
    '       DHH  ',
    '        DD  '
  ];
  const HOE_ART = [
    '   LHHHHHHH ',
    '   HHDDDDDH ',
    '   HD       ',
    '   DD       '
  ];
  const SWORD_ART = [
    '        LHH ',
    '       LHHH ',
    '      LHHH  ',
    '     LHHH   ',
    '    LHHH    ',
    '   LHHH     ',
    '   HHH      ',
    '  MHHM      '
  ];

  const TOOL_MATS = {
    wooden: { col: 0xa07845, tier: 0, speed: 2, dmg: 1, dur: 59 },
    stone: { col: 0x7d7d7d, tier: 1, speed: 4, dmg: 2, dur: 131 },
    iron: { col: 0xd8d8d8, tier: 2, speed: 6, dmg: 3, dur: 250 },
    golden: { col: 0xf6d33c, tier: 0, speed: 12, dmg: 1, dur: 32 },
    diamond: { col: 0x5decd5, tier: 3, speed: 8, dmg: 4, dur: 1561 }
  };
  MC.TOOL_MATS = TOOL_MATS;

  /* ---- generic item shapes ---- */
  function gem(col) {
    return function (c) {
      c.clear();
      const d = shade(col, 0.7), l = shade(col, 1.3);
      c.art([
        '   XXXX   ',
        '  XLLLLX  ',
        ' XLXXXXLX ',
        'XLXXXXXXLX',
        'XLXXXXXXDX',
        ' XDXXXXDX ',
        '  XDDDDX  ',
        '   XDDX   '
      ], { X: col, L: l, D: d }, 3, 4);
      c.outline(0x1a2a2a);
    };
  }
  function ingot(col) {
    return function (c) {
      c.clear();
      const d = shade(col, 0.72), l = shade(col, 1.22);
      c.art([
        '   LLLLLL   ',
        '  LXXXXXXL  ',
        ' LXXXXXXXXL ',
        ' DXXXXXXXXD ',
        '  DDDDDDDD  '
      ], { X: col, L: l, D: d }, 2, 6);
      c.outline(0x2a2a2a);
    };
  }
  function nugget(col) {
    return function (c) {
      c.clear();
      const d = shade(col, 0.72), l = shade(col, 1.25);
      c.art([
        '  XXL  ',
        ' XXXXL ',
        'LXXXXXX',
        'XXXDXXX',
        ' XXXXD ',
        '  DDD  '
      ], { X: col, L: l, D: d }, 5, 5);
      c.outline(0x2a2018);
    };
  }
  function dust(col) {
    return function (c) {
      c.clear();
      const rng = c.rng;
      for (let i = 0; i < 40; i++) {
        const x = 3 + rng.int(10), y = 6 + rng.int(8);
        const d = Math.abs(x - 8) + Math.abs(y - 11);
        if (d > 7) continue;
        c.set(x, y, shade(col, 0.75 + rng.next() * 0.5));
      }
      c.art(['  XXXX  ', ' XXXXXX ', 'XXXXXXXX'], { X: col }, 4, 11);
    };
  }
  function roundFood(col, dark, stem) {
    return function (c) {
      c.clear();
      c.disc(8, 9, 5, col);
      c.disc(6.5, 7.5, 2.2, shade(col, 1.25));
      for (let i = 0; i < 10; i++) c.set(4 + c.rng.int(9), 6 + c.rng.int(8), shade(col, 0.85));
      c.disc(9, 12, 3, shade(col, 0.88));
      if (stem) { c.set(8, 3, 0x6d5433); c.set(8, 4, 0x6d5433); c.set(9, 3, 0x4a8a2c); c.set(10, 2, 0x4a8a2c); c.set(10, 3, 0x5aa034); }
      c.outline(dark || shade(col, 0.5));
    };
  }
  function meat(raw, fat) {
    return function (c) {
      c.clear();
      c.art([
        '   XXXXX  ',
        '  XXXXXXX ',
        ' XXXXXXXXX',
        'XXXFFXXXXX',
        'XXFFFFXXX ',
        ' XXFFXXX  ',
        '  XXXXX   '
      ], { X: raw, F: fat }, 3, 4);
      for (let i = 0; i < 12; i++) c.set(3 + c.rng.int(10), 4 + c.rng.int(7), shade(raw, 0.85 + c.rng.next() * 0.3));
      c.outline(shade(raw, 0.5));
    };
  }
  function armorPiece(kind, col) {
    const trim = shade(col, 1.25), dark = shade(col, 0.7);
    const ART = {
      helmet: ['  XXXXXX  ', ' XLLLLLLX ', 'XLXXXXXXLX', 'XLX....XLX', 'XXX....XXX', 'XD......DX'],
      chestplate: ['XX      XX', 'XXXXXXXXXX', 'XLXXXXXXLX', 'XXXXXXXXXX', 'XXXXXXXXXX', ' XXXXXXXX ', ' XX    XX '],
      leggings: ['XXXXXXXXXX', 'XLXXXXXXLX', 'XXXX  XXXX', 'XXX    XXX', 'XXX    XXX', 'XD      DX'],
      boots: ['XXX    XXX', 'XXX    XXX', 'XXXX  XXXX', 'XXXXXXXXXX', 'DXXXXXXXXD']
    };
    return function (c) {
      c.clear();
      c.art(ART[kind], { X: col, L: trim, D: dark }, 3, kind === 'boots' ? 8 : 4);
      c.outline(0x201810);
    };
  }

  /* ============ materials ============ */
  IT.stick = function (c) {
    c.clear();
    const col = 0x9a7548;
    for (let i = 0; i < 10; i++) { const x = 4 + i * 0.7 | 0, y = 13 - i; c.set(x, y, col); c.set(x + 1, y, shade(col, 0.75)); }
    c.outline(0x3a2a18);
  };
  IT.coal = function (c) { c.clear(); c.disc(8, 9, 4.2, 0x1c1c1c); c.disc(6.5, 7.5, 1.6, 0x3a3a3a); c.disc(10, 11, 1.4, 0x101010); c.outline(0x000000); };
  IT.charcoal = function (c) { c.clear(); c.disc(8, 9, 4.2, 0x33302c); c.disc(6.5, 7.5, 1.6, 0x4d4740); c.outline(0x000000); };
  IT.diamond = gem(0x5decd5);
  IT.emerald = gem(0x2ed160);
  IT.lapis_lazuli = function (c) { c.clear(); c.disc(6, 8, 2.6, 0x2a55c0); c.disc(10, 10, 2.4, 0x1f47a8); c.disc(9, 6, 2, 0x3a68d8); c.outline(0x101c40); };
  IT.iron_ingot = ingot(0xd8d8d8);
  IT.gold_ingot = ingot(0xf6d33c);
  IT.copper_ingot = ingot(0xc16b42);
  IT.raw_iron = nugget(0xc8a17e);
  IT.raw_gold = nugget(0xf0c14b);
  IT.raw_copper = nugget(0xd07a4a);
  IT.redstone = dust(0xd42b1e);
  IT.glowstone_dust = dust(0xf5d68a);
  IT.gunpowder = dust(0x8a8a8a);
  IT.sugar = dust(0xf5f5f5);
  IT.blaze_powder = dust(0xf0a020);
  IT.clay_ball = function (c) { c.clear(); c.disc(8, 9, 4, 0xa4a8b8); c.disc(6.5, 7.5, 1.6, 0xc0c4d0); c.outline(0x5a5e6a); };
  IT.brick = function (c) { c.clear(); c.rect(3, 6, 10, 6, 0x9a5442); c.rect(4, 7, 8, 1, 0xb0654f); c.outline(0x4a2418); };
  IT.nether_brick = function (c) { c.clear(); c.rect(3, 6, 10, 6, 0x40232a); c.rect(4, 7, 8, 1, 0x55303a); c.outline(0x1a0d10); };
  IT.flint = function (c) { c.clear(); c.art(['  XXX ', ' XXXXX', 'XXXXXX', 'XXXXX ', ' XXX  '], { X: 0x484848 }, 5, 6); c.outline(0x1a1a1a); };
  IT.string = function (c) {
    c.clear();
    const col = 0xe8e8e8;
    for (let y = 2; y < 15; y++) c.set(8 + Math.round(Math.sin(y * 0.9) * 3), y, col);
    for (let y = 3; y < 14; y++) c.set(8 + Math.round(Math.sin(y * 0.9 + 1) * 3), y, shade(col, 0.8));
  };
  IT.feather = function (c) {
    c.clear();
    c.line(6, 14, 10, 3, 0xd8d8d8);
    for (let i = 0; i < 9; i++) {
      const y = 4 + i, x = 10 - Math.round(i * 0.42);
      const w = Math.min(4, 1 + (i >> 1));
      for (let k = 1; k <= w; k++) { c.set(x - k, y, 0xf0f0f0); c.set(x + Math.min(2, k), y, 0xe0e0e0); }
    }
    c.line(6, 14, 10, 3, 0xb0b0b0);
    c.outline(0x707070);
  };
  IT.bone = function (c) {
    c.clear();
    c.line(4, 12, 11, 4, 0xe8e4d0);
    c.line(5, 12, 12, 4, 0xd8d4c0);
    c.disc(4, 12, 1.8, 0xf0ecd8); c.disc(11.5, 3.5, 1.8, 0xf0ecd8);
    c.outline(0x8a8676);
  };
  IT.leather = function (c) { c.clear(); c.rect(3, 4, 10, 9, 0x8a5a33); c.rect(4, 5, 8, 3, 0x9a6a40); c.set(5, 9, 0x6a4525); c.set(9, 10, 0x6a4525); c.outline(0x3a2412); };
  IT.paper = function (c) { c.clear(); c.rect(3, 4, 10, 9, 0xf2f2f2); c.rect(4, 6, 7, 1, 0xc8c8c8); c.rect(4, 8, 7, 1, 0xc8c8c8); c.rect(4, 10, 5, 1, 0xc8c8c8); c.outline(0x8a8a8a); };
  IT.book = function (c) { c.clear(); c.rect(3, 3, 10, 11, 0x8a5a33); c.rect(4, 4, 8, 9, 0xf0ece0); c.rect(3, 3, 2, 11, 0x6a4525); c.outline(0x3a2412); };
  IT.slimeball = function (c) { c.clear(); c.disc(8, 9, 4.4, 0x7fd45a); c.disc(6.5, 7.5, 1.8, 0xa8ea86); c.outline(0x3e7a2a); };
  IT.ender_pearl = function (c) { c.clear(); c.disc(8, 8, 5, 0x1c6a5a); c.disc(8, 8, 3.4, 0x2fa88a); c.disc(7, 7, 1.6, 0x8ee0cc); c.outline(0x0a2a24); };
  IT.snowball = function (c) { c.clear(); c.disc(8, 9, 4.4, 0xf2fafa); c.disc(6.5, 7.5, 1.6, 0xffffff); c.outline(0xa8bcc4); };
  IT.egg = function (c) { c.clear(); c.disc(8, 9, 3.6, 0xf0e6d2); c.disc(8, 7, 3, 0xf6eee0); c.speckle(8, 0xd8c8a8, true); c.outline(0x9a8a70); };
  IT.wheat_item = function (c) {
    c.clear();
    const col = 0xd8c04a;
    for (let i = 0; i < 3; i++) {
      const bx = 4 + i * 3;
      for (let y = 4; y < 15; y++) c.set(bx, y, shade(col, 0.85 + (y % 3) * 0.1));
      for (let y = 5; y < 12; y += 2) { c.set(bx - 1, y, shade(col, 1.15)); c.set(bx + 1, y + 1, shade(col, 1.15)); }
    }
    c.outline(0x6a5a10);
  };
  IT.wheat_seeds = function (c) {
    c.clear();
    const pts = [[6, 7], [9, 6], [7, 10], [10, 10], [5, 11], [8, 8]];
    for (let i = 0; i < pts.length; i++) { c.set(pts[i][0], pts[i][1], 0x7aa83a); c.set(pts[i][0] + 1, pts[i][1], 0x5a8a24); c.set(pts[i][0], pts[i][1] + 1, 0x5a8a24); }
  };
  IT.bowl = function (c) { c.clear(); c.art(['XXXXXXXXXX', ' XXXXXXXX ', '  XXXXXX  ', '   XXXX   '], { X: 0x8a5a33 }, 3, 7); c.outline(0x3a2412); };

  /* ============ food ============ */
  IT.apple = roundFood(0xd42b2b, 0x6a1010, true);
  IT.bread = function (c) {
    c.clear();
    c.art([
      '  XXXXXXXX  ',
      ' XLXXXXXXLX ',
      'XXXXXXXXXXXX',
      'XXDXXXDXXDXX',
      ' XXXXXXXXXX ',
      '  XXXXXXXX  '
    ], { X: 0xc08a44, L: 0xd8a860, D: 0x9a6a2a }, 2, 5);
    c.outline(0x5a3a12);
  };
  IT.cookie = function (c) { c.clear(); c.disc(8, 9, 4.4, 0xc08a54); c.set(6, 8, 0x4a3018); c.set(9, 7, 0x4a3018); c.set(8, 11, 0x4a3018); c.set(10, 10, 0x4a3018); c.outline(0x6a4a20); };
  IT.melon_slice = function (c) {
    c.clear();
    c.art(['XXXXXXXXXX', 'XRRRRRRRRX', 'XRRRRRRRRX', ' XRRRRRRX ', '  XRRRRX  ', '   XXXX   '],
      { X: 0x4a8a2a, R: 0xd8404a }, 3, 5);
    c.set(6, 7, 0x2a2a2a); c.set(9, 8, 0x2a2a2a); c.set(7, 9, 0x2a2a2a);
    c.outline(0x2a4a12);
  };
  IT.carrot = function (c) {
    c.clear();
    for (let i = 0; i < 8; i++) { const y = 6 + i; const w = Math.max(1, 4 - (i >> 1)); for (let k = 0; k < w; k++) c.set(6 + k + (i >> 2), y, shade(0xe07a1a, 0.85 + (k % 2) * 0.25)); }
    c.set(6, 5, 0x3f8a2c); c.set(7, 4, 0x3f8a2c); c.set(8, 5, 0x4fa034); c.set(5, 4, 0x4fa034);
    c.outline(0x7a3a08);
  };
  IT.potato = function (c) { c.clear(); c.disc(8, 9, 4.2, 0xd0b060); c.disc(6.5, 7.5, 1.6, 0xe0c478); c.set(6, 10, 0xa08840); c.set(10, 8, 0xa08840); c.outline(0x6a5820); };
  IT.baked_potato = function (c) { c.clear(); c.disc(8, 9, 4.2, 0xb08a40); c.disc(6.5, 7.5, 1.6, 0xd0a860); c.speckle(6, 0x8a6a20, true); c.outline(0x4a3a10); };
  IT.beetroot = function (c) { c.clear(); c.disc(8, 10, 3.6, 0xa02040); c.set(8, 5, 0x3f8a2c); c.set(9, 4, 0x4fa034); c.set(7, 4, 0x4fa034); c.outline(0x50101f); };
  IT.beef = meat(0xc0504a, 0xe8a0a0);
  IT.cooked_beef = meat(0x8a4a28, 0xc08a5a);
  IT.porkchop = meat(0xe89a8a, 0xf2d0c0);
  IT.cooked_porkchop = meat(0xc0784a, 0xe8b888);
  IT.chicken = meat(0xe8b0a0, 0xf5dcc8);
  IT.cooked_chicken = meat(0xc08a50, 0xe8c090);
  IT.mutton = meat(0xd06a5a, 0xf0b0a0);
  IT.cooked_mutton = meat(0xa05a30, 0xd09a68);
  IT.mushroom_stew = function (c) {
    c.clear();
    c.art(['XXXXXXXXXX', ' XSSSSSSX ', '  XSSSSX  ', '   XXXX   '], { X: 0x8a5a33, S: 0xa8703a }, 3, 7);
    c.set(6, 7, 0xc42b22); c.set(9, 7, 0x9a6b4a);
    c.outline(0x3a2412);
  };
  IT.milk_bucket = function (c) { bucketArt(c, 0xf5f5f5); };
  IT.water_bucket = function (c) { bucketArt(c, 0x2f5fd0); };
  IT.lava_bucket = function (c) { bucketArt(c, 0xdf6a10); };
  IT.bucket = function (c) { bucketArt(c, null); };
  function bucketArt(c, fill) {
    c.clear();
    const m = 0xb0b0b0;
    c.art([
      'X        X',
      'XXXXXXXXXX',
      ' XffffffX ',
      ' XffffffX ',
      '  XffffX  ',
      '  XXXXXX  '
    ], { X: m, f: fill === null ? shade(m, 0.85) : fill }, 3, 5);
    c.outline(0x505050);
  }

  /* ============ tools, weapons, armour ============ */
  Object.keys(TOOL_MATS).forEach(function (m) {
    const col = TOOL_MATS[m].col;
    IT[m + '_pickaxe'] = tool(PICK_ART, col);
    IT[m + '_axe'] = tool(AXE_ART, col);
    IT[m + '_shovel'] = tool(SHOVEL_ART, col);
    IT[m + '_hoe'] = tool(HOE_ART, col);
    IT[m + '_sword'] = function (c) {
      c.clear();
      const pal = { H: col, D: shade(col, 0.72), L: shade(col, 1.22), M: 0x9a7548 };
      c.art(SWORD_ART, pal, 3, 1);
      // hilt
      c.set(4, 11, 0x9a7548); c.set(5, 10, 0x9a7548); c.set(3, 12, 0x7a5a35); c.set(4, 12, 0x7a5a35);
      c.set(6, 12, 0xc0c0c0); c.set(3, 9, 0xc0c0c0);
      c.outline(0x2a2018);
    };
  });
  const ARMOR_MATS = { leather: 0x9a5f36, iron: 0xd8d8d8, golden: 0xf6d33c, diamond: 0x5decd5 };
  MC.ARMOR_MATS = ARMOR_MATS;
  Object.keys(ARMOR_MATS).forEach(function (m) {
    IT[m + '_helmet'] = armorPiece('helmet', ARMOR_MATS[m]);
    IT[m + '_chestplate'] = armorPiece('chestplate', ARMOR_MATS[m]);
    IT[m + '_leggings'] = armorPiece('leggings', ARMOR_MATS[m]);
    IT[m + '_boots'] = armorPiece('boots', ARMOR_MATS[m]);
  });
  IT.bow = function (c) {
    c.clear();
    for (let i = 0; i < 13; i++) {
      const t = i / 12, a = -0.9 + t * 1.8;
      const x = 4 + Math.round(Math.cos(a) * 7), y = 2 + i;
      c.set(x, y, 0x8a5a33); c.set(x - 1, y, 0x6a4525);
    }
    c.line(3, 2, 3, 14, 0xf0f0f0);
    c.outline(0x2a1a0a);
  };
  IT.arrow = function (c) {
    c.clear();
    c.line(4, 12, 11, 4, 0x9a7548);
    c.art(['  X ', ' XX ', 'XXX '], { X: 0xd8d8d8 }, 9, 2);
    c.set(4, 12, 0xf0f0f0); c.set(3, 13, 0xf0f0f0); c.set(5, 13, 0xf0f0f0);
    c.outline(0x2a1a0a);
  };
  IT.shears = function (c) {
    c.clear();
    c.line(4, 12, 10, 4, 0xd8d8d8); c.line(5, 12, 11, 4, 0xa8a8a8);
    c.line(10, 12, 4, 4, 0xd8d8d8); c.line(11, 12, 5, 4, 0xa8a8a8);
    c.disc(4, 13, 1.6, 0x707070); c.disc(11, 13, 1.6, 0x707070);
    c.outline(0x303030);
  };
  IT.flint_and_steel = function (c) {
    c.clear();
    c.art(['XXX  ', 'X  X ', 'X   X', 'XXXXX'], { X: 0xb0b0b0 }, 3, 4);
    c.disc(11, 11, 2.4, 0x484848);
    c.outline(0x2a2a2a);
  };
  IT.spawn_egg = function (c) {
    c.clear();
    c.disc(8, 9, 4.6, 0xd8d8d8); c.disc(8, 7, 3.6, 0xe8e8e8);
    for (let i = 0; i < 12; i++) c.set(4 + c.rng.int(9), 5 + c.rng.int(9), 0x8a8a8a);
    c.outline(0x505050);
  };

  /* ============================================================
   * item registry
   * ============================================================ */
  const items = [];
  const itemsByName = Object.create(null);

  function item(name, o) {
    o = o || {};
    const it = {
      name: name,
      display: o.display || name.replace(/_/g, ' ').replace(/\b\w/g, function (m) { return m.toUpperCase(); }),
      tex: o.tex || name,
      maxStack: o.maxStack || 64,
      group: o.group || 'misc',
      tool: o.tool || null,          // { type, tier, speed, damage }
      durability: o.durability || 0,
      food: o.food || null,          // { hunger, saturation }
      armor: o.armor || null,        // { slot, defense }
      fuel: o.fuel || 0,
      place: o.place || null,        // block name this item places
      isBlock: false,
      spawns: o.spawns || null
    };
    items.push(it);
    itemsByName[name] = it;
    return it;
  }

  /* materials */
  item('stick', { fuel: 100, group: 'materials' });
  item('coal', { fuel: 1600, group: 'materials' });
  item('charcoal', { fuel: 1600, group: 'materials' });
  item('diamond', { group: 'materials' });
  item('emerald', { group: 'materials' });
  item('lapis_lazuli', { group: 'materials' });
  item('iron_ingot', { group: 'materials' });
  item('gold_ingot', { group: 'materials' });
  item('copper_ingot', { group: 'materials' });
  item('raw_iron', { group: 'materials' });
  item('raw_gold', { group: 'materials' });
  item('raw_copper', { group: 'materials' });
  item('redstone', { group: 'materials' });
  item('glowstone_dust', { group: 'materials' });
  item('gunpowder', { group: 'materials' });
  item('sugar', { group: 'materials' });
  item('clay_ball', { group: 'materials' });
  item('brick', { group: 'materials' });
  item('nether_brick', { group: 'materials' });
  item('flint', { group: 'materials' });
  item('string', { group: 'materials' });
  item('feather', { group: 'materials' });
  item('bone', { group: 'materials' });
  item('leather', { group: 'materials' });
  item('paper', { group: 'materials' });
  item('book', { group: 'materials' });
  item('slimeball', { group: 'materials' });
  item('ender_pearl', { maxStack: 16, group: 'materials' });
  item('snowball', { maxStack: 16, group: 'materials' });
  item('egg', { maxStack: 16, group: 'materials' });
  item('wheat', { tex: 'wheat_item', group: 'materials' });
  item('wheat_seeds', { group: 'materials', place: 'wheat' });
  item('bowl', { fuel: 100, group: 'materials' });
  item('bucket', { maxStack: 16, group: 'misc' });
  item('water_bucket', { maxStack: 1, group: 'misc', place: 'water' });
  item('lava_bucket', { maxStack: 1, group: 'misc', place: 'lava' });
  item('milk_bucket', { maxStack: 1, group: 'food' });

  /* food */
  item('apple', { food: { hunger: 4, saturation: 2.4 }, group: 'food' });
  item('bread', { food: { hunger: 5, saturation: 6 }, group: 'food' });
  item('cookie', { food: { hunger: 2, saturation: 0.4 }, group: 'food' });
  item('melon_slice', { food: { hunger: 2, saturation: 1.2 }, group: 'food' });
  item('carrot', { food: { hunger: 3, saturation: 3.6 }, group: 'food', place: 'wheat' });
  item('potato', { food: { hunger: 1, saturation: 0.6 }, group: 'food', place: 'wheat' });
  item('baked_potato', { food: { hunger: 5, saturation: 6 }, group: 'food' });
  item('beetroot', { food: { hunger: 1, saturation: 1.2 }, group: 'food' });
  item('mushroom_stew', { maxStack: 1, food: { hunger: 6, saturation: 7.2 }, group: 'food' });
  [['beef', 3, 1.8, 8, 12.8], ['porkchop', 3, 1.8, 8, 12.8], ['chicken', 2, 1.2, 6, 7.2], ['mutton', 2, 1.2, 6, 9.6]]
    .forEach(function (f) {
      item(f[0], { food: { hunger: f[1], saturation: f[2] }, group: 'food' });
      item('cooked_' + f[0], { food: { hunger: f[3], saturation: f[4] }, group: 'food' });
    });

  /* tools & weapons */
  Object.keys(TOOL_MATS).forEach(function (m) {
    const t = TOOL_MATS[m];
    item(m + '_pickaxe', { maxStack: 1, durability: t.dur, group: 'tools', tool: { type: 'pickaxe', tier: t.tier, speed: t.speed, damage: t.dmg + 1 } });
    item(m + '_axe', { maxStack: 1, durability: t.dur, group: 'tools', tool: { type: 'axe', tier: t.tier, speed: t.speed, damage: t.dmg + 3 } });
    item(m + '_shovel', { maxStack: 1, durability: t.dur, group: 'tools', tool: { type: 'shovel', tier: t.tier, speed: t.speed, damage: t.dmg + 1 } });
    item(m + '_hoe', { maxStack: 1, durability: t.dur, group: 'tools', tool: { type: 'hoe', tier: t.tier, speed: t.speed, damage: t.dmg } });
    item(m + '_sword', { maxStack: 1, durability: t.dur, group: 'combat', tool: { type: 'sword', tier: t.tier, speed: 1.5, damage: t.dmg + 3 } });
  });
  const ARMOR_DEF = { leather: [1, 3, 2, 1], iron: [2, 6, 5, 2], golden: [2, 5, 3, 1], diamond: [3, 8, 6, 3] };
  Object.keys(ARMOR_MATS).forEach(function (m) {
    const d = ARMOR_DEF[m];
    item(m + '_helmet', { maxStack: 1, durability: 165, group: 'combat', armor: { slot: 0, defense: d[0] } });
    item(m + '_chestplate', { maxStack: 1, durability: 240, group: 'combat', armor: { slot: 1, defense: d[1] } });
    item(m + '_leggings', { maxStack: 1, durability: 225, group: 'combat', armor: { slot: 2, defense: d[2] } });
    item(m + '_boots', { maxStack: 1, durability: 195, group: 'combat', armor: { slot: 3, defense: d[3] } });
  });
  item('bow', { maxStack: 1, durability: 384, group: 'combat', tool: { type: 'bow', tier: 0, speed: 1, damage: 1 } });
  item('arrow', { group: 'combat' });
  item('shears', { maxStack: 1, durability: 238, group: 'tools', tool: { type: 'shears', tier: 0, speed: 5, damage: 1 } });
  item('flint_and_steel', { maxStack: 1, durability: 64, group: 'tools' });

  MC.items = {
    list: items,
    byName: itemsByName,
    get: function (name) { return itemsByName[name] || null; }
  };

  /* ------------------------------------------------------------------
   * Unified "stack thing" lookup: blocks and items share one namespace.
   * ------------------------------------------------------------------ */
  MC.thing = function (name) {
    if (!name) return null;
    const b = MC.blocks.byName[name];
    if (b) {
      return {
        name: name, display: b.display, isBlock: true, block: b,
        maxStack: b.maxStack, group: b.group, fuel: b.fuel, food: null,
        tool: null, armor: null, durability: 0, place: name
      };
    }
    const i = itemsByName[name];
    if (i) {
      return {
        name: name, display: i.display, isBlock: false, item: i,
        maxStack: i.maxStack, group: i.group, fuel: i.fuel, food: i.food,
        tool: i.tool, armor: i.armor, durability: i.durability, place: i.place
      };
    }
    return null;
  };
})();
