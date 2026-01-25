
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
        condition: (s) => s === 'CRITICAL' 
    },
    'SPATIAL_TOPOLOGY': { 
        logLevel: 'ERROR', 
        action: 'SPATIAL', 
        capQuality: 'MEDIUM', 
        condition: (s) => s === 'CRITICAL' 
    },
    'RENDER_DEPTH': { 
        logLevel: 'WARN', 
        action: 'RENDER' 
    },
    'PATH_CONTINUITY': { 
        logLevel: 'WARN' 
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
          if (policy.action) {
              // Ensure we check message existence safely
              if (payload.message) {
                  this.corrector.triggerCorrection(policy.action);
              }
          }
          
          // Apply Quality Cap if conditions met
          if (policy.capQuality) {
              const shouldCap = policy.condition ? policy.condition(payload.severity) : true;
              if (shouldCap) {
                  this.adaptiveQuality.setSafetyCap(policy.capQuality);
              }
          }
      }
  }

  private startRecoveryLoop() {
      setInterval(() => {
          this.stabilityScore.update(s => Math.min(100, s + 1));
      }, 1000);
  }
}
