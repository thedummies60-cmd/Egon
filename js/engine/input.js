/* ============================================================
 * input.js - keyboard, mouse, pointer lock and key bindings.
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});

  const DEFAULT_BINDS = {
    forward: ['KeyW', 'ArrowUp'],
    back: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    jump: ['Space'],
    sneak: ['ShiftLeft', 'ShiftRight'],
    sprint: ['ControlLeft', 'KeyR'],
    inventory: ['KeyE'],
    drop: ['KeyQ'],
    chat: ['KeyT'],
    perspective: ['F5'],
    debug: ['F3'],
    fullscreen: ['F11'],
    screenshot: ['F2']
  };

  function Input(canvas) {
    this.canvas = canvas;
    this.binds = JSON.parse(JSON.stringify(DEFAULT_BINDS));
    this.keys = Object.create(null);
    this.pressedThisFrame = Object.create(null);
    this.mouse = { dx: 0, dy: 0, left: false, right: false, middle: false, wheel: 0 };
    this.locked = false;
    this.sensitivity = 0.0022;
    this.invertY = false;
    this.enabled = true;
    this.onKey = null;         // (code, event) -> boolean (true = handled)
    this.onLockChange = null;
    this.onMouseDown = null;
    this.onWheel = null;
    this._install();
  }

  Input.prototype._install = function () {
    const self = this;

    window.addEventListener('keydown', function (e) {
      if (e.repeat) {
        if (!/^F\d/.test(e.code)) return;
      }
      if (e.code === 'F11') return;              // let the browser handle it
      if (self.onKey && self.onKey(e.code, e)) { e.preventDefault(); return; }
      self.keys[e.code] = true;
      self.pressedThisFrame[e.code] = true;
      if (['Space', 'Tab', 'F3', 'F5', 'F2', 'KeyE', 'Slash'].indexOf(e.code) >= 0) e.preventDefault();
    });

    window.addEventListener('keyup', function (e) {
      self.keys[e.code] = false;
    });

    window.addEventListener('blur', function () { self.keys = Object.create(null); });

    document.addEventListener('pointerlockchange', function () {
      self.locked = document.pointerLockElement === self.canvas;
      if (!self.locked) { self.mouse.left = false; self.mouse.right = false; }
      if (self.onLockChange) self.onLockChange(self.locked);
    });

    this.canvas.addEventListener('mousemove', function (e) {
      if (!self.locked) return;
      self.mouse.dx += e.movementX || 0;
      self.mouse.dy += e.movementY || 0;
    });

    this.canvas.addEventListener('mousedown', function (e) {
      if (self.onMouseDown && self.onMouseDown(e.button, e)) return;
      if (!self.locked) return;
      if (e.button === 0) self.mouse.left = true;
      if (e.button === 1) { self.mouse.middle = true; e.preventDefault(); }
      if (e.button === 2) self.mouse.right = true;
    });

    window.addEventListener('mouseup', function (e) {
      if (e.button === 0) self.mouse.left = false;
      if (e.button === 1) self.mouse.middle = false;
      if (e.button === 2) self.mouse.right = false;
    });

    this.canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    window.addEventListener('wheel', function (e) {
      if (self.onWheel && self.onWheel(e)) return;
      if (!self.locked) return;
      self.mouse.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
  };

  Input.prototype.requestLock = function () {
    if (this.canvas.requestPointerLock) this.canvas.requestPointerLock();
  };
  Input.prototype.exitLock = function () {
    if (document.exitPointerLock) document.exitPointerLock();
  };

  Input.prototype.down = function (action) {
    const list = this.binds[action];
    if (!list) return false;
    for (let i = 0; i < list.length; i++) if (this.keys[list[i]]) return true;
    return false;
  };

  Input.prototype.pressed = function (action) {
    const list = this.binds[action];
    if (!list) return false;
    for (let i = 0; i < list.length; i++) if (this.pressedThisFrame[list[i]]) return true;
    return false;
  };

  Input.prototype.keyPressed = function (code) { return !!this.pressedThisFrame[code]; };

  Input.prototype.consumeMouse = function () {
    const dx = this.mouse.dx, dy = this.mouse.dy;
    this.mouse.dx = 0; this.mouse.dy = 0;
    return { dx: dx, dy: dy };
  };

  Input.prototype.endFrame = function () {
    this.pressedThisFrame = Object.create(null);
    this.mouse.wheel = 0;
  };

  MC.Input = Input;
  MC.DEFAULT_BINDS = DEFAULT_BINDS;
})();
