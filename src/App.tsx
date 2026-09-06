import { useEffect, useRef, useState } from "react";
import TitleScreen from "./components/TitleScreen";
import HUD from "./components/HUD";
import InventoryUI from "./components/InventoryUI";
import { DeathScreen, PauseMenu } from "./components/PauseMenu";
import { MinecraftGame, type InvState, type UIState } from "./game/engine";
import { getIcon } from "./game/textures";
import { B } from "./game/blocks";
import { loadWorlds, saveWorlds, type WorldMeta } from "./game/util";

function LoadingScreen({ p }: { p: number }) {
  const dirt = getIcon(B.DIRT);
  return (
    <div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-5"
      style={{ backgroundImage: `url(${dirt})`, backgroundSize: "48px 48px", imageRendering: "pixelated" }}
    >
      <div className="absolute inset-0 bg-black/70" />
      <h2 className="font-display text-mc relative text-[24px] text-white">MINECRAFT</h2>
      <div className="font-body text-mc relative text-[22px] text-[#d8d8d8]">
        Building terrain… {Math.round(p * 100)}%
      </div>
      <div className="relative h-5 w-[320px] max-w-[80vw] border-2 border-black bg-[#1d1d1d]">
        <div className="h-full bg-[#6fae44] transition-[width] duration-150" style={{ width: `${Math.round(p * 100)}%` }} />
      </div>
      <div className="font-body text-mc relative text-[17px] text-[#9a9a9a]">
        Generating infinite chunks around spawn
      </div>
    </div>
  );
}

function GameView({ meta, onQuit }: { meta: WorldMeta; onQuit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engRef = useRef<MinecraftGame | null>(null);
  const [ui, setUi] = useState<UIState | null>(null);
  const [inv, setInv] = useState<InvState | null>(null);
  const [loadP, setLoadP] = useState(0);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const eng = new MinecraftGame(canvas, meta, {
      onUI: setUi,
      onInv: setInv,
      onLoad: setLoadP,
    });
    engRef.current = eng;
    setMuted(eng.sfx.muted);
    void eng.start();
    return () => {
      eng.dispose();
      engRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quit = () => {
    engRef.current?.quitToTitle();
    onQuit();
  };

  const inGame = ui && loadP >= 1;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        onClick={() => {
          const u = ui;
          if (u && !u.paused && u.screen === "none") engRef.current?.requestLock();
        }}
      />

      {inGame && <HUD ui={ui} onSelect={(i) => engRef.current?.selectSlot(i)} />}

      {inGame && (ui.screen === "inv" || ui.screen === "craft") && inv && (
        <InventoryUI
          inv={inv}
          screen={ui.screen}
          onClose={() => engRef.current?.closeScreen()}
          onSlot={(a, i, b, l) => engRef.current?.clickSlot(a, i, b, l)}
        />
      )}

      {inGame && ui.paused && (
        <PauseMenu
          onResume={() => engRef.current?.resume()}
          onSave={() => engRef.current?.saveNow()}
          onQuit={quit}
          onToggleSound={() => setMuted(engRef.current!.sfx.toggleMuted())}
          muted={muted}
        />
      )}

      {inGame && ui.screen === "dead" && (
        <DeathScreen onRespawn={() => engRef.current?.respawn()} onQuit={quit} />
      )}

      {loadP < 1 && <LoadingScreen p={loadP} />}
    </div>
  );
}

export default function App() {
  const [world, setWorld] = useState<WorldMeta | null>(null);

  if (!world) {
    return <TitleScreen onPlay={(w) => setWorld(w)} />;
  }

  return (
    <GameView
      key={world.seed + ":" + world.created}
      meta={world}
      onQuit={() => {
        const list = loadWorlds().map((w) =>
          w.seed === world.seed && w.created === world.created ? { ...w, lastPlayed: Date.now() } : w,
        );
        saveWorlds(list);
        setWorld(null);
      }}
    />
  );
}
