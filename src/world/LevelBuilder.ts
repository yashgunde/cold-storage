import * as THREE from 'three';
import { Door } from './Door';
import type { CollisionWorld } from './Collision';
import type { GuardOpts } from '../entities/Guard';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Deterministic per-position RNG so desk clutter is stable across reloads. */
const seeded = (x: number, z: number) => {
  let s = (Math.imul(Math.round(x * 137) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(Math.round(z * 77), 0xc2b2ae35)) | 0;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d);
    s = Math.imul(s ^ (s >>> 12), 0x297a2d39);
    return ((s ^ (s >>> 15)) >>> 0) / 4294967296;
  };
};

export interface LevelPalette {
  wall: number;
  accent: number;
  carpetA: string;
  carpetB: string;
  fog: number;
  sun?: number;
  sunIntensity?: number;
  hemiSky?: number;
  hemiGround?: number;
  /** Ceiling tile color (CSS), grid line color, and wall trim color. */
  ceiling?: string;
  ceilingGrid?: string;
  trim?: number;
}

export interface CameraDef { x: number; z: number; facing: number; arc?: number; range?: number; }
export interface LaserDef {
  x0: number; z0: number; x1: number; z1: number;
  /** Sweep amplitude in radians: the far end oscillates ±sweep (rotating beam). */
  sweep?: number;
  /** On/off cycle length in seconds; the beam is safe AND dim while off. */
  blink?: number;
  /** Motion rate — sweep cycles per second. Default 0.4. */
  speed?: number;
}
export interface NoteDef { x: number; z: number; y?: number; text: string; }
export interface PropDef {
  type:
    | 'plant' | 'cooler' | 'copier' | 'crate' | 'table' | 'shelf' | 'counter'
    | 'filing' | 'bookshelf' | 'whiteboard' | 'board' | 'clock' | 'art'
    | 'meeting' | 'sofa' | 'bin' | 'vend';
  x: number;
  z: number;
  /** Yaw in radians — use multiples of PI/2 so colliders stay axis-aligned. */
  rot?: number;
}
export interface DoorDef { hinge: [number, number]; length: number; axis: 'x' | 'z'; locked?: string; swing?: 1 | -1; }
export interface KeycardLevelDef { id: string; x: number; z: number; y?: number; color: number; }
export interface Zone { x: number; z: number; r: number; }

/** A doorway (or open gap) in one wall of a room. */
export interface RoomDoor {
  side: 'N' | 'S' | 'E' | 'W';
  /** Offset of the gap center along the wall, from the wall's center. */
  at?: number;
  width?: number;
  /** True → hinged door in the gap; false/omitted → open gap. */
  door?: boolean;
  locked?: string;
}
/** Rooms generate their own four walls with door gaps. Keep rooms
 *  non-adjacent (leave corridors) so walls never coincide. */
export interface RoomDef { x: number; z: number; w: number; d: number; doors: RoomDoor[]; }

export interface LevelDef {
  id: string;
  name: string;
  floorLabel: string;
  briefing: { from: string; lines: string[] };
  palette: LevelPalette;
  size: [number, number];
  spawn: { x: number; z: number; yaw: number };
  walls: Array<[number, number, number, number]>;
  rooms?: RoomDef[];
  glass?: Array<[number, number, number, number]>;
  partitions?: Array<[number, number, number, number]>;
  columns?: Array<[number, number]>;
  desks?: Array<[number, number]>;
  props?: PropDef[];
  doors: DoorDef[];
  keycards: KeycardLevelDef[];
  guards: GuardOpts[];
  cameras?: CameraDef[];
  lasers?: LaserDef[];
  notes?: NoteDef[];
  /** Zones [cx, cz, w, d] where being SEEN is trespassing. */
  restricted?: Array<[number, number, number, number]>;
  /** Unlit pockets [cx, cz, w, d] — stand here and guards can't make you out. */
  dark?: Array<[number, number, number, number]>;
  lights: Array<[number, number]>;
  windowsSide?: 'N' | 'S' | null;
  fridge: { x: number; z: number };
  exit: Zone;
  /** L5: after the grab, the lockdown reroutes you to this exit. */
  exitLockdown?: Zone;
  objectives: { start: string; toFridge: string; escape: string };
  tutorial?: boolean;
  finale?: boolean;
  lunchName: string;
}

