
import { Injectable, inject } from '@angular/core';
import { LightSource } from '../../models/rendering.models';
import { IsoUtils } from '../../utils/iso-utils';

@Injectable({ providedIn: 'root' })
export class LightmapBakerService {
  
  private bakeCache = new Map<string, { canvas: HTMLCanvasElement | OffscreenCanvas, x: number, y: number }>();

  bakeStaticLights(
    lights: LightSource[], 
    cameraRotation: number
  ): { canvas: HTMLCanvasElement | OffscreenCanvas, x: number, y: number } | null {
    
    if (!lights) return null;

    // Filter only static lights
    const staticLights = lights.filter(l => l.type === 'STATIC');
    if (staticLights.length === 0) return null;

    // Cache Key
    const cacheKey = `LIGHTS_${staticLights.length}_${cameraRotation.toFixed(2)}`;
    if (this.bakeCache.has(cacheKey)) return this.bakeCache.get(cacheKey)!;

    // 1. Calculate Bounds (ISO)
    const originalRotation = IsoUtils._rotation;
    const originalCx = IsoUtils._cx;
    const originalCy = IsoUtils._cy;
    IsoUtils.setContext(cameraRotation, 0, 0);

    let minIsoX = Infinity, maxIsoX = -Infinity;
    let minIsoY = Infinity, maxIsoY = -Infinity;
    const pt = {x:0, y:0};

    for (const l of staticLights) {
        IsoUtils.toIso(l.x, l.y, l.z || 0, pt);
        const r = l.radius;
        if (pt.x - r < minIsoX) minIsoX = pt.x - r;
        if (pt.x + r > maxIsoX) maxIsoX = pt.x + r;
        if (pt.y - r < minIsoY) minIsoY = pt.y - r;
        if (pt.y + r > maxIsoY) maxIsoY = pt.y + r;
    }

    const width = Math.ceil(maxIsoX - minIsoX);
    const height = Math.ceil(maxIsoY - minIsoY);

    if (width > 4096 || height > 4096) {
        IsoUtils.setContext(originalRotation, originalCx, originalCy);
        return null;
    }

    // 2. Setup Canvas
    let canvas: HTMLCanvasElement | OffscreenCanvas;
    if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(width, height);
    } else {
        canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
    }
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    // 3. Render Lights (Hole Cutting / Additive)
    // We render them as WHITE sprites for the mask or COLORED for additive
    // This baker produces the "Light Mask" (holes in darkness)
    ctx.translate(-minIsoX, -minIsoY);
    
    // Fill transparent
    ctx.clearRect(0, 0, width, height);

    for (const l of staticLights) {
        IsoUtils.toIso(l.x, l.y, l.z || 0, pt);
        
        const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, l.radius);
        // We draw white with alpha = intensity. The lighting renderer will use this to destination-out
        grad.addColorStop(0, `rgba(255, 255, 255, ${l.intensity})`);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, l.radius, 0, Math.PI*2);
        ctx.fill();
    }

    IsoUtils.setContext(originalRotation, originalCx, originalCy);

    const result = { canvas, x: minIsoX, y: minIsoY };
    this.bakeCache.set(cacheKey, result);
    return result;
  }

  clearCache() {
      this.bakeCache.clear();
  }
}
