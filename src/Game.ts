import * as THREE from 'three';
import { Input } from './core/Input';
import { CollisionWorld } from './world/Collision';
import { PlayerController } from './entities/PlayerController';
import { RendererSystem } from './render/RendererSystem';
import { buildGrayBox, type BuiltLevel } from './world/graybox';
import { Guard, type GuardState } from './entities/Guard';
import { FootstepEmitter, NoiseSystem } from './systems/Stealth';
import { InteractSystem } from './systems/Interact';
import { HUD } from './ui/HUD';

type GameState = 'play' | 'caught' | 'complete';

const SUSPICIOUS_BARKS = [
  'Hm? Did the printer move?',
  'Hello? Timesheet questions?',
  'I heard that. I definitely heard that.',
  'New hire? You look… crouchy.'
];
const CHASE_BARKS = [
  'HEY! Badge check! BADGE CHECK!',
  'UNAUTHORIZED SNACK MOVEMENT!',
  'Stop! In the name of Facilities!',
  "Security to floor three. It's happening."
];
const CALM_BARKS = [
  'Probably the HVAC.',
  'Coffee. I need coffee.',
  "Logging it as 'ambient vibes'."
];

const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

export class Game {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  world = new CollisionWorld();
  readonly player: PlayerController;
  guards: Guard[] = [];
  state: GameState = 'play';
  inventory = new Set<string>();
  hasLunch = false;

  private readonly rendererSystem: RendererSystem;
  private readonly input: Input;
  private readonly hud = new HUD();
  private readonly noise = new NoiseSystem();
  private readonly footsteps = new FootstepEmitter();
  private readonly interact = new InteractSystem();
  private readonly fpsEl = document.getElementById('fps')!;
  private readonly lockOverlay = document.getElementById('lock-overlay')!;

  private level!: BuiltLevel;
  private levelRoot: THREE.Group | null = null;
  private alertBoost = 0;
  private stats = { time: 0, spotted: 0 };

  private lastT = 0;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private lastFps = 0;

  /** QA hook: when true the game runs without pointer lock (automation). */
  debugFree = false;

  constructor(container: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 150);
    this.rendererSystem = new RendererSystem(container);
    this.input = new Input(this.rendererSystem.renderer.domElement);
    this.player = new PlayerController(this.camera);

    this.scene.background = new THREE.Color(0x11141a);
    this.scene.fog = new THREE.Fog(0x11141a, 34, 90);

    this.loadLevel();
    this.rendererSystem.initPost(this.scene, this.camera);

    window.addEventListener('resize', () => this.onResize());
    this.lockOverlay.addEventListener('click', () => {
      this.rendererSystem.renderer.domElement.requestPointerLock();
    });

