/* ============================================================
 * mobart.js - box models + procedural skins for every creature.
 * Model units are 1/16 of a block, origin at the feet centre,
 * -Z is forward (the direction the mob faces).
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});
  const P = MC.paint;
  const shade = P.shade, mix = P.mix;

  const TEXW = 64, TEXH = 64;      // one skin per mob
  const MOBS = {};
  MC.mobArt = { MOBS: MOBS, TEXW: TEXW, TEXH: TEXH };

  /* box(name, size[w,h,d], pos[centre], uv[u,v], opts) */
  function box(name, size, pos, uv, opts) {
    opts = opts || {};
    return {
      name: name,
      size: size,
      pos: pos,
      pivot: opts.pivot || pos,
      rot: opts.rot || [0, 0, 0],
      uv: uv,
      anim: opts.anim || null,
      inflate: opts.inflate || 0,
      alpha: opts.alpha === undefined ? 1 : opts.alpha,
      layer: opts.layer || 0
    };
  }

  // MC-style box unwrap: [-X, +X, top, bottom, front(+Z... we use -Z), back]
  function uvRects(part) {
    const w = part.size[0], h = part.size[1], d = part.size[2];
    const u = part.uv[0], v = part.uv[1];
    return {
      xn: [u, v + d, d, h],
      xp: [u + d + w, v + d, d, h],
      yp: [u + d, v, w, d],
      yn: [u + d + w, v, w, d],
      zn: [u + d, v + d, w, h],          // front (faces -Z)
      zp: [u + d + w + d, v + d, w, h]   // back
    };
  }
  MC.mobArt.uvRects = uvRects;

  /* ---------------- texture painting helpers ---------------- */
  function Skin(canvas, model) {
    this.c = canvas;
    this.parts = {};
    for (let i = 0; i < model.length; i++) this.parts[model[i].name] = model[i];
  }
  Skin.prototype.rect = function (partName, face) {
    const p = this.parts[partName];
    if (!p) return null;
    return uvRects(p)[face];
  };
  Skin.prototype.fillPart = function (partName, col, vary) {
    const p = this.parts[partName];
    if (!p) return this;
    const r = uvRects(p), c = this.c;
    const faces = ['xn', 'xp', 'yp', 'yn', 'zn', 'zp'];
    for (let i = 0; i < faces.length; i++) {
      const q = r[faces[i]];
      for (let y = q[1]; y < q[1] + q[3]; y++)
        for (let x = q[0]; x < q[0] + q[2]; x++)
          c.set(x, y, vary ? shade(col, 0.9 + c.rng.next() * 0.2) : col);
    }
    return this;
  };
  Skin.prototype.fillAll = function (col, vary) {
    for (const k in this.parts) this.fillPart(k, col, vary);
    return this;
  };
  Skin.prototype.face = function (partName, face, fn) {
    const r = this.rect(partName, face);
    if (!r) return this;
    fn(this.c, r[0], r[1], r[2], r[3]);
    return this;
  };
  Skin.prototype.eyes = function (partName, col, white, y, spread) {
    const self = this;
    this.face(partName, 'zn', function (c, x0, y0, w, h) {
      const ey = y0 + (y === undefined ? Math.floor(h * 0.35) : y);
      const cx = x0 + w / 2;
      const s = spread === undefined ? Math.max(1, Math.floor(w * 0.22)) : spread;
      const ew = Math.max(1, Math.floor(w * 0.12));
      for (let i = 0; i < ew + 1; i++) {
        for (let j = 0; j < 2; j++) {
          if (white !== null && white !== undefined) {
            c.set(cx - s - i - 1, ey + j, white);
            c.set(cx + s + i, ey + j, white);
          }
          c.set(cx - s - i, ey + j, col);
          c.set(cx + s + i - 1, ey + j, col);
        }
      }
    });
    return this;
  };
  Skin.prototype.mouth = function (partName, col, yoff, w) {
    this.face(partName, 'zn', function (c, x0, y0, fw, fh) {
      const y = y0 + (yoff === undefined ? Math.floor(fh * 0.68) : yoff);
      const ww = w || Math.floor(fw * 0.4);
      for (let i = 0; i < ww; i++) c.set(x0 + Math.floor((fw - ww) / 2) + i, y, col);
    });
    return this;
  };

  /* ============================================================
   * shared rigs
   * ============================================================ */

  // four-legged animal
  function quadruped(o) {
    const bw = o.body[0], bh = o.body[1], bd = o.body[2];
    const by = o.bodyY;
    const lw = o.leg[0], lh = o.leg[1], ld = o.leg[2];
    const legZ = o.legZ || (bd / 2 - ld / 2 - 1);
    const legX = o.legX || (bw / 2 - lw / 2);
    const parts = [
      box('body', [bw, bh, bd], [0, by, 0], o.uvBody || [0, 16]),
      box('head', o.head, [0, o.headY, -(bd / 2 + o.head[2] / 2 - (o.headIn || 1))], o.uvHead || [0, 0],
        { anim: 'head', pivot: [0, o.headY, -(bd / 2 - (o.headIn || 1))] }),
      box('legFL', [lw, lh, ld], [-legX, lh / 2, -legZ], o.uvLeg || [0, 40], { anim: 'legFL', pivot: [-legX, lh, -legZ] }),
      box('legFR', [lw, lh, ld], [legX, lh / 2, -legZ], o.uvLeg || [0, 40], { anim: 'legFR', pivot: [legX, lh, -legZ] }),
      box('legBL', [lw, lh, ld], [-legX, lh / 2, legZ], o.uvLeg || [0, 40], { anim: 'legBL', pivot: [-legX, lh, legZ] }),
      box('legBR', [lw, lh, ld], [legX, lh / 2, legZ], o.uvLeg || [0, 40], { anim: 'legBR', pivot: [legX, lh, legZ] })
    ];
    if (o.extra) o.extra(parts, box);
    return parts;
  }

  // two-legged humanoid
  function humanoid(o) {
    o = o || {};
    const armW = o.armW || 4, armD = o.armD || 4;
    const legH = o.legH || 12, bodyH = o.bodyH || 12;
    const headY = legH + bodyH + 4;
    return [
      box('head', [8, 8, 8], [0, headY, 0], [0, 0], { anim: 'head', pivot: [0, legH + bodyH, 0] }),
      box('body', [8, bodyH, 4], [0, legH + bodyH / 2, 0], [16, 16]),
      box('armL', [armW, bodyH, armD], [-(4 + armW / 2), legH + bodyH - bodyH / 2, 0], [40, 16],
        { anim: 'armL', pivot: [-(4 + armW / 2), legH + bodyH - 2, 0] }),
      box('armR', [armW, bodyH, armD], [4 + armW / 2, legH + bodyH - bodyH / 2, 0], [40, 16],
        { anim: 'armR', pivot: [4 + armW / 2, legH + bodyH - 2, 0] }),
      box('legL', [armW, legH, armD], [-armW / 2, legH / 2, 0], [0, 16], { anim: 'legL', pivot: [-armW / 2, legH, 0] }),
      box('legR', [armW, legH, armD], [armW / 2, legH / 2, 0], [0, 16], { anim: 'legR', pivot: [armW / 2, legH, 0] })
    ];
  }
  MC.mobArt.humanoid = humanoid;

  function mob(name, o) {
    MOBS[name] = {
      name: name,
      display: o.display || name.replace(/_/g, ' ').replace(/\b\w/g, function (m) { return m.toUpperCase(); }),
      model: o.model,
      tex: o.tex,
      width: o.width, height: o.height,
      eyeHeight: o.eyeHeight || o.height * 0.85,
      scale: o.scale || 1 / 16,
      health: o.health || 10,
      hostile: !!o.hostile,
      damage: o.damage || 0,
      speed: o.speed || 1.2,
      drops: o.drops || [],
      xp: o.xp || 1,
      sound: o.sound || null,
      babyScale: o.babyScale || 0.55,
      swim: !!o.swim,
      arms: !!o.arms
    };
    return MOBS[name];
  }
  MC.mobArt.mob = mob;

  /* ============================================================
   * the roster
   * ============================================================ */

  /* ---- pig ---- */
  mob('pig', {
    width: 0.9, height: 0.9, health: 10, speed: 1.0, xp: 2,
    drops: [['porkchop', 1, 3]],
    model: quadruped({
      body: [10, 8, 16], bodyY: 11, head: [8, 8, 8], headY: 12, leg: [4, 6, 4],
      uvBody: [28, 8], uvHead: [0, 0], uvLeg: [0, 16],
      extra: function (parts) { parts.push(box('snout', [4, 3, 1], [0, 11, -15.5], [16, 16])); }
    }),
    tex: function (c, s) {
      s.fillAll(0xef9a9a, true);
      s.fillPart('snout', 0xd07070);
      s.eyes('head', 0x2a1a1a, 0xf2f2f2, 2, 2);
      s.fillPart('legFL', 0xd98787); s.fillPart('legFR', 0xd98787);
      s.fillPart('legBL', 0xd98787); s.fillPart('legBR', 0xd98787);
    }
  });

  /* ---- cow & mooshroom ---- */
  function cowModel() {
    return quadruped({
      body: [12, 10, 18], bodyY: 13, head: [8, 8, 6], headY: 18, leg: [4, 12, 4],
      uvBody: [26, 6], uvHead: [0, 0], uvLeg: [0, 20],
      extra: function (parts) {
        parts.push(box('hornL', [1, 3, 1], [-4.5, 22.5, -14], [20, 0]));
        parts.push(box('hornR', [1, 3, 1], [4.5, 22.5, -14], [24, 0]));
        parts.push(box('udder', [6, 1, 4], [0, 7.5, 4], [40, 42]));
      }
    });
  }
  mob('cow', {
    width: 0.9, height: 1.4, health: 10, speed: 0.9, xp: 2,
    drops: [['beef', 1, 3], ['leather', 0, 2]],
    model: cowModel(),
    tex: function (c, s) {
      s.fillAll(0x4a3722, true);
      s.fillPart('head', 0x4a3722);
      s.face('head', 'zn', function (cv, x, y, w, h) {
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) cv.set(x + i, y + j, 0xd8d8d8);
      });
      s.eyes('head', 0x2a1a1a, 0xffffff, 2, 2);
      s.mouth('head', 0x9a8070, 5, 4);
      s.fillPart('hornL', 0xe8e0c0); s.fillPart('hornR', 0xe8e0c0);
      s.fillPart('udder', 0xf0a0a0);
      // white patches on the body
      const r = s.rect('body', 'yp');
      for (let i = 0; i < 26; i++) {
        const x = r[0] + c.rng.int(r[2]), y = r[1] + c.rng.int(r[3]);
        c.disc(x, y, 1 + c.rng.next() * 1.6, 0xe6e6e6);
      }
      const r2 = s.rect('body', 'xn');
      for (let i = 0; i < 14; i++) c.disc(r2[0] + c.rng.int(r2[2]), r2[1] + c.rng.int(r2[3]), 1 + c.rng.next() * 1.8, 0xe6e6e6);
      const r3 = s.rect('body', 'xp');
      for (let i = 0; i < 14; i++) c.disc(r3[0] + c.rng.int(r3[2]), r3[1] + c.rng.int(r3[3]), 1 + c.rng.next() * 1.8, 0xe6e6e6);
    }
  });
  mob('mooshroom', {
    width: 0.9, height: 1.4, health: 10, speed: 0.9, xp: 2,
    drops: [['beef', 1, 3], ['red_mushroom', 1, 2]],
    model: cowModel(),
    tex: function (c, s) {
      s.fillAll(0xa02c2c, true);
      s.fillPart('hornL', 0xe8e0c0); s.fillPart('hornR', 0xe8e0c0);
      s.eyes('head', 0x2a1a1a, 0xffffff, 2, 2);
      const faces = ['yp', 'xn', 'xp', 'zn', 'zp'];
      for (let f = 0; f < faces.length; f++) {
        const r = s.rect('body', faces[f]);
        if (!r) continue;
        for (let i = 0; i < 10; i++) {
          const x = r[0] + c.rng.int(Math.max(1, r[2] - 2)), y = r[1] + c.rng.int(Math.max(1, r[3] - 2));
          c.disc(x, y, 1.4, 0xe8e8e8);
          c.set(x, y, 0xf5f5f5);
        }
      }
    }
  });

  /* ---- sheep ---- */
  mob('sheep', {
    width: 0.9, height: 1.3, health: 8, speed: 0.9, xp: 2,
    drops: [['mutton', 1, 2], ['white_wool', 1, 1]],
    model: quadruped({
      body: [9, 11, 17], bodyY: 13, head: [6, 6, 8], headY: 17, leg: [4, 12, 4],
      headIn: 2, uvBody: [26, 6], uvHead: [0, 0], uvLeg: [0, 20],
      extra: function (parts) {
        parts.push(box('woolBody', [10, 12, 18], [0, 13, 0], [26, 30], { inflate: 0.4 }));
        parts.push(box('woolHead', [7, 7, 5], [0, 17, -8.5], [0, 30]));
      }
    }),
    tex: function (c, s) {
      s.fillAll(0xf0e0d0, true);
      s.fillPart('woolBody', 0xf5f0e8, true);
      s.fillPart('woolHead', 0xf5f0e8, true);
      // fluff the wool
      const faces = ['yp', 'xn', 'xp', 'zn', 'zp', 'yn'];
      for (let f = 0; f < faces.length; f++) {
        const r = s.rect('woolBody', faces[f]);
        if (!r) continue;
        for (let i = 0; i < 40; i++) c.set(r[0] + c.rng.int(r[2]), r[1] + c.rng.int(r[3]), c.rng.chance(0.5) ? 0xe0d8cc : 0xffffff);
      }
      s.fillPart('head', 0xe8d8c8);
      s.eyes('head', 0x1a1a1a, 0xffffff, 2, 1);
      s.fillPart('legFL', 0xd8c8b8); s.fillPart('legFR', 0xd8c8b8);
      s.fillPart('legBL', 0xd8c8b8); s.fillPart('legBR', 0xd8c8b8);
    }
  });

  /* ---- chicken ---- */
  mob('chicken', {
    width: 0.4, height: 0.7, health: 4, speed: 0.9, xp: 1,
    drops: [['chicken', 1, 1], ['feather', 0, 2]],
    model: [
      box('body', [6, 6, 8], [0, 8, 0], [0, 18]),
      box('head', [4, 6, 3], [0, 14, -5], [0, 0], { anim: 'head', pivot: [0, 12, -4] }),
      box('beak', [4, 2, 2], [0, 13.5, -7.5], [14, 0], { anim: 'head', pivot: [0, 12, -4] }),
      box('wattle', [2, 2, 2], [0, 11.5, -7], [14, 4], { anim: 'head', pivot: [0, 12, -4] }),
      box('wingL', [1, 4, 6], [-3.5, 9, 0], [24, 13], { anim: 'wingL', pivot: [-3.5, 12, 0] }),
      box('wingR', [1, 4, 6], [3.5, 9, 0], [24, 13], { anim: 'wingR', pivot: [3.5, 12, 0] }),
      box('legL', [3, 5, 3], [-2, 2.5, 0], [26, 0], { anim: 'legFL', pivot: [-2, 5, 0] }),
      box('legR', [3, 5, 3], [2, 2.5, 0], [26, 0], { anim: 'legFR', pivot: [2, 5, 0] })
    ],
    tex: function (c, s) {
      s.fillAll(0xf2f2f2, true);
      s.fillPart('beak', 0xf0b429);
      s.fillPart('wattle', 0xc41f1f);
      s.fillPart('legL', 0xf0b429); s.fillPart('legR', 0xf0b429);
      s.eyes('head', 0x1a1a1a, 0xd0d0d0, 1, 1);
    }
  });

  /* ---- rabbit ---- */
  mob('rabbit', {
    width: 0.4, height: 0.5, health: 3, speed: 1.4, xp: 1,
    drops: [['leather', 0, 1]],
    model: [
      box('body', [6, 5, 8], [0, 5, 0], [0, 20]),
      box('head', [5, 4, 5], [0, 8, -5], [0, 0], { anim: 'head', pivot: [0, 7, -3] }),
      box('earL', [1, 5, 2], [-1.5, 12, -4.5], [20, 0], { anim: 'head', pivot: [0, 7, -3] }),
      box('earR', [1, 5, 2], [1.5, 12, -4.5], [26, 0], { anim: 'head', pivot: [0, 7, -3] }),
      box('legFL', [2, 4, 2], [-2, 2, -2.5], [8, 15], { anim: 'legFL', pivot: [-2, 4, -2.5] }),
      box('legFR', [2, 4, 2], [2, 2, -2.5], [8, 15], { anim: 'legFR', pivot: [2, 4, -2.5] }),
      box('legBL', [2, 3, 5], [-2, 1.5, 2.5], [16, 15], { anim: 'legBL', pivot: [-2, 3, 2.5] }),
      box('legBR', [2, 3, 5], [2, 1.5, 2.5], [16, 15], { anim: 'legBR', pivot: [2, 3, 2.5] }),
      box('tail', [2, 2, 1], [0, 6, 4.5], [30, 15])
    ],
    tex: function (c, s) {
      s.fillAll(0xa08560, true);
      s.fillPart('tail', 0xf0f0f0);
      s.eyes('head', 0x9a3a3a, 0xf0e0d0, 1, 1);
    }
  });

  /* ---- wolf ---- */
  mob('wolf', {
    width: 0.6, height: 0.85, health: 8, speed: 1.6, xp: 2, damage: 3,
    drops: [],
    model: quadruped({
      body: [6, 6, 9], bodyY: 10, head: [6, 6, 4], headY: 13, leg: [2, 8, 2],
      headIn: 0, uvBody: [18, 14], uvLeg: [0, 18],
      extra: function (parts) {
        parts.push(box('earL', [2, 2, 1], [-2, 17, -6], [16, 14], { anim: 'head', pivot: [0, 13, -4] }));
        parts.push(box('earR', [2, 2, 1], [2, 17, -6], [16, 14], { anim: 'head', pivot: [0, 13, -4] }));
        parts.push(box('tail', [2, 8, 2], [0, 11, 5.5], [9, 18], { anim: 'tail', pivot: [0, 13, 5] }));
      }
    }),
    tex: function (c, s) {
      s.fillAll(0xd6d6d6, true);
      s.fillPart('head', 0xdcdcdc);
      s.face('head', 'zn', function (cv, x, y, w, h) {
        for (let j = h - 2; j < h; j++) for (let i = 1; i < w - 1; i++) cv.set(x + i, y + j, 0xf0f0f0);
      });
      s.eyes('head', 0x1a1a1a, 0xffffff, 1, 1);
      s.set = null;
      s.fillPart('legFL', 0xc8c8c8); s.fillPart('legFR', 0xc8c8c8);
      s.fillPart('legBL', 0xc8c8c8); s.fillPart('legBR', 0xc8c8c8);
    }
  });

  /* ---- goat ---- */
  mob('goat', {
    width: 0.9, height: 1.3, health: 10, speed: 1.1, xp: 2,
    drops: [['mutton', 1, 2]],
    model: quadruped({
      body: [9, 10, 16], bodyY: 13, head: [6, 6, 8], headY: 17, leg: [4, 12, 4],
      headIn: 2, uvBody: [26, 6], uvLeg: [0, 20],
      extra: function (parts) {
        parts.push(box('hornL', [2, 6, 2], [-2.5, 22, -8], [20, 0], { anim: 'head', pivot: [0, 17, -6] }));
        parts.push(box('hornR', [2, 6, 2], [2.5, 22, -8], [26, 0], { anim: 'head', pivot: [0, 17, -6] }));
      }
    }),
    tex: function (c, s) {
      s.fillAll(0xd8d0c4, true);
      s.fillPart('hornL', 0x8a7a68); s.fillPart('hornR', 0x8a7a68);
      s.eyes('head', 0x1a1a1a, 0xffffff, 2, 1);
    }
  });

  /* ---- horse ---- */
  mob('horse', {
    width: 1.2, height: 1.6, health: 20, speed: 1.9, xp: 3,
    drops: [['leather', 0, 2]],
    model: [
      box('body', [10, 10, 22], [0, 16, 0], [0, 32]),
      box('neck', [4, 12, 8], [0, 24, -8], [0, 12], { anim: 'head', pivot: [0, 20, -6], rot: [0.5, 0, 0] }),
      box('head', [5, 6, 11], [0, 29, -13], [0, 0], { anim: 'head', pivot: [0, 20, -6] }),
      box('earL', [1, 3, 1], [-1.5, 33, -9], [22, 0], { anim: 'head', pivot: [0, 20, -6] }),
      box('earR', [1, 3, 1], [1.5, 33, -9], [26, 0], { anim: 'head', pivot: [0, 20, -6] }),
      box('legFL', [4, 16, 4], [-3, 8, -7], [40, 0], { anim: 'legFL', pivot: [-3, 16, -7] }),
      box('legFR', [4, 16, 4], [3, 8, -7], [40, 0], { anim: 'legFR', pivot: [3, 16, -7] }),
      box('legBL', [4, 16, 4], [-3, 8, 7], [40, 0], { anim: 'legBL', pivot: [-3, 16, 7] }),
      box('legBR', [4, 16, 4], [3, 8, 7], [40, 0], { anim: 'legBR', pivot: [3, 16, 7] }),
      box('tail', [3, 12, 3], [0, 20, 11], [42, 36], { anim: 'tail', pivot: [0, 24, 11], rot: [-0.4, 0, 0] })
    ],
    tex: function (c, s) {
      s.fillAll(0x6b4a2a, true);
      s.fillPart('legFL', 0x5a3c22); s.fillPart('legFR', 0x5a3c22);
      s.fillPart('legBL', 0x5a3c22); s.fillPart('legBR', 0x5a3c22);
      s.fillPart('tail', 0x2f2018);
      s.fillPart('neck', 0x6b4a2a);
      s.eyes('head', 0x1a1a1a, 0xffffff, 1, 1);
      s.face('head', 'zn', function (cv, x, y, w, h) {
        for (let j = h - 3; j < h; j++) for (let i = 1; i < w - 1; i++) cv.set(x + i, y + j, 0x40291a);
      });
    }
  });

  /* ---- zombie ---- */
  mob('zombie', {
    width: 0.6, height: 1.95, health: 20, speed: 1.1, damage: 3, hostile: true, xp: 5,
    arms: true, drops: [['rotten_flesh', 0, 2]],
    model: humanoid(),
    tex: function (c, s) {
      s.fillAll(0x3a7a4a, true);
      s.fillPart('head', 0x4a8a52, true);
      s.eyes('head', 0x1a2a1a, null, 3, 2);
      s.mouth('head', 0x1e3a24, 6, 4);
      s.fillPart('body', 0x3d5ba8, true);
      s.fillPart('legL', 0x33488a, true); s.fillPart('legR', 0x33488a, true);
    }
  });

  /* ---- skeleton ---- */
  mob('skeleton', {
    width: 0.6, height: 1.95, health: 20, speed: 1.2, damage: 2, hostile: true, xp: 5,
    arms: true, drops: [['bone', 0, 2], ['arrow', 0, 2]],
    model: humanoid({ armW: 2, armD: 2 }),
    tex: function (c, s) {
      s.fillAll(0xc8c8c8, true);
      s.eyes('head', 0x141414, null, 3, 2);
      s.mouth('head', 0x141414, 6, 5);
      s.face('head', 'zn', function (cv, x, y, w, h) {
        cv.set(x + 3, y + 6, 0x141414); cv.set(x + 5, y + 6, 0x141414);
      });
      // rib shading
      const r = s.rect('body', 'zn');
      for (let j = 1; j < r[3]; j += 3) for (let i = 1; i < r[2] - 1; i++) c.set(r[0] + i, r[1] + j, 0xa8a8a8);
    }
  });

  /* ---- creeper ---- */
  mob('creeper', {
    width: 0.6, height: 1.7, health: 20, speed: 1.0, damage: 0, hostile: true, xp: 5,
    drops: [['gunpowder', 0, 2]],
    model: [
      box('head', [8, 8, 8], [0, 20, 0], [0, 0], { anim: 'head', pivot: [0, 18, 0] }),
      box('body', [8, 12, 4], [0, 12, 0], [16, 16]),
      box('legFL', [4, 6, 4], [-2, 3, -4], [0, 16], { anim: 'legFL', pivot: [-2, 6, -4] }),
      box('legFR', [4, 6, 4], [2, 3, -4], [0, 16], { anim: 'legFR', pivot: [2, 6, -4] }),
      box('legBL', [4, 6, 4], [-2, 3, 4], [0, 16], { anim: 'legBL', pivot: [-2, 6, 4] }),
      box('legBR', [4, 6, 4], [2, 3, 4], [0, 16], { anim: 'legBR', pivot: [2, 6, 4] })
    ],
    tex: function (c, s) {
      s.fillAll(0x4c9c3d, true);
      // the classic face
      s.face('head', 'zn', function (cv, x, y, w, h) {
        const F = 0x0d1a0d;
        cv.rect(x + 2, y + 2, 2, 2, F); cv.rect(x + 4, y + 2, 2, 2, F);
        cv.rect(x + 2, y + 2, 2, 2, F);
        cv.rect(x + 1, y + 2, 2, 2, F); cv.rect(x + 5, y + 2, 2, 2, F);
        cv.rect(x + 3, y + 4, 2, 3, F);
        cv.rect(x + 2, y + 5, 4, 2, F);
        cv.rect(x + 2, y + 7, 1, 1, F); cv.rect(x + 5, y + 7, 1, 1, F);
      });
      // mottled camouflage
      const faces = ['yp', 'xn', 'xp', 'zp'];
      for (let f = 0; f < faces.length; f++) {
        const r = s.rect('body', faces[f]);
        if (!r) continue;
        for (let i = 0; i < 16; i++) c.set(r[0] + c.rng.int(r[2]), r[1] + c.rng.int(r[3]), c.rng.chance(0.5) ? 0x3c7a30 : 0x66b34c);
      }
    }
  });

  /* ---- spider ---- */
  mob('spider', {
    width: 1.4, height: 0.9, health: 16, speed: 1.5, damage: 2, hostile: true, xp: 5,
    drops: [['string', 0, 2]],
    model: (function () {
      const parts = [
        box('body', [10, 8, 12], [0, 9, 3], [0, 12]),
        box('head', [8, 8, 8], [0, 9, -7], [32, 4], { anim: 'head', pivot: [0, 9, -3] }),
        box('rear', [6, 6, 6], [0, 9, 11], [0, 0])
      ];
      const zs = [-3, -1, 1, 3];
      for (let i = 0; i < 4; i++) {
        parts.push(box('legL' + i, [14, 1.4, 1.4], [-8, 9, zs[i] + 2], [18, 0],
          { anim: 'spiderL' + i, pivot: [-4, 9, zs[i] + 2], rot: [0, (i - 1.5) * 0.28, 0.32] }));
        parts.push(box('legR' + i, [14, 1.4, 1.4], [8, 9, zs[i] + 2], [18, 0],
          { anim: 'spiderR' + i, pivot: [4, 9, zs[i] + 2], rot: [0, -(i - 1.5) * 0.28, -0.32] }));
      }
      return parts;
    })(),
    tex: function (c, s) {
      s.fillAll(0x2a2018, true);
      s.fillPart('head', 0x241a14);
      s.face('head', 'zn', function (cv, x, y, w, h) {
        const E = 0xb02020;
        cv.rect(x + 1, y + 2, 2, 2, E); cv.rect(x + 5, y + 2, 2, 2, E);
        cv.set(x + 3, y + 1, E); cv.set(x + 4, y + 1, E);
      });
    }
  });

  /* ---- enderman ---- */
  mob('enderman', {
    width: 0.6, height: 2.9, health: 40, speed: 1.4, damage: 7, hostile: true, xp: 10,
    arms: true, drops: [['ender_pearl', 0, 1]],
    model: [
      box('head', [8, 8, 8], [0, 42, 0], [0, 0], { anim: 'head', pivot: [0, 38, 0] }),
      box('body', [8, 12, 4], [0, 32, 0], [16, 16]),
      box('armL', [2, 26, 2], [-5, 25, 0], [40, 16], { anim: 'armL', pivot: [-5, 37, 0] }),
      box('armR', [2, 26, 2], [5, 25, 0], [40, 16], { anim: 'armR', pivot: [5, 37, 0] }),
      box('legL', [2, 26, 2], [-2, 13, 0], [0, 16], { anim: 'legL', pivot: [-2, 26, 0] }),
      box('legR', [2, 26, 2], [2, 13, 0], [0, 16], { anim: 'legR', pivot: [2, 26, 0] })
    ],
    tex: function (c, s) {
      s.fillAll(0x141419, true);
      s.face('head', 'zn', function (cv, x, y, w, h) {
        for (let i = 0; i < 3; i++) {
          cv.set(x + 1 + i, y + 3, 0xd8b0ff); cv.set(x + 1 + i, y + 4, 0xe8d0ff);
          cv.set(x + 4 + i, y + 3, 0xd8b0ff); cv.set(x + 4 + i, y + 4, 0xe8d0ff);
        }
      });
    }
  });

  /* ---- villager ---- */
  mob('villager', {
    width: 0.6, height: 1.95, health: 20, speed: 0.9, xp: 1,
    arms: true, drops: [['emerald', 0, 1]],
    model: humanoid(),
    tex: function (c, s) {
      s.fillAll(0x8a6a4a, true);
      s.fillPart('body', 0x7a5a3a, true);
      s.fillPart('head', 0xb08968, true);
      s.face('head', 'zn', function (cv, x, y, w, h) {
        // big nose
        cv.rect(x + 3, y + 3, 2, 3, 0x9a7050);
        cv.set(x + 1, y + 2, 0xffffff); cv.set(x + 2, y + 2, 0x2a4a8a);
        cv.set(x + 6, y + 2, 0xffffff); cv.set(x + 5, y + 2, 0x2a4a8a);
        for (let i = 0; i < w; i++) { cv.set(x + i, y, 0x4a3520); cv.set(x + i, y + 1, 0x4a3520); }
      });
      s.fillPart('armL', 0x7a5a3a); s.fillPart('armR', 0x7a5a3a);
      s.fillPart('legL', 0x4a3a5a); s.fillPart('legR', 0x4a3a5a);
    }
  });

  /* ---- slime ---- */
  mob('slime', {
    width: 0.8, height: 0.8, health: 8, speed: 0.8, damage: 2, hostile: true, xp: 3,
    drops: [['slimeball', 0, 2]],
    model: [
      box('inner', [6, 6, 6], [0, 5, 0], [0, 16]),
      box('body', [10, 10, 10], [0, 5, 0], [0, 0], { alpha: 0.72, layer: 1 })
    ],
    tex: function (c, s) {
      s.fillAll(0x6fbf4a, true);
      s.fillPart('inner', 0x3a7a24);
      s.face('body', 'zn', function (cv, x, y, w, h) {
        cv.rect(x + 2, y + 3, 2, 2, 0x1c3a12); cv.rect(x + 6, y + 3, 2, 2, 0x1c3a12);
        cv.rect(x + 4, y + 6, 2, 1, 0x1c3a12);
      });
    }
  });

  /* ---- player ---- */
  mob('player', {
    width: 0.6, height: 1.8, health: 20, speed: 1.0, xp: 0, arms: true,
    model: humanoid(),
    tex: function (c, s) {
      s.fillAll(0x00a0a0, true);              // teal shirt, the classic look
      s.fillPart('head', 0xc99a72, true);
      s.face('head', 'zn', function (cv, x, y, w, h) {
        for (let i = 0; i < w; i++) { cv.set(x + i, y, 0x2b1d10); cv.set(x + i, y + 1, 0x2b1d10); }
        cv.set(x + 2, y + 3, 0xffffff); cv.set(x + 5, y + 3, 0xffffff);
        cv.set(x + 2, y + 4, 0x3a2a8a); cv.set(x + 5, y + 4, 0x3a2a8a);
        cv.rect(x + 3, y + 6, 2, 1, 0x8a5a44);
      });
      s.face('head', 'yp', function (cv, x, y, w, h) {
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) cv.set(x + i, y + j, 0x2b1d10);
      });
      s.face('head', 'zp', function (cv, x, y, w, h) {
        for (let j = 0; j < h - 2; j++) for (let i = 0; i < w; i++) cv.set(x + i, y + j, 0x2b1d10);
      });
      s.fillPart('armL', 0x00a0a0); s.fillPart('armR', 0x00a0a0);
      s.face('armL', 'yn', function (cv, x, y, w, h) { cv.rect(x, y, w, h, 0xc99a72); });
      s.face('armR', 'yn', function (cv, x, y, w, h) { cv.rect(x, y, w, h, 0xc99a72); });
      s.fillPart('legL', 0x2a3a8a); s.fillPart('legR', 0x2a3a8a);
    }
  });

  /* ============================================================
   * bake all the skins into one atlas
   * ============================================================ */
  MC.mobArt.build = function () {
    const names = Object.keys(MOBS);
    const cols = Math.ceil(Math.sqrt(names.length));
    let size = 1; while (size < cols * TEXW) size *= 2;
    const realCols = Math.floor(size / TEXW);
    const data = new Uint8Array(size * size * 4);
    const uvOrigin = {};

    for (let i = 0; i < names.length; i++) {
      const name = names[i], m = MOBS[name];
      const c = new MC.paint.Canvas(TEXW, MC.hashSeed('mob:' + name));
      const skin = new Skin(c, m.model);
      try { m.tex(c, skin); }
      catch (e) { c.fill(0xff00ff); console.warn('mob skin failed:', name, e); }
      const col = i % realCols, row = (i / realCols) | 0;
      const ox = col * TEXW, oy = row * TEXH;
      for (let y = 0; y < TEXH; y++) for (let x = 0; x < TEXW; x++) {
        const s = (y * TEXW + x) * 4, d = ((oy + y) * size + ox + x) * 4;
        data[d] = c.data[s]; data[d + 1] = c.data[s + 1];
        data[d + 2] = c.data[s + 2]; data[d + 3] = c.data[s + 3];
      }
      uvOrigin[name] = [ox / size, oy / size];
      m.atlasOrigin = uvOrigin[name];
      m.atlasScale = 1 / size;
      // precompute the six uv rects for every part, in atlas space
      m.parts = m.model.map(function (p) {
        const r = uvRects(p);
        const out = { part: p, uv: {} };
        ['xn', 'xp', 'yp', 'yn', 'zn', 'zp'].forEach(function (f) {
          const q = r[f];
          out.uv[f] = [
            (ox + q[0]) / size, (oy + q[1]) / size,
            (ox + q[0] + q[2]) / size, (oy + q[1] + q[3]) / size
          ];
        });
        return out;
      });
    }
    MC.mobArt.pixels = data;
    MC.mobArt.size = size;
    return data;
  };
})();
