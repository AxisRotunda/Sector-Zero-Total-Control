
import { Injectable } from '@angular/core';
import { Entity, Particle, RenderLayer } from '../../models/game.models';
import { SORTING_CONFIG } from './render.config';

@Injectable({ providedIn: 'root' })
export class EntitySorterService {
  
  // Reusable object for bounding box calculations to avoid GC
  private _bounds = { minDepth: 0, maxDepth: 0, center: 0 };

  /**
   * Optimized sorting strategy:
   * 1. Linear Pass O(N): Calculate a numeric 'sortKey' for every entity.
   *    - Combines RenderLayer (High weight) and Projected Depth (Low weight).
   * 2. Sort O(N log N): Use a simple numeric comparator which is extremely fast in V8.
   */
  sortForRender(renderList: (Entity | Particle)[], cameraRotation: number): void {
    const len = renderList.length;
    const cos = Math.cos(cameraRotation);
    const sin = Math.sin(cameraRotation);
    
    // 1. Calculate Metadata (Linear Pass)
    for (let i = 0; i < len; i++) {
      const e = renderList[i];
      
      // Lazy Layer Assignment
      if (e.renderLayer === undefined) {
        e.renderLayer = this.assignLayer(e);
      }
      
      // Base depth (Center point projected)
      // Rotated X = x*cos - y*sin
      // Rotated Y = x*sin + y*cos
      // Iso Depth ~ Rx + Ry
      const rx = e.x * cos - e.y * sin;
      const ry = e.x * sin + e.y * cos;
      const baseDepth = rx + ry;
      
      let effectiveDepth = baseDepth;

      // Handle large structures (Walls) needing bounding box consideration
      if (this.requiresBoundingBox(e)) {
        this.calculateBounds(e as Entity, cos, sin, baseDepth);
        // Heuristic: Use the "Max" depth for structures to push them behind units standing "inside" their footprint
        // But for overlapping walls, we need consistent ordering.
        // Standard painter's algorithm for iso: Sort by "Furthest point" (Min) or "Nearest" (Max)?
        // Usually, things with smaller depth (further back) draw first.
        // We use the center, but bias it based on logic.
        effectiveDepth = this._bounds.center; 
      }

      // Apply Z-bias (vertical height influence)
      // Objects higher up (z > 0) should generally appear "in front" if depth is tied
      const zBias = e.z * 0.1;
      
      // WEIGHTING ALGORITHM:
      // Layer: 1,000,000 range per layer
      // Depth: +/- 100,000 range (World size usually < 10k)
      // Key = (Layer * 1,000,000) + Depth + ZBias
      
      e._depthKey = (e.renderLayer * 1000000) + effectiveDepth + zBias;
    }
    
    // 2. Fast Numeric Sort
    renderList.sort((a, b) => (a._depthKey || 0) - (b._depthKey || 0));
  }
  
  private assignLayer(e: Entity | Particle): RenderLayer {
    if ('type' in e && e.type === 'DECORATION') {
      const ent = e as Entity;
      if (['RUG', 'FLOOR_CRACK', 'GRAFFITI'].includes(ent.subType || '')) {
        return RenderLayer.FLOOR;
      }
    }
    
    const z = e.z || 0;
    if (z < SORTING_CONFIG.LAYER_THRESHOLDS.GROUND_MAX) return RenderLayer.GROUND;
    if (z < SORTING_CONFIG.LAYER_THRESHOLDS.ELEVATED_MAX) return RenderLayer.ELEVATED;
    return RenderLayer.OVERHEAD;
  }
  
  private requiresBoundingBox(e: Entity | Particle): boolean {
    if (!('type' in e)) return false; 
    
    const ent = e as Entity;
    if (ent.type === 'WALL' || ent.type === 'DESTRUCTIBLE') return true;
    if (ent.type === 'DECORATION') {
      // Small decos act like units, large ones like walls
      return (ent.width || 0) > SORTING_CONFIG.LAYER_THRESHOLDS.LARGE_ENTITY_MIN;
    }
    return false;
  }

  private calculateBounds(e: Entity, cos: number, sin: number, centerDepth: number) {
      const w = (e.width || 40) / 2;
      const d = (e.depth || 40) / 2;
      
      // Unrolled projection of 4 corners relative to center
      // x' = x*c - y*s
      // y' = x*s + y*c
      // d = x' + y' = (x*c - y*s) + (x*s + y*c) = x(c+s) + y(c-s)
      
      const term1 = w * (cos + sin);
      const term2 = d * (cos - sin);
      
      // d1 = (-w, -d) => -term1 - term2
      // d2 = ( w, -d) =>  term1 - term2
      // d3 = (-w,  d) => -term1 + term2
      // d4 = ( w,  d) =>  term1 + term2
      
      // We essentially want the 'min' and 'max' relative depth to add to centerDepth
      // But for a simple sort key, using the Center is usually stable enough for static geometry
      // unless camera rotates.
      // Refined Heuristic:
      // If we are a Wall, we generally want to be sorted by our "Back" corner so things in front draw over us.
      // But standard topological sort for iso is tricky.
      // Using Center + small bias helps.
      
      this._bounds.center = centerDepth;
      // We calculate min/max just in case we implement a more complex overlap check later, 
      // but for O(N) sort, we stick to center.
  }
}
