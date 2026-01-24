
import { Injectable, inject } from '@angular/core';
import { Entity, VisualProfile } from '../../models/game.models';
import { Item } from '../../models/item.models';
import { InventoryService } from '../../game/inventory.service';
import { IsoUtils } from '../../utils/iso-utils';
import { InteractionService } from '../../services/interaction.service';
import { PlayerStatsService } from '../../game/player/player-stats.service';
import { PlayerAbilitiesService } from '../../game/player/player-abilities.service';

interface StatusIcon { type: 'poison' | 'burn' | 'stun' | 'weakness' | 'slow' | 'bleed'; timer: number; maxTimer: number; icon: string; color: string; }

@Injectable({ providedIn: 'root' })
export class UnitRendererService {
  private inventory = inject(InventoryService);
  private interaction = inject(InteractionService);
  private playerStats = inject(PlayerStatsService);
  private abilities = inject(PlayerAbilitiesService);
  
  private _iso = { x: 0, y: 0 };
  private _isoLeg = { x: 0, y: 0 };
  private _isoBody = { x: 0, y: 0 };
  private _isoShoulder = { x: 0, y: 0 };
  private _isoElbow = { x: 0, y: 0 };
  private _isoHand = { x: 0, y: 0 };
  
  private _cos = 0;
  private _sin = 0;

  private angleCache = new Map<number, { sin: number, cos: number }>();

  constructor() {
      for (let angle = 0; angle < 360; angle += 1) {
          const rad = angle * Math.PI / 180;
          this.angleCache.set(angle, { sin: Math.sin(rad), cos: Math.cos(rad) });
      }
  }

  private getCachedTrig(rad: number) {
      const deg = Math.round((rad * 180 / Math.PI));
      const normalized = (deg % 360 + 360) % 360;
      return this.angleCache.get(normalized) || { sin: Math.sin(rad), cos: Math.cos(rad) };
  }

