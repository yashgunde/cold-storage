import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

export type IndicatorState = 'none' | 'question' | 'alert';

/**
 * The surface Guard drives, satisfied structurally by BOTH this
 * GLTF-backed figure and the primitive CharacterFigure — so guards fall
 * back to primitives seamlessly until the model has loaded.
 */
export interface Figure {
  readonly root: THREE.Object3D;
  setPosition(x: number, z: number): void;
  setFacing(yaw: number): void;
  animate(dt: number, speed: number): void;
  setIndicator(state: IndicatorState): void;
}

export interface ModelFigureOpts {
  shirt: number;
  pants: number;
  cap?: number;
  seed?: number;
}

// RobotExpressive faces +Z natively; our guards face -Z at yaw 0.
const MODEL_FACING = Math.PI;
const TARGET_HEIGHT = 1.75;

let template: THREE.Object3D | null = null;
let clips: THREE.AnimationClip[] = [];
let normScale = 1;
let footOffset = 0;

/** Load the shared character model once. Failure is silent — guards then
 *  keep using the primitive fallback. */
export async function preloadCharacterModel(url: string): Promise<void> {
  try {
    const gltf = await new GLTFLoader().loadAsync(url);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const h = box.max.y - box.min.y || 1;
    normScale = TARGET_HEIGHT / h;
    footOffset = -box.min.y * normScale;
    clips = gltf.animations;
    template = gltf.scene;
  } catch {
    template = null;
  }
}

export function isCharacterModelReady(): boolean {
  return template !== null;
}

function indicatorTexture(text: string, color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.font = 'bold 52px "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.6)';
  g.shadowBlur = 6;
  g.fillStyle = color;
  g.fillText(text, 32, 34);
  return new THREE.CanvasTexture(c);
}
let qTex: THREE.CanvasTexture | undefined;
let aTex: THREE.CanvasTexture | undefined;

export class CharacterModel implements Figure {
  readonly root = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private currentName = '';
  private readonly indicator: THREE.Sprite;

  constructor(opts: ModelFigureOpts) {
    // SkeletonUtils.clone deep-copies skinned meshes with their skeleton.
    const model = cloneSkinned(template!);
    model.scale.setScalar(normScale);
    model.position.y = footOffset;
    model.rotation.y = MODEL_FACING;

    // Tint bodies so security (dark) vs civilian (shirt hue) still reads.
    const tint = new THREE.Color(opts.shirt);
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      const src = Array.isArray(m.material) ? m.material : [m.material];
      const tinted = src.map((mat) => {
        const cl = (mat as THREE.MeshStandardMaterial).clone();
        if (cl.color) cl.color.lerp(tint, 0.5);
        return cl;
      });
      m.material = tinted.length === 1 ? tinted[0] : tinted;
    });
    this.root.add(model);

    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of clips) this.actions.set(clip.name, this.mixer.clipAction(clip));
    this.play('Idle');

    qTex ??= indicatorTexture('?', '#ffc53d');
    aTex ??= indicatorTexture('!', '#ff5d5d');
    this.indicator = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: qTex, transparent: true, depthWrite: false })
    );
    this.indicator.position.y = 2.15;
    this.indicator.scale.setScalar(0.5);
    this.indicator.visible = false;
    this.root.add(this.indicator);
  }

  private play(name: string): void {
    if (this.currentName === name) return;
    const next = this.actions.get(name);
    if (!next) return;
    const prev = this.actions.get(this.currentName);
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.25).play();
    if (prev && prev !== next) prev.fadeOut(0.25);
    this.currentName = name;
  }

  setPosition(x: number, z: number): void {
    this.root.position.set(x, 0, z);
  }

  setFacing(yaw: number): void {
    this.root.rotation.y = yaw;
  }

  animate(dt: number, speed: number): void {
    this.mixer.update(dt);
    this.play(speed > 3.6 ? 'Running' : speed > 0.25 ? 'Walking' : 'Idle');
  }

  setIndicator(state: IndicatorState): void {
    if (state === 'none') {
      this.indicator.visible = false;
      return;
    }
    this.indicator.visible = true;
    this.indicator.material.map = state === 'question' ? qTex! : aTex!;
    this.indicator.material.needsUpdate = true;
  }
}
