
import { Injectable, signal, inject } from '@angular/core';
import * as BALANCE from '../../config/balance.config';
import { PlayerStatsService } from './player-stats.service';
import { SoundService } from '../../services/sound.service';
import { WorldService } from '../world/world.service';
import { EntityPoolService } from '../../services/entity-pool.service';
import { ParticleService } from '../../systems/particle.service';
import { InventoryService } from '../inventory.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { GameEvents } from '../../core/events/game-events';
import { HapticService } from '../../services/haptic.service';
import { Entity } from '../../models/game.models';
import { UNARMED_WEAPON, Item } from '../../models/item.models';
import { PlayerProgressionService } from './player-progression.service';
import { CollisionService } from '../../systems/collision.service';
import { createEmptyDamagePacket } from '../../models/damage.model';
import { CommandType } from '../../config/combo.config';

@Injectable({ providedIn: 'root' })
export class PlayerAbilitiesService {
  private stats = inject(PlayerStatsService);
  private sound = inject(SoundService);
  private world = inject(WorldService);
  private entityPool = inject(EntityPoolService);
  private particleService = inject(ParticleService);
  private inventory = inject(InventoryService);
  private eventBus = inject(EventBusService);
  private haptic = inject(HapticService);
  private progression = inject(PlayerProgressionService);
  private collisionService = inject(CollisionService);

  cooldowns = signal({ primary: 0, secondary: 0, dash: 0, utility: 0 });
  maxCooldowns = signal({ primary: BALANCE.COOLDOWNS.PRIMARY, secondary: BALANCE.COOLDOWNS.SECONDARY, dash: BALANCE.COOLDOWNS.DASH, utility: BALANCE.COOLDOWNS.UTILITY });

  // Combo State
  currentCombo = signal(0);
  private readonly MAX_COMBO = 3;

  updateCooldowns() {
    const c = this.cooldowns();
    // Optimization: Skip update if all cooldowns are 0
    if (c.primary <= 0 && c.secondary <= 0 && c.dash <= 0 && c.utility <= 0) {
        return;
    }

    this.cooldowns.update(curr => ({
        primary: Math.max(0, curr.primary - 1), 
        secondary: Math.max(0, curr.secondary - 1), 
        dash: Math.max(0, curr.dash - 1), 
        utility: Math.max(0, curr.utility - 1)
    }));
  }

  useSkill(skill: CommandType, targetAngle?: number) {
    const player = this.world.player;
    if (player.hp <= 0 || player.status.stun > 0) return;
    const stats = this.stats.playerStats();
    const cds = this.cooldowns();

    if (skill === 'PRIMARY') {
        const equippedWeapon = this.inventory.equipped().weapon;
        const isRanged = equippedWeapon && equippedWeapon.projectile;

        if (isRanged) {
            this.performRangedAttack(player, equippedWeapon!, targetAngle);
        } else {
            this.performMeleeAttack(player, stats, equippedWeapon, targetAngle);
        }
    }
    else if (skill === 'SECONDARY') {
        this.useSecondary(player, stats, cds);
    }
    else if (skill === 'DASH') {
        this.useDash(player, cds, targetAngle);
    }
    else if (skill === 'UTILITY') {
        this.useUtility(player, stats, cds, targetAngle);
    }
    else if (skill === 'SHIELD_BASH') {
        this.useShieldBash(player, stats, cds, targetAngle);
    }
    else if (skill === 'OVERLOAD') {
        this.useOverload(player, stats);
    }
    else if (skill === 'WHIRLWIND') {
        this.useWhirlwind(player, stats);
    }
    else if (skill === 'DASH_STRIKE') {
        this.useDashStrike(player, stats, targetAngle);
    }
  }

  // --- COMBO IMPLEMENTATIONS ---
  
