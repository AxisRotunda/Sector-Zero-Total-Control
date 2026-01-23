
import { Injectable, inject } from '@angular/core';
import { Camera, Entity, Zone } from '../../models/game.models';
import { IsoUtils } from '../../utils/iso-utils';
import { RENDER_CONFIG } from './render.config';
import { LightingService } from './lighting.service';

@Injectable({ providedIn: 'root' })
export class LightingRendererService {
  private lightingService = inject(LightingService);
  
  private canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  
  private _iso = { x: 0, y: 0 }; 
  
  // Cache for rgba strings to avoid allocation
  private colorCache = new Map<string, string>();

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
    const ctx = this.ctx;
    const gi = this.lightingService.globalAmbient();

    // --- PASS 1: AMBIENT OCCLUSION (Darkness) ---
    ctx.globalCompositeOperation = 'source-over';
    
    ctx.fillStyle = this.hexToRgba(gi.ambientColor, gi.intensity);
    ctx.fillRect(0, 0, w, h);

    // Camera Transform for Light Map
    ctx.save();
    IsoUtils.toIso(cam.x, cam.y, 0, this._iso);
    ctx.translate(w/2, h/2);
    ctx.scale(cam.zoom * scale, cam.zoom * scale);
    ctx.translate(-this._iso.x, -this._iso.y);

    // CUTOUTS
    ctx.globalCompositeOperation = 'destination-out';

    this.drawRadialGradient(ctx, player.x, player.y, player.z, 350, 1.0, '#ffffff');

    const visibleLights = this.lightingService.visibleLights;
    for (const light of visibleLights) {
        this.drawRadialGradient(ctx, light.x, light.y, light.z || 0, light.radius, light.intensity, '#ffffff');
    }

    // --- PASS 2: EMISSIVE LIGHTS (Color) ---
    ctx.globalCompositeOperation = 'lighter'; 

    for (const light of visibleLights) {
        if (light.color === '#ffffff' || light.color === '#000000') continue; 
        
        this.drawRadialGradient(ctx, light.x, light.y, light.z || 0, light.radius * 0.8, light.intensity * 0.6, light.color);
    }

    ctx.restore();

    // --- COMPOSITE TO MAIN SCREEN ---
    mainCtx.save();
    mainCtx.resetTransform(); 
    
    mainCtx.imageSmoothingEnabled = true;
    mainCtx.imageSmoothingQuality = 'medium';
    
    mainCtx.drawImage(this.canvas, 0, 0, screenWidth, screenHeight);
    
    mainCtx.restore();
  }

  private drawRadialGradient(ctx: any, x: number, y: number, z: number, radius: number, intensity: number, color: string) {
      IsoUtils.toIso(x, y, z, this._iso);
      
      const grad = ctx.createRadialGradient(this._iso.x, this._iso.y, radius * 0.1, this._iso.x, this._iso.y, radius);
      
      const c = this.hexToRgba(color, intensity);
      const transparent = this.hexToRgba(color, 0);

      grad.addColorStop(0, c);
      grad.addColorStop(1, transparent);
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this._iso.x, this._iso.y, radius, 0, Math.PI * 2);
      ctx.fill();
  }

  private hexToRgba(hex: string, alpha: number): string {
      // Create cache key based on color and alpha
      // Alpha is rounded to 2 decimals to improve cache hit rate
      const alphaFixed = alpha.toFixed(2);
      const key = hex + '_' + alphaFixed;
      
      if (this.colorCache.has(key)) {
          return this.colorCache.get(key)!;
      }

      let r = 0, g = 0, b = 0;
      if (hex.length === 4) {
          r = parseInt(hex[1] + hex[1], 16);
          g = parseInt(hex[2] + hex[2], 16);
          b = parseInt(hex[3] + hex[3], 16);
      } else if (hex.length === 7) {
          r = parseInt(hex.substring(1, 3), 16);
          g = parseInt(hex.substring(3, 5), 16);
          b = parseInt(hex.substring(5, 7), 16);
      }
      
      const val = `rgba(${r},${g},${b},${alphaFixed})`;
      
      // Limit cache size to prevent memory leak over long sessions
      if (this.colorCache.size > 200) {
          this.colorCache.clear();
      }
      
      this.colorCache.set(key, val);
      return val;
  }
}
