import { useState } from "react";
import { CREATIVE_LIST, nameOf, type Stack } from "../game/blocks";
import { getIcon } from "../game/textures";
import { RECIPES, type Recipe } from "../game/recipes";
import type { InvState } from "../game/engine";
import type { SlotArea } from "../game/inventory";

function Slot({
  s, onDown, highlight, title,
}: {
  s: Stack | null;
  onDown: (btn: number) => void;
  highlight?: boolean;
  title?: string;
}) {
  return (
    <div
      className={`mc-slot ${highlight && s ? "!bg-[#b0c8a0]" : ""}`}
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onDown(e.button); }}
      onContextMenu={(e) => e.preventDefault()}
      title={title ?? (s ? nameOf(s.id) : "")}
    >
      {s && <img src={getIcon(s.id)} className="pixelated" alt="" draggable={false} />}
      {s && s.count > 1 && <span className="count font-body">{s.count}</span>}
    </div>
  );
}

function recipeIngredients(r: Recipe): { id: number; count: number }[] {
  const map = new Map<number, number>();
  if (r.shapeless) {
    for (const id of r.shapeless) map.set(id, (map.get(id) ?? 0) + 1);
  } else if (r.shape && r.map) {
    for (const row of r.shape)
      for (const ch of row) {
        if (ch === ".") continue;
        const id = r.map[ch];
        if (id) map.set(id, (map.get(id) ?? 0) + 1);
      }
  }
  return [...map.entries()].map(([id, count]) => ({ id, count }));
}

function RecipesPanel() {
  return (
    <div className="flex w-[250px] flex-none flex-col border-2 border-[#555] bg-[#b5b5b5]">
      <div className="font-body border-b-2 border-[#555] bg-[#8b8b8b] px-2 py-1 text-[20px] text-white" style={{ textShadow: "1px 1px 0 #3f3f3f" }}>
        Recipe Book
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2" style={{ maxHeight: "400px" }}>
        {RECIPES.map((r) => (
          <div key={r.label} className="flex items-center gap-1.5 border border-[#9c9c9c] bg-[#c6c6c6] px-1.5 py-1">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
              {recipeIngredients(r).map((ing, i) => (
                <span key={i} className="flex items-center" title={nameOf(ing.id)}>
                  <img src={getIcon(ing.id)} className="pixelated h-5 w-5" alt="" />
                  {ing.count > 1 && <span className="font-body text-[14px] leading-none text-[#3f3f3f]">×{ing.count}</span>}
                </span>
              ))}
            </div>
            <span className="font-body text-[18px] text-[#3f3f3f]">→</span>
            <span className="flex items-center" title={r.label}>
              <img src={getIcon(r.out.id)} className="pixelated h-6 w-6" alt="" />
              {r.out.count > 1 && <span className="font-body text-[14px] leading-none text-[#3f3f3f]">×{r.out.count}</span>}
            </span>
          </div>
        ))}
        <div className="font-body px-1 pt-1 text-[15px] leading-tight text-[#5a5a5a]">
          Arrange items in the grid exactly as the book suggests — or drag stacks with LMB / RMB.
        </div>
      </div>
    </div>
  );
}

export default function InventoryUI({
  inv, screen, onSlot, onClose,
}: {
  inv: InvState;
  screen: "inv" | "craft";
  onSlot: (area: SlotArea, i: number, btn: number, libId?: number) => void;
  onClose: () => void;
}) {
  const [mp, setMp] = useState({ x: -100, y: -100 });
  const isCraft = screen === "craft";
  const cs = inv.craftSize;
  const title = inv.mode === "creative" ? "Creative Items" : isCraft ? "Crafting Table" : "Inventory";

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/60"
      onMouseMove={(e) => setMp({ x: e.clientX, y: e.clientY })}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="mc-panel fade-up flex max-h-[92vh] gap-3 overflow-y-auto p-4">
        <div className="flex flex-col gap-3">
          <div className="font-body text-[24px] leading-none text-[#3f3f3f]">{title}</div>

          {inv.mode === "creative" && (
            <div>
              <div className="font-body mb-1 text-[17px] text-[#5a5a5a]">All blocks & items — click to grab a stack</div>
              <div className="grid gap-[2px]" style={{ gridTemplateColumns: "repeat(9, var(--slot))" }}>
                {CREATIVE_LIST.map((id, i) => (
                  <Slot key={id} s={{ id, count: 1 }} title={nameOf(id)} onDown={(b) => onSlot("lib", i, b, id)} />
                ))}
              </div>
            </div>
          )}

          {inv.mode === "survival" && (
            <div className="flex items-center gap-4">
              <div>
                <div className="font-body mb-1 text-[17px] text-[#5a5a5a]">
                  Crafting {isCraft ? "3×3" : "2×2"}
                </div>
                <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${cs}, var(--slot))` }}>
                  {Array.from({ length: cs * cs }).map((_, i) => (
                    <Slot key={i} s={inv.craft[i]} onDown={(b) => onSlot("craft", i, b)} />
                  ))}
                </div>
              </div>
              <svg width="34" height="26" viewBox="0 0 34 26" shapeRendering="crispEdges">
                <rect x="0" y="10" width="22" height="6" fill="#3f3f3f" />
                <rect x="16" y="2" width="6" height="22" fill="#3f3f3f" />
                <rect x="22" y="6" width="6" height="14" fill="#3f3f3f" />
                <rect x="28" y="10" width="6" height="6" fill="#3f3f3f" />
              </svg>
              <div>
                <div className="font-body mb-1 text-[17px] text-[#5a5a5a]">Result</div>
                <Slot s={inv.result} highlight onDown={(b) => onSlot("result", 0, b)} />
              </div>
            </div>
          )}

          <div>
            <div className="font-body mb-1 text-[17px] text-[#5a5a5a]">{inv.mode === "creative" ? "Your inventory" : "Backpack"}</div>
            <div className="grid gap-[2px]" style={{ gridTemplateColumns: "repeat(9, var(--slot))" }}>
              {inv.slots.slice(0, 27).map((s, i) => (
                <Slot key={i} s={s} onDown={(b) => onSlot("main", i, b)} />
              ))}
            </div>
          </div>
          <div>
            <div className="font-body mb-1 text-[17px] text-[#5a5a5a]">Hotbar</div>
            <div className="grid gap-[2px]" style={{ gridTemplateColumns: "repeat(9, var(--slot))" }}>
              {inv.slots.slice(27).map((s, i) => (
                <Slot key={i} s={s} onDown={(b) => onSlot("hotbar", i, b)} />
              ))}
            </div>
          </div>
        </div>

        {inv.mode === "survival" && <RecipesPanel />}
      </div>

      {/* cursor stack */}
      {inv.cursor && (
        <div className="pointer-events-none fixed z-50" style={{ left: mp.x - 18, top: mp.y - 18 }}>
          <img src={getIcon(inv.cursor.id)} className="pixelated h-9 w-9" alt="" />
          {inv.cursor.count > 1 && (
            <span className="font-body absolute -right-2 -bottom-1 text-[18px] text-white" style={{ textShadow: "2px 2px 0 #1c1c1c" }}>
              {inv.cursor.count}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
