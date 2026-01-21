
import { Injectable, inject } from '@angular/core';
import { Entity, Zone } from '../../models/game.models';
import { IsoUtils } from '../../utils/iso-utils';
import { SpriteCacheService } from './sprite-cache.service';
import { SpriteRegistryService } from './sprite-registry.service';

@Injectable({ providedIn: 'root' })
export class StructureRendererService {
  private cache = inject(SpriteCacheService);
  private registry = inject(SpriteRegistryService);

  drawStructure(ctx: CanvasRenderingContext2D, e: Entity, zone: Zone) {
      if (e.subType === 'BARRIER') { this.drawEnergyBarrier(ctx, e); return; }
      
      // 1. Try Sprite Registry (High Performance, High Fidelity)
      if (e.spriteId) {
          const sprite = this.registry.getSprite(e.spriteId);
          if (sprite) {
              const pos = IsoUtils.toIso(e.x, e.y, 0);
              ctx.drawImage(sprite.canvas, 
                  Math.floor(pos.x - sprite.anchorX), 
                  Math.floor(pos.y - sprite.anchorY)
              );
              return;
          }
      }

      // 2. Fallback to Legacy Procedural Generation (Slow, but flexible)
      this.drawLegacyStructure(ctx, e);
  }

  // Legacy rendering logic maintained for dynamic structures not in registry
  private drawLegacyStructure(ctx: CanvasRenderingContext2D, e: Entity) {
      const w = e.width || 40; 
      const d = e.depth || w;
      const h = e.height || 100;
      
      const cacheKey = `LEGACY_STRUCT_${e.type}_${e.subType}_${w}_${d}_${h}_${e.color}_${e.locked}`;
      
      const isoBounds = this.calculateIsoBounds(w, d, h);
      const padding = 60;
      const canvasW = Math.ceil(isoBounds.maxX - isoBounds.minX + padding * 2);
      const canvasH = Math.ceil(isoBounds.maxY - isoBounds.minY + padding * 2);
      
      if (canvasW <= 0 || canvasH <= 0 || canvasW > 4096 || canvasH > 4096) return;

      const anchorX = -isoBounds.minX + padding;
      const anchorY = -isoBounds.minY + padding;

      const sprite = this.cache.getOrRender(cacheKey, canvasW, canvasH, (bufferCtx) => {
          this.renderStructureToBuffer(bufferCtx, e, w, d, h, anchorX, anchorY);
      });

      const pos = IsoUtils.toIso(e.x, e.y, 0);
      ctx.drawImage(sprite, Math.floor(pos.x - anchorX), Math.floor(pos.y - anchorY)); 
  }

