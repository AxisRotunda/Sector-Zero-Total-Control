
import { Injectable, inject } from '@angular/core';
import { Entity } from '../models/game.models';
import { WorldService } from '../game/world/world.service';
import { EntityPoolService } from '../services/entity-pool.service';
import { SpatialHashService } from './spatial-hash.service';
import { ParticleService } from './particle.service';
import { isEnemy } from '../utils/type-guards';

@Injectable({ providedIn: 'root' })
export class NpcUpdateService {
  private world = inject(WorldService);
  private entityPool = inject(EntityPoolService);
  private spatialHash = inject(SpatialHashService);
  private particleService = inject(ParticleService);

  updateTurret(t: Entity) {
      if (t.attackTimer === undefined) t.attackTimer = 0;
      if (t.attackTimer > 0) t.attackTimer--;
      t.angle += 0.02;
      if (t.attackTimer <= 0) {
          const range = 500;
          const targets = this.spatialHash.query(t.x, t.y, range);
          let nearest: Entity | null = null; let minDist = range;
          for (const target of targets) {
              if (isEnemy(target) && target.state !== 'DEAD') {
                  const d = Math.hypot(target.x - t.x, target.y - t.y);
                  if (d < minDist) { minDist = d; nearest = target; }
              }
          }
          if (nearest) {
              const angle = Math.atan2(nearest.y - t.y, nearest.x - t.x);
              t.angle = angle; 
              // Pass zoneId to projectile
              const proj = this.entityPool.acquire('HITBOX', undefined, t.zoneId);
              proj.source = 'DEFENSE'; proj.x = t.x + Math.cos(angle) * 30; proj.y = t.y + Math.sin(angle) * 30; proj.z = 30; 
              proj.vx = Math.cos(angle) * 12; proj.vy = Math.sin(angle) * 12; proj.radius = 5; proj.hp = 50; proj.timer = 60; proj.color = '#38bdf8'; 
              this.world.entities.push(proj); t.attackTimer = 40; 
          }
      }
  }

  updateGuard(g: Entity) {
      this.checkPlayerAwareness(g);

      if (!g.patrolPoints || g.patrolPoints.length === 0) {
          this.animateIdle(g);
          return;
      }
      
      if (g.patrolIndex === undefined) g.patrolIndex = 0;
      const target = g.patrolPoints[g.patrolIndex];
      
      const dx = target.x - g.x;
      const dy = target.y - g.y;
      const dist = Math.hypot(dx, dy);
      
      if (dist < 10) { 
          g.patrolIndex = (g.patrolIndex + 1) % g.patrolPoints.length; 
          // Pause briefly at patrol point
          g.timer = 60; 
          g.state = 'IDLE';
          return; 
      }

      if (g.timer && g.timer > 0) {
          g.timer--;
          this.animateIdle(g);
          return;
      }

      g.state = 'MOVE';
      const angle = Math.atan2(dy, dx);
      // Smooth turn
      const angleDiff = angle - g.angle;
      g.angle += angleDiff * 0.1;
      
      g.vx += Math.cos(angle) * 0.5; 
      g.vy += Math.sin(angle) * 0.5;
      
      this.animateMove(g);
  }

  updateGenericNpc(npc: Entity) {
      this.checkPlayerAwareness(npc);
      this.animateIdle(npc);
  }

  updateCitizen(c: Entity) {
      this.checkPlayerAwareness(c);

      // Wander Logic
      if (c.timer && c.timer > 0) {
          c.timer--;
          // While waiting, just breathe
          this.animateIdle(c);
      } else {
          // If no target, pick one within wanderRadius of home
          if (c.targetX === undefined || c.targetY === undefined) {
              const r = c.aggroRadius || 100; // Reuse aggroRadius as wander radius if not set explicit
              const homeX = c.homeX || c.x;
              const homeY = c.homeY || c.y;
              
              const angle = Math.random() * Math.PI * 2;
              const dist = Math.random() * r;
              
              c.targetX = homeX + Math.cos(angle) * dist;
              c.targetY = homeY + Math.sin(angle) * dist;
              c.state = 'MOVE';
          }

          // Move to target
          const dx = c.targetX - c.x;
          const dy = c.targetY - c.y;
          const dist = Math.hypot(dx, dy);

          if (dist < 5) {
              // Arrived
              c.targetX = undefined;
              c.targetY = undefined;
              c.state = 'IDLE';
              c.timer = 120 + Math.random() * 200; // Pause for 2-5 seconds
          } else {
              const angle = Math.atan2(dy, dx);
              // Smooth rotation
              let diff = angle - c.angle;
              // Normalize angle
              while (diff < -Math.PI) diff += Math.PI * 2;
              while (diff > Math.PI) diff -= Math.PI * 2;
              c.angle += diff * 0.1;

              const speed = 0.3; // Slow walk
              c.vx += Math.cos(angle) * speed;
              c.vy += Math.sin(angle) * speed;
              this.animateMove(c);
          }
      }
  }

