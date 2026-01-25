
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

const WEIGHTS = {
    LOW: 1,
    MEDIUM: 5,
    HIGH: 10,
    CRITICAL: 20
};

const POLICIES: Record<string, SupervisionPolicy> = {
    'GEOMETRY_SEGMENTS': { 
        logLevel: 'WARN', 
        capQuality: 'HIGH', 
        // Condition: severity in {MEDIUM, HIGH, CRITICAL}
        condition: (s) => s === 'MEDIUM' || s === 'HIGH' || s === 'CRITICAL'
    },
    'SPATIAL_TOPOLOGY': { 
        logLevel: 'ERROR', 
        action: 'SPATIAL', 
        capQuality: 'MEDIUM', 
        // Condition: severity in {MEDIUM, CRITICAL}
        // Action logic: trigger SPATIAL; only apply MEDIUM cap if systemStatus is CRITICAL (handled in handleViolation)
        condition: (s) => s === 'MEDIUM' || s === 'CRITICAL' 
    },
    'RENDER_DEPTH': { 
        logLevel: 'WARN', 
        action: 'RENDER',
        // Condition: any severity
        condition: () => true
    },
    'PATH_CONTINUITY': { 
        logLevel: 'WARN'
        // Condition: any severity, log-only
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
  
  // Recovery rate r (per second)
  private readonly RECOVERY_RATE = 1;

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
      // 1. Penalize Stability using explicit weights
      // S(t+1) = max(0, S(t) - w(severity))
      const weight = WEIGHTS[payload.severity as keyof typeof WEIGHTS] || 1;
      this.stabilityScore.update(s => Math.max(0, s - weight));

      // 2. Extract Domain (Format: "KERNEL:{DOMAIN}" or just "{DOMAIN}")
      const rawSource = payload.source;
      const domainKey = Object.keys(POLICIES).find(k => rawSource.includes(k));
      
      const policy = domainKey ? POLICIES[domainKey] : null;

      // 3. Log
      const msg = `[Supervisor] ${payload.source}: ${payload.message} (Sev: ${payload.severity}, Pen: -${weight})`;
      if (policy?.logLevel === 'ERROR' || payload.severity === 'CRITICAL') {
          console.error(msg);
      } else {
          console.warn(msg);
      }

      // 4. Execute Policy
      if (policy) {
          // Check condition predicate
          if (policy.condition && !policy.condition(payload.severity)) {
              return;
          }

          // Trigger Corrector Action if defined
          if (policy.action && payload.message) {
              this.corrector.triggerCorrection(policy.action);
          }
          
          // Apply Quality Cap logic
          if (policy.capQuality) {
              const status = this.systemStatus();

              // Emergency MEDIUM cap: Only applied if system is globally CRITICAL
              if (policy.capQuality === 'MEDIUM') {
                  if (status === 'CRITICAL' && !this.emergencyCapApplied) {
                      console.warn('[Supervisor] Stability Critical. Engaging Emergency Caps.');
                      this.adaptiveQuality.setSafetyCap('MEDIUM');
                      this.emergencyCapApplied = true;
                  }
                  return;
              }

              // One-shot HIGH cap: Applied immediately on violation (e.g. Geometry overlap)
              if (policy.capQuality === 'HIGH') {
                  this.adaptiveQuality.setSafetyCap('HIGH');
              }
          }
      }
  }

  private startRecoveryLoop() {
      // S(t+1) = min(100, S(t) + r)
      setInterval(() => {
          this.stabilityScore.update(s => Math.min(100, s + this.RECOVERY_RATE));
          
          // Reset emergency latch if stability recovers significantly
          // Hysteresis: Wait until > 80 (STABLE) to ensure we don't oscillate
          if (this.stabilityScore() > 80 && this.emergencyCapApplied) {
              console.log('[Supervisor] Stability recovered. Disengaging Emergency Locks.');
              this.emergencyCapApplied = false;
          }
      }, 1000);
  }
}
