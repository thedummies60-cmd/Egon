/* ============================================================
 * main.js - bootstrap, key routing and the frame loop.
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC;

  function boot() {
    const canvas = document.getElementById('glcanvas');

    /* --- bake every texture before anything touches the GPU --- */
    const t0 = performance.now();
    MC.atlas.buildAll();
    MC.mobArt.build();
    MC.initMeshTables();
    const bakeMs = Math.round(performance.now() - t0);

    const game = new MC.Game(canvas, null);
    if (!game.boot()) {
      document.body.innerHTML =
        '<div style="padding:40px;font:16px monospace;color:#fff;background:#111;height:100%">' +
        '<h2>WebGL is not available</h2>' +
        '<p>This game needs WebGL. Try a different browser, or enable hardware acceleration.</p></div>';
      return;
    }
    const ui = new MC.UI(game);
    game.ui = ui;
    console.log('Egon: textures baked in ' + bakeMs + 'ms, ' +
      MC.blocks.count() + ' blocks / ' + MC.items.list.length + ' items / ' +
      Object.keys(MC.mobArt.MOBS).length + ' mobs');

    /* --- sizing --- */
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(window.innerWidth * dpr));
      const h = Math.max(1, Math.floor(window.innerHeight * dpr));
      game.renderer.resize(w, h);
    }
    window.addEventListener('resize', resize);
    resize();

    /* --- key routing that must bypass the movement handler --- */
    let lastSpace = 0;
    game.input.onKey = function (code, e) {
      if (!game.running || game.panorama) {
        if (code === 'Escape' && ui.current && ui.current !== 'screen-title') {
          ui.show('screen-title');
          return true;
        }
        return false;
      }
      switch (code) {
        case 'Escape':
          if (game.screen) { game.closeScreen(); return true; }
          if (game.player.dead) return true;
          if (game.paused) ui.resume(); else ui.pause();
          return true;
        case 'KeyE':
          if (game.player.dead || game.paused) return true;
          if (game.screen) game.closeScreen(); else game.openInventory();
          return true;
        case 'F3':
          game.debug = !game.debug;
          return true;
        case 'F5':
          game.perspective = (game.perspective + 1) % 3;
          return true;
        case 'Space': {
          const now = performance.now();
          if (game.player.mode === 'creative' && !game.screen && !game.paused) {
            if (now - lastSpace < 320) { game.player.toggleFly(); lastSpace = 0; }
            else lastSpace = now;
          }
          return false;
        }
        default:
          return false;
      }
    };

    game.input.onMouseDown = function (button, e) {
      if (!game.running || game.panorama) return false;
      if (game.screen) return false;            // container UI handles its own clicks
      if (game.paused) return false;
      if (!game.input.locked && !game.player.dead) {
        game.audio.resume();
        game.input.requestLock();
        return true;
      }
      return false;
    };

    game.input.onWheel = function () { return !!game.screen || game.paused; };

    // Losing pointer lock means the player alt-tabbed or hit Esc, so pause.
    // The title-screen panorama never holds lock, so it must not trigger this.
    game.input.onLockChange = function (locked) {
      if (!locked && game.running && !game.panorama && !game.paused &&
          !game.screen && !game.player.dead) {
        ui.pause();
      }
    };

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && game.running && !game.panorama && !game.paused && !game.screen) ui.pause();
    });

    /* --- title screen with a live world behind it --- */
    ui.show('screen-title');
    ui.setHud(false);
    game.startPanorama();

    /* --- frame loop --- */
    let last = performance.now();
    let acc = 0, frames = 0;
    function frame(now) {
      requestAnimationFrame(frame);
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.1) dt = 0.1;          // never simulate a huge step after a stall

      acc += dt; frames++;
      if (acc >= 0.5) { game.fps = frames / acc; acc = 0; frames = 0; }

      if (game.running) {
        game.tick(dt);
        game.render(dt);
        if (!game.panorama) ui.update(dt);
        // keep the loading bar moving while the first chunks stream in
        if (!game.ready && ui.current === 'screen-loading') {
          const bar = document.querySelector('#loadbar i');
          if (bar) bar.style.width = Math.min(96, 4 + game.loadTicks * 1.4) + '%';
        }
      }
    }
    requestAnimationFrame(frame);

    window.addEventListener('beforeunload', function () { game.save(); });
    window.MCGAME = game;               // handy from the console
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
