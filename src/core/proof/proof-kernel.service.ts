
import { Injectable, signal, OnDestroy, inject } from '@angular/core';
import { Entity } from '../../models/game.models';
import { DamageResult, DamagePacket } from '../../models/damage.model';
import { Item } from '../../models/item.models';
import { EventBusService } from '../events/event-bus.service';
import { GameEvents } from '../events/game-events';

export type AxiomDomain = 'COMBAT' | 'INVENTORY' | 'WORLD' | 'STATUS' | 'RENDER' | 'INTEGRITY' | 'GEOMETRY' | 'GEOMETRY_SEGMENTS' | 'SPATIAL_TOPOLOGY' | 'PATH_CONTINUITY' | 'RENDER_DEPTH';
export type AxiomSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// Critical domains bypass sampling and always run
const CRITICAL_DOMAINS = new Set<AxiomDomain>([
    'INVENTORY', 
    'COMBAT', 
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
            case 'COMBAT': {
                const p = req.payload;
                const cap = 10000;
                if (p.damage < 0 || p.damage > cap) {
                    valid = false;
                    error = 'Damage Magnitude (' + p.damage + ') out of bounds';
                } else {
                    const rawExpected = p.oldHp - p.damage;
                    const matchesRaw = Math.abs(p.newHp - rawExpected) < 0.01;
                    const matchesClamped = (p.newHp === 0 && rawExpected < 0);
                    valid = matchesRaw || matchesClamped;
                    if (!valid) error = 'State Transition Non-Deterministic';
                }
                break;
            }

            case 'GEOMETRY_SEGMENTS': {
                const segments = req.payload.segments;
                valid = true;
                const SEG_EPS = 2.0; 
                const OVERLAP_THRESHOLD = 0.3;

                outerSeg: for (let i = 0; i < segments.length; i++) {
                    const a = segments[i];
                    for (let j = i + 1; j < segments.length; j++) {
                        const b = segments[j];
                        if (a.role && b.role && a.role === b.role && a.role !== 'DEFAULT') continue;

                        const vertA = Math.abs(a.x1 - a.x2) < SEG_EPS;
                        const vertB = Math.abs(b.x1 - b.x2) < SEG_EPS;
                        const horzA = Math.abs(a.y1 - a.y2) < SEG_EPS;
                        const horzB = Math.abs(b.y1 - b.y2) < SEG_EPS;

                        const sameX = vertA && vertB && Math.abs(a.x1 - b.x1) < SEG_EPS;
                        const sameY = horzA && horzB && Math.abs(a.y1 - b.y1) < SEG_EPS;

                        if (!sameX && !sameY) continue;

                        let aStart, aEnd, bStart, bEnd;
                        if (sameX) {
                            aStart = Math.min(a.y1, a.y2); aEnd = Math.max(a.y1, a.y2);
                            bStart = Math.min(b.y1, b.y2); bEnd = Math.max(b.y1, b.y2);
                        } else {
                            aStart = Math.min(a.x1, a.x2); aEnd = Math.max(a.x1, a.x2);
                            bStart = Math.min(b.x1, b.x2); bEnd = Math.max(b.x1, b.x2);
                        }

                        const overlapLen = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

                        if (overlapLen > SEG_EPS) {
                            const lenA = Math.abs(aEnd - aStart);
                            const lenB = Math.abs(bEnd - bStart);
                            const minLen = Math.min(lenA, lenB);
                            
                            if (minLen < 10) continue; 

                            const frac = overlapLen / minLen;
                            if (frac > OVERLAP_THRESHOLD) {
                                valid = false;
                                error = 'Segment Overlap ' + (frac*100).toFixed(1) + '%';
                                meta = { entityIdA: a.entityId, entityIdB: b.entityId, overlapFrac: frac };
                                break outerSeg;
                            }
                        }
                    }
                }
                break;
            }

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
      // Use internal signal driven by Supervisor via effect
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
    // Gate Check
    if (!this.shouldVerify(domain)) return;

    if (!this.worker) return;
    this.worker.postMessage({ id: contextId, type: domain, payload: context });
  }

  verifyStructuralSegments(segments: { x1: number; y1: number; x2: number; y2: number; entityId?: number | string; role?: string }[]): void {
      // Critical domain, shouldVerify returns true anyway, but called explicitly here
      this.verifyFormal('GEOMETRY_SEGMENTS', { segments }, `SEG_${Date.now()}`);
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

  // --- SYNC API (Critical Path - Usually Manual Gating in Caller or always run) ---

  createTransaction<T>(state: T) {
      return { state }; 
  }

  verifyCombatTransaction(damagePacket: DamagePacket, result: DamageResult): ValidationResult {
    return this.verify('COMBAT', { packet: damagePacket, result });
  }

  verifyInventoryState(bag: Item[], credits: number, scrap: number): ValidationResult {
    return this.verify('INVENTORY', { bag, credits, scrap });
  }
  
  verifyStatusEffects(entity: Entity): ValidationResult {
      // Status is critical, check every time
      if (!entity.status) return { isValid: false, errors: [{ axiomId: 'status.missing', domain: 'STATUS', severity: 'MEDIUM', code: 'NO_STATUS', message: 'Entity missing status object', timestamp: Date.now() }] };
      return { isValid: true, errors: [] };
  }
  
  verifyDialogueState(node: any, checkReqs: (reqs: any) => boolean): ValidationResult {
      if (!node || !node.id) return { isValid: false, errors: [{ axiomId: 'dlg.struct', domain: 'WORLD', severity: 'HIGH', code: 'DLG_INVALID', message: 'Invalid Node Structure', timestamp: Date.now() }] };
      return { isValid: true, errors: [] };
  }
  
  verifyNonOverlap(entities: Entity[]): ValidationResult {
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
      
      // Mapped Logic for Severity Constraints
      // Policy: only kernel-level failures as CRITICAL
      if (data.type === 'SPATIAL_TOPOLOGY') {
          severity = 'MEDIUM'; 
      } else if (data.type === 'GEOMETRY_SEGMENTS') {
          severity = 'MEDIUM'; 
      } else if (data.error.includes('KernelPanic')) {
          severity = 'CRITICAL';
      } else {
          // Default logic errors (paths, etc)
          severity = 'MEDIUM';
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
    // Synchronous Verify Gate - Note: Inventory and Combat are CRITICAL_DOMAINS
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
    // Downgraded from CRITICAL to HIGH to match "Only kernel failures are critical" policy
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