  drawFloorDecoration(ctx: CanvasRenderingContext2D, e: Entity) {
      const pos = IsoUtils.toIso(e.x, e.y, e.z || 0);
      ctx.save();
      ctx.translate(pos.x, pos.y);
      
      if (e.subType === 'RUG') {
          const w = e.width || 400; const h = e.height || 400;
          const p1 = IsoUtils.toIso(-w/2, -h/2, 0);
          const p2 = IsoUtils.toIso(w/2, -h/2, 0);
          const p3 = IsoUtils.toIso(w/2, h/2, 0);
          const p4 = IsoUtils.toIso(-w/2, h/2, 0);
          
          ctx.fillStyle = e.color;
          ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.fill();
      } else if (e.subType === 'GRAFFITI') {
          ctx.font = 'bold 40px monospace';
          ctx.fillStyle = e.color;
          ctx.globalAlpha = 0.6;
          ctx.scale(1, 0.5);
          ctx.fillText("NO HOPE", 0, 0);
      } else if (e.subType === 'TRASH') {
          ctx.fillStyle = '#27272a';
          ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#3f3f46';
          ctx.beginPath(); ctx.arc(5, 5, 8, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
  }

  private drawEnergyBarrier(ctx: CanvasRenderingContext2D, e: Entity) {
      const pos = IsoUtils.toIso(e.x, e.y, e.z || 0);
      const w = e.width || 80; const h = 100;
      
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.fillStyle = e.color;
      ctx.globalAlpha = 0.4 + Math.sin(Date.now() * 0.01) * 0.2;
      ctx.fillRect(-w/2, -h, w, h);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
      ctx.strokeRect(-w/2, -h, w, h);
      ctx.restore();
  }

  private calculateIsoBounds(width: number, length: number, height: number) {
      const hw = width / 2;
      const hl = length / 2;
      const corners = [
          {x: -hw, y: -hl, z: 0}, {x: hw, y: -hl, z: 0}, {x: hw, y: hl, z: 0}, {x: -hw, y: hl, z: 0},
          {x: -hw, y: -hl, z: height}, {x: hw, y: -hl, z: height}, {x: hw, y: hl, z: height}, {x: -hw, y: hl, z: height}
      ];
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const c of corners) {
          const iso = IsoUtils.toIso(c.x, c.y, c.z);
          if (iso.x < minX) minX = iso.x; if (iso.x > maxX) maxX = iso.x;
          if (iso.y < minY) minY = iso.y; if (iso.y > maxY) maxY = iso.y;
      }
      return { minX, maxX, minY, maxY };
  }

  private renderStructureToBuffer(ctx: any, e: Entity, width: number, length: number, height: number, anchorX: number, anchorY: number) {
      ctx.translate(anchorX, anchorY);
      
      const hw = width / 2; 
      const hl = length / 2;
      const p = (x: number, y: number, z: number) => IsoUtils.toIso(x, y, z);

      const basePoints = [
          p(-hw, hl, 0), p(hw, hl, 0), p(hw, -hl, 0), p(-hw, -hl, 0)
      ];
      const topPoints = [
          p(-hw, hl, height), p(hw, hl, height), p(hw, -hl, height), p(-hw, -hl, height)
      ];

      // Draw sides (Simplified: only draw visible sides for standard Iso view)
      // Visible sides: Top, Left (-x), Bottom (+y) - assuming camera angle
      
      // Side 1 (Left Face)
      ctx.fillStyle = this.adjustColor(e.color, -20);
      ctx.beginPath();
      ctx.moveTo(basePoints[0].x, basePoints[0].y);
      ctx.lineTo(basePoints[3].x, basePoints[3].y);
      ctx.lineTo(topPoints[3].x, topPoints[3].y);
      ctx.lineTo(topPoints[0].x, topPoints[0].y);
      ctx.fill();

      // Side 2 (Right/Bottom Face)
      ctx.fillStyle = this.adjustColor(e.color, -40);
      ctx.beginPath();
      ctx.moveTo(basePoints[0].x, basePoints[0].y);
      ctx.lineTo(basePoints[1].x, basePoints[1].y);
      ctx.lineTo(topPoints[1].x, topPoints[1].y);
      ctx.lineTo(topPoints[0].x, topPoints[0].y);
      ctx.fill();

      // Top Face
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(topPoints[0].x, topPoints[0].y);
      ctx.lineTo(topPoints[1].x, topPoints[1].y);
      ctx.lineTo(topPoints[2].x, topPoints[2].y);
      ctx.lineTo(topPoints[3].x, topPoints[3].y);
      ctx.fill();
      
      // Highlight edges
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();
  }

  private adjustColor(hex: string, percent: number) {
      if (!hex || !hex.startsWith('#')) return '#333333';
      let R = parseInt(hex.substring(1,3),16); let G = parseInt(hex.substring(3,5),16); let B = parseInt(hex.substring(5,7),16);
      R = Math.min(255, Math.max(0, R + percent)); G = Math.min(255, Math.max(0, G + percent)); B = Math.min(255, Math.max(0, B + percent));
      const RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16)); const GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16)); const BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));
      return "#"+RR+GG+BB;
  }
}
