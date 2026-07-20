import type { BoxCollider, CollisionWorld } from '../world/Collision';

/**
 * Coarse walkability grid + A* so guards steer around desks and walls
 * instead of beelining into them. Built once per level from the collision
 * world (door colliders excluded — guards open doors; locked doors are
 * stamped in separately via setDoorCells and refreshed when locks change).
 */
export class NavGrid {
  readonly cell = 0.5;
  readonly cols: number;
  readonly rows: number;
  private readonly originX: number;
  private readonly originZ: number;
  /** Static blockers (walls, furniture), inflated by the guard radius. */
  private readonly base: Uint8Array;
  /** Dynamic blockers: currently-locked doors. */
  private readonly doorBlock: Uint8Array;

  // A* scratch buffers, reused across calls (guards query sequentially).
  private readonly gScore: Float32Array;
  private readonly from: Int32Array;
  private readonly closed: Uint8Array;
  private readonly heapF: number[] = [];
  private readonly heapI: number[] = [];

  constructor(world: CollisionWorld, width: number, depth: number, ignore: ReadonlySet<BoxCollider>) {
    this.cols = Math.ceil(width / this.cell);
    this.rows = Math.ceil(depth / this.cell);
    this.originX = -width / 2;
    this.originZ = -depth / 2;
    const n = this.cols * this.rows;
    this.base = new Uint8Array(n);
    this.doorBlock = new Uint8Array(n);
    this.gScore = new Float32Array(n);
    this.from = new Int32Array(n);
    this.closed = new Uint8Array(n);
    const pad = 0.45; // guard radius 0.32 + clearance
    for (const b of world.boxes) {
      if (ignore.has(b)) continue;
      this.stamp(this.base, b, pad);
    }
  }