  updateOverseerEye(eye: Entity) {
      const player = this.world.player;
      
      // Floating motion
      eye.z = (eye.data?.z || 150) + Math.sin(Date.now() * 0.002) * 10;

      // Track player
      if (eye.data?.trackPlayer) {
          // Calculate angle to player
          eye.angle = Math.atan2(player.y - eye.y, player.x - eye.x);
      }

      // Reactive Color Logic
      const playerHP = player.hp / player.maxHp;
      let targetColor = '#10b981'; // Green (Safe)

      if (playerHP < 0.25) {
          targetColor = '#ef4444'; // Red (Critical)
          // Alarmed spin if player near death
          eye.angle += (Date.now() % 1000) / 100; 
      } else if (playerHP < 0.6) {
          targetColor = '#f59e0b'; // Yellow (Warning)
      }

      // Very simple color lerp via hex is hard, just snapping for now or using property
      eye.color = targetColor;
  }

  // --- Helpers ---

  private checkPlayerAwareness(npc: Entity) {
      const player = this.world.player;
      const dx = player.x - npc.x;
      const dy = player.y - npc.y;
      const dist = Math.hypot(dx, dy);
      
      // Look at player if close but not *too* close (personal space)
      if (dist < 150 && dist > 30) {
          const targetAngle = Math.atan2(dy, dx);
          let diff = targetAngle - npc.angle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          
          // Only turn head/body if moving slowly or idle
          if (Math.abs(npc.vx) < 0.1 && Math.abs(npc.vy) < 0.1) {
              npc.angle += diff * 0.1;
          }
      }
  }

  private animateIdle(npc: Entity) {
      npc.animFrameTimer++;
      if (npc.animFrameTimer > 15) {
          npc.animFrame = (npc.animFrame + 1) % 4;
          npc.animFrameTimer = 0;
      }
  }

  private animateMove(npc: Entity) {
      npc.animFrameTimer++; 
      if (npc.animFrameTimer > 8) { 
          npc.animFrame = (npc.animFrame + 1) % 6; 
          npc.animFrameTimer = 0; 
      }
  }

  updateSteamVent(vent: Entity) {
      vent.timer++;
      if (vent.timer > 240) { vent.timer = 0; vent.state = 'IDLE'; } 
      else if (vent.timer > 180) {
          vent.state = 'ACTIVE';
          if (vent.timer % 5 === 0) this.particleService.addParticles({ x: vent.x + (Math.random()-0.5)*20, y: vent.y + (Math.random()-0.5)*20, z: 0, color: '#fff', count: 2, speed: 6, life: 0.8, size: 4, type: 'circle' });
      } else if (vent.timer > 120) {
          vent.state = 'CHARGE'; 
          if (vent.timer % 10 === 0) this.particleService.addParticles({ x: vent.x, y: vent.y, z: 0, color: '#9ca3af', count: 1, speed: 2, life: 0.5, size: 2, type: 'circle' });
      }
  }

  updateSludge(sludge: Entity, time: number) {
      if (time % 20 === 0) {
          const r = sludge.radius;
          const x = sludge.x + (Math.random() - 0.5) * 2 * r;
          const y = sludge.y + (Math.random() - 0.5) * 2 * r;
          if (Math.hypot(x - sludge.x, y - sludge.y) < r) this.particleService.addParticles({ x: x, y: y, z: 0, color: '#10b981', count: 1, speed: 1, life: 0.6, size: 3, type: 'circle' });
      }
      sludge.status.poison = { duration: 60, dps: 2, timer: 60 };
  }
}
