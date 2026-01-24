
import { Injectable } from '@angular/core';
import { Entity, Particle, RenderLayer } from '../../models/game.models';
import { SORTING_CONFIG } from './render.config';

@Injectable({ providedIn: 'root' })
export class EntitySorterService {
  
  /**
   * Sorts entities for Isometric Rendering (Back to Front).
   * 
   * Strategy:
   * 1. Lazy Layer Assignment (Calculate once)
   * 2. Hybrid Depth Sort (Bounding Box for structures, Center for units)
   * 3. GC Optimization (Reuse _sortMeta objects)
   */
  sortForRender(renderList: (Entity | Particle)[], cameraRotation: number): void {
    const len = renderList.length;
    const cos = Math.cos(cameraRotation);
    const sin = Math.sin(cameraRotation);
    
    // 1. Calculate Metadata (Linear Pass)
    for (let i = 0; i < len; i++) {
      const e = renderList[i];
      
      // Skip if layer already assigned (Lazy Init)
      if (e.renderLayer === undefined) {
        e.renderLayer = this.assignLayer(e);
      }
      
      // Calculate depth extents based on rotation
      const rx = e.x * cos - e.y * sin;
      const ry = e.x * sin + e.y * cos;
      const baseDepth = rx + ry;
      
      let minDepth = baseDepth;
      let maxDepth = baseDepth;
      
      // Bounding box for large entities only (Walls, large Decos)
      if (this.requiresBoundingBox(e)) {
        const ent = e as Entity;
        const w = (ent.width || 40) / 2;
        const d = (ent.depth || 40) / 2;
        
        // Project 4 corners
        // Optimized: Unrolled loop to avoid array allocation
        const c1x = (e.x - w) * cos - (e.y - d) * sin;
        const c1y = (e.x - w) * sin + (e.y - d) * cos;
        const d1 = c1x + c1y;

        const c2x = (e.x + w) * cos - (e.y - d) * sin;
        const c2y = (e.x + w) * sin + (e.y - d) * cos;
        const d2 = c2x + c2y;

        const c3x = (e.x - w) * cos - (e.y + d) * sin;
        const c3y = (e.x - w) * sin + (e.y + d) * cos;
        const d3 = c3x + c3y;

        const c4x = (e.x + w) * cos - (e.y + d) * sin;
        const c4y = (e.x + w) * sin + (e.y + d) * cos;
        const d4 = c4x + c4y;
        
        minDepth = Math.min(d1, d2, d3, d4);
        maxDepth = Math.max(d1, d2, d3, d4);
      } else {
        // Simple radius extent for units/particles
        const rad = ('radius' in e ? (e as Entity).radius : undefined) || 20;
        minDepth = baseDepth - rad;
        maxDepth = baseDepth + rad;
      }
      
      // Apply z-bias uniformly to correct overlapping heights visually
      const zBias = e.z * 0.01;
      
      // Reuse or create metadata object (GC Optimization)
      if (!e._sortMeta) {
        e._sortMeta = { min: 0, max: 0, center: 0 };
      }
      e._sortMeta.min = minDepth + zBias;
      e._sortMeta.max = maxDepth + zBias;
      e._sortMeta.center = baseDepth + zBias;
    }
    
    // 2. Sort In-Place using pre-calc data
    renderList.sort(this.hybridComparator);
  }
  
  private assignLayer(e: Entity | Particle): RenderLayer {
    // Floor decorations check
    if ('type' in e && e.type === 'DECORATION') {
      const ent = e as Entity;
      if (['RUG', 'FLOOR_CRACK', 'GRAFFITI'].includes(ent.subType || '')) {
        return RenderLayer.FLOOR;
      }
    }
    
    // Z-height based layering
    const z = e.z || 0;
    if (z < SORTING_CONFIG.LAYER_THRESHOLDS.GROUND_MAX) return RenderLayer.GROUND;
    if (z < SORTING_CONFIG.LAYER_THRESHOLDS.ELEVATED_MAX) return RenderLayer.ELEVATED;
    return RenderLayer.OVERHEAD;
  }
  
  private requiresBoundingBox(e: Entity | Particle): boolean {
    if (!('type' in e)) return false;  // Particles use simple extent
    
    const ent = e as Entity;
    if (ent.type === 'WALL') return true;
    if (ent.type === 'DESTRUCTIBLE') return true;
    if (ent.type === 'DECORATION') {
      const w = ent.width || 0;
      const d = ent.depth || 0;
      return w > SORTING_CONFIG.LAYER_THRESHOLDS.LARGE_ENTITY_MIN ||
             d > SORTING_CONFIG.LAYER_THRESHOLDS.LARGE_ENTITY_MIN;
    }
    return false;
  }
  
  private hybridComparator(a: Entity | Particle, b: Entity | Particle): number {
    // Priority 1: Render Layer
    const layerDiff = (a.renderLayer || 0) - (b.renderLayer || 0);
    if (layerDiff !== 0) return layerDiff;
    
    // Safety check for metadata (should exist from sortForRender loop)
    const metaA = a._sortMeta!;
    const metaB = b._sortMeta!;
    
    // Priority 2: Non-Overlapping Ranges (Front-to-Back)
    if (metaA.max < metaB.min) return -1;
    if (metaB.max < metaA.min) return 1;
    
    // Priority 3: Overlapping Ranges (Structure vs Unit resolution)
    // If ranges overlap, we prioritize drawing structures "behind" units if ambiguous
    const isLargeA = 'type' in a && (a.type === 'WALL' || a.type === 'DECORATION' || a.type === 'DESTRUCTIBLE');
    const isLargeB = 'type' in b && (b.type === 'WALL' || b.type === 'DECORATION' || b.type === 'DESTRUCTIBLE');
    
    if (isLargeA && !isLargeB) return -1;  // Structure (A) before Unit (B)
    if (!isLargeA && isLargeB) return 1;   // Structure (B) before Unit (A)
    
    // Fallback: Center depth
    return metaA.center - metaB.center;
  }
}