  private stamp(target: Uint8Array, b: BoxCollider, pad: number): void {
    const c0 = Math.max(0, Math.floor((b.minX - pad - this.originX) / this.cell));
    const c1 = Math.min(this.cols - 1, Math.floor((b.maxX + pad - this.originX) / this.cell));
    const r0 = Math.max(0, Math.floor((b.minZ - pad - this.originZ) / this.cell));
    const r1 = Math.min(this.rows - 1, Math.floor((b.maxZ + pad - this.originZ) / this.cell));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) target[r * this.cols + c] = 1;
    }
  }

  /** Re-stamp the dynamic layer with the currently locked doors. */
  setDoorCells(lockedDoors: BoxCollider[]): void {
    this.doorBlock.fill(0);
    for (const b of lockedDoors) this.stamp(this.doorBlock, b, 0.3);
  }

  private blockedCell(c: number, r: number): boolean {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return true;
    const i = r * this.cols + c;
    return this.base[i] === 1 || this.doorBlock[i] === 1;
  }

  blockedAt(x: number, z: number): boolean {
    return this.blockedCell(
      Math.floor((x - this.originX) / this.cell),
      Math.floor((z - this.originZ) / this.cell)
    );
  }

  /** Is the straight line walkable (sampled every 0.22 m)? */
  walkableLine(x0: number, z0: number, x1: number, z1: number): boolean {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(1, Math.ceil(d / 0.22));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (this.blockedAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)) return false;
    }
    return true;
  }

  /** Nearest unblocked cell within a small ring search, or null. */
  private nearestFree(c: number, r: number): [number, number] | null {
    if (!this.blockedCell(c, r)) return [c, r];
    for (let radius = 1; radius <= 6; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue;
          if (!this.blockedCell(c + dc, r + dr)) return [c + dc, r + dr];
        }
      }
    }
    return null;
  }

  private heapPush(f: number, i: number): void {
    this.heapF.push(f);
    this.heapI.push(i);
    let k = this.heapF.length - 1;
    while (k > 0) {
      const parent = (k - 1) >> 1;
      if (this.heapF[parent] <= this.heapF[k]) break;
      [this.heapF[parent], this.heapF[k]] = [this.heapF[k], this.heapF[parent]];
      [this.heapI[parent], this.heapI[k]] = [this.heapI[k], this.heapI[parent]];
      k = parent;
    }
  }

  private heapPop(): number {
    const top = this.heapI[0];
    const lf = this.heapF.pop()!;
    const li = this.heapI.pop()!;
    if (this.heapF.length > 0) {
      this.heapF[0] = lf;
      this.heapI[0] = li;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1;
        const r = l + 1;
        let m = k;
        if (l < this.heapF.length && this.heapF[l] < this.heapF[m]) m = l;
        if (r < this.heapF.length && this.heapF[r] < this.heapF[m]) m = r;
        if (m === k) break;
        [this.heapF[m], this.heapF[k]] = [this.heapF[k], this.heapF[m]];
        [this.heapI[m], this.heapI[k]] = [this.heapI[k], this.heapI[m]];
        k = m;
      }
    }
    return top;
  }

  /**
   * A* (8-connected, no corner cutting) from (x0,z0) to (x1,z1).
   * Returns smoothed world-space waypoints, or null when unreachable.
   */
  findPath(x0: number, z0: number, x1: number, z1: number): Array<[number, number]> | null {
    const s = this.nearestFree(
      Math.floor((x0 - this.originX) / this.cell),
      Math.floor((z0 - this.originZ) / this.cell)
    );
    const g = this.nearestFree(
      Math.floor((x1 - this.originX) / this.cell),
      Math.floor((z1 - this.originZ) / this.cell)
    );
    if (!s || !g) return null;
    const [sc, sr] = s;
    const [gc, gr] = g;
    const goal = gr * this.cols + gc;
    const start = sr * this.cols + sc;

    this.gScore.fill(Infinity);
    this.closed.fill(0);
    this.heapF.length = 0;
    this.heapI.length = 0;
    this.gScore[start] = 0;
    this.from[start] = -1;
    const hCost = (c: number, r: number) => {
      const dc = Math.abs(c - gc);
      const dr = Math.abs(r - gr);
      return Math.max(dc, dr) + 0.4142 * Math.min(dc, dr);
    };
    this.heapPush(hCost(sc, sr), start);

    let found = false;
    let expanded = 0;
    while (this.heapF.length > 0) {
      const cur = this.heapPop();
      if (this.closed[cur]) continue;
      if (cur === goal) {
        found = true;
        break;
      }
      this.closed[cur] = 1;
      if (++expanded > 6000) break; // pathological — treat as unreachable
      const c = cur % this.cols;
      const r = (cur / this.cols) | 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dc === 0 && dr === 0) continue;
          const nc = c + dc;
          const nr = r + dr;
          if (this.blockedCell(nc, nr)) continue;
          // Diagonals may not cut a blocked corner.
          if (dc !== 0 && dr !== 0 && (this.blockedCell(c + dc, r) || this.blockedCell(c, r + dr))) continue;
          const ni = nr * this.cols + nc;
          if (this.closed[ni]) continue;
          const step = dc !== 0 && dr !== 0 ? 1.4142 : 1;
          const ng = this.gScore[cur] + step;
          if (ng < this.gScore[ni]) {
            this.gScore[ni] = ng;
            this.from[ni] = cur;
            this.heapPush(ng + hCost(nc, nr), ni);
          }
        }
      }
    }
    if (!found) return null;

    // Reconstruct as cell centers, then string-pull with visibility checks.
    const raw: Array<[number, number]> = [];
    for (let i = goal; i !== -1; i = this.from[i]) {
      const c = i % this.cols;
      const r = (i / this.cols) | 0;
      raw.push([this.originX + (c + 0.5) * this.cell, this.originZ + (r + 0.5) * this.cell]);
      if (i === start) break;
    }
    raw.reverse();
    raw.push([x1, z1]);

    const out: Array<[number, number]> = [];
    let ax = x0;
    let az = z0;
    let i = 0;
    while (i < raw.length) {
      let j = i;
      for (let k = raw.length - 1; k > i; k--) {
        if (this.walkableLine(ax, az, raw[k][0], raw[k][1])) {
          j = k;
          break;
        }
      }
      out.push(raw[j]);
      [ax, az] = raw[j];
      i = j + 1;
    }
    return out;
  }
}
