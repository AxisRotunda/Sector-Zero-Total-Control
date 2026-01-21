
import { Injectable, inject } from '@angular/core';
import { Entity, Zone, ZoneTheme } from '../../models/game.models';
import * as CONFIG from '../../config/game.config';
import { EntityPoolService } from '../../services/entity-pool.service';
import { NarrativeService } from '../narrative.service';
import { MapUtils } from '../../utils/map-utils';

export interface GenerationResult { entities: Entity[]; zone: Zone; playerStart: { x: number, y: number }; bounds: { minX: number, maxX: number, minY: number, maxY: number }; }

@Injectable({ providedIn: 'root' })
export class WorldGeneratorService {
  private entityPool = inject(EntityPoolService);
  private narrative = inject(NarrativeService);

  public generate(theme: ZoneTheme, difficulty: number, sectorId: string): GenerationResult {
    // Determine colors based on Theme
    const colors = this.getThemeColors(theme);
    
    const zone: Zone = {
        name: sectorId,
        theme: theme,
        groundColor: colors.ground,
        wallColor: colors.wall,
        detailColor: colors.detail,
        minDepth: 0,
        difficultyMult: difficulty,
        weather: theme === 'INDUSTRIAL' ? 'ASH' : (theme === 'RESIDENTIAL' ? 'RAIN' : 'NONE'),
        floorPattern: theme === 'HIGH_TECH' ? 'GRID' : (theme === 'INDUSTRIAL' ? 'HAZARD' : 'PLAIN')
    };

    const entities: Entity[] = [];
    const size = 3000;
    const bounds = { minX: -size, maxX: size, minY: -size, maxY: size };
    const rooms = 6 + Math.floor(difficulty * 2);
    const roomSize = 500;
    
    // Always start with an UP exit back to previous sector
    const exitUp = this.entityPool.acquire('EXIT');
    exitUp.exitType = 'UP'; exitUp.x = 0; exitUp.y = 0; entities.push(exitUp);

    let cx = 0, cy = 0;
    for(let i=0; i<rooms; i++) {
        const dir = Math.floor(Math.random() * 4);
        let nx = cx, ny = cy; 
        const dist = 700 + Math.random() * 200;
        
        if (dir === 0) ny -= dist; else if (dir === 1) nx += dist; else if (dir === 2) ny += dist; else nx -= dist;

        this.buildCorridor(cx, cy, nx, ny, 150, entities, colors);
        this.buildRoom(nx, ny, roomSize, roomSize, entities, colors, theme);
        
        // Populate
        const mobType = this.getEnemyForTheme(theme);
        this.createSpawner(nx, ny, mobType, 1 + Math.floor(difficulty), 500, entities);

        cx = nx; cy = ny;
        if (i === rooms - 1) {
            const exitDown = this.entityPool.acquire('EXIT');
            exitDown.exitType = 'DOWN'; exitDown.x = cx; exitDown.y = cy; exitDown.color = '#22c55e';
            entities.push(exitDown);
        }
    }
    
    // Merge walls to optimize rendering
    const mergedEntities = MapUtils.mergeWalls(entities);
    
    return { entities: mergedEntities, zone, playerStart: { x: 0, y: 100 }, bounds };
  }

  private getThemeColors(theme: ZoneTheme) {
      switch(theme) {
          case 'RESIDENTIAL': return { ground: '#020617', wall: '#1e1b4b', detail: '#f472b6' }; // Neon Pink/Blue
          case 'HIGH_TECH': return { ground: '#f8fafc', wall: '#cbd5e1', detail: '#0ea5e9' }; // White/Cyan
          case 'ORGANIC': return { ground: '#052e16', wall: '#14532d', detail: '#22c55e' }; // Dark Green
          case 'VOID': return { ground: '#000000', wall: '#3b0764', detail: '#d8b4fe' }; // Purple/Black
          default: return { ground: '#1c1917', wall: '#44403c', detail: '#f59e0b' }; // Industrial
      }
  }

  private getEnemyForTheme(theme: ZoneTheme): string {
      switch(theme) {
          case 'RESIDENTIAL': return Math.random() > 0.5 ? 'STALKER' : 'STEALTH';
          case 'HIGH_TECH': return Math.random() > 0.5 ? 'SNIPER' : 'HEAVY';
          case 'ORGANIC': return 'GRUNT'; // Swarmers
          case 'VOID': return 'BOSS'; // Mini-bosses
          default: return 'GRUNT';
      }
  }

  private buildRoom(x: number, y: number, w: number, h: number, entities: Entity[], colors: any, theme: ZoneTheme) {
      // Floor Decoration
      const rug = this.entityPool.acquire('DECORATION', 'RUG');
      rug.x = x; rug.y = y; rug.width = w; rug.height = h; rug.color = colors.ground;
      entities.push(rug);

      // Walls Corners
      const addWall = (wx: number, wy: number, ww: number, wh: number) => {
          const wall = this.entityPool.acquire('WALL');
          wall.x = wx; wall.y = wy; wall.width = ww; wall.height = 120; wall.depth = wh; wall.color = colors.wall;
          entities.push(wall);
      };
      
      const t = 40; // thickness
      addWall(x - w/2, y, t, h); // Left
      addWall(x + w/2, y, t, h); // Right
      addWall(x, y - h/2, w, t); // Top
      addWall(x, y + h/2, w, t); // Bottom
      
      if (theme === 'ORGANIC') {
          const vent = this.entityPool.acquire('DECORATION', 'VENT');
          vent.x = x + 100; vent.y = y + 100;
          entities.push(vent);
      }
  }

  private buildCorridor(x1: number, y1: number, x2: number, y2: number, width: number, entities: Entity[], colors: any) {
      const midX = (x1 + x2) / 2; const midY = (y1 + y2) / 2;
      const len = Math.hypot(x2-x1, y2-y1);
      
      const rug = this.entityPool.acquire('DECORATION', 'RUG');
      rug.x = midX; rug.y = midY; 
      rug.width = Math.abs(x2-x1) + width; 
      rug.height = Math.abs(y2-y1) + width; 
      rug.color = colors.ground;
      entities.push(rug);
  }

  private createSpawner(x: number, y: number, type: string, max: number, cooldown: number, entities: Entity[]) {
      const spawner = this.entityPool.acquire('SPAWNER', 'SPAWN_NODE');
      spawner.x = x; spawner.y = y; spawner.spawnType = type; spawner.spawnMax = max; spawner.spawnCooldown = cooldown;
      spawner.timer = 0; spawner.spawnedIds = []; spawner.radius = 20; spawner.color = '#333'; 
      entities.push(spawner);
  }
}
