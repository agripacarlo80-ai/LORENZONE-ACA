class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  constructor() {
    try {
      this.muted = localStorage.getItem('lorenzone_muted') === 'true';
    } catch {
      this.muted = false;
    }
  }

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    try {
      localStorage.setItem('lorenzone_muted', String(mute));
    } catch {
      // ignore storage errors
    }
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'sine', delay = 0, gainVal = 0.14): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playClick(): void {
    this.playTone(540, 0.06, 'triangle', 0, 0.08);
  }

  public playCorrect(): void {
    this.playTone(523.25, 0.12, 'sine', 0, 0.14);
    this.playTone(659.25, 0.12, 'sine', 0.08, 0.14);
    this.playTone(783.99, 0.2, 'sine', 0.16, 0.16);
  }

  public playWrong(): void {
    this.playTone(240, 0.16, 'sawtooth', 0, 0.08);
    this.playTone(190, 0.22, 'sawtooth', 0.12, 0.08);
  }

  public playCare(): void {
    this.playTone(587.33, 0.1, 'sine', 0, 0.12);
    this.playTone(880, 0.18, 'triangle', 0.08, 0.12);
  }

  public playLevelUp(): void {
    this.playTone(523.25, 0.1, 'triangle', 0, 0.15);
    this.playTone(659.25, 0.1, 'triangle', 0.09, 0.15);
    this.playTone(783.99, 0.1, 'triangle', 0.18, 0.15);
    this.playTone(1046.5, 0.35, 'triangle', 0.27, 0.18);
  }

  public playQuack(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.14);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.14, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playAlertSiren(): void {
    this.playTone(880, 0.18, 'square', 0, 0.14);
    this.playTone(660, 0.18, 'square', 0.2, 0.14);
    this.playTone(880, 0.18, 'square', 0.4, 0.14);
    this.playTone(660, 0.24, 'square', 0.6, 0.14);
  }
}

export const soundFx = new SoundEngine();
