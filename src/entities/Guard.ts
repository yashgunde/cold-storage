import { CharacterFigure } from './CharacterFigure';
import { CharacterModel, isCharacterModelReady, type Figure } from './CharacterModel';
import type { CollisionWorld } from '../world/Collision';
import type { NavGrid } from '../systems/NavGrid';
import type { NoiseEvent } from '../systems/Stealth';
import type { PlayerController } from './PlayerController';

export type GuardState =
  | 'patrol'
  | 'stare'
  | 'suspicious'
  | 'search'
  | 'chase'
  | 'return'
  | 'report';

export interface GuardOpts {
  name: string;
  /** A single waypoint makes a POSTED guard: they stand there and watch. */
  waypoints: Array<[number, number]>;
  /** Coworkers notice you more slowly than security, but they DO narc:
   *  at full suspicion they run for the nearest officer instead of you. */
  civilian?: boolean;
  /** Headphones in — immune to noise (cans, shouts), sharp-eyed. */
  deaf?: boolean;
  /** Unusually sharp ears — noises reach them from 1.5x as far. */
  keenEars?: boolean;
  /** Posted guards: the direction they face while at their post (radians,
   *  0 faces -Z / "north", PI faces +Z, -PI/2 faces +X). */
  facing?: number;
  viewDist?: number;
  patrolSpeed?: number;
  shirt?: number;
  pants?: number;
}

