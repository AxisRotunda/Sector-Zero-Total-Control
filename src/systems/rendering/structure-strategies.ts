
import { Injectable, inject } from '@angular/core';
import { Entity } from '../../models/game.models';
import { IsoUtils } from '../../utils/iso-utils';
import { StructurePrimitivesService } from './structure-primitives.service';
import { ThemeVisuals } from './texture-generator.service';
import { SpriteCacheService } from './sprite-cache.service';

export interface IStructureRenderer {
  canHandle(entity: Entity): boolean;
  render(ctx: CanvasRenderingContext2D, entity: Entity, visuals: ThemeVisuals): void;
}

@Injectable({ providedIn: 'root' })
export class GateRenderer implements IStructureRenderer {
  private prims = inject(StructurePrimitivesService);
  private cache = inject(SpriteCacheService);

  canHandle(e: Entity): boolean { return e.subType === 'GATE_SEGMENT'; }

  render(ctx: CanvasRenderingContext2D, e: Entity, visuals: ThemeVisuals) {
      const w = e.width || 200;
      const d = e.depth || 40;
      const h = e.height || 300;
      
      const openness = e.openness || 0; 
      const maxSlide = w * 0.45;
      const slideAmount = maxSlide * openness;
      const leftOffset = -w/4 - slideAmount;
      const rightOffset = w/4 + slideAmount;
      
      const panelW = w / 2;
      const isoBounds = this.prims.calculateIsoBounds(panelW, d, h);
      const padding = 60;
      const cW = Math.ceil(isoBounds.maxX - isoBounds.minX + padding * 2);
      const cH = Math.ceil(isoBounds.maxY - isoBounds.minY + padding * 2);
      const aX = -isoBounds.minX + padding;
      const aY = -isoBounds.minY + padding;

      // Cache keys
      const leftKey = `GATE_PANEL_L_${w}_${d}_${h}_${e.color}_${visuals.edgeColor}_v4`;
      const rightKey = `GATE_PANEL_R_${w}_${d}_${h}_${e.color}_${visuals.edgeColor}_${e.locked}_v4`;

      const leftSprite = this.cache.getOrRender(leftKey, cW, cH, (bCtx) => {
          this.prims.renderPrism(bCtx, panelW, d, h, aX, aY, e.color, visuals, 'PLATING');
          bCtx.translate(aX, aY);
          bCtx.strokeStyle = '#facc15'; bCtx.lineWidth = 4;
          const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);
          const baseB = p(panelW/2, d/2, 0);
          bCtx.beginPath(); bCtx.moveTo(baseB.x - 20, baseB.y - 20); bCtx.lineTo(baseB.x, baseB.y); bCtx.stroke();
          bCtx.translate(-aX, -aY);
      });

      const rightSprite = this.cache.getOrRender(rightKey, cW, cH, (bCtx) => {
          this.prims.renderPrism(bCtx, panelW, d, h, aX, aY, e.color, visuals, 'PLATING');
          bCtx.translate(aX, aY);
          const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);
          const topB = p(-panelW/2, d/2, h - 40); 
          bCtx.fillStyle = e.locked ? '#ef4444' : '#22c55e';
          bCtx.shadowColor = bCtx.fillStyle; bCtx.shadowBlur = 10;
          bCtx.beginPath(); bCtx.arc(topB.x, topB.y, 6, 0, Math.PI*2); bCtx.fill();
          bCtx.shadowBlur = 0;
          bCtx.translate(-aX, -aY);
      });

      const worldPos = IsoUtils.toIso(e.x, e.y, 0);
      const lIso = IsoUtils.toIso(leftOffset, 0, 0);
      ctx.drawImage(leftSprite, Math.floor(worldPos.x + lIso.x - aX), Math.floor(worldPos.y + lIso.y - aY));
      const rIso = IsoUtils.toIso(rightOffset, 0, 0);
      ctx.drawImage(rightSprite, Math.floor(worldPos.x + rIso.x - aX), Math.floor(worldPos.y + rIso.y - aY));
  }
}

@Injectable({ providedIn: 'root' })
export class MonolithRenderer implements IStructureRenderer {
  canHandle(e: Entity): boolean { return e.subType === 'MONOLITH'; }

  render(ctx: CanvasRenderingContext2D, e: Entity, visuals: ThemeVisuals) {
      const w = e.width || 200;
      const d = e.depth || 200;
      const h = e.height || 600;
      const pos = IsoUtils.toIso(e.x, e.y, e.z || 0); 
      
      ctx.save();
      ctx.translate(pos.x, pos.y);
      
      const t = Date.now() * 0.0005;
      const halfW = w / 2; const halfD = d / 2;
      const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);

      const height = h + Math.sin(t * 2) * 10;

