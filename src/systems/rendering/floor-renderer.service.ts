
import { Injectable, inject } from '@angular/core';
import { Zone, Camera, Entity } from '../../models/game.models';
import { IsoUtils } from '../../utils/iso-utils';
import { EntityRendererService } from './entity-renderer.service';
import { RENDER_CONFIG } from './render.config';
import { SpatialHashService } from '../spatial-hash.service';

@Injectable({ providedIn: 'root' })
export class FloorRendererService {
  private entityRenderer = inject(EntityRendererService);
  private spatialHash = inject(SpatialHashService);
  
  // Cache System
  private floorCanvas: HTMLCanvasElement | null = null;
  private floorCtx: CanvasRenderingContext2D | null = null;
  private lastZoneId: string = '';
  private lastViewX: number = -99999;
  private lastViewY: number = -99999;
  private lastZoom: number = 1;
  private readonly CACHE_PADDING = RENDER_CONFIG.FLOOR_CACHE_PADDING; 

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
      
      const needsRedraw = 
          zone.id !== this.lastZoneId ||
          cam.zoom !== this.lastZoom ||
          Math.abs(cam.x - this.lastViewX) > this.CACHE_PADDING / 2 ||
          Math.abs(cam.y - this.lastViewY) > this.CACHE_PADDING / 2;

      if (needsRedraw) {
          this.updateCache(cam, zone, mapBounds, canvasWidth, canvasHeight);
      }

      const cacheCenterIso = IsoUtils.toIso(this.lastViewX, this.lastViewY, 0);
      
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
      
      ctx.fillStyle = zone.groundColor;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(width/2, height/2);
      
      const centerIso = IsoUtils.toIso(this.lastViewX, this.lastViewY, 0);
      ctx.translate(-centerIso.x, -centerIso.y);

      // 1. Draw Ground Tiles
      if (zone.floorPattern === 'HUB') {
          this.drawHubFloor(ctx, zone);
      } else {
          this.drawGridFloor(ctx, zone, mapBounds, width, height);
      }

      // 2. Draw Static Decorations via Spatial Hash Query
      // Calculate world bounds of the cache area (inverse iso projection approx)
      // Since it's a large rect, simple AABB centered on view is sufficient
      const range = Math.max(width, height) * 1.5; // Padding for safety
      
      // FIX: Use zone ID to query spatial hash for decorations
      const entities = this.spatialHash.queryRect(
          this.lastViewX - range, 
          this.lastViewY - range, 
          this.lastViewX + range, 
          this.lastViewY + range,
          zone.id
      );

      for (const d of entities) {
          // Filter for decorations that belong on the floor layer
          if (d.type === 'DECORATION' && (d.subType === 'RUG' || d.subType === 'FLOOR_CRACK' || d.subType === 'GRAFFITI')) {
              this.entityRenderer.drawDecoration(ctx, d);
          }
      }
      
      ctx.restore();
  }

  private drawGridFloor(ctx: CanvasRenderingContext2D, zone: Zone, mapBounds: any, width: number, height: number) {
      const tileSize = RENDER_CONFIG.FLOOR_TILE_SIZE;
      const range = Math.max(width, height) * 1.5;
      
      const startX = Math.max(mapBounds.minX, Math.floor((this.lastViewX - range) / tileSize) * tileSize);
      const endX = Math.min(mapBounds.maxX, this.lastViewX + range);
      const startY = Math.max(mapBounds.minY, Math.floor((this.lastViewY - range) / tileSize) * tileSize);
      const endY = Math.min(mapBounds.maxY, this.lastViewY + range);

      for (let x = startX; x <= endX; x += tileSize) {
          for (let y = startY; y <= endY; y += tileSize) {
               this.drawTile(ctx, x, y, tileSize, zone);
          }
      }
  }

  private drawHubFloor(ctx: CanvasRenderingContext2D, zone: Zone) {
      const plazaRadius = 1200;
      ctx.fillStyle = '#18181b'; 
      this.drawOctagon(ctx, 0, 0, plazaRadius);
      ctx.fill();
      
      ctx.strokeStyle = zone.detailColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.1;
      
      for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const p1 = IsoUtils.toIso(0, 0, 0);
          const p2 = IsoUtils.toIso(Math.cos(angle) * plazaRadius, Math.sin(angle) * plazaRadius, 0);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
      }

      for (let r = 200; r <= plazaRadius; r += 200) {
          this.drawOctagon(ctx, 0, 0, r);
          ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
  }

  private drawOctagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const p = IsoUtils.toIso(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 0);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
  }

  private drawTile(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, zone: Zone) {
      const p1 = IsoUtils.toIso(x, y, 0); 
      const p2 = IsoUtils.toIso(x + size, y, 0); 
      const p3 = IsoUtils.toIso(x + size, y + size, 0); 
      const p4 = IsoUtils.toIso(x, y + size, 0);
      
      ctx.fillStyle = zone.groundColor; 
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.fill();
      
      if (zone.floorPattern === 'GRID') { 
          ctx.strokeStyle = zone.detailColor; ctx.globalAlpha = 0.1; ctx.stroke(); 
      } else if (zone.floorPattern === 'HAZARD') { 
          ctx.strokeStyle = '#3f3f46'; ctx.globalAlpha = 0.05; 
          ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p3.x, p3.y); ctx.stroke(); 
      } else { 
          ctx.strokeStyle = '#3f3f46'; ctx.globalAlpha = 0.05; ctx.stroke(); 
          if ((x ^ y) % 7 === 0) {
              ctx.fillStyle = '#555'; ctx.fillRect(p1.x - 1, p1.y - 1, 2, 2);
          }
      }
      ctx.globalAlpha = 1.0;
  }
}
