
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
import { UNARMED_WEAPON } from '../../models/item.models';
import { PlayerProgressionService } from './player-progression.service';
import { CollisionService } from '../../systems/collision.service';

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
    this.cooldowns.update(c => ({
        primary: Math.max(0, c.primary - 1), secondary: Math.max(0, c.secondary - 1), dash: Math.max(0, c.dash - 1), utility: Math.max(0, c.utility - 1)
    }));
  }

  useSkill(skill: 'PRIMARY' | 'SECONDARY' | 'DASH' | 'UTILITY' | 'OVERLOAD' | 'SHIELD_BASH', targetAngle?: number) {
    const player = this.world.player;
    if (player.hp <= 0 || player.status.stun > 0) return;
    const stats = this.stats.playerStats();
    const cds = this.cooldowns();

    if (skill === 'PRIMARY') {
        const canCombo = player.state === 'ATTACK' && player.animPhase === 'recovery';
        
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
        
        this.sound.play('SHOOT'); 
    }
    if (skill === 'SECONDARY') {
        const cost = 50;
        if (cds.secondary > 0 || this.stats.psionicEnergy() < cost) return;
        this.stats.psionicEnergy.update(e => e - cost);
        this.cooldowns.update(c => ({...c, secondary: 300}));
        
        const hitbox = this.entityPool.acquire('HITBOX', undefined, this.world.currentZone().id);
        hitbox.source = 'PSIONIC'; hitbox.x = player.x; hitbox.y = player.y; 
        hitbox.radius = 120 + stats.psyche * 3; 
        hitbox.damageValue = 15 + stats.psyche * 2; 
        hitbox.color = '#a855f7'; hitbox.state = 'ATTACK'; hitbox.timer = 10; hitbox.knockbackForce = 20; hitbox.psionicEffect = 'wave';
        
        this.collisionService.checkHitboxCollisions(hitbox);
        
        this.world.entities.push(hitbox);
        this.eventBus.dispatch({ type: GameEvents.ADD_SCREEN_SHAKE, payload: BALANCE.SHAKE.EXPLOSION });
        this.sound.play('EXPLOSION');
        
        this.particleService.addParticles({
            x: player.x, y: player.y, z: 20,
            count: 20, speed: 8, color: '#d8b4fe', size: 4, type: 'circle',
            life: 0.5, emitsLight: true
        });
    }
    if (skill === 'DASH') {
        if (cds.dash > 0) return;
        this.cooldowns.update(c => ({...c, dash: 40}));
        this.currentCombo.set(0); 
        player.comboIndex = 0;
        
        const dashDir = targetAngle ?? player.angle;
        // Ensure visual alignment to dash direction
        player.angle = dashDir;
        player.vx += Math.cos(dashDir) * 20; player.vy += Math.sin(dashDir) * 20;
        this.particleService.addParticles({ x: player.x, y: player.y, z: 0, color: '#71717a', count: 10, speed: 2, life: 0.5, size: 2, type: 'circle' });
        this.sound.play('DASH');
    }
    if (skill === 'UTILITY') {
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
        hitbox.damageValue = 5 + stats.psyche * 0.5;
        hitbox.timer = 8; 
        hitbox.color = '#a855f7'; 
        hitbox.status.stun = 30; 
        hitbox.knockbackForce = -15; // VACUUM PULL
        hitbox.psionicEffect = 'wave';
        this.world.entities.push(hitbox);
        this.sound.play('CHARGE');
    }
    if (skill === 'SHIELD_BASH') {
        const cost = 40;
        if (cds.utility > 0 || this.stats.psionicEnergy() < cost) return;
        this.stats.psionicEnergy.update(e => e - cost);
        this.cooldowns.update(c => ({...c, utility: 200}));

        const angle = targetAngle ?? player.angle;
        player.angle = angle; // Snap visual
        player.vx += Math.cos(angle) * 10;
        player.vy += Math.sin(angle) * 10;

        const hitbox = this.entityPool.acquire('HITBOX', undefined, this.world.currentZone().id);
        hitbox.source = 'PLAYER';
        hitbox.x = player.x + Math.cos(angle) * 40;
        hitbox.y = player.y + Math.sin(angle) * 40;
        hitbox.radius = 80;
        hitbox.damageValue = 25;
        hitbox.timer = 6;
        hitbox.color = '#fbbf24';
        hitbox.status.stun = 45;
        hitbox.knockbackForce = 15;
        
        this.collisionService.checkHitboxCollisions(hitbox);
        
        this.world.entities.push(hitbox);
        this.sound.play('IMPACT');
        
        this.particleService.addParticles({
            x: hitbox.x, y: hitbox.y, z: 20,
            count: 15, speed: 6, color: '#fbbf24', size: 3, type: 'square',
            life: 0.4, emitsLight: true
        });
    }
    if (skill === 'OVERLOAD') {
        if (this.stats.psionicEnergy() < this.stats.maxPsionicEnergy()) return;
        this.stats.psionicEnergy.set(0);
        this.world.player.status.stun = 120;
        const explosion = this.entityPool.acquire('HITBOX', undefined, this.world.currentZone().id);
        explosion.source = 'PSIONIC'; explosion.x = player.x; explosion.y = player.y; 
        explosion.radius = 350; 
        explosion.damageValue = 100 + this.stats.playerStats().psyche * 5; 
        explosion.knockbackForce = 50; explosion.timer = 15; explosion.color = '#f0abfc'; explosion.psionicEffect = 'wave';
        
        this.collisionService.checkHitboxCollisions(explosion);
        
        this.world.entities.push(explosion);
        this.eventBus.dispatch({ type: GameEvents.ADD_SCREEN_SHAKE, payload: { intensity: 30, decay: 0.7 } });
        this.sound.play('EXPLOSION');
        
        this.particleService.addParticles({
            x: player.x, y: player.y, z: 20,
            count: 50, speed: 12, color: '#f0abfc', size: 6, type: 'circle',
            life: 1.0, emitsLight: true
        });
    }
  }

  spawnPrimaryAttackHitbox(player: Entity) {
      const stats = this.stats.playerStats();
      const equippedWeapon = this.inventory.equipped().weapon;
      const combo = player.comboIndex || 0;
      
      const currentZoneId = this.world.currentZone().id;

      // BRANCH 1: UNARMED
      if (!equippedWeapon) {
          const level = this.progression.level() || 1;
          const baseDamage = 8; // Buffed from 6 to ensure damage vs armor
          const scaledDamage = baseDamage + (level * 2) + (stats.damage * 0.3); 
          
          let comboMultiplier = 1.0;
          let knockback = 5;
          let stun = 0;
          // BUFF: Significantly increased base reach (45 -> 75)
          let reach = 75; 
          let color = '#fbbf24';
          let radiusMult = 1.0;

          // Add a forward Lunge to help connect hits on mobile
          const lungeSpeed = 12 + (combo * 4);
          player.vx += Math.cos(player.angle) * lungeSpeed;
          player.vy += Math.sin(player.angle) * lungeSpeed;

          if (combo === 1) {
              comboMultiplier = 1.2;
              knockback = 8;
              color = '#fcd34d';
              reach = 80;
          } else if (combo === 2) {
              comboMultiplier = 2.5;
              knockback = 35; 
              stun = 45; 
              color = '#f59e0b'; 
              reach = 90;
              radiusMult = 1.3; 
              
              this.sound.play('IMPACT');
              this.eventBus.dispatch({ type: GameEvents.ADD_SCREEN_SHAKE, payload: { intensity: 8, decay: 0.8 } });
          }

          const finalDamage = Math.max(1, scaledDamage * comboMultiplier);

          const hitbox = this.entityPool.acquire('HITBOX', undefined, currentZoneId);
          hitbox.type = 'HITBOX';
          hitbox.source = 'PLAYER';
          const offsetDist = 20 + (combo * 5); 
          hitbox.x = player.x + Math.cos(player.angle) * offsetDist;
          hitbox.y = player.y + Math.sin(player.angle) * offsetDist;
          hitbox.z = 10;
          
          // Projectile Motion to sweep area
          hitbox.vx = Math.cos(player.angle) * (3 + combo);
          hitbox.vy = Math.sin(player.angle) * (3 + combo);
          
          hitbox.angle = player.angle;
          hitbox.radius = reach * radiusMult;
          // BUFF: Duration 10 -> 12
          hitbox.timer = 12; 
          
          hitbox.damageValue = finalDamage; 

          hitbox.color = color;
          hitbox.state = 'ATTACK';
          hitbox.knockbackForce = knockback;
          hitbox.status.stun = stun;
          hitbox.hitIds = new Set(); 

          this.collisionService.checkHitboxCollisions(hitbox);
          this.world.entities.push(hitbox);
          this.haptic.impactLight();
          
          if (combo === 2) {
              this.particleService.addParticles({
                  x: hitbox.x, y: hitbox.y, z: 15,
                  count: 12, speed: 6, color: '#f59e0b', size: 3, type: 'square',
                  life: 0.4, emitsLight: true
              });
          }
          
          player.comboIndex = (combo + 1) % this.MAX_COMBO;
          this.currentCombo.set(player.comboIndex);
          return;
      }

      // BRANCH 2: ARMED
      const weapon = equippedWeapon;
      
      const baseReach = weapon.stats?.['reach'] || 60; 
      const reachScale = weapon.shape === 'psiBlade' ? 1.2 : 1.0;
      let reach = (baseReach + (stats.damage * 0.3)) * reachScale;

      let damage = weapon.stats['dmg'] || 5;
      damage += stats.damage; 

      let dmgMult = 1.0;
      const baseKb = 8;
      const kbMult = 4;
      let color = '#f97316'; 
      let stun = 0;

      const knockback = baseKb + (combo * kbMult);

      if (combo === 1) {
          reach *= 1.2;
          dmgMult = 1.2;
          color = '#fb923c';
      } else if (combo === 2) {
          reach *= 1.5;
          dmgMult = 2.0;
          stun = 15; 
          color = '#ea580c';
      }

      const finalDamage = Math.max(1, damage * dmgMult);

      const hitbox = this.entityPool.acquire('HITBOX', undefined, currentZoneId);
      hitbox.type = 'HITBOX';
      hitbox.source = 'PLAYER';
      hitbox.x = player.x + Math.cos(player.angle) * 30; 
      hitbox.y = player.y + Math.sin(player.angle) * 30;
      hitbox.z = 10;
      hitbox.vx = Math.cos(player.angle) * (2 + combo); 
      hitbox.vy = Math.sin(player.angle) * (2 + combo);
      hitbox.angle = player.angle; 
      hitbox.radius = reach; 
      
      hitbox.damageValue = finalDamage;
      
      hitbox.color = color; 
      hitbox.state = 'ATTACK'; 
      hitbox.timer = 15; 
      hitbox.knockbackForce = knockback;
      hitbox.status.stun = stun;
      hitbox.hitIds = new Set();

      this.collisionService.checkHitboxCollisions(hitbox);
      this.world.entities.push(hitbox);
      this.haptic.impactMedium();
      
      player.comboIndex = (combo + 1) % this.MAX_COMBO;
      this.currentCombo.set(player.comboIndex);
  }

  reset() { this.cooldowns.set({ primary: 0, secondary: 0, dash: 0, utility: 0 }); this.currentCombo.set(0); }
}
