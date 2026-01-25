
import { Injectable, inject, signal } from '@angular/core';
import { PerformanceTelemetryService } from './performance-telemetry.service';
import { EventBusService } from '../core/events/event-bus.service';
import { GameEvents, RealityBleedPayload } from '../core/events/game-events';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export interface QualityPreset {
  name: string;
  renderDistance: number; // Max px from camera
  maxVisibleEntities: number;
  lightingQuality: 'high' | 'medium' | 'low';
  particleMultiplier: number; // 0.0 - 1.0
  shadowsEnabled: boolean;
}

const QUALITY_PRESETS: Record<string, QualityPreset> = {
  ULTRA: {
    name: 'Ultra',
    renderDistance: 1500,
    maxVisibleEntities: 300,
    lightingQuality: 'high',
    particleMultiplier: 1.0,
    shadowsEnabled: true
  },
  HIGH: {
    name: 'High',
    renderDistance: 1200,
    maxVisibleEntities: 200,
    lightingQuality: 'medium',
    particleMultiplier: 0.8,
    shadowsEnabled: true
  },
  MEDIUM: {
    name: 'Medium',
    renderDistance: 1000,
    maxVisibleEntities: 150,
    lightingQuality: 'medium',
    particleMultiplier: 0.6,
    shadowsEnabled: false
  },
  LOW: {
    name: 'Low',
    renderDistance: 800,
    maxVisibleEntities: 100,
    lightingQuality: 'low',
    particleMultiplier: 0.4,
    shadowsEnabled: false
  },
  EMERGENCY: {
    name: 'Emergency',
    renderDistance: 600,
    maxVisibleEntities: 50,
    lightingQuality: 'low',
    particleMultiplier: 0.1,
    shadowsEnabled: false
  }
};

@Injectable({ providedIn: 'root' })
export class AdaptiveQualityService {
  private telemetry = inject(PerformanceTelemetryService);
  private eventBus = inject(EventBusService);

  currentPreset = signal<QualityPreset>(QUALITY_PRESETS['HIGH']);
  private lastAdjustment = 0;
  private adjustmentCooldown = 3000; // Min 3s between changes
  
  // Safety Lock
  private maxAllowedTier = signal<string>('ULTRA'); 

  constructor() {
      this.eventBus.on(GameEvents.REALITY_BLEED)
        .pipe(takeUntilDestroyed())
        .subscribe((payload: RealityBleedPayload) => {
            // Check for kernel/geometry issues
            if (payload.message.includes('Axiom') || payload.source.includes('KERNEL') || payload.source.includes('GEOMETRY') || payload.source.includes('SECTOR_LOAD')) {
                this.handleStabilityIssue();
            }
        });
  }

  /**
   * Check every frame and auto-adjust quality
   */
  evaluateAndAdjust(): void {
    const now = performance.now();
    if (now - this.lastAdjustment < this.adjustmentCooldown) return;

    const trend = this.telemetry.getTrend();
    const fps = this.telemetry.currentFps();
    const current = this.currentPreset();

    // Emergency degradation
    if (fps < 25 && current.name !== 'Emergency') {
      this.setQuality('EMERGENCY');
      this.lastAdjustment = now;
      this.eventBus.dispatch({
        type: GameEvents.REALITY_BLEED,
        payload: {
          severity: 'CRITICAL',
          source: 'ADAPTIVE_QUALITY',
          message: 'Entropy Critical. Emergency degradation engaged.'
        }
      });
      return;
    }

    // Predictive degradation (before FPS drops critically)
    if ((trend === 'DEGRADING' && fps < 45) || fps < 35) {
      this.downgrade(current.name);
    }

    // Upgrade quality when stable, but respect the safety cap
    if (trend === 'STABLE' && fps > 58) {
      this.upgrade(current.name);
    }
  }

  public setSafetyCap(tier: 'HIGH' | 'MEDIUM') {
      console.warn(`[AdaptiveQuality] Manual Safety Cap Engaged: ${tier}`);
      this.maxAllowedTier.set(tier);
      
      const order = ['ULTRA', 'HIGH', 'MEDIUM', 'LOW', 'EMERGENCY'];
      const currentIdx = order.indexOf(this.currentPreset().name.toUpperCase());
      const capIdx = order.indexOf(tier);
      
      // If current is higher quality (lower index) than cap, force downgrade
      if (currentIdx < capIdx) {
          this.setQuality(tier);
      }
  }

  private handleStabilityIssue() {
      if (this.maxAllowedTier() === 'ULTRA') {
          console.warn('[AdaptiveQuality] Reality Instability Detected. Capping Quality to HIGH.');
          this.maxAllowedTier.set('HIGH');
          if (this.currentPreset().name === 'Ultra') {
              this.setQuality('HIGH');
          }
      } else if (this.maxAllowedTier() === 'HIGH') {
          console.warn('[AdaptiveQuality] Persistent Instability. Capping Quality to MEDIUM.');
          this.maxAllowedTier.set('MEDIUM');
          if (this.currentPreset().name === 'High') {
              this.setQuality('MEDIUM');
          }
      }
  }

  private downgrade(currentName: string) {
      const order = ['ULTRA', 'HIGH', 'MEDIUM', 'LOW', 'EMERGENCY'];
      const idx = order.findIndex(k => QUALITY_PRESETS[k].name === currentName);
      
      if (idx !== -1 && idx < order.length - 1) {
          const nextKey = order[idx + 1];
          this.setQuality(nextKey);
          console.log(`[ADAPTIVE] Reducing quality: ${currentName} -> ${QUALITY_PRESETS[nextKey].name}`);
          this.lastAdjustment = performance.now();
      }
  }

  private upgrade(currentName: string) {
      const order = ['ULTRA', 'HIGH', 'MEDIUM', 'LOW', 'EMERGENCY'];
      const idx = order.findIndex(k => QUALITY_PRESETS[k].name === currentName);
      
      if (idx > 0) {
          const prevKey = order[idx - 1];
          
          // Safety Check: Do not exceed max allowed tier
          const tierIndex = order.indexOf(prevKey);
          const maxIndex = order.indexOf(this.maxAllowedTier());
          
          // Note: Lower index = Higher Quality in this array order
          if (tierIndex < maxIndex) return;

          this.setQuality(prevKey);
          console.log(`[ADAPTIVE] Increasing quality: ${currentName} -> ${QUALITY_PRESETS[prevKey].name}`);
          this.lastAdjustment = performance.now();
      }
  }

  private setQuality(presetKey: string): void {
    const preset = QUALITY_PRESETS[presetKey];
    if (!preset) return;

    this.currentPreset.set(preset);
    
    // Dispatch event for other systems to react (Narrative flavor)
    if (presetKey !== 'ULTRA' && presetKey !== 'HIGH') {
        this.eventBus.dispatch({
            type: GameEvents.REALITY_BLEED,
            payload: {
                severity: 'LOW',
                source: 'QUALITY_REGULATOR',
                message: `Reality complexity adjusting to ${preset.name}`
            }
        });
    }
  }

  getPreset() {
    return this.currentPreset();
  }
}
