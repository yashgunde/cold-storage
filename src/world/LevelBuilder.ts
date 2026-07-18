import * as THREE from 'three';
import { Door } from './Door';
import type { CollisionWorld } from './Collision';
import type { GuardOpts } from '../entities/Guard';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

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
}

export interface CameraDef { x: number; z: number; facing: number; arc?: number; range?: number; }
export interface LaserDef { x0: number; z0: number; x1: number; z1: number; }
export interface NoteDef { x: number; z: number; y?: number; text: string; }
export interface PropDef {
  type: 'plant' | 'cooler' | 'copier' | 'crate' | 'table' | 'shelf' | 'counter';
  x: number;
  z: number;
}
export interface DoorDef { hinge: [number, number]; length: number; axis: 'x' | 'z'; locked?: string; swing?: 1 | -1; }
export interface KeycardLevelDef { id: string; x: number; z: number; y?: number; color: number; }
export interface Zone { x: number; z: number; r: number; }

export interface LevelDef {
  id: string;
  name: string;
  floorLabel: string;
  briefing: { from: string; lines: string[] };
  palette: LevelPalette;
  size: [number, number];
  spawn: { x: number; z: number; yaw: number };
  walls: Array<[number, number, number, number]>;
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
  update(dt: number, px: number, pz: number, crouching: boolean, world: CollisionWorld): boolean {
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
    if (dist < range) {
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

  constructor(readonly def: LaserDef) {
    const len = Math.hypot(def.x1 - def.x0, def.z1 - def.z0);
    this.beamMat = new THREE.MeshStandardMaterial({
      color: 0x330508,
      emissive: 0xff2233,
      emissiveIntensity: 2.4,
      roughness: 0.4
    });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, len), this.beamMat);
    beam.position.z = len / 2;
    this.group.add(beam);
    const emitter = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.5, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x1c2027, roughness: 0.5, metalness: 0.5 })
    );
    emitter.position.y = -0.25;
    this.group.add(emitter);
    this.group.position.set(def.x0, 0.55, def.z0);
    this.group.rotation.y = Math.atan2(def.x1 - def.x0, def.z1 - def.z0);
  }

  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.beamMat.emissiveIntensity = 2.1 + Math.sin(performance.now() * 0.008) * 0.5;
  }

  crossed(px: number, pz: number, r: number): boolean {
    if (this.cooldown > 0) return false;
    const { x0, z0, x1, z1 } = this.def;
    const dx = x1 - x0;
    const dz = z1 - z0;
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

  const material = (color: number, roughness = 0.9, metalness = 0.02) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });

  const addSolid = (
    cx: number, cz: number, w: number, h: number, d: number, color: number,
    opts?: { collider?: boolean; y?: number; roughness?: number; sightHeight?: number }
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color, opts?.roughness ?? 0.9));
    mesh.position.set(cx, (opts?.y ?? 0) + h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    if (opts?.collider !== false) {
      world.addBox(cx, cz, w, d, { height: opts?.sightHeight ?? (opts?.y ?? 0) + h });
    }
    return mesh;
  };

  const WALL_H = 3.2;
  const addWall = (cx: number, cz: number, w: number, d: number) =>
    addSolid(cx, cz, w, WALL_H, d, p.wall);

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

  // ---- Ceiling (shadow-transparent so the key light reaches inside) ----
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(W, 0.15, D), material(0x3a3f49, 0.95));
  ceiling.position.y = 3.3;
  ceiling.receiveShadow = true;
  root.add(ceiling);

  // ---- Perimeter ----
  addWall(0, -D / 2 - 0.2, W + 0.8, 0.4);
  addWall(0, D / 2 + 0.2, W + 0.8, 0.4);
  addWall(-W / 2 - 0.2, 0, 0.4, D);
  addWall(W / 2 + 0.2, 0, 0.4, D);

  // ---- Structure ----
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
  for (const [cx, cz, w, d] of def.partitions ?? []) addSolid(cx, cz, w, 1.35, d, 0x6f7480);
  for (const [x, z] of def.columns ?? []) addSolid(x, z, 0.6, WALL_H, 0.6, 0x7d828d);

  // ---- Desks ----
  const MONITOR = 0x23262c;
  for (const [x, z] of def.desks ?? []) {
    addSolid(x, z, 1.8, 0.78, 0.9, 0x8b7f6a);
    const mon = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.34, 0.06), material(MONITOR, 0.4));
    mon.position.set(x, 1.04, z - 0.28);
    mon.castShadow = true;
    root.add(mon);
    // Task chair behind the desk.
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.09, 0.46), material(0x30343c, 0.7));
    seat.position.set(x, 0.48, z + 0.85);
    seat.castShadow = true;
    root.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.55, 0.08), material(0x30343c, 0.7));
    back.position.set(x, 0.82, z + 1.06);
    back.castShadow = true;
    root.add(back);
  }

  // ---- Props ----
  for (const prop of def.props ?? []) {
    const { x, z } = prop;
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
        addSolid(x, z, 0.6, 0.08, 0.5, 0x2a2e36, { y: 1.0, collider: false });
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
        addSolid(x, z, 0.9, 0.9, 3.4, 0x777d88);
        break;
    }
  }

  // ---- Fixtures + lights ----
  const fixtureMat = new THREE.MeshStandardMaterial({
    color: 0xdfe7f2,
    emissive: 0xd8e6ff,
    emissiveIntensity: 1.25,
    roughness: 0.6
  });
  for (let fx = -W / 2 + 6; fx < W / 2 - 2; fx += 8) {
    for (let fz = -D / 2 + 5; fz < D / 2 - 2; fz += 7) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.07, 0.55), fixtureMat);
      f.position.set(fx, 3.18, fz);
      root.add(f);
    }
  }
  for (const [lx, lz] of def.lights) {
    const pl = new THREE.PointLight(0xdfe9ff, 26, 18, 1.9);
    pl.position.set(lx, 2.9, lz);
    root.add(pl);
  }

  const hemi = new THREE.HemisphereLight(p.hemiSky ?? 0xcfe0ee, p.hemiGround ?? 0x35383f, 0.65);
  root.add(hemi);
  const sun = new THREE.DirectionalLight(p.sun ?? 0xffe3bd, p.sunIntensity ?? 2.6);
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
      emissiveIntensity: 1.4,
      roughness: 0.4
    });
    for (let wx = -W / 2 + 4; wx <= W / 2 - 4; wx += 8) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.5, 0.1), windowMat);
      win.position.set(wx, 2.1, wz);
      root.add(win);
    }
  }

  // ---- Doors ----
  const doors = def.doors.map((d) => {
    const door = new Door(world, d.hinge[0], d.hinge[1], d.length, d.axis, {
      locked: d.locked,
      swing: d.swing
    });
    root.add(door.group);
    return door;
  });

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
