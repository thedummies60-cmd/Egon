import * as THREE from "three";
import { mulberry32 } from "./util";

export type MobType = "pig" | "cow" | "sheep" | "chicken" | "zombie" | "creeper";

export interface MobCtx {
  dt: number;
  playerPos: THREE.Vector3;
  playerAlive: boolean;
  getSolid: (x: number, y: number, z: number) => boolean;
  damagePlayer: (dmg: number, from: THREE.Vector3) => void;
  explodeAt: (p: THREE.Vector3) => void;
  sfx: { fuse(): void };
}

// ---------- textures ----------

const texCache = new Map<string, THREE.CanvasTexture>();

function canvasTex(key: string, draw: (ctx: CanvasRenderingContext2D, rnd: () => number) => void): THREE.CanvasTexture {
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext("2d")!;
  draw(ctx, mulberry32(key.length * 7919 + key.charCodeAt(0)));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

const speck = (ctx: CanvasRenderingContext2D, rnd: () => number, base: string, cols: string[], n: number) => {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 16, 16);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = cols[(rnd() * cols.length) | 0];
    ctx.fillRect((rnd() * 16) | 0, (rnd() * 16) | 0, 1, 1);
  }
};

const skin = (key: string, base: string, cols: string[]): THREE.Texture =>
  canvasTex("s_" + key, (ctx, rnd) => speck(ctx, rnd, base, cols, 42));

function faceTex(key: string, base: string, cols: string[], draw: (ctx: CanvasRenderingContext2D) => void): THREE.Texture {
  return canvasTex("f_" + key, (ctx, rnd) => {
    speck(ctx, rnd, base, cols, 30);
    draw(ctx);
  });
}

const FACES: Record<MobType, THREE.Texture> = {
  pig: faceTex("pig", "#f0a5a2", ["#e89a97", "#f5b0ad"], (c) => {
    c.fillStyle = "#2c1a1a"; c.fillRect(3, 7, 2, 2); c.fillRect(11, 7, 2, 2);
    c.fillStyle = "#d98c89"; c.fillRect(5, 10, 6, 4);
    c.fillStyle = "#a86a67"; c.fillRect(6, 11, 1, 2); c.fillRect(9, 11, 1, 2);
  }),
  cow: faceTex("cow", "#6b4a2f", ["#5f4129", "#77532f"], (c) => {
    c.fillStyle = "#e8e4dc"; c.fillRect(1, 0, 5, 4); c.fillRect(10, 1, 5, 3);
    c.fillStyle = "#1e1410"; c.fillRect(3, 7, 2, 2); c.fillRect(11, 7, 2, 2);
    c.fillStyle = "#c9a08a"; c.fillRect(3, 10, 10, 5);
    c.fillStyle = "#8a6a55"; c.fillRect(5, 12, 1, 2); c.fillRect(10, 12, 1, 2);
  }),
  sheep: faceTex("sheep", "#9c8f80", ["#8f8274", "#a89b8c"], (c) => {
    c.fillStyle = "#1e1a14"; c.fillRect(3, 7, 2, 2); c.fillRect(11, 7, 2, 2);
    c.fillStyle = "#c9a49a"; c.fillRect(6, 10, 4, 3);
    c.fillStyle = "#e8e4dc"; c.fillRect(0, 0, 16, 3); c.fillRect(0, 0, 2, 7); c.fillRect(14, 0, 2, 7);
  }),
  chicken: faceTex("chicken", "#e8e8e8", ["#dcdcdc", "#f2f2f2"], (c) => {
    c.fillStyle = "#1e1e1e"; c.fillRect(4, 6, 2, 2); c.fillRect(10, 6, 2, 2);
    c.fillStyle = "#e8a23c"; c.fillRect(6, 9, 4, 3);
    c.fillStyle = "#c83c3c"; c.fillRect(7, 12, 2, 2);
  }),
  zombie: faceTex("zombie", "#3f7d3a", ["#377233", "#488a42"], (c) => {
    c.fillStyle = "#101c10"; c.fillRect(3, 6, 3, 3); c.fillRect(10, 6, 3, 3);
    c.fillStyle = "#1e3a1c"; c.fillRect(4, 7, 1, 1); c.fillRect(11, 7, 1, 1);
    c.fillStyle = "#2a5528"; c.fillRect(5, 11, 6, 2);
    c.fillStyle = "#1e3a1c"; c.fillRect(6, 12, 1, 1); c.fillRect(9, 12, 1, 1);
  }),
  creeper: faceTex("creeper", "#58b447", ["#4aa53e", "#63c050", "#3c9332"], (c) => {
    c.fillStyle = "#0e240c";
    c.fillRect(2, 6, 4, 4); c.fillRect(10, 6, 4, 4);
    c.fillRect(6, 9, 4, 3); c.fillRect(4, 11, 2, 4); c.fillRect(10, 11, 2, 4);
    c.fillRect(6, 13, 4, 2);
  }),
};

