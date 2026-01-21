
import { Injectable } from '@angular/core';
import { Entity, Particle } from '../../models/game.models';

@Injectable({ providedIn: 'root' })
export class EntitySorterService {
  
  // Isometric depth calculation
  // Depth = (x + y) - z
  // We prioritize floor position (x+y) but subtract height (z) so higher objects draw *after* floor objects at same x,y?
  // Wait, in Painter's algorithm (Back-to-Front):
  // Furthest back = Lowest Depth value.
  // Standard Iso: X goes Right-Down, Y goes Left-Down.
  // "Down" the screen is increasing Y_screen.
  // ScreenY = (x + y) * 0.5 - z.
  // So objects with higher (x+y) are "lower" on screen (closer to viewer).
  // Objects with higher z are "higher" on screen (further 'up' visually, but physically above).
  
  // Correct Sort Order:
  // We want to draw objects with LOWER (x+y) first (Background).
  // Then HIGHER (x+y) (Foreground).
  // Z complicates this. An object at z=100 is "above" z=0.
  // If we just sort by (x+y), a bird at (10,10, 100) has same depth as a rock at (10,10,0).
  // The bird should be drawn AFTER the rock if it's "on top".
  
  // Revised Metric: `isoDepth = (x + y)`. Z is handled by draw order relative to footprint?
  // Actually, for pure occlusion, we often sort by the *screen Y* of the *base* of the object.
  // But let's use the robust topological metric:
  // depth = x + y + z_layer_bias
  
  sortForRender(entities: (Entity | Particle)[], player: Entity): (Entity | Particle)[] {
    
    // 1. Calculate Depth Key for all items
    for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        
        // For entities with volume (Walls), we ideally use the "furthest back" point of their footprint
        // But for a simple center-sort:
        
        // Base Iso Depth (Footprint center)
        let depth = e.x + e.y;
        
        // Bias for specific types to fix z-fighting
        if ((e as any).type === 'DECORATION' && (e as any).subType === 'RUG') {
            depth -= 5000; // Floor decals always first
        } else if ((e as any).type === 'WALL') {
            // Walls: Sort by their base center. 
            // Note: Large walls might need splitting for perfect sorting, 
            // but center-sort works if objects aren't intersecting.
        } else if ((e as any).type === 'HITBOX' && (e as any).z > 10) {
            // Flying projectiles: add small bias to draw in front of things at same footprint
            depth += 10; 
        } else if ((e as any).type === 'PARTICLE') {
             // Particles often have Z. 
             // Ideally we sort particles into the scene geometry.
             depth += (e as any).z; 
        }

        // Store calculated depth on the object (transiently)
        (e as any).isoDepth = depth;
    }

    // 2. Sort
    // Native sort is usually Timsort (stable, fast for partially sorted arrays)
    // We sort Ascending (Lowest depth first -> Background)
    entities.sort((a: any, b: any) => {
        return a.isoDepth - b.isoDepth;
    });
    
    return entities;
  }
}
