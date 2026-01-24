
import { Injectable, inject } from '@angular/core';
import { WorldService } from './world.service';
import { EntityPoolService } from '../../services/entity-pool.service';
import { ZoneTemplate, ZoneEntityDef } from '../../models/zone.models';
import { NarrativeService } from '../narrative.service';
import { MapUtils } from '../../utils/map-utils';
import { SpatialHashService } from '../../systems/spatial-hash.service';
import { DECORATIONS } from '../../config/decoration.config';

@Injectable({ providedIn: 'root' })
export class SectorLoaderService {
  private entityPool = inject(EntityPoolService);
  private narrative = inject(NarrativeService);
  private spatialHash = inject(SpatialHashService);

  loadFromTemplate(world: WorldService, template: ZoneTemplate): void {
      try {
          const zoneId = template.id;

          // 1. Set Global Zone Params
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
              isSafeZone: template.isSafeZone // New Safe Zone flag
          });
          world.mapBounds = template.bounds;

          // 2. Spawn Walls
          if (template.geometry.walls) {
              template.geometry.walls.forEach(w => this.spawnWall(world, w, zoneId));
          }

          // 3. Merge Walls optimization
          world.entities = MapUtils.mergeWalls(world.entities);

          // 4. Insert Walls into Static Spatial Hash
          world.entities.forEach(e => {
              if (e.type === 'WALL') {
                  this.spatialHash.insert(e, true);
              }
          });

          // 5. Spawn Entities (Static & Dynamic)
          if (template.entities.static) {
              template.entities.static.forEach(e => this.spawnEntity(world, e, zoneId));
          }
          if (template.entities.dynamic) {
              template.entities.dynamic.forEach(e => this.spawnEntity(world, e, zoneId));
          }

          // 6. Insert Static Decorations into Static Spatial Hash
          world.staticDecorations.forEach(e => {
              this.spatialHash.insert(e, true);
          });

          // 7. Spawn Exits
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
      
      world.entities.push(wall);
  }

  private spawnEntity(world: WorldService, def: ZoneEntityDef, zoneId: string) {
      // Progressive Unlocking: Check Narrative Condition
      if (def.conditionFlag) {
          const isMet = this.narrative.getFlag(def.conditionFlag);
          if (!isMet) return; // Skip spawning
      }

      const e = this.entityPool.acquire(def.type as any, def.subType as any);
      e.x = def.x; e.y = def.y; e.zoneId = zoneId;
      
      // Defaults
      if (!e.radius) e.radius = 20;
      if (!e.color) e.color = '#fff';

      // Apply Config Defaults if available
      if (def.subType && DECORATIONS[def.subType]) {
          const config = DECORATIONS[def.subType];
          e.width = config.width;
          e.height = config.height;
          e.depth = config.depth; 
          e.color = config.baseColor;
      }

      // Apply Instance Overrides
      if (def.data) {
          // CRITICAL FIX: Propagate the entire data object to the entity.
          // This ensures properties like 'targetZone' for transitions are preserved.
          e.data = { ...def.data };

          // Map specific properties to entity root for performance/logic access
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
          if (e.type === 'SPAWNER') {
              e.spawnType = def.data.spawnType;
              e.spawnMax = def.data.spawnMax;
              e.spawnCooldown = def.data.spawnCooldown;
              e.spawnedIds = [];
              e.timer = 0;
              e.color = '#333'; 
              e.radius = 20;
          }
          // AI Properties
          if (def.data.patrolPoints) e.patrolPoints = def.data.patrolPoints;
          if (def.data.homeX !== undefined) e.homeX = def.data.homeX;
          if (def.data.homeY !== undefined) e.homeY = def.data.homeY;
          if (def.data.wanderRadius !== undefined) e.aggroRadius = def.data.wanderRadius;
      }
      
      // --- ID MAPPING ---
      // If the definition has a stable ID, persist it in the data bag for runtime lookup
      if (def.id) {
          if (!e.data) e.data = {};
          e.data.id = def.id;
      }
      
      // Special logic for NPCs colors if not overridden
      if (e.type === 'NPC' && (!def.data || !def.data.color)) {
          if (!e.radius) e.radius = 25;
          e.interactionRadius = 100;
          if (e.subType === 'MEDIC') e.color = '#ef4444';
          else if (e.subType === 'TRADER') e.color = '#eab308';
          else if (e.subType === 'HANDLER') e.color = '#3b82f6';
          else if (e.subType === 'GUARD') e.color = '#1d4ed8';
          else e.color = '#94a3b8';
      }

      // Determine storage list based on Config
      if (e.type === 'DECORATION' && e.subType && DECORATIONS[e.subType]?.isStaticFloor) {
          world.staticDecorations.push(e);
      } else {
          world.entities.push(e);
      }
  }

  private spawnExit(world: WorldService, def: any, zoneId: string) {
      const exit = this.entityPool.acquire('EXIT');
      exit.x = def.x; exit.y = def.y;
      exit.exitType = def.direction || 'DOWN'; 
      exit.targetX = 0;
      
      // Visuals: Logic to distinguish Return (HUB) portals from Forward (Danger) gates
      if (def.targetZoneId === 'HUB') {
          exit.color = '#06b6d4'; // Cyan for Return
      } else {
          exit.color = def.transitionType === 'GATE' ? '#ef4444' : '#f97316';
      }

      exit.radius = 40; 
      exit.zoneId = zoneId;
      (exit as any).targetSector = def.targetZoneId;
      
      // Defensive Copy: Only set spawnOverride if defined
      if (def.spawnOverride) {
          exit.spawnOverride = { x: def.spawnOverride.x, y: def.spawnOverride.y };
      }
      
      if (def.locked) {
          const isOpen = this.narrative.getFlag('GATE_OPEN'); 
          if (!isOpen) { 
              exit.locked = true;
              exit.color = '#991b1b';
          }
      }
      world.entities.push(exit);
  }
}
