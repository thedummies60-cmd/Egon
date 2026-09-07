/* ============================================================
 * entities.js - mobs, dropped items, projectiles and particles.
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});
  const PH = MC.physics;
  const M = MC.math, mat4 = M.mat4;
  const clamp = M.clamp;
  const GRAVITY = 32;

  /* ============================================================
   * Mob
   * ============================================================ */
  function Mob(type, x, y, z, opts) {
    opts = opts || {};
    const art = MC.mobArt.MOBS[type];
    this.type = type;
    this.art = art;
    this.x = x; this.y = y; this.z = z;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.yaw = Math.random() * Math.PI * 2;
    this.bodyYaw = this.yaw;
    this.headYaw = 0; this.headPitch = 0;
    this.baby = !!opts.baby;
    const bs = this.baby ? art.babyScale : 1;
    this.scale = art.scale * bs;
    this.w = art.width * bs / 2;
    this.h = art.height * bs;
    this.health = art.health;
    this.maxHealth = art.health;
    this.onGround = false;
    this.walkTime = Math.random() * 10;
    this.walkAmount = 0;
    this.idle = Math.random() * 100;
    this.hurtTime = 0;
    this.dead = false;
    this.deathTime = 0;
    this.aiTimer = Math.random() * 2;
    this.wishX = 0; this.wishZ = 0;
    this.jumpTimer = 0;
    this.attackTimer = 0;
    this.target = null;
    this.fuse = -1;                       // creepers
    this.age = 0;
    this.panicTimer = 0;
    this.despawnTimer = 0;
    this.inWater = false;
    this.fallStart = null;
  }

  Mob.prototype.eyeY = function () { return this.y + this.h * 0.85; };

  Mob.prototype.update = function (dt, world, game) {
    this.age += dt;
    if (this.dead) { this.deathTime += dt; return; }
    this.hurtTime = Math.max(0, this.hurtTime - dt);
    this.attackTimer = Math.max(0, this.attackTimer - dt);

    const fluid = PH.fluidAt(world, this.x, this.y, this.z, this.w, this.h);
    this.inWater = fluid.water;

    this.think(dt, world, game);

    /* --- movement --- */
    const speed = this.art.speed * (this.panicTimer > 0 ? 1.75 : 1) * (this.baby ? 1.2 : 1);
    const k = Math.min(1, (this.onGround ? 14 : 4) * dt);
    this.vx += (this.wishX * speed - this.vx) * k;
    this.vz += (this.wishZ * speed - this.vz) * k;

    if (this.inWater) {
      this.vy = clamp(this.vy - 8 * dt, -2.4, 2.4);
      this.vy += 14 * dt;                  // float
      this.vy *= Math.pow(0.2, dt);
    } else {
      this.vy -= GRAVITY * dt;
      if (this.vy < -70) this.vy = -70;
    }

    const wasGround = this.onGround;
    PH.move(world, this, this.vx * dt, this.vy * dt, this.vz * dt);

    // hop over one-block obstacles
    if ((this.hitWallX || this.hitWallZ) && this.onGround && this.jumpTimer <= 0) {
      this.vy = 8.2; this.jumpTimer = 0.5;
    }
    this.jumpTimer -= dt;

    if (this.y < -8) { this.health = 0; this.kill(game); }

    /* --- fall damage --- */
    if (!this.onGround && this.vy < 0 && this.fallStart === null) this.fallStart = this.y;
    if (this.vy > 0) this.fallStart = null;
    if (this.onGround && !wasGround && this.fallStart !== null) {
      const d = this.fallStart - this.y;
      if (d > 3.5 && !this.inWater) this.hurt(Math.floor(d - 3), game, null);
      this.fallStart = null;
    }

    /* --- animation --- */
    const hs = Math.hypot(this.vx, this.vz);
    this.walkAmount += (Math.min(1, hs / 2.2) - this.walkAmount) * Math.min(1, 8 * dt);
    this.walkTime += hs * dt * 2.6;
    this.idle += dt;
    if (hs > 0.1) {
      const want = Math.atan2(-this.vx, -this.vz);
      this.bodyYaw += M.angleDiff(this.bodyYaw, want) * Math.min(1, 7 * dt);
    }

    /* --- hostile mobs burn in daylight --- */
    if ((this.type === 'zombie' || this.type === 'skeleton') && !world.isNight()) {
      const sky = world.getSkyLight(Math.floor(this.x), Math.floor(this.y + this.h), Math.floor(this.z));
      if (sky >= 14 && world.dayLight() > 0.6) {
        this.burnTimer = (this.burnTimer || 0) + dt;
        this.burning = true;
        if (this.burnTimer > 1) { this.burnTimer = 0; this.hurt(1, game, null); }
      } else this.burning = false;
    }
  };

  Mob.prototype.think = function (dt, world, game) {
    const art = this.art;
    const player = game ? game.player : null;
    this.aiTimer -= dt;
    this.panicTimer = Math.max(0, this.panicTimer - dt);

    let dist = Infinity;
    if (player && !player.dead) {
      dist = Math.hypot(player.x - this.x, (player.y - this.y) * 0.6, player.z - this.z);
    }

    /* --- hostiles hunt the player --- */
    if (art.hostile && player && !player.dead && player.mode !== 'creative' && dist < 22) {
      this.target = player;
      const dx = player.x - this.x, dz = player.z - this.z;
      const len = Math.hypot(dx, dz) || 1;

      if (this.type === 'creeper') {
        if (dist < 3.2) {
          this.fuse = this.fuse < 0 ? 1.5 : this.fuse - dt;
          this.wishX = 0; this.wishZ = 0;
          if (this.fuse <= 0) { this.explode(world, game); return; }
        } else {
          this.fuse = -1;
          this.wishX = dx / len; this.wishZ = dz / len;
        }
      } else if (this.type === 'skeleton' && dist < 12 && dist > 4) {
        this.wishX = 0; this.wishZ = 0;
        if (this.attackTimer <= 0) {
          this.attackTimer = 2.0;
          if (game) game.spawnArrow(this, player);
        }
      } else {
        this.wishX = dx / len; this.wishZ = dz / len;
        if (dist < 1.9 && this.attackTimer <= 0 && art.damage > 0) {
          this.attackTimer = 1.0;
          player.damage(art.damage, 'mob');
          const kb = 4.5;
          player.vx += dx / len * kb; player.vz += dz / len * kb; player.vy = 4;
          if (game) game.audio.play('hurt', 0.5);
        }
      }
      this.headYaw = M.angleDiff(this.bodyYaw, Math.atan2(-dx, -dz));
      this.headPitch = clamp(Math.atan2(this.y + this.h - player.eyeY(), len), -0.8, 0.8);
      return;
    }

    /* --- passive wandering --- */
    if (this.panicTimer > 0) {
      // keep running from whatever hit us
      if (this.aiTimer <= 0) { this.aiTimer = 0.6; }
    } else if (this.aiTimer <= 0) {
      this.aiTimer = 1.5 + Math.random() * 4;
      if (Math.random() < 0.42) { this.wishX = 0; this.wishZ = 0; }
      else {
        const a = Math.random() * Math.PI * 2;
        this.wishX = Math.cos(a); this.wishZ = Math.sin(a);
      }
    }

    // look at a nearby player when idle
    if (player && dist < 8) {
      const dx = player.x - this.x, dz = player.z - this.z;
      const len = Math.hypot(dx, dz) || 1;
      const want = M.angleDiff(this.bodyYaw, Math.atan2(-dx, -dz));
      this.headYaw += (clamp(want, -1.2, 1.2) - this.headYaw) * Math.min(1, 4 * dt);
      this.headPitch += (clamp(Math.atan2(this.y + this.h - player.eyeY(), len), -0.7, 0.7) - this.headPitch) * Math.min(1, 4 * dt);
    } else {
      this.headYaw *= Math.pow(0.2, dt);
      this.headPitch *= Math.pow(0.2, dt);
    }
  };

  Mob.prototype.explode = function (world, game) {
    if (game) game.explode(this.x, this.y + 0.6, this.z, 3.1);
    this.health = 0;
    this.dead = true;
    this.deathTime = 0.45;
  };

  Mob.prototype.hurt = function (amount, game, fromEntity) {
    if (this.dead) return;
    if (this.hurtTime > 0.25) return;
    this.health -= amount;
    this.hurtTime = 0.5;
    this.panicTimer = 6;
    if (fromEntity) {
      const dx = this.x - fromEntity.x, dz = this.z - fromEntity.z;
      const l = Math.hypot(dx, dz) || 1;
      this.vx += dx / l * 6; this.vz += dz / l * 6; this.vy = 5.2;
      if (!this.art.hostile) { this.wishX = dx / l; this.wishZ = dz / l; }
    }
    if (game) game.audio.play('hit', 0.3);
    if (this.health <= 0) this.kill(game);
  };

  Mob.prototype.kill = function (game) {
    if (this.dead) return;
    this.dead = true;
    this.deathTime = 0;
    if (!game) return;
    const drops = this.art.drops;
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      const n = d[1] + Math.floor(Math.random() * (d[2] - d[1] + 1));
      if (n > 0) game.dropItem(this.x, this.y + 0.4, this.z, d[0], n);
    }
    if (this.art.xp) game.spawnXP(this.x, this.y + 0.4, this.z, this.art.xp);
  };

  /* ---------------- rendering ---------------- */
  const _m = mat4.create(), _t = mat4.create(), _r = mat4.create();
  const WHITE = [255, 255, 255, 255];

  Mob.prototype.render = function (batch, dt, camY) {
    const art = this.art;
    const parts = art.parts;
    const swing = Math.sin(this.walkTime) * this.walkAmount;
    const swing2 = Math.sin(this.walkTime + Math.PI) * this.walkAmount;
    const breathe = Math.sin(this.idle * 1.4) * 0.03;

    let deathTilt = 0;
    if (this.dead) deathTilt = Math.min(1, this.deathTime / 0.5) * Math.PI * 0.5;
    const alpha = this.dead ? Math.max(0, 1 - this.deathTime / 0.9) : 1;
    if (alpha <= 0) return;

    let col = WHITE;
    if (this.hurtTime > 0.25) col = [255, 120, 120, 255 * alpha];
    else if (alpha < 1) col = [255, 255, 255, 255 * alpha];
    if (this.fuse >= 0) {
      const f = 1 - this.fuse / 1.5;
      const flash = (Math.sin(f * 40) * 0.5 + 0.5) * f;
      col = [255, 255 - flash * 130, 255 - flash * 130, 255 * alpha];
    }

    mat4.identity(_m);
    mat4.translate(_m, _m, this.x, this.y, this.z);
    mat4.rotateY(_m, _m, this.bodyYaw);
    if (deathTilt) mat4.rotateZ(_m, _m, deathTilt);
    mat4.scaleM(_m, _m, this.scale, this.scale, this.scale);

    for (let i = 0; i < parts.length; i++) {
      const entry = parts[i];
      const p = entry.part;
      let rx = p.rot[0], ry = p.rot[1], rz = p.rot[2];
      const a = p.anim;
      if (a === 'head') { ry += this.headYaw; rx += this.headPitch; }
      else if (a === 'legFL' || a === 'legL' || a === 'legBR') rx += swing * 0.9;
      else if (a === 'legFR' || a === 'legR' || a === 'legBL') rx += swing2 * 0.9;
      else if (a === 'armL') { rx += swing2 * 0.8; rz += breathe; }
      else if (a === 'armR') { rx += swing * 0.8; rz -= breathe; }
      else if (a === 'wingL') rz += Math.sin(this.idle * 9) * 0.35 * (this.onGround ? 0.25 : 1) - 0.1;
      else if (a === 'wingR') rz -= Math.sin(this.idle * 9) * 0.35 * (this.onGround ? 0.25 : 1) - 0.1;
      else if (a === 'tail') rx += Math.sin(this.idle * 3) * 0.18;
      else if (a && a.indexOf('spider') === 0) {
        const n = +a.slice(-1);
        const side = a.indexOf('L') > 0 ? 1 : -1;
        rz += Math.sin(this.walkTime * 2 + n * 1.6) * 0.32 * this.walkAmount * side;
        ry += Math.cos(this.walkTime * 2 + n * 1.6) * 0.22 * this.walkAmount;
      }
      if (this.type === 'zombie' && (a === 'armL' || a === 'armR')) rx = -1.45 + rx * 0.25;

      mat4.identity(_t);
      mat4.translate(_t, _t, p.pivot[0], p.pivot[1], p.pivot[2]);
      if (rx) mat4.rotateX(_t, _t, rx);
      if (ry) mat4.rotateY(_t, _t, ry);
      if (rz) mat4.rotateZ(_t, _t, rz);
      mat4.translate(_t, _t, p.pos[0] - p.pivot[0], p.pos[1] - p.pivot[1], p.pos[2] - p.pivot[2]);
      mat4.multiply(_r, _m, _t);

      const inf = p.inflate || 0;
      let c = col;
      if (p.alpha < 1) c = [col[0], col[1], col[2], col[3] * p.alpha];
      batch.box(_r, p.size[0] + inf * 2, p.size[1] + inf * 2, p.size[2] + inf * 2, entry.uv, c, true);
    }
  };

  MC.Mob = Mob;

  /* ============================================================
   * dropped item
   * ============================================================ */
  function ItemEntity(x, y, z, name, count) {
    this.x = x; this.y = y; this.z = z;
    this.vx = (Math.random() - 0.5) * 2.2;
    this.vy = 3 + Math.random() * 1.5;
    this.vz = (Math.random() - 0.5) * 2.2;
    this.name = name; this.count = count;
    this.w = 0.125; this.h = 0.25;
    this.age = 0; this.pickupDelay = 0.5;
    this.dead = false;
    this.onGround = false;
    this.spin = Math.random() * 6.28;
  }
  ItemEntity.prototype.update = function (dt, world, game) {
    this.age += dt;
    this.pickupDelay -= dt;
    if (this.age > 300) { this.dead = true; return; }
    const fluid = PH.fluidAt(world, this.x, this.y, this.z, this.w, this.h);
    if (fluid.water) { this.vy += 20 * dt; this.vy = clamp(this.vy, -1.5, 1.5); }
    else this.vy -= GRAVITY * dt;
    if (fluid.lava) { this.dead = true; return; }
    PH.move(world, this, this.vx * dt, this.vy * dt, this.vz * dt);
    const damp = this.onGround ? Math.pow(0.02, dt) : Math.pow(0.6, dt);
    this.vx *= damp; this.vz *= damp;
    this.spin += dt * 1.6;

    const p = game.player;
    if (this.pickupDelay <= 0 && !p.dead) {
      const d = Math.hypot(p.x - this.x, p.y + 0.9 - this.y, p.z - this.z);
      if (d < 1.6) {
        // drift toward the player before snapping in
        const k = Math.min(1, 12 * dt);
        this.x += (p.x - this.x) * k;
        this.y += (p.y + 0.6 - this.y) * k;
        this.z += (p.z - this.z) * k;
        if (d < 0.7) {
          const left = game.inventory.add(this.name, this.count);
          if (left < this.count) {
            game.audio.play('pop', 0.25);
            this.count = left;
            if (left <= 0) this.dead = true;
          }
        }
      }
    }
  };
  MC.ItemEntity = ItemEntity;

  /* ============================================================
   * XP orb
   * ============================================================ */
  function XPOrb(x, y, z, amount) {
    this.x = x; this.y = y; this.z = z;
    this.vx = (Math.random() - 0.5) * 2; this.vy = 2 + Math.random(); this.vz = (Math.random() - 0.5) * 2;
    this.amount = amount; this.w = 0.1; this.h = 0.2;
    this.age = 0; this.dead = false; this.onGround = false;
  }
  XPOrb.prototype.update = function (dt, world, game) {
    this.age += dt;
    if (this.age > 300) { this.dead = true; return; }
    this.vy -= GRAVITY * 0.5 * dt;
    const p = game.player;
    const d = Math.hypot(p.x - this.x, p.y + 0.9 - this.y, p.z - this.z);
    if (d < 5 && this.age > 0.4) {
      const k = Math.min(1, 6 * dt);
      this.x += (p.x - this.x) * k; this.y += (p.y + 0.8 - this.y) * k; this.z += (p.z - this.z) * k;
      if (d < 0.6) {
        p.addXP(this.amount);
        game.audio.play('xp', 0.2);
        this.dead = true;
        return;
      }
    }
    PH.move(world, this, this.vx * dt, this.vy * dt, this.vz * dt);
    this.vx *= Math.pow(0.2, dt); this.vz *= Math.pow(0.2, dt);
  };
  MC.XPOrb = XPOrb;

  /* ============================================================
   * arrow
   * ============================================================ */
  function Arrow(x, y, z, vx, vy, vz, owner) {
    this.x = x; this.y = y; this.z = z;
    this.vx = vx; this.vy = vy; this.vz = vz;
    this.owner = owner; this.dead = false; this.age = 0;
    this.stuck = false; this.w = 0.05; this.h = 0.1;
  }
  Arrow.prototype.update = function (dt, world, game) {
    this.age += dt;
    if (this.age > 60) { this.dead = true; return; }
    if (this.stuck) { if (this.age > 8) this.dead = true; return; }
    this.vy -= 20 * dt;
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt, nz = this.z + this.vz * dt;
    if (MC.blocks.T.solid[world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz))]) {
      this.stuck = true; this.age = 0; return;
    }
    this.x = nx; this.y = ny; this.z = nz;
    // hit test against mobs and the player
    const list = game.entities;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!(e instanceof Mob) || e.dead || e === this.owner) continue;
      if (Math.abs(e.x - this.x) < e.w + 0.3 && Math.abs(e.z - this.z) < e.w + 0.3 &&
          this.y > e.y - 0.2 && this.y < e.y + e.h + 0.2) {
        e.hurt(4, game, this.owner);
        this.dead = true;
        return;
      }
    }
    const p = game.player;
    if (this.owner !== p && !p.dead &&
        Math.abs(p.x - this.x) < 0.5 && Math.abs(p.z - this.z) < 0.5 &&
        this.y > p.y - 0.2 && this.y < p.y + p.h + 0.2) {
      p.damage(3, 'arrow');
      game.audio.play('hurt', 0.4);
      this.dead = true;
    }
  };
  MC.Arrow = Arrow;

  /* ============================================================
   * particles
   * ============================================================ */
  function Particles(max) {
    this.max = max || 3000;
    this.n = 0;
    this.x = new Float32Array(this.max); this.y = new Float32Array(this.max); this.z = new Float32Array(this.max);
    this.vx = new Float32Array(this.max); this.vy = new Float32Array(this.max); this.vz = new Float32Array(this.max);
    this.life = new Float32Array(this.max); this.maxLife = new Float32Array(this.max);
    this.size = new Float32Array(this.max);
    this.u0 = new Float32Array(this.max); this.v0 = new Float32Array(this.max);
    this.u1 = new Float32Array(this.max); this.v1 = new Float32Array(this.max);
    this.r = new Uint8Array(this.max); this.g = new Uint8Array(this.max); this.b = new Uint8Array(this.max);
    this.grav = new Float32Array(this.max);
  }
  Particles.prototype.spawn = function (x, y, z, vx, vy, vz, life, size, uv, col, grav) {
    let i;
    if (this.n < this.max) i = this.n++;
    else i = (Math.random() * this.max) | 0;
    this.x[i] = x; this.y[i] = y; this.z[i] = z;
    this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = life; this.maxLife[i] = life;
    this.size[i] = size;
    this.u0[i] = uv[0]; this.v0[i] = uv[1]; this.u1[i] = uv[2]; this.v1[i] = uv[3];
    this.r[i] = col ? col[0] : 255; this.g[i] = col ? col[1] : 255; this.b[i] = col ? col[2] : 255;
    this.grav[i] = grav === undefined ? 1 : grav;
  };
  // a few pixels of a block texture, for break/step puffs
  Particles.prototype.blockBurst = function (bx, by, bz, blockId, count, spread) {
    const name = MC.atlas.faceTex(MC.blocks.get(blockId), 'side');
    const uv = MC.atlas.uv[name];
    if (!uv) return;
    const s = (uv[2] - uv[0]) / 4;
    for (let i = 0; i < count; i++) {
      const cu = uv[0] + Math.floor(Math.random() * 3) * s;
      const cv = uv[1] + Math.floor(Math.random() * 3) * s;
      this.spawn(
        bx + Math.random(), by + Math.random() * 0.9, bz + Math.random(),
        (Math.random() - 0.5) * (spread || 2.4), Math.random() * 3.2, (Math.random() - 0.5) * (spread || 2.4),
        0.6 + Math.random() * 0.5, 0.09 + Math.random() * 0.05,
        [cu, cv, cu + s, cv + s], null, 1
      );
    }
  };
  Particles.prototype.update = function (dt, world) {
    const T = MC.blocks.T;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) continue;
      this.vy[i] -= 18 * this.grav[i] * dt;
      const nx = this.x[i] + this.vx[i] * dt;
      const ny = this.y[i] + this.vy[i] * dt;
      const nz = this.z[i] + this.vz[i] * dt;
      if (T.solid[world.getBlock(Math.floor(nx), Math.floor(this.y[i]), Math.floor(this.z[i]))]) { this.vx[i] = 0; }
      else this.x[i] = nx;
      if (T.solid[world.getBlock(Math.floor(this.x[i]), Math.floor(ny), Math.floor(this.z[i]))]) {
        if (this.vy[i] < 0) { this.vy[i] = 0; this.vx[i] *= 0.5; this.vz[i] *= 0.5; }
        else this.vy[i] = 0;
      } else this.y[i] = ny;
      if (T.solid[world.getBlock(Math.floor(this.x[i]), Math.floor(this.y[i]), Math.floor(nz))]) { this.vz[i] = 0; }
      else this.z[i] = nz;
    }
    // compact the tail so the array doesn't grow forever
    while (this.n > 0 && this.life[this.n - 1] <= 0) this.n--;
  };
  const _partQuad = new Float32Array(12);
  Particles.prototype.render = function (batch, camRight, camUp) {
    const p = _partQuad;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      const s = this.size[i] * Math.min(1, this.life[i] / 0.18);
      const rx = camRight[0] * s, ry = camRight[1] * s, rz = camRight[2] * s;
      const ux = camUp[0] * s, uy = camUp[1] * s, uz = camUp[2] * s;
      const x = this.x[i], y = this.y[i], z = this.z[i];
      p[0] = x - rx - ux; p[1] = y - ry - uy; p[2] = z - rz - uz;
      p[3] = x + rx - ux; p[4] = y + ry - uy; p[5] = z + rz - uz;
      p[6] = x + rx + ux; p[7] = y + ry + uy; p[8] = z + rz + uz;
      p[9] = x - rx + ux; p[10] = y - ry + uy; p[11] = z - rz + uz;
      batch.quad(p, [this.u0[i], this.v0[i], this.u1[i], this.v1[i]],
        [this.r[i], this.g[i], this.b[i], 255]);
    }
  };
  MC.Particles = Particles;
})();
