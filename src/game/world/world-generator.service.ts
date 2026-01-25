
import { Injectable, inject, signal } from '@angular/core';
import { Entity, Zone, ZoneTheme } from '../../models/game.models';
import * as CONFIG from '../../config/game.config';
import { EntityPoolService } from '../../services/entity-pool.service';
import { NarrativeService } from '../narrative.service';
import { MapUtils } from '../../utils/map-utils';
import { ProofKernelService } from '../../core/proof/proof-kernel.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { GameEvents } from '../../core/events/game-events';

export interface GenerationResult { entities: Entity[]; zone: Zone; playerStart: { x: number, y: number }; bounds: { minX: number, maxX: number, minY: number, maxY: number }; }

@Injectable({ providedIn: 'root' })
export class WorldGeneratorService {
  private entityPool = inject(EntityPoolService);
  private narrative = inject(NarrativeService);
  private proofKernel = inject(ProofKernelService);
  private eventBus = inject(EventBusService);

  private readonly MAX_RETRIES = 5;
  private entropyModifier = signal(1.0); // 1.0 = normal, <1.0 = safer

  reduceEntropy(amount: number) {
      this.entropyModifier.update(v => Math.max(0.5, v - amount));
  }

  public generate(theme: ZoneTheme, difficulty: number, sectorId: string): GenerationResult {
    let attempt = 0;
    
    // Apply entropy modifier to difficulty effectively reducing complexity
    const effectiveDifficulty = difficulty * this.entropyModifier();

    while (attempt < this.MAX_RETRIES) {
        attempt++;
        const result = this.attemptGeneration(theme, effectiveDifficulty, sectorId);
        
        // --- PROOF PHASE ---
        const overlapProof = this.proofKernel.verifyNonOverlap(result.entities);
        if (!overlapProof.isValid) {
            console.warn(`[WorldGen] Hallucination Detected (Overlap) on attempt ${attempt}:`, overlapProof.errors[0]);
            continue; // Retry
        }

        const connectivityProof = this.proofKernel.verifyConnectivity(result.entities, result.bounds, result.playerStart);
        if (!connectivityProof.isValid) {
            console.warn(`[WorldGen] Hallucination Detected (Unreachable) on attempt ${attempt}:`, connectivityProof.errors[0]);
            continue; // Retry
        }

        const checksum = this.proofKernel.computeChecksum(result.entities); 
        console.log(`[WorldGen] Sector ${sectorId} Verified. Checksum: ${checksum}`);

        result.entities = MapUtils.mergeWalls(result.entities);
        return result;
    }

    this.eventBus.dispatch({
        type: GameEvents.REALITY_BLEED,
        payload: { severity: 'CRITICAL', source: 'WORLD_GEN', message: `Generation collapse for ${sectorId}. Safe Mode engaged.` }
    });
    
    return this.generateSafeRoom(theme, sectorId);
  }

