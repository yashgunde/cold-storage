import { CharacterFigure } from './CharacterFigure';
import type { CollisionWorld } from '../world/Collision';
import type { NavGrid } from '../systems/NavGrid';
import type { NoiseEvent } from '../systems/Stealth';
import type { PlayerController } from './PlayerController';

export type GuardState = 'patrol' | 'suspicious' | 'chase' | 'return';

export interface GuardOpts {
  name: string;
  waypoints: Array<[number, number]>;
  /** Coworkers notice you more slowly than security, but they DO narc. */
  civilian?: boolean;
  /** Headphones in — immune to noise, sharp-eyed. */
  deaf?: boolean;
  viewDist?: number;
  patrolSpeed?: number;
  shirt?: number;
  pants?: number;
}

const CAPTURE_DIST = 1.05;
const SUSPICIOUS_AT = 0.35;
const HALF_FOV_COS = Math.cos(0.95); // ~109° total field of view

/** What the guard knows about the current climate + player conduct. */
export interface GuardSenseCtx {
  /** Extra view distance once the floor knows the lunch is gone. */
  alertBoost: number;
  /** Player is somewhere their badge does not allow. */
  restricted: boolean;
  /** Player is visibly carrying the contraband. */
  lunch: boolean;
  /** Player is tucked into an unlit pocket — effectively invisible. */
  hidden: boolean;
}

const lerpAngle = (a: number, b: number, t: number): number => {
  const d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
};

export class Guard {
  x: number;
  z: number;
  heading = 0;
  state: GuardState = 'patrol';
  suspicion = 0;
  /** Distance walked since Game last consumed it — drives audible footsteps. */
  travel = 0;
  /** Injected by Game after the level's collision world is final. */
  nav: NavGrid | null = null;
  readonly figure: CharacterFigure;
  onStateChange?: (g: Guard, from: GuardState, to: GuardState) => void;

  private wp = 0;
  private waitT = 0;
  private speedNow = 0;
  private lookT = 0;
  private memoryT = 0;
  private investigate = { x: 0, z: 0 };
  private lastSeen = { x: 0, z: 0 };
  private path: Array<[number, number]> | null = null;
  private pathI = 0;
  private pathGoalX = 0;
  private pathGoalZ = 0;
  private repathCd = 0;
  private stuckT = 0;
  private lastX = 0;
  private lastZ = 0;

  readonly opts: GuardOpts;

  constructor(opts: GuardOpts) {
    // Clone: lockdown boosts patrolSpeed at runtime, and the defs in
    // LEVELS are a shared singleton that must survive retries untouched.
    this.opts = { ...opts };
    [this.x, this.z] = this.opts.waypoints[0];
    // Name hash → stable skin/hair per character, matching their voice hash.
    let seed = 0;
    for (let i = 0; i < opts.name.length; i++) seed = (seed * 31 + opts.name.charCodeAt(i)) | 0;
    seed = seed >>> 0;
    this.figure = new CharacterFigure(
      opts.civilian
        ? { shirt: opts.shirt ?? 0x7c9c6b, pants: opts.pants ?? 0x4a4640, seed }
        : { shirt: opts.shirt ?? 0x2c3a55, pants: opts.pants ?? 0x1f2733, cap: 0x22293a, seed }
    );
    this.figure.setPosition(this.x, this.z);
  }

  private setState(next: GuardState): void {
    if (next === this.state) return;
    const prev = this.state;
    this.state = next;
    this.onStateChange?.(this, prev, next);
  }

