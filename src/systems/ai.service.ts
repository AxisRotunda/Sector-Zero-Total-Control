
import { Injectable, inject } from '@angular/core';
import { Entity } from '../models/game.models';
import { WorldService } from '../game/world/world.service';
import { PlayerService } from '../game/player/player.service';
import { SoundService } from '../services/sound.service';
import { EntityPoolService } from '../services/entity-pool.service';
import { SquadAiService } from './squad-ai.service';
import { SpatialHashService } from './spatial-hash.service';
import * as BALANCE from '../config/balance.config';

@Injectable({ providedIn: 'root' })
export class AiService {
  private world = inject(WorldService);
  private playerService = inject(PlayerService);
  private sound = inject(SoundService);
  private entityPool = inject(EntityPoolService);
  private squadAi = inject(SquadAiService);
  private spatialHash = inject(SpatialHashService);
  
  private strategies: { [key: string]: (e: Entity, p: Entity, dist: number, angle: number) => void } = {
    'SNIPER': this.updateSniper.bind(this), 'STEALTH': this.updateStealth.bind(this), 'GRUNT': this.updateFlanker.bind(this),
    'HEAVY': this.updateDefault.bind(this), 'STALKER': this.updateSkirmisher.bind(this), 'BOSS': this.updateDefault.bind(this), 'SUPPORT': this.updateSupport.bind(this)
  };

  public updateEnemy(enemy: Entity, player: Entity): void {
    const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    const aggroRange = enemy.aggroRadius || 400;
    const leashRange = aggroRange * 2;
    
    let distFromHome = 0;
    if (enemy.homeX !== undefined && enemy.homeY !== undefined) distFromHome = Math.hypot(enemy.x - enemy.homeX, enemy.y - enemy.homeY);

    if (distFromHome > leashRange) {
        enemy.state = 'RETREAT';
        const homeAngle = Math.atan2(enemy.homeY! - enemy.y, enemy.homeX! - enemy.x);
        enemy.angle = homeAngle; enemy.vx += Math.cos(homeAngle) * 0.5; enemy.vy += Math.sin(homeAngle) * 0.5;
        if (enemy.hp < enemy.maxHp) enemy.hp += 0.5;
        if (distFromHome < 20) enemy.state = 'IDLE';
        return;
    }

    if (distToPlayer > aggroRange && enemy.state !== 'ATTACK' && enemy.state !== 'SUPPORT') {
        enemy.state = 'IDLE'; if (enemy.hp < enemy.maxHp) enemy.hp += 0.1; return;
    }

    let targetX = player.x; let targetY = player.y;
    if (enemy.squadId) {
        const orders = this.squadAi.getSquadOrders(enemy, player);
        if (orders.behavior === 'ATTACK') { targetX += orders.xOffset; targetY += orders.yOffset; }
    }

    const targetDx = targetX - enemy.x; const targetDy = targetY - enemy.y;
    const targetAngle = Math.atan2(targetDy, targetDx); const targetDist = Math.hypot(targetDx, targetDy);

    enemy.angle = targetAngle; enemy.state = 'MOVE'; enemy.animFrame++;

    if (enemy.hp < enemy.maxHp * BALANCE.ENEMY_AI.COVER_HP_THRESHOLD && enemy.subType !== 'BOSS') { this.updateSeekCover(enemy, player, targetDist, targetAngle); return; }
    if (enemy.aiRole === 'SUPPORT') { this.updateSupport(enemy, player, targetDist, targetAngle); return; }

    const strategy = this.strategies[enemy.subType!] || this.updateDefault;
    strategy(enemy, player, targetDist, targetAngle);
  }

  private updateSeekCover(enemy: Entity, player: Entity, dist: number, angle: number) {
      // FIX: Pass enemy.zoneId
      const walls = this.spatialHash.query(enemy.x, enemy.y, BALANCE.ENEMY_AI.COVER_SEEK_DISTANCE, enemy.zoneId);
      let bestCover: Entity | null = null; let bestDist = Infinity;
      for (const w of walls) {
          if (w.type === 'WALL') {
              const d = Math.hypot(w.x - enemy.x, w.y - enemy.y);
              if (d < bestDist) { bestDist = d; bestCover = w; }
          }
      }
      if (bestCover) {
          const anglePlayerToWall = Math.atan2(bestCover.y - player.y, bestCover.x - player.x);
          const coverX = bestCover.x + Math.cos(anglePlayerToWall) * 60; const coverY = bestCover.y + Math.sin(anglePlayerToWall) * 60;
          const coverAngle = Math.atan2(coverY - enemy.y, coverX - enemy.x);
          enemy.vx += Math.cos(coverAngle) * 0.5; enemy.vy += Math.sin(coverAngle) * 0.5;
      } else { enemy.vx -= Math.cos(angle) * 0.4; enemy.vy -= Math.sin(angle) * 0.4; }
  }

