
import { Injectable, inject } from '@angular/core';
import { Entity } from '../models/game.models';
import { SpatialHashService } from './spatial-hash.service';
import { ChunkManagerService } from '../game/world/chunk-manager.service';
import { isDestructible } from '../utils/type-guards';
import * as BALANCE from '../config/balance.config';
import { WorldService } from '../game/world/world.service';
import { ParticleService } from './particle.service';

@Injectable({ providedIn: 'root' })
export class PhysicsService {
  private spatialHash = inject(SpatialHashService);
  private chunkManager = inject(ChunkManagerService);
  private world = inject(WorldService);
  private particleService = inject(ParticleService);

  private readonly SPATIAL_BUFFER_RATIO = 1.5;
  private readonly COLLISION_QUERY_RATIO = 1.5; 
  private readonly MIN_SEPARATION_FORCE = 0.01;
  private readonly MAX_SEPARATION_NEIGHBORS = 6; 

  public updateEntityPhysics(e: Entity, stats?: { speed: number }, inputVec?: { x: number, y: number }): boolean {
    const isPlayer = e.type === 'PLAYER';
    
    const ACCELERATION = isPlayer ? 3.0 : 2.0; 
    const FRICTION_MOVING = 0.85; 
    const FRICTION_STOPPING = 0.6; 
    
    const hasInput = isPlayer && inputVec && (Math.abs(inputVec.x) > 0.01 || Math.abs(inputVec.y) > 0.01);

    if (hasInput && stats) {
        const MAX_SPEED = BALANCE.PLAYER.BASE_SPEED + (stats.speed * BALANCE.PLAYER.SPEED_STAT_SCALE);
        e.vx += inputVec!.x * ACCELERATION; 
        e.vy += inputVec!.y * ACCELERATION;
        
        const currentSpeed = Math.hypot(e.vx, e.vy);
        if (currentSpeed > MAX_SPEED) { 
            const scale = MAX_SPEED / currentSpeed; 
            e.vx *= scale; 
            e.vy *= scale; 
        }
    }

    if ((e.type === 'ENEMY' || e.type === 'PLAYER') && e.state !== 'DEAD') {
        const zoneId = this.world.currentZone().id;
        const queryRadius = e.radius * this.SPATIAL_BUFFER_RATIO;
        
        // Use default buffer (0) for outer separation loop
        const { buffer, count } = this.spatialHash.queryFast(e.x, e.y, queryRadius, zoneId, 0);
        
        let processedNeighbors = 0;

        for (let i = 0; i < count; i++) {
            const n = buffer[i];
            if (processedNeighbors >= this.MAX_SEPARATION_NEIGHBORS) break;
            if (n.id === e.id || n.state === 'DEAD' || n.type === 'WALL' || n.type === 'DECORATION' || n.type === 'PICKUP') continue;
            
            const minDist = e.radius + n.radius;
            const distSq = (e.x - n.x)**2 + (e.y - n.y)**2;
            
            if (distSq < minDist * minDist && distSq > 0.01) {
                const dist = Math.sqrt(distSq);
                const pushStrength = (minDist - dist) / dist; 
                const force = 0.2; 
                
                const px = (e.x - n.x) * pushStrength * force;
                const py = (e.y - n.y) * pushStrength * force;
                
                if (Math.abs(px) < this.MIN_SEPARATION_FORCE && Math.abs(py) < this.MIN_SEPARATION_FORCE) continue;

                e.vx += px;
                e.vy += py;
                processedNeighbors++;
            }
        }
    }

    const friction = hasInput ? FRICTION_MOVING : FRICTION_STOPPING;
    
    e.vx *= friction; 
    e.vy *= friction;
    
    if (Math.abs(e.vx) < 0.1) e.vx = 0; 
    if (Math.abs(e.vy) < 0.1) e.vy = 0;
    
    const isMoving = Math.abs(e.vx) > 0.1 || Math.abs(e.vy) > 0.1;
    if (!isMoving) return false;

    // Sub-stepping for collision
    const r = e.radius || 20;
    const speed = Math.hypot(e.vx, e.vy);
    const steps = Math.ceil(speed / (r * 0.5));
    
    const stepVx = e.vx / steps;
    const stepVy = e.vy / steps;

    for (let i = 0; i < steps; i++) {
        const prevX = e.x;
        const prevY = e.y;
        
        e.x += stepVx;
        e.y += stepVy;
        
        // Find obstacle
        const obstacle = this.getCollidingEntity(e);
        
        if (obstacle) {
            // Impact effects
            if (isPlayer && speed > 5) this.spawnWallImpact(e);

            // 1. Revert to position before collision to un-stick
            e.x = prevX;
            e.y = prevY;

            // 2. Calculate Slide Normal
            const normal = this.getCollisionNormal(e, obstacle);
            
            // 3. Project velocity along wall surface (remove normal component)
            // v_new = v - (v . n) * n
            const dot = e.vx * normal.x + e.vy * normal.y;
            
            // Apply friction coefficient to sliding to prevent infinite slide
            e.vx -= dot * normal.x;
            e.vy -= dot * normal.y;
            
            // Slight damping on impact
            e.vx *= 0.9;
            e.vy *= 0.9;
            
            // 4. Re-apply step with NEW projected velocity so we don't freeze for a frame
            const projectedStepX = (e.vx / steps);
            const projectedStepY = (e.vy / steps);
            e.x += projectedStepX;
            e.y += projectedStepY;

            // Push out of overlap (Slop recovery)
            // For walls (AABB), strict pushout is handled by revert + slide
            // For Circles, we might want to push explicitly if we are still stuck
            if (obstacle.type !== 'WALL') {
                const dx = e.x - obstacle.x;
                const dy = e.y - obstacle.y;
                const dist = Math.hypot(dx, dy);
                const overlap = (e.radius + (obstacle.radius || 20)) - dist;
                if (overlap > 0 && dist > 0) {
                    e.x += normal.x * overlap * 0.5;
                    e.y += normal.y * overlap * 0.5;
                }
            }
        }

        const bounds = this.world.mapBounds;
        if (e.x < bounds.minX + r) { e.x = bounds.minX + r; e.vx = 0; }
        if (e.x > bounds.maxX - r) { e.x = bounds.maxX - r; e.vx = 0; }
        if (e.y < bounds.minY + r) { e.y = bounds.minY + r; e.vy = 0; }
        if (e.y > bounds.maxY - r) { e.y = bounds.maxY - r; e.vy = 0; }
    }
    
    if (isPlayer && isMoving && e.trail && performance.now() % 5 === 0) {
        e.trail.push({x: e.x, y: e.y, alpha: 0.2});
    }
    
    return isMoving;
}

