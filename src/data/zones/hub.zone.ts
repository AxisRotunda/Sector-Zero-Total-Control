
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
      
      // The Spire (North) - Centered at 0, -600 as per prompt logic
      { x: 0, y: -600, w: 200, h: 200, height: 600, color: '#06b6d4', type: 'MONOLITH' },
      
      // Main Gate (South Exit Barrier)
      { x: 0, y: 1380, w: 400, h: 40, height: 300, color: '#3f3f46', type: 'GATE_SEGMENT', locked: true },
      
      // Medical District Enclosure (East) - Adjusted to multiples of 600 (x=1200)
      { x: 1000, y: 0, w: 20, h: 600, height: 120, color: '#52525b' }, // Inner wall
      { x: 1300, y: -300, w: 600, h: 20, height: 120, color: '#52525b' }, // Top wall
      
      // Market District Pillars (West) - Adjusted to x=-1200 area
      { x: -1000, y: -200, w: 40, h: 40, height: 150, color: '#52525b', type: 'PILLAR' },
      { x: -1000, y: 200, w: 40, h: 40, height: 150, color: '#52525b', type: 'PILLAR' },
    ]
  },

  entities: {
    static: [
      // NPCs - Moved Handler closer to Spire base
      { type: 'NPC', subType: 'HANDLER', x: 0, y: -400, data: { dialogueId: 'start_1', color: '#3b82f6' } },
      { type: 'NPC', subType: 'CONSOLE', x: -100, y: -400, data: { dialogueId: 'start_1', color: '#06b6d4' } },
      { type: 'NPC', subType: 'GUARD', x: 250, y: 1300, data: { dialogueId: 'gate_locked', color: '#3b82f6' } },
      
      // Med Bay (East) - Centered at 1200
      { type: 'NPC', subType: 'MEDIC', x: 1200, y: 0, data: { dialogueId: 'medic_intro', color: '#ef4444' } },
      { type: 'DECORATION', subType: 'RUG', x: 1200, y: 0, data: { width: 400, height: 500, color: '#e2e8f0' } },
      
      // Market (West) - Centered at -1200
      { type: 'NPC', subType: 'TRADER', x: -1200, y: 0, data: { dialogueId: 'generic', color: '#eab308' } },
      { type: 'DECORATION', subType: 'RUG', x: -1200, y: 0, data: { width: 400, height: 500, color: '#1c1917' } },
      { type: 'DECORATION', subType: 'VENDING_MACHINE', x: -1350, y: -100 },
      { type: 'DECORATION', subType: 'VENDING_MACHINE', x: -1350, y: 100 },

      // Spire Cables - Connecting Spire (0, -600) to new centers
      { type: 'DECORATION', subType: 'CABLE', x: 0, y: -600, data: { targetX: 1200, targetY: -200, z: 400 } },
      { type: 'DECORATION', subType: 'CABLE', x: 0, y: -600, data: { targetX: -1200, targetY: -200, z: 350 } },
      
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
