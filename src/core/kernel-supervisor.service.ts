
import { Injectable, inject, signal, computed } from '@angular/core';
import { EventBusService } from './events/event-bus.service';
import { GameEvents, RealityBleedPayload } from './events/game-events';
import { RealityCorrectorService } from './reality-corrector.service';
import { AdaptiveQualityService } from '../systems/adaptive-quality.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProofKernelService } from './proof/proof-kernel.service';

export type SystemStatus = 'STABLE' | 'UNSTABLE' | 'CRITICAL';

export interface ViolationRecord {
    source: string;
    severity: string;
    weight: number;
    time: number;
}

export const KERNEL_CONFIG = {
    WEIGHTS: {
        LOW: 1,
        MEDIUM: 5,
        HIGH: 10,
        CRITICAL: 12
    },
    RECOVERY_RATE: 1, 
    THRESHOLDS: {
        STABLE: 80,
        CRITICAL: 35
    },
    SAMPLING: {
        STABLE: 0.05,
        UNSTABLE: 0.25,
        CRITICAL: 1.0
    }
};

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
  }

  getGeometryViolationCount() { return this.proofKernel.getGeometryViolationCount(); }
  getCombatViolationCount() { return this.proofKernel.getCombatViolationCount(); }

  private subscribeToBleeds() {
      this.eventBus.on(GameEvents.REALITY_BLEED)
        .pipe(takeUntilDestroyed())
        .subscribe((payload: RealityBleedPayload) => {
            this.handleViolation(payload);
        });
  }

  private handleViolation(payload: RealityBleedPayload) {
      const weight = KERNEL_CONFIG.WEIGHTS[payload.severity as keyof typeof KERNEL_CONFIG.WEIGHTS] || 1;
      this.stabilityScore.update(s => Math.max(0, s - weight));

      this.recentViolations.update(v => [
          { source: payload.source, severity: payload.severity, weight, time: Date.now() },
          ...v
      ].slice(0, 8)); 

      const msg = `[Supervisor] ${payload.source}: ${payload.message}`;
      if (payload.severity === 'CRITICAL') console.error(msg);
      else console.warn(msg);

      // Immune Loop: Trigger Corrections based on Source Pattern
      if (payload.source.startsWith('LEAN:GEOMETRY')) {
          this.corrector.triggerCorrection('SPATIAL');
      } else if (payload.source.startsWith('LEAN:COMBAT')) {
          this.corrector.triggerCorrection('COMBAT');
      } else if (payload.source.startsWith('LEAN:INVENTORY')) {
          this.corrector.triggerCorrection('INVENTORY');
      }

      if (payload.severity === 'CRITICAL' && !this.emergencyCapActive()) {
          this.adaptiveQuality.setSafetyCap('MEDIUM');
          this.emergencyCapActive.set(true);
      }
  }

  private startRecoveryLoop() {
      setInterval(() => {
          this.stabilityScore.update(s => Math.min(100, s + KERNEL_CONFIG.RECOVERY_RATE));
          
          if (this.stabilityScore() > KERNEL_CONFIG.THRESHOLDS.STABLE && this.emergencyCapActive()) {
              this.emergencyCapActive.set(false);
          }
      }, 1000);
  }
}