  private spawnWallImpact(e: Entity) {
      if (!e.data) e.data = {};
      const now = Date.now();
      if (e.data.lastWallHit && now - e.data.lastWallHit < 200) return;
      
      e.data.lastWallHit = now;
      this.particleService.addParticles({
          x: e.x,
          y: e.y,
          z: 20,
          color: '#06b6d4',
          count: 3,
          speed: 1,
          size: 2,
          type: 'square',
          life: 0.4
      });
  }

  private getCollidingEntity(e: Entity): Entity | null {
      const radius = e.radius || 20;
      const zoneId = this.world.currentZone().id;
      const queryRadius = radius * this.COLLISION_QUERY_RATIO;
      
      // Use buffer 1 to avoid overlap with outer physics loop
      const { buffer, count } = this.spatialHash.queryFast(e.x, e.y, queryRadius, zoneId, 1); 
      
      // Check Static Walls
      const { buffer: staticBuffer, count: staticCount } = this.chunkManager.getVisibleStaticEntities(
          { x: e.x, y: e.y, zoom: 1 } as any, 
          1000, 1000 
      );

      // 1. Static Check
      for (let i = 0; i < staticCount; i++) {
          const obs = staticBuffer[i];
          if (obs.type === 'WALL') {
              if (obs.locked === false) continue; 
              if (this.checkAABBOverlap(e, obs)) return obs;
          }
      }

      // 2. Dynamic Check
      for (let i = 0; i < count; i++) {
          const obs = buffer[i];
          if (obs.id === e.id) continue;
          
          if (isDestructible(obs) && obs.state !== 'DEAD') {
              const obsR = obs.radius || 20;
              const dist = Math.hypot(e.x - obs.x, e.y - obs.y);
              if (dist < radius + obsR) return obs;
          }
          
          // Also check dynamic walls (gates)
          if (obs.type === 'WALL' && obs.locked !== false) {
              if (this.checkAABBOverlap(e, obs)) return obs;
          }
      }
      
      return null;
  }

  private checkAABBOverlap(e: Entity, wall: Entity): boolean {
      const colW = wall.width || 40;
      const colD = wall.depth ?? (wall.width || 40);
      const halfW = colW / 2;
      const halfD = colD / 2;
      
      const closestX = Math.max(wall.x - halfW, Math.min(e.x, wall.x + halfW));
      const closestY = Math.max(wall.y - halfD, Math.min(e.y, wall.y + halfD));
      
      const dx = e.x - closestX;
      const dy = e.y - closestY;
      const distSq = dx * dx + dy * dy;
      
      return distSq < (e.radius * e.radius) - 0.1;
  }

  private getCollisionNormal(e: Entity, obstacle: Entity): { x: number, y: number } {
      if (obstacle.type === 'WALL') {
          // AABB Normal Logic
          const halfW = (obstacle.width || 40) / 2;
          const halfD = (obstacle.depth || 40) / 2;
          
          const dx = e.x - obstacle.x;
          const dy = e.y - obstacle.y;
          
          // Calculate penetration depth on each axis relative to bounds
          const px = halfW + e.radius - Math.abs(dx);
          const py = halfD + e.radius - Math.abs(dy);
          
          // If penetration on X is shallower, collision is horizontal (normal is X)
          if (px < py) {
              return { x: Math.sign(dx), y: 0 };
          } else {
              return { x: 0, y: Math.sign(dy) };
          }
      } else {
          // Circle Logic
          const dx = e.x - obstacle.x;
          const dy = e.y - obstacle.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist === 0) return { x: 0, y: 1 }; // Fallback
          return { x: dx / dist, y: dy / dist };
      }
  }
}