  private useWhirlwind(player: Entity, stats: any) {
      player.state = 'ATTACK';
      // Provide extended active frames for animation sync
      player.animFrameTimer = 0;
      player.animFrame = 0;
      
      this.sound.play('SWOOSH');
      this.haptic.impactHeavy();
      
      // Create a persistent hitbox that pulses
      const hitbox = this.entityPool.acquire('HITBOX', undefined, this.world.currentZone().id);
      hitbox.source = 'PLAYER';
      hitbox.x = player.x; 
      hitbox.y = player.y; 
      hitbox.radius = 140; // Larger AOE
      
      hitbox.damagePacket = createEmptyDamagePacket();
      hitbox.damagePacket.physical = stats.damage * 1.5;
      hitbox.damagePacket.chaos = stats.psyche * 2;
      
      hitbox.color = '#f97316';
      hitbox.timer = 20; // Lasts 20 frames
      hitbox.knockbackForce = 25;
      hitbox.critChance = stats.crit + 20; // Bonus crit
      
      // Spin physics
      player.angle += 3.14; // Instant spin visual
      
      // Attach hit IDs so it only hits once per spawn, 
      // but in a real whirlwind you might want multi-hit. 
      // Current system limits single hitbox to single hit per entity.
      hitbox.hitIds = new Set();

      this.world.entities.push(hitbox);
      this.collisionService.checkHitboxCollisions(hitbox); // Immediate check
      
      this.particleService.addParticles({ x: player.x, y: player.y, z: 20, count: 30, speed: 12, color: '#f97316', size: 3, type: 'circle', life: 0.6 });
      this.eventBus.dispatch({ type: GameEvents.FLOATING_TEXT_SPAWN, payload: { onPlayer: true, yOffset: -90, text: "WHIRLWIND", color: '#f97316', size: 26 } });
  }

  private useDashStrike(player: Entity, stats: any, targetAngle?: number) {
      const angle = targetAngle ?? player.angle;
      player.angle = angle;
      
      // Huge velocity boost
      player.vx += Math.cos(angle) * 45;
      player.vy += Math.sin(angle) * 45;
      player.state = 'ATTACK';
      
      this.sound.play('DASH');
      this.haptic.impactMedium();
      
      const hitbox = this.entityPool.acquire('HITBOX', undefined, this.world.currentZone().id);
      hitbox.source = 'PLAYER';
      hitbox.x = player.x; 
      hitbox.y = player.y; 
      hitbox.radius = 80;
      
      hitbox.damagePacket = createEmptyDamagePacket();
      hitbox.damagePacket.physical = stats.damage * 2.5; // High single target dmg
      
      hitbox.critChance = 100; // Guaranteed Crit
      hitbox.color = '#ffffff';
      hitbox.timer = 15; // Matches dash duration roughly
      
      // Attach to player velocity for the duration
      hitbox.vx = player.vx;
      hitbox.vy = player.vy;
      
      // Data flag for renderers/logic to know it's a projectile-like melee
      hitbox.data = { isProjectile: true, trailColor: '#ffffff' }; 
      
      this.world.entities.push(hitbox);
      this.eventBus.dispatch({ type: GameEvents.FLOATING_TEXT_SPAWN, payload: { onPlayer: true, yOffset: -80, text: "STRIKE", color: '#ffffff', size: 24 } });
  }

  // --- ATTACK LOGIC ---

  private performRangedAttack(player: Entity, weapon: Item, targetAngle?: number) {
      if (this.cooldowns().primary > 0) return;

      const stats = this.stats.playerStats();
      const atkSpeed = Math.max(0.5, (weapon.stats['spd'] || 1.0) + (stats.speed * 0.1));
      const cooldown = Math.floor(60 / atkSpeed);
      
      this.maxCooldowns.update(c => ({...c, primary: cooldown}));
      this.cooldowns.update(c => ({...c, primary: cooldown}));

      const aimAngle = targetAngle ?? player.angle;
      player.angle = aimAngle;
      player.state = 'ATTACK';
      player.animFrame = 0;
      player.animFrameTimer = 0;
      player.timer = 0; 

      const recoilForce = 2.0; 
      player.vx -= Math.cos(aimAngle) * recoilForce;
      player.vy -= Math.sin(aimAngle) * recoilForce;

      this.fireProjectile(player, weapon, aimAngle, stats);
      
      this.haptic.impactLight();
      this.eventBus.dispatch({ type: GameEvents.ADD_SCREEN_SHAKE, payload: { intensity: 2, decay: 0.8 } });
      this.sound.play('SHOOT');
  }

