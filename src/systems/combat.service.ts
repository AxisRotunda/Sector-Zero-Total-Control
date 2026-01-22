
import { Injectable, inject } from '@angular/core';
import { Entity } from '../models/game.models';
import { PlayerService } from '../game/player/player.service';
import { WorldService } from '../game/world/world.service';
import { SoundService } from '../services/sound.service';
import * as BALANCE from '../config/balance.config';
import * as CONFIG from '../config/game.config';
import { isDestructible, isEnemy } from '../utils/type-guards';
import { EntityPoolService } from '../services/entity-pool.service';
import { InventoryService } from '../game/inventory.service';
import { MissionService } from '../game/mission.service';
import { ParticleService } from './particle.service';
import { ItemGeneratorService } from '../services/item-generator.service';
import { NarrativeService } from '../game/narrative.service';
import { EventBusService } from '../core/events/event-bus.service';
import { GameEvents } from '../core/events/game-events';
import { TimeService } from '../game/time.service';
import { HapticService } from '../services/haptic.service';
import { UiPanelService } from '../services/ui-panel.service';

@Injectable({ providedIn: 'root' })
export class CombatService {
  private player = inject(PlayerService);
  private world = inject(WorldService);
  private sound = inject(SoundService);
  private entityPool = inject(EntityPoolService);
  private inventory = inject(InventoryService);
  private mission = inject(MissionService);
  private particleService = inject(ParticleService);
  private itemGenerator = inject(ItemGeneratorService);
  private narrative = inject(NarrativeService);
  private eventBus = inject(EventBusService);
  private timeService = inject(TimeService);
  private haptic = inject(HapticService);
  private uiService = inject(UiPanelService); // Use UiPanelService or EventBus for notification

  public processHit(hitbox: Entity, target: Entity): void {
    if (target.hitFlash > 0 || target.isHitStunned) return;
    const playerStats = this.player.playerStats();
    let dmg = hitbox.hp;
    let armorMultiplier = 1;
    if (target.status.weakness) armorMultiplier = 1 - target.status.weakness.armorReduction;
    
    if (target.armor > 0) {
        const attackerArmorPen = (hitbox.source === 'PLAYER' || hitbox.source === 'PSIONIC') ? playerStats.armorPen : 0;
        const netArmor = Math.max(0, target.armor * armorMultiplier);
        const effectiveArmor = Math.max(0, netArmor - attackerArmorPen); // Fix: Prevent negative armor increasing damage
        dmg *= (100 / (100 + effectiveArmor));
    }

    const isCrit = (hitbox.source === 'PLAYER' || hitbox.source === 'PSIONIC') && (Math.random() * 100 < playerStats.crit);
    if (isCrit) { 
        dmg *= BALANCE.COMBAT.CRIT_MULTIPLIER; 
        this.player.addShake(BALANCE.SHAKE.CRIT); 
        this.timeService.triggerSlowMo(100, 0.2); 
        this.haptic.impactHeavy();
    } else {
        this.haptic.impactLight();
    }

    target.hp -= dmg; target.hitFlash = 10;
    target.hitStopFrames = (isCrit || dmg > 50) ? BALANCE.ENEMY_AI.HIT_STOP_FRAMES_HEAVY : BALANCE.ENEMY_AI.HIT_STOP_FRAMES_LIGHT;
    target.isHitStunned = true;

    let knockback = hitbox.knockbackForce ?? BALANCE.COMBAT.KNOCKBACK_FORCE;
    const dx = target.x - hitbox.x;
    const dy = target.y - hitbox.y;
    const angleToTarget = Math.atan2(dy, dx);
    
    if (knockback < 0) {
        const pullAngle = angleToTarget; 
        const swirlAngle = pullAngle + Math.PI / 2;
        const pullStrength = Math.abs(knockback);
        const swirlStrength = pullStrength * 0.5;
        target.vx -= Math.cos(pullAngle) * pullStrength;
        target.vy -= Math.sin(pullAngle) * pullStrength;
        target.vx += Math.cos(swirlAngle) * swirlStrength;
        target.vy += Math.sin(swirlAngle) * swirlStrength;
    } else {
        target.vx += Math.cos(angleToTarget) * knockback; 
        target.vy += Math.sin(angleToTarget) * knockback;
    }

    const applyStatus = (type: 'stun'|'slow'|'burn'|'poison'|'weakness', effect: any) => {
        const res = target.resistances?.[type] || 1.0;
        if (res <= 0 || !effect) return;

        // Apply simple duration multipliers
        if (type === 'stun' && hitbox.status.stun > 0) {
            target.status.stun = Math.max(target.status.stun, hitbox.status.stun * res);
        }
        else if (type === 'slow' && hitbox.status.slow > 0) {
            target.status.slow = Math.max(target.status.slow, hitbox.status.slow * res);
        }
        else if (typeof effect === 'object') {
            // Fix: Use object spread instead of JSON cloning
            const newDuration = effect.duration * res;
            const newTimer = effect.timer ? effect.timer * res : undefined;
            
            // Fix: Check priority (duration) before overwriting existing status
            const existing = (target.status as any)[type];
            if (!existing || newDuration > existing.duration) {
                (target.status as any)[type] = { 
                    ...effect, 
                    duration: newDuration,
                    timer: newTimer ?? newDuration
                };
            }
        }
    };
    applyStatus('stun', null); applyStatus('slow', null); applyStatus('weakness', hitbox.status.weakness); applyStatus('burn', hitbox.status.burn); applyStatus('poison', hitbox.status.poison);

    const stopDuration = Math.min(10, Math.floor(BALANCE.COMBAT.HIT_STOP_FRAMES + (dmg / 10)));
    this.timeService.triggerHitStop(stopDuration);

    if (hitbox.source === 'PLAYER' && playerStats.lifesteal > 0) {
        this.player.playerHp.update(h => Math.min(playerStats.hpMax, h + dmg * (playerStats.lifesteal / 100)));
    }

    this.world.spawnFloatingText(target.x, target.y - 40, Math.floor(dmg).toString(), isCrit ? '#f97316' : '#fff', isCrit ? 30 : 20);
    this.sound.play(isCrit ? 'CRIT' : 'HIT');

    if (target.hp <= 0) {
        this.haptic.impactMedium();
        if (isEnemy(target)) this.killEnemy(target);
        if (isDestructible(target)) this.destroyObject(target);
    }
  }

