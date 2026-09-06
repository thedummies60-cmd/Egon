/* ============================================================
 * physics.js - AABB collision against the voxel grid, plus the
 * DDA voxel raycast used for block targeting.
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});
  const CY = MC.CHUNK.Y;

  const PH = {};
  MC.physics = PH;

  /* Is any solid block overlapping this box? */
  function boxBlocked(world, minX, minY, minZ, maxX, maxY, maxZ) {
    const T = MC.blocks.T;
    const x0 = Math.floor(minX), x1 = Math.floor(maxX - 1e-7);
    const y0 = Math.floor(minY), y1 = Math.floor(maxY - 1e-7);
    const z0 = Math.floor(minZ), z1 = Math.floor(maxZ - 1e-7);
    for (let y = y0; y <= y1; y++) {
      if (y < 0) return true;
      if (y >= CY) continue;
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          if (T.solid[world.getBlock(x, y, z)]) return true;
        }
      }
    }
    return false;
  }
  PH.boxBlocked = boxBlocked;

  /* Move an axis-aligned box through the world, one axis at a time.
   * body: { x, y, z, w (half width), h (height), vx, vy, vz, onGround } */
  PH.move = function (world, body, dx, dy, dz) {
    const w = body.w, h = body.h;
    body.onGround = false;
    body.hitWallX = false; body.hitWallZ = false;

    // Y first so landing resolves before the horizontal slide
    if (dy !== 0) {
      const ny = body.y + dy;
      if (boxBlocked(world, body.x - w, ny, body.z - w, body.x + w, ny + h, body.z + w)) {
        if (dy < 0) {
          // settle on top of the first free row
          let gy = Math.floor(ny);
          while (gy < CY && boxBlocked(world, body.x - w, gy, body.z - w, body.x + w, gy + h, body.z + w)) gy++;
          body.y = gy;
          body.onGround = true;
        } else {
          // stop just below the ceiling the head ran into
          body.y = Math.floor(ny + h) - h - 1e-4;
        }
        body.vy = 0;
      } else {
        body.y = ny;
      }
    }

    if (dx !== 0) {
      const nx = body.x + dx;
      if (boxBlocked(world, nx - w, body.y + 0.02, body.z - w, nx + w, body.y + h, body.z + w)) {
        body.vx = 0; body.hitWallX = true;
      } else body.x = nx;
    }
    if (dz !== 0) {
      const nz = body.z + dz;
      if (boxBlocked(world, body.x - w, body.y + 0.02, nz - w, body.x + w, body.y + h, nz + w)) {
        body.vz = 0; body.hitWallZ = true;
      } else body.z = nz;
    }

    if (!body.onGround && dy <= 0) {
      body.onGround = boxBlocked(world, body.x - w, body.y - 0.02, body.z - w,
                                 body.x + w, body.y, body.z + w);
    }
  };

  PH.isBlockedAt = function (world, x, y, z, w, h) {
    const T = MC.blocks.T;
    const x0 = Math.floor(x - w), x1 = Math.floor(x + w - 1e-7);
    const y0 = Math.floor(y), y1 = Math.floor(y + h - 1e-7);
    const z0 = Math.floor(z - w), z1 = Math.floor(z + w - 1e-7);
    for (let yy = y0; yy <= y1; yy++)
      for (let zz = z0; zz <= z1; zz++)
        for (let xx = x0; xx <= x1; xx++)
          if (T.solid[world.getBlock(xx, yy, zz)]) return true;
    return false;
  };

  /* Which fluid is the box sitting in? */
  PH.fluidAt = function (world, x, y, z, w, h) {
    const water = MC.blocks.idOf('water'), lava = MC.blocks.idOf('lava');
    const x0 = Math.floor(x - w), x1 = Math.floor(x + w - 1e-7);
    const y0 = Math.floor(y), y1 = Math.floor(y + h - 1e-7);
    const z0 = Math.floor(z - w), z1 = Math.floor(z + w - 1e-7);
    let inWater = false, inLava = false;
    for (let yy = y0; yy <= y1; yy++)
      for (let zz = z0; zz <= z1; zz++)
        for (let xx = x0; xx <= x1; xx++) {
          const id = world.getBlock(xx, yy, zz);
          if (id === water) inWater = true;
          else if (id === lava) inLava = true;
        }
    return { water: inWater, lava: inLava };
  };

  /* ---------------- voxel raycast (Amanatides & Woo) ---------------- */
  PH.raycast = function (world, ox, oy, oz, dx, dy, dz, maxDist, opts) {
    opts = opts || {};
    const T = MC.blocks.T;
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tDeltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
    const tDeltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
    const tDeltaZ = dz === 0 ? Infinity : Math.abs(1 / dz);
    let tMaxX = dx === 0 ? Infinity : ((dx > 0 ? x + 1 - ox : ox - x) * tDeltaX);
    let tMaxY = dy === 0 ? Infinity : ((dy > 0 ? y + 1 - oy : oy - y) * tDeltaY);
    let tMaxZ = dz === 0 ? Infinity : ((dz > 0 ? z + 1 - oz : oz - z) * tDeltaZ);
    let face = -1;
    let t = 0;

    for (let i = 0; i < 512; i++) {
      const id = world.getBlock(x, y, z);
      if (id !== 0) {
        const hit = opts.fluids ? true : (T.render[id] !== 3);
        const solid = opts.plants ? true : (T.render[id] !== 2);
        if (hit && (solid || opts.plants)) {
          if (!(T.render[id] === 3 && !opts.fluids) && !(T.render[id] === 2 && !opts.plants)) {
            return {
              x: x, y: y, z: z, id: id, face: face, dist: t,
              nx: face === 0 ? -stepX : 0,
              ny: face === 1 ? -stepY : 0,
              nz: face === 2 ? -stepZ : 0
            };
          }
        }
      }
      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; face = 0; }
        else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = 2; }
      } else {
        if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; face = 1; }
        else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = 2; }
      }
      if (t > maxDist) break;
      if (y < 0 || y >= CY) break;
    }
    return null;
  };
})();
