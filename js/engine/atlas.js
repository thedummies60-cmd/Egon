/* ============================================================
 * atlas.js - bakes every procedural texture into GPU atlases and
 * a 2D icon sheet the HTML UI uses as a CSS sprite.
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});
  const Canvas = MC.paint.Canvas;

  const TILE = 16;    // texel size of one block face
  const PAD = 8;      // wrap-around padding so mipmaps don't bleed
  const CELL = TILE + PAD * 2;

  function nextPow2(n) { let p = 1; while (p < n) p *= 2; return p; }

  function makeCanvasEl(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  const A = {
    tiles: {},        // name -> Uint8Array rgba (16x16)
    uv: {},           // name -> Float32Array [u0,v0,u1,v1]
    index: {},        // name -> tile index
    size: 0,
    cols: 0,
    tileU: 0,
    ready: false
  };
  MC.atlas = A;

  /* ---------------- build the block atlas pixel data ---------------- */
  A.buildBlockAtlas = function () {
    const names = Object.keys(MC.blockTextures);
    const cols = Math.max(1, Math.ceil(Math.sqrt(names.length)));
    const size = nextPow2(cols * CELL);
    const realCols = Math.floor(size / CELL);
    const data = new Uint8Array(size * size * 4);

    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const c = new Canvas(TILE, MC.hashSeed(name));
      try { MC.blockTextures[name](c); }
      catch (e) { c.fill(0xff00ff); console.warn('texture failed:', name, e); }
      A.tiles[name] = c.data;

      const col = i % realCols, row = (i / realCols) | 0;
      const ox = col * CELL, oy = row * CELL;
      // fill the whole padded cell by wrapping the tile - keeps tiling
      // textures seamless at every mip level
      for (let y = 0; y < CELL; y++) {
        for (let x = 0; x < CELL; x++) {
          const sx = ((x - PAD) % TILE + TILE) % TILE;
          const sy = ((y - PAD) % TILE + TILE) % TILE;
          const s = (sy * TILE + sx) * 4;
          const d = ((oy + y) * size + (ox + x)) * 4;
          data[d] = c.data[s]; data[d + 1] = c.data[s + 1];
          data[d + 2] = c.data[s + 2]; data[d + 3] = c.data[s + 3];
        }
      }
      const u0 = (ox + PAD) / size, v0 = (oy + PAD) / size;
      A.uv[name] = new Float32Array([u0, v0, u0 + TILE / size, v0 + TILE / size]);
      A.index[name] = i;
    }
    A.size = size;
    A.cols = realCols;
    A.tileU = TILE / size;
    A.pixels = data;
    return data;
  };

  /* ---------------- item sprite atlas (flat 16x16, no padding) ---------------- */
  A.buildItemAtlas = function () {
    const names = Object.keys(MC.itemTextures);
    const cols = Math.max(1, Math.ceil(Math.sqrt(names.length)));
    const size = nextPow2(cols * TILE);
    const realCols = Math.floor(size / TILE);
    const data = new Uint8Array(size * size * 4);
    A.itemUV = {};
    A.itemTiles = {};
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const c = new Canvas(TILE, MC.hashSeed('item_' + name));
      try { MC.itemTextures[name](c); }
      catch (e) { c.fill(0xff00ff); console.warn('item texture failed:', name, e); }
      A.itemTiles[name] = c.data;
      const col = i % realCols, row = (i / realCols) | 0;
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
        const s = (y * TILE + x) * 4;
        const d = ((row * TILE + y) * size + col * TILE + x) * 4;
        data[d] = c.data[s]; data[d + 1] = c.data[s + 1];
        data[d + 2] = c.data[s + 2]; data[d + 3] = c.data[s + 3];
      }
      A.itemUV[name] = new Float32Array([
        col * TILE / size, row * TILE / size,
        (col + 1) * TILE / size, (row + 1) * TILE / size
      ]);
    }
    A.itemSize = size;
    A.itemPixels = data;
    return data;
  };

  /* ---------------- 2D icon sheet used by the HTML UI ---------------- */
  // Blocks become little isometric cubes, items are the flat sprite.
  const ICON = 32;

  function tileToCanvas(rgba, bright) {
    const cv = makeCanvasEl(TILE, TILE);
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(TILE, TILE);
    for (let i = 0; i < rgba.length; i += 4) {
      img.data[i] = Math.min(255, rgba[i] * bright);
      img.data[i + 1] = Math.min(255, rgba[i + 1] * bright);
      img.data[i + 2] = Math.min(255, rgba[i + 2] * bright);
      img.data[i + 3] = rgba[i + 3];
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  function faceTex(block, face) {
    const t = block.tex;
    if (typeof t === 'string') return t;
    if (face === 'top') return t.top || t.side || t.all;
    if (face === 'bottom') return t.bottom || t.side || t.all;
    return t.side || t.all || t.top;
  }
  A.faceTex = faceTex;

  A.drawIsoCube = function (ctx, block, ox, oy, scale) {
    scale = scale || 1;
    const topName = faceTex(block, 'top');
    const sideName = faceTex(block, 'side');
    if (!A.tiles[topName] || !A.tiles[sideName]) return;
    const top = tileToCanvas(A.tiles[topName], 1.0);
    const left = tileToCanvas(A.tiles[sideName], 0.62);
    const right = tileToCanvas(A.tiles[sideName], 0.82);
    const S = scale;
    ctx.imageSmoothingEnabled = false;
    // top rhombus
    ctx.save();
    ctx.setTransform(14 * S / 16, 7 * S / 16, -14 * S / 16, 7 * S / 16, ox + 16 * S, oy + 2 * S);
    ctx.drawImage(top, 0, 0);
    ctx.restore();
    // left face
    ctx.save();
    ctx.setTransform(14 * S / 16, 7 * S / 16, 0, 14 * S / 16, ox + 2 * S, oy + 9 * S);
    ctx.drawImage(left, 0, 0);
    ctx.restore();
    // right face
    ctx.save();
    ctx.setTransform(14 * S / 16, -7 * S / 16, 0, 14 * S / 16, ox + 16 * S, oy + 16 * S);
    ctx.drawImage(right, 0, 0);
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  A.buildIconSheet = function () {
    // one entry per placeable block + per item
    const entries = [];
    MC.blocks.list.forEach(function (b) { if (b.name !== 'air') entries.push({ name: b.name, block: b }); });
    MC.items.list.forEach(function (i) { entries.push({ name: i.name, item: i }); });

    const cols = 24;
    const rows = Math.ceil(entries.length / cols);
    const cv = makeCanvasEl(cols * ICON, rows * ICON);
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    A.iconIndex = {};
    A.iconCols = cols;
    A.iconSize = ICON;

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const ox = (i % cols) * ICON, oy = ((i / cols) | 0) * ICON;
      A.iconIndex[e.name] = i;
      if (e.block) {
        if (e.block.render === 'cube' || e.block.render === 'liquid') {
          A.drawIsoCube(ctx, e.block, ox, oy, ICON / 32);
        } else {
          const tn = faceTex(e.block, 'side');
          if (A.tiles[tn]) {
            const t = tileToCanvas(A.tiles[tn], 1);
            ctx.drawImage(t, ox, oy, ICON, ICON);
          }
        }
      } else {
        const tn = e.item.tex;
        if (A.itemTiles[tn]) {
          const t = tileToCanvas(A.itemTiles[tn], 1);
          ctx.drawImage(t, ox, oy, ICON, ICON);
        }
      }
    }
    A.iconCanvas = cv;
    A.iconURL = cv.toDataURL();
    A.iconSheetW = cv.width;
    A.iconSheetH = cv.height;
    return cv;
  };

  // CSS helper: position an element's background to show one icon
  A.iconStyle = function (name, px) {
    const idx = A.iconIndex[name];
    if (idx === undefined) return '';
    const s = px / ICON;
    const col = idx % A.iconCols, row = (idx / A.iconCols) | 0;
    return 'background-image:url(' + A.iconURL + ');' +
      'background-size:' + (A.iconSheetW * s) + 'px ' + (A.iconSheetH * s) + 'px;' +
      'background-position:' + (-col * ICON * s) + 'px ' + (-row * ICON * s) + 'px;' +
      'image-rendering:pixelated;';
  };

  A.buildAll = function () {
    A.buildBlockAtlas();
    A.buildItemAtlas();
    A.buildIconSheet();
    A.ready = true;
  };
})();
