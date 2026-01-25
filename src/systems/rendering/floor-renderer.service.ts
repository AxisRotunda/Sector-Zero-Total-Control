
import { Injectable, inject } from '@angular/core';
import { Zone, Camera, Entity } from '../../models/game.models';
import { IsoUtils } from '../../utils/iso-utils';
import { EntityRendererService } from './entity-renderer.service';
import { RENDER_CONFIG } from './render.config';
import { SpatialHashService } from '../spatial-hash.service';
import { TextureGeneratorService } from './texture-generator.service';

@Injectable({ providedIn: 'root' })
export class FloorRendererService {
  private entityRenderer = inject(EntityRendererService);
  private spatialHash = inject(SpatialHashService);
  private textureGen = inject(TextureGeneratorService);
  
  // Cache Management
  private floorCache = new Map<string, HTMLCanvasElement>();
  private readonly MAX_CACHE_SIZE = 3; // Keep only 3 most recent zones
  
  // State
  private lastZoneId: string = '';
  private lastViewX: number = -99999;
  private lastViewY: number = -99999;
  private lastZoom: number = 1;
  private lastRotation: number = 0;
  private readonly CACHE_PADDING = RENDER_CONFIG.FLOOR_CACHE_PADDING; 
  private _p1 = { x: 0, y: 0 }; // Reusable vector

  drawFloor(ctx: CanvasRenderingContext2D, cam: Camera, zone: Zone, mapBounds: {minX:number, maxX:number, minY:number, maxY:number}, canvasWidth: number, canvasHeight: number) {
      const viewW = canvasWidth / cam.zoom;
      const viewH = canvasHeight / cam.zoom;
      
      const needsRedraw = 
          zone.id !== this.lastZoneId ||
          Math.abs(cam.zoom - this.lastZoom) > 0.01 || 
          Math.abs(cam.rotation - this.lastRotation) > 0.01 ||
          Math.abs(cam.x - this.lastViewX) > this.CACHE_PADDING / 3 ||
          Math.abs(cam.y - this.lastViewY) > this.CACHE_PADDING / 3;

      const cacheKey = `FLOOR_${zone.id}_${Math.floor(cam.x / 500)}`; // Simple spatial key approximation

      if (needsRedraw) {
          this.updateCache(cacheKey, cam, zone, mapBounds, canvasWidth, canvasHeight);
      }

      // Render latest cache
      // Note: In a real robust system we'd look up the *correct* key for the current position
      // For this MVP fix, we just use the most recently generated one which is implicitly the "current" one
      if (this.floorCache.has(cacheKey)) {
          const canvas = this.floorCache.get(cacheKey)!;
          const cacheCenterIso = IsoUtils.toIso(this.lastViewX, this.lastViewY, 0, this._p1);
          ctx.drawImage(
              canvas, 
              Math.floor(cacheCenterIso.x - canvas.width / 2), 
              Math.floor(cacheCenterIso.y - canvas.height / 2)
          );
      }
  }

  private updateCache(key: string, cam: Camera, zone: Zone, mapBounds: {minX:number, maxX:number, minY:number, maxY:number}, viewW: number, viewH: number) {
      // 1. Eviction Policy
      if (!this.floorCache.has(key)) {
          if (this.floorCache.size >= this.MAX_CACHE_SIZE) {
              const firstKey = this.floorCache.keys().next().value;
              const evicted = this.floorCache.get(firstKey)!;
              // CRITICAL: Free canvas memory
              evicted.width = 0; 
              evicted.height = 0;
              this.floorCache.delete(firstKey);
          }
      }

      // 2. Create/Reuse Canvas
      let canvas = this.floorCache.get(key);
      if (!canvas) {
          canvas = document.createElement('canvas');
          this.floorCache.set(key, canvas);
      }

      this.lastZoneId = zone.id;
      this.lastViewX = cam.x;
      this.lastViewY = cam.y;
      this.lastZoom = cam.zoom;
      this.lastRotation = cam.rotation;

      // Calculate dimensions
      const maxDim = RENDER_CONFIG.MAX_CANVAS_DIMENSION;
      const calcW = Math.ceil((viewW / cam.zoom) + (this.CACHE_PADDING * 2));
      const calcH = Math.ceil((viewH / cam.zoom) + (this.CACHE_PADDING * 2));
      const width = Math.min(maxDim, calcW);
      const height = Math.min(maxDim, calcH);
      
      if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
      }

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      const visuals = this.textureGen.getThemeVisuals(zone.theme);
      
      // Base Fill
      ctx.fillStyle = zone.groundColor;
      ctx.fillRect(0, 0, width, height);

