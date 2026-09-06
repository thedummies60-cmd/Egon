import { useEffect, useMemo, useRef, useState } from "react";
import { SFX } from "../game/audio";
import { hashString, loadWorlds, saveWorlds, type GameMode, type WorldMeta } from "../game/util";

const sfx = new SFX();

const SPLASHES = [
  "As seen on the web!", "Punch a tree!", "100% JavaScript!", "Now with creepers!",
  "Infinite worlds!", "No Java required!", "WebGL powered!", "Also try mining!",
  "Craft everything!", "Biomes everywhere!", "Hello, world!", "Blocky!",
  "Diamonds are forever!", "Don't dig straight down!", "Right-click the crafting table!",
];

// Draws a Minecraft-style panorama entirely in code (always available, no network).
function drawPanorama(canvas: HTMLCanvasElement) {
  const W = 1400, H = 620;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#6f9ef0");
  sky.addColorStop(0.6, "#a8c8f8");
  sky.addColorStop(1, "#cfe0fb");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // square sun
  ctx.fillStyle = "#fff6c8";
  ctx.fillRect(1080, 70, 72, 72);
  // clouds
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (const [cx, cy, cw] of [[120, 90, 130], [420, 50, 90], [760, 120, 160], [1240, 160, 100]] as const) {
    ctx.fillRect(cx, cy, cw, 18);
    ctx.fillRect(cx + 18, cy - 12, cw - 40, 12);
  }
  const h1 = (x: number, s: number) => {
    const v = Math.sin(x * 0.008 + s) * 0.5 + Math.sin(x * 0.023 + s * 2) * 0.3 + Math.sin(x * 0.051 + s * 3) * 0.2;
    return v * 0.5 + 0.5;
  };
  // far snowy mountains
  for (let x = 0; x < W; x += 14) {
    const mh = 150 + h1(x, 9) * 170;
    ctx.fillStyle = "#9db4d4";
    ctx.fillRect(x, H - 260 - mh, 14, mh + 260);
    ctx.fillStyle = "#eef4fb";
    ctx.fillRect(x, H - 260 - mh, 14, 26);
  }
  // mid hills
  for (let x = 0; x < W; x += 12) {
    const mh = 60 + h1(x, 4) * 130;
    const y = H - 180 - mh;
    ctx.fillStyle = "#6aa845";
    ctx.fillRect(x, y, 12, H - y);
    ctx.fillStyle = "#7cbd4f";
    ctx.fillRect(x, y, 12, 12);
    ctx.fillStyle = "#5d9e38";
    ctx.fillRect(x, y + 12, 12, 5);
  }
  // near ground
  for (let x = 0; x < W; x += 16) {
    const y = H - 150 + h1(x, 1) * 22;
    ctx.fillStyle = "#96653f";
    ctx.fillRect(x, y + 14, 16, H - y);
    ctx.fillStyle = "#7cbd4f";
    ctx.fillRect(x, y, 16, 16);
  }
  // trees
  const treeAt = (tx: number, ty: number, s: number) => {
    ctx.fillStyle = "#6b5232";
    ctx.fillRect(tx - 5 * s, ty - 34 * s, 10 * s, 34 * s);
    ctx.fillStyle = "#3e7a24";
    ctx.fillRect(tx - 24 * s, ty - 66 * s, 48 * s, 36 * s);
    ctx.fillStyle = "#4c9130";
    ctx.fillRect(tx - 16 * s, ty - 82 * s, 32 * s, 18 * s);
    ctx.fillStyle = "#2f6218";
    ctx.fillRect(tx - 24 * s, ty - 36 * s, 48 * s, 6 * s);
  };
  treeAt(180, H - 158, 1.1);
  treeAt(620, H - 150, 0.9);
  treeAt(1010, H - 162, 1.25);
  treeAt(1330, H - 148, 0.8);
}

export function ControlsList() {
  const rows: [string, string][] = [
    ["W A S D", "Move"], ["SPACE", "Jump / Swim / Fly up"], ["CTRL", "Sprint"],
    ["MOUSE", "Look around"], ["LMB (hold)", "Mine block / Attack"], ["RMB", "Place block / Use / Eat"],
    ["1-9 / WHEEL", "Select hotbar slot"], ["E", "Inventory & crafting"], ["RMB on Crafting Table", "Open 3×3 crafting"],
    ["SPACE ×2 (Creative)", "Toggle flight"], ["SHIFT (flying)", "Descend"], ["F3", "Debug info"], ["ESC", "Pause menu"],
  ];
  return (
    <div className="grid grid-cols-1 gap-y-1.5 text-left">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center gap-3">
          <span className="inline-block min-w-[170px] border-2 border-black bg-[#3d3d3d] px-2 py-0.5 text-center text-[17px] leading-tight text-[#e8e8e8] shadow-[inset_1px_1px_0_#5c5c5c]">
            {k}
          </span>
          <span className="text-[19px] text-[#d8d8d8]">{v}</span>
        </div>
      ))}
    </div>
  );
}

