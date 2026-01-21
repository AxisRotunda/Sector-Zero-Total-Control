
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
          // FIX: Pass t.zoneId
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
              const proj = this.entityPool.acquire('HITBOX');
              proj.source = 'DEFENSE'; proj.x = t.x + Math.cos(angle) * 30; proj.y = t.y + Math.sin(angle) * 30; proj.z = 30; 
              proj.vx = Math.cos(angle) * 12; proj.vy = Math.sin(angle) * 12; proj.radius = 5; proj.hp = 50; proj.timer = 60; proj.color = '#38bdf8'; 
              // FIX: Assign ZoneID
              proj.zoneId = t.zoneId;
              this.world.entities.push(proj); t.attackTimer = 40; 
          }
      }
  }

  updateGuard(g: Entity) {
      if (!g.patrolPoints || g.patrolPoints.length === 0) {
          // Idle animation if static guard
          g.animFrameTimer++; 
          if (g.animFrameTimer > 12) { g.animFrame = (g.animFrame + 1) % 4; g.animFrameTimer = 0; }
          return;
      }
      if (g.patrolIndex === undefined) g.patrolIndex = 0;
      const target = g.patrolPoints[g.patrolIndex];
      const dist = Math.hypot(target.x - g.x, target.y - g.y);
      if (dist < 10) { g.patrolIndex = (g.patrolIndex + 1) % g.patrolPoints.length; g.state = 'IDLE'; return; }
      g.state = 'MOVE';
      const angle = Math.atan2(target.y - g.y, target.x - g.x);
      g.angle = angle; g.vx += Math.cos(angle) * 0.5; g.vy += Math.sin(angle) * 0.5;
      g.animFrameTimer++; if (g.animFrameTimer > 6) { g.animFrame = (g.animFrame + 1) % 6; g.animFrameTimer = 0; }
  }

  updateGenericNpc(npc: Entity) {
      // Basic idle breathing
      npc.animFrameTimer++;
      if (npc.animFrameTimer > 15) {
          npc.animFrame = (npc.animFrame + 1) % 4;
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
