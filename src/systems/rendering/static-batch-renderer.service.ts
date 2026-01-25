
import { Injectable, inject } from '@angular/core';
import { Entity, Zone } from '../../models/game.models';
import { FloorRendererService } from './floor-renderer.service';
import { StructureRendererService } from './structure-renderer.service';
import { IsoUtils } from '../../utils/iso-utils';
import { EntityRendererService } from './entity-renderer.service';

export interface BakedTile {
    canvas: HTMLCanvasElement | OffscreenCanvas;
    x: number;
    y: number;
}

@Injectable({ providedIn: 'root' })
export class StaticBatchRendererService {
  private floorRenderer = inject(FloorRendererService);
  private structureRenderer = inject(StructureRendererService);
  private entityRenderer = inject(EntityRendererService);

  private batchCache = new Map<string, BakedTile[]>();
  private readonly TILE_SIZE = 2048; // Safe chunk size

  /**
   * Bakes static geometry (Floor Decos only) into tiled canvases.
   * Returns array of tiles to be drawn.
   */
  bakeStaticGeometry(
    zone: Zone, 
    entities: Entity[], 
    cameraRotation: number
  ): BakedTile[] | null {
    
    if (!entities) return null;

    // Check cache first
    const cacheKey = `${zone.id}_${cameraRotation.toFixed(2)}`;
    if (this.batchCache.has(cacheKey)) {
      return this.batchCache.get(cacheKey)!;
    }

    // Filter static candidates
    // FIX: Exclude WALLS to allow proper Z-sorting with player. Only bake flat floor decorations.
    const statics = entities.filter(e => 
      e.type === 'DECORATION' && ['RUG', 'FLOOR_CRACK', 'GRAFFITI', 'TRASH', 'SCORCH'].includes(e.subType || '')
    );

    if (statics.length === 0) return null;

    // 1. Calculate Global Bounds in ISO SPACE
    const originalRotation = IsoUtils._rotation;
    const originalCx = IsoUtils._cx;
    const originalCy = IsoUtils._cy;

    IsoUtils.setContext(cameraRotation, 0, 0);

    let minIsoX = Infinity, maxIsoX = -Infinity;
    let minIsoY = Infinity, maxIsoY = -Infinity;
    
    const expand = (x: number, y: number) => {
        if (x < minIsoX) minIsoX = x;
        if (x > maxIsoX) maxIsoX = x;
        if (y < minIsoY) minIsoY = y;
        if (y > maxIsoY) maxIsoY = y;
    };

    const tempPt = {x: 0, y: 0};
    for (const e of statics) {
        const w = e.width || 100;
        const d = e.depth || 100;
        
        // Project footprint
        IsoUtils.toIso(e.x - w/2, e.y - d/2, 0, tempPt); expand(tempPt.x, tempPt.y);
        IsoUtils.toIso(e.x + w/2, e.y + d/2, 0, tempPt); expand(tempPt.x, tempPt.y);
        IsoUtils.toIso(e.x - w/2, e.y + d/2, 0, tempPt); expand(tempPt.x, tempPt.y);
        IsoUtils.toIso(e.x + w/2, e.y - d/2, 0, tempPt); expand(tempPt.x, tempPt.y);
    }

    // Add Padding
    const PADDING = 100;
    minIsoX -= PADDING; maxIsoX += PADDING;
    minIsoY -= PADDING; maxIsoY += PADDING;

    const tiles: BakedTile[] = [];
    
    // 2. Generate Tiles
    // Loop through the bounding box in TILE_SIZE steps
    for (let y = minIsoY; y < maxIsoY; y += this.TILE_SIZE) {
        for (let x = minIsoX; x < maxIsoX; x += this.TILE_SIZE) {
            
            // Check if any entity overlaps this tile
            const tileRight = x + this.TILE_SIZE;
            const tileBottom = y + this.TILE_SIZE;
            
            const tileEntities = statics.filter(e => {
                const w = e.width || 100;
                const d = e.depth || 100;
                
                // Fast broadphase check using center point projection
                // (More accurate would be full AABB check but this suffices for static scatter)
                IsoUtils.toIso(e.x, e.y, 0, tempPt);
                
                // Allow some bleed for entity size
                const margin = Math.max(w, d) + 100;
                return tempPt.x >= x - margin && tempPt.x <= tileRight + margin &&
                       tempPt.y >= y - margin && tempPt.y <= tileBottom + margin;
            });

            if (tileEntities.length === 0) continue;

            const tile = this.renderTile(tileEntities, x, y, this.TILE_SIZE, this.TILE_SIZE, zone);
            if (tile) tiles.push(tile);
        }
    }

    // 4. Restore Global Context
    IsoUtils.setContext(originalRotation, originalCx, originalCy);

    this.batchCache.set(cacheKey, tiles);
    
    return tiles;
  }

  private renderTile(entities: Entity[], x: number, y: number, w: number, h: number, zone: Zone): BakedTile | null {
      let canvas: HTMLCanvasElement | OffscreenCanvas;
      
      if (typeof OffscreenCanvas !== 'undefined') {
          canvas = new OffscreenCanvas(w, h);
      } else {
          canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
      }

      const ctx = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;
      
      // Translate so that (x, y) is at (0, 0)
      ctx.translate(-x, -y);

      // Sort
      entities.sort((a, b) => {
          const ad = (a.x + a.y) + (a.z || 0) * 0.1;
          const bd = (b.x + b.y) + (b.z || 0) * 0.1;
          return ad - bd;
      });

      for (const e of entities) {
          this.entityRenderer.drawDecoration(ctx, e);
      }

      return { canvas, x, y };
  }

  clearCache() {
      this.batchCache.clear();
  }
}
