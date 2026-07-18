import * as THREE from 'three';

export type IndicatorState = 'none' | 'question' | 'alert';

export interface FigureOpts {
  shirt: number;
  pants: number;
  skin?: number;
  /** Cap color — guards get one, civilians don't. */
  cap?: number;
}

function indicatorTexture(text: string, color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.font = 'bold 52px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 6;
  ctx.fillStyle = color;
  ctx.fillText(text, 32, 34);
  return new THREE.CanvasTexture(c);
}

let questionTex: THREE.CanvasTexture | undefined;
let alertTex: THREE.CanvasTexture | undefined;

/**
 * Stylized low-poly humanoid built from primitives, with a floating
 * ?/! awareness indicator (the classic stealth-game tell).
 */
export class CharacterFigure {
  readonly root = new THREE.Group();

  private readonly legL: THREE.Group;
  private readonly legR: THREE.Group;
  private readonly armL: THREE.Group;
  private readonly armR: THREE.Group;
  private readonly indicator: THREE.Sprite;
  private walkPhase = 0;

  constructor(opts: FigureOpts) {
    const mat = (color: number, roughness = 0.85) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
    const box = (w: number, h: number, d: number, color: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
      m.castShadow = true;
      return m;
    };

    const skin = opts.skin ?? 0xd9a184;

    // Limbs pivot at hip/shoulder so rotation.x swings them naturally.
    const limb = (x: number, y: number, w: number, h: number, d: number, color: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      const mesh = box(w, h, d, color);
      mesh.position.y = -h / 2;
      pivot.add(mesh);
      this.root.add(pivot);
      return pivot;
    };

    this.legL = limb(-0.11, 0.72, 0.16, 0.68, 0.18, opts.pants);
    this.legR = limb(0.11, 0.72, 0.16, 0.68, 0.18, opts.pants);
    this.armL = limb(-0.28, 1.28, 0.11, 0.56, 0.14, opts.shirt);
    this.armR = limb(0.28, 1.28, 0.11, 0.56, 0.14, opts.shirt);

    const torso = box(0.42, 0.6, 0.26, opts.shirt);
    torso.position.y = 1.02;
    this.root.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 12), mat(skin, 0.7));
    head.position.y = 1.5;
    head.castShadow = true;
    this.root.add(head);

    if (opts.cap !== undefined) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.07, 14), mat(opts.cap, 0.6));
      cap.position.y = 1.63;
      cap.castShadow = true;
      this.root.add(cap);
      const brim = box(0.2, 0.025, 0.14, opts.cap);
      brim.position.set(0, 1.6, -0.19);
      this.root.add(brim);
    }

    questionTex ??= indicatorTexture('?', '#ffc53d');
    alertTex ??= indicatorTexture('!', '#ff5d5d');
    this.indicator = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: questionTex, transparent: true, depthWrite: false })
    );
    this.indicator.position.y = 2.05;
    this.indicator.scale.setScalar(0.5);
    this.indicator.visible = false;
    this.root.add(this.indicator);
  }

  setPosition(x: number, z: number): void {
    this.root.position.set(x, 0, z);
  }

  /** Face direction of travel; yaw uses the same convention as the player. */
  setFacing(yaw: number): void {
    this.root.rotation.y = yaw;
  }

  setIndicator(state: IndicatorState): void {
    if (state === 'none') {
      this.indicator.visible = false;
      return;
    }
    this.indicator.visible = true;
    this.indicator.material.map = state === 'question' ? questionTex! : alertTex!;
    this.indicator.material.needsUpdate = true;
  }

  /** Procedural limb swing scaled by movement speed. */
  animate(dt: number, speed: number): void {
    const stride = Math.min(1, speed / 2.6);
    this.walkPhase += dt * (1.5 + speed * 3.4);
    const s = Math.sin(this.walkPhase) * 0.62 * stride;
    this.legL.rotation.x = s;
    this.legR.rotation.x = -s;
    this.armL.rotation.x = -s * 0.8;
    this.armR.rotation.x = s * 0.8;
  }
}
