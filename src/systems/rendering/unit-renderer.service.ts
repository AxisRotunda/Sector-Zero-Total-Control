
import { Injectable, inject } from '@angular/core';
import { Entity, VisualProfile } from '../../models/game.models';
import { Item } from '../../models/item.models';
import { InventoryService } from '../../game/inventory.service';
import { IsoUtils } from '../../utils/iso-utils';
import { InteractionService } from '../../services/interaction.service';
import { PlayerStatsService } from '../../game/player/player-stats.service';
import { PlayerAbilitiesService } from '../../game/player/player-abilities.service';
import { WorldService } from '../../game/world/world.service';
import { PerformanceManagerService } from '../../game/performance-manager.service';

interface StatusIcon { type: 'poison' | 'burn' | 'stun' | 'weakness' | 'slow' | 'bleed'; timer: number; maxTimer: number; icon: string; color: string; }

@Injectable({ providedIn: 'root' })
export class UnitRendererService {
  private inventory = inject(InventoryService);
  private interaction = inject(InteractionService);
  private playerStats = inject(PlayerStatsService);
  private abilities = inject(PlayerAbilitiesService);
  private world = inject(WorldService);
  private perf = inject(PerformanceManagerService);
  
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

  // Refactored helper to avoid closure allocation
  private transformToIso(wx: number, wy: number, wz: number, target: {x:number, y:number}, 
                         ex: number, ey: number, ez: number, bodyTwist: number, bodyZ: number) {
     const cosT = Math.cos(bodyTwist); const sinT = Math.sin(bodyTwist);
     const tx = wx * cosT - wy * sinT; 
     const ty = wx * sinT + wy * cosT;
     
     const rx = tx * this._cos - ty * this._sin; 
     const ry = tx * this._sin + ty * this._cos;
     
     IsoUtils.toIso(ex + rx, ey + ry, ez + wz + bodyZ, target);
     return target;
  }