  private fireProjectile(player: Entity, weapon: Item, angle: number, stats: any) {
      const projConfig = weapon.projectile!;
      const count = projConfig.count || 1;
      const spread = projConfig.spread || 0;
      const zoneId = this.world.currentZone().id;

      for (let i = 0; i < count; i++) {
          const bullet = this.entityPool.acquire('HITBOX', undefined, zoneId);
          bullet.source = 'PLAYER';
          
          const offsetDist = 30;
          bullet.x = player.x + Math.cos(angle) * offsetDist;
          bullet.y = player.y + Math.sin(angle) * offsetDist;
          
          const fireAngle = angle + (Math.random() - 0.5) * spread;
          const speed = projConfig.speed || 15;
          bullet.vx = Math.cos(fireAngle) * speed;
          bullet.vy = Math.sin(fireAngle) * speed;
          
          bullet.radius = 5;
          bullet.timer = projConfig.range || 60; 
          bullet.color = weapon.color; 
          bullet.state = 'ATTACK';
          
          bullet.data = { 
              renderType: projConfig.renderType, 
              isProjectile: true,
              trailColor: weapon.color 
          };

          const damageScale = count > 1 ? 0.7 : 1.0; 
          
          if (stats.damagePacket) {
              bullet.damagePacket = { ...stats.damagePacket };
              bullet.damagePacket.physical *= damageScale;
              bullet.damagePacket.fire *= damageScale;
          } else {
              bullet.damagePacket = createEmptyDamagePacket();
              bullet.damagePacket.physical = 10 * damageScale;
          }
          
          bullet.penetration = stats.penetration;
          bullet.critChance = stats.crit;
          bullet.hitIds = new Set(); 

          this.world.entities.push(bullet);
      }
  }

  private performMeleeAttack(player: Entity, stats: any, weapon: Item | null, targetAngle?: number) {
        const canCombo = player.state === 'ATTACK' && player.animPhase === 'recovery';
        const cds = this.cooldowns();
        
        if (cds.primary > 0 && !canCombo) return;
        
        let newComboIndex = 0;
        if (canCombo) {
            newComboIndex = (this.currentCombo() + 1) % this.MAX_COMBO;
        } else {
            newComboIndex = 0;
        }
        
        this.currentCombo.set(newComboIndex);
        player.comboIndex = newComboIndex;

        const baseCdr = Math.max(0, Math.min(BALANCE.COOLDOWNS.CDR_CAP, stats.cdr / 100));
        const cdTime = canCombo ? 15 : BALANCE.COOLDOWNS.PRIMARY;
        const cooldown = Math.max(10, cdTime * (1 - baseCdr)); 
        
        this.maxCooldowns.update(c => ({...c, primary: cooldown})); 
        this.cooldowns.update(c => ({...c, primary: cooldown}));
        
        const attackDir = targetAngle ?? player.angle;
        player.angle = attackDir; 
        player.state = 'ATTACK'; 
        player.animFrame = 0; 
        player.animFrameTimer = 0; 
        player.animPhase = 'startup';
        
        const shakeIntensity = 2 + newComboIndex;
        this.eventBus.dispatch({ type: GameEvents.ADD_SCREEN_SHAKE, payload: { intensity: shakeIntensity, decay: 0.9, x: Math.cos(attackDir), y: Math.sin(attackDir) } });
        
        this.sound.play('SWOOSH'); 
  }

