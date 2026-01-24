
import { Injectable, inject, computed } from '@angular/core';
import { WorldService } from './world/world.service';
import { PlayerService } from './player/player.service';
import { InputService, Action } from '../services/input.service';
import { RENDER_CONFIG } from '../systems/rendering/render.config';

@Injectable({ providedIn: 'root' })
export class CameraService {
  private world = inject(WorldService);
  private playerService = inject(PlayerService);
  private input = inject(InputService);

  private targetZoom = RENDER_CONFIG.CAMERA.BASE_ZOOM;
  
  // Discrete Rotation State
  private targetRotation = 0;
  private startRotation = 0;
  private rotationStartTime = 0;
  private isRotating = false;
  private readonly ROTATION_DURATION = 250; // ms
  private readonly ROTATION_STEP = Math.PI / 4; // 45 degrees
  
  // Maximum distance the mouse can offset the camera (screen pixels approx)
  private readonly MOUSE_PEEK_DISTANCE = 300; 

  // Signal for UI scaling based on zoom
  uiScale = computed(() => {
      const z = this.world.camera.zoom;
      return Math.max(0.8, Math.min(1.2, 1 / z));
  });

  constructor() {
      const config = RENDER_CONFIG.CAMERA;

      // Subscribe to Input Zoom events
      this.input.zoomEvents.subscribe((delta) => {
          const range = config.MAX_ZOOM - config.MIN_ZOOM;
          const zoomProgress = (this.targetZoom - config.MIN_ZOOM) / range; 
          const sensitivity = config.MIN_ZOOM_SENSITIVITY + 
              (config.MAX_ZOOM_SENSITIVITY - config.MIN_ZOOM_SENSITIVITY) * zoomProgress;

          this.targetZoom -= delta * sensitivity;
          this.targetZoom = Math.max(config.MIN_ZOOM, Math.min(config.MAX_ZOOM, this.targetZoom));
      });

      // Subscribe to Discrete Rotation Actions
      this.input.actionEvents.subscribe((action: Action) => {
          if (action === 'ROTATE_LEFT') this.snapRotation(-1);
          if (action === 'ROTATE_RIGHT') this.snapRotation(1);
      });
  }

  snapRotation(direction: 1 | -1) {
      if (this.isRotating) return; // Debounce
      
      this.isRotating = true;
      this.startRotation = this.world.camera.rotation;
      this.targetRotation = this.startRotation + (this.ROTATION_STEP * direction);
      this.rotationStartTime = performance.now();
  }

  update() {
    const player = this.world.player;
    const camera = this.world.camera;
    const config = RENDER_CONFIG.CAMERA;
    const now = performance.now();
    
    // --- 1. Rotation Tween ---
    if (this.isRotating) {
        const elapsed = now - this.rotationStartTime;
        const t = Math.min(1, elapsed / this.ROTATION_DURATION);
        
        // Quadratic Ease Out
        const ease = t * (2 - t); 
        
        camera.rotation = this.startRotation + (this.targetRotation - this.startRotation) * ease;
        
        if (t >= 1) {
            this.isRotating = false;
            // Normalize angle to -PI to PI range for cleanliness
            camera.rotation = Math.atan2(Math.sin(this.targetRotation), Math.cos(this.targetRotation));
            this.targetRotation = camera.rotation; // Sync
        }
    }

    // --- 2. Zoom-Responsive Look-Ahead ---
    const zoomFactor = 1.0 + (1.0 - camera.zoom) * 0.5;
    
    const lookAheadX = player.vx * config.LOOK_AHEAD_DIST * zoomFactor;
    const lookAheadY = player.vy * config.LOOK_AHEAD_DIST * zoomFactor;
    
    let rawTargetX = player.x + lookAheadX;
    let rawTargetY = player.y + lookAheadY;
    
    // --- 3. Mouse Cursor Peeking ---
    if (this.input.usingKeyboard()) {
        const cursor = this.input.cursorRelative;
        const peekX = Math.sign(cursor.x) * Math.pow(Math.abs(cursor.x), 2) * this.MOUSE_PEEK_DISTANCE;
        const peekY = Math.sign(cursor.y) * Math.pow(Math.abs(cursor.y), 2) * this.MOUSE_PEEK_DISTANCE;
        
        // Rotate Peek Vector to match Camera Rotation
        const cos = Math.cos(-camera.rotation);
        const sin = Math.sin(-camera.rotation);
        
        const worldPeekX = peekX * cos - peekY * sin;
        const worldPeekY = peekX * sin + peekY * cos;

        rawTargetX += worldPeekX / camera.zoom;
        rawTargetY += worldPeekY / camera.zoom;
    }

    // --- 4. Soft-Clamp Bounds ---
    const bounds = this.world.mapBounds;
    const margin = config.BOUNDS_MARGIN;
    
    const clampedTargetX = Math.max(bounds.minX + margin, Math.min(bounds.maxX - margin, rawTargetX));
    const clampedTargetY = Math.max(bounds.minY + margin, Math.min(bounds.maxY - margin, rawTargetY));

    // --- 5. Smooth Damping ---
    const DAMPING = 0.06;
    camera.x += (clampedTargetX - camera.x) * DAMPING;
    camera.y += (clampedTargetY - camera.y) * DAMPING;

    // --- 6. Smooth Zoom Damping ---
    if (Math.abs(camera.zoom - this.targetZoom) > 0.001) {
        camera.zoom += (this.targetZoom - camera.zoom) * config.SMOOTH_FACTOR;
    }

    // --- 7. Apply Screen Shake ---
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
