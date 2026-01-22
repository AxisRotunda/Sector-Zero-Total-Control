
import { Injectable, inject } from '@angular/core';
import { Entity, Zone } from '../../models/game.models';
import { IsoUtils } from '../../utils/iso-utils';
import { SpriteCacheService } from './sprite-cache.service';
import { TextureGeneratorService, ThemeVisuals } from './texture-generator.service';
import { DECORATIONS } from '../../config/decoration.config';

@Injectable({ providedIn: 'root' })
export class StructureRendererService {
  private cache = inject(SpriteCacheService);
  private textureGen = inject(TextureGeneratorService);
  
  // ISOMETRIC LIGHTING CONSTANTS
  // Simulates a light source from Top-Left-Front
  private readonly SHADE_TOP = 1.15;   // Direct overhead light (Highlight)
  private readonly SHADE_LEFT = 1.0;   // Main lit face (Base color)
  private readonly SHADE_RIGHT = 0.7;  // Occluded face (Shadow)

  drawStructure(ctx: CanvasRenderingContext2D, e: Entity, zone: Zone) {
      if (e.subType === 'BARRIER') { this.drawEnergyBarrier(ctx, e); return; }
      if (e.subType === 'CABLE') { this.drawCable(ctx, e); return; }
      if (e.subType === 'DYNAMIC_GLOW') { this.drawDynamicGlow(ctx, e); return; }
      
      const theme = zone ? zone.theme : 'INDUSTRIAL';
      const structureType = e.subType || 'WALL';
      const visuals = this.textureGen.getThemeVisuals(theme);

      // --- ANIMATED GATE OPTIMIZATION ---
      if (structureType === 'GATE_SEGMENT') {
          const gw = e.width || 200;
          const gd = e.depth || 40;
          const gh = e.height || 300;
          this.drawAnimatedGate(ctx, e, gw, gd, gh, theme, visuals);
          return;
      }
      
      // Determine Dimensions & Style from Config
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

      // --- STATIC CACHED STRUCTURES ---
      // Cache Key: Includes visual properties + 'v5' version bump for shading update
      const cacheKey = `STRUCT_${structureType}_${w}_${d}_${h}_${e.color}_${theme}_${e.locked}_${detailStyle}_v5`;
      
      const isoBounds = this.calculateIsoBounds(w, d, h);
      const padding = 120;
      const canvasW = Math.ceil(isoBounds.maxX - isoBounds.minX + padding * 2);
      const canvasH = Math.ceil(isoBounds.maxY - isoBounds.minY + padding * 2);
      
      if (canvasW <= 0 || canvasH <= 0 || canvasW > 4096 || canvasH > 4096) return;

      const anchorX = -isoBounds.minX + padding;
      const anchorY = -isoBounds.minY + padding;

      const sprite = this.cache.getOrRender(cacheKey, canvasW, canvasH, (bufferCtx) => {
          if (renderStyle === 'CUSTOM') {
              if (structureType === 'MONOLITH') this.renderMonolith(bufferCtx, e, w, d, h, anchorX, anchorY, visuals);
              else if (structureType === 'OBSERVATION_DECK') this.renderObservationDeck(bufferCtx, e, w, d, h, anchorX, anchorY, visuals);
              else if (structureType === 'TRAINING_EXTERIOR') this.renderTrainingExterior(bufferCtx, e, w, d, h, anchorX, anchorY, visuals);
              else if (structureType === 'HOLO_TABLE') this.renderHoloTable(bufferCtx, e, w, d, h, anchorX, anchorY);
              else if (structureType === 'VENDING_MACHINE') this.renderVendingMachine(bufferCtx, e, w, d, h, anchorX, anchorY);
              else if (structureType === 'VENT') this.renderVent(bufferCtx, e, w, d, h, anchorX, anchorY);
              else if (structureType === 'OVERSEER_EYE') this.renderOverseerEye(bufferCtx, e, w, d, h, anchorX, anchorY);
              else if (structureType === 'STREET_LIGHT') this.renderStreetLight(bufferCtx, e, w, d, h, anchorX, anchorY);
              else if (structureType === 'NEON') this.renderNeon(bufferCtx, e, w, d, h, anchorX, anchorY);
              else this.renderGenericPrism(bufferCtx, e, w, d, h, anchorX, anchorY, visuals, detailStyle); 
          } 
          else {
              this.renderGenericPrism(bufferCtx, e, w, d, h, anchorX, anchorY, visuals, detailStyle);
          }
      });

      const pos = IsoUtils.toIso(e.x, e.y, e.z || 0); 
      ctx.drawImage(sprite, Math.floor(pos.x - anchorX), Math.floor(pos.y - anchorY)); 
  }