  update(
    dt: number,
    player: PlayerController,
    world: CollisionWorld,
    noises: NoiseEvent[],
    onCaught: (g: Guard) => void,
    ctx: GuardSenseCtx
  ): void {
    const px = player.position.x;
    const pz = player.position.z;
    const dx = px - this.x;
    const dz = pz - this.z;
    const dist = Math.hypot(dx, dz);

    // ---- Sight ----
    // How out-of-place does the player look right now? 0 = a colleague
    // walking normally, and guards simply don't clock a colleague.
    let behavior = 0;
    if (ctx.lunch) behavior = Math.max(behavior, 1.3);
    if (ctx.restricted) behavior = Math.max(behavior, 1.15);
    // Sprinting through an office is more alarming than trespassing —
    // nobody runs indoors unless something is very wrong.
    if (player.sprinting || player.speed > 4.3) behavior = Math.max(behavior, 1.25);
    else if (player.crouching) behavior = Math.max(behavior, 0.7);
    if (this.state === 'chase' || this.state === 'suspicious') behavior = Math.max(behavior, 0.6);

    const viewDist = ((this.opts.viewDist ?? 13) + ctx.alertBoost) * (player.crouching ? 0.62 : 1);
    const sightMinH = player.crouching ? 0.95 : 1.55;
    let sees = false;
    if (dist < viewDist) {
      const fx = -Math.sin(this.heading);
      const fz = -Math.cos(this.heading);
      const dot = (dx * fx + dz * fz) / (dist || 1);
      if (dot > HALF_FOV_COS && !world.segmentBlocked(this.x, this.z, px, pz, sightMinH)) {
        sees = true;
      }
    }
    // Proximity sense: brushing past someone while acting shifty.
    if (!sees && behavior > 0 && dist < 1.5 && !world.segmentBlocked(this.x, this.z, px, pz, sightMinH)) {
      sees = true;
    }
    // Shadow concealment: inside an unlit pocket the player reads as
    // office furniture unless the guard is close enough to touch them.
    if (ctx.hidden && dist > 2.2) sees = false;

    if (sees && behavior > 0) {
      this.lastSeen.x = px;
      this.lastSeen.z = pz;
      if (this.state !== 'chase') {
        const closeness = 1 - dist / (viewDist || 1);
        let rate = 0.85 * (0.3 + 0.7 * closeness) * behavior;
        if (this.opts.civilian) rate *= 0.6;
        if (this.state === 'suspicious') rate *= 1.35;
        this.suspicion = Math.min(1, this.suspicion + rate * dt);
        if (this.suspicion >= 1) {
          this.memoryT = 3.5;
          this.setState('chase');
        } else if (this.suspicion >= SUSPICIOUS_AT && (this.state === 'patrol' || this.state === 'return')) {
          this.investigate = { x: px, z: pz };
          this.lookT = 0;
          this.setState('suspicious');
        }
      }
    } else {
      const decay = this.state === 'suspicious' ? 0.12 : 0.35;
      this.suspicion = Math.max(0, this.suspicion - decay * dt);
    }

    // ---- Hearing ----
    if (this.state !== 'chase' && !this.opts.deaf) {
      for (const n of noises) {
        const nd = Math.hypot(n.x - this.x, n.z - this.z);
        let radius = n.radius;
        if (world.segmentBlocked(this.x, this.z, n.x, n.z, 1.55)) radius *= 0.45;
        if (nd >= radius) continue;
        this.suspicion = Math.min(1, this.suspicion + n.strength * (ctx.alertBoost > 0 ? 1.4 : 1));
        // Only distinctly odd sounds (sprinting, doors, the fridge) are
        // worth walking over to investigate — office footsteps are normal.
        if (n.strength >= 0.2) {
          this.investigate = { x: n.x, z: n.z };
          if (this.suspicion >= SUSPICIOUS_AT && this.state !== 'suspicious') {
            this.lookT = 0;
            this.setState('suspicious');
          }
        }
      }
    }

    // ---- Behavior ----
    switch (this.state) {
      case 'patrol': {
        if (this.waitT > 0) {
          this.waitT -= dt;
          this.speedNow = 0;
          this.heading += Math.sin(this.waitT * 2.1) * 0.9 * dt; // idle glance
        } else {
          const [tx, tz] = this.opts.waypoints[this.wp];
          if (this.moveToward(tx, tz, this.opts.patrolSpeed ?? 1.7, dt, world)) {
            this.waitT = 1.6;
            this.wp = (this.wp + 1) % this.opts.waypoints.length;
          }
        }
        break;
      }
      case 'suspicious': {
        if (this.moveToward(this.investigate.x, this.investigate.z, 2.45, dt, world)) {
          this.lookT += dt;
          this.heading += Math.sin(this.lookT * 1.7) * 1.2 * dt;
          if (this.lookT > 3.2) {
            this.suspicion = Math.min(this.suspicion, 0.3);
            this.setState('return');
          }
        }
        break;
      }
      case 'chase': {
        if (sees) this.memoryT = 3.5;
        else this.memoryT -= dt;
        const tx = sees ? px : this.lastSeen.x;
        const tz = sees ? pz : this.lastSeen.z;
        // Faster than a tired sprinter, slower than a fresh one: the
        // player can gain ground only while their stamina lasts.
        this.moveToward(tx, tz, 4.75, dt, world);
        if (dist < CAPTURE_DIST) onCaught(this);
        if (this.memoryT <= 0) {
          this.suspicion = 0.85;
          this.investigate = { ...this.lastSeen };
          this.lookT = 0;
          this.setState('suspicious');
        }
        break;
      }
      case 'return': {
        const [tx, tz] = this.opts.waypoints[this.wp];
        if (this.moveToward(tx, tz, 1.9, dt, world)) this.setState('patrol');
        break;
      }
    }

    // ---- Visuals ----
    this.figure.setPosition(this.x, this.z);
    this.figure.setFacing(this.heading);
    this.figure.animate(dt, this.speedNow);
    this.figure.setIndicator(
      this.state === 'chase' ? 'alert' : this.suspicion >= SUSPICIOUS_AT ? 'question' : 'none'
    );
  }

