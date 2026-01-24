
import { Injectable } from '@angular/core';

export type SoundType = 'HIT' | 'CRIT' | 'SHOOT' | 'EXPLOSION' | 'DASH' | 'UI' | 'CHARGE' | 'POWERUP' | 
  'DEATH' | 'PICKUP' | 'LEVELUP' | 'FOOTSTEP' | 'RELOAD' | 'SWOOSH' | 'IMPACT' | 'WHOOSH' | 
  'BONUS' | 'ZONE_CHANGE' | 'BOSS_SPAWN' | 'ABILITY_READY' | 'DEFLECT' | 'PARRY' | 'CRAFT' | 'GATE_OPEN' | 'HEAVY_SWING';

@Injectable({
  providedIn: 'root'
})
export class SoundService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private soundBuffers: Map<SoundType, AudioBuffer> = new Map();
  private lastSoundTimes: Map<SoundType, number> = new Map();
  private minSoundInterval = 50;

  init() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass && !this.ctx) {
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.connect(this.masterGain);
        
        // Pre-generate buffers
        this.generateBuffers();
      }
    } catch (e) { console.error('Audio init failed', e); }
  }

  private generateBuffers() {
      if (!this.ctx) return;
      // Pre-synthesize common sounds to avoid realtime OSC creation overhead
      this.soundBuffers.set('HIT', this.createToneBuffer(400, 'triangle', 0.1));
      this.soundBuffers.set('CRIT', this.createToneBuffer(1200, 'square', 0.15));
      this.soundBuffers.set('SHOOT', this.createNoiseBuffer(0.08));
      this.soundBuffers.set('EXPLOSION', this.createNoiseBuffer(0.5));
      this.soundBuffers.set('DASH', this.createNoiseBuffer(0.2, 'highpass'));
      this.soundBuffers.set('UI', this.createToneBuffer(800, 'sine', 0.05));
      this.soundBuffers.set('POWERUP', this.createToneBuffer(600, 'sine', 0.3, true));
      this.soundBuffers.set('CHARGE', this.createToneBuffer(200, 'sawtooth', 0.5, true));
      this.soundBuffers.set('ZONE_CHANGE', this.createToneBuffer(100, 'sine', 1.5, true));
      this.soundBuffers.set('CRAFT', this.createToneBuffer(150, 'square', 0.2));
      this.soundBuffers.set('IMPACT', this.createToneBuffer(100, 'square', 0.1));
      this.soundBuffers.set('GATE_OPEN', this.createToneBuffer(60, 'sawtooth', 2.0, true)); // Long low rumble
      
      // New Combat Sounds
      this.soundBuffers.set('SWOOSH', this.createNoiseBuffer(0.15, 'highpass')); // Sharper
      this.soundBuffers.set('WHOOSH', this.createNoiseBuffer(0.25, 'lowpass')); // Deeper
      this.soundBuffers.set('HEAVY_SWING', this.createToneBuffer(80, 'sawtooth', 0.4, true)); // Heavy mechanical swing
  }

  public play(type: SoundType, x?: number, y?: number): void {
    if (!this.ctx || !this.sfxGain) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    if (this.lastSoundTimes.has(type) && (now - (this.lastSoundTimes.get(type) ?? 0)) < this.minSoundInterval / 1000) {
        return;
    }
    this.lastSoundTimes.set(type, now);

    const buffer = this.soundBuffers.get(type);
    if (buffer) {
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.sfxGain);
        source.start();
    }
  }

  private createToneBuffer(freq: number, type: OscillatorType, dur: number, slide = false): AudioBuffer {
      const sampleRate = this.ctx!.sampleRate;
      const buffer = this.ctx!.createBuffer(1, sampleRate * dur, sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < data.length; i++) {
          const t = i / sampleRate;
          const currentFreq = slide ? freq * (1 + t * 4) : freq; // Simple linear slide simulation
          const wave = this.getWaveValue(type, currentFreq, t);
          // Envelope
          const envelope = 1 - (t / dur);
          data[i] = wave * envelope * 0.3; // Volume scaling
      }
      return buffer;
  }

  private createNoiseBuffer(dur: number, filterType?: BiquadFilterType): AudioBuffer {
      const sampleRate = this.ctx!.sampleRate;
      const buffer = this.ctx!.createBuffer(1, sampleRate * dur, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
          const t = i / sampleRate;
          let noise = Math.random() * 2 - 1;
          if (filterType === 'highpass') {
              noise = (noise + (i > 0 ? -data[i-1] : 0)) * 0.5; // Very cheap highpass simulation
          } else if (filterType === 'lowpass') {
              noise = (noise + (i > 0 ? data[i-1] : 0)) * 0.5; // Very cheap lowpass simulation
          }
          const envelope = 1 - (t / dur);
          data[i] = noise * envelope * 0.3;
      }
      return buffer;
  }

  private getWaveValue(type: OscillatorType, freq: number, t: number): number {
      const v = t * freq * Math.PI * 2;
      switch (type) {
          case 'sine': return Math.sin(v);
          case 'square': return Math.sin(v) > 0 ? 1 : -1;
          case 'sawtooth': return (t * freq) % 1 * 2 - 1;
          case 'triangle': return Math.abs((t * freq) % 1 * 2 - 1) * 2 - 1;
          default: return Math.sin(v);
      }
  }
}
