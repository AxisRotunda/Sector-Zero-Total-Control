
import { Injectable, inject } from '@angular/core';
import { Entity, Zone, ZoneTheme } from '../../models/game.models';
import { IsoUtils } from '../../utils/iso-utils';
import { SpriteCacheService } from './sprite-cache.service';

interface ThemeVisuals {
    pattern: CanvasPattern | null;
    edgeColor: string;
    erosionLevel: number; // 0 to 1
    rimLight: boolean;
    fillOpacity: number;
    overlayColor?: string;
}

@Injectable({ providedIn: 'root' })
export class StructureRendererService {
  private cache = inject(SpriteCacheService);
  
  // Patterns
  private patterns: Record<string, CanvasPattern | null> = {
      noise: null,
      rust: null,
      moss: null,
      grid: null,
      void: null
  };

  constructor() {
      this.initPatterns();
  }

  private initPatterns() {
      if (typeof document === 'undefined') return;
      
      const createPattern = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d')!;
          draw(ctx);
          return ctx.createPattern(c, 'repeat');
      };

      // 1. General Grime
      this.patterns.noise = createPattern(64, 64, (ctx) => {
          for(let i=0; i<400; i++) {
              ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
              ctx.fillRect(Math.random()*64, Math.random()*64, 2, 2);
          }
      });

      // 2. Rust (Industrial)
      this.patterns.rust = createPattern(128, 128, (ctx) => {
          for(let i=0; i<50; i++) {
              const size = Math.random() * 20;
              ctx.fillStyle = `rgba(180, 80, 50, ${Math.random() * 0.2})`;
              ctx.beginPath(); ctx.arc(Math.random()*128, Math.random()*128, size, 0, Math.PI*2); ctx.fill();
          }
      });

      // 3. Moss (Organic)
      this.patterns.moss = createPattern(128, 128, (ctx) => {
          for(let i=0; i<80; i++) {
              const size = Math.random() * 15;
              ctx.fillStyle = `rgba(20, 100, 40, ${Math.random() * 0.3})`;
              ctx.beginPath(); ctx.arc(Math.random()*128, Math.random()*128, size, 0, Math.PI*2); ctx.fill();
          }
      });

