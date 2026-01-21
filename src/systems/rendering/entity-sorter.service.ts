
import { Injectable } from '@angular/core';
import { Entity, Particle } from '../../models/game.models';
import { DepthLayer } from '../../models/render.models';

@Injectable({ providedIn: 'root' })
export class EntitySorterService {
  
  sortForRender(visibleEntities: Entity[], particles: Particle[], player: Entity): any[] {
    const renderList = [...visibleEntities, ...particles];
    
    // Sort logic:
    // 1. DepthLayer (Ground -> Structure -> Unit -> FX)
    // 2. Isometric Depth (x + y)
    
    return renderList.sort((a, b) => {
        const layerA = this.getLayer(a);
        const layerB = this.getLayer(b);
        
        if (layerA !== layerB) {
            return layerA - layerB;
        }
        
        // Same layer, sort by Y-Depth
        // Particle/Entity unified coordinate access
        const ax = (a as any).x || 0;
        const ay = (a as any).y || 0;
        const bx = (b as any).x || 0;
        const by = (b as any).y || 0;
        
        return (ax + ay) - (bx + by);
    });
  }
  
  private getLayer(e: any): DepthLayer {
      // 1. Explicit Layer
      if ((e as Entity).depthLayer !== undefined) return (e as Entity).depthLayer!;
      
      // 2. Particles defaults
      if ((e as Particle).life !== undefined) return DepthLayer.FX_LOW;

      // 3. Fallback inference for Entity types
      const ent = e as Entity;
      switch (ent.type) {
          case 'WALL': return DepthLayer.STRUCTURES;
          case 'NPC': 
          case 'ENEMY':
          case 'PLAYER': return DepthLayer.UNITS;
          case 'PICKUP': return DepthLayer.ITEMS;
          case 'HITBOX': return DepthLayer.FX_HIGH;
          case 'DECORATION': 
              if (['RUG', 'FLOOR_CRACK', 'GRAFFITI', 'TRASH'].includes(ent.subType || '')) return DepthLayer.FLOOR_DECORATION;
              return DepthLayer.STRUCTURES;
          default: return DepthLayer.STRUCTURES;
      }
  }
}
