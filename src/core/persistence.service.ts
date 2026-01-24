
import { Injectable, signal, inject } from '@angular/core';
import { InventoryService } from '../game/inventory.service';
import { SkillTreeService } from '../game/skill-tree.service';
import { WorldService } from '../game/world/world.service';
import { PlayerService } from '../game/player/player.service';
import { MissionService } from '../game/mission.service';
import { MapService } from '../services/map.service';
import { NarrativeService } from '../game/narrative.service';
import * as CONFIG from '../config/game.config';
import { EventBusService } from './events/event-bus.service';
import { GameEvents } from './events/game-events';
import { IndexedDbService } from '../services/indexed-db.service';
import { ZoneManagerService } from '../game/world/zone-manager.service';
import { WorldStateService } from '../game/world/world-state.service';

interface SaveFile {
    version: number;
    timestamp: number;
    data: any;
}

@Injectable({
  providedIn: 'root'
})
export class PersistenceService {
  private inventory = inject(InventoryService);
  private skillTree = inject(SkillTreeService);
  private world = inject(WorldService);
  private player = inject(PlayerService);
  private mission = inject(MissionService);
  private mapService = inject(MapService);
  private eventBus = inject(EventBusService);
  private narrative = inject(NarrativeService);
  private db = inject(IndexedDbService);
  private zoneManager = inject(ZoneManagerService);
  private worldState = inject(WorldStateService);

  private saveKey = CONFIG.SAVE_KEY;
  private readonly CURRENT_VERSION = 1;
  hasSaveData = signal(false);

  constructor() {
      this.checkSaveData();
  }

  async checkSaveData() {
      // Check both storage methods for migration support
      const localData = localStorage.getItem(this.saveKey + '_meta');
      if (localData) {
          this.hasSaveData.set(true);
          return;
      }
      
      const dbData = await this.db.load(this.saveKey);
      this.hasSaveData.set(!!dbData);
  }

  async saveGame() {
      // Collect snapshots from all persistent systems
      const payload: SaveFile = {
          version: this.CURRENT_VERSION,
          timestamp: Date.now(),
          data: {
              player: this.player.getSaveData(),
              inventory: this.inventory.getSaveData(),
              skillTree: this.skillTree.getSaveData(),
              mission: this.mission.getSaveData(),
              map: this.mapService.getSaveData(),
              narrative: this.narrative.getSaveData(),
              worldState: this.worldState.getSaveData()
          }
      };
      
      try {
          // Asynchronously write to IndexedDB
          await this.db.save(this.saveKey, payload);
          
          // Use a lightweight local flag for sync UI checks
          localStorage.setItem(this.saveKey + '_meta', Date.now().toString());
          this.hasSaveData.set(true);
          console.log("[Persistence] Game Saved to IndexedDB.");
      } catch (e) {
          console.error("[Persistence] Save Failed", e);
      }
  }

  async loadGame(): Promise<boolean> {
      try {
          // 1. Primary: Load from IndexedDB
          let raw = await this.db.load(this.saveKey);
          
          // 2. Migration: Check legacy LocalStorage if DB is empty
          if (!raw) {
              const json = localStorage.getItem(this.saveKey);
              if (json) {
                  raw = JSON.parse(json);
                  console.log("[Persistence] Migrating legacy save to IndexedDB...");
                  await this.db.save(this.saveKey, raw);
              }
          }

          if (!raw) return false;

          let data = raw;
          if (raw.version !== undefined) {
              data = raw.data;
          }
          
          // Deserialize into services
          if(data.player) this.player.loadSaveData(data.player);
          if (data.inventory) this.inventory.loadSaveData(data.inventory);
          if (data.skillTree) this.skillTree.loadSaveData(data.skillTree);
          if (data.mission) this.mission.loadSaveData(data.mission);
          if (data.narrative) this.narrative.loadSaveData(data.narrative);
          if (data.worldState) this.worldState.loadSaveData(data.worldState);
          
          // Initialize world manager with the saved sector ID
          await this.zoneManager.initWorld(this.player.currentSectorId());
          
          if (data.map) this.mapService.loadSaveData(data.map);

          this.eventBus.dispatch({ 
            type: GameEvents.FLOATING_TEXT_SPAWN, 
            payload: { onPlayer: true, yOffset: -80, text: "UPLINK RESTORED", color: '#22c55e', size: 30 } 
          });
          
          return true;
      } catch (e) {
          console.error("[Persistence] Load Failed", e);
          return false;
      }
  }

  async resetGame() {
      await this.db.clear();
      localStorage.removeItem(this.saveKey);
      localStorage.removeItem(this.saveKey + '_meta');
      
      this.hasSaveData.set(false);
      this.player.reset();
      this.inventory.reset();
      this.skillTree.reset();
      this.mission.reset();
      this.mapService.reset();
      this.narrative.reset();
      this.worldState.reset();
  }
}
