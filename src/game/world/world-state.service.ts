
import { Injectable } from '@angular/core';
import { Entity, SectorId } from '../../models/game.models';

interface EntitySnapshot {
    type: string;
    subType?: string;
    x: number; y: number; z: number;
    hp: number;
    state: string;
    equipment?: any; 
    factionId?: string;
    zoneId?: string;
}

interface ZoneState { 
    entities: EntitySnapshot[]; 
    visited: boolean; 
    timestamp: number;
    hierarchyPath?: string[];
}

@Injectable({ providedIn: 'root' })
export class WorldStateService {
  private zones = new Map<string, ZoneState>();

  hasSector(id: string): boolean { return !!this.zones.get(id); }

  saveSector(id: string, entities: Entity[], path: string[] = []) {
      const snapshot: EntitySnapshot[] = entities
        .filter(e => {
            // Filter out transient entities
            if (e.type === 'HITBOX' || e.type === 'DECORATION' || (e.type === 'DESTRUCTIBLE' && e.hp <= 0)) return false;
            if (e.type === 'WALL') return false; // Walls loaded from template
            // Don't save HUB NPCs (config based)
            if (id === 'HUB' && e.type === 'NPC') return false;
            // Only save entities belonging to THIS zone
            if (e.zoneId && e.zoneId !== id) return false;
            
            return true;
        })
        .map(e => ({
            type: e.type,
            subType: e.subType,
            x: e.x, y: e.y, z: e.z,
            hp: e.hp,
            state: e.state,
            equipment: e.equipment,
            factionId: e.factionId,
            zoneId: e.zoneId
        }));
      
      this.zones.set(id, { 
          entities: snapshot, 
          visited: true, 
          timestamp: Date.now(),
          hierarchyPath: path 
      });
  }

  loadSector(id: string): Entity[] {
      const state = this.zones.get(id);
      if (!state) return [];
      
      return state.entities.map(s => {
          const e = { ...s } as Entity;
          e.vx = 0; e.vy = 0; e.angle = 0; e.radius = 20; 
          e.maxHp = s.hp; 
          e.status = { stun: 0, slow: 0, poison: null, burn: null, weakness: null, bleed: null };
          return e;
      });
  }

  reset() { this.zones.clear(); }
}
