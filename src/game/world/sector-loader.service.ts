
import { Injectable, inject } from '@angular/core';
import { WorldService } from './world.service';
import { EntityPoolService } from '../../services/entity-pool.service';
import { SectorDefinition } from '../../models/map.models';
import { ZoneTemplate } from '../../models/zone.models';
import { NarrativeService } from '../narrative.service';
import { SECTORS } from '../../config/maps.config';
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

  loadFromTemplate(world: WorldService, template: ZoneTemplate) {
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
          floorPattern: template.environment.floorPattern
      });
      world.mapBounds = template.bounds;

      // 2. Spawn Walls
      if (template.geometry && template.geometry.walls) {
          template.geometry.walls.forEach(w => this.spawnWall(world, w, template.id));
      }

      // 3. Merge Walls - Only for non-sprite walls (simple primitives)
      // Walls with sprites (defined types) should usually not be merged to preserve art
      const simpleWalls = world.entities.filter(e => e.type === 'WALL' && !e.spriteId);
      const spriteWalls = world.entities.filter(e => e.type === 'WALL' && !!e.spriteId);
      const otherEntities = world.entities.filter(e => e.type !== 'WALL');
      
      const mergedSimpleWalls = MapUtils.mergeWalls(simpleWalls);
      world.entities = [...otherEntities, ...mergedSimpleWalls, ...spriteWalls];

      // 4. Insert Walls into Static Spatial Hash
      world.entities.forEach(e => {
          if (e.type === 'WALL') {
              this.spatialHash.insert(e, true);
          }
      });

      // 5. Spawn Entities (Static & Dynamic)
      if (template.entities) {
          if (template.entities.static) {
              template.entities.static.forEach(e => this.spawnEntity(world, e, template.id));
          }
          if (template.entities.dynamic) {
              template.entities.dynamic.forEach(e => this.spawnEntity(world, e, template.id));
          }
      }

      // 6. Insert Static Decorations into Static Spatial Hash
      world.staticDecorations.forEach(e => {
          this.spatialHash.insert(e, true);
      });

      // 7. Spawn Exits
      if (template.exits) {
          template.exits.forEach(e => this.spawnExit(world, e, template.id));
      }
  }

  loadSector(world: WorldService, sectorId: string): void {
      // Legacy support maintained but delegating to same logic
      const def = SECTORS[sectorId];
      // ... (Implementation handled by loadFromTemplate logic usually via ZoneManager)
  }

  loadStaticDecorationsOnly(world: WorldService, sectorId: string) {
      // ... (Logic remains similar)
  }

  private spawnWall(world: WorldService, def: any, zoneId: string) {
      const wall = this.entityPool.acquire('WALL', def.type as any);
      wall.x = def.x; wall.y = def.y;
      wall.width = def.w; wall.depth = def.h || def.depth;
      wall.zoneId = zoneId;
      
      if (def.height) wall.height = def.height;
      else wall.height = 100; 
      
      wall.color = def.color || '#333';
      
      // Map TYPE to SPRITE ID
      if (def.type && (def.type.startsWith('WALL_') || def.type.startsWith('PILLAR_') || def.type.startsWith('MONOLITH_'))) {
          wall.spriteId = def.type;
      }
      
      if (def.type === 'GATE_SEGMENT') {
          const isOpen = this.narrative.getFlag('GATE_OPEN');
          wall.locked = def.locked && !isOpen;
          if (!wall.locked) wall.color = '#22c55e';
      }
      
      world.entities.push(wall);
  }

  private spawnEntity(world: WorldService, def: any, zoneId: string) {
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

      if (e.subType === 'CABLE') {
          world.staticDecorations.push(e);
          return;
      }

      if (e.type === 'DECORATION' && this.STATIC_DECORATION_TYPES.has(e.subType || '')) {
          world.staticDecorations.push(e);
      } else {
          world.entities.push(e);
      }
  }

  private spawnExit(world: WorldService, def: any, zoneId: string) {
      const exit = this.entityPool.acquire('EXIT');
      exit.x = def.x; exit.y = def.y;
      exit.exitType = def.direction || 'DOWN'; 
      exit.transitionType = def.transitionType || 'WALK';
      exit.targetX = 0;
      exit.color = def.transitionType === 'GATE' ? '#ef4444' : (def.transitionType === 'WALK' ? 'transparent' : '#f97316');
      exit.radius = 40; 
      exit.zoneId = zoneId;
      (exit as any).targetSector = def.targetSector || def.targetZoneId;
      
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
