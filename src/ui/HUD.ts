/**
 * All in-game DOM UI: objective line, detection meter, interaction
 * prompt, toasts, keycard chips, and end-of-mission overlays.
 */
export class HUD {
  private readonly objectiveEl = document.getElementById('objective')!;
  private readonly detectEl = document.getElementById('detect')!;
  private readonly detectFillEl = document.getElementById('detect-fill')!;
  private readonly staminaEl = document.getElementById('stamina')!;
  private readonly staminaFillEl = document.getElementById('stamina-fill')!;
  private readonly hiddenEl = document.getElementById('hidden-tag')!;
  private readonly promptEl = document.getElementById('prompt')!;
  private readonly toastsEl = document.getElementById('toasts')!;
  private readonly keysEl = document.getElementById('keys')!;
  private readonly endEl = document.getElementById('end-overlay')!;
  private readonly endTitleEl = document.getElementById('end-title')!;
  private readonly endBodyEl = document.getElementById('end-body')!;

  setObjective(text: string): void {
    this.objectiveEl.textContent = text ? `OBJECTIVE — ${text}` : '';
  }

  /** Stamina bar: shown only while it matters (not full), amber when winded. */
  setStamina(v: number, winded: boolean): void {
    this.staminaEl.style.opacity = v < 0.999 ? '1' : '0';
    this.staminaFillEl.style.width = `${Math.round(v * 100)}%`;
    this.staminaFillEl.style.background = winded ? '#ff7043' : '#7dd3fc';
  }

  setHidden(on: boolean): void {
    this.hiddenEl.style.opacity = on ? '1' : '0';
  }

  setPrompt(text: string | null): void {
    this.promptEl.textContent = text ? `[E] ${text}` : '';
  }

  /** v in 0..1 drives the fill; chase turns the whole meter red. */
  setDetection(v: number, chase: boolean): void {
    this.detectEl.style.opacity = v > 0.02 || chase ? '1' : '0';
    this.detectFillEl.style.width = `${Math.round((chase ? 1 : v) * 100)}%`;
    this.detectFillEl.style.background = chase
      ? '#ff5d5d'
      : v > 0.7
        ? '#ff9a3d'
        : '#ffc53d';
  }

  toast(text: string, ms = 3200): void {
    const div = document.createElement('div');
    div.className = 'toast';
    div.textContent = text;
    this.toastsEl.appendChild(div);
    while (this.toastsEl.children.length > 4) this.toastsEl.firstChild!.remove();
    setTimeout(() => {
      div.classList.add('fade');
      setTimeout(() => div.remove(), 450);
    }, ms);
  }

  setKeycards(ids: Iterable<string>): void {
    this.keysEl.textContent = '';
    for (const id of ids) {
      const chip = document.createElement('span');
      chip.className = `keychip key-${id.toLowerCase()}`;
      chip.textContent = id;
      this.keysEl.appendChild(chip);
    }
  }

  showEnd(kind: 'caught' | 'complete', title: string, body: string): void {
    this.endEl.classList.remove('hidden', 'caught', 'complete');
    this.endEl.classList.add(kind);
    this.endTitleEl.textContent = title;
    this.endBodyEl.textContent = body;
  }

  hideEnd(): void {
    this.endEl.classList.add('hidden');
  }
}
