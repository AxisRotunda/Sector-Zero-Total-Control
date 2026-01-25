import { Injectable } from '@angular/core';

// --- MIRROR TYPES (Matching .lean definitions) ---

export interface LeanCombatState {
  hp: number; // Mapped to Nat
  max_hp: number; // Mapped to Nat
  armor: number; // Mapped to Nat
}

export interface LeanCombatInput {
  damage: number; // Mapped to Nat
  penetration: number; // Mapped to Nat
}

// 1. Canonical geometry model
export interface LeanRect {
  id: number | string; // Mapped to Nat
  x: number; // left (Int)
  y: number; // bottom (Int)
  w: number; // width (Nat, > 0)
  h: number; // height (Nat, > 0)
}

export interface LeanProofResult {
  valid: boolean;
  reason?: string;
  pair?: [number, number]; // New: Indices of failing pair
}

// Helper functions (Pure, no allocations)
const left   = (r: LeanRect) => r.x;
const right  = (r: LeanRect) => r.x + r.w;
const bottom = (r: LeanRect) => r.y;
const top    = (r: LeanRect) => r.y + r.h;

/**
 * Acts as the FFI (Foreign Function Interface) to the hypothetical Lean/WASM module.
 * Currently runs a "Shadow Mode" implementation using strict TypeScript logic to simulate
 * the formal verification process defined in `src/lean/*.lean`.
 */
@Injectable({
  providedIn: 'root'
})
export class LeanBridgeService {

  constructor() {
    this.runGeometrySelfTest();
  }

  // --- 1. GEOMETRY DOMAIN ---
  // Reference: src/lean/geometry.lean :: ValidLevel

  /**
   * 2. Strict overlap kernel
   * Private overlap predicate.
   * Strict `<` in Lean is implemented via early-return `>=` checks.
   */
  private rectOverlap(a: LeanRect, b: LeanRect): boolean {
    if (a.w <= 0 || a.h <= 0 || b.w <= 0 || b.h <= 0) return false;
    
    // Separation Axis Theorem (simplified for AABB)
    // If they are separated on any axis, they do not overlap.
    if (left(a)   >= right(b))  return false;
    if (left(b)   >= right(a))  return false;
    if (bottom(a) >= top(b))    return false;
    if (bottom(b) >= top(a))    return false;
    
    return true;
  }

  /**
   * Deterministic validity check with minimal allocations.
   * Complexity: O(n^2 / 2)
   */
  private validLevel(rects: readonly LeanRect[]): { ok: boolean; pair?: [number, number] } {
    const n = rects.length;
    for (let i = 0; i < n; i++) {
      const ri = rects[i];
      // Symmetry is exploited by iterating j = i + 1
      for (let j = i + 1; j < n; j++) { 
        const rj = rects[j];
        if (this.rectOverlap(ri, rj)) {
          return { ok: false, pair: [i, j] };
        }
      }
    }
    return { ok: true };
  }

  /**
   * Simulates: `ValidLevel : List Rect -> Bool`
   * Executable Boolean version: validLevelBool(walls) returns true iff no pair of distinct rectangles overlaps.
   */
  proveGeometryValidity(walls: readonly LeanRect[]): LeanProofResult {
    const result = this.validLevel(walls);
    
    if (!result.ok && result.pair) {
        const [i, j] = result.pair;
        const a = walls[i];
        const b = walls[j];
        return {
            valid: false,
            reason: `Geometric Axiom Violation: Intersection detected between Entity ${a.id} and Entity ${b.id}`,
            pair: result.pair
        };
    }

    return { valid: true };
  }

  // --- 4. Mechanistic verification and automation ---
  private runGeometrySelfTest() {
     const cases: { rects: LeanRect[]; expectOk: boolean; name: string }[] = [
       {
         name: "single rect",
         expectOk: true,
         rects: [{ id: 0, x: 0, y: 0, w: 10, h: 10 }],
       },
       {
         name: "overlapping",
         expectOk: false,
         rects: [
           { id: 0, x: 0, y: 0, w: 10, h: 10 },
           { id: 1, x: 5, y: 5, w: 10, h: 10 },
         ],
       },
       {
         name: "touching edge (allowed)",
         expectOk: true,
         rects: [
           { id: 0, x: 0, y: 0, w: 10, h: 10 },
           { id: 1, x: 10, y: 0, w: 10, h: 10 },
         ],
       },
     ];

     for (const c of cases) {
       const r = this.validLevel(c.rects);
       if (r.ok !== c.expectOk) {
         console.warn("[LeanBridge] GeometryKernelSelfTest mismatch", c.name, r);
       }
     }
     // console.log("[LeanBridge] Self-test complete.");
  }

  // --- 2. COMBAT DOMAIN ---
  // Reference: src/lean/combat.lean :: next_state

  /**
   * Simulates: `next_state : State -> Input -> State`
   * Verifies that the transition from prev to next state respects the combat axioms.
   */
  proveCombatStep(prev: LeanCombatState, input: LeanCombatInput, next: LeanCombatState): LeanProofResult {
    // Theorem 1: HP Consistency (Entropy Monotonicity)
    // HP should never exceed MaxHP
    if (next.hp > next.max_hp) {
      return { valid: false, reason: 'Combat Axiom Violation: HP exceeds MaxHP' };
    }

    // Axiom 1: Damage Calculation (Nat Subtraction Saturation)
    // effective_armor := defense.armor - input.penetration
    const effectiveArmor = Math.max(0, prev.armor - input.penetration);
    
    // damage := input.damage - effective_armor
    const expectedDamage = Math.max(0, input.damage - effectiveArmor);
    
    // new_hp := current.hp - damage
    const expectedHp = Math.max(0, prev.hp - expectedDamage);

    // Strict equality check.
    // We allow a minimal epsilon (0.1) solely for JS floating point drift,
    // but semantically this enforces integer-like determinism.
    if (Math.abs(next.hp - expectedHp) > 0.1) {
      return { 
        valid: false, 
        reason: `Combat Axiom Violation: Invalid State Transition. Expected HP ${expectedHp}, Found ${next.hp}` 
      };
    }

    return { valid: true };
  }
}