const PANORAMA_URL = "https://image.qwenlm.ai/generated-images/436aa6aa-701e-45d4-8b5a-108e88a28630/_result.png";

export default function TitleScreen({ onPlay }: { onPlay: (w: WorldMeta) => void }) {
  const [view, setView] = useState<"main" | "worlds" | "create" | "controls">("main");
  const [worlds, setWorlds] = useState<WorldMeta[]>(loadWorlds);
  const [name, setName] = useState("New World");
  const [seed, setSeed] = useState("");
  const [mode, setMode] = useState<GameMode>("survival");
  const [imgOk, setImgOk] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const splash = useMemo(() => SPLASHES[Math.floor(Math.random() * SPLASHES.length)], []);

  useEffect(() => {
    if (canvasRef.current) drawPanorama(canvasRef.current);
  }, []);

  const btn = "mc-btn w-[380px] max-w-[86vw]";
  const click = (fn: () => void) => () => { sfx.click(); fn(); };

  const createWorld = () => {
    const seedNum = seed.trim() === "" ? Math.floor(Math.random() * 2 ** 31) : /^\d+$/.test(seed.trim()) ? Number(seed.trim()) % 2 ** 31 : hashString(seed.trim());
    const w: WorldMeta = { name: name.trim() || "New World", seed: seedNum, mode, created: Date.now(), lastPlayed: Date.now() };
    const next = [w, ...worlds].slice(0, 12);
    setWorlds(next);
    saveWorlds(next);
    onPlay(w);
  };

  const deleteWorld = (w: WorldMeta) => {
    const next = worlds.filter((x) => x !== w);
    setWorlds(next);
    saveWorlds(next);
    try { localStorage.removeItem("mcw_save_" + w.seed); } catch { /* ignore */ }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />
      {imgOk && (
        <img src={PANORAMA_URL} alt="" onError={() => setImgOk(false)} onLoad={() => setImgOk(true)}
          className="pan-anim absolute inset-0 h-full w-full object-cover" />
      )}
      {!imgOk && <img src={PANORAMA_URL} alt="" onLoad={() => setImgOk(true)} onError={() => setImgOk(false)} className="hidden" />}
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/60" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2 px-4">
        {view === "main" && (
          <div className="fade-up flex flex-col items-center">
            <div className="relative mb-1">
              <h1 className="font-display text-mc-hard select-none text-center text-[clamp(30px,7.2vw,74px)] leading-none tracking-tight text-[#e9e9e9]"
                style={{ textShadow: "0 5px 0 #6d6d6d, 0 9px 0 rgba(0,0,0,0.4), 4px 4px 0 #3a3a3a" }}>
                MINECRAFT
              </h1>
              <div className="splash font-body absolute -right-10 -bottom-4 hidden text-[26px] text-[#ffff00] sm:block"
                style={{ textShadow: "2px 2px 0 #3f3f00" }}>
                {splash}
              </div>
            </div>
            <div className="font-display text-mc mb-8 text-[11px] tracking-[0.3em] text-[#cfe0ff]">WEB EDITION</div>

            <button className={btn} onMouseEnter={() => sfx.hover()} onClick={click(() => setView("worlds"))}>Singleplayer</button>
            <button className={btn} onMouseEnter={() => sfx.hover()} onClick={click(() => setView("controls"))}>Controls</button>
            <button className={btn} disabled>Multiplayer — LAN off</button>
            <button className={btn} onMouseEnter={() => sfx.hover()} onClick={click(() => { sfx.toggleMuted(); setView("main"); })}>
              Sound: {sfx.muted ? "OFF" : "ON"}
            </button>
          </div>
        )}

        {view === "worlds" && (
          <div className="fade-up flex max-h-[86vh] w-[520px] max-w-[92vw] flex-col items-center gap-3 overflow-hidden">
            <h2 className="font-display text-mc text-[20px] text-white">Select World</h2>
            <div className="w-full flex-1 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: "46vh" }}>
              {worlds.length === 0 && (
                <div className="font-body text-mc border-2 border-black/40 bg-black/35 p-4 text-center text-[20px] text-white">
                  No worlds yet — create your first infinite world!
                </div>
              )}
              {worlds.map((w) => (
                <div key={w.seed + w.created} className="group flex items-center gap-3 border-2 border-black bg-[#1d1d1d]/85 p-2 hover:border-white"
                  onMouseEnter={() => sfx.hover()}>
                  <div className="pixelated flex h-12 w-12 flex-none items-center justify-center border-2 border-black"
                    style={{ background: w.mode === "creative" ? "linear-gradient(#7cbd4f 45%, #96653f 45%)" : "linear-gradient(#8f8f8f 45%, #4a4a4a 45%)" }}>
                  </div>
                  <button className="min-w-0 flex-1 text-left" onClick={click(() => onPlay({ ...w, lastPlayed: Date.now() }))}>
                    <div className="font-body truncate text-[22px] leading-tight text-white">{w.name}</div>
                    <div className="font-body text-[16px] leading-tight text-[#9a9a9a]">
                      {w.mode === "creative" ? "Creative" : "Survival"} · Seed {w.seed} · {new Date(w.lastPlayed).toLocaleDateString()}
                    </div>
                  </button>
                  <button className="mc-btn mc-btn-red !px-2.5 !text-[17px]" onClick={click(() => deleteWorld(w))}>✕</button>
                </div>
              ))}
            </div>
            <button className={btn + " mc-btn-green"} onMouseEnter={() => sfx.hover()} onClick={click(() => setView("create"))}>Create New World</button>
            <button className={btn} onMouseEnter={() => sfx.hover()} onClick={click(() => setView("main"))}>Cancel</button>
          </div>
        )}

        {view === "create" && (
          <div className="fade-up flex w-[560px] max-w-[92vw] flex-col items-center gap-3">
            <h2 className="font-display text-mc text-[20px] text-white">Create New World</h2>
            <div className="w-full border-2 border-black bg-[#1d1d1d]/85 p-4">
              <label className="font-body block text-[18px] text-[#bdbdbd]">World name</label>
              <input className="mc-input mb-3 w-full" value={name} onChange={(e) => setName(e.target.value)} maxLength={28} />
              <label className="font-body block text-[18px] text-[#bdbdbd]">Seed (optional — text or number)</label>
              <input className="mc-input w-full" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Leave blank for a random world" />
            </div>
            <div className="flex w-full gap-3">
              {(["survival", "creative"] as GameMode[]).map((m) => (
                <button key={m} onMouseEnter={() => sfx.hover()}
                  onClick={click(() => setMode(m))}
                  className={`flex-1 border-2 p-3 text-left transition-colors ${mode === m ? "border-white bg-[#3d5c2c]/90" : "border-black bg-[#1d1d1d]/85 hover:bg-[#2a2a2a]/90"}`}>
                  <div className="font-display text-[12px] text-white">{m === "survival" ? "SURVIVAL" : "CREATIVE"}</div>
                  <div className="font-body mt-1 text-[16px] leading-tight text-[#c9c9c9]">
                    {m === "survival" ? "Mine, craft, eat and survive the night. Mobs fight back." : "Unlimited blocks, instant mining, flight. Pure building."}
                  </div>
                </button>
              ))}
            </div>
            <button className={btn + " mc-btn-green"} onMouseEnter={() => sfx.hover()} onClick={click(createWorld)}>Create & Play</button>
            <button className={btn} onMouseEnter={() => sfx.hover()} onClick={click(() => setView("worlds"))}>Back</button>
          </div>
        )}

        {view === "controls" && (
          <div className="fade-up flex w-[560px] max-w-[92vw] flex-col items-center gap-4">
            <h2 className="font-display text-mc text-[20px] text-white">Controls</h2>
            <div className="max-h-[56vh] w-full overflow-y-auto border-2 border-black bg-[#1d1d1d]/85 p-4">
              <ControlsList />
            </div>
            <button className={btn} onMouseEnter={() => sfx.hover()} onClick={click(() => setView("main"))}>Back</button>
          </div>
        )}
      </div>

      <div className="font-body absolute bottom-2 left-3 z-10 text-[16px] text-white/85" style={{ textShadow: "1px 1px 0 #000" }}>
        Minecraft Web Edition v1.0 — infinite voxel sandbox
      </div>
      <div className="font-body absolute right-3 bottom-2 z-10 text-[16px] text-white/70" style={{ textShadow: "1px 1px 0 #000" }}>
        Fan-made browser tribute · not affiliated with Mojang or Microsoft
      </div>
    </div>
  );
}
