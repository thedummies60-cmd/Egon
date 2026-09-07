/* ============================================================
 * game.js - ties everything together: chunk streaming, player
 * interaction, entity simulation and the render order.
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});
  const B = MC.blocks;
  const M = MC.math, vec3 = M.vec3, mat4 = M.mat4;
  const PH = MC.physics;
  const clamp = M.clamp;
  const CY = MC.CHUNK.SEA * 0 + MC.CHUNK.Y;

  function Game(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.renderer = new MC.Renderer(canvas);
    this.audio = new MC.Audio();
    this.input = new MC.Input(canvas);
    this.settings = {
      renderDistance: 8,
      fov: 70,
      sensitivity: 1.0,
      volume: 0.7,
      smoothLighting: true,
      viewBob: true,
      showFps: false
    };
    this.running = false;
    this.paused = false;
    this.screen = null;        // open container UI, if any
    this.perspective = 0;      // 0 first person, 1 back, 2 front
    this.debug = false;
    this.entities = [];
    this.particles = new MC.Particles(4000);
    this.activeTiles = [];
    this.time = 0;
    this.frame = 0;
    this.fps = 0;
    this._fpsAcc = 0; this._fpsCount = 0;
    this.meshBudget = 3;
    this.genBudget = 2;
    this.chatLog = [];
    this.spawnTimer = 0;
    this.saveTimer = 0;
    this.weather = { rain: 0, target: 0, timer: 60 };
    this.mesher = null;
    this.worldName = null;
  }

  /* ============================================================
   * lifecycle
   * ============================================================ */

  Game.prototype.boot = function () {
    if (!this.renderer.init()) return false;
    this.input.canvasReady = true;
    return true;
  };

  Game.prototype.startWorld = function (opts) {
    const seedStr = (opts.seed === undefined || opts.seed === '') ? String(Date.now() % 1000000) : String(opts.seed);
    const numeric = /^-?\d+$/.test(seedStr) ? (parseInt(seedStr, 10) >>> 0) : MC.hashSeed(seedStr);

    this.worldName = opts.name || 'New World';
    this.seedText = seedStr;
    this.world = new MC.World(numeric, { edits: opts.edits || null, tiles: opts.tiles || null });
    this.world.time = opts.time === undefined ? 0.28 : opts.time;
    this.mesher = new MC.Mesher(this.world);
    this.inventory = new MC.Inventory();
    if (opts.inventory) this.inventory.load(opts.inventory);

    const spawn = opts.player || this.findSpawn(numeric);
    this.player = new MC.Player(this.world, {
      x: spawn.x, y: spawn.y, z: spawn.z,
      yaw: spawn.yaw || 0, pitch: spawn.pitch || 0,
      mode: opts.mode || 'survival'
    });
    if (opts.player) {
      this.player.health = opts.player.health;
      this.player.hunger = opts.player.hunger;
      this.player.xp = opts.player.xp || 0;
      this.player.level = opts.player.level || 0;
      this.player.selected = opts.player.selected || 0;
      if (opts.player.respawn) this.player.respawnPoint = opts.player.respawn;
    } else {
      this.player.respawnPoint = { x: spawn.x, y: spawn.y, z: spawn.z };
      if ((opts.mode || 'survival') === 'creative') this.giveStarterKit();
    }
    this.entities.length = 0;
    this.particles.n = 0;
    this.activeTiles.length = 0;
    this.gameMode = opts.mode || 'survival';
    this.panorama = false;
    this.running = true;
    this.paused = false;
    this.screen = null;
    this.dirtyMeshQueue = [];
    this.pendingSpawn = !opts.player;
    this.ready = false;
    this.loadTicks = 0;
  };

  // walk outward from the origin until we find dry, non-ocean land
  Game.prototype.findSpawn = function (seed) {
    const gen = new MC.WorldGen(seed);
    for (let r = 0; r < 220; r++) {
      for (let a = 0; a < 12; a++) {
        const ang = a / 12 * Math.PI * 2;
        const x = Math.round(Math.cos(ang) * r * 12);
        const z = Math.round(Math.sin(ang) * r * 12);
        const cl = gen.climate(x, z);
        const h = gen.heightAt(x, z, cl);
        if (h > MC.CHUNK.SEA + 2 && h < 110) {
          const bio = gen.biomeAt(x, z, h, cl);
          if (!bio.ocean && !bio.river) return { x: x + 0.5, y: Math.round(h) + 1.2, z: z + 0.5 };
        }
      }
    }
    return { x: 0.5, y: 90, z: 0.5 };
  };

  Game.prototype.giveStarterKit = function () {
    const inv = this.inventory;
    ['grass_block', 'stone', 'oak_planks', 'glass', 'oak_log', 'torch',
     'crafting_table', 'furnace', 'chest'].forEach(function (n, i) {
      inv.set(i, MC.stack(n, 64));
    });
  };

  /* ============================================================
   * main loop
   * ============================================================ */

  Game.prototype.tick = function (dt) {
    if (!this.running) return;
    this.time += dt;
    this.frame++;

    const input = this.input;
    const player = this.player;

    /* --- title-screen panorama: just orbit and keep streaming --- */
    if (this.panorama) {
      player.yaw += dt * 0.05;
      player.pitch = -0.06;
      player.vx = player.vy = player.vz = 0;
      this.world.tick(dt * 0.35);
      this.streamChunks(dt);
      this.updateEntities(dt);
      this.particles.update(dt, this.world);
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.ready) { this.spawnTimer = 4; this.trySpawnMobs(); }
      input.endFrame();
      return;
    }

    if (!this.paused && !this.screen) {
      /* --- look --- */
      if (input.locked) {
        const m = input.consumeMouse();
        const sens = input.sensitivity * this.settings.sensitivity;
        player.yaw -= m.dx * sens;
        player.pitch += (this.settings.invertY ? -1 : 1) * m.dy * sens;
        player.pitch = clamp(player.pitch, -Math.PI / 2 + 0.001, Math.PI / 2 - 0.001);
        player.yaw = ((player.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      }
      /* --- hotbar --- */
      if (input.mouse.wheel) {
        player.selected = (player.selected + input.mouse.wheel + 9) % 9;
        this.ui.markHotbar();
      }
      for (let i = 0; i < 9; i++) {
        if (input.keyPressed('Digit' + (i + 1))) { player.selected = i; this.ui.markHotbar(); }
      }
      if (input.pressed('drop')) this.dropSelected(input.down('sneak'));

      player.update(dt, input, this);
      this.interact(dt);
    } else {
      player.update(dt, { down: function () { return false; } }, this);
    }

    this.world.tick(dt);
    this.updateWeather(dt);
    this.streamChunks(dt);
    this.updateEntities(dt);
    this.particles.update(dt, this.world);
    this.updateTiles(dt);
    this.randomTick(dt);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.ready) { this.spawnTimer = 3; this.trySpawnMobs(); }

    if (player.dead && !this.ui.deathShown) this.ui.showDeath();

    this.saveTimer += dt;
    if (this.saveTimer > 30) { this.saveTimer = 0; this.save(); }

    input.endFrame();
  };

  Game.prototype.updateWeather = function (dt) {
    const w = this.weather;
    w.timer -= dt;
    if (w.timer <= 0) {
      w.timer = 120 + Math.random() * 420;
      w.target = Math.random() < 0.28 ? (0.5 + Math.random() * 0.5) : 0;
    }
    w.rain += (w.target - w.rain) * Math.min(1, dt * 0.25);
    if (w.rain > 0.05) this.spawnRain(dt);
  };

  Game.prototype.spawnRain = function (dt) {
    const p = this.player;
    const n = Math.floor(this.weather.rain * 70 * dt);
    const uv = MC.atlas.uv.white;
    for (let i = 0; i < n; i++) {
      const x = p.x + (Math.random() - 0.5) * 26;
      const z = p.z + (Math.random() - 0.5) * 26;
      const top = this.world.topSolid(Math.floor(x), Math.floor(z));
      if (top < 0) continue;
      const y = Math.min(top + 14, p.y + 12);
      if (y < top) continue;
      this.particles.spawn(x, y, z, 0, -14, 0, 0.9, 0.035, uv, [120, 150, 220], 0.2);
    }
  };

  /* ============================================================
   * chunk streaming
   * ============================================================ */

  Game.prototype.streamChunks = function (dt) {
    const world = this.world, p = this.player;
    const R = this.settings.renderDistance;
    const pcx = Math.floor(p.x) >> 4, pcz = Math.floor(p.z) >> 4;

    /* --- generate --- */
    let gen = this.ready ? this.genBudget : 12;
    const want = [];
    for (let dz = -R - 1; dz <= R + 1; dz++) {
      for (let dx = -R - 1; dx <= R + 1; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > (R + 1) * (R + 1)) continue;
        const cx = pcx + dx, cz = pcz + dz;
        if (!world.hasChunk(cx, cz)) want.push([d2, cx, cz]);
      }
    }
    want.sort(function (a, b) { return a[0] - b[0]; });
    for (let i = 0; i < want.length && gen > 0; i++) {
      this.rememberTiles(world.createChunk(want[i][1], want[i][2]));
      gen--;
    }

    /* --- decorate (needs all 8 neighbours generated) --- */
    let dec = this.ready ? 4 : 16;
    for (let dz = -R; dz <= R && dec > 0; dz++) {
      for (let dx = -R; dx <= R && dec > 0; dx++) {
        const cx = pcx + dx, cz = pcz + dz;
        const c = world.getChunk(cx, cz);
        if (!c || c.decorated) continue;
        let ok = true;
        for (let j = -1; j <= 1 && ok; j++) for (let i = -1; i <= 1; i++) {
          if (!world.hasChunk(cx + i, cz + j)) { ok = false; break; }
        }
        if (!ok) continue;
        world.decorateChunk(c);
        dec--;
      }
    }

    /* --- light --- */
    let lit = this.ready ? 4 : 16;
    for (let dz = -R; dz <= R && lit > 0; dz++) {
      for (let dx = -R; dx <= R && lit > 0; dx++) {
        const c = world.getChunk(pcx + dx, pcz + dz);
        if (!c || c.lit || !c.decorated) continue;
        world.initSkyLight(c);
        lit--;
      }
    }
    world.processLight(this.ready ? 26000 : 260000);

    /* --- mesh --- */
    let mesh = this.ready ? this.meshBudget : 10;
    const todo = [];
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > R * R) continue;
        const cx = pcx + dx, cz = pcz + dz;
        const c = world.getChunk(cx, cz);
        if (!c || !c.dirty || !c.lit || !c.decorated) continue;
        if (!world.hasChunk(cx + 1, cz) || !world.hasChunk(cx - 1, cz) ||
            !world.hasChunk(cx, cz + 1) || !world.hasChunk(cx, cz - 1)) continue;
        todo.push([d2, c]);
      }
    }
    todo.sort(function (a, b) { return a[0] - b[0]; });
    for (let i = 0; i < todo.length && mesh > 0; i++) {
      const c = todo[i][1];
      const data = this.mesher.build(c);
      this.renderer.uploadChunk(c, data);
      c.dirty = false;
      mesh--;
    }

    /* --- unload --- */
    const limit = (R + 3) * (R + 3);
    const self = this;
    const drop = [];
    world.chunks.forEach(function (c) {
      const dx = c.cx - pcx, dz = c.cz - pcz;
      if (dx * dx + dz * dz > limit) drop.push(c.key);
    });
    for (let i = 0; i < drop.length; i++) {
      const c = world.chunks.get(drop[i]);
      if (c) {
        world.stashChunk(c);
        if (c.tiles && c.tiles.size) this.forgetTiles(c);
      }
      world.unloadChunk(drop[i]);
      this.renderer.freeChunk(drop[i]);
    }

    /* --- ready when the ground under the player exists --- */
    if (!this.ready) {
      this.loadTicks++;
      const home = world.getChunk(pcx, pcz);
      const meshed = home && home.mesh && !home.dirty;
      if ((meshed && todo.length < 12) || this.loadTicks > 400) {
        this.ready = true;
        if (this.pendingSpawn) {
          const top = world.topSolid(Math.floor(p.x), Math.floor(p.z));
          if (top >= 0) {
            p.y = top + (this.panorama ? 6 : 1);
            p.respawnPoint = { x: p.x, y: p.y, z: p.z };
          }
          this.pendingSpawn = false;
        }
        this.ui.hideLoading();
      }
    }
  };

  /* ============================================================
   * interaction
   * ============================================================ */

  Game.prototype.heldStack = function () { return this.inventory.get(this.player.selected); };
  Game.prototype.heldThing = function () {
    const s = this.heldStack();
    return s ? MC.thing(s.name) : null;
  };

  Game.prototype.breakTime = function (block, tool) {
    if (block.unbreakable || block.hardness < 0) return Infinity;
    if (block.hardness === 0) return 0;
    const needs = block.tool;
    const usable = tool && (!needs || tool.type === needs);
    const speed = usable ? tool.speed : 1;
    const correct = !needs || (tool && tool.type === needs);
    return block.hardness * (correct ? 1.5 : 5) / speed;
  };

  Game.prototype.canHarvest = function (block, tool) {
    if (block.level === 0) return true;
    return !!(tool && tool.type === block.tool && tool.tier + 1 >= block.level);
  };

  Game.prototype.pickTarget = function () {
    const p = this.player;
    const d = vec3.create(); p.lookVector(d);
    return PH.raycast(this.world, p.x, p.eyeY(), p.z, d[0], d[1], d[2], p.reach(), { plants: true });
  };

  Game.prototype.pickEntity = function (maxDist) {
    const p = this.player;
    const d = vec3.create(); p.lookVector(d);
    const ox = p.x, oy = p.eyeY(), oz = p.z;
    let best = null, bestT = maxDist;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!(e instanceof MC.Mob) || e.dead) continue;
      // ray vs AABB slab test
      const minX = e.x - e.w - 0.1, maxX = e.x + e.w + 0.1;
      const minY = e.y - 0.1, maxY = e.y + e.h + 0.1;
      const minZ = e.z - e.w - 0.1, maxZ = e.z + e.w + 0.1;
      let t0 = 0, t1 = bestT;
      let ok = true;
      const o = [ox, oy, oz], dd = [d[0], d[1], d[2]];
      const mn = [minX, minY, minZ], mx = [maxX, maxY, maxZ];
      for (let a = 0; a < 3; a++) {
        if (Math.abs(dd[a]) < 1e-8) { if (o[a] < mn[a] || o[a] > mx[a]) { ok = false; break; } continue; }
        let ta = (mn[a] - o[a]) / dd[a], tb = (mx[a] - o[a]) / dd[a];
        if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
        if (ta > t0) t0 = ta;
        if (tb < t1) t1 = tb;
        if (t0 > t1) { ok = false; break; }
      }
      if (ok && t0 >= 0 && t0 < bestT) { bestT = t0; best = e; }
    }
    return best;
  };

  Game.prototype.interact = function (dt) {
    const input = this.input, p = this.player, world = this.world;
    if (p.dead) return;
    const target = this.pickTarget();
    this.target = target;

    /* --- middle click picks the block you're looking at --- */
    if (input.mouse.middle && target) {
      input.mouse.middle = false;
      const name = B.get(target.id).name;
      if (p.mode === 'creative') {
        p.selected = this.inventory.pickBlock(name, p.selected);
        this.ui.markHotbar();
      }
    }

    /* --- left: mine or attack --- */
    if (input.mouse.left) {
      const ent = this.pickEntity(p.reach());
      if (ent && p.attackCooldown <= 0) {
        p.swing();
        p.attackCooldown = 0.45;
        const held = this.heldThing();
        const dmg = held && held.tool ? held.tool.damage : 1;
        ent.hurt(dmg, this, p);
        p.exhaust(0.1);
        if (held && held.tool && held.durability) this.inventory.damageTool(p.selected, 1);
        input.mouse.left = false;
      } else if (target) {
        this.mine(dt, target);
      } else {
        if (!p.swinging) p.swing();
        p.breaking = null;
      }
    } else {
      p.breaking = null;
    }

    /* --- right: place or use --- */
    if (input.mouse.right) {
      input.mouse.right = false;
      this.useItem(target);
    }
  };

  Game.prototype.mine = function (dt, target) {
    const p = this.player, world = this.world;
    const block = B.get(target.id);
    if (!p.breaking || p.breaking.x !== target.x || p.breaking.y !== target.y || p.breaking.z !== target.z) {
      p.breaking = { x: target.x, y: target.y, z: target.z, t: 0, total: 0 };
      p.swing();
    }
    const held = this.heldThing();
    const tool = held ? held.tool : null;
    const total = p.mode === 'creative' ? 0 : this.breakTime(block, tool);
    p.breaking.total = total;
    p.breaking.t += dt;
    if (!p.swinging) p.swing();
    if (Math.random() < dt * 14) {
      this.particles.blockBurst(target.x, target.y, target.z, target.id, 1, 1.2);
      this.audio.dig(block.sound);
    }
    if (p.breaking.t >= total) {
      this.breakBlock(target.x, target.y, target.z, true);
      p.breaking = null;
    }
  };

  Game.prototype.breakBlock = function (x, y, z, byPlayer) {
    const world = this.world, p = this.player;
    const id = world.getBlock(x, y, z);
    if (id === 0) return;
    const block = B.get(id);
    if (block.unbreakable && p.mode !== 'creative') return;

    const held = this.heldThing();
    const tool = held ? held.tool : null;
    if (byPlayer && p.mode === 'survival') {
      if (this.canHarvest(block, tool) && block.drop) {
        let dropName = block.drop;
        let n = block.dropCount;
        if (tool && tool.type === 'shears' && /leaves/.test(block.name)) dropName = block.name;
        if (/leaves/.test(block.name) && !dropName) dropName = null;
        if (dropName) this.dropItem(x + 0.5, y + 0.5, z + 0.5, dropName, n);
      }
      // leaves occasionally give a sapling or an apple
      if (/leaves/.test(block.name) && (!tool || tool.type !== 'shears')) {
        const wood = block.name.replace('_leaves', '');
        if (Math.random() < 0.06 && B.byName[wood + '_sapling']) this.dropItem(x + 0.5, y + 0.5, z + 0.5, wood + '_sapling', 1);
        if (wood === 'oak' && Math.random() < 0.02) this.dropItem(x + 0.5, y + 0.5, z + 0.5, 'apple', 1);
      }
      if (block.name === 'short_grass' || block.name === 'tall_grass') {
        if (Math.random() < 0.12) this.dropItem(x + 0.5, y + 0.5, z + 0.5, 'wheat_seeds', 1);
      }
      if (tool && held.durability) this.inventory.damageTool(p.selected, 1);
      p.exhaust(0.005);
      if (block.name.indexOf('_ore') >= 0) {
        const xp = { coal_ore: 1, diamond_ore: 4, emerald_ore: 5, lapis_ore: 3, redstone_ore: 3 }[block.name] || 0;
        if (xp) this.spawnXP(x + 0.5, y + 0.5, z + 0.5, xp);
      }
    }

    this.particles.blockBurst(x, y, z, id, 14, 2.6);
    this.audio.break_(block.sound);
    this.removeTile(x, y, z);
    world.setBlock(x, y, z, 0);
    this.afterBlockChange(x, y, z);
  };

  // knock down anything that needed the block that just vanished
  Game.prototype.afterBlockChange = function (x, y, z) {
    const world = this.world;
    const above = world.getBlock(x, y + 1, z);
    if (above !== 0) {
      const ab = B.get(above);
      if (ab.needsSupport && !B.T.solid[world.getBlock(x, y, z)]) {
        if (ab.drop) this.dropItem(x + 0.5, y + 1.5, z + 0.5, ab.drop, ab.dropCount);
        world.setBlock(x, y + 1, z, 0);
        this.afterBlockChange(x, y + 1, z);
      } else if (ab.gravity) {
        this.fallColumn(x, y + 1, z);
      }
    }
  };

  // sand and gravel drop straight down
  Game.prototype.fallColumn = function (x, y, z) {
    const world = this.world;
    let src = y;
    while (src < CY) {
      const id = world.getBlock(x, src, z);
      if (id === 0 || !B.get(id).gravity) break;
      let dest = src;
      while (dest > 0 && world.getBlock(x, dest - 1, z) === 0) dest--;
      if (dest !== src) {
        world.setBlock(x, src, z, 0);
        world.setBlock(x, dest, z, id);
      }
      src++;
    }
  };

  Game.prototype.useItem = function (target) {
    const p = this.player, world = this.world;
    const stack = this.heldStack();
    const thing = stack ? MC.thing(stack.name) : null;

    /* --- open a container --- */
    if (target && !this.input.down('sneak')) {
      const name = B.get(target.id).name;
      if (name === 'crafting_table') { this.openCrafting(); return; }
      if (name === 'furnace' || name === 'furnace_lit') { this.openFurnace(target.x, target.y, target.z); return; }
      if (name === 'chest') { this.openChest(target.x, target.y, target.z); return; }
    }

    if (!thing) { p.swing(); return; }

    /* --- eat --- */
    if (thing.food && (p.hunger < 20 || thing.name === 'milk_bucket')) {
      p.eat(thing.food);
      this.audio.play('eat', 0.3);
      if (thing.name === 'mushroom_stew' || /bucket/.test(thing.name)) {
        this.inventory.set(p.selected, MC.stack('bowl', 1));
        if (/bucket/.test(thing.name)) this.inventory.set(p.selected, MC.stack('bucket', 1));
      } else this.inventory.consumeSelected(p.selected, 1);
      this.ui.markHotbar();
      p.swing();
      return;
    }

    /* --- buckets --- */
    if (thing.name === 'bucket') {
      const t = PH.raycast(world, p.x, p.eyeY(), p.z, ...vecOf(p), p.reach(), { fluids: true });
      if (t && (B.get(t.id).name === 'water' || B.get(t.id).name === 'lava')) {
        const fluid = B.get(t.id).name;
        world.setBlock(t.x, t.y, t.z, 0);
        this.inventory.set(p.selected, MC.stack(fluid + '_bucket', 1));
        this.audio.play('splash', 0.3);
        this.ui.markHotbar();
        p.swing();
        return;
      }
    }
    if (thing.place === 'water' || thing.place === 'lava') {
      if (target) {
        const px = target.x + target.nx, py = target.y + target.ny, pz = target.z + target.nz;
        world.setBlock(px, py, pz, B.idOf(thing.place));
        this.inventory.set(p.selected, MC.stack('bucket', 1));
        this.audio.play('splash', 0.3);
        this.ui.markHotbar();
        p.swing();
        this.markNeighbours(px, py, pz);
        return;
      }
    }

    /* --- hoe makes farmland --- */
    if (thing.tool && thing.tool.type === 'hoe' && target) {
      const n = B.get(target.id).name;
      if (n === 'grass_block' || n === 'dirt' || n === 'coarse_dirt') {
        world.setBlock(target.x, target.y, target.z, B.idOf('farmland'));
        this.audio.place('gravel');
        this.inventory.damageTool(p.selected, 1);
        p.swing();
        return;
      }
    }

    /* --- shoot --- */
    if (thing.name === 'bow' && (p.mode === 'creative' || this.inventory.has('arrow', 1))) {
      if (p.mode !== 'creative') this.inventory.remove('arrow', 1);
      const d = vec3.create(); p.lookVector(d);
      this.entities.push(new MC.Arrow(p.x, p.eyeY(), p.z, d[0] * 46, d[1] * 46 + 2, d[2] * 46, p));
      this.audio.play('bow', 0.4);
      this.inventory.damageTool(p.selected, 1);
      p.swing();
      return;
    }

    /* --- place a block --- */
    if (thing.isBlock || (thing.place && B.byName[thing.place])) {
      if (!target) { p.swing(); return; }
      const placeName = thing.isBlock ? thing.name : thing.place;
      const targetBlock = B.get(target.id);
      let px, py, pz;
      if (targetBlock.replaceable) { px = target.x; py = target.y; pz = target.z; }
      else { px = target.x + target.nx; py = target.y + target.ny; pz = target.z + target.nz; }
      const existing = B.get(world.getBlock(px, py, pz));
      if (!existing.replaceable && existing.name !== 'air') { p.swing(); return; }

      const def = B.byName[placeName];
      if (def.collide) {
        // don't wall yourself in
        const overlapX = p.x + 0.3 > px && p.x - 0.3 < px + 1;
        const overlapZ = p.z + 0.3 > pz && p.z - 0.3 < pz + 1;
        const overlapY = p.y + p.h > py && p.y < py + 1;
        if (overlapX && overlapY && overlapZ) { p.swing(); return; }
        for (let i = 0; i < this.entities.length; i++) {
          const e = this.entities[i];
          if (!(e instanceof MC.Mob) || e.dead) continue;
          if (e.x + e.w > px && e.x - e.w < px + 1 && e.z + e.w > pz && e.z - e.w < pz + 1 &&
              e.y + e.h > py && e.y < py + 1) { p.swing(); return; }
        }
      }
      if (def.needsSupport && !B.T.solid[world.getBlock(px, py - 1, pz)]) { p.swing(); return; }

      // orient front-facing blocks away from the player
      let id = B.idOf(placeName);
      world.setBlock(px, py, pz, id);
      this.markNeighbours(px, py, pz);
      this.audio.place(def.sound);
      if (p.mode !== 'creative') this.inventory.consumeSelected(p.selected, 1);
      this.ui.markHotbar();
      p.swing();
      if (placeName === 'chest' || placeName === 'furnace') this.createTile(px, py, pz, placeName);
      return;
    }

    p.swing();
  };

  function vecOf(p) {
    const d = vec3.create();
    p.lookVector(d);
    return [d[0], d[1], d[2]];
  }

  Game.prototype.markNeighbours = function (x, y, z) {
    const w = this.world;
    for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const c = w.chunkAtBlock(x + dx, z + dz);
      if (c) c.dirty = true;
    }
  };

  Game.prototype.dropSelected = function (whole) {
    const p = this.player;
    const s = this.inventory.get(p.selected);
    if (!s) return;
    const n = whole ? s.count : 1;
    const d = vec3.create(); p.lookVector(d);
    const e = new MC.ItemEntity(p.x + d[0] * 0.6, p.eyeY() - 0.3, p.z + d[2] * 0.6, s.name, n);
    e.vx = d[0] * 6; e.vy = d[1] * 6 + 1.6; e.vz = d[2] * 6;
    e.pickupDelay = 1.2;
    this.entities.push(e);
    s.count -= n;
    if (s.count <= 0) this.inventory.set(p.selected, null);
    this.ui.markHotbar();
  };

  Game.prototype.dropItem = function (x, y, z, name, count) {
    if (!name || count <= 0) return;
    if (!MC.thing(name)) return;
    this.entities.push(new MC.ItemEntity(x, y, z, name, count));
  };

  Game.prototype.spawnXP = function (x, y, z, amount) {
    if (this.player.mode === 'creative') return;
    this.entities.push(new MC.XPOrb(x, y, z, amount));
  };

  Game.prototype.spawnArrow = function (from, to) {
    const dx = to.x - from.x, dy = (to.eyeY ? to.eyeY() : to.y + 1) - (from.y + from.h * 0.8), dz = to.z - from.z;
    const l = Math.hypot(dx, dy, dz) || 1;
    const sp = 30;
    this.entities.push(new MC.Arrow(from.x, from.y + from.h * 0.8, from.z,
      dx / l * sp, dy / l * sp + 3, dz / l * sp, from));
    this.audio.play('bow', 0.25);
  };

  /* ============================================================
   * explosions
   * ============================================================ */
  Game.prototype.explode = function (x, y, z, power) {
    const world = this.world;
    const r = Math.ceil(power);
    for (let dy = -r; dy <= r; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          const d = Math.hypot(dx, dy, dz);
          if (d > power) continue;
          const bx = Math.floor(x) + dx, by = Math.floor(y) + dy, bz = Math.floor(z) + dz;
          const id = world.getBlock(bx, by, bz);
          if (id === 0) continue;
          const b = B.get(id);
          if (b.unbreakable || b.hardness > 12) continue;
          if (Math.random() < d / power * 0.65) continue;
          if (Math.random() < 0.25 && b.drop) this.dropItem(bx + 0.5, by + 0.5, bz + 0.5, b.drop, b.dropCount);
          this.removeTile(bx, by, bz);
          world.setBlock(bx, by, bz, 0);
        }
      }
    }
    this.markNeighbours(Math.floor(x), Math.floor(y), Math.floor(z));
    const uv = MC.atlas.uv.white;
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * 2;
      const s = 3 + Math.random() * 9;
      const grey = 130 + Math.random() * 90;
      this.particles.spawn(x, y, z, Math.cos(a) * s, e * s * 0.6, Math.sin(a) * s,
        0.8 + Math.random() * 0.9, 0.2 + Math.random() * 0.3, uv, [grey, grey * 0.85, grey * 0.7], 0.25);
    }
    // damage everything nearby
    const p = this.player;
    const pd = Math.hypot(p.x - x, p.y + 0.9 - y, p.z - z);
    if (pd < power * 2) {
      p.damage(Math.max(1, Math.round((1 - pd / (power * 2)) * 18)), 'explosion');
      const l = pd || 1;
      p.vx += (p.x - x) / l * 9; p.vy += 7; p.vz += (p.z - z) / l * 9;
    }
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!(e instanceof MC.Mob) || e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y, e.z - z);
      if (d < power * 2) e.hurt(Math.max(1, Math.round((1 - d / (power * 2)) * 20)), this, null);
    }
    this.audio.play('explode', 0.6);
  };

  /* ============================================================
   * entities
   * ============================================================ */

  Game.prototype.updateEntities = function (dt) {
    const list = this.entities;
    const p = this.player;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      e.update(dt, this.world, this);
      if (e.dead && (!(e instanceof MC.Mob) || e.deathTime > 0.9)) { list.splice(i, 1); continue; }
      // cull anything far from the player
      const d2 = (e.x - p.x) * (e.x - p.x) + (e.z - p.z) * (e.z - p.z);
      if (d2 > 140 * 140) list.splice(i, 1);
      else if (e instanceof MC.Mob && d2 > 90 * 90) {
        e.despawnTimer += dt;
        if (e.despawnTimer > 12) list.splice(i, 1);
      } else if (e instanceof MC.Mob) e.despawnTimer = 0;
    }
    // occasional ambient noises
    if (Math.random() < dt * 0.35) {
      const mobs = list.filter(function (e) { return e instanceof MC.Mob && !e.dead; });
      if (mobs.length) {
        const m = mobs[(Math.random() * mobs.length) | 0];
        const d = Math.hypot(m.x - p.x, m.z - p.z);
        if (d < 20) this.audio.mob(m.type, 0.16 * (1 - d / 20));
      }
    }
  };

  Game.prototype.trySpawnMobs = function () {
    const world = this.world, p = this.player;
    if (p.mode === 'creative') return;
    let passive = 0, hostile = 0;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!(e instanceof MC.Mob) || e.dead) continue;
      if (e.art.hostile) hostile++; else passive++;
    }
    const night = world.isNight();
    const tries = 14;
    for (let t = 0; t < tries; t++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 22 + Math.random() * 34;
      const x = Math.floor(p.x + Math.cos(ang) * dist);
      const z = Math.floor(p.z + Math.sin(ang) * dist);
      const c = world.chunkAtBlock(x, z);
      if (!c || !c.lit) continue;
      const top = world.topSolid(x, z);
      if (top < 0 || top >= MC.CHUNK.Y - 3) continue;
      const y = top + 1;
      if (world.getBlock(x, y, z) !== 0 || world.getBlock(x, y + 1, z) !== 0) continue;
      const ground = B.get(world.getBlock(x, top, z));
      const biome = world.biomeAt(x, z);
      const sky = world.getSkyLight(x, y, z);
      const blockLight = world.getBlockLight(x, y, z);
      const lightLevel = Math.max(sky * world.dayLight(), blockLight);

      if (!night && lightLevel > 8 && passive < 14) {
        if (!biome.mobs.length) continue;
        if (ground.name !== 'grass_block' && ground.name !== 'sand' && ground.name !== 'snow_block'
            && ground.name !== 'podzol' && ground.name !== 'mycelium') continue;
        const type = biome.mobs[(Math.random() * biome.mobs.length) | 0];
        if (!MC.mobArt.MOBS[type]) continue;
        const n = 1 + ((Math.random() * 3) | 0);
        for (let k = 0; k < n; k++) {
          const m = new MC.Mob(type, x + 0.5 + (Math.random() - 0.5) * 3, y, z + 0.5 + (Math.random() - 0.5) * 3,
            { baby: Math.random() < 0.1 });
          this.entities.push(m);
          passive++;
        }
        return;
      }
      if (lightLevel < 7 && hostile < 12) {
        const pool = ['zombie', 'skeleton', 'creeper', 'spider', 'zombie'];
        if (Math.random() < 0.05) pool.push('enderman');
        const type = pool[(Math.random() * pool.length) | 0];
        this.entities.push(new MC.Mob(type, x + 0.5, y, z + 0.5, {}));
        hostile++;
        return;
      }
    }
  };

  /* ============================================================
   * tile entities (chests, furnaces)
   * ============================================================ */

  Game.prototype.tileKey = function (x, y, z) { return x + ',' + y + ',' + z; };

  Game.prototype.getTile = function (x, y, z, create, kind) {
    const c = this.world.chunkAtBlock(x, z);
    if (!c) return null;
    if (!c.tiles) c.tiles = new Map();
    const k = MC.idx(x & 15, y, z & 15);
    let t = c.tiles.get(k);
    if (!t && create) {
      t = kind === 'furnace'
        ? { kind: 'furnace', x: x, y: y, z: z, input: null, fuel: null, output: null, burn: 0, burnMax: 0, cook: 0 }
        : { kind: 'chest', x: x, y: y, z: z, items: new Array(27).fill(null) };
      c.tiles.set(k, t);
      if (kind === 'furnace') this.activeTiles.push(t);
    }
    return t || null;
  };

  Game.prototype.createTile = function (x, y, z, kind) { this.getTile(x, y, z, true, kind); };

  // Furnaces tick from a flat list, so it has to follow chunks in and out.
  Game.prototype.rememberTiles = function (chunk) {
    if (!chunk || !chunk.tiles) return chunk;
    const self = this;
    chunk.tiles.forEach(function (t) {
      if (t.kind === 'furnace' && self.activeTiles.indexOf(t) < 0) self.activeTiles.push(t);
    });
    return chunk;
  };

  Game.prototype.forgetTiles = function (chunk) {
    if (!chunk || !chunk.tiles) return;
    const self = this;
    chunk.tiles.forEach(function (t) {
      const i = self.activeTiles.indexOf(t);
      if (i >= 0) self.activeTiles.splice(i, 1);
    });
  };

  Game.prototype.removeTile = function (x, y, z) {
    const c = this.world.chunkAtBlock(x, z);
    if (!c || !c.tiles) return;
    const k = MC.idx(x & 15, y, z & 15);
    const t = c.tiles.get(k);
    if (!t) return;
    // spill the contents
    const spill = t.kind === 'chest' ? t.items : [t.input, t.fuel, t.output];
    for (let i = 0; i < spill.length; i++) {
      if (spill[i]) this.dropItem(x + 0.5, y + 0.5, z + 0.5, spill[i].name, spill[i].count);
    }
    c.tiles.delete(k);
    const ai = this.activeTiles.indexOf(t);
    if (ai >= 0) this.activeTiles.splice(ai, 1);
  };

  Game.prototype.updateTiles = function (dt) {
    const world = this.world;
    for (let i = 0; i < this.activeTiles.length; i++) {
      const t = this.activeTiles[i];
      if (t.kind !== 'furnace') continue;
      const recipe = t.input ? MC.recipes.smelt(t.input.name) : null;
      const canOutput = recipe && (!t.output ||
        (t.output.name === recipe.name && t.output.count < 64));

      if (t.burn > 0) t.burn -= dt;
      if (t.burn <= 0 && canOutput && t.fuel) {
        const f = MC.recipes.fuel(t.fuel.name);
        if (f > 0) {
          t.burnMax = f / 20;          // fuel values are in ticks (20 per second)
          t.burn = t.burnMax;
          t.fuel.count--;
          if (t.fuel.count <= 0) t.fuel = t.fuel.name === 'lava_bucket' ? MC.stack('bucket', 1) : null;
        }
      }
      const wasLit = t.lit;
      t.lit = t.burn > 0;
      if (t.lit !== wasLit) {
        const id = B.idOf(t.lit ? 'furnace_lit' : 'furnace');
        if (world.getBlock(t.x, t.y, t.z) !== 0) world.setBlock(t.x, t.y, t.z, id);
      }
      if (t.burn > 0 && canOutput) {
        t.cook += dt;
        if (t.cook >= 10) {
          t.cook = 0;
          if (t.output) t.output.count += recipe.count;
          else t.output = MC.stack(recipe.name, recipe.count);
          t.input.count--;
          if (t.input.count <= 0) t.input = null;
          this.player.addXP(Math.max(1, Math.round(recipe.xp * 3)));
        }
      } else t.cook = Math.max(0, t.cook - dt * 2);
    }
  };

  /* ============================================================
   * random ticks - saplings growing, grass spreading and dying back
   * ============================================================ */

  const SAPLING_TREE = {
    oak_sapling: ['oak', 'big_oak'], birch_sapling: ['birch'], spruce_sapling: ['spruce', 'mega_spruce'],
    jungle_sapling: ['jungle', 'mega_jungle'], acacia_sapling: ['acacia'], dark_oak_sapling: ['dark_oak']
  };

  Game.prototype.randomTick = function (dt) {
    if (!this.ready) return;
    this.rtAccum = (this.rtAccum || 0) + dt;
    if (this.rtAccum < 0.5) return;
    this.rtAccum = 0;

    const world = this.world, p = this.player;
    const pcx = Math.floor(p.x) >> 4, pcz = Math.floor(p.z) >> 4;
    const R = Math.min(4, this.settings.renderDistance);
    const rng = this._rtRng || (this._rtRng = new MC.RNG((Math.random() * 0xffffffff) >>> 0));

    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const c = world.getChunk(pcx + dx, pcz + dz);
        if (!c || !c.lit) continue;
        // sample a handful of surface columns per chunk rather than every block
        for (let n = 0; n < 3; n++) {
          const lx = rng.int(16), lz = rng.int(16);
          const wx = c.cx * 16 + lx, wz = c.cz * 16 + lz;
          const top = world.topSolid(wx, wz);
          if (top < 0) continue;
          const y = rng.intRange(Math.max(0, top - 2), Math.min(MC.CHUNK.Y - 2, top + 1));
          this.tickBlock(wx, y, wz, rng);
        }
      }
    }
  };

  Game.prototype.tickBlock = function (x, y, z, rng) {
    const world = this.world;
    const id = world.getBlock(x, y, z);
    if (id === 0) return;
    const name = B.get(id).name;

    /* --- saplings grow into trees --- */
    const kinds = SAPLING_TREE[name];
    if (kinds) {
      if (world.getSkyLight(x, y, z) < 9 && world.getBlockLight(x, y, z) < 9) return;
      if (!rng.chance(0.06)) return;
      // needs headroom
      for (let k = 1; k <= 5; k++) if (B.T.opaque[world.getBlock(x, y + k, z)]) return;
      const type = kinds.length > 1 && rng.chance(0.15) ? kinds[1] : kinds[0];
      const self = this;
      world.setBlock(x, y, z, 0);
      world.gen.tree(type, x, y, z, rng, function (bx, by, bz, blockId, soft) {
        if (soft && world.getBlock(bx, by, bz) !== 0) return;
        world.setBlock(bx, by, bz, blockId);
      });
      this.markNeighbours(x, y, z);
      this.audio.place('grass');
      return;
    }

    /* --- grass dies under cover, and spreads onto bare dirt --- */
    if (name === 'grass_block') {
      const above = world.getBlock(x, y + 1, z);
      if (B.T.opaque[above]) {
        if (rng.chance(0.25)) world.setBlock(x, y, z, B.idOf('dirt'));
      }
      return;
    }
    if (name === 'dirt') {
      if (B.T.opaque[world.getBlock(x, y + 1, z)]) return;
      if (world.getSkyLight(x, y + 1, z) < 4) return;
      if (!rng.chance(0.35)) return;
      // only if a grass block is next to it
      for (let d = 0; d < 4; d++) {
        const nx = x + [1, -1, 0, 0][d], nz = z + [0, 0, 1, -1][d];
        for (let dy = -1; dy <= 1; dy++) {
          if (B.get(world.getBlock(nx, y + dy, nz)).name === 'grass_block') {
            world.setBlock(x, y, z, B.idOf('grass_block'));
            return;
          }
        }
      }
    }
  };

  /* ============================================================
   * container screens
   * ============================================================ */

  Game.prototype.openCrafting = function () {
    this.inventory.craftSize = 3;
    this.inventory.updateCraftResult();
    this.openScreen({ type: 'crafting' });
  };
  Game.prototype.openInventory = function () {
    this.inventory.craftSize = 2;
    this.inventory.updateCraftResult();
    this.openScreen({ type: this.player.mode === 'creative' ? 'creative' : 'inventory' });
  };
  Game.prototype.openFurnace = function (x, y, z) {
    const t = this.getTile(x, y, z, true, 'furnace');
    if (this.activeTiles.indexOf(t) < 0) this.activeTiles.push(t);
    this.openScreen({ type: 'furnace', tile: t });
  };
  Game.prototype.openChest = function (x, y, z) {
    const t = this.getTile(x, y, z, true, 'chest');
    this.openScreen({ type: 'chest', tile: t });
  };
  Game.prototype.openScreen = function (s) {
    this.screen = s;
    this.input.exitLock();
    this.audio.play('open', 0.2);
    this.ui.showScreen(s);
  };
  Game.prototype.closeScreen = function () {
    if (!this.screen) return;
    const spill = this.inventory.clearCraft();
    for (let i = 0; i < spill.length; i++) {
      this.dropItem(this.player.x, this.player.eyeY() - 0.2, this.player.z, spill[i].name, spill[i].count);
    }
    this.screen = null;
    this.ui.hideScreen();
    if (!this.paused) this.input.requestLock();
  };

  /* ============================================================
   * saving
   * ============================================================ */

  Game.prototype.snapshot = function () {
    const p = this.player;
    return {
      version: 1,
      name: this.worldName,
      seed: this.seedText,
      mode: p.mode,
      time: this.world.time,
      saved: Date.now(),
      player: {
        x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch,
        health: p.health, hunger: p.hunger, xp: p.xp, level: p.level,
        selected: p.selected, respawn: p.respawnPoint
      },
      inventory: this.inventory.serialize(),
      edits: this.world.exportEdits(),
      tiles: this.world.exportTiles()
    };
  };

  Game.prototype.save = function () {
    if (!this.running || !this.worldName || this.panorama) return false;
    try {
      const data = this.snapshot();
      localStorage.setItem('egon.world.' + this.worldName, JSON.stringify(data));
      const list = JSON.parse(localStorage.getItem('egon.worlds') || '[]');
      const i = list.findIndex(function (w) { return w.name === data.name; });
      const meta = { name: data.name, mode: data.mode, seed: data.seed, saved: data.saved };
      if (i >= 0) list[i] = meta; else list.push(meta);
      localStorage.setItem('egon.worlds', JSON.stringify(list));
      return true;
    } catch (e) {
      console.warn('save failed', e);
      return false;
    }
  };

  /* A slowly rotating world behind the title screen. */
  Game.prototype.startPanorama = function () {
    this.startWorld({ name: 'panorama', seed: 'egon-panorama', mode: 'creative' });
    this.panorama = true;
    this.worldName = null;
    this.player.mode = 'survival';
    this.player.flying = false;
    this.ui.setHud(false);
  };

  MC.Game = Game;
})();
