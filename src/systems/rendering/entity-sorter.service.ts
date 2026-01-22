
import { Injectable } from '@angular/core';
import { Entity, Particle } from '../../models/game.models';

@Injectable({ providedIn: 'root' })
export class EntitySorterService {
  
  /**
   * Sorts entities for Isometric Rendering (Back to Front).
   * 
   * Isometric Projection Logic:
   * Screen X = (x - y)
   * Screen Y = (x + y) * 0.5 - z
   * 
   * To draw correctly without a Z-buffer, we essentially draw from the "furthest back" corner (Top of screen)
   * to the "closest" corner (Bottom of screen).
   * 
   * Primary Sort Key: (x + y)
   * - Objects with smaller (x + y) are "behind" objects with larger (x + y).
   * 
   * Z-Axis Handling:
   * - An object at Z=100 (floating) is physically above Z=0.
   * - Visually, it appears "higher" on screen (lower Y pixel value).
   * - However, for OCCLUSION, it should be drawn AFTER the floor below it.
   * - Therefore, Z does strictly not affect the draw order relative to the floor tile it sits on,
   *   unless we have overlapping tall structures.
   */
  sortForRender(entities: (Entity | Particle)[], player: Entity): (Entity | Particle)[] {
    
    // 1. Calculate Depth Key for all items
    // This loop is critical path, keeping it monomorphic and simple is best.
    const len = entities.length;
    for (let i = 0; i < len; i++) {
        const e = entities[i];
        
        // Base Iso Depth: The "Manhattan Distance" from the origin corner.
        // x + y determines the "row" in isometric grid.
        let depth = e.x + e.y;
        
        // --- Layer Biasing ---
        
        // 1. Floor Decorations (Rugs, Cracks) must always be drawn first (Deepest)
        if ((e as any).type === 'DECORATION' && (
            (e as any).subType === 'RUG' || 
            (e as any).subType === 'FLOOR_CRACK' ||
            (e as any).subType === 'GRAFFITI'
        )) {
            depth -= 100000; 
        } 
        // 2. Walls/Structures
        else if ((e as any).type === 'WALL') {
            // Walls are anchored at their center. 
            // In a tight packing, we might want to sort by the 'back' edge, but center works for sparse grids.
        } 
        // 3. Floating Projectiles/Particles
        else if ((e as any).type === 'HITBOX' || (e as any).type === 'PARTICLE') {
             // Add Z to depth? No.
             // If a particle is at x=10, y=10, z=50, it is "above" the player at x=10, y=10, z=0.
             // It should be drawn AFTER the player.
             // So we add a small bias to ensure it renders on top of the entity it is hitting.
             if ((e as any).z > 0) {
                 depth += 1; 
             }
        }

        // Store calculated depth on the object (transiently)
        (e as any).isoDepth = depth;
    }

    // 2. Sort
    // JavaScript's sort is stable and generally fast (TimSort in V8).
    // Sorting by isoDepth ascending draws background (low x+y) first.
    entities.sort((a: any, b: any) => {
        return a.isoDepth - b.isoDepth;
    });
    
    return entities;
  }
}
