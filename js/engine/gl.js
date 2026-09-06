/* ============================================================
 * gl.js - thin WebGL wrapper: programs, textures, buffers.
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});

  const G = {};
  MC.glu = G;

  G.getContext = function (canvas) {
    const opts = {
      alpha: false, antialias: false, depth: true, stencil: false,
      powerPreference: 'high-performance', preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false
    };
    let gl = canvas.getContext('webgl2', opts);
    let isGL2 = !!gl;
    if (!gl) gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) return null;
    gl.isGL2 = isGL2;
    return gl;
  };

  function compileShader(gl, type, src, label) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      console.error('Shader compile failed (' + label + '):\n' + log + '\n---\n' +
        src.split('\n').map(function (l, i) { return (i + 1) + ': ' + l; }).join('\n'));
      throw new Error('Shader compile failed: ' + label);
    }
    return s;
  }

  // Creates a program and eagerly caches every active uniform/attribute location.
  G.program = function (gl, vsSrc, fsSrc, label) {
    const p = gl.createProgram();
    gl.attachShader(p, compileShader(gl, gl.VERTEX_SHADER, vsSrc, label + '.vert'));
    gl.attachShader(p, compileShader(gl, gl.FRAGMENT_SHADER, fsSrc, label + '.frag'));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('Program link failed (' + label + '): ' + gl.getProgramInfoLog(p));
    }
    const prog = { id: p, u: {}, a: {}, gl: gl, name: label };
    const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < nu; i++) {
      const info = gl.getActiveUniform(p, i);
      const nm = info.name.replace(/\[0\]$/, '');
      prog.u[nm] = gl.getUniformLocation(p, nm);
    }
    const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < na; i++) {
      const info = gl.getActiveAttrib(p, i);
      prog.a[info.name] = gl.getAttribLocation(p, info.name);
    }
    prog.use = function () { gl.useProgram(p); return prog; };
    return prog;
  };

  G.texture = function (gl, pixels, size, opts) {
    opts = opts || {};
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    if (opts.mipmap) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
      if (gl.isGL2) gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, 4);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };

  /* Vertex attribute arrays are global state, not per-program: an array left
   * enabled by one program still feeds the next draw and, if its buffer is
   * too small, makes the draw fail with INVALID_OPERATION. So every pass
   * declares exactly which locations it wants and the rest get switched off. */
  const MAX_ATTRIBS = 8;

  G.enableOnly = function (gl, locs) {
    for (let i = 0; i < MAX_ATTRIBS; i++) {
      if (locs.indexOf(i) >= 0) gl.enableVertexAttribArray(i);
      else gl.disableVertexAttribArray(i);
    }
  };

  // Interleaved attribute layout helper.
  // spec: [{ name, size, type, norm, offset }], stride in bytes
  G.bindAttribs = function (gl, prog, spec, stride, baseOffset) {
    baseOffset = baseOffset || 0;
    const used = [];
    for (let i = 0; i < spec.length; i++) {
      const s = spec[i];
      const loc = prog.a[s.name];
      if (loc === undefined || loc < 0) continue;
      used.push(loc);
    }
    G.enableOnly(gl, used);
    for (let i = 0; i < spec.length; i++) {
      const s = spec[i];
      const loc = prog.a[s.name];
      if (loc === undefined || loc < 0) continue;
      gl.vertexAttribPointer(loc, s.size, s.type, !!s.norm, stride, s.offset + baseOffset);
    }
  };
})();
