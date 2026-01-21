import { Injectable, inject } from '@angular/core';
import { WorldService } from './world/world.service';
import { PlayerService } from './player/player.service';

@Injectable({ providedIn: 'root' })
export class CameraService {
  private world = inject(WorldService);
  private playerService = inject(PlayerService);

  update() {
    const player = this.world.player;
    const camera = this.world.camera;
    
    // Smooth follow
    const tx = player.x + player.vx * 15;
    const ty = player.y + player.vy * 15;
    
    camera.x += (tx - camera.x) * 0.05;
    camera.y += (ty - camera.y) * 0.05;

    // Apply Screen Shake
    const shake = this.playerService.screenShake();
    this.playerService.screenShake.update(s => ({
        ...s,
        intensity: s.intensity * s.decay,
        x: s.x * s.decay,
        y: s.y * s.decay
    }));
  }
}