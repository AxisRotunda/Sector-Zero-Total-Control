
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
import { AdaptiveQualityService } from '../../systems/adaptive-quality.service';

@Injectable({ providedIn: 'root' })
export class SectorLoaderService {
  private entityPool = inject(EntityPoolService);
  private narrative = inject(NarrativeService);
  private spatialHash = inject(SpatialHashService);
  private proofKernel = inject(ProofKernelService);
  private eventBus = inject(EventBusService);
  private adaptiveQuality = inject(AdaptiveQualityService);

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

          // --- FORMAL VERIFICATION ---
          // Use Segment Logic (1D) to allow T-junctions/Corners, banning only collinear overlap
          try {
              const walls = world.entities.filter(e => e.type === 'WALL');
              
              const geometrySnapshots = walls.map((w, idx) => ({
                  kernelId: idx,
                  entityId: w.data?.id ?? w.id, // Prefer authored ID if available, else runtime ID
                  kind: w.data?.kind ?? 'STRUCTURAL', // Default to STRUCTURAL if not tagged
                  x: w.x, 
                  y: w.y, 
                  w: w.width || 40, 
                  h: w.depth || 40
              }));

              const segments = geometrySnapshots
                .filter(s => s.kind === 'STRUCTURAL')
                .map(s => {
                    // Determine primary axis
                    const vertical = (s.h || 0) > (s.w || 0);
                    const base = { entityId: s.entityId, role: 'DEFAULT' }; // Future: pull role from data
                    if (vertical) {
                        return {
                            ...base,
                            x1: s.x,
                            y1: s.y - s.h / 2,
                            x2: s.x,
                            y2: s.y + s.h / 2,
                        };
                    } else {
                        return {
                            ...base,
                            x1: s.x - s.w / 2,
                            y1: s.y,
                            x2: s.x + s.w / 2,
                            y2: s.y,
                        };
                    }
                });
              
              // Debug dump for troubleshooting geometry conflicts
              // console.groupCollapsed('[DEBUG] Structural Segments');
              // segments.forEach((s, i) => {
              //   console.log('i=%o entityId=%o x1=%o y1=%o x2=%o y2=%o', i, s.entityId, s.x1, s.y1, s.x2, s.y2);
              // });
              // console.groupEnd();

              // New Segment Check
              this.proofKernel.verifyStructuralSegments(segments);
              
              // Optional: Run full AABB check only on decorative/non-structural elements if needed
              // or keep as a "soft" warning in development builds. For now, segments replace AABB for walls.
              
          } catch (verifyErr) {
              console.warn('[SectorLoader] Verification Exception:', verifyErr);
              
              // Graceful degradation: Lock quality to HIGH to prevent GPU overload during instability
              this.adaptiveQuality.setSafetyCap('HIGH');

              this.eventBus.dispatch({
                  type: GameEvents.REALITY_BLEED,
                  payload: { severity: 'MEDIUM', source: 'SECTOR_LOAD_VERIFY', message: 'Geometry verification bypassed due to instability' }
              });
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
      
      // Preserve template data (ID, kind, etc)
      if (def.data) {
          wall.data = { ...def.data };
      }
      // If template has explicit ID but not nested in data, attach it
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

      // Static vs Dynamic separation
      if (e.type === 'DECORATION') {
          // If decoration is static floor type, render specially or add to static list
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
      exit.exitType = def.direction; // Legacy mapping
      exit.zoneId = zoneId;
      
      // Modern properties
      if (def.targetZoneId) (exit as any).targetZoneId = def.targetZoneId;
      if (def.transitionType) (exit as any).transitionType = def.transitionType;
      if (def.spawnOverride) exit.spawnOverride = def.spawnOverride;
      
      exit.locked = def.locked;
      if (exit.locked) exit.color = '#ef4444';
      else exit.color = def.direction === 'DOWN' ? '#22c55e' : '#f97316';
      
      world.entities.push(exit);
  }
}
