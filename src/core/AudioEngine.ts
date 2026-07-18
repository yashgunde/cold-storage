/**
 * Fully synthesized audio — no asset files. A lazy AudioContext (created
 * on first user gesture) drives an ambient office hum plus short
 * procedural stingers for gameplay events.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private voiceRoster: SpeechSynthesisVoice[] = [];
  private masterVolume = 0.5;
  private voiceVolume = 0.9;

  /** 0..1 master gain for all synthesized SFX; applies live. */
  setMasterVolume(v: number): void {
    this.masterVolume = v;
    if (this.master) this.master.gain.value = v;
  }

  /** 0..1 loudness for spoken dialogue. */
  setVoiceVolume(v: number): void {
    this.voiceVolume = v;
  }

  /**
   * Best-sounding voices first: Chrome's Google network voices are far more
   * natural than the local SAPI ones (Microsoft David sounds robotic).
   * Locals stay at the end of the roster as offline fallbacks.
   */
  private refreshVoices(): void {
    const all = window.speechSynthesis?.getVoices() ?? [];
    const preferred = [
      'Google US English',
      'Google UK English Female',
      'Google UK English Male',
      'Microsoft Zira - English (United States)',
      'Microsoft Mark - English (United States)'
    ];
    const natural = all.filter((v) => /Natural/i.test(v.name) && v.lang.startsWith('en'));
    const named = preferred
      .map((n) => all.find((v) => v.name === n))
      .filter((v): v is SpeechSynthesisVoice => !!v);
    this.voiceRoster = [...natural, ...named];
  }

  /** Call from any user-gesture handler; safe to call repeatedly. */
  ensure(): void {
    if (this.voiceRoster.length === 0 && window.speechSynthesis) {
      this.refreshVoices();
      window.speechSynthesis.onvoiceschanged = () => this.refreshVoices();
    }
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.masterVolume;
      this.master.connect(this.ctx.destination);
      // Ambient hum: two detuned sine oscillators, whisper-quiet. Sines
      // only — a sawtooth's harmonics read as constant static on speakers.
      const humGain = this.ctx.createGain();
      humGain.gain.value = 0.005;
      humGain.connect(this.master);
      for (const [freq, type] of [[50, 'sine'], [101, 'sine']] as Array<[number, OscillatorType]>) {
        const osc = this.ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        osc.connect(humGain);
        osc.start();
      }
      // White-noise buffer for footstep thuds.
      this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.2, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /**
   * Spoken dialogue via the OS speech synthesizer — guards actually talk.
   * `voice` picks a roster entry (modulo length) so each character keeps a
   * stable, natural-sounding voice; pitch/rate add variation on top.
   * Note: Google network voices ignore `pitch`, so voice choice + rate carry
   * most of the character differentiation.
   */
  say(text: string, opts?: { pitch?: number; rate?: number; volume?: number; voice?: number }): void {
    const synth = window.speechSynthesis;
    if (!synth || this.voiceVolume <= 0.01) return;
    // Don't pile up a backlog of barks during a chase.
    if (synth.speaking && synth.pending) return;
    const u = new SpeechSynthesisUtterance(text);
    if (this.voiceRoster.length > 0) {
      u.voice = this.voiceRoster[(opts?.voice ?? 0) % this.voiceRoster.length];
    }
    u.pitch = opts?.pitch ?? 1;
    u.rate = opts?.rate ?? 1.05;
    u.volume = (opts?.volume ?? 1) * this.voiceVolume;
    synth.speak(u);
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

  /** Footstep thud — filtered noise burst. vol scales for distant guards. */
  step(crouching: boolean, vol = 1): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    // Keep the cutoff low: above ~250 Hz the noise burst reads as hiss.
    filter.frequency.value = 150 + Math.random() * 80;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime((crouching ? 0.05 : 0.16) * vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + 0.13);
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