  drawHumanoid(ctx: CanvasRenderingContext2D, e: Entity) {
      if (e.state === 'DEAD') return;

      const isPlayer = e.type === 'PLAYER'; 
      const isGuard = e.subType === 'GUARD'; 
      const isNPC = e.type === 'NPC' && !isGuard; 
      const isCitizen = e.subType === 'CITIZEN'; 
      const isHit = e.hitFlash > 0;
      const isStunned = e.status.stun > 0;
      
      const primaryColor = isHit ? '#ffffff' : (isGuard ? '#3b82f6' : e.color);
      
      const trig = this.getCachedTrig(e.angle);
      this._cos = trig.cos;
      this._sin = trig.sin;

      let equippedWeapon: Item | null = null; 
      if (isPlayer) { 
          const eq = this.inventory.equipped(); 
          equippedWeapon = eq.weapon; 
      } else if (isGuard) {
          equippedWeapon = { type: 'WEAPON', shape: 'rifle', color: '#1e3a8a', name: 'Rifle', id: '', level: 1, rarity: 'COMMON', stack: 1, maxStack: 1, stats: {} };
      } else if (e.subType === 'SNIPER') {
          equippedWeapon = { type: 'WEAPON', shape: 'railgun', color: '#a855f7', name: 'Railgun', id: '', level: 1, rarity: 'RARE', stack: 1, maxStack: 1, stats: {} };
      } else if (e.equipment) {
          equippedWeapon = e.equipment.weapon || null;
      }

      const isRanged = equippedWeapon && ['pistol', 'rifle', 'shotgun', 'railgun'].includes(equippedWeapon.shape);
      const isTwoHanded = equippedWeapon && ['rifle', 'shotgun', 'railgun'].includes(equippedWeapon.shape);

      let rArmAngle = 0; let lArmAngle = 0; let legCycle = 0; let bodyTwist = 0; let bodyZ = 0; let headZ = 0; let rHandReach = 0;
      
      if (e.state === 'ATTACK') {
          if (isRanged) {
              const p = 1 - ((e.timer || 0) / (isPlayer ? 10 : 30)); 
              const recoil = Math.sin(p * Math.PI) * 0.3; 
              rArmAngle = 0 - recoil; 
              lArmAngle = isTwoHanded ? (Math.PI / 6) : 0; 
              bodyTwist = isTwoHanded ? 0.8 : 0.4; 
              bodyZ = -1 * recoil; 
          } else {
              // MELEE LOGIC
              if (isPlayer && this.abilities.activeComboStep) {
                  const step = this.abilities.activeComboStep;
                  const phase = e.animPhase;
                  // Use standardized 0-1 progress derived from logic frame
                  // Approximate progress based on arbitrary constants in animation service
                  // Ideally pass progress explicitly in Entity, but using animFrame heuristics for now
                  const p = e.animFrame / 8; // Normalized approx

                  if (step.swingType === 'THRUST') {
                      rArmAngle = -Math.PI/2 + (Math.sin(p * Math.PI) * 1.5);
                      bodyTwist = 0.5;
                      rHandReach = Math.sin(p * Math.PI) * 30;
                  } else if (step.swingType === 'OVERHEAD') {
                      rArmAngle = -Math.PI + (p * Math.PI * 1.5); // Top to bottom
                      bodyTwist = 0.2;
                  } else if (step.swingType === 'SLASH_LEFT') {
                      rArmAngle = (Math.PI/2) - (p * Math.PI); // Right to Left
                      bodyTwist = 0.5 - p;
                  } else { // SLASH_RIGHT (Default)
                      rArmAngle = (-Math.PI/2) + (p * Math.PI); // Left to Right
                      bodyTwist = -0.5 + p;
                  }
              } else {
                  // Fallback / Enemy Logic
                  const p = 1 - ((e.timer || 0) / 10);
                  if (p < 0.25) { rArmAngle = -Math.PI / 1.4; bodyTwist = -0.3; bodyZ = -2; } 
                  else if (p < 0.6) { rArmAngle = Math.PI / 3; bodyTwist = 0.4; rHandReach = 15; bodyZ = 0; } 
                  else { rArmAngle = Math.PI / 8; bodyTwist = 0.1; rHandReach = 5; bodyZ = 0; }
              }
          }
      } 
      else if (['MOVE', 'CHARGE', 'RETREAT', 'PATROL'].includes(e.state)) {
          const cycle = Math.sin((e.animFrame + (e.animFrameTimer / 6)) / 6 * Math.PI * 2);
          legCycle = cycle * Math.PI / 6; 
          bodyZ = Math.abs(cycle) * 2; 
          
          if (isRanged && isPlayer) {
              rArmAngle = Math.PI / 12 + cycle * 0.1;
              lArmAngle = isTwoHanded ? (Math.PI / 6 + cycle * 0.1) : (-legCycle * 0.8);
              bodyTwist = isTwoHanded ? 0.5 : 0.2;
          } else {
              lArmAngle = -legCycle * 0.8; 
              rArmAngle = legCycle * 0.8;
          }
      } 
      else if (e.state === 'IDLE') {
          const breathe = Math.sin((e.animFrame + (e.animFrameTimer / 12)) / 4 * Math.PI * 2);
          bodyZ = breathe; headZ = breathe * 0.5; 
          
          if (isRanged && isPlayer) {
              rArmAngle = Math.PI / 6 + breathe * 0.02;
              lArmAngle = isTwoHanded ? (Math.PI / 4) : (breathe * -0.05);
              bodyTwist = isTwoHanded ? 0.3 : 0;
          } else {
              rArmAngle = breathe * 0.05; lArmAngle = breathe * -0.05;
              if (isNPC && !isCitizen) { rArmAngle = Math.PI / 4; lArmAngle = -Math.PI / 4; }
          }
      }

      if (isStunned) {
          ctx.save();
          const offsetX = (Math.random() - 0.5) * 4;
          const offsetY = (Math.random() - 0.5) * 4;
          ctx.translate(offsetX, offsetY);
          if (Math.random() > 0.5) {
              ctx.globalCompositeOperation = 'screen';
              ctx.fillStyle = '#0ff';
              ctx.globalAlpha = 0.5;
          }
      }

      const transformToIso = (wx: number, wy: number, wz: number, target: {x:number, y:number}) => {
         const cosT = Math.cos(bodyTwist); const sinT = Math.sin(bodyTwist);
         const tx = wx * cosT - wy * sinT; 
         const ty = wx * sinT + wy * cosT;
         
         const rx = tx * this._cos - ty * this._sin; 
         const ry = tx * this._sin + ty * this._cos;
         
         IsoUtils.toIso(e.x + rx, e.y + ry, e.z + wz + bodyZ, target);
         return target;
      };

      const activeTarget = this.interaction.activeInteractable();
      if (activeTarget && activeTarget.id === e.id) {
          IsoUtils.toIso(e.x, e.y, 0, this._iso);
          ctx.save();
          ctx.translate(this._iso.x, this._iso.y);
          ctx.scale(1, 0.5); 
          const pulse = (Math.sin(Date.now() * 0.01) + 1) * 0.5; 
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.6 + pulse * 0.4;
          ctx.beginPath();
          ctx.arc(0, 0, e.radius + 10 + pulse * 5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
      }

      const vis = e.visuals || {
          headType: 'NONE', bodyType: 'STANDARD', clothingType: 'UNIFORM', 
          accessoryType: 'NONE', faceType: 'NONE', 
          colors: { primary: primaryColor, secondary: '#333', skin: '#d4d4d8', hair: '#18181b', accent: '#06b6d4' },
          scaleHeight: 1, scaleWidth: 1
      } as VisualProfile;

      const scaleW = vis.scaleWidth || 1;
      const scaleH = vis.scaleHeight || 1;

      // 1. Back Accessories
      const pWaist = transformToIso(0, 0, 18, this._isoBody);
      if (!isHit && vis.accessoryType === 'CAPE') {
          const pShoulders = transformToIso(0, 0, 38 * scaleH, this._iso);
          const capeEnd = transformToIso(-20 * Math.sin(legCycle), 0, 5, this._isoLeg); 
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
      
      ctx.fillStyle = isHit ? '#fff' : vis.colors.skin;
      ctx.beginPath(); ctx.arc(pHead.x, pHead.y, 8 * scaleW, 0, Math.PI * 2); ctx.fill();
      
      if (!isHit) {
          if (vis.headType === 'HELMET') {
              ctx.fillStyle = vis.colors.primary;
              ctx.beginPath(); ctx.arc(pHead.x, pHead.y - 2, 9 * scaleW, Math.PI, 0); ctx.fill();
              ctx.fillStyle = vis.colors.accent;
              ctx.fillRect(pHead.x - 6 * scaleW, pHead.y - 2, 12 * scaleW, 3);
          } else if (vis.headType === 'HOOD') {
              ctx.fillStyle = vis.colors.primary;
              ctx.beginPath(); ctx.arc(pHead.x, pHead.y, 10 * scaleW, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(pHead.x, pHead.y + 1, 5 * scaleW, 0, Math.PI * 2); ctx.fill();
          } else if (vis.headType === 'SPIKEY_HAIR') {
              ctx.fillStyle = vis.colors.hair;
              ctx.beginPath(); ctx.moveTo(pHead.x - 8, pHead.y); ctx.lineTo(pHead.x, pHead.y - 12); ctx.lineTo(pHead.x + 8, pHead.y); ctx.fill();
          }
      }

      // 5. Arms & Weapons
      const drawArm = (angle: number, isRight: boolean, isSupportArm: boolean = false) => {
          const shoulderX = isRight ? 8 * scaleW : -8 * scaleW;
          const shoulderPos = transformToIso(shoulderX, 0, 36 * scaleH, this._isoShoulder);
          
          let handX, handY;
          if (isTwoHanded && isSupportArm) {
              handX = shoulderX + 15 * scaleW; 
              handY = 10; 
          } else {
              handX = shoulderX + Math.sin(angle) * 24 * scaleW + (isRight ? rHandReach : 0);
              handY = Math.cos(angle) * 24;
          }

          const elbowX = (shoulderX + handX) / 2;
          const elbowY = handY / 2;
          
          const elbowPos = transformToIso(elbowX, elbowY, 24 * scaleH, this._isoElbow);
          const handPos = transformToIso(handX, handY, 20 * scaleH, this._isoHand);

          ctx.strokeStyle = isHit ? '#fff' : vis.colors.primary;
          ctx.lineWidth = 5 * scaleW;
          ctx.beginPath();
          ctx.moveTo(shoulderPos.x, shoulderPos.y);
          ctx.lineTo(elbowPos.x, elbowPos.y);
          ctx.lineTo(handPos.x, handPos.y);
          ctx.stroke();
          
          if (isRight && equippedWeapon && !isHit) {
              this.drawWeapon(ctx, handPos.x, handPos.y, e.angle, equippedWeapon);
          }
      };

      drawArm(lArmAngle, false, isTwoHanded);
      drawArm(rArmAngle, true);

      if (isStunned) {
          ctx.restore();
      }
  }

  private drawWeapon(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, item: Item) {
      ctx.save();
      ctx.translate(x, y);
      
      const forwardScreenX = this._cos - this._sin; 
      const forwardScreenY = (this._cos + this._sin) * 0.5;
      const screenAngle = Math.atan2(forwardScreenY, forwardScreenX);
      
      ctx.rotate(screenAngle);
      
      const color = item.color;
      const shape = item.shape;

      if (shape === 'pistol') {
          ctx.fillStyle = '#18181b'; ctx.fillRect(0, -2, 12, 4); ctx.fillRect(-2, 0, 4, 6); 
          ctx.fillStyle = color; ctx.fillRect(8, -2, 2, 2); 
      } 
      else if (shape === 'rifle' || shape === 'shotgun') {
          ctx.fillStyle = '#18181b'; ctx.fillRect(-5, -2, 30, 4); 
          ctx.fillStyle = '#27272a'; ctx.fillRect(-8, -1, 10, 4); ctx.fillRect(5, 2, 4, 6); 
          ctx.fillStyle = color; ctx.fillRect(0, -1, 25, 1); 
      }
      else if (shape === 'railgun') {
          ctx.fillStyle = '#1e293b'; ctx.fillRect(-5, -3, 40, 6); 
          ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 5; ctx.fillRect(0, -1, 38, 2); ctx.shadowBlur = 0;
      }
      else if (shape === 'sword' || shape === 'psiBlade') {
          ctx.rotate(-Math.PI / 2); 
          ctx.fillStyle = '#52525b'; ctx.fillRect(0, -2, 30, 4); 
          ctx.fillStyle = color; ctx.fillRect(0, -1, 30, 2); 
          ctx.fillStyle = '#18181b'; ctx.fillRect(-5, -4, 5, 8); 
      } 
      else if (shape === 'shield') {
          ctx.fillStyle = color; ctx.beginPath(); ctx.arc(5, 0, 10, 0, Math.PI*2); ctx.fill();
      } 
      else {
          ctx.fillStyle = '#333'; ctx.fillRect(0, -2, 20, 4);
      }
      
      ctx.restore();
  }

  drawNPC(ctx: CanvasRenderingContext2D, e: Entity) {
      this.drawHumanoid(ctx, e);
      if (['MEDIC', 'TRADER', 'HANDLER'].includes(e.subType || '')) {
          IsoUtils.toIso(e.x, e.y, e.height || 80, this._iso);
          ctx.save();
          ctx.translate(this._iso.x, this._iso.y - 20);
          const float = Math.sin(Date.now() * 0.005) * 5;
          ctx.translate(0, float);
          let icon = '?'; let color = '#fff';
          if (e.subType === 'MEDIC') { icon = '+'; color = '#ef4444'; }
          if (e.subType === 'TRADER') { icon = '$'; color = '#eab308'; }
          if (e.subType === 'HANDLER') { icon = '!'; color = '#3b82f6'; }
          ctx.fillStyle = color; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.shadowColor = color; ctx.shadowBlur = 10;
          ctx.fillText(icon, 0, 0);
          ctx.restore();
      }
  }
}