  /** True while the guard is actually walking (drives door auto-open). */
  get moving(): boolean {
    return this.speedNow > 0.1;
  }

  /**
   * Walk toward a point, routing around obstacles via the nav grid.
   * Returns true when arrived.
   */
  private moveToward(tx: number, tz: number, speed: number, dt: number, world: CollisionWorld): boolean {
    const d = Math.hypot(tx - this.x, tz - this.z);
    if (d < 0.3) {
      this.speedNow = 0;
      this.path = null;
      return true;
    }
    this.repathCd -= dt;

    // Stuck watchdog: commanded to move but going nowhere → replan.
    this.stuckT += dt;
    if (this.stuckT > 0.7) {
      if (this.speedNow > 0.4 && Math.hypot(this.x - this.lastX, this.z - this.lastZ) < 0.15) {
        this.path = null;
        this.repathCd = 0;
      }
      this.lastX = this.x;
      this.lastZ = this.z;
      this.stuckT = 0;
    }

    if (this.nav && this.repathCd <= 0) {
      const goalMoved = Math.hypot(tx - this.pathGoalX, tz - this.pathGoalZ) > 1.1;
      if (!this.path || goalMoved) {
        this.repathCd = 0.4;
        this.pathGoalX = tx;
        this.pathGoalZ = tz;
        this.path = this.nav.walkableLine(this.x, this.z, tx, tz)
          ? null // beeline is clear — no plan needed
          : this.nav.findPath(this.x, this.z, tx, tz);
        this.pathI = 0;
      }
    }

    let sx = tx;
    let sz = tz;
    if (this.path) {
      while (
        this.pathI < this.path.length &&
        Math.hypot(this.path[this.pathI][0] - this.x, this.path[this.pathI][1] - this.z) < 0.35
      ) {
        this.pathI++;
      }
      if (this.pathI < this.path.length) [sx, sz] = this.path[this.pathI];
      else this.path = null;
    }

    const dx = sx - this.x;
    const dz = sz - this.z;
    const sd = Math.hypot(dx, dz) || 1;
    this.heading = lerpAngle(this.heading, Math.atan2(-dx, -dz), Math.min(1, dt * 7));
    const [nx, nz] = world.resolveCircle(this.x + (dx / sd) * speed * dt, this.z + (dz / sd) * speed * dt, 0.32);
    this.x = nx;
    this.z = nz;
    this.speedNow = speed;
    this.travel += speed * dt;
    return false;
  }
}
