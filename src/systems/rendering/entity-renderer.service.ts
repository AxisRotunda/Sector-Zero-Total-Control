
import { Injectable, inject } from '@angular/core';
import { Entity, Zone } from '../../models/game.models';
import { Item } from '../../models/item.models';
import { StructureRendererService } from './structure-renderer.service';
import { UnitRendererService } from './unit-renderer.service';
import { EffectRendererService } from './effect-renderer.service';
import { IsoUtils } from '../../utils/iso-utils';
import { WorldService } from '../../game/world/world.service';

@Injectable({ providedIn: 'root' })
export class EntityRendererService {
  private structureRenderer = inject(StructureRendererService);
  private unitRenderer = inject(UnitRendererService);
  private effectRenderer = inject(EffectRendererService);
  private world = inject(WorldService); 

  // Pooled Vectors for Zero-Alloc Rendering
  private _iso = { x: 0, y: 0 };
  private _p1 = { x: 0, y: 0 };
  private _p2 = { x: 0, y: 0 };
  private _p3 = { x: 0, y: 0 };
  private _p4 = { x: 0, y: 0 };

  drawDecoration(ctx: CanvasRenderingContext2D, e: Entity) {
      if (['RUG', 'FLOOR_CRACK', 'GRAFFITI', 'TRASH'].includes(e.subType || '')) {
          this.structureRenderer.drawFloorDecoration(ctx, e);
      } else if (e.type === 'INTERACTABLE') {
          if (e.subType === 'RIFTGATE' || e.subType === 'PORTAL') {
              this.drawRiftgate(ctx, e);
          } else {
              this.drawInteractable(ctx, e);
          }
      } else {
          // Use current zone from world service to ensure theme consistency
          this.structureRenderer.drawStructure(ctx, e, this.world.currentZone());
      }
  }

  // Used by ItemIconComponent
  drawItemIcon(ctx: CanvasRenderingContext2D, item: Item, size: number) {
      ctx.save(); ctx.clearRect(0, 0, size, size);
      
      // Normalize color to ensure 6-digit hex before appending alpha
      const baseColor = this.normalizeHex(item.color);

      if (item.rarity !== 'COMMON') {
        const glowColor = baseColor; 
        ctx.shadowBlur = 10; ctx.shadowColor = glowColor; ctx.strokeStyle = glowColor; ctx.lineWidth = 2; ctx.strokeRect(2, 2, size - 4, size - 4); ctx.shadowBlur = 0;
      }
      ctx.translate(size / 2, size / 2);
      if (item.rarity !== 'COMMON') {
        const grad = ctx.createRadialGradient(0, 0, size * 0.1, 0, 0, size * 0.5); 
        grad.addColorStop(0, `${baseColor}50`); 
        grad.addColorStop(1, `${baseColor}00`); 
        ctx.fillStyle = grad; ctx.fillRect(-size/2, -size/2, size, size);
      }
      const s = size * 0.035; 
      ctx.scale(s, s);
      this.drawItemShape(ctx, item);
      ctx.restore();
  }

