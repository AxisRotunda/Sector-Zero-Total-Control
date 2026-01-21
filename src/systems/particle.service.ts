import { Injectable } from '@angular/core';
import { Particle } from '../models/game.models';
import { ObjectPool } from '../utils/object-pool';
import * as BALANCE from '../config/balance.config';

export interface ParticleOptions {
    x: number; y: number; z: number; color: string; count: number; speed: number;
    life?: number; size?: number; type?: 'circle' | 'square' | 'star' | 'spark'; composite?: GlobalCompositeOperation;
}

@Injectable({ providedIn: 'root' })
export class ParticleService {
  public particles: Particle[] = [];
  private particlePool: ObjectPool<Particle>;

  constructor() {
    this.particlePool = new ObjectPool<Particle>(
      () => ({ x:0, y:0, z:0, vx:0, vy:0, vz:0, color:'', life:0, sizeStart:0, sizeEnd:0, alphaStart:0, alphaEnd:0, shape:'circle', rotation:0, rotSpeed:0 }),
      (p) => { p.life = 0; p.composite = undefined; return p; },
      300
    );
  }

  reset() { this.particlePool.releaseAll(); this.particles = []; }

  addParticles(opts: ParticleOptions) {
      for(let i=0; i<opts.count; i++) {
          const a = Math.random() * Math.PI * 2;
          const s = Math.random() * opts.speed;
          const p = this.particlePool.acquire();
          p.x = opts.x; p.y = opts.y; p.z = opts.z;
          p.vx = Math.cos(a)*s; p.vy = Math.sin(a)*s; p.vz = Math.random() * 5;
          p.color = opts.color; p.life = opts.life || 1.0;
          p.sizeStart = opts.size || 2; p.sizeEnd = 0; p.alphaStart = 1; p.alphaEnd = 0;
          p.shape = opts.type || 'circle'; p.rotation = Math.random() * 360; p.rotSpeed = (Math.random() - 0.5) * 10;
          p.composite = opts.composite;
          this.particles.push(p);
      }
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