
import { ZoneTemplate } from "../../models/zone.models";
import { MapUtils } from "../../utils/map-utils";

export const HUB_ZONE: ZoneTemplate = {
  id: 'HUB',
  name: 'Liminal Citadel',
  theme: 'INDUSTRIAL',
  // Constrained bounds to create a settlement feel
  bounds: { minX: -1500, maxX: 1500, minY: -1500, maxY: 1600 },
  
  // Hierarchy Metadata
  regionType: 'hub',
  childZoneIds: ['SECTOR_9_N'],

  geometry: {
    walls: [
      // Fortress Perimeter (Radius 1400)
      ...MapUtils.createFortress(1400, 60, 250, '#27272a'),
      
      // The Spire (North)
      { x: 0, y: -600, w: 200, h: 200, height: 600, color: '#06b6d4', type: 'MONOLITH' },
      
      // Main Gate (South Exit Barrier)
      { x: 0, y: 1380, w: 400, h: 40, height: 300, color: '#3f3f46', type: 'GATE_SEGMENT', locked: true },
      
      // Medical District Enclosure (East)
      { x: 900, y: 0, w: 20, h: 600, height: 120, color: '#52525b' },
      { x: 1200, y: -300, w: 600, h: 20, height: 120, color: '#52525b' },
      
      // Market District Pillars (West)
      { x: -900, y: -200, w: 40, h: 40, height: 150, color: '#52525b', type: 'PILLAR' },
      { x: -900, y: 200, w: 40, h: 40, height: 150, color: '#52525b', type: 'PILLAR' },
    ]
  },

  entities: {
    static: [
      // --- KEY NPCS ---
      { type: 'NPC', subType: 'HANDLER', x: 0, y: -400, data: { dialogueId: 'start_1', color: '#3b82f6' } },
      { type: 'NPC', subType: 'CONSOLE', x: -100, y: -400, data: { dialogueId: 'start_1', color: '#06b6d4' } },
      
      // Med Bay
      { type: 'NPC', subType: 'MEDIC', x: 1100, y: 0, data: { dialogueId: 'medic_intro', color: '#ef4444' } },
      
      // Market
      { type: 'NPC', subType: 'TRADER', x: -1100, y: 0, data: { dialogueId: 'generic', color: '#eab308' } },

      // --- PATROLLING GUARDS ---
      // Gate Guard (Static)
      { type: 'NPC', subType: 'GUARD', x: 250, y: 1300, data: { dialogueId: 'gate_locked', color: '#3b82f6' } },
      
      // Plaza Patrol (Triangle Route)
      { 
        type: 'NPC', subType: 'GUARD', x: 0, y: 0, 
        data: { 
          color: '#1d4ed8', 
          dialogueId: 'generic_guard',
          patrolPoints: [{x: -300, y: 200}, {x: 300, y: 200}, {x: 0, y: -200}] 
        } 
      },
      // Spire Patrol (Linear)
      { 
        type: 'NPC', subType: 'GUARD', x: 0, y: -800, 
        data: { 
          color: '#1d4ed8', 
          dialogueId: 'generic_guard',
          patrolPoints: [{x: -400, y: -800}, {x: 400, y: -800}] 
        } 
      },

      // --- AMBIENT CITIZENS (Market & Slums) ---
      // Market Crowd
      { type: 'NPC', subType: 'CITIZEN', x: -900, y: -100, data: { dialogueId: 'citizen_bark', color: '#71717a', homeX: -900, homeY: -100, wanderRadius: 150 } },
      { type: 'NPC', subType: 'CITIZEN', x: -1000, y: 150, data: { dialogueId: 'citizen_bark', color: '#52525b', homeX: -1000, homeY: 150, wanderRadius: 100 } },
      { type: 'NPC', subType: 'CITIZEN', x: -850, y: 50, data: { dialogueId: 'citizen_bark', color: '#a1a1aa', homeX: -850, homeY: 50, wanderRadius: 120 } },
      
      // Med Bay Queue
      { type: 'NPC', subType: 'CITIZEN', x: 950, y: 50, data: { dialogueId: 'citizen_bark', color: '#71717a', homeX: 950, homeY: 50, wanderRadius: 50 } },
      { type: 'NPC', subType: 'CITIZEN', x: 950, y: -50, data: { dialogueId: 'citizen_bark', color: '#52525b', homeX: 950, homeY: -50, wanderRadius: 50 } },

      // --- DECORATIONS ---
      { type: 'DECORATION', subType: 'RUG', x: 1100, y: 0, data: { width: 400, height: 500, color: '#e2e8f0' } },
      { type: 'DECORATION', subType: 'RUG', x: -1100, y: 0, data: { width: 400, height: 500, color: '#1c1917' } },
      { type: 'DECORATION', subType: 'VENDING_MACHINE', x: -1250, y: -100 },
      { type: 'DECORATION', subType: 'VENDING_MACHINE', x: -1250, y: 100 },

      // Spire Cables
      { type: 'DECORATION', subType: 'CABLE', x: 0, y: -600, data: { targetX: 1100, targetY: -200, z: 400 } },
      { type: 'DECORATION', subType: 'CABLE', x: 0, y: -600, data: { targetX: -1100, targetY: -200, z: 350 } },
      
      // Plaza Decorations
      { type: 'DECORATION', subType: 'HOLO_TABLE', x: 0, y: 400, data: { color: '#06b6d4' } },
      { type: 'DECORATION', subType: 'BENCH', x: 200, y: 600 },
      { type: 'DECORATION', subType: 'BENCH', x: -200, y: 600 },
    ],
    dynamic: []
  },

  exits: [
    // South Exit -> Sector 9 North (Main Gate)
    { 
      x: 0, 
      y: 1500, 
      targetZoneId: 'SECTOR_9_N', 
      transitionType: 'GATE', 
      locked: true,
    }
  ],

  environment: {
    weather: 'ASH',
    floorPattern: 'HUB',
    colors: {
      ground: '#09090b',
      wall: '#27272a',
      detail: '#06b6d4'
    }
  },

  metadata: {
    difficulty: 1.0,
    isInstanced: false,
    playerStart: { x: 0, y: 800 }
  }
};
