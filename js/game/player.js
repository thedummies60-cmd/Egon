/* ============================================================
 * player.js - movement, camera, survival stats, block reach.
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});
  const PH = MC.physics;
  const clamp = MC.math.clamp;

  const WALK = 4.317, SPRINT = 5.612, SNEAK = 1.31;
  const FLY = 10.9, FLY_SPRINT = 21.6;
  const GRAVITY = 32, JUMP_V = 8.95;
  const SWIM_SPEED = 2.4;
  const EYE = 1.62, EYE_SNEAK = 1.42;

  function Player(world, opts) {
    opts = opts || {};
    this.world = world;
    this.x = opts.x || 0; this.y = opts.y || 80; this.z = opts.z || 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.yaw = opts.yaw || 0; this.pitch = opts.pitch || 0;
    this.w = 0.3; this.h = 1.8;
    this.onGround = false;
    this.mode = opts.mode || 'survival';
    this.flying = this.mode === 'creative' && !!opts.flying;
    this.sprinting = false;
    this.sneaking = false;
    this.inWater = false; this.inLava = false; this.headUnderwater = false;
    this.health = opts.health === undefined ? 20 : opts.health;
    this.maxHealth = 20;
    this.hunger = opts.hunger === undefined ? 20 : opts.hunger;
    this.saturation = 5;
    this.exhaustion = 0;
    this.air = 300; this.maxAir = 300;
    this.xp = 0; this.level = 0;
    this.selected = 0;
    this.bob = 0; this.bobAmount = 0;
    this.swingTime = 1; this.swinging = false;
    this.hurtTime = 0;
    this.fallStart = null;
    this.regenTimer = 0; this.starveTimer = 0; this.drownTimer = 0;
    this.lastDamageSource = null;
    this.dead = false;
    this.respawnPoint = { x: this.x, y: this.y, z: this.z };
    this.jumpCooldown = 0;
    this.flyToggleTime = -1;
    this.stepDistance = 0;
    this.breaking = null;
    this.attackCooldown = 0;
    this.eatTime = 0;
  }

  Player.prototype.eyeY = function () {
    return this.y + (this.sneaking ? EYE_SNEAK : EYE);
  };

  Player.prototype.reach = function () { return this.mode === 'creative' ? 5.2 : 4.5; };

  Player.prototype.lookVector = function (out) {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    out[0] = -cp * sy;
    out[1] = -sp;
    out[2] = -cp * cy;
    return out;
  };

  /* ---------------- main update ---------------- */

  Player.prototype.update = function (dt, input, game) {
    const world = this.world;
    if (this.dead) { this.vx = this.vy = this.vz = 0; return; }

    const fluid = PH.fluidAt(world, this.x, this.y, this.z, this.w, this.h);
    this.inWater = fluid.water;
    this.inLava = fluid.lava;
    const headBlock = world.getBlock(Math.floor(this.x), Math.floor(this.eyeY()), Math.floor(this.z));
    this.headUnderwater = headBlock === MC.blocks.idOf('water');
    this.headInLava = headBlock === MC.blocks.idOf('lava');

    this.sneaking = input.down('sneak') && !this.flying;
    const wantSprint = input.down('sprint') && !this.sneaking;

    /* --- desired horizontal direction in world space --- */
    let fwd = 0, str = 0;
    if (input.down('forward')) fwd += 1;
    if (input.down('back')) fwd -= 1;
    if (input.down('left')) str -= 1;
    if (input.down('right')) str += 1;
    const len = Math.hypot(fwd, str);
    if (len > 0) { fwd /= len; str /= len; }
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let wishX = -fwd * sy + str * cy;
    let wishZ = -fwd * cy - str * sy;

    if (len > 0 && wantSprint && fwd > 0 && !this.inWater) this.sprinting = true;
    if (len === 0 || fwd <= 0) this.sprinting = false;
    if (this.mode === 'survival' && this.hunger <= 6) this.sprinting = false;

    /* --- speed for the current medium --- */
    let speed;
    if (this.flying) speed = (wantSprint ? FLY_SPRINT : FLY);
    else if (this.inLava) speed = 1.6;
    else if (this.inWater) speed = SWIM_SPEED;
    else if (this.sneaking) speed = SNEAK;
    else if (this.sprinting) speed = SPRINT;
    else speed = WALK;

    const accel = (this.onGround || this.flying || this.inWater) ? 26 : 7;
    const k = Math.min(1, accel * dt);
    this.vx += (wishX * speed - this.vx) * k;
    this.vz += (wishZ * speed - this.vz) * k;

    /* --- vertical --- */
    if (this.flying) {
      let vy = 0;
      if (input.down('jump')) vy += speed;
      if (input.down('sneak')) vy -= speed;
      this.vy += (vy - this.vy) * Math.min(1, 18 * dt);
    } else if (this.inWater || this.inLava) {
      const g = this.inLava ? 12 : 9;
      this.vy -= g * dt;
      if (input.down('jump')) this.vy = Math.min(this.vy + 22 * dt, this.inLava ? 1.6 : 3.2);
      else if (input.down('sneak')) this.vy = Math.max(this.vy - 14 * dt, -3.2);
      this.vy = clamp(this.vy, -4, 4);
      this.vy *= Math.pow(0.06, dt);
      this.vy += (this.inLava ? -0.9 : -0.55) * dt * 3;
      this.fallStart = null;
    } else {
      this.vy -= GRAVITY * dt;
      if (this.vy < -78) this.vy = -78;
      if (input.down('jump') && this.onGround && this.jumpCooldown <= 0) {
        this.vy = JUMP_V;
        this.jumpCooldown = 0.12;
        this.exhaust(this.sprinting ? 0.2 : 0.05);
        if (game) game.audio.play('jump', 0.25);
      }
    }
    this.jumpCooldown -= dt;

    /* --- integrate --- */
    const wasGround = this.onGround;
    const py = this.y;
    let dx = this.vx * dt, dy = this.vy * dt, dz = this.vz * dt;

    // sneaking on the edge of a block stops you walking off it
    if (this.sneaking && this.onGround) {
      const probe = 0.05;
      if (!PH.boxBlocked(world, this.x + dx - this.w, this.y - probe, this.z - this.w,
                         this.x + dx + this.w, this.y, this.z + this.w)) dx = 0;
      if (!PH.boxBlocked(world, this.x - this.w, this.y - probe, this.z + dz - this.w,
                         this.x + this.w, this.y, this.z + dz + this.w)) dz = 0;
    }

    PH.move(world, this, dx, dy, dz);

    /* --- fall damage --- */
    if (!this.flying && this.mode === 'survival') {
      if (!this.onGround && this.vy < 0 && this.fallStart === null) this.fallStart = this.y;
      if (this.vy > 0) this.fallStart = null;
      if (this.onGround && !wasGround && this.fallStart !== null) {
        const dist = this.fallStart - this.y;
        if (dist > 3.5 && !this.inWater) {
          this.damage(Math.floor(dist - 3), 'fall');
          if (game) game.audio.play('hurt', 0.4);
        }
        this.fallStart = null;
      }
      if (this.onGround) this.fallStart = null;
    }
    if (this.flying && this.onGround && !input.down('jump')) this.flying = false;

    /* --- footsteps & view bob --- */
    const hspeed = Math.hypot(this.vx, this.vz);
    this.bobAmount += ((this.onGround && hspeed > 0.4 ? Math.min(1, hspeed / WALK) : 0) - this.bobAmount) * Math.min(1, 10 * dt);
    this.bob += hspeed * dt * 1.9;
    if (this.onGround && hspeed > 0.5) {
      this.stepDistance += hspeed * dt;
      if (this.stepDistance > 2.1) {
        this.stepDistance = 0;
        if (game) {
          const below = world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.2), Math.floor(this.z));
          game.audio.step(MC.blocks.get(below).sound);
        }
        this.exhaust(this.sprinting ? 0.1 : 0.01);
      }
    }

    /* --- survival upkeep --- */
    if (this.mode === 'survival') this.survivalTick(dt, game);
    else { this.health = this.maxHealth; this.hunger = 20; this.air = this.maxAir; }

    this.hurtTime = Math.max(0, this.hurtTime - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.swinging) {
      this.swingTime += dt * 3.4;
      if (this.swingTime >= 1) { this.swingTime = 1; this.swinging = false; }
    }
  };

  Player.prototype.survivalTick = function (dt, game) {
    /* breathing */
    if (this.headUnderwater) {
      this.air -= dt * 60;
      if (this.air <= 0) {
        this.air = 0;
        this.drownTimer += dt;
        if (this.drownTimer >= 1) { this.drownTimer = 0; this.damage(2, 'drown'); }
      }
    } else {
      this.air = Math.min(this.maxAir, this.air + dt * 180);
      this.drownTimer = 0;
    }
    if (this.inLava || this.headInLava) {
      this.lavaTimer = (this.lavaTimer || 0) + dt;
      if (this.lavaTimer >= 0.5) { this.lavaTimer = 0; this.damage(2, 'lava'); }
    }

    /* hunger & regeneration */
    if (this.exhaustion >= 4) {
      this.exhaustion -= 4;
      if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1);
      else this.hunger = Math.max(0, this.hunger - 1);
    }
    if (this.hunger >= 18 && this.health < this.maxHealth) {
      this.regenTimer += dt;
      if (this.regenTimer >= 3.5) {
        this.regenTimer = 0;
        this.health = Math.min(this.maxHealth, this.health + 1);
        this.exhaust(1.5);
      }
    } else this.regenTimer = 0;
    if (this.hunger === 0) {
      this.starveTimer += dt;
      if (this.starveTimer >= 4) { this.starveTimer = 0; this.damage(1, 'starve'); }
    }
  };

  Player.prototype.exhaust = function (a) {
    if (this.mode !== 'survival') return;
    this.exhaustion += a;
  };

  Player.prototype.damage = function (amount, source) {
    if (this.mode === 'creative' && source !== 'void') return;
    if (this.hurtTime > 0.35 && source !== 'void') return;
    this.health -= amount;
    this.hurtTime = 0.5;
    this.lastDamageSource = source;
    if (this.health <= 0) { this.health = 0; this.dead = true; }
  };

  Player.prototype.heal = function (n) {
    this.health = Math.min(this.maxHealth, this.health + n);
  };

  Player.prototype.eat = function (food) {
    this.hunger = Math.min(20, this.hunger + food.hunger);
    this.saturation = Math.min(this.hunger, this.saturation + food.saturation);
  };

  Player.prototype.addXP = function (n) {
    this.xp += n;
    while (this.xp >= this.xpToNext()) { this.xp -= this.xpToNext(); this.level++; }
  };
  Player.prototype.xpToNext = function () {
    const l = this.level;
    if (l < 16) return 2 * l + 7;
    if (l < 31) return 5 * l - 38;
    return 9 * l - 158;
  };

  Player.prototype.respawn = function (world) {
    this.dead = false;
    this.health = this.maxHealth;
    this.hunger = 20; this.saturation = 5; this.exhaustion = 0;
    this.air = this.maxAir;
    this.vx = this.vy = this.vz = 0;
    const p = this.respawnPoint;
    this.x = p.x + 0.5; this.z = p.z + 0.5;
    const top = world.topSolid(Math.floor(this.x), Math.floor(this.z));
    this.y = top >= 0 ? top + 1 : p.y;
    this.fallStart = null;
    this.hurtTime = 0;
  };

  Player.prototype.setMode = function (m) {
    this.mode = m;
    if (m === 'creative') { this.health = 20; this.hunger = 20; }
    else this.flying = false;
  };

  Player.prototype.toggleFly = function () {
    if (this.mode !== 'creative') return;
    this.flying = !this.flying;
    if (this.flying) this.vy = 0;
  };

  Player.prototype.swing = function () {
    this.swinging = true;
    this.swingTime = 0;
  };

  MC.Player = Player;
})();
