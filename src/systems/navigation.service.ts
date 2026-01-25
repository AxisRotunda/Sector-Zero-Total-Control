
import { Injectable, inject } from '@angular/core';
import { WorldService } from '../game/world/world.service';
import { Zone } from '../models/game.models';
import { ProofKernelService } from '../core/proof/proof-kernel.service';

interface GridCell {
  x: number;
  y: number;
}

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private world = inject(WorldService);
  private proofKernel = inject(ProofKernelService);
  
  private navGrid: boolean[][] = [];
  private gridSize = 60; // Size of grid cells in world units
  private gridWidth = 0;
  private gridHeight = 0;
  private minX = 0;
  private minY = 0;

  buildNavGrid(zone: Zone) {
    const bounds = this.world.mapBounds;
    this.minX = bounds.minX;
    this.minY = bounds.minY;
    
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    
    this.gridWidth = Math.ceil(width / this.gridSize);
    this.gridHeight = Math.ceil(height / this.gridSize);
    
    // Initialize grid (true = walkable)
    this.navGrid = Array(this.gridHeight).fill(null).map(() => Array(this.gridWidth).fill(true));
    
    const walls = this.world.entities.filter(e => e.type === 'WALL');
    
    for (const wall of walls) {
        this.markUnwalkable(wall);
    }
  }

  findPath(start: {x: number, y: number}, end: {x: number, y: number}): {x: number, y: number}[] {
      const startCell = this.worldToGrid(start);
      const endCell = this.worldToGrid(end);

      if (!this.isValid(startCell) || !this.isValid(endCell)) return [];
      
      let target = endCell;
      if (!this.isWalkable(target)) {
          target = this.findNearestWalkable(target);
          if (!target) return [];
      }

      const pathGrid = this.aStar(startCell, target);
      const worldPath = pathGrid.map(cell => this.gridToWorld(cell));

      // --- FORMAL VERIFICATION ---
      // Send path to Kernel to prove continuity (no teleportation)
      if (worldPath.length > 1) {
          this.proofKernel.verifyPathContinuity(worldPath, this.gridSize);
      }

      return worldPath;
  }

  private worldToGrid(pos: {x: number, y: number}): GridCell {
      return {
          x: Math.floor((pos.x - this.minX) / this.gridSize),
          y: Math.floor((pos.y - this.minY) / this.gridSize)
      };
  }

  private gridToWorld(cell: GridCell): {x: number, y: number} {
      return {
          x: this.minX + (cell.x * this.gridSize) + (this.gridSize / 2),
          y: this.minY + (cell.y * this.gridSize) + (this.gridSize / 2)
      };
  }

  private markUnwalkable(wall: any) {
      const w = wall.width || 40;
      const d = wall.depth || 40; 
      
      const startX = Math.floor((wall.x - w / 2 - this.minX) / this.gridSize);
      const endX = Math.ceil((wall.x + w / 2 - this.minX) / this.gridSize);
      const startY = Math.floor((wall.y - d / 2 - this.minY) / this.gridSize);
      const endY = Math.ceil((wall.y + d / 2 - this.minY) / this.gridSize);

      for (let y = Math.max(0, startY); y < Math.min(this.gridHeight, endY); y++) {
          for (let x = Math.max(0, startX); x < Math.min(this.gridWidth, endX); x++) {
              this.navGrid[y][x] = false;
          }
      }
  }

  private isWalkable(cell: GridCell): boolean {
      if (!this.isValid(cell)) return false;
      return this.navGrid[cell.y][cell.x];
  }

  private isValid(cell: GridCell): boolean {
      return cell.x >= 0 && cell.x < this.gridWidth && cell.y >= 0 && cell.y < this.gridHeight;
  }

  private findNearestWalkable(cell: GridCell): GridCell | null {
      const neighbors = this.getNeighbors(cell);
      return neighbors.find(n => this.isWalkable(n)) || null;
  }

  private aStar(start: GridCell, end: GridCell): GridCell[] {
      const openSet: GridCell[] = [start];
      const cameFrom = new Map<string, GridCell>();
      const gScore = new Map<string, number>();
      const fScore = new Map<string, number>();
      
      const key = (c: GridCell) => `${c.x},${c.y}`;
      
      gScore.set(key(start), 0);
      fScore.set(key(start), this.heuristic(start, end));

      let iterations = 0;
      const MAX_ITERATIONS = 500;

      while (openSet.length > 0 && iterations < MAX_ITERATIONS) {
          iterations++;
          
          openSet.sort((a, b) => (fScore.get(key(a)) || Infinity) - (fScore.get(key(b)) || Infinity));
          const current = openSet.shift()!;

          if (current.x === end.x && current.y === end.y) {
              return this.reconstructPath(cameFrom, current);
          }

          const neighbors = this.getNeighbors(current);
          for (const neighbor of neighbors) {
              if (!this.isWalkable(neighbor)) continue;

              const tentativeG = (gScore.get(key(current)) || Infinity) + 1;
              const neighborKey = key(neighbor);

              if (tentativeG < (gScore.get(neighborKey) || Infinity)) {
                  cameFrom.set(neighborKey, current);
                  gScore.set(neighborKey, tentativeG);
                  fScore.set(neighborKey, tentativeG + this.heuristic(neighbor, end));
                  
                  if (!openSet.some(n => n.x === neighbor.x && n.y === neighbor.y)) {
                      openSet.push(neighbor);
                  }
              }
          }
      }
      return []; 
  }

  private getNeighbors(cell: GridCell): GridCell[] {
      const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]]; 
      return dirs.map(d => ({ x: cell.x + d[0], y: cell.y + d[1] })).filter(c => this.isValid(c));
  }

  private heuristic(a: GridCell, b: GridCell): number {
      return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  private reconstructPath(cameFrom: Map<string, GridCell>, current: GridCell): GridCell[] {
      const totalPath = [current];
      const key = (c: GridCell) => `${c.x},${c.y}`;
      while (cameFrom.has(key(current))) {
          current = cameFrom.get(key(current))!;
          totalPath.unshift(current);
      }
      return totalPath;
  }
}
