
import { Injectable, signal, computed } from '@angular/core';
import { Entity } from '../../models/game.models';
import { DamageResult, DamagePacket } from '../../models/damage.model';
import { Item } from '../../models/item.models';

// --- TYPES ---

export type AxiomDomain = 'COMBAT' | 'INVENTORY' | 'WORLD' | 'STATUS' | 'RENDER';
export type AxiomSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Axiom<T = any> {
  id: string;
  domain: AxiomDomain;
  description: string;
  severity: AxiomSeverity;
  /** Returns true if valid, false if violation */
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
}

export interface DomainMetrics {
  checks: number;
  failures: number;
  totalTimeMs: number;
}

// --- TRANSACTION HELPER ---

export class Transaction<T> {
  private snapshot: T;

  constructor(private state: T) {
    this.snapshot = structuredClone(state);
  }

  /**
   * Executes a mutation on a clone of the state. 
   * If validation passes, returns { success: true, newState }.
   * If validation fails, returns { success: false, errors } and leaves original state untouched.
   */
  attempt(
    mutator: (draft: T) => void, 
    validator: (draft: T) => ValidationResult
  ): { success: boolean; newState: T | null; errors: ProofError[] } {
    try {
      const draft = structuredClone(this.snapshot);
      mutator(draft);
      
      const result = validator(draft);
      
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
          domain: 'WORLD', // Default
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
export class ProofKernelService {
  
  // --- STATE ---
  private axioms = new Map<string, Axiom>();
  
  private metrics = {
    COMBAT: signal<DomainMetrics>({ checks: 0, failures: 0, totalTimeMs: 0 }),
    INVENTORY: signal<DomainMetrics>({ checks: 0, failures: 0, totalTimeMs: 0 }),
    WORLD: signal<DomainMetrics>({ checks: 0, failures: 0, totalTimeMs: 0 }),
    STATUS: signal<DomainMetrics>({ checks: 0, failures: 0, totalTimeMs: 0 }),
    RENDER: signal<DomainMetrics>({ checks: 0, failures: 0, totalTimeMs: 0 }),
  };

  constructor() {
    this.registerCoreAxioms();
  }

  // --- API ---

  registerAxiom<T>(axiom: Axiom<T>) {
    this.axioms.set(axiom.id, axiom);
  }

  createTransaction<T>(state: T): Transaction<T> {
    return new Transaction(state);
  }

  /**
   * Runs all registered axioms for a specific domain against the provided context.
   */
  verify<T>(domain: AxiomDomain, context: T): ValidationResult {
    const start = performance.now();
    const errors: ProofError[] = [];
    
    // Filter axioms by domain (Optimization: In a real ECS, we'd have separate lists)
    for (const axiom of this.axioms.values()) {
      if (axiom.domain !== domain) continue;

      try {
        if (!axiom.check(context)) {
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

    // Update Metrics
    const duration = performance.now() - start;
    this.updateMetrics(domain, duration, errors.length);

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // --- SPECIFIC VERIFICATION HELPERS (Facades) ---

  verifyCombatTransaction(damagePacket: DamagePacket, result: DamageResult, multiplierLimit: number = 2.5): ValidationResult {
    return this.verify('COMBAT', { packet: damagePacket, result, limit: multiplierLimit });
  }

  verifyInventoryState(bag: Item[], credits: number, scrap: number): ValidationResult {
    return this.verify('INVENTORY', { bag, credits, scrap });
  }

  verifyEntityBounds(entity: Entity, bounds: { minX: number, maxX: number, minY: number, maxY: number }): ValidationResult {
    return this.verify('WORLD', { entity, bounds });
  }

  // --- INTERNAL ---

  private registerCoreAxioms() {
    // 1. COMBAT AXIOMS
    this.registerAxiom({
      id: 'combat.non_negative',
      domain: 'COMBAT',
      severity: 'HIGH',
      description: 'Damage output cannot be negative',
      check: (ctx: { result: DamageResult }) => ctx.result.total >= 0,
      errorMessage: (ctx) => `Negative damage detected: ${ctx.result.total}`
    });

    this.registerAxiom({
      id: 'combat.entropy_limit',
      domain: 'COMBAT',
      severity: 'MEDIUM',
      description: 'Output cannot exceed theoretical maximum',
      check: (ctx: { packet: DamagePacket, result: DamageResult, limit: number }) => {
        const rawInput = ctx.packet.physical + ctx.packet.fire + ctx.packet.cold + ctx.packet.lightning + ctx.packet.chaos;
        // Allow a small buffer constant (+50) for flat bonuses
        return ctx.result.total <= (rawInput * ctx.limit) + 50;
      },
      errorMessage: (ctx) => `Entropy Violation: Output ${ctx.result.total} exceeds limit for input`
    });

    // 2. INVENTORY AXIOMS
    this.registerAxiom({
      id: 'inv.non_negative_stacks',
      domain: 'INVENTORY',
      severity: 'CRITICAL',
      description: 'Item stacks must be positive',
      check: (ctx: { bag: Item[] }) => ctx.bag.every(i => i.stack > 0),
      errorMessage: () => `Item with 0 or negative stack found`
    });

    this.registerAxiom({
      id: 'inv.currency_integrity',
      domain: 'INVENTORY',
      severity: 'HIGH',
      description: 'Currencies must be non-negative',
      check: (ctx: { credits: number, scrap: number }) => ctx.credits >= 0 && ctx.scrap >= 0,
      errorMessage: (ctx) => `Invalid currency state: CR=${ctx.credits}, SCRAP=${ctx.scrap}`
    });

    // 3. WORLD AXIOMS
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
      errorMessage: (ctx) => `Entity ${ctx.entity.id} out of bounds: (${ctx.entity.x.toFixed(0)}, ${ctx.entity.y.toFixed(0)})`
    });
  }

  private updateMetrics(domain: AxiomDomain, time: number, failureCount: number) {
    // Safe signal update
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
    // Return a lightweight version of context for logging to avoid circular structures
    try {
      // Simple shallow copy or specific field extraction could go here
      return JSON.parse(JSON.stringify(ctx, (key, value) => {
        if (key === 'trail' || key === 'grid') return '[Omitted]';
        return value;
      }));
    } catch {
      return '[Context Serialization Failed]';
    }
  }

  // --- CHECKSUM UTILITY ---
  computeChecksum(data: any): string {
    let hash = 0;
    const str = JSON.stringify(data);
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; 
    }
    return (hash >>> 0).toString(16);
  }
  
  // Legacy stubs for compatibility during refactor
  verifyConnectivity(entities: Entity[], bounds: any, start: any): ValidationResult {
      return { isValid: true, errors: [] };
  }
  
  verifyNonOverlap(entities: Entity[]): ValidationResult {
      return { isValid: true, errors: [] };
  }
  
  verifyDialogueState(node: any, fn: any): ValidationResult {
      return { isValid: true, errors: [] };
  }
  
  verifyStatusEffects(entity: Entity): ValidationResult {
      return { isValid: true, errors: [] };
  }
  
  verifySpatialGrid(grid: any, entities: any, size: number): ValidationResult {
      return { isValid: true, errors: [] };
  }
}
