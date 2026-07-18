/**
 * Minimal 2D (XZ-plane) collision world. Office floors are flat, so the
 * player and NPCs are circles colliding against axis-aligned boxes.
 * Also provides segment raycasts for line-of-sight checks (Phase 1).
 */
export interface BoxCollider {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  /** Colliders can be toggled (open doors, unlocked gates). */
  enabled: boolean;
  /** True for see-through blockers (glass walls): block movement, not sight. */
  transparent: boolean;
  /** Top of the blocker in meters — low furniture hides crouchers only. */
  height: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export class CollisionWorld {
  readonly boxes: BoxCollider[] = [];

  /** Add a collider from center + size. Returns it so callers can toggle it. */
  addBox(
    cx: number, cz: number, width: number, depth: number,
    opts?: { transparent?: boolean; height?: number }
  ): BoxCollider {
    const b: BoxCollider = {
      minX: cx - width / 2,
      minZ: cz - depth / 2,
      maxX: cx + width / 2,
      maxZ: cz + depth / 2,
      enabled: true,
      transparent: opts?.transparent ?? false,
      height: opts?.height ?? 3.2
    };
    this.boxes.push(b);
    return b;
  }

  /** Push a circle out of every intersecting box. Returns corrected position. */
  resolveCircle(x: number, z: number, r: number): [number, number] {
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const b of this.boxes) {
        if (!b.enabled) continue;
        const cx = clamp(x, b.minX, b.maxX);
        const cz = clamp(z, b.minZ, b.maxZ);
        const dx = x - cx;
        const dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        moved = true;
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * r;
          z = cz + (dz / d) * r;
        } else {
          // Circle center is inside the box: eject along the shallowest axis.
          const left = x - b.minX, right = b.maxX - x;
          const near = z - b.minZ, far = b.maxZ - z;
          const minPen = Math.min(left, right, near, far);
          if (minPen === left) x = b.minX - r;
          else if (minPen === right) x = b.maxX + r;
          else if (minPen === near) z = b.minZ - r;
          else z = b.maxZ + r;
        }
      }
      if (!moved) break;
    }
    return [x, z];
  }

  /**
   * Does the segment (x0,z0)→(x1,z1) hit any sight-blocking box?
   * Used for guard line-of-sight; ignores transparent (glass) colliders.
   */
  segmentBlocked(x0: number, z0: number, x1: number, z1: number, minBlockHeight = 0): boolean {
    const dx = x1 - x0;
    const dz = z1 - z0;
    for (const b of this.boxes) {
      if (!b.enabled || b.transparent) continue;
      if (b.height < minBlockHeight) continue;
      let tMin = 0;
      let tMax = 1;
      if (Math.abs(dx) < 1e-9) {
        if (x0 < b.minX || x0 > b.maxX) continue;
      } else {
        let t1 = (b.minX - x0) / dx;
        let t2 = (b.maxX - x0) / dx;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) continue;
      }
      if (Math.abs(dz) < 1e-9) {
        if (z0 < b.minZ || z0 > b.maxZ) continue;
      } else {
        let t1 = (b.minZ - z0) / dz;
        let t2 = (b.maxZ - z0) / dz;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) continue;
      }
      return true;
    }
    return false;
  }
}
