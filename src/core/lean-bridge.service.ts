
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
  id: number | string; // Mapped to Nat
  x: number; // left (Int)
  y: number; // bottom (Int)
  w: number; // width (Nat, > 0)
  h: number; // height (Nat, > 0)
}

export interface CombatDetails {
    reason: string;
    expectedHp: number;
    actualHp: number;
}

export interface GeometryDetails {
  sectorId?: string;
  aId?: number | string;
  bId?: number | string;
  source: string;
}

export interface LeanProofResult<T = any> {
  valid: boolean;
  reason?: string;
  details?: T;
}

// Helper functions (Pure, no allocations)
const left   = (r: LeanRect) => r.x;
const right  = (r: LeanRect) => r.x + r.w;
const bottom = (r: LeanRect) => r.y;
const top    = (r: LeanRect) => r.y + r.h;

@Injectable({
  providedIn: 'root'
})
export class LeanBridgeService {

  constructor() {
    // Self-test on init to verify kernel integrity
    this.runGeometrySelfTest();
  }

  // --- 1. GEOMETRY KERNEL ---

  /**
   * Internal shared implementation.
   * Separation Axis Theorem (simplified for AABB).
   */
  private rectOverlap(a: LeanRect, b: LeanRect): boolean {
    if (a.w <= 0 || a.h <= 0 || b.w <= 0 || b.h <= 0) return false;
    
    // Strict inequality check (touching edges allowed)
    if (left(a)   >= right(b))  return false;
    if (left(b)   >= right(a))  return false;
    if (bottom(a) >= top(b))    return false;
    if (bottom(b) >= top(a))    return false;
    
    return true;
  }

  /**
   * KERNEL SURFACE: Pure Predicate.
   * O(n^2) canonical check.
   */
  public validLevel(rects: readonly LeanRect[]): boolean {
    const n = rects.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) { 
        if (this.rectOverlap(rects[i], rects[j])) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * KERNEL SURFACE: Explainer.
   * Reuses internal predicate to extract failure details.
   */
  public proveGeometryValidity(rects: readonly LeanRect[], sectorId?: string, source: string = "UNKNOWN"): LeanProofResult<GeometryDetails> {
    const n = rects.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (this.rectOverlap(rects[i], rects[j])) {
           return {
              valid: false,
              reason: "GEOMETRY_OVERLAP",
              details: { 
                  aId: rects[i].id, 
                  bId: rects[j].id, 
                  sectorId, 
                  source 
              }
           };
        }
      }
    }
    
    // Dev Sanity Check
    // In a real build step, this would be stripped, but useful for now.
    // console.assert(this.validLevel(rects) === true, "Kernel Divergence Detected!");
    
    return { valid: true };
  }

  // --- 2. COMBAT KERNEL ---

  /**
   * Internal shared implementation for combat math.
   */
  private computeNextHp(prev: LeanCombatState, input: LeanCombatInput): number {
      const effectiveArmor = Math.max(0, prev.armor - input.penetration);
      // Simple linear mitigation model for kernel check
      // Note: This must match the GAME logic exactly or allow tolerance
      // For this kernel, we verify strict monotonicity and bounds
      const damage = Math.max(0, input.damage - effectiveArmor); // Simplified
      return Math.max(0, prev.hp - input.damage); // We verify against RAW damage mostly for safety
  }

  /**
   * KERNEL SURFACE: Pure Predicate.
   */
  public validCombatStep(prev: LeanCombatState, input: LeanCombatInput, next: LeanCombatState): boolean {
      if (next.hp > next.max_hp) return false; // Entropy Monotonicity violation
      if (next.hp > prev.hp) return false; // Healing not allowed in pure combat step
      
      // Allow floating point tolerance
      // Logic: NewHP should roughly equal OldHP - Damage
      const expectedDiff = prev.hp - next.hp;
      if (Math.abs(expectedDiff - input.damage) > 1.0) return false; // Divergence > 1.0 damage
      
      return true;
  }

  /**
   * KERNEL SURFACE: Explainer.
   */
  public proveCombatStep(prev: LeanCombatState, input: LeanCombatInput, next: LeanCombatState): LeanProofResult<CombatDetails> {
      if (next.hp > next.max_hp) {
          return { valid: false, reason: "HP_EXCEEDS_MAX", details: { reason: "HP > MaxHP", expectedHp: next.max_hp, actualHp: next.hp } };
      }

      // Check approx consistency
      const expectedHp = Math.max(0, prev.hp - input.damage);
      if (Math.abs(next.hp - expectedHp) > 1.0) {
          return {
              valid: false,
              reason: "DAMAGE_MISMATCH",
              details: {
                  reason: "Output HP diverged from Kernel Prediction",
                  expectedHp,
                  actualHp: next.hp
              }
          };
      }

      return { valid: true };
  }

  // --- SELF TEST ---

  public runGeometrySelfTest() {
     const testRects: LeanRect[] = [
       { id: 1, x: 0, y: 0, w: 10, h: 10 },
       { id: 2, x: 5, y: 5, w: 10, h: 10 } // Overlap
     ];
     
     // Expect failure
     const result = this.proveGeometryValidity(testRects, "SELF_TEST", "INIT");
     if (result.valid) {
         console.error("[LeanBridge] CRITICAL: Self-test passed when it should fail.");
         throw new Error("Kernel Integrity Failure");
     }
     
     // Expect success
     const safeRects: LeanRect[] = [
         { id: 1, x: 0, y: 0, w: 10, h: 10 },
         { id: 2, x: 20, y: 20, w: 10, h: 10 }
     ];
     if (!this.validLevel(safeRects)) {
         console.error("[LeanBridge] CRITICAL: Self-test failed valid input.");
         throw new Error("Kernel Integrity Failure");
     }
     
     // console.log("[LeanBridge] Kernel Self-Test OK.");
  }
}
