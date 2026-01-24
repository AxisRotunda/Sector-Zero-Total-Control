
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
  private targetRotation = 0;
  
  // Public cached trig values to avoid per-frame recalc in other services
  public rotationCos = 1;
  public rotationSin = 0;
  
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
      const config = RENDER_CONFIG.CAMERA;

      // Subscribe to Input Zoom events (Wheel / Pinch)
      this.input.zoomEvents.subscribe((delta) => {
          // Dynamic Sensitivity: Scale sensitivity based on current zoom level
          const range = config.MAX_ZOOM - config.MIN_ZOOM;
          const zoomProgress = (this.targetZoom - config.MIN_ZOOM) / range; 
          
          // Interpolate sensitivity
          const sensitivity = config.MIN_ZOOM_SENSITIVITY + 
              (config.MAX_ZOOM_SENSITIVITY - config.MIN_ZOOM_SENSITIVITY) * zoomProgress;

          this.targetZoom -= delta * sensitivity;
          
          // Hard Clamp
          this.targetZoom = Math.max(config.MIN_ZOOM, Math.min(config.MAX_ZOOM, this.targetZoom));
      });

      // Subscribe to Rotation events
      this.input.rotationEvents.subscribe((deltaRadians) => {
          this.targetRotation += deltaRadians * config.ROTATION_SENSITIVITY;
      });
  }

  update() {
    const player = this.world.player;
    const camera = this.world.camera;
    const config = RENDER_CONFIG.CAMERA;
    
    // --- 1. Zoom-Responsive Look-Ahead ---
    const zoomFactor = 1.0 + (1.0 - camera.zoom) * 0.5;
    
    const lookAheadX = player.vx * config.LOOK_AHEAD_DIST * zoomFactor;
    const lookAheadY = player.vy * config.LOOK_AHEAD_DIST * zoomFactor;
    
    let rawTargetX = player.x + lookAheadX;
    let rawTargetY = player.y + lookAheadY;
    
    // --- 1.5. Mouse Cursor Peeking (PC Optimization) ---
    if (this.input.usingKeyboard()) {
        const cursor = this.input.cursorRelative;
        const peekX = Math.sign(cursor.x) * Math.pow(Math.abs(cursor.x), 2) * this.MOUSE_PEEK_DISTANCE;
        const peekY = Math.sign(cursor.y) * Math.pow(Math.abs(cursor.y), 2) * this.MOUSE_PEEK_DISTANCE;
        
        // WorldVec = Rotate(ScreenVec, -CameraAngle)
        const cos = Math.cos(-camera.rotation);
        const sin = Math.sin(-camera.rotation);
        
        const worldPeekX = peekX * cos - peekY * sin;
        const worldPeekY = peekX * sin + peekY * cos;

        rawTargetX += worldPeekX / camera.zoom;
        rawTargetY += worldPeekY / camera.zoom;
    }

    // --- 2. Soft-Clamp Bounds ---
    const bounds = this.world.mapBounds;
    const margin = config.BOUNDS_MARGIN;
    
    const clampedTargetX = Math.max(bounds.minX + margin, Math.min(bounds.maxX - margin, rawTargetX));
    const clampedTargetY = Math.max(bounds.minY + margin, Math.min(bounds.maxY - margin, rawTargetY));

    // --- 3. Smooth Damping (Lerp) ---
    const DAMPING = 0.06;
    camera.x += (clampedTargetX - camera.x) * DAMPING;
    camera.y += (clampedTargetY - camera.y) * DAMPING;

    // --- 4. Smooth Zoom & Rotation Damping ---
    if (Math.abs(camera.zoom - this.targetZoom) > 0.001) {
        camera.zoom += (this.targetZoom - camera.zoom) * config.SMOOTH_FACTOR;
    }
    
    if (Math.abs(camera.rotation - this.targetRotation) > 0.001) {
        camera.rotation += (this.targetRotation - camera.rotation) * config.ROTATION_SMOOTHING;
    } else {
        camera.rotation = this.targetRotation;
    }
    
    // Update Cached Trig (used by PlayerControl and Renderer)
    this.rotationCos = Math.cos(camera.rotation);
    this.rotationSin = Math.sin(camera.rotation);

    // --- 5. Apply Screen Shake ---
    const shake = this.playerService.screenShake();
    if (shake.intensity > 0.1) {
        this.playerService.screenShake.update(s => ({
            ...s,
            intensity: s.intensity * s.decay,
            x: s.x * s.decay,
            y: s.y * s.decay
        }));
    }
  }
}
