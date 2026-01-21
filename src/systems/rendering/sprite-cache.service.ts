import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SpriteCacheService {
  // Use a Map as an LRU cache (insertion order is preserved)
  private cache = new Map<string, { canvas: HTMLCanvasElement | OffscreenCanvas, lastUsed: number }>();
  private readonly MAX_CACHE_SIZE = 750;

  getOrRender(key: string, width: number, height: number, renderFn: (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => void): HTMLCanvasElement | OffscreenCanvas {
    const now = Date.now();
    
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      entry.lastUsed = now; // Update usage time
      
      // Re-insert to update iteration order (LRU behavior)
      this.cache.delete(key);
      this.cache.set(key, entry);
      
      return entry.canvas;
    }

    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      // Evict oldest 25% entries
      const toRemoveCount = Math.floor(this.MAX_CACHE_SIZE * 0.25);
      const iterator = this.cache.keys();
      for (let i = 0; i < toRemoveCount; i++) {
        const next = iterator.next();
        if (next.done) break;
        this.cache.delete(next.value);
      }
    }

    const canvas = typeof OffscreenCanvas !== 'undefined' 
      ? new OffscreenCanvas(width, height)
      : document.createElement('canvas');
    
    if (typeof OffscreenCanvas === 'undefined') {
        (canvas as HTMLCanvasElement).width = width;
        (canvas as HTMLCanvasElement).height = height;
    }

    const ctx = canvas.getContext('2d') as any; // Cast to any to handle both context types
    renderFn(ctx);

    this.cache.set(key, { canvas, lastUsed: now });
    return canvas;
  }

  clear() {
    this.cache.clear();
  }
}