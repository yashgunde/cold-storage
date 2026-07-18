import * as THREE from 'three';
import { Door } from './Door';
import type { CollisionWorld } from './Collision';
import type { GuardOpts } from '../entities/Guard';

export interface KeycardDef {
  id: string;
  x: number;
  z: number;
  mesh: THREE.Mesh;
}

export interface BuiltLevel {
  root: THREE.Group;
  spawn: { x: number; z: number; yaw: number };
  doors: Door[];
  guards: GuardOpts[];
  keycards: KeycardDef[];
  fridge: { x: number; z: number };
  exit: { x: number; z: number; r: number };
}

/**
 * Phase 0 test map: one floor of Halcyon Dynamics blocked out in gray.
 * West half = cubicle bullpen + south corridor, east end = breakroom
 * with the fridge. Replaced by the real building kit in Phase 2.
 */
export function buildGrayBox(world: CollisionWorld): BuiltLevel {
  const root = new THREE.Group();

  const material = (color: number, roughness = 0.9, metalness = 0.02) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });

  const addSolid = (
    cx: number, cz: number,
    w: number, h: number, d: number,
    color: number,
    opts?: { collider?: boolean; y?: number; roughness?: number }
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color, opts?.roughness ?? 0.9));
    mesh.position.set(cx, (opts?.y ?? 0) + h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    if (opts?.collider !== false) world.addBox(cx, cz, w, d, { height: (opts?.y ?? 0) + h });
    return mesh;
  };

  const WALL_H = 3.2;
  const WALL_COLOR = 0x8f95a1;
  const addWall = (cx: number, cz: number, w: number, d: number) =>
    addSolid(cx, cz, w, WALL_H, d, WALL_COLOR);

  // Floor slab (no collider — walkable) with a carpet-tile texture.
  const carpet = document.createElement('canvas');
  carpet.width = 256;
  carpet.height = 256;
  {
    const ctx = carpet.getContext('2d')!;
    ctx.fillStyle = '#4c515c';
    ctx.fillRect(0, 0, 256, 256);
    for (let ty = 0; ty < 4; ty++) {
      for (let tx = 0; tx < 4; tx++) {
        ctx.fillStyle = (tx + ty) % 2 ? '#4d525d' : '#505560';
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
  carpetTex.repeat.set(26, 16);
  carpetTex.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(40, 0.2, 24),
    new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 0.96, metalness: 0 })
  );
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  root.add(floor);

  // Ceiling: does not cast shadows, so the warm key light still reaches
  // inside (standard interior-lighting cheat).
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(40, 0.15, 24), material(0x3a3f49, 0.95));
  ceiling.position.y = 3.3;
  ceiling.receiveShadow = true;
  root.add(ceiling);

  // Fluorescent fixtures — emissive panels the bloom pass picks up.
  const fixtureMat = new THREE.MeshStandardMaterial({
    color: 0xdfe7f2,
    emissive: 0xd8e6ff,
    emissiveIntensity: 1.25,
    roughness: 0.6
  });
  for (const [fx, fz] of [
    [-14, -6], [-6, -6], [2, -6], [-14, 2], [-6, 2], [2, 2],
    [-14, 8.5], [-6, 8.5], [14, -8], [14, 0], [14, 8]
  ] as Array<[number, number]>) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.07, 0.55), fixtureMat);
    f.position.set(fx, 3.18, fz);
    root.add(f);
  }

  // Daylight strips high on the south wall — implied windows.
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0xcfe4f2,
    emissive: 0xbcd9ee,
    emissiveIntensity: 1.4,
    roughness: 0.4
  });
  for (let wx = -16; wx <= 16; wx += 8) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.5, 0.1), windowMat);
    win.position.set(wx, 2.1, 11.94);
    root.add(win);
  }

  // Perimeter.
  addWall(0, -12.2, 40.8, 0.4);
  addWall(0, 12.2, 40.8, 0.4);
  addWall(-20.2, 0, 0.4, 24);
  addWall(20.2, 0, 0.4, 24);

  // Breakroom divider at x=10 with a doorway (z -6.4..-4.4).
  addWall(10, -9.2, 0.4, 5.6);
  addWall(10, 3.8, 0.4, 16.4);

  // Mid wall at z=0 on the west side, doorway at x -13..-11.
  addWall(-16.5, 0, 7, 0.4);
  addWall(-7.5, 0, 7, 0.4);

  // Structural columns.
  addSolid(4, 0, 0.6, WALL_H, 0.6, 0x7d828d);
  addSolid(4, -8, 0.6, WALL_H, 0.6, 0x7d828d);
  addSolid(-2, 6, 0.6, WALL_H, 0.6, 0x7d828d);

  // Cubicle desks (top slab + monitor, one collider per desk).
  const DESK = 0x8b7f6a;
  const MONITOR = 0x23262c;
  const desk = (cx: number, cz: number) => {
    addSolid(cx, cz, 1.8, 0.78, 0.9, DESK);
    const mon = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.34, 0.06), material(MONITOR, 0.4));
    mon.position.set(cx, 0.78 + 0.26, cz - 0.28);
    mon.castShadow = true;
    root.add(mon);
  };
  const deskSpots: Array<[number, number]> = [
    [-14, -8], [-10, -8], [-6, -8], [-2, -8],
    [-14, -4], [-10, -4], [-6, -4], [-2, -4],
    [-14, 6], [-10, 6], [-6, 6],
    [2, 4], [6, 4]
  ];
  for (const [x, z] of deskSpots) desk(x, z);

  // Low cubicle partitions (chest height — crouch to hide behind them).
  const PARTITION = 0x6f7480;
  addSolid(-8, -6, 10, 1.35, 0.15, PARTITION);
  addSolid(-8, -2.2, 10, 1.35, 0.15, PARTITION);
  addSolid(0.4, -6, 0.15, 1.35, 4, PARTITION);
  addSolid(4, 4.8, 6, 1.35, 0.15, PARTITION);

  // Breakroom furnishings.
  addSolid(14, -8, 1.5, 0.76, 1.5, 0x9a9284); // table
  addSolid(13, 2, 0.9, 0.9, 3.4, 0x777d88);   // counter
  addSolid(16.5, 8.5, 1.1, 1.1, 1.1, 0x84796b); // supply crate
  addSolid(18, 8.5, 1.1, 1.6, 1.1, 0x84796b);   // supply crate

  // THE FRIDGE. Object of desire. Against the east wall of the breakroom.
  const fridge = addSolid(19.3, -10, 0.9, 1.95, 1.05, 0xf2f4f5, { roughness: 0.35 });
  (fridge.material as THREE.MeshStandardMaterial).metalness = 0.25;
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.7, 0.06),
    material(0xb9bec6, 0.3, 0.8)
  );
  handle.position.set(19.3 - 0.48, 1.15, -10 + 0.32);
  root.add(handle);

  // Lighting — warm key light raking through the "windows", cool office fill.
  const hemi = new THREE.HemisphereLight(0xcfe0ee, 0x35383f, 0.65);
  root.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe3bd, 2.8);
  sun.position.set(14, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -26;
  sun.shadow.camera.right = 26;
  sun.shadow.camera.top = 26;
  sun.shadow.camera.bottom = -26;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0004;
  root.add(sun);

  const fluorescent = (x: number, z: number, color = 0xdfe9ff) => {
    const p = new THREE.PointLight(color, 26, 18, 1.9);
    p.position.set(x, 2.9, z);
    root.add(p);
  };
  fluorescent(-10, -6);
  fluorescent(-10, 6);
  fluorescent(0, 0);
  fluorescent(15, -6, 0xeaf2f7); // breakroom — slightly clinical

  // Breakroom door — locked; the BLUE keycard is out on the bullpen floor.
  const breakroomDoor = new Door(world, 10, -6.4, 2.0, 'z', { locked: 'BLUE' });
  root.add(breakroomDoor.group);

  // BLUE keycard, left on a desk like a promise.
  const cardMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.035, 0.2),
    new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.55,
      roughness: 0.4
    })
  );
  cardMesh.position.set(-2, 0.81, -3.72);
  root.add(cardMesh);

  // Elevator (exit zone) on the west wall.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.05, 1.4, 40),
    new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(-18.3, 0.02, 8);
  root.add(ring);
  const lift = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 2.4, 2.2),
    material(0x9fb4c8, 0.35, 0.6)
  );
  lift.position.set(-19.9, 1.2, 8);
  root.add(lift);

  const guards: GuardOpts[] = [
    {
      name: 'Officer Dwight',
      waypoints: [[-12, -10.5], [8, -10.5], [8, 8.5], [-12, 8.5]]
    },
    {
      name: 'Officer Pat',
      waypoints: [[12, -10.5], [17, -10.5], [17, -5.5], [12, -5.5]],
      viewDist: 12
    },
    {
      name: 'Gary (Accounts)',
      waypoints: [[-15.5, 8.5], [-4.5, 8.5], [-4.5, 4.5], [-15.5, 4.5]],
      civilian: true,
      patrolSpeed: 1.3
    }
  ];

  return {
    root,
    spawn: { x: -17, z: 8, yaw: -0.56 },
    doors: [breakroomDoor],
    guards,
    keycards: [{ id: 'BLUE', x: -2, z: -3.72, mesh: cardMesh }],
    fridge: { x: 18.7, z: -10 },
    exit: { x: -18.3, z: 8, r: 1.6 }
  };
}
