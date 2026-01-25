
import { Injectable, inject } from '@angular/core';
import { LeanBridgeService, LeanRect, LeanProofResult, GeometryDetails, CombatDetails, LeanCombatState, LeanCombatInput, LeanInventoryState, InventoryDetails } from '../lean-bridge.service';
import { EventBusService } from '../events/event-bus.service';
import { GameEvents } from '../events/game-events';

export type GeometryGateMode = "STRICT_DEV" | "SOFT_PROD";
export type ProofDomain = 'GEOMETRY' | 'COMBAT' | 'INVENTORY';

export interface DomainStats {
    checks: number;
    violations: number;
    totalMs: number;
    ledgerSize: number;
}

export interface KernelDiagnostics {
  domains: Record<ProofDomain, { checks: number; violations: number; avgMs: number }>;
  gateMode: GeometryGateMode;
}

interface GateRequest<T> {
    domain: ProofDomain;
    source: string;
    kernelCall: () => LeanProofResult<T>;
}

// Compact per-domain config table
const DOMAIN_CONFIG: Record<ProofDomain, { severity: 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL', throwStrict: boolean }> = {
    GEOMETRY: { severity: 'HIGH', throwStrict: true },
    COMBAT: { severity: 'MEDIUM', throwStrict: false },
    INVENTORY: { severity: 'MEDIUM', throwStrict: false } // Inventory is recoverable via rollback
};

@Injectable({
  providedIn: 'root'
})
export class ProofKernelService {
  private leanBridge = inject(LeanBridgeService);
  private eventBus = inject(EventBusService);

  private gateMode: GeometryGateMode = "SOFT_PROD";
  
  // Ledgers & Metrics
  private readonly LEDGER_CAP = 50;
  private ledgers: Record<ProofDomain, { timestamp: number, details: any }[]> = {
      GEOMETRY: [], COMBAT: [], INVENTORY: []
  };
  
  private metrics: Record<ProofDomain, { checks: number, violations: number, totalMs: number }> = {
      GEOMETRY: { checks: 0, violations: 0, totalMs: 0 },
      COMBAT: { checks: 0, violations: 0, totalMs: 0 },
      INVENTORY: { checks: 0, violations: 0, totalMs: 0 }
  };

  constructor() {}

  setGeometryGateMode(mode: GeometryGateMode) {
      this.gateMode = mode;
      console.log(`[ProofKernel] Gate Mode switched to: ${mode}`);
  }

  getGeometryGateMode() { return this.gateMode; }

  // --- GENERIC GATE PIPELINE ---
  
  private runGate<T>(req: GateRequest<T>): boolean {
      const start = performance.now();
      const config = DOMAIN_CONFIG[req.domain];
      
      // 1. Kernel Call (Delegated to LeanBridge)
      const result = req.kernelCall();
      
      const duration = performance.now() - start;
      const metric = this.metrics[req.domain];
      
      metric.checks++;
      metric.totalMs += duration;

      // 2. Interpret Ok/Details
      if (result.valid) {
          return true;
      }

      // 3. Update Metrics & Ledger
      metric.violations++;
      const ledger = this.ledgers[req.domain];
      ledger.unshift({ timestamp: Date.now(), details: result.details || { reason: result.reason } });
      if (ledger.length > this.LEDGER_CAP) ledger.pop();

      // 4. Emit REALITY_BLEED (Event Bus)
      this.eventBus.dispatch({
          type: GameEvents.REALITY_BLEED,
          payload: { 
              severity: config.severity, 
              source: `LEAN:${req.domain}:${req.source}`, 
              message: result.reason || 'Validation Failed',
              meta: result.details 
          }
      });

      // 5. Strict Mode Enforcement
      if (this.gateMode === "STRICT_DEV" && config.throwStrict) {
          throw new Error(`[ProofKernel] STRICT VIOLATION in ${req.domain}: ${result.reason}`);
      }

      return false;
  }

  // --- DOMAIN EXPOSURE ---

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

  verifyInventoryState(state: LeanInventoryState, source: string = "TRANSACTION"): boolean {
      return this.runGate<InventoryDetails>({
          domain: 'INVENTORY',
          source,
          kernelCall: () => this.leanBridge.proveInventoryState(state)
      });
  }

  // --- DIAGNOSTICS ---

  debugRunGeometrySelfTest() {
      this.leanBridge.runGeometrySelfTest();
  }

  getDiagnostics(): KernelDiagnostics {
      const d: any = {};
      for (const key of ['GEOMETRY', 'COMBAT', 'INVENTORY'] as ProofDomain[]) {
          const m = this.metrics[key];
          d[key] = {
              checks: m.checks,
              violations: m.violations,
              avgMs: m.checks > 0 ? m.totalMs / m.checks : 0
          };
      }
      return {
          domains: d,
          gateMode: this.gateMode
      };
  }
  
  getGeometryViolationCount() { return this.metrics.GEOMETRY.violations; }
  getCombatViolationCount() { return this.metrics.COMBAT.violations; }
  
  // Helpers / Facades
  createTransaction<T>(state: T) { return { state }; }
  
  // Legacy stubs
  verifySpatialGridTopology(cellCount: number, entityCount: number, cellSize: number) {}
  verifyPathContinuity(path: any[], gridSize: number) {}
  verifyRenderDepth(samples: any[]) {}
  verifyStatusEffects(e: any): any { return { isValid: true, errors: [] }; }
  verifyDialogueState(node: any, check: any): any { return { isValid: true, errors: [] }; }
  computeChecksum(entities: any): string { return "CHECK"; }
  verifyNonOverlap(entities: any): any { return { isValid: true, errors: [] }; }
  verifyConnectivity(entities: any, bounds: any, start: any): any { return { isValid: true, errors: [] }; }
}
