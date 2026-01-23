
import { Injectable } from '@angular/core';
import { Entity, Camera } from '../../models/game.models';

@Injectable({
  providedIn: 'root'
})
export class ChunkManagerService {
  // Config
  private readonly CHUNK_SIZE = 1000; // Size of chunk in world units
  private readonly LOAD_MARGIN = 1; // Number of neighbor chunks to include

  // State
  // Key: "chunkX,chunkY" -> Array of Entities
  private chunks = new Map<string, Entity[]>();
  
  // Cache the last visible set to avoid re-aggregating every frame if camera hasn't moved much
  private lastVisibleEntities: Entity[] = [];
  
  // Reusable buffer to avoid allocating a new Array every frame when cache misses
  private resultBuffer: Entity[] = [];
  
  private lastCheckX = -99999;
  private lastCheckY = -99999;
  private readonly CACHE_DIST_SQ = 100 * 100; // Only re-query if camera moved > 100 units

  reset() {
    this.chunks.clear();
    this.lastVisibleEntities = [];
    this.resultBuffer = [];
    this.lastCheckX = -99999;
  }

  /**
   * Registers a static entity into the chunk system.
   * Modifies entity.chunkId.
   */
  registerStaticEntity(entity: Entity) {
    const chunkKey = this.getChunkKey(entity.x, entity.y);
    entity.chunkId = chunkKey;

    if (!this.chunks.has(chunkKey)) {
      this.chunks.set(chunkKey, []);
    }
    this.chunks.get(chunkKey)!.push(entity);
  }

  /**
   * Returns all entities in chunks visible to the camera.
   * This is the "Culling" phase.
   */
  getVisibleStaticEntities(cam: Camera, canvasWidth: number, canvasHeight: number): Entity[] {
    // Optimization: Return cached list if camera hasn't moved significantly
    const distSq = (cam.x - this.lastCheckX)**2 + (cam.y - this.lastCheckY)**2;
    if (distSq < this.CACHE_DIST_SQ && this.lastVisibleEntities.length > 0) {
        return this.lastVisibleEntities;
    }

    const visibleKeys = this.calculateVisibleChunkKeys(cam, canvasWidth, canvasHeight);
    
    // Clear buffer without deallocation
    this.resultBuffer.length = 0;

    for (const key of visibleKeys) {
      const chunk = this.chunks.get(key);
      if (chunk) {
        // Fast Array Copy
        const len = chunk.length;
        for (let i = 0; i < len; i++) {
            this.resultBuffer.push(chunk[i]);
        }
      }
    }
    
    // Update cache
    // We must clone the buffer to a new array for cache storage, as resultBuffer is reused
    // However, typically the consumer (RenderService) iterates immediately.
    // To be safe for cache logic, we slice.
    this.lastVisibleEntities = this.resultBuffer.slice();
    
    this.lastCheckX = cam.x;
    this.lastCheckY = cam.y;

    return this.lastVisibleEntities;
  }

  private getChunkKey(x: number, y: number): string {
    const cx = Math.floor(x / this.CHUNK_SIZE);
    const cy = Math.floor(y / this.CHUNK_SIZE);
    return `${cx},${cy}`;
  }

  private calculateVisibleChunkKeys(cam: Camera, w: number, h: number): Set<string> {
    const keys = new Set<string>();
    
    // Calculate world bounds of the camera view
    // Since we are isometric, the view is a diamond, but we use a bounding box for chunk selection.
    // We pad generousy to avoid pop-in.
    
    // Effective Viewport Size in World Units
    const worldW = (w / cam.zoom);
    const worldH = (h / cam.zoom);
    
    // Iso projection rotates 45 deg. The bounding box of the rotated view is larger.
    const radius = Math.max(worldW, worldH) * 1.0; 

    const minX = cam.x - radius;
    const maxX = cam.x + radius;
    const minY = cam.y - radius;
    const maxY = cam.y + radius;
    
    const startX = Math.floor(minX / this.CHUNK_SIZE);
    const endX = Math.floor(maxX / this.CHUNK_SIZE);
    const startY = Math.floor(minY / this.CHUNK_SIZE);
    const endY = Math.floor(maxY / this.CHUNK_SIZE);

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        keys.add(`${x},${y}`);
      }
    }
    return keys;
  }
}
