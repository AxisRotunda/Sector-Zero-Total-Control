
import { AIStrategy, AIContext } from './ai-interface.ts';
import { Entity } from '../../models/game.models';
import { createEmptyDamagePacket } from '../../models/damage.model';
import * as BALANCE from '../../config/balance.config';

// Helper for path movement
function moveTowardTarget(enemy: Entity, targetX: number, targetY: number, ctx: AIContext, stopDist: number = 0) {
    // 1. Direct Line Check (Optimization: Don't pathfind if line of sight is clear and short)
    const dx = targetX - enemy.x;
    const dy = targetY - enemy.y;
    const directDist = Math.hypot(dx, dy);
    
    if (directDist < stopDist) return;

    if (directDist < 100) {
        // Close range, direct movement
        const angle = Math.atan2(dy, dx);
        enemy.vx += Math.cos(angle) * 0.5;
        enemy.vy += Math.sin(angle) * 0.5;
        enemy.angle = angle;
        return;
    }

    // 2. Pathfinding
    if (!enemy.data) enemy.data = {};
    const now = Date.now();
    
    // Re-path if: No path, Path stale (>1s), or Target moved significantly
    const lastTarget = enemy.data.pathTarget || {x: -999, y: -999};
    const targetDiff = Math.abs(targetX - lastTarget.x) + Math.abs(targetY - lastTarget.y);
    
    // MODIFIED: Squad members use longer staleness window to prevent jitter
    const isSquadMember = !!enemy.squadId;
    const staleThreshold = isSquadMember ? 2000 : 1000;  // 2s for squads, 1s for solos

    if (!enemy.data.path || (now - (enemy.data.lastPathTime || 0) > staleThreshold && targetDiff > 50)) {
        enemy.data.path = ctx.navigation.findPath({x: enemy.x, y: enemy.y}, {x: targetX, y: targetY});
        enemy.data.currentWaypoint = 0;
        enemy.data.lastPathTime = now;
        enemy.data.pathTarget = {x: targetX, y: targetY};
    }

    if (enemy.data.path && enemy.data.path.length > 0) {
        // Follow Path
        const wpIdx = enemy.data.currentWaypoint || 0;
        if (wpIdx < enemy.data.path.length) {
            const wp = enemy.data.path[wpIdx];
            const distToWp = Math.hypot(wp.x - enemy.x, wp.y - enemy.y);
            
            if (distToWp < 30) {
                enemy.data.currentWaypoint++;
            } else {
                const angle = Math.atan2(wp.y - enemy.y, wp.x - enemy.x);
                enemy.vx += Math.cos(angle) * 0.5;
                enemy.vy += Math.sin(angle) * 0.5;
                enemy.angle = angle;
                // Debug trail
                // if (!enemy.trail) enemy.trail = [];
                // enemy.trail.push({x: wp.x, y: wp.y, alpha: 0.5});
            }
        } else {
            // End of path, move directly to target if needed
            const angle = Math.atan2(dy, dx);
            enemy.vx += Math.cos(angle) * 0.5;
            enemy.vy += Math.sin(angle) * 0.5;
        }
    } else {
        // Fallback direct
        const angle = Math.atan2(dy, dx);
        enemy.vx += Math.cos(angle) * 0.5;
        enemy.vy += Math.sin(angle) * 0.5;
    }
}

export class MeleeStrategy implements AIStrategy {
  execute(enemy: Entity, player: Entity, ctx: AIContext): void {
    let targetX = player.x;
    let targetY = player.y;

    // Squad logic override
    if (enemy.squadId) {
        const orders = ctx.squadAi.getSquadOrders(enemy, player);
        if (orders) {
            targetX += orders.xOffset;
            targetY += orders.yOffset;
        }
    }

    const dist = Math.hypot(targetX - enemy.x, targetY - enemy.y);
    enemy.state = 'MOVE';
    enemy.animFrame++;

    moveTowardTarget(enemy, targetX, targetY, ctx, player.radius + enemy.radius);

    // Attack check
    const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (distToPlayer < player.radius + enemy.radius + 10) {
        const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        let damage = (enemy.equipment?.weapon?.stats['dmg'] || 8) * ctx.world.currentZone().difficultyMult;
        ctx.combat.applyDirectDamage(enemy, player, damage);
        // Recoil
        enemy.vx -= Math.cos(angle) * 10;
        enemy.vy -= Math.sin(angle) * 10;
    }
  }
}

export class SniperStrategy implements AIStrategy {
  private readonly OPTIMAL_RANGE = 500;
  private readonly RETREAT_THRESHOLD = 300;
  private readonly CHARGE_TIME = 90;

  execute(enemy: Entity, player: Entity, ctx: AIContext): void {
    const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);