  private drawItemShape(ctx: CanvasRenderingContext2D, item: Item) {
      ctx.save();
      switch (item.shape) {
        case 'sword': ctx.rotate(-Math.PI / 4); ctx.fillStyle = '#52525b'; ctx.fillRect(-12, 10, 24, 4); ctx.fillRect(-3, 4, 6, 6); ctx.fillStyle = item.color; ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(4, -20); ctx.lineTo(0, -25); ctx.lineTo(-4, -20); ctx.closePath(); ctx.fill(); break;
        case 'psiBlade': ctx.rotate(-Math.PI / 4); ctx.shadowBlur = 10; ctx.shadowColor = item.color; ctx.fillStyle = '#18181b'; ctx.fillRect(-3, 4, 6, 8); ctx.fillStyle = item.color; ctx.fillRect(-1, -20, 2, 24); ctx.shadowBlur = 0; break;
        case 'shield': ctx.fillStyle = '#52525b'; ctx.fillRect(-12, -12, 24, 24); ctx.fillStyle = item.color; ctx.fillRect(-10, -10, 20, 20); ctx.fillStyle = '#e4e4e7'; ctx.fillRect(-4, -4, 8, 8); break;
        case 'chip': ctx.fillStyle = '#18181b'; ctx.fillRect(-10, -8, 20, 16); ctx.fillStyle = item.color; ctx.fillRect(-8, -6, 16, 12); ctx.fillStyle = '#f59e0b'; ctx.fillRect(-12, -2, 4, 4); ctx.fillRect(8, -2, 4, 4); break;
        case 'syringe': ctx.rotate(-Math.PI / 4); ctx.fillStyle = '#e4e4e7'; ctx.fillRect(-3, 10, 6, 6); ctx.fillStyle = '#71717a'; ctx.fillRect(-4, -10, 8, 20); ctx.fillStyle = item.color; ctx.fillRect(-2, -8, 4, 15); ctx.fillStyle = '#e4e4e7'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(2, -18); ctx.lineTo(-2, -18); ctx.closePath(); ctx.fill(); break;
        case 'amulet': ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = item.color; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI*2); ctx.fill(); break;
        case 'ring': ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.stroke(); ctx.fillStyle = item.color; ctx.beginPath(); ctx.arc(0, -8, 4, 0, Math.PI*2); ctx.fill(); break;
    }
    ctx.restore();
  }

  drawPickup(ctx: CanvasRenderingContext2D, e: Entity) {
    if (!e.itemData) return;
    const pos = IsoUtils.toIso(e.x, e.y, e.z, this._iso); 
    ctx.save(); ctx.translate(pos.x, pos.y);
    const scale = 1 + Math.sin(Date.now() * 0.005) * 0.1;
    ctx.scale(scale, scale);
    this.drawItemShape(ctx, e.itemData);
    ctx.restore();
  }

  drawExit(ctx: CanvasRenderingContext2D, e: Entity) {
      const pos = IsoUtils.toIso(e.x, e.y, e.z, this._iso);
      ctx.save(); 
      ctx.translate(pos.x, pos.y);
      
      const isGate = e.color === '#ef4444' || e.locked || e.color === '#991b1b'; 
      
      if (isGate) {
          ctx.scale(1, 0.5); 
          const pulse = (Math.sin(Date.now() * 0.005) + 1) * 0.5; 
          ctx.fillStyle = e.color; 
          ctx.globalAlpha = 0.2 + pulse * 0.1;
          const w = 140; const h = 60;
          ctx.strokeStyle = e.color; ctx.lineWidth = 2; ctx.setLineDash([10, 5]); ctx.strokeRect(-w/2, -h/2, w, h); ctx.setLineDash([]);
          ctx.fillRect(-w/2, -h/2, w, h);
          ctx.globalAlpha = 0.8; ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(e.locked ? 'LOCKED' : 'ACCESS GRANTED', 0, 0);
      } else {
          ctx.scale(1, 0.5); ctx.fillStyle = e.color; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, e.radius * 0.7, 0, Math.PI*2); ctx.stroke();
      }
      ctx.restore();
  }
  
  drawDestructible(ctx: CanvasRenderingContext2D, e: Entity) {
      this.structureRenderer.drawStructure(ctx, e, this.world.currentZone());
  }
  
  drawShrine(ctx: CanvasRenderingContext2D, e: Entity) {
      this.structureRenderer.drawStructure(ctx, e, this.world.currentZone());
  }

  // Draw Riftgate / Personal Rift
  private drawRiftgate(ctx: CanvasRenderingContext2D, e: Entity) {
      // Use pooled vector
      const pos = IsoUtils.toIso(e.x, e.y, 40, this._iso);
      const t = Date.now() * 0.002;
      const isPersonal = e.subType === 'PORTAL';
      const color = isPersonal ? '#a855f7' : '#06b6d4'; 

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.translate(0, Math.sin(t) * 5);

      ctx.globalCompositeOperation = 'screen';
      ctx.shadowBlur = 20; ctx.shadowColor = color;
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath();
      
      for(let i=0; i <= Math.PI*2; i+=0.1) {
          const r = 20 + Math.sin(i * 5 + t*3) * 5;
          const x = Math.cos(i) * r;
          const y = Math.sin(i) * r * 0.5; 
          if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.closePath(); ctx.stroke();

      ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 0.3; ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.lineTo(0, -80 - Math.random() * 20); ctx.fill();
      ctx.restore();
  }

  private drawInteractable(ctx: CanvasRenderingContext2D, e: Entity) {
      const pos = IsoUtils.toIso(e.x, e.y, e.z || 30, this._iso);
      ctx.save();
      ctx.translate(pos.x, pos.y);
      const float = Math.sin(Date.now() * 0.003) * 5;
      ctx.translate(0, float);

      ctx.shadowBlur = 10; ctx.shadowColor = '#06b6d4';
      ctx.fillStyle = 'rgba(6, 182, 212, 0.2)'; ctx.strokeStyle = '#06b6d4'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.rect(-20, -30, 40, 60); ctx.fill(); ctx.stroke();

      ctx.fillStyle = '#06b6d4'; ctx.globalAlpha = 0.8; ctx.fillRect(-12, -20, 24, 15); 
      ctx.globalAlpha = 0.5; ctx.fillRect(-12, 0, 10, 8); ctx.fillRect(2, 0, 10, 8); ctx.fillRect(-12, 12, 10, 8); ctx.fillRect(2, 12, 10, 8);
      ctx.restore();
  }

  // --- SUB-STRUCTURE RENDERERS ---
  
  drawEnergyBarrier(ctx: CanvasRenderingContext2D, e: Entity) {
      const h = e.height || 150; const w = e.width || 100; const d = e.depth || 20; 
      // Reuse _iso
      const pos = IsoUtils.toIso(e.x, e.y, 0, this._iso);
      ctx.save(); ctx.translate(pos.x, pos.y);
      const hw = w/2; const hd = d/2;
      
      // OPTIMIZED: Use pooled vectors for all corners
      const p1 = IsoUtils.toIso(-hw, hd, 0, this._p1); 
      const p2 = IsoUtils.toIso(hw, hd, 0, this._p2); 
      const p3 = IsoUtils.toIso(hw, hd, h, this._p3); 
      const p4 = IsoUtils.toIso(-hw, hd, h, this._p4);
      
      ctx.fillStyle = '#18181b'; ctx.fillRect(p1.x - 5, p1.y - 5, 10, 10); ctx.fillRect(p2.x - 5, p2.y - 5, 10, 10);
      ctx.globalCompositeOperation = 'screen';
      const grad = ctx.createLinearGradient(0, p1.y, 0, p3.y); 
      const color = this.normalizeHex(e.color || '#ef4444');
      
      grad.addColorStop(0, `${color}00`); grad.addColorStop(0.5, `${color}40`); grad.addColorStop(1, `${color}00`); 
      ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.fill();
      ctx.restore();
  }

  private normalizeHex(hex: string): string {
      if (hex.length === 4) {
          return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
      }
      return hex;
  }
}
