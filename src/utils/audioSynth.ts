// Web Audio API Focus Sound Synthesizer (Binaural Alpha Tones & Pink Noise)

type WebkitAudioWindow = typeof window & { webkitAudioContext?: typeof AudioContext };

function getAudioContextClass(): typeof AudioContext | undefined {
  return window.AudioContext || (window as WebkitAudioWindow).webkitAudioContext;
}

class AmbientAudioSynth {
  private audioCtx: AudioContext | null = null;
  private isPlaying = false;
  private leftOsc: OscillatorNode | null = null;
  private rightOsc: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;

  public startAlphaWaves(volume = 0.25) {
    this.stop();

    try {
      const AudioContextClass = getAudioContextClass();
      if (!AudioContextClass) return;
      this.audioCtx = new AudioContextClass();

      // Master Gain
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.setValueAtTime(volume, this.audioCtx.currentTime);

      // Stereo Panner / Binaural Splitter
      const merger = this.audioCtx.createChannelMerger(2);

      // Left Channel: 432 Hz Base Frequency
      this.leftOsc = this.audioCtx.createOscillator();
      this.leftOsc.type = 'sine';
      this.leftOsc.frequency.setValueAtTime(432, this.audioCtx.currentTime);

      // Right Channel: 442 Hz Frequency (Difference = 10 Hz Alpha Wave Flow State)
      this.rightOsc = this.audioCtx.createOscillator();
      this.rightOsc.type = 'sine';
      this.rightOsc.frequency.setValueAtTime(442, this.audioCtx.currentTime);

      // Connect channels
      this.leftOsc.connect(merger, 0, 0); // Left channel
      this.rightOsc.connect(merger, 0, 1); // Right channel

      merger.connect(this.gainNode);
      this.gainNode.connect(this.audioCtx.destination);

      this.leftOsc.start();
      this.rightOsc.start();
      this.isPlaying = true;
    } catch (e) {
      console.warn('AudioContext not supported or blocked by browser policy:', e);
    }
  }

  public startPinkNoise(volume = 0.15) {
    this.stop();

    try {
      const AudioContextClass = getAudioContextClass();
      if (!AudioContextClass) return;
      this.audioCtx = new AudioContextClass();

      const bufferSize = this.audioCtx.sampleRate * 2;
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const output = buffer.getChannelData(0);

      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11;
        b6 = white * 0.115926;
      }

      this.noiseNode = this.audioCtx.createBufferSource();
      this.noiseNode.buffer = buffer;
      this.noiseNode.loop = true;

      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.setValueAtTime(volume, this.audioCtx.currentTime);

      this.noiseNode.connect(this.gainNode);
      this.gainNode.connect(this.audioCtx.destination);

      this.noiseNode.start();
      this.isPlaying = true;
    } catch (e) {
      console.warn('Pink noise synth error:', e);
    }
  }

  public stop() {
    if (this.leftOsc) {
      try {
        this.leftOsc.stop();
      } catch {
        /* ignore */
      }
      this.leftOsc = null;
    }
    if (this.rightOsc) {
      try {
        this.rightOsc.stop();
      } catch {
        /* ignore */
      }
      this.rightOsc = null;
    }
    if (this.noiseNode) {
      try {
        this.noiseNode.stop();
      } catch {
        /* ignore */
      }
      this.noiseNode = null;
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {
        /* ignore */
      }
      this.audioCtx = null;
    }
    this.isPlaying = false;
  }

  public getIsPlaying() {
    return this.isPlaying;
  }

  public playChime(kind: 'match' | 'miss' | 'victory') {
    try {
      const AudioContextClass = getAudioContextClass();
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;

      const playTone = (
        freq: number,
        startOffset: number,
        duration: number,
        type: OscillatorType = 'sine'
      ) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now + startOffset);
        gain.gain.setValueAtTime(0.08, now + startOffset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + startOffset);
        osc.stop(now + startOffset + duration + 0.02);
      };

      if (kind === 'match') {
        playTone(587.33, 0, 0.12);
        playTone(880, 0.07, 0.18);
      } else if (kind === 'miss') {
        playTone(240, 0, 0.12, 'triangle');
        playTone(190, 0.08, 0.16, 'triangle');
      } else {
        playTone(523.25, 0, 0.14);
        playTone(659.25, 0.1, 0.14);
        playTone(783.99, 0.2, 0.22);
        playTone(1046.5, 0.32, 0.35);
      }

      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 900);
    } catch {
      // Ignore blocked audio context
    }
  }
}

export const ambientSynth = new AmbientAudioSynth();
