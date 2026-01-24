
import { Injectable, inject, computed, signal } from '@angular/core';
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
  
  public rotationCos = 1;
  public rotationSin = 0;
  
  private readonly MOUSE_PEEK_DISTANCE = 300; 
  
  // Optimization: Circular Buffer for velocity history
  private velocityBuffer = new Array(20).fill(null).map(() => ({ vx: 0, vy: 0, t: 0 }));
  private bufferIndex = 0;

  // Make zoom reactive for computed signals
  private currentZoom = signal(RENDER_CONFIG.CAMERA.BASE_ZOOM);

  uiScale = computed(() => {
      const z = this.currentZoom();
      return Math.max(0.8, Math.min(1.2, 1 / z));
  });

  constructor() {
      const config = RENDER_CONFIG.CAMERA;

      this.input.zoomEvents.subscribe((delta) => {
          const range = config.MAX_ZOOM - config.MIN_ZOOM;
          const zoomProgress = (this.targetZoom - config.MIN_ZOOM) / range; 
          
          const sensitivity = config.MIN_ZOOM_SENSITIVITY + 
              (config.MAX_ZOOM_SENSITIVITY - config.MIN_ZOOM_SENSITIVITY) * zoomProgress;

          this.targetZoom -= delta * sensitivity;
          this.targetZoom = Math.max(config.MIN_ZOOM, Math.min(config.MAX_ZOOM, this.targetZoom));
      });

      this.input.rotationEvents.subscribe((deltaRadians) => {
          this.targetRotation += deltaRadians * config.ROTATION_SENSITIVITY;
      });
  }

  update() {
    const player = this.world.player;
    const camera = this.world.camera;
    const config = RENDER_CONFIG.CAMERA;
    
    // Predictive Smoothing: Velocity Ring Buffer Update
    const now = Date.now();
    this.velocityBuffer[this.bufferIndex] = { vx: player.vx, vy: player.vy, t: now };
    this.bufferIndex = (this.bufferIndex + 1) % this.velocityBuffer.length;
    
    // Calculate Average Velocity (only recent)
    const cutoff = now - 200;
    let sumVx = 0, sumVy = 0, count = 0;
    
    for (const v of this.velocityBuffer) {
        if (v.t >= cutoff) { 
            sumVx += v.vx; 
            sumVy += v.vy; 
            count++; 
        }
    }
    const avgVx = count > 0 ? sumVx / count : 0;
    const avgVy = count > 0 ? sumVy / count : 0;

    const zoomFactor = 1.0 + (1.0 - camera.zoom) * 0.5;
    
    // Use average velocity for lookahead to reduce jitter
    const lookAheadX = avgVx * config.LOOK_AHEAD_DIST * zoomFactor;
    const lookAheadY = avgVy * config.LOOK_AHEAD_DIST * zoomFactor;
    
    let rawTargetX = player.x + lookAheadX;
    let rawTargetY = player.y + lookAheadY;
    
    if (this.input.usingKeyboard()) {
        const cursor = this.input.cursorRelative;
        const peekX = Math.sign(cursor.x) * Math.pow(Math.abs(cursor.x), 2) * this.MOUSE_PEEK_DISTANCE;
        const peekY = Math.sign(cursor.y) * Math.pow(Math.abs(cursor.y), 2) * this.MOUSE_PEEK_DISTANCE;
        
        const cos = Math.cos(-camera.rotation);
        const sin = Math.sin(-camera.rotation);
        
        const worldPeekX = peekX * cos - peekY * sin;
        const worldPeekY = peekX * sin + peekY * cos;

        rawTargetX += worldPeekX / camera.zoom;
        rawTargetY += worldPeekY / camera.zoom;
    }

    const bounds = this.world.mapBounds;
    const margin = config.BOUNDS_MARGIN;
    
    const clampedTargetX = Math.max(bounds.minX + margin, Math.min(bounds.maxX - margin, rawTargetX));
    const clampedTargetY = Math.max(bounds.minY + margin, Math.min(bounds.maxY - margin, rawTargetY));

    const DAMPING = config.POSITION_DAMPING || 0.08;
    camera.x += (clampedTargetX - camera.x) * DAMPING;
    camera.y += (clampedTargetY - camera.y) * DAMPING;

    if (Math.abs(camera.zoom - this.targetZoom) > 0.001) {
        camera.zoom += (this.targetZoom - camera.zoom) * config.SMOOTH_FACTOR;
        this.currentZoom.set(camera.zoom); // Sync signal
    }
    
    if (Math.abs(camera.rotation - this.targetRotation) > 0.001) {
        camera.rotation += (this.targetRotation - camera.rotation) * config.ROTATION_SMOOTHING;
    } else {
        camera.rotation = this.targetRotation;
    }
    
    this.rotationCos = Math.cos(camera.rotation);
    this.rotationSin = Math.sin(camera.rotation);

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
