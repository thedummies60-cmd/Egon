import * as THREE from "three";
import { B, BLOCKS, ITEMS, IT, isBlockId, nameOf, type Stack } from "./blocks";
import { World, CHUNK, HEIGHT, SEA, type Biome } from "./world";
import { buildChunkMeshes } from "./mesher";
import { blockParticleColor, getAtlasCanvas, getIcon } from "./textures";
import { Inventory, type SlotArea } from "./inventory";
import { Mob, type MobType } from "./mobs";
import { SFX } from "./audio";
import { clamp, saveKey, type GameMode, type WorldMeta } from "./util";

const VIEW = 4;
const REACH = 5.6;
const EYE = 1.62;
const P_HEIGHT = 1.8;
const P_HALF = 0.3;

export interface UIState {
  mode: GameMode;
  health: number;
  hunger: number;
  hotbar: (Stack | null)[];
  selected: number;
  flying: boolean;
  paused: boolean;
  screen: "none" | "inv" | "craft" | "dead";
  toastText: string;
  toastId: number;
  hurtId: number;
  fps: number;
  pos: [number, number, number];
  biome: Biome;
  debug: boolean;
  day: number;
  worldName: string;
}

export interface InvState {
  slots: (Stack | null)[];
  craft: (Stack | null)[];
  craftSize: number;
  cursor: Stack | null;
  result: Stack | null;
  mode: GameMode;
}

export interface EngineCallbacks {
  onUI: (s: UIState) => void;
  onInv: (s: InvState) => void;
  onLoad: (p: number) => void;
}

interface RayHit { x: number; y: number; z: number; nx: number; ny: number; nz: number; id: number; t: number }

export class MinecraftGame {
  private canvas: HTMLCanvasElement;
  private cb: EngineCallbacks;
  private meta: WorldMeta;
  mode: GameMode;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private atlasTex: THREE.CanvasTexture;
  private solidMat: THREE.MeshLambertMaterial;
  private waterMat: THREE.MeshLambertMaterial;
  private sunLight: THREE.DirectionalLight;
  private ambLight: THREE.AmbientLight;
  private stars: THREE.Points;
  private starMat: THREE.PointsMaterial;
  private sunMesh: THREE.Mesh;
  private moonMesh: THREE.Mesh;
  private highlight: THREE.LineSegments;
  private handGroup = new THREE.Group();
  private fog: THREE.Fog;

  world: World;
  inv = new Inventory();
  sfx = new SFX();

  private meshes = new Map<string, { solid?: THREE.Mesh; water?: THREE.Mesh }>();
  private loaded = new Set<string>();
  private dirty = new Set<string>();

  private pos = new THREE.Vector3(0.5, 40, 0.5);
  private spawn = new THREE.Vector3(0.5, 40, 0.5);
  private vel = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  private onGround = false;
  flying = false;
  private health = 20;
  private hunger = 20;
  private fallDist = 0;
  private hurtCd = 0;
  private attackCd = 0;
  private dead = false;
  private inWater = false;

  private keys = new Set<string>();
  private locked = false;
  paused = false;
  screen: UIState["screen"] = "none";
  private openingUI = false;
  private mouseL = false;
  private breakTarget: RayHit | null = null;
  private breakProgress = 0;
  private crackT = 0;

  private mobs: Mob[] = [];
  private mobSpawnT = 2;

  private parts: { m: THREE.Mesh; v: THREE.Vector3; life: number; max: number }[] = [];
  private partGeo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
  private pendingBooms: { t: number; p: THREE.Vector3 }[] = [];

  private time = 0.3;
  private daylight = 1;
  private simT = 0;
  private shake = 0;
  private swingT = 0;
  private bobT = 0;
  private handId = -999;
  private toastText = "";
  private toastId = 0;
  private hurtId = 0;
  private debug = false;
  private fps = 60;
  private fpsFrames = 0;
  private fpsT = 0;
  private uiT = 0;
  private saveT = 0;
  private hungerT = 0;
  private regenT = 0;
  private starveT = 0;
  private lastSpace = 0;
  private started = false;
  private disposed = false;
  private raf = 0;
  private last = 0;

  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onMouseMove: (e: MouseEvent) => void;
  private onMouseDown: (e: MouseEvent) => void;
  private onMouseUp: (e: MouseEvent) => void;
  private onWheel: (e: WheelEvent) => void;
  private onCtx: (e: Event) => void;
  private onPlc: () => void;
  private onResize: () => void;

  constructor(canvas: HTMLCanvasElement, meta: WorldMeta, cb: EngineCallbacks) {
    this.canvas = canvas;
    this.cb = cb;
    this.meta = meta;
    this.mode = meta.mode;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);

    this.atlasTex = new THREE.CanvasTexture(getAtlasCanvas());
    this.atlasTex.magFilter = THREE.NearestFilter;
    this.atlasTex.minFilter = THREE.NearestFilter;
    this.atlasTex.generateMipmaps = false;
    this.atlasTex.colorSpace = THREE.SRGBColorSpace;

