import { Injectable, inject } from '@angular/core';
import { Entity } from '../models/game.models';
import { WorldService } from '../game/world/world.service';
import { EntityPoolService } from '../services/entity-pool.service';
import { ItemGeneratorService } from '../services/item-generator.service';
import { PlayerProgressionService } from '../game/player/player-progression.service';
import { EventBusService } from '../core/events/event-bus.service';
import { GameEvents } from '../core/events/game-events';
import { NarrativeService } from '../game/narrative.service';
import * as CONFIG from '../config/game.config';

@Injectable({ providedIn: 'root' })
export class LootService {
  private world = inject(WorldService);
  private entityPool = inject(EntityPoolService);
  private itemGenerator = inject(ItemGeneratorService);
  private progression = inject(PlayerProgressionService);
  private eventBus = inject(EventBusService);
  private narrative = inject(NarrativeService);

  public processEnemyRewards(enemy: Entity): void {
    const currentZone = this.world.currentZone();
    
    // Training zones don't grant progression
    if (currentZone.isTrainingZone) return;

    // Grant XP and Credits
    this.progression.gainXp(enemy.xpValue);
    const creditReward = Math.floor(
      enemy.xpValue * 0.5 * (0.8 + Math.random() * 0.4)
    );
    this.progression.gainCredits(creditReward);

    // Database discovery for new enemy types
    if (enemy.subType && this.narrative.discoverEntity(enemy.subType)) {
      this.eventBus.dispatch({
        type: GameEvents.FLOATING_TEXT_SPAWN,
        payload: {
          onPlayer: true,
          yOffset: -120,
          text: 'DATABASE UPDATED',
          color: '#06b6d4',
          size: 20
        }
      });
    }

    // Loot rolls
    const isBoss = enemy.subType === 'BOSS';
    const dropChance = isBoss ? 1.0 : CONFIG.LOOT_CHANCES.ENEMY_DROP;
    
    if (Math.random() < dropChance) {
      const dropCount = isBoss ? 3 : 1;
      for (let i = 0; i < dropCount; i++) {
        this.spawnLoot(enemy.x, enemy.y, isBoss ? 'BOSS' : 'ENEMY');
      }
    }

    // Equipment drops (if enemy was equipped)
    this.processEquipmentDrop(enemy);
  }

  private processEquipmentDrop(enemy: Entity): void {
    if (!enemy.equipment) return;

    const DROP_CHANCE = 0.3; // 30% per equipped item

    if (enemy.equipment.weapon && Math.random() < DROP_CHANCE) {
      this.dropSpecificItem(enemy.x, enemy.y, enemy.equipment.weapon);
    }

    if (enemy.equipment.armor && Math.random() < DROP_CHANCE) {
      this.dropSpecificItem(enemy.x, enemy.y, enemy.equipment.armor);
    }
  }

  public spawnLoot(x: number, y: number, source: 'ENEMY' | 'CRATE' | 'BOSS'): void {
    const rarityBias = source === 'BOSS' ? 0.6 : (source === 'CRATE' ? 0.2 : 0);

    const loot = this.itemGenerator.generateLoot({
      level: this.progression.level(),
      difficulty: this.world.currentZone().difficultyMult,
      rarityBias,
      source
    });

    this.dropSpecificItem(x, y, loot);
  }

  public dropSpecificItem(x: number, y: number, item: any): void {
    const pickup = this.entityPool.acquire('PICKUP');
    
    pickup.x = x;
    pickup.y = y;
    pickup.color = item.color;
    pickup.itemData = item;

    // Ejection physics (spread pattern)
    pickup.vx = (Math.random() - 0.5) * 5;
    pickup.vy = (Math.random() - 0.5) * 5;

    this.world.entities.push(pickup);
  }

  public processDestructibleRewards(destructible: Entity): void {
    if (Math.random() < CONFIG.LOOT_CHANCES.DESTRUCTIBLE_DROP) {
      this.spawnLoot(destructible.x, destructible.y, 'CRATE');
    }
  }
}