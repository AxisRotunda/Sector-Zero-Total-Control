
import { Injectable, inject, Injector } from '@angular/core';
import { Entity, Zone } from '../../models/game.models';
import { IsoUtils } from '../../utils/iso-utils';
import { SpriteCacheService } from './sprite-cache.service';
import { TextureGeneratorService, ThemeVisuals } from './texture-generator.service';
import { DECORATIONS } from '../../config/decoration.config';
import { StructurePrimitivesService } from './structure-primitives.service';
import { IStructureRenderer, GateRenderer, MonolithRenderer, DynamicGlowRenderer } from './structure-strategies';

@Injectable({ providedIn: 'root' })
export class StructureRendererService {
  private cache = inject(SpriteCacheService);
  private textureGen = inject(TextureGeneratorService);
  private prims = inject(StructurePrimitivesService);
  private injector = inject(Injector);

  private strategies: IStructureRenderer[] = [];

  constructor() {
      // Register strategies
      // Ideally these are multi-providers, but manual registry is fine for minimal complexity
      this.strategies = [
          this.injector.get(GateRenderer),
          this.injector.get(MonolithRenderer),
          this.injector.get(DynamicGlowRenderer)
          // Add BannerRenderer etc. as needed
      ];
  }

  drawStructure(ctx: CanvasRenderingContext2D, e: Entity, zone: Zone) {
      const theme = zone ? zone.theme : 'INDUSTRIAL';
      const visuals = this.textureGen.getThemeVisuals(theme);

      // 1. Try Strategy
      for (const strategy of this.strategies) {
          if (strategy.canHandle(e)) {
              strategy.render(ctx, e, visuals);
              return;
          }
      }

      // 2. Specialized Non-Strategy Legacy Renderers (Gradually migrating these is best practice)
      // For now, keeping inline to match "Minimal Functional" req without over-engineering 20 files
      if (e.subType === 'CABLE') { this.drawCable(ctx, e); return; }
      if (e.subType === 'BANNER') { this.drawBanner(ctx, e); return; }
      if (e.subType === 'HOLO_SIGN') { this.drawHoloSign(ctx, e); return; }
      if (e.subType === 'BARRIER') { this.drawEnergyBarrier(ctx, e); return; }

      // 3. Generic Cached Prism Renderer
      const structureType = e.subType || 'WALL';
      let w = e.width || 40;
      let d = e.depth || e.width || 40;
      let h = e.height || 100;
      let renderStyle = 'PRISM';
      let detailStyle = visuals.detailStyle;

      if (DECORATIONS[structureType]) {
          const config = DECORATIONS[structureType];
          if (!e.width) w = config.width;
          if (!e.depth) d = config.depth;
          if (!e.height) h = config.height;
          if (config.renderStyle) renderStyle = config.renderStyle;
          if (config.detailStyle) detailStyle = config.detailStyle;
      }

      const cacheKey = `STRUCT_${structureType}_${w}_${d}_${h}_${e.color}_${theme}_${e.locked}_${detailStyle}_v11`;
      
      const isoBounds = this.prims.calculateIsoBounds(w, d, h);
      const padding = 120;
      const canvasW = Math.ceil(isoBounds.maxX - isoBounds.minX + padding * 2);
      const canvasH = Math.ceil(isoBounds.maxY - isoBounds.minY + padding * 2);
      
      if (canvasW <= 0 || canvasH <= 0 || canvasW > 4096 || canvasH > 4096) return;

      const anchorX = -isoBounds.minX + padding;
      const anchorY = -isoBounds.minY + padding;

      const sprite = this.cache.getOrRender(cacheKey, canvasW, canvasH, (bufferCtx) => {
          this.prims.renderPrism(bufferCtx, w, d, h, anchorX, anchorY, e.color, visuals, detailStyle);
      });

      const pos = IsoUtils.toIso(e.x, e.y, e.z || 0); 
      ctx.drawImage(sprite, Math.floor(pos.x - anchorX), Math.floor(pos.y - anchorY)); 
  }

