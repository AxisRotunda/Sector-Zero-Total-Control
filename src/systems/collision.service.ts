
import { Injectable, inject } from '@angular/core';
import { Entity } from '../models/game.models';
import { CombatService } from './combat.service';
import { PlayerService } from '../game/player/player.service';
import { SpatialHashService } from './spatial-hash.service';
import { isDestructible, isEnemy } from '../utils/type-guards';
import { WorldService } from '../game/world/world.service';

@Injectable({ providedIn: 'root' })
export class CollisionService {
  private combat = inject(CombatService);
  private playerService = inject(PlayerService);
  private spatialHash = inject(SpatialHashService);
  private world = inject(WorldService);
  
  public checkHitboxCollisions(hitbox: Entity): void {
    if (hitbox.source === 'PLAYER' || hitbox.source === 'ENVIRONMENT' || hitbox.source === 'PSIONIC' || hitbox.source === 'DEFENSE') {
        // FIX: Pass hitbox.zoneId
        const potentialTargets = this.spatialHash.query(hitbox.x, hitbox.y, hitbox.radius, hitbox.zoneId);
        potentialTargets.forEach(target => {
            if (target.state !== 'DEAD' && (isEnemy(target) || isDestructible(target))) {
                 const dist = Math.hypot(target.x - hitbox.x, target.y - hitbox.y);
                 if (dist < target.radius + hitbox.radius) {
                    this.combat.processHit(hitbox, target);
                    if (hitbox.source === 'DEFENSE') hitbox.timer = 0;
                 }
            }
        });
    } else if (hitbox.source === 'ENEMY') {
        const player = this.world.player;
        const dist = Math.hypot(player.x - hitbox.x, player.y - hitbox.y);
        if (dist < player.radius + hitbox.radius) {
            this.playerService.stats.takeDamage(hitbox.hp);
            hitbox.timer = 0; 
        }
    }
  }
}
