
import { Injectable, inject, signal, effect } from '@angular/core';
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
import { Entity } from '../../models/game.models';
import { WaypointService } from './waypoint.service';
import { EntityPoolService } from '../../services/entity-pool.service';

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
  private waypointService = inject(WaypointService);
  private entityPool = inject(EntityPoolService);

  // Strategies
  private staticLoader = inject(StaticZoneLoader);
  private proceduralLoader = inject(ProceduralZoneLoader);

  private graph = WORLD_GRAPH;
  
  currentZoneId = signal<string>('HUB');
  transitionState = signal<ZoneTransitionState>(ZoneTransitionState.IDLE);

  constructor() {
      // Listen for Reset Flag from Dialogue
      effect(() => {
          if (this.narrative.getFlag('RESET_ZONE_ENTITIES')) {
              this.clearZoneEntities(this.currentZoneId());
              this.narrative.setFlag('RESET_ZONE_ENTITIES', false); // Consume flag
          }
      });
  }

  async transitionToZone(targetZoneId: string, spawnOverride?: {x: number, y: number}) {
    const targetConfig = this.graph.zones[targetZoneId];
    
    if (!targetConfig) {
      console.error(`Zone ${targetZoneId} not defined`);
      return;
    }

    const currentId = this.currentZoneId();
    this.transitionState.set(ZoneTransitionState.SAVING_CURRENT);

    try {
        // 1. Save Current State
        const path = this.hierarchy.getPathToRoot(currentId);
        this.worldState.saveSector(currentId, this.world.entities, path);

        // 2. Determine Transition Type (Visuals)
        const parentId = this.hierarchy.getParent(currentId);
        if (targetConfig.parentZoneId === currentId) {
            this.sound.play('ZONE_CHANGE');
        } else if (parentId === targetZoneId) {
            this.sound.play('ZONE_CHANGE');
        }

        // 3. Clean up old zone entities
        this.world.entities = this.world.entities.filter(e => e.type === 'PLAYER');
        this.world.staticDecorations = [];
        this.spatialHash.clearAll();

        // 4. Load New Zone
        this.transitionState.set(ZoneTransitionState.LOADING_NEW);
        await this.loadZoneStrategy(targetConfig.template, currentId, spawnOverride);
        
        // 5. Update State
        this.currentZoneId.set(targetZoneId);
        this.player.currentSectorId.set(targetZoneId);
        this.world.player.zoneId = targetZoneId;

        // 6. Discovery & Events
        this.checkDiscovery(targetZoneId, targetConfig.displayName);
        
        // 7. Check Riftgate Unlock
        if (targetConfig.template.metadata.hasRiftgate) {
            this.waypointService.unlockWaypoint(targetZoneId);
        }

        // 8. Respawn Personal Rift Visual (Persistence Fix)
        const rift = this.waypointService.personalRift();
        if (rift && rift.active && rift.sourceZoneId === targetZoneId) {
            const portal = this.entityPool.acquire('INTERACTABLE', 'PORTAL');
            portal.x = rift.x;
            portal.y = rift.y;
            portal.zoneId = targetZoneId;
            portal.data = { isPersonal: true };
            this.world.entities.push(portal);
        }

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
      
      if (config.template.metadata.hasRiftgate) {
          this.waypointService.unlockWaypoint(config.id);
      }
  }

  clearZoneEntities(zoneId: string): void {
    if (zoneId !== this.currentZoneId()) return;

    // Filter out Player, Walls, Interactables, Decor
    const keepers = this.world.entities.filter(e => 
        e.type === 'PLAYER' || 
        e.type === 'WALL' || 
        e.type === 'DECORATION' || 
        e.type === 'TERMINAL' ||
        (e.type === 'NPC' && e.subType !== 'GUARD') // Keep non-hostile NPCs
    );
    
    // The ones to remove are implicitly dropped
    this.world.entities = keepers;
    this.spatialHash.clearDynamic(zoneId); 

    // Reset spawners
    const spawners = this.world.entities.filter(e => e.type === 'SPAWNER');
    spawners.forEach(s => {
        s.spawnedIds = [];
        s.timer = 0;
    });

    this.eventBus.dispatch({ 
        type: GameEvents.FLOATING_TEXT_SPAWN, 
        payload: { onPlayer: true, yOffset: -100, text: "SIMULATION RESET", color: '#fbbf24', size: 24 } 
    });
  }

  private async loadZoneStrategy(template: ZoneTemplate, previousZoneId?: string, spawnOverride?: {x: number, y: number}) {
      const isProcedural = (!template.geometry.walls || template.geometry.walls.length === 0) && template.metadata.isInstanced;
      const loader = isProcedural ? this.proceduralLoader : this.staticLoader;

      await loader.load(this.world, { template, previousZoneId });
      
      this.handleSpawnPoint(template, previousZoneId, spawnOverride);
      
      this.world.camera.x = this.world.player.x;
      this.world.camera.y = this.world.player.y;
  }

  private handleSpawnPoint(template: ZoneTemplate, previousZoneId?: string, spawnOverride?: {x: number, y: number}) {
      if (spawnOverride) {
          this.world.player.x = spawnOverride.x;
          this.world.player.y = spawnOverride.y;
          return;
      }

      if (!previousZoneId) {
          this.world.player.x = template.metadata.playerStart.x;
          this.world.player.y = template.metadata.playerStart.y;
          return;
      }

      const entrance = this.world.entities.find(e => 
          e.type === 'EXIT' && (e as any).targetSector === previousZoneId
      );

      if (entrance) {
          this.world.player.x = entrance.x;
          this.world.player.y = entrance.y + (entrance.exitType === 'DOWN' ? -100 : 100);
      } else {
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