    if (dist < this.RETREAT_THRESHOLD) {
        enemy.state = 'RETREAT';
        enemy.vx -= Math.cos(angle) * 0.6;
        enemy.vy -= Math.sin(angle) * 0.6;
        enemy.angle = angle;
        // Reset charge if forced to move
        enemy.timer = 0;
    } else if (dist < this.OPTIMAL_RANGE + 200) {
        // In position, charge attack
        enemy.state = 'CHARGE';
        enemy.angle = angle; // Face player
        if (enemy.timer === undefined) enemy.timer = 0;
        enemy.timer++;
        
        if (enemy.timer % 60 === 0) ctx.sound.play('CHARGE');
        
        if (enemy.timer > 180) {
            this.fire(enemy, player, angle, ctx);
            enemy.timer = 0;
        }
    } else {
        // Approach
        enemy.state = 'MOVE';
        moveTowardTarget(enemy, player.x, player.y, ctx, this.OPTIMAL_RANGE);
    }
  }

  private fire(enemy: Entity, player: Entity, angle: number, ctx: AIContext) {
      ctx.sound.play('SHOOT');
      let damage = 40 * ctx.world.currentZone().difficultyMult;
      
      const projectile = ctx.entityPool.acquire('HITBOX', undefined, enemy.zoneId);
      projectile.source = 'ENEMY'; 
      projectile.x = enemy.x; projectile.y = enemy.y; projectile.z = 10;
      projectile.vx = Math.cos(angle) * 15; projectile.vy = Math.sin(angle) * 15;
      projectile.angle = angle; projectile.radius = 8;
      
      projectile.damagePacket = createEmptyDamagePacket();
      projectile.damagePacket.physical = damage;
      
      projectile.color = '#a855f7'; 
      projectile.state = 'ATTACK'; 
      projectile.timer = 60;
      
      if (enemy.status.weakness) {
          projectile.status.weakness = { ...enemy.status.weakness };
      }
      ctx.world.entities.push(projectile);
  }
}

export class StealthStrategy implements AIStrategy {
    execute(enemy: Entity, player: Entity, ctx: AIContext): void {
        const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        
        const isRevealed = dist < 200 || enemy.state === 'ATTACK';
        enemy.color = isRevealed ? '#334155' : 'rgba(51, 65, 85, 0.1)';
        
        if (dist > 50) {
            enemy.state = 'MOVE';
            moveTowardTarget(enemy, player.x, player.y, ctx, 40);
        } else {
            if (enemy.attackTimer === undefined) enemy.attackTimer = 0;
            if (enemy.attackTimer <= 0) {
                let damage = 15 * ctx.world.currentZone().difficultyMult;
                ctx.combat.applyDirectDamage(enemy, player, damage);
                enemy.attackTimer = 60; 
                enemy.state = 'ATTACK';
            }
        }
        if (enemy.attackTimer && enemy.attackTimer > 0) enemy.attackTimer--;
    }
}

export class SupportStrategy implements AIStrategy {
    execute(enemy: Entity, player: Entity, ctx: AIContext): void {
        let target = player;
        let healTarget: Entity | null = null;

        // Find injured ally
        if (enemy.squadId) {
            const members = ctx.squadAi.getSquadMembers(enemy.squadId);
            const injured = members.find(m => m.id !== enemy.id && m.hp < m.maxHp * 0.8);
            if (injured) healTarget = injured;
        }

        if (healTarget) {
            const dx = healTarget.x - enemy.x;
            const dy = healTarget.y - enemy.y;
            const dist = Math.hypot(dx, dy);
            
            if (dist > 100) {
                moveTowardTarget(enemy, healTarget.x, healTarget.y, ctx, 80);
            } else {
                if (enemy.attackTimer === undefined) enemy.attackTimer = 0;
                if (enemy.attackTimer <= 0) {
                    enemy.state = 'SUPPORT';
                    healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + BALANCE.ENEMY_AI.SUPPORT_HEAL_AMOUNT);
                    healTarget.hitFlash = 5;
                    ctx.world.spawnFloatingText(healTarget.x, healTarget.y - 20, "HEALED", '#22c55e', 14);
                    enemy.attackTimer = BALANCE.ENEMY_AI.SUPPORT_COOLDOWN;
                }
            }
        } else {
            // No one to heal, keep distance from player
            const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
            const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
            if (dist < 300) {
                enemy.vx -= Math.cos(angle) * 0.4;
                enemy.vy -= Math.sin(angle) * 0.4;
            }
        }
        if (enemy.attackTimer && enemy.attackTimer > 0) enemy.attackTimer--;
    }
}

export class SkirmisherStrategy implements AIStrategy {
    execute(enemy: Entity, player: Entity, ctx: AIContext): void {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        
        // Evade if being aimed at
        const angleToEnemy = Math.atan2(enemy.y - player.y, enemy.x - player.x);
        const isBeingAimedAt = Math.abs(angleToEnemy - player.angle) < 0.5;
        
        if (isBeingAimedAt && dist < 200) {
            const evadeAngle = angle + Math.PI / 2;
            enemy.vx += Math.cos(evadeAngle) * 0.8;
            enemy.vy += Math.sin(evadeAngle) * 0.8;
        } else {
            moveTowardTarget(enemy, player.x, player.y, ctx, player.radius + enemy.radius);
        }
        
        if (dist < player.radius + enemy.radius + 10) {
             let damage = (enemy.equipment?.weapon?.stats['dmg'] || 8) * ctx.world.currentZone().difficultyMult;
             ctx.combat.applyDirectDamage(enemy, player, damage);
        }
    }
}
