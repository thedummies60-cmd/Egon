/* ============================================================
 * shaders.js - GLSL source for every render pass.
 * Written against GLSL ES 1.00 so it runs on WebGL1 and WebGL2.
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});

  const FOG_FN = [
    'float fogFactor(float d){',
    '  float f = clamp((d - uFogStart) / max(0.001, uFogEnd - uFogStart), 0.0, 1.0);',
    '  return f * f;',
    '}'
  ].join('\n');

  /* ---------------- terrain ---------------- */
  const TERRAIN_VS = [
    'precision highp float;',
    'attribute vec3 aPos;',     // 1/16-block fixed point, chunk local
    'attribute vec2 aUV;',
    'attribute vec4 aLight;',   // r=sky g=blocklight b=ao a=wave amount
    'attribute vec4 aTint;',
    'uniform mat4 uVP;',
    'uniform vec3 uChunkOrigin;',
    'uniform vec3 uCam;',
    'uniform float uTime;',
    'varying vec2 vUV;',
    'varying vec3 vTint;',
    'varying float vSky;',
    'varying float vBlock;',
    'varying float vAO;',
    'varying float vDist;',
    'varying vec3 vWorld;',
    'void main(){',
    '  vec3 p = aPos * 0.0625 + uChunkOrigin;',
    '  float wave = aLight.a;',
    '  if (wave > 0.004) {',
    '    float t = uTime * 2.6;',
    '    p.x += sin(t + p.x * 0.7 + p.z * 0.9) * wave * 0.13;',
    '    p.z += cos(t * 0.85 + p.z * 0.6 + p.y * 1.1) * wave * 0.13;',
    '    p.y += sin(t * 1.4 + p.x * 1.3) * wave * 0.05;',
    '  }',
    '  vWorld = p;',
    '  vUV = aUV;',
    '  vTint = aTint.rgb;',
    '  vSky = aLight.r; vBlock = aLight.g; vAO = aLight.b;',
    '  vDist = length(p - uCam);',
    '  gl_Position = uVP * vec4(p, 1.0);',
    '}'
  ].join('\n');

  const TERRAIN_FS = [
    'precision highp float;',
    'uniform sampler2D uAtlas;',
    'uniform vec3 uFogColor;',
    'uniform float uFogStart, uFogEnd;',
    'uniform float uDayLight;',
    'uniform float uAlphaTest;',
    'uniform float uOpacity;',
    'uniform float uTime;',
    'uniform vec3 uSunDir;',
    'varying vec2 vUV;',
    'varying vec3 vTint;',
    'varying float vSky, vBlock, vAO, vDist;',
    'varying vec3 vWorld;',
    FOG_FN,
    'void main(){',
    '  vec4 c = texture2D(uAtlas, vUV);',
    '  if (c.a < uAlphaTest) discard;',
    '  vec3 col = c.rgb * vTint;',
    '  float sky = vSky * uDayLight;',
    '  float lv = max(sky, vBlock);',
    '  // warm the block-light contribution slightly, like torchlight',
    '  vec3 tintedLight = mix(vec3(1.0, 0.86, 0.68), vec3(1.0), clamp(sky / max(lv, 0.001), 0.0, 1.0));',
    '  col *= (0.045 + 0.955 * lv) * vAO * tintedLight;',
    '  col = mix(col, uFogColor, fogFactor(vDist));',
    '  gl_FragColor = vec4(col, c.a * uOpacity);',
    '}'
  ].join('\n');

  /* ---------------- entities / particles / held item ---------------- */
  const ENTITY_VS = [
    'precision highp float;',
    'attribute vec3 aPos;',
    'attribute vec2 aUV;',
    'attribute vec4 aColor;',
    'uniform mat4 uVP;',
    'uniform vec3 uCam;',
    'varying vec2 vUV;',
    'varying vec4 vColor;',
    'varying float vDist;',
    'void main(){',
    '  vUV = aUV; vColor = aColor;',
    '  vDist = length(aPos - uCam);',
    '  gl_Position = uVP * vec4(aPos, 1.0);',
    '}'
  ].join('\n');

  const ENTITY_FS = [
    'precision highp float;',
    'uniform sampler2D uTex;',
    'uniform vec3 uFogColor;',
    'uniform float uFogStart, uFogEnd;',
    'uniform float uAlphaTest;',
    'uniform float uFogAmount;',
    'uniform vec4 uOverlay;',   // flash colour (damage tint) rgb + strength
    'varying vec2 vUV;',
    'varying vec4 vColor;',
    'varying float vDist;',
    FOG_FN,
    'void main(){',
    '  vec4 t = texture2D(uTex, vUV);',
    '  if (t.a < uAlphaTest) discard;',
    '  vec4 c = t * vColor;',
    '  c.rgb = mix(c.rgb, uOverlay.rgb, uOverlay.a);',
    '  c.rgb = mix(c.rgb, uFogColor, fogFactor(vDist) * uFogAmount);',
    '  gl_FragColor = c;',
    '}'
  ].join('\n');

  /* ---------------- sky: gradient + sun + moon + stars + clouds ---------------- */
  const SKY_VS = [
    'precision highp float;',
    'attribute vec2 aPos;',
    'uniform mat4 uInvVP;',
    'uniform vec3 uCam;',
    'varying vec3 vRay;',
    'void main(){',
    '  vec4 near = uInvVP * vec4(aPos, -1.0, 1.0);',
    '  vec4 far  = uInvVP * vec4(aPos,  1.0, 1.0);',
    '  vRay = normalize(far.xyz / far.w - near.xyz / near.w);',
    '  gl_Position = vec4(aPos, 0.9999, 1.0);',
    '}'
  ].join('\n');

  const SKY_FS = [
    'precision highp float;',
    'uniform vec3 uSkyTop, uSkyHorizon, uFogColor;',
    'uniform vec3 uSunDir;',
    'uniform float uDayLight;',
    'uniform float uTime;',
    'uniform vec3 uCam;',
    'uniform float uCloudCover;',
    'varying vec3 vRay;',
    'float hash21(vec2 p){',
    '  p = fract(p * vec2(233.34, 851.73));',
    '  p += dot(p, p + 23.45);',
    '  return fract(p.x * p.y);',
    '}',
    'float vnoise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  f = f * f * (3.0 - 2.0 * f);',
    '  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));',
    '  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));',
    '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);',
    '}',
    'float fbm(vec2 p){',
    '  float s = 0.0, a = 0.5;',
    '  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }',
    '  return s;',
    '}',
    'void main(){',
    '  vec3 r = normalize(vRay);',
    '  float h = clamp(r.y, -1.0, 1.0);',
    '  float t = pow(clamp(h, 0.0, 1.0), 0.65);',
    '  vec3 col = mix(uSkyHorizon, uSkyTop, t);',
    '  if (h < 0.0) col = mix(uSkyHorizon, uFogColor * 0.75, clamp(-h * 3.0, 0.0, 1.0));',
    '  // stars (fade in at night)',
    '  float night = clamp(1.0 - uDayLight * 1.6, 0.0, 1.0);',
    '  if (night > 0.01 && h > -0.02) {',
    '    vec2 sp = r.xz / max(0.08, abs(r.y) + 0.25) * 26.0;',
    '    float st = hash21(floor(sp));',
    '    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + st * 40.0);',
    '    float star = smoothstep(0.9955, 0.9995, st) * tw;',
    '    col += vec3(star) * night * 1.6;',
    '  }',
    '  // sun',
    '  float sd = dot(r, uSunDir);',
    '  col += vec3(1.0, 0.94, 0.78) * pow(max(sd, 0.0), 900.0) * 6.0;',
    '  col += vec3(1.0, 0.72, 0.36) * pow(max(sd, 0.0), 12.0) * 0.34 * uDayLight;',
    '  // moon (opposite the sun)',
    '  float md = dot(r, -uSunDir);',
    '  col += vec3(0.88, 0.90, 1.0) * pow(max(md, 0.0), 1400.0) * 5.0 * night;',
    '  // a flat layer of drifting blocky clouds',
    '  if (r.y > 0.045) {',
    '    float planeY = 150.0;',
    '    float dist = (planeY - uCam.y) / r.y;',
    '    if (dist > 0.0) {',
    '      vec2 world = uCam.xz + r.xz * dist + vec2(uTime * 1.6, uTime * 0.5);',
    '      // snap to a grid so the clouds read as blocks, like the rest of the world',
    '      vec2 cp = floor(world / 12.0) * 12.0 * 0.0042;',
    '      float n = fbm(cp);',
    '      float cov = smoothstep(0.56 - uCloudCover * 0.30, 0.70, n);',
    '      float fade = (1.0 - smoothstep(600.0, 2200.0, dist)) * smoothstep(0.045, 0.16, r.y);',
    '      vec3 cl = mix(vec3(0.50, 0.55, 0.66), vec3(1.0), uDayLight);',
    '      col = mix(col, cl, cov * fade * 0.9);',
    '    }',
    '  }',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* ---------------- flat coloured lines (block outline, debug) ---------------- */
  const LINE_VS = [
    'precision highp float;',
    'attribute vec3 aPos;',
    'uniform mat4 uVP;',
    'void main(){ gl_Position = uVP * vec4(aPos, 1.0); }'
  ].join('\n');

  const LINE_FS = [
    'precision highp float;',
    'uniform vec4 uColor;',
    'void main(){ gl_FragColor = uColor; }'
  ].join('\n');

  MC.shaders = {
    TERRAIN_VS, TERRAIN_FS,
    ENTITY_VS, ENTITY_FS,
    SKY_VS, SKY_FS,
    LINE_VS, LINE_FS
  };
})();
