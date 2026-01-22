
import { Injectable, signal, inject } from '@angular/core';
import { WorldService } from './world.service';
import { PlayerService } from '../player/player.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { GameEvents } from '../../core/events/game-events';
import { SoundService } from '../../services/sound.service';
import { EntityPoolService } from '../../services/entity-pool.service';

export interface PersonalRift {
    sourceZoneId: string;
    x: number;
    y: number;
    active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class WaypointService {
  private world = inject(WorldService);
  private player = inject(PlayerService);
  private eventBus = inject(EventBusService);
  private sound = inject(SoundService);
  private entityPool = inject(EntityPoolService);

  // Set of Zone IDs that have been unlocked
  unlockedWaypoints = signal<Set<string>>(new Set(['HUB']));
  
  personalRift = signal<PersonalRift | null>(null);

  constructor() {
      // Auto-unlock HUB
      this.unlockedWaypoints.update(s => s.add('HUB'));
  }

  unlockWaypoint(zoneId: string) {
      if (!this.unlockedWaypoints().has(zoneId)) {
          this.unlockedWaypoints.update(s => {
              const newSet = new Set(s);
              newSet.add(zoneId);
              return newSet;
          });
          this.eventBus.dispatch({ 
              type: GameEvents.FLOATING_TEXT_SPAWN, 
              payload: { onPlayer: true, yOffset: -120, text: "RIFTGATE SYNCED", color: '#06b6d4', size: 24 } 
          });
          this.sound.play('POWERUP');
      }
  }

  createPersonalRift() {
      const p = this.world.player;
      const zoneId = this.player.currentSectorId();
      
      this.personalRift.set({
          sourceZoneId: zoneId,
          x: p.x,
          y: p.y,
          active: true
      });

      this.sound.play('ZONE_CHANGE');
      
      // Spawn visual entity
      const rift = this.entityPool.acquire('INTERACTABLE', 'PORTAL');
      rift.x = p.x;
      rift.y = p.y;
      rift.zoneId = zoneId;
      rift.data = { isPersonal: true };
      this.world.entities.push(rift);
      
      this.eventBus.dispatch({ 
          type: GameEvents.FLOATING_TEXT_SPAWN, 
          payload: { onPlayer: true, yOffset: -80, text: "RIFT OPENED", color: '#a855f7', size: 20 } 
      });
  }

  getSaveData() {
      return {
          unlocked: Array.from(this.unlockedWaypoints()),
          personalRift: this.personalRift()
      };
  }

  loadSaveData(data: any) {
      if (data?.unlocked) {
          this.unlockedWaypoints.set(new Set(data.unlocked));
      }
      if (data?.personalRift) {
          this.personalRift.set(data.personalRift);
      }
  }
}
