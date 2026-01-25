
import { Injectable, inject } from '@angular/core';
import { Entity, Zone } from '../../models/game.models';
import { IsoUtils } from '../../utils/iso-utils';
import { SpriteCacheService } from './sprite-cache.service';
import { TextureGeneratorService, ThemeVisuals } from './texture-generator.service';
import { DECORATIONS } from '../../config/decoration.config';
import { NarrativeService } from '../../game/narrative.service';

@Injectable({ providedIn: 'root' })
export class StructureRendererService {
  private cache = inject(SpriteCacheService);
  private textureGen = inject(TextureGeneratorService);
  private narrative = inject(NarrativeService);

  private gateStateCache = new Map<string, number>();
  // OPTIMIZATION: Memoize structure cache keys to avoid constant string concatenation
  private keyCache = new WeakMap<Entity, string>();

  // Vector Pools to prevent GC allocation in hot paths
  private _isoMinMax = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  private _p1 = { x: 0, y: 0 };
  private _p2 = { x: 0, y: 0 };
  private _p3 = { x: 0, y: 0 };
  private _p4 = { x: 0, y: 0 };
  private _isoTemp = { x: 0, y: 0 };

  drawStructure(ctx: CanvasRenderingContext2D, e: Entity, zone: Zone) {
      const theme = zone ? zone.theme : 'INDUSTRIAL';
      const visuals = this.textureGen.getThemeVisuals(theme);

      // Strategy Routing (Internal Methods)
      if (e.subType === 'GATE_SEGMENT') { this.renderGate(ctx, e, visuals); return; }
      if (e.subType === 'MONOLITH') { this.renderMonolith(ctx, e, visuals); return; }
      if (e.subType === 'DYNAMIC_GLOW') { this.renderDynamicGlow(ctx, e, visuals); return; }
      
      // Legacy Specialized
      if (e.subType === 'CABLE') { this.drawCable(ctx, e); return; }
      if (e.subType === 'BANNER') { this.drawBanner(ctx, e); return; }
      if (e.subType === 'HOLO_SIGN') { this.drawHoloSign(ctx, e); return; }
      if (e.subType === 'BARRIER') { this.drawEnergyBarrier(ctx, e); return; }

      // Standard Prism Renderer
      
      // OPTIMIZATION: Check Cache Key first
      let cacheKey = this.keyCache.get(e);
      let w = e.width || 40;
      let d = e.depth || e.width || 40;
      let h = e.height || 100;
      let detailStyle = visuals.detailStyle;

      if (!cacheKey) {
          const structureType = e.subType || 'WALL';
          
          if (DECORATIONS[structureType]) {
              const config = DECORATIONS[structureType];
              if (!e.width) w = config.width;
              if (!e.depth) d = config.depth;
              if (!e.height) h = config.height;
              if (config.detailStyle) detailStyle = config.detailStyle;
          }

          cacheKey = `STRUCT_${structureType}_${w}_${d}_${h}_${e.color}_${theme}_${e.locked}_${detailStyle}_v12`;
          this.keyCache.set(e, cacheKey);
      } else {
          // Re-derive W/D/H if needed, but for rendering we need them. 
          // If we hit cache, we assume standard properties.
          // For safety in this hybrid implementation, we just recalculate w/d/h cheaply:
          if (DECORATIONS[e.subType || 'WALL']) {
              const config = DECORATIONS[e.subType || 'WALL'];
              if (!e.width) w = config.width;
              if (!e.depth) d = config.depth;
              if (!e.height) h = config.height;
          }
      }
      
      // Use zero-alloc bounds calculation
      const isoBounds = this.calculateIsoBounds(w, d, h);
      const padding = 120;
      const canvasW = Math.ceil(isoBounds.maxX - isoBounds.minX + padding * 2);
      const canvasH = Math.ceil(isoBounds.maxY - isoBounds.minY + padding * 2);
      
      if (canvasW <= 0 || canvasH <= 0 || canvasW > 4096 || canvasH > 4096) return;

      const anchorX = -isoBounds.minX + padding;
      const anchorY = -isoBounds.minY + padding;

      const sprite = this.cache.getOrRender(cacheKey, canvasW, canvasH, (bufferCtx) => {
          this.renderPrism(bufferCtx, w, d, h, anchorX, anchorY, e.color, visuals, detailStyle);
      });

      // Use pooled vector
      const pos = IsoUtils.toIso(e.x, e.y, e.z || 0, this._isoTemp); 
      ctx.drawImage(sprite, Math.floor(pos.x - anchorX), Math.floor(pos.y - anchorY)); 
  }

