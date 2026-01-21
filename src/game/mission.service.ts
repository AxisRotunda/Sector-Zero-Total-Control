
import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { NarrativeService } from './narrative.service';
import { EventBusService } from '../core/events/event-bus.service';
import { GameEvents } from '../core/events/game-events';
import { MapService } from '../services/map.service';
import { PlayerService } from './player/player.service';

export type MissionType = 'KILL' | 'COLLECT' | 'INTERACT' | 'TALK' | 'REACH_EXIT';
export type MissionCategory = 'MAIN' | 'SIDE' | 'RADIANT';
export type MissionState = 'ACTIVE' | 'COMPLETE' | 'CLAIMED';

export interface MissionObjective {
    type: MissionType; 
    targetId?: string; 
    targetAmount: number; 
    currentAmount: number; 
    description: string;
    // Spatial data for map markers
    targetZoneId?: string;
    targetLocation?: { x: number, y: number };
}

export interface Mission {
    id: string; title: string; description: string; category: MissionCategory;
    objectives: MissionObjective[];
    rewardXp: number; rewardCredits: number; factionRep?: { factionId: string, amount: number };
    state: MissionState; prereqMissionId?: string; unlocksFlag?: string;
}

@Injectable({ providedIn: 'root' })
export class MissionService {
  private narrative = inject(NarrativeService);
  private eventBus = inject(EventBusService);
  private mapService = inject(MapService);
  private player = inject(PlayerService);

  activeMissions = signal<Mission[]>([]);
  completedMissionIds = signal<Set<string>>(new Set());
  private trackedIndex = signal(0);
  
  trackedMission = computed(() => { 
      const active = this.activeMissions();
      if (active.length === 0) return null;
      return active[this.trackedIndex() % active.length] || active[0];
  });

  missionText = computed(() => {
      const m = this.trackedMission();
      if (!m) return "No Active Directive";
      const obj = m.objectives.find(o => o.currentAmount < o.targetAmount);
      if (!obj) return "Directive Complete: Return to Handler";
      return `[${m.category}] ${m.title}: ${obj.description} (${obj.currentAmount}/${obj.targetAmount})`;
  });

  constructor() { 
      if (this.activeMissions().length === 0 && this.completedMissionIds().size === 0) this.startQuest('MQ_01_ARRIVAL'); 
      
      // Update markers whenever missions change or player moves floors
      effect(() => {
          this.updateMapMarkers();
      });
  }

  cycleTracked() {
      if (this.activeMissions().length > 1) {
          this.trackedIndex.update(i => i + 1);
      }
  }

  private updateMapMarkers() {
      const currentZone = this.player.currentSectorId();
      
      // Collect all active objectives in this zone
      const markers: any[] = [];
      
      this.activeMissions().forEach(m => {
          if (m.state !== 'ACTIVE') return;
          m.objectives.forEach(obj => {
              if (obj.currentAmount < obj.targetAmount && obj.targetZoneId === currentZone && obj.targetLocation) {
                  markers.push({
                      x: obj.targetLocation.x,
                      y: obj.targetLocation.y,
                      color: m.category === 'MAIN' ? '#fbbf24' : '#06b6d4',
                      label: m.category === 'MAIN' ? '★ ' + obj.description : '● ' + obj.description
                  });
              }
          });
      });
      
      this.mapService.setObjectiveMarkers(markers);
  }

  private questDb: Record<string, Omit<Mission, 'state'>> = {
      'MQ_01_ARRIVAL': { 
          id: 'MQ_01_ARRIVAL', title: 'The Arrival', description: 'Contact surface handler.', category: 'MAIN', 
          objectives: [{ type: 'TALK', targetId: 'HANDLER', targetAmount: 1, currentAmount: 0, description: 'Report to Mission Handler', targetZoneId: 'HUB', targetLocation: {x: 0, y: -400} }], 
          rewardXp: 100, rewardCredits: 50, unlocksFlag: 'ACT_I_STARTED' 
      },
      'MQ_02_DESCEND': { 
          id: 'MQ_02_DESCEND', title: 'Into the Depths', description: 'The gate is locked. Prove your worth or find a clearance key.', category: 'MAIN', 
          objectives: [{ type: 'INTERACT', targetId: 'GATE', targetAmount: 1, currentAmount: 0, description: 'Unlock Sector Gate', targetZoneId: 'HUB', targetLocation: {x: 0, y: 1380} }], 
          rewardXp: 200, rewardCredits: 100, prereqMissionId: 'MQ_01_ARRIVAL' 
      }
  };