export interface BuiltKeycard { id: string; x: number; z: number; mesh: THREE.Mesh; }
export interface BuiltNote { def: NoteDef; mesh: THREE.Mesh; read: boolean; }

export interface BuiltLevel {
  def: LevelDef;
  root: THREE.Group;
  doors: Door[];
  keycards: BuiltKeycard[];
  cameras: SecurityCamera[];
  lasers: LaserTrip[];
  notes: BuiltNote[];
}

/** Wall/ceiling-mounted sweeping camera. Flags the player when heat maxes. */
export class SecurityCamera {
  readonly group = new THREE.Group();
  heat = 0;
  private sweepT = Math.random() * 6;
  private cooldown = 0;
  private readonly lensMat: THREE.MeshStandardMaterial;

  constructor(readonly def: CameraDef) {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.16, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.5, metalness: 0.4 })
    );
    body.position.z = -0.1;
    this.group.add(body);
    this.lensMat = new THREE.MeshStandardMaterial({
      color: 0x101418,
      emissive: 0x22cc66,
      emissiveIntensity: 1.6,
      roughness: 0.3
    });
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), this.lensMat);
    lens.position.set(0, -0.02, -0.33);
    this.group.add(lens);
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.5, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.6 })
    );
    arm.position.y = 0.32;
    this.group.add(arm);
    this.group.position.set(def.x, 2.55, def.z);
  }

  /** Returns true exactly on the frame the camera flags the player. */
  update(
    dt: number,
    px: number,
    pz: number,
    crouching: boolean,
    world: CollisionWorld,
    /** Cameras also ignore colleagues walking normally in public areas. */
    behaviorActive: boolean
  ): boolean {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.sweepT += dt;
    const arc = this.def.arc ?? 0.7;
    const angle = this.def.facing + Math.sin(this.sweepT * 0.5) * arc;
    this.group.rotation.y = angle;

    const range = (this.def.range ?? 10) * (crouching ? 0.8 : 1);
    const dx = px - this.def.x;
    const dz = pz - this.def.z;
    const dist = Math.hypot(dx, dz);
    let sees = false;
    if (behaviorActive && dist < range) {
      const fx = -Math.sin(angle);
      const fz = -Math.cos(angle);
      const dot = (dx * fx + dz * fz) / (dist || 1);
      if (dot > Math.cos(0.45) && !world.segmentBlocked(this.def.x, this.def.z, px, pz, 1.0)) {
        sees = true;
      }
    }
    this.heat = clamp(this.heat + (sees ? 1.1 : -0.5) * dt, 0, 1);
    // Lens goes green → amber → red as heat builds.
    this.lensMat.emissive.setHSL(0.36 * (1 - this.heat), 0.9, 0.45);
    if (this.heat >= 1 && this.cooldown === 0) {
      this.cooldown = 6;
      return true;
    }
    return false;
  }
}

/** Knee-height laser tripwire. Crossing it sounds the floor alarm. */
export class LaserTrip {
  readonly group = new THREE.Group();
  private cooldown = 0;
  private readonly beamMat: THREE.MeshStandardMaterial;
  private readonly beam: THREE.Mesh;
  private readonly len: number;
  private readonly baseAngle: number;
  private t = Math.random() * 10; // desync identical grids
  private live = true;
  // Current far endpoint (tracks the sweep) — the crossing test uses this,
  // so a rotating beam is only dangerous where it actually points.
  private curX1: number;
  private curZ1: number;

