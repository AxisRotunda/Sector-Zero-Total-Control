
import { Injectable } from '@angular/core';
import { Entity, Particle, FloatingText, Camera, Zone } from '../../models/game.models';
import { IsoUtils } from '../../utils/iso-utils';
import { MissionObjective } from '../../game/mission.service';

@Injectable({ providedIn: 'root' })
export class EffectRendererService {
  
  // Reusable vector to avoid allocation in particle loop
  private _pos = { x: 0, y: 0 };

  drawParticleIso(ctx: CanvasRenderingContext2D, p: Particle) {
      IsoUtils.toIso(p.x, p.y, p.z, this._pos);
      
      ctx.save();
      const lifeInv = 1.0 - p.life; 
      const size = p.sizeStart + (p.sizeEnd - p.sizeStart) * lifeInv; 
      const alpha = p.alphaStart + (p.alphaEnd - p.alphaStart) * lifeInv;
      
      ctx.globalAlpha = Math.max(0, alpha); 
      if (p.composite) ctx.globalCompositeOperation = p.composite;
      
      ctx.fillStyle = p.color; 
      ctx.translate(this._pos.x, this._pos.y); 
      if (p.rotation) ctx.rotate(p.rotation * Math.PI/180);
      
      if (p.shape === 'square') { ctx.fillRect(-size/2, -size/2, size, size); } 
      else if (p.shape === 'star') { ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size/4, -size/4); ctx.lineTo(size, 0); ctx.lineTo(size/4, size/4); ctx.lineTo(0, size); ctx.lineTo(-size/4, size/4); ctx.lineTo(-size, 0); ctx.lineTo(-size/4, -size/4); ctx.fill(); } 
      else if (p.shape === 'spark') { ctx.beginPath(); ctx.ellipse(0, 0, size, size * 0.1, 0, 0, Math.PI*2); ctx.fill(); } 
      else { ctx.beginPath(); ctx.arc(0, 0, size/2, 0, Math.PI*2); ctx.fill(); }
      
