
import { Injectable } from '@angular/core';
import { Entity, Particle } from '../../models/game.models';

@Injectable({ providedIn: 'root' })
export class EntitySorterService {
  
  // Reuse bucket arrays to reduce allocation
  private buckets = new Map<number, any[]>();
  private readonly BUCKET_SIZE = 100;

  sortForRender(visibleEntities: Entity[], particles: Particle[], player: Entity): any[] {
    // Merge all renderable objects
    // Note: renderableEntities input is already filtered by RenderService to exclude floor decorations
    const renderList = [...visibleEntities, ...particles];
    
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
            // Cable logic: Render cables behind other entities in same bucket if possible
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
}
