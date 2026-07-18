/**
 * Fully synthesized audio — no asset files. A lazy AudioContext (created
 * on first user gesture) drives an ambient office hum plus short
 * procedural stingers for gameplay events.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  /** Call from any user-gesture handler; safe to call repeatedly. */
  ensure(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // Ambient hum: two detuned low oscillators, very quiet.
      const humGain = this.ctx.createGain();
      humGain.gain.value = 0.012;
      humGain.connect(this.master);
      for (const [freq, type] of [[55, 'sawtooth'], [120, 'sine']] as Array<[number, OscillatorType]>) {
        const osc = this.ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        osc.connect(humGain);
        osc.start();
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private blip(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
    slideTo?: number
  ): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  step(crouching: boolean): void {
    this.blip(70 + Math.random() * 25, 0.06, 'triangle', crouching ? 0.015 : 0.05);
  }

  /** A guard got curious. */
  sting(): void {
    this.blip(392, 0.18, 'sine', 0.12);
    this.blip(466, 0.3, 'sine', 0.12, 0.14);
  }

  /** Chase begins. */
  alarm(): void {
    for (let i = 0; i < 3; i++) {
      this.blip(740, 0.14, 'square', 0.07, i * 0.22);
      this.blip(587, 0.14, 'square', 0.07, i * 0.22 + 0.11);
    }
  }

  cameraBeep(): void {
    this.blip(1245, 0.09, 'square', 0.08);
    this.blip(1245, 0.09, 'square', 0.08, 0.14);
  }

  laserBuzz(): void {
    this.blip(160, 0.4, 'sawtooth', 0.12, 0, 60);
  }

  grab(): void {
    this.blip(523, 0.12, 'sine', 0.12);
    this.blip(659, 0.12, 'sine', 0.12, 0.1);
    this.blip(784, 0.22, 'sine', 0.12, 0.2);
  }

  caught(): void {
    this.blip(330, 0.5, 'sawtooth', 0.12, 0, 110);
    this.blip(165, 0.7, 'sawtooth', 0.1, 0.25, 82);
  }

  success(): void {
    const seq = [523, 659, 784, 1047];
    seq.forEach((f, i) => this.blip(f, 0.16, 'triangle', 0.11, i * 0.12));
    this.blip(1319, 0.4, 'triangle', 0.1, seq.length * 0.12);
  }

  uiClick(): void {
    this.blip(880, 0.05, 'square', 0.04);
  }
}
