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

    // ✅ EXTENSIVE LOGGING
    console.log('💥 Combat Hit Detected:', {
      hitbox: {
        type: hitbox.type,
        source: hitbox.source,
        hasDamagePacket: !!hitbox.damagePacket,
        damagePacket: hitbox.damagePacket,
        position: { x: hitbox.x, y: hitbox.y }
      },
      target: {
        type: target.type,
        subType: target.subType,
        hp: target.hp,
        maxHp: target.maxHp,
        resistances: target.resistances,
        position: { x: target.x, y: target.y }
      }
    });

    // Get damage packet from hitbox or generate fallback
    const damagePacket = hitbox.damagePacket ?? this.createFallbackDamagePacket(hitbox);
    
    console.log('📦 Damage Packet Used:', damagePacket);

    const result = this.calculateMitigatedDamage(hitbox, target, damagePacket);
    
    console.log('🎯 Damage Result:', {
      total: result.total,
      breakdown: result.breakdown,
      isCrit: result.isCrit
    });

    if (result.total === 0) {
      console.error('❌ ZERO DAMAGE DETECTED - Debugging:');
      console.error('   Packet:', damagePacket);
      console.error('   Target Resistances:', target.resistances);
      console.error('   Calculation breakdown:', result.breakdown);
    }
    
    this.applyCombatResult(hitbox, target, result);
  }

  /**
   * Entry point for Direct Melee attacks (Collision).
   */
  public applyDirectDamage(
    attacker: Entity,
    target: Entity,
    baseDamage: number
  ): void {
    if (target.hitFlash > 0 || target.isHitStunned || target.invulnerable) {
      return;
    }

    // Convert single damage value to pure physical packet
    const damagePacket = createEmptyDamagePacket();
    damagePacket.physical = baseDamage;

    const result = this.calculateMitigatedDamage(attacker, target, damagePacket);
    this.applyCombatResult(attacker, target, result);
  }

  /**
   * Creates fallback damage packet for entities without damagePacket.
   */
  private createFallbackDamagePacket(hitbox: Entity): DamagePacket {
    const packet = createEmptyDamagePacket();
    
    // Check for legacy damageValue first
    if (hitbox.damageValue !== undefined) {
      // Temporary migration hack: color mapping for legacy hitboxes
      if (hitbox.color === '#ef4444') packet.fire = hitbox.damageValue;
      else if (hitbox.color === '#3b82f6') packet.cold = hitbox.damageValue;
      else if (hitbox.color === '#eab308') packet.lightning = hitbox.damageValue;
      else if (hitbox.color === '#a855f7') packet.chaos = hitbox.damageValue;
      else packet.physical = hitbox.damageValue;
      return packet;
    }
    
    // Calculate from source
    if (hitbox.source === 'PLAYER' || hitbox.source === 'PSIONIC') {
      // ✅ FIX: Use damagePacket from playerStats
      const stats = this.stats.playerStats();
      
      if (stats.damagePacket) {
        return { ...stats.damagePacket }; // Clone to avoid mutation
      }
      
      // Fallback: Legacy damage property
      if (stats.damage !== undefined) {
        packet.physical = stats.damage;
      } else {
        packet.physical = 10; // Ultimate fallback
      }
    } else {
      // Enemy/environment default
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

    // Physical conversions
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
      physical: targetResistances.physical, // Armor calculation handles pen separately
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
    // Diminishing returns: Armor / (Armor + 10 * Damage)
    const reduction = armor / (armor + 10 * physicalDamage);
    return Math.min(0.90, reduction);
  }

  private calculateMitigatedDamage(
    source: Entity,
    target: Entity,
    incomingDamage: DamagePacket
  ): DamageResult {
    let damagePacket = { ...incomingDamage };

    // 1. Critical Strike (multiplicative to all types)
    const isCrit = this.rollCritical(source);
    if (isCrit) {
      damagePacket.physical *= BALANCE.COMBAT.CRIT_MULTIPLIER;
      damagePacket.fire *= BALANCE.COMBAT.CRIT_MULTIPLIER;
      damagePacket.cold *= BALANCE.COMBAT.CRIT_MULTIPLIER;
      damagePacket.lightning *= BALANCE.COMBAT.CRIT_MULTIPLIER;
      damagePacket.chaos *= BALANCE.COMBAT.CRIT_MULTIPLIER;
    }

    // 2. Damage Conversion
    damagePacket = this.applyDamageConversion(damagePacket, source.damageConversion);

    // 3. Weakness Amplification
    if (target.status.weakness) {
      const amp = 1 + target.status.weakness.damageReduction;
      damagePacket.physical *= amp;
      damagePacket.fire *= amp;
      damagePacket.cold *= amp;
      damagePacket.lightning *= amp;
      damagePacket.chaos *= amp;
    }

    // 4. Get penetration
    const penetration = source.penetration ?? createZeroPenetration();
    // Default armor pen for player from stats if not set on source entity
    if ((source.source === 'PLAYER' || source.source === 'PSIONIC') && !source.penetration) {
        const pStats = this.stats.playerStats();
        if (pStats.penetration) {
            penetration.physical += pStats.penetration.physical;
            penetration.fire += pStats.penetration.fire;
            // ... merge others if needed, typically physical is main one stored in stats.penetration
        } else {
            penetration.physical = pStats.armorPen;
        }
    } else if (source.armorPen) {
        penetration.physical = source.armorPen;
    }

    // 5. Target Resistances (Fallback if missing)
    const targetResistances = target.resistances ?? createDefaultResistances();
    // Use legacy armor if physical resist is 0
    if (targetResistances.physical === 0 && target.armor > 0) targetResistances.physical = target.armor;

    // 6. Apply penetration to elemental resistances
    const effectiveResistances = this.applyPenetration(targetResistances, penetration);

    // 7. Calculate physical mitigation (Armor based)
    // Reduce armor by penetration amount first (Flat reduction for armor usually)
    const effectiveArmor = Math.max(0, targetResistances.physical - penetration.physical * 100); 
    
    // We reduce effective armor by penetration % of current armor
    const armorMitigationVal = targetResistances.physical * (1 - penetration.physical);
    
    const physicalMitigation = this.calculatePhysicalMitigation(
      damagePacket.physical,
      armorMitigationVal
    );

    // 8. Apply per-type mitigation
    const mitigatedDamage: DamagePacket = {
      physical: damagePacket.physical * (1 - physicalMitigation),
      fire: damagePacket.fire * (1 - Math.min(RESISTANCE_CAPS.fire, effectiveResistances.fire)),
      cold: damagePacket.cold * (1 - Math.min(RESISTANCE_CAPS.cold, effectiveResistances.cold)),
      lightning: damagePacket.lightning * (1 - Math.min(RESISTANCE_CAPS.lightning, effectiveResistances.lightning)),
      chaos: damagePacket.chaos * (1 - Math.min(RESISTANCE_CAPS.chaos, effectiveResistances.chaos))
    };

    const total = calculateTotalDamage(mitigatedDamage);
    const finalTotal = total > 0 ? Math.max(1, total) : 0;

    return {
      total: finalTotal,
      breakdown: mitigatedDamage,
      isCrit,
      penetratedResistances: effectiveResistances
    };
  }

  private applyCombatResult(
    source: Entity,
    target: Entity,
    result: DamageResult
  ): void {
    const { total, breakdown, isCrit } = result;

    this.feedback.onHitConfirmed(target, total, isCrit, breakdown);

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
      isCrit || total > 50
        ? BALANCE.ENEMY_AI.HIT_STOP_FRAMES_HEAVY
        : BALANCE.ENEMY_AI.HIT_STOP_FRAMES_LIGHT;
    target.isHitStunned = true;

    // Knockback
    const knockback = source.knockbackForce ?? BALANCE.COMBAT.KNOCKBACK_FORCE;
    this.applyKnockback(source, target, knockback);

    // Status effects
    this.applyStatusEffects(source, target);

    // Lifesteal
    this.applyLifeSteal(source, total);

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
  
      // Legacy resistance check via statusResistances, fallback to 1.0 (no resist)
      // New system could use explicit resistances if we map them
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
      
      // Explosion now deals Fire damage logic internally via packet
      const packet = createEmptyDamagePacket();
      packet.fire = BALANCE.ENVIRONMENT.BARREL_EXPLOSION_DMG;
      explosion.damagePacket = packet;
      
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