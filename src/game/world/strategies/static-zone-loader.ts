

import { Injectable, inject } from '@angular/core';
import { ZoneLoadStrategy, ZoneLoadingContext } from '../models/zone-transition.types';
import { WorldService } from '../world.service';
import { SectorLoaderService } from '../sector-loader.service';
import { WorldStateService } from '../world-state.service';

@Injectable({ providedIn: 'root' })
export class StaticZoneLoader implements ZoneLoadStrategy {
  private sectorLoader = inject(SectorLoaderService);
  private worldState = inject(WorldStateService);

  async load(world: WorldService, context: ZoneLoadingContext): Promise<void> {
    const template = context.template;
    
    // 1. Load Geometry & Static Data
    this.sectorLoader.loadFromTemplate(world, template);

    // 2. Restore Dynamic State (if persistent)
    if (this.worldState.hasSector(template.id) && !template.metadata.isInstanced) {
        const savedEntities = this.worldState.loadSector(template.id);
        
        // Remove default dynamic entities from template, as they will be replaced by saved state
        world.entities = world.entities.filter(e => e.type !== 'SPAWNER' && e.type !== 'DESTRUCTIBLE');
        world.entities.push(...savedEntities);
    } else {
        // First visit or instanced: Use default start (handled by sectorLoader logic mostly, but we ensure player pos)
        world.player.x = template.metadata.playerStart.x;
        world.player.y = template.metadata.playerStart.y;
    }
  }
}
