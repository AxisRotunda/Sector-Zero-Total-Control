
import { Injectable, inject } from '@angular/core';
import { Entity } from '../../models/game.models';
import { Item } from '../../models/item.models';
import { InventoryService } from '../../game/inventory.service';
import { IsoUtils } from '../../utils/iso-utils';

interface StatusIcon { type: 'poison' | 'burn' | 'stun' | 'weakness' | 'slow' | 'bleed'; timer: number; maxTimer: number; icon: string; color: string; }

@Injectable({ providedIn: 'root' })
export class UnitRendererService {
  private inventory = inject(InventoryService);
  
  // Reusable vectors to prevent GC thrashing in the render loop
  private _iso = { x: 0, y: 0 };
  private _isoLeg = { x: 0, y: 0 };
  private _isoBody = { x: 0, y: 0 };
  
  // Trig cache vars (per entity)
  private _cos = 0;
  private _sin = 0;

  drawHumanoid(ctx: CanvasRenderingContext2D, e: Entity) {
      const isPlayer = e.type === 'PLAYER'; 
      const isGuard = e.subType === 'GUARD'; 
      const isNPC = e.type === 'NPC' && !isGuard; 
      const isCitizen = e.subType === 'CITIZEN'; 
      const isHit = e.hitFlash > 0;
      const isStunned = e.status.stun > 0;
      const primaryColor = isHit ? '#ffffff' : (isGuard ? '#3b82f6' : e.color);
      
      // Compute Trig once per entity
      this._cos = Math.cos(e.angle);
      this._sin = Math.sin(e.angle);

      // Animation State
      let rArmAngle = 0; let lArmAngle = 0; let legCycle = 0; let bodyTwist = 0; let bodyZ = 0; let headZ = 0; let rHandReach = 0;
      
      if (e.state === 'ATTACK' && isPlayer) {
          const phase = e.animPhase; const frame = e.animFrame;
          if (phase === 'startup') { const p = frame / 1; rArmAngle = p * (-Math.PI / 1.4); bodyTwist = p * -0.3; bodyZ = p * -2; } 
          else if (phase === 'active') { const p = (frame - 2) / 2; rArmAngle = (-Math.PI / 1.4) + p * (Math.PI / 1.4 + Math.PI / 3); bodyTwist = -0.3 + p * 0.7; rHandReach = p * 15; bodyZ = -2 + p * 2; } 
          else if (phase === 'recovery') { const p = (frame - 5) / 3; rArmAngle = (Math.PI / 3) - p * (Math.PI / 3 - Math.PI / 8); bodyTwist = 0.4 - p * 0.3; rHandReach = 15 - p * 10; bodyZ = 0; }
      } else if (e.state === 'ATTACK' && !isPlayer) {
          const p = 1 - ((e.timer || 0) / 10);
          if (p < 0.25) { rArmAngle = -Math.PI / 1.4; bodyTwist = -0.3; bodyZ = -2; } else if (p < 0.6) { rArmAngle = Math.PI / 3; bodyTwist = 0.4; rHandReach = 15; bodyZ = 0; } else { rArmAngle = Math.PI / 8; bodyTwist = 0.1; rHandReach = 5; bodyZ = 0; }
      } else if (['MOVE', 'CHARGE', 'RETREAT', 'PATROL'].includes(e.state)) {
          const cycle = Math.sin((e.animFrame + (e.animFrameTimer / 6)) / 6 * Math.PI * 2);
          legCycle = cycle * Math.PI / 6; bodyZ = Math.abs(cycle) * 2; lArmAngle = -legCycle * 0.8; rArmAngle = legCycle * 0.8;
      } else if (e.state === 'IDLE') {
          const breathe = Math.sin((e.animFrame + (e.animFrameTimer / 12)) / 4 * Math.PI * 2);
          bodyZ = breathe; headZ = breathe * 0.5; rArmAngle = breathe * 0.05; lArmAngle = breathe * -0.05;
          if (isNPC && !isCitizen) { rArmAngle = Math.PI / 4; lArmAngle = -Math.PI / 4; }
      }
      
      let equippedWeapon: Item | null = null; 
      let equippedArmor: Item | null = null;
      if (isPlayer) { 
          const eq = this.inventory.equipped(); 
          equippedWeapon = eq.weapon; 
          equippedArmor = eq.armor; 
      } else if (isGuard) {
          equippedWeapon = { type: 'WEAPON', shape: 'sword', color: '#1e3a8a', name: 'Rifle', id: '', level: 1, rarity: 'COMMON', stack: 1, maxStack: 1, stats: {} };
      } else if (e.equipment) {
          equippedWeapon = e.equipment.weapon || null;
          equippedArmor = e.equipment.armor || null;
      }

      // Glitch Effect Setup
      if (isStunned) {
          ctx.save();
          const offsetX = (Math.random() - 0.5) * 4;
          const offsetY = (Math.random() - 0.5) * 4;
          ctx.translate(offsetX, offsetY);
          // Chromatic aberration simulation (draw Cyan ghost)
          if (Math.random() > 0.5) {
              ctx.globalCompositeOperation = 'screen';
              ctx.fillStyle = '#0ff';
              ctx.globalAlpha = 0.5;
          }
      }

      // Helper to transform model space to ISO screen space without allocation
      const transformToIso = (wx: number, wy: number, wz: number, target: {x:number, y:number}) => {
         // Apply Body Twist rotation 2D
         const cosT = Math.cos(bodyTwist); const sinT = Math.sin(bodyTwist);
         const tx = wx * cosT - wy * sinT; 
         const ty = wx * sinT + wy * cosT;
         
         // Apply Entity rotation
         const rx = tx * this._cos - ty * this._sin; 
         const ry = tx * this._sin + ty * this._cos;
         
         IsoUtils.toIso(e.x + rx, e.y + ry, e.z + wz + bodyZ, target);
         return target;
      };

      // --- BATCH 1: LEGS ---
      const legLen = 18;
      // Leg transform doesn't twist with body
      const legTransform = (wx: number, wy: number, wz: number, target: {x:number, y:number}) => {
          const rx = wx * this._cos - wy * this._sin; 
          const ry = wx * this._sin + wy * this._cos; 
          IsoUtils.toIso(e.x + rx, e.y + ry, e.z + wz, target);
          return target;
      };

      ctx.lineWidth = 6; ctx.lineCap = 'round'; 
      ctx.strokeStyle = isGuard || isNPC ? '#1e293b' : '#27272a';
      
      const hips = legTransform(0, 0, legLen, this._iso); 
      const lExt = Math.sin(legCycle) * 10;
      
      // Reuse _isoLeg for left foot, then right foot
      const pFootL = legTransform(5, lExt, 0, this._isoLeg);
      
      ctx.beginPath(); 
      ctx.moveTo(hips.x, hips.y); ctx.lineTo(pFootL.x, pFootL.y); 
      ctx.stroke();

      const pFootR = legTransform(-5, -lExt, 0, this._isoLeg);
      ctx.beginPath();
      ctx.moveTo(hips.x, hips.y); ctx.lineTo(pFootR.x, pFootR.y); 
      ctx.stroke();

      // --- BATCH 2: BODY ---
      const torsoH = 20; const shoulderZ = legLen + torsoH;
      const pWaist = transformToIso(0, 0, legLen, this._isoBody); 
      const pNeck = transformToIso(0, 0, shoulderZ, this._iso); // Reuse _iso for neck
      
      // Store shoulders for arms
      const pLShoulder = { x: 0, y: 0 }; transformToIso(10, 0, shoulderZ - 2, pLShoulder);
      const pRShoulder = { x: 0, y: 0 }; transformToIso(-10, 0, shoulderZ - 2, pRShoulder);

      if (equippedArmor && !isHit) {
          ctx.fillStyle = equippedArmor.color; ctx.strokeStyle = '#18181b'; ctx.lineWidth = 1;
          ctx.beginPath(); 
          ctx.moveTo(pNeck.x, pNeck.y); 
          ctx.lineTo(pRShoulder.x, pRShoulder.y); 
          ctx.lineTo(pWaist.x - 5, pWaist.y); 
          ctx.lineTo(pWaist.x + 5, pWaist.y); 
          ctx.lineTo(pLShoulder.x, pLShoulder.y); 
          ctx.closePath(); 
          ctx.fill(); ctx.stroke();
          
          // Shoulders
          ctx.beginPath(); ctx.arc(pLShoulder.x, pLShoulder.y, 6, 0, Math.PI*2); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.arc(pRShoulder.x, pRShoulder.y, 6, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      } else { 
          ctx.strokeStyle = primaryColor; ctx.lineWidth = 14; 
          ctx.beginPath(); ctx.moveTo(pWaist.x, pWaist.y); ctx.lineTo(pNeck.x, pNeck.y); ctx.stroke(); 
      }

      // --- BATCH 3: HEAD ---
      const pHead = transformToIso(0, 0, shoulderZ + 8 + headZ, this._iso);
      ctx.fillStyle = isHit ? '#fff' : (e.type === 'PLAYER' ? '#0ea5e9' : (isGuard ? '#93c5fd' : (isNPC ? '#e4e4e7' : '#b91c1c'))); 
      if (isCitizen) ctx.fillStyle = '#a1a1aa';
      
      // Head bob/glitch
      if (isStunned && Math.random() > 0.7) {
          ctx.fillStyle = Math.random() > 0.5 ? '#f0f' : '#0ff';
      }
      ctx.beginPath(); ctx.arc(pHead.x, pHead.y - 4, 7, 0, Math.PI*2); ctx.fill();
      
      // --- BATCH 4: ARMS ---
      ctx.lineWidth = 5; ctx.strokeStyle = isHit ? '#fff' : (equippedArmor ? '#3f3f46' : primaryColor);
      
      // Left Arm
      const pHandL = transformToIso(10 + Math.cos(lArmAngle)*10, 10 + Math.sin(lArmAngle)*10, shoulderZ - 12, this._iso);
      ctx.beginPath(); ctx.moveTo(pLShoulder.x, pLShoulder.y); ctx.lineTo(pHandL.x, pHandL.y); ctx.stroke();
      
      // Right Arm
      const reach = 12 + rHandReach;
      const pHandR = transformToIso(-8 + Math.sin(rArmAngle)*10, 5 + Math.cos(rArmAngle)*reach, shoulderZ - 10, this._iso);
      ctx.beginPath(); ctx.moveTo(pRShoulder.x, pRShoulder.y); ctx.lineTo(pHandR.x, pHandR.y); ctx.stroke();

      if (!isNPC) { this.drawWeapon(ctx, pHandR, rArmAngle, equippedWeapon, e.angle + bodyTwist, isHit); }
      
      // Restore Glitch State
      if (isStunned) {
          ctx.restore();
      }

      this.drawStatusIndicators(ctx, e, pHead.x, pHead.y - 25);
      
      // Health Bar
      if (e.type === 'ENEMY' && e.hp < e.maxHp) {
          // Reuse _iso for bar position
          IsoUtils.toIso(e.x, e.y, e.z + 60, this._iso);
          ctx.fillStyle = '#000'; ctx.fillRect(this._iso.x - 15, this._iso.y, 30, 4);
          ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#22c55e' : '#ef4444'; ctx.fillRect(this._iso.x - 14, this._iso.y + 1, 28 * (e.hp/e.maxHp), 2);
          if (e.armor > 0) { ctx.fillStyle = '#f59e0b'; ctx.fillRect(this._iso.x - 15, this._iso.y - 3, 30, 2); }
      }
  }

  drawNPC(ctx: CanvasRenderingContext2D, e: Entity) {
      if (e.subType === 'TRADER' || e.subType === 'MEDIC') {
          // Reusing this._iso to avoid alloc
          IsoUtils.toIso(e.x + 20, e.y + 20, 0, this._iso);
          ctx.save(); ctx.translate(this._iso.x, this._iso.y); 
          ctx.fillStyle = '#27272a'; ctx.fillRect(-20, -20, 40, 30); 
          ctx.fillStyle = '#3f3f46'; ctx.beginPath(); ctx.moveTo(-20, -20); ctx.lineTo(0, -30); ctx.lineTo(20, -20); ctx.lineTo(0, -10); ctx.fill(); 
          ctx.restore();
      }
      
      this.drawHumanoid(ctx, e);
      
      if (e.subType === 'CITIZEN') return;
      
      IsoUtils.toIso(e.x, e.y, 70, this._iso);
      ctx.save(); ctx.translate(this._iso.x, this._iso.y);
      let icon = '?'; if (e.subType === 'MEDIC') icon = '✚'; if (e.subType === 'TRADER') icon = '$'; if (e.subType === 'HANDLER') icon = '!';
      const bounce = Math.sin(Date.now() * 0.005) * 5; ctx.translate(0, bounce - 20);
      ctx.fillStyle = e.color; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.shadowColor = e.color; ctx.shadowBlur = 10;
      ctx.fillText(icon, 0, 0); ctx.shadowBlur = 0; 
      ctx.restore();
  }

  private drawWeapon(ctx: CanvasRenderingContext2D, handPos: {x: number, y: number}, armAngle: number, item: Item | null, facingAngle: number, isHit: boolean) {
      ctx.save(); ctx.translate(handPos.x, handPos.y);
      const isoRotation = Math.atan2(Math.sin(facingAngle), Math.cos(facingAngle));
      ctx.rotate(isoRotation + armAngle);
      if (armAngle > Math.PI/4 && item && item.shape !== 'psiBlade') { ctx.fillStyle = `${item.color}40`; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-10, 30); ctx.lineTo(20, 30); ctx.fill(); }
      if (item && item.shape === 'psiBlade') { ctx.globalCompositeOperation = 'screen'; ctx.shadowBlur = 15; ctx.shadowColor = item.color; }
      const color = isHit ? '#fff' : (item ? item.color : '#52525b');
      ctx.fillStyle = color; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      if (!item) { ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill(); } 
      else {
          switch (item.shape) {
              case 'sword': ctx.fillStyle = '#27272a'; ctx.fillRect(-2, -2, 4, 8); ctx.fillRect(-6, 6, 12, 3); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-3, 9); ctx.lineTo(3, 9); ctx.lineTo(0, 45); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#ffffff80'; ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, 40); ctx.stroke(); break;
              case 'shield': ctx.fillRect(-2, -5, 4, 30); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 15, 12, 0, Math.PI*2); ctx.fill(); ctx.stroke(); break;
              case 'chip': case 'syringe': ctx.fillStyle = '#18181b'; ctx.fillRect(-4, 0, 8, 15); ctx.fillStyle = color; ctx.fillRect(-2, 2, 4, 10); ctx.shadowColor = color; ctx.shadowBlur = 5; ctx.fillRect(-1, 4, 2, 6); ctx.shadowBlur = 0; break;
              case 'psiBlade': ctx.fillStyle = '#18181b'; ctx.shadowBlur = 0; ctx.fillRect(-2, -2, 4, 10); ctx.shadowBlur = 10; ctx.shadowColor = item.color; ctx.fillStyle = item.color; ctx.beginPath(); ctx.moveTo(-2, 8); ctx.lineTo(2, 8); ctx.lineTo(0, 45 + Math.random() * 5); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.8; ctx.fillRect(-0.5, 8, 1, 35); ctx.globalAlpha = 1.0; break;
          }
      }
      ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over'; ctx.restore();
  }

  private drawStatusIndicators(ctx: CanvasRenderingContext2D, e: Entity, screenX: number, screenY: number) {
      const icons: StatusIcon[] = [];
      if (e.status.poison && e.status.poison.timer > 0) icons.push({ type: 'poison', timer: e.status.poison.timer, maxTimer: e.status.poison.duration, icon: '☠', color: '#84cc16' });
      if (e.status.burn && e.status.burn.timer > 0) icons.push({ type: 'burn', timer: e.status.burn.timer, maxTimer: e.status.burn.duration, icon: '🔥', color: '#f97316' });
      if (e.status.stun > 0) icons.push({ type: 'stun', timer: e.status.stun, maxTimer: 60, icon: '⭐', color: '#fbbf24' });
      if (e.status.weakness && e.status.weakness.timer > 0) icons.push({ type: 'weakness', timer: e.status.weakness.timer, maxTimer: e.status.weakness.duration, icon: '🛡️', color: '#a855f7' });
      if (e.status.slow > 0) icons.push({ type: 'slow', timer: e.status.slow, maxTimer: 120, icon: '❄️', color: '#38bdf8' });
      if (e.status.bleed && e.status.bleed.timer > 0) icons.push({ type: 'bleed', timer: e.status.bleed.timer, maxTimer: e.status.bleed.duration, icon: '🩸', color: '#dc2626' });

      let xOffset = -(icons.length * 20) / 2 + 10;
      icons.forEach(icon => {
          const x = screenX + xOffset; const y = screenY; const scale = 0.9 + Math.sin(Date.now() * 0.005) * 0.1;
          
          ctx.save(); 
          ctx.translate(x, y); 
          ctx.scale(scale, scale);
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; 
          ctx.fillRect(-10, -10, 20, 20);
          
          ctx.font = '16px sans-serif'; 
          ctx.fillStyle = icon.color; 
          ctx.textAlign = 'center'; 
          ctx.textBaseline = 'middle'; 
          ctx.fillText(icon.icon, 0, 0);
          
          const percent = icon.timer / icon.maxTimer; 
          ctx.fillStyle = icon.color; 
          ctx.fillRect(-8, 8, 16 * percent, 2);
          
          ctx.restore(); 
          xOffset += 20;
      });
  }
}