      ctx.restore(); 
      ctx.globalAlpha = 1;
  }

  drawHitboxIso(ctx: CanvasRenderingContext2D, e: Entity) {
      IsoUtils.toIso(e.x, e.y, e.z, this._pos);
      ctx.save(); ctx.translate(this._pos.x, this._pos.y); ctx.rotate(Math.PI/4); 
      if (e.source === 'PLAYER' && e.radius < 100) { ctx.globalAlpha = 0.6; ctx.strokeStyle = e.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, e.radius, e.angle - Math.PI/3, e.angle + Math.PI/3); ctx.stroke(); } 
      else { ctx.strokeStyle = e.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, e.radius, e.radius * 0.5, -Math.PI/4, 0, Math.PI*2); ctx.stroke(); }
      ctx.restore();
  }

  drawPsionicWave(ctx: CanvasRenderingContext2D, hitbox: Entity) {
    IsoUtils.toIso(hitbox.x, hitbox.y, hitbox.z, this._pos);
    ctx.save(); ctx.translate(this._pos.x, this._pos.y); ctx.scale(1, 0.5);
    let progress = (10 - hitbox.timer) / 10; if (progress < 0) progress = 0;
    const currentRadius = Math.max(0, hitbox.radius * progress); const opacity = Math.max(0, 1 - progress * progress);
    ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = `rgba(168, 85, 247, ${opacity})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, currentRadius, 0, Math.PI * 2); ctx.stroke();
    if (progress > 0.3) { ctx.strokeStyle = `rgba(192, 132, 252, ${opacity * 0.7})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, currentRadius * 0.7, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = `rgba(216, 180, 254, ${opacity * 0.3})`; ctx.beginPath(); ctx.arc(0, 0, currentRadius * 0.8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  drawSteamColumn(ctx: CanvasRenderingContext2D, e: Entity) {
      IsoUtils.toIso(e.x, e.y, 0, this._pos); 
      ctx.save(); ctx.translate(this._pos.x, this._pos.y); ctx.globalAlpha = 0.3; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.lineTo(30, -100); ctx.lineTo(-30, -100); ctx.fill(); ctx.restore();
  }

  drawSludge(ctx: CanvasRenderingContext2D, e: Entity) {
      IsoUtils.toIso(e.x, e.y, 0, this._pos); 
      ctx.save(); ctx.translate(this._pos.x, this._pos.y); ctx.scale(1, 0.5);
      const time = Date.now() * 0.002; ctx.fillStyle = e.color; ctx.globalAlpha = 0.6; ctx.beginPath();
      for(let i=0; i<=Math.PI*2; i+=0.1) { const r = e.radius + Math.sin(i * 5 + time) * 2; if (i===0) ctx.moveTo(Math.cos(i)*r, Math.sin(i)*r); else ctx.lineTo(Math.cos(i)*r, Math.sin(i)*r); }
      ctx.fill(); ctx.restore();
  }

  drawGlobalEffects(ctx: CanvasRenderingContext2D, entities: Entity[], player: Entity, zone: Zone, rainDrops: any[]) {
      entities.filter(e => e.subType === 'SNIPER' && e.state === 'CHARGE').forEach(e => {
        // Reuse internal _pos for start, need separate for end to draw line
        IsoUtils.toIso(e.x, e.y, 15, this._pos); 
        const startX = this._pos.x;
        const startY = this._pos.y;
        
        IsoUtils.toIso(player.x, player.y, 10, this._pos);
        const endX = this._pos.x;
        const endY = this._pos.y;

        ctx.strokeStyle = `rgba(255, 0, 0, ${e.timer/180})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(endX, endY); ctx.stroke();
        const radius = Math.max(0, 20 * (1 - e.timer/180)); ctx.strokeStyle = '#ef4444'; ctx.beginPath(); ctx.arc(endX, endY, radius, 0, Math.PI*2); ctx.stroke();
      });
      
      if (zone.weather === 'RAIN' || zone.weather === 'ASH') {
        ctx.strokeStyle = zone.weather === 'RAIN' ? '#3b82f6' : '#a1a1aa'; ctx.lineWidth = 1; ctx.globalAlpha = 0.3; ctx.beginPath();
        rainDrops.forEach(r => { 
            IsoUtils.toIso(r.x, r.y, r.z, this._pos);
            const p1x = this._pos.x;
            const p1y = this._pos.y;
            IsoUtils.toIso(r.x, r.y, r.z + 15, this._pos);
            
            ctx.moveTo(p1x, p1y); ctx.lineTo(this._pos.x, this._pos.y); 
        });
        ctx.stroke(); ctx.globalAlpha = 1.0;
      }
  }

  drawFloatingTexts(ctx: CanvasRenderingContext2D, texts: FloatingText[], cam: Camera) {
      ctx.textAlign = 'center';
      texts.forEach(t => {
        IsoUtils.toIso(t.x, t.y, 60, this._pos); 
        const fs = t.size / cam.zoom;
        ctx.font = `bold ${fs}px 'Courier New', monospace`; ctx.fillStyle = 'black'; ctx.fillText(t.text, this._pos.x + 1, this._pos.y + 1);
        ctx.fillStyle = t.color; ctx.globalAlpha = t.life; ctx.fillText(t.text, this._pos.x, this._pos.y); ctx.globalAlpha = 1;
      });
  }

  drawDebugHitbox(ctx: CanvasRenderingContext2D, e: Entity) {
      IsoUtils.toIso(e.x, e.y, e.z, this._pos);
      ctx.save(); ctx.translate(this._pos.x, this._pos.y); ctx.scale(1, 0.5); ctx.strokeStyle = '#0f0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }

  drawInteractionIndicator(ctx: CanvasRenderingContext2D, e: Entity, label: string) {
      if (!e) return;
      IsoUtils.toIso(e.x, e.y, e.radius * 2, this._pos);
      
      const time = Date.now() * 0.005;
      const hoverY = Math.sin(time) * 5;
      
      ctx.save();
      ctx.translate(this._pos.x, this._pos.y + hoverY - 40);
      
      // Draw Bracket
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 10;
      
      const w = 20;
      const h = 20;

      // Top-Left Corner
      ctx.beginPath();
      ctx.moveTo(-w, -h + 5); ctx.lineTo(-w, -h); ctx.lineTo(-w + 5, -h);
      ctx.stroke();

      // Top-Right Corner
      ctx.beginPath();
      ctx.moveTo(w - 5, -h); ctx.lineTo(w, -h); ctx.lineTo(w, -h + 5);
      ctx.stroke();

      // Bottom-Left Corner
      ctx.beginPath();
      ctx.moveTo(-w, h - 5); ctx.lineTo(-w, h); ctx.lineTo(-w + 5, h);
      ctx.stroke();

      // Bottom-Right Corner
      ctx.beginPath();
      ctx.moveTo(w - 5, h); ctx.lineTo(w, h); ctx.lineTo(w, h - 5);
      ctx.stroke();
      
      // Label Background
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      const textWidth = ctx.measureText(label).width * 2; // Est
      ctx.fillRect(-40, -h - 25, 80, 16);
      
      // Label Text
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(label, 0, -h - 13);
      
      // Input Hint
      ctx.font = '10px monospace';
      ctx.fillStyle = '#4ade80';
      ctx.fillText('[F] / TAP', 0, h + 15);
      
      ctx.restore();
  }

  // Draw On-Screen Waypoint / Off-Screen Arrow
  drawGuidanceOverlay(ctx: CanvasRenderingContext2D, activeObjective: MissionObjective | null, player: Entity, cam: Camera, canvasWidth: number, canvasHeight: number, currentZoneId: string) {
      if (!activeObjective || !activeObjective.targetLocation) return;
      
      // If target is in another zone, we currently don't draw vector (TODO: Pathfind to exit)
      // We only draw if activeObjective.targetZoneId matches current
      if (activeObjective.targetZoneId !== currentZoneId) return;

      const target = activeObjective.targetLocation;
      
      // 1. Calculate Target Screen Position
      // Reuse logic from RenderService.getScreenToWorld essentially but inverted
      // World -> Screen transform manually because we don't have the context transform applied at this stage (this runs in overlay pass)
      
      // Camera Transform Re-calc
      // Center of screen
      const cx = canvasWidth / 2;
      const cy = canvasHeight / 2;
      
      // World delta
      const wx = target.x - player.x;
      const wy = target.y - player.y;
      
      // Iso Projection of delta
      const isoX = (wx - wy);
      const isoY = (wx + wy) * 0.5;
      
      // Apply Zoom
      const screenX = cx + (isoX * cam.zoom);
      const screenY = cy + (isoY * cam.zoom);
      
      // 2. Check Bounds
      const padding = 40;
      const minX = padding;
      const maxX = canvasWidth - padding;
      const minY = padding;
      const maxY = canvasHeight - padding;
      
      const isOffScreen = screenX < minX || screenX > maxX || screenY < minY || screenY > maxY;
      
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#fbbf24';
      ctx.fillStyle = '#fbbf24';
      ctx.strokeStyle = '#fbbf24';
      
      if (isOffScreen) {
          // Clamp to edge
          // Vector from center
          const dx = screenX - cx;
          const dy = screenY - cy;
          const angle = Math.atan2(dy, dx);
          
          // Simple clamping logic (intersects box)
          // Use absolute ratio to find which edge is hit first
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);
          const ratioX = (canvasWidth / 2 - padding) / absDx;
          const ratioY = (canvasHeight / 2 - padding) / absDy;
          const scale = Math.min(ratioX, ratioY);
          
          const clampX = cx + dx * scale;
          const clampY = cy + dy * scale;
          
          // Draw Arrow
          ctx.translate(clampX, clampY);
          ctx.rotate(angle);
          
          ctx.beginPath();
          ctx.moveTo(10, 0);
          ctx.lineTo(-10, 10);
          ctx.lineTo(-10, -10);
          ctx.closePath();
          ctx.fill();
          
          // Pulse effect
          const pulse = (Math.sin(Date.now() * 0.01) + 1) * 0.5;
          ctx.globalAlpha = 0.5 + pulse * 0.5;
          ctx.beginPath();
          ctx.arc(0, 0, 20, 0, Math.PI*2);
          ctx.stroke();
          
      } else {
          // On Screen Reticle
          ctx.translate(screenX, screenY - 60); // Float above head
          
          const bounce = Math.sin(Date.now() * 0.008) * 5;
          ctx.translate(0, bounce);
          
          // Down Arrow / Chevron
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-10, -10);
          ctx.lineTo(0, 10);
          ctx.lineTo(10, -10);
          ctx.stroke();
          
          // Label
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText("OBJECTIVE", 0, -20);
      }
      
      ctx.restore();
  }
}
