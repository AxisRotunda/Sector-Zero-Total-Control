
import { Injectable } from '@angular/core';
import { Entity, Camera } from '../../models/game.models';

@Injectable({
  providedIn: 'root'
})
export class ChunkManagerService {
  // Config
  private readonly CHUNK_SIZE = 1000; // Size of chunk in world units

  // State
  // Key: "chunkX,chunkY" -> Array of Entities
  private chunks = new Map<string, Entity[]>();
  
  // Cache the last visible set to avoid re-aggregating every frame if camera hasn't moved much
  private lastVisibleCount = 0;
  
  // Reusable buffer to avoid allocating a new Array every frame when cache misses
  // Pre-allocate to a reasonable size to avoid initial resizing
  private resultBuffer: Entity[] = new Array(2000);
  
  private lastCheckX = -99999;
  private lastCheckY = -99999;
  private readonly CACHE_DIST_SQ = 50 * 50; // Re-query if camera moved > 50 units

  reset() {
    this.chunks.clear();
    this.lastVisibleCount = 0;
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
   * Returns a shared buffer reference and a count. Do NOT modify the buffer.
   * OPTIMIZED: Zero-allocation path.
   */
  getVisibleStaticEntities(cam: Camera, canvasWidth: number, canvasHeight: number): { buffer: Entity[], count: number } {
    // Optimization: Return cached list if camera hasn't moved significantly
    const distSq = (cam.x - this.lastCheckX)**2 + (cam.y - this.lastCheckY)**2;
    if (distSq < this.CACHE_DIST_SQ && this.lastVisibleCount > 0) {
        return { buffer: this.resultBuffer, count: this.lastVisibleCount };
    }

    let count = 0;

    // Calculate world bounds of the camera view
    // Effective Viewport Size in World Units
    const worldW = (canvasWidth / cam.zoom);
    const worldH = (canvasHeight / cam.zoom);
    
    // Iso projection rotates 45 deg. The bounding box of the rotated view is larger.
    const radius = Math.max(worldW, worldH) * 0.8; 

    const minX = cam.x - radius;
    const maxX = cam.x + radius;
    const minY = cam.y - radius;
    const maxY = cam.y + radius;
    
    const startX = Math.floor(minX / this.CHUNK_SIZE);
    const endX = Math.floor(maxX / this.CHUNK_SIZE);
    const startY = Math.floor(minY / this.CHUNK_SIZE);
    const endY = Math.floor(maxY / this.CHUNK_SIZE);

    // Direct iteration over grid coordinates to avoid allocating a Set<string>
    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        // Construct key directly in loop (cheap string op vs Set allocation)
        const key = `${x},${y}`;
        const chunk = this.chunks.get(key);
        
        if (chunk) {
          const len = chunk.length;
          // Ensure buffer size with geometric growth
          if (count + len > this.resultBuffer.length) {
              const newSize = Math.max((count + len) * 1.5, this.resultBuffer.length + 1000);
              // Resize by creating new array and copying (expensive but rare)
              const newBuffer = new Array(Math.floor(newSize));
              for(let k=0; k<count; k++) newBuffer[k] = this.resultBuffer[k];
              this.resultBuffer = newBuffer;
          }
          
          // Fast Array Copy
          for (let i = 0; i < len; i++) {
              this.resultBuffer[count++] = chunk[i];
          }
        }
      }
    }
    
    this.lastVisibleCount = count;
    this.lastCheckX = cam.x;
    this.lastCheckY = cam.y;

    return { buffer: this.resultBuffer, count };
  }

  private getChunkKey(x: number, y: number): string {
    const cx = Math.floor(x / this.CHUNK_SIZE);
    const cy = Math.floor(y / this.CHUNK_SIZE);
    return `${cx},${cy}`;
  }
}
