import { Injectable, inject } from '@angular/core';
import { Item, ItemType, Rarity, ItemShape } from '../models/item.models';
import { ItemAffixService } from './item-affix.service';
import { IdGeneratorService } from '../utils/id-generator.service';
import * as LOOT from '../config/loot.config';

export interface LootContext {
  level: number;
  difficulty?: number;
  rarityBias?: number;
  forceType?: ItemType;
  source?: 'ENEMY' | 'CRATE' | 'BOSS';
  luck?: number;
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
    const shape = this.getShapeForType(type);
    const baseStats = { ...LOOT.BASE_STATS[type] };
    const stats: { [key: string]: number } = {};
    const scale = level * difficulty * (1 + rarityTier * 0.5);

    for (const key in baseStats) {
      const variance = 0.8 + Math.random() * 0.4;
      stats[key] = Math.floor(baseStats[key] * (1 + (scale * 0.15)) * variance);
    }

    const baseNames: { [key in ItemType]: string } = {
        'WEAPON': 'Baton', 'ARMOR': 'Rig', 'IMPLANT': 'Chip', 'STIM': 'Injector', 'PSI_BLADE': 'Cutter', 'AMULET': 'Talisman', 'RING': 'Band'
    };
    let coreName = baseNames[type];
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

    return {
      id: this.idGenerator.generateStringId(),
      name, type, rarity, level: Math.floor(level),
      stats, color: this.getRarityColor(rarity),
      shape, stack, maxStack
    };
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
}