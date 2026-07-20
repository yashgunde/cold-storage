import * as THREE from 'three';

// Shared geometry/material — every thrown can looks the same, so mint once.
const CAN_GEO = new THREE.CylinderGeometry(0.05, 0.05, 0.13, 8);
const CAN_MAT = new THREE.MeshStandardMaterial({
  color: 0xb9c0c6,
  metalness: 0.6,
  roughness: 0.35
});

/**
 * A thrown object (a soda can) that arcs from the player's hand to a landing
 * point, then rests on the floor. It carries no logic of its own beyond the
 * arc — Game emits the lure-noise on the frame it lands.
 */
export class Distraction {
  readonly mesh: THREE.Mesh;
  private t = 0;
  landed = false;

  constructor(
    private readonly from: THREE.Vector3,
    private readonly to: THREE.Vector3,
    private readonly dur: number,
    private readonly arc: number
  ) {
    this.mesh = new THREE.Mesh(CAN_GEO, CAN_MAT);
    this.mesh.castShadow = true;
    this.mesh.position.copy(from);
  }

  /** Advance the arc. Returns true exactly on the frame it touches down. */
  update(dt: number): boolean {
    if (this.landed) return false;
    this.t += dt;
    const u = Math.min(1, this.t / this.dur);
    this.mesh.position.lerpVectors(this.from, this.to, u);
    this.mesh.position.y += Math.sin(u * Math.PI) * this.arc; // parabolic lift
    this.mesh.rotation.x += dt * 12;
    this.mesh.rotation.z += dt * 7;
    if (u >= 1) {
      this.landed = true;
      this.mesh.position.copy(this.to);
      this.mesh.rotation.set(Math.PI / 2, 0, 0); // lie flat on its side
      return true;
    }
    return false;
  }
}
