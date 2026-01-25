
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
      const msg = payload.message;
      
      // DOMAIN: Geometry & Structural Integrity
      if (source.includes('GEOMETRY_SEGMENTS')) {
          // Action: Log warning, cap quality if persistent
          console.warn(`[Supervisor] Structural Flaw: ${msg}`);
          if (this.systemStatus() !== 'STABLE') {
              this.adaptiveQuality.setSafetyCap('HIGH');
          }
      } 
      // DOMAIN: Spatial Topology (Grid Density)
      else if (source.includes('SPATIAL_TOPOLOGY')) {
          // Action: Immediate Correction (Cull entities or rebuild grid)
          console.error(`[Supervisor] Topology Breach: ${msg}`);
          this.corrector.triggerCorrection('SPATIAL');
          
          if (payload.severity === 'CRITICAL') {
              this.adaptiveQuality.setSafetyCap('MEDIUM');
          }
      }
      // DOMAIN: Render Depth (Z-Sorting)
      else if (source.includes('RENDER_DEPTH')) {
          // Action: Soft correction (Re-cull next frame)
          this.corrector.triggerCorrection('RENDER');
      }
      // DOMAIN: Path Continuity
      else if (source.includes('PATH_CONTINUITY')) {
          // Action: Log, implies navmesh desync
          console.warn(`[Supervisor] Nav Discontinuity: ${msg}`);
      }
      // DOMAIN: Inventory State
      else if (source.includes('INVENTORY')) {
          // Action: State Rollback / Lock
          this.corrector.triggerCorrection('INVENTORY');
      }
      // DOMAIN: World Generation
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