  spawnPrimaryAttackHitbox(player: Entity) {
      const stats = this.stats.playerStats();
      const equippedWeapon = this.inventory.equipped().weapon;
      
      const combo = player.comboIndex || 0;
      const currentZoneId = this.world.currentZone().id;
      const hitbox = this.entityPool.acquire('HITBOX', undefined, currentZoneId);
      hitbox.source = 'PLAYER';
      
      // FIXED: Always use stats.damagePacket, create fallback if truly missing
      if (!stats.damagePacket) {
        console.error('[CRITICAL] playerStats().damagePacket is undefined!');
        hitbox.damagePacket = { ...createEmptyDamagePacket(), physical: 10 };
      } else {
        hitbox.damagePacket = { ...stats.damagePacket };
      }
      
      if (stats.penetration) hitbox.penetration = { ...stats.penetration };
      if (equippedWeapon?.damageConversion) hitbox.damageConversion = { ...equippedWeapon.damageConversion };

      let comboMultiplier = 1.0;
      let knockback = 5;
      let stun = 0;
      let color = '#f97316';
      let radiusMult = 1.0;
      let reach = 60;

      if (!equippedWeapon) {
          reach = 75; color = '#fbbf24';
          const lungeSpeed = 12 + (combo * 4);
          player.vx += Math.cos(player.angle) * lungeSpeed;
          player.vy += Math.sin(player.angle) * lungeSpeed;
      } else {
          reach = (equippedWeapon.stats['reach'] || 60) + (stats.damage * 0.1); 
      }

      if (combo === 1) { comboMultiplier = 1.2; knockback += 3; radiusMult = 1.1; } 
      else if (combo === 2) { comboMultiplier = 2.0; knockback += 15; stun = 20; radiusMult = 1.3; this.sound.play('IMPACT'); }

      if (hitbox.damagePacket && comboMultiplier !== 1.0) {
          hitbox.damagePacket.physical = Math.floor(hitbox.damagePacket.physical * comboMultiplier);
          hitbox.damagePacket.fire = Math.floor(hitbox.damagePacket.fire * comboMultiplier);
          hitbox.damagePacket.cold = Math.floor(hitbox.damagePacket.cold * comboMultiplier);
          hitbox.damagePacket.lightning = Math.floor(hitbox.damagePacket.lightning * comboMultiplier);
          hitbox.damagePacket.chaos = Math.floor(hitbox.damagePacket.chaos * comboMultiplier);
      }

      const offsetDist = 20 + (combo * 5); 
      hitbox.x = player.x + Math.cos(player.angle) * offsetDist;
      hitbox.y = player.y + Math.sin(player.angle) * offsetDist;
      hitbox.z = 10;
      hitbox.vx = Math.cos(player.angle) * (3 + combo);
      hitbox.vy = Math.sin(player.angle) * (3 + combo);
      
      hitbox.angle = player.angle;
      hitbox.radius = reach * radiusMult;
      hitbox.timer = 12; 
      
      hitbox.color = color;
      hitbox.state = 'ATTACK';
      hitbox.knockbackForce = knockback;
      hitbox.status.stun = stun;
      
      if (equippedWeapon?.status) hitbox.status = { ...hitbox.status, ...equippedWeapon.status };
      
      hitbox.critChance = stats.crit;
      hitbox.hitIds = new Set(); 

      this.collisionService.checkHitboxCollisions(hitbox);
      this.world.entities.push(hitbox);
      
      player.comboIndex = (combo + 1) % this.MAX_COMBO;
      this.currentCombo.set(player.comboIndex);
  }

  private useSecondary(player: Entity, stats: any, cds: any) {
        const cost = 50;
        if (cds.secondary > 0 || this.stats.psionicEnergy() < cost) return;
        this.stats.psionicEnergy.update(e => e - cost);
        this.cooldowns.update(c => ({...c, secondary: 300}));
        
        const hitbox = this.entityPool.acquire('HITBOX', undefined, this.world.currentZone().id);
        hitbox.source = 'PSIONIC'; hitbox.x = player.x; hitbox.y = player.y; 
        hitbox.radius = 120 + stats.psyche * 3; 
        const damage = 15 + stats.psyche * 2;
        hitbox.damagePacket = createEmptyDamagePacket();
        hitbox.damagePacket.chaos = damage;
        hitbox.color = '#a855f7'; hitbox.state = 'ATTACK'; hitbox.timer = 10; hitbox.knockbackForce = 20; hitbox.psionicEffect = 'wave';
        this.collisionService.checkHitboxCollisions(hitbox);
        this.world.entities.push(hitbox);
        this.eventBus.dispatch({ type: GameEvents.ADD_SCREEN_SHAKE, payload: BALANCE.SHAKE.EXPLOSION });
        this.sound.play('EXPLOSION');
        this.particleService.addParticles({ x: player.x, y: player.y, z: 20, count: 20, speed: 8, color: '#d8b4fe', size: 4, type: 'circle', life: 0.5, emitsLight: true });
  }

  private useDash(player: Entity, cds: any, targetAngle?: number) {
        if (cds.dash > 0) return;
        this.cooldowns.update(c => ({...c, dash: 40}));
        this.currentCombo.set(0); 
        player.comboIndex = 0;
        const dashDir = targetAngle ?? player.angle;
        player.angle = dashDir;
        player.vx += Math.cos(dashDir) * 20; player.vy += Math.sin(dashDir) * 20;
        this.particleService.addParticles({ x: player.x, y: player.y, z: 0, color: '#71717a', count: 10, speed: 2, life: 0.5, size: 2, type: 'circle' });
        this.sound.play('DASH');
  }

