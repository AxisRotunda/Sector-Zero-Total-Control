
import { Injectable, inject } from '@angular/core';
import { Entity } from '../models/game.models';
import { PlayerStatsService } from '../game/player/player-stats.service';
import { PlayerProgressionService } from '../game/player/player-progression.service';
import { WorldService } from '../game/world/world.service';
import { SoundService } from '../services/sound.service';
import * as BALANCE from '../config/balance.config';
import * as CONFIG from '../config/game.config';
import { isDestructible, isEnemy } from '../utils/type-guards';
import { EntityPoolService } from '../services/entity-pool.service';
import { InventoryService } from '../game/inventory.service';
import { ParticleService } from './particle.service';
import { ItemGeneratorService } from '../services/item-generator.service';
import { NarrativeService } from '../game/narrative.service';
import { EventBusService } from '../core/events/event-bus.service';
import { GameEvents } from '../core/events/game-events';
import { TimeService } from '../game/time.service';
import { HapticService } from '../services/haptic.service';

@Injectable({ providedIn: 'root' })
export class CombatService {
  private stats = inject(PlayerStatsService);
  private progression = inject(PlayerProgressionService);
  private world = inject(WorldService);
  private sound = inject(SoundService);
  private entityPool = inject(EntityPoolService);
  private inventory = inject(InventoryService);
  private particleService = inject(ParticleService);
  private itemGenerator = inject(ItemGeneratorService);
  private narrative = inject(NarrativeService);
  private eventBus = inject(EventBusService);
  private timeService = inject(TimeService);
  private haptic = inject(HapticService);

  /**
   * Main entry point for Hitbox-based collisions.
   */
  public processHit(hitbox: Entity, target: Entity): void {
    
    // Diagnostic Log
    if (hitbox.source === 'PLAYER' && target.type === 'ENEMY') {
        // Debug logging can be disabled in production
        // console.log('💥 PROCESS HIT:', { hitboxId: hitbox.id, enemyId: target.id, dmg: hitbox.damageValue });
    }

    if (target.hitFlash > 0 || target.isHitStunned) return;

    // 1. Calculate Damage
    const result = this.calculateMitigatedDamage(hitbox, target, hitbox.damageValue || 0);
    
    // 2. Apply Damage & Effects
    this.applyCombatResult(hitbox, target, result);
  }

  /**
   * Entry point for Direct Melee attacks (e.g., Enemy touching Player).
   */
  public applyDirectDamage(attacker: Entity, target: Entity, baseDamage: number): void {
      if (target.hitFlash > 0 || target.isHitStunned || target.invulnerable) return;

      const result = this.calculateMitigatedDamage(attacker, target, baseDamage);
      this.applyCombatResult(attacker, target, result);
  }

  /**
   * Calculates if a hit is critical.
   */
  private rollCritical(source: Entity): boolean {
      let critChance = source.critChance || 5; // Base 5%
      
      // If player is source, use player stats
      if (source.source === 'PLAYER' || source.source === 'PSIONIC') {
          critChance = this.stats.playerStats().crit;
      }
      
      return Math.random() * 100 < critChance;
  }

  /**
   * Calculates Armor Reduction using Diminishing Returns formula.
   * DR = Armor / (Armor + 10 * Damage)
   */
  private calculateArmorReduction(armor: number, damage: number, armorPen: number): number {
      const effectiveArmor = Math.max(0, armor - armorPen);
      if (effectiveArmor <= 0) return 0;
      
      // POE-style formula: Prevents immunity at high armor, scales with hit size
      return effectiveArmor / (effectiveArmor + (10 * damage));
  }

