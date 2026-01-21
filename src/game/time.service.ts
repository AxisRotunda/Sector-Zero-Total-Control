
import { Injectable, signal } from '@angular/core';
import * as BALANCE from '../config/balance.config';

@Injectable({
  providedIn: 'root'
})
export class TimeService {
  public globalTime = 0;
  private hitStopFrames = 0;
  
  // Time Dilation
  public timeScale = signal(1.0);
  private targetTimeScale = 1.0;
  private timeLerpSpeed = 0.1;

  private accumulator = 0;
  private lastTime = 0;
  
  public isPaused = signal(false);

  constructor() {
      this.lastTime = performance.now();
  }

  /**
   * Ticks the game clock. Returns true if a logic update should occur.
   */
  tick(): boolean {
    if (this.isPaused()) {
        this.lastTime = performance.now();
        return false;
    }

    // Hit Stop pauses everything explicitly
    if (this.hitStopFrames > 0) {
      this.hitStopFrames--;
      this.lastTime = performance.now();
      return false; 
    }

    const now = performance.now();
    const rawDelta = now - this.lastTime;
    this.lastTime = now;

    // Smooth Time Scale Transition
    if (Math.abs(this.timeScale() - this.targetTimeScale) > 0.01) {
        const newVal = this.timeScale() + (this.targetTimeScale - this.timeScale()) * this.timeLerpSpeed;
        this.timeScale.set(newVal);
    } else if (this.timeScale() !== this.targetTimeScale) {
        this.timeScale.set(this.targetTimeScale);
    }

    const safeDelta = Math.min(rawDelta, 100);
    this.accumulator += safeDelta * this.timeScale();

    const step = 1000 / 60;

    if (this.accumulator >= step) {
        this.accumulator -= step;
        this.globalTime++;
        return true;
    }

    return false; 
  }

  triggerHitStop(intensity: 'LIGHT' | 'HEAVY' | number) {
    let frames = 0;
    if (typeof intensity === 'number') {
        frames = intensity;
    } else {
        frames = intensity === 'HEAVY' 
          ? BALANCE.ENEMY_AI.HIT_STOP_FRAMES_HEAVY 
          : BALANCE.ENEMY_AI.HIT_STOP_FRAMES_LIGHT;
    }
    this.hitStopFrames = Math.max(this.hitStopFrames, frames);
  }

  triggerSlowMo(durationMs: number, scale: number = 0.2) {
      this.targetTimeScale = scale;
      this.timeLerpSpeed = 0.2; // Fast entry
      setTimeout(() => {
          this.targetTimeScale = 1.0;
          this.timeLerpSpeed = 0.05; // Slow exit
      }, durationMs);
  }

  getHitStop(): number {
      return this.hitStopFrames;
  }
}