  public killEnemy(e: Entity) {
      e.state = 'DEAD';
      
      const currentZone = this.world.currentZone();
      const isTraining = currentZone.isTrainingZone;

      // Handle Death Effects
      if (isTraining) {
          this.spawnDerezEffect(e.x, e.y);
      } 

      // Rewards (Skip in Training)
      if (!isTraining) {
          this.player.gainXp(e.xpValue);
          this.mission.onEnemyKill(e.subType || '');
          if (e.subType && this.narrative.discoverEntity(e.subType)) {
              this.eventBus.dispatch({ type: GameEvents.FLOATING_TEXT_SPAWN, payload: { onPlayer: true, yOffset: -120, text: "DATABASE UPDATED", color: '#06b6d4', size: 20 } });
          }
          this.player.gainCredits(Math.floor(e.xpValue * 0.5 * (0.8 + Math.random() * 0.4)));
          
          const isBoss = e.subType === 'BOSS';
          if (Math.random() < (isBoss ? 1.0 : CONFIG.LOOT_CHANCES.ENEMY_DROP)) {
              for(let i=0; i<(isBoss?3:1); i++) this.spawnLoot(e.x, e.y, isBoss ? 'BOSS' : 'ENEMY');
          }
          if (e.equipment) {
              if (e.equipment.weapon && Math.random() < 0.3) this.dropSpecificItem(e.x, e.y, e.equipment.weapon);
              if (e.equipment.armor && Math.random() < 0.3) this.dropSpecificItem(e.x, e.y, e.equipment.armor);
          }
      }

      // Check for training completion
      if (isTraining) {
          this.checkTrainingWaveComplete();
      }
  }

  private spawnDerezEffect(x: number, y: number): void {
    // Cyan -> Purple -> Transparent
    this.particleService.addParticles({
      x, y, z: 20,
      count: 30,
      color: '#06b6d4',
      speed: 4,
      size: 3,
      type: 'square',
      life: 0.6,
      composite: 'lighter',
      emitsLight: true // Added light emission
    });
    // Secondary purple burst
    this.particleService.addParticles({
      x, y, z: 20,
      count: 15,
      color: '#a855f7',
      speed: 2,
      size: 4,
      type: 'square',
      life: 0.8
    });
  }