  /**
   * Unified damage calculation logic.
   */
  private calculateMitigatedDamage(source: Entity, target: Entity, incomingDamage: number): { damage: number, isCrit: boolean } {
      let damage = incomingDamage;
      
      // 1. Critical Strike Roll
      const isCrit = this.rollCritical(source);
      if (isCrit) {
          damage *= BALANCE.COMBAT.CRIT_MULTIPLIER;
      }

      // 2. Weakness Status (Amplifies incoming damage before armor)
      // Note: Weakness can also reduce target's armor, handled in next step
      if (target.status.weakness) {
          // e.g. 1.0 / (1 - 0.3) = 1.42x damage taken? Or just flat mult?
          // Using damage reduction property inverted: damage = damage / (1 - reduction)
          // Or just simple multiplier from config if available.
          // For now, assume weakness.damageReduction is actually "Damage Taken Increase" or similar logic.
          // Let's implement it as reducing the effectiveness of armor or boosting damage.
          // Let's treat it as Damage Vulnerability:
          damage = damage * (1 + target.status.weakness.damageReduction);
      }

      // 3. Armor Mitigation
      if (target.armor > 0) {
          // Determine Attacker Armor Pen
          let attackerArmorPen = source.armorPen || 0;
          if (source.source === 'PLAYER' || source.source === 'PSIONIC') {
              attackerArmorPen = this.stats.playerStats().armorPen;
          }

          // Determine Target Effective Armor (Status effects apply here)
          let targetArmor = target.armor;
          if (target.status.weakness) {
              targetArmor *= (1 - target.status.weakness.armorReduction);
          }

          const reduction = this.calculateArmorReduction(targetArmor, damage, attackerArmorPen);
          // Cap reduction at 90%
          const finalReduction = Math.min(0.9, reduction);
          
          damage = damage * (1 - finalReduction);
      }

      return { damage: Math.max(1, damage), isCrit };
  }

  /**
   * Applies the calculated results to the world state.
   */
  private applyCombatResult(source: Entity, target: Entity, result: { damage: number, isCrit: boolean }) {
      const { damage, isCrit } = result;
      const playerStats = this.stats.playerStats();

      // 1. Effects
      if (isCrit) {
          this.eventBus.dispatch({ type: GameEvents.ADD_SCREEN_SHAKE, payload: BALANCE.SHAKE.CRIT });
          this.timeService.triggerSlowMo(100, 0.2); 
          this.haptic.impactHeavy();
          
          // Visual: Critical Text
          this.world.spawnFloatingText(target.x, target.y - 50, 'CRITICAL!', '#facc15', 10);
      } else {
          this.haptic.impactLight();
      }

      // 2. State Updates
      if (target.type === 'PLAYER') {
          this.stats.takeDamage(damage);
          target.invulnerable = true;
          target.iframeTimer = 30;
      } else {
          target.hp -= damage; 
      }

      target.hitFlash = 10;
      target.hitStopFrames = (isCrit || damage > 50) ? BALANCE.ENEMY_AI.HIT_STOP_FRAMES_HEAVY : BALANCE.ENEMY_AI.HIT_STOP_FRAMES_LIGHT;
      target.isHitStunned = true;

      // 3. Knockback
      const knockback = source.knockbackForce ?? BALANCE.COMBAT.KNOCKBACK_FORCE;
      this.applyKnockback(source, target, knockback);

      // 4. Status Effects
      this.applyStatusEffects(source, target);

      // 5. Global Hit Stop
      const stopDuration = Math.min(10, Math.floor(BALANCE.COMBAT.HIT_STOP_FRAMES + (damage / 10)));
      this.timeService.triggerHitStop(stopDuration);

      // 6. Lifesteal (Player Only)
      this.applyLifeSteal(source, damage);

      // 7. UI Feedback
      // Using Math.ceil for display to avoid decimals
      this.world.spawnFloatingText(target.x, target.y - 40, Math.ceil(damage).toString(), isCrit ? '#f97316' : '#fff', isCrit ? 30 : 20);
      this.sound.play(isCrit ? 'CRIT' : 'HIT');

      // 8. Death Check
      if (target.hp <= 0 && target.type !== 'PLAYER') {
          this.haptic.impactMedium();
          if (isEnemy(target)) this.killEnemy(target);
          if (isDestructible(target)) this.destroyObject(target);
      }
  }

