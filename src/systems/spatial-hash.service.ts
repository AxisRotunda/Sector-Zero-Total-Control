import { Injectable } from '@angular/core';
import { Entity } from '../models/game.models';

class SpatialHash {
  private dynamicGrid = new Map<number, Entity[]>();
  private staticGrid = new Map<number, Entity[]>();
  
  // Reusable array for query results to prevent allocation
  private queryResult: Entity[] = [];
  
  // Frame counter for deduplication
  private queryIdCounter = 0;
  
  constructor(public cellSize: number) {
      // Pre-allocate decent size
      this.queryResult.length = 2000; 
  }

  private getKey(x: number, y: number): number { return ((x & 0xFFFF) << 16) | (y & 0xFFFF); }

  clearDynamic(): void { 
      this.dynamicGrid.clear(); 
  }

  clearAll(): void {
      this.dynamicGrid.clear();
      this.staticGrid.clear();
  }

  insert(entity: Entity, isStatic: boolean): void {
    const grid = isStatic ? this.staticGrid : this.dynamicGrid;
    const startX = Math.floor((entity.x - entity.radius) / this.cellSize);
    const startY = Math.floor((entity.y - entity.radius) / this.cellSize);
    const endX = Math.floor((entity.x + entity.radius) / this.cellSize);
    const endY = Math.floor((entity.y + entity.radius) / this.cellSize);

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const key = this.getKey(x, y);
        let cell = grid.get(key);
        if (!cell) { cell = []; grid.set(key, cell); }
        cell.push(entity);
      }
    }
  }
  
  query(x: number, y: number, radius: number): Entity[] {
    const startX = Math.floor((x - radius) / this.cellSize);
    const startY = Math.floor((y - radius) / this.cellSize);
    const endX = Math.floor((x + radius) / this.cellSize);
    const endY = Math.floor((y + radius) / this.cellSize);
    return this.queryInternal(startX, startY, endX, endY);
  }

  queryRect(minX: number, minY: number, maxX: number, maxY: number): Entity[] {
    const startX = Math.floor(minX / this.cellSize);
    const startY = Math.floor(minY / this.cellSize);
    const endX = Math.floor(maxX / this.cellSize);
    const endY = Math.floor(maxY / this.cellSize);
    return this.queryInternal(startX, startY, endX, endY);
  }

  private queryInternal(startX: number, startY: number, endX: number, endY: number): Entity[] {
    this.queryIdCounter++;
    let count = 0;

    for (let j = startY; j <= endY; j++) {
      for (let i = startX; i <= endX; i++) {
        const key = this.getKey(i, j);
        const process = (grid: Map<number, Entity[]>) => {
            const cell = grid.get(key);
            if (cell) {
                const len = cell.length;
                for (let k = 0; k < len; k++) {
                    const e = cell[k];
                    if (e.lastQueryId !== this.queryIdCounter) {
                        e.lastQueryId = this.queryIdCounter;
                        // Safety check for buffer overflow
                        if (count < this.queryResult.length) {
                            this.queryResult[count++] = e;
                        }
                    }
                }
            }
        };
        process(this.dynamicGrid);
        process(this.staticGrid);
      }
    }
    return this.queryResult.slice(0, count);
  }

  getDebugData() {
      const keys = [...this.dynamicGrid.keys(), ...this.staticGrid.keys()];
      return { keys: keys, decode: (k: number) => {
          const x = (k >> 16) & 0xFFFF;
          const y = k & 0xFFFF;
          return { x: x >= 32768 ? x - 65536 : x, y: y >= 32768 ? y - 65536 : y };
      }};
  }
}

@Injectable({ providedIn: 'root' })
export class SpatialHashService {
  private hash: SpatialHash;
  public cellSize = 120;
  
  constructor() { this.hash = new SpatialHash(this.cellSize); }
  
  clearDynamic() { this.hash.clearDynamic(); }
  clearAll() { this.hash.clearAll(); }
  
  insert(entity: Entity, isStatic: boolean = false) { 
      this.hash.insert(entity, isStatic); 
  }
  
  query(x: number, y: number, radius: number): Entity[] { return this.hash.query(x, y, radius); }
  
  queryRect(minX: number, minY: number, maxX: number, maxY: number): Entity[] {
      return this.hash.queryRect(minX, minY, maxX, maxY);
  }

  getDebugData() { return this.hash.getDebugData(); }
}