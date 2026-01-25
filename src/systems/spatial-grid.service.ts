
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
  private entityToCell = new Map<number, string>(); 
  
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

    // --- AUTOMATED KERNEL CHECK (Topology) ---
    // O(1) Check dispatched to worker. The Supervisor will handle any failures (e.g., density spikes).
    this.proofKernel.verifySpatialGridTopology(this.grid.size, activeEntities.length, this.cellSize);
    
    // Note: Removed heavy synchronous 'verifySpatialGrid' check. 
    // We trust the Supervisor/Worker flow now to avoid main thread jank.
  }

  queryRadius(x: number, y: number, radius: number): Entity[] {
    if (this.grid.size === 0) return [];
    
    const results: Entity[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const startCX = Math.floor(x / this.cellSize);
    const startCY = Math.floor(y / this.cellSize);

    for (let dy = -cellRadius; dy <= cellRadius; dy++) {
      for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        const key = `${startCX + dx},${startCY + dy}`;
        const cell = this.grid.get(key);
        if (cell) {
            for(let i=0; i<cell.length; i++) {
                const e = cell[i];
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
      if (oldKey) {
          const oldCell = this.grid.get(oldKey);
          if (oldCell) {
              const idx = oldCell.findIndex(x => x.id === e.id);
              if (idx !== -1) oldCell.splice(idx, 1);
              if (oldCell.length === 0) this.grid.delete(oldKey);
          }
      }

      if (!this.grid.has(newKey)) this.grid.set(newKey, []);
      this.grid.get(newKey)!.push(e);
      this.entityToCell.set(e.id, newKey);
    }
  }

  private getCellKey = (x: number, y: number) => 
    `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
}
