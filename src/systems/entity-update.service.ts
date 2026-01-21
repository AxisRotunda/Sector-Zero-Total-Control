
import { Injectable, inject } from '@angular/core';
import { WorldService } from '../game/world/world.service';
import { isDestructible, isEnemy } from '../utils/type-guards';
import { SpatialHashService } from './spatial-hash.service';
import { AiService } from './ai.service';
import { CombatService } from './combat.service';
import { StatusEffectService } from './status-effect.service';
import { CollisionService } from './collision.service';
import { PhysicsService } from './physics.service';
import { PlayerControlService } from './player-control.service';
import { EntityPoolService } from '../services/entity-pool.service';
import { Entity } from '../models/game.models';
import { SpawnerService } from './spawner.service';
import { NpcUpdateService } from './npc-update.service';

@Injectable({ providedIn: 'root' })
export class EntityUpdateService {
  world = inject(WorldService);
  spatialHash = inject(SpatialHashService);
  entityPool = inject(EntityPoolService);
  ai = inject(AiService);
  combat = inject(CombatService);
  statusEffect = inject(StatusEffectService);
  collision = inject(CollisionService); 
  physics = inject(PhysicsService);
  playerControl = inject(PlayerControlService);
  spawnerService = inject(SpawnerService);
  npcService = inject(NpcUpdateService);
  
  update(globalTime: number) {
    if (this.world.player.hp <= 0) return;
    
    // Only clear dynamic entities. Static walls persist.
    this.spatialHash.clearDynamic();
    
    // Insert dynamic entities
    this.spatialHash.insert(this.world.player, false);
    
    this.world.entities.forEach(e => { 
        if (e.state !== 'DEAD' && e.type !== 'SPAWNER' && e.type !== 'WALL') {
            this.spatialHash.insert(e, false); 
        }
    });

    this.playerControl.update(globalTime);
    this.updateEntities(globalTime);
  }

  private updateEntities(globalTime: number) {
    const spawners: Entity[] = [];
    this.world.entities.forEach(e => {
        if (e.state === 'DEAD') return; 
        
        // Static walls don't need updates usually, skip them for performance
        if (e.type === 'WALL') return;

        if (e.hitStopFrames && e.hitStopFrames > 0) {
            e.hitStopFrames--; if (e.hitStopFrames <= 0) e.isHitStunned = false; return;
        }
        if (e.type === 'SPAWNER') { spawners.push(e); return; }
        if (e.type === 'NPC') {
            if (e.subType === 'TURRET') this.npcService.updateTurret(e);
            else if (e.subType === 'GUARD') this.npcService.updateGuard(e);
            else this.npcService.updateGenericNpc(e); // Ensure idle animation for traders/handlers
        }
        if (e.type === 'HITBOX' && e.subType === 'VENT') {
            this.npcService.updateSteamVent(e);
            if (e.state === 'ACTIVE') this.collision.checkHitboxCollisions(e);
            return;
        }
        if (e.type === 'HITBOX' && e.subType === 'SLUDGE') {
            this.npcService.updateSludge(e, globalTime); this.collision.checkHitboxCollisions(e); return;
        }
        this.statusEffect.processStatusEffects(e, globalTime);
        if (e.hp <= 0 && e.type !== 'EXIT' && e.type !== 'NPC' && e.type !== 'SHRINE' && e.type !== 'HITBOX') {
            if (isEnemy(e)) this.combat.killEnemy(e);
            if (isDestructible(e)) this.combat.destroyObject(e);
            return;
        }
        if (e.status.stun > 0) {
            e.status.stun--; e.vx *= 0.9; e.vy *= 0.9; this.physics.updateEntityPhysics(e); return;
        }
        if (e.hitFlash > 0) e.hitFlash--;
        if (e.type !== 'HITBOX' && e.type !== 'PICKUP' && e.type !== 'EXIT' && e.type !== 'NPC' && e.type !== 'DECORATION' && e.type !== 'SHRINE') {
            this.physics.updateEntityPhysics(e);
        } else if (e.type === 'HITBOX') { e.x += e.vx; e.y += e.vy;
        } else if (e.type === 'PICKUP') { e.x += e.vx * 0.9; e.y += e.vy * 0.9; }

        switch (e.type) {
            case 'HITBOX': e.timer--; this.collision.checkHitboxCollisions(e); break;
            case 'PICKUP': this.combat.updatePickup(e); break;
            case 'ENEMY': this.ai.updateEnemy(e, this.world.player); break;
        }
    });
    spawners.forEach(s => this.spawnerService.updateSpawner(s));
  }
}
