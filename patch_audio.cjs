const fs = require('fs');
let code = fs.readFileSync('src/utils/audio.ts', 'utf8');

const bgmCode = `
  private bgmOscillators: OscillatorNode[] = [];
  private bgmGain: GainNode | null = null;
  private bgmInterval: ReturnType<typeof setInterval> | null = null;

  public startBGM() {
    const ctx = this.getContext();
    if (!ctx) return;
    if (this.bgmGain) return; // already playing

    this.bgmGain = ctx.createGain();
    this.bgmGain.gain.value = 0.04; // Very quiet volume
    
    // Add a gentle lowpass filter for lofi vibe
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    this.bgmGain.connect(filter);
    filter.connect(ctx.destination);

    // Warm, chill chord progression (Cmaj7 -> Amin7 -> Fmaj7 -> G7)
    const chords = [
      [261.63, 329.63, 392.00, 493.88], // Cmaj7
      [220.00, 261.63, 329.63, 392.00], // Amin7
      [174.61, 220.00, 261.63, 329.63], // Fmaj7
      [196.00, 246.94, 293.66, 349.23]  // G7
    ];
    let chordIdx = 0;

    const playChord = () => {
      if (!this.bgmGain || !ctx) return;
      const chord = chords[chordIdx];
      
      chord.forEach(freq => {
        const osc = ctx.createOscillator();
        osc.type = 'sine'; // Sine wave for very chill pad
        osc.frequency.value = freq;
        
        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0, ctx.currentTime);
        // Slow attack
        oscGain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 2.5);
        // Slow release
        oscGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 5.5);
        
        osc.connect(oscGain);
        oscGain.connect(this.bgmGain!);
        osc.start();
        osc.stop(ctx.currentTime + 6);
      });
      
      chordIdx = (chordIdx + 1) % chords.length;
    };

    playChord();
    this.bgmInterval = setInterval(playChord, 5000);
  }

  public stopBGM() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
    if (this.bgmGain) {
      this.bgmGain.disconnect();
      this.bgmGain = null;
    }
  }
`;

code = code.replace('  constructor() {', bgmCode + '\n  constructor() {');
fs.writeFileSync('src/utils/audio.ts', code);
console.log('Audio patched');
