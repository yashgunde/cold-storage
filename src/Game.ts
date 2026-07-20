import * as THREE from 'three';
import { Input } from './core/Input';
import { AudioEngine } from './core/AudioEngine';
import { CollisionWorld } from './world/Collision';
import { PlayerController } from './entities/PlayerController';
import { RendererSystem } from './render/RendererSystem';
import { buildLevel, type BuiltLevel } from './world/LevelBuilder';
import { LEVELS, ENDING_CEO, ENDING_LUNCH } from './world/levels';
import { Guard, type GuardState, type GuardSenseCtx } from './entities/Guard';
import { FootstepEmitter, NoiseSystem } from './systems/Stealth';
import { NavGrid } from './systems/NavGrid';
import { InteractSystem } from './systems/Interact';
import { HUD } from './ui/HUD';

type GameState = 'menu' | 'briefing' | 'play' | 'caught' | 'complete' | 'choice' | 'ending';

const SAVE_KEY = 'coldstorage.save';

const SUSPICIOUS_BARKS = [
  'Hm? Did the printer move?',
  'Hello? Timesheet questions?',
  'I heard that. I definitely heard that.',
  'You look… crouchy.'
];
const CHASE_BARKS = [
  'HEY! Badge check! BADGE CHECK!',
  'UNAUTHORIZED SNACK MOVEMENT!',
  'Stop! In the name of Facilities!',
  "Security to all floors. It's happening."
];
const CALM_BARKS = [
  'Probably the HVAC.',
  'Coffee. I need coffee.',
  "Logging it as 'ambient vibes'."
];

const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

interface TutorialStep {
  text: string;
  done: (g: Game, dt: number) => boolean;
}

export class Game {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  world = new CollisionWorld();
  readonly player: PlayerController;
  guards: Guard[] = [];
  state: GameState = 'menu';
  inventory = new Set<string>();
  hasLunch = false;
  levelIndex = 0;
  sprintDrill = 0;
  built: BuiltLevel | null = null;

  private readonly rendererSystem: RendererSystem;
  private readonly input: Input;
  private readonly hud = new HUD();
  private readonly audio = new AudioEngine();
  private readonly noise = new NoiseSystem();
  private readonly footsteps = new FootstepEmitter();
  private readonly interact = new InteractSystem();

  private readonly fpsEl = document.getElementById('fps')!;
  private readonly lockOverlay = document.getElementById('lock-overlay')!;
  private readonly menuEl = document.getElementById('menu')!;
  private readonly menuLevelsEl = document.getElementById('menu-levels')!;
  private readonly briefingEl = document.getElementById('briefing')!;
  private readonly choiceEl = document.getElementById('choice')!;
  private readonly endingEl = document.getElementById('ending')!;

  private alertBoost = 0;
  private lockdown = false;
  private nav: NavGrid | null = null;
  /** Bumped on every level load / menu return; invalidates stale timers. */
  private session = 0;
  private stats = { time: 0, spotted: 0, notes: 0 };
  private tutorialSteps: TutorialStep[] = [];
  private tutorialIndex = 0;
  private tipShown = false;
  private briefingIndex = 0;

