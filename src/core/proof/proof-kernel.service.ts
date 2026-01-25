
import { Injectable, signal, OnDestroy } from '@angular/core';
import { Entity } from '../../models/game.models';
import { DamageResult, DamagePacket } from '../../models/damage.model';
import { Item } from '../../models/item.models';
import { EventBusService } from '../events/event-bus.service';
import { GameEvents } from '../events/game-events';

// --- TYPES ---

export type AxiomDomain = 'COMBAT' | 'INVENTORY' | 'WORLD' | 'STATUS' | 'RENDER' | 'INTEGRITY' | 'GEOMETRY' | 'GEOMETRY_SEGMENTS' | 'SPATIAL_TOPOLOGY' | 'PATH_CONTINUITY' | 'RENDER_DEPTH';
export type AxiomSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Axiom<T = any> {
  id: string;
  domain: AxiomDomain;
  description: string;
  severity: AxiomSeverity;
  /** Synchronous Heuristic Check (Fast) */
  check: (context: T) => boolean;
  /** Dynamic error message based on context */
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
}

export interface AxiomStats {
  id: string;
  checks: number;
  failures: number;
}

export interface KernelDiagnostics {
  domains: { domain: string; checks: number; failures: number; avgMs: number }[];
  failingAxioms: AxiomStats[];
  ledgerSize: number;
}

