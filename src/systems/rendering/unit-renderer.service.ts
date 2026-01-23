
import { Injectable, inject } from '@angular/core';
import { Entity, VisualProfile } from '../../models/game.models';
import { Item } from '../../models/item.models';
import { InventoryService } from '../../game/inventory.service';
import { IsoUtils } from '../../utils/iso-utils';
import { InteractionService } from '../../services/interaction.service';
import { PlayerStatsService } from '../../game/player/player-stats.service';

interface StatusIcon { type: 'poison' | 'burn' | 'stun' | 'weakness' | 'slow' | 'bleed'; timer: number; maxTimer: number; icon: string; color: string; }

@Injectable({ providedIn: 'root' })
export class UnitRendererService {
  private inventory = inject(InventoryService);
  private interaction = inject(InteractionService);
  private playerStats = inject(PlayerStatsService);
  
  // Reusable vectors to prevent GC thrashing in the render loop
  private _iso = { x: 0, y: 0 };
  private _isoLeg = { x: 0, y: 0 };
  private _isoBody = { x: 0, y: 0 };
  
  // Trig cache vars (per entity)
  private _cos = 0;
  private _sin = 0;

  // Optimization: Angle Lookup Table
  private angleCache = new Map<number, { sin: number, cos: number }>();

  constructor() {
      // Pre-compute trig for 360 degrees in 5-degree steps
      for (let angle = 0; angle < 360; angle += 5) {
          const rad = angle * Math.PI / 180;
          this.angleCache.set(angle, {
              sin: Math.sin(rad),
              cos: Math.cos(rad)
          });
      }
  }

  private getCachedTrig(rad: number) {
      const deg = Math.round((rad * 180 / Math.PI));
      const normalized = (deg % 360 + 360) % 360;
      const snapped = Math.round(normalized / 5) * 5;
      return this.angleCache.get(snapped) || { sin: Math.sin(rad), cos: Math.cos(rad) };
  }

