
import { Injectable, inject, signal, computed } from '@angular/core';
import { Entity } from '../models/game.models';
import { SpatialHashService } from '../systems/spatial-hash.service';
import { NarrativeService } from '../game/narrative.service';
import { SoundService } from './sound.service';
import { EventBusService } from '../core/events/event-bus.service';
import { GameEvents } from '../core/events/game-events';
import { HapticService } from './haptic.service';
import { WorldService } from '../game/world/world.service';
import { ShopService } from './shop.service';
import { DialogueService } from './dialogue.service';
import { UiPanelService } from './ui-panel.service';
import { MissionService } from '../game/mission.service';
import { IsoUtils } from '../utils/iso-utils';

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
  private shopService = inject(ShopService);
  private dialogueService = inject(DialogueService);
  private ui = inject(UiPanelService);
  private missionService = inject(MissionService);

  nearbyInteractable = signal<Entity | null>(null);
  activeInteractable = computed(() => { 
      const target = this.nearbyInteractable(); 
      if (target && target.id !== -1 && target.state !== 'DEAD') return target; 
      return null; 
  });
  
  requestedFloorChange = signal<'UP' | 'DOWN' | string | null>(null);

  update(player: Entity, globalTime: number) {
      let bestTarget: Entity | null = null;
      let bestScore = Infinity;

      // CRITICAL FIX: Must pass currentZone().id to query the correct spatial bucket
      const zoneId = this.world.currentZone().id;
      const nearby = this.spatialHash.query(player.x, player.y, 250, zoneId);
      
      const px = player.x;
      const py = player.y;
      // Player direction vector
      const pDirX = Math.cos(player.angle);
      const pDirY = Math.sin(player.angle);

      for(const e of nearby) {
          // Calculate distance
          const dx = e.x - px;
          const dy = e.y - py;
          const dist = Math.hypot(dx, dy);
          const combinedRadius = player.radius + (e.radius || 20);
          
          // 1. Exits
          if (e.type === 'EXIT') {
               if (dist < combinedRadius + 20) {
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
                    return;
               }
          }
          
          // 2. Selectable Targets (NPCs, Terminals)
          if (e.type === 'NPC' || (e.type === 'TERMINAL' && !e.accessed)) {
               const interactRange = (e.interactionRadius || 100) + combinedRadius + 50; 
               
               if (dist < interactRange) {
                   // Calculate "Facing Score" to prioritize what player is looking at
                   const tDirX = dx / dist;
                   const tDirY = dy / dist;
                   const dot = (pDirX * tDirX) + (pDirY * tDirY);
                   
                   // Score: Distance minus facing bonus.
                   const score = dist - (dot * 100);

                   if (score < bestScore) {
                       bestScore = score;
                       bestTarget = e;
                   }
                   
                   // Discovery check
                   if (e.subType && this.narrative.discoverEntity(e.subType)) {
                       this.eventBus.dispatch({ 
                           type: GameEvents.FLOATING_TEXT_SPAWN, 
                           payload: { onPlayer: true, yOffset: -120, text: "DATABASE UPDATED", color: '#06b6d4', size: 20 } 
                       });
                   }
               }
          }
      }
      
      // Haptic bump when changing targets
      if (bestTarget && this.nearbyInteractable()?.id !== bestTarget.id) {
          this.haptic.impactLight();
      }
      
      this.nearbyInteractable.set(bestTarget);
  }

  // New: Direct World Interaction via Tap
  tryInteractAt(screenX: number, screenY: number, screenWidth: number, screenHeight: number) {
      const cam = this.world.camera;
      
      // 1. Inverse Camera Transform (Screen -> World)
      // Center offset
      const sx = screenX - screenWidth / 2;
      const sy = screenY - screenHeight / 2;
      
      // Unzoom
      const unzoomedX = sx / cam.zoom;
      const unzoomedY = sy / cam.zoom;
      
      // Cam Center in Iso
      const camIso = IsoUtils.toIso(cam.x, cam.y, 0);
      
      // Target in Iso
      const targetIsoX = unzoomedX + camIso.x;
      const targetIsoY = unzoomedY + camIso.y;
      
      // Inverse Iso (Iso -> Cartesian)
      // x = (2y + x) / 2  -- derived from iso formulas
      // y = (2y - x) / 2
      // wait, standard iso: x_iso = x - y, y_iso = (x + y)/2
      // x_iso = x - y
      // 2*y_iso = x + y
      // x = y_iso + 0.5 * x_iso
      // y = y_iso - 0.5 * x_iso
      
      const worldX = targetIsoY + 0.5 * targetIsoX;
      const worldY = targetIsoY - 0.5 * targetIsoX;
      
      // 2. Query at World Coords
      const zoneId = this.world.currentZone().id;
      // Search a small radius around the tap
      const targets = this.spatialHash.query(worldX, worldY, 100, zoneId);
      
      // 3. Filter for interactables
      const validTarget = targets.find(e => 
          (e.type === 'NPC' || (e.type === 'TERMINAL' && !e.accessed)) && 
          e.state !== 'DEAD'
      );
      
      if (validTarget) {
          // Check distance to player to ensure no telepathic interaction
          const p = this.world.player;
          const dist = Math.hypot(validTarget.x - p.x, validTarget.y - p.y);
          if (dist < 400) { // Generous tap range
              this.interact(validTarget);
              // Visual feedback for tap
              this.eventBus.dispatch({ 
                  type: GameEvents.FLOATING_TEXT_SPAWN, 
                  payload: { x: validTarget.x, y: validTarget.y - 50, text: "▼", color: '#fff', size: 20 } 
              });
          } else {
              this.eventBus.dispatch({ 
                  type: GameEvents.FLOATING_TEXT_SPAWN, 
                  payload: { onPlayer: true, yOffset: -50, text: "TOO FAR", color: '#ef4444', size: 14 } 
              });
          }
      }
  }

  interact(target: Entity) {
      if (!target) return;
      
      this.haptic.impactLight();

      if (target.subType === 'TRADER') {
          this.shopService.openShop(target);
          this.ui.openPanel('SHOP');
      } else if (['HANDLER', 'CITIZEN', 'ECHO', 'GUARD', 'MEDIC'].includes(target.subType || '')) {
          if (target.subType) this.missionService.onTalk(target.subType);
          this.dialogueService.startDialogue(target.dialogueId || 'generic');
      } else if (target.type === 'TERMINAL') {
          this.processTerminal(target);
      } else {
          this.dialogueService.startDialogue(target.dialogueId || 'generic');
      }
  }

  getInteractLabel(target: Entity): string {
      switch(target.subType) {
          case 'MEDIC': return 'MEDICAL ASSIST';
          case 'TRADER': return 'MARKET ACCESS';
          case 'HANDLER': return 'BRIEFING';
          case 'CONSOLE': return 'TERMINAL';
          case 'CITIZEN': return 'CONVERSE';
          default: return 'INTERACT';
      }
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