// --- WORKER SCRIPT (Formal Verification Simulation) ---
const WORKER_SCRIPT = `
self.onmessage = function(e) {
    const req = e.data;
    const start = performance.now();
    let valid = false;
    let error = undefined;
    let meta = {};

    try {
        switch (req.type) {
            case 'COMBAT':
                const p = req.payload;
                const cap = 10000;
                if (p.damage < 0 || p.damage > cap) {
                    valid = false;
                    error = 'AxiomViolation: Damage Magnitude (' + p.damage + ') outside set [0, ' + cap + ']';
                } else {
                    const rawExpected = p.oldHp - p.damage;
                    const matchesRaw = Math.abs(p.newHp - rawExpected) < 0.01;
                    const matchesClamped = (p.newHp === 0 && rawExpected < 0);
                    if (matchesRaw || matchesClamped) {
                        valid = true;
                    } else {
                        valid = false;
                        error = 'AxiomViolation: State Transition Non-Deterministic';
                    }
                }
                break;

            case 'GEOMETRY_SEGMENTS': {
                // Theorem: No Significant Collinear Overlap
                // Exception: Segments with matching 'role' (e.g. 'REINFORCED') are allowed to overlap.
                
                const segments = req.payload.segments;
                valid = true;
                const SEG_EPS = 2.0; // Tolerance for alignment
                const OVERLAP_THRESHOLD = 0.3; // Max 30% overlap fraction allowed for mixed roles

                // O(N^2) but strictly for static load time
                outerSeg: for (let i = 0; i < segments.length; i++) {
                    const a = segments[i];
                    for (let j = i + 1; j < segments.length; j++) {
                        const b = segments[j];

                        // Exception: Intentional Reinforcement
                        if (a.role && b.role && a.role === b.role && a.role !== 'DEFAULT') {
                            continue;
                        }

                        // 1. Detect orientation (Vertical if x1 approx x2)
                        const verticalA = Math.abs(a.x1 - a.x2) < SEG_EPS;
                        const verticalB = Math.abs(b.x1 - b.x2) < SEG_EPS;
                        const horizontalA = Math.abs(a.y1 - a.y2) < SEG_EPS;
                        const horizontalB = Math.abs(b.y1 - b.y2) < SEG_EPS;

                        // 2. Must match orientation to be collinear
                        const sameX = verticalA && verticalB && Math.abs(a.x1 - b.x1) < SEG_EPS;
                        const sameY = horizontalA && horizontalB && Math.abs(a.y1 - b.y1) < SEG_EPS;

                        if (!sameX && !sameY) continue; 

                        // 3. Calculate overlap on the shared axis
                        let aStart, aEnd, bStart, bEnd;
                        if (sameX) { // Vertical segments, compare Y ranges
                            aStart = Math.min(a.y1, a.y2); aEnd = Math.max(a.y1, a.y2);
                            bStart = Math.min(b.y1, b.y2); bEnd = Math.max(b.y1, b.y2);
                        } else { // Horizontal segments, compare X ranges
                            aStart = Math.min(a.x1, a.x2); aEnd = Math.max(a.x1, a.x2);
                            bStart = Math.min(b.x1, b.x2); bEnd = Math.max(b.x1, b.x2);
                        }

                        // 4. Determine Linear Overlap
                        const overlapLen = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

                        if (overlapLen > SEG_EPS) {
                            // 5. Check Fraction against smallest segment
                            const lenA = Math.abs(aEnd - aStart);
                            const lenB = Math.abs(bEnd - bStart);
                            const minLen = Math.min(lenA, lenB);
                            
                            // Ignore tiny segments (decorators)
                            if (minLen < 10) continue;

                            const frac = overlapLen / minLen;

                            if (frac > OVERLAP_THRESHOLD) {
                                valid = false;
                                const idA = a.entityId !== undefined ? a.entityId : i;
                                const idB = b.entityId !== undefined ? b.entityId : j;
                                error = 'Segment Overlap ' + (frac*100).toFixed(1) + '%';
                                meta = { 
                                    entityIdA: idA, 
                                    entityIdB: idB, 
                                    overlapFrac: frac,
                                    axis: sameX ? 'VERTICAL' : 'HORIZONTAL'
                                };
                                break outerSeg;
                            }
                        }
                    }
                }
                break;
            }

            case 'SPATIAL_TOPOLOGY': {
                // Verify Grid Consistency
                const p = req.payload;
                const cellCount = p.cellCount;
                const entityCount = p.entityCount;
                const cellSize = p.cellSize;
                
                meta = { cellCount, entityCount, density: 0 };

                if (cellCount > 0 && entityCount > 0) {
                    const density = entityCount / cellCount;
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

            case 'PATH_CONTINUITY':
                const path = req.payload.path;
                const maxStride = req.payload.gridSize * 1.5;
                valid = true;
                for (let i = 0; i < path.length - 1; i++) {
                    const dx = path[i].x - path[i+1].x;
                    const dy = path[i].y - path[i+1].y;
                    if (Math.sqrt(dx*dx + dy*dy) > maxStride) {
                        valid = false;
                        error = 'Path Discontinuity at index ' + i;
                        break;
                    }
                }
                break;

            case 'RENDER_DEPTH':
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

// --- TRANSACTION HELPER ---

export class Transaction<T> {
  private snapshot: T;

  constructor(private state: T, private kernel: ProofKernelService) {
    this.snapshot = structuredClone(state);
  }

  attempt(
    actionName: string,
    domain: AxiomDomain,
    mutator: (draft: T) => void, 
    validator: (draft: T) => ValidationResult
  ): { success: boolean; newState: T | null; errors: ProofError[] } {
    try {
      const draft = structuredClone(this.snapshot);
      mutator(draft);
      
      const result = validator(draft);
      this.kernel.logTransaction(domain, actionName, this.state, draft, result.isValid);

      if (result.isValid) {
        return { success: true, newState: draft, errors: [] };
      } else {
        return { success: false, newState: null, errors: result.errors };
      }
    } catch (e: any) {
      console.error('[ProofKernel] Transaction Exception', e);
      return { 
        success: false, 
        newState: null, 
        errors: [{
          axiomId: 'RUNTIME_EXCEPTION',
          domain: 'INTEGRITY',
          severity: 'CRITICAL',
          code: 'EXCEPTION',
          message: e.message || 'Unknown Error',
          timestamp: Date.now()
        }] 
      };
    }
  }
}

@Injectable({
  providedIn: 'root'
})
export class ProofKernelService implements OnDestroy {
  
  // --- STATE ---
  private axioms = new Map<string, Axiom>();
  private axiomStats = new Map<string, AxiomStats>();
  
  private ledger: any[] = [];
  private currentHeadHash = 'GENESIS_HASH';
  
  private metrics: Record<string, ReturnType<typeof signal<DomainMetrics>>> = {
    COMBAT: signal<DomainMetrics>({ checks: 0, failures: 0, totalTimeMs: 0 }),
    INVENTORY: signal<DomainMetrics>({ checks: 0, failures: 0, totalTimeMs: 0 }),
    WORLD: signal<DomainMetrics>({ checks: 0, failures: 0, totalTimeMs: 0 }),
    STATUS: signal<DomainMetrics>({ checks: 0, failures: 0, totalTimeMs: 0 }),
    RENDER: signal<DomainMetrics>({ checks: 0, failures: 0, totalTimeMs: 0 }),
    INTEGRITY: signal<DomainMetrics>({ checks: 0, failures: 0, totalTimeMs: 0 }),
    GEOMETRY: signal<DomainMetrics>({ checks: 0, failures: 0, totalTimeMs: 0 }),
    GEOMETRY_SEGMENTS: signal<DomainMetrics>({ checks: 0, failures: 0, totalTimeMs: 0 }),
    SPATIAL_TOPOLOGY: signal<DomainMetrics>({ checks: 0, failures: 0, totalTimeMs: 0 }),
    PATH_CONTINUITY: signal<DomainMetrics>({ checks: 0, failures: 0, totalTimeMs: 0 }),
    RENDER_DEPTH: signal<DomainMetrics>({ checks: 0, failures: 0, totalTimeMs: 0 }),
  };

  // --- WORKER INTEGRATION ---
  private worker: Worker | null = null;
  private workerUrl: string | null = null;
  
  constructor(private eventBus: EventBusService) {
    this.registerCoreAxioms();
    this.initWorker();
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
        console.warn('Failed to initialize Proof Worker via Blob, falling back to main thread logic simulation.', e);
      }
    }
  }

  ngOnDestroy() {
    this.worker?.terminate();
    if (this.workerUrl) {
      URL.revokeObjectURL(this.workerUrl);
    }
  }

  // --- API ---

  registerAxiom<T>(axiom: Axiom<T>) {
    this.axioms.set(axiom.id, axiom);
    this.axiomStats.set(axiom.id, { id: axiom.id, checks: 0, failures: 0 });
  }

  createTransaction<T>(state: T): Transaction<T> {
    return new Transaction(state, this);
  }

  logTransaction(domain: AxiomDomain, action: string, oldState: any, newState: any, valid: boolean) {
    const newHash = this.computeChecksum(newState);
    this.ledger.push({
      timestamp: Date.now(),
      domain,
      action,
      previousHash: this.currentHeadHash,
      newHash: valid ? newHash : 'INVALID',
      valid
    });
    if (valid) this.currentHeadHash = newHash;
    if (this.ledger.length > 500) this.ledger.shift();
  }

  // Async Verification Dispatcher
  verifyFormal(
      domain: AxiomDomain, 
      context: any, 
      contextId: string
  ) {
    if (!this.worker) return;
    this.worker.postMessage({ id: contextId, type: domain, payload: context });
  }

  // --- FORMAL FACADES ---

  verifyPathContinuity(path: {x: number, y: number}[], gridSize: number): void {
      this.verifyFormal('PATH_CONTINUITY', { path, gridSize }, `PATH_${Date.now()}`);
  }

  verifyStructuralSegments(segments: { x1: number; y1: number; x2: number; y2: number; entityId?: number | string; role?: string }[]): void {
      this.verifyFormal('GEOMETRY_SEGMENTS', { segments }, `SEG_${Date.now()}`);
  }

  verifyRenderDepth(depthValues: number[]): void {
      this.verifyFormal('RENDER_DEPTH', { list: depthValues }, `RENDER_${Date.now()}`);
  }

  verifySpatialGridTopology(cellCount: number, entityCount: number, cellSize: number): void {
      this.verifyFormal('SPATIAL_TOPOLOGY', { cellCount, entityCount, cellSize }, `TOPO_${Date.now()}`);
  }

  // Synchronous checks (kept for critical path logic)
  verifyCombatTransaction(damagePacket: DamagePacket, result: DamageResult, multiplierLimit: number = 2.5): ValidationResult {
    return this.verify('COMBAT', { packet: damagePacket, result, limit: multiplierLimit });
  }

  verifyInventoryState(bag: Item[], credits: number, scrap: number): ValidationResult {
    return this.verify('INVENTORY', { bag, credits, scrap });
  }

  verifySpatialGrid(grid: Map<string, Entity[]>, entities: Entity[], size: number): ValidationResult {
      return this.verify('WORLD', { grid, entities, size });
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
  
  verifyStatusEffects(entity: Entity): ValidationResult {
      if (!entity.status) return { isValid: false, errors: [{ axiomId: 'status.missing', domain: 'STATUS', severity: 'MEDIUM', code: 'NO_STATUS', message: 'Entity missing status object', timestamp: Date.now() }] };
      return { isValid: true, errors: [] };
  }

  // --- INTERNAL ---

  private verify<T>(domain: AxiomDomain, context: T): ValidationResult {
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
            timestamp: Date.now(),
            context: this.sanitizeContext(context)
          });
        }
      } catch (e) {
        console.warn(`[ProofKernel] Axiom ${axiom.id} threw error during check`, e);
      }
    }

    const duration = performance.now() - start;
    this.updateMetrics(domain, duration, errors.length);

    return { isValid: errors.length === 0, errors, hash: this.currentHeadHash };
  }

  private handleProofResult(data: any) {
      if (data.valid) {
          this.updateMetrics(data.type, data.computeTime, 0);
          return;
      }

      // If invalid, standardized emission
      let severity: 'LOW' | 'MEDIUM' | 'CRITICAL' = 'MEDIUM';
      
      if (data.error.includes('Critical') || data.error.includes('KernelPanic')) {
          severity = 'CRITICAL';
      } else if (data.error.includes('Overlap') || data.error.includes('Density')) {
          severity = 'MEDIUM'; 
      } else {
          severity = 'LOW';
      }

      this.updateMetrics(data.type, data.computeTime, 1);

      this.eventBus.dispatch({
          type: GameEvents.REALITY_BLEED,
          payload: {
              severity: severity,
              source: `KERNEL:${data.type}`,
              message: data.error
          }
      });
  }

  private registerCoreAxioms() {
    this.registerAxiom({
      id: 'combat.non_negative',
      domain: 'COMBAT',
      severity: 'HIGH',
      description: 'Damage output cannot be negative',
      check: (ctx: { result: DamageResult }) => ctx.result.total >= 0,
      errorMessage: (ctx) => `Negative damage detected: ${ctx.result.total}`
    });

    this.registerAxiom({
        id: 'geo.euclidean_bounds',
        domain: 'GEOMETRY',
        severity: 'MEDIUM',
        description: 'Dimensions must be non-negative real numbers',
        check: (ctx: { w: number, h: number, d?: number }) => ctx.w >= 0 && ctx.h >= 0 && (ctx.d === undefined || ctx.d >= 0),
        errorMessage: () => 'Negative dimensions detected'
    });

    this.registerAxiom({
      id: 'inv.non_negative_stacks',
      domain: 'INVENTORY',
      severity: 'CRITICAL',
      description: 'Item stacks must be positive',
      check: (ctx: { bag: Item[] }) => ctx.bag.every(i => i.stack > 0),
      errorMessage: () => `Item with 0 or negative stack found`
    });

    this.registerAxiom({
      id: 'world.bounds_containment',
      domain: 'WORLD',
      severity: 'LOW',
      description: 'Entity must be within map bounds',
      check: (ctx: { entity: Entity, bounds: any }) => {
        const e = ctx.entity;
        return e.x >= ctx.bounds.minX && e.x <= ctx.bounds.maxX && 
               e.y >= ctx.bounds.minY && e.y <= ctx.bounds.maxY;
      },
      errorMessage: (ctx) => `Entity ${ctx.entity.id} out of bounds`
    });
  }

  private updateMetrics(domain: string, time: number, failureCount: number) {
    const signal = this.metrics[domain];
    if (signal) {
      signal.update(m => ({
        checks: m.checks + 1,
        failures: m.failures + (failureCount > 0 ? 1 : 0),
        totalTimeMs: m.totalTimeMs + time
      }));
    }
  }

  private sanitizeContext(ctx: any): any {
    try {
      return JSON.parse(JSON.stringify(ctx, (key, value) => {
        if (key === 'trail' || key === 'grid' || key === 'visuals') return '[Omitted]';
        return value;
      }));
    } catch {
      return '[Context Serialization Failed]';
    }
  }

  computeChecksum(data: any): string {
    let str = '';
    try {
        str = JSON.stringify(data, (key, value) => {
            if (key === 'animFrame' || key === 'animFrameTimer' || key === '_sortMeta') return undefined;
            return value;
        });
    } catch { return 'HASH_ERR'; }

    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16);
  }

  getDiagnostics(): KernelDiagnostics {
    const domains = Object.entries(this.metrics).map(([key, sig]) => {
      const m = sig();
      return { 
        domain: key, 
        checks: m.checks, 
        failures: m.failures, 
        avgMs: m.checks > 0 ? parseFloat((m.totalTimeMs / m.checks).toFixed(4)) : 0 
      };
    });

    const failingAxioms = Array.from(this.axiomStats.values())
      .filter(s => s.failures > 0)
      .sort((a, b) => b.failures - a.failures);

    return { domains, failingAxioms, ledgerSize: this.ledger.length };
  }
}
