
import { Injectable, inject } from '@angular/core';
import { ZoneLoadStrategy, ZoneLoadingContext } from '../models/zone-transition.types';
import { WorldService } from '../world.service';
import { WorldGeneratorService } from '../world-generator.service';
import { SpatialHashService } from '../../../systems/spatial-hash.service';
import { WORLD_GRAPH } from '../../../data/world/world-graph.config';

@Injectable({ providedIn: 'root' })
export class ProceduralZoneLoader implements ZoneLoadStrategy {
  private worldGenerator = inject(WorldGeneratorService);
  private spatialHash = inject(SpatialHashService);

  async load(world: WorldService, context: ZoneLoadingContext): Promise<void> {
    const template = context.template;
    
    // 1. Generate Layout
    const result = this.worldGenerator.generate(template.theme, template.metadata.difficulty, template.id);
    
    // 2. Apply to World
    world.currentZone.set(result.zone);
    world.mapBounds = result.bounds;
    
    // 3. Entity Management
    world.entities = [];
    world.staticDecorations = [];
    
    result.entities.forEach(e => {
        if (e.type === 'WALL') {
            // Walls in procedural are dynamic in list but static in behavior
            world.entities.push(e);
            this.spatialHash.insert(e, true); // Insert into static hash immediately
        } else if (e.type === 'DECORATION') {
            world.entities.push(e); // Simplification: Treat procedural decorations as entities for now
        } else {
            world.entities.push(e);
        }
    });

    // 4. Map Exits to Graph
    const upExit = result.entities.find(e => e.type === 'EXIT' && e.exitType === 'UP');
    const downExit = result.entities.find(e => e.type === 'EXIT' && e.exitType === 'DOWN');
    
    const config = WORLD_GRAPH.zones[template.id];
    if (config) {
        if (upExit && config.adjacentZones[0]) upExit.targetSector = config.adjacentZones[0];
        if (downExit && config.adjacentZones[1]) downExit.targetSector = config.adjacentZones[1];
    }

    // 5. Set Player Start (Default center for procedural gen usually)
    world.player.x = result.playerStart.x;
    world.player.y = result.playerStart.y;
  }
}
