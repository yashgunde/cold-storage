import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Cinematic vignette — darkens the frame corners so the eye stays centered
 * and the office reads moodier. Multiplies in linear space (runs before
 * OutputPass), so it only dims and never shifts the warm palette's hue.
 */
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    strength: { value: 0.34 },
    radius: { value: 0.55 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float strength;
    uniform float radius;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float dist = length(vUv - 0.5) * 1.41421356;
      float v = smoothstep(radius, 1.0, dist);
      c.rgb *= 1.0 - v * strength;
      gl_FragColor = c;
    }`
};

/**
 * Owns the WebGL renderer and the post-processing chain.
 * Kept separate from Game so quality settings only touch this file.
 */
export class RendererSystem {
  readonly renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private vignette: ShaderPass | null = null;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
  }

  /** Build the postfx chain once the scene exists. */
  initPost(scene: THREE.Scene, camera: THREE.Camera): void {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    // Subtle bloom — high threshold so only emissives (fixtures, windows,
    // keycards, alarm lights) glow, not the whole frame.
    // Long sightlines stack dozens of glowing troffers + the emissive
    // ceiling; keep bloom tight or the far end of corridors whites out.
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.22,
      0.4,
      0.88
    );
    this.composer.addPass(this.bloom);
    this.vignette = new ShaderPass(VignetteShader);
    this.composer.addPass(this.vignette);
    this.composer.addPass(new OutputPass());
  }

  /** HIGH: full pixel ratio + bloom. LOW: 1x pixel ratio, no bloom. */
  setQuality(high: boolean): void {
    this.renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio, 2) : 1);
    if (this.bloom) this.bloom.enabled = high;
    if (this.vignette) this.vignette.enabled = high;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer?.setSize(window.innerWidth, window.innerHeight);
  }

  setSize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    this.composer?.setSize(width, height);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (this.composer) this.composer.render();
    else this.renderer.render(scene, camera);
  }
}
