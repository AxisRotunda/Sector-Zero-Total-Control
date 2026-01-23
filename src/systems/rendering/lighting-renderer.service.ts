
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
  
  // Sprite Optimization: Cached radial gradient image
  private lightSprite: HTMLCanvasElement | OffscreenCanvas | null = null;
  
  private _iso = { x: 0, y: 0 }; 
  
  // Cache for rgba strings to avoid allocation
  private colorCache = new Map<string, string>();

  private currentScale = 0.5; // Default, controlled by PerformanceManager
  private currentWidth = 0;
  private currentHeight = 0;

  init(width: number, height: number) {
    this.currentWidth = width;
    this.currentHeight = height;
    this.updateCanvasDimensions();
    
    // Pre-render the Light Sprite
    this.renderLightSprite();
  }

  private updateCanvasDimensions() {
    // Current Scale is updated via setResolutionScale()
    const w = Math.floor(this.currentWidth * this.currentScale);
    const h = Math.floor(this.currentHeight * this.currentScale);

    // Only recreate if dimensions actually changed
    if (this.canvas && this.canvas.width === w && this.canvas.height === h) return;

    if (typeof OffscreenCanvas !== 'undefined') {
      this.canvas = new OffscreenCanvas(w, h);
      if (!this.lightSprite) this.lightSprite = new OffscreenCanvas(256, 256);
    } else {
      this.canvas = document.createElement('canvas');
      this.canvas.width = w;
      this.canvas.height = h;
      if (!this.lightSprite) {
          this.lightSprite = document.createElement('canvas');
          this.lightSprite.width = 256;
          this.lightSprite.height = 256;
      }
    }
    
    this.ctx = this.canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    
    // Re-render sprite if canvas changed to ensure validity (though sprite is separate, context might need fresh sprite on some platforms)
    this.renderLightSprite();
  }

  setResolutionScale(scale: number) {
      if (Math.abs(this.currentScale - scale) > 0.01) {
          this.currentScale = scale;
          this.updateCanvasDimensions();
      }
  }

  private renderLightSprite() {
      if (!this.lightSprite) return;
      const ctx = this.lightSprite.getContext('2d') as CanvasRenderingContext2D;
      const w = this.lightSprite.width;
      const h = this.lightSprite.height;
      const cx = w/2;
      const cy = h/2;
      const radius = w/2;

      ctx.clearRect(0, 0, w, h);

      // FIX: Use BLACK gradient for proper destination-out blending behavior
      // White gradients can cause "white fog" artifacts on some compositors when using destination-out
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
      grad.addColorStop(0.2, 'rgba(0, 0, 0, 0.8)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
  }

  resize(width: number, height: number) {
    this.currentWidth = width;
    this.currentHeight = height;
    this.updateCanvasDimensions();
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

    const scale = this.currentScale;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;
    const gi = this.lightingService.globalAmbient();

    // --- CLEAR BUFFER ---
    ctx.clearRect(0, 0, w, h);

    // --- PASS 1: AMBIENT OCCLUSION (Darkness) ---
    ctx.globalCompositeOperation = 'source-over';
    
    ctx.fillStyle = this.hexToRgba(gi.ambientColor, gi.intensity);
    ctx.fillRect(0, 0, w, h);

    // Camera Transform for Light Map
    ctx.save();
    
    // Calculate center relative to camera
    IsoUtils.toIso(cam.x, cam.y, 0, this._iso);
    
    ctx.translate(w/2, h/2);
    ctx.scale(cam.zoom * scale, cam.zoom * scale);
    ctx.translate(-this._iso.x, -this._iso.y);

    // CUTOUTS - Use destination-out to punch through darkness
    ctx.globalCompositeOperation = 'destination-out';

    // Player cutout
    this.drawLightSprite(ctx, player.x, player.y, player.z, 350, 1.0);

    const visibleLights = this.lightingService.visibleLights;
    const len = visibleLights.length;
    for (let i = 0; i < len; i++) {
        const light = visibleLights[i];
        this.drawLightSprite(ctx, light.x, light.y, light.z || 0, light.radius, light.intensity);
    }

    // --- PASS 2: EMISSIVE LIGHTS (Color) ---
    ctx.globalCompositeOperation = 'lighter'; 

    for (let i = 0; i < len; i++) {
        const light = visibleLights[i];
        // Skip white/black lights in emissive pass to avoid blowing out the scene
        if (light.color === '#ffffff' || light.color === '#000000') continue; 
        
        this.drawColoredLight(ctx, light.x, light.y, light.z || 0, light.radius * 0.8, light.intensity * 0.6, light.color);
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

  private drawLightSprite(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, z: number, radius: number, intensity: number) {
      if (!this.lightSprite) return;
      IsoUtils.toIso(x, y, z, this._iso);
      
      const size = radius * 2;
      ctx.globalAlpha = intensity;
      ctx.drawImage(this.lightSprite, this._iso.x - radius, this._iso.y - radius, size, size);
      ctx.globalAlpha = 1.0;
  }

  private drawColoredLight(ctx: any, x: number, y: number, z: number, radius: number, intensity: number, color: string) {
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
      
      if (this.colorCache.size > 200) {
          this.colorCache.clear();
      }
      
      this.colorCache.set(key, val);
      return val;
  }
}
