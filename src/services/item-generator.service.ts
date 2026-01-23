
import { Injectable, inject } from '@angular/core';
import { Item, ItemType, Rarity, ItemShape } from '../models/item.models';
import { ItemAffixService } from './item-affix.service';
import { IdGeneratorService } from '../utils/id-generator.service';
import * as LOOT from '../config/loot.config';
import {
  DamagePacket,
  Penetration,
  DamageConversion,
  createEmptyDamagePacket
} from '../models/damage.model';

export interface LootContext {
  level: number;
  difficulty?: number;
  rarityBias?: number;
  forceType?: ItemType;
  source?: 'ENEMY' | 'CRATE' | 'BOSS';
  luck?: number;
  weaponType?: string; 
}

@Injectable({
  providedIn: 'root'
})
export class ItemGeneratorService {
  private affixService = inject(ItemAffixService);
  private idGenerator = inject(IdGeneratorService);

  generateLoot(context: LootContext): Item {
    const level = Math.max(1, context.level);
    const difficulty = context.difficulty || 1.0;
    const rarityBias = context.rarityBias || 0;
    const rarity = this.rollRarity(level, rarityBias, context.source);
    const rarityTier = this.getRarityTier(rarity);
    const type = context.forceType || this.rollType();
    
    // Weapon Shape Logic: Now includes Guns
    let shape = this.getShapeForType(type);
    
    // Randomize Weapon Shape (Melee vs Ranged)
    if (type === 'WEAPON') {
        const roll = Math.random();
        if (roll < 0.4) shape = 'pistol';
        else if (roll < 0.6) shape = 'shotgun';
        else if (roll < 0.8) shape = 'rifle';
        else shape = 'sword'; // Fallback / Classic
    }

    const baseStats = { ...LOOT.BASE_STATS[type] };
    const stats: { [key: string]: number } = {};
    const scale = level * difficulty * (1 + rarityTier * 0.5);

    // Base Stat Generation
    for (const key in baseStats) {
      const variance = 0.8 + Math.random() * 0.4;
      stats[key] = Math.floor(baseStats[key] * (1 + (scale * 0.15)) * variance);
    }

    // Weapon Specifics
    let damagePacket: DamagePacket | undefined;
    let penetration: Penetration | undefined;
    let damageConversion: DamageConversion | undefined;
    let projectileConfig: Item['projectile'] | undefined;

    if (type === 'WEAPON') {
        damagePacket = this.generateWeaponDamage(level, context.weaponType, rarity);
        penetration = this.rollPenetration(rarity);
        damageConversion = this.rollConversion(rarity);
        
        // Projectile Config based on Shape
        if (['pistol', 'rifle', 'shotgun', 'railgun'].includes(shape)) {
            projectileConfig = this.generateProjectileConfig(shape, level);
            // Adjust stats for ranged
            stats['reach'] = projectileConfig.range; // UI mapping
            // Ranged weapons might have different speed scaling
            if (shape === 'pistol') stats['spd'] = 2.0;
            if (shape === 'shotgun') stats['spd'] = 0.8;
            if (shape === 'rifle') stats['spd'] = 1.5;
        }

        // Legacy stat for UI compat
        stats['dmg'] = damagePacket.physical + damagePacket.fire + damagePacket.cold + damagePacket.lightning + damagePacket.chaos;
    }

    // Naming
    const baseNames: { [key: string]: string } = {
        'WEAPON': 'Baton', 'ARMOR': 'Rig', 'IMPLANT': 'Chip', 'STIM': 'Injector', 'PSI_BLADE': 'Cutter', 'AMULET': 'Talisman', 'RING': 'Band'
    };
    let coreName = baseNames[type];
    
    // Override Name for Guns
    if (shape === 'pistol') coreName = 'Handcannon';
    if (shape === 'rifle') coreName = 'Carbine';
    if (shape === 'shotgun') coreName = 'Scattergun';

    const affixSlots = rarityTier === 0 ? 0 : (rarityTier === 1 ? 1 : 2);
    let prefix = null;
    let suffix = null;

    if (affixSlots > 0) {
      if (Math.random() > 0.3 || rarityTier >= 2) {
         prefix = this.affixService.getValidAffix('PREFIX', type, rarityTier + 1);
         if (prefix) this.affixService.applyAffix(stats, prefix, level);
      }
      if ((affixSlots >= 2) || (!prefix && affixSlots >= 1)) {
          suffix = this.affixService.getValidAffix('SUFFIX', type, rarityTier + 1);
          if (suffix) this.affixService.applyAffix(stats, suffix, level);
      }
    }

    const name = `${prefix ? prefix.name + ' ' : ''}${coreName}${suffix ? ' ' + suffix.name : ''}`;
    let stack = 1;
    let maxStack = 1;
    if (type === 'STIM') {
        maxStack = 5;
        stack = 1 + Math.floor(Math.random() * 2);
        if (Object.keys(stats).length === 0) {
            if (Math.random() > 0.5) stats['hp'] = Math.floor(20 * scale);
            else stats['speed'] = 0.2;
        }
    }

    const item: Item = {
      id: this.idGenerator.generateStringId(),
      name, type, rarity, level: Math.floor(level),
      stats, color: this.getRarityColor(rarity),
      shape: shape as ItemShape, stack, maxStack,
      damagePacket, penetration, damageConversion, projectile: projectileConfig
    };

    return item;
  }

