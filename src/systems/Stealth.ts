/**
 * Noise propagation: anything loud emits a NoiseEvent; guards read the
 * frame's events and react if the sound reaches them (walls dampen it).
 */
export interface NoiseEvent {
  x: number;
  z: number;
  radius: number;
  /** How much suspicion a guard gains on hearing this (0..1). */
  strength: number;
  /**
   * A deliberate decoy (thrown can). Guards localize it exactly — the
   * clatter is distinctive — but each guard falls for it a little less
   * every time, and a guard who WATCHED the throw goes after the thrower.
   */
  lure?: boolean;
}

export class NoiseSystem {
  private events: NoiseEvent[] = [];

  emit(x: number, z: number, radius: number, strength: number, lure = false): void {
    this.events.push({ x, z, radius, strength, lure });
  }

  /** Events emitted since last frame. Read once per frame by Game. */
  drain(): NoiseEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}

/** Turns player movement into periodic footstep noise. */
export class FootstepEmitter {
  private travelled = 0;

  update(
    dt: number,
    speed: number,
    crouching: boolean,
    sprinting: boolean,
    x: number,
    z: number,
    noise: NoiseSystem
  ): boolean {
    this.travelled += speed * dt;
    const stepLength = crouching ? 1.5 : sprinting ? 2.3 : 2.0;
    if (this.travelled < stepLength) return false;
    this.travelled = 0;
    if (speed < 0.3) return false;
    // Walking is normal office noise — guards barely register it.
    if (crouching) noise.emit(x, z, 1.8, 0.05);
    else if (sprinting) noise.emit(x, z, 13, 0.45);
    else noise.emit(x, z, 4.5, 0.08);
    return true;
  }
}
