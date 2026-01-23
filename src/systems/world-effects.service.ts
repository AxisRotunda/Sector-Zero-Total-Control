
import { Injectable, inject } from '@angular/core';
import { WorldService } from '../game/world/world.service';
import { ParticleService } from './particle.service';

@Injectable({ providedIn: 'root' })
export class WorldEffectsService {
    private world = inject(WorldService);
    private particleService = inject(ParticleService);

    update() {
        this.particleService.update();
        const zone = this.world.currentZone();
        
        if (zone.weather !== 'NONE') {
             this.world.rainDrops.forEach(r => {
                 if (zone.weather === 'SNOW') {
                     // Drifting Snow Logic
                     r.z -= r.speed * 0.3; // Slower fall than rain
                     r.x += r.speed * 1.5; // High wind drift X
                     r.y += r.speed * 0.2; // Slight Y drift
                 } else {
                     // Standard Rain/Ash
                     r.z -= r.speed; 
                     r.x += 1; 
                 }
                 
                 // Wrap particles
                 if (r.z < 0) { 
                     r.z = 500; 
                     r.x = this.world.camera.x - 1000 + Math.random() * 2000; 
                     r.y = this.world.camera.y - 1000 + Math.random() * 2000; 
                 }
             });
        }
        for(let i=this.world.floatingTexts.length-1; i>=0; i--) {
            const t = this.world.floatingTexts[i];
            t.y -= t.vy; t.life -= 0.02;
            if (t.life <= 0) this.world.floatingTexts.splice(i, 1);
        }
    }
}