  private save: {
    unlocked: number;
    quality?: 'high' | 'low';
    sens?: number;
    vol?: number;
    voice?: number;
  } = { unlocked: 0 };

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
    this.rendererSystem.initPost(this.scene, this.camera);

    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) this.save = { unlocked: 0, ...JSON.parse(raw) };
    } catch {
      this.save = { unlocked: 0 };
    }

    window.addEventListener('resize', () => this.onResize());
    this.lockOverlay.addEventListener('click', () => {
      this.audio.ensure();
      this.input.requestLock();
    });
    document.getElementById('brief-begin')!.addEventListener('click', () => this.beginShift());
    document.getElementById('choice-ceo')!.addEventListener('click', () => this.showEnding(ENDING_CEO));
    document.getElementById('choice-eat')!.addEventListener('click', () => this.showEnding(ENDING_LUNCH));
    document.getElementById('ending-menu')!.addEventListener('click', () => this.toMenu());
    document.getElementById('quality-btn')!.addEventListener('click', () => {
      this.save.quality = this.save.quality === 'low' ? 'high' : 'low';
      this.persist();
      this.applyQuality();
      this.audio.uiClick();
    });
    this.applyQuality();

    // ---- Settings panel (menu + pause) ----
    const settingsEl = document.getElementById('settings')!;
    const openSettings = () => {
      settingsEl.classList.remove('hidden');
      this.applySettings();
    };
    document.getElementById('settings-btn')!.addEventListener('click', () => {
      this.audio.uiClick();
      openSettings();
    });
    document.getElementById('pause-settings')!.addEventListener('click', (e) => {
      e.stopPropagation(); // the overlay behind it resumes on click
      this.audio.ensure();
      openSettings();
    });
    document.getElementById('settings-close')!.addEventListener('click', () => {
      settingsEl.classList.add('hidden');
      this.audio.uiClick();
    });
    const bindSlider = (id: string, apply: (v: number) => void) => {
      const el = document.getElementById(id) as HTMLInputElement;
      el.addEventListener('input', () => {
        apply(parseFloat(el.value));
        this.applySettings();
        this.persist();
      });
    };
    bindSlider('set-sens', (v) => (this.save.sens = v));
    bindSlider('set-vol', (v) => (this.save.vol = v));
    bindSlider('set-voice', (v) => (this.save.voice = v));
    this.applySettings();

    this.toMenu();
    this.rendererSystem.renderer.setAnimationLoop((t) => this.frame(t));
  }

  // ------------------------------------------------------------- flow

  private applyQuality(): void {
    const high = this.save.quality !== 'low';
    this.rendererSystem.setQuality(high);
    const btn = document.getElementById('quality-btn');
    if (btn) btn.textContent = `GRAPHICS: ${high ? 'HIGH' : 'LOW'} — CLICK TO TOGGLE`;
  }

  /** Push saved settings into the systems and sync the sliders/labels. */
  private applySettings(): void {
    const sens = this.save.sens ?? 1;
    const vol = this.save.vol ?? 0.5;
    const voice = this.save.voice ?? 0.9;
    this.player.lookScale = sens;
    this.audio.setMasterVolume(vol);
    this.audio.setVoiceVolume(voice);
    const sync = (id: string, value: number, label: string) => {
      const input = document.getElementById(id) as HTMLInputElement | null;
      const span = document.getElementById(`${id}-v`);
      if (input && document.activeElement !== input) input.value = String(value);
      if (span) span.textContent = label;
    };
    sync('set-sens', sens, `${sens.toFixed(2)}x`);
    sync('set-vol', vol, `${Math.round(vol * 100)}%`);
    sync('set-voice', voice, `${Math.round(voice * 100)}%`);
  }

  /** Every character gets a stable voice derived from their name. */
  private speakAs(name: string, text: string): void {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
    const pitch = 0.85 + ((h >>> 4) % 30) / 100;
    const rate = 0.92 + ((h >>> 10) % 22) / 100;
    const voice = (h >>> 7) % 3;
    this.audio.say(text, { pitch, rate, voice });
  }

  private persist(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch {
      /* storage unavailable — progress just won't persist */
    }
  }

  toMenu(): void {
    this.state = 'menu';
    this.session++;
    document.exitPointerLock?.();
    this.hud.hideEnd();
    this.hud.setObjective('');
    this.hud.setPrompt(null);
    this.hud.setDetection(0, false);
    this.menuLevelsEl.textContent = '';
    LEVELS.forEach((def, i) => {
      const btn = document.createElement('div');
      const locked = i > this.save.unlocked;
      btn.className = `lvl-btn${locked ? ' locked' : ''}`;
      btn.innerHTML = `<span class="lvl-name">${locked ? '🔒 ' : ''}${def.name}</span><span class="lvl-floor">${def.floorLabel}</span>`;
      if (!locked) {
        btn.addEventListener('click', () => {
          this.audio.ensure();
          this.audio.uiClick();
          this.showBriefing(i);
        });
      }
      this.menuLevelsEl.appendChild(btn);
    });
  }

  showBriefing(index: number): void {
    this.briefingIndex = index;
    const def = LEVELS[index];
    this.state = 'briefing';
    document.getElementById('brief-floor')!.textContent = def.floorLabel;
    document.getElementById('brief-title')!.textContent = def.name;
    document.getElementById('brief-from')!.textContent = def.briefing.from;
    const linesEl = document.getElementById('brief-lines')!;
    linesEl.textContent = '';
    for (const line of def.briefing.lines) {
      const p = document.createElement('p');
      p.textContent = line;
      linesEl.appendChild(p);
    }
  }

  private beginShift(): void {
    this.audio.ensure();
    this.audio.uiClick();
    this.loadLevel(this.briefingIndex);
    this.state = 'play';
    this.rendererSystem.renderer.domElement.requestPointerLock();
  }

  /** (Re)build a mission — used on start and on R-restart. */
  loadLevel(index: number): void {
    this.levelIndex = index;
    this.session++;
    const def = LEVELS[index];

    if (this.built) {
      this.scene.remove(this.built.root);
      this.disposeLevel(this.built.root);
    }
    this.world = new CollisionWorld();
    this.interact.clear();
    this.guards = [];
    this.inventory.clear();
    this.hasLunch = false;
    this.alertBoost = 0;
    this.lockdown = false;
    this.stats = { time: 0, spotted: 0, notes: 0 };
    this.noise.drain();

    this.scene.background = new THREE.Color(def.palette.fog);
    this.scene.fog = new THREE.Fog(def.palette.fog, 30, 85);

    const built = buildLevel(def, this.world);
    this.built = built;
    this.scene.add(built.root);
    this.player.spawnAt(def.spawn.x, def.spawn.z, def.spawn.yaw);
    this.player.crouching = false;

    for (const gdef of def.guards) {
      const g = new Guard(gdef);
      g.onStateChange = (guard, _from, to) => this.onGuardState(guard, to);
      built.root.add(g.figure.root);
      this.guards.push(g);
    }

    // Guard pathfinding: one grid per level, doors excluded from the static
    // layer (guards open them) and re-stamped as they lock/unlock.
    const [navW, navD] = def.size;
    this.nav = new NavGrid(this.world, navW, navD, new Set(built.doors.map((d) => d.collider)));
    this.refreshNavDoors();
    for (const g of this.guards) g.nav = this.nav;

    for (const door of built.doors) {
      this.interact.add({
        x: door.cx,
        z: door.cz,
        radius: 2.0,
        prompt: () => door.promptText(this.inventory),
        act: () => {
          door.interact(this.inventory, (m) => this.hud.toast(m));
          this.refreshNavDoors(); // an unlocked door opens a route for guards
          this.noise.emit(door.cx, door.cz, 5, 0.2);
          this.audio.uiClick();
        }
      });
    }

    for (const kc of built.keycards) {
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
          this.audio.grab();
        }
      });
    }

    for (const note of built.notes) {
      this.interact.add({
        x: note.def.x,
        z: note.def.z,
        radius: 1.7,
        prompt: () => (note.read ? null : 'Read note'),
        act: () => {
          note.read = true;
          this.stats.notes++;
          note.mesh.visible = false;
          this.hud.toast(note.def.text, 9500);
          this.audio.uiClick();
        }
      });
    }

    this.interact.add({
      x: def.fridge.x,
      z: def.fridge.z,
      radius: 2.0,
      prompt: () => (this.hasLunch ? null : `Take ${def.lunchName}`),
      act: () => this.onFridge()
    });

    if (def.tutorial) {
      this.tutorialIndex = 0;
      this.sprintDrill = 0;
      this.tutorialSteps = [
        {
          text: 'Report to your desk — the one with the fern-less monitor (WASD to move, mouse or ARROW KEYS to look).',
          done: (g) => Math.hypot(g.player.position.x - 0, g.player.position.z - -2.6) < 2.4
        },
        {
          text: 'Mobility compliance: CROUCH (C or CTRL) and move a little. HR is watching. HR is always watching.',
          done: (g) => g.player.crouching && g.player.speed > 0.5
        },
        {
          text: 'Fire drill! SPRINT (SHIFT + W) for a moment. Do not actually leave the building.',
          done: (g, dt) => {
            if (g.player.sprinting) g.sprintDrill += dt;
            return g.sprintDrill > 0.9;
          }
        },
        {
          text: 'Find the breakroom (northeast) and open its door (E).',
          done: (g) => g.built!.doors[0].open
        },
        {
          text: 'It is 5 PM. Retrieve YOUR lunch from the communal fridge.',
          done: (g) => g.hasLunch
        }
      ];
    } else {
      this.tutorialSteps = [];
    }

    this.hud.hideEnd();
    this.hud.setKeycards(this.inventory);
    this.hud.setDetection(0, false);
  }

  private onFridge(): void {
    const def = LEVELS[this.levelIndex];
    if (def.tutorial) {
      this.hasLunch = true;
      this.hud.toast('The fridge is empty. Your tupperware is gone. In its place: a sticky note — "welcome to Halcyon."');
      this.audio.say('Your lunch is gone. Welcome to Halcyon.', { voice: 0, rate: 0.95 });
      this.audio.sting();
      const session = this.session;
      setTimeout(() => {
        if (this.session === session) this.completeLevel();
      }, 1800);
      return;
    }
    this.hasLunch = true;
    this.audio.grab();
    this.hud.toast(`You take ${def.lunchName}. It is… beautiful.`);
    if (def.finale) {
      this.lockdown = true;
      this.alertBoost = 3;
      for (const g of this.guards) g.opts.patrolSpeed = (g.opts.patrolSpeed ?? 1.7) * 1.35;
      this.audio.alarm();
      this.hud.toast('LOCKDOWN. Every camera turns at once. The freight elevator, northeast — GO.');
    } else {
      this.alertBoost = 1.5;
      this.hud.toast('The floor feels tense. Get back to the elevator.');
    }
    this.noise.emit(def.fridge.x, def.fridge.z, 9, 0.3);
  }

  private onGuardState(g: Guard, to: GuardState): void {
    if (to === 'suspicious') {
      this.audio.sting();
      const bark = pick(SUSPICIOUS_BARKS);
      this.speakAs(g.opts.name, bark);
      this.hud.toast(`${g.opts.name}: “${bark}”`);
      if (!this.tipShown) {
        this.tipShown = true;
        this.hud.toast(
          "TIP — You blend in while WALKING UPRIGHT in public areas. Crouching, sprinting, trespassing, and carrying someone's lunch are what get you noticed.",
          9000
        );
      }
    } else if (to === 'chase') {
      this.stats.spotted++;
      this.audio.alarm();
      const bark = pick(CHASE_BARKS);
      this.speakAs(g.opts.name, bark);
      this.hud.toast(`${g.opts.name}: “${bark}”`);
    } else if (to === 'return') {
      const bark = pick(CALM_BARKS);
      this.speakAs(g.opts.name, bark);
      this.hud.toast(`${g.opts.name}: “${bark}”`, 2200);
    }
  }

  private onCaught(g: Guard): void {
    if (this.state !== 'play') return;
    this.state = 'caught';
    this.audio.caught();
    this.speakAs(g.opts.name, "Badge check. Let's take a little walk to H.R.");
    this.hud.showEnd(
      'caught',
      'ESCORTED TO HR',
      `${g.opts.name} walked you to a beige room containing one laminated pamphlet. ` +
        `Time ${this.stats.time.toFixed(0)}s · Spotted ${this.stats.spotted}× — R to retry · M for the lobby.`
    );
  }

  private completeLevel(): void {
    if (this.state !== 'play') return;
    this.state = 'complete';
    this.audio.success();
    const def = LEVELS[this.levelIndex];
    this.save.unlocked = Math.max(this.save.unlocked, Math.min(this.levelIndex + 1, LEVELS.length - 1));
    this.persist();
    if (def.tutorial) {
      this.hud.showEnd(
        'complete',
        'DAY ONE COMPLETE',
        'Someone took your lunch on your first day. HR gave you a pamphlet. Tomorrow, you do something about it. ' +
          'N for your next shift · M for the lobby.'
      );
      return;
    }
    const ghost = this.stats.spotted === 0;
    this.hud.showEnd(
      'complete',
      ghost ? 'EMPLOYEE OF THE MONTH' : 'MISSION COMPLETE',
      `The lunch is yours. Somewhere upstairs, a memo is already being drafted. ` +
        `Time ${this.stats.time.toFixed(0)}s · Spotted ${this.stats.spotted}× · Notes ${this.stats.notes}` +
        (ghost ? ' · GHOST CLEARANCE.' : '.') +
        ` — ${this.levelIndex < LEVELS.length - 1 ? 'N for next shift · ' : ''}R to replay · M for the lobby.`
    );
  }

  private showEnding(ending: { title: string; body: string }): void {
    this.state = 'ending';
    this.audio.success();
    this.save.unlocked = LEVELS.length - 1;
    this.persist();
    document.getElementById('ending-title')!.textContent = ending.title;
    document.getElementById('ending-body')!.textContent = ending.body;
  }

  /**
   * Free the previous level's GPU resources — geometries, materials,
   * per-level textures, and the sun's shadow map. Sprite indicator
   * textures are shared module singletons and are deliberately kept.
   */
  private disposeLevel(root: THREE.Object3D): void {
    root.traverse((obj) => {
      if ((obj as THREE.Sprite).isSprite) {
        (obj as THREE.Sprite).material.dispose();
        return;
      }
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const std = m as THREE.MeshStandardMaterial;
          std.map?.dispose();
          m.dispose();
        }
      }
      const light = obj as THREE.DirectionalLight;
      if (light.isLight && light.shadow?.map) {
        light.shadow.map.dispose();
        light.shadow.map = null;
      }
    });
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.rendererSystem.setSize(window.innerWidth, window.innerHeight);
  }

  // ------------------------------------------------------------- frame

  private inRestricted(px: number, pz: number): boolean {
    const zones = LEVELS[this.levelIndex].restricted;
    if (!zones) return false;
    for (const [cx, cz, w, d] of zones) {
      if (Math.abs(px - cx) < w / 2 && Math.abs(pz - cz) < d / 2) return true;
    }
    return false;
  }

  /** Standing in an unlit pocket — guards can't pick you out from 2 m+. */
  private inShadow(px: number, pz: number): boolean {
    const zones = LEVELS[this.levelIndex].dark;
    if (!zones) return false;
    for (const [cx, cz, w, d] of zones) {
      if (Math.abs(px - cx) < w / 2 && Math.abs(pz - cz) < d / 2) return true;
    }
    return false;
  }

  /** Re-stamp the nav grid's dynamic layer with the currently-locked doors. */
  private refreshNavDoors(): void {
    if (!this.built) return;
    this.nav?.setDoorCells(this.built.doors.filter((d) => d.locked).map((d) => d.collider));
  }

  private frame(t: number): void {
    const dt = Math.min((t - this.lastT) / 1000 || 0, 0.05);
    this.lastT = t;

    const active = this.input.pointerLocked || this.debugFree;
    this.input.lockingEnabled = this.state === 'play';

    // Overlay visibility per state.
    this.menuEl.classList.toggle('hidden', this.state !== 'menu');
    this.briefingEl.classList.toggle('hidden', this.state !== 'briefing');
    this.choiceEl.classList.toggle('hidden', this.state !== 'choice');
    this.endingEl.classList.toggle('hidden', this.state !== 'ending');
    this.lockOverlay.classList.toggle('hidden', this.state !== 'play' || active);

    // Menus need the cursor: release pointer lock the moment any
    // non-play screen takes over (N/R from the end card used to leave
    // the lock held, forcing a manual ESC that then tripped Chrome's
    // relock cooldown).
    if (this.state !== 'play' && this.input.pointerLocked) document.exitPointerLock();

    if (this.state === 'caught' || this.state === 'complete') {
      if (this.input.wasPressed('KeyR')) {
        this.hud.hideEnd();
        this.loadLevel(this.levelIndex);
        this.state = 'play';
      } else if (
        this.state === 'complete' &&
        this.input.wasPressed('KeyN') &&
        this.levelIndex < LEVELS.length - 1
      ) {
        this.hud.hideEnd();
        this.showBriefing(this.levelIndex + 1);
      } else if (this.input.wasPressed('KeyM')) {
        this.toMenu();
      }
    } else if (this.state === 'play' && !active && this.input.wasPressed('KeyM')) {
      this.toMenu();
    }

    if (this.state === 'play' && this.built) {
      const def = LEVELS[this.levelIndex];
      this.stats.time += dt;
      this.player.enabled = active;
      this.player.update(dt, this.input, this.world);

      const px = this.player.position.x;
      const pz = this.player.position.z;
      const restricted = this.inRestricted(px, pz);
      // Sprinting kicks up enough of a scene that the shadows won't save you.
      const hidden = this.inShadow(px, pz) && !this.player.sprinting;
      const behaviorActive =
        this.hasLunch || restricted || this.player.crouching || this.player.sprinting;

      if (
        this.footsteps.update(dt, this.player.speed, this.player.crouching, this.player.sprinting, px, pz, this.noise)
      ) {
        this.audio.step(this.player.crouching);
      }

      const senseCtx: GuardSenseCtx = { alertBoost: this.alertBoost, restricted, lunch: this.hasLunch, hidden };
      const noises = this.noise.drain();
      for (const g of this.guards) {
        g.update(dt, this.player, this.world, noises, (gg) => this.onCaught(gg), senseCtx);
        // Audible guard footsteps, louder as they close in. Gated on
        // `active` so the pause overlay is silent, and with no volume
        // floor so distant patrols fade out instead of crackling forever.
        if (g.travel > 1.9) {
          g.travel = 0;
          const gd = Math.hypot(g.x - px, g.z - pz);
          if (active && gd < 10) this.audio.step(false, (1 - gd / 10) * 0.7);
        }
      }
      for (const d of this.built.doors) d.update(dt);
      for (const kc of this.built.keycards) {
        if (kc.mesh.visible) kc.mesh.rotation.y += dt * 1.6;
      }
      let camHeat = 0;
      for (const cam of this.built.cameras) {
        if (cam.update(dt, px, pz, this.player.crouching, this.world, behaviorActive)) {
          this.audio.cameraBeep();
          // PA announcer: UK Female at a measured pace, distinct from guards.
          this.audio.say('Camera alert. Security has been paged.', { voice: 1, rate: 0.88 });
          this.hud.toast('CAMERA — movement flagged. Security is being paged.');
          this.noise.emit(px, pz, 18, 0.4);
        }
        camHeat = Math.max(camHeat, cam.heat);
      }
      for (const laser of this.built.lasers) {
        laser.update(dt);
        if (laser.crossed(px, pz, this.player.radius)) {
          this.audio.laserBuzz();
          this.hud.toast('LASER GRID TRIPPED. That one is on you.');
          this.noise.emit(px, pz, 22, 0.55);
        }
      }

      const it = this.interact.current(px, pz, this.player.yaw);
      this.hud.setPrompt(it ? it.prompt() : null);
      if (it && this.input.wasPressed('KeyE')) it.act();

      // Objective line.
      if (def.tutorial && this.tutorialSteps.length > 0) {
        const step = this.tutorialSteps[this.tutorialIndex];
        if (step && step.done(this, dt) && this.tutorialIndex < this.tutorialSteps.length - 1) {
          this.tutorialIndex++;
          this.audio.uiClick();
        }
        this.hud.setObjective(this.tutorialSteps[this.tutorialIndex]?.text ?? '');
      } else {
        const anyLocked = this.built.doors.some((d) => d.locked);
        this.hud.setObjective(
          this.hasLunch ? def.objectives.escape : anyLocked ? def.objectives.start : def.objectives.toFridge
        );
      }

      // Detection meter: worst of guard suspicion and camera heat.
      let maxS = camHeat;
      let chase = false;
      for (const g of this.guards) {
        maxS = Math.max(maxS, g.suspicion);
        if (g.state === 'chase') chase = true;
      }
      this.hud.setDetection(maxS, chase);
      this.hud.setStamina(this.player.stamina, this.player.winded);
      this.hud.setHidden(hidden && !chase);

      // Exit check (finale reroutes to the freight elevator during lockdown).
      if (this.hasLunch && !def.tutorial) {
        const exit = def.finale && this.lockdown && def.exitLockdown ? def.exitLockdown : def.exit;
        if (Math.hypot(px - exit.x, pz - exit.z) < exit.r) {
          if (def.finale) {
            this.state = 'choice';
            document.exitPointerLock?.();
          } else {
            this.completeLevel();
          }
        }
      }
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

  qaStart(index: number): void {
    this.loadLevel(index);
    this.state = 'play';
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

  getState(): { gameState: GameState } & Record<string, unknown> {
    return {
      gameState: this.state,
      level: this.levelIndex,
      levelId: LEVELS[this.levelIndex]?.id,
      unlocked: this.save.unlocked,
      pos: { x: +this.player.position.x.toFixed(2), z: +this.player.position.z.toFixed(2) },
      yaw: +this.player.yaw.toFixed(2),
      crouching: this.player.crouching,
      hasLunch: this.hasLunch,
      lockdown: this.lockdown,
      inventory: [...this.inventory],
      alertBoost: this.alertBoost,
      tutorialIndex: this.tutorialIndex,
      stats: { ...this.stats, time: +this.stats.time.toFixed(1) },
      guards: this.guards.map((g) => ({
        name: g.opts.name,
        state: g.state,
        suspicion: +g.suspicion.toFixed(2),
        x: +g.x.toFixed(1),
        z: +g.z.toFixed(1)
      })),
      cameras: this.built?.cameras.map((c) => +c.heat.toFixed(2)) ?? [],
      fps: this.lastFps,
      pointerLocked: this.input.pointerLocked
    };
  }
}