  constructor(readonly def: LaserDef) {
    this.len = Math.hypot(def.x1 - def.x0, def.z1 - def.z0);
    this.baseAngle = Math.atan2(def.x1 - def.x0, def.z1 - def.z0);
    this.curX1 = def.x1;
    this.curZ1 = def.z1;
    this.beamMat = new THREE.MeshStandardMaterial({
      color: 0x330508,
      emissive: 0xff2233,
      emissiveIntensity: 2.4,
      roughness: 0.4
    });
    this.beam = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, this.len), this.beamMat);
    this.beam.position.z = this.len / 2;
    this.group.add(this.beam);
    const emitter = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.5, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x1c2027, roughness: 0.5, metalness: 0.5 })
    );
    emitter.position.y = -0.25;
    this.group.add(emitter);
    this.group.position.set(def.x0, 0.55, def.z0);
    this.group.rotation.y = this.baseAngle;
  }

  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.t += dt;
    // Sweeping beam: rotate around the emitter and track the live endpoint.
    if (this.def.sweep) {
      const angle = this.baseAngle + Math.sin(this.t * (this.def.speed ?? 0.4) * Math.PI * 2) * this.def.sweep;
      this.group.rotation.y = angle;
      this.curX1 = this.def.x0 + Math.sin(angle) * this.len;
      this.curZ1 = this.def.z0 + Math.cos(angle) * this.len;
    }
    // Blinking beam: dark (and harmless) for the last 40% of each cycle.
    if (this.def.blink) {
      this.live = this.t % this.def.blink < this.def.blink * 0.6;
      this.beam.visible = this.live;
    }
    this.beamMat.emissiveIntensity = this.live ? 2.1 + Math.sin(performance.now() * 0.008) * 0.5 : 0;
  }

  crossed(px: number, pz: number, r: number): boolean {
    if (this.cooldown > 0 || !this.live) return false;
    const { x0, z0 } = this.def;
    const dx = this.curX1 - x0;
    const dz = this.curZ1 - z0;
    const len2 = dx * dx + dz * dz;
    const t = len2 === 0 ? 0 : clamp(((px - x0) * dx + (pz - z0) * dz) / len2, 0, 1);
    const d = Math.hypot(px - (x0 + dx * t), pz - (z0 + dz * t));
    if (d < r + 0.05) {
      this.cooldown = 3;
      return true;
    }
    return false;
  }
}