  private checkTrainingWaveComplete(): void {
    const zoneId = this.world.currentZone().id;
    // Check if any active enemies remain in the zone
    const activeEnemies = this.world.entities.filter(e => e.type === 'ENEMY' && e.state !== 'DEAD');
    
    if (activeEnemies.length === 0) {
      // Wave complete
      this.narrative.setFlag('TRAINING_ACTIVE', false);
      
      // Unlock next trial if this was LVL1
      if (this.narrative.getFlag('TRAINING_LVL1_ACTIVE')) {
        this.narrative.setFlag('TRAINING_LVL1_COMPLETE', true);
        this.narrative.setFlag('TRAINING_LVL1_ACTIVE', false);
      }
      
      // Clean up flags
      this.narrative.setFlag('TRAINING_LVL2_ACTIVE', false);

      // Show completion UI
      this.eventBus.dispatch({ 
          type: GameEvents.FLOATING_TEXT_SPAWN, 
          payload: { onPlayer: true, yOffset: -100, text: "SIMULATION COMPLETE", color: '#06b6d4', size: 30 } 
      });
    }
  }

  private dropSpecificItem(x: number, y: number, item: any) {
      const pickup = this.entityPool.acquire('PICKUP');
      pickup.x = x; pickup.y = y; pickup.color = item.color; pickup.itemData = item; pickup.vx = (Math.random() - 0.5) * 5; pickup.vy = (Math.random() - 0.5) * 5;
      this.world.entities.push(pickup);
  }

  private spawnLoot(x: number, y: number, source: 'ENEMY' | 'CRATE' | 'BOSS') {
    const loot = this.itemGenerator.generateLoot({ level: this.player.level(), difficulty: this.world.currentZone().difficultyMult, rarityBias: source === 'BOSS' ? 0.6 : (source === 'CRATE' ? 0.2 : 0), source: source });
    this.dropSpecificItem(x, y, loot);
  }

  public destroyObject(e: Entity) {
      e.state = 'DEAD';
      if (e.subType === 'BARREL') {
          this.sound.play('EXPLOSION'); this.player.addShake(BALANCE.SHAKE.EXPLOSION);
          this.particleService.addParticles({
              x: e.x, y: e.y, z: 10, color: '#ef4444', count: 30, speed: 8, size: 4, type: 'square',
              emitsLight: true // Added light emission
          });
          const explosion = this.entityPool.acquire('HITBOX', undefined, e.zoneId);
          explosion.source = 'ENVIRONMENT'; explosion.x = e.x; explosion.y = e.y; explosion.radius = BALANCE.ENVIRONMENT.BARREL_EXPLOSION_RADIUS; explosion.hp = BALANCE.ENVIRONMENT.BARREL_EXPLOSION_DMG;
          explosion.color = '#f87171'; explosion.state = 'ATTACK'; explosion.timer = 5; explosion.status.stun = BALANCE.ENVIRONMENT.BARREL_EXPLOSION_STUN;
          this.world.entities.push(explosion);
      } else {
          this.particleService.addParticles({x: e.x, y: e.y, z: 10, color: '#a16207', count: 10, speed: 4, size: 2, type: 'square'});
      }
      if (Math.random() < CONFIG.LOOT_CHANCES.DESTRUCTIBLE_DROP) this.spawnLoot(e.x, e.y, 'CRATE');
  }

  public updatePickup(e: Entity) {
    const player = this.world.player;
    const dist = Math.hypot(player.x - e.x, player.y - e.y);
    e.z = 10 + Math.sin(performance.now() * 0.005) * 5;
    if (dist < 100) { 
        e.x += (player.x - e.x) * 0.1; e.y += (player.y - e.y) * 0.1;
        if (dist < 30) {
             if(this.inventory.addItem(e.itemData!)) {
                 this.world.spawnFloatingText(player.x, player.y - 60, e.itemData?.name || 'ITEM', e.itemData?.color || '#fff', 16);
                 this.mission.onCollect(e.itemData?.id); this.sound.play('POWERUP'); e.hp = 0;
             }
        }
    }
  }
}
