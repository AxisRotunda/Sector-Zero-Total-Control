
import { Injectable, inject } from '@angular/core';
import { Entity } from '../models/game.models';
import { ObjectPool } from '../utils/object-pool';
import { IdGeneratorService } from '../utils/id-generator.service';
import { NpcVisualGeneratorService } from './npc-visual-generator.service';
import { DamagePacket, Resistances, createEmptyDamagePacket } from '../models/damage.model';
import * as BALANCE from '../config/balance.config';

const baseEntity: Omit<Entity, 'id' | 'type' | 'x' | 'y'> = {
    z: 0, vx: 0, vy: 0, angle: 0, radius: 20, hp: 1, maxHp: 1, armor: 0,
    color: '#fff', state: 'IDLE', animFrame: 0, animFrameTimer: 0, timer: 0, speed: 0, hitFlash: 0, xpValue: 0,
    status: { stun: 0, slow: 0, poison: null, burn: null, weakness: null, bleed: null },
    hitStopFrames: 0, isHitStunned: false, invulnerable: false
};

@Injectable({
  providedIn: 'root'
})
export class EntityPoolService {
  private idGenerator = inject(IdGeneratorService);
  private visualGenerator = inject(NpcVisualGeneratorService);
  private pools = new Map<string, ObjectPool<Entity>>();

  private getPool(type: Entity['type'], subType?: Entity['subType']): ObjectPool<Entity> {
    const key = subType ? `${type}_${subType}` : type;
    if (!this.pools.has(key)) {
      this.pools.set(key, new ObjectPool<Entity>(
        () => ({ ...baseEntity, id: -1, type, subType, x: 0, y: 0, status: { ...baseEntity.status } }),
        (e) => {
          const originalType = e.type;
          const originalSubType = e.subType;
          Object.assign(e, baseEntity);
          e.id = -1;
          e.type = originalType;
          e.subType = originalSubType;
          e.x = 0;
          e.y = 0;
          e.status = { ...baseEntity.status };
          e.trail = undefined;
          e.itemData = undefined;
          e.psionicEffect = undefined;
          e.animPhase = undefined;
          e.knockbackForce = undefined;
          e.attackTimer = undefined;
          e.width = undefined;
          e.height = undefined;
          e.source = undefined;
          e.rotation = undefined;
          e.text = undefined;
          e.name = undefined;
          e.hitStopFrames = 0;
          e.isHitStunned = false;
          e.invulnerable = false; // Reset iframes
          e.resistances = undefined;
          e.damagePacket = undefined;
          e.penetration = undefined;
          e.damageConversion = undefined;
          e.equipment = undefined;
          e.squadId = undefined;
          e.aiRole = undefined;
          e.zoneId = undefined; 
          e.persistenceTag = undefined; // Reset Tag
          e.data = undefined; // CRITICAL: Clear custom data bag
          e.visuals = undefined; // Clear visuals to be regenerated
          e.level = undefined;
          if (e.hitIds) e.hitIds.clear(); // Reset Hit Memory
        },
        100 
      ));
    }
    return this.pools.get(key)!;
  }

  acquire(type: Entity['type'], subType?: Entity['subType'], inheritZoneId?: string): Entity {
    const entity = this.getPool(type, subType).acquire();
    entity.id = this.idGenerator.generateNumericId();
    if (inheritZoneId) entity.zoneId = inheritZoneId;
    
    // Apply new damage system if enemy type
    if (type === 'ENEMY' && subType) {
      this.applyDamageTypeConfig(entity, subType);
    }

    // Generate new visuals for Units (NPCs, Enemies, Player)
    if (type === 'NPC' || type === 'ENEMY' || type === 'PLAYER') {
        // Basic Faction Guess (Can be overwritten by Spawner later)
        let factionId = undefined;
        if (subType === 'SNIPER' || subType === 'HEAVY') factionId = 'VANGUARD';
        if (subType === 'STALKER' || subType === 'MEDIC') factionId = 'REMNANT';
        if (subType === 'STEALTH') factionId = 'RESONANT';
        
        entity.visuals = this.visualGenerator.generate(type, subType, factionId);
    }

    return entity;
  }

