import { Injectable } from '@angular/core';
import { ItemType } from '../models/item.models';

export interface AffixDefinition {
  name: string;
  type: 'PREFIX' | 'SUFFIX';
  tier: number;
  modifiers: { stat: string; min: number; max: number; isPercentage?: boolean }[];
  allowedTypes: ItemType[] | 'ALL';
  excludedTypes?: ItemType[];
}

@Injectable({
  providedIn: 'root'
})
export class ItemAffixService {
  
  private prefixes: AffixDefinition[] = [
    { name: "Rusty", type: 'PREFIX', tier: 1, modifiers: [{ stat: 'dmg', min: -2, max: 0 }, { stat: 'speed', min: -0.05, max: 0 }], allowedTypes: 'ALL' },
    { name: "Standard", type: 'PREFIX', tier: 1, modifiers: [{ stat: 'hp', min: 5, max: 10 }], allowedTypes: ['ARMOR'] },
    { name: "Serrated", type: 'PREFIX', tier: 1, modifiers: [{ stat: 'dmg', min: 2, max: 5 }], allowedTypes: ['WEAPON', 'PSI_BLADE'] },
    
    { name: "Reinforced", type: 'PREFIX', tier: 2, modifiers: [{ stat: 'hp', min: 20, max: 40 }, { stat: 'armorPen', min: 2, max: 5 }], allowedTypes: ['ARMOR'] },
    { name: "Polymer", type: 'PREFIX', tier: 2, modifiers: [{ stat: 'speed', min: 0.05, max: 0.1 }], allowedTypes: ['ARMOR', 'IMPLANT'] },
    { name: "Charged", type: 'PREFIX', tier: 2, modifiers: [{ stat: 'dmg', min: 5, max: 10 }], allowedTypes: ['WEAPON', 'PSI_BLADE'] },
    { name: "Focused", type: 'PREFIX', tier: 2, modifiers: [{ stat: 'cdr', min: 5, max: 10 }], allowedTypes: ['IMPLANT', 'PSI_BLADE'] },

    { name: "Nanite-Infused", type: 'PREFIX', tier: 3, modifiers: [{ stat: 'hp', min: 50, max: 80 }, { stat: 'ls', min: 1, max: 3 }], allowedTypes: ['ARMOR', 'IMPLANT'] },
    { name: "Void-Forged", type: 'PREFIX', tier: 3, modifiers: [{ stat: 'dmg', min: 12, max: 20 }, { stat: 'psy', min: 10, max: 20 }], allowedTypes: ['WEAPON', 'PSI_BLADE'] },
    { name: "Hyper-Threaded", type: 'PREFIX', tier: 3, modifiers: [{ stat: 'speed', min: 0.15, max: 0.25 }, { stat: 'cdr', min: 10, max: 15 }], allowedTypes: ['IMPLANT'] },

    { name: "Ascended", type: 'PREFIX', tier: 4, modifiers: [{ stat: 'dmg', min: 25, max: 40 }, { stat: 'psy', min: 30, max: 50 }], allowedTypes: 'ALL' },
    { name: "Prototype", type: 'PREFIX', tier: 4, modifiers: [{ stat: 'crit', min: 10, max: 20 }, { stat: 'armorPen', min: 15, max: 25 }], allowedTypes: ['WEAPON'] }
  ];

  private suffixes: AffixDefinition[] = [
    { name: "of the Rat", type: 'SUFFIX', tier: 1, modifiers: [{ stat: 'speed', min: 0.02, max: 0.05 }], allowedTypes: 'ALL' },
    { name: "of Lead", type: 'SUFFIX', tier: 1, modifiers: [{ stat: 'armorPen', min: 1, max: 3 }], allowedTypes: ['WEAPON'] },

    { name: "of the Bear", type: 'SUFFIX', tier: 2, modifiers: [{ stat: 'hp', min: 30, max: 50 }], allowedTypes: ['ARMOR', 'IMPLANT'] },
    { name: "of Agility", type: 'SUFFIX', tier: 2, modifiers: [{ stat: 'speed', min: 0.1, max: 0.15 }, { stat: 'cdr', min: 3, max: 6 }], allowedTypes: 'ALL' },
    { name: "of Leeching", type: 'SUFFIX', tier: 2, modifiers: [{ stat: 'ls', min: 2, max: 4 }], allowedTypes: ['WEAPON', 'IMPLANT'] },

    { name: "of Destruction", type: 'SUFFIX', tier: 3, modifiers: [{ stat: 'crit', min: 5, max: 10 }, { stat: 'dmg', min: 10, max: 15 }], allowedTypes: ['WEAPON'] },
    { name: "of the Guardian", type: 'SUFFIX', tier: 3, modifiers: [{ stat: 'hp', min: 80, max: 120 }, { stat: 'armorPen', min: 5, max: 10 }], allowedTypes: ['ARMOR'] },
    { name: "of the Mind", type: 'SUFFIX', tier: 3, modifiers: [{ stat: 'psy', min: 15, max: 25 }, { stat: 'cdr', min: 10, max: 15 }], allowedTypes: ['IMPLANT', 'PSI_BLADE'] },

    { name: "of Total Control", type: 'SUFFIX', tier: 4, modifiers: [{ stat: 'psy', min: 40, max: 60 }, { stat: 'crit', min: 15, max: 25 }], allowedTypes: 'ALL' },
    { name: "of the Omega", type: 'SUFFIX', tier: 4, modifiers: [{ stat: 'dmg', min: 30, max: 50 }, { stat: 'ls', min: 5, max: 10 }], allowedTypes: ['WEAPON'] }
  ];

  getValidAffix(type: 'PREFIX' | 'SUFFIX', itemType: ItemType, targetTier: number): AffixDefinition | null {
    const pool = type === 'PREFIX' ? this.prefixes : this.suffixes;
    const valid = pool.filter(affix => {
      if (affix.allowedTypes !== 'ALL' && !affix.allowedTypes.includes(itemType)) return false;
      if (affix.excludedTypes && affix.excludedTypes.includes(itemType)) return false;
      return affix.tier <= targetTier && affix.tier >= Math.max(1, targetTier - 1);
    });
    if (valid.length === 0) return null;
    return valid[Math.floor(Math.random() * valid.length)];
  }

  applyAffix(stats: { [key: string]: number }, affix: AffixDefinition, levelScale: number) {
    affix.modifiers.forEach(mod => {
      let val = mod.min + Math.random() * (mod.max - mod.min);
      if (!mod.isPercentage) val *= (1 + (levelScale * 0.15));
      const statKey = mod.stat;
      if (!stats[statKey]) stats[statKey] = 0;
      stats[statKey] += val;
      if (statKey === 'speed' || statKey === 'ls' || statKey === 'crit') stats[statKey] = Math.round(stats[statKey] * 100) / 100;
      else stats[statKey] = Math.floor(stats[statKey]);
    });
  }
}