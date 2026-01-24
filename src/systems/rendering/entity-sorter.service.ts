
import { Injectable } from '@angular/core';
import { Entity, Particle } from '../../models/game.models';
import { IsoUtils } from '../../utils/iso-utils';

@Injectable({ providedIn: 'root' })
export class EntitySorterService {
  
  /**
   * Sorts entities for Isometric Rendering (Back to Front).
   * 
   * Updates objects in-place with `isoDepth` to avoid recalculation during the sort comparator.
   * Leverages IsoUtils which is pre-configured with the current frame's camera rotation.
   */
  sortForRender(renderList: (Entity | Particle)[], player: Entity): void {
    
    const len = renderList.length;
    
    // 1. Calculate Depth Key for all items (Linear Pass)
    for (let i = 0; i < len; i++) {
        const e = renderList[i];
        
        // Base Iso Depth: Use rotation-aware helper
        let depth = IsoUtils.getSortDepth(e.x, e.y);
        
        // --- Layer Biasing ---
        // Floor Decorations: Always Deepest
        if ('subType' in e && e.type === 'DECORATION') {
            if (e.subType === 'RUG' || e.subType === 'FLOOR_CRACK' || e.subType === 'GRAFFITI') {
                depth -= 100000;
            }
        }
        
        // Floating Objects: Bias based on Z to ensure they draw on top of their ground position
        // e.g. A flying drone at (x,y, z=50) should draw AFTER a ground unit at (x,y, z=0)
        if (e.z > 0) {
             depth += 1;
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
