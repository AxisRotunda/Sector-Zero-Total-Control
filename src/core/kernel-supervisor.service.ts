
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
        condition: (s) => s === 'MEDIUM' || s === 'CRITICAL' 
    },
    'RENDER_DEPTH': { 
        logLevel: 'WARN', 
        action: 'RENDER',
        condition: () => true
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

export interface ViolationRecord {
    source: string;
    severity: string;
    weight: number;
    time: number;
}

@Injectable({
  providedIn: 'root'
})
export class KernelSupervisorService {
  private eventBus = inject(EventBusService);
  private corrector = inject(RealityCorrectorService);
  private adaptiveQuality = inject(AdaptiveQualityService);

  stabilityScore = signal(100);
  emergencyCapActive = signal(false); // Exposed as signal for HUD
  recentViolations = signal<ViolationRecord[]>([]); // Debug history
  
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
      // Expose for console debugging
      (window as any).kernelSim = this.simulateStability.bind(this);
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

      // 2. Track Violation for Debug HUD
      this.recentViolations.update(v => [
          { source: payload.source, severity: payload.severity, weight, time: Date.now() },
          ...v
      ].slice(0, 8)); // Keep last 8

      // 3. Extract Domain (Format: "KERNEL:{DOMAIN}" or just "{DOMAIN}")
      const rawSource = payload.source;
      const domainKey = Object.keys(POLICIES).find(k => rawSource.includes(k));
      
      const policy = domainKey ? POLICIES[domainKey] : null;

      // 4. Log
      const msg = `[Supervisor] ${payload.source}: ${payload.message} (Sev: ${payload.severity}, Pen: -${weight})`;
      if (policy?.logLevel === 'ERROR' || payload.severity === 'CRITICAL') {
          console.error(msg);
      } else {
          console.warn(msg);
      }

      // 5. Execute Policy
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
                  if (status === 'CRITICAL' && !this.emergencyCapActive()) {
                      console.warn('[Supervisor] Stability Critical. Engaging Emergency Caps.');
                      this.adaptiveQuality.setSafetyCap('MEDIUM');
                      this.emergencyCapActive.set(true);
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
          if (this.stabilityScore() > 80 && this.emergencyCapActive()) {
              console.log('[Supervisor] Stability recovered. Disengaging Emergency Locks.');
              this.emergencyCapActive.set(false);
          }
      }, 1000);
  }

  /**
   * Debug Helper: Simulates stability impact of hypothetical violations.
   * Usage: kernelSim(5, 'MEDIUM', 3) -> 5 Medium errors over 3 seconds
   */
  simulateStability(count: number, severity: 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL', durationSec: number = 1) {
      console.log(`%c[KERNEL SIMULATION] ${count}x ${severity} over ${durationSec}s`, 'color: #06b6d4; font-weight: bold');
      
      const weight = WEIGHTS[severity];
      const totalPenalty = count * weight;
      const ratePerSec = totalPenalty / durationSec;
      
      let s = this.stabilityScore();
      console.log(`T=0s | Stability: ${s.toFixed(1)}%`);

      for (let t = 1; t <= durationSec; t++) {
          s = Math.max(0, s - ratePerSec); // Apply damage
          s = Math.min(100, s + this.RECOVERY_RATE); // Apply recovery
          
          let status = 'STABLE';
          if (s < 40) status = 'CRITICAL';
          else if (s < 80) status = 'UNSTABLE';
          
          const color = s < 40 ? 'color:red' : (s < 80 ? 'color:orange' : 'color:green');
          console.log(`%cT=${t}s | Stability: ${s.toFixed(1)}% [${status}]`, color);
      }
      
      console.log(`Net Impact: ${(this.stabilityScore() - s).toFixed(1)} stability lost.`);
  }
}
