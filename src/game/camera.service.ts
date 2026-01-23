
import { Injectable, inject, computed } from '@angular/core';
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
  
  // Maximum distance the mouse can offset the camera (screen pixels approx)
  private readonly MOUSE_PEEK_DISTANCE = 300; 

  // Signal for UI scaling based on zoom, useful for keeping UI elements consistent size
  // or adapting them to the view depth.
  uiScale = computed(() => {
      const z = this.world.camera.zoom;
      // Inverse scale clamped to sane limits
      return Math.max(0.8, Math.min(1.2, 1 / z));
  });

  constructor() {
      // Subscribe to Input Zoom events (Wheel / Pinch)
      this.input.zoomEvents.subscribe((delta) => {
          // Dynamic Sensitivity: Scale sensitivity based on current zoom level
          // When Zoomed IN (High Value), we want higher sensitivity for twitch adjustments.
          // When Zoomed OUT (Low Value), we want lower sensitivity for broad tactical framing.
          const config = RENDER_CONFIG.CAMERA;
          const range = config.MAX_ZOOM - config.MIN_ZOOM;
          
          // 0.0 (Zoomed out completely) to 1.0 (Zoomed in completely)
          const zoomProgress = (this.targetZoom - config.MIN_ZOOM) / range; 
          
          // Interpolate sensitivity
          const sensitivity = config.MIN_ZOOM_SENSITIVITY + 
              (config.MAX_ZOOM_SENSITIVITY - config.MIN_ZOOM_SENSITIVITY) * zoomProgress;

          this.targetZoom -= delta * sensitivity;
          
          // Hard Clamp
          this.targetZoom = Math.max(config.MIN_ZOOM, Math.min(config.MAX_ZOOM, this.targetZoom));
      });
  }

  update() {
    const player = this.world.player;
    const camera = this.world.camera;
    const config = RENDER_CONFIG.CAMERA;
    
    // --- 1. Zoom-Responsive Look-Ahead ---
    // The "Eye of the Operator" projects focus forward based on velocity.
    // This projection scales inversely with zoom: when zoomed out (Tactical), we look further ahead.
    const zoomFactor = 1.0 + (1.0 - camera.zoom) * 0.5;
    
    const lookAheadX = player.vx * config.LOOK_AHEAD_DIST * zoomFactor;
    const lookAheadY = player.vy * config.LOOK_AHEAD_DIST * zoomFactor;
    
    let rawTargetX = player.x + lookAheadX;
    let rawTargetY = player.y + lookAheadY;
    
    // --- 1.5. Mouse Cursor Peeking (PC Optimization) ---
    // Allows the player to "Look" towards the mouse cursor without moving
    if (this.input.usingKeyboard()) {
        const cursor = this.input.cursorRelative;
        // Non-linear peek: Only engaging when cursor moves away from center
        const peekX = Math.sign(cursor.x) * Math.pow(Math.abs(cursor.x), 2) * this.MOUSE_PEEK_DISTANCE;
        const peekY = Math.sign(cursor.y) * Math.pow(Math.abs(cursor.y), 2) * this.MOUSE_PEEK_DISTANCE;
        
        // Scale peek by zoom level (look further when zoomed out)
        rawTargetX += peekX / camera.zoom;
        rawTargetY += peekY / camera.zoom;
    }

    // --- 2. Soft-Clamp Bounds ---
    // We clamp the TARGET, not the camera position directly. 
    // This allows the damping (lerp) to naturally decelerate the camera as it approaches the "wall"
    const bounds = this.world.mapBounds;
    const margin = config.BOUNDS_MARGIN;
    
    const clampedTargetX = Math.max(bounds.minX + margin, Math.min(bounds.maxX - margin, rawTargetX));
    const clampedTargetY = Math.max(bounds.minY + margin, Math.min(bounds.maxY - margin, rawTargetY));

    // --- 3. Smooth Damping (Lerp) ---
    // Interpolate current position towards the clamped target.
    camera.x += (clampedTargetX - camera.x) * config.POSITION_DAMPING;
    camera.y += (clampedTargetY - camera.y) * config.POSITION_DAMPING;

    // --- 4. Smooth Zoom Damping ---
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
