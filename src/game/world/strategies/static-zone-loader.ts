
import { Injectable, inject } from '@angular/core';
import { ZoneLoadStrategy, ZoneLoadingContext } from '../models/zone-transition.types';
import { WorldService } from '../world.service';
import { SectorLoaderService } from '../sector-loader.service';
import { WorldStateService } from '../world-state.service';
import { ChunkManagerService } from '../chunk-manager.service';

@Injectable({ providedIn: 'root' })
export class StaticZoneLoader implements ZoneLoadStrategy {
  private sectorLoader = inject(SectorLoaderService);
  private worldState = inject(WorldStateService);
  private chunkManager = inject(ChunkManagerService);

  async load(world: WorldService, context: ZoneLoadingContext): Promise<void> {
    const template = context.template;
    
    this.chunkManager.reset();

    // 1. Load Geometry & Static Data
    this.sectorLoader.loadFromTemplate(world, template);

    // 2. Move Walls to ChunkManager
    const staticWalls = world.entities.filter(e => e.type === 'WALL');
    staticWalls.forEach(w => this.chunkManager.registerStaticEntity(w));
    
    // 3. Keep only dynamic entities in main list
    world.entities = world.entities.filter(e => e.type !== 'WALL');

    // 4. Restore Dynamic State (if persistent)
    if (this.worldState.hasSector(template.id) && !template.metadata.isInstanced) {
        const savedEntities = this.worldState.loadSector(template.id);
        // Remove default dynamic entities from template to avoid dupes
        world.entities = world.entities.filter(e => e.type !== 'SPAWNER' && e.type !== 'DESTRUCTIBLE');
        world.entities.push(...savedEntities);
    } else {
        world.player.x = template.metadata.playerStart.x;
        world.player.y = template.metadata.playerStart.y;
    }
  }
}
