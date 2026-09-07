/* ============================================================
 * renderer.js - all GPU work: sky, terrain, entities, particles,
 * water, block outline and the first-person hand.
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});
  const M = MC.math, mat4 = M.mat4, vec3 = M.vec3;
  const glu = MC.glu;
  const STRIDE = MC.MESH.STRIDE;
  const MAX_QUADS = MC.MESH.MAX_QUADS_PER_SEG;

  const TERRAIN_ATTRS = [
    { name: 'aPos', size: 3, type: 0x1403 /*UNSIGNED_SHORT*/, norm: false, offset: 0 },
    { name: 'aUV', size: 2, type: 0x1403, norm: true, offset: 6 },
    { name: 'aLight', size: 4, type: 0x1401 /*UNSIGNED_BYTE*/, norm: true, offset: 10 },
    { name: 'aTint', size: 4, type: 0x1401, norm: true, offset: 14 }
  ];
  const ENTITY_STRIDE = 24;
  const ENTITY_ATTRS = [
    { name: 'aPos', size: 3, type: 0x1406 /*FLOAT*/, norm: false, offset: 0 },
    { name: 'aUV', size: 2, type: 0x1406, norm: false, offset: 12 },
    { name: 'aColor', size: 4, type: 0x1401, norm: true, offset: 20 }
  ];

  /* ============================================================
   * dynamic geometry batch for entities / particles / hand
   * ============================================================ */
  function Batch(quads) {
    this.cap = quads;
    this.buf = new ArrayBuffer(quads * 4 * ENTITY_STRIDE);
    this.f32 = new Float32Array(this.buf);
    this.u8 = new Uint8Array(this.buf);
    this.quads = 0;
  }
  Batch.prototype.reset = function () { this.quads = 0; };
  Batch.prototype.ensure = function (n) {
    if (this.quads + n <= this.cap) return;
    let cap = this.cap;
    while (cap < this.quads + n) cap *= 2;
    const nb = new ArrayBuffer(cap * 4 * ENTITY_STRIDE);
    new Uint8Array(nb).set(this.u8.subarray(0, this.quads * 4 * ENTITY_STRIDE));
    this.buf = nb; this.f32 = new Float32Array(nb); this.u8 = new Uint8Array(nb);
    this.cap = cap;
  };
  // p: 12 floats (4 corners), uv: [u0,v0,u1,v1], col: [r,g,b,a] 0-255
  Batch.prototype.quad = function (p, uv, col) {
    this.ensure(1);
    const base = this.quads * 4 * ENTITY_STRIDE;
    const f = this.f32, u8 = this.u8;
    const CA = [0, 1, 1, 0], CB = [0, 0, 1, 1];
    for (let k = 0; k < 4; k++) {
      const o = base + k * ENTITY_STRIDE, fo = o >> 2;
      f[fo] = p[k * 3]; f[fo + 1] = p[k * 3 + 1]; f[fo + 2] = p[k * 3 + 2];
      f[fo + 3] = uv[0] + (uv[2] - uv[0]) * CA[k];
      f[fo + 4] = uv[1] + (uv[3] - uv[1]) * (1 - CB[k]);
      u8[o + 20] = col[0]; u8[o + 21] = col[1]; u8[o + 22] = col[2]; u8[o + 23] = col[3];
    }
    this.quads++;
  };
  MC.Batch = Batch;

  /* corner order per face, matching the mesher's basis */
  const BOX_FACES = [
    { key: 'xp', n: [1, 0, 0], t: [0, 0, -1], b: [0, 1, 0], o: [1, 0, 1] },
    { key: 'xn', n: [-1, 0, 0], t: [0, 0, 1], b: [0, 1, 0], o: [0, 0, 0] },
    { key: 'yp', n: [0, 1, 0], t: [1, 0, 0], b: [0, 0, -1], o: [0, 1, 1] },
    { key: 'yn', n: [0, -1, 0], t: [1, 0, 0], b: [0, 0, 1], o: [0, 0, 0] },
    { key: 'zp', n: [0, 0, 1], t: [1, 0, 0], b: [0, 1, 0], o: [0, 0, 1] },
    { key: 'zn', n: [0, 0, -1], t: [-1, 0, 0], b: [0, 1, 0], o: [1, 0, 0] }
  ];
  MC.BOX_FACES = BOX_FACES;

  const _p = new Float32Array(12);
  const _v = new Float32Array(3);
  // Emit a transformed axis-aligned box. `m` maps local box space to world.
  // size is in local units, box is centred on the local origin.
  Batch.prototype.box = function (m, sx, sy, sz, uvSet, col, faceShade) {
    for (let f = 0; f < 6; f++) {
      const F = BOX_FACES[f];
      const uv = uvSet[F.key];
      if (!uv) continue;
      const CA = [0, 1, 1, 0], CB = [0, 0, 1, 1];
      for (let k = 0; k < 4; k++) {
        const lx = (F.o[0] + F.t[0] * CA[k] + F.b[0] * CB[k] - 0.5) * sx;
        const ly = (F.o[1] + F.t[1] * CA[k] + F.b[1] * CB[k] - 0.5) * sy;
        const lz = (F.o[2] + F.t[2] * CA[k] + F.b[2] * CB[k] - 0.5) * sz;
        _p[k * 3] = m[0] * lx + m[4] * ly + m[8] * lz + m[12];
        _p[k * 3 + 1] = m[1] * lx + m[5] * ly + m[9] * lz + m[13];
        _p[k * 3 + 2] = m[2] * lx + m[6] * ly + m[10] * lz + m[14];
      }
      let c = col;
      if (faceShade) {
        const s = [0.86, 0.86, 1.0, 0.62, 0.74, 0.74][f];
        c = [col[0] * s, col[1] * s, col[2] * s, col[3]];
      }
      this.quad(_p, uv, c);
    }
  };

  /* ============================================================
   * Renderer
   * ============================================================ */
  function Renderer(canvas) {
    this.canvas = canvas;
    this.gl = null;
    this.chunkMeshes = new Map();
    this.stats = { chunks: 0, quads: 0, entities: 0, draws: 0 };
  }

  Renderer.prototype.init = function () {
    const gl = this.gl = glu.getContext(this.canvas);
    if (!gl) return false;
    const S = MC.shaders;
    this.pTerrain = glu.program(gl, S.TERRAIN_VS, S.TERRAIN_FS, 'terrain');
    this.pEntity = glu.program(gl, S.ENTITY_VS, S.ENTITY_FS, 'entity');
    this.pSky = glu.program(gl, S.SKY_VS, S.SKY_FS, 'sky');
    this.pLine = glu.program(gl, S.LINE_VS, S.LINE_FS, 'line');

    this.texBlocks = glu.texture(gl, MC.atlas.pixels, MC.atlas.size, { mipmap: true });
    this.texItems = glu.texture(gl, MC.atlas.itemPixels, MC.atlas.itemSize, {});
    this.texMobs = glu.texture(gl, MC.mobArt.pixels, MC.mobArt.size, {});

    // one shared index buffer drives every quad mesh in the game
    const idxCount = MAX_QUADS * 6;
    const idx = new Uint16Array(idxCount);
    for (let q = 0; q < MAX_QUADS; q++) {
      const v = q * 4, i = q * 6;
      idx[i] = v; idx[i + 1] = v + 1; idx[i + 2] = v + 2;
      idx[i + 3] = v; idx[i + 4] = v + 2; idx[i + 5] = v + 3;
    }
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

    // fullscreen triangle-pair for the sky
    this.skyVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    this.dynVBO = gl.createBuffer();
    this.lineVBO = gl.createBuffer();

    this.batch = new Batch(4096);
    this.batchBlocks = new Batch(2048);

    this.proj = mat4.create();
    this.view = mat4.create();
    this.vp = mat4.create();
    this.invVP = mat4.create();
    this.camToWorld = mat4.create();
    this.tmpM = mat4.create();
    this.tmpM2 = mat4.create();
    this.planes = new Float32Array(24);
    this.sunDir = vec3.create(0, 1, 0);
    this.fogColor = new Float32Array([0.7, 0.8, 0.95]);
    this.skyTop = new Float32Array([0.35, 0.55, 0.92]);
    this.skyHorizon = new Float32Array([0.66, 0.79, 0.95]);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    gl.clearColor(0.7, 0.8, 0.95, 1);
    return true;
  };

  Renderer.prototype.resize = function (w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
  };

  /* ---------------- chunk mesh upload ---------------- */

  Renderer.prototype.uploadChunk = function (chunk, mesh) {
    const gl = this.gl;
    let entry = this.chunkMeshes.get(chunk.key);
    if (!entry) { entry = { segs: [], water: [] }; this.chunkMeshes.set(chunk.key, entry); }
    this.uploadSegments(entry, 'segs', mesh.solid, mesh.solidQuads);
    this.uploadSegments(entry, 'water', mesh.water, mesh.waterQuads);
    entry.cx = chunk.cx; entry.cz = chunk.cz;
    entry.minY = 0; entry.maxY = chunk.maxY + 1;
    chunk.mesh = entry;
    return entry;
  };

  Renderer.prototype.uploadSegments = function (entry, field, data, quads) {
    const gl = this.gl;
    const segs = entry[field];
    const need = Math.ceil(quads / MAX_QUADS);
    while (segs.length > need) { gl.deleteBuffer(segs.pop().vbo); }
    for (let i = 0; i < need; i++) {
      const first = i * MAX_QUADS;
      const count = Math.min(MAX_QUADS, quads - first);
      const bytes = data.subarray(first * 4 * STRIDE, (first + count) * 4 * STRIDE);
      let seg = segs[i];
      if (!seg) { seg = { vbo: gl.createBuffer(), quads: 0 }; segs.push(seg); }
      gl.bindBuffer(gl.ARRAY_BUFFER, seg.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, bytes, gl.STATIC_DRAW);
      seg.quads = count;
    }
  };

  Renderer.prototype.freeChunk = function (key) {
    const gl = this.gl;
    const entry = this.chunkMeshes.get(key);
    if (!entry) return;
    for (let i = 0; i < entry.segs.length; i++) gl.deleteBuffer(entry.segs[i].vbo);
    for (let i = 0; i < entry.water.length; i++) gl.deleteBuffer(entry.water[i].vbo);
    this.chunkMeshes.delete(key);
  };

  /* ---------------- camera & sky colour ---------------- */

  Renderer.prototype.setupCamera = function (cam, aspect, fov, far) {
    mat4.perspective(this.proj, fov, aspect, 0.05, far);
    mat4.identity(this.view);
    // forward is (-sin yaw, -sin pitch, -cos yaw): see Player.lookVector
    mat4.rotateX(this.view, this.view, cam.pitch);
    mat4.rotateY(this.view, this.view, -cam.yaw);
    mat4.translate(this.view, this.view, -cam.x, -cam.y, -cam.z);
    mat4.multiply(this.vp, this.proj, this.view);
    mat4.invert(this.invVP, this.vp);
    M.extractFrustum(this.planes, this.vp);

    // camera-to-world, used to place the first-person hand
    mat4.identity(this.camToWorld);
    mat4.translate(this.camToWorld, this.camToWorld, cam.x, cam.y, cam.z);
    mat4.rotateY(this.camToWorld, this.camToWorld, cam.yaw);
    mat4.rotateX(this.camToWorld, this.camToWorld, -cam.pitch);
    this.cam = cam;
  };

  const DAY_TOP = [0.32, 0.53, 0.94], NIGHT_TOP = [0.014, 0.02, 0.062];
  const DAY_HOR = [0.68, 0.81, 0.97], NIGHT_HOR = [0.045, 0.055, 0.115];
  const SUNSET = [0.98, 0.52, 0.24];

  Renderer.prototype.updateSky = function (world, weather) {
    const s = world.sunAmount();
    const lin = Math.pow(s, 0.55);
    const glow = M.clamp(1 - Math.abs(s - 0.26) / 0.3, 0, 1);
    const rain = weather ? weather.rain : 0;
    for (let i = 0; i < 3; i++) {
      let top = NIGHT_TOP[i] + (DAY_TOP[i] - NIGHT_TOP[i]) * lin;
      let hor = NIGHT_HOR[i] + (DAY_HOR[i] - NIGHT_HOR[i]) * lin;
      hor = hor + (SUNSET[i] - hor) * glow * 0.75;
      top = top + (SUNSET[i] - top) * glow * 0.22;
      if (rain > 0) {
        const grey = [0.42, 0.45, 0.5][i] * (0.25 + lin * 0.75);
        top += (grey - top) * rain; hor += (grey - hor) * rain;
      }
      this.skyTop[i] = top;
      this.skyHorizon[i] = hor;
      this.fogColor[i] = hor * 0.92 + top * 0.08;
    }
    world.sunDir(this.sunDir);
  };

  /* ---------------- passes ---------------- */

  Renderer.prototype.drawSky = function (world, time) {
    const gl = this.gl, p = this.pSky.use();
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyVBO);
    glu.enableOnly(gl, [p.a.aPos]);
    gl.vertexAttribPointer(p.a.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(p.u.uInvVP, false, this.invVP);
    gl.uniform3f(p.u.uCam, this.cam.x, this.cam.y, this.cam.z);
    gl.uniform3fv(p.u.uSkyTop, this.skyTop);
    gl.uniform3fv(p.u.uSkyHorizon, this.skyHorizon);
    gl.uniform3fv(p.u.uFogColor, this.fogColor);
    gl.uniform3fv(p.u.uSunDir, this.sunDir);
    gl.uniform1f(p.u.uDayLight, world.dayLight());
    gl.uniform1f(p.u.uTime, time);
    gl.uniform1f(p.u.uCloudCover, this.cloudCover === undefined ? 0.35 : this.cloudCover);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    this.stats.draws++;
  };

  Renderer.prototype.beginTerrain = function (world, time, fogStart, fogEnd) {
    const gl = this.gl, p = this.pTerrain.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texBlocks);
    gl.uniform1i(p.u.uAtlas, 0);
    gl.uniformMatrix4fv(p.u.uVP, false, this.vp);
    gl.uniform3f(p.u.uCam, this.cam.x, this.cam.y, this.cam.z);
    gl.uniform3fv(p.u.uFogColor, this.fogColor);
    gl.uniform1f(p.u.uFogStart, fogStart);
    gl.uniform1f(p.u.uFogEnd, fogEnd);
    gl.uniform1f(p.u.uDayLight, world.dayLight());
    gl.uniform1f(p.u.uTime, time);
    gl.uniform3fv(p.u.uSunDir, this.sunDir);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    return p;
  };

  Renderer.prototype.drawChunks = function (world, water, renderDist) {
    const gl = this.gl, p = this.pTerrain;
    const cam = this.cam;
    gl.uniform1f(p.u.uAlphaTest, water ? 0.05 : 0.5);
    gl.uniform1f(p.u.uOpacity, water ? 0.76 : 1.0);
    const CY = MC.CHUNK.Y;
    const list = this._visible || (this._visible = []);
    list.length = 0;
    const self = this;
    this.chunkMeshes.forEach(function (entry) {
      const segs = water ? entry.water : entry.segs;
      if (!segs.length) return;
      const x0 = entry.cx * 16, z0 = entry.cz * 16;
      if (!M.aabbInFrustum(self.planes, x0, 0, z0, x0 + 16, entry.maxY + 2, z0 + 16)) return;
      const dx = x0 + 8 - cam.x, dz = z0 + 8 - cam.z;
      entry._d = dx * dx + dz * dz;
      list.push(entry);
    });
    // near-to-far for solids (early-z), far-to-near for translucent water
    list.sort(water ? function (a, b) { return b._d - a._d; } : function (a, b) { return a._d - b._d; });

    for (let i = 0; i < list.length; i++) {
      const entry = list[i];
      const segs = water ? entry.water : entry.segs;
      gl.uniform3f(p.u.uChunkOrigin, entry.cx * 16, 0, entry.cz * 16);
      for (let s = 0; s < segs.length; s++) {
        const seg = segs[s];
        if (!seg.quads) continue;
        gl.bindBuffer(gl.ARRAY_BUFFER, seg.vbo);
        glu.bindAttribs(gl, p, TERRAIN_ATTRS, STRIDE);
        gl.drawElements(gl.TRIANGLES, seg.quads * 6, gl.UNSIGNED_SHORT, 0);
        this.stats.draws++;
        this.stats.quads += seg.quads;
      }
      if (!water) this.stats.chunks++;
    }
  };

  /* ---------------- dynamic batches ---------------- */

  Renderer.prototype.flushBatch = function (batch, tex, opts) {
    if (!batch.quads) return;
    opts = opts || {};
    const gl = this.gl, p = this.pEntity.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(p.u.uTex, 0);
    gl.uniformMatrix4fv(p.u.uVP, false, opts.vp || this.vp);
    gl.uniform3f(p.u.uCam, this.cam.x, this.cam.y, this.cam.z);
    gl.uniform3fv(p.u.uFogColor, this.fogColor);
    gl.uniform1f(p.u.uFogStart, opts.fogStart === undefined ? this.fogStart : opts.fogStart);
    gl.uniform1f(p.u.uFogEnd, opts.fogEnd === undefined ? this.fogEnd : opts.fogEnd);
    gl.uniform1f(p.u.uAlphaTest, opts.alphaTest === undefined ? 0.5 : opts.alphaTest);
    gl.uniform1f(p.u.uFogAmount, opts.fogAmount === undefined ? 1 : opts.fogAmount);
    const ov = opts.overlay || [0, 0, 0, 0];
    gl.uniform4f(p.u.uOverlay, ov[0], ov[1], ov[2], ov[3]);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.dynVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(batch.buf, 0, batch.quads * 4 * ENTITY_STRIDE), gl.DYNAMIC_DRAW);
    glu.bindAttribs(gl, p, ENTITY_ATTRS, ENTITY_STRIDE);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);

    let drawn = 0;
    while (drawn < batch.quads) {
      const n = Math.min(MAX_QUADS, batch.quads - drawn);
      if (drawn > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.dynVBO);
        glu.bindAttribs(gl, p, ENTITY_ATTRS, ENTITY_STRIDE, drawn * 4 * ENTITY_STRIDE);
      }
      gl.drawElements(gl.TRIANGLES, n * 6, gl.UNSIGNED_SHORT, 0);
      drawn += n;
      this.stats.draws++;
    }
  };

  /* ---------------- block selection outline ---------------- */

  Renderer.prototype.drawOutline = function (bx, by, bz, shape) {
    const gl = this.gl, p = this.pLine.use();
    const e = 0.0025;
    const x0 = bx - e, y0 = by - e, z0 = bz - e;
    const x1 = bx + (shape ? shape[0] : 1) + e;
    const y1 = by + (shape ? shape[1] : 1) + e;
    const z1 = bz + (shape ? shape[2] : 1) + e;
    const v = [
      x0, y0, z0, x1, y0, z0, x1, y0, z0, x1, y0, z1, x1, y0, z1, x0, y0, z1, x0, y0, z1, x0, y0, z0,
      x0, y1, z0, x1, y1, z0, x1, y1, z0, x1, y1, z1, x1, y1, z1, x0, y1, z1, x0, y1, z1, x0, y1, z0,
      x0, y0, z0, x0, y1, z0, x1, y0, z0, x1, y1, z0, x1, y0, z1, x1, y1, z1, x0, y0, z1, x0, y1, z1
    ];
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.DYNAMIC_DRAW);
    glu.enableOnly(gl, [p.a.aPos]);
    gl.vertexAttribPointer(p.a.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(p.u.uVP, false, this.vp);
    gl.uniform4f(p.u.uColor, 0, 0, 0, 0.45);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.LINES, 0, v.length / 3);
    this.stats.draws++;
  };

  Renderer.prototype.beginFrame = function () {
    const gl = this.gl;
    this.stats.chunks = 0; this.stats.quads = 0; this.stats.draws = 0; this.stats.entities = 0;
    gl.clearColor(this.fogColor[0], this.fogColor[1], this.fogColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  };

  MC.Renderer = Renderer;
})();
