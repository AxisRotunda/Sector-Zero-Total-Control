
import { Injectable, inject, signal } from '@angular/core';
import { WorldService } from './world.service';
import { WorldStateService } from './world-state.service';
import { WORLD_GRAPH } from '../../data/world/world-graph.config';
import { ZoneTemplate } from '../../models/zone.models';
import { SectorLoaderService } from './sector-loader.service';
import { WorldGeneratorService } from './world-generator.service';
import { PlayerService } from '../player/player.service';
import { SoundService } from '../../services/sound.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { GameEvents } from '../../core/events/game-events';
import { NarrativeService } from '../narrative.service';
import { ZONE_LORE } from '../../config/narrative.config';

@Injectable({
  providedIn: 'root'
})
export class ZoneManagerService {
  private world = inject(WorldService);
  private worldState = inject(WorldStateService);
  private sectorLoader = inject(SectorLoaderService);
  private worldGenerator = inject(WorldGeneratorService);
  private player = inject(PlayerService);
  private sound = inject(SoundService);
  private eventBus = inject(EventBusService);
  private narrative = inject(NarrativeService);

  private graph = WORLD_GRAPH;
  currentZoneId = signal<string>('HUB');

  async transitionToZone(targetZoneId: string) {
    const targetConfig = this.graph.zones[targetZoneId];
    
    if (!targetConfig) {
      console.error(`Zone ${targetZoneId} not defined in WorldGraph`);
      return;
    }

    // 1. Save state of current zone
    const currentId = this.currentZoneId();
    this.worldState.saveSector(currentId, this.world.entities);

    // 2. Play Effects
    this.sound.play('ZONE_CHANGE');
    
    // 3. Load new zone
    this.loadZone(targetConfig.template, currentId);
    
    // 4. Update pointer
    this.currentZoneId.set(targetZoneId);
    this.player.currentSectorId.set(targetZoneId); 

    // 5. Trigger Discovery or just text
    this.checkDiscovery(targetZoneId, targetConfig.displayName);
  }

  initWorld(startZoneId: string = 'HUB') {
      const config = this.graph.zones[startZoneId] || this.graph.zones[this.graph.rootZoneId];
      this.currentZoneId.set(config.id);
      this.player.currentSectorId.set(config.id);
      this.loadZone(config.template);
      
      setTimeout(() => this.checkDiscovery(config.id, config.displayName), 1000);
  }

  private checkDiscovery(zoneId: string, displayName: string) {
      if (this.narrative.discoverZone(zoneId)) {
          const lore = ZONE_LORE[zoneId];
          this.eventBus.dispatch({
              type: GameEvents.LOCATION_DISCOVERED,
              payload: {
                  zoneId,
                  name: displayName,
                  description: lore ? lore.description : 'Unknown Sector'
              }
          });
      } else {
          this.eventBus.dispatch({ 
              type: GameEvents.FLOATING_TEXT_SPAWN, 
              payload: { 
                  onPlayer: true, 
                  yOffset: -150, 
                  text: `ZONE: ${displayName}`, 
                  color: '#22c55e', 
                  size: 24
              } 
          });
      }
  }

  private loadZone(template: ZoneTemplate, previousZoneId?: string) {
      // Check if it's a procedural zone (Empty geometry in template)
      const isProcedural = (!template.geometry.walls || template.geometry.walls.length === 0) && template.metadata.isInstanced;

      if (isProcedural) {
          // Generate Fresh Layout
          const result = this.worldGenerator.generate(template.theme, template.metadata.difficulty, template.id);
          
          // Manually populate world from generation result
          this.world.currentZone.set(result.zone);
          this.world.mapBounds = result.bounds;
          
          // Clear old
          this.world.entities = [];
          this.world.staticDecorations = [];
          
          // Add generated entities
          result.entities.forEach(e => {
              if (e.type === 'WALL' || e.type === 'DECORATION') {
                  // Separate statics? For generator, walls are usually static.
                  if(e.type === 'WALL') this.world.entities.push(e); // Walls act dynamic for now in generator logic or need hash insertion
                  else this.world.entities.push(e);
              } else {
                  this.world.entities.push(e);
              }
          });
          
          // IMPORTANT: Re-insert into spatial hash is handled by world.generateFloor logic usually, 
          // but here we need to ensure the caller or renderer handles it.
          // EntityUpdateService clears dynamic hash every frame. Static hash needs manual insert.
          // For simplicity in this refactor, we let EntityUpdateService handle it or re-insert here.
          // WorldGenerator result entities are mixed.
          // Let's rely on standard update loop for dynamic, but Walls need static insert.
          const spatialHash = (this.world as any).spatialHash; // Access via any or inject if possible (circular dep risk)
          if(spatialHash) {
              spatialHash.clearAll();
              result.entities.forEach(e => spatialHash.insert(e, e.type === 'WALL'));
          }

          // Link Exits logic for Procedural
          // WorldGenerator creates generic UP/DOWN exits. We need to map them to adjacent zones.
          const upExit = result.entities.find(e => e.type === 'EXIT' && e.exitType === 'UP');
          const downExit = result.entities.find(e => e.type === 'EXIT' && e.exitType === 'DOWN');
          
          const config = this.graph.zones[template.id];
          if (upExit && config.adjacentZones[0]) (upExit as any).targetSector = config.adjacentZones[0];
          if (downExit && config.adjacentZones[1]) (downExit as any).targetSector = config.adjacentZones[1];

          this.world.player.x = result.playerStart.x;
          this.world.player.y = result.playerStart.y;

      } else {
          // Standard Static Load
          this.sectorLoader.loadFromTemplate(this.world, template);
          
          // Restore saved state if exists (and not purely procedural/re-rollable)
          if (this.worldState.hasSector(template.id) && !template.metadata.isInstanced) {
              const savedEntities = this.worldState.loadSector(template.id);
              this.world.entities = this.world.entities.filter(e => e.type === 'WALL');
              this.world.entities.push(...savedEntities);
          } else {
              this.world.player.x = template.metadata.playerStart.x;
              this.world.player.y = template.metadata.playerStart.y;
          }
      }
      
      // Handle Spawn Points based on entry direction
      if (previousZoneId) {
          // If we came from "UP" (previous sector), we are at Start.
          // If we came from "DOWN" (next sector), we should be at the End.
          const config = this.graph.zones[template.id];
          const prevIndex = config.adjacentZones.indexOf(previousZoneId);
          
          // 0 = Up/Prev, 1 = Down/Next
          if (prevIndex === 1) { 
              // Came from below, spawn at Down Exit
              const exit = this.world.entities.find(e => e.type === 'EXIT' && e.exitType === 'DOWN');
              if (exit) {
                  this.world.player.x = exit.x;
                  this.world.player.y = exit.y - 100;
              }
          } else {
              // Came from above, spawn at Up Exit (Start)
              const exit = this.world.entities.find(e => e.type === 'EXIT' && e.exitType === 'UP');
              if (exit) {
                  this.world.player.x = exit.x;
                  this.world.player.y = exit.y + 100;
              }
          }
      }

      this.world.camera.x = this.world.player.x;
      this.world.camera.y = this.world.player.y;
  }
}
