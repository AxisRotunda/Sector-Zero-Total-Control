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
    const zoneId = hitbox.zoneId || this.world.currentZone().id;

    if (hitbox.source === 'PLAYER' || hitbox.source === 'ENVIRONMENT' || hitbox.source === 'PSIONIC' || hitbox.source === 'DEFENSE') {
        const potentialTargets = this.spatialHash.query(hitbox.x, hitbox.y, hitbox.radius, zoneId);
        
        if (!hitbox.hitIds) hitbox.hitIds = new Set();

        potentialTargets.forEach(target => {
            if (hitbox.hitIds!.has(target.id)) return;

            if (target.state !== 'DEAD' && (isEnemy(target) || isDestructible(target))) {
                 const dist = Math.hypot(target.x - hitbox.x, target.y - hitbox.y);
                 if (dist < target.radius + hitbox.radius) {
                    
                    this.combat.processHit(hitbox, target);
                    
                    hitbox.hitIds!.add(target.id);

                    if (hitbox.source === 'DEFENSE') hitbox.timer = 0;
                 }
            }
        });
    } else if (hitbox.source === 'ENEMY') {
        const player = this.world.player;
        const dist = Math.hypot(player.x - hitbox.x, player.y - hitbox.y);
        
        if (dist < player.radius + hitbox.radius) {
            if (player.state !== 'DEAD' && !player.invulnerable) {
                // Fallback Damage Logic:
                const damage = hitbox.damageValue ?? this.calculateFallbackDamage(hitbox);

                // Unified damage application
                this.combat.applyDirectDamage(hitbox, player, damage);
                
                if (hitbox.timer !== undefined) {
                    hitbox.timer = 0;
                }
            }
        }
    }
  }

  private calculateFallbackDamage(hitbox: Entity): number {
    // If hitbox is a projectile, it might have a sourceEntityId to lookup (not implemented yet).
    // For now, if it's the enemy body itself (no timer usually), check its equipment.
    
    // Check if hitbox is actually the enemy entity
    if (hitbox.type === 'ENEMY' && hitbox.equipment?.weapon?.stats['dmg']) {
        return hitbox.equipment.weapon.stats['dmg'];
    }

    // Hard fallback based on difficulty
    return 5 * this.world.currentZone().difficultyMult;
  }
}