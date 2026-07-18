import * as THREE from 'three';
import type { BoxCollider, CollisionWorld } from './Collision';

/**
 * Hinged office door. Blocks movement and sight while closed; can be
 * keycard-locked. The panel pivots around the hinge (group origin).
 */
export class Door {
  readonly group = new THREE.Group();
  readonly collider: BoxCollider;
  /** Keycard id required, or null when unlocked. */
  locked: string | null;
  open = false;

  /** Doorway center, used for interaction distance checks. */
  readonly cx: number;
  readonly cz: number;

  private openAmount = 0;
  private readonly swingSign: number;

  constructor(
    world: CollisionWorld,
    hingeX: number,
    hingeZ: number,
    length: number,
    axis: 'x' | 'z',
    opts?: { locked?: string; color?: number; swing?: 1 | -1 }
  ) {
    this.locked = opts?.locked ?? null;
    this.swingSign = opts?.swing ?? 1;

    const color = opts?.color ?? (this.locked ? 0x8a5a44 : 0x6b7280);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05 });
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(axis === 'x' ? length : 0.09, 2.15, axis === 'x' ? 0.09 : length),
      mat
    );
    panel.castShadow = true;
    panel.receiveShadow = true;
    if (axis === 'x') panel.position.set(length / 2, 2.15 / 2, 0);
    else panel.position.set(0, 2.15 / 2, length / 2);
    this.group.add(panel);

    // Handle plate — reads as a door instead of a floating slab.
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.16, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xcfd4da, roughness: 0.3, metalness: 0.7 })
    );
    if (axis === 'x') handle.position.set(length - 0.14, 1.02, 0.07);
    else handle.position.set(0.07, 1.02, length - 0.14);
    this.group.add(handle);

    this.group.position.set(hingeX, 0, hingeZ);

    if (axis === 'x') {
      this.cx = hingeX + length / 2;
      this.cz = hingeZ;
      this.collider = world.addBox(this.cx, this.cz, length, 0.3, { height: 2.15 });
    } else {
      this.cx = hingeX;
      this.cz = hingeZ + length / 2;
      this.collider = world.addBox(this.cx, this.cz, 0.3, length, { height: 2.15 });
    }
  }

  promptText(inventory: ReadonlySet<string>): string {
    if (this.locked) {
      return inventory.has(this.locked)
        ? `Unlock — ${this.locked} keycard`
        : `LOCKED — requires ${this.locked} keycard`;
    }
    return this.open ? 'Close door' : 'Open door';
  }

  interact(inventory: ReadonlySet<string>, message: (s: string) => void): void {
    if (this.locked) {
      if (inventory.has(this.locked)) {
        message(`${this.locked} keycard accepted.`);
        this.locked = null;
        this.open = true;
      } else {
        message(`The reader blinks red. ${this.locked} clearance required.`);
      }
      return;
    }
    this.open = !this.open;
  }

  update(dt: number): void {
    const target = this.open ? 1 : 0;
    this.openAmount += (target - this.openAmount) * Math.min(1, dt * 6);
    this.group.rotation.y = -this.openAmount * 1.85 * this.swingSign;
    this.collider.enabled = this.openAmount < 0.35;
  }
}
