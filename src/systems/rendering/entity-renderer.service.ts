
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
  private world = inject(WorldService); // Inject world to get current zone context if needed

  drawDecoration(ctx: CanvasRenderingContext2D, e: Entity) {
      if (['RUG', 'FLOOR_CRACK', 'GRAFFITI', 'TRASH'].includes(e.subType || '')) {
          this.structureRenderer.drawFloorDecoration(ctx, e);
      } else {
          // Use current zone from world service to ensure theme consistency
          this.structureRenderer.drawStructure(ctx, e, this.world.currentZone());
      }
  }

  // Used by ItemIconComponent
  drawItemIcon(ctx: CanvasRenderingContext2D, item: Item, size: number) {
      ctx.save(); ctx.clearRect(0, 0, size, size);
      if (item.rarity !== 'COMMON') {
        const glowColor = item.color; ctx.shadowBlur = 10; ctx.shadowColor = glowColor; ctx.strokeStyle = glowColor; ctx.lineWidth = 2; ctx.strokeRect(2, 2, size - 4, size - 4); ctx.shadowBlur = 0;
      }
      ctx.translate(size / 2, size / 2);
      if (item.rarity !== 'COMMON') {
        const grad = ctx.createRadialGradient(0, 0, size * 0.1, 0, 0, size * 0.5); grad.addColorStop(0, `${item.color}50`); grad.addColorStop(1, `${item.color}00`); ctx.fillStyle = grad; ctx.fillRect(-size/2, -size/2, size, size);
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
    const pos = IsoUtils.toIso(e.x, e.y, e.z); 
    ctx.save(); ctx.translate(pos.x, pos.y);
    const scale = 1 + Math.sin(Date.now() * 0.005) * 0.1;
    ctx.scale(scale, scale);
    this.drawItemShape(ctx, e.itemData);
    ctx.restore();
  }

  drawExit(ctx: CanvasRenderingContext2D, e: Entity) {
      const pos = IsoUtils.toIso(e.x, e.y, e.z);
      ctx.save(); 
      ctx.translate(pos.x, pos.y);
      
      const isGate = e.color === '#ef4444' || e.locked; // Logic to detect major gate transition or if explictly defined in future
      
      if (isGate) {
          // Render as a floor threshold marker
          // Flatten to floor
          ctx.scale(1, 0.5); 
          const pulse = Math.sin(Date.now() * 0.005);
          
          ctx.fillStyle = e.color; 
          ctx.globalAlpha = 0.3 + pulse * 0.1;
          
          // Rectangular mat
          const w = 120;
          const h = 60;
          ctx.fillRect(-w/2, -h/2, w, h);
          
          // Warning chevrons
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          for(let i = -w/2; i < w/2; i+=20) {
              ctx.moveTo(i, h/2);
              ctx.lineTo(i+10, -h/2);
          }
          ctx.stroke();
          
      } else {
          // Standard Circular Exit
          ctx.scale(1, 0.5);
          ctx.fillStyle = e.color; 
          ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI*2); ctx.fill();
      }
      
      ctx.restore();
  }
  
  drawDestructible(ctx: CanvasRenderingContext2D, e: Entity) {
      this.structureRenderer.drawStructure(ctx, e, this.world.currentZone());
  }
  
  drawShrine(ctx: CanvasRenderingContext2D, e: Entity) {
      this.structureRenderer.drawStructure(ctx, e, this.world.currentZone());
  }
}
