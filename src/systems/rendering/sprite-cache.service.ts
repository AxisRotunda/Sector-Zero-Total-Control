
import { Injectable } from '@angular/core';

interface CacheEntry {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  lastUsed: number;
  sizeBytes: number;
}

@Injectable({ providedIn: 'root' })
export class SpriteCacheService {
  private cache = new Map<string, CacheEntry>();
  
  // Cache limits
  private readonly MAX_CACHE_SIZE_MB = 50; 
  private readonly BYTES_PER_PIXEL = 4;
  private currentSizeBytes = 0;
  private pruneThreshold = this.MAX_CACHE_SIZE_MB * 1024 * 1024 * 0.9; // Prune at 90% full

  getOrRender(
    key: string, 
    width: number, 
    height: number, 
    renderFn: (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => void
  ): HTMLCanvasElement | OffscreenCanvas {
    const now = Date.now();
    const entry = this.cache.get(key);

    if (entry) {
      entry.lastUsed = now;
      return entry.canvas;
    }

    // Estimate size of new sprite
    const estimatedSize = width * height * this.BYTES_PER_PIXEL;

    // OPTIMIZED: Only prune when approaching limit, not every frame
    if (this.currentSizeBytes + estimatedSize > this.pruneThreshold) {
      this.prune(estimatedSize);
    }

    const canvas = this.createCanvas(width, height);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    
    if (ctx) {
        renderFn(ctx);
    } else {
        console.warn('[SpriteCache] Failed to get context for sprite:', key);
    }

    this.cache.set(key, { canvas, lastUsed: now, sizeBytes: estimatedSize });
    this.currentSizeBytes += estimatedSize;
    
    return canvas;
  }

  clear() {
    this.cache.clear();
    this.currentSizeBytes = 0;
  }

  private createCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
    if (typeof OffscreenCanvas !== 'undefined') {
      return new OffscreenCanvas(width, height);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  private prune(requiredSize: number) {
    // Only remove enough entries to fit new sprite + 10% buffer
    const targetSize = (this.MAX_CACHE_SIZE_MB * 1024 * 1024) - requiredSize - (5 * 1024 * 1024);
    
    // Sort by LRU (Oldest first)
    const entries = Array.from(this.cache.entries()).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    
    for (const [key, entry] of entries) {
        if (this.currentSizeBytes <= targetSize) {
            break; // Enough space freed
        }

        // CRITICAL: Release memory explicitly if possible (mostly for DOM nodes)
        if (entry.canvas instanceof HTMLCanvasElement) {
            entry.canvas.width = 0;
            entry.canvas.height = 0;
        }

        this.currentSizeBytes -= entry.sizeBytes;
        this.cache.delete(key);
    }
  }
}
