
import { Injectable, inject, signal } from '@angular/core';
import { Entity } from '../models/game.models';
import { ProofKernelService } from '../core/proof/proof-kernel.service';
import { EventBusService } from '../core/events/event-bus.service';
import { GameEvents } from '../core/events/game-events';

@Injectable({ providedIn: 'root' })
export class SpatialGridService {
  private proofKernel = inject(ProofKernelService);
  private eventBus = inject(EventBusService);

  private cellSize = 100;
  private grid = new Map<string, Entity[]>();
  private entityToCell = new Map<number, string>(); // Using number (ID) as key for faster lookup
  
  // Metrics for monitoring
  private metrics = signal({ totalCells: 0, totalEntities: 0, rebuilds: 0, failures: 0 });

  rebuildGrid(entities: Entity[]): void {
    this.grid.clear();
    this.entityToCell.clear();

    const activeEntities = entities.filter(e => e.state !== 'DEAD');

    activeEntities.forEach(e => {
      const key = this.getCellKey(e.x, e.y);
      if (!this.grid.has(key)) this.grid.set(key, []);
      this.grid.get(key)!.push(e);
      this.entityToCell.set(e.id, key);
    });

    this.metrics.update(m => ({
      totalCells: this.grid.size, 
      totalEntities: activeEntities.length, 
      rebuilds: m.rebuilds + 1, 
      failures: m.failures
    }));

    // Verify consistency immediately after rebuild
    const verification = this.proofKernel.verifySpatialGrid(this.grid, activeEntities, this.cellSize);
    if (!verification.isValid) {
      this.metrics.update(m => ({ ...m, failures: m.failures + 1 }));
      this.eventBus.dispatch({
        type: GameEvents.REALITY_BLEED, 
        payload: {
            severity: 'MEDIUM',
            source: 'Spatial Grid Corruption', 
            message: verification.errors[0]
        }
      });
      // Auto-heal by brute force clearing to prevent crash cascades, next frame will rebuild
      this.grid.clear(); 
    }
  }

  queryRadius(x: number, y: number, radius: number): Entity[] {
    if (this.grid.size === 0) return [];
    
    const results: Entity[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const startCX = Math.floor(x / this.cellSize);
    const startCY = Math.floor(y / this.cellSize);

    // Scan relevant cells
    for (let dy = -cellRadius; dy <= cellRadius; dy++) {
      for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        const key = `${startCX + dx},${startCY + dy}`;
        const cell = this.grid.get(key);
        if (cell) {
            for(let i=0; i<cell.length; i++) {
                const e = cell[i];
                // Precise distance check
                if (Math.abs(e.x - x) <= radius && Math.abs(e.y - y) <= radius) {
                    if (Math.hypot(e.x - x, e.y - y) <= radius) {
                        results.push(e);
                    }
                }
            }
        }
      }
    }
    return results;
  }

  updateEntity(e: Entity, newX: number, newY: number): void {
    const oldKey = this.entityToCell.get(e.id);
    const newKey = this.getCellKey(newX, newY);

    if (oldKey !== newKey) {
      // Remove from old cell
      if (oldKey) {
          const oldCell = this.grid.get(oldKey);
          if (oldCell) {
              const idx = oldCell.findIndex(x => x.id === e.id);
              if (idx !== -1) oldCell.splice(idx, 1);
              // Clean up empty cells to save memory
              if (oldCell.length === 0) this.grid.delete(oldKey);
          }
      }

      // Add to new cell
      if (!this.grid.has(newKey)) this.grid.set(newKey, []);
      this.grid.get(newKey)!.push(e);
      this.entityToCell.set(e.id, newKey);
    }

    // Position update handled by Physics, but we track grid location here.
    // Assuming physics engine actually mutates x/y, we just react to it or allow this method to update it.
    // For safety in this integration, we assume this is called *after* physics or *during* physics update.
  }

  private getCellKey = (x: number, y: number) => 
    `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
}
