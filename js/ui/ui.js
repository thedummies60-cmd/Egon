/* ============================================================
 * ui.js - title screen, HUD and every container screen.
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});
  const $ = function (id) { return document.getElementById(id); };
  const INV = MC.Inventory;

  /* ---------------- little pixel sprites for the HUD ---------------- */
  function spriteURL(rows, palette, scale) {
    scale = scale || 2;
    const h = rows.length, w = rows[0].length;
    const cv = document.createElement('canvas');
    cv.width = w * scale; cv.height = h * scale;
    const ctx = cv.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = palette[rows[y][x]];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    return cv.toDataURL();
  }

  const HEART_SHAPE = [
    ' XX XX ',
    'XRRXRRX',
    'XRRRRRX',
    'XRRRRRX',
    ' XRRRX ',
    '  XRX  ',
    '   X   '
  ];
  const SPRITES = {};
  function buildSprites() {
    SPRITES.heartFull = spriteURL(HEART_SHAPE, { X: '#3a0000', R: '#e33232' }, 3);
    SPRITES.heartHalf = spriteURL(HEART_SHAPE.map(function (r, y) {
      return r.split('').map(function (ch, x) { return x > 3 && ch === 'R' ? 'D' : ch; }).join('');
    }), { X: '#3a0000', R: '#e33232', D: '#4a4a4a' }, 3);
    SPRITES.heartEmpty = spriteURL(HEART_SHAPE, { X: '#2a2a2a', R: '#4a4a4a' }, 3);

    const FOOD = [
      '   XX  ',
      '  XFFX ',
      ' XFFFX ',
      'XFFFXX ',
      'XFFXX  ',
      'XXX    ',
      'X      '
    ];
    SPRITES.foodFull = spriteURL(FOOD, { X: '#4a2a10', F: '#c98a3c' }, 3);
    SPRITES.foodEmpty = spriteURL(FOOD, { X: '#2a2a2a', F: '#4a4a4a' }, 3);
    SPRITES.foodHalf = spriteURL(FOOD.map(function (r, x) {
      return r;
    }), { X: '#4a2a10', F: '#7a5a2c' }, 3);

    const SHIELD = [
      '  XXX  ',
      ' XSSSX ',
      'XSSSSSX',
      'XSSSSSX',
      ' XSSSX ',
      '  XSX  ',
      '   X   '
    ];
    SPRITES.armorFull = spriteURL(SHIELD, { X: '#2a2a2a', S: '#d8d8d8' }, 3);
    SPRITES.armorEmpty = spriteURL(SHIELD, { X: '#2a2a2a', S: '#5a5a5a' }, 3);

    const BUBBLE = [
      ' XXX ',
      'XWWWX',
      'XWWWX',
      ' XXX '
    ];
    SPRITES.bubble = spriteURL(BUBBLE, { X: '#0a2a4a', W: '#9fd8ff' }, 4);
  }

  const SPLASHES = [
    'Awesome game design right there!', 'Infinite worlds!', 'Now with biomes!',
    '100% procedural!', 'No downloads required!', 'Made with WebGL!',
    'Watch out for creepers!', 'Diamonds are down there somewhere!',
    'Also try creative mode!', 'Zero dependencies!', 'Every texture drawn at runtime!',
    'Press F3 for numbers!', 'Punch a tree to begin!', 'Mind the lava!',
    'Voxels all the way down!', 'It even has sheep!', 'Blocky!',
    'Now rendering at 60fps (hopefully)!', 'Dig straight down? Never!',
    'Sixty-four blocks per stack!', 'The sun also rises!'
  ];

  const TIPS = [
    'Tip: punch a tree to get wood, then craft planks and a crafting table.',
    'Tip: hold Shift near a ledge to avoid falling off.',
    'Tip: torches keep hostile mobs from spawning.',
    'Tip: press E to open your inventory and craft in the 2x2 grid.',
    'Tip: double-tap Space in creative mode to fly.',
    'Tip: a stone pickaxe mines iron; an iron pickaxe mines diamond.',
    'Tip: press F5 to switch to third person.',
    'Tip: sand and gravel fall when you dig underneath them.',
    'Tip: cook raw food in a furnace to restore more hunger.'
  ];

  /* ============================================================
   * UI
   * ============================================================ */
  function UI(game) {
    this.game = game;
    this.hotbarDirty = true;
    this.deathShown = false;
    this.screenEl = $('screen-container');
    this.mouse = { x: 0, y: 0 };
    this.selectedWorld = null;
    this.creativeTab = 'building';
    this.creativeSearch = '';
    this.toastList = [];
    this.lastHotbarName = -1;
    this.nameTimer = 0;
    buildSprites();
    this.buildHotbar();
    this.bind();
  }

  /* ---------------- construction ---------------- */

  UI.prototype.buildHotbar = function () {
    const bar = $('hotbar');
    bar.innerHTML = '';
    this.hotbarSlots = [];
    for (let i = 0; i < 9; i++) {
      const el = document.createElement('div');
      el.className = 'slot';
      el.innerHTML = '<span class="icon"></span><span class="count"></span>' +
        '<span class="durability hidden"><i></i></span>';
      bar.appendChild(el);
      this.hotbarSlots.push(el);
    }
    const hp = $('health'), hu = $('hunger'), ar = $('armor');
    hp.innerHTML = ''; hu.innerHTML = ''; ar.innerHTML = '';
    this.heartEls = []; this.foodEls = []; this.armorEls = [];
    for (let i = 0; i < 10; i++) {
      const a = document.createElement('div'); a.className = 'pip';
      a.style.cssText = 'background-size:contain;background-repeat:no-repeat;';
      hp.appendChild(a); this.heartEls.push(a);
      const b = document.createElement('div'); b.className = 'pip';
      b.style.cssText = 'background-size:contain;background-repeat:no-repeat;';
      hu.appendChild(b); this.foodEls.push(b);
      const c = document.createElement('div'); c.className = 'pip';
      c.style.cssText = 'background-size:contain;background-repeat:no-repeat;';
      ar.appendChild(c); this.armorEls.push(c);
    }
    const air = $('airbar');
    air.innerHTML = '';
    this.airEls = [];
    for (let i = 0; i < 10; i++) {
      const e = document.createElement('div');
      e.className = 'pip';
      e.style.cssText = 'background-image:url(' + SPRITES.bubble + ');background-size:contain;background-repeat:no-repeat;';
      air.appendChild(e);
      this.airEls.push(e);
    }
  };

  UI.prototype.buildTitle = function () {
    const logo = MC.buildLogo('MINECRAFT', 12);
    const el = $('title-logo');
    el.width = logo.width; el.height = logo.height;
    el.getContext('2d').drawImage(logo, 0, 0);
    const sub = MC.buildPixelText('WEB EDITION', 5, '#dcdcdc');
    const se = $('title-sublogo');
    se.width = sub.width; se.height = sub.height;
    se.getContext('2d').drawImage(sub, 0, 0);
    $('splash').textContent = SPLASHES[(Math.random() * SPLASHES.length) | 0];
    $('version-text').textContent =
      'Egon 1.0 (WebGL voxel engine)\n' +
      MC.blocks.count() + ' blocks, ' + Object.keys(MC.blockTextures).length + ' textures, ' +
      MC.biomes.list.length + ' biomes\nFan-made Minecraft-style sandbox';
  };

  /* ---------------- screen switching ---------------- */

  const SCREENS = ['screen-title', 'screen-worlds', 'screen-create', 'screen-options',
    'screen-help', 'screen-gallery', 'screen-pause', 'screen-death', 'screen-loading'];

  UI.prototype.show = function (id) {
    for (let i = 0; i < SCREENS.length; i++) {
      const el = $(SCREENS[i]);
      if (el) el.classList.toggle('hidden', SCREENS[i] !== id);
    }
    this.current = id;
    if (id === 'screen-title') this.buildTitle();
  };

  UI.prototype.hideAll = function () {
    for (let i = 0; i < SCREENS.length; i++) {
      const el = $(SCREENS[i]);
      if (el) el.classList.add('hidden');
    }
    this.current = null;
  };

  UI.prototype.setHud = function (on) { $('hud').classList.toggle('hidden', !on); };

  /* ---------------- events ---------------- */

  UI.prototype.bind = function () {
    const self = this, g = this.game;

    $('btn-singleplayer').onclick = function () { self.click(); self.showWorlds(); };
    $('btn-multiplayer').onclick = function () {
      self.click();
      self.toast('Multiplayer is not available in this build - play offline!');
    };
    $('btn-options').onclick = function () { self.click(); self.showOptions('screen-title'); };
    $('btn-howto').onclick = function () { self.click(); self.showHelp(); };
    $('btn-gallery').onclick = function () { self.click(); self.showGallery(); };
    $('btn-quit').onclick = function () {
      self.click();
      self.toast('Close the browser tab to quit.');
    };

    $('btn-worlds-back').onclick = function () { self.click(); self.show('screen-title'); };
    $('btn-newworld').onclick = function () { self.click(); self.showCreate(); };
    $('btn-play').onclick = function () { self.click(); self.playSelected(); };
    $('btn-delete').onclick = function () { self.click(); self.deleteSelected(); };
    $('btn-create-back').onclick = function () { self.click(); self.showWorlds(); };
    $('btn-create').onclick = function () { self.click(); self.createWorld(); };
    $('btn-options-done').onclick = function () { self.click(); self.show(self.optionsReturn || 'screen-title'); };
    $('btn-help-back').onclick = function () { self.click(); self.show('screen-title'); };
    $('btn-gallery-back').onclick = function () { self.click(); self.show('screen-title'); };

    $('btn-resume').onclick = function () { self.click(); self.resume(); };
    $('btn-pause-options').onclick = function () { self.click(); self.showOptions('screen-pause'); };
    $('btn-pause-mode').onclick = function () {
      self.click();
      const p = g.player;
      p.setMode(p.mode === 'creative' ? 'survival' : 'creative');
      if (p.mode === 'creative') g.giveStarterKit();
      self.toast('Game mode: ' + p.mode);
      self.markHotbar();
    };
    $('btn-save-quit').onclick = function () { self.click(); self.quitToTitle(); };
    $('btn-respawn').onclick = function () { self.click(); self.respawn(); };
    $('btn-death-title').onclick = function () { self.click(); self.quitToTitle(); };

    document.addEventListener('mousemove', function (e) {
      self.mouse.x = e.clientX; self.mouse.y = e.clientY;
      if (g.screen) self.positionCursorStack();
    });

    // clicking outside a container closes it
    this.screenEl.addEventListener('mousedown', function (e) {
      if (e.target === self.screenEl) g.closeScreen();
    });
  };

  UI.prototype.click = function () { this.game.audio.resume(); this.game.audio.play('click', 0.3); };

  UI.prototype.resume = function () {
    this.game.paused = false;
    this.hideAll();
    this.setHud(true);
    this.game.input.requestLock();
  };

  UI.prototype.pause = function () {
    if (this.game.player && this.game.player.dead) return;
    this.game.paused = true;
    this.game.input.exitLock();
    this.game.save();
    this.show('screen-pause');
    $('btn-pause-mode').textContent = this.game.player.mode === 'creative' ? 'Mode: Creative' : 'Mode: Survival';
  };

  UI.prototype.quitToTitle = function () {
    const g = this.game;
    g.save();
    g.running = false;
    g.paused = false;
    g.screen = null;
    this.hideScreen();
    this.deathShown = false;
    this.setHud(false);
    g.input.exitLock();
    if (g.startPanorama) g.startPanorama();
    this.show('screen-title');
  };

  UI.prototype.respawn = function () {
    this.deathShown = false;
    this.game.player.respawn(this.game.world);
    this.hideAll();
    this.setHud(true);
    this.game.input.requestLock();
  };

  UI.prototype.showDeath = function () {
    this.deathShown = true;
    const src = this.game.player.lastDamageSource;
    const causes = {
      fall: 'You fell from a high place', drown: 'You drowned', lava: 'You tried to swim in lava',
      starve: 'You starved to death', mob: 'You were slain by a monster',
      explosion: 'You were blown up', arrow: 'You were shot', void: 'You fell out of the world'
    };
    $('death-cause').textContent = causes[src] || 'Game over';
    this.game.input.exitLock();
    this.game.audio.play('death', 0.4);
    this.show('screen-death');
  };

  /* ---------------- world list ---------------- */

  UI.prototype.worlds = function () {
    try { return JSON.parse(localStorage.getItem('egon.worlds') || '[]'); }
    catch (e) { return []; }
  };

  UI.prototype.showWorlds = function () {
    const list = this.worlds();
    const el = $('world-list');
    el.innerHTML = '';
    const self = this;
    if (!list.length) {
      el.innerHTML = '<div class="world-item"><span class="wname">No worlds yet - create one!</span></div>';
    }
    list.sort(function (a, b) { return (b.saved || 0) - (a.saved || 0); });
    list.forEach(function (w) {
      const d = document.createElement('div');
      d.className = 'world-item';
      const when = w.saved ? new Date(w.saved).toLocaleString() : 'never saved';
      d.innerHTML = '<div class="grow"><div class="wname">' + escapeHtml(w.name) + '</div>' +
        '<div class="wmeta">' + w.mode + ' &middot; seed ' + escapeHtml(String(w.seed)) + ' &middot; ' + when + '</div></div>';
      d.onclick = function () {
        el.querySelectorAll('.world-item').forEach(function (x) { x.classList.remove('selected'); });
        d.classList.add('selected');
        self.selectedWorld = w.name;
      };
      d.ondblclick = function () { self.selectedWorld = w.name; self.playSelected(); };
      el.appendChild(d);
    });
    this.selectedWorld = list.length ? list[0].name : null;
    if (list.length) el.firstChild.classList.add('selected');
    $('btn-play').disabled = !list.length;
    $('btn-delete').disabled = !list.length;
    this.show('screen-worlds');
  };

  UI.prototype.playSelected = function () {
    if (!this.selectedWorld) return;
    let data = null;
    try { data = JSON.parse(localStorage.getItem('egon.world.' + this.selectedWorld)); }
    catch (e) { data = null; }
    if (!data) { this.toast('Could not load that world.'); return; }
    this.launch({
      name: data.name, seed: data.seed, mode: data.mode, time: data.time,
      player: data.player, inventory: data.inventory, edits: data.edits
    });
  };

  UI.prototype.deleteSelected = function () {
    if (!this.selectedWorld) return;
    localStorage.removeItem('egon.world.' + this.selectedWorld);
    const list = this.worlds().filter((w) => w.name !== this.selectedWorld);
    localStorage.setItem('egon.worlds', JSON.stringify(list));
    this.showWorlds();
  };

  UI.prototype.showCreate = function () {
    const n = this.worlds().length;
    $('in-name').value = n ? 'New World ' + (n + 1) : 'New World';
    $('in-seed').value = '';
    this.show('screen-create');
  };

  UI.prototype.createWorld = function () {
    let name = ($('in-name').value || 'New World').trim().slice(0, 32);
    const existing = this.worlds().map(function (w) { return w.name; });
    let base = name, i = 2;
    while (existing.indexOf(name) >= 0) name = base + ' (' + (i++) + ')';
    this.launch({ name: name, seed: $('in-seed').value.trim(), mode: $('in-mode').value });
  };

  UI.prototype.launch = function (opts) {
    const g = this.game;
    this.hideAll();
    this.deathShown = false;
    $('loading-tip').textContent = TIPS[(Math.random() * TIPS.length) | 0];
    $('loading-text').textContent = 'Building terrain...';
    $('loadbar').firstElementChild.style.width = '2%';
    this.show('screen-loading');
    const self = this;
    // let the loading screen paint before the first heavy frame
    setTimeout(function () {
      g.startWorld(opts);
      self.setHud(true);
      self.markHotbar();
    }, 60);
  };

  UI.prototype.hideLoading = function () {
    if (this.current === 'screen-loading') {
      this.hideAll();
      this.game.input.requestLock();
    }
  };

  /* ---------------- options ---------------- */

  UI.prototype.showOptions = function (ret) {
    this.optionsReturn = ret || 'screen-title';
    const s = this.game.settings;
    const body = $('options-body');
    const self = this;
    body.innerHTML = '';

    function slider(label, key, min, max, step, fmt) {
      const row = document.createElement('div');
      row.className = 'opt-row';
      const l = document.createElement('span');
      l.className = 'label';
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = s[key];
      inp.className = 'val';
      function refresh() { l.textContent = label + ': ' + (fmt ? fmt(s[key]) : s[key]); }
      inp.oninput = function () {
        s[key] = parseFloat(inp.value);
        refresh();
        if (key === 'volume') self.game.audio.setVolume(s.volume);
      };
      refresh();
      row.appendChild(l); row.appendChild(inp);
      body.appendChild(row);
    }
    function toggle(label, key) {
      const row = document.createElement('div');
      row.className = 'opt-row';
      const b = document.createElement('button');
      b.className = 'btn small val';
      function refresh() { b.textContent = label + ': ' + (s[key] ? 'ON' : 'OFF'); }
      b.onclick = function () { s[key] = !s[key]; refresh(); self.click(); };
      refresh();
      row.appendChild(b);
      body.appendChild(row);
    }

    slider('Render Distance', 'renderDistance', 3, 16, 1, function (v) { return v + ' chunks'; });
    slider('Field of View', 'fov', 50, 110, 1, function (v) { return v + '°'; });
    slider('Mouse Sensitivity', 'sensitivity', 0.2, 3, 0.05, function (v) { return Math.round(v * 100) + '%'; });
    slider('Sound Volume', 'volume', 0, 1, 0.05, function (v) { return Math.round(v * 100) + '%'; });
    toggle('View Bobbing', 'viewBob');
    toggle('Invert Mouse', 'invertY');
    toggle('Show FPS', 'showFps');

    const note = document.createElement('div');
    note.className = 'label';
    note.style.marginTop = '10px';
    note.textContent = 'Lower the render distance if the game feels slow.';
    body.appendChild(note);
    this.show('screen-options');
  };

  UI.prototype.showHelp = function () {
    const rows = [
      ['W A S D', 'Move'],
      ['Mouse', 'Look around'],
      ['Left click', 'Mine block / attack'],
      ['Right click', 'Place block / use item / open container'],
      ['Middle click', 'Pick block (creative)'],
      ['Space', 'Jump - double tap to fly in creative'],
      ['Shift', 'Sneak (and not walk off ledges)'],
      ['Ctrl', 'Sprint'],
      ['1 - 9 / Wheel', 'Select hotbar slot'],
      ['E', 'Inventory and 2x2 crafting'],
      ['Q', 'Drop item (Shift+Q drops the stack)'],
      ['F3', 'Debug overlay'],
      ['F5', 'Change camera perspective'],
      ['Esc', 'Pause menu'],
      ['', ''],
      ['Getting started', 'Punch a tree, craft planks, then a crafting table.'],
      ['Crafting table', 'Place it, right click it for the 3x3 grid.'],
      ['Furnace', 'Fuel at the bottom, ore or food at the top.'],
      ['Night time', 'Monsters spawn in the dark - build a shelter or place torches.']
    ];
    const body = $('help-body');
    body.innerHTML = '';
    rows.forEach(function (r) {
      const a = document.createElement('div');
      a.innerHTML = r[0] ? '<kbd>' + escapeHtml(r[0]) + '</kbd>' : '&nbsp;';
      const b = document.createElement('div');
      b.textContent = r[1];
      body.appendChild(a); body.appendChild(b);
    });
    this.show('screen-help');
  };

  UI.prototype.showGallery = function () {
    const body = $('gallery-body');
    body.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;';
    MC.blocks.list.forEach(function (b) {
      if (b.name === 'air') return;
      const d = document.createElement('div');
      d.className = 'slot';
      d.title = b.display;
      d.innerHTML = '<span class="icon"></span>';
      d.firstChild.style.cssText = MC.atlas.iconStyle(b.name, 38) + 'position:absolute;inset:3px;';
      wrap.appendChild(d);
    });
    body.appendChild(wrap);
    const c = document.createElement('div');
    c.className = 'label';
    c.style.marginTop = '10px';
    c.textContent = MC.blocks.count() + ' blocks and ' + MC.items.list.length +
      ' items, every texture generated in code at load time.';
    body.appendChild(c);
    this.show('screen-gallery');
  };

  /* ============================================================
   * HUD
   * ============================================================ */

  UI.prototype.markHotbar = function () { this.hotbarDirty = true; };

  UI.prototype.slotStyle = function (name, px) {
    return MC.atlas.iconStyle(name, px) + 'position:absolute;inset:3px;';
  };

  UI.prototype.renderSlot = function (el, stack, size) {
    const icon = el.querySelector('.icon');
    const count = el.querySelector('.count');
    const dur = el.querySelector('.durability');
    if (!stack) {
      icon.style.cssText = 'position:absolute;inset:3px;';
      count.textContent = '';
      if (dur) dur.classList.add('hidden');
      return;
    }
    icon.style.cssText = this.slotStyle(stack.name, size || 38);
    count.textContent = stack.count > 1 ? stack.count : '';
    if (dur) {
      const t = MC.thing(stack.name);
      if (t && t.durability && stack.dur < t.durability) {
        dur.classList.remove('hidden');
        const f = Math.max(0, stack.dur / t.durability);
        dur.firstElementChild.style.width = (f * 100) + '%';
        dur.firstElementChild.style.background =
          f > 0.5 ? '#3ee03e' : (f > 0.25 ? '#e0e03e' : '#e03e3e');
      } else dur.classList.add('hidden');
    }
  };

  UI.prototype.update = function (dt) {
    const g = this.game, p = g.player;
    if (!g.running || !p) return;

    /* hotbar */
    if (this.hotbarDirty || this.lastSel !== p.selected) {
      for (let i = 0; i < 9; i++) {
        const el = this.hotbarSlots[i];
        el.classList.toggle('selected', i === p.selected);
        this.renderSlot(el, g.inventory.get(i), 40);
      }
      if (this.lastSel !== p.selected) {
        const s = g.inventory.get(p.selected);
        const nm = $('hotbar-name');
        if (s) {
          const t = MC.thing(s.name);
          nm.textContent = t ? t.display : s.name;
          nm.style.opacity = '1';
          this.nameTimer = 2;
        } else { nm.style.opacity = '0'; this.nameTimer = 0; }
      }
      this.lastSel = p.selected;
      this.hotbarDirty = false;
    }
    if (this.nameTimer > 0) {
      this.nameTimer -= dt;
      if (this.nameTimer <= 0) $('hotbar-name').style.opacity = '0';
    }

    /* stats - hidden in creative, like the real thing */
    const survival = p.mode === 'survival';
    $('stats').style.visibility = survival ? 'visible' : 'hidden';
    if (!survival) $('airbar').style.visibility = 'hidden';
    if (survival) {
      const hp = p.health;
      for (let i = 0; i < 10; i++) {
        const v = hp - i * 2;
        const img = v >= 2 ? SPRITES.heartFull : (v >= 1 ? SPRITES.heartHalf : SPRITES.heartEmpty);
        if (this.heartEls[i]._img !== img) {
          this.heartEls[i].style.backgroundImage = 'url(' + img + ')';
          this.heartEls[i]._img = img;
        }
      }
      const hu = p.hunger;
      for (let i = 0; i < 10; i++) {
        const v = hu - (9 - i) * 2;
        const img = v >= 2 ? SPRITES.foodFull : (v >= 1 ? SPRITES.foodHalf : SPRITES.foodEmpty);
        if (this.foodEls[i]._img !== img) {
          this.foodEls[i].style.backgroundImage = 'url(' + img + ')';
          this.foodEls[i]._img = img;
        }
      }
      const ap = g.inventory.armorPoints();
      $('armor').style.display = ap > 0 ? 'flex' : 'none';
      for (let i = 0; i < 10; i++) {
        const img = ap - i * 2 >= 1 ? SPRITES.armorFull : SPRITES.armorEmpty;
        if (this.armorEls[i]._img !== img) {
          this.armorEls[i].style.backgroundImage = 'url(' + img + ')';
          this.armorEls[i]._img = img;
        }
      }
      const bubbles = Math.ceil(p.air / p.maxAir * 10);
      const showAir = p.air < p.maxAir;
      $('airbar').style.visibility = showAir ? 'visible' : 'hidden';
      for (let i = 0; i < 10; i++) this.airEls[i].style.visibility = i < bubbles ? 'visible' : 'hidden';
    }

    /* xp */
    const xpFrac = p.xpToNext() ? p.xp / p.xpToNext() : 0;
    $('xpbar').firstElementChild.style.width = (xpFrac * 100) + '%';
    $('xplevel').textContent = p.level > 0 ? p.level : '';
    $('xpwrap').style.visibility = survival ? 'visible' : 'hidden';

    /* overlays */
    $('water-overlay').style.display = p.headUnderwater ? 'block' : 'none';
    $('lava-overlay').style.display = p.headInLava ? 'block' : 'none';
    const v = $('vignette');
    if (p.hurtTime > 0) { v.classList.add('hurt'); v.style.opacity = Math.min(0.9, p.hurtTime * 2); }
    else v.style.opacity = '0';

    /* debug */
    const dbg = $('debug');
    if (g.debug) {
      dbg.classList.remove('hidden');
      dbg.textContent = this.debugText();
    } else if (g.settings.showFps) {
      dbg.classList.remove('hidden');
      dbg.textContent = Math.round(g.fps) + ' fps';
    } else dbg.classList.add('hidden');

    if (g.screen) this.refreshScreen();
  };

  UI.prototype.debugText = function () {
    const g = this.game, p = g.player, w = g.world;
    const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
    const biome = w.biomeAt(bx, bz);
    const dirs = ['south', 'west', 'north', 'east'];
    const di = Math.round(p.yaw / (Math.PI / 2)) & 3;
    const t = w.time * 24;
    const hh = Math.floor(t), mm = Math.floor((t - hh) * 60);
    const target = g.target ? MC.blocks.get(g.target.id).name : '-';
    return 'Egon 1.0  |  ' + Math.round(g.fps) + ' fps\n' +
      'XYZ ' + p.x.toFixed(2) + ' / ' + p.y.toFixed(2) + ' / ' + p.z.toFixed(2) + '\n' +
      'Block ' + bx + ' ' + by + ' ' + bz + '   Chunk ' + (bx >> 4) + ' ' + (bz >> 4) + '\n' +
      'Facing ' + dirs[di] + ' (' + (p.yaw * 180 / Math.PI).toFixed(0) + '° / ' +
      (-p.pitch * 180 / Math.PI).toFixed(0) + '°)\n' +
      'Biome ' + biome.display + '\n' +
      'Light sky ' + w.getSkyLight(bx, by + 1, bz) + ' block ' + w.getBlockLight(bx, by + 1, bz) + '\n' +
      'Time ' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') +
      (w.isNight() ? ' (night)' : ' (day)') + '\n' +
      'Chunks ' + g.renderer.stats.chunks + '/' + w.chunks.size +
      '  quads ' + g.renderer.stats.quads + '  draws ' + g.renderer.stats.draws + '\n' +
      'Entities ' + g.entities.length + ' (' + g.renderer.stats.entities + ' drawn)  particles ' + g.particles.n + '\n' +
      'Looking at: ' + target + '\n' +
      'Mode ' + p.mode + (p.flying ? ' (flying)' : '') + '  seed ' + g.seedText;
  };

  UI.prototype.toast = function (msg) {
    const el = document.createElement('div');
    el.className = 'toast mc-text';
    el.textContent = msg;
    $('toasts').appendChild(el);
    setTimeout(function () { el.style.transition = 'opacity .5s'; el.style.opacity = '0'; }, 2600);
    setTimeout(function () { el.remove(); }, 3200);
  };

  /* ============================================================
   * container screens
   * ============================================================ */

  UI.prototype.showScreen = function (s) {
    this.buildScreen(s);
    this.screenEl.classList.remove('hidden');
    this.positionCursorStack();
  };

  UI.prototype.hideScreen = function () {
    this.screenEl.classList.add('hidden');
    this.screenEl.innerHTML = '';
    $('cursor-stack').classList.add('hidden');
    $('tooltip').classList.add('hidden');
    this.slotMap = null;
  };

  UI.prototype.makeSlot = function (index, opts) {
    opts = opts || {};
    const self = this, g = this.game;
    const el = document.createElement('div');
    el.className = 'slot';
    el.innerHTML = '<span class="icon"></span><span class="count"></span>' +
      '<span class="durability hidden"><i></i></span>';
    el.dataset.slot = index;
    el.onmousedown = function (e) {
      e.preventDefault();
      e.stopPropagation();
      self.handleSlotClick(index, e, opts);
    };
    el.onmouseenter = function () { self.hoverSlot = { index: index, opts: opts, el: el }; };
    el.onmouseleave = function () { if (self.hoverSlot && self.hoverSlot.index === index) self.hoverSlot = null; };
    return el;
  };

  UI.prototype.handleSlotClick = function (index, e, opts) {
    const g = this.game, inv = g.inventory;
    const shift = e.shiftKey;

    /* creative palette: clicking an entry hands you a full stack */
    if (opts.creative) {
      const name = opts.name;
      if (e.button === 0) {
        inv.set(INV.CURSOR, MC.stack(name, MC.thing(name).maxStack));
      } else if (e.button === 2) {
        inv.set(INV.CURSOR, MC.stack(name, 1));
      }
      this.refreshScreen();
      return;
    }
    /* container (chest / furnace) slots live outside the inventory array */
    if (opts.external) {
      const arr = opts.array, i = opts.arrayIndex;
      const cur = inv.get(INV.CURSOR);
      if (shift) {
        if (arr[i]) {
          const left = inv.add(arr[i].name, arr[i].count);
          if (left <= 0) arr[i] = null; else arr[i].count = left;
        }
      } else if (e.button === 2) {
        if (!cur && arr[i]) {
          const half = Math.ceil(arr[i].count / 2);
          inv.set(INV.CURSOR, MC.stack(arr[i].name, half, arr[i].dur));
          arr[i].count -= half;
          if (arr[i].count <= 0) arr[i] = null;
        } else if (cur) {
          if (!arr[i]) { arr[i] = MC.stack(cur.name, 1, cur.dur); cur.count--; }
          else if (arr[i].name === cur.name && arr[i].count < inv.maxStack(cur.name)) { arr[i].count++; cur.count--; }
          if (cur.count <= 0) inv.set(INV.CURSOR, null);
        }
      } else {
        if (opts.takeOnly && cur && arr[i]) {
          if (cur.name === arr[i].name && cur.count + arr[i].count <= inv.maxStack(cur.name)) {
            cur.count += arr[i].count; arr[i] = null;
          }
        } else if (opts.takeOnly) {
          if (arr[i]) { inv.set(INV.CURSOR, arr[i]); arr[i] = null; }
        } else if (!cur) {
          inv.set(INV.CURSOR, arr[i]); arr[i] = null;
        } else if (!arr[i]) {
          arr[i] = cur; inv.set(INV.CURSOR, null);
        } else if (arr[i].name === cur.name) {
          const max = inv.maxStack(cur.name);
          const n = Math.min(max - arr[i].count, cur.count);
          arr[i].count += n; cur.count -= n;
          if (cur.count <= 0) inv.set(INV.CURSOR, null);
        } else {
          const t = arr[i]; arr[i] = cur; inv.set(INV.CURSOR, t);
        }
      }
      this.refreshScreen();
      return;
    }

    /* crafting output */
    if (index === INV.RESULT) {
      if (!inv.get(INV.RESULT)) return;
      if (shift) {
        const n = inv.maxCrafts();
        for (let k = 0; k < n; k++) {
          const r = inv.get(INV.RESULT);
          if (!r) break;
          if (inv.add(r.name, r.count) > 0) break;
          inv.consumeCraft(1);
        }
      } else if (inv.clickSlot(INV.RESULT, true)) {
        inv.consumeCraft(1);
      }
      g.audio.play('craft', 0.3);
      this.refreshScreen();
      return;
    }

    if (shift) inv.quickMove(index);
    else if (e.button === 2) inv.rightClickSlot(index);
    else inv.clickSlot(index);
    inv.updateCraftResult();
    this.refreshScreen();
  };

  UI.prototype.grid = function (cols, count, startIndex, opts) {
    const wrap = document.createElement('div');
    wrap.className = 'grid cols' + cols;
    wrap.style.gridTemplateColumns = 'repeat(' + cols + ', 48px)';
    for (let i = 0; i < count; i++) {
      wrap.appendChild(this.makeSlot(startIndex + i, opts));
    }
    return wrap;
  };

  UI.prototype.playerGrid = function () {
    const wrap = document.createElement('div');
    const main = document.createElement('div');
    main.className = 'grid';
    main.style.gridTemplateColumns = 'repeat(9, 48px)';
    for (let i = 0; i < 27; i++) main.appendChild(this.makeSlot(INV.MAIN + i));
    const hot = document.createElement('div');
    hot.className = 'grid';
    hot.style.cssText = 'grid-template-columns:repeat(9,48px);margin-top:8px;';
    for (let i = 0; i < 9; i++) hot.appendChild(this.makeSlot(i));
    wrap.appendChild(main); wrap.appendChild(hot);
    return wrap;
  };

  UI.prototype.buildScreen = function (s) {
    const g = this.game;
    const host = this.screenEl;
    host.innerHTML = '';
    const gui = document.createElement('div');
    gui.className = 'gui';
    gui.onmousedown = function (e) { e.stopPropagation(); };
    gui.oncontextmenu = function (e) { e.preventDefault(); };

    if (s.type === 'creative') {
      this.buildCreative(gui);
    } else if (s.type === 'inventory' || s.type === 'crafting') {
      const n = s.type === 'crafting' ? 3 : 2;
      g.inventory.craftSize = n;
      g.inventory.updateCraftResult();
      const title = document.createElement('div');
      title.className = 'gtitle';
      title.textContent = s.type === 'crafting' ? 'Crafting' : 'Inventory';
      gui.appendChild(title);

      const top = document.createElement('div');
      top.className = 'row';
      if (s.type === 'inventory') {
        const armor = document.createElement('div');
        armor.className = 'grid';
        armor.style.gridTemplateColumns = '48px';
        for (let i = 0; i < 4; i++) armor.appendChild(this.makeSlot(INV.ARMOR + i));
        top.appendChild(armor);
        const spacer = document.createElement('div');
        spacer.style.width = '30px';
        top.appendChild(spacer);
      }
      const cg = document.createElement('div');
      cg.className = 'grid';
      cg.style.gridTemplateColumns = 'repeat(' + n + ', 48px)';
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) cg.appendChild(this.makeSlot(INV.CRAFT + y * 3 + x));
      top.appendChild(cg);
      const arrow = document.createElement('div');
      arrow.className = 'arrow'; arrow.textContent = '➡';
      top.appendChild(arrow);
      const res = this.makeSlot(INV.RESULT);
      top.appendChild(res);
      gui.appendChild(top);
      gui.appendChild(document.createElement('div')).className = 'spacer';
      gui.appendChild(this.playerGrid());

    } else if (s.type === 'furnace') {
      const title = document.createElement('div');
      title.className = 'gtitle'; title.textContent = 'Furnace';
      gui.appendChild(title);
      const t = s.tile;
      const row = document.createElement('div');
      row.className = 'row';
      const col = document.createElement('div');
      col.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;';
      col.appendChild(this.makeSlot(-1, { external: true, array: t, arrayIndex: 'input', obj: t, field: 'input' }));
      const flame = document.createElement('div');
      flame.className = 'flame'; flame.innerHTML = '<i></i>';
      flame.id = 'furnace-flame';
      col.appendChild(flame);
      col.appendChild(this.makeSlot(-2, { external: true, array: t, arrayIndex: 'fuel', obj: t, field: 'fuel' }));
      row.appendChild(col);
      const pa = document.createElement('div');
      pa.className = 'progress-arrow'; pa.innerHTML = '<i></i>'; pa.id = 'furnace-progress';
      row.appendChild(pa);
      row.appendChild(this.makeSlot(-3, { external: true, array: t, arrayIndex: 'output', takeOnly: true }));
      gui.appendChild(row);
      gui.appendChild(document.createElement('div')).className = 'spacer';
      gui.appendChild(this.playerGrid());

    } else if (s.type === 'chest') {
      const title = document.createElement('div');
      title.className = 'gtitle'; title.textContent = 'Chest';
      gui.appendChild(title);
      const c = document.createElement('div');
      c.className = 'grid';
      c.style.gridTemplateColumns = 'repeat(9, 48px)';
      for (let i = 0; i < 27; i++) {
        c.appendChild(this.makeSlot(-100 - i, { external: true, array: s.tile.items, arrayIndex: i }));
      }
      gui.appendChild(c);
      gui.appendChild(document.createElement('div')).className = 'spacer';
      gui.appendChild(this.playerGrid());
    }

    host.appendChild(gui);
    this.currentGui = gui;
    this.refreshScreen();
  };

  UI.prototype.buildCreative = function (gui) {
    const self = this, g = this.game;
    const title = document.createElement('div');
    title.className = 'gtitle';
    title.textContent = 'Creative Inventory';
    gui.appendChild(title);

    const search = document.createElement('input');
    search.type = 'text'; search.id = 'creative-search';
    search.placeholder = 'Search...';
    search.value = this.creativeSearch;
    search.oninput = function () { self.creativeSearch = search.value; renderGrid(); };
    search.onmousedown = function (e) { e.stopPropagation(); };
    gui.appendChild(search);

    const tabs = document.createElement('div');
    tabs.id = 'creative-tabs';
    const GROUPS = ['building', 'nature', 'misc', 'materials', 'tools', 'combat', 'food', 'all'];
    GROUPS.forEach(function (grp) {
      const b = document.createElement('button');
      b.className = 'tab' + (grp === self.creativeTab ? ' active' : '');
      b.textContent = grp.charAt(0).toUpperCase() + grp.slice(1);
      b.onclick = function () {
        self.creativeTab = grp;
        tabs.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
        b.classList.add('active');
        renderGrid();
      };
      tabs.appendChild(b);
    });
    gui.appendChild(tabs);

    const grid = document.createElement('div');
    grid.id = 'creative-grid';
    grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:2px;width:min(660px,86vw);';
    gui.appendChild(grid);

    function renderGrid() {
      grid.innerHTML = '';
      const q = self.creativeSearch.toLowerCase();
      const entries = [];
      MC.blocks.list.forEach(function (b) {
        if (b.name === 'air' || b.hidden) return;
        entries.push({ name: b.name, group: b.group, display: b.display });
      });
      MC.items.list.forEach(function (i) {
        entries.push({ name: i.name, group: i.group, display: i.display });
      });
      entries.forEach(function (e) {
        if (self.creativeTab !== 'all' && e.group !== self.creativeTab) return;
        if (q && e.display.toLowerCase().indexOf(q) < 0 && e.name.indexOf(q) < 0) return;
        const el = self.makeSlot(-1, { creative: true, name: e.name });
        el.querySelector('.icon').style.cssText = self.slotStyle(e.name, 38);
        el.dataset.name = e.name;
        grid.appendChild(el);
      });
      if (!grid.children.length) {
        const d = document.createElement('div');
        d.className = 'label';
        d.textContent = 'Nothing matches that search.';
        grid.appendChild(d);
      }
    }
    renderGrid();

    const sp = document.createElement('div'); sp.className = 'spacer';
    gui.appendChild(sp);
    gui.appendChild(this.playerGrid());
  };

  UI.prototype.refreshScreen = function () {
    const g = this.game, inv = g.inventory, s = g.screen;
    if (!s || !this.currentGui) return;
    const self = this;
    const slots = this.currentGui.querySelectorAll('.slot');
    for (let i = 0; i < slots.length; i++) {
      const el = slots[i];
      if (el.dataset.name) continue;             // creative palette entries are static
      const idx = parseInt(el.dataset.slot, 10);
      let stack = null;
      if (idx === -1 && s.type === 'furnace') stack = s.tile.input;
      else if (idx === -2 && s.type === 'furnace') stack = s.tile.fuel;
      else if (idx === -3 && s.type === 'furnace') stack = s.tile.output;
      else if (idx <= -100) stack = s.tile.items[-100 - idx];
      else if (idx >= 0) stack = inv.get(idx);
      this.renderSlot(el, stack, 38);
    }
    if (s.type === 'furnace') {
      const t = s.tile;
      const fl = $('furnace-flame');
      if (fl) fl.firstElementChild.style.height = (t.burnMax ? Math.max(0, t.burn / t.burnMax) * 100 : 0) + '%';
      const pr = $('furnace-progress');
      if (pr) pr.firstElementChild.style.width = (t.cook / 10 * 100) + '%';
    }
    this.updateCursorStack();
    this.updateTooltip();
  };

  UI.prototype.updateCursorStack = function () {
    const cur = this.game.inventory.get(INV.CURSOR);
    const el = $('cursor-stack');
    if (!cur) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.querySelector('.icon').style.cssText = this.slotStyle(cur.name, 40);
    el.querySelector('.count').textContent = cur.count > 1 ? cur.count : '';
    this.positionCursorStack();
  };

  UI.prototype.positionCursorStack = function () {
    const el = $('cursor-stack');
    el.style.left = this.mouse.x + 'px';
    el.style.top = this.mouse.y + 'px';
  };

  UI.prototype.updateTooltip = function () {
    const tip = $('tooltip');
    const h = this.hoverSlot;
    const inv = this.game.inventory;
    if (!h || inv.get(INV.CURSOR)) { tip.classList.add('hidden'); return; }
    let name = null;
    if (h.opts && h.opts.creative) name = h.opts.name;
    else {
      const idx = h.index;
      const s = this.game.screen;
      let stack = null;
      if (h.opts && h.opts.external && s) {
        if (idx === -1) stack = s.tile.input;
        else if (idx === -2) stack = s.tile.fuel;
        else if (idx === -3) stack = s.tile.output;
        else if (idx <= -100) stack = s.tile.items[-100 - idx];
      } else if (idx >= 0) stack = inv.get(idx);
      name = stack ? stack.name : null;
    }
    if (!name) { tip.classList.add('hidden'); return; }
    const t = MC.thing(name);
    if (!t) { tip.classList.add('hidden'); return; }
    let sub = '';
    if (t.isBlock) {
      const b = t.block;
      sub = 'Block';
      if (b.tool) sub += ' &middot; ' + b.tool;
      if (b.hardness > 0) sub += ' &middot; hardness ' + b.hardness;
      if (b.light) sub += ' &middot; light ' + b.light;
    } else {
      if (t.tool) sub = t.tool.type + ' &middot; ' + t.tool.damage + ' damage';
      else if (t.food) sub = 'Food &middot; ' + t.food.hunger + ' hunger';
      else if (t.armor) sub = 'Armour &middot; ' + t.armor.defense + ' defence';
      else sub = 'Item';
      if (t.durability) sub += ' &middot; ' + t.durability + ' uses';
    }
    tip.innerHTML = escapeHtml(t.display) + '<div class="sub">' + sub + '</div>';
    tip.classList.remove('hidden');
    const r = h.el.getBoundingClientRect();
    tip.style.left = (r.right + 8) + 'px';
    tip.style.top = (r.top - 4) + 'px';
    const tr = tip.getBoundingClientRect();
    if (tr.right > window.innerWidth - 6) tip.style.left = (r.left - tr.width - 8) + 'px';
    if (tr.bottom > window.innerHeight - 6) tip.style.top = (window.innerHeight - tr.height - 8) + 'px';
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  MC.UI = UI;
})();
