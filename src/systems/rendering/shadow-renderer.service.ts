
import { Injectable } from '@angular/core';
import { Entity } from '../../models/game.models';
import { IsoUtils } from '../../utils/iso-utils';

@Injectable({ providedIn: 'root' })
export class ShadowRendererService {
  
  drawUnitShadow(ctx: CanvasRenderingContext2D, e: Entity) {
    const pos = IsoUtils.toIso(e.x, e.y, 0); // Shadow is always on floor (z=0)
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.scale(1, 0.5);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawStructureShadow(ctx: CanvasRenderingContext2D, e: Entity) {
    // Projected shadow logic for tall structures
    // Light source assumed Top-Left
    const h = e.height || 100;
    const w = e.width || 40;
    
    const baseL = IsoUtils.toIso(e.x - w/2, e.y + w/2, 0);
    const baseR = IsoUtils.toIso(e.x + w/2, e.y - w/2, 0);
    const baseB = IsoUtils.toIso(e.x + w/2, e.y + w/2, 0);
    
    // Projection offset
    const shadowLen = h * 0.6;
    const shadowX = shadowLen; 
    const shadowY = shadowLen * 0.5;

    const topL_Shadow = { x: baseL.x + shadowX, y: baseL.y + shadowY };
    const topR_Shadow = { x: baseR.x + shadowX, y: baseR.y + shadowY };
    const topB_Shadow = { x: baseB.x + shadowX, y: baseB.y + shadowY };

    // Soft Shadow Gradient
    const gradient = ctx.createLinearGradient(
      baseL.x, baseL.y,
      topL_Shadow.x, topL_Shadow.y
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.15)'); // Reduced intensity base
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');    // Fade out

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(baseL.x, baseL.y);
    ctx.lineTo(topL_Shadow.x, topL_Shadow.y);
    ctx.lineTo(topB_Shadow.x, topB_Shadow.y);
    ctx.lineTo(topR_Shadow.x, topR_Shadow.y);
    ctx.lineTo(baseR.x, baseR.y);
    ctx.lineTo(baseB.x, baseB.y);
    ctx.closePath();
    ctx.fill();
  }
}
