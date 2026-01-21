
import { Injectable, inject } from '@angular/core';
import { WorldService } from './world.service';
import { EntityPoolService } from '../../services/entity-pool.service';
import { ZoneTemplate, ZoneEntityDef } from '../../models/zone.models';
import { NarrativeService } from '../narrative.service';
import { MapUtils } from '../../utils/map-utils';
import { SpatialHashService } from '../../systems/spatial-hash.service';

@Injectable({ providedIn: 'root' })
export class SectorLoaderService {
  private entityPool = inject(EntityPoolService);
  private narrative = inject(NarrativeService);
  private spatialHash = inject(SpatialHashService);

  private readonly STATIC_DECORATION_TYPES = new Set([
      'RUG', 'FLOOR_CRACK', 'GRAFFITI', 'TRASH', 'CABLE', 
      'VENDING_MACHINE', 'BENCH', 'STREET_LIGHT', 'SIGN_POST', 
      'PLANT_BOX', 'MURAL', 'MONOLITH', 'NEON', 'HOLO_TABLE'
  ]);

  loadFromTemplate(world: WorldService, template: ZoneTemplate): void {
      try {
          const zoneId = template.id;

          // 1. Set Global Zone Params
          world.currentZone.set({
              id: template.id, // Set ID
              name: template.name,
              theme: template.theme,
              groundColor: template.environment.colors.ground,
              wallColor: template.environment.colors.wall,
              detailColor: template.environment.colors.detail,
              minDepth: 0,
              difficultyMult: template.metadata.difficulty,
              weather: template.environment.weather,
              floorPattern: template.environment.floorPattern
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
      const e = this.entityPool.acquire(def.type as any, def.subType as any);
      e.x = def.x; e.y = def.y; e.zoneId = zoneId;
      
      if (!e.radius) e.radius = 20;
      if (!e.color) e.color = '#fff';

      if (def.data) {
          if (def.data.dialogueId) e.dialogueId = def.data.dialogueId;
          if (def.data.color) e.color = def.data.color;
          if (def.data.width) e.width = def.data.width;
          if (def.data.height) e.height = def.data.height;
          
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
          if (def.data.wanderRadius !== undefined) e.aggroRadius = def.data.wanderRadius; // Reuse aggro for wander bounds
      }
      
      if (e.type === 'NPC') {
          if (!e.radius) e.radius = 25;
          e.interactionRadius = 100;
          if (!e.color) {
              if (e.subType === 'MEDIC') e.color = '#ef4444';
              else if (e.subType === 'TRADER') e.color = '#eab308';
              else if (e.subType === 'HANDLER') e.color = '#3b82f6';
              else if (e.subType === 'GUARD') e.color = '#1d4ed8';
              else e.color = '#94a3b8';
          }
      }

      if (e.type === 'DECORATION' && !e.width) e.width = 40;
      if (e.type === 'DECORATION' && !e.height) e.height = 40;

      if (e.type === 'DECORATION' && this.STATIC_DECORATION_TYPES.has(e.subType || '')) {
          world.staticDecorations.push(e);
      } else {
          world.entities.push(e);
      }
  }

  private spawnExit(world: WorldService, def: any, zoneId: string) {
      const exit = this.entityPool.acquire('EXIT');
      exit.x = def.x; exit.y = def.y;
      exit.exitType = def.direction || 'DOWN'; // Legacy compat
      exit.targetX = 0;
      exit.color = def.transitionType === 'GATE' ? '#ef4444' : '#f97316';
      exit.radius = 40; 
      exit.zoneId = zoneId;
      (exit as any).targetSector = def.targetZoneId;
      
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
