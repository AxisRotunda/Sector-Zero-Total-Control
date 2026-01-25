
import { Injectable, inject } from '@angular/core';
import { Entity } from '../models/game.models';
import {
  DamagePacket,
  DamageResult,
  Resistances,
  Penetration,
  createEmptyDamagePacket,
  createZeroPenetration,
  calculateTotalDamage,
  RESISTANCE_CAPS,
  RESISTANCE_FLOOR,
  DamageConversion,
  createDefaultResistances
} from '../models/damage.model';
import { PlayerStatsService } from '../game/player/player-stats.service';
import { WorldService } from '../game/world/world.service';
import * as BALANCE from '../config/balance.config';
import { isDestructible, isEnemy } from '../utils/type-guards';
import { EntityPoolService } from '../services/entity-pool.service';
import { NarrativeService } from '../game/narrative.service';
import { EventBusService } from '../core/events/event-bus.service';
import { GameEvents } from '../core/events/game-events';
import { LootService } from '../services/loot.service';
import { InventoryService } from '../game/inventory.service';
import { SoundService } from '../services/sound.service';
import { ProofKernelService } from '../core/proof/proof-kernel.service';
import { LeanCombatState, LeanCombatInput } from '../core/lean-bridge.service';

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
  private proofKernel = inject(ProofKernelService);

  private damageResultPool: DamageResult[] = [];

  private acquireDamageResult(): DamageResult {
      return this.damageResultPool.pop() || {
          total: 0,
          breakdown: createEmptyDamagePacket(),
          isCrit: false,
          penetratedResistances: createDefaultResistances()
      };
  }

  private releaseDamageResult(result: DamageResult) {
      if (this.damageResultPool.length < 50) {
          this.damageResultPool.push(result);
      }
  }

  public processHit(hitbox: Entity, target: Entity): void {
    if (target.hitFlash > 0 || target.isHitStunned) return;

    const damagePacket = hitbox.damagePacket ?? this.createFallbackDamagePacket(hitbox);
    
    // Snapshot Pre-State
    const oldHp = target.hp;
    
    // 1. Calculate Potential Damage (Pure Function)
    const result = this.calculateMitigatedDamage(hitbox, target, damagePacket);
    
    // 2. Optimistic Application
    this.applyCombatResult(hitbox, target, result);

    // 3. Kernel Gate Verification
    // Map to Lean types
    const prev: LeanCombatState = { hp: oldHp, max_hp: target.maxHp, armor: target.armor || 0 };
    const next: LeanCombatState = { hp: target.hp, max_hp: target.maxHp, armor: target.armor || 0 };
    const input: LeanCombatInput = { damage: result.total, penetration: 0 }; // Simplified input for kernel check

    // This call logs violations in SOFT_PROD and throws in STRICT_DEV
    this.proofKernel.verifyCombatStep('PROCESS_HIT', prev, input, next);
    
    this.releaseDamageResult(result);
  }

  public applyDirectDamage(
    attacker: Entity,
    target: Entity,
    baseDamage: number
  ): void {
    if (target.hitFlash > 0 || target.isHitStunned || target.invulnerable) {
      return;
    }

    const oldHp = target.hp;
    const damagePacket = createEmptyDamagePacket();
    damagePacket.physical = baseDamage;

    const result = this.calculateMitigatedDamage(attacker, target, damagePacket);
    
    this.applyCombatResult(attacker, target, result);

    const prev: LeanCombatState = { hp: oldHp, max_hp: target.maxHp, armor: target.armor || 0 };
    const next: LeanCombatState = { hp: target.hp, max_hp: target.maxHp, armor: target.armor || 0 };
    const input: LeanCombatInput = { damage: result.total, penetration: 0 };

    this.proofKernel.verifyCombatStep('DIRECT_DAMAGE', prev, input, next);

    this.releaseDamageResult(result);
  }

  private createFallbackDamagePacket(hitbox: Entity): DamagePacket {
    const packet = createEmptyDamagePacket();
    
    if (hitbox.damageValue !== undefined) {
      if (hitbox.color === '#ef4444') packet.fire = hitbox.damageValue;
      else if (hitbox.color === '#3b82f6') packet.cold = hitbox.damageValue;
      else if (hitbox.color === '#eab308') packet.lightning = hitbox.damageValue;
      else if (hitbox.color === '#a855f7') packet.chaos = hitbox.damageValue;
      else packet.physical = hitbox.damageValue;
      return packet;
    }
    
    if (hitbox.source === 'PLAYER' || hitbox.source === 'PSIONIC') {
      const stats = this.stats.playerStats();
      if (stats.damagePacket) {
        return { ...stats.damagePacket }; 
      }
      if (stats.damage !== undefined) {
        packet.physical = stats.damage;
      } else {
        packet.physical = 10; 
      }
    } else {
      packet.physical = 10;
    }
    
    return packet;
  }

  private rollCritical(source: Entity): boolean {
    let critChance = source.critChance || 5;
    if (source.source === 'PLAYER' || source.source === 'PSIONIC') {
      critChance = this.stats.playerStats().crit;
    }
    return Math.random() * 100 < critChance;
  }

  private applyDamageConversion(
    packet: DamagePacket,
    conversion?: DamageConversion
  ): DamagePacket {
    if (!conversion) return packet;
    const converted = { ...packet };
    if (conversion.physicalToFire) {
      const amount = packet.physical * conversion.physicalToFire;
      converted.physical -= amount;
      converted.fire += amount;
    }
    if (conversion.physicalToCold) {
      const amount = packet.physical * conversion.physicalToCold;
      converted.physical -= amount;
      converted.cold += amount;
    }
    if (conversion.physicalToLightning) {
      const amount = packet.physical * conversion.physicalToLightning;
      converted.physical -= amount;
      converted.lightning += amount;
    }
    if (conversion.physicalToChaos) {
      const amount = packet.physical * conversion.physicalToChaos;
      converted.physical -= amount;
      converted.chaos += amount;
    }
    return converted;
  }

  private applyPenetration(
    targetResistances: Resistances,
    penetration: Penetration
  ): Resistances {
    return {
      physical: targetResistances.physical, 
      fire: Math.max(RESISTANCE_FLOOR, targetResistances.fire * (1 - penetration.fire)),
      cold: Math.max(RESISTANCE_FLOOR, targetResistances.cold * (1 - penetration.cold)),
      lightning: Math.max(RESISTANCE_FLOOR, targetResistances.lightning * (1 - penetration.lightning)),
      chaos: Math.max(RESISTANCE_FLOOR, targetResistances.chaos * (1 - penetration.chaos))
    };
  }

  private calculatePhysicalMitigation(
    physicalDamage: number,
    armor: number
  ): number {
    if (armor <= 0 || physicalDamage <= 0) return 0;
    const reduction = armor / (armor + 10 * physicalDamage);
    return Math.min(0.90, reduction);
  }

  private calculateMitigatedDamage(
    source: Entity,
    target: Entity,
    incomingDamage: DamagePacket
  ): DamageResult {
    let damagePacket = { ...incomingDamage };

    // 1. Critical
    const isCrit = this.rollCritical(source);
    if (isCrit) {
      const mult = BALANCE.COMBAT.CRIT_MULTIPLIER;
      damagePacket.physical *= mult;
      damagePacket.fire *= mult;
      damagePacket.cold *= mult;
      damagePacket.lightning *= mult;
      damagePacket.chaos *= mult;
    }

    // 2. Conversion
    damagePacket = this.applyDamageConversion(damagePacket, source.damageConversion);

    // 3. Weakness
    if (target.status.weakness) {
      const amp = 1 + target.status.weakness.damageReduction;
      damagePacket.physical *= amp;
      damagePacket.fire *= amp;
      damagePacket.cold *= amp;
      damagePacket.lightning *= amp;
      damagePacket.chaos *= amp;
    }

    // 4. Penetration
    let penetration = source.penetration ? { ...source.penetration } : createZeroPenetration();
    
    if ((source.source === 'PLAYER' || source.source === 'PSIONIC') && !source.penetration) {
        const pStats = this.stats.playerStats();
        if (pStats.penetration) {
            penetration.physical += pStats.penetration.physical;
            penetration.fire += pStats.penetration.fire;
        } else {
            penetration.physical = pStats.armorPen;
        }
    } else if (source.armorPen) {
        penetration.physical = source.armorPen;
    }

    // 5. Target Resistances (Safely Cloned)
    let targetResistances = target.resistances 
      ? { ...target.resistances } 
      : createDefaultResistances();
      
    if (targetResistances.physical === 0 && target.armor > 0) {
        targetResistances.physical = target.armor;
    }

    // 6. Effective Resistances
    const effectiveResistances = this.applyPenetration(targetResistances, penetration);

    // 7. Armor Logic
    const effectiveArmor = targetResistances.physical * (1 - penetration.physical);
    const physicalMitigation = this.calculatePhysicalMitigation(
      damagePacket.physical,
      effectiveArmor
    );

    // 8. Mitigation Application
    const mitigatedDamage: DamagePacket = {
      physical: damagePacket.physical * (1 - physicalMitigation),
      fire: damagePacket.fire * (1 - Math.min(RESISTANCE_CAPS.fire, effectiveResistances.fire)),
      cold: damagePacket.cold * (1 - Math.min(RESISTANCE_CAPS.cold, effectiveResistances.cold)),
      lightning: damagePacket.lightning * (1 - Math.min(RESISTANCE_CAPS.lightning, effectiveResistances.lightning)),
      chaos: damagePacket.chaos * (1 - Math.min(RESISTANCE_CAPS.chaos, effectiveResistances.chaos))
    };

    const total = calculateTotalDamage(mitigatedDamage);
    const finalTotal = total > 0 ? Math.max(1, total) : 0;

    // Use Pooled Object
    const result = this.acquireDamageResult();
    result.total = finalTotal;
    result.breakdown = mitigatedDamage; 
    result.isCrit = isCrit;
    result.penetratedResistances = effectiveResistances;

    return result;
  }

  private applyCombatResult(
    source: Entity,
    target: Entity,
    result: DamageResult
  ): void {
    const { total } = result;

    this.eventBus.dispatch({
        type: GameEvents.COMBAT_HIT_CONFIRMED,
        payload: { source, target, result }
    });

    // State updates
    if (target.type === 'PLAYER') {
      this.stats.takeDamage(total);
      target.invulnerable = true;
      target.iframeTimer = 30;
    } else {
      target.hp -= total;
    }

    target.hitFlash = 10;
    target.hitStopFrames =
      result.isCrit || total > 50
        ? BALANCE.ENEMY_AI.HIT_STOP_FRAMES_HEAVY
        : BALANCE.ENEMY_AI.HIT_STOP_FRAMES_LIGHT;
    target.isHitStunned = true;

    const knockback = source.knockbackForce ?? BALANCE.COMBAT.KNOCKBACK_FORCE;
    this.applyKnockback(source, target, knockback);
    this.applyStatusEffects(source, target);
    this.applyLifeSteal(source, total);

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
        this.stats.playerHp.update((h) => Math.min(stats.hpMax, h + healing));
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

  private applyKnockback(source: Entity, target: Entity, force: number): void {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const angleToTarget = Math.atan2(dy, dx);

    if (force < 0) {
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
      const resistance = target.statusResistances?.[type as keyof typeof target.statusResistances] ?? 1.0;
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
      this.eventBus.dispatch({ type: GameEvents.ENEMY_KILLED, payload: { type: e.subType || '' } });
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
      const explosion = this.entityPool.acquire('HITBOX', undefined, e.zoneId);
      explosion.source = 'ENVIRONMENT';
      explosion.x = e.x;
      explosion.y = e.y;
      explosion.radius = BALANCE.ENVIRONMENT.BARREL_EXPLOSION_RADIUS;
      const packet = createEmptyDamagePacket();
      packet.fire = BALANCE.ENVIRONMENT.BARREL_EXPLOSION_DMG;
      explosion.damagePacket = packet;
      explosion.color = '#f87171';
      explosion.state = 'ATTACK';
      explosion.timer = 5;
      explosion.status.stun = BALANCE.ENVIRONMENT.BARREL_EXPLOSION_STUN;
      this.world.entities.push(explosion);
      
      this.sound.play('EXPLOSION');
    } 
    this.loot.processDestructibleRewards(e);
  }
}
