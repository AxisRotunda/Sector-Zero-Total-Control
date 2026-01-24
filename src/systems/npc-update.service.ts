import { Injectable, inject } from '@angular/core';
import { Entity } from '../models/game.models';
import { WorldService } from '../game/world/world.service';
import { EntityPoolService } from '../services/entity-pool.service';
import { SpatialHashService } from './spatial-hash.service';
import { ParticleService } from './particle.service';
import { isEnemy } from '../utils/type-guards';
import { GUARD_BARKS } from '../config/narrative.config';

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
          const targets = this.spatialHash.query(t.x, t.y, range, t.zoneId);
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
              const proj = this.entityPool.acquire('HITBOX', undefined, t.zoneId);
              proj.source = 'DEFENSE'; proj.x = t.x + Math.cos(angle) * 30; proj.y = t.y + Math.sin(angle) * 30; proj.z = 30; 
              proj.vx = Math.cos(angle) * 12; proj.vy = Math.sin(angle) * 12; proj.radius = 5; proj.hp = 50; proj.timer = 60; proj.color = '#38bdf8'; 
              this.world.entities.push(proj); t.attackTimer = 40; 
          }
      }
  }

  updateGuard(g: Entity) {
      this.checkPlayerAwareness(g);
      
      // Behavior Override: Alert / Confront
      if (g.data?.alertBehavior === 'CONFRONT') {
          const p = this.world.player;
          const dist = Math.hypot(p.x - g.x, p.y - g.y);
          // If player is close but not touching, face and move towards
          if (dist < (g.data.detectionRadius || 150) && dist > 50) {
              g.state = 'MOVE';
              const angle = Math.atan2(p.y - g.y, p.x - g.x);
              g.angle = angle;
              const speed = 1.5; // Fast walk
              g.vx += Math.cos(angle) * speed;
              g.vy += Math.sin(angle) * speed;
              this.animateMove(g);
              return; // Override patrol
          } else if (dist <= 50) {
              g.state = 'IDLE'; // Stop at player
              g.angle = Math.atan2(p.y - g.y, p.x - g.x); // Face player
              this.animateIdle(g);
              return;
          }
      }

      this.handleGuardBark(g);

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
          g.timer = 120 + Math.floor(Math.random() * 60); 
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
      const angleDiff = angle - g.angle;
      let d = angleDiff;
      while (d < -Math.PI) d += Math.PI * 2;
      while (d > Math.PI) d -= Math.PI * 2;
      g.angle += d * 0.1;
      
      const speed = 1.0;
      g.vx += Math.cos(angle) * speed; 
      g.vy += Math.sin(angle) * speed;
      
      this.animateMove(g);
  }

  private handleGuardBark(g: Entity) {
      if (!g.data) g.data = {};
      if (g.data.nextBarkTime === undefined) {
          g.data.nextBarkTime = Date.now() + 5000 + Math.random() * 15000;
      }

      if (Date.now() > g.data.nextBarkTime) {
          const text = GUARD_BARKS[Math.floor(Math.random() * GUARD_BARKS.length)];
          if (Math.hypot(this.world.player.x - g.x, this.world.player.y - g.y) < 600) {
              this.world.spawnFloatingText(g.x, g.y - 60, text, '#a5f3fc', 12);
          }
          g.data.nextBarkTime = Date.now() + 15000 + Math.random() * 30000; 
      }
  }

  updateGenericNpc(npc: Entity) {
      this.checkPlayerAwareness(npc);
      this.animateIdle(npc);
  }

  updateCitizen(c: Entity) {
      // NEW BEHAVIOR: 'COWER' - Tremble in place
      if (c.data?.behavior === 'COWER') {
          // Jitter
          c.angle += (Math.random() - 0.5) * 0.1;
          this.animateIdle(c);
          return;
      }

      this.checkPlayerAwareness(c);

      if (c.timer && c.timer > 0) {
          c.timer--;
          this.animateIdle(c);
      } else {
          if (c.targetX === undefined || c.targetY === undefined) {
              const r = c.aggroRadius || 100;
              const homeX = c.homeX || c.x;
              const homeY = c.homeY || c.y;
              const angle = Math.random() * Math.PI * 2;
              const dist = Math.random() * r;
              c.targetX = homeX + Math.cos(angle) * dist;
              c.targetY = homeY + Math.sin(angle) * dist;
              c.state = 'MOVE';
          }

          const dx = c.targetX - c.x;
          const dy = c.targetY - c.y;
          const dist = Math.hypot(dx, dy);

          if (dist < 5) {
              c.targetX = undefined;
              c.targetY = undefined;
              c.state = 'IDLE';
              c.timer = 120 + Math.random() * 200; 
          } else {
              const angle = Math.atan2(dy, dx);
              let diff = angle - c.angle;
              while (diff < -Math.PI) diff += Math.PI * 2;
              while (diff > Math.PI) diff -= Math.PI * 2;
              c.angle += diff * 0.1;

              const speed = 0.3; 
              c.vx += Math.cos(angle) * speed;
              c.vy += Math.sin(angle) * speed;
              this.animateMove(c);
          }
      }
  }

  updateOverseerEye(eye: Entity) {
      const player = this.world.player;
      eye.z = (eye.data?.z || 150) + Math.sin(Date.now() * 0.002) * 10;
      if (eye.data?.trackPlayer) {
          eye.angle = Math.atan2(player.y - eye.y, player.x - eye.x);
      }
      const playerHP = player.hp / player.maxHp;
      let targetColor = '#10b981';
      if (playerHP < 0.25) {
          targetColor = '#ef4444';
          eye.angle += (Date.now() % 1000) / 100; 
      } else if (playerHP < 0.6) {
          targetColor = '#f59e0b';
      }
      eye.color = targetColor;
  }

  private checkPlayerAwareness(npc: Entity) {
      const player = this.world.player;
      const dx = player.x - npc.x;
      const dy = player.y - npc.y;
      const dist = Math.hypot(dx, dy);
      
      const detectionRange = npc.data?.detectionRadius || 150;

      if (dist < detectionRange && dist > 30) {
          const targetAngle = Math.atan2(dy, dx);
          let diff = targetAngle - npc.angle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          
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