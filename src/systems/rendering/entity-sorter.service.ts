
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
        // Uses (rx + ry) * 10000 + z * 10 formula
        let depth = IsoUtils.getSortDepth(e.x, e.y, e.z);
        
        // --- Layer Biasing ---
        // Special handling to force certain types to render strictly before or after others
        
        if ('type' in e) {
            const ent = e as Entity;
            
            // Floor Decorations: Always Deepest
            // We apply a massive negative bias to ensure they are drawn before any standing entities
            // in the same vicinity.
            if (ent.type === 'DECORATION') {
                if (ent.subType === 'RUG' || ent.subType === 'FLOOR_CRACK' || ent.subType === 'GRAFFITI') {
                    depth -= 500000;
                }
            }
            
            // Wall segments or Gates might need bias if they are visually 'behind' but mathematically 'front'
            // For now, the improved Iso formula handles most structure/unit overlap correctly.
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