  private attemptGeneration(theme: ZoneTheme, difficulty: number, sectorId: string): GenerationResult {
    const colors = this.getThemeColors(theme);
    
    const zone: Zone = {
        id: sectorId,
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
    
    // Scale room count by entropy
    const rooms = Math.floor((6 + Math.floor(difficulty * 2)) * this.entropyModifier());
    const roomSize = 500;
    
    const exitUp = this.entityPool.acquire('EXIT');
    exitUp.exitType = 'UP'; exitUp.x = 0; exitUp.y = 0; exitUp.zoneId = sectorId; entities.push(exitUp);

    let cx = 0, cy = 0;
    for(let i=0; i<rooms; i++) {
        const dir = Math.floor(Math.random() * 4);
        let nx = cx, ny = cy; 
        const dist = 700 + Math.random() * 200;
        
        if (dir === 0) ny -= dist; else if (dir === 1) nx += dist; else if (dir === 2) ny += dist; else nx -= dist;

        this.buildCorridor(cx, cy, nx, ny, 150, entities, colors, sectorId);
        this.buildRoom(nx, ny, roomSize, roomSize, entities, colors, theme, sectorId);
        
        const mobType = this.getEnemyForTheme(theme);
        this.createSpawner(nx, ny, mobType, 1 + Math.floor(difficulty), 500, entities, sectorId);

        cx = nx; cy = ny;
        if (i === rooms - 1) {
            const exitDown = this.entityPool.acquire('EXIT');
            exitDown.exitType = 'DOWN'; exitDown.x = cx; exitDown.y = cy; exitDown.color = '#22c55e';
            exitDown.zoneId = sectorId;
            entities.push(exitDown);
        }
    }
    
    return { entities, zone, playerStart: { x: 0, y: 100 }, bounds };
  }

  private generateSafeRoom(theme: ZoneTheme, sectorId: string): GenerationResult {
      const colors = this.getThemeColors(theme);
      const zone: Zone = {
        id: sectorId,
        name: `${sectorId} [SAFE MODE]`,
        theme: theme,
        groundColor: colors.ground,
        wallColor: colors.wall,
        detailColor: colors.detail,
        minDepth: 0,
        difficultyMult: 0,
        weather: 'NONE',
        floorPattern: 'PLAIN',
        isSafeZone: true
      };
      
      const entities: Entity[] = [];
      const bounds = { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 };
      
      const exitUp = this.entityPool.acquire('EXIT');
      exitUp.exitType = 'UP'; exitUp.x = 0; exitUp.y = -200; exitUp.zoneId = sectorId; entities.push(exitUp);
      
      const exitDown = this.entityPool.acquire('EXIT');
      exitDown.exitType = 'DOWN'; exitDown.x = 0; exitDown.y = 200; exitDown.zoneId = sectorId; entities.push(exitDown);
      
      return { entities, zone, playerStart: { x: 0, y: 0 }, bounds };
  }

  private getThemeColors(theme: ZoneTheme) {
      switch(theme) {
          case 'RESIDENTIAL': return { ground: '#020617', wall: '#1e1b4b', detail: '#f472b6' };
          case 'HIGH_TECH': return { ground: '#f8fafc', wall: '#cbd5e1', detail: '#0ea5e9' };
          case 'ORGANIC': return { ground: '#052e16', wall: '#14532d', detail: '#22c55e' };
          case 'VOID': return { ground: '#000000', wall: '#3b0764', detail: '#d8b4fe' };
          default: return { ground: '#1c1917', wall: '#44403c', detail: '#f59e0b' };
      }
  }

  private getEnemyForTheme(theme: ZoneTheme): string {
      switch(theme) {
          case 'RESIDENTIAL': return Math.random() > 0.5 ? 'STALKER' : 'STEALTH';
          case 'HIGH_TECH': return Math.random() > 0.5 ? 'SNIPER' : 'HEAVY';
          case 'ORGANIC': return 'GRUNT';
          case 'VOID': return 'BOSS';
          default: return 'GRUNT';
      }
  }

  private buildRoom(x: number, y: number, w: number, h: number, entities: Entity[], colors: any, theme: ZoneTheme, zoneId: string) {
      const rug = this.entityPool.acquire('DECORATION', 'RUG');
      rug.x = x; rug.y = y; rug.width = w; rug.height = h; rug.color = colors.ground;
      rug.zoneId = zoneId;
      entities.push(rug);

      const addWall = (wx: number, wy: number, ww: number, wh: number) => {
          const wall = this.entityPool.acquire('WALL');
          wall.x = wx; wall.y = wy; wall.width = ww; wall.height = 120; wall.depth = wh; wall.color = colors.wall;
          wall.zoneId = zoneId;
          entities.push(wall);
      };
      
      const t = 40;
      addWall(x - w/2, y, t, h);
      addWall(x + w/2, y, t, h);
      addWall(x, y - h/2, w, t);
      addWall(x, y + h/2, w, t);
      
      if (theme === 'ORGANIC') {
          const vent = this.entityPool.acquire('DECORATION', 'VENT');
          vent.x = x + 100; vent.y = y + 100;
          vent.zoneId = zoneId;
          entities.push(vent);
      }
  }

  private buildCorridor(x1: number, y1: number, x2: number, y2: number, width: number, entities: Entity[], colors: any, zoneId: string) {
      const midX = (x1 + x2) / 2; const midY = (y1 + y2) / 2;
      
      const rug = this.entityPool.acquire('DECORATION', 'RUG');
      rug.x = midX; rug.y = midY; 
      rug.width = Math.abs(x2-x1) + width; 
      rug.height = Math.abs(y2-y1) + width; 
      rug.color = colors.ground;
      rug.zoneId = zoneId;
      entities.push(rug);
  }

  private createSpawner(x: number, y: number, type: string, max: number, cooldown: number, entities: Entity[], zoneId: string) {
      const spawner = this.entityPool.acquire('SPAWNER', 'SPAWN_NODE');
      spawner.x = x; spawner.y = y; spawner.spawnType = type; spawner.spawnMax = max; spawner.spawnCooldown = cooldown;
      spawner.timer = 0; spawner.spawnedIds = []; spawner.radius = 20; spawner.color = '#333'; 
      spawner.zoneId = zoneId;
      entities.push(spawner);
  }
}
