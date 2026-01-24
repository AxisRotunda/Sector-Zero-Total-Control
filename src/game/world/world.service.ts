
import { Injectable, signal, inject, OnDestroy } from '@angular/core';
import { Entity, FloatingText, Zone, Camera } from '../../models/game.models';
import { EntityPoolService } from '../../services/entity-pool.service';
import { ParticleService } from '../../systems/particle.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { GameEvents, FloatingTextPayload } from '../../core/events/game-events';
import { SpatialHashService } from '../../systems/spatial-hash.service';
import { ChunkManagerService } from './chunk-manager.service';
import { WorldGeneratorService } from './world-generator.service';
import { Subscription } from 'rxjs';
import { migrateEntities } from '../../utils/damage-migration.util';

// Fallback "Boot Zone" to ensure Renderer has valid data before ZoneManager finishes loading the HUB
const BOOT_ZONE: Zone = {
    id: 'BOOT',
    name: 'Initializing...',
    theme: 'INDUSTRIAL',
    groundColor: '#09090b',
    wallColor: '#27272a',
    detailColor: '#333',
    minDepth: 0,
    difficultyMult: 1.0,
    weather: 'NONE',
    floorPattern: 'PLAIN',
    isSafeZone: true
};

@Injectable({ providedIn: 'root' })
export class WorldService implements OnDestroy {
  public entityPool = inject(EntityPoolService);
  public particleService = inject(ParticleService);
  private eventBus = inject(EventBusService);
  public spatialHash = inject(SpatialHashService);
  public chunkManager = inject(ChunkManagerService);
  private worldGenerator = inject(WorldGeneratorService);
  private subscriptions: Subscription[] = [];

  public camera: Camera = { x: 0, y: 0, zoom: 1.0, rotation: 0 };
  public player: Entity = this.createPlayer();
  
  // Dynamic entities (Updated every frame)
  public entities: Entity[] = [];
  
  // Static decorations (Baked into floor cache or Static Hash)
  public staticDecorations: Entity[] = [];

  public mapBounds = { minX: -2000, maxX: 2000, minY: -2000, maxY: 2000 };
  public rainDrops: {x: number, y: number, z: number, speed: number}[] = [];
  public floatingTexts: FloatingText[] = [];
  
  // Initialize with safe BOOT_ZONE
  currentZone = signal<Zone>(BOOT_ZONE);

  constructor() {
    for(let i=0; i<100; i++) this.rainDrops.push({ x: Math.random() * 2000, y: Math.random() * 2000, z: Math.random() * 500, speed: 15 + Math.random() * 10 });
    const sub = this.eventBus.on(GameEvents.FLOATING_TEXT_SPAWN).subscribe((payload: FloatingTextPayload) => {
        let x = payload.x ?? 0, y = payload.y ?? 0;
        if (payload.onPlayer) { x = this.player.x; y = this.player.y; }
        if (payload.yOffset) y += payload.yOffset;
        this.spawnFloatingText(x, y, payload.text, payload.color, payload.size);
    });
    this.subscriptions.push(sub);
  }

  ngOnDestroy() { this.subscriptions.forEach(sub => sub.unsubscribe()); }

  // Legacy Gen - kept for reference or hybrid usage
  generateFloor(depth: number) {
    this.player = this.createPlayer();
    const result = this.worldGenerator.generate('INDUSTRIAL', 1.0 + (depth * 0.5), `PROCEDURAL_DEPTH_${depth}`);
    this.currentZone.set(result.zone);
    this.entities = result.entities;
    this.player.x = result.playerStart.x;
    this.player.y = result.playerStart.y;
    this.camera.x = result.playerStart.x;
    this.camera.y = result.playerStart.y;
    this.mapBounds = result.bounds;
    
    // Register walls into ChunkManager
    this.chunkManager.reset();
    this.entities.forEach(e => {
        if (e.type === 'WALL') {
            this.chunkManager.registerStaticEntity(e);
        } else {
            this.spatialHash.insert(e, false);
        }
    });
    // Remove walls from dynamic update list
    this.entities = this.entities.filter(e => e.type !== 'WALL');
  }

  createPlayer(): Entity {
    return { id: 0, type: 'PLAYER', x: 0, y: 0, z: 0, vx: 0, vy: 0, angle: -Math.PI/4, radius: 20, hp: 100, maxHp: 100, armor: 5, color: '#e4e4e7', state: 'IDLE', animFrame: 0, animFrameTimer: 0, timer: 0, speed: 0, hitFlash: 0, xpValue: 0, trail: [], status: { stun: 0, slow: 0, poison: null, burn: null, weakness: null, bleed: null } };
  }

  public spawnEnemy(
    x: number,
    y: number,
    subType: string,
    level?: number
  ): Entity {
    const zoneId = this.currentZone().id;
    const enemy = this.entityPool.acquire('ENEMY', subType as any, zoneId);

    enemy.x = x;
    enemy.y = y;

    if (level) {
        enemy.level = level;
    } else {
        enemy.level = 1;
    }

    enemy.maxHp = this.calculateEnemyHP(enemy.level || 1, subType);
    enemy.hp = enemy.maxHp;

    this.entities.push(enemy);

    return enemy;
  }

  private calculateEnemyHP(level: number, subType: string): number {
    const BASE_HP = 50;
    const PER_LEVEL = 15;
    const QUADRATIC = 0.5;

    let baseHP = BASE_HP + (level * PER_LEVEL) + (level * level * QUADRATIC);

    if (subType === 'BOSS' || subType.includes('BOSS')) {
      baseHP *= 5;
    } else if (subType.includes('ELITE')) {
      baseHP *= 2;
    }

    return Math.floor(baseHP);
  }

  public migrateLoadedEntities(): void {
    migrateEntities(this.entities);
  }

  spawnFloatingText(x: number, y: number, text: string, color: string, size: number) {
      this.floatingTexts.push({x, y, text, color, size, life: 1.0, vy: 1.5});
  }

  cleanup() {
     for (let i = this.entities.length - 1; i >= 0; i--) { 
        const e = this.entities[i];
        if (e.type === 'SPAWNER' || e.type === 'SHRINE' || e.type === 'WALL') continue;
        // Simple bounds check cleanup
        if (e.x < this.mapBounds.minX - 500 || e.x > this.mapBounds.maxX + 500 || e.y < this.mapBounds.minY - 500 || e.y > this.mapBounds.maxY + 500) {
            this.entities.splice(i, 1);
        }
     }
  }
}
