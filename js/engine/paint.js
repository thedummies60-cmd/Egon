/* ============================================================
 * paint.js - tiny pixel-art painting toolkit.
 * Every texture in the game is drawn procedurally at runtime by
 * these helpers, so the game ships with zero image assets.
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});

  /* --------- colour helpers (colours are 0xRRGGBB integers) --------- */
  function rgb(r, g, b) { return ((r & 255) << 16) | ((g & 255) << 8) | (b & 255); }
  function R(c) { return (c >> 16) & 255; }
  function G(c) { return (c >> 8) & 255; }
  function B(c) { return c & 255; }

  function shade(c, f) {
    return rgb(
      Math.min(255, Math.max(0, Math.round(R(c) * f))),
      Math.min(255, Math.max(0, Math.round(G(c) * f))),
      Math.min(255, Math.max(0, Math.round(B(c) * f)))
    );
  }
  function mixc(a, b, t) {
    return rgb(R(a) + (R(b) - R(a)) * t, G(a) + (G(b) - G(a)) * t, B(a) + (B(b) - B(a)) * t);
  }
  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const hk = function (t) {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      r = hk(h + 1 / 3); g = hk(h); b = hk(h - 1 / 3);
    }
    return rgb(r * 255, g * 255, b * 255);
  }

  /* ------------------------------------------------------------------
   * Canvas: an RGBA pixel buffer of size N x N with drawing helpers.
   * ------------------------------------------------------------------ */
  function Canvas(size, seed) {
    this.size = size;
    this.data = new Uint8Array(size * size * 4); // rgba, a=0 -> transparent
    this.rng = new MC.RNG(seed === undefined ? 1 : seed);
  }

  Canvas.prototype.idx = function (x, y) { return (y * this.size + x) * 4; };

  Canvas.prototype.set = function (x, y, c, a) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return this;
    const i = this.idx(x | 0, y | 0);
    const d = this.data;
    d[i] = R(c); d[i + 1] = G(c); d[i + 2] = B(c);
    d[i + 3] = a === undefined ? 255 : a;
    return this;
  };

  Canvas.prototype.get = function (x, y) {
    const i = this.idx(x, y), d = this.data;
    return rgb(d[i], d[i + 1], d[i + 2]);
  };
  Canvas.prototype.alpha = function (x, y) { return this.data[this.idx(x, y) + 3]; };

  // blend a colour on top with coverage t (0..1)
  Canvas.prototype.blend = function (x, y, c, t) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return this;
    const i = this.idx(x | 0, y | 0), d = this.data;
    if (d[i + 3] === 0) return this.set(x, y, c);
    d[i] = d[i] + (R(c) - d[i]) * t;
    d[i + 1] = d[i + 1] + (G(c) - d[i + 1]) * t;
    d[i + 2] = d[i + 2] + (B(c) - d[i + 2]) * t;
    return this;
  };

  Canvas.prototype.fill = function (c) {
    for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) this.set(x, y, c);
    return this;
  };

  Canvas.prototype.clear = function () { this.data.fill(0); return this; };

  Canvas.prototype.rect = function (x0, y0, w, h, c, a) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, c, a);
    return this;
  };

  Canvas.prototype.frame = function (x0, y0, w, h, c) {
    for (let x = x0; x < x0 + w; x++) { this.set(x, y0, c); this.set(x, y0 + h - 1, c); }
    for (let y = y0; y < y0 + h; y++) { this.set(x0, y, c); this.set(x0 + w - 1, y, c); }
    return this;
  };

  Canvas.prototype.line = function (x0, y0, x1, y1, c) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  };

  Canvas.prototype.disc = function (cx, cy, r, c) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r * r) this.set(x, y, c);
      }
    }
    return this;
  };

  /* ---- texture-ish effects ---- */

  // per-pixel brightness jitter, the bread and butter of blocky textures
  Canvas.prototype.grain = function (amount, density) {
    density = density === undefined ? 1 : density;
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.data[this.idx(x, y) + 3] === 0) continue;
        if (this.rng.next() > density) continue;
        const f = 1 + (this.rng.next() * 2 - 1) * amount;
        this.set(x, y, shade(this.get(x, y), f), this.alpha(x, y));
      }
    }
    return this;
  };

  // quantised noise clusters (2x2 / 3x3 blobs) - reads more "Minecraft"
  Canvas.prototype.blotch = function (amount, scale) {
    scale = scale || 2;
    const s = this.size;
    for (let y = 0; y < s; y += scale) {
      for (let x = 0; x < s; x += scale) {
        const f = 1 + (this.rng.next() * 2 - 1) * amount;
        for (let j = 0; j < scale; j++) for (let i = 0; i < scale; i++) {
          const px = x + i, py = y + j;
          if (px >= s || py >= s) continue;
          if (this.data[this.idx(px, py) + 3] === 0) continue;
          this.set(px, py, shade(this.get(px, py), f), this.alpha(px, py));
        }
      }
    }
    return this;
  };

  // scatter n single pixels of a colour
  Canvas.prototype.speckle = function (n, c, vary) {
    for (let i = 0; i < n; i++) {
      const x = this.rng.int(this.size), y = this.rng.int(this.size);
      if (this.data[this.idx(x, y) + 3] === 0) continue;
      this.set(x, y, vary ? shade(c, 0.85 + this.rng.next() * 0.3) : c);
    }
    return this;
  };

  // scatter small irregular blobs
  Canvas.prototype.blobs = function (n, minR, maxR, c, vary) {
    for (let i = 0; i < n; i++) {
      const cx = this.rng.int(this.size), cy = this.rng.int(this.size);
      const r = this.rng.range(minR, maxR);
      const col = vary ? shade(c, 0.85 + this.rng.next() * 0.3) : c;
      for (let y = Math.floor(cy - r); y <= cy + r; y++) {
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          const dx = x - cx, dy = y - cy;
          if (dx * dx + dy * dy > r * r) continue;
          this.set(((x % this.size) + this.size) % this.size,
                   ((y % this.size) + this.size) % this.size, col);
        }
      }
    }
    return this;
  };

  // darken the outer ring, brighten the top-left - fakes bevelled depth
  Canvas.prototype.bevel = function (dark, light) {
    const s = this.size;
    dark = dark === undefined ? 0.82 : dark;
    light = light === undefined ? 1.12 : light;
    for (let x = 0; x < s; x++) {
      this.set(x, 0, shade(this.get(x, 0), light), this.alpha(x, 0));
      this.set(x, s - 1, shade(this.get(x, s - 1), dark), this.alpha(x, s - 1));
    }
    for (let y = 0; y < s; y++) {
      this.set(0, y, shade(this.get(0, y), light), this.alpha(0, y));
      this.set(s - 1, y, shade(this.get(s - 1, y), dark), this.alpha(s - 1, y));
    }
    return this;
  };

  // horizontal top-to-bottom gradient between two colours
  Canvas.prototype.vgrad = function (top, bottom) {
    for (let y = 0; y < this.size; y++) {
      const c = mixc(top, bottom, y / (this.size - 1));
      for (let x = 0; x < this.size; x++) this.set(x, y, c);
    }
    return this;
  };

  // draw from an ASCII map: rows of chars, palette maps char -> colour
  // ' ' and '.' mean transparent.
  Canvas.prototype.art = function (rows, palette, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === ' ' || ch === '.') continue;
        const c = palette[ch];
        if (c === undefined) continue;
        this.set(ox + x, oy + y, c);
      }
    }
    return this;
  };

  // wrap-around pixel scroll, used to make variants of the same texture
  Canvas.prototype.offset = function (dx, dy) {
    const s = this.size, out = new Uint8Array(this.data.length);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const sx = ((x - dx) % s + s) % s, sy = ((y - dy) % s + s) % s;
        const a = (y * s + x) * 4, b = (sy * s + sx) * 4;
        out[a] = this.data[b]; out[a + 1] = this.data[b + 1];
        out[a + 2] = this.data[b + 2]; out[a + 3] = this.data[b + 3];
      }
    }
    this.data = out;
    return this;
  };

  Canvas.prototype.tint = function (c, t) {
    for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) {
      if (this.alpha(x, y) === 0) continue;
      this.set(x, y, mixc(this.get(x, y), c, t), this.alpha(x, y));
    }
    return this;
  };

  Canvas.prototype.clone = function () {
    const c = new Canvas(this.size, 1);
    c.data.set(this.data);
    return c;
  };

  // overlay another canvas of the same size, respecting its alpha
  Canvas.prototype.stamp = function (other) {
    for (let i = 0; i < this.data.length; i += 4) {
      if (other.data[i + 3] > 0) {
        this.data[i] = other.data[i];
        this.data[i + 1] = other.data[i + 1];
        this.data[i + 2] = other.data[i + 2];
        this.data[i + 3] = other.data[i + 3];
      }
    }
    return this;
  };

  // outline every opaque pixel that touches transparency (item look)
  Canvas.prototype.outline = function (c) {
    const s = this.size, snapshot = this.data.slice();
    const op = function (x, y) {
      if (x < 0 || y < 0 || x >= s || y >= s) return false;
      return snapshot[(y * s + x) * 4 + 3] > 0;
    };
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      if (op(x, y)) continue;
      if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1)) this.set(x, y, c);
    }
    return this;
  };

  MC.paint = { Canvas, rgb, shade, mix: mixc, hsl, R, G, B };
})();
