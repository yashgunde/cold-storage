/**
 * Keyboard + pointer-lock mouse input. Key state is tracked by `code`
 * (physical key), so WASD works on any layout position-wise.
 */
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();

  /** Accumulated mouse deltas since last frame (only while pointer-locked). */
  mouseDX = 0;
  mouseDY = 0;
  pointerLocked = false;

  /** When true, click-to-lock is suppressed (menus, QA automation). */
  lockingEnabled = true;

  constructor(private el: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());

    window.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });

    el.addEventListener('click', () => {
      if (this.lockingEnabled && !this.pointerLocked) {
        this.el.requestPointerLock();
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.el;
    });
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** True only on the first frame the key went down. */
  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  /** Call once at the end of every frame. */
  endFrame(): void {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }
}
