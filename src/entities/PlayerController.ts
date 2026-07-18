import * as THREE from 'three';
import type { Input } from '../core/Input';
import type { CollisionWorld } from '../world/Collision';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const WALK_SPEED = 3.1;
const SPRINT_SPEED = 5.4;
const CROUCH_SPEED = 1.7;
const EYE_STAND = 1.62;
const EYE_CROUCH = 0.98;

export class PlayerController {
  /** Feet position on the floor plane (y is floor height, usually 0). */
  readonly position = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  crouching = false;
  sprinting = false;
  readonly radius = 0.35;
  sensitivity = 0.0023;
  /** Set false while menus/cutscenes own the frame. */
  enabled = true;
  /** Current horizontal speed — feeds noise + visibility in Phase 1. */
  speed = 0;

  private vx = 0;
  private vz = 0;
  private ctrlHeld = false;
  private eyeCurrent = EYE_STAND;
  private bobPhase = 0;

  constructor(readonly camera: THREE.PerspectiveCamera) {
    camera.rotation.order = 'YXZ';
  }

  spawnAt(x: number, z: number, yaw: number): void {
    this.position.set(x, 0, z);
    this.yaw = yaw;
    this.pitch = 0;
    this.vx = 0;
    this.vz = 0;
  }

  update(dt: number, input: Input, world: CollisionWorld): void {
    if (this.enabled) {
      this.yaw -= input.mouseDX * this.sensitivity;
      this.pitch = clamp(this.pitch - input.mouseDY * this.sensitivity, -1.45, 1.45);

      // Arrow-key look: touchpads often suppress pointer motion while
      // WASD is held (palm rejection), so keys must be able to steer too.
      const keyLook = 2.6 * dt;
      if (input.isDown('ArrowLeft')) this.yaw += keyLook;
      if (input.isDown('ArrowRight')) this.yaw -= keyLook;
      if (input.isDown('ArrowUp')) this.pitch = clamp(this.pitch + keyLook * 0.6, -1.45, 1.45);
      if (input.isDown('ArrowDown')) this.pitch = clamp(this.pitch - keyLook * 0.6, -1.45, 1.45);

      if (input.wasPressed('KeyC')) this.crouching = !this.crouching;
      // Ctrl is hold-to-crouch: engage on press, release on let-go
      // (C remains a latching toggle).
      const ctrl = input.isDown('ControlLeft') || input.isDown('ControlRight');
      if (ctrl && !this.ctrlHeld) this.crouching = true;
      else if (!ctrl && this.ctrlHeld) this.crouching = false;
      this.ctrlHeld = ctrl;

      const f = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
      const s = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
      this.sprinting = !this.crouching && input.isDown('ShiftLeft') && f > 0;

      // Camera-relative move axes: yaw=0 faces -Z (three.js convention).
      const sinY = Math.sin(this.yaw);
      const cosY = Math.cos(this.yaw);
      let wx = -sinY * f + cosY * s;
      let wz = -cosY * f - sinY * s;
      const len = Math.hypot(wx, wz);
      const target = this.crouching ? CROUCH_SPEED : this.sprinting ? SPRINT_SPEED : WALK_SPEED;
      if (len > 1e-5) {
        wx = (wx / len) * target;
        wz = (wz / len) * target;
      } else {
        wx = 0;
        wz = 0;
      }
      const k = Math.min(1, dt * 12);
      this.vx += (wx - this.vx) * k;
      this.vz += (wz - this.vz) * k;

      const [nx, nz] = world.resolveCircle(
        this.position.x + this.vx * dt,
        this.position.z + this.vz * dt,
        this.radius
      );
      this.position.x = nx;
      this.position.z = nz;
    } else {
      this.vx = 0;
      this.vz = 0;
    }

    this.speed = Math.hypot(this.vx, this.vz);

    const eyeTarget = this.crouching ? EYE_CROUCH : EYE_STAND;
    this.eyeCurrent += (eyeTarget - this.eyeCurrent) * Math.min(1, dt * 10);

    this.bobPhase += dt * this.speed * 2.6;
    const bob = Math.sin(this.bobPhase) * Math.min(1, this.speed / WALK_SPEED) * 0.026;

    this.camera.position.set(
      this.position.x,
      this.position.y + this.eyeCurrent + bob,
      this.position.z
    );
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }
}