/** Interprets a LevelDef into meshes, colliders, and gameplay objects. */
export function buildLevel(def: LevelDef, world: CollisionWorld): BuiltLevel {
  const root = new THREE.Group();
  const [W, D] = def.size;
  const p = def.palette;
  const TRIM = p.trim ?? 0x5c4f40;

  // Cache by params: hundreds of solids share a handful of looks, and
  // unique material instances defeat the renderer's program batching.
  const matCache = new Map<string, THREE.MeshStandardMaterial>();
  const material = (color: number, roughness = 0.9, metalness = 0.02) => {
    const key = `${color}|${roughness}|${metalness}`;
    let m = matCache.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
      matCache.set(key, m);
    }
    return m;
  };

  const addSolid = (
    cx: number, cz: number, w: number, h: number, d: number, color: number,
    opts?: { collider?: boolean; y?: number; roughness?: number; sightHeight?: number; shadow?: boolean }
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color, opts?.roughness ?? 0.9));
    mesh.position.set(cx, (opts?.y ?? 0) + h / 2, cz);
    mesh.castShadow = opts?.shadow !== false;
    mesh.receiveShadow = true;
    root.add(mesh);
    if (opts?.collider !== false) {
      world.addBox(cx, cz, w, d, { height: opts?.sightHeight ?? (opts?.y ?? 0) + h });
    }
    return mesh;
  };

  const WALL_H = 3.2;
  /** Wall with baseboard + chair-rail trim — sells "office" instantly.
   *  Trim pads only the wall's THIN axis, else a 0.4×40 wall would grow a
   *  40×40 slab (the "stacked floors" bug). */
  const addWall = (cx: number, cz: number, w: number, d: number) => {
    addSolid(cx, cz, w, WALL_H, d, p.wall);
    const alongX = w > d;
    const bw = alongX ? w : w + 0.06;
    const bd = alongX ? d + 0.06 : d;
    addSolid(cx, cz, bw, 0.14, bd, TRIM, { collider: false, shadow: false });
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(alongX ? w : w + 0.05, 0.06, alongX ? d + 0.05 : d),
      material(TRIM, 0.8)
    );
    rail.position.set(cx, 1.0, cz);
    rail.castShadow = false;
    root.add(rail);
  };

  // ---- Floor (carpet) ----
  const carpet = document.createElement('canvas');
  carpet.width = 256;
  carpet.height = 256;
  {
    const ctx = carpet.getContext('2d')!;
    ctx.fillStyle = p.carpetA;
    ctx.fillRect(0, 0, 256, 256);
    for (let ty = 0; ty < 4; ty++) {
      for (let tx = 0; tx < 4; tx++) {
        ctx.fillStyle = (tx + ty) % 2 ? p.carpetA : p.carpetB;
        ctx.fillRect(tx * 64, ty * 64, 63, 63);
        for (let i = 0; i < 60; i++) {
          ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.04)';
          ctx.fillRect(tx * 64 + Math.random() * 62, ty * 64 + Math.random() * 62, 2, 2);
        }
      }
    }
  }
  const carpetTex = new THREE.CanvasTexture(carpet);
  carpetTex.wrapS = carpetTex.wrapT = THREE.RepeatWrapping;
  carpetTex.repeat.set(Math.round(W * 0.65), Math.round(D * 0.65));
  carpetTex.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(W, 0.2, D),
    new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 0.96 })
  );
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  root.add(floor);

  // ---- Ceiling: drop-tile grid (shadow-transparent so light reaches in) ----
  const tileCanvas = document.createElement('canvas');
  tileCanvas.width = 256;
  tileCanvas.height = 256;
  {
    const ctx = tileCanvas.getContext('2d')!;
    ctx.fillStyle = p.ceiling ?? '#d6d1c4';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = p.ceilingGrid ?? '#b3aea1';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(256, i * 64); ctx.stroke();
    }
  }
  const tileTex = new THREE.CanvasTexture(tileCanvas);
  tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
  tileTex.repeat.set(Math.round(W / 2.44), Math.round(D / 2.44));
  tileTex.colorSpace = THREE.SRGBColorSpace;
  // Faint self-glow: the underside faces away from every light, so without
  // this the tiles render near-black instead of office-bright.
  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(W, 0.15, D),
    new THREE.MeshStandardMaterial({
      map: tileTex,
      emissiveMap: tileTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.42,
      roughness: 0.94
    })
  );
  ceiling.position.y = 3.3;
  root.add(ceiling);

  // ---- Perimeter ----
  addWall(0, -D / 2 - 0.2, W + 0.8, 0.4);
  addWall(0, D / 2 + 0.2, W + 0.8, 0.4);
  addWall(-W / 2 - 0.2, 0, 0.4, D);
  addWall(W / 2 + 0.2, 0, 0.4, D);

  // ---- Rooms: generate walls-with-gaps (+ optional hinged doors) ----
  const doors: Door[] = [];
  const addDoorEntity = (d: DoorDef) => {
    const door = new Door(world, d.hinge[0], d.hinge[1], d.length, d.axis, {
      locked: d.locked,
      swing: d.swing
    });
    root.add(door.group);
    doors.push(door);
  };

  for (const room of def.rooms ?? []) {
    const sides: Array<['N' | 'S' | 'E' | 'W', number, number, number]> = [
      ['N', room.z - room.d / 2, room.x - room.w / 2, room.x + room.w / 2],
      ['S', room.z + room.d / 2, room.x - room.w / 2, room.x + room.w / 2],
      ['W', room.x - room.w / 2, room.z - room.d / 2, room.z + room.d / 2],
      ['E', room.x + room.w / 2, room.z - room.d / 2, room.z + room.d / 2]
    ];
    for (const [side, line, lo, hi] of sides) {
      const horizontal = side === 'N' || side === 'S';
      const center = horizontal ? room.x : room.z;
      const gaps = (room.doors ?? [])
        .filter((g) => g.side === side)
        .map((g) => {
          const c = center + (g.at ?? 0);
          const half = (g.width ?? 2) / 2;
          return { min: c - half, max: c + half, g };
        })
        .sort((a, b) => a.min - b.min);
      let cursor = lo;
      for (const gap of gaps) {
        if (gap.min - cursor > 0.05) {
          const mid = (cursor + gap.min) / 2;
          const len = gap.min - cursor;
          if (horizontal) addWall(mid, line, len, 0.4);
          else addWall(line, mid, 0.4, len);
        }
        if (gap.g.door) {
          addDoorEntity({
            hinge: horizontal ? [gap.min, line] : [line, gap.min],
            length: gap.max - gap.min,
            axis: horizontal ? 'x' : 'z',
            locked: gap.g.locked
          });
        }
        cursor = gap.max;
      }
      if (hi - cursor > 0.05) {
        const mid = (cursor + hi) / 2;
        const len = hi - cursor;
        if (horizontal) addWall(mid, line, len, 0.4);
        else addWall(line, mid, 0.4, len);
      }
    }
  }

  // ---- Free-standing structure ----
  for (const [cx, cz, w, d] of def.walls) addWall(cx, cz, w, d);
  for (const [cx, cz, w, d] of def.glass ?? []) {
    const g = new THREE.Mesh(
      new THREE.BoxGeometry(w, 2.7, d),
      new THREE.MeshStandardMaterial({
        color: 0xbfe0ee,
        transparent: true,
        opacity: 0.16,
        roughness: 0.1,
        metalness: 0.1
      })
    );
    g.position.set(cx, 1.35, cz);
    root.add(g);
    world.addBox(cx, cz, w, d, { transparent: true, height: 2.7 });
  }
  for (const [cx, cz, w, d] of def.partitions ?? []) addSolid(cx, cz, w, 1.35, d, 0x8a8477);
  for (const [x, z] of def.columns ?? []) addSolid(x, z, 0.6, WALL_H, 0.6, p.wall);

  // ---- Shadow pockets: a pool of darkness on the floor marks a hiding
  // spot. Gameplay treats these as concealment (see Game.inShadow); the
  // dark decal is the visual tell. Keep level lights away from them. ----
  for (const [cx, cz, w, d] of def.dark ?? []) {
    const shade = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.62, depthWrite: false })
    );
    shade.rotation.x = -Math.PI / 2;
    shade.position.set(cx, 0.03, cz);
    root.add(shade);
  }

  // ---- Shared little builders ----
  const chair = (x: number, z: number, rot = 0) => {
    const grp = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.09, 0.46), material(0x30343c, 0.7));
    seat.position.y = 0.48;
    seat.castShadow = true;
    grp.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.55, 0.08), material(0x30343c, 0.7));
    back.position.set(0, 0.82, 0.21);
    back.castShadow = true;
    grp.add(back);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.16, 0.45, 8), material(0x22262c, 0.5));
    post.position.y = 0.23;
    grp.add(post);
    grp.position.set(x, 0, z);
    grp.rotation.y = rot;
    root.add(grp);
  };

  // ---- Desks: slab + monitor + chair + seeded clutter ----
  const MONITOR = 0x23262c;
  for (const [x, z] of def.desks ?? []) {
    addSolid(x, z, 1.8, 0.78, 0.9, 0x9c8d74);
    const mon = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.34, 0.06), material(MONITOR, 0.4));
    mon.position.set(x, 1.04, z - 0.28);
    mon.castShadow = true;
    root.add(mon);
    const monBase = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.12), material(MONITOR, 0.4));
    monBase.position.set(x, 0.82, z - 0.28);
    root.add(monBase);
    chair(x, z + 0.85, Math.PI);

    const rand = seeded(x, z);
    const clutterY = 0.79;
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.13), material(0x2a2e35, 0.6));
    kb.position.set(x + (rand() - 0.5) * 0.2, clutterY, z + 0.05);
    kb.castShadow = false;
    root.add(kb);
    const papers = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < papers; i++) {
      const sheet = new THREE.Mesh(
        new THREE.BoxGeometry(0.21, 0.006 + rand() * 0.02, 0.29),
        material(0xe9e6dc, 0.95)
      );
      sheet.position.set(x - 0.6 + rand() * 1.2, clutterY, z - 0.25 + rand() * 0.5);
      sheet.rotation.y = (rand() - 0.5) * 0.6;
      sheet.castShadow = false;
      root.add(sheet);
    }
    const mug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.09, 10),
      material([0xb4482f, 0x3d6b8f, 0x5a7a44, 0xc9a13b][Math.floor(rand() * 4)], 0.5)
    );
    mug.position.set(x + 0.55 - rand() * 0.2, clutterY + 0.045, z + 0.15);
    mug.castShadow = false;
    root.add(mug);
    if (rand() > 0.4) {
      const phone = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.06, 0.2), material(0x30353d, 0.6));
      phone.position.set(x - 0.65, clutterY + 0.03, z + 0.12);
      phone.castShadow = false;
      root.add(phone);
    }
  }

  // ---- Props ----
  const swap = (rot: number | undefined) => rot !== undefined && Math.abs(Math.sin(rot)) > 0.5;
  for (const prop of def.props ?? []) {
    const { x, z } = prop;
    const rot = prop.rot ?? 0;
    switch (prop.type) {
      case 'plant': {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.35, 10), material(0x6b4a35, 0.9));
        pot.position.set(x, 0.175, z);
        pot.castShadow = true;
        root.add(pot);
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 8), material(0x3f7a4a, 0.9));
        leaf.position.set(x, 0.85, z);
        leaf.castShadow = true;
        root.add(leaf);
        const leaf2 = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 8), material(0x4b8c56, 0.9));
        leaf2.position.set(x, 1.25, z);
        leaf2.castShadow = true;
        root.add(leaf2);
        world.addBox(x, z, 0.5, 0.5, { height: 0.6 });
        break;
      }
      case 'cooler': {
        addSolid(x, z, 0.42, 1.05, 0.42, 0xdfe3e8, { roughness: 0.5 });
        const bottle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.16, 0.4, 10),
          new THREE.MeshStandardMaterial({ color: 0x4aa8e0, transparent: true, opacity: 0.75, roughness: 0.2 })
        );
        bottle.position.set(x, 1.28, z);
        root.add(bottle);
        break;
      }
      case 'copier':
        addSolid(x, z, 0.75, 1.0, 0.62, 0xb9bec7, { roughness: 0.6 });
        addSolid(x, z, 0.6, 0.08, 0.5, 0x2a2e36, { y: 1.0, collider: false, shadow: false });
        break;
      case 'crate':
        addSolid(x, z, 1.1, 1.1 + Math.random() * 0.5, 1.1, 0x84796b);
        break;
      case 'table':
        addSolid(x, z, 1.5, 0.76, 1.5, 0x9a9284);
        break;
      case 'shelf':
        addSolid(x, z, 1.6, 2.0, 0.5, 0x6e6759);
        break;
      case 'counter':
        addSolid(x, z, swap(rot) ? 3.4 : 0.9, 0.9, swap(rot) ? 0.9 : 3.4, 0x777d88);
        break;
      case 'filing':
        addSolid(x, z, swap(rot) ? 0.62 : 0.5, 1.32, swap(rot) ? 0.5 : 0.62, 0x8a8f99, { roughness: 0.55 });
        break;
      case 'bookshelf': {
        addSolid(x, z, swap(rot) ? 0.35 : 1.2, 2.1, swap(rot) ? 1.2 : 0.35, 0x6e5b45);
        const rand = seeded(x, z);
        for (let row = 0; row < 3; row++) {
          const books = new THREE.Mesh(
            new THREE.BoxGeometry(swap(rot) ? 0.24 : 1.0, 0.3, swap(rot) ? 1.0 : 0.24),
            material([0x7a3b2e, 0x2e5a7a, 0x557a2e, 0x6b4a7a, 0x8f7a2e][Math.floor(rand() * 5)], 0.85)
          );
          books.position.set(x, 0.5 + row * 0.55, z);
          books.castShadow = false;
          root.add(books);
        }
        break;
      }
      case 'whiteboard': {
        const grp = new THREE.Group();
        const frame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.08, 0.06), material(0x9aa0a8, 0.5));
        frame.position.y = 1.65;
        grp.add(frame);
        const face = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.07), material(0xf0f2ef, 0.35));
        face.position.y = 1.65;
        grp.add(face);
        grp.position.set(x, 0, z);
        grp.rotation.y = rot;
        root.add(grp);
        break;
      }
      case 'board': {
        const grp = new THREE.Group();
        const cork = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.92, 0.05), material(0xa8845c, 0.95));
        cork.position.y = 1.62;
        grp.add(cork);
        const rand = seeded(x, z);
        for (let i = 0; i < 4; i++) {
          const pin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.02), material(0xe9e6dc, 0.9));
          pin.position.set(-0.45 + rand() * 0.9, 1.45 + rand() * 0.45, 0.03);
          pin.rotation.z = (rand() - 0.5) * 0.3;
          pin.castShadow = false;
          grp.add(pin);
        }
        grp.position.set(x, 0, z);
        grp.rotation.y = rot;
        root.add(grp);
        break;
      }
      case 'clock': {
        const grp = new THREE.Group();
        const face = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 16), material(0xeceee9, 0.4));
        face.rotation.x = Math.PI / 2;
        face.position.y = 2.35;
        grp.add(face);
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.03, 16), material(0x2a2e35, 0.4));
        rim.rotation.x = Math.PI / 2;
        rim.position.set(0, 2.35, -0.015);
        grp.add(rim);
        grp.position.set(x, 0, z);
        grp.rotation.y = rot;
        root.add(grp);
        break;
      }
      case 'art': {
        const grp = new THREE.Group();
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.66, 0.05), material(0x54432f, 0.7));
        frame.position.y = 1.7;
        grp.add(frame);
        const rand = seeded(x, z);
        const canvasArt = new THREE.Mesh(
          new THREE.BoxGeometry(0.74, 0.54, 0.06),
          material([0x6b7a8f, 0x8f6b5a, 0x5a8f6b, 0x8f8a5a][Math.floor(rand() * 4)], 0.8)
        );
        canvasArt.position.y = 1.7;
        grp.add(canvasArt);
        grp.position.set(x, 0, z);
        grp.rotation.y = rot;
        root.add(grp);
        break;
      }
      case 'meeting': {
        addSolid(x, z, swap(rot) ? 1.5 : 3.4, 0.75, swap(rot) ? 3.4 : 1.5, 0x7d6c52, { roughness: 0.6 });
        const across = swap(rot);
        for (let i = -1; i <= 1; i++) {
          const off = i * 1.05;
          if (across) {
            chair(x - 1.15, z + off, -Math.PI / 2);
            chair(x + 1.15, z + off, Math.PI / 2);
          } else {
            chair(x + off, z - 1.15, 0);
            chair(x + off, z + 1.15, Math.PI);
          }
        }
        break;
      }
      case 'sofa': {
        const alongZ = swap(rot);
        addSolid(x, z, alongZ ? 0.85 : 1.9, 0.45, alongZ ? 1.9 : 0.85, 0x5b6470, { roughness: 0.9 });
        addSolid(
          alongZ ? x + (rot && Math.sin(rot) > 0 ? 0.35 : -0.35) : x,
          alongZ ? z : z - 0.35,
          alongZ ? 0.25 : 1.9, 0.85, alongZ ? 1.9 : 0.25,
          0x525a66,
          { collider: false, roughness: 0.9 }
        );
        break;
      }
      case 'bin': {
        const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.42, 10), material(0x555b64, 0.7));
        bin.position.set(x, 0.21, z);
        bin.castShadow = false;
        root.add(bin);
        break;
      }
      case 'vend': {
        addSolid(x, z, swap(rot) ? 0.72 : 0.95, 1.9, swap(rot) ? 0.95 : 0.72, 0x2f3d55, { roughness: 0.5 });
        const glow = new THREE.Mesh(
          new THREE.BoxGeometry(swap(rot) ? 0.08 : 0.7, 1.3, swap(rot) ? 0.7 : 0.08),
          new THREE.MeshStandardMaterial({
            color: 0x8fb3d8, emissive: 0x6fa3d8, emissiveIntensity: 0.9, roughness: 0.4
          })
        );
        const off = swap(rot) ? (Math.sin(rot) > 0 ? 0.46 : -0.46) : 0;
        glow.position.set(x + (swap(rot) ? off : 0), 1.15, z + (swap(rot) ? 0 : 0.34));
        root.add(glow);
        break;
      }
    }
  }

  // ---- Ceiling troffers aligned to the tile grid ----
  // Fixture density doubled with the tile grid, so each one glows less or
  // the combined bloom washes out the frame center.
  const fixtureMat = new THREE.MeshStandardMaterial({
    color: 0xe6ecf4,
    emissive: 0xd8e6ff,
    emissiveIntensity: 0.85,
    roughness: 0.6
  });
  for (let fx = -W / 2 + 3.6; fx < W / 2 - 1.5; fx += 4.88) {
    for (let fz = -D / 2 + 2.4; fz < D / 2 - 1.2; fz += 4.88) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.07, 0.58), fixtureMat);
      f.position.set(fx, 3.22, fz);
      root.add(f);
    }
  }
  for (const [lx, lz] of def.lights) {
    const pl = new THREE.PointLight(0xdfe9ff, 26, 19, 1.9);
    pl.position.set(lx, 2.9, lz);
    root.add(pl);
  }

  const hemi = new THREE.HemisphereLight(p.hemiSky ?? 0xcfe0ee, p.hemiGround ?? 0x35383f, 0.65);
  root.add(hemi);
  // 2.6 suited the old dark palette; on the cream walls/carpet it blows out.
  const sun = new THREE.DirectionalLight(p.sun ?? 0xffe3bd, p.sunIntensity ?? 1.8);
  sun.position.set(14, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const bound = Math.max(W, D) / 2 + 6;
  sun.shadow.camera.left = -bound;
  sun.shadow.camera.right = bound;
  sun.shadow.camera.top = bound;
  sun.shadow.camera.bottom = -bound;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 70;
  sun.shadow.bias = -0.0004;
  root.add(sun);

  // ---- Windows ----
  if (def.windowsSide) {
    const wz = def.windowsSide === 'S' ? D / 2 - 0.06 : -D / 2 + 0.06;
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0xcfe4f2,
      emissive: 0xbcd9ee,
      emissiveIntensity: 1.05,
      roughness: 0.4
    });
    for (let wx = -W / 2 + 4; wx <= W / 2 - 4; wx += 8) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.5, 0.1), windowMat);
      win.position.set(wx, 2.1, wz);
      root.add(win);
    }
  }

  // ---- Explicit doors (in addition to room-generated ones) ----
  for (const d of def.doors) addDoorEntity(d);

  // ---- Keycards ----
  const keycards: BuiltKeycard[] = def.keycards.map((kc) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.035, 0.2),
      new THREE.MeshStandardMaterial({
        color: kc.color,
        emissive: kc.color,
        emissiveIntensity: 0.55,
        roughness: 0.4
      })
    );
    mesh.position.set(kc.x, kc.y ?? 0.81, kc.z);
    root.add(mesh);
    return { id: kc.id, x: kc.x, z: kc.z, mesh };
  });

  // ---- Notes (collectible memos) ----
  const noteMat = new THREE.MeshStandardMaterial({
    color: 0xf2df7a,
    emissive: 0x8a7b22,
    emissiveIntensity: 0.35,
    roughness: 0.8
  });
  const notes: BuiltNote[] = (def.notes ?? []).map((n) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.015, 0.24), noteMat.clone());
    mesh.position.set(n.x, n.y ?? 0.8, n.z);
    mesh.rotation.y = Math.random() * Math.PI;
    root.add(mesh);
    return { def: n, mesh, read: false };
  });

  // ---- Fridge ----
  const fridge = addSolid(def.fridge.x, def.fridge.z, 0.9, 1.95, 1.05, 0xf2f4f5, { roughness: 0.35 });
  (fridge.material as THREE.MeshStandardMaterial).metalness = 0.25;

  // ---- Exit(s) ----
  const addExit = (zone: Zone, color: number) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(zone.r * 0.66, zone.r * 0.88, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(zone.x, 0.02, zone.z);
    root.add(ring);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.3, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x0c1116, emissive: color, emissiveIntensity: 1.3 })
    );
    sign.position.set(zone.x, 2.5, zone.z);
    root.add(sign);
  };
  addExit(def.exit, 0x7dd3fc);
  if (def.exitLockdown) addExit(def.exitLockdown, 0xffa14a);

  // ---- Cameras + lasers ----
  const cameras = (def.cameras ?? []).map((c) => {
    const cam = new SecurityCamera(c);
    root.add(cam.group);
    return cam;
  });
  const lasers = (def.lasers ?? []).map((l) => {
    const laser = new LaserTrip(l);
    root.add(laser.group);
    return laser;
  });

  return { def, root, doors, keycards, cameras, lasers, notes };
}
