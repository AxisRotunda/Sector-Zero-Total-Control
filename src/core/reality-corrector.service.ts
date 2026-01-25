
import { Injectable, inject } from '@angular/core';
import { EventBusService } from './events/event-bus.service';
import { GameEvents, RealityBleedPayload } from './events/game-events';
import { SpatialGridService } from '../systems/spatial-grid.service';
import { CullingService } from '../systems/rendering/culling.service';
import { WorldGeneratorService } from '../game/world/world-generator.service';
import { InventoryService } from '../game/inventory.service';
import { WorldService } from '../game/world/world.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PerformanceManagerService } from '../game/performance-manager.service';

interface CorrectionAction {
  type: string;
  action: () => void;
  cooldown: number; // Minimum ms between corrections
  lastRun: number;
}

@Injectable({ providedIn: 'root' })
export class RealityCorrectorService {
  private eventBus = inject(EventBusService);
  private spatialGrid = inject(SpatialGridService);
  private culling = inject(CullingService);
  private worldGen = inject(WorldGeneratorService);
  private inventory = inject(InventoryService);
  private world = inject(WorldService);
  private perf = inject(PerformanceManagerService);

  private corrections = new Map<string, CorrectionAction>();
  private correctionHistory: { timestamp: number; context: string; action: string }[] = [];

  constructor() {
    this.initializeCorrections();
    this.subscribeToBleedEvents();
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
  }

  private subscribeToBleedEvents(): void {
    this.eventBus.on(GameEvents.REALITY_BLEED)
      .pipe(takeUntilDestroyed())
      .subscribe((payload: RealityBleedPayload) => {
        this.handleBleedEvent(payload);
      });
  }

  private handleBleedEvent(payload: RealityBleedPayload): void {
    const source = payload.source.toUpperCase();
    
    // Fuzzy match source to correction type
    let matchedKey = '';
    if (source.includes('SPATIAL') || source.includes('GRID')) matchedKey = 'SPATIAL';
    else if (source.includes('RENDER') || source.includes('CULL')) matchedKey = 'RENDER';
    else if (source.includes('INVENTORY') || source.includes('ITEM')) matchedKey = 'INVENTORY';
    else if (source.includes('WORLD') || source.includes('GEN')) matchedKey = 'WORLD_GEN';

    const correction = this.corrections.get(matchedKey);

    if (correction) {
      const now = performance.now();
      const timeSinceLastRun = now - correction.lastRun;

      if (timeSinceLastRun > correction.cooldown) {
        console.warn(`[REALITY CORRECTOR] Applying fix for: ${payload.source}`);
        correction.action();
        correction.lastRun = now;

        this.correctionHistory.push({
          timestamp: now,
          context: payload.message,
          action: correction.type
        });

        // Trim history
        if (this.correctionHistory.length > 20) {
          this.correctionHistory.shift();
        }
      }
    }
  }

  // === CORRECTION STRATEGIES ===

  /**
   * SPATIAL: Force rebuild grid and cull distant entities
   */
  private correctSpatialGrid(): void {
    // Force immediate full rebuild
    this.spatialGrid.rebuildGrid(this.world.entities);

    // Aggressive culling: Remove entities > 1500px from player to reduce load
    const player = this.world.player;
    const initialCount = this.world.entities.length;
    
    this.world.entities = this.world.entities.filter(e => {
      if (e.type === 'PLAYER' || e.persistenceTag === 'PERSISTENT') return true;
      const dist = Math.hypot(e.x - player.x, e.y - player.y);
      return dist < 1500;
    });

    const culledCount = initialCount - this.world.entities.length;
    if (culledCount > 0) {
        console.log(`[CORRECTOR] Culled ${culledCount} distant entities`);
    }
  }

  /**
   * RENDER: Reduce visual fidelity temporarily
   */
  private correctRenderOverload(): void {
    console.log('[CORRECTOR] Reducing render load via PerformanceManager...');
    // Force a re-cull logic pass implicitly by updating camera
    this.culling.getVisibleEntities(
        this.world.entities, 
        this.world.camera, 
        window.innerWidth, 
        window.innerHeight
    );
  }

  /**
   * WORLD_GEN: Reduce entropy for safer generation next time
   */
  private correctWorldGeneration(): void {
    console.log('[CORRECTOR] Reducing World Entropy...');
    this.worldGen.reduceEntropy(0.2);
  }

  /**
   * INVENTORY: Lock inventory to prevent further corruption
   */
  private correctInventoryState(): void {
    console.log('[CORRECTOR] Locking inventory for state rollback...');
    this.inventory.lock();
    
    // Auto-unlock after 2 seconds to allow system to settle
    setTimeout(() => {
      this.inventory.unlock();
      console.log('[CORRECTOR] Inventory unlocked');
    }, 2000);
  }

  getStats() {
    return {
      totalCorrections: this.correctionHistory.length,
      recentCorrections: this.correctionHistory.slice(-5),
    };
  }
}
