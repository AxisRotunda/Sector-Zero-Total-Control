
import { Injectable } from '@angular/core';
import { Entity, Particle } from '../../models/game.models';
import { IsoUtils } from '../../utils/iso-utils';

@Injectable({ providedIn: 'root' })
export class EntitySorterService {
  
  /**
   * Sorts entities for Isometric Rendering (Back to Front).
   * 
   * Primary Sort Key: Projected Depth (Rotated X + Rotated Y)
   * 
   * Updates objects in-place with `isoDepth` to avoid recalculation during the sort comparator.
   */
  sortForRender(renderList: (Entity | Particle)[], cameraRotation: number): void {
    
    const len = renderList.length;
    
    // Optimization: Cache trig values for the frame
    const cos = Math.cos(cameraRotation);
    const sin = Math.sin(cameraRotation);

    // 1. Calculate Depth Key for all items (Linear Pass)
    for (let i = 0; i < len; i++) {
        const e = renderList[i];
        
        // Calculate Rotated Coordinates manually here for speed 
        // (Avoiding function call overhead of IsoUtils.getSortDepth inside tight loop)
        const rx = e.x * cos - e.y * sin;
        const ry = e.x * sin + e.y * cos;
        
        // Base Iso Depth: Rotated X + Rotated Y
        let depth = rx + ry;
        
        // --- Layer Biasing ---
        
        // Floor Decorations: Always Deepest
        if ('subType' in e && e.type === 'DECORATION') {
            if (e.subType === 'RUG' || e.subType === 'FLOOR_CRACK' || e.subType === 'GRAFFITI') {
                depth -= 100000;
            }
        }
        
        // Floating Objects: Bias based on Z.
        // In Iso, Z moves things "Up" (Lower Y). 
        // Standard painter's algo sorts by "Footprint".
        // If we add Z to depth, we might make flying things sort behind things they are visually in front of.
        // Usually, we ignore Z for sorting unless it's a multi-story game.
        // However, adding a tiny epsilon of Z helps strict overlaps.
        if (e.z > 0) {
             depth += e.z * 0.01;
        }

        // Store calculated depth on the object (transiently)
        e.isoDepth = depth;
    }

    // 2. Sort In-Place
    renderList.sort(this.depthComparator);
  }

  private depthComparator(a: Entity | Particle, b: Entity | Particle): number {
      // isoDepth is guaranteed to be set by the pre-sort pass
      return (a.isoDepth || 0) - (b.isoDepth || 0);
  }
}
