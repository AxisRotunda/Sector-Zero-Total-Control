
import { Injectable, signal, computed } from '@angular/core';
import { QUALITY_TIERS } from '../systems/rendering/render.config';

@Injectable({
  providedIn: 'root'
})
export class PerformanceManagerService {
  // Default to Medium (Index 1) for balanced start
  private currentTierIndex = signal(1);

  // Reactive settings exposed to the app
  readonly currentTier = computed(() => QUALITY_TIERS[this.currentTierIndex()]);
  readonly shadowsEnabled = computed(() => this.currentTier().shadow);
  readonly lightingScale = computed(() => this.currentTier().lightScale);
  readonly particleLimit = computed(() => this.currentTier().particleCap);

  private fpsAccumulator = 0;
  private frameCount = 0;
  private qualityStableFrames = 0;

  monitorFrame(delta: number) {
    // Safety: Prevent division by zero or negative deltas
    if (delta <= 0) return;

    const fps = 1000 / delta;
    this.fpsAccumulator += fps;
    this.frameCount++;

    // Analyze every 30 frames
    if (this.frameCount >= 30) {
      const avgFps = this.fpsAccumulator / 30;
      this.frameCount = 0;
      this.fpsAccumulator = 0;
      this.adjustQuality(avgFps);
    }
  }

  private adjustQuality(avgFps: number) {
    const currentIndex = this.currentTierIndex();

    if (avgFps < 45) {
      // Downgrade Logic
      this.qualityStableFrames--;
      // Require 2 consecutive checks (60 frames) of low FPS to downgrade
      if (this.qualityStableFrames < -2) {
        if (currentIndex > 0) {
          console.log(`[Perf] Low FPS (${avgFps.toFixed(1)}). Downgrading to ${QUALITY_TIERS[currentIndex - 1].name}`);
          this.currentTierIndex.set(currentIndex - 1);
          this.qualityStableFrames = 0;
        }
      }
    } else if (avgFps > 58) {
      // Upgrade Logic
      this.qualityStableFrames++;
      // Require 5 consecutive checks (150 frames) of high FPS to upgrade
      if (this.qualityStableFrames > 5) {
        if (currentIndex < QUALITY_TIERS.length - 1) {
          console.log(`[Perf] High FPS (${avgFps.toFixed(1)}). Upgrading to ${QUALITY_TIERS[currentIndex + 1].name}`);
          this.currentTierIndex.set(currentIndex + 1);
          this.qualityStableFrames = 0;
        }
      }
    } else {
      // Stability decay towards zero
      if (this.qualityStableFrames > 0) this.qualityStableFrames--;
      if (this.qualityStableFrames < 0) this.qualityStableFrames++;
    }
  }
}
