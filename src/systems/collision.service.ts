
import { Injectable, inject } from '@angular/core';
import { Entity } from '../models/game.models';
import { CombatService } from './combat.service';
import { SpatialGridService } from './spatial-grid.service';
import { isDestructible, isEnemy } from '../utils/type-guards';
import { WorldService } from '../game/world/world.service';

@Injectable({ providedIn: 'root' })
export class CollisionService {
  private combat = inject(CombatService);
  private spatialGrid = inject(SpatialGridService);
  private world = inject(WorldService);
  
  public checkHitboxCollisions(hitbox: Entity): void {
    // Replaced SpatialHash with SpatialGrid logic for O(K) lookup
    const nearby = this.spatialGrid.queryRadius(hitbox.x, hitbox.y, hitbox.radius);
    
    if (!hitbox.hitIds) hitbox.hitIds = new Set();

    const isPlayerSource = hitbox.source === 'PLAYER' || hitbox.source === 'ENVIRONMENT' || hitbox.source === 'PSIONIC' || hitbox.source === 'DEFENSE';

    for (const target of nearby) {
        if (target.id === hitbox.id) continue;
        if (hitbox.hitIds.has(target.id)) continue;
        if (target.state === 'DEAD') continue;

        let isValidTarget = false;

        if (isPlayerSource) {
            isValidTarget = isEnemy(target) || isDestructible(target);
        } else if (hitbox.source === 'ENEMY') {
            isValidTarget = target.type === 'PLAYER' && !target.invulnerable;
        }

        if (isValidTarget) {
             const dist = Math.hypot(target.x - hitbox.x, target.y - hitbox.y);
             if (dist < target.radius + hitbox.radius) {
                this.combat.processHit(hitbox, target);
                hitbox.hitIds.add(target.id);
                if (hitbox.source === 'DEFENSE' || (hitbox.source === 'ENEMY' && hitbox.timer !== undefined)) {
                    hitbox.timer = 0;
                }
             }
        }
    }
  }
}
