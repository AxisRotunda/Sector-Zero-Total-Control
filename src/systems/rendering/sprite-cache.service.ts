import { Injectable } from '@angular/core';
import { RENDER_CONFIG } from './render.config';

@Injectable({ providedIn: 'root' })
export class SpriteCacheService {
  private cache = new Map<string, { canvas: HTMLCanvasElement | OffscreenCanvas, lastUsed: number }>();
  
  // Cache limits from config
  private readonly MAX_CACHE_SIZE = RENDER_CONFIG.MAX_CACHE_SIZE || 500;
  // Entries unused for this duration (ms) are preferred for eviction
  private readonly STALE_THRESHOLD = 60000; 

  getOrRender(
    key: string, 
    width: number, 
    height: number, 
    renderFn: (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => void
  ): HTMLCanvasElement | OffscreenCanvas {
    const now = Date.now();
    const entry = this.cache.get(key);

    if (entry) {
      // Optimization: Update timestamp only. Avoids delete/set map mutation overhead on every frame.
      entry.lastUsed = now;
      return entry.canvas;
    }

    // Cache Miss: Check capacity before allocation
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.prune(now);
    }

    const canvas = this.createCanvas(width, height);
    // Type assertion is safe here as context matches the created canvas type
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    
    if (ctx) {
        renderFn(ctx);
    }

    this.cache.set(key, { canvas, lastUsed: now });
    return canvas;
  }

  clear() {
    this.cache.clear();
  }

  /**
   * Abstraction for creating canvases, handling OffscreenCanvas support.
   */
  private createCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
    if (typeof OffscreenCanvas !== 'undefined') {
      return new OffscreenCanvas(width, height);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  /**
   * Handles cache eviction when limit is reached.
   */
  private prune(now: number) {
    // 1. First Pass: Remove stale entries (older than threshold)
    // Iterating map entries is fast enough for <1000 items on rare prune events
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.lastUsed > this.STALE_THRESHOLD) {
        this.cache.delete(key);
      }
    }

    // 2. Second Pass: If still over limit, aggressive LRU eviction
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
        // Sort by usage time to find oldest. 
        // We must explicit sort since we stopped re-inserting on read to optimize the hot path.
        const entries = Array.from(this.cache.entries());
        // Sort ascending by lastUsed (oldest first)
        entries.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
        
        // Remove oldest 20% to free up substantial space
        const removeCount = Math.ceil(this.MAX_CACHE_SIZE * 0.2);
        for (let i = 0; i < removeCount; i++) {
            this.cache.delete(entries[i][0]);
        }
    }
  }
}