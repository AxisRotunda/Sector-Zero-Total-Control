
// Fix: Add ambient declarations for test runner globals (describe, it, expect, beforeEach)
// which are missing in the current build environment's type definitions.
declare var describe: any;
declare var beforeEach: any;
declare var it: any;
declare var expect: any;

import { TestBed } from '@angular/core/testing';
import { LeanBridgeService, LeanRect, LeanCombatState, LeanCombatInput } from './lean-bridge.service';

describe('LeanBridgeService (Formal Verification Harness)', () => {
  let service: LeanBridgeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LeanBridgeService);
  });

  describe('Geometry Domain (proveGeometryValidity)', () => {
    it('should validate disjoint rectangles', () => {
      const walls: LeanRect[] = [
        { id: 1, x: 0, y: 0, w: 10, h: 10 },
        { id: 2, x: 20, y: 0, w: 10, h: 10 }
      ];
      const proof = service.proveGeometryValidity(walls);
      expect(proof.valid).toBeTrue();
    });

    it('should reject overlapping rectangles', () => {
      const walls: LeanRect[] = [
        { id: 1, x: 0, y: 0, w: 10, h: 10 },
        { id: 2, x: 5, y: 5, w: 10, h: 10 } // Overlaps
      ];
      const proof = service.proveGeometryValidity(walls);
      expect(proof.valid).toBeFalse();
      expect(proof.reason).toContain('Intersection');
    });

    it('should allow touching edges', () => {
      const walls: LeanRect[] = [
        { id: 1, x: 0, y: 0, w: 10, h: 10 },
        { id: 2, x: 10, y: 0, w: 10, h: 10 } // Touches at x=10
      ];
      const proof = service.proveGeometryValidity(walls);
      expect(proof.valid).toBeTrue();
    });
  });

  describe('Combat Domain (proveCombatStep)', () => {
    it('should validate correct damage application', () => {
      const prev: LeanCombatState = { hp: 100, max_hp: 100, armor: 0 };
      const input: LeanCombatInput = { damage: 10, penetration: 0 };
      const next: LeanCombatState = { hp: 90, max_hp: 100, armor: 0 };
      
      const proof = service.proveCombatStep(prev, input, next);
      expect(proof.valid).toBeTrue();
    });

    it('should reject HP increase (Entropy Violation)', () => {
      const prev: LeanCombatState = { hp: 100, max_hp: 100, armor: 0 };
      const input: LeanCombatInput = { damage: 10, penetration: 0 };
      const next: LeanCombatState = { hp: 110, max_hp: 100, armor: 0 };
      
      const proof = service.proveCombatStep(prev, input, next);
      expect(proof.valid).toBeFalse();
    });

    it('should validate armor mitigation', () => {
      // 10 damage - 5 armor = 5 actual damage. 100 - 5 = 95.
      const prev: LeanCombatState = { hp: 100, max_hp: 100, armor: 5 };
      const input: LeanCombatInput = { damage: 10, penetration: 0 };
      const next: LeanCombatState = { hp: 95, max_hp: 100, armor: 5 };
      
      const proof = service.proveCombatStep(prev, input, next);
      expect(proof.valid).toBeTrue();
    });

    it('should reject incorrect arithmetic', () => {
      const prev: LeanCombatState = { hp: 100, max_hp: 100, armor: 0 };
      const input: LeanCombatInput = { damage: 10, penetration: 0 };
      const next: LeanCombatState = { hp: 80, max_hp: 100, armor: 0 }; // Should be 90
      
      const proof = service.proveCombatStep(prev, input, next);
      expect(proof.valid).toBeFalse();
    });
  });
});