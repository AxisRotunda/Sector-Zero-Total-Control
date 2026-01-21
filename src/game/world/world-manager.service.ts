
import { Injectable, inject } from '@angular/core';
import { WorldService } from './world.service';
import { SectorLoaderService } from './sector-loader.service';
import { WorldGeneratorService } from './world-generator.service';
import { SectorId } from '../../models/game.models';
import { ZoneManagerService } from './zone-manager.service';

@Injectable({ providedIn: 'root' })
export class WorldManagerService {
  private worldService = inject(WorldService);
  private sectorLoader = inject(SectorLoaderService);
  private worldGenerator = inject(WorldGeneratorService);
  private zoneManager = inject(ZoneManagerService);
  
  loadContent(type: 'SECTOR' | 'PROCEDURAL', id: string | number) {
    if (type === 'SECTOR') {
        this.zoneManager.initWorld(id as string);
    } else {
        this.worldService.generateFloor(id as number);
    }
  }
}