  generateTestWeapon(archetype: string): Item {
      const level = 5;
      const stats: any = { dmg: 0, crit: 5 };
      const packet = createEmptyDamagePacket();
      let name = 'Test Weapon';
      let color = '#fff';
      let shape: ItemShape = 'rifle';
      let projectile: Item['projectile'] | undefined;

      switch(archetype) {
          case 'PLASMA':
              name = 'Sim-Plasma Rifle';
              packet.fire = 30; stats.dmg = 30; color = '#f97316';
              projectile = { speed: 12, count: 1, spread: 0, range: 60, renderType: 'PLASMA' };
              stats.spd = 1.5;
              break;
          case 'CRYO':
              name = 'Sim-Cryo Emitter';
              packet.cold = 30; stats.dmg = 30; color = '#3b82f6';
              projectile = { speed: 15, count: 1, spread: 0, range: 60, renderType: 'BULLET' };
              stats.spd = 2.0;
              break;
          case 'VOID':
              name = 'Sim-Void Blade';
              shape = 'psiBlade'; // Melee test
              packet.chaos = 35; stats.dmg = 35; color = '#a855f7';
              break;
          case 'KINETIC':
          default:
              name = 'Sim-Kinetic Driver';
              packet.physical = 30; stats.dmg = 30; stats.armorPen = 20; color = '#a1a1aa';
              projectile = { speed: 25, count: 1, spread: 0.05, range: 80, renderType: 'BULLET' };
              stats.spd = 2.5;
              break;
      }

      return {
          id: `TEST_${Date.now()}`,
          name, type: 'WEAPON', shape, rarity: 'RARE', level, stats, color, stack: 1, maxStack: 1,
          damagePacket: packet, projectile
      };
  }

  private generateProjectileConfig(shape: string, level: number): Item['projectile'] {
      switch(shape) {
          case 'shotgun': return { speed: 20, count: 5, spread: 0.4, range: 30, renderType: 'BULLET' }; // High spread, low range
          case 'pistol': return { speed: 22, count: 1, spread: 0.05, range: 60, renderType: 'BULLET' };
          case 'rifle': return { speed: 25, count: 1, spread: 0.02, range: 80, renderType: 'BULLET' };
          case 'railgun': return { speed: 40, count: 1, spread: 0, range: 120, renderType: 'RAIL' };
          default: return { speed: 15, count: 1, spread: 0, range: 50, renderType: 'BULLET' };
      }
  }

