
import { Injectable } from '@angular/core';
import { SpriteDefinition } from '../../models/render.models';
import { IsoUtils } from '../../utils/iso-utils';

@Injectable({ providedIn: 'root' })
export class SpriteRegistryService {
  private registry = new Map<string, SpriteDefinition>();

  constructor() {
    this.initCoreSprites();
  }

  getSprite(id: string): SpriteDefinition | undefined {
    return this.registry.get(id);
  }

  private initCoreSprites() {
    // Generate Fortress Walls
    this.generateWallSprite('WALL_FORTRESS_MAIN', 1200, 80, 400, '#27272a');
    this.generateWallSprite('WALL_FORTRESS_SIDE', 80, 1200, 400, '#27272a');
    this.generatePillarSprite('PILLAR_FORTRESS', 120, 450, '#3f3f46');
    this.generateMonolithSprite('MONOLITH_CORE', 250, 800, '#06b6d4');
  }

  private createCanvas(w: number, h: number): { canvas: HTMLCanvasElement | OffscreenCanvas, ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D } {
    const canvas = typeof OffscreenCanvas !== 'undefined' 
      ? new OffscreenCanvas(w, h) 
      : document.createElement('canvas');
    
    if (typeof OffscreenCanvas === 'undefined') {
        (canvas as HTMLCanvasElement).width = w;
        (canvas as HTMLCanvasElement).height = h;
    }
    const ctx = canvas.getContext('2d') as any;
    return { canvas, ctx };
  }

  private generateWallSprite(id: string, width: number, depth: number, height: number, color: string) {
    const isoBounds = this.calculateIsoBounds(width, depth, height);
    const padding = 20;
    const canvasW = Math.ceil(isoBounds.maxX - isoBounds.minX + padding * 2);
    const canvasH = Math.ceil(isoBounds.maxY - isoBounds.minY + padding * 2);
    
    const { canvas, ctx } = this.createCanvas(canvasW, canvasH);
    
    const anchorX = -isoBounds.minX + padding;
    const anchorY = -isoBounds.minY + padding;

    ctx.translate(anchorX, anchorY);

    // Geometry Points
    const halfW = width / 2; 
    const halfD = depth / 2;
    const p = (lx: number, ly: number, lz: number) => IsoUtils.toIso(lx, ly, lz);

    const baseL = p(-halfW, halfD, 0); 
    const baseR = p(halfW, -halfD, 0); 
    const baseB = p(halfW, halfD, 0);
    const topL = p(-halfW, halfD, height); 
    const topR = p(halfW, -halfD, height); 
    const topB = p(halfW, halfD, height); 
    const topT = p(-halfW, -halfD, height);

    // --- RENDER ---
    
    // 1. Shadow Side (Right/Bottom Faces) - Darker
    ctx.fillStyle = this.adjustColor(color, -40);
    ctx.beginPath(); 
    ctx.moveTo(baseB.x, baseB.y); 
    ctx.lineTo(baseR.x, baseR.y); 
    ctx.lineTo(topR.x, topR.y); 
    ctx.lineTo(topB.x, topB.y); 
    ctx.fill();

    // 2. Lit Side (Left/Front Faces) - Base Color
    ctx.fillStyle = this.adjustColor(color, -10);
    ctx.beginPath(); 
    ctx.moveTo(baseB.x, baseB.y); 
    ctx.lineTo(baseL.x, baseL.y); 
    ctx.lineTo(topL.x, topL.y); 
    ctx.lineTo(topB.x, topB.y); 
    ctx.fill();

    // 3. Texture/Noise (Grime)
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.3;
    for(let i=0; i<30; i++) {
        const rx = (Math.random() - 0.5) * canvasW;
        const ry = (Math.random() - 0.5) * canvasH;
        ctx.strokeStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + 20, ry + 20);
        ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';

    // 4. Hazard Stripe / Detail
    if (Math.random() > 0.5) {
        ctx.fillStyle = '#eab308'; // Yellow
        ctx.globalAlpha = 0.5;
        const stripY = topB.y + (baseB.y - topB.y) * 0.8; // Near bottom
        ctx.beginPath();
        ctx.moveTo(baseL.x, stripY);
        ctx.lineTo(baseB.x, stripY + 10); // Perspective slant
        ctx.lineTo(baseR.x, stripY);
        ctx.lineTo(baseR.x, stripY - 10);
        ctx.lineTo(baseB.x, stripY);
        ctx.lineTo(baseL.x, stripY - 10);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    // 5. Top Cap - Highlight
    ctx.fillStyle = this.adjustColor(color, 20);
    ctx.beginPath(); 
    ctx.moveTo(topT.x, topT.y); 
    ctx.lineTo(topR.x, topR.y); 
    ctx.lineTo(topB.x, topB.y); 
    ctx.lineTo(topL.x, topL.y); 
    ctx.fill();

    // 6. Edge Highlights
    ctx.strokeStyle = this.adjustColor(color, 50); 
    ctx.lineWidth = 2;
    ctx.beginPath(); 
    ctx.moveTo(topL.x, topL.y); 
    ctx.lineTo(topB.x, topB.y); 
    ctx.lineTo(topR.x, topR.y); 
    ctx.stroke();

    this.registry.set(id, {
        id,
        width: canvasW,
        height: canvasH,
        anchorX,
        anchorY,
        canvas
    });
  }

  private generatePillarSprite(id: string, width: number, height: number, color: string) {
      // Simplification: Reuse wall gen logic for now but simpler geometry
      this.generateWallSprite(id, width, width, height, color);
  }

  private generateMonolithSprite(id: string, width: number, height: number, color: string) {
      // Just reuse wall gen for now to save tokens, but tint it
      this.generateWallSprite(id, width, width, height, color);
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

  private adjustColor(hex: string, percent: number) {
      if (!hex) return '#333333';
      let R = parseInt(hex.substring(1,3),16); let G = parseInt(hex.substring(3,5),16); let B = parseInt(hex.substring(5,7),16);
      R = Math.min(255, Math.max(10, R + percent)); G = Math.min(255, Math.max(10, G + percent)); B = Math.min(255, Math.max(15, B + percent));
      const RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16)); const GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16)); const BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));
      return "#"+RR+GG+BB;
  }
}
