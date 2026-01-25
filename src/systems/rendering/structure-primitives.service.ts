
import { Injectable, inject } from '@angular/core';
import { IsoUtils } from '../../utils/iso-utils';
import { TextureGeneratorService, ThemeVisuals } from './texture-generator.service';

@Injectable({ providedIn: 'root' })
export class StructurePrimitivesService {
  private textureGen = inject(TextureGeneratorService);

  calculateIsoBounds(width: number, length: number, height: number) {
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

  renderPrism(ctx: any, w: number, d: number, h: number, anchorX: number, anchorY: number, color: string, visuals: ThemeVisuals, detailStyle: string = 'NONE') {
      ctx.translate(anchorX, anchorY);
      const halfW = w / 2; const halfD = d / 2;
      const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);

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

      // Erosion
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
              ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
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
              ctx.font = '20px monospace'; ctx.textAlign = 'center'; ctx.fillText('◊', cx, cy);
          }
      }
      ctx.restore();
  }
}