  release(entity: Entity): void {
    if (entity.type !== 'WALL' && entity.type !== 'PLAYER') {
        this.getPool(entity.type, entity.subType).release(entity);
    }
  }

  /**
   * Configures entity damage packet and resistances based on enemy archetype.
   */
  private applyDamageTypeConfig(entity: Entity, subType: string): void {
    // Determine enemy tier from subType
    const tier = this.getEnemyTier(subType);
    
    // Apply damage packet
    const typeKey = subType as keyof typeof BALANCE.DAMAGE_TYPES.ENEMY_TYPES;
    if (BALANCE.DAMAGE_TYPES.ENEMY_TYPES[typeKey]) {
      entity.damagePacket = this.createDamagePacketFromConfig(
        BALANCE.DAMAGE_TYPES.ENEMY_TYPES[typeKey],
        entity.level || 1
      );
    } else {
      // Fallback: use tier-based defaults
      const tierKey = tier as keyof typeof BALANCE.DAMAGE_TYPES.ENEMY_TYPES;
      entity.damagePacket = this.createDamagePacketFromConfig(
        BALANCE.DAMAGE_TYPES.ENEMY_TYPES[tierKey],
        entity.level || 1
      );
    }

    // Apply resistances
    entity.resistances = this.createResistancesFromConfig(tier);

    // Deprecate legacy properties
    entity.damageValue = undefined;
    entity.armor = 0;
  }

  /**
   * Determines enemy tier from subType.
   */
  private getEnemyTier(subType: string): 'MELEE' | 'RANGED' | 'ELITE' | 'BOSS' {
    if (subType === 'BOSS' || subType.includes('BOSS')) return 'BOSS';
    if (subType.includes('ELITE') || subType.includes('CAPTAIN')) return 'ELITE';
    if (
      subType.includes('RANGED') || 
      subType.includes('ARCHER') || 
      subType.includes('GUNNER') || 
      subType === 'SNIPER'
    ) return 'RANGED';
    return 'MELEE';
  }

  /**
   * Creates damage packet from balance config, scaled by level.
   */
  private createDamagePacketFromConfig(
    typeConfig: { readonly physical: number; readonly fire: number; readonly cold: number; readonly lightning: number; readonly chaos: number },
    level: number
  ): DamagePacket {
    const baseDamage = this.calculateBaseDamage(level);

    return {
      physical: Math.floor(baseDamage * typeConfig.physical),
      fire: Math.floor(baseDamage * typeConfig.fire),
      cold: Math.floor(baseDamage * typeConfig.cold),
      lightning: Math.floor(baseDamage * typeConfig.lightning),
      chaos: Math.floor(baseDamage * typeConfig.chaos)
    };
  }

  /**
   * Calculates base damage scaled by level.
   */
  private calculateBaseDamage(level: number): number {
    const { BASE_DAMAGE, PER_LEVEL, QUADRATIC_FACTOR } = BALANCE.DAMAGE_TYPES.LEVEL_SCALING;
    return Math.floor(
      BASE_DAMAGE + 
      (level * PER_LEVEL) + 
      (level * level * QUADRATIC_FACTOR)
    );
  }

  /**
   * Creates resistance packet from balance config.
   */
  private createResistancesFromConfig(
    tier: 'MELEE' | 'RANGED' | 'ELITE' | 'BOSS'
  ): Resistances {
    const resistKey = (tier === 'MELEE' || tier === 'RANGED') ? 'TRASH' : tier;
    const config = BALANCE.DAMAGE_TYPES.RESISTANCES[resistKey];

    return {
      physical: config.physical,
      fire: config.fire,
      cold: config.cold,
      lightning: config.lightning,
      chaos: config.chaos
    };
  }
}