    this.rendererSystem.renderer.setAnimationLoop((t) => this.frame(t));
  }

  /** (Re)build the whole mission — used on boot and on R-restart. */
  loadLevel(): void {
    if (this.levelRoot) this.scene.remove(this.levelRoot);
    this.world = new CollisionWorld();
    this.interact.clear();
    this.guards = [];
    this.inventory.clear();
    this.hasLunch = false;
    this.alertBoost = 0;
    this.stats = { time: 0, spotted: 0 };
    this.noise.drain();

    const level = buildGrayBox(this.world);
    this.level = level;
    this.levelRoot = level.root;
    this.scene.add(level.root);
    this.player.spawnAt(level.spawn.x, level.spawn.z, level.spawn.yaw);
    this.player.crouching = false;

    for (const def of level.guards) {
      const g = new Guard(def);
      g.onStateChange = (guard, _from, to) => this.onGuardState(guard, to);
      level.root.add(g.figure.root);
      this.guards.push(g);
    }

    for (const door of level.doors) {
      this.interact.add({
        x: door.cx,
        z: door.cz,
        radius: 2.0,
        prompt: () => door.promptText(this.inventory),
        act: () => {
          door.interact(this.inventory, (m) => this.hud.toast(m));
          this.noise.emit(door.cx, door.cz, 5, 0.15);
        }
      });
    }

    for (const kc of level.keycards) {
      this.interact.add({
        x: kc.x,
        z: kc.z,
        radius: 1.8,
        prompt: () => (this.inventory.has(kc.id) ? null : `Take ${kc.id} keycard`),
        act: () => {
          this.inventory.add(kc.id);
          kc.mesh.visible = false;
          this.hud.setKeycards(this.inventory);
          this.hud.toast(`${kc.id} keycard acquired. For legitimate business, surely.`);
        }
      });
    }

    this.interact.add({
      x: level.fridge.x,
      z: level.fridge.z,
      radius: 2.0,
      prompt: () => (this.hasLunch ? null : "Take DORIAN'S LUNCH"),
      act: () => {
        this.hasLunch = true;
        this.alertBoost = 1.5;
        this.noise.emit(level.fridge.x, level.fridge.z, 9, 0.3);
        this.hud.toast("You take the intern's lunch. It is… beautiful.");
        this.hud.toast('The floor feels tense. Get back to the elevator.');
      }
    });

    this.hud.hideEnd();
    this.hud.setKeycards(this.inventory);
    this.hud.setDetection(0, false);
    this.state = 'play';
  }

  private onGuardState(g: Guard, to: GuardState): void {
    if (to === 'suspicious') this.hud.toast(`${g.opts.name}: “${pick(SUSPICIOUS_BARKS)}”`);
    else if (to === 'chase') {
      this.stats.spotted++;
      this.hud.toast(`${g.opts.name}: “${pick(CHASE_BARKS)}”`);
    } else if (to === 'return') this.hud.toast(`${g.opts.name}: “${pick(CALM_BARKS)}”`, 2200);
  }

  private onCaught(g: Guard): void {
    if (this.state !== 'play') return;
    this.state = 'caught';
    this.hud.showEnd(
      'caught',
      'ESCORTED TO HR',
      `${g.opts.name} walked you to a beige room containing one laminated pamphlet. ` +
        `Time ${this.stats.time.toFixed(0)}s · Spotted ${this.stats.spotted}×.`
    );
  }

  private completeLevel(): void {
    if (this.state !== 'play') return;
    this.state = 'complete';
    const ghost = this.stats.spotted === 0;
    this.hud.showEnd(
      'complete',
      ghost ? 'EMPLOYEE OF THE MONTH' : 'MISSION COMPLETE',
      `The lunch is yours. Somewhere upstairs, a memo is already being drafted. ` +
        `Time ${this.stats.time.toFixed(0)}s · Spotted ${this.stats.spotted}×` +
        (ghost ? ' · GHOST CLEARANCE.' : '.')
    );
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.rendererSystem.setSize(window.innerWidth, window.innerHeight);
  }

  private frame(t: number): void {
    const dt = Math.min((t - this.lastT) / 1000 || 0, 0.05);
    this.lastT = t;

    const active = this.input.pointerLocked || this.debugFree;
    this.lockOverlay.classList.toggle('hidden', active || this.state !== 'play');

    if (this.input.wasPressed('KeyR') && this.state !== 'play') this.loadLevel();

    if (this.state === 'play') {
      this.stats.time += dt;
      this.player.enabled = active;
      this.player.update(dt, this.input, this.world);

      const px = this.player.position.x;
      const pz = this.player.position.z;
      this.footsteps.update(dt, this.player.speed, this.player.crouching, this.player.sprinting, px, pz, this.noise);

      const noises = this.noise.drain();
      for (const g of this.guards) {
        g.update(dt, this.player, this.world, noises, (gg) => this.onCaught(gg), this.alertBoost);
      }
      for (const d of this.level.doors) d.update(dt);
      for (const kc of this.level.keycards) {
        if (kc.mesh.visible) kc.mesh.rotation.y += dt * 1.6;
      }

      const it = this.interact.current(px, pz, this.player.yaw);
      this.hud.setPrompt(it ? it.prompt() : null);
      if (it && this.input.wasPressed('KeyE')) it.act();

      const needsKey = this.level.doors.some((d) => d.locked) && !this.inventory.has('BLUE');
      this.hud.setObjective(
        this.hasLunch
          ? 'Return to the elevator. Walk like you belong.'
          : needsKey
            ? "Dorian's lunch is in the breakroom. Find the BLUE keycard."
            : 'Get to the breakroom fridge.'
      );

      let maxS = 0;
      let chase = false;
      for (const g of this.guards) {
        maxS = Math.max(maxS, g.suspicion);
        if (g.state === 'chase') chase = true;
      }
      this.hud.setDetection(maxS, chase);

      const ex = this.level.exit;
      if (this.hasLunch && Math.hypot(px - ex.x, pz - ex.z) < ex.r) this.completeLevel();
    }

    this.rendererSystem.render(this.scene, this.camera);
    this.input.endFrame();

    this.fpsAccum += dt;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      this.lastFps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsEl.textContent = `${this.lastFps} FPS`;
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }
  }

  // ---- QA / automation API (used by browser-driven testing) ----

  /** Run without pointer lock so automation can drive the camera. */
  debugStart(): void {
    this.debugFree = true;
  }

  teleport(x: number, z: number, yaw?: number): void {
    this.player.position.x = x;
    this.player.position.z = z;
    if (yaw !== undefined) this.player.yaw = yaw;
  }

  qaGrantKey(id: string): void {
    this.inventory.add(id);
    this.hud.setKeycards(this.inventory);
  }

  qaInteract(): void {
    const it = this.interact.current(this.player.position.x, this.player.position.z, this.player.yaw);
    it?.act();
  }

  getState(): object {
    return {
      gameState: this.state,
      pos: { x: +this.player.position.x.toFixed(2), z: +this.player.position.z.toFixed(2) },
      yaw: +this.player.yaw.toFixed(2),
      crouching: this.player.crouching,
      hasLunch: this.hasLunch,
      inventory: [...this.inventory],
      alertBoost: this.alertBoost,
      stats: { ...this.stats, time: +this.stats.time.toFixed(1) },
      guards: this.guards.map((g) => ({
        name: g.opts.name,
        state: g.state,
        suspicion: +g.suspicion.toFixed(2),
        x: +g.x.toFixed(1),
        z: +g.z.toFixed(1)
      })),
      fps: this.lastFps,
      pointerLocked: this.input.pointerLocked
    };
  }
}