const SKINS: Record<MobType, THREE.Texture> = {
  pig: skin("pig", "#f0a5a2", ["#e89a97", "#f5b0ad", "#dd908d"]),
  cow: canvasTex("s_cow", (ctx, rnd) => {
    speck(ctx, rnd, "#6b4a2f", ["#5f4129", "#77532f"], 36);
    ctx.fillStyle = "#e8e4dc";
    ctx.fillRect(2 + ((rnd() * 6) | 0), 3 + ((rnd() * 5) | 0), 4, 3);
    ctx.fillRect(8 + ((rnd() * 5) | 0), 8 + ((rnd() * 4) | 0), 3, 3);
  }),
  sheep: skin("wool", "#e8e8e8", ["#dcdcdc", "#f2f2f2", "#d4d4d4"]),
  chicken: skin("feather", "#e8e8e8", ["#dcdcdc", "#f4f4f4"]),
  zombie: skin("zombie", "#3f7d3a", ["#377233", "#488a42"]),
  creeper: skin("creeper", "#4aa53e", ["#3c9332", "#58b447", "#2f7d27"]),
};

const lambert = (map: THREE.Texture) => new THREE.MeshLambertMaterial({ map });

function box(
  w: number, h: number, d: number, m: THREE.Material,
  x: number, y: number, z: number, pivotTop = false,
): THREE.Mesh {
  const g = new THREE.BoxGeometry(w, h, d);
  if (pivotTop) g.translate(0, -h / 2, 0);
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, y, z);
  return mesh;
}

export interface MobModel {
  group: THREE.Group;
  legs: THREE.Mesh[];
  arms: THREE.Mesh[];
  mats: THREE.MeshLambertMaterial[];
  w: number;
  h: number;
  hp: number;
  hostile: boolean;
}

export function buildMobModel(type: MobType): MobModel {
  const g = new THREE.Group();
  const legs: THREE.Mesh[] = [];
  const arms: THREE.Mesh[] = [];
  const bodyMat = lambert(SKINS[type]);
  const faceMat = lambert(FACES[type]);
  const mats = [bodyMat, faceMat];
  const headOf = (s: number, x: number, y: number, z: number) =>
    new THREE.Mesh(new THREE.BoxGeometry(s, s, s), [bodyMat, bodyMat, bodyMat, bodyMat, faceMat, bodyMat]);

  let w = 0.9, h = 1, hp = 10, hostile = false;

  if (type === "pig") {
    for (const [lx, lz] of [[-0.27, -0.4], [0.27, -0.4], [-0.27, 0.4], [0.27, 0.4]])
      legs.push(box(0.24, 0.36, 0.24, bodyMat, lx, 0.36, lz, true));
    g.add(box(0.85, 0.55, 1.1, bodyMat, 0, 0.64, 0));
    const head = headOf(0.5, 0, 0.9, 0.72);
    g.add(head);
    g.add(box(0.26, 0.18, 0.1, lambert(FACES.pig), 0, 0.84, 1.0));
    h = 1.05;
  } else if (type === "cow") {
    const legMat = lambert(SKINS.cow);
    for (const [lx, lz] of [[-0.32, -0.48], [0.32, -0.48], [-0.32, 0.48], [0.32, 0.48]])
      legs.push(box(0.26, 0.52, 0.26, legMat, lx, 0.52, lz, true));
    g.add(box(0.95, 0.7, 1.35, bodyMat, 0, 0.88, 0));
    g.add(headOf(0.5, 0, 1.3, 0.85));
    const hornMat = new THREE.MeshLambertMaterial({ color: "#d8d0c0" });
    g.add(box(0.08, 0.18, 0.08, hornMat, -0.22, 1.6, 0.85));
    g.add(box(0.08, 0.18, 0.08, hornMat, 0.22, 1.6, 0.85));
    mats.push(legMat, hornMat);
    w = 1.0; h = 1.5;
  } else if (type === "sheep") {
    const legMat = new THREE.MeshLambertMaterial({ color: "#9c8f80" });
    for (const [lx, lz] of [[-0.3, -0.42], [0.3, -0.42], [-0.3, 0.42], [0.3, 0.42]])
      legs.push(box(0.24, 0.5, 0.24, legMat, lx, 0.5, lz, true));
    g.add(box(1.0, 0.75, 1.15, bodyMat, 0, 0.9, 0));
    const head = headOf(0.42, 0, 1.22, 0.68);
    g.add(head);
    mats.push(legMat);
    w = 1.0; h = 1.4; hp = 8;
  } else if (type === "chicken") {
    const legMat = new THREE.MeshLambertMaterial({ color: "#e8a23c" });
    for (const lx of [-0.09, 0.09]) legs.push(box(0.06, 0.26, 0.06, legMat, lx, 0.26, 0, true));
    g.add(box(0.4, 0.4, 0.5, bodyMat, 0, 0.5, 0));
    g.add(box(0.05, 0.28, 0.4, bodyMat, -0.23, 0.52, 0));
    g.add(box(0.05, 0.28, 0.4, bodyMat, 0.23, 0.52, 0));
    g.add(headOf(0.28, 0, 0.84, 0.14));
    const combMat = new THREE.MeshLambertMaterial({ color: "#c83c3c" });
    g.add(box(0.08, 0.09, 0.12, combMat, 0, 1.0, 0.14));
    mats.push(legMat, combMat);
    w = 0.45; h = 0.95; hp = 4;
  } else if (type === "zombie") {
    hostile = true;
    const pantsMat = new THREE.MeshLambertMaterial({ color: "#4a3b6b" });
    const shirtMat = new THREE.MeshLambertMaterial({ color: "#2a6b6b" });
    for (const lx of [-0.15, 0.15]) legs.push(box(0.27, 0.7, 0.27, pantsMat, lx, 0.7, 0, true));
    g.add(box(0.55, 0.7, 0.3, shirtMat, 0, 1.05, 0));
    for (const ax of [-0.41, 0.41]) {
      const arm = box(0.24, 0.66, 0.24, bodyMat, ax, 1.36, 0.3, true);
      arm.rotation.x = -1.35;
      arms.push(arm);
    }
    g.add(headOf(0.5, 0, 1.66, 0));
    mats.push(pantsMat, shirtMat);
    w = 0.65; h = 1.9; hp = 20;
  } else {
    // creeper
    hostile = true;
    for (const [lx, lz] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]])
      legs.push(box(0.28, 0.4, 0.28, bodyMat, lx, 0.4, lz, true));
    g.add(box(0.55, 0.8, 0.3, bodyMat, 0, 0.8, 0));
    g.add(headOf(0.5, 0, 1.46, 0));
    w = 0.6; h = 1.7; hp = 20;
  }

  for (const l of legs) g.add(l);
  for (const a of arms) g.add(a);
  return { group: g, legs, arms, mats, w, h, hp, hostile };
}

