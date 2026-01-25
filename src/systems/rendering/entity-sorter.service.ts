
import { Injectable, inject } from '@angular/core';
import { Entity, Particle, RenderLayer } from '../../models/game.models';
import { SORTING_CONFIG } from './render.config';
import { ProofKernelService } from '../../core/proof/proof-kernel.service';

@Injectable({ providedIn: 'root' })
export class EntitySorterService {
  private proofKernel = inject(ProofKernelService);
  
  // Reusable object for bounding box calculations to avoid GC
  private _bounds = { minDepth: 0, maxDepth: 0, center: 0 };
  private frameCount = 0;

  sortForRender(renderList: (Entity | Particle)[], cameraRotation: number): void {
    const len = renderList.length;
    const cos = Math.cos(cameraRotation);
    const sin = Math.sin(cameraRotation);
    
    // 1. Calculate Metadata (Linear Pass)
    for (let i = 0; i < len; i++) {
      const e = renderList[i];
      
      if (e.renderLayer === undefined) {
        e.renderLayer = this.assignLayer(e);
      }
      
      const rx = e.x * cos - e.y * sin;
      const ry = e.x * sin + e.y * cos;
      const baseDepth = rx + ry;
      
      let effectiveDepth = baseDepth;

      if (this.requiresBoundingBox(e)) {
        this.calculateBounds(e as Entity, cos, sin, baseDepth);
        effectiveDepth = this._bounds.center; 
      }

      const zBias = e.z * 0.1;
      e._depthKey = (e.renderLayer * 1000000) + effectiveDepth + zBias;
    }
    
    // 2. Fast Numeric Sort
    renderList.sort((a, b) => (a._depthKey || 0) - (b._depthKey || 0));

    // 3. Probabilistic Verification
    // Every 60 frames (approx 1 sec), sample the sorted list and verify monotonicity
    this.frameCount++;
    if (this.frameCount > 60) {
        this.frameCount = 0;
        // Optimization: Just check a stride of entities to avoid heavy serialization
        const samples = [];
        for (let i = 0; i < len; i += 5) {
            samples.push(renderList[i]._depthKey || 0);
        }
        if (samples.length > 1) {
            this.proofKernel.verifyRenderDepth(samples);
        }
    }
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
      return (ent.width || 0) > SORTING_CONFIG.LAYER_THRESHOLDS.LARGE_ENTITY_MIN;
    }
    return false;
  }

  private calculateBounds(e: Entity, cos: number, sin: number, centerDepth: number) {
      this._bounds.center = centerDepth;
  }
}
