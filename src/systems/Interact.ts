/**
 * Proximity + facing based interaction: the nearest interactable within
 * reach that the player is roughly looking at gets the HUD prompt.
 */
export interface Interactable {
  x: number;
  z: number;
  radius?: number;
  /** Prompt text, or null while not currently interactable. */
  prompt(): string | null;
  act(): void;
}

export class InteractSystem {
  readonly items: Interactable[] = [];

  add(item: Interactable): Interactable {
    this.items.push(item);
    return item;
  }

  clear(): void {
    this.items.length = 0;
  }

  current(px: number, pz: number, yaw: number): Interactable | null {
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    let best: Interactable | null = null;
    let bestDist = Infinity;
    for (const it of this.items) {
      if (it.prompt() === null) continue;
      const dx = it.x - px;
      const dz = it.z - pz;
      const d = Math.hypot(dx, dz);
      if (d > (it.radius ?? 2.2) || d >= bestDist) continue;
      const dot = (dx * fx + dz * fz) / (d || 1);
      if (d > 0.6 && dot < 0.45) continue; // must face it unless on top of it
      best = it;
      bestDist = d;
    }
    return best;
  }
}