  startQuest(id: string) {
      if (this.completedMissionIds().has(id) || this.activeMissions().some(m => m.id === id)) return;
      const template = this.questDb[id];
      if (!template) return;
      this.activeMissions.update(list => [...list, { ...template, state: 'ACTIVE' }]);
      this.eventBus.dispatch({ type: GameEvents.FLOATING_TEXT_SPAWN, payload: { onPlayer: true, yOffset: -100, text: "NEW DIRECTIVE", color: '#fbbf24', size: 24 } });
  }

  generateRadiantQuest(depth: number) {
      const id = 'RAD_' + Date.now();
      const killAmount = 3 + Math.floor(depth / 2);
      this.activeMissions.update(list => [...list, {
          id,
          title: 'Sector Patrol',
          description: 'Clear hostiles in the area.',
          category: 'RADIANT',
          objectives: [{ type: 'KILL', targetId: 'ENEMY', targetAmount: killAmount, currentAmount: 0, description: 'Neutralize Hostiles' }], 
          rewardXp: 100 * (depth + 1),
          rewardCredits: 50 * (depth + 1),
          state: 'ACTIVE'
      }]);
      this.eventBus.dispatch({ type: GameEvents.FLOATING_TEXT_SPAWN, payload: { onPlayer: true, yOffset: -100, text: "RADIANT DIRECTIVE", color: '#fbbf24', size: 24 } });
  }

  onEnemyKill(type: string) { this.updateObjectives('KILL', type); this.updateObjectives('KILL', 'ENEMY'); }
  onCollect(itemId: string = '') { this.updateObjectives('COLLECT', itemId); }
  
  onTalk(npcId: string) { 
      this.updateObjectives('TALK', npcId);
  }
  
  onInteract(targetId: string) { this.updateObjectives('INTERACT', targetId); }

  private updateObjectives(type: MissionType, targetId: string) {
      this.activeMissions.update(list => {
          return list.map(m => {
              if (m.state !== 'ACTIVE') return m;
              const updatedObjectives = m.objectives.map(obj => {
                  if (obj.type === type && (obj.targetId === targetId || !obj.targetId) && obj.currentAmount < obj.targetAmount) {
                      return { ...obj, currentAmount: obj.currentAmount + 1 };
                  } return obj;
              });
              // Note: We don't auto-complete quests here for all types. TALK objectives often complete via dialogue action.
              // But for KILL/COLLECT, we could.
              // For now, we rely on manual 'completeQuest' call for story beats, or simple auto-complete for radiant.
              const allComplete = updatedObjectives.every(o => o.currentAmount >= o.targetAmount);
              
              // Auto-complete Radiant or Collect missions
              if (allComplete && (m.category === 'RADIANT' || type === 'KILL')) { 
                  // Use setTimeout to avoid update loop issues if called from render/update cycle
                  setTimeout(() => this.completeQuest(m.id), 0);
                  return { ...m, objectives: updatedObjectives, state: 'COMPLETE' }; 
              }
              
              return { ...m, objectives: updatedObjectives };
          });
      });
  }

  public completeQuest(id: string) {
      const mission = this.activeMissions().find(m => m.id === id);
      if (!mission) return; // Already completed or not active
      
      this.eventBus.dispatch({ type: GameEvents.FLOATING_TEXT_SPAWN, payload: { onPlayer: true, yOffset: -80, text: "DIRECTIVE COMPLETE", color: '#22c55e', size: 30 } });
      this.claimReward(mission);
  }

  private claimReward(mission: Mission) {
      this.activeMissions.update(list => list.filter(m => m.id !== mission.id));
      this.completedMissionIds.update(set => { const newSet = new Set(set); newSet.add(mission.id); return newSet; });
      if (mission.unlocksFlag) this.narrative.setFlag(mission.unlocksFlag, true);
      if (mission.factionRep) this.narrative.modifyReputation(mission.factionRep.factionId as any, mission.factionRep.amount);
      
      this.player.gainXp(mission.rewardXp);
      this.player.gainCredits(mission.rewardCredits);
  }

  isQuestActive(id: string): boolean { return this.activeMissions().some(m => m.id === id); }
  getSaveData() { return { active: this.activeMissions(), completed: Array.from(this.completedMissionIds()) }; }
  loadSaveData(data: any) { if (data.active) this.activeMissions.set(data.active); if (data.completed) this.completedMissionIds.set(new Set(data.completed)); }
  reset() { this.activeMissions.set([]); this.completedMissionIds.set(new Set()); this.startQuest('MQ_01_ARRIVAL'); }
}
