
import { Injectable, signal, OnDestroy } from '@angular/core';
import { Entity } from '../../models/game.models';
import { DamageResult, DamagePacket } from '../../models/damage.model';
import { Item } from '../../models/item.models';
import { EventBusService } from '../events/event-bus.service';
import { GameEvents } from '../events/game-events';

// --- TYPES ---

export type AxiomDomain = 'COMBAT' | 'INVENTORY' | 'WORLD' | 'STATUS' | 'RENDER' | 'INTEGRITY' | 'GEOMETRY' | 'GEOMETRY_SEGMENTS' | 'TOPOLOGY';
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

    // Helper: Separating Axis Theorem (1D Projection)
    function overlap(min1, max1, min2, max2) {
        return Math.max(0, Math.min(max1, max2) - Math.max(min1, min2));
    }

    try {
        switch (req.type) {
            case 'COMBAT':
                // Theorem: Conservation of Damage
                // 0 <= damage <= CAP AND new_hp == max(0, old_hp - damage)
                const p = req.payload;
                const cap = 10000;
                
                if (p.damage < 0 || p.damage > cap) {
                    valid = false;
                    error = 'AxiomViolation: Damage Magnitude (' + p.damage + ') outside set [0, ' + cap + ']';
                } else {
                    const rawExpected = p.oldHp - p.damage;
                    // Strict equality with float epsilon
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

            case 'GEOMETRY_OVERLAP':
                // Theorem: Disjoint Rectangles (Separating Axis)
                // Forall A, B in Entities: Intersect(A, B) -> Area(Intersection) < Epsilon
                // Input: list of {x, y, w, h, entityId?, kind?}
                const entities = req.payload.entities;
                valid = true;
                const EPS = 1.0; // Tolerance for flush contact
                
                // O(N^2) check - optimized by semantic filtering
                outer: for (let i = 0; i < entities.length; i++) {
                    const a = entities[i];
                    
                    // Semantic Filter: Skip non-structural entities (decorative items can overlap)
                    // Default to STRUCTURAL if kind is undefined for safety
                    const kindA = a.kind || 'STRUCTURAL';
                    if (kindA !== 'STRUCTURAL') continue;

                    for (let j = i + 1; j < entities.length; j++) {
                        const b = entities[j];
                        
                        const kindB = b.kind || 'STRUCTURAL';
                        if (kindB !== 'STRUCTURAL') continue;
                        
                        const x_overlap = overlap(a.x - a.w/2, a.x + a.w/2, b.x - b.w/2, b.x + b.w/2);
                        const y_overlap = overlap(a.y - a.h/2, a.y + a.h/2, b.y - b.h/2, b.y + b.h/2);
                        
                        if (x_overlap > EPS && y_overlap > EPS) { 
                            valid = false;
                            const idA = a.entityId !== undefined ? a.entityId : i;
                            const idB = b.entityId !== undefined ? b.entityId : j;
                            error = 'AxiomViolation: Euclidean Intersection detected between Entity ' + idA + ' and Entity ' + idB;
                            break outer;
                        }
                    }
                }
                break;

            case 'GEOMETRY_SEGMENTS': {
                const segments = req.payload.segments;
                valid = true;
                const SEG_EPS = 1.0;

                outerSeg: for (let i = 0; i < segments.length; i++) {
                    const a = segments[i];
                    for (let j = i + 1; j < segments.length; j++) {
                    const b = segments[j];

                    const verticalA = Math.abs(a.x1 - a.x2) < SEG_EPS;
                    const verticalB = Math.abs(b.x1 - b.x2) < SEG_EPS;
                    const horizontalA = Math.abs(a.y1 - a.y2) < SEG_EPS;
                    const horizontalB = Math.abs(b.y1 - b.y2) < SEG_EPS;

                    const sameX = verticalA && verticalB && Math.abs(a.x1 - b.x1) < SEG_EPS;
                    const sameY = horizontalA && horizontalB && Math.abs(a.y1 - b.y1) < SEG_EPS;

                    if (!sameX && !sameY) continue; // orthogonal / skew: allowed

                    let aStart, aEnd, bStart, bEnd;
                    if (sameX) {
                        aStart = Math.min(a.y1, a.y2);
                        aEnd   = Math.max(a.y1, a.y2);
                        bStart = Math.min(b.y1, b.y2);
                        bEnd   = Math.max(b.y1, b.y2);
                    } else {
                        aStart = Math.min(a.x1, a.x2);
                        aEnd   = Math.max(a.x1, a.x2);
                        bStart = Math.min(b.x1, b.x2);
                        bEnd   = Math.max(b.x1, b.x2);
                    }

                    const overlapLen = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

                    if (overlapLen > SEG_EPS) {
                        valid = false;
                        const idA = a.entityId !== undefined ? a.entityId : i;
                        const idB = b.entityId !== undefined ? b.entityId : j;
                        error = 'AxiomViolation: Segment Overlap detected between Entity ' + idA + ' and Entity ' + idB;
                        break outerSeg;
                    }
                    }
                }
                break;
            }

            case 'PATH_CONTINUITY':
                // Theorem: Topological Connectivity
                // Forall steps i: Distance(step[i], step[i+1]) <= MaxStride
                const path = req.payload.path;
                const maxStride = req.payload.gridSize * 1.5; // Allow diagonal (sqrt(2)) + epsilon
                valid = true;

                for (let i = 0; i < path.length - 1; i++) {
                    const curr = path[i];
                    const next = path[i+1];
                    const dx = curr.x - next.x;
                    const dy = curr.y - next.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    
                    if (dist > maxStride) {
                        valid = false;
                        error = 'AxiomViolation: Discontinuous Path Manifold at index ' + i + '. Dist: ' + dist.toFixed(2);
                        break;
                    }
                }
                break;

            case 'RENDER_DEPTH':
                // Theorem: Z-Order Monotonicity
                // Forall i < j: Depth(List[i]) <= Depth(List[j])
                const list = req.payload.list;
                valid = true;
                for (let i = 0; i < list.length - 1; i++) {
                    if (list[i] > list[i+1]) {
                        valid = false;
                        error = 'AxiomViolation: Painter Algorithm Failure at index ' + i;
                        break;
                    }
                }
                break;

            default:
                valid = true; // Heuristic pass
        }
    } catch (err) {
        valid = false;
        error = 'KernelPanic: ' + err.message;
    }

    self.postMessage({
        id: req.id,
        valid: valid,
        error: error,
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
        // Optimistic execution with async verification
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
    TOPOLOGY: signal<DomainMetrics>({ checks: 0, failures: 0, totalTimeMs: 0 }),
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

  verifyFormal(domain: AxiomDomain | 'PATH_CONTINUITY' | 'GEOMETRY_OVERLAP' | 'GEOMETRY_SEGMENTS' | 'RENDER_DEPTH', context: any, contextId: string) {
    if (!this.worker) return;
    this.worker.postMessage({ id: contextId, type: domain, payload: context });
  }

  verify<T>(domain: AxiomDomain, context: T): ValidationResult {
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

  // --- FORMAL FACADES ---

  verifyPathContinuity(path: {x: number, y: number}[], gridSize: number): void {
      this.verifyFormal('PATH_CONTINUITY', { path, gridSize }, `PATH_${Date.now()}`);
  }

  verifyGeometryOverlap(entities: {x: number, y: number, w: number, h: number, entityId?: string | number, kind?: string}[]): void {
      this.verifyFormal('GEOMETRY_OVERLAP', { entities }, `GEO_${Date.now()}`);
  }

  verifyStructuralSegments(segments: { x1: number; y1: number; x2: number; y2: number; entityId?: number | string }[]): void {
      this.verifyFormal('GEOMETRY_SEGMENTS', { segments }, `SEG_${Date.now()}`);
  }

  verifyRenderDepth(depthValues: number[]): void {
      this.verifyFormal('RENDER_DEPTH', { list: depthValues }, `RENDER_${Date.now()}`);
  }

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
      const walls = entities.filter(e => e.type === 'WALL');
      for(let i=0; i<Math.min(walls.length, 50); i++) {
          for(let j=i+1; j<Math.min(walls.length, 50); j++) {
              const a = walls[i]; const b = walls[j];
              const dist = Math.hypot(a.x - b.x, a.y - b.y);
              if (dist < 5) return { isValid: false, errors: [{ axiomId: 'geo.heuristic_overlap', domain: 'GEOMETRY', severity: 'HIGH', code: 'OVERLAP', message: `Wall overlap detected ${a.id} vs ${b.id}`, timestamp: Date.now() }] };
          }
      }
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

  private handleProofResult(data: any) {
      if (!data.valid) {
          console.error(`[ProofKernel] FORMAL VERIFICATION FAILED: ${data.error}`);
          this.eventBus.dispatch({
              type: GameEvents.REALITY_BLEED,
              payload: {
                  severity: 'CRITICAL',
                  source: 'WASM_KERNEL',
                  message: `Axiom Collapse detected. Logic divergent. Context: ${data.id}. Error: ${data.error}`
              }
          });
      }
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

  private updateMetrics(domain: AxiomDomain, time: number, failureCount: number) {
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
