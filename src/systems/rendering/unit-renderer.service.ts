
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
      } else if (!isHit && vis.accessoryType === 'BACKPACK') {
          const packCenter = transformToIso(0, -8, 30 * scaleH, this._iso);
          ctx.fillStyle = vis.colors.secondary;
          ctx.beginPath();
          // Simple iso rect for backpack
          ctx.rect(packCenter.x - 10 * scaleW, packCenter.y - 12 * scaleH, 20 * scaleW, 24 * scaleH);
          ctx.fill();
          ctx.lineWidth = 1; ctx.strokeStyle = '#000'; ctx.stroke();
      }

      // 2. Legs
      const legLen = 18 * scaleH;
      // Leg transform doesn't twist with body
      const legTransform = (wx: number, wy: number, wz: number, target: {x:number, y:number}) => {
          const rx = wx * this._cos - wy * this._sin; 
          const ry = wx * this._sin + wy * this._cos; 
          IsoUtils.toIso(e.x + rx, e.y + ry, e.z + wz, target);
          return target;
      };

      ctx.lineWidth = 6 * scaleW; ctx.lineCap = 'round'; 
      // Pant color
      ctx.strokeStyle = isHit ? '#fff' : (vis.clothingType === 'RAGS' ? vis.colors.secondary : vis.colors.primary);
      
      const hips = legTransform(0, 0, legLen, this._iso); 
      const lExt = Math.sin(legCycle) * 10;
      
      const pFootL = legTransform(5 * scaleW, lExt, 0, this._isoLeg);
      ctx.beginPath(); ctx.moveTo(hips.x, hips.y); ctx.lineTo(pFootL.x, pFootL.y); ctx.stroke();

      const pFootR = legTransform(-5 * scaleW, -lExt, 0, this._isoLeg);
      ctx.beginPath(); ctx.moveTo(hips.x, hips.y); ctx.lineTo(pFootR.x, pFootR.y); ctx.stroke();

      // Coat Tail (Behind Body, Front of Legs)
      if (!isHit && (vis.clothingType === 'COAT' || vis.clothingType === 'ROBE')) {
          const pCoatL = legTransform(8 * scaleW, lExt * 0.5, 5, this._isoLeg);
          const pCoatR = legTransform(-8 * scaleW, -lExt * 0.5, 5, this._isoBody); // Reuse var
          ctx.fillStyle = vis.colors.primary;
          ctx.beginPath();
          ctx.moveTo(hips.x - 8 * scaleW, hips.y - 5); // Waist left
          ctx.lineTo(hips.x + 8 * scaleW, hips.y - 5); // Waist right
          ctx.lineTo(pCoatR.x, pCoatR.y);
          ctx.lineTo(pCoatL.x, pCoatL.y);
          ctx.fill();
      }

      // 3. Torso
      const torsoH = 20 * scaleH; const shoulderZ = legLen + torsoH;
      const pNeck = transformToIso(0, 0, shoulderZ, this._iso); // Reuse _iso for neck
      
      // Store shoulders for arms
      const pLShoulder = { x: 0, y: 0 }; transformToIso(10 * scaleW, 0, shoulderZ - 2, pLShoulder);
      const pRShoulder = { x: 0, y: 0 }; transformToIso(-10 * scaleW, 0, shoulderZ - 2, pRShoulder);

      if (isHit) {
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 14 * scaleW; 
          ctx.beginPath(); ctx.moveTo(pWaist.x, pWaist.y); ctx.lineTo(pNeck.x, pNeck.y); ctx.stroke(); 
      } else {
          // Clothing Body
          ctx.fillStyle = vis.colors.primary;
          
          if (vis.clothingType === 'VEST' || vis.clothingType === 'RAGS') {
              ctx.fillStyle = vis.colors.skin; // Undershirt/Skin
          }

          // Base Body Shape
          ctx.beginPath();
          // Trapezoid body
          ctx.moveTo(pNeck.x - 5 * scaleW, pNeck.y); 
          ctx.lineTo(pNeck.x + 5 * scaleW, pNeck.y);
          ctx.lineTo(pWaist.x + 4 * scaleW, pWaist.y);
          ctx.lineTo(pWaist.x - 4 * scaleW, pWaist.y);
          ctx.fill();

          // Overlay VEST or ARMOR
          if (vis.clothingType === 'VEST' || vis.clothingType === 'ARMOR') {
              ctx.fillStyle = vis.clothingType === 'VEST' ? vis.colors.secondary : vis.colors.primary;
              ctx.fillRect(pNeck.x - 6 * scaleW, pNeck.y, 12 * scaleW, 15 * scaleH);
          }
      }

      // 4. Head
      const pHead = transformToIso(0, 0, shoulderZ + 8 + headZ, this._iso);
      const headSize = 7 * scaleW;
      
      if (isHit) {
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(pHead.x, pHead.y - 4, headSize, 0, Math.PI*2); ctx.fill();
      } else {
          // Skin
          ctx.fillStyle = vis.colors.skin;
          ctx.beginPath(); ctx.arc(pHead.x, pHead.y - 4, headSize, 0, Math.PI*2); ctx.fill();

          // Hair / Hat
          if (vis.headType === 'HELMET') {
              ctx.fillStyle = vis.colors.primary;
              ctx.beginPath(); ctx.arc(pHead.x, pHead.y - 6, headSize + 1, 0, Math.PI*2); ctx.fill();
              // Visor line
              ctx.strokeStyle = vis.colors.accent; ctx.lineWidth = 2;
              ctx.beginPath(); ctx.moveTo(pHead.x - 4, pHead.y - 4); ctx.lineTo(pHead.x + 4, pHead.y - 4); ctx.stroke();
          } else if (vis.headType === 'HOOD') {
              ctx.fillStyle = vis.colors.primary;
              ctx.beginPath(); ctx.arc(pHead.x, pHead.y - 6, headSize + 2, Math.PI, Math.PI*2); ctx.fill();
              // Hood sides
              ctx.beginPath(); ctx.moveTo(pHead.x - 8, pHead.y - 6); ctx.lineTo(pHead.x - 6, pHead.y + 2); ctx.stroke();
          } else if (vis.headType === 'CAP') {
              ctx.fillStyle = vis.colors.primary;
              ctx.beginPath(); ctx.arc(pHead.x, pHead.y - 8, headSize, Math.PI, 0); ctx.fill();
              ctx.fillRect(pHead.x - headSize, pHead.y - 8, headSize * 2, 4);
          } else if (vis.headType === 'SPIKEY_HAIR') {
              ctx.fillStyle = vis.colors.hair;
              ctx.beginPath(); ctx.moveTo(pHead.x - 5, pHead.y - 8); ctx.lineTo(pHead.x, pHead.y - 15); ctx.lineTo(pHead.x + 5, pHead.y - 8); ctx.fill();
          }

          // Face Accessories
          if (vis.faceType === 'VISOR' || vis.faceType === 'GOGGLES') {
              ctx.fillStyle = vis.colors.accent;
              ctx.fillRect(pHead.x - 6, pHead.y - 6, 12, 4);
          } else if (vis.faceType === 'MASK') {
              ctx.fillStyle = '#333';
              ctx.beginPath(); ctx.arc(pHead.x, pHead.y - 2, 5, 0, Math.PI); ctx.fill();
          }
      }
      
      // 5. Arms
      ctx.lineWidth = 5 * scaleW; 
      // Arm color (Skin or Cloth)
      ctx.strokeStyle = isHit ? '#fff' : (vis.clothingType === 'VEST' || vis.clothingType === 'RAGS' ? vis.colors.skin : vis.colors.primary);
      
      // Left Arm
      const pHandL = transformToIso(10 * scaleW + Math.cos(lArmAngle)*10, 10 + Math.sin(lArmAngle)*10, shoulderZ - 12, this._iso);
      ctx.beginPath(); ctx.moveTo(pLShoulder.x, pLShoulder.y); ctx.lineTo(pHandL.x, pHandL.y); ctx.stroke();
      
      // Right Arm
      const reach = 12 + rHandReach;
      const pHandR = transformToIso(-8 * scaleW + Math.sin(rArmAngle)*10, 5 + Math.cos(rArmAngle)*reach, shoulderZ - 10, this._iso);
      ctx.beginPath(); ctx.moveTo(pRShoulder.x, pRShoulder.y); ctx.lineTo(pHandR.x, pHandR.y); ctx.stroke();

      if (!isNPC) { 
          // Use Entity's weaponTrail storage
          if (!e.weaponTrail) e.weaponTrail = [];
          // Pass e to access comboIndex for unarmed drawing
          this.drawWeapon(ctx, pHandR, rArmAngle, equippedWeapon, e.angle + bodyTwist, isHit, e.weaponTrail, isPlayer, e); 
      }
      
      if (isStunned) {
          ctx.restore();
      }

      this.drawStatusIndicators(ctx, e, pHead.x, pHead.y - 25);
      
      if (e.type === 'ENEMY' && e.hp < e.maxHp) {
          IsoUtils.toIso(e.x, e.y, e.z + 60, this._iso);
          ctx.fillStyle = '#000'; ctx.fillRect(this._iso.x - 15, this._iso.y, 30, 4);
          ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#22c55e' : '#ef4444'; ctx.fillRect(this._iso.x - 14, this._iso.y + 1, 28 * (e.hp/e.maxHp), 2);
          if (e.armor > 0) { ctx.fillStyle = '#f59e0b'; ctx.fillRect(this._iso.x - 15, this._iso.y - 3, 30, 2); }
      }
  }

  drawNPC(ctx: CanvasRenderingContext2D, e: Entity) {
      this.drawHumanoid(ctx, e);
      
      if (e.subType === 'CITIZEN') return;
      
      IsoUtils.toIso(e.x, e.y, 70, this._iso);
      ctx.save(); ctx.translate(this._iso.x, this._iso.y);
      let icon = '?'; if (e.subType === 'MEDIC') icon = '✚'; if (e.subType === 'TRADER') icon = '$'; if (e.subType === 'HANDLER') icon = '!';
      
      const bounce = Math.sin(Date.now() * 0.008) * 8; 
      ctx.translate(0, bounce - 25);
      
      ctx.fillStyle = e.color; 
      ctx.font = 'bold 24px monospace'; 
      ctx.textAlign = 'center'; 
      ctx.shadowColor = e.color; 
      ctx.shadowBlur = 15;
      ctx.fillText(icon, 0, 0); 
      ctx.shadowBlur = 0; 
      ctx.restore();
  }

  private drawWeapon(ctx: CanvasRenderingContext2D, handPos: {x: number, y: number}, armAngle: number, item: Item | null, facingAngle: number, isHit: boolean, trail: any[], isPlayer: boolean, entity: Entity) {
      // UNARMED LOGIC
      if (!item) {
          const combo = entity.comboIndex || 0;
          
          // Only draw glowing fist for players
          if (isPlayer) {
              const glowIntensity = 10 + (combo * 15);
              const glowColor = combo > 0 ? '#fbbf24' : '#f59e0b';
              
              ctx.save();
              ctx.translate(handPos.x, handPos.y);
              
              // Fist Aura
              ctx.shadowBlur = glowIntensity;
              ctx.shadowColor = glowColor;
              ctx.fillStyle = combo > 0 ? '#fcd34d' : '#27272a';
              
              ctx.beginPath();
              ctx.arc(0, 0, 6, 0, Math.PI * 2);
              ctx.fill();
              
              // Impact Sparks if attacking
              if (entity.state === 'ATTACK' && entity.animPhase === 'active') {
                  const sparkCount = 3 + combo;
                  for(let i=0; i<sparkCount; i++) {
                      const sa = facingAngle + (Math.random() - 0.5);
                      const sd = Math.random() * 20;
                      ctx.fillStyle = '#fff';
                      ctx.fillRect(Math.cos(sa)*sd, Math.sin(sa)*sd, 2, 2);
                  }
                  
                  // Procedural Kinetic Swipe (Unarmed)
                  ctx.rotate(facingAngle);
                  ctx.globalAlpha = 0.6;
                  ctx.strokeStyle = glowColor;
                  ctx.lineWidth = 4 + combo;
                  ctx.beginPath();
                  ctx.arc(0, 0, 30 + (combo * 5), -Math.PI/3, Math.PI/3);
                  ctx.stroke();
              }
              
              ctx.restore();
          } else {
              // Basic fist for NPCs
              ctx.beginPath(); ctx.arc(handPos.x, handPos.y, 4, 0, Math.PI*2); ctx.fill();
          }
          return;
      }

      ctx.save(); 
      ctx.translate(handPos.x, handPos.y);
      const isoRotation = Math.atan2(Math.sin(facingAngle), Math.cos(facingAngle));
      const rotateAngle = isoRotation + armAngle;
      ctx.rotate(rotateAngle);

      // --- WEAPON TRAIL LOGIC ---
      if (item && armAngle > -Math.PI / 1.4 && armAngle < Math.PI / 2) {
          // Calculate weapon tip position in screen space
          const tipLen = 45;
          const tipX = handPos.x + Math.cos(rotateAngle) * tipLen;
          const tipY = handPos.y + Math.sin(rotateAngle) * tipLen;
          
          trail.push({ x: tipX, y: tipY, angle: rotateAngle, alpha: 0.8 });
      } else {
          // Clear trail if idle
          if (trail.length > 0) trail.length = 0; // Clear without GC
      }

      // Decay trails
      if (trail.length > 0) {
          // Restore context to draw trails in world space
          ctx.restore();
          ctx.save(); // New save for trails
          
          const trailColor = item?.color || '#fff';
          for (let i = trail.length - 1; i >= 0; i--) {
              const t = trail[i];
              t.alpha *= 0.8;
              if (t.alpha < 0.1) {
                  trail.splice(i, 1);
                  continue;
              }
              
              ctx.globalAlpha = t.alpha;
              ctx.strokeStyle = trailColor;
              ctx.lineWidth = 2;
              ctx.beginPath();
              // Draw line from hand (approx) to tip history
              // Note: Hand moved, so this is an approximation connecting previous points
              // Ideally connect point i to point i-1
              if (i > 0) {
                  const prev = trail[i-1];
                  ctx.moveTo(prev.x, prev.y);
                  ctx.lineTo(t.x, t.y);
                  ctx.stroke();
              }
          }
          ctx.restore();
          
          // Re-apply weapon transform
          ctx.save();
          ctx.translate(handPos.x, handPos.y);
          ctx.rotate(rotateAngle);
      }

      // --- DYNAMIC PSI GLOW ---
      if (item && item.shape === 'psiBlade') { 
          ctx.globalCompositeOperation = 'screen'; 
          
          if (isPlayer) {
              const psiEnergy = this.playerStats.psionicEnergy();
              const maxPsi = this.playerStats.maxPsionicEnergy();
              const ratio = psiEnergy / maxPsi;
              
              ctx.shadowBlur = 5 + (ratio * 20); 
              ctx.shadowColor = `hsl(180, 100%, ${50 + ratio * 50}%)`; // Brighter when full
          } else {
              ctx.shadowBlur = 10; 
              ctx.shadowColor = item.color;
          }
      }

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
