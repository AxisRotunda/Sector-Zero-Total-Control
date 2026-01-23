
import { Injectable, inject } from '@angular/core';
import { Zone, Camera, Entity } from '../../models/game.models';
import { IsoUtils } from '../../utils/iso-utils';
import { EntityRendererService } from './entity-renderer.service';
import { RENDER_CONFIG } from './render.config';
import { SpatialHashService } from '../spatial-hash.service';
import { TextureGeneratorService, ThemeVisuals } from './texture-generator.service';

@Injectable({ providedIn: 'root' })
export class FloorRendererService {
  private entityRenderer = inject(EntityRendererService);
  private spatialHash = inject(SpatialHashService);
  private textureGen = inject(TextureGeneratorService);
  
  // Cache System
  private floorCanvas: HTMLCanvasElement | null = null;
  private floorCtx: CanvasRenderingContext2D | null = null;
  private lastZoneId: string = '';
  private lastViewX: number = -99999;
  private lastViewY: number = -99999;
  private lastZoom: number = 1;
  private lastRotation: number = 0; // New tracking
  private readonly CACHE_PADDING = RENDER_CONFIG.FLOOR_CACHE_PADDING; 

  // Vector Pooling (Reuse to prevent GC thrashing)
  private _p1 = { x: 0, y: 0 };
  private _p2 = { x: 0, y: 0 };
  private _p3 = { x: 0, y: 0 };
  private _p4 = { x: 0, y: 0 };

  constructor() {
      if (typeof document !== 'undefined') {
          this.floorCanvas = document.createElement('canvas');
          this.floorCtx = this.floorCanvas.getContext('2d', { alpha: false }); 
      }
  }

  drawFloor(ctx: CanvasRenderingContext2D, cam: Camera, zone: Zone, mapBounds: {minX:number, maxX:number, minY:number, maxY:number}, canvasWidth: number, canvasHeight: number) {
      if (!this.floorCanvas || !this.floorCtx) return;

      const viewW = canvasWidth / cam.zoom;
      const viewH = canvasHeight / cam.zoom;
      
      // Invalidate cache if: 
      // 1. Zone changed
      // 2. Zoom changed significantly
      // 3. Pan exceeded padding buffer
      // 4. Rotation changed (Must redraw cache on rotation!)
      const needsRedraw = 
          zone.id !== this.lastZoneId ||
          Math.abs(cam.zoom - this.lastZoom) > 0.01 || 
          Math.abs(cam.rotation - this.lastRotation) > 0.01 ||
          Math.abs(cam.x - this.lastViewX) > this.CACHE_PADDING / 3 ||
          Math.abs(cam.y - this.lastViewY) > this.CACHE_PADDING / 3;

      if (needsRedraw) {
          this.updateCache(cam, zone, mapBounds, canvasWidth, canvasHeight);
      }

      // Draw cached canvas relative to current camera position
      const cacheCenterIso = IsoUtils.toIso(this.lastViewX, this.lastViewY, 0, this._p1);
      
      ctx.drawImage(
          this.floorCanvas, 
          Math.floor(cacheCenterIso.x - this.floorCanvas.width / 2), 
          Math.floor(cacheCenterIso.y - this.floorCanvas.height / 2)
      );
  }

  private updateCache(cam: Camera, zone: Zone, mapBounds: {minX:number, maxX:number, minY:number, maxY:number}, viewW: number, viewH: number) {
      if (!this.floorCanvas || !this.floorCtx) return;

      this.lastZoneId = zone.id;
      this.lastViewX = cam.x;
      this.lastViewY = cam.y;
      this.lastZoom = cam.zoom;
      this.lastRotation = cam.rotation;

      // Calculate cache dimensions with padding
      const maxDim = RENDER_CONFIG.MAX_CANVAS_DIMENSION;
      const calcW = Math.ceil((viewW / cam.zoom) + (this.CACHE_PADDING * 2));
      const calcH = Math.ceil((viewH / cam.zoom) + (this.CACHE_PADDING * 2));
      const width = Math.min(maxDim, calcW);
      const height = Math.min(maxDim, calcH);
      
      if (this.floorCanvas.width !== width || this.floorCanvas.height !== height) {
          this.floorCanvas.width = width;
          this.floorCanvas.height = height;
      }

      const ctx = this.floorCtx;
      const visuals = this.textureGen.getThemeVisuals(zone.theme);
      
      // 1. Base Fill
      ctx.fillStyle = zone.groundColor;
      ctx.fillRect(0, 0, width, height);

      // 2. Texture Overlay (Procedural Noise/Pattern)
      if (visuals.pattern) {
          ctx.save();
          ctx.globalAlpha = visuals.fillOpacity * 0.5; // Subtle blend
          ctx.globalCompositeOperation = 'overlay'; 
          ctx.fillStyle = visuals.pattern;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
      }

      ctx.save();
      ctx.translate(width/2, height/2);
      
      const centerIso = IsoUtils.toIso(this.lastViewX, this.lastViewY, 0, this._p1);
      ctx.translate(-centerIso.x, -centerIso.y);

      // 3. Draw Geometry (Grid / Hub)
      if (zone.floorPattern === 'HUB') {
          this.drawHubFloor(ctx, zone);
      } else {
          this.drawGridFloorBatch(ctx, zone, mapBounds, width, height);
      }

      // 4. Draw Static Decorations (Baked into floor)
      const range = Math.max(width, height) * 1.0; // Query range matches cache size
      
      const entities = this.spatialHash.queryRect(
          this.lastViewX - range, 
          this.lastViewY - range, 
          this.lastViewX + range, 
          this.lastViewY + range,
          zone.id
      );

      // Sort decorations by Y depth to prevent weird overlapping
      entities.sort((a, b) => (a.x + a.y) - (b.x + b.y));

      for (const d of entities) {
          if (d.type === 'DECORATION' && (d.subType === 'RUG' || d.subType === 'FLOOR_CRACK' || d.subType === 'GRAFFITI' || d.subType === 'TRASH')) {
              this.entityRenderer.drawDecoration(ctx, d);
          }
      }
      
      ctx.restore();
  }

