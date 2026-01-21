
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
import { ZoneHierarchyManagerService } from './zone-hierarchy-manager.service';

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
  private spatialHash = inject(SpatialHashService);
  private hierarchy = inject(ZoneHierarchyManagerService);

  // Strategies
  private staticLoader = inject(StaticZoneLoader);
  private proceduralLoader = inject(ProceduralZoneLoader);

  private graph = WORLD_GRAPH;
  
  currentZoneId = signal<string>('HUB');
  transitionState = signal<ZoneTransitionState>(ZoneTransitionState.IDLE);

  async transitionToZone(targetZoneId: string) {
    const targetConfig = this.graph.zones[targetZoneId];
    
    if (!targetConfig) {
      console.error(`Zone ${targetZoneId} not defined`);
      return;
    }

    const currentId = this.currentZoneId();
    this.transitionState.set(ZoneTransitionState.SAVING_CURRENT);

    try {
        // 1. Save Current State
        // Only save dynamic entities related to the current zone to avoid cross-contamination
        const path = this.hierarchy.getPathToRoot(currentId);
        this.worldState.saveSector(currentId, this.world.entities, path);

        // 2. Determine Transition Type (Visuals)
        const parentId = this.hierarchy.getParent(currentId);
        if (targetConfig.parentZoneId === currentId) {
            // Downward (Parent -> Child)
            this.sound.play('ZONE_CHANGE');
        } else if (parentId === targetZoneId) {
            // Upward (Child -> Parent)
            this.sound.play('ZONE_CHANGE');
        }

        // 3. Clean up old zone entities
        // If HUB is persistent, we might keep it, but for simplicity in MVP we reload geometry to avoid dupes
        this.world.entities = this.world.entities.filter(e => e.type === 'PLAYER');
        this.world.staticDecorations = [];
        this.spatialHash.clearAll();

        // 4. Load New Zone
        this.transitionState.set(ZoneTransitionState.LOADING_NEW);
        await this.loadZoneStrategy(targetConfig.template, currentId);
        
        // 5. Update State
        this.currentZoneId.set(targetZoneId);
        this.player.currentSectorId.set(targetZoneId);
        this.world.player.zoneId = targetZoneId; // Track player zone on Entity

        // 6. Discovery & Events
        this.checkDiscovery(targetZoneId, targetConfig.displayName);
        this.transitionState.set(ZoneTransitionState.COMPLETE);
        setTimeout(() => this.transitionState.set(ZoneTransitionState.IDLE), 500);

    } catch (e) {
        console.error("Transition Failed", e);
        this.transitionState.set(ZoneTransitionState.ERROR);
    }
  }

  async initWorld(startZoneId: string = 'HUB') {
      const config = this.graph.zones[startZoneId] || this.graph.zones[this.graph.rootZoneId];
      this.currentZoneId.set(config.id);
      this.player.currentSectorId.set(config.id);
      this.world.player.zoneId = config.id;
      
      this.world.entities = [];
      this.world.staticDecorations = [];
      this.spatialHash.clearAll();
      
      await this.loadZoneStrategy(config.template);
      this.checkDiscovery(config.id, config.displayName);
  }

  private async loadZoneStrategy(template: ZoneTemplate, previousZoneId?: string) {
      const isProcedural = (!template.geometry.walls || template.geometry.walls.length === 0) && template.metadata.isInstanced;
      const loader = isProcedural ? this.proceduralLoader : this.staticLoader;

      await loader.load(this.world, { template, previousZoneId });
      
      this.handleSpawnPoint(template, previousZoneId);
      
      // Sync Camera
      this.world.camera.x = this.world.player.x;
      this.world.camera.y = this.world.player.y;
  }

  private handleSpawnPoint(template: ZoneTemplate, previousZoneId?: string) {
      if (!previousZoneId) return;

      // Find the exit that points back to where we came from
      // If I came from 'HUB', look for exit with targetZoneId='HUB'
      const entrance = this.world.entities.find(e => 
          e.type === 'EXIT' && (e as any).targetSector === previousZoneId
      );

      if (entrance) {
          // Spawn 'in front' of the exit
          this.world.player.x = entrance.x;
          this.world.player.y = entrance.y + (entrance.exitType === 'DOWN' ? -100 : 100);
      } else {
          // Fallback
          this.world.player.x = template.metadata.playerStart.x;
          this.world.player.y = template.metadata.playerStart.y;
      }
  }

  private async checkDiscovery(zoneId: string, displayName: string) {
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
