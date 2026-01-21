import { Injectable, inject } from '@angular/core';
import { Entity } from '../models/game.models';
import { WorldService } from '../game/world/world.service';
import * as BALANCE from '../config/balance.config';

@Injectable({ providedIn: 'root' })
export class SquadAiService {
  private world = inject(WorldService);
  private squads = new Map<number, number[]>();

  registerMember(entity: Entity) {
      if (!entity.squadId) return;
      if (!this.squads.has(entity.squadId)) this.squads.set(entity.squadId, []);
      this.squads.get(entity.squadId)!.push(entity.id);
  }

  getSquadMembers(squadId: number): Entity[] {
      const ids = this.squads.get(squadId);
      if (!ids) return [];
      return ids.map(id => this.world.entities.find(e => e.id === id)).filter((e): e is Entity => !!e && e.state !== 'DEAD');
  }

  getSquadOrders(entity: Entity, player: Entity): { xOffset: number, yOffset: number, behavior: 'ATTACK' | 'SUPPORT' } {
      if (!entity.squadId) return { xOffset: 0, yOffset: 0, behavior: 'ATTACK' };
      const members = this.getSquadMembers(entity.squadId);
      if (members.length <= 1) return { xOffset: 0, yOffset: 0, behavior: 'ATTACK' };
      if (entity.aiRole === 'SUPPORT') return { xOffset: 0, yOffset: 0, behavior: 'SUPPORT' };

      const index = members.findIndex(m => m.id === entity.id);
      const angleToPlayer = Math.atan2(player.y - entity.y, player.x - entity.x);
      const spacing = BALANCE.ENEMY_AI.SQUAD_FORMATION_SPACING;
      const offsetMultiplier = Math.ceil(index / 2);
      const side = index % 2 === 0 ? 1 : -1;
      const flankAngle = angleToPlayer + (Math.PI / 2 * side);
      return { xOffset: Math.cos(flankAngle) * (spacing * offsetMultiplier), yOffset: Math.sin(flankAngle) * (spacing * offsetMultiplier), behavior: 'ATTACK' };
  }
}