
import { Injectable, signal, inject } from '@angular/core';
import { LeanBridgeService, LeanRect, LeanProofResult, GeometryDetails, CombatDetails, LeanCombatState, LeanCombatInput } from '../lean-bridge.service';
import { EventBusService } from '../events/event-bus.service';
import { GameEvents } from '../events/game-events';

export type GeometryGateMode = "STRICT_DEV" | "SOFT_PROD";

export interface KernelDiagnostics {
  geometry: { checks: number; violations: number; avgMs: number; ledgerSize: number };
  combat: { checks: number; violations: number; avgMs: number; ledgerSize: number };
  gateMode: GeometryGateMode;
}

interface GateConfig<T> {
    domain: 'GEOMETRY' | 'COMBAT';
    source: string;
    kernelCall: () => LeanProofResult<T>;
    toDetails?: (result: LeanProofResult<T>) => any;
}

@Injectable({
  providedIn: 'root'
})
export class ProofKernelService {
  private leanBridge = inject(LeanBridgeService);
  private eventBus = inject(EventBusService);

  private gateMode: GeometryGateMode = "SOFT_PROD";
  
  // Ledgers
  private readonly LEDGER_CAP = 50;
  private geometryLedger: { timestamp: number, details: GeometryDetails }[] = [];
  private combatLedger: { timestamp: number, details: CombatDetails }[] = [];

  // Metrics
  private metrics = {
      geometry: { checks: 0, violations: 0, totalMs: 0 },
      combat: { checks: 0, violations: 0, totalMs: 0 }
  };

  constructor() {}

  setGeometryGateMode(mode: GeometryGateMode) {
      this.gateMode = mode;
      console.log(`[ProofKernel] Gate Mode switched to: ${mode}`);
  }

  getGeometryGateMode() { return this.gateMode; }

  // --- GENERIC GATE TEMPLATE ---
  
  private runGate<T>(config: GateConfig<T>): boolean {
      const start = performance.now();
      
      // 1. Call Kernel
      const result = config.kernelCall();
      
      const duration = performance.now() - start;
      const metricObj = config.domain === 'GEOMETRY' ? this.metrics.geometry : this.metrics.combat;
      
      metricObj.checks++;
      metricObj.totalMs += duration;

      // 2. Interpret Result
      if (result.valid) {
          return true;
      }

      // 3. Update Ledger & Metrics on Failure
      metricObj.violations++;
      
      if (config.domain === 'GEOMETRY' && result.details) {
          this.geometryLedger.unshift({ timestamp: Date.now(), details: result.details as any });
          if (this.geometryLedger.length > this.LEDGER_CAP) this.geometryLedger.pop();
      } else if (config.domain === 'COMBAT' && result.details) {
          this.combatLedger.unshift({ timestamp: Date.now(), details: result.details as any });
          if (this.combatLedger.length > this.LEDGER_CAP) this.combatLedger.pop();
      }

      // 4. Emit Event
      this.eventBus.dispatch({
          type: GameEvents.REALITY_BLEED,
          payload: { 
              severity: 'HIGH', 
              source: `KERNEL:${config.domain}:${config.source}`, 
              message: result.reason || 'Kernel Validation Failed',
              meta: result.details 
          }
      });

      // 5. Conditional Throw
      if (this.gateMode === "STRICT_DEV") {
          throw new Error(`[KernelGate] STRICT VIOLATION in ${config.domain}: ${result.reason}`);
      }

      return false;
  }

  // --- CONCRETE WRAPPERS ---

  verifyGeometry(rects: readonly LeanRect[], sectorId: string = "UNKNOWN", source: string = "RUNTIME"): boolean {
      return this.runGate<GeometryDetails>({
          domain: 'GEOMETRY',
          source,
          kernelCall: () => this.leanBridge.proveGeometryValidity(rects, sectorId, source)
      });
  }

  verifyCombatStep(source: string, prev: LeanCombatState, input: LeanCombatInput, next: LeanCombatState): boolean {
      return this.runGate<CombatDetails>({
          domain: 'COMBAT',
          source,
          kernelCall: () => this.leanBridge.proveCombatStep(prev, input, next)
      });
  }

  // --- DIAGNOSTICS & HELPERS ---

  debugRunGeometrySelfTest() {
      this.leanBridge.runGeometrySelfTest();
  }

  getDiagnostics(): KernelDiagnostics {
      const g = this.metrics.geometry;
      const c = this.metrics.combat;
      return {
          geometry: { 
              checks: g.checks, 
              violations: g.violations, 
              avgMs: g.checks > 0 ? g.totalMs / g.checks : 0,
              ledgerSize: this.geometryLedger.length 
          },
          combat: { 
              checks: c.checks, 
              violations: c.violations, 
              avgMs: c.checks > 0 ? c.totalMs / c.checks : 0,
              ledgerSize: this.combatLedger.length 
          },
          gateMode: this.gateMode
      };
  }
  
  getGeometryViolationCount() { return this.metrics.geometry.violations; }
  getCombatViolationCount() { return this.metrics.combat.violations; }
  getLastGeometryViolations(k: number) { return this.geometryLedger.slice(0, k).map(x => x.details); }
  
  // Legacy facade methods if needed
  createTransaction<T>(state: T) { return { state }; }
  
  // Compatibility with old supervisor calls until fully migrated
  verifySpatialGridTopology(cellCount: number, entityCount: number, cellSize: number) {}
  verifyPathContinuity(path: any[], gridSize: number) {}
  verifyRenderDepth(samples: any[]) {}
  verifyStatusEffects(e: any): any { return { isValid: true, errors: [] }; }
  verifyDialogueState(node: any, check: any): any { return { isValid: true, errors: [] }; }
  verifyInventoryState(bag: any, c: any, s: any): any { return { isValid: true, errors: [] }; }
  computeChecksum(entities: any): string { return "CHECK"; }
  verifyNonOverlap(entities: any): any { return { isValid: true, errors: [] }; }
  verifyConnectivity(entities: any, bounds: any, start: any): any { return { isValid: true, errors: [] }; }
}