  // --- LEGACY HELPERS (To be migrated to Strategies later) ---

  private drawBanner(ctx: CanvasRenderingContext2D, e: Entity) {
      const w = e.width || 60; const h = e.height || 180; const pos = IsoUtils.toIso(e.x, e.y, e.z || 200);
      ctx.save(); ctx.translate(pos.x, pos.y);
      const wind = Math.sin(Date.now() * 0.002 + e.id) * 5;
      ctx.fillStyle = e.color || '#06b6d4';
      ctx.beginPath(); ctx.moveTo(-w/2, 0); ctx.lineTo(w/2, 0); ctx.lineTo(w/2 + wind, h); ctx.lineTo(0, h - 20); ctx.lineTo(-w/2 + wind, h); ctx.closePath(); ctx.fill();
      ctx.restore();
  }

  private drawHoloSign(ctx: CanvasRenderingContext2D, e: Entity) {
      const w = e.width || 120; const h = e.height || 60; const pos = IsoUtils.toIso(e.x, e.y, e.z || 150);
      ctx.save(); ctx.translate(pos.x, pos.y);
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = e.color || '#ef4444'; ctx.shadowColor = e.color || '#ef4444'; ctx.shadowBlur = 15;
      ctx.transform(1, -0.2, 0, 1, 0, 0); ctx.fillRect(-w/2, -h/2, w, h);
      ctx.restore();
  }

  private drawCable(ctx: CanvasRenderingContext2D, e: Entity) {
      if (!e.targetX || !e.targetY) return;
      const start = IsoUtils.toIso(e.x, e.y, e.z); const endZ = 120; const end = IsoUtils.toIso(e.targetX, e.targetY, endZ);
      ctx.strokeStyle = '#18181b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(start.x, start.y);
      const midX = (start.x + end.x) / 2; const midY = (start.y + end.y) / 2; ctx.quadraticCurveTo(midX, midY + 50, end.x, end.y); ctx.stroke();
  }

  private drawEnergyBarrier(ctx: CanvasRenderingContext2D, e: Entity) {
      const h = e.height || 150; const w = e.width || 100; const d = e.depth || 20; const pos = IsoUtils.toIso(e.x, e.y, 0);
      ctx.save(); ctx.translate(pos.x, pos.y);
      const hw = w/2; const hd = d/2;
      const p1 = IsoUtils.toIso(-hw, hd, 0); const p2 = IsoUtils.toIso(hw, hd, 0); const p3 = IsoUtils.toIso(hw, hd, h); const p4 = IsoUtils.toIso(-hw, hd, h);
      ctx.fillStyle = '#18181b'; ctx.fillRect(p1.x - 5, p1.y - 5, 10, 10); ctx.fillRect(p2.x - 5, p2.y - 5, 10, 10);
      ctx.globalCompositeOperation = 'screen';
      const grad = ctx.createLinearGradient(0, p1.y, 0, p3.y); 
      grad.addColorStop(0, `${e.color}00`); grad.addColorStop(0.5, `${e.color}40`); grad.addColorStop(1, `${e.color}00`); 
      ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.fill();
      ctx.restore();
  }

  drawFloorDecoration(ctx: CanvasRenderingContext2D, e: Entity) {
      const config = DECORATIONS[e.subType || ''] || { width: 40, depth: 40, height: 40, baseColor: '#333' };
      const w = e.width || config.width; const h = e.height || config.depth; const pos = IsoUtils.toIso(e.x, e.y, 0);
      ctx.save(); ctx.translate(pos.x, pos.y);
      const hw = w/2; const hh = h/2;
      const p1 = IsoUtils.toIso(-hw, hh, 0); const p2 = IsoUtils.toIso(hw, hh, 0);  
      const p3 = IsoUtils.toIso(hw, -hh, 0); const p4 = IsoUtils.toIso(-hw, -hh, 0);
      if (e.subType === 'RUG') {
          ctx.fillStyle = e.data?.color || e.color || config.baseColor;
          ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.fill();
      }
      ctx.restore();
  }
}