    this.solidMat = new THREE.MeshLambertMaterial({ map: this.atlasTex, vertexColors: true, side: THREE.DoubleSide, alphaTest: 0.5 });
    this.waterMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: this.atlasTex, transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide, vertexColors: true });

    this.fog = new THREE.Fog(0x87b5ff, 42, 88);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0x87b5ff);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.scene.add(this.sunLight);
    this.ambLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambLight);

    // stars
    const starPos: number[] = [];
    for (let i = 0; i < 500; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 0.95);
      const r = 220;
      starPos.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.camera.add(this.stars);

    this.sunMesh = new THREE.Mesh(new THREE.BoxGeometry(22, 22, 2), new THREE.MeshBasicMaterial({ color: 0xfff3b0, fog: false }));
    this.moonMesh = new THREE.Mesh(new THREE.BoxGeometry(14, 14, 2), new THREE.MeshBasicMaterial({ color: 0xdfe8f5, fog: false }));
    this.camera.add(this.sunMesh);
    this.camera.add(this.moonMesh);

    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }),
    );
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    this.handGroup.position.set(0.52, -0.5, -0.85);
    this.camera.add(this.handGroup);

    this.world = new World(meta.seed);
    this.loadSave();

    if (this.mode === "creative" && this.inv.slots.every((s) => !s)) {
      const starter = [B.GRASS, B.DIRT, B.STONE, B.LOG, B.PLANKS, B.GLASS, B.COBBLE, B.TABLE, B.TNT];
      starter.forEach((b, i) => (this.inv.slots[27 + i] = { id: b, count: 64 }));
    }

    this.onKeyDown = (e) => this.keyDown(e);
    this.onKeyUp = (e) => this.keys.delete(e.code);
    this.onMouseMove = (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0023;
      this.pitch = clamp(this.pitch - e.movementY * 0.0023, -1.55, 1.55);
    };
    this.onMouseDown = (e) => this.mouseDown(e);
    this.onMouseUp = (e) => {
      if (e.button === 0) { this.mouseL = false; this.breakProgress = 0; this.breakTarget = null; }
    };
    this.onWheel = (e) => {
      if (!this.locked) return;
      e.preventDefault();
      const d = e.deltaY > 0 ? 1 : -1;
      this.selectSlot((this.inv.hotbarIndex + d + 9) % 9);
    };
    this.onCtx = (e) => e.preventDefault();
    this.onPlc = () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked && this.started && !this.dead) {
        if (this.openingUI) {
          this.openingUI = false;
          return;
        }
        // inventory was open when the lock dropped (Esc) — tidy it up
        if (this.screen === "inv" || this.screen === "craft") {
          const c = this.inv.cursor;
          if (c) this.inv.give(c.id, c.count);
          this.inv.cursor = null;
          this.screen = "none";
          this.pushInv();
        }
        this.paused = true;
        this.pushUI(true);
      }
    };
    this.onResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.canvas.addEventListener("contextmenu", this.onCtx);
    document.addEventListener("pointerlockchange", this.onPlc);
    window.addEventListener("resize", this.onResize);

    this.pushUI(true);
    this.pushInv();
  }

  // ---------- lifecycle ----------

  async start() {
    // preload region around the player (or origin for a fresh world)
    const R = 3;
    const bx = this.loadedSavePos ? Math.floor(this.pos.x / CHUNK) : 0;
    const bz = this.loadedSavePos ? Math.floor(this.pos.z / CHUNK) : 0;
    const cells: [number, number][] = [];
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) cells.push([bx + dx, bz + dz]);
    cells.sort((a, b) => {
      const da = (a[0] - bx) ** 2 + (a[1] - bz) ** 2;
      const db = (b[0] - bx) ** 2 + (b[1] - bz) ** 2;
      return da - db;
    });
    for (let i = 0; i < cells.length; i++) {
      if (this.disposed) return;
      this.world.generate(cells[i][0], cells[i][1]);
      this.cb.onLoad((i + 1) / cells.length);
      if (i % 4 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    if (!this.loadedSavePos) {
      // find a dry spawn column near origin
      let sx = 0, sz = 0, found = false;
      for (let r = 0; r <= 24 && !found; r++) {
        for (let x = -r; x <= r && !found; x++)
          for (let z = -r; z <= r && !found; z++) {
            if (Math.max(Math.abs(x), Math.abs(z)) !== r) continue;
            const h = this.world.heightAt(x, z);
            if (h > SEA + 1) { sx = x; sz = z; found = true; }
          }
      }
      this.spawn.set(sx + 0.5, this.world.heightAt(sx, sz) + 0.1, sz + 0.5);
      this.pos.copy(this.spawn);
    } else if (this.spawn.y <= 1) {
      this.spawn.copy(this.pos);
    }

    for (const [cx, cz] of cells) {
      this.loaded.add(World.key(cx, cz));
      this.rebuildChunk(cx, cz);
    }

    this.started = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.tick(dt);
    };
    this.raf = requestAnimationFrame(loop);
    this.toast(this.mode === "creative" ? "Creative Mode — double-tap SPACE to fly" : "Survival Mode — punch a tree to begin");
  }

  private loadedSavePos = false;

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.saveWorld();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("contextmenu", this.onCtx);
    document.removeEventListener("pointerlockchange", this.onPlc);
    window.removeEventListener("resize", this.onResize);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.meshes.forEach((m) => {
      m.solid?.geometry.dispose();
      m.water?.geometry.dispose();
    });
    this.partGeo.dispose();
    this.solidMat.dispose();
    this.waterMat.dispose();
    this.atlasTex.dispose();
    this.renderer.dispose();
  }

  requestLock() {
    this.canvas.requestPointerLock();
  }

  // ---------- input ----------

  private keyDown(e: KeyboardEvent) {
    if (e.code === "F3") { e.preventDefault(); this.debug = !this.debug; this.pushUI(true); return; }
    if (this.dead) return;
    if (this.paused) return;
    if (e.code === "KeyE") {
      if (!this.started) return;
      if (this.screen === "none") this.openScreen("inv");
      else if (this.screen === "inv" || this.screen === "craft") this.closeScreen();
      return;
    }
    if (e.code === "Escape" && (this.screen === "inv" || this.screen === "craft")) {
      this.closeScreen();
      return;
    }
    if (this.paused) return;
    if (/^Digit[1-9]$/.test(e.code)) {
      this.selectSlot(Number(e.code.slice(5)) - 1);
      return;
    }
    if (e.code === "Space" && this.mode === "creative" && this.locked) {
      const now = performance.now();
      if (now - this.lastSpace < 280) {
        this.flying = !this.flying;
        this.toast(this.flying ? "Flying enabled" : "Flying disabled");
      }
      this.lastSpace = now;
    }
    this.keys.add(e.code);
  }

  private mouseDown(e: MouseEvent) {
    if (!this.locked || this.paused || this.screen !== "none" || this.dead) return;
    if (e.button === 0) {
      this.mouseL = true;
      this.swingT = 0.26;
      // attack mob first
      const mob = this.raycastMob();
      if (mob) {
        this.attackMob(mob);
        return;
      }
      const hit = this.raycastVoxel(REACH);
      if (hit && this.mode === "creative") {
        this.breakBlock(hit);
      }
    } else if (e.button === 2) {
      this.swingT = 0.26;
      this.useItem();
    }
  }

  selectSlot(i: number) {
    this.inv.hotbarIndex = i;
    const s = this.inv.selectedStack();
    if (s) this.toast(nameOf(s.id));
    this.sfx.hover();
    this.pushUI(true);
  }

  clickSlot(area: SlotArea, i: number, btn: number, libId = 0) {
    this.inv.click(area, i, btn, libId);
    this.sfx.click();
    this.pushInv();
    this.pushUI(true);
  }

  openScreen(s: "inv" | "craft") {
    this.screen = s;
    this.inv.craftSize = s === "craft" ? 3 : 2;
    this.openingUI = true;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    else this.openingUI = false;
    this.pushUI(true);
    this.pushInv();
  }

  closeScreen() {
    if (this.screen === "none") return;
    const c = this.inv.cursor;
    if (c) this.inv.give(c.id, c.count);
    this.inv.cursor = null;
    this.screen = "none";
    this.pushInv();
    this.requestLock();
    this.pushUI(true);
  }

  resume() {
    this.paused = false;
    this.pushUI(true);
    this.requestLock();
  }

  respawn() {
    this.pos.copy(this.spawn);
    this.vel.set(0, 0, 0);
    this.health = 20;
    this.hunger = 20;
    this.fallDist = 0;
    this.dead = false;
    this.flying = false;
    this.pushUI(true);
    this.requestLock();
  }

  quitToTitle() {
    this.saveWorld();
  }

  saveNow() {
    this.saveWorld();
    this.toast("World saved");
  }

  // ---------- raycasting ----------

  private raycastVoxel(maxDist: number): RayHit | null {
    const o = this.camera.position;
    const d = new THREE.Vector3();
    this.camera.getWorldDirection(d);
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const stepX = d.x > 0 ? 1 : -1, stepY = d.y > 0 ? 1 : -1, stepZ = d.z > 0 ? 1 : -1;
    const tDX = Math.abs(1 / (d.x || 1e-9)), tDY = Math.abs(1 / (d.y || 1e-9)), tDZ = Math.abs(1 / (d.z || 1e-9));
    let tMX = (d.x > 0 ? x + 1 - o.x : o.x - x) * tDX;
    let tMY = (d.y > 0 ? y + 1 - o.y : o.y - y) * tDY;
    let tMZ = (d.z > 0 ? z + 1 - o.z : o.z - z) * tDZ;
    let nx = 0, ny = 0, nz = 0, t = 0;
    while (t < maxDist) {
      if (tMX < tMY && tMX < tMZ) { x += stepX; t = tMX; tMX += tDX; nx = -stepX; ny = 0; nz = 0; }
      else if (tMY < tMZ) { y += stepY; t = tMY; tMY += tDY; ny = -stepY; nx = 0; nz = 0; }
      else { z += stepZ; t = tMZ; tMZ += tDZ; nz = -stepZ; nx = 0; ny = 0; }
      const id = this.world.getBlock(x, y, z);
      if (id !== B.AIR && id !== B.WATER) return { x, y, z, nx, ny, nz, id, t };
    }
    return null;
  }

  private raycastMob(): Mob | null {
    const o = this.camera.position;
    const d = new THREE.Vector3();
    this.camera.getWorldDirection(d);
    let best: Mob | null = null;
    let bestT = REACH;
    for (const m of this.mobs) {
      const c = m.pos.clone().add(new THREE.Vector3(0, m.h * 0.55, 0));
      const L = c.clone().sub(o);
      const tca = L.dot(d);
      if (tca < 0 || tca > bestT) continue;
      const d2 = L.lengthSq() - tca * tca;
      const r = Math.max(0.45, m.w * 0.75);
      if (d2 < r * r) { best = m; bestT = tca; }
    }
    const block = this.raycastVoxel(REACH);
    if (block && block.t < bestT) return null;
    return best;
  }

  // ---------- world interaction ----------

  private toolOf(stack: Stack | null) {
    if (!stack) return null;
    return ITEMS[stack.id]?.tool ?? null;
  }

  private breakBlock(hit: RayHit) {
    const id = hit.id;
    const def = BLOCKS[id];
    if (!def) return;
    if (id === B.TNT) {
      this.world.setBlock(hit.x, hit.y, hit.z, B.AIR);
      this.markDirtyAt(hit.x, hit.z);
      this.pendingBooms.push({ t: this.simT + 0.15, p: new THREE.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5) });
      this.sfx.fuse();
      return;
    }
    this.world.setBlock(hit.x, hit.y, hit.z, B.AIR);
    this.markDirtyAt(hit.x, hit.z);
    this.spawnBurst(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, blockParticleColor(id), 12);
    this.sfx.breakBlock(this.matClass(id));

    if (this.mode === "survival") {
      let drop = def.drop;
      if (id === B.LEAVES) drop = Math.random() < 0.1 ? IT.APPLE : 0;
      const tool = this.toolOf(this.inv.selectedStack());
      const canDrop = def.tool !== "pickaxe" || this.toolTierOf(tool) >= def.tier;
      if (drop > 0 && canDrop) {
        this.inv.give(drop, 1);
        this.sfx.pop();
        this.toast("+1 " + nameOf(drop));
      }
    }
    this.pushUI(true);
  }

  private toolTierOf(tool: ReturnType<typeof this.toolOf>): number {
    return tool?.kind === "pickaxe" ? tool.tier : 0;
  }

  private matClass(id: number): "stone" | "dirt" | "wood" | "sand" | "grass" | "glass" | "cloth" {
    if (id === B.GLASS) return "glass";
    if (id === B.WOOL) return "cloth";
    if (id === B.SAND) return "sand";
    if (id === B.LOG || id === B.PLANKS || id === B.TABLE || id === B.BOOKSHELF) return "wood";
    if (id === B.GRASS || id === B.SNOWGRASS || id === B.LEAVES || id === B.TALLGRASS) return "grass";
    if (id === B.DIRT || id === B.GRAVEL || id === B.SNOW) return "dirt";
    return "stone";
  }

  private useItem() {
    const hit = this.raycastVoxel(REACH);
    const held = this.inv.selectedStack();

    if (hit) {
      // interactive blocks
      if (hit.id === B.TABLE) { this.openScreen("craft"); this.toast("Crafting Table — 3×3 grid"); return; }
      if (hit.id === B.FURNACE) { this.toast("The furnace glows warmly (decorative in Web Edition)"); return; }
      if (hit.id === B.BOOKSHELF) { this.toast(["\"Punching trees: a memoir\"", "\"So you found diamonds\"", "\"Creeper safety handbook, 3rd ed.\""][Math.floor(Math.random() * 3)]); return; }
      if (hit.id === B.TNT) {
        this.world.setBlock(hit.x, hit.y, hit.z, B.AIR);
        this.markDirtyAt(hit.x, hit.z);
        this.pendingBooms.push({ t: this.simT + 0.8, p: new THREE.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5) });
        this.sfx.fuse();
        this.toast("TNT ignited!");
        return;
      }

      if (held && isBlockId(held.id)) {
        const px = hit.x + hit.nx, py = hit.y + hit.ny, pz = hit.z + hit.nz;
        const cell = this.world.getBlock(px, py, pz);
        if (cell === B.AIR || cell === B.WATER || BLOCKS[cell]?.cross) {
          // don't place inside player
          const bx0 = px, bx1 = px + 1, by0 = py, by1 = py + 1, bz0 = pz, bz1 = pz + 1;
          const overlaps =
            this.pos.x + P_HALF > bx0 && this.pos.x - P_HALF < bx1 &&
            this.pos.y + P_HEIGHT > by0 && this.pos.y < by1 &&
            this.pos.z + P_HALF > bz0 && this.pos.z - P_HALF < bz1;
          if (!overlaps && py > 0 && py < HEIGHT) {
            this.world.setBlock(px, py, pz, held.id);
            this.markDirtyAt(px, pz);
            if (this.mode === "survival") {
              held.count -= 1;
              if (held.count <= 0) this.inv.slots[27 + this.inv.hotbarIndex] = null;
            }
            this.sfx.place();
            this.spawnBurst(px + 0.5, py + 0.5, pz + 0.5, blockParticleColor(held.id), 5);
            this.pushUI(true);
          }
        }
        return;
      }
    }

    if (held && ITEMS[held.id]?.food) {
      if (this.mode === "creative") { this.toast("Creative chefs don't get hungry"); return; }
      if (this.hunger >= 20) { this.toast("Not hungry"); return; }
      this.hunger = Math.min(20, this.hunger + ITEMS[held.id].food!);
      held.count -= 1;
      if (held.count <= 0) this.inv.slots[27 + this.inv.hotbarIndex] = null;
      this.sfx.eat();
      this.toast("Yum! +" + ITEMS[held.id].food + " hunger");
      this.pushUI(true);
    }
  }

  private attackMob(m: Mob) {
    if (this.attackCd > 0) return;
    this.attackCd = 0.28;
    const tool = this.toolOf(this.inv.selectedStack());
    const dmg = tool?.dmg ?? 2;
    m.hurt(dmg, this.pos);
    this.sfx.mobHit();
    this.spawnBurst(m.pos.x, m.pos.y + m.h * 0.6, m.pos.z, "#c83c3c", 8);
    if (m.hp <= 0) this.killMob(m);
  }

  private killMob(m: Mob) {
    m.dead = true;
    const drop = (id: number, n: number) => {
      this.inv.give(id, n);
      this.sfx.pop();
      this.toast("+" + n + " " + nameOf(id));
    };
    const r = Math.random();
    if (m.type === "pig") drop(IT.PORK, 1 + (r < 0.5 ? 1 : 0));
    else if (m.type === "cow") drop(IT.BEEF, 1 + (r < 0.5 ? 1 : 0));
    else if (m.type === "sheep") drop(B.WOOL, 1 + (r < 0.5 ? 1 : 0));
    else if (m.type === "chicken") drop(IT.CHICKEN, 1);
    else if (m.type === "zombie" && r < 0.3) drop(IT.APPLE, 1);
    else if (m.type === "creeper") drop(IT.GUNPOWDER, 1 + (r < 0.4 ? 1 : 0));
    this.spawnBurst(m.pos.x, m.pos.y + m.h * 0.5, m.pos.z, "#ffffff", 14);
    this.pushUI(true);
  }

  explodeAt(center: THREE.Vector3, radius = 3.1) {
    const r = radius;
    const touched = new Set<string>();
    const tnt: THREE.Vector3[] = [];
    const x0 = Math.floor(center.x - r), x1 = Math.floor(center.x + r);
    const y0 = Math.floor(center.y - r), y1 = Math.floor(center.y + r);
    const z0 = Math.floor(center.z - r), z1 = Math.floor(center.z + r);
    for (let x = x0; x <= x1; x++)
      for (let y = Math.max(1, y0); y <= y1; y++)
        for (let z = z0; z <= z1; z++) {
          const d = Math.hypot(x + 0.5 - center.x, y + 0.5 - center.y, z + 0.5 - center.z);
          if (d > r) continue;
          const id = this.world.getBlock(x, y, z);
          if (id === B.AIR || id === B.WATER || id === B.BEDROCK) continue;
          if (id === B.TNT) tnt.push(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5));
          this.world.setBlock(x, y, z, B.AIR);
          touched.add(World.key(Math.floor(x / CHUNK), Math.floor(z / CHUNK)));
        }
    for (const k of touched) {
      const [cx, cz] = k.split(",").map(Number);
      this.dirty.add(k);
      this.dirty.add(World.key(cx + 1, cz));
      this.dirty.add(World.key(cx - 1, cz));
      this.dirty.add(World.key(cx, cz + 1));
      this.dirty.add(World.key(cx, cz - 1));
    }
    for (const t of tnt) this.pendingBooms.push({ t: this.simT + 0.25 + Math.random() * 0.3, p: t });

    const pd = this.pos.clone().add(new THREE.Vector3(0, 1, 0)).distanceTo(center);
    if (pd < r + 2.5) this.damagePlayer(Math.round((1 - pd / (r + 2.5)) * 30), center);
    for (const m of this.mobs) {
      const md = m.pos.clone().add(new THREE.Vector3(0, m.h / 2, 0)).distanceTo(center);
      if (md < r + 2) {
        m.hp -= (1 - md / (r + 2)) * 40;
        m.flash = 0.3;
        if (m.hp <= 0 && !m.dead) this.killMob(m);
      }
    }
    this.spawnBurst(center.x, center.y, center.z, "#9a9a9a", 34);
    this.spawnBurst(center.x, center.y, center.z, "#f0a03a", 20);
    this.sfx.explosion();
    this.shake = 0.7;
  }

  private damagePlayer(dmg: number, from: THREE.Vector3) {
    if (this.mode === "creative" || this.dead || this.hurtCd > 0) return;
    this.health -= dmg;
    this.hurtCd = 0.6;
    this.hurtId++;
    this.sfx.hurt();
    const d = Math.max(0.1, this.pos.distanceTo(from));
    this.vel.x += ((this.pos.x - from.x) / d) * 6;
    this.vel.z += ((this.pos.z - from.z) / d) * 6;
    this.vel.y = Math.max(this.vel.y, 4);
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.screen = "dead";
      if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    }
    this.pushUI(true);
  }

  // ---------- physics ----------

  private solidAt(x: number, y: number, z: number) {
    return this.world.isSolidAt(x, y, z, true);
  }

  private updatePlayer(dt: number) {
    if (this.dead) return;
    this.hurtCd -= dt;
    this.attackCd -= dt;

    const sprint = this.keys.has("ControlLeft") || this.keys.has("ControlRight");
    const fwd = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0);
    const str = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let wx = -sin * fwd + cos * str;
    let wz = -cos * fwd - sin * str;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx /= wl; wz /= wl; }

    this.inWater = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.3), Math.floor(this.pos.z)) === B.WATER;

    let speed = this.flying ? (sprint ? 17 : 9.5) : sprint ? 5.7 : 4.3;
    if (this.inWater && !this.flying) speed *= 0.55;

    this.vel.x += (wx * speed - this.vel.x) * Math.min(1, dt * 13);
    this.vel.z += (wz * speed - this.vel.z) * Math.min(1, dt * 13);

    if (this.flying) {
      const vy = (this.keys.has("Space") ? 1 : 0) - (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? 1 : 0);
      this.vel.y += (vy * (sprint ? 15 : 8) - this.vel.y) * Math.min(1, dt * 11);
    } else {
      this.vel.y -= 25 * dt;
      if (this.vel.y < -38) this.vel.y = -38;
      if (this.keys.has("Space") && this.onGround) {
        this.vel.y = 8.6;
        this.onGround = false;
      }
      if (this.inWater) {
        this.vel.y = Math.max(this.vel.y, -2.4);
        if (this.keys.has("Space")) this.vel.y = 3.6;
      }
    }

    // integrate + collide
    const hw = P_HALF;
    const wasFalling = this.vel.y;
    let movingSpeed = 0;

    this.pos.y += this.vel.y * dt;
    this.onGround = false;
    {
      const x0 = Math.floor(this.pos.x - hw + 0.01), x1 = Math.floor(this.pos.x + hw - 0.01);
      const z0 = Math.floor(this.pos.z - hw + 0.01), z1 = Math.floor(this.pos.z + hw - 0.01);
      if (this.vel.y <= 0) {
        const by = Math.floor(this.pos.y);
        let hit = false;
        for (let bx = x0; bx <= x1 && !hit; bx++)
          for (let bz = z0; bz <= z1 && !hit; bz++) if (this.solidAt(bx, by, bz)) hit = true;
        if (hit) {
          this.pos.y = by + 1;
          this.vel.y = 0;
          this.onGround = true;
          if (wasFalling < -9) this.sfx.noise(0.08, 0.09, 320);
        }
      } else {
        const ty = Math.floor(this.pos.y + P_HEIGHT);
        let hit = false;
        for (let bx = x0; bx <= x1 && !hit; bx++)
          for (let bz = z0; bz <= z1 && !hit; bz++) if (this.solidAt(bx, ty, bz)) hit = true;
        if (hit) {
          this.pos.y = ty - P_HEIGHT - 0.001;
          this.vel.y = 0;
        }
      }
    }

    const axisCollide = (axis: "x" | "z") => {
      const v = this.vel[axis];
      if (v === 0) return;
      this.pos[axis] += v * dt;
      const yA = Math.floor(this.pos.y + 0.02), yB = Math.floor(this.pos.y + P_HEIGHT - 0.02);
      const plane = Math.floor(this.pos[axis] + (v > 0 ? hw : -hw));
      const c0 = Math.floor(this.pos[axis === "x" ? "z" : "x"] - hw + 0.01);
      const c1 = Math.floor(this.pos[axis === "x" ? "z" : "x"] + hw - 0.01);
      for (let by = yA; by <= yB; by++)
        for (let c = c0; c <= c1; c++) {
          const solid = axis === "x" ? this.solidAt(plane, by, c) : this.solidAt(c, by, plane);
          if (solid) {
            this.pos[axis] = v > 0 ? plane - hw - 0.001 : plane + 1 + hw + 0.001;
            this.vel[axis] = 0;
            return;
          }
        }
    };
    axisCollide("x");
    axisCollide("z");

    movingSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (movingSpeed > 0.5) this.bobT += dt * (4 + movingSpeed * 1.4);

    // fall damage
    if (!this.onGround && !this.flying && this.vel.y < 0) this.fallDist += -this.vel.y * dt;
    if (this.onGround) {
      if (this.fallDist > 3.6 && this.mode === "survival") {
        const dmg = Math.floor(this.fallDist - 3) * 2;
        if (dmg > 0) {
          this.hurtCd = 0;
          this.damagePlayer(dmg, this.pos.clone().add(new THREE.Vector3(0, -1, 0)));
          this.toast("Ouch! Fall damage");
        }
      }
      this.fallDist = 0;
    }

    // survival vitals
    if (this.mode === "survival") {
      this.hungerT += dt;
      if (this.hungerT > 45) {
        this.hungerT = 0;
        this.hunger = Math.max(0, this.hunger - 1);
        this.pushUI(true);
      }
      if (this.hunger >= 18 && this.health < 20) {
        this.regenT += dt;
        if (this.regenT > 3.5) { this.regenT = 0; this.health = Math.min(20, this.health + 1); this.pushUI(true); }
      } else this.regenT = 0;
      if (this.hunger === 0) {
        this.starveT += dt;
        if (this.starveT > 4) {
          this.starveT = 0;
          this.hurtCd = 0;
          this.damagePlayer(1, this.pos.clone().add(new THREE.Vector3(0, -1, 0)));
        }
      } else this.starveT = 0;
    }

    if (this.pos.y < -24) {
      this.pos.copy(this.spawn);
      this.vel.set(0, 0, 0);
      if (this.mode === "survival") { this.hurtCd = 0; this.damagePlayer(6, this.pos.clone().add(new THREE.Vector3(0, -1, 0))); }
    }
  }

  // ---------- breaking loop ----------

  private updateBreaking(dt: number) {
    if (!this.mouseL || !this.locked || this.screen !== "none" || this.dead) return;
    if (this.mode === "creative") return;
    const hit = this.raycastVoxel(REACH);
    if (!hit) { this.breakProgress = 0; this.breakTarget = null; return; }
    if (!this.breakTarget || this.breakTarget.x !== hit.x || this.breakTarget.y !== hit.y || this.breakTarget.z !== hit.z) {
      this.breakTarget = hit;
      this.breakProgress = 0;
    }
    const def = BLOCKS[hit.id];
    if (!def || def.hard < 0) return;
    const tool = this.toolOf(this.inv.selectedStack());
    let mult = 1;
    if (tool) {
      if (def.tool === "pickaxe" && tool.kind === "pickaxe") mult = tool.speed;
      else if (def.tool === "axe" && tool.kind === "axe") mult = tool.speed;
      else if (def.tool === "shovel" && tool.kind === "axe") mult = tool.speed * 0.75;
      else if (tool.kind === "sword") mult = 1.4;
    }
    if (def.tool === "pickaxe" && (!tool || tool.kind !== "pickaxe")) mult = 0.3;
    this.breakProgress += (dt * mult) / Math.max(0.08, def.hard);
    this.crackT -= dt;
    if (this.crackT <= 0) {
      this.crackT = 0.22;
      this.sfx.tone(260 + this.breakProgress * 260, 0.035, "square", 0.03);
    }
    if (this.breakProgress >= 1) {
      this.breakProgress = 0;
      this.breakTarget = null;
      this.breakBlock(hit);
    }
  }

  // ---------- mobs ----------

  private isNight() {
    return this.daylight < 0.45;
  }

  private updateMobs(dt: number) {
    this.mobSpawnT -= dt;
    if (this.mobSpawnT <= 0 && this.mobs.length < 15) {
      this.mobSpawnT = 2.2;
      this.trySpawnMob();
    }
    const night = this.isNight();
    const ctx = {
      dt,
      playerPos: this.pos,
      playerAlive: !this.dead && this.screen === "none" && !this.paused,
      getSolid: (x: number, y: number, z: number) => this.world.isSolidAt(x, y, z, false),
      damagePlayer: (d: number, f: THREE.Vector3) => this.damagePlayer(d, f),
      explodeAt: (p: THREE.Vector3) => this.explodeAt(p),
      sfx: { fuse: () => this.sfx.fuse() },
    };
    for (const m of this.mobs) {
      if (m.dead) continue;
      if (!night && m.type === "zombie") {
        m.hp -= 2.5 * dt;
        m.flash = 0.12;
        if (Math.random() < dt * 6) this.spawnBurst(m.pos.x, m.pos.y + m.h * 0.7, m.pos.z, "#f0a03a", 1);
        if (m.hp <= 0) { m.dead = true; this.spawnBurst(m.pos.x, m.pos.y + 1, m.pos.z, "#8a8a8a", 8); continue; }
      }
      m.update(dt, ctx);
    }
    // cleanup
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const d = m.pos.distanceTo(this.pos);
      if (m.dead || d > 64 || m.pos.y < -10) {
        this.scene.remove(m.group);
        this.mobs.splice(i, 1);
      }
    }
  }

  private trySpawnMob() {
    const ang = Math.random() * Math.PI * 2;
    const dist = 18 + Math.random() * 18;
    const x = Math.floor(this.pos.x + Math.cos(ang) * dist);
    const z = Math.floor(this.pos.z + Math.sin(ang) * dist);
    const y = this.world.heightAt(x, z);
    if (y <= SEA + 1 || y > HEIGHT - 6) return;
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    if (!this.world.chunks.has(World.key(cx, cz))) return;
    const night = this.isNight();
    const bio = this.world.biomeAt(x, z);
    let type: MobType;
    if (night) {
      type = Math.random() < 0.6 ? "zombie" : "creeper";
    } else {
      if (bio === "desert") return;
      const pool: MobType[] =
        bio === "snowy" ? ["sheep", "sheep", "pig"] :
        bio === "forest" ? ["pig", "chicken", "sheep", "cow"] :
        ["pig", "cow", "sheep", "chicken"];
      type = pool[Math.floor(Math.random() * pool.length)];
      if (this.mobs.filter((m) => !m.hostile).length > 9) return;
    }
    if (this.mobs.filter((m) => m.type === type).length > 6) return;
    const m = new Mob(type, x + 0.5, y + 0.1, z + 0.5);
    this.mobs.push(m);
    this.scene.add(m.group);
  }

  // ---------- particles ----------

  private spawnBurst(x: number, y: number, z: number, color: string, n: number) {
    const mat = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.partGeo, mat);
      m.position.set(x + (Math.random() - 0.5) * 0.5, y + (Math.random() - 0.5) * 0.5, z + (Math.random() - 0.5) * 0.5);
      this.scene.add(m);
      this.parts.push({
        m,
        v: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4 + 1.5, (Math.random() - 0.5) * 4),
        life: 0.5 + Math.random() * 0.5,
        max: 1,
      });
    }
    if (this.parts.length > 220) {
      const extra = this.parts.splice(0, this.parts.length - 220);
      for (const p of extra) { this.scene.remove(p.m); (p.m.material as THREE.Material).dispose(); }
    }
  }

  private updateParts(dt: number) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.m);
        (p.m.material as THREE.Material).dispose();
        this.parts.splice(i, 1);
        continue;
      }
      p.v.y -= 16 * dt;
      p.m.position.addScaledVector(p.v, dt);
      const s = Math.min(1, p.life * 2.4);
      p.m.scale.setScalar(s);
    }
  }

  // ---------- chunk streaming ----------

  private markDirtyAt(x: number, z: number) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    this.dirty.add(World.key(cx, cz));
    const lx = ((x % CHUNK) + CHUNK) % CHUNK;
    const lz = ((z % CHUNK) + CHUNK) % CHUNK;
    if (lx === 0) this.dirty.add(World.key(cx - 1, cz));
    if (lx === CHUNK - 1) this.dirty.add(World.key(cx + 1, cz));
    if (lz === 0) this.dirty.add(World.key(cx, cz - 1));
    if (lz === CHUNK - 1) this.dirty.add(World.key(cx, cz + 1));
  }

  private rebuildChunk(cx: number, cz: number) {
    const key = World.key(cx, cz);
    if (!this.world.chunks.has(key)) return;
    const old = this.meshes.get(key);
    if (old) {
      if (old.solid) { this.scene.remove(old.solid); old.solid.geometry.dispose(); }
      if (old.water) { this.scene.remove(old.water); old.water.geometry.dispose(); }
    }
    const { solid, water } = buildChunkMeshes(this.world, cx, cz);
    const entry: { solid?: THREE.Mesh; water?: THREE.Mesh } = {};
    if (solid) {
      entry.solid = new THREE.Mesh(solid, this.solidMat);
      entry.solid.matrixAutoUpdate = false;
      this.scene.add(entry.solid);
    }
    if (water) {
      entry.water = new THREE.Mesh(water, this.waterMat);
      entry.water.matrixAutoUpdate = false;
      entry.water.renderOrder = 2;
      this.scene.add(entry.water);
    }
    this.meshes.set(key, entry);
    this.loaded.add(key);
  }

  private streamChunks() {
    const pcx = Math.floor(this.pos.x / CHUNK);
    const pcz = Math.floor(this.pos.z / CHUNK);

    // generate missing
    const missing: { k: string; cx: number; cz: number; d: number }[] = [];
    for (let dx = -VIEW; dx <= VIEW; dx++)
      for (let dz = -VIEW; dz <= VIEW; dz++) {
        const cx = pcx + dx, cz = pcz + dz;
        const k = World.key(cx, cz);
        if (!this.loaded.has(k)) missing.push({ k, cx, cz, d: dx * dx + dz * dz });
      }
    missing.sort((a, b) => a.d - b.d);
    let budget = 2;
    for (const m of missing) {
      if (budget <= 0) break;
      this.world.generate(m.cx, m.cz);
      this.dirty.add(m.k);
      budget--;
    }

    // mesh dirty
    let meshBudget = 4;
    for (const k of this.dirty) {
      if (meshBudget <= 0) break;
      this.dirty.delete(k);
      const [cx, cz] = k.split(",").map(Number);
      const d = (cx - pcx) ** 2 + (cz - pcz) ** 2;
      if (d <= (VIEW + 1) ** 2) {
        this.rebuildChunk(cx, cz);
        meshBudget--;
      }
    }

    // unload far
    for (const k of this.loaded) {
      const [cx, cz] = k.split(",").map(Number);
      if ((cx - pcx) ** 2 + (cz - pcz) ** 2 > (VIEW + 2) ** 2) {
        const entry = this.meshes.get(k);
        if (entry) {
          if (entry.solid) { this.scene.remove(entry.solid); entry.solid.geometry.dispose(); }
          if (entry.water) { this.scene.remove(entry.water); entry.water.geometry.dispose(); }
          this.meshes.delete(k);
        }
        this.loaded.delete(k);
        this.world.chunks.delete(k);
      }
    }
  }

  // ---------- atmosphere ----------

  private updateSky(dt: number) {
    this.time = (this.time + dt / 300) % 1;
    const ang = this.time * Math.PI * 2 - Math.PI / 2;
    const elev = Math.sin(ang);
    this.daylight = clamp(elev * 2.4 + 0.35, 0, 1);

    const night = new THREE.Color(0x070b1c);
    const day = new THREE.Color(0x7fa6f7);
    const sky = night.clone().lerp(day, this.daylight);
    const dusk = 1 - clamp(Math.abs(elev) / 0.22, 0, 1);
    sky.lerp(new THREE.Color(0xff9a5c), dusk * 0.45);
    (this.scene.background as THREE.Color).copy(sky);
    this.fog.color.copy(sky);

    this.sunLight.intensity = 0.2 + 0.85 * this.daylight;
    this.sunLight.position.set(Math.cos(ang) * 80, Math.max(8, Math.sin(ang) * 80), 35);
    this.ambLight.intensity = 0.34 + 0.3 * this.daylight;
    this.starMat.opacity = (1 - this.daylight) * 0.9;

    this.sunMesh.position.set(Math.cos(ang) * 260, Math.sin(ang) * 260, -140);
    this.moonMesh.position.set(-Math.cos(ang) * 260, -Math.sin(ang) * 260, -140);
    this.sunMesh.visible = elev > -0.3;
    this.moonMesh.visible = elev < 0.3;
  }

  // ---------- hand & camera ----------

  private updateHand() {
    const held = this.inv.selectedStack();
    const id = held ? held.id : -1;
    if (id !== this.handId) {
      this.handId = id;
      while (this.handGroup.children.length) {
        const c = this.handGroup.children[0] as THREE.Mesh;
        this.handGroup.remove(c);
        c.geometry?.dispose();
        if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
        else c.material?.dispose();
      }
      if (id >= 0) {
        const img = new Image();
        img.src = getIcon(id);
        const tex = new THREE.Texture(img);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.colorSpace = THREE.SRGBColorSpace;
        img.onload = () => { tex.needsUpdate = true; };
        if (isBlockId(id)) {
          const mat = new THREE.MeshLambertMaterial({ map: tex });
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat);
          mesh.position.set(0, 0, -0.1);
          mesh.rotation.set(0.4, -0.5, 0);
          this.handGroup.add(mesh);
        } else {
          const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
          const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), mat);
          mesh.position.set(0, 0.05, -0.1);
          mesh.rotation.set(0, -0.6, -0.4);
          this.handGroup.add(mesh);
        }
      } else {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.3), new THREE.MeshLambertMaterial({ color: 0xd8a878 }));
        mesh.position.set(0, 0, -0.05);
        this.handGroup.add(mesh);
      }
    }
    this.swingT = Math.max(0, this.swingT - 0.016);
    const k = this.swingT > 0 ? Math.sin(((0.26 - this.swingT) / 0.26) * Math.PI) : 0;
    const bob = Math.sin(this.bobT) * 0.018;
    this.handGroup.rotation.x = -k * 0.9;
    this.handGroup.position.set(0.52, -0.5 + bob, -0.85 + k * 0.12);
  }

  // ---------- save / load ----------

  saveWorld() {
    try {
      const data = {
        v: 1,
        edits: [...this.world.edits.entries()],
        pos: [this.pos.x, this.pos.y, this.pos.z],
        spawn: [this.spawn.x, this.spawn.y, this.spawn.z],
        yaw: this.yaw,
        health: this.health,
        hunger: this.hunger,
        time: this.time,
        mode: this.mode,
        flying: this.flying,
        inv: this.inv.serialize(),
      };
      localStorage.setItem(saveKey(this.meta.seed), JSON.stringify(data));
    } catch {
      /* quota exceeded — skip */
    }
  }

  private loadSave() {
    try {
      const raw = localStorage.getItem(saveKey(this.meta.seed));
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.v !== 1) return;
      if (Array.isArray(d.edits)) for (const [k, v] of d.edits as [string, number][]) this.world.edits.set(k, v);
      if (Array.isArray(d.pos) && d.pos.length === 3) {
        this.pos.set(d.pos[0], d.pos[1], d.pos[2]);
        this.loadedSavePos = true;
      }
      if (Array.isArray(d.spawn) && d.spawn.length === 3) this.spawn.set(d.spawn[0], d.spawn[1], d.spawn[2]);
      if (typeof d.yaw === "number") this.yaw = d.yaw;
      if (typeof d.health === "number") this.health = d.health;
      if (typeof d.hunger === "number") this.hunger = d.hunger;
      if (typeof d.time === "number") this.time = d.time;
      if (d.mode === "creative" || d.mode === "survival") this.mode = d.mode;
      if (typeof d.flying === "boolean") this.flying = d.flying && this.mode === "creative";
      if (d.inv) this.inv.restore(d.inv);
    } catch {
      /* corrupted save — ignore */
    }
  }

  // ---------- UI sync ----------

  toast(text: string) {
    this.toastText = text;
    this.toastId++;
    this.pushUI(true);
  }

  private pushUI(force = false) {
    if (!force && this.uiT < 0.15) return;
    this.uiT = 0;
    const bx = Math.floor(this.pos.x), bz = Math.floor(this.pos.z);
    const biome = this.started ? this.world.biomeAt(bx, bz) : "plains";
    this.cb.onUI({
      mode: this.mode,
      health: Math.ceil(this.health),
      hunger: this.hunger,
      hotbar: this.inv.slots.slice(27).map((s) => (s ? { ...s } : null)),
      selected: this.inv.hotbarIndex,
      flying: this.flying,
      paused: this.paused,
      screen: this.screen,
      toastText: this.toastText,
      toastId: this.toastId,
      hurtId: this.hurtId,
      fps: this.fps,
      pos: [Math.round(this.pos.x * 10) / 10, Math.round(this.pos.y * 10) / 10, Math.round(this.pos.z * 10) / 10],
      biome,
      debug: this.debug,
      day: this.time,
      worldName: this.meta.name,
    });
  }

  private pushInv() {
    this.cb.onInv({
      slots: this.inv.slots.map((s) => (s ? { ...s } : null)),
      craft: this.inv.craft.slice(0, 9).map((s) => (s ? { ...s } : null)),
      craftSize: this.inv.craftSize,
      cursor: this.inv.cursor ? { ...this.inv.cursor } : null,
      result: this.inv.resultStack(),
      mode: this.mode,
    });
  }

  // ---------- main loop ----------

  private tick(dt: number) {
    this.fpsFrames++;
    this.fpsT += dt;
    if (this.fpsT >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsT);
      this.fpsFrames = 0;
      this.fpsT = 0;
    }
    this.uiT += dt;

    const simming = this.started && !this.paused && this.screen === "none" && !this.dead;

    if (simming) {
      this.simT += dt;
      this.streamChunks();
      this.updatePlayer(dt);
      this.updateBreaking(dt);
      this.updateMobs(dt);
      this.saveT += dt;
      if (this.saveT > 25) { this.saveT = 0; this.saveWorld(); }
      // pending explosions
      for (let i = this.pendingBooms.length - 1; i >= 0; i--) {
        if (this.simT >= this.pendingBooms[i].t) {
          const p = this.pendingBooms[i].p;
          this.pendingBooms.splice(i, 1);
          this.explodeAt(p);
        }
      }
    }

    this.updateSky(simming ? dt : 0);
    this.updateParts(dt);
    this.updateHand();

    // highlight target block
    let showHl = false;
    if (this.locked && this.screen === "none" && !this.paused && !this.dead) {
      const hit = this.raycastVoxel(REACH);
      if (hit) {
        this.highlight.visible = true;
        this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
        showHl = true;
      }
    }
    if (!showHl) this.highlight.visible = false;

    // break overlay feedback: scale pulse on highlight
    if (this.breakProgress > 0 && this.breakTarget) {
      const s = 1 - this.breakProgress * 0.12;
      this.highlight.scale.setScalar(s);
    } else this.highlight.scale.setScalar(1);

    // camera
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const sh = this.shake * this.shake * 0.06;
    this.camera.position.set(this.pos.x, this.pos.y + EYE, this.pos.z);
    this.camera.rotation.set(
      this.pitch + (Math.random() - 0.5) * sh,
      this.yaw + (Math.random() - 0.5) * sh,
      (Math.random() - 0.5) * sh * 0.5,
    );
    const sprinting = this.keys.has("ControlLeft") || this.keys.has("ControlRight");
    const targetFov = this.flying ? 82 : sprinting ? 80 : 75;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 8);
    this.camera.updateProjectionMatrix();

    this.pushUI();
    this.renderer.render(this.scene, this.camera);
  }
}
