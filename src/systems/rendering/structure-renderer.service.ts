
import { Injectable, inject } from '@angular/core';
import { Entity, Zone } from '../../models/game.models';
import { IsoUtils } from '../../utils/iso-utils';
import { SpriteCacheService } from './sprite-cache.service';

@Injectable({ providedIn: 'root' })
export class StructureRendererService {
  private cache = inject(SpriteCacheService);

  private adjustColor(hex: string, percent: number) {
      if (!hex) return '#333333';
      let R = parseInt(hex.substring(1,3),16); let G = parseInt(hex.substring(3,5),16); let B = parseInt(hex.substring(5,7),16);
      R = Math.min(255, Math.max(10, R + percent)); G = Math.min(255, Math.max(10, G + percent)); B = Math.min(255, Math.max(15, B + percent));
      const RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16)); const GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16)); const BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));
      return "#"+RR+GG+BB;
  }

  drawStructure(ctx: CanvasRenderingContext2D, e: Entity, zone: Zone) {
      if (e.subType === 'BARRIER') { this.drawEnergyBarrier(ctx, e); return; }
      
      const w = e.width || 40; 
      const d = e.depth || w;
      const h = e.height || 100;
      
      // Cache Key: Includes specific types now to ensure unique sprites
      const cacheKey = `STRUCT_${e.type}_${e.subType}_${w}_${d}_${h}_${e.color}_${e.locked}`;
      
      const isoBounds = this.calculateIsoBounds(w, d, h);
      const padding = 40; // Increased padding for glows/effects
      const canvasW = Math.ceil(isoBounds.maxX - isoBounds.minX + padding * 2);
      const canvasH = Math.ceil(isoBounds.maxY - isoBounds.minY + padding * 2);
      
      if (canvasW <= 0 || canvasH <= 0 || canvasW > 4096 || canvasH > 4096) return;

      const anchorX = -isoBounds.minX + padding;
      const anchorY = -isoBounds.minY + padding;

      const sprite = this.cache.getOrRender(cacheKey, canvasW, canvasH, (bufferCtx) => {
          // Delegate specific rendering based on subType
          if (e.subType === 'MONOLITH') {
              this.renderMonolithToBuffer(bufferCtx, e, w, d, h, anchorX, anchorY);
          } else if (e.subType === 'GATE_SEGMENT') {
              this.renderGateToBuffer(bufferCtx, e, w, d, h, anchorX, anchorY);
          } else {
              this.renderStructureToBuffer(bufferCtx, e, w, d, h, anchorX, anchorY);
          }
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
          
          ctx.fillStyle = e.color || '#333';
          ctx.globalAlpha = 0.5;
          ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.fill();
          
          // Border for Rugs to look like designated zones
          ctx.lineWidth = 2; ctx.strokeStyle = this.adjustColor(e.color, 40); 
          ctx.stroke();
          
          ctx.globalAlpha = 1.0;
      } else if (e.subType === 'FLOOR_CRACK') {
          ctx.scale(1, 0.5);
          ctx.strokeStyle = '#18181b'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(5, 5); ctx.lineTo(15, -5); ctx.lineTo(25, 0); ctx.stroke();
      } else if (e.subType === 'GRAFFITI') {
          ctx.scale(1, 0.5);
          ctx.font = 'bold 20px monospace'; ctx.fillStyle = e.color || '#ef4444';
          ctx.fillText('⚠', 0, 0);
      } else if (e.subType === 'TRASH') {
          ctx.scale(1, 0.5);
          ctx.fillStyle = '#52525b';
          ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#3f3f46';
          ctx.beginPath(); ctx.arc(5, 2, 6, 0, Math.PI*2); ctx.fill();
      }
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

  // --- STANDARD WALL ---
  private renderStructureToBuffer(ctx: any, e: Entity, w: number, d: number, h: number, anchorX: number, anchorY: number) {
      ctx.translate(anchorX, anchorY);
      const halfW = w / 2; const halfD = d / 2;
      const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);

      const baseL = p(-halfW, halfD, 0); const baseR = p(halfW, -halfD, 0); const baseB = p(halfW, halfD, 0); 
      const topL = p(-halfW, halfD, h); const topR = p(halfW, -halfD, h); const topB = p(halfW, halfD, h); const topT = p(-halfW, -halfD, h);

      // Sides (Shadowed)
      ctx.fillStyle = this.adjustColor(e.color, -30); 
      ctx.beginPath(); ctx.moveTo(baseB.x, baseB.y); ctx.lineTo(baseR.x, baseR.y); ctx.lineTo(topR.x, topR.y); ctx.lineTo(topB.x, topB.y); ctx.fill();
      
      // Front (Base Color)
      ctx.fillStyle = this.adjustColor(e.color, -10); 
      ctx.beginPath(); ctx.moveTo(baseB.x, baseB.y); ctx.lineTo(baseL.x, baseL.y); ctx.lineTo(topL.x, topL.y); ctx.lineTo(topB.x, topB.y); ctx.fill();
      
      // Top (Highlight)
      ctx.fillStyle = e.color; 
      ctx.beginPath(); ctx.moveTo(topT.x, topT.y); ctx.lineTo(topR.x, topR.y); ctx.lineTo(topB.x, topB.y); ctx.lineTo(topL.x, topL.y); ctx.fill();
      
      // Edge Highlight
      ctx.strokeStyle = this.adjustColor(e.color, 40); ctx.lineWidth = 1; 
      ctx.beginPath(); ctx.moveTo(topL.x, topL.y); ctx.lineTo(topB.x, topB.y); ctx.lineTo(topR.x, topR.y); ctx.stroke();

      if (e.subType === 'PILLAR') {
          // Extra detail for pillars
          ctx.fillStyle = this.adjustColor(e.color, 20);
          ctx.beginPath(); ctx.arc(topB.x, topB.y, 4, 0, Math.PI*2); ctx.fill();
      } else {
          this.applyProceduralDecay(ctx, e, w, d, h, topL, topR, topB);
      }
  }

  // --- GATE SEGMENT ---
  private renderGateToBuffer(ctx: any, e: Entity, w: number, d: number, h: number, anchorX: number, anchorY: number) {
      this.renderStructureToBuffer(ctx, e, w, d, h, anchorX, anchorY);
      
      // Add Hazard Stripes and Lights
      const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);
      const topB = p(w/2, d/2, h);
      const baseB = p(w/2, d/2, 0);
      
      // Status Light
      ctx.beginPath();
      ctx.arc(topB.x, topB.y + 20, 5, 0, Math.PI * 2);
      ctx.fillStyle = e.locked ? '#ef4444' : '#22c55e';
      ctx.fill();
      ctx.shadowColor = e.locked ? '#ef4444' : '#22c55e';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Hazard Stripes
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(baseB.x - 10, baseB.y - 10);
      ctx.lineTo(baseB.x + 10, baseB.y + 10);
      ctx.stroke();
  }

  // --- MONOLITH (The Spire) ---
  private renderMonolithToBuffer(ctx: any, e: Entity, w: number, d: number, h: number, anchorX: number, anchorY: number) {
      ctx.translate(anchorX, anchorY);
      const halfW = w / 2; const halfD = d / 2;
      const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);

      const topT = p(-halfW, -halfD, h); const topR = p(halfW, -halfD, h); const topB = p(halfW, halfD, h); const topL = p(-halfW, halfD, h);
      const baseB = p(halfW, halfD, 0); const baseR = p(halfW, -halfD, 0); const baseL = p(-halfW, halfD, 0);

      // Gradient Fill
      const grad = ctx.createLinearGradient(0, topT.y, 0, baseB.y);
      grad.addColorStop(0, '#3b82f6');
      grad.addColorStop(1, '#1e1b4b');

      ctx.fillStyle = grad;
      // Draw faces
      ctx.beginPath(); ctx.moveTo(baseB.x, baseB.y); ctx.lineTo(baseR.x, baseR.y); ctx.lineTo(topR.x, topR.y); ctx.lineTo(topB.x, topB.y); ctx.fill();
      ctx.beginPath(); ctx.moveTo(baseB.x, baseB.y); ctx.lineTo(baseL.x, baseL.y); ctx.lineTo(topL.x, topL.y); ctx.lineTo(topB.x, topB.y); ctx.fill();
      
      // Glowing Top
      ctx.shadowBlur = 30; ctx.shadowColor = '#06b6d4';
      ctx.fillStyle = '#cffafe';
      ctx.beginPath(); ctx.moveTo(topT.x, topT.y); ctx.lineTo(topR.x, topR.y); ctx.lineTo(topB.x, topB.y); ctx.lineTo(topL.x, topL.y); ctx.fill();
      ctx.shadowBlur = 0;

      // Data Lines
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(baseB.x, baseB.y); ctx.lineTo(topB.x, topB.y); ctx.stroke();
  }

  private applyProceduralDecay(ctx: any, e: Entity, w: number, d: number, h: number, tl: any, tr: any, tb: any) {
      const seed = e.id;
      const noise = (n: number) => Math.sin(seed * n) * 0.5 + 0.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = 1;
      const lines = Math.floor(noise(1) * 5) + 2;
      for (let i = 0; i < lines; i++) {
          const yOff = noise(i + 2) * h;
          ctx.beginPath(); ctx.moveTo(tl.x, tl.y + yOff); ctx.lineTo(tb.x, tb.y + yOff); ctx.lineTo(tr.x, tr.y + yOff); ctx.stroke();
      }
  }

  private drawEnergyBarrier(ctx: CanvasRenderingContext2D, e: Entity) {
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