  drawHumanoid(ctx: CanvasRenderingContext2D, e: Entity) {
      if (e.state === 'DEAD') return;

      // LOD Check
      const player = this.world.player;
      const distToPlayer = Math.hypot(e.x - player.x, e.y - player.y);
      const isPlayer = e.type === 'PLAYER'; 
      
      // Dynamic LOD thresholds based on performance tier
      const tier = this.perf.currentTier().name;
      let lodFar = 800;
      let lodMed = 400;

      if (tier === 'LOW') {
          lodFar = 550; // Aggressive culling for mobile
          lodMed = 300;
      } else if (tier === 'HIGH') {
          lodFar = 1000;
          lodMed = 600;
      }
      
      // LOD 0: FAR (> limit) - Simple circle
      if (!isPlayer && distToPlayer > lodFar) {
          IsoUtils.toIso(e.x, e.y, e.z, this._iso);
          ctx.save();
          ctx.translate(this._iso.x, this._iso.y);
          ctx.fillStyle = e.visuals?.colors.primary || e.color;
          ctx.beginPath();
          ctx.arc(0, -20, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          return;
      }

      // LOD 1: MEDIUM (Simplified Geometry)
      const useSimpleGeo = !isPlayer && distToPlayer > lodMed;

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
              // MELEE LOGIC: Visual Swing Types
              const comboStep = isPlayer ? this.abilities.activeComboStep() : null;
              
              if (isPlayer && comboStep) {
                  const start = comboStep.hitboxStart;
                  const total = comboStep.durationTotal;
                  const progress = Math.min(1, Math.max(0, e.animFrameTimer / total));

                  switch (comboStep.swingType) {
                      case 'SLASH_RIGHT': 
                          rArmAngle = -Math.PI/2 + (progress * Math.PI);
                          lArmAngle = -Math.PI/6;
                          bodyTwist = -0.5 + progress;
                          break;
                      case 'SLASH_LEFT': 
                          rArmAngle = Math.PI/2 - (progress * Math.PI);
                          lArmAngle = Math.PI/6;
                          bodyTwist = 0.5 - progress;
                          break;
                      case 'OVERHEAD': 
                          rArmAngle = -Math.PI + (progress * Math.PI * 1.5);
                          lArmAngle = -Math.PI + (progress * Math.PI * 1.5) - 0.2;
                          bodyTwist = 0.1;
                          break;
                      case 'THRUST': 
                          const stab = Math.sin(progress * Math.PI);
                          rArmAngle = -Math.PI/2 + (stab * 0.2);
                          rHandReach = stab * 35;
                          bodyTwist = 0.5;
                          break;
                      case 'SPIN': 
                          const spin = progress * Math.PI * 2;
                          rArmAngle = spin;
                          lArmAngle = spin + Math.PI;
                          bodyTwist = spin;
                          break;
                  }
              } else {
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

      // 1. Back Accessories (LOD Checked)
      this.transformToIso(0, 0, 18, this._isoBody, e.x, e.y, e.z || 0, bodyTwist, bodyZ);
      const pWaist = this._isoBody;

      if (!isHit && !useSimpleGeo && vis.accessoryType === 'CAPE') {
          this.transformToIso(0, 0, 38 * scaleH, this._iso, e.x, e.y, e.z || 0, bodyTwist, bodyZ);
          const pShoulders = this._iso;
          this.transformToIso(-20 * Math.sin(legCycle), 0, 5, this._isoLeg, e.x, e.y, e.z || 0, bodyTwist, bodyZ); 
          const capeEnd = this._isoLeg;
          ctx.fillStyle = vis.colors.primary;
          ctx.beginPath();
          ctx.moveTo(pShoulders.x - 10 * scaleW, pShoulders.y);
          ctx.lineTo(pShoulders.x + 10 * scaleW, pShoulders.y);
          ctx.lineTo(capeEnd.x + 15 * scaleW, capeEnd.y);
          ctx.lineTo(capeEnd.x - 15 * scaleW, capeEnd.y); 
          ctx.fill();
      }

      // 2. Legs
      const legColor = isHit ? '#fff' : vis.colors.secondary;
      this.drawLeg(ctx, e, pWaist, legCycle, scaleW, legColor, bodyTwist, bodyZ); // Right
      this.drawLeg(ctx, e, pWaist, -legCycle + Math.PI, scaleW, legColor, bodyTwist, bodyZ); // Left

      // 3. Torso
      this.transformToIso(0, 0, 38 * scaleH, this._iso, e.x, e.y, e.z || 0, bodyTwist, bodyZ);
      const pShoulders = this._iso;
      ctx.strokeStyle = isHit ? '#fff' : vis.colors.primary;
      ctx.lineWidth = 14 * scaleW;
      ctx.beginPath();
      ctx.moveTo(pWaist.x, pWaist.y);
      ctx.lineTo(pShoulders.x, pShoulders.y);
      ctx.stroke();
      
      if (!useSimpleGeo && (vis.clothingType === 'ARMOR' || vis.clothingType === 'VEST')) {
          ctx.strokeStyle = vis.colors.secondary;
          ctx.lineWidth = 10 * scaleW;
          ctx.beginPath();
          ctx.moveTo(pWaist.x, pWaist.y - 5);
          ctx.lineTo(pShoulders.x, pShoulders.y + 5);
          ctx.stroke();
      }

      // 4. Head
      this.transformToIso(0, 0, 48 * scaleH + headZ, this._iso, e.x, e.y, e.z || 0, bodyTwist, bodyZ);
      const pHead = this._iso;
      
      ctx.fillStyle = isHit ? '#fff' : vis.colors.skin;
      ctx.beginPath(); ctx.arc(pHead.x, pHead.y, 8 * scaleW, 0, Math.PI * 2); ctx.fill();
      
      if (!isHit && !useSimpleGeo) {
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
      this.drawArm(ctx, e, lArmAngle, false, isTwoHanded, scaleW, scaleH, bodyTwist, bodyZ, rHandReach, isHit, vis, equippedWeapon);
      this.drawArm(ctx, e, rArmAngle, true, isTwoHanded, scaleW, scaleH, bodyTwist, bodyZ, rHandReach, isHit, vis, equippedWeapon);

      if (isStunned) {
          ctx.restore();
      }
  }

  private drawLeg(ctx: CanvasRenderingContext2D, e: Entity, pWaist: {x:number, y:number}, angle: number, scaleW: number, color: string, bodyTwist: number, bodyZ: number) {
      this.transformToIso(Math.sin(angle) * 10 * scaleW, Math.cos(angle) * 5, 8, this._isoLeg, e.x, e.y, e.z || 0, bodyTwist, bodyZ);
      const knee = this._isoLeg;
      
      this.transformToIso(Math.sin(angle) * 20 * scaleW, Math.cos(angle) * 15, 0, this._iso, e.x, e.y, e.z || 0, bodyTwist, bodyZ);
      const foot = this._iso;
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 6 * scaleW;
      ctx.beginPath();
      ctx.moveTo(pWaist.x, pWaist.y);
      ctx.lineTo(knee.x, knee.y);
      ctx.lineTo(foot.x, foot.y);
      ctx.stroke();
  }

  private drawArm(ctx: CanvasRenderingContext2D, e: Entity, angle: number, isRight: boolean, isTwoHanded: boolean | null, 
                  scaleW: number, scaleH: number, bodyTwist: number, bodyZ: number, 
                  rHandReach: number, isHit: boolean, vis: VisualProfile, equippedWeapon: Item | null) {
      
      const shoulderX = isRight ? 8 * scaleW : -8 * scaleW;
      // Using temp object _isoShoulder for first point, need to clone/copy if we use it later in path
      this.transformToIso(shoulderX, 0, 36 * scaleH, this._isoShoulder, e.x, e.y, e.z || 0, bodyTwist, bodyZ);
      // We must copy values because transformToIso reuses the object if we call it again for elbow/hand
      const sX = this._isoShoulder.x;
      const sY = this._isoShoulder.y;
      
      let handX, handY;
      // isSupportArm logic: left arm is support if two handed
      const isSupportArm = !isRight && isTwoHanded;

      if (isSupportArm) {
          handX = shoulderX + 15 * scaleW; 
          handY = 10; 
      } else {
          handX = shoulderX + Math.sin(angle) * 24 * scaleW + (isRight ? rHandReach : 0);
          handY = Math.cos(angle) * 24;
      }

      const elbowX = (shoulderX + handX) / 2;
      const elbowY = handY / 2;
      
      this.transformToIso(elbowX, elbowY, 24 * scaleH, this._isoElbow, e.x, e.y, e.z || 0, bodyTwist, bodyZ);
      const eX = this._isoElbow.x;
      const eY = this._isoElbow.y;

      this.transformToIso(handX, handY, 20 * scaleH, this._isoHand, e.x, e.y, e.z || 0, bodyTwist, bodyZ);
      const hX = this._isoHand.x;
      const hY = this._isoHand.y;

      ctx.strokeStyle = isHit ? '#fff' : vis.colors.primary;
      ctx.lineWidth = 5 * scaleW;
      ctx.beginPath();
      ctx.moveTo(sX, sY);
      ctx.lineTo(eX, eY);
      ctx.lineTo(hX, hY);
      ctx.stroke();
      
      if (isRight && equippedWeapon && !isHit) {
          this.drawWeapon(ctx, hX, hY, e.angle, equippedWeapon);
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