  private applyLifeSteal(source: Entity, damageDealt: number) {
      if (source.source !== 'PLAYER' && source.source !== 'PSIONIC') return;
      
      const stats = this.stats.playerStats();
      if (stats.lifesteal > 0) {
          const healing = damageDealt * (stats.lifesteal / 100);
          if (healing >= 1) {
              this.stats.playerHp.update(h => Math.min(stats.hpMax, h + healing));
              this.world.spawnFloatingText(this.world.player.x, this.world.player.y - 60, `+${Math.floor(healing)}`, '#22c55e', 14);
          }
      }
  }

  private applyKnockback(source: Entity, target: Entity, force: number) {
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const angleToTarget = Math.atan2(dy, dx);
      
      if (force < 0) {
          // Vacuum / Pull effect
          const pullAngle = angleToTarget; 
          const swirlAngle = pullAngle + Math.PI / 2;
          const pullStrength = Math.abs(force);
          const swirlStrength = pullStrength * 0.5;
          target.vx -= Math.cos(pullAngle) * pullStrength;
          target.vy -= Math.sin(pullAngle) * pullStrength;
          target.vx += Math.cos(swirlAngle) * swirlStrength;
          target.vy += Math.sin(swirlAngle) * swirlStrength;
      } else {
          target.vx += Math.cos(angleToTarget) * force; 
          target.vy += Math.sin(angleToTarget) * force;
      }
  }

