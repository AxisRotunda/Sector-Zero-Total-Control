import { Injectable } from '@angular/core';
import { Entity, Particle } from '../../models/game.models';

@Injectable({ providedIn: 'root' })
export class EntitySorterService {
  
  // Reuse bucket arrays to reduce allocation
  private buckets = new Map<number, any[]>();
  private readonly BUCKET_SIZE = 100;

  sortForRender(visibleEntities: Entity[], particles: Particle[], player: Entity): any[] {
    // Merge all renderable objects
    const renderList = [...visibleEntities, ...particles];
    
    // Ensure player is in the list (SpatialHash might have culled if player logic differs, 
    // but player is usually inserted. We add check to avoid duplication if player is already in visibleEntities).
    // Note: visibleEntities comes from SpatialHash which SHOULD contain player.
    // However, to be safe against deduplication logic in RenderService vs SpatialHash, 
    // we can rely on SpatialHash query returning player. 
    // If player is dead/hidden, we don't render.
    
    // Since RenderService passes the result of spatialHash.queryRect, and EntityUpdateService inserts player into hash,
    // player is already in visibleEntities if within bounds. 
    // We do NOT manually push player here anymore to avoid duplication.

    // Bucket Sort Optimization
    this.buckets.clear();
    
    // 1. Distribute into buckets based on ISO depth approximation (x + y)
    for (const e of renderList) {
        // Handle both Entity and Particle types safely
        const depthVal = e.x + e.y;
        const bucketIndex = Math.floor(depthVal / this.BUCKET_SIZE);
        
        if (!this.buckets.has(bucketIndex)) {
            this.buckets.set(bucketIndex, []);
        }
        this.buckets.get(bucketIndex)!.push(e);
    }

    // 2. Sort buckets by index
    const sortedBucketIndices = Array.from(this.buckets.keys()).sort((a, b) => a - b);
    
    const sortedResult: any[] = [];

    // 3. Sort within buckets and merge
    for (const idx of sortedBucketIndices) {
        const bucket = this.buckets.get(idx)!;
        
        // Timsort (native) is efficient for small arrays
        bucket.sort((a, b) => {
            const isFloorA = this.isFloorLayer(a);
            const isFloorB = this.isFloorLayer(b);
            if (isFloorA && !isFloorB) return -1;
            if (!isFloorA && isFloorB) return 1;
            
            const isCableA = (a as any).subType === 'CABLE';
            const isCableB = (b as any).subType === 'CABLE';
            if (isCableA && !isCableB) return -1;
            if (!isCableA && isCableB) return 1;

            return (a.x + a.y) - (b.x + b.y);
        });
        
        for (const item of bucket) {
            sortedResult.push(item);
        }
    }
    
    return sortedResult;
  }
  
  private isFloorLayer(e: any): boolean {
    if (e.life !== undefined) return false; // Particle
    const ent = e as Entity;
    return (ent.type === 'DECORATION' && 
      ['RUG', 'FLOOR_CRACK', 'GRAFFITI'].includes(ent.subType!)) ||
      (ent.type === 'HITBOX' && ent.subType === 'SLUDGE');
  }
}