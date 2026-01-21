
import { ZoneTemplate } from "../../models/zone.models";
import { MapUtils } from "../../utils/map-utils";

export const HUB_ZONE: ZoneTemplate = {
  id: 'HUB',
  name: 'Liminal Citadel',
  theme: 'INDUSTRIAL',
  // Tighter bounds to keep camera focused
  bounds: { minX: -1600, maxX: 1600, minY: -1600, maxY: 1600 },
  
  regionType: 'hub',
  childZoneIds: ['SECTOR_9'],

  geometry: {
    walls: [
      // Rectangular Fortress (Radius 1200 = 2400x2400 box)
      ...MapUtils.createFortress(1200, 80, 400, '#27272a'),
      
      // The Central Spire - Massive visual anchor
      { x: 0, y: -400, w: 250, h: 250, height: 800, color: '#06b6d4', type: 'MONOLITH' },
      
      // The Main Gate - Explicit gate structure blocking the south exit
      { x: 0, y: 1200, w: 400, h: 60, height: 350, color: '#3f3f46', type: 'GATE_SEGMENT', locked: true },
      
      // Med Bay Enclosure (East Side)
      { x: 900, y: 0, w: 20, h: 600, height: 150, color: '#52525b' }, // Vertical divider
      
      // Market Area Columns (West Side)
      { x: -900, y: -300, w: 60, h: 60, height: 200, color: '#52525b', type: 'PILLAR' },
      { x: -900, y: 300, w: 60, h: 60, height: 200, color: '#52525b', type: 'PILLAR' },
    ]
  },

  entities: {
    static: [
      // NPCs
      { type: 'NPC', subType: 'HANDLER', x: 0, y: -200, data: { dialogueId: 'start_1', color: '#3b82f6' } }, // Near Spire base
      { type: 'NPC', subType: 'CONSOLE', x: -120, y: -200, data: { dialogueId: 'start_1', color: '#06b6d4' } },
      { type: 'NPC', subType: 'GUARD', x: 250, y: 1100, data: { dialogueId: 'gate_locked', color: '#3b82f6' } }, // Near Gate
      
      // Med Bay (East)
      { type: 'NPC', subType: 'MEDIC', x: 1050, y: 0, data: { dialogueId: 'medic_intro', color: '#ef4444' } },
      { type: 'DECORATION', subType: 'RUG', x: 1050, y: 0, data: { width: 300, height: 600, color: '#e2e8f0' } },
      
      // Market (West)
      { type: 'NPC', subType: 'TRADER', x: -1050, y: 0, data: { dialogueId: 'generic', color: '#eab308' } },
      { type: 'DECORATION', subType: 'RUG', x: -1050, y: 0, data: { width: 300, height: 600, color: '#1c1917' } },
      
      // Cables connecting Spire to districts
      { type: 'DECORATION', subType: 'CABLE', x: 0, y: -400, data: { targetX: 1050, targetY: -200, z: 500 } },
      { type: 'DECORATION', subType: 'CABLE', x: 0, y: -400, data: { targetX: -1050, targetY: -200, z: 450 } },
      
      // Plaza Decorations
      { type: 'DECORATION', subType: 'HOLO_TABLE', x: 0, y: 400, data: { color: '#06b6d4' } },
    ],
    dynamic: []
  },

  exits: [
    // South Exit -> Sector 9
    // Placed slightly outside the gate visual
    { 
      x: 0, 
      y: 1300, 
      targetZoneId: 'SECTOR_9', 
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