  private useUtility(player: Entity, stats: any, cds: any, targetAngle?: number) {
        const cost = 35;
        if (cds.utility > 0 || this.stats.psionicEnergy() < cost) return;
        this.stats.psionicEnergy.update(e => e - cost);
        this.cooldowns.update(c => ({...c, utility: BALANCE.COOLDOWNS.UTILITY}));
        const angle = targetAngle ?? player.angle;
        const hitbox = this.entityPool.acquire('HITBOX', undefined, this.world.currentZone().id);
        hitbox.source = 'PSIONIC'; 
        hitbox.x = player.x + Math.cos(angle) * 70; 
        hitbox.y = player.y + Math.sin(angle) * 70; 
        hitbox.radius = 60; 
        const damage = 5 + stats.psyche * 0.5;
        hitbox.damagePacket = createEmptyDamagePacket();
        hitbox.damagePacket.chaos = damage;
        hitbox.timer = 8; hitbox.color = '#a855f7'; hitbox.status.stun = 30; hitbox.knockbackForce = -15; hitbox.psionicEffect = 'wave';
        this.collisionService.checkHitboxCollisions(hitbox);
        this.world.entities.push(hitbox);
        this.sound.play('CHARGE');
  }

  private useShieldBash(player: Entity, stats: any, cds: any, targetAngle?: number) {
      const cost = 40;
        if (cds.utility > 0 || this.stats.psionicEnergy() < cost) return;
        this.stats.psionicEnergy.update(e => e - cost);
        this.cooldowns.update(c => ({...c, utility: 200}));
        const angle = targetAngle ?? player.angle;
        player.angle = angle;
        player.vx += Math.cos(angle) * 10; player.vy += Math.sin(angle) * 10;
        const hitbox = this.entityPool.acquire('HITBOX', undefined, this.world.currentZone().id);
        hitbox.source = 'PLAYER';
        hitbox.x = player.x + Math.cos(angle) * 40; hitbox.y = player.y + Math.sin(angle) * 40; hitbox.radius = 80;
        hitbox.damagePacket = createEmptyDamagePacket(); hitbox.damagePacket.physical = 25;
        hitbox.timer = 6; hitbox.color = '#fbbf24'; hitbox.status.stun = 45; hitbox.knockbackForce = 15;
        this.collisionService.checkHitboxCollisions(hitbox);
        this.world.entities.push(hitbox);
        this.sound.play('IMPACT');
        this.particleService.addParticles({ x: hitbox.x, y: hitbox.y, z: 20, count: 15, speed: 6, color: '#fbbf24', size: 3, type: 'square', life: 0.4, emitsLight: true });
  }

  private useOverload(player: Entity, stats: any) {
      if (this.stats.psionicEnergy() < this.stats.maxPsionicEnergy()) return;
        this.stats.psionicEnergy.set(0);
        this.world.player.status.stun = 120;
        const explosion = this.entityPool.acquire('HITBOX', undefined, this.world.currentZone().id);
        explosion.source = 'PSIONIC'; explosion.x = player.x; explosion.y = player.y; explosion.radius = 350; 
        const damage = 100 + this.stats.playerStats().psyche * 5; 
        explosion.damagePacket = createEmptyDamagePacket(); explosion.damagePacket.chaos = damage;
        explosion.knockbackForce = 50; explosion.timer = 15; explosion.color = '#f0abfc'; explosion.psionicEffect = 'wave';
        this.collisionService.checkHitboxCollisions(explosion);
        this.world.entities.push(explosion);
        this.eventBus.dispatch({ type: GameEvents.ADD_SCREEN_SHAKE, payload: { intensity: 30, decay: 0.7 } });
        this.sound.play('EXPLOSION');
        this.particleService.addParticles({ x: player.x, y: player.y, z: 20, count: 50, speed: 12, color: '#f0abfc', size: 6, type: 'circle', life: 1.0, emitsLight: true });
  }

  reset() { this.cooldowns.set({ primary: 0, secondary: 0, dash: 0, utility: 0 }); this.currentCombo.set(0); }
}
