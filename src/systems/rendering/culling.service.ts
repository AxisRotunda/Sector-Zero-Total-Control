
import { Injectable, signal } from '@angular/core';
import { Camera, Entity } from '../../models/game.models';

export interface ViewFrustum {
  minX: number; maxX: number; minY: number; maxY: number; buffer: number;
}

@Injectable({ providedIn: 'root' })
export class CullingService {
  private frustumCache = signal<ViewFrustum | null>(null);

  computeViewFrustum(camera: Camera, viewportWidth: number, viewportHeight: number, buffer = 50): ViewFrustum {
    // Calculate world extent of viewport based on zoom
    const worldW = viewportWidth / camera.zoom;
    const worldH = viewportHeight / camera.zoom;
    
    // Isometric projection expands the visible bounds (approx 1.5x)
    // We add a generous buffer to ensure no pop-in
    const expansion = Math.max(worldW, worldH) * 0.8; 

    return {
      minX: camera.x - expansion - buffer, 
      maxX: camera.x + expansion + buffer,
      minY: camera.y - expansion - buffer, 
      maxY: camera.y + expansion + buffer, 
      buffer
    };
  }

  isEntityVisible(e: Entity, f: ViewFrustum): boolean {
    const w = e.width || 32;
    const h = e.depth || 32; // Use depth for Y-axis footprint
    return !(e.x + w < f.minX || e.x > f.maxX || e.y + h < f.minY || e.y > f.maxY);
  }

  getVisibleEntities(entities: Entity[], camera: Camera, vw: number, vh: number): Entity[] {
    const frustum = this.computeViewFrustum(camera, vw, vh);
    this.frustumCache.set(frustum);
    return entities.filter(e => this.isEntityVisible(e, frustum));
  }

  getLastFrustum = () => this.frustumCache();
}
