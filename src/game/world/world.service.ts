
import { Injectable, signal, inject, OnDestroy } from '@angular/core';
import { Entity, FloatingText, Zone, Camera, SectorId } from '../../models/game.models';
import * as CONFIG from '../../config/game.config';
import { EntityPoolService } from '../../services/entity-pool.service';
import { ParticleService } from '../../systems/particle.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { GameEvents, FloatingTextPayload } from '../../core/events/game-events';
import { SpatialHashService } from '../../systems/spatial-hash.service';
import { WorldGeneratorService } from './world-generator.service';
import { Subscription } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class WorldService implements OnDestroy {
  public entityPool = inject(EntityPoolService);
  public particleService = inject(ParticleService);
  private eventBus = inject(EventBusService);
  public spatialHash = inject(SpatialHashService);
  private worldGenerator = inject(WorldGeneratorService);
  private subscriptions: Subscription[] = [];

  public camera: Camera = { x: 0, y: 0, zoom: 1.0 };
  public player: Entity = this.createPlayer();
  
  // Dynamic entities (Updated every frame)
  public entities: Entity[] = [];
  
  // Static decorations (Baked into floor cache or Static Hash)
  public staticDecorations: Entity[] = [];

  public mapBounds = { minX: -2000, maxX: 2000, minY: -2000, maxY: 2000 };
  public rainDrops: {x: number, y: number, z: number, speed: number}[] = [];
  public floatingTexts: FloatingText[] = [];
  currentZone = signal<Zone>(CONFIG.ZONES[0]);

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
    const result = this.worldGenerator.generate(depth);
    this.currentZone.set(result.zone);
    this.entities = result.entities;
    this.player.x = result.playerStart.x;
    this.player.y = result.playerStart.y;
    this.camera.x = result.playerStart.x;
    this.camera.y = result.playerStart.y;
    this.mapBounds = result.bounds;
    
    // Insert into hash manually or let update loop do it
    this.entities.forEach(e => this.spatialHash.insert(e, e.type === 'WALL'));
  }

  // Load Sector logic moved to ZoneManagerService to prevent circular dependency and separation of concerns.
  // WorldService is now a data container.

  createPlayer(): Entity {
    return { id: 0, type: 'PLAYER', x: 0, y: 0, z: 0, vx: 0, vy: 0, angle: -Math.PI/4, radius: 20, hp: 100, maxHp: 100, armor: 5, color: '#e4e4e7', state: 'IDLE', animFrame: 0, animFrameTimer: 0, timer: 0, speed: 0, hitFlash: 0, xpValue: 0, trail: [], status: { stun: 0, slow: 0, poison: null, burn: null, weakness: null, bleed: null } };
  }

  spawnFloatingText(x: number, y: number, text: string, color: string, size: number) {
      this.floatingTexts.push({x, y, text, color, size, life: 1.0, vy: 1.5});
  }

  cleanup() {
     // Player is not in entities list, so we can iterate full array safely
     for (let i = this.entities.length - 1; i >= 0; i--) { 
        const e = this.entities[i];
        // Don't cleanup NPCs in the Hub, they are persistent fixtures.
        // With ZoneManager, this logic should check the zone config, but for now name check suffices.
        if (e.type === 'SPAWNER' || e.type === 'SHRINE' || e.type === 'WALL') continue;
        if (this.currentZone().name === 'Liminal Citadel' && e.type === 'NPC') continue;
        
        if (e.state === 'DEAD' || (e.type === 'HITBOX' && e.timer <= 0) || (e.type === 'PICKUP' && e.hp <= 0)) {
            this.entityPool.release(e);
            this.entities.splice(i, 1);
        }
    }
  }
}
