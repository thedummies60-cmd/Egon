/* ============================================================
 * logo.js - a chunky 5x7 pixel font, drawn as stone blocks for
 * the title screen logo.
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});

  const F = {
    A: '.###.|#...#|#...#|#####|#...#|#...#|#...#',
    B: '####.|#...#|#...#|####.|#...#|#...#|####.',
    C: '.####|#....|#....|#....|#....|#....|.####',
    D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
    E: '#####|#....|#....|####.|#....|#....|#####',
    F: '#####|#....|#....|####.|#....|#....|#....',
    G: '.####|#....|#....|#..##|#...#|#...#|.####',
    H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
    I: '#####|..#..|..#..|..#..|..#..|..#..|#####',
    J: '####.|...#.|...#.|...#.|...#.|#..#.|.##..',
    K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
    L: '#....|#....|#....|#....|#....|#....|#####',
    M: '#...#|##.##|#.#.#|#...#|#...#|#...#|#...#',
    N: '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#',
    O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
    P: '####.|#...#|#...#|####.|#....|#....|#....',
    Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
    R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
    S: '.####|#....|#....|.###.|....#|....#|####.',
    T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
    U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
    V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
    W: '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#',
    X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
    Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
    Z: '#####|....#|...#.|..#..|.#...|#....|#####',
    '0': '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.',
    '1': '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
    '2': '.###.|#...#|....#|...#.|..#..|.#...|#####',
    '3': '####.|....#|....#|.###.|....#|....#|####.',
    '4': '#..#.|#..#.|#..#.|#####|...#.|...#.|...#.',
    '5': '#####|#....|####.|....#|....#|#...#|.###.',
    '6': '.###.|#....|#....|####.|#...#|#...#|.###.',
    '7': '#####|....#|...#.|..#..|.#...|.#...|.#...',
    '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
    '9': '.###.|#...#|#...#|.####|....#|....#|.###.',
    ' ': '.....|.....|.....|.....|.....|.....|.....',
    '-': '.....|.....|.....|#####|.....|.....|.....',
    '!': '..#..|..#..|..#..|..#..|..#..|.....|..#..',
    '.': '.....|.....|.....|.....|.....|.....|..#..'
  };

  MC.pixelFont = F;

  /* Draw text as chunky bevelled stone blocks. */
  MC.drawBlockText = function (ctx, text, ox, oy, cell, opts) {
    opts = opts || {};
    const spacing = opts.spacing === undefined ? 1 : opts.spacing;
    const depth = opts.depth === undefined ? Math.max(2, Math.round(cell * 0.36)) : opts.depth;
    const top = opts.top || '#c8c8c8';
    const mid = opts.mid || '#9d9d9d';
    const dark = opts.dark || '#6b6b6b';
    const shadow = opts.shadow || 'rgba(0,0,0,0.55)';
    let x = ox;
    for (let i = 0; i < text.length; i++) {
      const g = F[text[i].toUpperCase()];
      if (!g) { x += (5 + spacing) * cell; continue; }
      const rows = g.split('|');
      // drop shadow slab underneath
      for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
          if (rows[r][c] !== '#') continue;
          ctx.fillStyle = shadow;
          ctx.fillRect(x + c * cell + depth, oy + r * cell + depth, cell, cell);
        }
      }
      for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
          if (rows[r][c] !== '#') continue;
          const px = x + c * cell, py = oy + r * cell;
          ctx.fillStyle = mid;
          ctx.fillRect(px, py, cell, cell);
          const b = Math.max(1, Math.round(cell * 0.16));
          ctx.fillStyle = top;
          ctx.fillRect(px, py, cell, b);
          ctx.fillRect(px, py, b, cell);
          ctx.fillStyle = dark;
          ctx.fillRect(px, py + cell - b, cell, b);
          ctx.fillRect(px + cell - b, py, b, cell);
        }
      }
      x += (5 + spacing) * cell;
    }
    return x - ox;
  };

  MC.textWidth = function (text, cell, spacing) {
    spacing = spacing === undefined ? 1 : spacing;
    return text.length * (5 + spacing) * cell - spacing * cell;
  };

  /* Build the title logo as a canvas element. */
  MC.buildLogo = function (text, cell) {
    const w = Math.ceil(MC.textWidth(text, cell) + cell * 1.2);
    const h = Math.ceil(7 * cell + cell * 1.2);
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    MC.drawBlockText(ctx, text, 0, 0, cell, {
      top: '#d5d5d5', mid: '#a2a2a2', dark: '#5f5f5f', shadow: 'rgba(0,0,0,0.5)'
    });
    return cv;
  };

  /* Small flat pixel text, used for sub-labels. */
  MC.buildPixelText = function (text, cell, color) {
    const w = Math.ceil(MC.textWidth(text, cell));
    const h = 7 * cell;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, w); cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    let x = 0;
    for (let i = 0; i < text.length; i++) {
      const g = F[text[i].toUpperCase()];
      if (!g) { x += 6 * cell; continue; }
      const rows = g.split('|');
      for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
          if (rows[r][c] !== '#') continue;
          ctx.fillStyle = color || '#ffffff';
          ctx.fillRect(x + c * cell, r * cell, cell, cell);
        }
      }
      x += 6 * cell;
    }
    return cv;
  };
})();
