
import { Injectable } from '@angular/core';
import { Entity, Particle, RenderLayer } from '../../models/game.models';
import { IsoUtils } from '../../utils/iso-utils';

@Injectable({ providedIn: 'root' })
export class EntitySorterService {
  
  /**
   * Sorts entities for Isometric Rendering (Back to Front).
   * 
   * Strategy:
   * 1. Layer Bucket Sort (Floor -> Ground -> Elevated -> Overhead)
   * 2. Within Layer: Hybrid Depth Sort (Bounding Box Extents)
   */
  sortForRender(renderList: (Entity | Particle)[], cameraRotation: number): void {
    
    const len = renderList.length;
    
    // Optimization: Cache trig values for the frame
    const cos = Math.cos(cameraRotation);
    const sin = Math.sin(cameraRotation);

    // 1. Calculate Metadata for all items (Linear Pass)
    for (let i = 0; i < len; i++) {
        const e = renderList[i];
        
        // --- Layer Assignment ---
        if (e.renderLayer === undefined) {
            // Assign dynamic layer based on Z and Type
            if ((e as Entity).type === 'DECORATION' && ['RUG', 'FLOOR_CRACK', 'GRAFFITI'].includes((e as Entity).subType || '')) {
                e.renderLayer = RenderLayer.FLOOR;
            } else if (e.z < 80) {
                e.renderLayer = RenderLayer.GROUND;
            } else if (e.z < 300) {
                e.renderLayer = RenderLayer.ELEVATED;
            } else {
                e.renderLayer = RenderLayer.OVERHEAD;
            }
        }

        // --- Depth Calculation ---
        // Projected Depth (Center)
        const rx = e.x * cos - e.y * sin;
        const ry = e.x * sin + e.y * cos;
        const centerDepth = rx + ry + (e.z * 0.01);

        // Bounding Box Extents (for robust wall sorting)
        // For simple particles/units, radius acts as extent
        let minDepth = centerDepth;
        let maxDepth = centerDepth;

        // Use bounding box logic for rectangular entities (Walls, Decorations, Destructibles)
        if ((e as Entity).type === 'WALL' || (e as Entity).type === 'DECORATION' || (e as Entity).type === 'DESTRUCTIBLE') {
            const ent = e as Entity;
            const w = (ent.width || 40) / 2;
            const d = (ent.depth || 40) / 2;
            
            // Project 4 corners
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

            minDepth = Math.min(d1, d2, d3, d4) + (e.z * 0.01);
            maxDepth = Math.max(d1, d2, d3, d4) + (e.z * 0.01);
        } else {
            const rad = (e as any).radius || 20;
            minDepth = centerDepth - rad;
            maxDepth = centerDepth + rad;
        }

        // Store transient metadata
        (e as any)._sortMeta = { min: minDepth, max: maxDepth, center: centerDepth };
    }

    // 2. Sort In-Place
    renderList.sort(this.hybridComparator);
  }

  private hybridComparator(a: any, b: any): number {
      // Priority 1: Render Layer
      const layerDiff = (a.renderLayer || 0) - (b.renderLayer || 0);
      if (layerDiff !== 0) return layerDiff;

      const metaA = a._sortMeta;
      const metaB = b._sortMeta;

      // Priority 2: Non-Overlapping Ranges (Front-to-Back)
      // If A is strictly behind B
      if (metaA.max < metaB.min) return -1;
      // If B is strictly behind A
      if (metaB.max < metaA.min) return 1;

      // Priority 3: Overlapping Ranges (Hybrid Strategy)
      // If ranges overlap, we have ambiguity.
      // Large static structures (Walls) generally provide the "background" context.
      // If a Unit is inside a Wall's depth range, the Unit is likely standing "in front" of the wall's foundation visually.
      
      const isLargeA = a.type === 'WALL' || a.type === 'DECORATION' || a.type === 'DESTRUCTIBLE';
      const isLargeB = b.type === 'WALL' || b.type === 'DECORATION' || b.type === 'DESTRUCTIBLE';

      if (isLargeA && !isLargeB) return -1; // Draw Wall before Unit
      if (!isLargeA && isLargeB) return 1;  // Draw Wall before Unit

      // Fallback: Center Depth
      return metaA.center - metaB.center;
  }
}
