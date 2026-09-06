/* ============================================================
 * blocktex.js - procedural painters for every block texture.
 * Each entry is  name -> function(canvas, rng)  drawing a 16x16 tile.
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});
  const P = MC.paint;
  const shade = P.shade, mix = P.mix, rgb = P.rgb;

  const T = {};   // name -> painter
  MC.blockTextures = T;

  /* ---------------- generic family helpers ---------------- */

  // rough natural stone-ish surface
  function rough(base, grainAmt, blotchAmt) {
    return function (c) {
      c.fill(base);
      c.blotch(blotchAmt === undefined ? 0.10 : blotchAmt, 2);
      c.grain(grainAmt === undefined ? 0.07 : grainAmt);
    };
  }

  // ore = stone background + coloured mineral blobs with a highlight
  function ore(bg, col, hi, count) {
    return function (c) {
      bg(c);
      const spots = [[3, 3, 2], [10, 5, 2.2], [5, 11, 2], [12, 12, 1.6], [8, 8, 1.4]];
      const n = count || 4;
      for (let i = 0; i < n; i++) {
        const s = spots[i % spots.length];
        const jx = c.rng.range(-1.5, 1.5), jy = c.rng.range(-1.5, 1.5);
        c.disc(s[0] + jx, s[1] + jy, s[2], col);
        c.set(s[0] + jx - 1, s[1] + jy - 1, hi);
        c.set(s[0] + jx, s[1] + jy - 1, hi);
      }
      c.grain(0.05);
    };
  }

  // planks: horizontal boards with vertical seams
  function planks(base) {
    return function (c) {
      c.fill(base);
      const dark = shade(base, 0.72), mid = shade(base, 0.88), light = shade(base, 1.08);
      for (let y = 0; y < 16; y++) {
        const board = (y / 4) | 0;
        const f = [1.0, 0.93, 1.05, 0.88][board];
        for (let x = 0; x < 16; x++) c.set(x, y, shade(base, f));
      }
      // board separators
      for (let b = 1; b < 4; b++) for (let x = 0; x < 16; x++) c.set(x, b * 4 - 1, dark);
      // vertical seams, staggered per board
      const seams = [11, 5, 13, 7];
      for (let b = 0; b < 4; b++) {
        for (let y = b * 4; y < b * 4 + 3; y++) c.set(seams[b], y, dark);
      }
      // wood grain streaks
      for (let i = 0; i < 26; i++) {
        const y = c.rng.int(16), x = c.rng.int(16);
        if (y % 4 === 3) continue;
        c.set(x, y, c.rng.chance(0.5) ? mid : light);
      }
      c.grain(0.05);
    };
  }

  // log bark: vertical streaks
  function logSide(base) {
    return function (c) {
      c.fill(base);
      for (let x = 0; x < 16; x++) {
        const f = 0.82 + c.rng.next() * 0.36;
        for (let y = 0; y < 16; y++) c.set(x, y, shade(base, f * (0.96 + c.rng.next() * 0.08)));
      }
      for (let i = 0; i < 14; i++) {
        const x = c.rng.int(16), y0 = c.rng.int(12);
        const col = shade(base, c.rng.chance(0.5) ? 0.7 : 1.18);
        const h = c.rng.intRange(3, 7);
        for (let y = y0; y < Math.min(16, y0 + h); y++) c.set(x, y, col);
      }
    };
  }

  // log end grain: concentric rings
  function logTop(base, ringCol) {
    return function (c) {
      c.fill(shade(base, 1.12));
      const cx = 7.5, cy = 7.5;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x - cx, y - cy);
        const ring = Math.sin(d * 2.1) * 0.5 + 0.5;
        c.set(x, y, mix(shade(base, 1.15), ringCol, ring * 0.55));
      }
      c.disc(cx, cy, 1.2, shade(ringCol, 0.8));
      c.frame(0, 0, 16, 16, shade(base, 0.75));
      c.grain(0.05);
    };
  }

  // leaves: dense clumpy foliage with holes (alpha-tested)
  function leaves(base, holes, clumpy) {
    return function (c) {
      c.fill(base);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const n = c.rng.next();
        let f = 0.72 + n * 0.55;
        if (clumpy && ((x + y) & 3) === 0) f *= 0.85;
        c.set(x, y, shade(base, f));
      }
      // dark veins / gaps
      for (let i = 0; i < 30; i++) {
        c.set(c.rng.int(16), c.rng.int(16), shade(base, 0.55));
      }
      // punch transparent holes so foliage reads as leafy
      const nHoles = holes === undefined ? 16 : holes;
      for (let i = 0; i < nHoles; i++) {
        const x = c.rng.int(16), y = c.rng.int(16);
        c.data[c.idx(x, y) + 3] = 0;
        if (c.rng.chance(0.35)) c.data[c.idx((x + 1) % 16, y) + 3] = 0;
      }
    };
  }

  function wool(base) {
    return function (c) {
      c.fill(base);
      c.blotch(0.10, 2);
      // fluffy criss-cross fibres
      for (let i = 0; i < 46; i++) {
        const x = c.rng.int(16), y = c.rng.int(16);
        c.set(x, y, shade(base, c.rng.chance(0.5) ? 0.86 : 1.12));
      }
      for (let i = 0; i < 8; i++) {
        const x = c.rng.int(14), y = c.rng.int(14);
        c.set(x, y, shade(base, 0.8)); c.set(x + 1, y + 1, shade(base, 0.8));
      }
      c.grain(0.04);
    };
  }

  function terracotta(base) {
    return function (c) {
      c.fill(base);
      c.blotch(0.09, 2);
      for (let i = 0; i < 22; i++) {
        const x = c.rng.int(16), y = c.rng.int(16);
        c.set(x, y, shade(base, 0.84));
      }
      // faint horizontal banding, like fired clay layers
      for (let y = 0; y < 16; y += 3) for (let x = 0; x < 16; x++) c.blend(x, y, shade(base, 0.9), 0.4);
      c.grain(0.05);
    };
  }

  function metalBlock(base) {
    return function (c) {
      c.fill(base);
      const d = shade(base, 0.7), l = shade(base, 1.2);
      // 4 bevelled ingots
      for (let by = 0; by < 2; by++) for (let bx = 0; bx < 2; bx++) {
        const x0 = bx * 8, y0 = by * 8;
        c.rect(x0 + 1, y0 + 1, 6, 6, base);
        for (let i = 1; i < 7; i++) { c.set(x0 + i, y0 + 1, l); c.set(x0 + 1, y0 + i, l); }
        for (let i = 1; i < 7; i++) { c.set(x0 + i, y0 + 6, d); c.set(x0 + 6, y0 + i, d); }
      }
      c.frame(0, 0, 16, 16, d);
      c.grain(0.045);
    };
  }

  function bricksTex(base, mortar) {
    return function (c) {
      c.fill(mortar);
      for (let row = 0; row < 4; row++) {
        const y = row * 4;
        const off = (row % 2) * 4;
        for (let b = -1; b < 3; b++) {
          const x = b * 8 + off;
          for (let yy = y; yy < y + 3; yy++) for (let xx = x; xx < x + 7; xx++) {
            if (xx < 0 || xx > 15) continue;
            c.set(xx, yy, shade(base, 0.88 + ((b * 7 + row * 3) % 5) * 0.055));
          }
        }
      }
      c.grain(0.07);
    };
  }

  function crossPlant(stem, flower, tall) {
    return function (c) {
      c.clear();
      const base = tall ? 15 : 14;
      // a few blades of grass fanning out
      const blades = [[7, 4], [5, 6], [9, 6], [6, 3], [10, 5], [8, 7]];
      for (let i = 0; i < blades.length; i++) {
        const bx = blades[i][0], h = blades[i][1] + (tall ? 4 : 0);
        for (let k = 0; k < h; k++) {
          const x = bx + Math.round(Math.sin(k * 0.5 + i) * 1.1);
          const y = base - k;
          c.set(x, y, shade(stem, 0.8 + (k / h) * 0.5));
        }
      }
      if (flower !== undefined && flower !== null) {
        c.set(7, base - 7, flower); c.set(8, base - 7, flower);
        c.set(7, base - 8, flower); c.set(8, base - 8, flower);
        c.set(6, base - 8, shade(flower, 0.85)); c.set(9, base - 8, shade(flower, 0.85));
        c.set(7, base - 9, shade(flower, 1.15)); c.set(8, base - 9, shade(flower, 1.15));
      }
    };
  }

  function flower(stemCol, petal, centre) {
    return function (c) {
      c.clear();
      // stem
      for (let y = 8; y < 16; y++) c.set(7, y, shade(stemCol, 0.9 + (y % 2) * 0.2));
      c.set(6, 11, stemCol); c.set(5, 10, shade(stemCol, 1.1));
      c.set(8, 13, stemCol); c.set(9, 12, shade(stemCol, 1.1));
      // blossom
      const pts = [[6, 5], [7, 4], [8, 5], [9, 6], [8, 7], [7, 8], [6, 7], [5, 6]];
      for (let i = 0; i < pts.length; i++) c.set(pts[i][0], pts[i][1], shade(petal, 0.92 + (i % 3) * 0.08));
      c.set(6, 6, petal); c.set(8, 6, petal); c.set(7, 5, petal); c.set(7, 7, petal);
      c.set(7, 6, centre);
    };
  }

  function sapling(leafCol, trunkCol) {
    return function (c) {
      c.clear();
      for (let y = 10; y < 16; y++) c.set(7, y, trunkCol);
      const crown = [[7, 3], [6, 4], [7, 4], [8, 4], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5],
                     [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [6, 7], [7, 7], [8, 7],
                     [5, 8], [7, 8], [9, 8], [6, 9], [8, 9]];
      for (let i = 0; i < crown.length; i++) {
        c.set(crown[i][0], crown[i][1], shade(leafCol, 0.8 + ((i * 7) % 5) * 0.1));
      }
    };
  }

  /* ================= STONE & EARTH ================= */
  T.stone = rough(0x7d7d7d, 0.09, 0.12);
  T.cobblestone = function (c) {
    c.fill(0x6b6b6b);
    const cells = [[0, 0, 6, 5], [7, 0, 5, 4], [13, 0, 3, 6], [0, 6, 4, 5], [5, 5, 7, 6],
                   [13, 7, 3, 5], [0, 12, 7, 4], [8, 12, 5, 4], [12, 12, 4, 4]];
    for (let i = 0; i < cells.length; i++) {
      const s = cells[i];
      const g = 0.72 + ((i * 37) % 11) / 11 * 0.5;
      for (let y = s[1]; y < Math.min(16, s[1] + s[3]); y++)
        for (let x = s[0]; x < Math.min(16, s[0] + s[2]); x++) {
          if (x === s[0] + s[2] - 1 || y === s[1] + s[3] - 1) c.set(x, y, 0x4a4a4a);
          else c.set(x, y, shade(0x8a8a8a, g + c.rng.next() * 0.1));
        }
    }
    c.grain(0.09);
  };
  T.mossy_cobblestone = function (c) {
    T.cobblestone(c);
    for (let i = 0; i < 60; i++) {
      const x = c.rng.int(16), y = c.rng.int(16);
      c.blend(x, y, 0x4f7a35, 0.55 + c.rng.next() * 0.45);
    }
    c.blobs(3, 1.5, 3, 0x5a8c3c, true);
  };
  T.granite = rough(0x95675a, 0.09, 0.13);
  T.polished_granite = function (c) { c.fill(0x9c6c5f); c.grain(0.05); c.bevel(0.9, 1.08); };
  T.diorite = function (c) {
    c.fill(0xd0d0d0); c.blotch(0.1, 2);
    c.speckle(40, 0x8f8f8f, true); c.speckle(20, 0xf2f2f2, true); c.grain(0.05);
  };
  T.polished_diorite = function (c) { c.fill(0xcfcfd2); c.grain(0.04); c.bevel(0.92, 1.06); };
  T.andesite = function (c) { c.fill(0x8a8a8a); c.blotch(0.09, 2); c.speckle(34, 0x707070, true); c.grain(0.05); };
  T.polished_andesite = function (c) { c.fill(0x8f9291); c.grain(0.04); c.bevel(0.92, 1.06); };
  T.deepslate = function (c) {
    c.fill(0x515357);
    for (let x = 0; x < 16; x++) { const f = 0.85 + c.rng.next() * 0.3; for (let y = 0; y < 16; y++) c.set(x, y, shade(0x515357, f)); }
    c.grain(0.08);
  };
  T.cobbled_deepslate = function (c) {
    T.cobblestone(c);
    c.tint(0x3f4145, 0.62);
  };
  T.deepslate_bricks = function (c) { bricksTex(0x4a4c50, 0x33353a)(c); };
  T.tuff = function (c) { c.fill(0x6c6d63); c.blotch(0.12, 2); c.speckle(46, 0x565749, true); c.grain(0.06); };
  T.calcite = function (c) { c.fill(0xdfdfd6); c.blotch(0.06, 2); c.speckle(30, 0xc7c7bd, true); c.grain(0.04); };
  T.bedrock = function (c) {
    c.fill(0x565656);
    for (let i = 0; i < 34; i++) c.disc(c.rng.int(16), c.rng.int(16), c.rng.range(0.8, 2.2), shade(0x565656, 0.5 + c.rng.next() * 0.9));
    c.grain(0.14);
  };
  T.gravel = function (c) {
    c.fill(0x7f7d78);
    for (let i = 0; i < 40; i++) c.disc(c.rng.int(16), c.rng.int(16), c.rng.range(0.9, 2.1), shade(0x8b8983, 0.6 + c.rng.next() * 0.7));
    c.grain(0.1);
  };
  T.clay = function (c) { c.fill(0xa4a8b8); c.blotch(0.07, 2); c.grain(0.05); };
  T.obsidian = function (c) {
    c.fill(0x14101f);
    c.blotch(0.35, 2);
    for (let i = 0; i < 22; i++) c.set(c.rng.int(16), c.rng.int(16), 0x3b2f5c);
    for (let i = 0; i < 6; i++) c.set(c.rng.int(16), c.rng.int(16), 0x6a55a0);
  };
  T.netherrack = function (c) {
    c.fill(0x6f2b2b); c.blotch(0.18, 2);
    for (let i = 0; i < 30; i++) c.set(c.rng.int(16), c.rng.int(16), shade(0x8a3535, 0.7 + c.rng.next() * 0.6));
    c.grain(0.1);
  };
  T.dirt = function (c) {
    c.fill(0x866043);
    c.blotch(0.13, 2);
    c.speckle(34, 0x6b4c34, true);
    c.speckle(14, 0x9a7050, true);
    c.grain(0.07);
  };
  T.coarse_dirt = function (c) { T.dirt(c); c.speckle(48, 0x5d422d, true); };
  T.rooted_dirt = function (c) { T.dirt(c); c.speckle(30, 0xc9a06a, true); };
  T.mud = function (c) { c.fill(0x3d3a3b); c.blotch(0.14, 2); c.grain(0.07); };
  T.grass_top = function (c) {
    // painted neutral; the shader multiplies in the biome colour
    c.fill(0xbdbdbd);
    c.blotch(0.13, 2);
    c.speckle(50, 0x9d9d9d, true);
    c.speckle(26, 0xdcdcdc, true);
    c.grain(0.09);
  };
  T.grass_side_overlay = function (c) {
    c.clear();
    // a ragged fringe of grass hanging over the dirt
    for (let x = 0; x < 16; x++) {
      const h = 3 + ((x * 5 + (x * x) % 7) % 4);
      for (let y = 0; y < h; y++) c.set(x, y, shade(0xbdbdbd, 0.78 + ((x + y) % 5) * 0.09));
    }
    c.grain(0.1);
  };
  T.podzol_top = function (c) { c.fill(0x6b4a24); c.blotch(0.16, 2); c.speckle(40, 0x8a6330, true); c.speckle(16, 0x4a3218, true); };
  T.podzol_side = function (c) { T.dirt(c); for (let x = 0; x < 16; x++) { const h = 3 + (x % 3); for (let y = 0; y < h; y++) c.set(x, y, shade(0x6b4a24, 0.85 + c.rng.next() * 0.35)); } };
  T.mycelium_top = function (c) { c.fill(0x6f6265); c.blotch(0.12, 2); c.speckle(40, 0x8b7f86, true); c.speckle(18, 0x9d7f9d, true); };
  T.mycelium_side = function (c) { T.dirt(c); for (let x = 0; x < 16; x++) { const h = 3 + (x % 3); for (let y = 0; y < h; y++) c.set(x, y, shade(0x6f6265, 0.85 + c.rng.next() * 0.35)); } };
  T.moss_block = function (c) { c.fill(0x5a7a2e); c.blotch(0.16, 2); c.speckle(46, 0x466322, true); c.speckle(20, 0x769a3f, true); };
  T.farmland = function (c) {
    T.dirt(c);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (((x / 4) | 0) % 2 === 0) c.blend(x, y, 0x000000, 0.14);
    }
    for (let b = 0; b < 4; b++) for (let y = 0; y < 16; y++) c.set(b * 4, y, shade(0x5d422d, 0.9));
  };
  T.farmland_wet = function (c) { T.farmland(c); c.tint(0x2d1c0d, 0.42); };

  /* ================= SAND / SANDSTONE / TERRACOTTA ================= */
  T.sand = function (c) { c.fill(0xdbd3a0); c.blotch(0.07, 2); c.speckle(46, 0xc4bb86, true); c.speckle(22, 0xefe8bd, true); c.grain(0.05); };
  T.red_sand = function (c) { c.fill(0xbe6b2e); c.blotch(0.08, 2); c.speckle(46, 0xa25a26, true); c.speckle(20, 0xd68a48, true); c.grain(0.05); };
  T.sandstone_top = function (c) { c.fill(0xd8cf9d); c.blotch(0.05, 2); c.grain(0.05); };
  T.sandstone_side = function (c) {
    c.fill(0xd8cf9d);
    for (let y = 0; y < 16; y++) { const f = 0.9 + Math.sin(y * 1.7) * 0.06 + c.rng.next() * 0.06; for (let x = 0; x < 16; x++) c.set(x, y, shade(0xd8cf9d, f)); }
    for (let x = 0; x < 16; x++) { c.set(x, 0, shade(0xd8cf9d, 1.1)); c.set(x, 12, shade(0xd8cf9d, 0.82)); }
    c.grain(0.04);
  };
  T.sandstone_bottom = function (c) { c.fill(0xcfc593); c.blotch(0.06, 2); c.grain(0.05); };
  T.cut_sandstone = function (c) {
    c.fill(0xd8cf9d);
    c.frame(0, 0, 8, 8, shade(0xd8cf9d, 0.85)); c.frame(8, 0, 8, 8, shade(0xd8cf9d, 0.85));
    c.frame(0, 8, 8, 8, shade(0xd8cf9d, 0.85)); c.frame(8, 8, 8, 8, shade(0xd8cf9d, 0.85));
    c.grain(0.04);
  };
  T.chiseled_sandstone = function (c) {
    T.sandstone_top(c);
    c.frame(1, 1, 14, 14, shade(0xd8cf9d, 0.8));
    // little creeper-ish glyph
    c.rect(5, 4, 2, 3, shade(0xd8cf9d, 0.7)); c.rect(9, 4, 2, 3, shade(0xd8cf9d, 0.7));
    c.rect(6, 8, 4, 4, shade(0xd8cf9d, 0.7)); c.rect(5, 9, 6, 2, shade(0xd8cf9d, 0.7));
  };
  T.red_sandstone_top = function (c) { c.fill(0xba6b28); c.blotch(0.06, 2); c.grain(0.05); };
  T.red_sandstone_side = function (c) { T.sandstone_side(c); c.tint(0xa8551d, 0.72); };
  T.red_sandstone_bottom = function (c) { c.fill(0xac5f22); c.blotch(0.06, 2); c.grain(0.05); };
  T.terracotta = terracotta(0x975d43);
  T.white_terracotta = terracotta(0xd1b1a1);
  T.orange_terracotta = terracotta(0xa15325);
  T.yellow_terracotta = terracotta(0xba8523);
  T.brown_terracotta = terracotta(0x4d3323);
  T.red_terracotta = terracotta(0x8e3c2e);
  T.light_gray_terracotta = terracotta(0x876b62);
  T.purple_terracotta = terracotta(0x764656);
  T.cyan_terracotta = terracotta(0x565b5b);

  /* ================= ORES ================= */
  const stoneBg = T.stone, deepBg = T.deepslate;
  T.coal_ore = ore(stoneBg, 0x1b1b1b, 0x3a3a3a, 4);
  T.iron_ore = ore(stoneBg, 0xc8a17e, 0xe0c0a2, 4);
  T.copper_ore = ore(stoneBg, 0xd07a4a, 0xea9a6a, 4);
  T.gold_ore = ore(stoneBg, 0xf0c14b, 0xfff0a0, 4);
  T.redstone_ore = ore(stoneBg, 0xc22b1e, 0xf25a4a, 5);
  T.lapis_ore = ore(stoneBg, 0x1d47a5, 0x4a7ad6, 4);
  T.diamond_ore = ore(stoneBg, 0x2ce0d8, 0xa8fff8, 4);
  T.emerald_ore = ore(stoneBg, 0x1cc94b, 0x86f7a4, 3);
  T.deepslate_coal_ore = ore(deepBg, 0x121212, 0x2f2f2f, 4);
  T.deepslate_iron_ore = ore(deepBg, 0xbe9878, 0xdcbb9c, 4);
  T.deepslate_gold_ore = ore(deepBg, 0xefbe44, 0xfff0a0, 4);
  T.deepslate_redstone_ore = ore(deepBg, 0xbb271b, 0xf25a4a, 5);
  T.deepslate_lapis_ore = ore(deepBg, 0x1b45a3, 0x4a7ad6, 4);
  T.deepslate_diamond_ore = ore(deepBg, 0x2ce0d8, 0xa8fff8, 4);
  T.deepslate_emerald_ore = ore(deepBg, 0x1cc94b, 0x86f7a4, 3);

  T.coal_block = function (c) { c.fill(0x151515); c.blotch(0.35, 2); c.speckle(30, 0x2e2e2e, true); };
  T.iron_block = metalBlock(0xdcdcdc);
  T.gold_block = metalBlock(0xf6d33c);
  T.diamond_block = metalBlock(0x5decd5);
  T.emerald_block = metalBlock(0x2ed160);
  T.copper_block = metalBlock(0xc16b42);
  T.lapis_block = function (c) { c.fill(0x1f47a8); c.blotch(0.2, 2); c.speckle(36, 0x143480, true); c.speckle(18, 0x4b78d8, true); };
  T.redstone_block = function (c) { c.fill(0xa81f14); c.blotch(0.18, 2); c.speckle(36, 0x7a140c, true); c.speckle(18, 0xe04a38, true); };
  T.quartz_block = function (c) { c.fill(0xece5dd); c.blotch(0.05, 2); c.grain(0.04); c.bevel(0.93, 1.05); };
  T.bone_block = function (c) {
    c.fill(0xe1ddca);
    for (let x = 2; x < 14; x += 3) for (let y = 0; y < 16; y++) c.set(x, y, shade(0xe1ddca, 0.8));
    c.grain(0.05);
  };

  /* ================= WOOD ================= */
  const WOODS = {
    oak: { bark: 0x6d5433, top: 0xb08a51, plank: 0xb08a51, leaf: 0x4a8a2c },
    birch: { bark: 0xd7d3c8, top: 0xd0c99a, plank: 0xd7cca3, leaf: 0x6f9e4a },
    spruce: { bark: 0x4a3520, top: 0x8a6a3f, plank: 0x7a5a35, leaf: 0x2d5b32 },
    jungle: { bark: 0x5a4326, top: 0xac8455, plank: 0xa3714a, leaf: 0x3f8a24 },
    acacia: { bark: 0x6b5238, top: 0xa85b2c, plank: 0xb26a37, leaf: 0x71a334 },
    dark_oak: { bark: 0x3c2c17, top: 0x50361b, plank: 0x4a3319, leaf: 0x386b1f }
  };
  MC.WOODS = WOODS;
  Object.keys(WOODS).forEach(function (k) {
    const w = WOODS[k];
    T[k + '_log_side'] = logSide(w.bark);
    T[k + '_log_top'] = logTop(w.top, shade(w.bark, 0.95));
    T[k + '_planks'] = planks(w.plank);
    T[k + '_leaves'] = leaves(0xb4b4b4, k === 'spruce' ? 22 : 16, k === 'jungle');
    T[k + '_sapling'] = sapling(w.leaf, w.bark);
  });
  T.azalea_leaves = function (c) {
    leaves(0xb4b4b4, 14)(c);
    for (let i = 0; i < 10; i++) { const x = c.rng.int(16), y = c.rng.int(16); c.set(x, y, 0xd06fb0); c.set(x + 1, y, 0xe08fc4); }
  };
  T.bookshelf = function (c) {
    planks(WOODS.oak.plank)(c);
    c.rect(0, 3, 16, 10, 0x6d5433);
    const cols = [0xa22b2b, 0x2b52a2, 0xd0c060, 0x2b8a3c, 0x7a3ca2, 0xc06a2b];
    for (let shelfY = 3; shelfY < 13; shelfY += 5) {
      let x = 0;
      while (x < 16) {
        const w = 1 + (c.rng.int(2));
        const col = c.rng.pick(cols);
        for (let yy = shelfY; yy < shelfY + 4 && yy < 16; yy++)
          for (let xx = x; xx < x + w && xx < 16; xx++) c.set(xx, yy, shade(col, 0.8 + c.rng.next() * 0.4));
        x += w + 1;
      }
      for (let xx = 0; xx < 16; xx++) c.set(xx, shelfY + 4 > 15 ? 15 : shelfY + 4, 0x8a6a3f);
    }
  };
  T.ladder = function (c) {
    c.clear();
    for (let y = 0; y < 16; y++) { c.set(2, y, 0x8a6a3f); c.set(3, y, 0x6d5433); c.set(12, y, 0x8a6a3f); c.set(13, y, 0x6d5433); }
    for (let y = 2; y < 16; y += 5) for (let x = 3; x < 13; x++) { c.set(x, y, 0x9a7a4a); c.set(x, y + 1, 0x6d5433); }
  };

  /* ================= WOOL / CONCRETE-ISH COLOURS ================= */
  const DYES = {
    white: 0xe9ecec, orange: 0xf07613, magenta: 0xbd44b3, light_blue: 0x3ab3da,
    yellow: 0xf8c627, lime: 0x70b919, pink: 0xed8dac, gray: 0x3e4447,
    light_gray: 0x8e8e86, cyan: 0x158991, purple: 0x792fac, blue: 0x35399d,
    brown: 0x724728, green: 0x546d1b, red: 0xa12722, black: 0x141519
  };
  MC.DYES = DYES;
  Object.keys(DYES).forEach(function (k) { T[k + '_wool'] = wool(DYES[k]); });

  /* ================= GLASS / ICE / LIQUIDS ================= */
  T.glass = function (c) {
    c.clear();
    c.rect(0, 0, 16, 16, 0xcfe8f2, 40);
    c.frame(0, 0, 16, 16, 0xe8f4fa);
    for (let i = 0; i < 16; i++) c.data[c.idx(c.rng.int(16), c.rng.int(16)) + 3] = 90;
    c.line(2, 12, 6, 3, 0xffffff); c.line(9, 13, 13, 5, 0xf0fbff);
  };
  T.ice = function (c) { c.fill(0x7dadf5); c.blotch(0.1, 2); c.line(2, 13, 7, 2, 0xbfe0ff); c.line(9, 14, 14, 4, 0xa8d4ff); c.grain(0.05); };
  T.packed_ice = function (c) { c.fill(0x8ab4f0); c.blotch(0.07, 2); c.grain(0.04); };
  T.blue_ice = function (c) { c.fill(0x74a5f0); c.blotch(0.06, 2); c.grain(0.03); };
  T.snow = function (c) { c.fill(0xf2fafa); c.blotch(0.04, 2); c.speckle(24, 0xdfeaf0, true); c.grain(0.03); };
  T.water_still = function (c) {
    c.fill(0x2f5fd0);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const w = Math.sin(x * 0.7 + y * 0.35) * 0.5 + Math.sin(y * 0.9 - x * 0.2) * 0.5;
      c.set(x, y, mix(0x2b57c4, 0x4a86ee, (w + 1) / 2 * 0.7));
    }
    c.grain(0.05);
  };
  T.lava_still = function (c) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const w = Math.sin(x * 0.8 + y * 0.4) * 0.5 + Math.sin(y * 1.1 - x * 0.3) * 0.5;
      c.set(x, y, mix(0xcf3b0a, 0xfbc02d, (w + 1) / 2));
    }
    c.blobs(4, 1, 2.4, 0xffe98a, true);
    c.grain(0.06);
  };

  /* ================= BUILT / UTILITY ================= */
  T.bricks = bricksTex(0x9a5442, 0xb5a99a);
  T.stone_bricks = function (c) {
    c.fill(0x6d6d6d);
    const rows = [[0, 0, 8, 5], [8, 0, 8, 5], [0, 5, 5, 6], [5, 5, 11, 6], [0, 11, 11, 5], [11, 11, 5, 5]];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      for (let y = r[1]; y < r[1] + r[3] && y < 16; y++) for (let x = r[0]; x < r[0] + r[2] && x < 16; x++) {
        if (x === r[0] + r[2] - 1 || y === r[1] + r[3] - 1) c.set(x, y, 0x525252);
        else c.set(x, y, shade(0x7d7d7d, 0.88 + ((i * 13) % 7) / 7 * 0.24));
      }
    }
    c.grain(0.06);
  };
  T.mossy_stone_bricks = function (c) { T.stone_bricks(c); for (let i = 0; i < 55; i++) c.blend(c.rng.int(16), c.rng.int(16), 0x4f7a35, 0.6); };
  T.cracked_stone_bricks = function (c) {
    T.stone_bricks(c);
    c.line(3, 0, 6, 8, 0x4a4a4a); c.line(6, 8, 4, 15, 0x4a4a4a);
    c.line(11, 2, 13, 9, 0x4a4a4a);
  };
  T.chiseled_stone_bricks = function (c) {
    c.fill(0x6d6d6d); c.frame(0, 0, 16, 16, 0x525252);
    c.rect(2, 2, 12, 12, 0x7a7a7a);
    c.rect(4, 4, 8, 3, 0x5e5e5e); c.rect(4, 9, 8, 3, 0x5e5e5e);
    c.rect(6, 7, 4, 2, 0x666666);
    c.grain(0.06);
  };
  T.nether_bricks = bricksTex(0x30181c, 0x1c0d10);
  T.crafting_table_top = function (c) {
    planks(0x9a7548)(c);
    c.frame(0, 0, 16, 16, 0x5a4225);
    c.rect(2, 2, 5, 5, 0x6d5433); c.rect(9, 2, 5, 5, 0x8a6a3f);
    c.rect(2, 9, 5, 5, 0x8a6a3f); c.rect(9, 9, 5, 5, 0x6d5433);
    c.frame(2, 2, 5, 5, 0x4a3520); c.frame(9, 2, 5, 5, 0x4a3520);
    c.frame(2, 9, 5, 5, 0x4a3520); c.frame(9, 9, 5, 5, 0x4a3520);
  };
  T.crafting_table_front = function (c) {
    planks(0x9a7548)(c);
    c.rect(1, 4, 6, 5, 0x6d5433); c.frame(1, 4, 6, 5, 0x4a3520);
    c.rect(9, 4, 6, 5, 0x7a5a35); c.frame(9, 4, 6, 5, 0x4a3520);
    c.line(2, 10, 13, 10, 0x5a4225);
  };
  T.crafting_table_side = function (c) {
    planks(0x8a6a3f)(c);
    c.rect(2, 3, 12, 4, 0x6d5433); c.frame(2, 3, 12, 4, 0x4a3520);
    c.line(1, 9, 14, 9, 0x5a4225); c.line(1, 12, 14, 12, 0x5a4225);
  };
  T.furnace_side = function (c) { T.stone(c); c.tint(0x555555, 0.25); c.frame(0, 0, 16, 16, 0x5a5a5a); };
  T.furnace_top = function (c) { T.stone(c); c.tint(0x606060, 0.2); c.frame(0, 0, 16, 16, 0x5a5a5a); };
  T.furnace_front = function (c) {
    T.furnace_side(c);
    c.rect(3, 5, 10, 8, 0x2b2b2b); c.frame(3, 5, 10, 8, 0x151515);
    c.rect(4, 6, 8, 2, 0x4a4a4a);
    c.rect(4, 9, 8, 3, 0x1a1a1a);
  };
  T.furnace_front_on = function (c) {
    T.furnace_side(c);
    c.rect(3, 5, 10, 8, 0x2b2b2b); c.frame(3, 5, 10, 8, 0x151515);
    c.rect(4, 6, 8, 2, 0x4a4a4a);
    for (let y = 9; y < 13; y++) for (let x = 4; x < 12; x++) {
      c.set(x, y, mix(0xff9d2b, 0xffe066, c.rng.next()));
    }
    c.rect(5, 11, 2, 2, 0xfff0a0); c.rect(9, 11, 2, 2, 0xfff0a0);
  };
  T.chest_top = function (c) { planks(0x8a6a3f)(c); c.frame(0, 0, 16, 16, 0x5a4225); c.rect(6, 0, 4, 4, 0x8a8a8a); };
  T.chest_side = function (c) {
    planks(0x8a6a3f)(c);
    c.rect(0, 4, 16, 1, 0x4a3520); c.rect(0, 6, 16, 1, 0x4a3520);
    c.frame(0, 0, 16, 16, 0x5a4225);
  };
  T.chest_front = function (c) {
    T.chest_side(c);
    c.rect(6, 5, 4, 5, 0x6a6a6a); c.frame(6, 5, 4, 5, 0x3a3a3a);
    c.rect(7, 7, 2, 2, 0x2a2a2a);
    c.set(7, 6, 0xd0d0d0); c.set(8, 6, 0xd0d0d0);
  };
  T.tnt_side = function (c) {
    c.fill(0xc4392b);
    c.rect(0, 0, 16, 4, 0xdedede);
    c.rect(0, 12, 16, 4, 0x9a5a3a);
    for (let x = 0; x < 16; x++) { c.set(x, 4, 0x7a2418); c.set(x, 11, 0x7a2418); }
    // TNT lettering
    const letters = ['XX.XX.X..X', '.X..X..XX.X', '.X..X..X.XX'];
    c.rect(3, 6, 10, 4, 0xc4392b);
    c.art(['X X X X X X', ' X  X   X X'], { X: 0xf0f0f0 }, 3, 6);
    c.grain(0.05);
  };
  T.tnt_top = function (c) { c.fill(0xc4392b); c.rect(0, 0, 16, 3, 0xdedede); c.disc(8, 8, 3, 0xdedede); c.disc(8, 8, 1.5, 0x8a2a1e); c.grain(0.05); };
  T.tnt_bottom = function (c) { c.fill(0x9a5a3a); c.grain(0.06); };
  T.sponge = function (c) {
    c.fill(0xc7c452);
    for (let i = 0; i < 30; i++) c.disc(c.rng.int(16), c.rng.int(16), c.rng.range(0.8, 1.8), shade(0xa8a63f, 0.7 + c.rng.next() * 0.5));
    c.grain(0.08);
  };
  T.glowstone = function (c) {
    c.fill(0x8a6a35);
    for (let i = 0; i < 26; i++) c.disc(c.rng.int(16), c.rng.int(16), c.rng.range(0.9, 2.2), shade(0xf5d68a, 0.75 + c.rng.next() * 0.5));
    c.grain(0.08);
  };
  T.sea_lantern = function (c) {
    c.fill(0xa8c4c0);
    for (let i = 0; i < 20; i++) { const x = c.rng.int(14), y = c.rng.int(14); c.rect(x, y, 2, 2, shade(0xdff2ee, 0.8 + c.rng.next() * 0.4)); }
    c.frame(0, 0, 16, 16, 0x87a5a2);
  };
  T.magma = function (c) {
    c.fill(0x3a1c10);
    for (let i = 0; i < 22; i++) c.disc(c.rng.int(16), c.rng.int(16), c.rng.range(1, 2.6), mix(0xd44a12, 0xffcf5a, c.rng.next()));
    c.grain(0.1);
  };
  T.torch = function (c) {
    c.clear();
    for (let y = 8; y < 16; y++) { c.set(7, y, 0x8a6a3f); c.set(8, y, 0x6d5433); }
    c.rect(7, 6, 2, 2, 0xffcf4a);
    c.set(6, 7, 0xff9a2b); c.set(9, 7, 0xff9a2b);
    c.set(7, 5, 0xfff0a0); c.set(8, 5, 0xfff0a0);
  };
  T.hay_top = function (c) { c.fill(0xb99b23); c.disc(8, 8, 6, 0xa08618); c.disc(8, 8, 3, 0xc7a828); c.grain(0.1); };
  T.hay_side = function (c) {
    c.fill(0xc0a022);
    for (let y = 0; y < 16; y++) { const f = 0.85 + c.rng.next() * 0.3; for (let x = 0; x < 16; x++) c.set(x, y, shade(0xc0a022, f)); }
    for (let x = 3; x < 16; x += 6) for (let y = 0; y < 16; y++) c.set(x, y, 0x8a7010);
    c.grain(0.07);
  };
  T.melon_top = function (c) { c.fill(0x6a8a2a); c.blotch(0.1, 2); c.grain(0.06); };
  T.melon_side = function (c) {
    c.fill(0x6f9430);
    for (let x = 0; x < 16; x += 4) for (let y = 0; y < 16; y++) c.set(x + ((y / 4) | 0) % 2, y, 0x4a6a1c);
    c.speckle(30, 0x87a844, true);
    c.grain(0.06);
  };
  T.pumpkin_top = function (c) { c.fill(0xc07615); c.disc(8, 8, 5, 0xa8620f); c.rect(6, 6, 4, 4, 0x6d5433); c.grain(0.07); };
  T.pumpkin_side = function (c) {
    c.fill(0xc07615);
    for (let x = 2; x < 16; x += 4) for (let y = 0; y < 16; y++) c.set(x, y, 0x9a5a0c);
    c.grain(0.06);
  };
  T.pumpkin_face = function (c) {
    T.pumpkin_side(c);
    const F = 0x3a2408;
    c.art([
      '  XX     XX  ',
      '  XXX   XXX  ',
      '   XXX XXX   ',
      '             ',
      ' XX XX XX XX ',
      ' XXXXXXXXXXX '
    ], { X: F }, 1, 3);
  };
  T.jack_o_lantern = function (c) {
    T.pumpkin_side(c);
    const F = 0xffd45a;
    c.art([
      '  XX     XX  ',
      '  XXX   XXX  ',
      '   XXX XXX   ',
      '             ',
      ' XX XX XX XX ',
      ' XXXXXXXXXXX '
    ], { X: F }, 1, 3);
  };
  T.cactus_top = function (c) { c.fill(0x0f6b1c); c.disc(8, 8, 6, 0x14802b); c.frame(0, 0, 16, 16, 0x0a4a12); c.grain(0.07); };
  T.cactus_side = function (c) {
    c.fill(0x0d7a20);
    c.rect(0, 0, 1, 16, 0x0a5a16); c.rect(15, 0, 1, 16, 0x0a5a16);
    for (let y = 1; y < 16; y += 4) for (let x = 2; x < 15; x += 4) { c.set(x, y, 0xcfe0a0); c.set(x, y + 1, 0x0a4a12); }
    c.grain(0.06);
  };
  T.cactus_bottom = function (c) { c.fill(0x0a5a16); c.grain(0.07); };
  T.sugar_cane = function (c) {
    c.clear();
    for (let y = 0; y < 16; y++) {
      for (let x = 5; x < 11; x++) c.set(x, y, shade(0x96c37a, 0.85 + ((x + y) % 4) * 0.08));
    }
    for (let y = 3; y < 16; y += 5) for (let x = 5; x < 11; x++) c.set(x, y, 0x6f9a55);
  };
  T.wheat_0 = crossPlant(0x6d8a3a, null, false);
  T.wheat_1 = crossPlant(0x7a9a3f, null, true);
  T.wheat_2 = crossPlant(0xa8a83f, null, true);
  T.wheat_3 = function (c) { crossPlant(0xd8c04a, 0xe8d05a, true)(c); c.speckle(14, 0xf0dc7a, true); };
  T.carrots = function (c) { crossPlant(0x3f8a2c, null, true)(c); c.set(6, 14, 0xe07a1a); c.set(9, 13, 0xe07a1a); };
  T.potatoes = function (c) { crossPlant(0x4a8a2c, null, true)(c); c.set(6, 14, 0xd0b060); c.set(9, 14, 0xd0b060); };

  /* ================= PLANTS ================= */
  T.short_grass = crossPlant(0xb4b4b4, null, false);   // tinted by biome
  T.tall_grass_top = crossPlant(0xb4b4b4, null, true);
  T.tall_grass_bottom = crossPlant(0xb0b0b0, null, true);
  T.fern = crossPlant(0xa8a8a8, null, false);
  T.dead_bush = function (c) {
    c.clear();
    const col = 0x8a6a3a;
    c.line(7, 15, 7, 6, col); c.line(7, 10, 4, 6, shade(col, 0.85));
    c.line(7, 9, 11, 5, shade(col, 1.1)); c.line(7, 12, 3, 10, shade(col, 0.9));
    c.line(7, 8, 10, 3, col);
  };
  T.dandelion = flower(0x4a8a2c, 0xf0d040, 0xfff090);
  T.poppy = flower(0x4a8a2c, 0xd02b1e, 0x2b2b2b);
  T.blue_orchid = flower(0x4a8a2c, 0x2fa8e0, 0xf0e070);
  T.allium = flower(0x4a8a2c, 0xb060d0, 0xd0a0e0);
  T.azure_bluet = flower(0x4a8a2c, 0xf0f0f0, 0xf0d040);
  T.red_tulip = flower(0x4a8a2c, 0xd0301e, 0x50a030);
  T.orange_tulip = flower(0x4a8a2c, 0xe08020, 0x50a030);
  T.white_tulip = flower(0x4a8a2c, 0xf0f0f0, 0x50a030);
  T.pink_tulip = flower(0x4a8a2c, 0xf0a0c0, 0x50a030);
  T.oxeye_daisy = flower(0x4a8a2c, 0xf5f5f0, 0xf0c030);
  T.cornflower = flower(0x4a8a2c, 0x4060d0, 0x8090e0);
  T.lily_of_the_valley = flower(0x4a8a2c, 0xf8f8f8, 0xe0e0e0);
  T.brown_mushroom = function (c) {
    c.clear();
    c.rect(7, 9, 2, 5, 0xd0c0a0);
    c.disc(8, 8, 3.6, 0x9a6b4a);
    c.rect(5, 9, 7, 1, 0x7a5030);
    c.set(6, 6, 0xb08a68); c.set(10, 7, 0xb08a68);
  };
  T.red_mushroom = function (c) {
    c.clear();
    c.rect(7, 9, 2, 5, 0xe0d0c0);
    c.disc(8, 8, 3.8, 0xc42b22);
    c.rect(5, 9, 7, 1, 0x8a1a14);
    c.set(6, 6, 0xf0f0f0); c.set(10, 7, 0xf0f0f0); c.set(8, 5, 0xf0f0f0);
  };
  T.vine = function (c) {
    c.clear();
    for (let i = 0; i < 5; i++) {
      const x = 1 + i * 3 + c.rng.int(2);
      const h = 8 + c.rng.int(8);
      for (let y = 0; y < h; y++) c.set(x + Math.round(Math.sin(y * 0.6) * 1.2), y, shade(0xb4b4b4, 0.75 + c.rng.next() * 0.4));
    }
  };
  T.lily_pad = function (c) {
    c.clear();
    c.disc(8, 8, 7, 0x76a83a);
    c.disc(8, 8, 4.5, 0x86bd44);
    c.line(8, 8, 14, 12, 0x5a8a2a);
    for (let i = 0; i < 8; i++) c.set(c.rng.int(16), c.rng.int(16), 0x6a9a30);
  };

  /* ================= BREAK OVERLAY (10 stages) ================= */
  for (let s = 0; s < 10; s++) {
    T['destroy_' + s] = (function (stage) {
      return function (c) {
        c.clear();
        const rng = new MC.RNG(7000 + stage);
        const cracks = 1 + stage;
        for (let i = 0; i < cracks; i++) {
          let x = rng.int(16), y = rng.int(16);
          const len = 3 + stage * 2;
          for (let k = 0; k < len; k++) {
            c.set(x, y, 0x000000, 190);
            if (rng.chance(0.5)) c.set(x + 1, y, 0x000000, 120);
            x += rng.int(3) - 1; y += rng.int(3) - 1;
            x = Math.max(0, Math.min(15, x)); y = Math.max(0, Math.min(15, y));
          }
        }
      };
    })(s);
  }

  /* ---- special: solid white tile used for coloured/untextured quads ---- */
  T.white = function (c) { c.fill(0xffffff); };
})();