// ---------- mob entity ----------

const wrapAngle = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export class Mob {
  type: MobType;
  group: THREE.Group;
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw: number;
  hp: number;
  w: number;
  h: number;
  hostile: boolean;
  onGround = false;
  dead = false;
  flash = 0;
  fuse = -1;
  fuseSounded = false;
  attackCd = 0;
  private legs: THREE.Mesh[];
  private arms: THREE.Mesh[];
  private mats: THREE.MeshLambertMaterial[];
  private wanderT = Math.random() * 2;
  private moving = false;
  private targetYaw = 0;
  private animT = Math.random() * 10;

  constructor(type: MobType, x: number, y: number, z: number) {
    this.type = type;
    const m = buildMobModel(type);
    this.group = m.group;
    this.legs = m.legs;
    this.arms = m.arms;
    this.mats = m.mats;
    this.w = m.w;
    this.h = m.h;
    this.hp = m.hp;
    this.hostile = m.hostile;
    this.pos.set(x, y, z);
    this.yaw = Math.random() * Math.PI * 2;
    this.group.position.copy(this.pos);
  }

  hurt(dmg: number, from: THREE.Vector3) {
    this.hp -= dmg;
    this.flash = 0.3;
    const dx = this.pos.x - from.x;
    const dz = this.pos.z - from.z;
    const d = Math.max(0.1, Math.hypot(dx, dz));
    this.vel.x += (dx / d) * 6;
    this.vel.z += (dz / d) * 6;
    this.vel.y = Math.max(this.vel.y, 4.5);
    if (this.hostile) {
      this.targetYaw = Math.atan2(-dx, -dz);
      this.moving = true;
    }
  }

  update(dt: number, ctx: MobCtx) {
    if (this.dead) return;
    this.animT += dt;
    this.attackCd -= dt;
    this.flash = Math.max(0, this.flash - dt * 2.5);

    const px = ctx.playerPos.x - this.pos.x;
    const pz = ctx.playerPos.z - this.pos.z;
    const dist = Math.hypot(px, pz);

    let speed = 0;

    if (this.hostile && ctx.playerAlive) {
      if (this.type === "creeper") {
        if (dist < 16) {
          this.targetYaw = Math.atan2(px, pz);
          speed = dist > 2.4 ? 2.7 : 0;
        }
        if (dist < 2.7) {
          if (!this.fuseSounded) {
            ctx.sfx.fuse();
            this.fuseSounded = true;
          }
          this.fuse += dt;
          speed = 0;
          if (this.fuse > 1.25) {
            ctx.explodeAt(this.pos.clone().add(new THREE.Vector3(0, 0.8, 0)));
            this.dead = true;
            return;
          }
        } else if (this.fuse > 0) {
          this.fuse = Math.max(0, this.fuse - dt * 1.5);
          if (this.fuse === 0) this.fuseSounded = false;
        }
      } else {
        // zombie
        if (dist < 18) {
          this.targetYaw = Math.atan2(px, pz);
          speed = 2.4;
          if (dist < 1.6 && Math.abs(ctx.playerPos.y - this.pos.y) < 1.5 && this.attackCd <= 0) {
            ctx.damagePlayer(4, this.pos);
            this.attackCd = 1.1;
          }
        }
      }
    }

    if (speed === 0) {
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = 2 + Math.random() * 4;
        if (Math.random() < 0.4) this.moving = false;
        else {
          this.moving = true;
          this.targetYaw = Math.random() * Math.PI * 2;
        }
      }
      speed = this.moving ? 1.0 : 0;
    } else {
      this.moving = true;
    }

    const dy = wrapAngle(this.targetYaw - this.yaw);
    this.yaw += dy * Math.min(1, dt * 5);
    this.vel.x = Math.sin(this.yaw) * speed;
    this.vel.z = Math.cos(this.yaw) * speed;

    // physics
    this.vel.y -= 24 * dt;
    if (this.vel.y < -35) this.vel.y = -35;
    const hw = this.w / 2 - 0.02;

    this.pos.y += this.vel.y * dt;
    this.onGround = false;
    const x0 = Math.floor(this.pos.x - hw), x1 = Math.floor(this.pos.x + hw);
    const z0 = Math.floor(this.pos.z - hw), z1 = Math.floor(this.pos.z + hw);
    if (this.vel.y <= 0) {
      const by = Math.floor(this.pos.y);
      let hit = false;
      for (let bx = x0; bx <= x1 && !hit; bx++)
        for (let bz = z0; bz <= z1 && !hit; bz++) if (ctx.getSolid(bx, by, bz)) hit = true;
      if (hit) {
        this.pos.y = by + 1;
        this.vel.y = 0;
        this.onGround = true;
      }
    } else {
      const ty = Math.floor(this.pos.y + this.h);
      let hit = false;
      for (let bx = x0; bx <= x1 && !hit; bx++)
        for (let bz = z0; bz <= z1 && !hit; bz++) if (ctx.getSolid(bx, ty, bz)) hit = true;
      if (hit) {
        this.pos.y = ty - this.h - 0.001;
        this.vel.y = 0;
      }
    }

    let blocked = false;
    this.pos.x += this.vel.x * dt;
    {
      const yA = Math.floor(this.pos.y + 0.05), yB = Math.floor(this.pos.y + this.h - 0.05);
      const bx = Math.floor(this.pos.x + (this.vel.x > 0 ? hw : -hw));
      outer: for (let by = yA; by <= yB; by++)
        for (let bz = z0; bz <= z1; bz++)
          if (ctx.getSolid(bx, by, bz)) {
            this.pos.x = this.vel.x > 0 ? bx - hw - 0.001 : bx + 1 + hw + 0.001;
            blocked = true;
            break outer;
          }
    }
    this.pos.z += this.vel.z * dt;
    {
      const yA = Math.floor(this.pos.y + 0.05), yB = Math.floor(this.pos.y + this.h - 0.05);
      const bz = Math.floor(this.pos.z + (this.vel.z > 0 ? hw : -hw));
      outer2: for (let by = yA; by <= yB; by++)
        for (let bx = x0; bx <= x1; bx++)
          if (ctx.getSolid(bx, by, bz)) {
            this.pos.z = this.vel.z > 0 ? bz - hw - 0.001 : bz + 1 + hw + 0.001;
            blocked = true;
            break outer2;
          }
    }
    if (blocked && this.onGround) this.vel.y = 7.4;

    // animation
    const swing = this.moving && speed > 0 ? Math.sin(this.animT * 9) * 0.6 : 0;
    this.legs.forEach((l, i) => {
      l.rotation.x = i % 2 === 0 ? swing : -swing;
    });
    this.arms.forEach((a, i) => {
      a.rotation.x = -1.35 + Math.sin(this.animT * 9) * 0.12 * (i === 0 ? 1 : -1);
    });

    // fuse flash
    if (this.type === "creeper" && this.fuse > 0) {
      const pulse = ((Math.sin(this.fuse * 26) + 1) / 2) * Math.min(1, this.fuse * 1.4);
      for (const m of this.mats) m.emissive.setRGB(pulse * 0.9, pulse * 0.9, pulse * 0.9);
    } else {
      for (const m of this.mats) m.emissive.setRGB(this.flash, 0, 0);
    }

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
  }
}
