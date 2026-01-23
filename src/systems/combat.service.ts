import { Injectable, inject } from '@angular/core';
import { Entity } from '../models/game.models';
import { PlayerStatsService } from '../game/player/player-stats.service';
import { WorldService } from '../game/world/world.service';
import * as BALANCE from '../config/balance.config';
import { isDestructible, isEnemy } from '../utils/type-guards';
import { EntityPoolService } from '../services/entity-pool.service';
import { NarrativeService } from '../game/narrative.service';
import { EventBusService } from '../core/events/event-bus.service';
import { GameEvents } from '../core/events/game-events';
import { LootService } from '../services/loot.service';
import { CombatFeedbackService } from '../services/combat-feedback.service';
import { InventoryService } from '../game/inventory.service';
import { SoundService } from '../services/sound.service';

@Injectable({ providedIn: 'root' })
export class CombatService {
  private stats = inject(PlayerStatsService);
  private world = inject(WorldService);
  private entityPool = inject(EntityPoolService);
  private narrative = inject(NarrativeService);
  private eventBus = inject(EventBusService);
  private inventory = inject(InventoryService);
  private sound = inject(SoundService);
  
  private loot = inject(LootService);
  private feedback = inject(CombatFeedbackService);

  /**
   * Main entry point for Hitbox-based collisions.
   */
  public processHit(hitbox: Entity, target: Entity): void {
    if (target.hitFlash > 0 || target.isHitStunned) return;

    const result = this.calculateMitigatedDamage(
      hitbox,
      target,
      hitbox.damageValue || 0
    );
    this.applyCombatResult(hitbox, target, result);
  }

  /**
   * Entry point for Direct Melee attacks.
   */
  public applyDirectDamage(
    attacker: Entity,
    target: Entity,
    baseDamage: number
  ): void {
    if (target.hitFlash > 0 || target.isHitStunned || target.invulnerable) {
      return;
    }

    const result = this.calculateMitigatedDamage(attacker, target, baseDamage);
    this.applyCombatResult(attacker, target, result);
  }

  private rollCritical(source: Entity): boolean {
    let critChance = source.critChance || 5;

    if (source.source === 'PLAYER' || source.source === 'PSIONIC') {
      critChance = this.stats.playerStats().crit;
    }

    return Math.random() * 100 < critChance;
  }

  private calculateArmorReduction(
    armor: number,
    damage: number,
    armorPen: number
  ): number {
    const effectiveArmor = Math.max(0, armor - armorPen);
    if (effectiveArmor <= 0) return 0;

    // POE-style diminishing returns: Armor / (Armor + 10 * Damage)
    return effectiveArmor / (effectiveArmor + 10 * damage);
  }

  private calculateMitigatedDamage(
    source: Entity,
    target: Entity,
    incomingDamage: number
  ): { damage: number; isCrit: boolean } {
    let damage = incomingDamage;

    // 1. Critical Strike
    const isCrit = this.rollCritical(source);
    if (isCrit) {
      damage *= BALANCE.COMBAT.CRIT_MULTIPLIER;
    }

    // 2. Weakness Amplification
    if (target.status.weakness) {
      damage *= 1 + target.status.weakness.damageReduction;
    }

    // 3. Armor Mitigation
    if (target.armor > 0) {
      let attackerArmorPen = source.armorPen || 0;
      if (source.source === 'PLAYER' || source.source === 'PSIONIC') {
        attackerArmorPen = this.stats.playerStats().armorPen;
      }

      let targetArmor = target.armor;
      if (target.status.weakness) {
        targetArmor *= 1 - target.status.weakness.armorReduction;
      }

      const reduction = this.calculateArmorReduction(
        targetArmor,
        damage,
        attackerArmorPen
      );
      const cappedReduction = Math.min(0.9, reduction);
      damage *= 1 - cappedReduction;
    }

    return { damage: Math.max(1, damage), isCrit };
  }

  private applyCombatResult(
    source: Entity,
    target: Entity,
    result: { damage: number; isCrit: boolean }
  ): void {
    const { damage, isCrit } = result;

    this.feedback.onHitConfirmed(target, damage, isCrit);

    // State updates
    if (target.type === 'PLAYER') {
      this.stats.takeDamage(damage);
      target.invulnerable = true;
      target.iframeTimer = 30;
    } else {
      target.hp -= damage;
    }

    target.hitFlash = 10;
    target.hitStopFrames =
      isCrit || damage > 50
        ? BALANCE.ENEMY_AI.HIT_STOP_FRAMES_HEAVY
        : BALANCE.ENEMY_AI.HIT_STOP_FRAMES_LIGHT;
    target.isHitStunned = true;

    // Knockback
    const knockback = source.knockbackForce ?? BALANCE.COMBAT.KNOCKBACK_FORCE;
    this.applyKnockback(source, target, knockback);

    // Status effects
    this.applyStatusEffects(source, target);

    // Lifesteal
    this.applyLifeSteal(source, damage);

    // Death check
    if (target.hp <= 0 && target.type !== 'PLAYER') {
      if (isEnemy(target)) this.killEnemy(target);
      if (isDestructible(target)) this.destroyObject(target);
    }
  }

