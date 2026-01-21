
import { Injectable, inject, signal, computed } from '@angular/core';
import { Entity } from '../models/game.models';
import { SpatialHashService } from '../systems/spatial-hash.service';
import { NarrativeService } from '../game/narrative.service';
import { SoundService } from './sound.service';
import { EventBusService } from '../core/events/event-bus.service';
import { GameEvents } from '../core/events/game-events';
import { HapticService } from './haptic.service';
import { WorldService } from '../game/world/world.service';

@Injectable({
  providedIn: 'root'
})
export class InteractionService {
  private spatialHash = inject(SpatialHashService);
  private narrative = inject(NarrativeService);
  private sound = inject(SoundService);
  private eventBus = inject(EventBusService);
  private haptic = inject(HapticService);
  private world = inject(WorldService);

  nearbyInteractable = signal<Entity | null>(null);
  activeInteractable = computed(() => { 
      const target = this.nearbyInteractable(); 
      if (target && target.id !== -1 && target.state !== 'DEAD') return target; 
      return null; 
  });
  
  requestedFloorChange = signal<'UP' | 'DOWN' | string | null>(null);

  update(player: Entity, globalTime: number) {
      let foundInteractable: Entity | null = null;
      // Query slightly larger than interaction radius to ensure detection
      const nearby = this.spatialHash.query(player.x, player.y, 150);
      
      for(const e of nearby) {
          // 1. Exits (Auto-trigger or Manual)
          if (e.type === 'EXIT') {
               const dist = Math.hypot(e.x - player.x, e.y - player.y);
               // Trigger radius for exits
               if (dist < 40) {
                    if (!e.locked) {
                        if ((e as any).targetSector) {
                            this.requestedFloorChange.set((e as any).targetSector);
                        } else {
                            this.requestedFloorChange.set(e.exitType || 'DOWN');
                        }
                    }
                    else if (globalTime % 60 === 0) {
                        this.eventBus.dispatch({ 
                            type: GameEvents.FLOATING_TEXT_SPAWN, 
                            payload: { x: e.x, y: e.y - 60, text: "LOCKED - CLEARANCE REQUIRED", color: '#ef4444', size: 16 } 
                        });
                        this.haptic.error();
                    }
                    // Exit takes priority, return immediately
                    return;
               }
          }
          
          // 2. NPCs (Dialogue/Trade)
          if (e.type === 'NPC') {
               const dist = Math.hypot(e.x - player.x, e.y - player.y);
               if (dist < (e.interactionRadius || 80)) {
                   foundInteractable = e;
                   if (e.subType && this.narrative.discoverEntity(e.subType)) {
                       this.eventBus.dispatch({ 
                           type: GameEvents.FLOATING_TEXT_SPAWN, 
                           payload: { onPlayer: true, yOffset: -120, text: "DATABASE UPDATED", color: '#06b6d4', size: 20 } 
                       });
                   }
               }
          }
          
          // 3. Terminals (Lore/Mechanics)
          if (e.type === 'TERMINAL' && !e.accessed) {
               const dist = Math.hypot(e.x - player.x, e.y - player.y);
               if (dist < 60) this.processTerminal(e);
          }
      }
      
      // Haptic bump when finding a new interactable
      if (foundInteractable && this.nearbyInteractable()?.id !== foundInteractable.id) {
          this.haptic.impactLight();
      }
      
      this.nearbyInteractable.set(foundInteractable);
  }

  private processTerminal(e: Entity) {
      if (!e.logId) return;
      if (this.narrative.discoverLog(e.logId)) {
          e.accessed = true; 
          e.color = '#3f3f46'; 
          this.sound.play('POWERUP');
          this.haptic.success();
          this.world.spawnFloatingText(e.x, e.y - 40, "DATA LOG ACQUIRED", '#06b6d4', 20);
      }
  }
}
