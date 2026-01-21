
import { Injectable } from '@angular/core';
import { Entity, Camera } from '../../models/game.models';

@Injectable({
  providedIn: 'root'
})
export class ChunkManagerService {
  // Config
  private readonly CHUNK_SIZE = 1000; // Large chunks for static geometry
  private readonly LOAD_MARGIN = 1; // Chunks around visibility to load

  // State
  private chunks = new Map<string, Entity[]>();
  private activeChunks = new Set<string>();

  reset() {
    this.chunks.clear();
    this.activeChunks.clear();
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
    const visibleKeys = this.calculateVisibleChunkKeys(cam, canvasWidth, canvasHeight);
    const entities: Entity[] = [];

    // Simple cache check - if set of visible chunks hasn't changed, we could cache the result list
    // For now, we rebuild the list as it's just pointer references
    for (const key of visibleKeys) {
      const chunk = this.chunks.get(key);
      if (chunk) {
        // We could do finer culling here, but chunk-level is good for broad phase
        for (let i = 0; i < chunk.length; i++) {
            entities.push(chunk[i]);
        }
      }
    }
    return entities;
  }

  private getChunkKey(x: number, y: number): string {
    const cx = Math.floor(x / this.CHUNK_SIZE);
    const cy = Math.floor(y / this.CHUNK_SIZE);
    return `${cx},${cy}`;
  }

  private calculateVisibleChunkKeys(cam: Camera, w: number, h: number): Set<string> {
    const keys = new Set<string>();
    
    // Calculate world bounds of the camera view
    // (Approximate un-projected bounds)
    const viewW = (w / cam.zoom) * 1.5; // Padding for rotation/iso
    const viewH = (h / cam.zoom) * 1.5;
    
    const startX = Math.floor((cam.x - viewW / 2) / this.CHUNK_SIZE);
    const endX = Math.floor((cam.x + viewW / 2) / this.CHUNK_SIZE);
    const startY = Math.floor((cam.y - viewH / 2) / this.CHUNK_SIZE);
    const endY = Math.floor((cam.y + viewH / 2) / this.CHUNK_SIZE);

    for (let x = startX - this.LOAD_MARGIN; x <= endX + this.LOAD_MARGIN; x++) {
      for (let y = startY - this.LOAD_MARGIN; y <= endY + this.LOAD_MARGIN; y++) {
        keys.add(`${x},${y}`);
      }
    }
    return keys;
  }
}
