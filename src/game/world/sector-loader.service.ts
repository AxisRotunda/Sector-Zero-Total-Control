
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

  // Entities that should be baked into the static world layer and not updated dynamically
  private readonly STATIC_DECORATION_TYPES = new Set([
      'RUG', 'FLOOR_CRACK', 'GRAFFITI', 'TRASH', 'CABLE', 
      'VENDING_MACHINE', 'BENCH', 'STREET_LIGHT', 'SIGN_POST', 
      'PLANT_BOX', 'MURAL', 'MONOLITH', 'NEON', 'HOLO_TABLE'
  ]);

  loadFromTemplate(world: WorldService, template: ZoneTemplate): void {
      try {
          // 1. Set Global Zone Params
          world.currentZone.set({
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

          // 2. Clear current entities (important if not handled by caller)
          // Note: WorldService usually handles reset, but we ensure here we start fresh for the loader
          // (Caller ZoneManager handles proper reset of world.entities before calling this)
          
          // 3. Spawn Walls
          if (template.geometry.walls) {
              template.geometry.walls.forEach(w => this.spawnWall(world, w));
          }

          // 4. Merge Walls optimization
          world.entities = MapUtils.mergeWalls(world.entities);

          // 4b. Insert Walls into Static Spatial Hash
          // Walls are in world.entities but are static. We must register them for collision/rendering.
          world.entities.forEach(e => {
              if (e.type === 'WALL') {
                  this.spatialHash.insert(e, true); // true = static
              }
          });

          // 5. Spawn Entities (Static & Dynamic)
          if (template.entities.static) {
              template.entities.static.forEach(e => this.spawnEntity(world, e));
          }
          if (template.entities.dynamic) {
              template.entities.dynamic.forEach(e => this.spawnEntity(world, e));
          }

          // 5b. Insert Static Decorations into Static Spatial Hash
          world.staticDecorations.forEach(e => {
              this.spatialHash.insert(e, true);
          });

          // 6. Spawn Exits
          if (template.exits) {
              template.exits.forEach(e => this.spawnExit(world, e));
          }
          
      } catch (e) {
          console.error("Critical Zone Load Error:", e);
          const fallback = this.entityPool.acquire('WALL');
          fallback.x = 100; fallback.y = 100; fallback.width = 100; fallback.height = 100; fallback.color = '#fff';
          world.entities.push(fallback);
          this.spatialHash.insert(fallback, true);
      }
  }

  // Deprecated legacy method wrapper for compatibility if needed
  loadSector(world: WorldService, sectorId: string): void {
      console.warn("SectorLoaderService.loadSector is deprecated. Use ZoneManagerService.");
  }

  private spawnWall(world: WorldService, def: any) {
      const wall = this.entityPool.acquire('WALL', def.type as any);
      wall.x = def.x;
      wall.y = def.y;
      wall.width = def.w;
      wall.depth = def.h; // depth mapped to h from template geometry
      
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

  private spawnEntity(world: WorldService, def: ZoneEntityDef) {
      const e = this.entityPool.acquire(def.type as any, def.subType as any);
      e.x = def.x;
      e.y = def.y;
      
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
      }
      
      // Defaults for specific types if not set in data
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

      // Categorize into Static (Hash-only) vs Dynamic (Update loop)
      if (e.type === 'DECORATION' && this.STATIC_DECORATION_TYPES.has(e.subType || '')) {
          world.staticDecorations.push(e);
      } else {
          world.entities.push(e);
      }
  }

  private spawnExit(world: WorldService, def: any) {
      const exit = this.entityPool.acquire('EXIT');
      exit.x = def.x;
      exit.y = def.y;
      exit.exitType = def.direction;
      exit.targetX = 0;
      exit.color = def.direction === 'DOWN' ? '#22c55e' : '#f97316';
      exit.radius = 40; 
      (exit as any).targetSector = def.targetZoneId; // Mapped from targetZoneId
      
      if (def.locked) {
          const isOpen = this.narrative.getFlag('GATE_OPEN'); 
          if (!isOpen && def.targetZoneId !== 'HUB') { 
              exit.locked = true;
              exit.color = '#ef4444';
          }
      }
      world.entities.push(exit);
  }
}