
import { Injectable, inject } from '@angular/core';
import { SpatialGridService } from '../systems/spatial-grid.service';
import { WorldGeneratorService } from '../game/world/world-generator.service';
import { InventoryService } from '../game/inventory.service';
import { WorldService } from '../game/world/world.service';

interface CorrectionAction {
  type: string;
  action: () => void;
  cooldown: number; // Minimum ms between corrections
  lastRun: number;
}

@Injectable({ providedIn: 'root' })
export class RealityCorrectorService {
  private spatialGrid = inject(SpatialGridService);
  private worldGen = inject(WorldGeneratorService);
  private inventory = inject(InventoryService);
  private world = inject(WorldService);

  private corrections = new Map<string, CorrectionAction>();
  private correctionHistory: { timestamp: number; context: string; action: string }[] = [];

  constructor() {
    this.initializeCorrections();
  }

  private initializeCorrections(): void {
    // Spatial Grid Corrections
    this.corrections.set('SPATIAL', {
      type: 'SPATIAL',
      action: () => this.correctSpatialGrid(),
      cooldown: 5000, 
      lastRun: 0
    });

    // Render/Budget Violations
    this.corrections.set('RENDER', {
      type: 'RENDER',
      action: () => this.correctRenderOverload(),
      cooldown: 2000,
      lastRun: 0
    });

    // World Generation Failures
    this.corrections.set('WORLD_GEN', {
      type: 'WORLD_GEN',
      action: () => this.correctWorldGeneration(),
      cooldown: 10000,
      lastRun: 0
    });

    // Inventory Violations
    this.corrections.set('INVENTORY', {
      type: 'INVENTORY',
      action: () => this.correctInventoryState(),
      cooldown: 3000,
      lastRun: 0
    });

    // Combat Violations
    this.corrections.set('COMBAT', {
      type: 'COMBAT',
      action: () => this.correctCombatState(),
      cooldown: 1000,
      lastRun: 0
    });
  }

  // Public Trigger called by KernelSupervisor
  public triggerCorrection(type: string) {
      const correction = this.corrections.get(type);
      if (correction) {
          const now = performance.now();
          if (now - correction.lastRun > correction.cooldown) {
              console.warn(`[REALITY CORRECTOR] Executing fix: ${type}`);
              correction.action();
              correction.lastRun = now;
              this.correctionHistory.push({
                  timestamp: now,
                  context: 'Supervisor Request',
                  action: type
              });
          }
      }
  }

  // === CORRECTION STRATEGIES ===

  /**
   * SPATIAL: Force rebuild grid and cull distant entities
   */
  private correctSpatialGrid(): void {
    this.spatialGrid.rebuildGrid(this.world.entities);
    // Simple culling
    const player = this.world.player;
    this.world.entities = this.world.entities.filter(e => {
      if (e.type === 'PLAYER' || e.persistenceTag === 'PERSISTENT') return true;
      return Math.hypot(e.x - player.x, e.y - player.y) < 2000;
    });
  }

  private correctRenderOverload(): void {
    // Placeholder for flush caches
  }

  private correctWorldGeneration(): void {
    this.worldGen.reduceEntropy(0.2);
  }

  /**
   * INVENTORY: Lock inventory to prevent further corruption
   */
  private correctInventoryState(): void {
    console.log('[CORRECTOR] Normalizing inventory state...');
    this.inventory.lock();
    setTimeout(() => this.inventory.unlock(), 1500);
  }

  /**
   * COMBAT: Normalize entity HP to valid ranges
   */
  private correctCombatState(): void {
      console.log('[CORRECTOR] Normalizing bio-signals...');
      this.world.entities.forEach(e => {
          if (e.hp > e.maxHp) e.hp = e.maxHp;
          if (e.hp < 0) e.hp = 0;
          if (isNaN(e.hp)) e.hp = 0;
      });
  }

  getStats() {
    return {
      totalCorrections: this.correctionHistory.length,
      recentCorrections: this.correctionHistory.slice(-5),
    };
  }
}
