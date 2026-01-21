
import { Injectable, inject } from '@angular/core';
import { Entity } from '../models/game.models';
import { SpatialHashService } from './spatial-hash.service';
import { ChunkManagerService } from '../game/world/chunk-manager.service';
import { isDestructible } from '../utils/type-guards';
import * as BALANCE from '../config/balance.config';
import { WorldService } from '../game/world/world.service';

@Injectable({ providedIn: 'root' })
export class PhysicsService {
  private spatialHash = inject(SpatialHashService);
  private chunkManager = inject(ChunkManagerService);
  private world = inject(WorldService);

  public updateEntityPhysics(e: Entity, stats?: { speed: number }, inputVec?: { x: number, y: number }): boolean {
    const ACCELERATION = 2.0; 
    const FRICTION = 0.80; 
    const isPlayer = e.type === 'PLAYER';
    
    // 1. Input Acceleration
    if (isPlayer && inputVec && stats) {
        const MAX_SPEED = BALANCE.PLAYER.BASE_SPEED + (stats.speed * BALANCE.PLAYER.SPEED_STAT_SCALE);
        if (Math.hypot(inputVec.x, inputVec.y) > 0.01) {
            e.vx += inputVec.x * ACCELERATION; 
            e.vy += inputVec.y * ACCELERATION;
        }
        const currentSpeed = Math.hypot(e.vx, e.vy);
        if (currentSpeed > MAX_SPEED) { 
            const scale = MAX_SPEED / currentSpeed; 
            e.vx *= scale; 
            e.vy *= scale; 
        }
    }

    // 1.5 Separation / Steering Behaviors
    if ((e.type === 'ENEMY' || e.type === 'PLAYER') && e.state !== 'DEAD') {
        const zoneId = this.world.currentZone().id;
        const neighbors = this.spatialHash.query(e.x, e.y, e.radius * 1.5, zoneId);
        for (const n of neighbors) {
            if (n.id === e.id || n.state === 'DEAD' || n.type === 'WALL' || n.type === 'DECORATION' || n.type === 'PICKUP') continue;
            
            const minDist = e.radius + n.radius;
            const distSq = (e.x - n.x)**2 + (e.y - n.y)**2;
            
            if (distSq < minDist * minDist && distSq > 0.01) {
                const dist = Math.sqrt(distSq);
                const pushStrength = (minDist - dist) / dist; 
                const force = 0.2; 
                
                const px = (e.x - n.x) * pushStrength * force;
                const py = (e.y - n.y) * pushStrength * force;
                
                e.vx += px;
                e.vy += py;
            }
        }
    }

    // 2. Friction
    e.vx *= FRICTION; 
    e.vy *= FRICTION;
    if (Math.abs(e.vx) < 0.1) e.vx = 0; 
    if (Math.abs(e.vy) < 0.1) e.vy = 0;
    
    const isMoving = Math.abs(e.vx) > 0.1 || Math.abs(e.vy) > 0.1;
    if (!isMoving) return false;

    // 3. Sub-stepping for Collision Stability & Wall Sliding
    const r = e.radius || 20;
    const speed = Math.hypot(e.vx, e.vy);
    const steps = Math.ceil(speed / (r * 0.5));
    
    const stepVx = e.vx / steps;
    const stepVy = e.vy / steps;

    for (let i = 0; i < steps; i++) {
        const prevX = e.x;
        e.x += stepVx;
        if (this.checkCollision(e)) {
            e.x = prevX;
            e.vx = 0;
        }

        const prevY = e.y;
        e.y += stepVy;
        if (this.checkCollision(e)) {
            e.y = prevY;
            e.vy = 0;
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

  private checkCollision(e: Entity): boolean {
      const radius = e.radius || 20;
      const zoneId = this.world.currentZone().id;
      
      // Check Dynamic Entities via Spatial Hash
      const nearbyDynamic = this.spatialHash.query(e.x, e.y, radius + 20, zoneId); 
      
      // Check Static Entities via Chunk Manager
      // We simulate a camera at entity position to reuse the chunk logic (hacky but efficient reuse)
      const nearbyStatic = this.chunkManager.getVisibleStaticEntities({ x: e.x, y: e.y, zoom: 1 }, 200, 200);

      const candidates = [...nearbyDynamic, ...nearbyStatic];

      for (const obs of candidates) {
          if (obs.id === e.id) continue;
          
          if (obs.type === 'WALL' || (isDestructible(obs) && obs.state !== 'DEAD')) {
              if (obs.type === 'WALL' && obs.locked === false) continue;

              const colW = obs.width;
              const colH = obs.depth || obs.height; 

              if (colW && colH) {
                  // AABB vs Circle
                  const halfW = colW / 2;
                  const halfH = colH / 2;
                  
                  const closestX = Math.max(obs.x - halfW, Math.min(e.x, obs.x + halfW));
                  const closestY = Math.max(obs.y - halfH, Math.min(e.y, obs.y + halfH));
                  
                  const dx = e.x - closestX;
                  const dy = e.y - closestY;
                  const distSq = dx * dx + dy * dy;
                  
                  if (distSq < (radius * radius) - 0.1) {
                      return true;
                  }
              } else {
                  // Circle vs Circle
                  const obsR = obs.radius || 20;
                  const dist = Math.hypot(e.x - obs.x, e.y - obs.y);
                  if (dist < radius + obsR) {
                      return true;
                  }
              }
          }
      }
      return false;
  }
}
