
import { Injectable, inject } from '@angular/core';
import { Entity } from '../models/game.models';
import { CombatService } from './combat.service';
import { PlayerStatsService } from '../game/player/player-stats.service';
import { SpatialHashService } from './spatial-hash.service';
import { isDestructible, isEnemy } from '../utils/type-guards';
import { WorldService } from '../game/world/world.service';

@Injectable({ providedIn: 'root' })
export class CollisionService {
  private combat = inject(CombatService);
  private playerStats = inject(PlayerStatsService);
  private spatialHash = inject(SpatialHashService);
  private world = inject(WorldService);
  
  public checkHitboxCollisions(hitbox: Entity): void {
    // CRITICAL FIX: Use the hitbox's zoneId (inherited from source) or fallback to current world zone
    const zoneId = hitbox.zoneId || this.world.currentZone().id;

    if (hitbox.source === 'PLAYER' || hitbox.source === 'ENVIRONMENT' || hitbox.source === 'PSIONIC' || hitbox.source === 'DEFENSE') {
        const potentialTargets = this.spatialHash.query(hitbox.x, hitbox.y, hitbox.radius, zoneId);
        
        // Initialize hit tracking if missing (safety net)
        if (!hitbox.hitIds) hitbox.hitIds = new Set();

        potentialTargets.forEach(target => {
            // Idempotency Check: Don't hit the same enemy twice with the same swing
            if (hitbox.hitIds!.has(target.id)) return;

            if (target.state !== 'DEAD' && (isEnemy(target) || isDestructible(target))) {
                 const dist = Math.hypot(target.x - hitbox.x, target.y - hitbox.y);
                 if (dist < target.radius + hitbox.radius) {
                    this.combat.processHit(hitbox, target);
                    
                    // Mark as hit
                    hitbox.hitIds!.add(target.id);

                    if (hitbox.source === 'DEFENSE') hitbox.timer = 0;
                 }
            }
        });
    } else if (hitbox.source === 'ENEMY') {
        const player = this.world.player;
        const dist = Math.hypot(player.x - hitbox.x, player.y - hitbox.y);
        
        // Player Hit Logic with Iframes
        if (dist < player.radius + hitbox.radius) {
            if (player.state !== 'DEAD' && !player.invulnerable) {
                this.playerStats.takeDamage(hitbox.hp);
                player.invulnerable = true;
                player.iframeTimer = 30; // 0.5s @ 60fps
                hitbox.timer = 0;
            }
        }
    }
  }
}