  private applyStatusEffects(source: Entity, target: Entity) {
      const apply = (type: 'stun'|'slow'|'burn'|'poison'|'weakness'|'bleed', effect: any) => {
          const res = target.resistances?.[type as keyof typeof target.resistances] || 1.0;
          if (res <= 0 || !effect) return;

          // Merge Logic
          if (type === 'stun' && source.status.stun > 0) {
              target.status.stun = Math.max(target.status.stun, source.status.stun * res);
          }
          else if (type === 'slow' && source.status.slow > 0) {
              target.status.slow = Math.max(target.status.slow, source.status.slow * res);
          }
          else if (typeof effect === 'object') {
              const newDuration = effect.duration * res;
              const newTimer = effect.timer ? effect.timer * res : undefined;
              
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

      apply('stun', null); 
      apply('slow', null); 
      apply('weakness', source.status.weakness); 
      apply('burn', source.status.burn); 
      apply('poison', source.status.poison);
      apply('bleed', source.status.bleed);
  }

  public killEnemy(e: Entity) {
      e.state = 'DEAD';
      const currentZone = this.world.currentZone();
      
      if (currentZone.isTrainingZone) {
          this.spawnDerezEffect(e.x, e.y);
      } else {
          this.progression.gainXp(e.xpValue);
          this.eventBus.dispatch({ type: GameEvents.ENEMY_KILLED, payload: { type: e.subType || '' } });

          if (e.subType && this.narrative.discoverEntity(e.subType)) {
              this.eventBus.dispatch({ type: GameEvents.FLOATING_TEXT_SPAWN, payload: { onPlayer: true, yOffset: -120, text: "DATABASE UPDATED", color: '#06b6d4', size: 20 } });
          }
          
          this.progression.gainCredits(Math.floor(e.xpValue * 0.5 * (0.8 + Math.random() * 0.4)));
          
          const isBoss = e.subType === 'BOSS';
          if (Math.random() < (isBoss ? 1.0 : CONFIG.LOOT_CHANCES.ENEMY_DROP)) {
              for(let i=0; i<(isBoss?3:1); i++) this.spawnLoot(e.x, e.y, isBoss ? 'BOSS' : 'ENEMY');
          }
          
          // Equipment Drop Chance
          if (e.equipment) {
              if (e.equipment.weapon && Math.random() < 0.3) this.dropSpecificItem(e.x, e.y, e.equipment.weapon);
              if (e.equipment.armor && Math.random() < 0.3) this.dropSpecificItem(e.x, e.y, e.equipment.armor);
          }
      }

      if (currentZone.isTrainingZone) {
          this.checkTrainingWaveComplete();
      }
  }

  private spawnDerezEffect(x: number, y: number): void {
    this.particleService.addParticles({
      x, y, z: 20, count: 30, color: '#06b6d4', speed: 4, size: 3, type: 'square', life: 0.6, composite: 'lighter', emitsLight: true
    });
    this.particleService.addParticles({
      x, y, z: 20, count: 15, color: '#a855f7', speed: 2, size: 4, type: 'square', life: 0.8
    });
  }

  private checkTrainingWaveComplete(): void {
    const activeEnemies = this.world.entities.filter(e => e.type === 'ENEMY' && e.state !== 'DEAD');
    if (activeEnemies.length === 0) {
      this.narrative.setFlag('TRAINING_ACTIVE', false);
      if (this.narrative.getFlag('TRAINING_LVL1_ACTIVE')) {
        this.narrative.setFlag('TRAINING_LVL1_COMPLETE', true);
        this.narrative.setFlag('TRAINING_LVL1_ACTIVE', false);
      }
      this.narrative.setFlag('TRAINING_LVL2_ACTIVE', false);
      this.eventBus.dispatch({ type: GameEvents.FLOATING_TEXT_SPAWN, payload: { onPlayer: true, yOffset: -100, text: "SIMULATION COMPLETE", color: '#06b6d4', size: 30 } });
    }
  }

  private dropSpecificItem(x: number, y: number, item: any) {
      const pickup = this.entityPool.acquire('PICKUP');
      pickup.x = x; pickup.y = y; pickup.color = item.color; pickup.itemData = item; 
      pickup.vx = (Math.random() - 0.5) * 5; pickup.vy = (Math.random() - 0.5) * 5;
      this.world.entities.push(pickup);
  }

  private spawnLoot(x: number, y: number, source: 'ENEMY' | 'CRATE' | 'BOSS') {
    const loot = this.itemGenerator.generateLoot({ level: this.progression.level(), difficulty: this.world.currentZone().difficultyMult, rarityBias: source === 'BOSS' ? 0.6 : (source === 'CRATE' ? 0.2 : 0), source: source });
    this.dropSpecificItem(x, y, loot);
  }

  public destroyObject(e: Entity) {
      e.state = 'DEAD';
      if (e.subType === 'BARREL') {
          this.sound.play('EXPLOSION'); 
          this.eventBus.dispatch({ type: GameEvents.ADD_SCREEN_SHAKE, payload: BALANCE.SHAKE.EXPLOSION });
          this.particleService.addParticles({ x: e.x, y: e.y, z: 10, color: '#ef4444', count: 30, speed: 8, size: 4, type: 'square', emitsLight: true });
          
          const explosion = this.entityPool.acquire('HITBOX', undefined, e.zoneId);
          explosion.source = 'ENVIRONMENT'; explosion.x = e.x; explosion.y = e.y; 
          explosion.radius = BALANCE.ENVIRONMENT.BARREL_EXPLOSION_RADIUS; 
          explosion.damageValue = BALANCE.ENVIRONMENT.BARREL_EXPLOSION_DMG;
          explosion.color = '#f87171'; explosion.state = 'ATTACK'; explosion.timer = 5; 
          explosion.status.stun = BALANCE.ENVIRONMENT.BARREL_EXPLOSION_STUN;
          
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
                 this.eventBus.dispatch({ type: GameEvents.ITEM_COLLECTED, payload: { itemId: e.itemData?.id || '' } });
                 this.sound.play('POWERUP'); e.hp = 0;
             }
        }
    }
  }
}
