
import { Injectable } from '@angular/core';
import { Entity } from '../models/game.models';

class SpatialHash {
  // Map<ZoneId, Map<CellKey, Entity[]>>
  // We partition grids by zoneId to allow overlapping coordinates in different zones (instanced dungeons)
  private dynamicGrids = new Map<string, Map<number, Entity[]>>();
  private staticGrids = new Map<string, Map<number, Entity[]>>();
  
  private queryResult: Entity[] = [];
  private queryIdCounter = 0;
  
  constructor(public cellSize: number) {
      this.queryResult.length = 2000; 
  }

  private getKey(x: number, y: number): number { return ((x & 0xFFFF) << 16) | (y & 0xFFFF); }

  clearDynamic(zoneId?: string): void { 
      if (zoneId) {
          this.dynamicGrids.get(zoneId)?.clear();
      } else {
          this.dynamicGrids.clear(); 
      }
  }

  clearAll(): void {
      this.dynamicGrids.clear();
      this.staticGrids.clear();
  }

  insert(entity: Entity, isStatic: boolean): void {
    const zoneId = entity.zoneId || 'GLOBAL'; // Fallback if not set
    const mainMap = isStatic ? this.staticGrids : this.dynamicGrids;
    
    if (!mainMap.has(zoneId)) {
        mainMap.set(zoneId, new Map());
    }
    const grid = mainMap.get(zoneId)!;

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
  
  query(x: number, y: number, radius: number, zoneId?: string): Entity[] {
    const startX = Math.floor((x - radius) / this.cellSize);
    const startY = Math.floor((y - radius) / this.cellSize);
    const endX = Math.floor((x + radius) / this.cellSize);
    const endY = Math.floor((y + radius) / this.cellSize);
    return this.queryInternal(startX, startY, endX, endY, zoneId);
  }

  queryRect(minX: number, minY: number, maxX: number, maxY: number, zoneId?: string): Entity[] {
    const startX = Math.floor(minX / this.cellSize);
    const startY = Math.floor(minY / this.cellSize);
    const endX = Math.floor(maxX / this.cellSize);
    const endY = Math.floor(maxY / this.cellSize);
    return this.queryInternal(startX, startY, endX, endY, zoneId);
  }

  private queryInternal(startX: number, startY: number, endX: number, endY: number, targetZoneId?: string): Entity[] {
    this.queryIdCounter++;
    let count = 0;

    // Helper to process a specific grid map
    const processGridMap = (gridMap: Map<number, Entity[]>) => {
        for (let j = startY; j <= endY; j++) {
            for (let i = startX; i <= endX; i++) {
                const key = this.getKey(i, j);
                const cell = gridMap.get(key);
                if (cell) {
                    const len = cell.length;
                    for (let k = 0; k < len; k++) {
                        const e = cell[k];
                        if (e.lastQueryId !== this.queryIdCounter) {
                            e.lastQueryId = this.queryIdCounter;
                            if (count < this.queryResult.length) {
                                this.queryResult[count++] = e;
                            }
                        }
                    }
                }
            }
        }
    };

    // Process specified zone
    if (targetZoneId) {
        if (this.dynamicGrids.has(targetZoneId)) processGridMap(this.dynamicGrids.get(targetZoneId)!);
        if (this.staticGrids.has(targetZoneId)) processGridMap(this.staticGrids.get(targetZoneId)!);
    } 
    
    // Always process 'GLOBAL' zone (shared entities) if it exists
    if (targetZoneId !== 'GLOBAL') {
        if (this.dynamicGrids.has('GLOBAL')) processGridMap(this.dynamicGrids.get('GLOBAL')!);
        if (this.staticGrids.has('GLOBAL')) processGridMap(this.staticGrids.get('GLOBAL')!);
    }

    // In a "Soft Boundary" system, we might also query sibling zones here
    // For MVP, we assume rigid query per zone unless 'GLOBAL' is used.

    return this.queryResult.slice(0, count);
  }
}

@Injectable({ providedIn: 'root' })
export class SpatialHashService {
  private hash: SpatialHash;
  public cellSize = 120;
  
  constructor() { this.hash = new SpatialHash(this.cellSize); }
  
  clearDynamic(zoneId?: string) { this.hash.clearDynamic(zoneId); }
  clearAll() { this.hash.clearAll(); }
  
  insert(entity: Entity, isStatic: boolean = false) { 
      this.hash.insert(entity, isStatic); 
  }
  
  query(x: number, y: number, radius: number, zoneId?: string): Entity[] { return this.hash.query(x, y, radius, zoneId); }
  
  queryRect(minX: number, minY: number, maxX: number, maxY: number, zoneId?: string): Entity[] {
      return this.hash.queryRect(minX, minY, maxX, maxY, zoneId);
  }
}
