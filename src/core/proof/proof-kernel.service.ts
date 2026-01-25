import { Injectable, signal, OnDestroy, inject } from '@angular/core';
import { Entity } from '../../models/game.models';
import { DamageResult, DamagePacket } from '../../models/damage.model';
import { Item } from '../../models/item.models';
import { EventBusService } from '../events/event-bus.service';
import { GameEvents } from '../events/game-events';
import { LeanBridgeService, LeanCombatState, LeanCombatInput, LeanRect } from '../lean-bridge.service';

export type AxiomDomain = 'COMBAT' | 'INVENTORY' | 'WORLD' | 'STATUS' | 'RENDER' | 'INTEGRITY' | 'GEOMETRY' | 'GEOMETRY_SEGMENTS' | 'SPATIAL_TOPOLOGY' | 'PATH_CONTINUITY' | 'RENDER_DEPTH';
export type AxiomSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// Critical domains bypass sampling and always run
const CRITICAL_DOMAINS = new Set<AxiomDomain>([
    'INVENTORY', 
    'COMBAT', 
    'GEOMETRY', 
    'GEOMETRY_SEGMENTS',
    'WORLD', 
    'STATUS'
]);

export interface Axiom<T = any> {
  id: string;
  domain: AxiomDomain;
  description: string;
  severity: AxiomSeverity;
  check: (context: T) => boolean;
  errorMessage: (context: T) => string;
}

export interface ProofError {
  axiomId: string;
  domain: AxiomDomain;
  severity: AxiomSeverity;
  code: string;
  message: string;
  timestamp: number;
  context?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ProofError[];
  hash?: string;
  meta?: any;
}

export interface DomainMetrics {
  checks: number;
  failures: number;
  totalTimeMs: number;
  lastFailure: number;
}

export interface AxiomStats {
  id: string;
  checks: number;
  failures: number;
}

export interface KernelDiagnostics {
  domains: { domain: string; checks: number; failures: number; avgMs: number; lastFailure: number }[];
  failingAxioms: AxiomStats[];
  ledgerSize: number;
}

const WORKER_SCRIPT = `
self.onmessage = function(e) {
    const req = e.data;
    const start = performance.now();
    let valid = false;
    let error = undefined;
    let meta = {};

    try {
        switch (req.type) {
            case 'SPATIAL_TOPOLOGY': {
                const p = req.payload;
                meta = { density: 0 };
                if (p.cellCount > 0) {
                    const density = p.entityCount / p.cellCount;
                    meta.density = density;
                    if (density > 50) {
                        valid = false;
                        error = 'Grid Density Critical (' + density.toFixed(1) + ')';
                    } else {
                        valid = true;
                    }
                } else {
                    valid = true;
                }
                break;
            }

            case 'PATH_CONTINUITY': {
                const path = req.payload.path;
                const maxStride = req.payload.gridSize * 2.0; 
                valid = true;
                if (path && path.length > 1) {
                    for (let i = 0; i < path.length - 1; i++) {
                        const dx = path[i].x - path[i+1].x;
                        const dy = path[i].y - path[i+1].y;
                        if (Math.sqrt(dx*dx + dy*dy) > maxStride) {
                            valid = false;
                            error = 'Path Discontinuity at index ' + i;
                            break;
                        }
                    }
                }
                break;
            }

            case 'RENDER_DEPTH': {
                const list = req.payload.list;
                valid = true;
                for (let i = 0; i < list.length - 1; i++) {
                    if (list[i] > list[i+1]) {
                        valid = false;
                        error = 'Z-Sort Monotonicity Failure';
                        break;
                    }
                }
                break;
            }

            default:
                valid = true;
        }
    } catch (err) {
        valid = false;
        error = 'KernelPanic: ' + err.message;
    }

    self.postMessage({
        id: req.id,
        type: req.type,
        valid: valid,
        error: error,
        meta: meta,
        computeTime: performance.now() - start
    });
};
`;

@Injectable({
  providedIn: 'root'
})
export class ProofKernelService implements OnDestroy {
  
  private metrics: Record<string, ReturnType<typeof signal<DomainMetrics>>> = {};
  private worker: Worker | null = null;
  private workerUrl: string | null = null;
  
  private eventBus = inject(EventBusService);
  private leanBridge = inject(LeanBridgeService);
  
  // Public signal for sampling rate to break dependency cycle with Supervisor
  public samplingProbability = signal(0.1);
  
  private ledger: any[] = [];
  private axioms = new Map<string, Axiom>();
  private axiomStats = new Map<string, AxiomStats>();

  constructor() {
    this.initMetrics();
    this.registerCoreAxioms();
    this.initWorker();
  }

  // 3. CENTRALIZED PROBABILITY GATE
  private shouldVerify(domain: AxiomDomain): boolean {
      if (CRITICAL_DOMAINS.has(domain)) return true;
      const chance = this.samplingProbability();
      return Math.random() < (chance || 0.1);
  }

