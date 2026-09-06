import { useState } from "react";
import { ControlsList } from "./TitleScreen";

export function PauseMenu({
  onResume, onSave, onQuit, onToggleSound, muted,
}: {
  onResume: () => void;
  onSave: () => void;
  onQuit: () => void;
  onToggleSound: () => void;
  muted: boolean;
}) {
  const [showControls, setShowControls] = useState(false);
  const btn = "mc-btn w-[340px] max-w-[86vw]";
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60">
      <div className="fade-up flex flex-col items-center gap-2">
        <h2 className="font-display text-mc mb-3 text-[22px] text-white">Game Menu</h2>
        {showControls && (
          <div className="mb-2 max-h-[40vh] w-[420px] max-w-[88vw] overflow-y-auto border-2 border-black bg-[#1d1d1d]/90 p-3">
            <ControlsList />
          </div>
        )}
        <button className={btn} onClick={onResume}>Back to Game</button>
        <button className={btn} onClick={onSave}>Save World</button>
        <button className={btn} onClick={() => setShowControls((v) => !v)}>
          {showControls ? "Hide Controls" : "Controls"}
        </button>
        <button className={btn} onClick={onToggleSound}>Sound: {muted ? "OFF" : "ON"}</button>
        <button className={btn + " mc-btn-red"} onClick={onQuit}>Save & Quit to Title</button>
      </div>
    </div>
  );
}

export function DeathScreen({ onRespawn, onQuit }: { onRespawn: () => void; onQuit: () => void }) {
  const btn = "mc-btn w-[340px] max-w-[86vw]";
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: "rgba(120,10,10,0.55)" }}>
      <div className="fade-up flex flex-col items-center gap-3">
        <h2 className="font-display select-none text-[clamp(28px,5vw,46px)] text-[#ff5555]"
          style={{ textShadow: "4px 4px 0 #3f0000" }}>
          You died!
        </h2>
        <div className="font-body text-mc mb-2 text-[20px] text-[#ffd8d8]">
          The world keeps your blocks — your items are safe in your inventory.
        </div>
        <button className={btn + " mc-btn-green"} onClick={onRespawn}>Respawn</button>
        <button className={btn} onClick={onQuit}>Save & Quit to Title</button>
      </div>
    </div>
  );
}