  private rollRarity(level: number, bias: number, source?: string): Rarity {
    let weights = { ...LOOT.RARITY_WEIGHTS };
    const effectiveBias = bias + (source === 'BOSS' ? 0.5 : 0);
    weights.COMMON = Math.max(0, weights.COMMON - (effectiveBias * 40));
    weights.UNCOMMON += (effectiveBias * 20);
    weights.RARE += (effectiveBias * 15);
    weights.BLACK_MARKET += (effectiveBias * 5);
    if (level > 10) { weights.RARE *= 1.2; weights.BLACK_MARKET *= 1.2; }
    const total = weights.COMMON + weights.UNCOMMON + weights.RARE + weights.BLACK_MARKET;
    const roll = Math.random() * total;
    if (roll < weights.COMMON) return 'COMMON';
    if (roll < weights.COMMON + weights.UNCOMMON) return 'UNCOMMON';
    if (roll < weights.COMMON + weights.UNCOMMON + weights.RARE) return 'RARE';
    return 'BLACK_MARKET';
  }

  private rollType(): ItemType {
    const types = Object.keys(LOOT.TYPE_WEIGHTS) as ItemType[];
    const totalWeight = types.reduce((sum, t) => sum + LOOT.TYPE_WEIGHTS[t], 0);
    let roll = Math.random() * totalWeight;
    for (const t of types) {
      if (roll < LOOT.TYPE_WEIGHTS[t]) return t;
      roll -= LOOT.TYPE_WEIGHTS[t];
    }
    return 'WEAPON';
  }

  private getRarityTier(rarity: Rarity): number {
    switch (rarity) { case 'COMMON': return 0; case 'UNCOMMON': return 1; case 'RARE': return 2; case 'BLACK_MARKET': return 3; default: return 0; }
  }

  private getRarityColor(rarity: Rarity): string {
    switch (rarity) { case 'COMMON': return '#a1a1aa'; case 'UNCOMMON': return '#22c55e'; case 'RARE': return '#3b82f6'; case 'BLACK_MARKET': return '#f97316'; default: return '#fff'; }
  }

  private getShapeForType(type: ItemType): ItemShape {
      const map: { [key in ItemType]: ItemShape } = { 'WEAPON': 'sword', 'ARMOR': 'shield', 'IMPLANT': 'chip', 'STIM': 'syringe', 'PSI_BLADE': 'psiBlade', 'AMULET': 'amulet', 'RING': 'ring' };
      return map[type];
  }

  private generateWeaponDamage(level: number, weaponType?: string, rarity?: string): DamagePacket {
    const baseDamage = 5 + (level * 3) + (level * level * 0.2);
    const packet = createEmptyDamagePacket();
    
    const isEnergy = weaponType === 'PLASMA_RIFLE' || weaponType === 'VOID_RIFLE';
    // If we passed weaponType, respect it. Otherwise random distribution.
    
    if (isEnergy) {
        packet.fire = Math.floor(baseDamage * 0.8);
        packet.physical = Math.floor(baseDamage * 0.2);
    } else {
        packet.physical = Math.floor(baseDamage);
    }

    const rarityMult = this.getRarityMultiplier(rarity);
    packet.physical = Math.floor(packet.physical * rarityMult);
    packet.fire = Math.floor(packet.fire * rarityMult);
    packet.cold = Math.floor(packet.cold * rarityMult);
    packet.lightning = Math.floor(packet.lightning * rarityMult);
    packet.chaos = Math.floor(packet.chaos * rarityMult);

    return packet;
  }

  private rollPenetration(rarity?: string): Penetration | undefined {
    const chance = rarity === 'BLACK_MARKET' ? 0.5 : rarity === 'RARE' ? 0.2 : 0;
    if (Math.random() < chance) {
      const penValue = 0.1 + (Math.random() * 0.2); 
      return { physical: Math.random() < 0.5 ? penValue : 0, fire: 0, cold: 0, lightning: 0, chaos: 0 };
    }
    return undefined;
  }

  private rollConversion(rarity?: string): DamageConversion | undefined {
    if (rarity !== 'BLACK_MARKET') return undefined;
    if (Math.random() > 0.3) return undefined;
    const conversions: DamageConversion[] = [ { physicalToFire: 0.5 }, { physicalToCold: 0.5 } ];
    return conversions[Math.floor(Math.random() * conversions.length)];
  }

  private getRarityMultiplier(rarity?: string): number {
    switch (rarity) { case 'BLACK_MARKET': return 2.0; case 'RARE': return 1.5; case 'UNCOMMON': return 1.2; default: return 1.0; }
  }
}
