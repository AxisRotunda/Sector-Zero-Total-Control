
import { Injectable, inject } from '@angular/core';
import { WorldService } from '../game/world/world.service';
import { PhysicsService } from './physics.service';
import { AiService } from './ai.service';
import { CollisionService } from './collision.service';
import { SpawnerService } from './spawner.service';
import { StatusEffectService } from './status-effect.service';
import { NpcUpdateService } from './npc-update.service';
import { CombatService } from './combat.service';

@Injectable({ providedIn: 'root' })
export class EntityUpdateService {
  private world = inject(WorldService);
  private physics = inject(PhysicsService);
  private ai = inject(AiService);
  private collision = inject(CollisionService);
  private spawner = inject(SpawnerService);
  private status = inject(StatusEffectService);
  private npc = inject(NpcUpdateService);
  private combat = inject(CombatService);

  update(globalTime: number) {
    const player = this.world.player;
    const entities = this.world.entities;

    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e.state === 'DEAD') continue;

      this.status.processStatusEffects(e, globalTime);

      if (e.type === 'ENEMY') {
        this.ai.updateEnemy(e, player);
        this.physics.updateEntityPhysics(e, { speed: e.speed });
      } else if (e.type === 'HITBOX') {
        e.x += e.vx; e.y += e.vy;
        e.timer--;
        this.collision.checkHitboxCollisions(e);
      } else if (e.type === 'PICKUP') {
        this.combat.updatePickup(e);
        this.physics.updateEntityPhysics(e);
      } else if (e.type === 'SPAWNER') {
        this.spawner.updateSpawner(e);
      } else if (e.type === 'NPC') {
        if (e.subType === 'TURRET') this.npc.updateTurret(e);
        else if (e.subType === 'GUARD') this.npc.updateGuard(e);
        else if (e.subType === 'CITIZEN') this.npc.updateCitizen(e);
        else this.npc.updateGenericNpc(e);
        
        this.physics.updateEntityPhysics(e, { speed: e.speed || 1 });
      } else if (e.type === 'DECORATION') {
          if (e.subType === 'VENT') this.npc.updateSteamVent(e);
          if (e.subType === 'SLUDGE') this.npc.updateSludge(e, globalTime);
          if (e.subType === 'OVERSEER_EYE') this.npc.updateOverseerEye(e);
      } else if (e.type === 'DESTRUCTIBLE') {
          this.physics.updateEntityPhysics(e);
      }
    }
  }
}
