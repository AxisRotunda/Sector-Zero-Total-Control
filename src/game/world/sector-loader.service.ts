
import { Injectable, inject } from '@angular/core';
import { WorldService } from './world.service';
import { EntityPoolService } from '../../services/entity-pool.service';
import { ZoneTemplate, ZoneEntityDef } from '../../models/zone.models';
import { NarrativeService } from '../narrative.service';
import { MapUtils } from '../../utils/map-utils';
import { SpatialHashService } from '../../systems/spatial-hash.service';
import { DECORATIONS } from '../../config/decoration.config';
import { ProofKernelService } from '../../core/proof/proof-kernel.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { GameEvents } from '../../core/events/game-events';
import { GeometryMapping } from '../../utils/geometry-mapping.util';

@Injectable({ providedIn: 'root' })
export class SectorLoaderService {
  private entityPool = inject(EntityPoolService);
  private narrative = inject(NarrativeService);
  private spatialHash = inject(SpatialHashService);
  private proofKernel = inject(ProofKernelService);
  private eventBus = inject(EventBusService);

  loadFromTemplate(world: WorldService, template: ZoneTemplate): void {
      try {
          const zoneId = template.id;

          world.currentZone.set({
              id: template.id,
              name: template.name,
              theme: template.theme,
              groundColor: template.environment.colors.ground,
              wallColor: template.environment.colors.wall,
              detailColor: template.environment.colors.detail,
              minDepth: 0,
              difficultyMult: template.metadata.difficulty,
              weather: template.environment.weather,
              floorPattern: template.environment.floorPattern,
              ambientColor: template.environment.ambientColor,
              isSafeZone: template.isSafeZone 
          });
          world.mapBounds = template.bounds;

          if (template.geometry.walls) {
              template.geometry.walls.forEach(w => this.spawnWall(world, w, zoneId));
          }

          world.entities = MapUtils.mergeWalls(world.entities);

          // --- KERNEL VERIFICATION: AUTHORITATIVE GATE ---
          try {
              const walls = world.entities.filter(e => e.type === 'WALL');
              
              // Use standardized mapping module
              const rects = walls.map(w => GeometryMapping.fromEntity(w));

              if (rects.length > 0) {
                  // The verifyGeometry method now handles the logic for STRICT_DEV throwing
                  // and SOFT_PROD logging automatically.
                  this.proofKernel.verifyGeometry(rects, zoneId, "SECTOR_LOAD");
              }
              
          } catch (verifyErr: any) {
              // This catch block catches STRICT_DEV throws
              console.error('[SectorLoader] HARD GATE REJECTION:', verifyErr.message);
              // In strict mode, we want to stop loading to prevent broken state
              throw verifyErr; 
          }

          world.entities.forEach(e => {
              if (e.type === 'WALL') {
                  this.spatialHash.insert(e, true);
              }
          });

          if (template.entities.static) {
              template.entities.static.forEach(e => this.spawnEntity(world, e, zoneId));
          }
          if (template.entities.dynamic) {
              template.entities.dynamic.forEach(e => this.spawnEntity(world, e, zoneId));
          }

          world.staticDecorations.forEach(e => {
              this.spatialHash.insert(e, true);
          });

          if (template.exits) {
              template.exits.forEach(e => this.spawnExit(world, e, zoneId));
          }
          
      } catch (e) {
          console.error("Critical Zone Load Error:", e);
          const fallback = this.entityPool.acquire('WALL');
          fallback.x = 100; fallback.y = 100; fallback.width = 100; fallback.height = 100; fallback.color = '#fff';
          fallback.zoneId = 'ERROR';
          world.entities.push(fallback);
          this.spatialHash.insert(fallback, true);
          
          this.eventBus.dispatch({
              type: GameEvents.REALITY_BLEED,
              payload: { severity: 'CRITICAL', source: 'SECTOR_LOAD_CRASH', message: 'Sector initialization failed. Loading fallback geometry.' }
          });
      }
  }

  private spawnWall(world: WorldService, def: any, zoneId: string) {
      const wall = this.entityPool.acquire('WALL', def.type as any);
      wall.x = def.x; wall.y = def.y;
      wall.width = def.w; wall.depth = def.h;
      wall.zoneId = zoneId;
      
      if (def.height) wall.height = def.height;
      else wall.height = 100; 
      
      wall.color = def.color || '#333';
      
      if (def.type === 'GATE_SEGMENT') {
          const isOpen = this.narrative.getFlag('GATE_OPEN');
          wall.locked = def.locked && !isOpen;
          if (!wall.locked) wall.color = '#22c55e';
      }
      
      if (def.data) {
          wall.data = { ...def.data };
      }
      if (def.id && (!wall.data || !wall.data.id)) {
          if (!wall.data) wall.data = {};
          wall.data.id = def.id;
      }
      
      world.entities.push(wall);
  }

  private spawnEntity(world: WorldService, def: ZoneEntityDef, zoneId: string) {
      if (def.conditionFlag) {
          const isMet = this.narrative.getFlag(def.conditionFlag);
          if (!isMet) return; 
      }

      const e = this.entityPool.acquire(def.type as any, def.subType as any);
      e.x = def.x; e.y = def.y; e.zoneId = zoneId;
      
      if (!e.radius) e.radius = 20;
      if (!e.color) e.color = '#fff';

      if (def.subType && DECORATIONS[def.subType]) {
          const config = DECORATIONS[def.subType];
          e.width = config.width;
          e.height = config.height;
          e.depth = config.depth; 
          e.color = config.baseColor;
      }

      if (def.data) {
          e.data = { ...def.data };

          if (def.data.dialogueId) e.dialogueId = def.data.dialogueId;
          if (def.data.color) e.color = def.data.color;
          if (def.data.width) e.width = def.data.width;
          if (def.data.height) e.height = def.data.height;
          if (def.data.depth) e.depth = def.data.depth;
          
          if (def.data.targetX !== undefined) {
              e.targetX = def.data.targetX;
              e.targetY = def.data.targetY;
              e.z = def.data.z || 0;
          }
          if (e.data.spawnType) e.spawnType = e.data.spawnType;
      }

      if (e.type === 'DECORATION') {
          if (['RUG', 'FLOOR_CRACK', 'GRAFFITI', 'TRASH'].includes(e.subType || '')) {
              world.staticDecorations.push(e);
          } else {
              world.entities.push(e);
          }
      } else {
          world.entities.push(e);
      }
  }

  private spawnExit(world: WorldService, def: any, zoneId: string) {
      const exit = this.entityPool.acquire('EXIT');
      exit.x = def.x; exit.y = def.y;
      exit.exitType = def.direction;
      exit.zoneId = zoneId;
      
      if (def.targetZoneId) (exit as any).targetZoneId = def.targetZoneId;
      if (def.transitionType) (exit as any).transitionType = def.transitionType;
      if (def.spawnOverride) exit.spawnOverride = def.spawnOverride;
      
      exit.locked = def.locked;
      if (exit.locked) exit.color = '#ef4444';
      else exit.color = def.direction === 'DOWN' ? '#22c55e' : '#f97316';
      
      world.entities.push(exit);
  }
}