  private updateSupport(enemy: Entity, player: Entity, dist: number, angle: number) {
      if (enemy.squadId) {
          const members = this.squadAi.getSquadMembers(enemy.squadId);
          const injured = members.find(m => m.id !== enemy.id && m.hp < m.maxHp * 0.8);
          if (injured) {
              const dx = injured.x - enemy.x; const dy = injured.y - enemy.y; const d = Math.hypot(dx, dy); const a = Math.atan2(dy, dx);
              if (d > 100) { enemy.vx += Math.cos(a) * 0.6; enemy.vy += Math.sin(a) * 0.6; } 
              else {
                  if (enemy.attackTimer === undefined) enemy.attackTimer = 0;
                  if (enemy.attackTimer <= 0) {
                      enemy.state = 'SUPPORT'; injured.hp = Math.min(injured.maxHp, injured.hp + BALANCE.ENEMY_AI.SUPPORT_HEAL_AMOUNT); injured.hitFlash = 5;
                      this.world.spawnFloatingText(injured.x, injured.y - 20, "HEALED", '#22c55e', 14); enemy.attackTimer = BALANCE.ENEMY_AI.SUPPORT_COOLDOWN;
                  }
              }
              if (enemy.attackTimer > 0) enemy.attackTimer--;
              return;
          }
      }
      if (dist < 300) { enemy.vx -= Math.cos(angle) * 0.4; enemy.vy -= Math.sin(angle) * 0.4; }
  }

  private updateDefault(enemy: Entity, player: Entity, dist: number, angle: number) {
     const accel = 0.5; enemy.vx += Math.cos(angle) * accel; enemy.vy += Math.sin(angle) * accel;
     this.checkMeleeAttack(enemy, player, dist, angle);
  }

  private checkMeleeAttack(enemy: Entity, player: Entity, dist: number, angle: number) {
      if (dist < player.radius + enemy.radius) {
         let damage = (enemy.equipment?.weapon?.stats['dmg'] || 8) * this.world.currentZone().difficultyMult;
         if (enemy.status.weakness) damage *= (1 - enemy.status.weakness.damageReduction);
         this.playerService.damagePlayer(damage);
         enemy.vx -= Math.cos(angle) * 15; enemy.vy -= Math.sin(angle) * 15;
     }
  }

  private updateFlanker(enemy: Entity, player: Entity, dist: number, angle: number) {
      const accel = 0.5; const flankDir = enemy.id % 2 === 0 ? 1 : -1; const flankAngle = angle + (Math.PI / 2 * flankDir);
      const fx = (Math.cos(angle) * 0.7) + (Math.cos(flankAngle) * 0.3); const fy = (Math.sin(angle) * 0.7) + (Math.sin(flankAngle) * 0.3);
      enemy.vx += fx * accel; enemy.vy += fy * accel;
      this.checkMeleeAttack(enemy, player, dist, angle);
  }

  private updateSkirmisher(enemy: Entity, player: Entity, dist: number, angle: number) {
      const accel = 0.6;
      const angleToEnemy = Math.atan2(enemy.y - player.y, enemy.x - player.x);
      const isBeingAimedAt = Math.abs(angleToEnemy - player.angle) < 0.5; 
      if (isBeingAimedAt && dist < 200) {
          const evadeAngle = angle + Math.PI / 2; enemy.vx += Math.cos(evadeAngle) * accel * 1.5; enemy.vy += Math.sin(evadeAngle) * accel * 1.5;
      } else { enemy.vx += Math.cos(angle) * accel; enemy.vy += Math.sin(angle) * accel; }
      this.checkMeleeAttack(enemy, player, dist, angle);
  }
  
  private updateSniper(enemy: Entity, player: Entity, dist: number, angle: number) {
    if (dist < 300) {
       enemy.vx -= Math.cos(angle) * 0.4; enemy.vy -= Math.sin(angle) * 0.4; enemy.state = 'MOVE'; enemy.timer = 0;
    } else if (dist < 700) {
       enemy.state = 'CHARGE'; if (enemy.timer === undefined) enemy.timer = 0; enemy.timer++;
       if (enemy.timer % 60 === 0) this.sound.play('CHARGE');
       if (enemy.timer > 180) { 
            enemy.timer = 0; this.sound.play('SHOOT');
            let damage = 40 * this.world.currentZone().difficultyMult;
            if (enemy.status.weakness) damage *= (1 - enemy.status.weakness.damageReduction);
            const projectile = this.entityPool.acquire('HITBOX');
            projectile.source = 'ENEMY'; projectile.x = enemy.x; projectile.y = enemy.y; projectile.z = 10;
            projectile.vx = Math.cos(angle) * 15; projectile.vy = Math.sin(angle) * 15;
            projectile.angle = angle; projectile.radius = 8; projectile.hp = damage; projectile.color = '#a855f7'; projectile.state = 'ATTACK'; projectile.timer = 60;
            // FIX: Assign ZoneID to projectile
            projectile.zoneId = enemy.zoneId;
            this.world.entities.push(projectile);
       }
    } else { enemy.vx += Math.cos(angle) * 0.3; enemy.vy += Math.sin(angle) * 0.3; }
  }

  private updateStealth(enemy: Entity, player: Entity, dist: number, angle: number) {
    const isRevealed = dist < 200 || enemy.state === 'ATTACK';
    enemy.color = isRevealed ? '#334155' : 'rgba(51, 65, 85, 0.1)';
    if (dist > 50) {
        enemy.vx += Math.cos(angle) * 0.5; enemy.vy += Math.sin(angle) * 0.5; enemy.state = 'MOVE';
    } else {
         if (enemy.attackTimer === undefined) enemy.attackTimer = 0;
         if (enemy.attackTimer <= 0) {
             let damage = 15 * this.world.currentZone().difficultyMult;
             if (enemy.status.weakness) damage *= (1 - enemy.status.weakness.damageReduction);
             this.playerService.damagePlayer(damage);
             enemy.attackTimer = 60; enemy.state = 'ATTACK';
         }
    }
    if (enemy.attackTimer && enemy.attackTimer > 0) enemy.attackTimer--;
  }
}
