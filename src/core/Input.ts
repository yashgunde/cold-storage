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
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());

    window.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });

    el.addEventListener('click', () => this.requestLock());
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.el;
      if (this.pointerLocked && !locked) this.lastUnlockAt = performance.now();
      this.pointerLocked = locked;
    });
  }

  private lastUnlockAt = 0;
  private relockTimer: number | null = null;

  /**
   * Acquire pointer lock, respecting Chrome's ~1.5s cooldown after an
   * ESC exit. Requests inside the cooldown are deferred until it ends
   * (the click's transient activation lasts ~5s, so the deferred call
   * still counts as user-initiated) instead of rejecting with the
   * "cannot be acquired immediately" SecurityError.
   */
  requestLock(): void {
    if (!this.lockingEnabled || this.pointerLocked) return;
    const wait = this.lastUnlockAt + 1650 - performance.now();
    if (wait > 0) {
      if (this.relockTimer === null) {
        this.relockTimer = window.setTimeout(() => {
          this.relockTimer = null;
          this.requestLock();
        }, wait + 60);
      }
      return;
    }
    const req = this.el.requestPointerLock() as unknown as Promise<void> | undefined;
    if (req && typeof req.catch === 'function') {
      req.catch(() => {
        // Browser still said no — restart the cooldown so the next
        // click defers instead of failing the same way.
        this.lastUnlockAt = performance.now();
      });
    }
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