  private drawGridFloorBatch(ctx: CanvasRenderingContext2D, zone: Zone, mapBounds: any, width: number, height: number) {
      const tileSize = RENDER_CONFIG.FLOOR_TILE_SIZE;
      // We render a bit larger than the cache view to ensure lines don't pop out at edges
      const rangeX = width * 1.0; 
      const rangeY = height * 1.0;
      
      const startX = Math.max(mapBounds.minX, Math.floor((this.lastViewX - rangeX) / tileSize) * tileSize);
      const endX = Math.min(mapBounds.maxX, this.lastViewX + rangeX);
      const startY = Math.max(mapBounds.minY, Math.floor((this.lastViewY - rangeY) / tileSize) * tileSize);
      const endY = Math.min(mapBounds.maxY, this.lastViewY + rangeY);

      // Optimization: Batch drawing
      // Batch 1: Highlight Tiles (Checkerboard / Hazard)
      ctx.beginPath();
      ctx.fillStyle = '#ffffff'; // Tint color
      ctx.globalAlpha = 0.03;
      
      for (let x = startX; x <= endX; x += tileSize) {
          for (let y = startY; y <= endY; y += tileSize) {
              // Procedural variation based on position
              if ((x ^ y) % 7 === 0 || (zone.floorPattern === 'HAZARD' && (x + y) % 500 === 0)) {
                  IsoUtils.toIso(x, y, 0, this._p1);
                  IsoUtils.toIso(x + tileSize, y, 0, this._p2);
                  IsoUtils.toIso(x + tileSize, y + tileSize, 0, this._p3);
                  IsoUtils.toIso(x, y + tileSize, 0, this._p4);
                  
                  ctx.moveTo(this._p1.x, this._p1.y);
                  ctx.lineTo(this._p2.x, this._p2.y);
                  ctx.lineTo(this._p3.x, this._p3.y);
                  ctx.lineTo(this._p4.x, this._p4.y);
                  // Close subpath implicitly by moving to next
              }
          }
      }
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Batch 2: Grid Lines
      if (zone.floorPattern === 'GRID' || zone.floorPattern === 'HAZARD') {
          ctx.beginPath();
          ctx.strokeStyle = zone.detailColor;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.15;

          // Draw vertical lines (X-constant)
          for (let x = startX; x <= endX; x += tileSize) {
              IsoUtils.toIso(x, startY, 0, this._p1);
              IsoUtils.toIso(x, endY, 0, this._p2);
              ctx.moveTo(this._p1.x, this._p1.y);
              ctx.lineTo(this._p2.x, this._p2.y);
          }
          
          // Draw horizontal lines (Y-constant)
          for (let y = startY; y <= endY; y += tileSize) {
              IsoUtils.toIso(startX, y, 0, this._p1);
              IsoUtils.toIso(endX, y, 0, this._p2);
              ctx.moveTo(this._p1.x, this._p1.y);
              ctx.lineTo(this._p2.x, this._p2.y);
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
      
      // Central Rings
      ctx.strokeStyle = zone.detailColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.1;
      
      // Radial spokes
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          IsoUtils.toIso(0, 0, 0, this._p1);
          IsoUtils.toIso(Math.cos(angle) * plazaRadius, Math.sin(angle) * plazaRadius, 0, this._p2);
          ctx.moveTo(this._p1.x, this._p1.y);
          ctx.lineTo(this._p2.x, this._p2.y);
      }
      ctx.stroke();

      // Concentric rings
      for (let r = 200; r <= plazaRadius; r += 200) {
          this.drawOctagon(ctx, 0, 0, r, true); // True = stroke only
      }
      ctx.globalAlpha = 1.0;
  }

  private drawOctagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, stroke: boolean = false) {
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          IsoUtils.toIso(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 0, this._p1);
          if (i === 0) ctx.moveTo(this._p1.x, this._p1.y);
          else ctx.lineTo(this._p1.x, this._p1.y);
      }
      ctx.closePath();
      if (stroke) ctx.stroke();
  }
}