  drawHumanoid(ctx: CanvasRenderingContext2D, e: Entity) {
      const isPlayer = e.type === 'PLAYER'; 
      const isGuard = e.subType === 'GUARD'; 
      const isNPC = e.type === 'NPC' && !isGuard; 
      const isCitizen = e.subType === 'CITIZEN'; 
      const isHit = e.hitFlash > 0;
      const isStunned = e.status.stun > 0;
      
      // Fallback colors if no visual profile
      const primaryColor = isHit ? '#ffffff' : (isGuard ? '#3b82f6' : e.color);
      
      // Use cached trig
      const trig = this.getCachedTrig(e.angle);
      this._cos = trig.cos;
      this._sin = trig.sin;

      // Animation State
      let rArmAngle = 0; let lArmAngle = 0; let legCycle = 0; let bodyTwist = 0; let bodyZ = 0; let headZ = 0; let rHandReach = 0;
      
      if (e.state === 'ATTACK' && isPlayer) {
          const phase = e.animPhase; const frame = e.animFrame;
          
          // Attack Telegraphing (Red Arc) during Startup
          if (phase === 'startup') {
              const reach = 80; // Approximate visual reach
              IsoUtils.toIso(e.x, e.y, 0, this._iso);
              ctx.save();
              ctx.translate(this._iso.x, this._iso.y);
              ctx.scale(1, 0.5); // Iso flattening
              ctx.rotate(e.angle);
              
              ctx.globalAlpha = 0.3;
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(0, 0, reach, -Math.PI/3, Math.PI/3);
              ctx.stroke();
              
              // Fill sector
              ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
              ctx.beginPath();
              ctx.moveTo(0,0);
              ctx.arc(0, 0, reach, -Math.PI/3, Math.PI/3);
              ctx.fill();
              ctx.restore();
          }

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

      // --- VISUAL INTERACTION INDICATOR ---
      const activeTarget = this.interaction.activeInteractable();
      if (activeTarget && activeTarget.id === e.id) {
          IsoUtils.toIso(e.x, e.y, 0, this._iso);
          ctx.save();
          ctx.translate(this._iso.x, this._iso.y);
          ctx.scale(1, 0.5); // Flatten for Iso perspective
          
          const pulse = (Math.sin(Date.now() * 0.01) + 1) * 0.5; // 0 to 1
          const radius = e.radius + 10 + pulse * 5;
          
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.6 + pulse * 0.4;
          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
          ctx.stroke();
          
          ctx.restore();
      }

      // --- PAPER DOLL RENDERER ---
      const vis = e.visuals || {
          headType: 'NONE', bodyType: 'STANDARD', clothingType: 'UNIFORM', 
          accessoryType: 'NONE', faceType: 'NONE', 
          colors: { primary: primaryColor, secondary: '#333', skin: '#d4d4d8', hair: '#18181b', accent: '#06b6d4' },
          scaleHeight: 1, scaleWidth: 1
      } as VisualProfile;

      const scaleW = vis.scaleWidth || 1;
      const scaleH = vis.scaleHeight || 1;

      // 1. Back Accessories (Cape, Backpack) - Draw BEHIND body
      const pWaist = transformToIso(0, 0, 18, this._isoBody);
      if (!isHit && vis.accessoryType === 'CAPE') {
          const pShoulders = transformToIso(0, 0, 38 * scaleH, this._iso);
          const capeEnd = transformToIso(-20 * Math.sin(legCycle), 0, 5, this._isoLeg); // Sway
          ctx.fillStyle = vis.colors.primary;
          ctx.beginPath();
          ctx.moveTo(pShoulders.x - 10 * scaleW, pShoulders.y);
          ctx.lineTo(pShoulders.x + 10 * scaleW, pShoulders.y);
          ctx.lineTo(capeEnd.x + 15 * scaleW, capeEnd.y);
          ctx.lineTo(capeEnd.x - 15 * scaleW, capeEnd.y); 
          ctx.fill();
      }

      // 2. Legs
      ctx.fillStyle = vis.colors.secondary;
      const legColor = isHit ? '#fff' : vis.colors.secondary;
      
      const drawLeg = (angle: number) => {
          const knee = transformToIso(Math.sin(angle) * 10 * scaleW, Math.cos(angle) * 5, 8, this._isoLeg);
          const foot = transformToIso(Math.sin(angle) * 20 * scaleW, Math.cos(angle) * 15, 0, this._iso);
          ctx.strokeStyle = legColor;
          ctx.lineWidth = 6 * scaleW;
          ctx.beginPath();
          ctx.moveTo(pWaist.x, pWaist.y);
          ctx.lineTo(knee.x, knee.y);
          ctx.lineTo(foot.x, foot.y);
          ctx.stroke();
      };
      
      drawLeg(legCycle); // Right
      drawLeg(-legCycle + Math.PI); // Left

      // 3. Torso
      const pShoulders = transformToIso(0, 0, 38 * scaleH, this._iso);
      ctx.strokeStyle = isHit ? '#fff' : vis.colors.primary;
      ctx.lineWidth = 14 * scaleW;
      ctx.beginPath();
      ctx.moveTo(pWaist.x, pWaist.y);
      ctx.lineTo(pShoulders.x, pShoulders.y);
      ctx.stroke();
      
      // Vest/Armor Detail
      if (vis.clothingType === 'ARMOR' || vis.clothingType === 'VEST') {
          ctx.strokeStyle = vis.colors.secondary;
          ctx.lineWidth = 10 * scaleW;
          ctx.beginPath();
          ctx.moveTo(pWaist.x, pWaist.y - 5);
          ctx.lineTo(pShoulders.x, pShoulders.y + 5);
          ctx.stroke();
      }

      // 4. Head
      const pHead = transformToIso(0, 0, 48 * scaleH + headZ, this._iso);
      
      // Head Shape
      ctx.fillStyle = isHit ? '#fff' : vis.colors.skin;
      ctx.beginPath();
      ctx.arc(pHead.x, pHead.y, 8 * scaleW, 0, Math.PI * 2);
      ctx.fill();
      
      // Helmet/Hair
      if (!isHit) {
          if (vis.headType === 'HELMET') {
              ctx.fillStyle = vis.colors.primary;
              ctx.beginPath(); ctx.arc(pHead.x, pHead.y - 2, 9 * scaleW, Math.PI, 0); ctx.fill();
              // Visor
              ctx.fillStyle = vis.colors.accent;
              ctx.fillRect(pHead.x - 6 * scaleW, pHead.y - 2, 12 * scaleW, 3);
          } else if (vis.headType === 'HOOD') {
              ctx.fillStyle = vis.colors.primary;
              ctx.beginPath(); ctx.arc(pHead.x, pHead.y, 10 * scaleW, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#000'; // Face shadow
              ctx.beginPath(); ctx.arc(pHead.x, pHead.y + 1, 5 * scaleW, 0, Math.PI * 2); ctx.fill();
          } else if (vis.headType === 'SPIKEY_HAIR') {
              ctx.fillStyle = vis.colors.hair;
              ctx.beginPath();
              ctx.moveTo(pHead.x - 8, pHead.y);
              ctx.lineTo(pHead.x, pHead.y - 12);
              ctx.lineTo(pHead.x + 8, pHead.y);
              ctx.fill();
          }
      }

      // 5. Arms & Weapons
      const drawArm = (angle: number, isRight: boolean) => {
          const shoulderX = isRight ? 8 * scaleW : -8 * scaleW;
          const shoulderPos = transformToIso(shoulderX, 0, 36 * scaleH, this._iso);
          
          // Elbow
          const elbowX = shoulderX + Math.sin(angle) * 12 * scaleW;
          const elbowY = Math.cos(angle) * 12;
          const elbowPos = transformToIso(elbowX, elbowY, 24 * scaleH, this._isoLeg);
          
          // Hand
          const handX = shoulderX + Math.sin(angle) * 24 * scaleW + (isRight ? 0 : rHandReach); // Reach only affects active arm if needed
          const handY = Math.cos(angle) * 24;
          const handPos = transformToIso(handX, handY, 20 * scaleH, this._iso);

          ctx.strokeStyle = isHit ? '#fff' : vis.colors.primary;
          ctx.lineWidth = 5 * scaleW;
          ctx.beginPath();
          ctx.moveTo(shoulderPos.x, shoulderPos.y);
          ctx.lineTo(elbowPos.x, elbowPos.y);
          ctx.lineTo(handPos.x, handPos.y);
          ctx.stroke();
          
          // Weapon (Right Hand Only usually)
          if (isRight && equippedWeapon && !isHit) {
              this.drawWeapon(ctx, handPos.x, handPos.y, e.angle, equippedWeapon);
          }
      };

      drawArm(lArmAngle, false);
      drawArm(rArmAngle, true);

      // Restore if stunned
      if (isStunned) {
          ctx.restore();
      }
  }

  private drawWeapon(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, item: Item) {
      ctx.save();
      ctx.translate(x, y);
      // Simple rotation matching player facing, modified slightly by swing
      ctx.rotate(angle);
      
      const color = item.color;
      
      if (item.shape === 'sword' || item.shape === 'psiBlade') {
          ctx.fillStyle = '#52525b';
          ctx.fillRect(0, -2, 30, 4); // Blade
          ctx.fillStyle = color;
          ctx.fillRect(0, -1, 30, 2); // Glow
          ctx.fillStyle = '#18181b';
          ctx.fillRect(-5, -4, 5, 8); // Hilt
      } else if (item.shape === 'shield') {
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(5, 0, 10, 0, Math.PI*2); ctx.fill();
      } else {
          // Generic Baton/Gun
          ctx.fillStyle = '#333';
          ctx.fillRect(0, -2, 20, 4);
          ctx.fillStyle = color;
          ctx.fillRect(15, -1, 5, 2);
      }
      
      ctx.restore();
  }

  drawNPC(ctx: CanvasRenderingContext2D, e: Entity) {
      // Reuse humanoid renderer but ensure profile is set
      this.drawHumanoid(ctx, e);
      
      // Floating Icon for important NPCs
      if (['MEDIC', 'TRADER', 'HANDLER'].includes(e.subType || '')) {
          IsoUtils.toIso(e.x, e.y, e.height || 80, this._iso);
          ctx.save();
          ctx.translate(this._iso.x, this._iso.y - 20);
          
          // Float
          const float = Math.sin(Date.now() * 0.005) * 5;
          ctx.translate(0, float);
          
          let icon = '?';
          let color = '#fff';
          if (e.subType === 'MEDIC') { icon = '+'; color = '#ef4444'; }
          if (e.subType === 'TRADER') { icon = '$'; color = '#eab308'; }
          if (e.subType === 'HANDLER') { icon = '!'; color = '#3b82f6'; }
          
          ctx.fillStyle = color;
          ctx.font = 'bold 20px monospace';
          ctx.textAlign = 'center';
          ctx.shadowColor = color;
          ctx.shadowBlur = 10;
          ctx.fillText(icon, 0, 0);
          
          ctx.restore();
      }
  }
}
