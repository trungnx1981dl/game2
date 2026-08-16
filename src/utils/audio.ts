// Web Audio API based sound synthesizer for game show atmosphere

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private getContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  // Play a simple tone
  public playTone(freq: number, type: OscillatorType, duration: number, volume: number = 0.15) {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio playback error', e);
    }
  }

  // Button click / tick
  public playClick() {
    this.playTone(800, 'sine', 0.08, 0.1);
  }

  // Countdown tick
  public playTick() {
    this.playTone(600, 'triangle', 0.05, 0.08);
  }

  // Urgent countdown tick (last 5 seconds)
  public playUrgentTick() {
    this.playTone(950, 'square', 0.09, 0.12);
  }

  // Correct answer chime (pleasant ascending harmonic chord)
  public playCorrect() {
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'sine', 0.4, 0.2);
      }, idx * 75);
    });
  }

  // Incorrect answer buzz
  public playWrong() {
    const ctx = this.getContext();
    if (!ctx) return;

    this.playTone(180, 'sawtooth', 0.25, 0.2);
    setTimeout(() => {
      this.playTone(140, 'sawtooth', 0.35, 0.25);
    }, 120);
  }

  // Skill unlock / activation sparkle
  public playSkill() {
    const ctx = this.getContext();
    if (!ctx) return;

    const freqs = [440, 554.37, 659.25, 880, 1108.73, 1318.51];
    freqs.forEach((f, i) => {
      setTimeout(() => {
        this.playTone(f, 'sine', 0.3, 0.15);
      }, i * 50);
    });
  }

  // Round 3 Lockout sound (Buzzer winner)
  public playLockout() {
    const ctx = this.getContext();
    if (!ctx) return;

    this.playTone(880, 'triangle', 0.1, 0.3);
    setTimeout(() => this.playTone(1174.66, 'sine', 0.5, 0.3), 100);
  }

  // Victory fanfare for game over
  public playVictory() {
    const ctx = this.getContext();
    if (!ctx) return;

    const fanfare = [
      { f: 523.25, d: 150 },
      { f: 523.25, d: 150 },
      { f: 523.25, d: 150 },
      { f: 659.25, d: 400 },
      { f: 523.25, d: 200 },
      { f: 783.99, d: 600 },
    ];

    let delay = 0;
    fanfare.forEach((item) => {
      setTimeout(() => {
        this.playTone(item.f, 'triangle', item.d / 1000, 0.25);
      }, delay);
      delay += item.d + 50;
    });
  }
}

export const soundManager = new SoundManager();
