
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

export interface GeometryDetails {
  sectorId?: string;
  aId?: number | string;
  bId?: number | string;
  i?: number;
  j?: number;
  source: "SELFTEST" | "SECTOR_LOAD" | "WORLD_GEN" | "CI_SCAN";
}

export interface LeanProofResult {
  valid: boolean;
  reason?: "GEOMETRY_OVERLAP" | "GEOMETRY_SELFTEST_FAIL" | string;
  details?: GeometryDetails;
}

interface LeanTestCase {
  name: string;
  reason: string;
  rects: LeanRect[];
  expectOk: boolean;
}

// Helper functions (Pure, no allocations)
const left   = (r: LeanRect) => r.x;
const right  = (r: LeanRect) => r.x + r.w;
const bottom = (r: LeanRect) => r.y;
const top    = (r: LeanRect) => r.y + r.h;

const GEOMETRY_CORPUS: LeanTestCase[] = [
   {
     name: "single rect",
     reason: "A single rectangle cannot overlap itself",
     expectOk: true,
     rects: [{ id: 'test1', x: 0, y: 0, w: 10, h: 10 }],
   },
   {
     name: "identical overlapping",
     reason: "Two identical rectangles occupy the same space",
     expectOk: false,
     rects: [
       { id: 'a', x: 0, y: 0, w: 10, h: 10 },
       { id: 'b', x: 0, y: 0, w: 10, h: 10 },
     ],
   },
   {
     name: "touching edge (allowed)",
     reason: "Shared edges are valid (strict inequality check)",
     expectOk: true,
     rects: [
       { id: 'a', x: 0, y: 0, w: 10, h: 10 },
       { id: 'b', x: 10, y: 0, w: 10, h: 10 },
     ],
   },
   {
     name: "nested",
     reason: "One rectangle completely inside another is an overlap",
     expectOk: false,
     rects: [
       { id: 'outer', x: 0, y: 0, w: 20, h: 20 },
       { id: 'inner', x: 5, y: 5, w: 10, h: 10 },
     ],
   },
   {
     name: "zero-dimension (ignored)",
     reason: "Zero width/height rects are ghost entities",
     expectOk: true,
     rects: [
       { id: 'valid', x: 0, y: 0, w: 10, h: 10 },
       { id: 'ghost', x: 5, y: 5, w: 0, h: 0 },
     ],
   }
];

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
    // 4. Minimal formal linkage: Self-test on init
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
    // "zero-width/height walls (must be ignored)"
    if (a.w <= 0 || a.h <= 0 || b.w <= 0 || b.h <= 0) return false;
    
    // Separation Axis Theorem (simplified for AABB)
    // If they are separated on any axis, they do not overlap.
    // Touching edges are allowed (strictly separated or touching).
    if (left(a)   >= right(b))  return false;
    if (left(b)   >= right(a))  return false;
    if (bottom(a) >= top(b))    return false;
    if (bottom(b) >= top(a))    return false;
    
    return true;
  }

  /**
   * Canonical geometry function: pure, deterministic, boolean.
   * "Implement one canonical function validLevel(rects: LeanRect[]): boolean"
   */
  public validLevel(rects: readonly LeanRect[]): boolean {
    const n = rects.length;
    for (let i = 0; i < n; i++) {
      const ri = rects[i];
      // Symmetry is exploited by iterating j = i + 1
      for (let j = i + 1; j < n; j++) { 
        if (this.rectOverlap(ri, rects[j])) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Generates detailed proof result.
   * Used when we need to know *why* it failed (the Pair).
   */
  public proveGeometryValidity(rects: readonly LeanRect[], sectorId?: string, source: GeometryDetails["source"] = "WORLD_GEN"): LeanProofResult {
    const n = rects.length;
    
    // We duplicate the loop here to extract the offending pair efficiently without allocating a closure/object in the boolean check
    for (let i = 0; i < n; i++) {
      const ri = rects[i];
      for (let j = i + 1; j < n; j++) {
        const rj = rects[j];
        if (this.rectOverlap(ri, rj)) {
           return {
              valid: false,
              reason: "GEOMETRY_OVERLAP",
              details: { 
                  i, j, 
                  aId: ri.id, 
                  bId: rj.id, 
                  sectorId, 
                  source 
              }
           };
        }
      }
    }
    
    return { valid: true };
  }

  // --- 4. Mechanistic verification and automation ---
  
  private lcg(seed: number) {
    let s = seed;
    return () => {
      s = Math.imul(1664525, s) + 1013904223;
      s = s >>> 0;
      return s / 4294967296;
    }
  }

  private generateFuzzCases(count: number, seed: number): LeanTestCase[] {
    const rng = this.lcg(seed);
    const cases: LeanTestCase[] = [];

    for (let i = 0; i < count; i++) {
        // Generate random disjoint rects (simplified grid approach to ensure no overlap)
        const rects: LeanRect[] = [];
        const gridSize = 50;
        const mapSize = 5; // 5x5 grid
        
        for (let x = 0; x < mapSize; x++) {
            for (let y = 0; y < mapSize; y++) {
                if (rng() > 0.7) continue; // Skip some cells
                rects.push({
                    id: `fuzz_${i}_${x}_${y}`,
                    x: x * gridSize + 5,
                    y: y * gridSize + 5,
                    w: gridSize - 10,
                    h: gridSize - 10
                });
            }
        }

        // 50% chance to inject a failure
        let expectOk = true;
        let reason = "Generated disjoint grid";
        
        if (rects.length > 2 && rng() > 0.5) {
            // Inject overlap
            const target = rects[0];
            const overlapRect = {
                id: 'fuzz_overlap',
                x: target.x + 5,
                y: target.y + 5,
                w: 10, 
                h: 10
            };
            rects.push(overlapRect);
            expectOk = false;
            reason = "Injected deliberate overlap";
        }

        cases.push({
            name: `fuzz_case_${i}`,
            reason,
            rects,
            expectOk
        });
    }
    return cases;
  }

  public runGeometrySelfTest() {
     const fuzzCases = this.generateFuzzCases(32, 0xC0FFEE);
     let passed = 0;
     const allCases = [...GEOMETRY_CORPUS, ...fuzzCases];

     for (const c of allCases) {
       // Use canonical function for self-test
       const ok = this.validLevel(c.rects);
       if (ok !== c.expectOk) {
         console.error(`[LeanBridge] SELF-TEST FAILED: ${c.name} (${c.reason}). Expected ${c.expectOk} got ${ok}`);
       } else {
         passed++;
       }
     }
     
     if (passed === allCases.length) {
        // console.log(`[LeanBridge] Kernel Integrity Verified (${passed}/${allCases.length} axioms held)`);
     }
  }

  // --- 2. COMBAT DOMAIN ---
  // Reference: src/lean/combat.lean :: next_state

  proveCombatStep(prev: LeanCombatState, input: LeanCombatInput, next: LeanCombatState): LeanProofResult {
    // Theorem 1: HP Consistency (Entropy Monotonicity)
    if (next.hp > next.max_hp) {
      return { valid: false, reason: 'Combat Axiom Violation: HP exceeds MaxHP' };
    }

    // Axiom 1: Damage Calculation (Nat Subtraction Saturation)
    const effectiveArmor = Math.max(0, prev.armor - input.penetration);
    const expectedDamage = Math.max(0, input.damage - effectiveArmor);
    const expectedHp = Math.max(0, prev.hp - expectedDamage);

    if (Math.abs(next.hp - expectedHp) > 0.1) {
      return { 
        valid: false, 
        reason: `Combat Axiom Violation: Invalid State Transition. Expected HP ${expectedHp}, Found ${next.hp}` 
      };
    }

    return { valid: true };
  }
}
