
import { Injectable, inject } from '@angular/core';
import { Entity } from '../models/game.models';
import { WorldService } from '../game/world/world.service';
import { EntityPoolService } from '../services/entity-pool.service';
import { IdGeneratorService } from '../utils/id-generator.service';
import { SquadAiService } from './squad-ai.service';
import { ItemGeneratorService } from '../services/item-generator.service';
import { NarrativeService } from '../game/narrative.service';

@Injectable({ providedIn: 'root' })
export class SpawnerService {
  private world = inject(WorldService);
  private entityPool = inject(EntityPoolService);
  private idGenerator = inject(IdGeneratorService);
  private squadAi = inject(SquadAiService);
  private itemGenerator = inject(ItemGeneratorService);
  private narrative = inject(NarrativeService);

  updateSpawner(s: Entity) {
      // Check Narrative Trigger (for training zones)
      if (s.data?.triggerFlag && !this.narrative.getFlag(s.data.triggerFlag)) {
          return;
      }

      if (!s.spawnedIds) s.spawnedIds = [];
      s.spawnedIds = s.spawnedIds.filter(id => { const child = this.world.entities.find(e => e.id === id); return child && child.state !== 'DEAD'; });
      if (s.timer > 0) s.timer--;
      else {
          const max = s.spawnMax || 1;
          if (s.spawnedIds.length < max) {
              const squadId = this.idGenerator.generateNumericId();
              const batchSize = Math.min(3, max - s.spawnedIds.length);
              for(let i=0; i<batchSize; i++) this.spawnFrom(s, squadId, i, batchSize);
              s.timer = s.spawnCooldown || 600;
          }
      }
  }

  private spawnFrom(spawner: Entity, squadId: number, index: number, total: number) {
      if (!spawner.spawnType) return;
      const difficulty = this.world.currentZone().difficultyMult;
      const subType = spawner.spawnType as any;
      let stats: Partial<Entity> = { hp: 40 * difficulty, speed: 2.0, radius: 20, color: '#94a3b8', xpValue: 20 * difficulty, armor: 0 };
      let aggro = 350; let equipmentChance = 0; 
      let statusResistances: Entity['statusResistances'] = {};

      if (subType === 'STALKER') { stats = { hp: 25 * difficulty, speed: 3.5, radius: 15, color: '#60a5fa', xpValue: 35 * difficulty }; aggro = 450; equipmentChance = 0.1; }
      if (subType === 'SNIPER') { stats = { hp: 20 * difficulty, speed: 2.0, radius: 15, color: '#a855f7', xpValue: 45 * difficulty }; aggro = 600; equipmentChance = 0.2; statusResistances = { burn: 1.5, poison: 0.8 }; }
      if (subType === 'STEALTH') { stats = { hp: 30 * difficulty, speed: 4.0, radius: 15, color: '#334155', xpValue: 40 * difficulty }; aggro = 250; }
      if (subType === 'HEAVY') { stats = { hp: 150 * difficulty, speed: 1.5, radius: 35, color: '#f59e0b', xpValue: 90 * difficulty, armor: 15 * difficulty }; aggro = 400; equipmentChance = 0.5; statusResistances = { stun: 0.5, poison: 1.2 }; }
      if (subType === 'BOSS') { stats = { hp: 400 * difficulty, speed: 4.5, radius: 30, color: '#dc2626', xpValue: 300 * difficulty, armor: 30 * difficulty }; aggro = 500; equipmentChance = 1.0; statusResistances = { stun: 0.2, burn: 0.5 }; }
      if (subType === 'GRUNT') { stats = { hp: 40 * difficulty, speed: 2.0, radius: 18, color: '#a1a1aa', xpValue: 20 * difficulty }; }

      // CRITICAL: Inherit zone ID from spawner
      const enemy = this.entityPool.acquire('ENEMY', subType, spawner.zoneId);
      Object.assign(enemy, stats);
      const angle = Math.random() * Math.PI * 2; const dist = Math.random() * 50;
      enemy.x = spawner.x + Math.cos(angle) * dist; enemy.y = spawner.y + Math.sin(angle) * dist; enemy.homeX = spawner.x; enemy.homeY = spawner.y;
      enemy.aggroRadius = aggro; enemy.maxHp = stats.hp!; enemy.hp = stats.hp!; enemy.attackTimer = Math.random() * 100; enemy.statusResistances = statusResistances;
      
      if (total > 1) {
          enemy.squadId = squadId; this.squadAi.registerMember(enemy);
          if (index === 0 && Math.random() > 0.7 && subType !== 'BOSS') { enemy.aiRole = 'SUPPORT'; enemy.color = '#34d399'; } else enemy.aiRole = 'ATTACKER';
      }

      if (Math.random() < equipmentChance) {
          enemy.equipment = {};
          if (Math.random() < 0.8) enemy.equipment.weapon = this.itemGenerator.generateLoot({level: 1, difficulty, forceType: 'WEAPON'});
          if (Math.random() < 0.5) enemy.equipment.armor = this.itemGenerator.generateLoot({level: 1, difficulty, forceType: 'ARMOR'});
      }
      this.world.entities.push(enemy); spawner.spawnedIds?.push(enemy.id);
  }
}