      // Texture Overlay
      if (visuals.pattern) {
          ctx.save();
          ctx.globalAlpha = visuals.fillOpacity * 0.5;
          ctx.globalCompositeOperation = 'overlay'; 
          ctx.fillStyle = visuals.pattern;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
      }

      ctx.save();
      ctx.translate(width/2, height/2);
      const centerIso = IsoUtils.toIso(this.lastViewX, this.lastViewY, 0, this._p1);
      ctx.translate(-centerIso.x, -centerIso.y);

      // Geometry & Decor
      if (zone.floorPattern === 'HUB') {
          this.drawHubFloor(ctx, zone);
      } else {
          this.drawGridFloorBatch(ctx, zone, mapBounds, width, height);
      }

      // Render Decorations
      const range = Math.max(width, height) * 1.0; 
      const entities = this.spatialHash.queryRect(
          this.lastViewX - range, 
          this.lastViewY - range, 
          this.lastViewX + range, 
          this.lastViewY + range,
          zone.id
      );

      entities.sort((a, b) => (a.x + a.y) - (b.x + b.y));

      for (const d of entities) {
          if (d.type === 'DECORATION' && (d.subType === 'RUG' || d.subType === 'FLOOR_CRACK' || d.subType === 'GRAFFITI' || d.subType === 'TRASH')) {
              this.entityRenderer.drawDecoration(ctx, d);
          }
      }
      
      ctx.restore();
  }

  // --- DRAWING HELPERS (Same as before, just kept for completeness) ---
  
  private drawGridFloorBatch(ctx: CanvasRenderingContext2D, zone: Zone, mapBounds: any, width: number, height: number) {
      const tileSize = RENDER_CONFIG.FLOOR_TILE_SIZE;
      const rangeX = width * 1.0; 
      const rangeY = height * 1.0;
      
      const startX = Math.max(mapBounds.minX, Math.floor((this.lastViewX - rangeX) / tileSize) * tileSize);
      const endX = Math.min(mapBounds.maxX, this.lastViewX + rangeX);
      const startY = Math.max(mapBounds.minY, Math.floor((this.lastViewY - rangeY) / tileSize) * tileSize);
      const endY = Math.min(mapBounds.maxY, this.lastViewY + rangeY);

      ctx.beginPath();
      ctx.fillStyle = '#ffffff'; 
      ctx.globalAlpha = 0.03;
      
      for (let x = startX; x <= endX; x += tileSize) {
          for (let y = startY; y <= endY; y += tileSize) {
              if ((x ^ y) % 7 === 0 || (zone.floorPattern === 'HAZARD' && (x + y) % 500 === 0)) {
                  const p1 = IsoUtils.toIso(x, y, 0);
                  const p2 = IsoUtils.toIso(x + tileSize, y, 0);
                  const p3 = IsoUtils.toIso(x + tileSize, y + tileSize, 0);
                  const p4 = IsoUtils.toIso(x, y + tileSize, 0);
                  ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y);
              }
          }
      }
      ctx.fill();
      ctx.globalAlpha = 1.0;

      if (zone.floorPattern === 'GRID' || zone.floorPattern === 'HAZARD') {
          ctx.beginPath();
          ctx.strokeStyle = zone.detailColor;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.15;
          for (let x = startX; x <= endX; x += tileSize) {
              const p1 = IsoUtils.toIso(x, startY, 0);
              const p2 = IsoUtils.toIso(x, endY, 0);
              ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
          }
          for (let y = startY; y <= endY; y += tileSize) {
              const p1 = IsoUtils.toIso(startX, y, 0);
              const p2 = IsoUtils.toIso(endX, y, 0);
              ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
          }
          ctx.stroke();
          ctx.globalAlpha = 1.0;
      }
  }

  private drawHubFloor(ctx: CanvasRenderingContext2D, zone: Zone) {
      const plazaRadius = 1200;
      ctx.fillStyle = '#18181b'; 
      this.drawOctagon(ctx, 0, 0, plazaRadius);
      ctx.fill();
      ctx.strokeStyle = zone.detailColor; ctx.lineWidth = 2; ctx.globalAlpha = 0.1;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const p1 = IsoUtils.toIso(0, 0, 0);
          const p2 = IsoUtils.toIso(Math.cos(angle) * plazaRadius, Math.sin(angle) * plazaRadius, 0);
          ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
      }
      ctx.stroke();
      for (let r = 200; r <= plazaRadius; r += 200) { this.drawOctagon(ctx, 0, 0, r, true); }
      ctx.globalAlpha = 1.0;
  }

  private drawOctagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, stroke: boolean = false) {
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const p = IsoUtils.toIso(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 0);
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      if (stroke) ctx.stroke();
  }
}
