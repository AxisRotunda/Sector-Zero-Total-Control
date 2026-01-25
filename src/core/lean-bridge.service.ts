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

export interface LeanRect {
  id: number | string; // Mapped to Nat (logic handles string IDs via hash or equivalence)
  x: number; // Mapped to Int (left)
  y: number; // Mapped to Int (bottom)
  w: number; // Mapped to Nat (width)
  h: number; // Mapped to Nat (height)
}

export interface LeanProofResult {
  valid: boolean;
  reason?: string;
}

/**
 * Acts as the FFI (Foreign Function Interface) to the hypothetical Lean/WASM module.
 * Currently runs a "Shadow Mode" implementation using strict TypeScript logic to simulate
 * the formal verification process defined in `src/lean/*.lean`.
 */
@Injectable({
  providedIn: 'root'
})
export class LeanBridgeService {

  // --- 1. GEOMETRY DOMAIN ---
  // Reference: src/lean/geometry.lean :: ValidLevel

  /**
   * Logical model (Lean):
   * rectOverlap(a, b) holds iff:
   * a.w > 0 ∧ a.h > 0 ∧ b.w > 0 ∧ b.h > 0 (non-degenerate rectangles) and
   * a.left < b.right ∧ b.left < a.right (intervals overlap on X) and
   * a.bottom < b.top ∧ b.bottom < a.top (intervals overlap on Y).
   * 
   * Derived helpers:
   * left(r) = r.x
   * right(r) = r.x + r.w
   * bottom(r) = r.y
   * top(r) = r.y + r.h
   */
  private rectOverlap(a: LeanRect, b: LeanRect): boolean {
    const wpos = a.w > 0 && b.w > 0;
    const hpos = a.h > 0 && b.h > 0;
    
    const xInt = a.x < (b.x + b.w) && b.x < (a.x + a.w);
    const yInt = a.y < (b.y + b.h) && b.y < (a.y + a.h);
    
    return wpos && hpos && xInt && yInt;
  }

  /**
   * Simulates: `ValidLevel : List Rect -> Bool`
   * Executable Boolean version: validLevelBool(walls) returns true iff no pair of distinct rectangles overlaps.
   * This is O(n^2) and deterministic; it is the intended "kernel-level" check.
   */
  proveGeometryValidity(walls: LeanRect[]): LeanProofResult {
    const n = walls.length;
    for (let i = 0; i < n; i++) {
        const ri = walls[i];
        for (let j = 0; j < n; j++) {
            if (i === j) continue; // i ≠ j
            const rj = walls[j];
            
            if (this.rectOverlap(ri, rj)) {
                return { 
                    valid: false, 
                    reason: `Geometric Axiom Violation: Intersection detected between Entity ${ri.id} and Entity ${rj.id}` 
                };
            }
        }
    }
    return { valid: true };
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