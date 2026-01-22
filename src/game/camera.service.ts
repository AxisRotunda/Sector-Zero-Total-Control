
import { Injectable, inject } from '@angular/core';
import { WorldService } from './world/world.service';
import { PlayerService } from './player/player.service';
import { InputService } from '../services/input.service';
import { RENDER_CONFIG } from '../systems/rendering/render.config';

@Injectable({ providedIn: 'root' })
export class CameraService {
  private world = inject(WorldService);
  private playerService = inject(PlayerService);
  private input = inject(InputService);

  private targetZoom = RENDER_CONFIG.CAMERA.BASE_ZOOM;

  constructor() {
      // Subscribe to Input Zoom events (Wheel / Pinch)
      this.input.zoomEvents.subscribe((delta) => {
          // Normalize delta roughly between wheels and pinches
          const sensitivity = RENDER_CONFIG.CAMERA.WHEEL_SENSITIVITY; 
          this.targetZoom -= delta * sensitivity;
          
          // Clamp
          this.targetZoom = Math.max(RENDER_CONFIG.CAMERA.MIN_ZOOM, Math.min(RENDER_CONFIG.CAMERA.MAX_ZOOM, this.targetZoom));
      });
  }

  update() {
    const player = this.world.player;
    const camera = this.world.camera;
    
    // Smooth follow with slight look-ahead based on velocity
    // Look ahead more when moving fast
    const lookAheadX = player.vx * 20; 
    const lookAheadY = player.vy * 20;
    
    const tx = player.x + lookAheadX;
    const ty = player.y + lookAheadY;
    
    // Smooth Damping for Position
    camera.x += (tx - camera.x) * 0.08;
    camera.y += (ty - camera.y) * 0.08;

    // Smooth Damping for Zoom
    if (Math.abs(camera.zoom - this.targetZoom) > 0.001) {
        camera.zoom += (this.targetZoom - camera.zoom) * RENDER_CONFIG.CAMERA.SMOOTH_FACTOR;
    }

    // Apply Screen Shake
    const shake = this.playerService.screenShake();
    if (shake.intensity > 0.1) {
        // Shake decays over time
        this.playerService.screenShake.update(s => ({
            ...s,
            intensity: s.intensity * s.decay,
            x: s.x * s.decay,
            y: s.y * s.decay
        }));
    }
  }
}
