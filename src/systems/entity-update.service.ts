
import { Injectable, inject } from '@angular/core';
import { WorldService } from '../game/world/world.service';
import { PhysicsService } from './physics.service';
import { AiService } from './ai.service';
import { CollisionService } from './collision.service';
import { SpawnerService } from './spawner.service';
import { StatusEffectService } from './status-effect.service';
import { NpcUpdateService } from './npc-update.service';
import { CombatService } from './combat.service';
import { SpatialHashService } from './spatial-hash.service';

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
  private spatialHash = inject(SpatialHashService);

  update(globalTime: number) {
    const player = this.world.player;
    const entities = this.world.entities;

    // 1. Spatial Hash Maintenance (The Bridge to Rendering)
    // Clear previous frame's dynamic buckets so we don't have ghost entries
    this.spatialHash.clearDynamic();
    
    // Register Player (Dynamic) so enemies can query position via Hash
    this.spatialHash.insert(player, false);

    // Register all Dynamic Entities
    for (let i = 0; i < entities.length; i++) {
        // Insert before logic to ensure physics/AI queries against reasonably fresh data
        this.spatialHash.insert(entities[i], false);
    }

    // 2. Logic Updates
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e.state === 'DEAD') continue;

      this.status.processStatusEffects(e, globalTime);

      if (e.hitStopFrames && e.hitStopFrames > 0) {
          e.hitStopFrames--;
          continue; // Skip logic this frame for impact weight
      }
      
      // Reset hit stun flag if frames are done
      if (e.hitStopFrames <= 0) e.isHitStunned = false;

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
