
import { Injectable } from '@angular/core';
import { Camera, Entity, Zone } from '../../models/game.models';
import { IsoUtils } from '../../utils/iso-utils';
import { RENDER_CONFIG } from './render.config';

@Injectable({ providedIn: 'root' })
export class LightingRendererService {
  private canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  
  private _iso = { x: 0, y: 0 }; // Reusable vector

  init(width: number, height: number) {
    const scale = RENDER_CONFIG.LIGHTING.RESOLUTION_SCALE;
    const w = Math.floor(width * scale);
    const h = Math.floor(height * scale);

    if (typeof OffscreenCanvas !== 'undefined') {
      this.canvas = new OffscreenCanvas(w, h);
    } else {
      this.canvas = document.createElement('canvas');
      this.canvas.width = w;
      this.canvas.height = h;
    }
    
    this.ctx = this.canvas.getContext('2d') as any;
  }

  resize(width: number, height: number) {
    if (!this.canvas) {
        this.init(width, height);
        return;
    }
    const scale = RENDER_CONFIG.LIGHTING.RESOLUTION_SCALE;
    this.canvas.width = Math.floor(width * scale);
    this.canvas.height = Math.floor(height * scale);
  }

  drawLighting(
    mainCtx: CanvasRenderingContext2D, 
    entities: Entity[], 
    player: Entity, 
    cam: Camera, 
    zone: Zone,
    screenWidth: number, 
    screenHeight: number
  ) {
    if (!RENDER_CONFIG.LIGHTING.ENABLED || !this.ctx || !this.canvas) return;

    const scale = RENDER_CONFIG.LIGHTING.RESOLUTION_SCALE;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 1. Clear & Fill Darkness
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = zone.ambientColor 
        ? this.adjustAlpha(zone.ambientColor, 0.6) 
        : RENDER_CONFIG.LIGHTING.BASE_AMBIENT;
    this.ctx.fillRect(0, 0, w, h);

    // 2. Setup Camera Transform for Light Map
    this.ctx.save();
    // Center logic same as main renderer but scaled
    IsoUtils.toIso(cam.x, cam.y, 0, this._iso);
    this.ctx.translate(w/2, h/2);
    this.ctx.scale(cam.zoom * scale, cam.zoom * scale);
    this.ctx.translate(-this._iso.x, -this._iso.y);

    // 3. Cut out Lights (Destination Out)
    this.ctx.globalCompositeOperation = 'destination-out';

    // Player Light (Flashlight/Aura)
    this.drawLightSource(this.ctx, player, 350, 0.8);

    // Entity Lights
    for (const e of entities) {
        // Projectiles / Hitboxes
        if (e.type === 'HITBOX') {
            const intensity = e.source === 'PLAYER' ? 0.6 : 0.4;
            this.drawLightSource(this.ctx, e, e.radius * 3, intensity);
        }
        // Glowing Decor
        else if (e.type === 'DECORATION' && (e.subType === 'DYNAMIC_GLOW' || e.subType === 'NEON' || e.subType === 'HOLO_TABLE' || e.subType === 'STREET_LIGHT')) {
            const radius = e.subType === 'STREET_LIGHT' ? 400 : (e.subType === 'NEON' ? 250 : 200);
            const intensity = e.subType === 'STREET_LIGHT' ? 0.7 : 0.5;
            this.drawLightSource(this.ctx, e, radius, intensity);
        }
        // Spawners / Active Nodes
        else if (e.type === 'SPAWNER') {
            this.drawLightSource(this.ctx, e, 150, 0.3);
        }
        else if (e.type === 'EXIT') {
            this.drawLightSource(this.ctx, e, 250, 0.6);
        }
    }

    this.ctx.restore();

    // 4. Composite Light Map onto Main Canvas
    mainCtx.save();
    mainCtx.resetTransform(); // Ensure we draw over the whole screen 1:1
    
    // Smooth out the low-res scaling
    mainCtx.imageSmoothingEnabled = true;
    mainCtx.imageSmoothingQuality = 'medium';
    
    mainCtx.drawImage(this.canvas, 0, 0, screenWidth, screenHeight);
    mainCtx.restore();
  }

  private drawLightSource(ctx: any, e: Entity, radius: number, intensity: number) {
      // For street lights, light comes from the top (z height) down to floor
      // But shadows are drawn on floor. For ambient lighting, we generally light the floor area around the base
      // OR light the area around the bulb if it's volume fog.
      // Let's stick to floor lighting for clarity, but offset slightly for height if needed.
      // Actually, simple radial around x,y works best for top-down-ish isometric visibility.
      
      IsoUtils.toIso(e.x, e.y, (e.type === 'DECORATION' && e.subType === 'STREET_LIGHT') ? 0 : (e.z || 0), this._iso);
      
      const grad = ctx.createRadialGradient(this._iso.x, this._iso.y, radius * 0.2, this._iso.x, this._iso.y, radius);
      grad.addColorStop(0, `rgba(0,0,0,${intensity})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this._iso.x, this._iso.y, radius, 0, Math.PI * 2);
      ctx.fill();
  }

  // Helper to force alpha on hex or rgba strings (rough implementation)
  private adjustAlpha(color: string, alpha: number): string {
      if (color.startsWith('#')) return `rgba(0,0,0,${alpha})`; // Fallback for simple hex
      return color; 
  }
}