  drawFloorDecoration(ctx: CanvasRenderingContext2D, e: Entity) {
      const config = DECORATIONS[e.subType || ''] || { width: 40, depth: 40, height: 40, baseColor: '#333' };
      const w = e.width || config.width; 
      const h = e.height || config.depth; 
      const pos = IsoUtils.toIso(e.x, e.y, 0);

      ctx.save();
      ctx.translate(pos.x, pos.y);

      const hw = w/2; const hh = h/2;
      const p1 = IsoUtils.toIso(-hw, hh, 0); const p2 = IsoUtils.toIso(hw, hh, 0);  
      const p3 = IsoUtils.toIso(hw, -hh, 0); const p4 = IsoUtils.toIso(-hw, -hh, 0);

      if (e.subType === 'RUG') {
          ctx.fillStyle = e.data?.color || e.color || config.baseColor;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y);
          ctx.fill();
          ctx.strokeStyle = this.textureGen.adjustColor(ctx.fillStyle as string, 20);
          ctx.lineWidth = 2; ctx.stroke();
      }
      else if (e.subType === 'GRAFFITI') {
          ctx.save(); ctx.scale(1, 0.5); ctx.rotate(-Math.PI/4); ctx.fillStyle = e.color || config.baseColor; ctx.globalAlpha = 0.7; ctx.font = 'bold 30px monospace'; ctx.textAlign = 'center'; ctx.fillText(e.text || "☠", 0, 0); ctx.restore();
      }
      else if (e.subType === 'FLOOR_CRACK') {
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(5, 5); ctx.lineTo(15, -2); ctx.lineTo(25, 4); ctx.stroke();
      }
      else if (e.subType === 'TRASH') {
          ctx.fillStyle = config.baseColor;
          const p = (x:number, y:number) => IsoUtils.toIso(x,y,0);
          const d1 = p(-5, 5); ctx.fillRect(d1.x, d1.y, 4, 2);
          const d2 = p(10, -5); ctx.fillRect(d2.x, d2.y, 3, 3);
          const d3 = p(2, 2); ctx.fillRect(d3.x, d3.y, 5, 2);
      }
      ctx.restore();
  }

  // --- ANIMATED GATE SYSTEM ---
  private drawAnimatedGate(ctx: CanvasRenderingContext2D, e: Entity, w: number, d: number, h: number, theme: string, visuals: ThemeVisuals) {
      const openness = e.openness || 0; 
      const maxSlide = w * 0.45;
      const slideAmount = maxSlide * openness;
      const leftOffset = -w/4 - slideAmount;
      const rightOffset = w/4 + slideAmount;
      
      const panelW = w / 2;
      const isoBounds = this.calculateIsoBounds(panelW, d, h);
      const padding = 60;
      const cW = Math.ceil(isoBounds.maxX - isoBounds.minX + padding * 2);
      const cH = Math.ceil(isoBounds.maxY - isoBounds.minY + padding * 2);
      const aX = -isoBounds.minX + padding;
      const aY = -isoBounds.minY + padding;

      const leftKey = `GATE_PANEL_L_${w}_${d}_${h}_${e.color}_${theme}_v3`;
      const leftSprite = this.cache.getOrRender(leftKey, cW, cH, (bCtx) => {
          this.renderPrism(bCtx, panelW, d, h, aX, aY, e.color, visuals, 'PLATING');
          bCtx.translate(aX, aY);
          bCtx.strokeStyle = '#facc15'; bCtx.lineWidth = 4;
          const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);
          const baseB = p(panelW/2, d/2, 0);
          bCtx.beginPath(); bCtx.moveTo(baseB.x - 20, baseB.y - 20); bCtx.lineTo(baseB.x, baseB.y); bCtx.stroke();
          bCtx.translate(-aX, -aY);
      });

      const rightKey = `GATE_PANEL_R_${w}_${d}_${h}_${e.color}_${theme}_${e.locked}_v3`;
      const rightSprite = this.cache.getOrRender(rightKey, cW, cH, (bCtx) => {
          this.renderPrism(bCtx, panelW, d, h, aX, aY, e.color, visuals, 'PLATING');
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

  // --- CORE RENDERER WITH DIRECTIONAL SHADING ---
  private renderPrism(ctx: any, w: number, d: number, h: number, anchorX: number, anchorY: number, color: string, visuals: ThemeVisuals, detailStyle: string = 'NONE') {
      ctx.translate(anchorX, anchorY);
      const halfW = w / 2; const halfD = d / 2;
      const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);

      const baseL = p(-halfW, halfD, 0); const baseR = p(halfW, -halfD, 0); const baseB = p(halfW, halfD, 0); 
      const topL = p(-halfW, halfD, h); const topR = p(halfW, -halfD, h); const topB = p(halfW, halfD, h); const topT = p(-halfW, -halfD, h);

      // Helper to apply shading tint
      const applyShade = (baseHex: string, multiplier: number) => {
          // Adjust brightness by multiplier. 
          // Reusing adjustColor from TextureGen which uses +/- int, so we map multiplier to int.
          // 1.0 = 0 shift. 0.7 = -30 shift. 1.15 = +20 shift.
          const shift = Math.floor((multiplier - 1.0) * 100);
          return this.textureGen.adjustColor(baseHex, shift);
      };

      const drawFace = (p1: any, p2: any, p3: any, p4: any, faceType: 'TOP' | 'LEFT' | 'RIGHT') => {
          let multiplier = 1.0;
          if (faceType === 'TOP') multiplier = this.SHADE_TOP;
          else if (faceType === 'LEFT') multiplier = this.SHADE_LEFT;
          else if (faceType === 'RIGHT') multiplier = this.SHADE_RIGHT;

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

      // 1. Fill Faces (Order matters for simple painter's algorithm inside prism)
      drawFace(baseB, baseR, topR, topB, 'RIGHT'); // Darkest
      drawFace(baseB, baseL, topL, topB, 'LEFT');  // Medium
      drawFace(topT, topR, topB, topL, 'TOP');     // Brightest

      // 2. Edges/Highlights
      ctx.lineWidth = visuals.rimLight ? 2 : 1; 
      ctx.strokeStyle = visuals.rimLight ? visuals.edgeColor : this.textureGen.adjustColor(color, 40);
      if (visuals.rimLight) { ctx.shadowColor = visuals.edgeColor; ctx.shadowBlur = 10; }
      
      ctx.beginPath(); ctx.moveTo(topL.x, topL.y); ctx.lineTo(topB.x, topB.y); ctx.lineTo(topR.x, topR.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(topB.x, topB.y); ctx.lineTo(baseB.x, baseB.y); ctx.stroke();
      
      ctx.shadowBlur = 0;

      // 3. Ambient Occlusion (Gradient at bottom)
      const grad = ctx.createLinearGradient(0, baseB.y - 40, 0, baseB.y);
      grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(baseB.x, baseB.y); ctx.lineTo(baseR.x, baseR.y); ctx.lineTo(topR.x, topR.y - h + 40); ctx.lineTo(topB.x, topB.y - h + 40);
      ctx.lineTo(topL.x, topL.y - h + 40); ctx.lineTo(baseL.x, baseL.y);
      ctx.fill();

      // 4. Procedural Erosion
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
      return { topL, topR, topB, topT, baseB };
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
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
          ctx.lineWidth = 2;
          const steps = 3;
          for(let i=1; i<steps; i++) {
              const t = i/steps;
              const sx = pBottom.x + (pTopInner.x - pBottom.x) * t;
              const sy = pBottom.y + (pTopInner.y - pBottom.y) * t;
              const ex = pOuter.x + (pTopOuter.x - pOuter.x) * t;
              const ey = pOuter.y + (pTopOuter.y - pOuter.y) * t;
              
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.lineTo(sx + (ex-sx)*0.3, sy + (ey-sy)*0.3);
              ctx.lineTo(sx + (ex-sx)*0.3, sy + (ey-sy)*0.3 - 20);
              ctx.lineTo(ex, ey - 20);
              ctx.stroke();
          }
      }
      else if (style === 'PLATING') {
          ctx.strokeStyle = 'rgba(0,0,0,0.2)';
          ctx.lineWidth = 1;
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
              ctx.font = '20px monospace';
              ctx.textAlign = 'center';
              ctx.fillText('◊', cx, cy);
          }
      }
      ctx.restore();
  }

  // --- SPECIALIZED RENDERERS ---
  private renderGenericPrism(ctx: any, e: Entity, w: number, d: number, h: number, ax: number, ay: number, visuals: ThemeVisuals, detailStyle: any) {
      const coords = this.renderPrism(ctx, w, d, h, ax, ay, e.color, visuals, detailStyle);
      
      if (visuals.overlayColor && Math.random() > 0.7) {
          ctx.translate(ax, ay);
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = visuals.overlayColor;
          ctx.globalAlpha = 0.6;
          const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);
          const pos = p(w/2 + 2, d/4, h/2); 
          ctx.beginPath(); ctx.arc(pos.x, pos.y, 10, 0, Math.PI*2); ctx.fill();
          ctx.globalAlpha = 1.0;
          ctx.translate(-ax, -ay);
      }

      if (e.subType === 'PILLAR') {
          ctx.translate(ax, ay);
          ctx.strokeStyle = this.textureGen.adjustColor(e.color, 30);
          ctx.lineWidth = 2;
          const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);
          const bandY = p(0,0,h-20).y;
          ctx.beginPath(); ctx.moveTo(coords.topL.x, bandY); ctx.lineTo(coords.topB.x, bandY); ctx.lineTo(coords.topR.x, bandY); ctx.stroke();
          ctx.translate(-ax, -ay);
      }
  }

  private renderMonolith(ctx: any, e: Entity, w: number, d: number, h: number, ax: number, ay: number, visuals: ThemeVisuals) {
      ctx.translate(ax, ay);
      const halfW = w / 2; const halfD = d / 2;
      const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);

      const topT = p(-halfW, -halfD, h); const topR = p(halfW, -halfD, h); const topB = p(halfW, halfD, h); const topL = p(-halfW, halfD, h);
      const baseB = p(halfW, halfD, 0); const baseR = p(halfW, -halfD, 0); const baseL = p(-halfW, halfD, 0);

      const grad = ctx.createLinearGradient(0, topT.y, 0, baseB.y);
      grad.addColorStop(0, '#3b82f6'); grad.addColorStop(1, '#1e1b4b');

      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(baseB.x, baseB.y); ctx.lineTo(baseR.x, baseR.y); ctx.lineTo(topR.x, topR.y); ctx.lineTo(topB.x, topB.y); ctx.fill();
      ctx.beginPath(); ctx.moveTo(baseB.x, baseB.y); ctx.lineTo(baseL.x, baseL.y); ctx.lineTo(topL.x, topL.y); ctx.lineTo(topB.x, topB.y); ctx.fill();
      
      ctx.shadowBlur = 30; ctx.shadowColor = '#06b6d4';
      ctx.strokeStyle = '#cffafe'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(baseB.x, baseB.y - 50); ctx.lineTo(topB.x, topB.y + 50); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.translate(-ax, -ay);
  }

  private renderHoloTable(ctx: any, e: Entity, w: number, d: number, h: number, ax: number, ay: number) {
      this.renderPrism(ctx, w, d, h, ax, ay, '#18181b', this.textureGen.getThemeVisuals('HIGH_TECH'), 'NONE');
      ctx.translate(ax, ay);
      const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);
      const center = p(0, 0, h);
      
      ctx.save();
      ctx.translate(center.x, center.y - 20);
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = e.color || '#06b6d4';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(15, -5); ctx.lineTo(0, 5); ctx.lineTo(-15, -5); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = e.color || '#06b6d4'; ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(0, 30); ctx.lineTo(20, 0); ctx.fill();
      ctx.restore();
      ctx.translate(-ax, -ay);
  }

  private renderVendingMachine(ctx: any, e: Entity, w: number, d: number, h: number, ax: number, ay: number) {
      this.renderPrism(ctx, w, d, h, ax, ay, '#27272a', this.textureGen.getThemeVisuals('INDUSTRIAL'), 'NONE');
      ctx.translate(ax, ay);
      const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);
      const frontCenter = p(w/2, d/2, h * 0.6); 
      ctx.save();
      ctx.translate(frontCenter.x, frontCenter.y);
      ctx.rotate(-0.5); 
      ctx.fillStyle = '#06b6d4'; ctx.shadowColor = '#06b6d4'; ctx.shadowBlur = 10;
      ctx.fillRect(-10, -15, 20, 30);
      ctx.restore();
      ctx.translate(-ax, -ay);
  }

  private renderVent(ctx: any, e: Entity, w: number, d: number, h: number, ax: number, ay: number) {
      this.renderPrism(ctx, w, d, h, ax, ay, '#52525b', this.textureGen.getThemeVisuals('INDUSTRIAL'), 'RIVETS');
      ctx.translate(ax, ay);
      const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);
      const top = p(0, 0, h);
      ctx.save();
      ctx.translate(top.x, top.y);
      ctx.scale(1, 0.5);
      ctx.strokeStyle = '#18181b';
      ctx.beginPath(); ctx.arc(0, 0, w/3, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-w/3, 0); ctx.lineTo(w/3, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -w/3); ctx.lineTo(0, w/3); ctx.stroke();
      ctx.restore();
      ctx.translate(-ax, -ay);
  }

  private renderTrainingExterior(ctx: any, e: Entity, w: number, d: number, h: number, ax: number, ay: number, visuals: ThemeVisuals) {
      this.renderPrism(ctx, w, d, h, ax, ay, e.color, visuals, 'PLATING');
  }

  private renderObservationDeck(ctx: any, e: Entity, w: number, d: number, h: number, ax: number, ay: number, visuals: ThemeVisuals) {
      this.renderPrism(ctx, w, d, h, ax, ay, e.color, visuals, 'NONE');
      ctx.save();
      ctx.translate(ax, ay);
      const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);
      const front = p(0, d/2, h/2);
      ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = '#bae6fd'; ctx.globalAlpha = 0.2;
      ctx.beginPath(); ctx.arc(front.x, front.y, w/3, 0, Math.PI*2); ctx.fill();
      ctx.restore();
  }

  private renderStreetLight(ctx: any, e: Entity, w: number, d: number, h: number, ax: number, ay: number) {
      ctx.translate(ax, ay);
      const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);
      const base = p(0, 0, 0);
      const top = p(0, 0, h);
      
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#27272a';
      ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
      
      ctx.save();
      ctx.translate(top.x, top.y);
      ctx.rotate(-Math.PI/6);
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, -5, 40, 10);
      ctx.translate(35, 0);
      ctx.fillStyle = '#fbbf24'; ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      ctx.translate(-ax, -ay);
  }

  private renderNeon(ctx: any, e: Entity, w: number, d: number, h: number, ax: number, ay: number) {
      ctx.translate(ax, ay);
      const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);
      const pos = p(0, 0, 0);
      
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.shadowColor = e.color; ctx.shadowBlur = 15; ctx.strokeStyle = e.color; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-w/2, 0); ctx.lineTo(w/2, 0); ctx.moveTo(-w/2, -h); ctx.lineTo(w/2, -h);
      ctx.lineTo(w/2, 0); ctx.lineTo(-w/2, 0); ctx.lineTo(-w/2, -h); ctx.stroke();
      ctx.fillStyle = e.color; ctx.globalAlpha = 0.8; ctx.fillRect(-w/2 + 5, -h + 5, w - 10, h - 10);
      ctx.restore();
      ctx.translate(-ax, -ay);
  }

  private drawDynamicGlow(ctx: CanvasRenderingContext2D, e: Entity) {
      // Glow logic handled by LightingRenderer now for emission, this handles the physical strip
      const w = e.width || 500;
      const thickness = e.depth || 10;
      const elevation = e.height || 0;
      const pos = IsoUtils.toIso(e.x, e.y, e.z + elevation);
      
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.fillStyle = e.color;
      const p = (lx: number, ly: number) => IsoUtils.toIso(lx, ly, 0);
      const p1 = p(-w/2, 0); const p2 = p(w/2, 0);
      const h = thickness; 
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y - h/2); ctx.lineTo(p2.x, p2.y - h/2); ctx.lineTo(p2.x, p2.y + h/2); ctx.lineTo(p1.x, p1.y + h/2); ctx.fill();
      ctx.restore();
  }

  private drawCable(ctx: CanvasRenderingContext2D, e: Entity) {
      if (!e.targetX || !e.targetY) return;
      const start = IsoUtils.toIso(e.x, e.y, e.z);
      const endZ = 120;
      const end = IsoUtils.toIso(e.targetX, e.targetY, endZ);
      ctx.strokeStyle = '#18181b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(start.x, start.y);
      const midX = (start.x + end.x) / 2; const midY = (start.y + end.y) / 2;
      ctx.quadraticCurveTo(midX, midY + 50, end.x, end.y); ctx.stroke();
  }

  drawEnergyBarrier(ctx: CanvasRenderingContext2D, e: Entity) {
      const h = 80; const w = e.width || 100;
      const pos = IsoUtils.toIso(e.x, e.y, 0);
      ctx.save(); ctx.translate(pos.x, pos.y);
      const p1 = IsoUtils.toIso(-w/2, 0, 0); const p2 = IsoUtils.toIso(w/2, 0, 0); const p3 = IsoUtils.toIso(w/2, 0, h); const p4 = IsoUtils.toIso(-w/2, 0, h);
      ctx.fillStyle = '#333'; ctx.fillRect(p1.x - 5, p1.y - 40, 10, 40); ctx.fillRect(p2.x - 5, p2.y - 40, 10, 40);
      ctx.globalCompositeOperation = 'screen';
      const grad = ctx.createLinearGradient(0, p1.y, 0, p3.y); grad.addColorStop(0, `${e.color}00`); grad.addColorStop(0.5, `${e.color}60`); grad.addColorStop(1, `${e.color}00`); 
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.fill();
      ctx.restore();
  }

  private renderOverseerEye(ctx: any, e: Entity, w: number, d: number, h: number, ax: number, ay: number) {
      ctx.translate(ax, ay);
      const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);
      const center = p(0, 0, h/2);
      ctx.fillStyle = '#18181b'; ctx.beginPath(); ctx.arc(center.x, center.y, w/2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = e.color || '#ef4444'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(center.x, center.y, w/4, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.translate(-ax, -ay);
  }

  private calculateIsoBounds(width: number, length: number, height: number) {
      const hw = width / 2; const hl = length / 2;
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
}