  // --- FLOOR DECORATIONS ---
  drawFloorDecoration(ctx: CanvasRenderingContext2D, e: Entity) {
      const config = DECORATIONS[e.subType || ''] || { 
          width: 40, depth: 40, height: 40, baseColor: '#333' 
      };

      const w = e.width || config.width;
      const d = e.depth || e.height || w; 
      
      const hw = w / 2;
      const hd = d / 2;

      // Use reused vectors for projection
      const p1 = IsoUtils.toIso(e.x - hw, e.y - hd, 0, this._p1);
      const p2 = IsoUtils.toIso(e.x + hw, e.y - hd, 0, this._p2);
      const p3 = IsoUtils.toIso(e.x + hw, e.y + hd, 0, this._p3);
      const p4 = IsoUtils.toIso(e.x - hw, e.y + hd, 0, this._p4);

      if (e.subType === 'GRAFFITI') {
          const center = IsoUtils.toIso(e.x, e.y, 0, this._isoTemp);
          ctx.save();
          ctx.translate(center.x, center.y);
          ctx.scale(1, 0.5); 
          ctx.rotate(-Math.PI / 12);

          ctx.font = '900 40px Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          ctx.shadowColor = e.color || config.baseColor;
          ctx.shadowBlur = 10;
          ctx.fillStyle = e.color || config.baseColor;
          ctx.globalAlpha = 0.8;
          
          ctx.fillText(e.data?.label || 'RESIST', 0, 0);
          ctx.restore();
          return;
      }

      if (e.subType === 'TRASH') {
          ctx.fillStyle = e.color || config.baseColor;
          const debris = [
              { dx: -5, dy: 5, w: 4, h: 2 },
              { dx: 10, dy: -5, w: 3, h: 3 },
              { dx: 2, dy: 2, w: 5, h: 2 },
              { dx: -8, dy: -8, w: 3, h: 3 }
          ];
          
          // Optimization: No map allocation
          for(const bit of debris) {
              const pos = IsoUtils.toIso(e.x + bit.dx, e.y + bit.dy, 0, this._isoTemp);
              ctx.fillRect(Math.floor(pos.x), Math.floor(pos.y), bit.w, bit.h);
          }
          return;
      }

      // RUG / GENERIC FILL
      ctx.fillStyle = e.data?.color || e.color || config.baseColor;
      
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.closePath();
      ctx.fill();

      // Border for Rugs
      if (e.subType === 'RUG') {
          ctx.strokeStyle = this.textureGen.adjustColor(ctx.fillStyle as string, -20);
          ctx.lineWidth = 2;
          ctx.stroke();
      }

      // Simple details
      if (e.subType === 'FLOOR_CRACK') {
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y); 
          ctx.lineTo(p3.x, p3.y);
          ctx.stroke();
      }
  }

  // --- INTERNAL STRATEGIES (Consolidated) ---

  private renderGate(ctx: CanvasRenderingContext2D, e: Entity, visuals: ThemeVisuals) {
      const w = e.width || 200;
      const d = e.depth || 40;
      const h = e.height || 300;
      
      const openness = e.openness || 0; 
      const lastOpenness = this.gateStateCache.get(String(e.id)) ?? -1;

      // OPTIMIZATION: If gate is fully closed and hasn't moved, draw cached composite
      if (openness === 0 && openness === lastOpenness) {
          const compositeKey = `GATE_COMPOSITE_${e.id}_CLOSED_v1`;
          const isoBounds = this.calculateIsoBounds(w, d, h);
          const padding = 60;
          const cW = Math.ceil(isoBounds.maxX - isoBounds.minX + padding * 2);
          const cH = Math.ceil(isoBounds.maxY - isoBounds.minY + padding * 2);
          const aX = -isoBounds.minX + padding;
          const aY = -isoBounds.minY + padding;

          const composite = this.cache.getOrRender(compositeKey, cW, cH, (bCtx) => {
              this.drawGatePanels(bCtx, e, visuals, w, d, h, 0, aX, aY);
          });

          const pos = IsoUtils.toIso(e.x, e.y, 0, this._isoTemp);
          ctx.drawImage(composite, Math.floor(pos.x - aX), Math.floor(pos.y - aY));
          return;
      }

      this.gateStateCache.set(String(e.id), openness);

      const maxSlide = w * 0.45;
      const slideAmount = maxSlide * openness;
      
      const panelW = w / 2;
      const isoBounds = this.calculateIsoBounds(panelW, d, h);
      const padding = 60;
      const cW = Math.ceil(isoBounds.maxX - isoBounds.minX + padding * 2);
      const cH = Math.ceil(isoBounds.maxY - isoBounds.minY + padding * 2);
      const aX = -isoBounds.minX + padding;
      const aY = -isoBounds.minY + padding;

      // Draw dynamic state using individual cached panels
      this.drawGatePanels(ctx, e, visuals, w, d, h, slideAmount, 0, 0);
  }

  private drawGatePanels(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, e: Entity, visuals: ThemeVisuals, w: number, d: number, h: number, slideAmount: number, anchorX: number, anchorY: number) {
      const panelW = w / 2;
      const leftOffset = -w/4 - slideAmount;
      const rightOffset = w/4 + slideAmount;

      // Re-calc bounds for sprite generation
      const isoBounds = this.calculateIsoBounds(panelW, d, h);
      const padding = 60;
      const cW = Math.ceil(isoBounds.maxX - isoBounds.minX + padding * 2);
      const cH = Math.ceil(isoBounds.maxY - isoBounds.minY + padding * 2);
      const aX = -isoBounds.minX + padding;
      const aY = -isoBounds.minY + padding;

      const leftKey = `GATE_PANEL_L_${w}_${d}_${h}_${e.color}_${visuals.edgeColor}_v4`;
      const rightKey = `GATE_PANEL_R_${w}_${d}_${h}_${e.color}_${visuals.edgeColor}_${e.locked}_v4`;

      // Helper to avoid allocation in closure
      const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz, this._isoTemp);

      const leftSprite = this.cache.getOrRender(leftKey, cW, cH, (bCtx) => {
          this.renderPrism(bCtx, panelW, d, h, aX, aY, e.color, visuals, 'PLATING');
          bCtx.translate(aX, aY);
          bCtx.strokeStyle = '#facc15'; bCtx.lineWidth = 4;
          const baseB = p(panelW/2, d/2, 0);
          bCtx.beginPath(); bCtx.moveTo(baseB.x - 20, baseB.y - 20); bCtx.lineTo(baseB.x, baseB.y); bCtx.stroke();
          bCtx.translate(-aX, -aY);
      });

      const rightSprite = this.cache.getOrRender(rightKey, cW, cH, (bCtx) => {
          this.renderPrism(bCtx, panelW, d, h, aX, aY, e.color, visuals, 'PLATING');
          bCtx.translate(aX, aY);
          const topB = p(-panelW/2, d/2, h - 40); 
          bCtx.fillStyle = e.locked ? '#ef4444' : '#22c55e';
          bCtx.shadowColor = bCtx.fillStyle; bCtx.shadowBlur = 10;
          bCtx.beginPath(); bCtx.arc(topB.x, topB.y, 6, 0, Math.PI*2); bCtx.fill();
          bCtx.shadowBlur = 0;
          bCtx.translate(-aX, -aY);
      });

      const baseX = anchorX > 0 ? anchorX : e.x;
      const baseY = anchorY > 0 ? anchorY : e.y;
      
      const worldPos = anchorX > 0 ? {x: baseX, y: baseY} : IsoUtils.toIso(baseX, baseY, 0, this._isoTemp);

      // Reuse vectors for offset calculation
      const lIso = IsoUtils.toIso(leftOffset, 0, 0, this._p1);
      ctx.drawImage(leftSprite, Math.floor(worldPos.x + lIso.x - aX), Math.floor(worldPos.y + lIso.y - aY));
      
      const rIso = IsoUtils.toIso(rightOffset, 0, 0, this._p2);
      ctx.drawImage(rightSprite, Math.floor(worldPos.x + rIso.x - aX), Math.floor(worldPos.y + rIso.y - aY));
  }

  private renderMonolith(ctx: CanvasRenderingContext2D, e: Entity, visuals: ThemeVisuals) {
      const w = e.width || 200;
      const d = e.depth || 200;
      const h = e.height || 600;
      
      const isTransparent = this.narrative.getFlag('MONOLITH_TRANSPARENT');

      if (!isTransparent) {
          const cacheKey = `MONOLITH_VOID_${w}_${d}_${h}_v4`;
          const isoBounds = this.calculateIsoBounds(w, d, h);
          const padding = 120;
          const canvasW = Math.ceil(isoBounds.maxX - isoBounds.minX + padding * 2);
          const canvasH = Math.ceil(isoBounds.maxY - isoBounds.minY + padding * 2);
          const aX = -isoBounds.minX + padding;
          const aY = -isoBounds.minY + padding;
          
          const sprite = this.cache.getOrRender(cacheKey, canvasW, canvasH, (bCtx) => {
              bCtx.translate(aX, aY);
              this.renderMonolithVoid(bCtx, w, d, h);
              bCtx.translate(-aX, -aY);
          });
          
          const pos = IsoUtils.toIso(e.x, e.y, e.z || 0, this._isoTemp);
          ctx.drawImage(sprite, Math.floor(pos.x - aX), Math.floor(pos.y - aY));
      } else {
          const pos = IsoUtils.toIso(e.x, e.y, e.z || 0, this._isoTemp); 
          ctx.save();
          ctx.translate(pos.x, pos.y);
          this.renderMonolithDynamic(ctx, w, d, h);
          ctx.restore();
      }
  }

  private renderMonolithVoid(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, w: number, d: number, h: number) {
      const halfW = w / 2; const halfD = d / 2;
      
      // Use local allocs for cache generation (rare)
      const p = (lx: number, ly: number, lz: number) => ({...IsoUtils.toIso(lx, ly, lz)});

      const topT = p(-halfW, -halfD, h); const topR = p(halfW, -halfD, h); 
      const topB = p(halfW, halfD, h); const topL = p(-halfW, halfD, h);
      const baseB = p(halfW, halfD, 0); const baseR = p(halfW, -halfD, 0); const baseL = p(-halfW, halfD, 0);

      const grad = ctx.createLinearGradient(0, topT.y, 0, baseB.y);
      grad.addColorStop(0, '#000000'); 
      grad.addColorStop(0.5, '#0f172a'); 
      grad.addColorStop(1, '#000000');
      
      ctx.fillStyle = grad;
      ctx.shadowBlur = 20; ctx.shadowColor = '#000';

      ctx.beginPath(); ctx.moveTo(baseB.x, baseB.y); ctx.lineTo(baseR.x, baseR.y); ctx.lineTo(topR.x, topR.y); ctx.lineTo(topB.x, topB.y); ctx.fill();
      ctx.beginPath(); ctx.moveTo(baseB.x, baseB.y); ctx.lineTo(baseL.x, baseL.y); ctx.lineTo(topL.x, topL.y); ctx.lineTo(topB.x, topB.y); ctx.fill();
      
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.globalAlpha = 0.3;
      ctx.beginPath(); ctx.moveTo(baseB.x, baseB.y); ctx.lineTo(topB.x, topB.y); ctx.stroke();
      ctx.globalAlpha = 1.0; ctx.shadowBlur = 0;
  }

  private renderMonolithDynamic(ctx: CanvasRenderingContext2D, w: number, d: number, h: number) {
      const t = Date.now() * 0.0005;
      const halfW = w / 2; const halfD = d / 2;
      const p = (lx: number, ly: number, lz: number) => ({...IsoUtils.toIso(lx, ly, lz)}); 

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
  }

  private renderDynamicGlow(ctx: CanvasRenderingContext2D, e: Entity, visuals: ThemeVisuals) {
      const w = e.width || 150; 
      const d = e.depth || 150;
      const z = e.height || 0;
      const pos = IsoUtils.toIso(e.x, e.y, e.z || 0, this._isoTemp);
      
      const cacheKey = `GLOW_GRATE_${w}_${d}_${e.color}_v2`;
      
      const isoBounds = this.calculateIsoBounds(w, d, 20);
      const padding = 20;
      const cW = Math.ceil(isoBounds.maxX - isoBounds.minX + padding * 2);
      const cH = Math.ceil(isoBounds.maxY - isoBounds.minY + padding * 2);
      const aX = -isoBounds.minX + padding;
      const aY = -isoBounds.minY + padding;
      
      const sprite = this.cache.getOrRender(cacheKey, cW, cH, (bCtx) => {
          bCtx.translate(aX, aY);
          const hw = w / 2; const hd = d / 2;
          const p = (lx: number, ly: number) => IsoUtils.toIso(lx, ly, 0, this._isoTemp);
          
          // Must clone for separate points inside this generation function
          const tl = {...p(-hw, -hd)}; const tr = {...p(hw, -hd)};
          const br = {...p(hw, hd)}; const bl = {...p(-hw, hd)};
          
          bCtx.fillStyle = '#0f172a';
          bCtx.beginPath(); bCtx.moveTo(tl.x, tl.y); bCtx.lineTo(tr.x, tr.y); bCtx.lineTo(br.x, br.y); bCtx.lineTo(bl.x, bl.y); bCtx.fill();
          
          bCtx.save(); bCtx.globalCompositeOperation = 'screen';
          const center = p(0,0);
          const glowGrad = bCtx.createRadialGradient(center.x, center.y, w*0.1, center.x, center.y, w*0.6);
          const color = e.color || '#f59e0b';
          glowGrad.addColorStop(0, color); glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
          bCtx.fillStyle = glowGrad; bCtx.globalAlpha = 0.6;
          bCtx.beginPath(); bCtx.moveTo(tl.x, tl.y); bCtx.lineTo(tr.x, tr.y); bCtx.lineTo(br.x, br.y); bCtx.lineTo(bl.x, bl.y); bCtx.fill(); bCtx.restore();

          bCtx.strokeStyle = '#334155'; bCtx.lineWidth = 4;
          for (let i = 0; i <= 6; i++) {
              const t = i / 6; const x = -hw + (w * t);
              const p1 = {...p(x, -hd)}; const p2 = {...p(x, hd)};
              bCtx.beginPath(); bCtx.moveTo(p1.x, p1.y); bCtx.lineTo(p2.x, p2.y); bCtx.stroke();
          }
          
          bCtx.lineWidth = 6; bCtx.strokeStyle = '#475569';
          bCtx.beginPath(); bCtx.moveTo(tl.x, tl.y); bCtx.lineTo(tr.x, tr.y); bCtx.lineTo(br.x, br.y); bCtx.lineTo(bl.x, bl.y); bCtx.closePath(); bCtx.stroke();
          bCtx.translate(-aX, -aY);
      });
      
      ctx.drawImage(sprite, Math.floor(pos.x - aX), Math.floor(pos.y + z - aY));
  }

  // --- PRIMITIVES (Zero Allocation Version) ---

  private calculateIsoBounds(width: number, length: number, height: number) {
      const hw = width / 2; const hl = length / 2;
      
      // Reset MinMax
      this._isoMinMax.minX = Infinity; this._isoMinMax.maxX = -Infinity;
      this._isoMinMax.minY = Infinity; this._isoMinMax.maxY = -Infinity;

      const update = (x: number, y: number, z: number) => {
          IsoUtils.toIso(x, y, z, this._isoTemp);
          if (this._isoTemp.x < this._isoMinMax.minX) this._isoMinMax.minX = this._isoTemp.x;
          if (this._isoTemp.x > this._isoMinMax.maxX) this._isoMinMax.maxX = this._isoTemp.x;
          if (this._isoTemp.y < this._isoMinMax.minY) this._isoMinMax.minY = this._isoTemp.y;
          if (this._isoTemp.y > this._isoMinMax.maxY) this._isoMinMax.maxY = this._isoTemp.y;
      };

      // Unrolled corner projection
      update(-hw, -hl, 0); update(hw, -hl, 0); update(hw, hl, 0); update(-hw, hl, 0);
      update(-hw, -hl, height); update(hw, -hl, height); update(hw, hl, height); update(-hw, hl, height);

      return this._isoMinMax;
  }

  private renderPrism(ctx: any, w: number, d: number, h: number, anchorX: number, anchorY: number, color: string, visuals: ThemeVisuals, detailStyle: string = 'NONE') {
      ctx.translate(anchorX, anchorY);
      const halfW = w / 2; const halfD = d / 2;
      
      // Use local allocations for sprite generation (infrequent)
      const p = (lx: number, ly: number, lz: number) => ({...IsoUtils.toIso(lx, ly, lz)});

      const baseL = p(-halfW, halfD, 0); const baseR = p(halfW, -halfD, 0); const baseB = p(halfW, halfD, 0); 
      const topL = p(-halfW, halfD, h); const topR = p(halfW, -halfD, h); const topB = p(halfW, halfD, h); const topT = p(-halfW, -halfD, h);

      const applyShade = (baseHex: string, multiplier: number) => {
          const shift = Math.floor((multiplier - 1.0) * 100);
          return this.textureGen.adjustColor(baseHex, shift);
      };

      const drawFace = (p1: any, p2: any, p3: any, p4: any, faceType: 'TOP' | 'LEFT' | 'RIGHT') => {
          let multiplier = 1.0;
          if (faceType === 'TOP') multiplier = 1.15;
          else if (faceType === 'LEFT') multiplier = 1.0;
          else if (faceType === 'RIGHT') multiplier = 0.7;

          ctx.fillStyle = applyShade(color, multiplier);
          ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.fill();
          
          if (visuals.pattern) {
              ctx.fillStyle = visuals.pattern;
              ctx.globalAlpha = visuals.fillOpacity * 0.4;
              ctx.fill();
              ctx.globalAlpha = 1.0;
          }

          if (faceType !== 'TOP' && detailStyle !== 'NONE') {
              this.drawFaceDetails(ctx, p1, p2, p3, p4, faceType, detailStyle, w, h);
          }
      };

      drawFace(baseB, baseR, topR, topB, 'RIGHT');
      drawFace(baseB, baseL, topL, topB, 'LEFT');
      drawFace(topT, topR, topB, topL, 'TOP');

      // Edges
      ctx.lineWidth = visuals.rimLight ? 2 : 1; 
      ctx.strokeStyle = visuals.rimLight ? visuals.edgeColor : this.textureGen.adjustColor(color, 40);
      if (visuals.rimLight) { ctx.shadowColor = visuals.edgeColor; ctx.shadowBlur = 10; }
      
      ctx.beginPath(); ctx.moveTo(topL.x, topL.y); ctx.lineTo(topB.x, topB.y); ctx.lineTo(topR.x, topR.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(topB.x, topB.y); ctx.lineTo(baseB.x, baseB.y); ctx.stroke();
      ctx.shadowBlur = 0;

      // Base Shadow Gradient
      const grad = ctx.createLinearGradient(0, baseB.y - 40, 0, baseB.y);
      grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(baseB.x, baseB.y); ctx.lineTo(baseR.x, baseR.y); ctx.lineTo(topR.x, topR.y - h + 40); ctx.lineTo(topB.x, topB.y - h + 40);
      ctx.lineTo(topL.x, topL.y - h + 40); ctx.lineTo(baseL.x, baseL.y);
      ctx.fill();

      if (visuals.erosionLevel > 0) {
          ctx.globalCompositeOperation = 'destination-out';
          const cuts = Math.floor(h * visuals.erosionLevel * 0.2);
          for(let i=0; i<cuts; i++) {
              const t = Math.random();
              const ex = topB.x + (baseB.x - topB.x) * t;
              const ey = topB.y + (baseB.y - topB.y) * t;
              const size = Math.random() * 10 + 2;
              ctx.beginPath(); ctx.arc(ex, ey, size, 0, Math.PI*2); ctx.fill();
          }
          ctx.globalCompositeOperation = 'source-over';
      }

      ctx.translate(-anchorX, -anchorY);
  }

  private drawFaceDetails(ctx: any, pBottom: any, pOuter: any, pTopOuter: any, pTopInner: any, side: 'LEFT' | 'RIGHT' | 'TOP', style: string, w: number, h: number) {
      if (side === 'TOP') return;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pBottom.x, pBottom.y); ctx.lineTo(pOuter.x, pOuter.y); ctx.lineTo(pTopOuter.x, pTopOuter.y); ctx.lineTo(pTopInner.x, pTopInner.y);
      ctx.clip();

      if (style === 'RIVETS') {
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          const steps = Math.ceil(h / 60);
          for(let i=1; i<steps; i++) {
              const t = i/steps;
              const x1 = pBottom.x + (pTopInner.x - pBottom.x) * t;
              const y1 = pBottom.y + (pTopInner.y - pBottom.y) * t;
              ctx.beginPath(); ctx.arc(x1, y1, 2, 0, Math.PI*2); ctx.fill();
              const x2 = pOuter.x + (pTopOuter.x - pOuter.x) * t;
              const y2 = pOuter.y + (pTopOuter.y - pOuter.y) * t;
              ctx.beginPath(); ctx.arc(x2, y2, 2, 0, Math.PI*2); ctx.fill();
          }
      } 
      else if (style === 'CIRCUITS') {
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)'; ctx.lineWidth = 2;
          const steps = 3;
          for(let i=1; i<steps; i++) {
              const t = i/steps;
              const sx = pBottom.x + (pTopInner.x - pBottom.x) * t;
              const sy = pBottom.y + (pTopInner.y - pBottom.y) * t;
              const ex = pOuter.x + (pTopOuter.x - pOuter.x) * t;
              const ey = pOuter.y + (pTopOuter.y - pOuter.y) * t;
              ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
          }
      }
      else if (style === 'PLATING') {
          ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
          const plates = Math.ceil(h / 100);
          for(let i=1; i<plates; i++) {
              const t = i/plates;
              const sx = pBottom.x + (pTopInner.x - pBottom.x) * t;
              const sy = pBottom.y + (pTopInner.y - pBottom.y) * t;
              const ex = pOuter.x + (pTopOuter.x - pOuter.x) * t;
              const ey = pOuter.y + (pTopOuter.y - pOuter.y) * t;
              ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
          }
      }
      else if (style === 'GLYPHS') {
          ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
          if (Math.random() > 0.5) {
              const cx = (pBottom.x + pOuter.x + pTopOuter.x + pTopInner.x) / 4;
              const cy = (pBottom.y + pOuter.y + pTopOuter.y + pTopInner.y) / 4;
              ctx.font = '20px monospace'; ctx.textAlign = 'center'; ctx.fillText('◊', cx, cy);
          }
      }
      ctx.restore();
  }

  // --- LEGACY HELPERS ---

  private drawBanner(ctx: CanvasRenderingContext2D, e: Entity) {
      const w = e.width || 60; const h = e.height || 180; 
      const pos = IsoUtils.toIso(e.x, e.y, e.z || 200, this._isoTemp);
      ctx.save(); ctx.translate(pos.x, pos.y);
      const wind = Math.sin(Date.now() * 0.002 + e.id) * 5;
      ctx.fillStyle = e.color || '#06b6d4';
      ctx.beginPath(); ctx.moveTo(-w/2, 0); ctx.lineTo(w/2, 0); ctx.lineTo(w/2 + wind, h); ctx.lineTo(0, h - 20); ctx.lineTo(-w/2 + wind, h); ctx.closePath(); ctx.fill();
      ctx.restore();
  }

  private drawHoloSign(ctx: CanvasRenderingContext2D, e: Entity) {
      const w = e.width || 120; const h = e.height || 60; 
      const pos = IsoUtils.toIso(e.x, e.y, e.z || 150, this._isoTemp);
      ctx.save(); ctx.translate(pos.x, pos.y);
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = e.color || '#ef4444'; ctx.shadowColor = e.color || '#ef4444'; ctx.shadowBlur = 15;
      ctx.transform(1, -0.2, 0, 1, 0, 0); ctx.fillRect(-w/2, -h/2, w, h);
      ctx.restore();
  }

  private drawCable(ctx: CanvasRenderingContext2D, e: Entity) {
      if (!e.targetX || !e.targetY) return;
      const start = IsoUtils.toIso(e.x, e.y, e.z, this._p1); 
      const end = IsoUtils.toIso(e.targetX, e.targetY, 120, this._p2);
      ctx.strokeStyle = '#18181b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(start.x, start.y);
      const midX = (start.x + end.x) / 2; const midY = (start.y + end.y) / 2; ctx.quadraticCurveTo(midX, midY + 50, end.x, end.y); ctx.stroke();
  }

  private drawEnergyBarrier(ctx: CanvasRenderingContext2D, e: Entity) {
      const h = e.height || 150; const w = e.width || 100; const d = e.depth || 20; 
      const pos = IsoUtils.toIso(e.x, e.y, 0, this._isoTemp);
      ctx.save(); ctx.translate(pos.x, pos.y);
      const hw = w/2; const hd = d/2;
      
      const p1 = IsoUtils.toIso(-hw, hd, 0, this._p1); 
      const p2 = IsoUtils.toIso(hw, hd, 0, this._p2); 
      const p3 = IsoUtils.toIso(hw, hd, h, this._p3); 
      const p4 = IsoUtils.toIso(-hw, hd, h, this._p4);
      
      ctx.fillStyle = '#18181b'; ctx.fillRect(p1.x - 5, p1.y - 5, 10, 10); ctx.fillRect(p2.x - 5, p2.y - 5, 10, 10);
      ctx.globalCompositeOperation = 'screen';
      const grad = ctx.createLinearGradient(0, p1.y, 0, p3.y); 
      grad.addColorStop(0, `${e.color}00`); grad.addColorStop(0.5, `${e.color}40`); grad.addColorStop(1, `${e.color}00`); 
      ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.fill();
      ctx.restore();
  }
}
