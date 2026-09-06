/* ============================================================
 * gamerender.js - the per-frame draw order for Game.
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});
  const M = MC.math, mat4 = M.mat4, vec3 = M.vec3;
  const B = MC.blocks;
  const G = MC.Game.prototype;

  const _m = mat4.create(), _t = mat4.create();
  const _right = vec3.create(), _up = vec3.create(), _fwd = vec3.create();
  const WHITE = [255, 255, 255, 255];

  // biome tint for blocks rendered outside the chunk mesh (hand, drops, icons)
  function blockTint(game, block, out) {
    out = out || [255, 255, 255, 255];
    if (!block.tint) { out[0] = out[1] = out[2] = 255; out[3] = 255; return out; }
    const bio = game.world.biomeAt(Math.floor(game.player.x), Math.floor(game.player.z));
    const col = block.tint === MC.TINT.GRASS ? bio.grass
      : block.tint === MC.TINT.FOLIAGE ? bio.foliage : bio.water;
    out[0] = (col >> 16) & 255; out[1] = (col >> 8) & 255; out[2] = col & 255; out[3] = 255;
    return out;
  }

  function cubeUV(block) {
    const A = MC.atlas;
    const top = A.uv[A.faceTex(block, 'top')] || A.uv.white;
    const bottom = A.uv[A.faceTex(block, 'bottom')] || A.uv.white;
    const side = A.uv[A.faceTex(block, 'side')] || A.uv.white;
    return { xp: side, xn: side, yp: top, yn: bottom, zp: side, zn: side };
  }

  G.render = function (dt) {
    const r = this.renderer, gl = r.gl, world = this.world, p = this.player;
    const w = this.canvas.width, h = this.canvas.height;

    r.updateSky(world, this.weather);

    /* --- camera --- */
    let camX = p.x, camY = p.eyeY(), camZ = p.z;
    let bobX = 0, bobY = 0;
    if (this.settings.viewBob && this.perspective === 0) {
      bobX = Math.cos(p.bob * 2) * 0.045 * p.bobAmount;
      bobY = Math.abs(Math.sin(p.bob * 2)) * 0.055 * p.bobAmount;
      camY += bobY - 0.03;
    }
    const cam = { x: camX, y: camY, z: camZ, yaw: p.yaw, pitch: p.pitch };

    if (this.perspective !== 0) {
      const back = this.perspective === 1 ? 4.2 : -4.2;
      const d = vec3.create(); p.lookVector(d);
      let dist = back;
      const hit = MC.physics.raycast(world, camX, camY, camZ, -d[0] * Math.sign(back), -d[1] * Math.sign(back), -d[2] * Math.sign(back), Math.abs(back));
      if (hit) dist = Math.sign(back) * Math.max(0.6, hit.dist - 0.4);
      cam.x -= d[0] * dist; cam.y -= d[1] * dist; cam.z -= d[2] * dist;
      if (this.perspective === 2) { cam.yaw = p.yaw + Math.PI; cam.pitch = -p.pitch; }
    }

    const R = this.settings.renderDistance;
    let fogEnd = R * 16 - 10;
    let fogStart = fogEnd * 0.55;
    let fov = this.settings.fov * M.DEG;
    if (p.sprinting) fov *= 1.075;
    const far = Math.max(180, fogEnd + 220);

    const under = p.headUnderwater;
    if (under) {
      const wc = world.biomeAt(Math.floor(p.x), Math.floor(p.z)).water;
      r.fogColor[0] = ((wc >> 16) & 255) / 255 * 0.5;
      r.fogColor[1] = ((wc >> 8) & 255) / 255 * 0.6;
      r.fogColor[2] = (wc & 255) / 255 * 0.8;
      fogStart = 0.2; fogEnd = 22;
    } else if (p.headInLava) {
      r.fogColor[0] = 0.6; r.fogColor[1] = 0.16; r.fogColor[2] = 0.03;
      fogStart = 0.1; fogEnd = 2.2;
    }
    r.fogStart = fogStart; r.fogEnd = fogEnd;
    r.cloudCover = 0.3 + this.weather.rain * 0.55;

    r.setupCamera(cam, w / h, fov, far);

    // camera basis, used to billboard particles
    const c2w = r.camToWorld;
    vec3.set(_right, c2w[0], c2w[1], c2w[2]);
    vec3.set(_up, c2w[4], c2w[5], c2w[6]);
    vec3.set(_fwd, -c2w[8], -c2w[9], -c2w[10]);

    /* ---------- draw ---------- */
    r.beginFrame();
    if (!under && !p.headInLava) r.drawSky(world, this.time);

    r.beginTerrain(world, this.time, fogStart, fogEnd);
    gl.disable(gl.BLEND);
    r.drawChunks(world, false, R);

    /* --- entities --- */
    const batch = r.batch;
    batch.reset();
    let mobCount = 0;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!(e instanceof MC.Mob)) continue;
      const dx = e.x - cam.x, dz = e.z - cam.z;
      if (dx * dx + dz * dz > (fogEnd + 12) * (fogEnd + 12)) continue;
      if (!M.aabbInFrustum(r.planes, e.x - 1.5, e.y - 0.5, e.z - 1.5, e.x + 1.5, e.y + e.h + 1, e.z + 1.5)) continue;
      e.render(batch, dt, cam.y);
      mobCount++;
    }
    if (this.perspective !== 0 && !p.dead) this.renderPlayerModel(batch, p);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    r.flushBatch(batch, r.texMobs, { alphaTest: 0.5 });
    r.stats.entities = mobCount;

    /* --- dropped items, orbs, arrows --- */
    const bb = r.batchBlocks;
    bb.reset();
    batch.reset();
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (e instanceof MC.ItemEntity) this.renderDroppedItem(e, bb, batch);
      else if (e instanceof MC.XPOrb) this.renderOrb(e, bb);
      else if (e instanceof MC.Arrow) this.renderArrow(e, batch);
    }
    if (bb.quads) r.flushBatch(bb, r.texBlocks, { alphaTest: 0.5 });
    if (batch.quads) r.flushBatch(batch, r.texItems, { alphaTest: 0.5 });

    /* --- particles --- */
    bb.reset();
    this.particles.render(bb, _right, _up);
    if (bb.quads) r.flushBatch(bb, r.texBlocks, { alphaTest: 0.05 });

    /* --- block break overlay --- */
    if (p.breaking && p.breaking.total > 0) {
      const prog = M.clamp(p.breaking.t / p.breaking.total, 0, 0.999);
      const stage = Math.floor(prog * 10);
      bb.reset();
      const uv = MC.atlas.uv['destroy_' + stage];
      if (uv) {
        const set = { xp: uv, xn: uv, yp: uv, yn: uv, zp: uv, zn: uv };
        mat4.identity(_m);
        mat4.translate(_m, _m, p.breaking.x + 0.5, p.breaking.y + 0.5, p.breaking.z + 0.5);
        bb.box(_m, 1.008, 1.008, 1.008, set, [255, 255, 255, 255], false);
        gl.depthMask(false);
        r.flushBatch(bb, r.texBlocks, { alphaTest: 0.02, fogAmount: 0 });
        gl.depthMask(true);
      }
    }

    /* --- selection outline --- */
    if (this.target && !p.dead && this.perspective === 0) {
      r.drawOutline(this.target.x, this.target.y, this.target.z, null);
    }

    /* --- water last, blended --- */
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    r.beginTerrain(world, this.time, fogStart, fogEnd);
    r.drawChunks(world, true, R);
    gl.depthMask(true);

    /* --- first person hand --- */
    if (this.perspective === 0 && !p.dead) {
      gl.clear(gl.DEPTH_BUFFER_BIT);
      this.renderHand(bobX, bobY);
    }
    gl.disable(gl.BLEND);
  };

  /* ---------------- dropped items ---------------- */
  G.renderDroppedItem = function (e, blockBatch, itemBatch) {
    const t = MC.thing(e.name);
    if (!t) return;
    const bob = Math.sin(e.age * 2.4) * 0.06;
    if (t.isBlock && t.block.render !== 'cross') {
      mat4.identity(_m);
      mat4.translate(_m, _m, e.x, e.y + 0.16 + bob, e.z);
      mat4.rotateY(_m, _m, e.spin);
      blockBatch.box(_m, 0.26, 0.26, 0.26, cubeUV(t.block), blockTint(this, t.block, _tintCol), true);
    } else {
      const uv = t.isBlock
        ? (MC.atlas.uv[MC.atlas.faceTex(t.block, 'side')] || MC.atlas.uv.white)
        : (MC.atlas.itemUV[t.item.tex] || MC.atlas.itemUV.stick);
      const target = t.isBlock ? blockBatch : itemBatch;
      const s = 0.22;
      const x = e.x, y = e.y + 0.22 + bob, z = e.z;
      const rx = _right[0] * s, ry = _right[1] * s, rz = _right[2] * s;
      const ux = _up[0] * s, uy = _up[1] * s, uz = _up[2] * s;
      target.quad([
        x - rx - ux, y - ry - uy, z - rz - uz,
        x + rx - ux, y + ry - uy, z + rz - uz,
        x + rx + ux, y + ry + uy, z + rz + uz,
        x - rx + ux, y - ry + uy, z - rz + uz
      ], uv, WHITE);
    }
  };

  G.renderOrb = function (e, batch) {
    const uv = MC.atlas.uv.white;
    const s = 0.09 + Math.sin(e.age * 6) * 0.012;
    const x = e.x, y = e.y + 0.15, z = e.z;
    const rx = _right[0] * s, ry = _right[1] * s, rz = _right[2] * s;
    const ux = _up[0] * s, uy = _up[1] * s, uz = _up[2] * s;
    const g = 200 + Math.sin(e.age * 8) * 55;
    batch.quad([
      x - rx - ux, y - ry - uy, z - rz - uz,
      x + rx - ux, y + ry - uy, z + rz - uz,
      x + rx + ux, y + ry + uy, z + rz + uz,
      x - rx + ux, y - ry + uy, z - rz + uz
    ], uv, [140, g, 60, 255]);
  };

  G.renderArrow = function (e, batch) {
    const uv = MC.atlas.itemUV.arrow;
    if (!uv) return;
    const yaw = Math.atan2(-e.vx, -e.vz);
    const pitch = Math.atan2(e.vy, Math.hypot(e.vx, e.vz));
    mat4.identity(_m);
    mat4.translate(_m, _m, e.x, e.y, e.z);
    mat4.rotateY(_m, _m, yaw);
    mat4.rotateX(_m, _m, -pitch);
    const set = { zp: uv, zn: uv, xp: uv, xn: uv };
    batch.box(_m, 0.14, 0.14, 0.7, set, WHITE, false);
  };

  /* ---------------- third-person player ---------------- */
  G.renderPlayerModel = function (batch, p) {
    const art = MC.mobArt.MOBS.player;
    if (!art.parts) return;
    const speed = Math.hypot(p.vx, p.vz);
    const swing = Math.sin(p.bob * 2) * Math.min(1, speed / 4);
    mat4.identity(_m);
    mat4.translate(_m, _m, p.x, p.y, p.z);
    mat4.rotateY(_m, _m, p.yaw);
    mat4.scaleM(_m, _m, art.scale, art.scale, art.scale);
    for (let i = 0; i < art.parts.length; i++) {
      const entry = art.parts[i], part = entry.part;
      let rx = 0, ry = 0, rz = 0;
      const a = part.anim;
      if (a === 'head') rx = p.pitch;
      else if (a === 'legL' || a === 'armR') rx = swing;
      else if (a === 'legR' || a === 'armL') rx = -swing;
      if ((a === 'armR') && p.swinging) rx = -Math.sin(p.swingTime * Math.PI) * 1.9;
      mat4.identity(_t);
      mat4.translate(_t, _t, part.pivot[0], part.pivot[1], part.pivot[2]);
      if (rx) mat4.rotateX(_t, _t, rx);
      if (ry) mat4.rotateY(_t, _t, ry);
      if (rz) mat4.rotateZ(_t, _t, rz);
      mat4.translate(_t, _t, part.pos[0] - part.pivot[0], part.pos[1] - part.pivot[1], part.pos[2] - part.pivot[2]);
      const mm = mat4.create();
      mat4.multiply(mm, _m, _t);
      batch.box(mm, part.size[0], part.size[1], part.size[2], entry.uv, WHITE, true);
    }
  };

  /* ---------------- first person hand ---------------- */
  const _handProj = mat4.create();
  const _tintCol = [255, 255, 255, 255];

  G.renderHand = function (bobX, bobY) {
    const r = this.renderer, gl = r.gl, p = this.player;
    const stack = this.inventory.get(p.selected);
    const t = stack ? MC.thing(stack.name) : null;
    // The hand lives in view space with a fixed projection, so sprinting FOV
    // changes and render distance never alter how big it looks.
    const aspect = this.canvas.width / this.canvas.height;
    mat4.perspective(_handProj, 70 * M.DEG, aspect, 0.02, 8);
    const handOpts = { alphaTest: 0.5, fogAmount: 0, vp: _handProj };

    const sw = p.swinging ? p.swingTime : 1;
    const sq = Math.sqrt(Math.min(1, sw));
    const swingX = -Math.sin(sq * Math.PI) * 0.38;
    const swingY = Math.sin(sq * Math.PI * 2) * 0.18;
    const swingZ = -Math.sin(sw * Math.PI) * 0.28;
    const swingRot = Math.sin(sq * Math.PI) * 0.9;

    const batch = r.batchBlocks;
    batch.reset();

    const hand = mat4.create();
    mat4.identity(hand);

    if (t && t.isBlock && t.block.render !== 'cross') {
      mat4.translate(hand, hand, 0.44 + swingX * 0.55 + bobX, -0.42 + swingY * 0.6 - bobY, -0.86 + swingZ * 0.5);
      mat4.rotateY(hand, hand, -0.62);
      mat4.rotateX(hand, hand, 0.2 + swingRot * 0.5);
      mat4.rotateZ(hand, hand, 0.06);
      batch.box(hand, 0.34, 0.34, 0.34, cubeUV(t.block), blockTint(this, t.block, _tintCol), true);
      r.flushBatch(batch, r.texBlocks, handOpts);
      return;
    }

    // items (and cross-shaped blocks) render as a flat sprite
    const uv = t
      ? (t.isBlock ? (MC.atlas.uv[MC.atlas.faceTex(t.block, 'side')] || MC.atlas.uv.white)
                   : (MC.atlas.itemUV[t.item.tex] || MC.atlas.itemUV.stick))
      : null;
    const tex = t && t.isBlock ? r.texBlocks : r.texItems;

    if (uv) {
      mat4.translate(hand, hand, 0.42 + swingX * 0.55 + bobX, -0.38 + swingY * 0.6 - bobY, -0.82 + swingZ * 0.5);
      mat4.rotateY(hand, hand, -0.62);
      mat4.rotateZ(hand, hand, -0.32 - swingRot * 0.5);
      mat4.rotateX(hand, hand, swingRot * 0.4);
      mat4.copy(_m, hand);
      const s = 0.3;
      const P = new Float32Array(12);
      const corners = [[-s, -s], [s, -s], [s, s], [-s, s]];
      for (let k = 0; k < 4; k++) {
        const lx = corners[k][0], ly = corners[k][1];
        P[k * 3] = _m[0] * lx + _m[4] * ly + _m[12];
        P[k * 3 + 1] = _m[1] * lx + _m[5] * ly + _m[13];
        P[k * 3 + 2] = _m[2] * lx + _m[6] * ly + _m[14];
      }
      batch.quad(P, uv, t.isBlock ? blockTint(this, t.block, _tintCol) : WHITE);
      r.flushBatch(batch, tex, handOpts);
      return;
    }

    // empty hand: draw the player's arm
    const art = MC.mobArt.MOBS.player;
    if (!art.parts) return;
    const armEntry = art.parts.filter(function (e) { return e.part.name === 'armR'; })[0];
    if (!armEntry) return;
    mat4.translate(hand, hand, 0.44 + swingX * 0.6 + bobX, -0.52 + swingY * 0.6 - bobY, -0.72 + swingZ * 0.5);
    mat4.rotateY(hand, hand, -0.35);
    mat4.rotateZ(hand, hand, -0.26);
    mat4.rotateX(hand, hand, 0.5 + swingRot);
    mat4.scaleM(hand, hand, 1 / 26, 1 / 26, 1 / 26);
    const sz = armEntry.part.size;
    mat4.translate(hand, hand, 0, -sz[1] / 2, 0);
    batch.box(hand, sz[0], sz[1], sz[2], armEntry.uv, WHITE, true);
    r.flushBatch(batch, r.texMobs, handOpts);
  };
})();
