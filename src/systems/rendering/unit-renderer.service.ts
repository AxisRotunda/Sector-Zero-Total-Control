
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

      // Determine Equipment
      let equippedWeapon: Item | null = null; 
      if (isPlayer) { 
          const eq = this.inventory.equipped(); 
          equippedWeapon = eq.weapon; 
      } else if (isGuard) {
          // Guards visually use Rifles now
          equippedWeapon = { type: 'WEAPON', shape: 'rifle', color: '#1e3a8a', name: 'Rifle', id: '', level: 1, rarity: 'COMMON', stack: 1, maxStack: 1, stats: {} };
      } else if (e.subType === 'SNIPER') {
          equippedWeapon = { type: 'WEAPON', shape: 'railgun', color: '#a855f7', name: 'Railgun', id: '', level: 1, rarity: 'RARE', stack: 1, maxStack: 1, stats: {} };
      } else if (e.equipment) {
          equippedWeapon = e.equipment.weapon || null;
      }

      // Identify Weapon Style
      const isRanged = equippedWeapon && ['pistol', 'rifle', 'shotgun', 'railgun'].includes(equippedWeapon.shape);
      const isTwoHanded = equippedWeapon && ['rifle', 'shotgun', 'railgun'].includes(equippedWeapon.shape);

      // Animation State
      let rArmAngle = 0; let lArmAngle = 0; let legCycle = 0; let bodyTwist = 0; let bodyZ = 0; let headZ = 0; let rHandReach = 0;
      
      // --- ATTACK ANIMATION LOGIC ---
      if (e.state === 'ATTACK') {
          if (isRanged) {
              // Ranged Recoil Animation
              const p = 1 - ((e.timer || 0) / (isPlayer ? 10 : 30)); // 0 to 1 progress
              const recoil = Math.sin(p * Math.PI) * 0.3; // Kick back
              
              // Aim at target angle (relative to body 0)
              // Since we rotate the whole context by e.angle later, arms just point forward (0) or slightly offset
              rArmAngle = 0 - recoil; // Arm kicks up/back
              lArmAngle = isTwoHanded ? (Math.PI / 6) : 0; // Support arm
              
              bodyTwist = isTwoHanded ? 0.8 : 0.4; // Twist torso to align shoulder
              bodyZ = -1 * recoil; // Crouch slightly on shot
          } else {
              // Melee Swing Logic (Existing)
              const phase = e.animPhase; const frame = e.animFrame;
              if (isPlayer) {
                  // Existing Player Melee
                  if (phase === 'startup') { const p = frame / 1; rArmAngle = p * (-Math.PI / 1.4); bodyTwist = p * -0.3; bodyZ = p * -2; } 
                  else if (phase === 'active') { const p = (frame - 2) / 2; rArmAngle = (-Math.PI / 1.4) + p * (Math.PI / 1.4 + Math.PI / 3); bodyTwist = -0.3 + p * 0.7; rHandReach = p * 15; bodyZ = -2 + p * 2; } 
                  else if (phase === 'recovery') { const p = (frame - 5) / 3; rArmAngle = (Math.PI / 3) - p * (Math.PI / 3 - Math.PI / 8); bodyTwist = 0.4 - p * 0.3; rHandReach = 15 - p * 10; bodyZ = 0; }
              } else {
                  // Enemy Melee
                  const p = 1 - ((e.timer || 0) / 10);
                  if (p < 0.25) { rArmAngle = -Math.PI / 1.4; bodyTwist = -0.3; bodyZ = -2; } else if (p < 0.6) { rArmAngle = Math.PI / 3; bodyTwist = 0.4; rHandReach = 15; bodyZ = 0; } else { rArmAngle = Math.PI / 8; bodyTwist = 0.1; rHandReach = 5; bodyZ = 0; }
              }
          }
      } 
      // --- MOVE ANIMATION ---
      else if (['MOVE', 'CHARGE', 'RETREAT', 'PATROL'].includes(e.state)) {
          const cycle = Math.sin((e.animFrame + (e.animFrameTimer / 6)) / 6 * Math.PI * 2);
          legCycle = cycle * Math.PI / 6; 
          bodyZ = Math.abs(cycle) * 2; 
          
          if (isRanged && isPlayer) {
              // Run & Gun Pose: Keep gun roughly level
              rArmAngle = Math.PI / 12 + cycle * 0.1;
              lArmAngle = isTwoHanded ? (Math.PI / 6 + cycle * 0.1) : (-legCycle * 0.8);
              bodyTwist = isTwoHanded ? 0.5 : 0.2;
          } else {
              lArmAngle = -legCycle * 0.8; 
              rArmAngle = legCycle * 0.8;
          }
      } 
      // --- IDLE ANIMATION ---
      else if (e.state === 'IDLE') {
          const breathe = Math.sin((e.animFrame + (e.animFrameTimer / 12)) / 4 * Math.PI * 2);
          bodyZ = breathe; headZ = breathe * 0.5; 
          
          if (isRanged && isPlayer) {
              // Ready Pose
              rArmAngle = Math.PI / 6 + breathe * 0.02;
              lArmAngle = isTwoHanded ? (Math.PI / 4) : (breathe * -0.05);
              bodyTwist = isTwoHanded ? 0.3 : 0;
          } else {
              rArmAngle = breathe * 0.05; lArmAngle = breathe * -0.05;
              if (isNPC && !isCitizen) { rArmAngle = Math.PI / 4; lArmAngle = -Math.PI / 4; }
          }
      }

      // Glitch Effect Setup
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
          const shoulderPos = transformToIso(shoulderX, 0, 36 * scaleH, this._iso);
          
          let handX, handY;
          
          if (isTwoHanded && isSupportArm) {
              // Support arm holds the rifle barrel (approximate location)
              handX = shoulderX + 15 * scaleW; // Forward
              handY = 10; 
          } else {
              handX = shoulderX + Math.sin(angle) * 24 * scaleW + (isRight ? rHandReach : 0);
              handY = Math.cos(angle) * 24;
          }

          const elbowX = (shoulderX + handX) / 2;
          const elbowY = handY / 2; // Simple midpoint
          const elbowPos = transformToIso(elbowX, elbowY, 24 * scaleH, this._isoLeg);
          const handPos = transformToIso(handX, handY, 20 * scaleH, this._iso);

          ctx.strokeStyle = isHit ? '#fff' : vis.colors.primary;
          ctx.lineWidth = 5 * scaleW;
          ctx.beginPath();
          ctx.moveTo(shoulderPos.x, shoulderPos.y);
          ctx.lineTo(elbowPos.x, elbowPos.y);
          ctx.lineTo(handPos.x, handPos.y);
          ctx.stroke();
          
          // Draw Weapon (Right Hand Only usually)
          if (isRight && equippedWeapon && !isHit) {
              this.drawWeapon(ctx, handPos.x, handPos.y, e.angle, equippedWeapon);
          }
      };

      // Draw Left Arm First (Behind body relative to right hand usually)
      drawArm(lArmAngle, false, isTwoHanded);
      drawArm(rArmAngle, true);

      if (isStunned) {
          ctx.restore();
      }
  }

  private drawWeapon(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, item: Item) {
      ctx.save();
      ctx.translate(x, y);
      
      // Apply Rotation. 
      // Note: `angle` is the Entity's World Angle.
      // Since `drawHumanoid` calculates arm positions in Entity Space and then projects them,
      // the `handPos` passed here is already screen-relative to the body.
      // BUT, we need to rotate the weapon graphic itself to match the player's facing direction on screen.
      // In ISO, 0 radians is Down-Right. 
      
      // Simple approach: The hand position already tracks the body rotation logic via transformToIso.
      // We just need to align the sprite to the aim direction.
      
      // For aiming poses, the arm is raised. The weapon should align with the arm vector ideally.
      // For simplicity in this 2.5D style, we just rotate it by the entity's facing angle + 45deg offset for iso.
      
      // Actually, since we are already in Screen Space (after `transformToIso`), we need to apply the visual rotation.
      // The `e.angle` is used in `transformToIso` to project 3D points. 
      // Here we just want the gun to point "Forward" relative to the hand.
      
      // Since we drew the arm extending to `handPos`, and the weapon is AT `handPos`,
      // we need to rotate the canvas to match the "Shoot Direction" in Screen Space.
      
      // Calculate screen-space angle for "Forward"
      const forwardScreenX = this._cos - this._sin; // Iso projection of (1, 0) basically
      const forwardScreenY = (this._cos + this._sin) * 0.5;
      const screenAngle = Math.atan2(forwardScreenY, forwardScreenX);
      
      ctx.rotate(screenAngle);
      
      const color = item.color;
      const shape = item.shape;

      if (shape === 'pistol') {
          ctx.fillStyle = '#18181b';
          ctx.fillRect(0, -2, 12, 4); // Barrel
          ctx.fillRect(-2, 0, 4, 6); // Grip
          ctx.fillStyle = color;
          ctx.fillRect(8, -2, 2, 2); // Tip
      } 
      else if (shape === 'rifle' || shape === 'shotgun') {
          ctx.fillStyle = '#18181b';
          ctx.fillRect(-5, -2, 30, 4); // Long Barrel
          ctx.fillStyle = '#27272a';
          ctx.fillRect(-8, -1, 10, 4); // Stock
          ctx.fillRect(5, 2, 4, 6); // Mag/Grip
          ctx.fillStyle = color;
          ctx.fillRect(0, -1, 25, 1); // Highlight
      }
      else if (shape === 'railgun') {
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-5, -3, 40, 6); // Heavy Barrel
          ctx.fillStyle = color; // Glow
          ctx.shadowColor = color;
          ctx.shadowBlur = 5;
          ctx.fillRect(0, -1, 38, 2); // Rail
          ctx.shadowBlur = 0;
      }
      else if (shape === 'sword' || shape === 'psiBlade') {
          ctx.rotate(-Math.PI / 2); // Sword points up/out
          ctx.fillStyle = '#52525b';
          ctx.fillRect(0, -2, 30, 4); 
          ctx.fillStyle = color;
          ctx.fillRect(0, -1, 30, 2); 
          ctx.fillStyle = '#18181b';
          ctx.fillRect(-5, -4, 5, 8); 
      } 
      else if (shape === 'shield') {
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(5, 0, 10, 0, Math.PI*2); ctx.fill();
      } 
      else {
          // Generic
          ctx.fillStyle = '#333';
          ctx.fillRect(0, -2, 20, 4);
      }
      
      ctx.restore();
  }

  drawNPC(ctx: CanvasRenderingContext2D, e: Entity) {
      this.drawHumanoid(ctx, e);
      // ... existing NPC icon logic ...
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
