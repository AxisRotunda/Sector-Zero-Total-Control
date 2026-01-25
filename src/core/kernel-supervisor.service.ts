
import { Injectable, inject, signal, computed } from '@angular/core';
import { EventBusService } from './events/event-bus.service';
import { GameEvents, RealityBleedPayload } from './events/game-events';
import { RealityCorrectorService } from './reality-corrector.service';
import { AdaptiveQualityService } from '../systems/adaptive-quality.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export type SystemStatus = 'STABLE' | 'UNSTABLE' | 'CRITICAL';

interface SupervisionPolicy {
    logLevel: 'WARN' | 'ERROR';
    action?: string; 
    capQuality?: 'MEDIUM' | 'HIGH';
    condition?: (severity: string) => boolean;
}

const POLICIES: Record<string, SupervisionPolicy> = {
    'GEOMETRY_SEGMENTS': { 
        logLevel: 'WARN', 
        capQuality: 'HIGH', 
        // Cap to HIGH if we see significant overlap (MEDIUM) or worse
        condition: (s) => s === 'MEDIUM' || s === 'HIGH' || s === 'CRITICAL'
    },
    'SPATIAL_TOPOLOGY': { 
        logLevel: 'ERROR', 
        action: 'SPATIAL', 
        capQuality: 'MEDIUM', 
        // Only consider capping if the violation itself is critical
        condition: (s) => s === 'CRITICAL' 
    },
    'RENDER_DEPTH': { 
        logLevel: 'WARN', 
        action: 'RENDER' 
        // No quality cap for render depth issues, just correction
    },
    'PATH_CONTINUITY': { 
        logLevel: 'WARN' 
        // Log only
    },
    'INVENTORY': { 
        logLevel: 'ERROR', 
        action: 'INVENTORY' 
    },
    'WORLD_GEN': { 
        logLevel: 'ERROR', 
        action: 'WORLD_GEN' 
    }
};

@Injectable({
  providedIn: 'root'
})
export class KernelSupervisorService {
  private eventBus = inject(EventBusService);
  private corrector = inject(RealityCorrectorService);
  private adaptiveQuality = inject(AdaptiveQualityService);

  stabilityScore = signal(100);
  private emergencyCapApplied = false;
  
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

      // 2. Extract Domain (Format: "KERNEL:{DOMAIN}" or just "{DOMAIN}")
      const rawSource = payload.source;
      const domainKey = Object.keys(POLICIES).find(k => rawSource.includes(k));
      
      const policy = domainKey ? POLICIES[domainKey] : null;

      // 3. Log
      const msg = `[Supervisor] ${payload.source}: ${payload.message}`;
      if (policy?.logLevel === 'ERROR' || payload.severity === 'CRITICAL') {
          console.error(msg);
      } else {
          console.warn(msg);
      }

      // 4. Execute Policy
      if (policy) {
          // Trigger Corrector Action if defined
          if (policy.action && payload.message) {
              this.corrector.triggerCorrection(policy.action);
          }
          
          // Apply Quality Cap if conditions met
          if (policy.capQuality && policy.condition && policy.condition(payload.severity)) {
              const status = this.systemStatus();

              // Emergency MEDIUM cap only if system is globally critical and not already capped
              if (policy.capQuality === 'MEDIUM') {
                  if (status === 'CRITICAL' && !this.emergencyCapApplied) {
                      this.adaptiveQuality.setSafetyCap('MEDIUM');
                      this.emergencyCapApplied = true;
                  }
                  return;
              }

              // High cap for geometry/visuals, one-shot
              if (policy.capQuality === 'HIGH') {
                  this.adaptiveQuality.setSafetyCap('HIGH');
              }
          }
      }
  }

  private startRecoveryLoop() {
      setInterval(() => {
          this.stabilityScore.update(s => Math.min(100, s + 1));
          
          // Reset emergency latch if stability recovers
          if (this.stabilityScore() > 80 && this.emergencyCapApplied) {
              this.emergencyCapApplied = false;
          }
      }, 1000);
  }
}