      // 4. Hex Grid (High Tech)
      this.patterns.grid = createPattern(64, 64, (ctx) => {
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, 32); ctx.lineTo(16, 0); ctx.lineTo(48, 0); ctx.lineTo(64, 32); ctx.lineTo(48, 64); ctx.lineTo(16, 64); ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = 'rgba(6, 182, 212, 0.05)';
          ctx.fill();
      });
      
      // 5. Void Glitch
      this.patterns.void = createPattern(64, 64, (ctx) => {
          ctx.fillStyle = 'rgba(147, 51, 234, 0.1)';
          for(let i=0; i<10; i++) {
              ctx.fillRect(Math.random()*64, Math.random()*64, Math.random()*20, 2);
          }
      });
  }

  private getThemeVisuals(theme: ZoneTheme = 'INDUSTRIAL', overrideColor?: string): ThemeVisuals {
      const base: ThemeVisuals = { pattern: this.patterns.noise, edgeColor: '#000000', erosionLevel: 0.1, rimLight: false, fillOpacity: 1.0 };
      
      switch(theme) {
          case 'RESIDENTIAL':
              return { ...base, pattern: this.patterns.noise, edgeColor: '#1e1b4b', erosionLevel: 0.05, rimLight: true, overlayColor: '#f472b6' };
          case 'HIGH_TECH':
              return { ...base, pattern: this.patterns.grid, edgeColor: '#0ea5e9', erosionLevel: 0.0, rimLight: true, fillOpacity: 0.9 };
          case 'ORGANIC':
              return { ...base, pattern: this.patterns.moss, edgeColor: '#052e16', erosionLevel: 0.4, rimLight: false };
          case 'VOID':
              return { ...base, pattern: this.patterns.void, edgeColor: '#581c87', erosionLevel: 0.3, rimLight: true, overlayColor: '#a855f7' };
          case 'INDUSTRIAL':
          default:
              return { ...base, pattern: this.patterns.rust, edgeColor: '#000000', erosionLevel: 0.2, rimLight: false };
      }
  }

  private adjustColor(hex: string, percent: number) {
      if (!hex) return '#333333';
      let R = parseInt(hex.substring(1,3),16); let G = parseInt(hex.substring(3,5),16); let B = parseInt(hex.substring(5,7),16);
      R = Math.min(255, Math.max(10, R + percent)); G = Math.min(255, Math.max(10, G + percent)); B = Math.min(255, Math.max(15, B + percent));
      const RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16)); const GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16)); const BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));
      return "#"+RR+GG+BB;
  }

  drawStructure(ctx: CanvasRenderingContext2D, e: Entity, zone: Zone) {
      if (e.subType === 'BARRIER') { this.drawEnergyBarrier(ctx, e); return; }
      if (e.subType === 'CABLE') { this.drawCable(ctx, e); return; }
      
      const w = e.width || 40; 
      const d = e.depth || w;
      const h = e.height || 100;
      const theme = zone ? zone.theme : 'INDUSTRIAL';
      
      // Cache Key: Includes zone theme to ensure visual variety per sector
      const cacheKey = `STRUCT_${e.type}_${e.subType}_${w}_${d}_${h}_${e.color}_${theme}_${e.locked}`;
      
      const isoBounds = this.calculateIsoBounds(w, d, h);
      const padding = 60; 
      const canvasW = Math.ceil(isoBounds.maxX - isoBounds.minX + padding * 2);
      const canvasH = Math.ceil(isoBounds.maxY - isoBounds.minY + padding * 2);
      
      if (canvasW <= 0 || canvasH <= 0 || canvasW > 4096 || canvasH > 4096) return;

      const anchorX = -isoBounds.minX + padding;
      const anchorY = -isoBounds.minY + padding;

      const sprite = this.cache.getOrRender(cacheKey, canvasW, canvasH, (bufferCtx) => {
          const visuals = this.getThemeVisuals(theme, e.color);
          
          switch (e.subType) {
              case 'MONOLITH': this.renderMonolith(bufferCtx, e, w, d, h, anchorX, anchorY, visuals); break;
              case 'GATE_SEGMENT': this.renderGate(bufferCtx, e, w, d, h, anchorX, anchorY, visuals); break;
              case 'HOLO_TABLE': this.renderHoloTable(bufferCtx, e, w, d, h, anchorX, anchorY); break;
              case 'VENDING_MACHINE': this.renderVendingMachine(bufferCtx, e, w, d, h, anchorX, anchorY); break;
              case 'BENCH': this.renderBench(bufferCtx, e, w, d, h, anchorX, anchorY); break;
              default: this.renderGenericWall(bufferCtx, e, w, d, h, anchorX, anchorY, visuals); break;
          }
      });

      const pos = IsoUtils.toIso(e.x, e.y, 0);
      ctx.drawImage(sprite, Math.floor(pos.x - anchorX), Math.floor(pos.y - anchorY)); 
  }

  // --- PRIMITIVE RENDERER WITH EROSION ---
  
  private renderPrism(ctx: any, w: number, d: number, h: number, anchorX: number, anchorY: number, color: string, visuals: ThemeVisuals) {
      ctx.translate(anchorX, anchorY);
      const halfW = w / 2; const halfD = d / 2;
      const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);

      const baseL = p(-halfW, halfD, 0); const baseR = p(halfW, -halfD, 0); const baseB = p(halfW, halfD, 0); 
      const topL = p(-halfW, halfD, h); const topR = p(halfW, -halfD, h); const topB = p(halfW, halfD, h); const topT = p(-halfW, -halfD, h);

      // Faces
      const drawFace = (p1: any, p2: any, p3: any, p4: any, shade: number) => {
          ctx.fillStyle = this.adjustColor(color, shade); 
          ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.fill();
          if (visuals.pattern) {
              ctx.fillStyle = visuals.pattern;
              ctx.globalAlpha = visuals.fillOpacity * 0.4;
              ctx.fill();
              ctx.globalAlpha = 1.0;
          }
      };

      // Right Face (Darkest)
      drawFace(baseB, baseR, topR, topB, -30);
      // Left Face (Mid)
      drawFace(baseB, baseL, topL, topB, -10);
      // Top Face (Lightest)
      drawFace(topT, topR, topB, topL, 0);

      // Edges/Highlights
      ctx.lineWidth = visuals.rimLight ? 2 : 1; 
      ctx.strokeStyle = visuals.rimLight ? visuals.edgeColor : this.adjustColor(color, 40);
      if (visuals.rimLight) { ctx.shadowColor = visuals.edgeColor; ctx.shadowBlur = 10; }
      
      ctx.beginPath(); ctx.moveTo(topL.x, topL.y); ctx.lineTo(topB.x, topB.y); ctx.lineTo(topR.x, topR.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(topB.x, topB.y); ctx.lineTo(baseB.x, baseB.y); ctx.stroke();
      
      ctx.shadowBlur = 0;

      // Ambient Occlusion
      const grad = ctx.createLinearGradient(0, baseB.y - 40, 0, baseB.y);
      grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(baseB.x, baseB.y); ctx.lineTo(baseR.x, baseR.y); ctx.lineTo(topR.x, topR.y - h + 40); ctx.lineTo(topB.x, topB.y - h + 40);
      ctx.lineTo(topL.x, topL.y - h + 40); ctx.lineTo(baseL.x, baseL.y);
      ctx.fill();

      // PROCEDURAL EROSION (Carve out chunks from edges)
      if (visuals.erosionLevel > 0) {
          ctx.globalCompositeOperation = 'destination-out';
          const seed = w + h + d; // Pseudo-seed
          const cuts = Math.floor(h * visuals.erosionLevel * 0.2);
          
          for(let i=0; i<cuts; i++) {
              // Edge: TopB to BaseB (Vertical Corner)
              const t = Math.random();
              const ex = topB.x + (baseB.x - topB.x) * t;
              const ey = topB.y + (baseB.y - topB.y) * t;
              const size = Math.random() * 10 + 2;
              
              ctx.beginPath();
              ctx.arc(ex, ey, size, 0, Math.PI*2);
              ctx.fill();
              
              // Top Edges
              if (Math.random() > 0.5) {
                  const tx = topL.x + (topR.x - topL.x) * Math.random();
                  const ty = topL.y + (topR.y - topL.y) * Math.random();
                  ctx.beginPath(); ctx.arc(tx, ty, size * 0.8, 0, Math.PI*2); ctx.fill();
              }
          }
          ctx.globalCompositeOperation = 'source-over';
      }

      // Reset Transform
      ctx.translate(-anchorX, -anchorY);
      return { topL, topR, topB, topT, baseB };
  }

  // --- SPECIALIZED RENDERERS ---

  private renderGenericWall(ctx: any, e: Entity, w: number, d: number, h: number, ax: number, ay: number, visuals: ThemeVisuals) {
      const coords = this.renderPrism(ctx, w, d, h, ax, ay, e.color, visuals);
      
      // Theme Overlays
      if (visuals.overlayColor && Math.random() > 0.7) {
          // Glitch/Neon Graffiti
          ctx.translate(ax, ay);
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = visuals.overlayColor;
          ctx.globalAlpha = 0.6;
          const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);
          const pos = p(w/2 + 2, d/4, h/2); // Stick to side
          ctx.beginPath(); ctx.arc(pos.x, pos.y, 10, 0, Math.PI*2); ctx.fill();
          ctx.globalAlpha = 1.0;
          ctx.translate(-ax, -ay);
      }

      if (e.subType === 'PILLAR') {
          // Add banding
          ctx.translate(ax, ay);
          ctx.strokeStyle = this.adjustColor(e.color, 30);
          ctx.lineWidth = 2;
          const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);
          const bandY = p(0,0,h-20).y;
          ctx.beginPath(); ctx.moveTo(coords.topL.x, bandY); ctx.lineTo(coords.topB.x, bandY); ctx.lineTo(coords.topR.x, bandY); ctx.stroke();
          ctx.translate(-ax, -ay);
      }
  }

  private renderGate(ctx: any, e: Entity, w: number, d: number, h: number, ax: number, ay: number, visuals: ThemeVisuals) {
      this.renderPrism(ctx, w, d, h, ax, ay, e.color, visuals);
      
      ctx.translate(ax, ay);
      const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);
      const topB = p(w/2, d/2, h);
      const baseB = p(w/2, d/2, 0);
      
      // Status Light
      ctx.beginPath();
      ctx.arc(topB.x, topB.y + 20, 6, 0, Math.PI * 2);
      ctx.fillStyle = e.locked ? '#ef4444' : '#22c55e';
      ctx.fill();
      ctx.shadowColor = e.locked ? '#ef4444' : '#22c55e';
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Hazard Stripes
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(baseB.x - 15, baseB.y - 15); ctx.lineTo(baseB.x + 15, baseB.y + 15);
      ctx.moveTo(baseB.x - 5, baseB.y - 15); ctx.lineTo(baseB.x + 25, baseB.y + 15);
      ctx.stroke();
      ctx.translate(-ax, -ay);
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
      
      // Glowing Rune
      ctx.shadowBlur = 30; ctx.shadowColor = '#06b6d4';
      ctx.strokeStyle = '#cffafe'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(baseB.x, baseB.y - 50); ctx.lineTo(topB.x, topB.y + 50); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.translate(-ax, -ay);
  }

  private renderHoloTable(ctx: any, e: Entity, w: number, d: number, h: number, ax: number, ay: number) {
      this.renderPrism(ctx, 80, 80, 40, ax, ay, '#18181b', this.getThemeVisuals('HIGH_TECH'));
      ctx.translate(ax, ay);
      const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);
      const center = p(0, 0, 40);
      
      // Floating Hologram
      ctx.save();
      ctx.translate(center.x, center.y - 20);
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = e.color || '#06b6d4';
      ctx.lineWidth = 1;
      
      ctx.beginPath();
      ctx.moveTo(0, -15); ctx.lineTo(15, -5); ctx.lineTo(0, 5); ctx.lineTo(-15, -5); ctx.closePath();
      ctx.stroke();
      
      ctx.fillStyle = e.color || '#06b6d4';
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(-20, 0); ctx.lineTo(0, 30); ctx.lineTo(20, 0);
      ctx.fill();
      
      ctx.restore();
      ctx.translate(-ax, -ay);
  }

  private renderVendingMachine(ctx: any, e: Entity, w: number, d: number, h: number, ax: number, ay: number) {
      this.renderPrism(ctx, 50, 50, 100, ax, ay, '#27272a', this.getThemeVisuals('INDUSTRIAL'));
      ctx.translate(ax, ay);
      const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);
      const frontCenter = p(25, 25, 60); 
      
      ctx.save();
      ctx.translate(frontCenter.x, frontCenter.y);
      ctx.rotate(-0.5);
      ctx.fillStyle = '#06b6d4'; ctx.shadowColor = '#06b6d4'; ctx.shadowBlur = 15;
      ctx.fillRect(-10, -20, 20, 30);
      ctx.restore();
      ctx.translate(-ax, -ay);
  }

  private renderBench(ctx: any, e: Entity, w: number, d: number, h: number, ax: number, ay: number) {
      this.renderPrism(ctx, 80, 30, 20, ax, ay, '#3f3f46', this.getThemeVisuals('INDUSTRIAL'));
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

  // --- DYNAMIC DRAWING (No Cache) ---

  drawFloorDecoration(ctx: CanvasRenderingContext2D, e: Entity) {
      const pos = IsoUtils.toIso(e.x, e.y, e.z || 0);
      ctx.save();
      ctx.translate(pos.x, pos.y);
      
      if (e.subType === 'RUG') {
          const w = e.width || 400; const h = e.height || 400;
          const p1 = IsoUtils.toIso(-w/2, -h/2, 0); const p2 = IsoUtils.toIso(w/2, -h/2, 0);
          const p3 = IsoUtils.toIso(w/2, h/2, 0); const p4 = IsoUtils.toIso(-w/2, h/2, 0);
          
          ctx.fillStyle = e.color || '#333';
          ctx.globalAlpha = 0.5;
          ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.fill();
          
          ctx.lineWidth = 2; ctx.strokeStyle = this.adjustColor(e.color, 40); ctx.stroke();
          
          if (this.patterns.noise) {
              ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = this.patterns.noise; ctx.fill();
          }
          ctx.globalAlpha = 1.0;
      } else if (e.subType === 'FLOOR_CRACK') {
          ctx.scale(1, 0.5); ctx.strokeStyle = '#18181b'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(5, 5); ctx.lineTo(15, -5); ctx.lineTo(25, 0); ctx.stroke();
      } else if (e.subType === 'GRAFFITI') {
          ctx.scale(1, 0.5); ctx.font = 'bold 20px monospace'; ctx.fillStyle = e.color || '#ef4444';
          ctx.globalAlpha = 0.8; ctx.fillText('⚠', 0, 0);
      } else if (e.subType === 'TRASH') {
          ctx.scale(1, 0.5); ctx.fillStyle = '#52525b';
          ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#3f3f46';
          ctx.beginPath(); ctx.arc(5, 2, 6, 0, Math.PI*2); ctx.fill();
      }
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
}
