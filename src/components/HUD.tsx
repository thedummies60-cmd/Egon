import { useEffect, useState } from "react";
import { nameOf, type Stack } from "../game/blocks";
import { getIcon } from "../game/textures";
import type { UIState } from "../game/engine";

const HEART = [
  ".11..11.",
  "11111111",
  "11111111",
  "11111111",
  ".111111.",
  "..1111..",
  "...11...",
];

const FOOD = [
  "..1111..",
  ".111111.",
  ".111111.",
  "..1111..",
  "...11...",
  "..1111..",
  "..1111..",
];

function PixelIcon({ pattern, lit, dim, size = 17 }: { pattern: string[]; lit: string; dim: string; size?: number }) {
  const h = pattern.length;
  const w = pattern[0].length;
  const rects: React.ReactNode[] = [];
  pattern.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      if (row[x] === "1") rects.push(<rect key={x + "_" + y} x={x} y={y} width={1.06} height={1.06} fill={lit} />);
      else rects.push(<rect key={x + "_" + y} x={x} y={y} width={1.06} height={1.06} fill={dim} opacity={0.55} />);
    }
  });
  return (
    <svg width={size} height={(size * h) / w} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" style={{ display: "block" }}>
      {rects}
    </svg>
  );
}

function HalfIcon({ pattern, lit, dim, size = 17 }: { pattern: string[]; lit: string; dim: string; size?: number }) {
  const h = pattern.length;
  const w = pattern[0].length;
  const rects: React.ReactNode[] = [];
  pattern.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      if (row[x] !== "1") continue;
      rects.push(<rect key={x + "_" + y} x={x} y={y} width={1.06} height={1.06} fill={x < w / 2 ? lit : dim} />);
    }
  });
  return (
    <svg width={size} height={(size * h) / w} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" style={{ display: "block" }}>
      {rects}
    </svg>
  );
}

function Bar({ value, pattern, lit, dim }: { value: number; pattern: string[]; lit: string; dim: string }) {
  const icons = [];
  for (let i = 0; i < 10; i++) {
    const v = value - i * 2;
    icons.push(
      v >= 2 ? <PixelIcon key={i} pattern={pattern} lit={lit} dim="#20060a" /> :
      v === 1 ? <HalfIcon key={i} pattern={pattern} lit={lit} dim="#3c1012" /> :
      <PixelIcon key={i} pattern={pattern} lit="#312f2f" dim="#201f1f" />,
    );
  }
  return <div className="flex gap-[1px]">{icons}</div>;
}

export default function HUD({ ui, onSelect }: { ui: UIState; onSelect: (i: number) => void }) {
  const [hint, setHint] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setHint(false), 11000);
    return () => clearTimeout(t);
  }, []);

  const survival = ui.mode === "survival";

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* crosshair */}
      {ui.screen === "none" && !ui.paused && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mix-blend-difference">
          <div className="relative h-[18px] w-[18px]">
            <div className="absolute top-1/2 left-0 h-[2px] w-full -translate-y-1/2 bg-white" />
            <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-white" />
          </div>
        </div>
      )}

      {/* world chip */}
      <div className="font-body absolute top-2 left-2 border-2 border-black/60 bg-black/45 px-2.5 py-1 text-[17px] leading-tight text-white/90">
        <span className="text-[#8fe06a]">■</span> {ui.worldName}
        <span className="ml-2 text-[#bdbdbd]">{ui.mode === "creative" ? "Creative" : "Survival"}{ui.flying ? " · Flying" : ""}</span>
      </div>

      {/* debug */}
      {ui.debug && (
        <div className="font-body absolute top-12 left-2 border-2 border-black/60 bg-black/55 px-2.5 py-1.5 text-[16px] leading-snug text-[#d8ff9a]">
          <div>FPS: {ui.fps}</div>
          <div>XYZ: {ui.pos[0]} / {ui.pos[1]} / {ui.pos[2]}</div>
          <div>Biome: {ui.biome}</div>
          <div>Day cycle: {(ui.day * 24).toFixed(1)}h / 24h</div>
        </div>
      )}

      {/* hurt flash */}
      {ui.hurtId > 0 && (
        <div key={ui.hurtId} className="hurt-anim absolute inset-0"
          style={{ background: "radial-gradient(ellipse at center, rgba(200,0,0,0.12) 40%, rgba(190,0,0,0.5) 100%)" }} />
      )}
      {survival && ui.health <= 4 && (
        <div className="absolute inset-0 animate-pulse" style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(160,0,0,0.35) 100%)" }} />
      )}

      {/* toast */}
      {ui.toastId > 0 && (
        <div key={ui.toastId} className="toast-anim font-body absolute bottom-[118px] left-1/2 -translate-x-1/2 text-center text-[24px] text-white"
          style={{ textShadow: "2px 2px 0 #1c1c1c" }}>
          {ui.toastText}
        </div>
      )}

      {/* hints */}
      {hint && (
        <div className="font-body absolute bottom-3 left-3 border-2 border-black/60 bg-black/50 px-3 py-2 text-[17px] leading-snug text-[#d8d8d8]">
          <div className="text-[#8fe06a]">Quick start</div>
          <div>Hold LMB to punch trees · E = inventory</div>
          <div>RMB a Crafting Table for the 3×3 grid</div>
        </div>
      )}

      {/* vitals + hotbar */}
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1">
        {survival && (
          <div className="flex w-full items-end justify-between px-1">
            <Bar value={ui.health} pattern={HEART} lit="#e8283c" dim="#5c0e16" />
            <Bar value={ui.hunger} pattern={FOOD} lit="#c8843c" dim="#4c3212" />
          </div>
        )}
        <div className="pointer-events-auto flex gap-[3px]">
          {ui.hotbar.map((s: Stack | null, i: number) => (
            <button key={i} className={`hotbar-slot ${i === ui.selected ? "hotbar-sel" : ""}`}
              title={s ? nameOf(s.id) : ""}
              onClick={() => onSelect(i)}>
              {s && <img src={getIcon(s.id)} alt="" className="pixelated" draggable={false} />}
              {s && s.count > 1 && <span className="count font-body">{s.count}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
