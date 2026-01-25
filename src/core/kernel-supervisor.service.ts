
import { Injectable, inject, signal, computed } from '@angular/core';
import { EventBusService } from './events/event-bus.service';
import { GameEvents, RealityBleedPayload } from './events/game-events';
import { RealityCorrectorService } from './reality-corrector.service';
import { AdaptiveQualityService } from '../systems/adaptive-quality.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export type SystemStatus = 'STABLE' | 'UNSTABLE' | 'CRITICAL';

@Injectable({
  providedIn: 'root'
})
export class KernelSupervisorService {
  private eventBus = inject(EventBusService);
  private corrector = inject(RealityCorrectorService);
  private adaptiveQuality = inject(AdaptiveQualityService);

  // System Health State
  stabilityScore = signal(100);
  
  systemStatus = computed<SystemStatus>(() => {
      const score = this.stabilityScore();
      if (score < 40) return 'CRITICAL';
      if (score < 80) return 'UNSTABLE';
      return 'STABLE';
  });

  constructor() {
      this.subscribeToBleeds();
      this.startRecoveryLoop();
  }

  private subscribeToBleeds() {
      this.eventBus.on(GameEvents.REALITY_BLEED)
        .pipe(takeUntilDestroyed())
        .subscribe((payload: RealityBleedPayload) => {
            this.handleViolation(payload);
        });
  }

  private handleViolation(payload: RealityBleedPayload) {
      // 1. Penalize Stability
      const penalty = payload.severity === 'CRITICAL' ? 20 : (payload.severity === 'MEDIUM' ? 5 : 1);
      this.stabilityScore.update(s => Math.max(0, s - penalty));

      // 2. Policy Matrix: Map Domain -> Action
      const source = payload.source;
      
      if (source.includes('GEOMETRY_SEGMENTS')) {
          // Geometry overlap is visual/physics annoyance, not fatal.
          // Action: Log and maybe cap render quality if frequent.
          if (this.systemStatus() !== 'STABLE') {
              this.adaptiveQuality.setSafetyCap('HIGH');
          }
      } 
      else if (source.includes('SPATIAL_TOPOLOGY')) {
          // Grid density is dangerous (perf cliff).
          // Action: Immediate Correction.
          this.corrector.triggerCorrection('SPATIAL');
          
          if (payload.severity === 'CRITICAL') {
              this.adaptiveQuality.setSafetyCap('MEDIUM');
          }
      }
      else if (source.includes('RENDER_DEPTH')) {
          // Visual glitch.
          this.corrector.triggerCorrection('RENDER');
      }
      else if (source.includes('INVENTORY')) {
          // State corruption risk.
          this.corrector.triggerCorrection('INVENTORY');
      }
      else if (source.includes('WorldGen')) {
          this.corrector.triggerCorrection('WORLD_GEN');
      }
  }

  private startRecoveryLoop() {
      // Slowly recover stability over time if no errors occur
      setInterval(() => {
          this.stabilityScore.update(s => Math.min(100, s + 1));
      }, 1000);
  }
}