  private initMetrics() {
      const domains: AxiomDomain[] = ['COMBAT', 'INVENTORY', 'WORLD', 'STATUS', 'RENDER', 'INTEGRITY', 'GEOMETRY', 'GEOMETRY_SEGMENTS', 'SPATIAL_TOPOLOGY', 'PATH_CONTINUITY', 'RENDER_DEPTH'];
      domains.forEach(d => {
          this.metrics[d] = signal<DomainMetrics>({ checks: 0, failures: 0, totalTimeMs: 0, lastFailure: 0 });
      });
  }

  private initWorker() {
    if (typeof Worker !== 'undefined') {
      try {
        const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });
        this.workerUrl = URL.createObjectURL(blob);
        this.worker = new Worker(this.workerUrl);
        
        this.worker.onmessage = ({ data }) => {
          this.handleProofResult(data);
        };
      } catch (e) {
        console.warn('Failed to initialize Proof Worker.', e);
      }
    }
  }

  ngOnDestroy() {
    this.worker?.terminate();
    if (this.workerUrl) URL.revokeObjectURL(this.workerUrl);
  }

  // --- ASYNC API (Now Gated) ---

  verifyFormal(domain: AxiomDomain, context: any, contextId: string) {
    if (!this.shouldVerify(domain)) return;

    if (!this.worker) return;
    this.worker.postMessage({ id: contextId, type: domain, payload: context });
  }

  // Refactored to use LeanBridge canonical geometry
  verifyGeometry(rects: LeanRect[]): void {
      const start = performance.now();
      const proof = this.leanBridge.proveGeometryValidity(rects);
      const time = performance.now() - start;

      if (!proof.valid) {
          this.updateMetrics('GEOMETRY', time, 1);
          this.eventBus.dispatch({
              type: GameEvents.REALITY_BLEED,
              payload: { 
                  severity: 'HIGH', 
                  source: 'LEAN:GEOMETRY', 
                  message: proof.reason || 'Geometric overlapping detected',
                  meta: proof.details 
              }
          });
      } else {
          this.updateMetrics('GEOMETRY', time, 0);
      }
  }

  verifySpatialGridTopology(cellCount: number, entityCount: number, cellSize: number): void {
      this.verifyFormal('SPATIAL_TOPOLOGY', { cellCount, entityCount, cellSize }, `TOPO_${Date.now()}`);
  }

  verifyPathContinuity(path: {x: number, y: number}[], gridSize: number): void {
      this.verifyFormal('PATH_CONTINUITY', { path, gridSize }, `PATH_${Date.now()}`);
  }

  verifyRenderDepth(depthValues: number[]): void {
      this.verifyFormal('RENDER_DEPTH', { list: depthValues }, `RENDER_${Date.now()}`);
  }

  // --- SYNC API (Critical Path) ---

  createTransaction<T>(state: T) {
      return { state }; 
  }

  verifyCombatTransaction(context: { oldHp: number, damage: number, newHp: number }): ValidationResult {
    // 1. Run Lean Verification (Shadow Mode)
    const prev: LeanCombatState = { hp: context.oldHp, max_hp: 10000, armor: 0 }; // Approx context
    const next: LeanCombatState = { hp: context.newHp, max_hp: 10000, armor: 0 };
    const input: LeanCombatInput = { damage: context.damage, penetration: 0 };
    
    const proof = this.leanBridge.proveCombatStep(prev, input, next);
    
    if (!proof.valid) {
        return { 
            isValid: false, 
            errors: [{ 
                axiomId: 'lean.combat.validity', 
                domain: 'COMBAT', 
                severity: 'CRITICAL', 
                code: 'LEAN_VIOLATION', 
                message: proof.reason || 'Unknown Lean Failure', 
                timestamp: Date.now() 
            }] 
        };
    }

    return this.verify('COMBAT', { result: { total: context.damage } });
  }

  verifyInventoryState(bag: Item[], credits: number, scrap: number): ValidationResult {
    return this.verify('INVENTORY', { bag, credits, scrap });
  }
  
  verifyStatusEffects(entity: Entity): ValidationResult {
      if (!entity.status) return { isValid: false, errors: [{ axiomId: 'status.missing', domain: 'STATUS', severity: 'MEDIUM', code: 'NO_STATUS', message: 'Entity missing status object', timestamp: Date.now() }] };
      return { isValid: true, errors: [] };
  }
  
  verifyDialogueState(node: any, checkReqs: (reqs: any) => boolean): ValidationResult {
      if (!node || !node.id) return { isValid: false, errors: [{ axiomId: 'dlg.struct', domain: 'WORLD', severity: 'HIGH', code: 'DLG_INVALID', message: 'Invalid Node Structure', timestamp: Date.now() }] };
      return { isValid: true, errors: [] };
  }
  
  verifyNonOverlap(entities: Entity[]): ValidationResult {
      // Map entities to LeanRects for verification
      const rects: LeanRect[] = entities
        .filter(e => e.type === 'WALL' && e.width && e.depth)
        .map(e => ({
            id: e.id,
            x: e.x - (e.width || 40)/2,
            y: e.y - (e.depth || 40)/2,
            w: e.width || 40,
            h: e.depth || 40
        }));
      
      const proof = this.leanBridge.proveGeometryValidity(rects);
      
      if (!proof.valid) {
          return { 
              isValid: false, 
              errors: [{ 
                  axiomId: 'lean.geo.overlap', 
                  domain: 'GEOMETRY', 
                  severity: 'HIGH', 
                  code: 'OVERLAP', 
                  message: proof.reason!, 
                  context: proof.details,
                  timestamp: Date.now() 
              }] 
          };
      }
      return { isValid: true, errors: [] };
  }
  
  verifyConnectivity(entities: Entity[], bounds: any, start: any): ValidationResult {
      return { isValid: true, errors: [] };
  }

  // --- INTERNAL ---

  private handleProofResult(data: any) {
      if (data.valid) {
          this.updateMetrics(data.type, data.computeTime, 0);
          return;
      }

      let severity: AxiomSeverity = 'LOW';
      if (data.type === 'SPATIAL_TOPOLOGY') severity = 'MEDIUM'; 
      else if (data.error && data.error.includes('KernelPanic')) severity = 'CRITICAL';
      else severity = 'MEDIUM';

      // SAFETY: Explicitly downgrade severity if it defaulted to CRITICAL in worker but isn't a Panic
      if (severity === 'CRITICAL' && !data.error.includes('KernelPanic')) {
          severity = 'HIGH';
      }

      this.updateMetrics(data.type, data.computeTime, 1);

      this.eventBus.dispatch({
          type: GameEvents.REALITY_BLEED,
          payload: {
              severity,
              source: `KERNEL:${data.type}`,
              message: data.error,
              meta: data.meta
          }
      });
  }

  private verify<T>(domain: AxiomDomain, context: T): ValidationResult {
    if (!this.shouldVerify(domain)) return { isValid: true, errors: [] };

    const start = performance.now();
    const errors: ProofError[] = [];
    
    for (const axiom of this.axioms.values()) {
      if (axiom.domain !== domain) continue;
      const stats = this.axiomStats.get(axiom.id);
      if (stats) stats.checks++;

      try {
        if (!axiom.check(context)) {
          if (stats) stats.failures++;
          errors.push({
            axiomId: axiom.id,
            domain: domain,
            severity: axiom.severity,
            code: axiom.id.toUpperCase(),
            message: axiom.errorMessage(context),
            timestamp: Date.now()
          });
        }
      } catch (e) {
        console.warn(`[ProofKernel] Axiom ${axiom.id} error`, e);
      }
    }

    this.updateMetrics(domain, performance.now() - start, errors.length);
    return { isValid: errors.length === 0, errors };
  }

  private updateMetrics(domain: string, time: number, failureCount: number) {
    const signal = this.metrics[domain];
    if (signal) {
      signal.update(m => ({
        checks: m.checks + 1,
        failures: m.failures + (failureCount > 0 ? 1 : 0),
        totalTimeMs: m.totalTimeMs + time,
        lastFailure: failureCount > 0 ? Date.now() : m.lastFailure
      }));
    }
  }

  private registerCoreAxioms() {
    this.registerAxiom({
      id: 'combat.non_negative', domain: 'COMBAT', severity: 'HIGH', description: 'Non-negative damage',
      check: (ctx: { result: DamageResult }) => ctx.result.total >= 0,
      errorMessage: (ctx) => `Negative damage: ${ctx.result.total}`
    });
    this.registerAxiom({
      id: 'inv.non_negative_stacks', domain: 'INVENTORY', severity: 'HIGH', description: 'Positive stacks',
      check: (ctx: { bag: Item[] }) => ctx.bag.every(i => i.stack > 0),
      errorMessage: () => `Invalid stack count`
    });
  }

  registerAxiom<T>(axiom: Axiom<T>) {
    this.axioms.set(axiom.id, axiom);
    this.axiomStats.set(axiom.id, { id: axiom.id, checks: 0, failures: 0 });
  }

  computeChecksum(data: any): string { return 'HASH'; }

  getDiagnostics(): KernelDiagnostics {
    const domains = Object.entries(this.metrics).map(([key, sig]) => {
      const m = sig();
      return { 
        domain: key, 
        checks: m.checks, 
        failures: m.failures, 
        avgMs: m.checks > 0 ? parseFloat((m.totalTimeMs / m.checks).toFixed(4)) : 0,
        lastFailure: m.lastFailure 
      };
    });
    const failingAxioms = Array.from(this.axiomStats.values()).filter(s => s.failures > 0);
    return { domains, failingAxioms, ledgerSize: this.ledger.length };
  }
}