const CAPTURE_DIST = 1.05;
const SUSPICIOUS_AT = 0.35;
/** Something registered in the corner of their eye — enough for a look. */
const STARE_AT = 0.1;
// Human vision is two-lobed: a narrow cone of real attention, and a wide
// peripheral band that mostly notices MOTION and only works up close.
const HALF_FOCUS_COS = Math.cos(0.66); // ~76° focus cone
const HALF_PERIPH_COS = Math.cos(1.38); // ~158° total peripheral
const PERIPH_RANGE = 0.55; // peripheral only works within 55% of view dist

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
  /** Player hurled something in the last second — that LOOKS insane. */
  threw: boolean;
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
  /** Everyone on the floor — civilians use this to find an officer to tell. */
  allies: Guard[] = [];
  /** Why they're investigating — Game picks the bark that fits. */
  investigateKind: 'sight' | 'noise' | 'lure' = 'noise';
  readonly figure: Figure;
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
  /** Where they face while standing post (single-waypoint guards). */
  private readonly postFacing: number;
  /** Seconds of lingering edge after anything odd — humans stay rattled. */
  private wary = 0;
  /** How many can-lures they've already fallen for. Fool me twice… */
  private luredCount = 0;
  private lureCounted = false;
  private stareT = 0;
  private stareLost = 0;
  private inspectT = 0;
  private searchSpots: Array<[number, number]> = [];
  private searchWait = 0;
  // Player-velocity estimate: a chasing human aims where you're GOING.
  private prevPx = 0;
  private prevPz = 0;
  private havePrev = false;
  private pVelX = 0;
  private pVelZ = 0;
  private seenVelX = 0;
  private seenVelZ = 0;

  readonly opts: GuardOpts;

  constructor(opts: GuardOpts) {
    // Clone: lockdown boosts patrolSpeed at runtime, and the defs in
    // LEVELS are a shared singleton that must survive retries untouched.
    this.opts = { ...opts };
    [this.x, this.z] = this.opts.waypoints[0];
    this.postFacing = this.opts.facing ?? 0;
    this.heading = this.postFacing;
    // Name hash → stable skin/hair per character, matching their voice hash.
    let seed = 0;
    for (let i = 0; i < opts.name.length; i++) seed = (seed * 31 + opts.name.charCodeAt(i)) | 0;
    seed = seed >>> 0;
    const figOpts = opts.civilian
      ? { shirt: opts.shirt ?? 0x7c9c6b, pants: opts.pants ?? 0x4a4640, seed }
      : { shirt: opts.shirt ?? 0x2c3a55, pants: opts.pants ?? 0x1f2733, cap: 0x22293a, seed };
    // Real rigged/animated model when it has loaded; primitive fallback until then.
    this.figure = isCharacterModelReady() ? new CharacterModel(figOpts) : new CharacterFigure(figOpts);
    this.figure.setPosition(this.x, this.z);
  }

  /** Standing post: a single waypoint means "guard this spot, watch this way". */
  private get posted(): boolean {
    return this.opts.waypoints.length === 1;
  }

  private setState(next: GuardState): void {
    if (next === this.state) return;
    const prev = this.state;
    this.state = next;
    this.onStateChange?.(this, prev, next);
  }

  /** Nearest non-civilian colleague — who a witness runs to. */
  private nearestOfficer(): Guard | null {
    let best: Guard | null = null;
    let bestD = Infinity;
    for (const g of this.allies) {
      if (g === this || g.opts.civilian) continue;
      const d = Math.hypot(g.x - this.x, g.z - this.z);
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    return best;
  }

  /** A colleague shouted "HEY!" — everyone in earshot converges. */
  hearCallout(x: number, z: number): void {
    if (this.opts.deaf) return; // headphones: misses even the shout
    if (this.state === 'chase' || this.state === 'report') return;
    this.suspicion = Math.max(this.suspicion, 0.6);
    this.investigate = { x: x + (Math.random() - 0.5) * 2, z: z + (Math.random() - 0.5) * 2 };
    this.investigateKind = 'noise';
    this.inspectT = 0;
    this.setState('suspicious');
  }

  /** A civilian just described you and pointed. Officers take that seriously. */
  receiveReport(x: number, z: number): void {
    if (this.state === 'chase') return;
    this.suspicion = Math.max(this.suspicion, 0.92);
    this.investigate = { x, z };
    this.investigateKind = 'sight';
    this.inspectT = 0;
    this.wary = Math.max(this.wary, 20);
    this.setState('suspicious');
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
    this.wary = Math.max(0, this.wary - dt);

    // Rolling estimate of where the player is headed (for chase prediction).
    if (this.havePrev && dt > 0.0001) {
      const k = Math.min(1, dt * 4);
      this.pVelX += ((px - this.prevPx) / dt - this.pVelX) * k;
      this.pVelZ += ((pz - this.prevPz) / dt - this.pVelZ) * k;
    }
    this.prevPx = px;
    this.prevPz = pz;
    this.havePrev = true;

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
    // Hurling objects across an office is not normal colleague conduct.
    if (ctx.threw) behavior = Math.max(behavior, 1.2);
    if (this.state === 'chase' || this.state === 'suspicious' || this.state === 'search') {
      behavior = Math.max(behavior, 0.6);
    }

    const viewDist = ((this.opts.viewDist ?? 13) + ctx.alertBoost) * (player.crouching ? 0.62 : 1);
    const sightMinH = player.crouching ? 0.95 : 1.55;
    let sees = false;
    let peripheralOnly = false;
    if (dist < viewDist) {
      const fx = -Math.sin(this.heading);
      const fz = -Math.cos(this.heading);
      const dot = (dx * fx + dz * fz) / (dist || 1);
      const inFocus = dot > HALF_FOCUS_COS;
      const inPeriph = !inFocus && dot > HALF_PERIPH_COS && dist < viewDist * PERIPH_RANGE;
      if ((inFocus || inPeriph) && !world.segmentBlocked(this.x, this.z, px, pz, sightMinH)) {
        sees = true;
        peripheralOnly = inPeriph;
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
      this.seenVelX = this.pVelX;
      this.seenVelZ = this.pVelZ;
      if (this.state !== 'chase') {
        const closeness = 1 - dist / (viewDist || 1);
        let rate = 0.85 * (0.3 + 0.7 * closeness) * behavior;
        // Corner-of-the-eye: humans mostly catch MOTION out there.
        if (peripheralOnly) rate *= player.speed > 3.4 ? 0.8 : 0.35;
        if (this.opts.civilian) rate *= 0.6;
        if (this.state === 'suspicious' || this.state === 'search') rate *= 1.35;
        if (this.state === 'stare') rate *= 1.25; // undivided attention
        if (this.wary > 0) rate *= 1.4; // still rattled from last time
        this.suspicion = Math.min(1, this.suspicion + rate * dt);
        if (this.suspicion >= 1) {
          // Civilians don't tackle people. They go FIND someone whose job
          // that is, and describe you in humiliating detail.
          if (this.opts.civilian && this.nearestOfficer()) {
            this.setState('report');
          } else {
            this.memoryT = 3.5;
            this.setState('chase');
          }
        } else if (
          this.suspicion >= SUSPICIOUS_AT &&
          (this.state === 'patrol' || this.state === 'return' || this.state === 'stare')
        ) {
          this.investigate = { x: px, z: pz };
          this.investigateKind = 'sight';
          this.lookT = 0;
          this.inspectT = 0;
          this.setState('suspicious');
        } else if (
          this.suspicion >= STARE_AT &&
          (this.state === 'patrol' || this.state === 'return')
        ) {
          // Double-take: stop walking and LOOK before deciding anything.
          this.stareT = 0;
          this.stareLost = 0;
          this.setState('stare');
        }
      }
    } else {
      const decay = this.state === 'suspicious' || this.state === 'search' ? 0.12 : 0.35;
      this.suspicion = Math.max(0, this.suspicion - decay * dt);
    }

    // ---- Hearing ----
    if (this.state !== 'chase' && this.state !== 'report' && !this.opts.deaf) {
      for (const n of noises) {
        const nd = Math.hypot(n.x - this.x, n.z - this.z);
        let radius = n.radius * (this.opts.keenEars ? 1.5 : 1);
        if (world.segmentBlocked(this.x, this.z, n.x, n.z, 1.55)) radius *= 0.45;
        if (nd >= radius) continue;
        let gain = n.strength * (ctx.alertBoost > 0 ? 1.4 : 1);
        // The same trick wears thin: every can they've chased makes the
        // next one less convincing.
        if (n.lure) gain /= 1 + 0.7 * this.luredCount;
        this.suspicion = Math.min(1, this.suspicion + gain);
        // Only distinctly odd sounds (sprinting, doors, the fridge) are
        // worth walking over to investigate — office footsteps are normal.
        if (n.strength >= 0.2) {
          if (n.lure && sees && behavior > 0) {
            // They WATCHED you throw it. The can is not the mystery.
            this.investigate = { x: px, z: pz };
            this.investigateKind = 'sight';
            this.suspicion = Math.min(1, this.suspicion + 0.3);
          } else if (n.lure) {
            // A clatter is easy to place exactly.
            this.investigate = { x: n.x, z: n.z };
            this.investigateKind = 'lure';
            this.lureCounted = false;
          } else {
            // Ears are imprecise at range — they head for ROUGHLY there.
            const err = Math.min(3, nd * 0.18);
            const a = Math.random() * Math.PI * 2;
            this.investigate = { x: n.x + Math.cos(a) * err, z: n.z + Math.sin(a) * err };
            this.investigateKind = 'noise';
          }
          if (this.suspicion >= SUSPICIOUS_AT && this.state !== 'suspicious') {
            this.lookT = 0;
            this.inspectT = 0;
            this.setState('suspicious');
          }
        }
      }
    }

    // ---- Behavior ----
    switch (this.state) {
      case 'patrol': {
        if (this.posted) {
          // Standing post: hold position, watch the assigned direction,
          // with idle glances — bigger sweeps while still rattled.
          const [hx, hz] = this.opts.waypoints[0];
          if (Math.hypot(hx - this.x, hz - this.z) > 0.4) {
            this.moveToward(hx, hz, this.opts.patrolSpeed ?? 1.7, dt, world);
          } else {
            this.speedNow = 0;
            this.lookT += dt;
            const glance = Math.sin(this.lookT * 0.55) * (this.wary > 0 ? 0.85 : 0.4);
            this.heading = lerpAngle(this.heading, this.postFacing + glance, Math.min(1, dt * 3));
          }
        } else if (this.waitT > 0) {
          this.waitT -= dt;
          this.speedNow = 0;
          // Idle glance — a wary guard checks over their shoulder harder.
          this.heading += Math.sin(this.waitT * 2.1) * (this.wary > 0 ? 1.5 : 0.9) * dt;
        } else {
          const [tx, tz] = this.opts.waypoints[this.wp];
          if (this.moveToward(tx, tz, this.opts.patrolSpeed ?? 1.7, dt, world)) {
            this.waitT = 1.6;
            this.wp = (this.wp + 1) % this.opts.waypoints.length;
          }
        }
        break;
      }
      case 'stare': {
        // The human double-take: stop, face it, give it a beat.
        this.speedNow = 0;
        this.stareT += dt;
        if (dist > 0.01) {
          this.heading = lerpAngle(this.heading, Math.atan2(-dx, -dz), Math.min(1, dt * 5));
        }
        if (!sees || behavior === 0) this.stareLost += dt;
        else this.stareLost = 0;
        if ((this.stareLost > 0.9 && this.suspicion < 0.08) || this.stareT > 3) {
          // "…probably nothing." But they stay on edge for a while.
          this.wary = Math.max(this.wary, 12);
          this.setState(this.posted ? 'patrol' : 'return');
        }
        break;
      }
      case 'suspicious': {
        if (this.moveToward(this.investigate.x, this.investigate.z, 2.45, dt, world)) {
          if (this.investigateKind === 'lure' && !this.lureCounted) {
            this.lureCounted = true;
            this.luredCount++;
          }
          this.inspectT += dt;
          this.heading += Math.sin(this.inspectT * 1.7) * 1.2 * dt;
          const inspectFor = this.investigateKind === 'lure' ? 2.6 : 2.0;
          if (this.inspectT > inspectFor) {
            // Found nothing where the thing WAS — a real person then pokes
            // around the nearby hiding spots before shrugging it off.
            const spots =
              this.investigateKind === 'lure' && this.luredCount > 1
                ? 0 // "It's a can. Again. I'm not doing the whole routine."
                : ctx.alertBoost > 0
                  ? 3
                  : 2;
            this.searchSpots = this.planSearch(spots);
            this.searchWait = 0;
            if (this.searchSpots.length > 0) {
              this.setState('search');
            } else {
              this.suspicion = Math.min(this.suspicion, 0.3);
              this.wary = Math.max(this.wary, 22);
              this.setState('return');
            }
          }
        }
        break;
      }
      case 'search': {
        const spot = this.searchSpots[0];
        if (!spot) {
          this.suspicion = Math.min(this.suspicion, 0.3);
          this.wary = Math.max(this.wary, 22);
          this.setState('return');
          break;
        }
        if (this.moveToward(spot[0], spot[1], 2.3, dt, world)) {
          this.searchWait += dt;
          this.heading += Math.sin(this.searchWait * 2.2) * 1.1 * dt;
          if (this.searchWait > 1.15) {
            this.searchSpots.shift();
            this.searchWait = 0;
          }
        }
        break;
      }
      case 'chase': {
        if (sees) this.memoryT = 3.5;
        else this.memoryT -= dt;
        // Lost sight → run to where they're HEADED, not where they were.
        let tx = px;
        let tz = pz;
        if (!sees) {
          tx = this.lastSeen.x + this.seenVelX * 0.7;
          tz = this.lastSeen.z + this.seenVelZ * 0.7;
          if (this.nav && !this.nav.walkableLine(this.lastSeen.x, this.lastSeen.z, tx, tz)) {
            tx = this.lastSeen.x;
            tz = this.lastSeen.z;
          }
        }
        // Faster than a tired sprinter, slower than a fresh one: the
        // player can gain ground only while their stamina lasts.
        this.moveToward(tx, tz, 4.75, dt, world);
        if (dist < CAPTURE_DIST) onCaught(this);
        if (this.memoryT <= 0) {
          this.suspicion = 0.85;
          this.investigate = { x: tx, z: tz };
          this.investigateKind = 'sight';
          this.lookT = 0;
          this.inspectT = 0;
          this.setState('suspicious');
        }
        break;
      }
      case 'report': {
        // Witness protocol: hustle to the nearest officer and point.
        const officer = this.nearestOfficer();
        if (!officer) {
          // Nobody to tell — fine, citizen's arrest it is.
          this.memoryT = 3.5;
          this.setState('chase');
          break;
        }
        if (Math.hypot(officer.x - this.x, officer.z - this.z) < 1.7) {
          officer.receiveReport(this.lastSeen.x, this.lastSeen.z);
          this.suspicion = 0.45;
          this.wary = Math.max(this.wary, 25);
          this.setState('return');
        } else {
          this.moveToward(officer.x, officer.z, 3.4, dt, world);
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
      this.state === 'chase' || this.state === 'report'
        ? 'alert'
        : this.suspicion >= STARE_AT ||
            this.state === 'stare' ||
            this.state === 'suspicious' ||
            this.state === 'search'
          ? 'question'
          : 'none'
    );
  }

  /** True while the guard is actually walking (drives door auto-open). */
  get moving(): boolean {
    return this.speedNow > 0.1;
  }

  /** Pick a few reachable spots around the investigate point to check. */
  private planSearch(count: number): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    if (!this.nav || count <= 0) return out;
    for (let attempt = 0; attempt < 10 && out.length < count; attempt++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2.2 + Math.random() * 2.4;
      const sx = this.investigate.x + Math.cos(a) * r;
      const sz = this.investigate.z + Math.sin(a) * r;
      if (this.nav.blockedAt(sx, sz)) continue;
      if (!this.nav.walkableLine(this.investigate.x, this.investigate.z, sx, sz)) continue;
      out.push([sx, sz]);
    }
    return out;
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
