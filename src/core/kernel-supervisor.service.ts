
import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { EventBusService } from './events/event-bus.service';
import { GameEvents, RealityBleedPayload } from './events/game-events';
import { RealityCorrectorService } from './reality-corrector.service';
import { AdaptiveQualityService } from '../systems/adaptive-quality.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProofKernelService } from './proof/proof-kernel.service';

export type SystemStatus = 'STABLE' | 'UNSTABLE' | 'CRITICAL';

interface SupervisionPolicy {
    logLevel: 'WARN' | 'ERROR';
    action?: string; 
    capQuality?: 'MEDIUM' | 'HIGH';
    condition?: (severity: string) => boolean;
}

// 1. FREEZE THE CONTROL LAW: Expose knobs as constants
export const KERNEL_CONFIG = {
    WEIGHTS: {
        LOW: 1,
        MEDIUM: 5,
        HIGH: 10,
        CRITICAL: 15
    },
    RECOVERY_RATE: 1, // Points per second
    THRESHOLDS: {
        STABLE: 80,
        CRITICAL: 40
    },
    SAMPLING: {
        STABLE: 0.05,  // Tuned: 5% check rate for high-frequency ops when stable
        UNSTABLE: 0.25, // 25% check rate
        CRITICAL: 1.0  // 100% check rate
    }
};

const POLICIES: Record<string, SupervisionPolicy> = {
    'GEOMETRY_SEGMENTS': { 
        logLevel: 'WARN', 
        capQuality: 'HIGH', 
        condition: (s) => s === 'MEDIUM' || s === 'HIGH' || s === 'CRITICAL'
    },
    'SPATIAL_TOPOLOGY': { 
        logLevel: 'ERROR', 
        action: 'SPATIAL', 
        capQuality: 'MEDIUM', 
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
  private proofKernel = inject(ProofKernelService);

  stabilityScore = signal(100);
  emergencyCapActive = signal(false); 
  recentViolations = signal<ViolationRecord[]>([]); 

  systemStatus = computed<SystemStatus>(() => {
      const score = this.stabilityScore();
      if (score < KERNEL_CONFIG.THRESHOLDS.CRITICAL) return 'CRITICAL';
      if (score < KERNEL_CONFIG.THRESHOLDS.STABLE) return 'UNSTABLE';
      return 'STABLE';
  });

  // 2. ENCODE PROBABILITY: Derived entirely from status
  samplingMod = computed(() => {
      const status = this.systemStatus();
      switch (status) {
          case 'STABLE': return KERNEL_CONFIG.SAMPLING.STABLE;
          case 'UNSTABLE': return KERNEL_CONFIG.SAMPLING.UNSTABLE;
          case 'CRITICAL': return KERNEL_CONFIG.SAMPLING.CRITICAL;
      }
  });

  constructor() {
      this.subscribeToBleeds();
      this.startRecoveryLoop();
      
      // Expose harness globally for dev console usage
      (window as any).kernelHarness = this.runStabilityTest.bind(this);
      
      // Push calculated sampling rate to the Proof Kernel via effect
      effect(() => {
          this.proofKernel.samplingProbability.set(this.samplingMod());
      });
  }

  private subscribeToBleeds() {
      this.eventBus.on(GameEvents.REALITY_BLEED)
        .pipe(takeUntilDestroyed())
        .subscribe((payload: RealityBleedPayload) => {
            this.handleViolation(payload);
        });
  }

  private handleViolation(payload: RealityBleedPayload) {
      // S(t+1) = max(0, S(t) - w(severity))
      const weight = KERNEL_CONFIG.WEIGHTS[payload.severity as keyof typeof KERNEL_CONFIG.WEIGHTS] || 1;
      this.stabilityScore.update(s => Math.max(0, s - weight));

      this.recentViolations.update(v => [
          { source: payload.source, severity: payload.severity, weight, time: Date.now() },
          ...v
      ].slice(0, 8)); 

      const rawSource = payload.source;
      const domainKey = Object.keys(POLICIES).find(k => rawSource.includes(k));
      const policy = domainKey ? POLICIES[domainKey] : null;

      const msg = `[Supervisor] ${payload.source}: ${payload.message} (Sev: ${payload.severity}, Pen: -${weight})`;
      if (policy?.logLevel === 'ERROR' || payload.severity === 'CRITICAL') {
          console.error(msg);
      } else {
          console.warn(msg);
      }

      if (policy) {
          if (policy.condition && !policy.condition(payload.severity)) return;
          if (policy.action && payload.message) this.corrector.triggerCorrection(policy.action);
          
          if (policy.capQuality) {
              const status = this.systemStatus();
              if (policy.capQuality === 'MEDIUM') {
                  if (status === 'CRITICAL' && !this.emergencyCapActive()) {
                      console.warn('[Supervisor] Stability Critical. Engaging Emergency Caps.');
                      this.adaptiveQuality.setSafetyCap('MEDIUM');
                      this.emergencyCapActive.set(true);
                  }
                  return;
              }
              if (policy.capQuality === 'HIGH') {
                  this.adaptiveQuality.setSafetyCap('HIGH');
              }
          }
      }
  }

  private startRecoveryLoop() {
      // S(t+1) = min(100, S(t) + r)
      setInterval(() => {
          this.stabilityScore.update(s => Math.min(100, s + KERNEL_CONFIG.RECOVERY_RATE));
          
          // Hysteresis release
          if (this.stabilityScore() > KERNEL_CONFIG.THRESHOLDS.STABLE && this.emergencyCapActive()) {
              console.log('[Supervisor] Stability recovered. Disengaging Emergency Locks.');
              this.emergencyCapActive.set(false);
          }
      }, 1000);
  }

  /**
   * Deterministic Stability Harness
   * Feeds scripted sequence of severities to validate the control law.
   * Example: runStabilityTest(['MEDIUM', 'LOW', 'CRITICAL'])
   */
  runStabilityTest(sequence: ('LOW'|'MEDIUM'|'HIGH'|'CRITICAL')[]) {
      console.group('KERNEL STABILITY HARNESS');
      console.log('Initial Score:', this.stabilityScore());
      
      sequence.forEach((sev, i) => {
          const weight = KERNEL_CONFIG.WEIGHTS[sev];
          // Simulate violation
          this.stabilityScore.update(s => Math.max(0, s - weight));
          console.log(`[T+${i}] Input: ${sev} (-${weight}) -> Score: ${this.stabilityScore()} [${this.systemStatus()}]`);
      });
      
      console.log('Final Status:', this.systemStatus());
      console.groupEnd();
  }
}
