import * as THREE from 'three';

export type IndicatorState = 'none' | 'question' | 'alert';

export interface FigureOpts {
  shirt: number;
  pants: number;
  skin?: number;
  /** Cap color — guards get one, civilians get hair instead. */
  cap?: number;
  /** Stable per-character seed; drives skin/hair variation. */
  seed?: number;
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

const SKIN_TONES = [0xd9a184, 0xc78b68, 0x9c6b4b, 0x74513a, 0xe8b795];
const HAIR_COLORS = [0x2b2118, 0x171512, 0x6b4a2f, 0x8a8378, 0x7a4a2a];

/**
 * Humanoid built from capsules and spheres — tapered torso, shoulders,
 * neck, ears, layered eyes, hair (or a guard cap) — with a floating
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
    const seed = opts.seed ?? 0;
    const mat = (color: number, roughness = 0.85) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
    const add = (mesh: THREE.Mesh, x: number, y: number, z: number, shadow = true): THREE.Mesh => {
      mesh.position.set(x, y, z);
      mesh.castShadow = shadow;
      this.root.add(mesh);
      return mesh;
    };

    const skin = opts.skin ?? SKIN_TONES[seed % SKIN_TONES.length];
    const skinMat = mat(skin, 0.65);
    const skinDark = new THREE.Color(skin).multiplyScalar(0.8).getHex();

    // ---- Legs: capsules with shoes, pivoting at the hip ----
    const makeLeg = (x: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.78, 0);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.52, 3, 10), mat(opts.pants));
      leg.position.y = -0.37;
      leg.castShadow = true;
      pivot.add(leg);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.25), mat(0x241f1a, 0.6));
      shoe.position.set(0, -0.72, -0.04);
      shoe.castShadow = true;
      pivot.add(shoe);
      this.root.add(pivot);
      return pivot;
    };
    this.legL = makeLeg(-0.105);
    this.legR = makeLeg(0.105);

    // ---- Hips ----
    const hips = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), mat(opts.pants));
    hips.scale.set(1.05, 0.62, 0.78);
    add(hips, 0, 0.84, 0);

    // ---- Torso: tapered (shoulders wider than waist), flattened front-back ----
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.165, 0.58, 14), mat(opts.shirt));
    torso.scale.z = 0.68;
    add(torso, 0, 1.13, 0);
    const shoulderGeo = new THREE.SphereGeometry(0.088, 10, 8);
    const shoulderMat = mat(opts.shirt);
    const shoulderL = new THREE.Mesh(shoulderGeo, shoulderMat);
    add(shoulderL, -0.235, 1.38, 0);
    const shoulderR = new THREE.Mesh(shoulderGeo, shoulderMat);
    add(shoulderR, 0.235, 1.38, 0);

    // Guards wear a badge; civilians wear a tie. Both sell "office", cheap.
    if (opts.cap !== undefined) {
      const badge = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.065, 0.015), mat(0xc9a13b, 0.35));
      add(badge, -0.09, 1.28, -0.135, false);
    } else {
      const tieMat = mat(0x5a2530, 0.7);
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.3, 0.018), tieMat);
      add(tie, 0, 1.18, -0.145, false);
      const knot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.02), tieMat);
      add(knot, 0, 1.35, -0.148, false);
    }

    // ---- Arms: capsules with skin hands, slight outward hang ----
    const makeArm = (x: number, side: 1 | -1) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 1.36, 0);
      pivot.rotation.z = side * 0.07;
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.4, 3, 10), mat(opts.shirt));
      arm.position.y = -0.24;
      arm.castShadow = true;
      pivot.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), skinMat);
      hand.position.y = -0.5;
      hand.castShadow = true;
      pivot.add(hand);
      this.root.add(pivot);
      return pivot;
    };
    this.armL = makeArm(-0.295, -1);
    this.armR = makeArm(0.295, 1);

    // ---- Neck + head group ----
    // The head lives in its own group, raised clear of the shoulders so a
    // real neck shows — without the gap the figure reads hunched.
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.062, 0.14, 10), skinMat);
    add(neck, 0, 1.475, 0);
    const headGrp = new THREE.Group();
    headGrp.position.set(0, 1.62, 0);
    this.root.add(headGrp);
    const addH = (mesh: THREE.Mesh, x: number, y: number, z: number, shadow = false): THREE.Mesh => {
      mesh.position.set(x, y, z);
      mesh.castShadow = shadow;
      headGrp.add(mesh);
      return mesh;
    };

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 14), skinMat);
    head.scale.set(1, 1.15, 1.03);
    addH(head, 0, 0, 0, true);
    const earGeo = new THREE.SphereGeometry(0.03, 8, 6);
    const earL = new THREE.Mesh(earGeo, skinMat);
    earL.scale.set(0.55, 1, 0.8);
    addH(earL, -0.134, 0, 0.01);
    const earR = new THREE.Mesh(earGeo, skinMat);
    earR.scale.set(0.55, 1, 0.8);
    addH(earR, 0.134, 0, 0.01);

    // ---- Face on the forward (-Z) side ----
    // Eyes: white sclera with dark iris, sitting just proud of the head curve.
    const scleraGeo = new THREE.SphereGeometry(0.022, 10, 8);
    const irisGeo = new THREE.SphereGeometry(0.011, 8, 6);
    const scleraMat = mat(0xf2efe8, 0.4);
    const irisMat = mat(0x33261d, 0.35);
    for (const sx of [-0.048, 0.048]) {
      const sclera = new THREE.Mesh(scleraGeo, scleraMat);
      sclera.scale.set(1, 0.85, 0.5);
      addH(sclera, sx, 0.022, -0.122);
      const iris = new THREE.Mesh(irisGeo, irisMat);
      iris.scale.set(1, 1, 0.5);
      addH(iris, sx, 0.02, -0.134);
    }
    // Brows: thin, slightly angled bars in the hair color.
    const hairColor = HAIR_COLORS[(seed >> 3) % HAIR_COLORS.length];
    const browGeo = new THREE.BoxGeometry(0.052, 0.012, 0.016);
    const browMat = mat(hairColor, 0.8);
    const browL = new THREE.Mesh(browGeo, browMat);
    browL.rotation.z = -0.12;
    addH(browL, -0.048, 0.058, -0.12);
    const browR = new THREE.Mesh(browGeo, browMat);
    browR.rotation.z = 0.12;
    addH(browR, 0.048, 0.058, -0.12);
    // Nose: soft wedge, not a block.
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), mat(skinDark, 0.6));
    nose.scale.set(0.6, 0.88, 0.7);
    addH(nose, 0, -0.018, -0.132);
    // Mouth: thin muted line.
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.011, 0.013), mat(0x9c6553, 0.7));
    addH(mouth, 0, -0.068, -0.121);

    // ---- Hair or cap ----
    if (opts.cap !== undefined) {
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.148, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.2),
        mat(opts.cap, 0.6)
      );
      cap.scale.set(1.04, 0.95, 1.06);
      addH(cap, 0, 0.04, 0, true);
      const brim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.108, 0.122, 0.02, 12, 1, false, -Math.PI / 2, Math.PI),
        mat(opts.cap, 0.6)
      );
      addH(brim, 0, 0.096, -0.12);
    } else {
      // Hemispherical crown tilted back to cover the nape, plus per-seed extras.
      const hairMat = mat(hairColor, 0.9);
      const crown = new THREE.Mesh(
        new THREE.SphereGeometry(0.142, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.75),
        hairMat
      );
      crown.scale.set(1.03, 1.05, 1.05);
      crown.rotation.x = 0.38; // sweep coverage toward the back of the head
      addH(crown, 0, 0.022, 0.012, true);
      const style = (seed >> 6) % 3;
      if (style === 1) {
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), hairMat);
        addH(bun, 0, 0.075, 0.128);
      } else if (style === 2) {
        const sideGeo = new THREE.SphereGeometry(0.047, 8, 8);
        const sideL = new THREE.Mesh(sideGeo, hairMat);
        sideL.scale.set(0.6, 1.3, 0.9);
        addH(sideL, -0.127, -0.055, 0.02);
        const sideR = new THREE.Mesh(sideGeo, hairMat);
        sideR.scale.set(0.6, 1.3, 0.9);
        addH(sideR, 0.127, -0.055, 0.02);
      }
    }

    questionTex ??= indicatorTexture('?', '#ffc53d');
    alertTex ??= indicatorTexture('!', '#ff5d5d');
    this.indicator = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: questionTex, transparent: true, depthWrite: false })
    );
    this.indicator.position.y = 2.1;
    this.indicator.scale.setScalar(0.5);
    this.indicator.visible = false;
    this.root.add(this.indicator);

    // ---- Per-character build: subtle height + girth variety so figures read
    // as distinct people, not one silhouette recolored. x and z scale together
    // (uniform girth) so yaw rotation stays shear-free; the indicator, a child
    // of root, rides up with taller figures automatically.
    // Unsigned shift (>>>): seed is a full uint32, so a signed >> would go
    // negative for high-bit seeds and push scale below the intended band.
    const height = 0.94 + ((seed >>> 9) % 5) * 0.03; // 0.94–1.06
    const build = 0.93 + ((seed >>> 12) % 4) * 0.045; // 0.93–1.065
    this.root.scale.set(build, height, build);
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
