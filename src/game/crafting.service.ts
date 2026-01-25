
import { Injectable, inject } from '@angular/core';
import { PlayerProgressionService } from './player/player-progression.service';
import { Item } from '../models/item.models';
import { SoundService } from '../services/sound.service';
import { ItemGeneratorService } from '../services/item-generator.service';
import { EventBusService } from '../core/events/event-bus.service';
import { GameEvents } from '../core/events/game-events';
import { InventoryService } from './inventory.service';

export interface AugmentDef {
    label: string;
    stat: string;
    value: number;
    cost: number;
    validTypes?: string[]; // If undefined, valid for all
}

@Injectable({
  providedIn: 'root'
})
export class CraftingService {
  private progression = inject(PlayerProgressionService);
  private sound = inject(SoundService);
  private itemGen = inject(ItemGeneratorService);
  private eventBus = inject(EventBusService);
  private inventory = inject(InventoryService);

  private readonly REROLL_COST = 50;
  private readonly UPGRADE_COST = 100;
  private readonly MAX_STATS = 6;

  // Augment Database
  readonly AUGMENTS: AugmentDef[] = [
      { label: 'Reinforce Plating', stat: 'hp', value: 40, cost: 150 },
      { label: 'Hone Edge', stat: 'dmg', value: 3, cost: 200, validTypes: ['WEAPON', 'PSI_BLADE', 'RING'] },
      { label: 'Synaptic Threading', stat: 'psy', value: 8, cost: 150 },
      { label: 'Critical Wiring', stat: 'crit', value: 3, cost: 150 },
      { label: 'Servo Assist', stat: 'spd', value: 0.05, cost: 150 },
      { label: 'Vampiric Coil', stat: 'ls', value: 2, cost: 250, validTypes: ['WEAPON', 'IMPLANT'] },
      { label: 'Psi-Cycle Overclock', stat: 'cdr', value: 4, cost: 150, validTypes: ['IMPLANT', 'AMULET', 'PSI_BLADE'] },
      { label: 'Tungsten Core', stat: 'armorPen', value: 5, cost: 150, validTypes: ['WEAPON'] }
  ];

  canReroll(item: Item): boolean {
      return this.progression.scrap() >= this.REROLL_COST;
  }

  canUpgrade(item: Item): boolean {
      return this.progression.scrap() >= this.UPGRADE_COST;
  }

  getValidAugments(item: Item): AugmentDef[] {
      // Filter by:
      // 1. Stat doesn't exist on item yet
      // 2. Item Type is valid for augment
      return this.AUGMENTS.filter(aug => {
          if (item.stats[aug.stat] !== undefined) return false;
          if (aug.validTypes && !aug.validTypes.includes(item.type)) return false;
          return true;
      });
  }

  canAugment(item: Item, augment: AugmentDef): boolean {
      const statCount = Object.keys(item.stats).length;
      return statCount < this.MAX_STATS && this.progression.scrap() >= augment.cost;
  }

  rerollItem(item: Item): boolean {
      if (!this.canReroll(item)) {
          this.sound.play('UI'); // Error
          return false;
      }

      this.progression.gainScrap(-this.REROLL_COST);
      
      // Generate a new item of the same type and level to replace stats
      const newItem = this.itemGen.generateLoot({
          level: item.level,
          rarityBias: 0, // Neutral bias
          forceType: item.type
      });

      // Immutable Update
      const updatedItem: Item = {
          ...item,
          stats: newItem.stats,
          name: newItem.name
      };
      
      this.updateInventoryWith(updatedItem);
      
      this.sound.play('CRAFT');
      this.eventBus.dispatch({ type: GameEvents.FLOATING_TEXT_SPAWN, payload: { onPlayer: true, yOffset: -60, text: "STATS RECONFIGURED", color: '#fbbf24', size: 20 } });
      return true;
  }

  upgradeItem(item: Item): boolean {
      if (!this.canUpgrade(item)) {
          this.sound.play('UI');
          return false;
      }

      this.progression.gainScrap(-this.UPGRADE_COST);
      
      // Immutable Update logic
      const newStats: Record<string, number> = {};
      
      for (const key in item.stats) {
          const val = item.stats[key];
          if (key === 'speed' || key === 'crit' || key === 'ls' || key === 'cdr') {
              newStats[key] = parseFloat((val * 1.05).toFixed(2));
          } else {
              newStats[key] = Math.ceil(val * 1.15);
          }
      }

      const upgradedItem: Item = {
          ...item,
          level: item.level + 1,
          stats: newStats
      };

      this.updateInventoryWith(upgradedItem);

      this.sound.play('POWERUP');
      this.eventBus.dispatch({ type: GameEvents.FLOATING_TEXT_SPAWN, payload: { onPlayer: true, yOffset: -60, text: "ITEM UPGRADED", color: '#06b6d4', size: 24 } });
      return true;
  }

  installAugment(item: Item, augment: AugmentDef): boolean {
      if (!this.canAugment(item, augment)) {
          this.sound.play('UI');
          return false;
      }

      this.progression.gainScrap(-augment.cost);
      
      // Immutable Update
      const newStats = { ...item.stats };
      newStats[augment.stat] = augment.value;
      
      let newRarity = item.rarity;
      let newColor = item.color;

      // Upgrade rarity visual if it has many stats
      if (Object.keys(newStats).length >= 5 && item.rarity !== 'BLACK_MARKET') {
          newRarity = 'RARE';
          newColor = '#3b82f6';
      }

      const augmentedItem: Item = {
          ...item,
          stats: newStats,
          rarity: newRarity,
          color: newColor
      };

      this.updateInventoryWith(augmentedItem);

      this.sound.play('CRAFT');
      this.eventBus.dispatch({ type: GameEvents.FLOATING_TEXT_SPAWN, payload: { onPlayer: true, yOffset: -60, text: "AUGMENT INSTALLED", color: '#a855f7', size: 22 } });
      return true;
  }

  private updateInventoryWith(newItem: Item) {
      // Check Bag
      this.inventory.bag.update(items => items.map(i => i.id === newItem.id ? newItem : i));
      
      // Check Equipped
      this.inventory.equipped.update(eq => {
          const updates: any = {};
          if (eq.weapon?.id === newItem.id) updates.weapon = newItem;
          if (eq.armor?.id === newItem.id) updates.armor = newItem;
          if (eq.implant?.id === newItem.id) updates.implant = newItem;
          if (eq.stim?.id === newItem.id) updates.stim = newItem;
          if (eq.amulet?.id === newItem.id) updates.amulet = newItem;
          if (eq.ring?.id === newItem.id) updates.ring = newItem;
          return { ...eq, ...updates };
      });
  }
}
