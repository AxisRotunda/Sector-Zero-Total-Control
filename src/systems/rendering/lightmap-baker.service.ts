
import { Injectable, inject } from '@angular/core';
import { LightSource } from '../../models/rendering.models';
import { IsoUtils } from '../../utils/iso-utils';
import { BakedTile } from './static-batch-renderer.service';

@Injectable({ providedIn: 'root' })
export class LightmapBakerService {
  
  private bakeCache = new Map<string, BakedTile[]>();
  private readonly TILE_SIZE = 2048; // Safe chunk size

  bakeStaticLights(
    lights: LightSource[], 
    cameraRotation: number
  ): BakedTile[] | null {
    
    if (!lights) return null;

    // Filter only static lights
    const staticLights = lights.filter(l => l.type === 'STATIC');
    if (staticLights.length === 0) return null;

    // Cache Key
    const cacheKey = `LIGHTS_${staticLights.length}_${cameraRotation.toFixed(2)}`;
    if (this.bakeCache.has(cacheKey)) return this.bakeCache.get(cacheKey)!;

    // 1. Calculate Bounds (ISO)
    const originalRotation = IsoUtils._rotation;
    const originalCx = IsoUtils._cx;
    const originalCy = IsoUtils._cy;
    IsoUtils.setContext(cameraRotation, 0, 0);

    let minIsoX = Infinity, maxIsoX = -Infinity;
    let minIsoY = Infinity, maxIsoY = -Infinity;
    const pt = {x:0, y:0};

    // First pass: Determine global bounds of all lights
    for (const l of staticLights) {
        IsoUtils.toIso(l.x, l.y, l.z || 0, pt);
        const r = l.radius;
        if (pt.x - r < minIsoX) minIsoX = pt.x - r;
        if (pt.x + r > maxIsoX) maxIsoX = pt.x + r;
        if (pt.y - r < minIsoY) minIsoY = pt.y - r;
        if (pt.y + r > maxIsoY) maxIsoY = pt.y + r;
    }

    // Add padding
    minIsoX -= 100; maxIsoX += 100;
    minIsoY -= 100; maxIsoY += 100;

    const tiles: BakedTile[] = [];

    // 2. Generate Tiles
    for (let y = minIsoY; y < maxIsoY; y += this.TILE_SIZE) {
        for (let x = minIsoX; x < maxIsoX; x += this.TILE_SIZE) {
            
            const tileRight = x + this.TILE_SIZE;
            const tileBottom = y + this.TILE_SIZE;

            // Find lights that overlap this tile
            const tileLights = staticLights.filter(l => {
                IsoUtils.toIso(l.x, l.y, l.z || 0, pt);
                const r = l.radius;
                return pt.x + r >= x && pt.x - r <= tileRight &&
                       pt.y + r >= y && pt.y - r <= tileBottom;
            });

            if (tileLights.length === 0) continue;

            const tile = this.renderTile(tileLights, x, y, this.TILE_SIZE, this.TILE_SIZE);
            if (tile) tiles.push(tile);
        }
    }

    IsoUtils.setContext(originalRotation, originalCx, originalCy);

    this.bakeCache.set(cacheKey, tiles);
    return tiles;
  }

  private renderTile(lights: LightSource[], x: number, y: number, w: number, h: number): BakedTile {
      let canvas: HTMLCanvasElement | OffscreenCanvas;
      if (typeof OffscreenCanvas !== 'undefined') {
          canvas = new OffscreenCanvas(w, h);
      } else {
          canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
      }

      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
      
      // Translate context so that tile origin (x, y) is at (0, 0)
      ctx.translate(-x, -y);
      ctx.clearRect(0, 0, w, h);

      const pt = {x:0, y:0};

      for (const l of lights) {
          IsoUtils.toIso(l.x, l.y, l.z || 0, pt);
          
          const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, l.radius);
          // White mask with alpha = intensity
          grad.addColorStop(0, `rgba(255, 255, 255, ${l.intensity})`);
          grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, l.radius, 0, Math.PI*2);
          ctx.fill();
      }

      return { canvas, x, y };
  }

  clearCache() {
      this.bakeCache.clear();
  }
}
