import { Injectable, inject } from '@angular/core';
import { PlayerProgressionService } from './player/player-progression.service';
import { Item } from '../models/item.models';
import { SoundService } from '../services/sound.service';
import { ItemGeneratorService } from '../services/item-generator.service';
import { EventBusService } from '../core/events/event-bus.service';
import { GameEvents } from '../core/events/game-events';

@Injectable({
  providedIn: 'root'
})
export class CraftingService {
  private progression = inject(PlayerProgressionService);
  private sound = inject(SoundService);
  private itemGen = inject(ItemGeneratorService);
  private eventBus = inject(EventBusService);

  private readonly REROLL_COST = 50;
  private readonly UPGRADE_COST = 100;

  canReroll(item: Item): boolean {
      return this.progression.scrap() >= this.REROLL_COST;
  }

  canUpgrade(item: Item): boolean {
      return this.progression.scrap() >= this.UPGRADE_COST;
  }

  rerollItem(item: Item): boolean {
      if (!this.canReroll(item)) {
          this.sound.play('UI'); // Error
          return false;
      }

      this.progression.gainScrap(-this.REROLL_COST);
      
      // Generate a new item of the same type and level to replace stats
      // We essentially swap the stats block
      const newItem = this.itemGen.generateLoot({
          level: item.level,
          rarityBias: 0, // Neutral bias
          forceType: item.type
      });

      item.stats = newItem.stats;
      item.name = newItem.name; // Name usually tied to stats (prefixes)
      
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
      
      item.level++;
      // Boost stats by 10%
      for (const key in item.stats) {
          const val = item.stats[key];
          if (key === 'speed' || key === 'crit' || key === 'ls' || key === 'cdr') {
              // Percentage stats scale slower
              item.stats[key] = parseFloat((val * 1.05).toFixed(2));
          } else {
              item.stats[key] = Math.ceil(val * 1.15);
          }
      }

      this.sound.play('POWERUP');
      this.eventBus.dispatch({ type: GameEvents.FLOATING_TEXT_SPAWN, payload: { onPlayer: true, yOffset: -60, text: "ITEM UPGRADED", color: '#06b6d4', size: 24 } });
      return true;
  }
}