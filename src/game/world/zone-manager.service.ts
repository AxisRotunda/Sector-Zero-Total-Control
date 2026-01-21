
import { Injectable, inject, signal } from '@angular/core';
import { WorldService } from './world.service';
import { WorldStateService } from './world-state.service';
import { WORLD_GRAPH } from '../../data/world/world-graph.config';
import { ZoneTemplate } from '../../models/zone.models';
import { PlayerService } from '../player/player.service';
import { SoundService } from '../../services/sound.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { GameEvents } from '../../core/events/game-events';
import { NarrativeService } from '../narrative.service';
import { ZONE_LORE } from '../../config/narrative.config';
import { StaticZoneLoader } from './strategies/static-zone-loader';
import { ProceduralZoneLoader } from './strategies/procedural-zone-loader';
import { ZoneTransitionState } from './models/zone-transition.types';
import { SpatialHashService } from '../../systems/spatial-hash.service';

@Injectable({
  providedIn: 'root'
})
export class ZoneManagerService {
  private world = inject(WorldService);
  private worldState = inject(WorldStateService);
  private player = inject(PlayerService);
  private sound = inject(SoundService);
  private eventBus = inject(EventBusService);
  private narrative = inject(NarrativeService);
  private spatialHash = inject(SpatialHashService); // Direct injection to fix circular/any cast issue

  // Strategies
  private staticLoader = inject(StaticZoneLoader);
  private proceduralLoader = inject(ProceduralZoneLoader);

  private graph = WORLD_GRAPH;
  
  currentZoneId = signal<string>('HUB');
  transitionState = signal<ZoneTransitionState>(ZoneTransitionState.IDLE);

  async transitionToZone(targetZoneId: string) {
    const targetConfig = this.graph.zones[targetZoneId];
    
    if (!targetConfig) {
      console.error(`Zone ${targetZoneId} not defined in WorldGraph`);
      this.transitionState.set(ZoneTransitionState.ERROR);
      return;
    }

    const currentId = this.currentZoneId();

    try {
        // --- STEP 1: SAVE ---
        this.transitionState.set(ZoneTransitionState.SAVING_CURRENT);
        this.worldState.saveSector(currentId, this.world.entities);

        // --- STEP 2: CLEANUP ---
        this.spatialHash.clearAll();
        this.sound.play('ZONE_CHANGE');

        // --- STEP 3: LOAD ---
        this.transitionState.set(ZoneTransitionState.LOADING_NEW);
        await this.loadZoneStrategy(targetConfig.template, currentId);
        
        // --- STEP 4: SPAWN ---
        this.transitionState.set(ZoneTransitionState.SPAWNING_PLAYER);
        this.currentZoneId.set(targetZoneId);
        this.player.currentSectorId.set(targetZoneId); 

        // --- STEP 5: DISCOVERY ---
        this.transitionState.set(ZoneTransitionState.DISCOVERY_CHECK);
        await this.checkDiscovery(targetZoneId, targetConfig.displayName);

        // --- COMPLETE ---
        this.transitionState.set(ZoneTransitionState.COMPLETE);
        // Reset to IDLE after a short delay so UI can react
        setTimeout(() => this.transitionState.set(ZoneTransitionState.IDLE), 500);

    } catch (e) {
        console.error("Zone Transition Failed", e);
        this.transitionState.set(ZoneTransitionState.ERROR);
    }
  }

  async initWorld(startZoneId: string = 'HUB') {
      const config = this.graph.zones[startZoneId] || this.graph.zones[this.graph.rootZoneId];
      this.currentZoneId.set(config.id);
      this.player.currentSectorId.set(config.id);
      
      this.spatialHash.clearAll();
      await this.loadZoneStrategy(config.template);
      
      this.checkDiscovery(config.id, config.displayName);
  }

  private async loadZoneStrategy(template: ZoneTemplate, previousZoneId?: string) {
      const isProcedural = (!template.geometry.walls || template.geometry.walls.length === 0) && template.metadata.isInstanced;
      const loader = isProcedural ? this.proceduralLoader : this.staticLoader;

      await loader.load(this.world, { template, previousZoneId });
      
      this.handleSpawnPoint(template, previousZoneId);
      
      // Update Camera immediately
      this.world.camera.x = this.world.player.x;
      this.world.camera.y = this.world.player.y;
  }

  private handleSpawnPoint(template: ZoneTemplate, previousZoneId?: string) {
      if (!previousZoneId) return;

      const config = this.graph.zones[template.id];
      // Find index of previous zone in adjacency list to determine direction
      // Logic: If I came from Index 0 (Up), I am at the "Up" exit usually, but traversing DOWN.
      // Simply:
      // If previousZone == adjacentZones[0] (The "Parent"), I entered via UP gate, so spawn at UP exit.
      // If previousZone == adjacentZones[1] (The "Child"), I entered via DOWN gate, so spawn at DOWN exit.
      
      const prevIndex = config.adjacentZones.indexOf(previousZoneId);
      
      let spawnExit: any = null;

      if (prevIndex === 1) { 
          // Came from the "Next" zone (Below), so spawn at the DOWN exit (End of level)
          spawnExit = this.world.entities.find(e => e.type === 'EXIT' && e.exitType === 'DOWN');
          if (spawnExit) {
              this.world.player.x = spawnExit.x;
              this.world.player.y = spawnExit.y - 100; // Offset slightly
          }
      } else {
          // Came from "Prev" zone (Above) or default, spawn at UP exit (Start of level)
          spawnExit = this.world.entities.find(e => e.type === 'EXIT' && e.exitType === 'UP');
          if (spawnExit) {
              this.world.player.x = spawnExit.x;
              this.world.player.y = spawnExit.y + 100; // Offset slightly
          }
      }
  }

  private async checkDiscovery(zoneId: string, displayName: string) {
      // Small delay to ensure render frame has processed if needed, or just for feel
      await new Promise(resolve => setTimeout(resolve, 500));

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
}
