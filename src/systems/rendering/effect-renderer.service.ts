
import { Injectable } from '@angular/core';
import { Entity, Particle, FloatingText, Camera, Zone } from '../../models/game.models';
import { IsoUtils } from '../../utils/iso-utils';

@Injectable({ providedIn: 'root' })
export class EffectRendererService {
  
  drawParticleIso(ctx: CanvasRenderingContext2D, p: Particle) {
      const pos = IsoUtils.toIso(p.x, p.y, p.z);
      ctx.save();
      const lifeInv = 1.0 - p.life; const size = p.sizeStart + (p.sizeEnd - p.sizeStart) * lifeInv; const alpha = p.alphaStart + (p.alphaEnd - p.alphaStart) * lifeInv;
      ctx.globalAlpha = Math.max(0, alpha); if (p.composite) ctx.globalCompositeOperation = p.composite;
      ctx.fillStyle = p.color; ctx.translate(pos.x, pos.y); if (p.rotation) ctx.rotate(p.rotation * Math.PI/180);
      if (p.shape === 'square') { ctx.fillRect(-size/2, -size/2, size, size); } 
      else if (p.shape === 'star') { ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size/4, -size/4); ctx.lineTo(size, 0); ctx.lineTo(size/4, size/4); ctx.lineTo(0, size); ctx.lineTo(-size/4, size/4); ctx.lineTo(-size, 0); ctx.lineTo(-size/4, -size/4); ctx.fill(); } 
      else if (p.shape === 'spark') { ctx.beginPath(); ctx.ellipse(0, 0, size, size * 0.1, 0, 0, Math.PI*2); ctx.fill(); } 
      else { ctx.beginPath(); ctx.arc(0, 0, size/2, 0, Math.PI*2); ctx.fill(); }
      ctx.restore(); ctx.globalAlpha = 1;
  }

  drawHitboxIso(ctx: CanvasRenderingContext2D, e: Entity) {
      const pos = IsoUtils.toIso(e.x, e.y, e.z);
      ctx.save(); ctx.translate(pos.x, pos.y); ctx.rotate(Math.PI/4); 
      if (e.source === 'PLAYER' && e.radius < 100) { ctx.globalAlpha = 0.6; ctx.strokeStyle = e.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, e.radius, e.angle - Math.PI/3, e.angle + Math.PI/3); ctx.stroke(); } 
      else { ctx.strokeStyle = e.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, e.radius, e.radius * 0.5, -Math.PI/4, 0, Math.PI*2); ctx.stroke(); }
      ctx.restore();
  }

  drawPsionicWave(ctx: CanvasRenderingContext2D, hitbox: Entity) {
    const pos = IsoUtils.toIso(hitbox.x, hitbox.y, hitbox.z);
    ctx.save(); ctx.translate(pos.x, pos.y); ctx.scale(1, 0.5);
    let progress = (10 - hitbox.timer) / 10; if (progress < 0) progress = 0;
    const currentRadius = Math.max(0, hitbox.radius * progress); const opacity = Math.max(0, 1 - progress * progress);
    ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = `rgba(168, 85, 247, ${opacity})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, currentRadius, 0, Math.PI * 2); ctx.stroke();
    if (progress > 0.3) { ctx.strokeStyle = `rgba(192, 132, 252, ${opacity * 0.7})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, currentRadius * 0.7, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = `rgba(216, 180, 254, ${opacity * 0.3})`; ctx.beginPath(); ctx.arc(0, 0, currentRadius * 0.8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  drawSteamColumn(ctx: CanvasRenderingContext2D, e: Entity) {
      const pos = IsoUtils.toIso(e.x, e.y, 0); ctx.save(); ctx.translate(pos.x, pos.y); ctx.globalAlpha = 0.3; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.lineTo(30, -100); ctx.lineTo(-30, -100); ctx.fill(); ctx.restore();
  }

  drawSludge(ctx: CanvasRenderingContext2D, e: Entity) {
      const pos = IsoUtils.toIso(e.x, e.y, 0); ctx.save(); ctx.translate(pos.x, pos.y); ctx.scale(1, 0.5);
      const time = Date.now() * 0.002; ctx.fillStyle = e.color; ctx.globalAlpha = 0.6; ctx.beginPath();
      for(let i=0; i<=Math.PI*2; i+=0.1) { const r = e.radius + Math.sin(i * 5 + time) * 2; if (i===0) ctx.moveTo(Math.cos(i)*r, Math.sin(i)*r); else ctx.lineTo(Math.cos(i)*r, Math.sin(i)*r); }
      ctx.fill(); ctx.restore();
  }

  drawGlobalEffects(ctx: CanvasRenderingContext2D, entities: Entity[], player: Entity, zone: Zone, rainDrops: any[]) {
      entities.filter(e => e.subType === 'SNIPER' && e.state === 'CHARGE').forEach(e => {
        const start = IsoUtils.toIso(e.x, e.y, 15); const end = IsoUtils.toIso(player.x, player.y, 10);
        ctx.strokeStyle = `rgba(255, 0, 0, ${e.timer/180})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
        const radius = Math.max(0, 20 * (1 - e.timer/180)); ctx.strokeStyle = '#ef4444'; ctx.beginPath(); ctx.arc(end.x, end.y, radius, 0, Math.PI*2); ctx.stroke();
      });
      if (zone.weather === 'RAIN' || zone.weather === 'ASH') {
        ctx.strokeStyle = zone.weather === 'RAIN' ? '#3b82f6' : '#a1a1aa'; ctx.lineWidth = 1; ctx.globalAlpha = 0.3; ctx.beginPath();
        rainDrops.forEach(r => { const p1 = IsoUtils.toIso(r.x, r.y, r.z); const p2 = IsoUtils.toIso(r.x, r.y, r.z + 15); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); });
        ctx.stroke(); ctx.globalAlpha = 1.0;
      }
  }

  drawFloatingTexts(ctx: CanvasRenderingContext2D, texts: FloatingText[], cam: Camera) {
      ctx.textAlign = 'center';
      texts.forEach(t => {
        const pos = IsoUtils.toIso(t.x, t.y, 60); const fs = t.size / cam.zoom;
        ctx.font = `bold ${fs}px 'Courier New', monospace`; ctx.fillStyle = 'black'; ctx.fillText(t.text, pos.x + 1, pos.y + 1);
        ctx.fillStyle = t.color; ctx.globalAlpha = t.life; ctx.fillText(t.text, pos.x, pos.y); ctx.globalAlpha = 1;
      });
  }

  drawDebugHitbox(ctx: CanvasRenderingContext2D, e: Entity) {
      const pos = IsoUtils.toIso(e.x, e.y, e.z);
      ctx.save(); ctx.translate(pos.x, pos.y); ctx.scale(1, 0.5); ctx.strokeStyle = '#0f0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
}
