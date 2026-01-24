
import { Injectable, inject } from '@angular/core';
import { Particle } from '../models/game.models';
import { ObjectPool } from '../utils/object-pool';
import * as BALANCE from '../config/balance.config';
import { PerformanceManagerService } from '../game/performance-manager.service';

export interface ParticleOptions {
    x: number; y: number; z: number; color: string; count: number; speed: number;
    life?: number; size?: number; type?: 'circle' | 'square' | 'star' | 'spark'; composite?: GlobalCompositeOperation;
    emitsLight?: boolean;
    priority?: number; // Higher = more important
}

@Injectable({ providedIn: 'root' })
export class ParticleService {
  private performanceManager = inject(PerformanceManagerService);
  public particles: Particle[] = [];
  private particlePool: ObjectPool<Particle>;

  constructor() {
    this.particlePool = new ObjectPool<Particle>(
      () => ({ x:0, y:0, z:0, vx:0, vy:0, vz:0, color:'', life:0, sizeStart:0, sizeEnd:0, alphaStart:0, alphaEnd:0, shape:'circle', rotation:0, rotSpeed:0 }),
      (p) => { 
          p.life = 0; 
          p.composite = undefined; 
          p.emitsLight = false;
          p.priority = 0; 
          return p; 
      },
      300
    );
  }

  reset() { this.particlePool.releaseAll(); this.particles = []; }

  addParticles(opts: ParticleOptions) {
      const composite = opts.composite || 'source-over';
      const priority = opts.priority ?? 1;
      const limit = this.performanceManager.particleLimit();

      for(let i=0; i<opts.count; i++) {
          // Priority Culling: If at limit, try to replace low priority particle
          let particleToUse: Particle | null = null;

          if (this.particles.length >= limit) {
              // Find lowest priority particle
              let lowestIndex = -1;
              let lowestPriority = Infinity;
              
              // Optimization: Check random subset instead of full scan if list is huge
              // But for <1000 particles, linear scan is okay.
              // Scan backwards to favor keeping newer particles? No, favor priority.
              for (let j = 0; j < this.particles.length; j++) {
                  const p = this.particles[j];
                  const pPrio = p.priority ?? 1;
                  if (pPrio < lowestPriority) {
                      lowestPriority = pPrio;
                      lowestIndex = j;
                  }
                  // Early exit if we find something strictly lower than new priority
                  if (lowestPriority < priority) break;
              }

              if (lowestIndex !== -1 && lowestPriority < priority) {
                  // Replace it
                  particleToUse = this.particles[lowestIndex];
                  // Remove from current position to re-insert sorted later
                  this.particles.splice(lowestIndex, 1);
                  this.particlePool.release(particleToUse); // Reset it
                  particleToUse = this.particlePool.acquire();
              } else {
                  // Cannot spawn, budget full and no lower priority targets
                  continue;
              }
          } else {
              particleToUse = this.particlePool.acquire();
          }

          if (!particleToUse) continue;

          const p = particleToUse;
          const a = Math.random() * Math.PI * 2;
          const s = Math.random() * opts.speed;
          
          p.x = opts.x; p.y = opts.y; p.z = opts.z;
          p.vx = Math.cos(a)*s; p.vy = Math.sin(a)*s; p.vz = Math.random() * 5;
          p.color = opts.color; p.life = opts.life || 1.0;
          p.sizeStart = opts.size || 2; p.sizeEnd = 0; p.alphaStart = 1; p.alphaEnd = 0;
          p.shape = opts.type || 'circle'; p.rotation = Math.random() * 360; p.rotSpeed = (Math.random() - 0.5) * 10;
          p.composite = composite;
          p.emitsLight = opts.emitsLight;
          p.priority = priority;
          
          this.insertSorted(p);
      }
  }

  // Insert particle keeping the array sorted by composite mode
  private insertSorted(particle: Particle) {
      const comp = particle.composite || 'source-over';
      
      if (this.particles.length === 0) {
          this.particles.push(particle);
          return;
      }

      let index = 0;
      while (index < this.particles.length) {
          const currentComp = this.particles[index].composite || 'source-over';
          if (currentComp.localeCompare(comp) >= 0) {
              break;
          }
          index++;
      }
      this.particles.splice(index, 0, particle);
  }

  update() {
    for(let i=this.particles.length-1; i>=0; i--) {
        const p = this.particles[i];
        p.x += p.vx; p.y += p.vy; p.z += p.vz;
        p.vz -= BALANCE.PARTICLE.GRAVITY; 
        if (p.z < 0) { p.z = 0; p.vx *= 0.5; p.vy *= 0.5; }
        p.life -= BALANCE.PARTICLE.LIFESPAN_DECAY;
        p.rotation += p.rotSpeed;
        if (p.life <= 0) { this.particlePool.release(p); this.particles.splice(i, 1); }
    }
  }
}
