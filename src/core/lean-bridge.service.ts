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
  x: number; // Mapped to Int
  y: number; // Mapped to Int
  w: number; // Mapped to Nat
  h: number; // Mapped to Nat
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
   * Simulates: `ValidLevel : List Rect -> Bool`
   * Checks for strict non-overlap of static geometry using the Separating Axis Theorem (AABB).
   */
  proveGeometryValidity(walls: LeanRect[]): LeanProofResult {
    const len = walls.length;
    // O(N^2) naive check - acceptable for static initialization phase verification.
    // In a WASM context, this would be optimized, but the logic remains the axiom source.
    for (let i = 0; i < len; i++) {
      const a = walls[i];
      for (let j = i + 1; j < len; j++) {
        const b = walls[j];
        
        // Strict overlap check (Mirroring `intersects` in geometry.lean)
        // Note: Using <= for non-overlap to handle touching edges as valid (non-intersecting)
        const noOverlap = (
          (a.x + a.w <= b.x) ||
          (b.x + b.w <= a.x) ||
          (a.y + a.h <= b.y) ||
          (b.y + b.h <= a.y)
        );

        if (!noOverlap) {
          return { 
            valid: false, 
            reason: `Geometric Axiom Violation: Intersection between Wall #${a.id} and #${b.id}` 
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