      const topT = p(-halfW, -halfD, height); const topR = p(halfW, -halfD, height); 
      const topB = p(halfW, halfD, height); const topL = p(-halfW, halfD, height);
      const baseB = p(halfW, halfD, 0); const baseR = p(halfW, -halfD, 0); const baseL = p(-halfW, halfD, 0);

      const hue = (t * 20) % 360;
      const baseColor = `hsla(${hue}, 60%, 20%, 0.8)`;
      const highlightColor = `hsla(${(hue + 180) % 360}, 80%, 60%, 0.4)`;

      const grad = ctx.createLinearGradient(0, topT.y, 0, baseB.y);
      grad.addColorStop(0, '#000000'); grad.addColorStop(0.5, baseColor); grad.addColorStop(1, '#000000');
      
      ctx.fillStyle = grad;
      ctx.shadowBlur = 30; ctx.shadowColor = `hsla(${hue}, 80%, 50%, 0.3)`;

      ctx.beginPath(); ctx.moveTo(baseB.x, baseB.y); ctx.lineTo(baseR.x, baseR.y); ctx.lineTo(topR.x, topR.y); ctx.lineTo(topB.x, topB.y); ctx.fill();
      ctx.beginPath(); ctx.moveTo(baseB.x, baseB.y); ctx.lineTo(baseL.x, baseL.y); ctx.lineTo(topL.x, topL.y); ctx.lineTo(topB.x, topB.y); ctx.fill();

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = highlightColor;
      
      const sliceH = height / 5;
      for (let i = 0; i < 5; i++) {
          const sliceOffset = (t * 2 + i) % 5;
          if (sliceOffset < 1) continue; 
          
          const zStart = sliceOffset * sliceH;
          const zEnd = zStart + 20; 
          if (zEnd > height) continue;

          const b1 = p(halfW, halfD, zStart); const b2 = p(-halfW, halfD, zStart);
          const t1 = p(halfW, halfD, zEnd); const t2 = p(-halfW, halfD, zEnd);
          
          ctx.beginPath(); ctx.moveTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t1.x, t1.y); ctx.fill();
      }
      ctx.restore();

      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(baseB.x, baseB.y); ctx.lineTo(topB.x, topB.y); ctx.stroke();
      ctx.shadowBlur = 0; ctx.globalAlpha = 1.0;
      
      ctx.restore();
  }
}

@Injectable({ providedIn: 'root' })
export class DynamicGlowRenderer implements IStructureRenderer {
  private cache = inject(SpriteCacheService);
  private prims = inject(StructurePrimitivesService);

  canHandle(e: Entity): boolean { return e.subType === 'DYNAMIC_GLOW'; }

  render(ctx: CanvasRenderingContext2D, e: Entity, visuals: ThemeVisuals) {
      const w = e.width || 150; 
      const d = e.depth || 150;
      const z = e.height || 0;
      const pos = IsoUtils.toIso(e.x, e.y, e.z || 0);
      
      const cacheKey = `GLOW_GRATE_${w}_${d}_${e.color}_v2`;
      
      const isoBounds = this.prims.calculateIsoBounds(w, d, 20);
      const padding = 20;
      const cW = Math.ceil(isoBounds.maxX - isoBounds.minX + padding * 2);
      const cH = Math.ceil(isoBounds.maxY - isoBounds.minY + padding * 2);
      const aX = -isoBounds.minX + padding;
      const aY = -isoBounds.minY + padding;
      
      const sprite = this.cache.getOrRender(cacheKey, cW, cH, (bCtx) => {
          bCtx.translate(aX, aY);
          this.renderGrate(bCtx, w, d, e.color || '#f59e0b');
          bCtx.translate(-aX, -aY);
      });
      
      ctx.drawImage(sprite, Math.floor(pos.x - aX), Math.floor(pos.y + z - aY));
  }

  private renderGrate(ctx: any, w: number, d: number, color: string) {
      const hw = w / 2; const hd = d / 2;
      const p = (lx: number, ly: number) => IsoUtils.toIso(lx, ly, 0);
      
      const tl = p(-hw, -hd); const tr = p(hw, -hd);
      const br = p(hw, hd); const bl = p(-hw, hd);
      
      ctx.fillStyle = '#0f172a';
      ctx.beginPath(); ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y); ctx.fill();
      
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const center = p(0,0);
      const glowGrad = ctx.createRadialGradient(center.x, center.y, w*0.1, center.x, center.y, w*0.6);
      glowGrad.addColorStop(0, color); glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glowGrad; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y); ctx.fill(); ctx.restore();

      ctx.strokeStyle = '#334155'; ctx.lineWidth = 4;
      for (let i = 0; i <= 6; i++) {
          const t = i / 6; const x = -hw + (w * t);
          const p1 = p(x, -hd); const p2 = p(x, hd);
          ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      }
      
      ctx.lineWidth = 6; ctx.strokeStyle = '#475569';
      ctx.beginPath(); ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y); ctx.closePath(); ctx.stroke();
  }
}
