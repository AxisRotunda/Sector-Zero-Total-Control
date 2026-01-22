
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
          // Dynamic Sensitivity: Scale sensitivity based on current zoom level
          // When Zoomed IN (High Value), we want higher sensitivity.
          // When Zoomed OUT (Low Value), we want lower sensitivity for fine tuning.
          const config = RENDER_CONFIG.CAMERA;
          const range = config.MAX_ZOOM - config.MIN_ZOOM;
          const zoomProgress = (this.targetZoom - config.MIN_ZOOM) / range; // 0 to 1
          
          // Lerp between Min and Max sensitivity
          const sensitivity = config.MIN_ZOOM_SENSITIVITY + 
              (config.MAX_ZOOM_SENSITIVITY - config.MIN_ZOOM_SENSITIVITY) * zoomProgress;

          this.targetZoom -= delta * sensitivity;
          
          // Clamp
          this.targetZoom = Math.max(config.MIN_ZOOM, Math.min(config.MAX_ZOOM, this.targetZoom));
      });
  }

  update() {
    const player = this.world.player;
    const camera = this.world.camera;
    const config = RENDER_CONFIG.CAMERA;
    
    // --- 1. Zoom-Responsive Look-Ahead ---
    // Look ahead more when zoomed out (Tactical view) to see off-screen threats
    const zoomFactor = 1 / Math.max(0.1, camera.zoom); 
    const lookAheadX = player.vx * config.LOOK_AHEAD_DIST * zoomFactor;
    const lookAheadY = player.vy * config.LOOK_AHEAD_DIST * zoomFactor;
    
    const targetX = player.x + lookAheadX;
    const targetY = player.y + lookAheadY;
    
    // --- 2. World Bounds Checking ---
    const bounds = this.world.mapBounds;
    // Clamp the target position to the world edges
    // We add a margin so the player doesn't have to hug the wall to see it
    const margin = 100;
    const clampedX = Math.max(bounds.minX + margin, Math.min(bounds.maxX - margin, targetX));
    const clampedY = Math.max(bounds.minY + margin, Math.min(bounds.maxY - margin, targetY));

    // --- 3. Smooth Damping for Position ---
    camera.x += (clampedX - camera.x) * config.POSITION_DAMPING;
    camera.y += (clampedY - camera.y) * config.POSITION_DAMPING;

    // --- 4. Smooth Damping for Zoom ---
    if (Math.abs(camera.zoom - this.targetZoom) > 0.001) {
        camera.zoom += (this.targetZoom - camera.zoom) * config.SMOOTH_FACTOR;
    }

    // --- 5. Apply Screen Shake ---
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