  private applyLifeSteal(source: Entity, damageDealt: number): void {
    if (source.source !== 'PLAYER' && source.source !== 'PSIONIC') return;

    const stats = this.stats.playerStats();
    if (stats.lifesteal > 0) {
      const healing = damageDealt * (stats.lifesteal / 100);
      if (healing >= 1) {
        this.stats.playerHp.update((h) =>
          Math.min(stats.hpMax, h + healing)
        );
        this.world.spawnFloatingText(
          this.world.player.x,
          this.world.player.y - 60,
          `+${Math.floor(healing)}`,
          '#22c55e',
          14
        );
      }
    }
  }

  private applyKnockback(
    source: Entity,
    target: Entity,
    force: number
  ): void {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const angleToTarget = Math.atan2(dy, dx);

    if (force < 0) {
      // Vacuum effect
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

  private applyStatusEffects(source: Entity, target: Entity): void {
    type StatusKey = 'stun' | 'slow' | 'burn' | 'poison' | 'weakness' | 'bleed';
    type StatusEffect = number | { duration: number; timer?: number; [key: string]: any };
  
    const applyEffect = (type: StatusKey, sourceEffect: StatusEffect | undefined): void => {
      if (!sourceEffect) return;
  
      const resistance = target.resistances?.[type] ?? 1.0;
      if (resistance <= 0) return;
  
      if (type === 'stun' || type === 'slow') {
        const currentValue = target.status[type] as number;
        const newValue = (sourceEffect as number) * resistance;
        target.status[type] = Math.max(currentValue, newValue) as any;
        return;
      }
  
      if (typeof sourceEffect === 'object') {
        const newDuration = sourceEffect.duration * resistance;
        const newTimer = sourceEffect.timer ? sourceEffect.timer * resistance : newDuration;
  
        const existing = target.status[type];
        
        if (!existing || (typeof existing === 'object' && newDuration > existing.duration)) {
          target.status[type] = {
            ...sourceEffect,
            duration: newDuration,
            timer: newTimer
          } as any;
        }
      }
    };
  
    applyEffect('stun', source.status.stun);
    applyEffect('slow', source.status.slow);
    applyEffect('weakness', source.status.weakness);
    applyEffect('burn', source.status.burn);
    applyEffect('poison', source.status.poison);
    applyEffect('bleed', source.status.bleed);
  }

  public killEnemy(e: Entity): void {
    e.state = 'DEAD';
    const currentZone = this.world.currentZone();

    if (currentZone.isTrainingZone) {
      this.feedback.spawnDerezEffect(e.x, e.y);
      this.checkTrainingWaveComplete();
    } else {
      this.eventBus.dispatch({ type: GameEvents.ENEMY_KILLED, payload: { type: e.subType || '' } });
      this.loot.processEnemyRewards(e);
    }
  }

  private checkTrainingWaveComplete(): void {
    const activeEnemies = this.world.entities.filter(
      (e) => e.type === 'ENEMY' && e.state !== 'DEAD'
    );

    if (activeEnemies.length === 0) {
      this.narrative.setFlag('TRAINING_ACTIVE', false);

      if (this.narrative.getFlag('TRAINING_LVL1_ACTIVE')) {
        this.narrative.setFlag('TRAINING_LVL1_COMPLETE', true);
        this.narrative.setFlag('TRAINING_LVL1_ACTIVE', false);
      }

      this.narrative.setFlag('TRAINING_LVL2_ACTIVE', false);
      this.eventBus.dispatch({
        type: GameEvents.FLOATING_TEXT_SPAWN,
        payload: {
          onPlayer: true,
          yOffset: -100,
          text: 'SIMULATION COMPLETE',
          color: '#06b6d4',
          size: 30
        }
      });
    }
  }

  public destroyObject(e: Entity): void {
    e.state = 'DEAD';

    if (e.subType === 'BARREL') {
      this.feedback.spawnExplosionEffect(e.x, e.y);

      const explosion = this.entityPool.acquire('HITBOX', undefined, e.zoneId);
      explosion.source = 'ENVIRONMENT';
      explosion.x = e.x;
      explosion.y = e.y;
      explosion.radius = BALANCE.ENVIRONMENT.BARREL_EXPLOSION_RADIUS;
      explosion.damageValue = BALANCE.ENVIRONMENT.BARREL_EXPLOSION_DMG;
      explosion.color = '#f87171';
      explosion.state = 'ATTACK';
      explosion.timer = 5;
      explosion.status.stun = BALANCE.ENVIRONMENT.BARREL_EXPLOSION_STUN;

      this.world.entities.push(explosion);
    } else {
      this.feedback.spawnDebrisEffect(e.x, e.y);
    }

    this.loot.processDestructibleRewards(e);
  }

  public updatePickup(e: Entity): void {
    const player = this.world.player;
    const dist = Math.hypot(player.x - e.x, player.y - e.y);
    e.z = 10 + Math.sin(performance.now() * 0.005) * 5;

    if (dist < 100) {
      e.x += (player.x - e.x) * 0.1;
      e.y += (player.y - e.y) * 0.1;

      if (dist < 30 && e.itemData) {
        if (this.inventory.addItem(e.itemData)) {
          this.world.spawnFloatingText(
            player.x,
            player.y - 60,
            e.itemData.name || 'ITEM',
            e.itemData.color || '#fff',
            16
          );
          this.eventBus.dispatch({
            type: GameEvents.ITEM_COLLECTED,
            payload: { itemId: e.itemData.id || '' }
          });
          this.sound.play('POWERUP');
          e.hp = 0;
        }
      }
    }
  }
}