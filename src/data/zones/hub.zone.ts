
import { ZoneTemplate } from "../../models/zone.models";
import { MapUtils } from "../../utils/map-utils";

export const HUB_ZONE: ZoneTemplate = {
  id: 'HUB',
  name: 'Liminal Citadel',
  theme: 'INDUSTRIAL',
  bounds: { minX: -1600, maxX: 1600, minY: -1600, maxY: 1600 },
  
  regionType: 'hub',
  childZoneIds: ['SECTOR_9'],

  geometry: {
    walls: [
      // Main Walls - Using Sprites
      { x: 0, y: -1200, w: 2480, h: 80, height: 400, color: '#27272a', type: 'WALL_FORTRESS_MAIN' }, // Top
      { x: 0, y: 1200, w: 2480, h: 80, height: 400, color: '#27272a', type: 'WALL_FORTRESS_MAIN' }, // Bottom (Partially obscured by gate logic usually, but keep for simplicity)
      
      { x: -1200, y: 0, w: 80, h: 2400, height: 400, color: '#27272a', type: 'WALL_FORTRESS_SIDE' }, // Left
      { x: 1200, y: 0, w: 80, h: 2400, height: 400, color: '#27272a', type: 'WALL_FORTRESS_SIDE' }, // Right
      
      // Corners - Pillars
      { x: -1200, y: -1200, w: 120, h: 120, height: 450, color: '#3f3f46', type: 'PILLAR_FORTRESS' },
      { x: 1200, y: -1200, w: 120, h: 120, height: 450, color: '#3f3f46', type: 'PILLAR_FORTRESS' },
      { x: -1200, y: 1200, w: 120, h: 120, height: 450, color: '#3f3f46', type: 'PILLAR_FORTRESS' },
      { x: 1200, y: 1200, w: 120, h: 120, height: 450, color: '#3f3f46', type: 'PILLAR_FORTRESS' },

      // The Central Spire
      { x: 0, y: -400, w: 250, h: 250, height: 800, color: '#06b6d4', type: 'MONOLITH_CORE' },
      
      // The Main Gate
      { x: 0, y: 1200, w: 400, h: 60, height: 350, color: '#3f3f46', type: 'GATE_SEGMENT', locked: true },
      
      // Med Bay Enclosure
      { x: 900, y: 0, w: 20, h: 600, height: 150, color: '#52525b' }, 
      
      // Market Pillars
      { x: -900, y: -300, w: 60, h: 60, height: 200, color: '#52525b', type: 'PILLAR' },
      { x: -900, y: 300, w: 60, h: 60, height: 200, color: '#52525b', type: 'PILLAR' },
    ]
  },

  entities: {
    static: [
      { type: 'NPC', subType: 'HANDLER', x: 0, y: -200, data: { dialogueId: 'start_1', color: '#3b82f6' } },
      { type: 'NPC', subType: 'CONSOLE', x: -120, y: -200, data: { dialogueId: 'start_1', color: '#06b6d4' } },
      { type: 'NPC', subType: 'GUARD', x: 250, y: 1100, data: { dialogueId: 'gate_locked', color: '#3b82f6' } },
      { type: 'NPC', subType: 'MEDIC', x: 1050, y: 0, data: { dialogueId: 'medic_intro', color: '#ef4444' } },
      { type: 'DECORATION', subType: 'RUG', x: 1050, y: 0, data: { width: 300, height: 600, color: '#e2e8f0' } },
      { type: 'NPC', subType: 'TRADER', x: -1050, y: 0, data: { dialogueId: 'generic', color: '#eab308' } },
      { type: 'DECORATION', subType: 'RUG', x: -1050, y: 0, data: { width: 300, height: 600, color: '#1c1917' } },
      { type: 'DECORATION', subType: 'CABLE', x: 0, y: -400, data: { targetX: 1050, targetY: -200, z: 500 } },
      { type: 'DECORATION', subType: 'CABLE', x: 0, y: -400, data: { targetX: -1050, targetY: -200, z: 450 } },
      { type: 'DECORATION', subType: 'HOLO_TABLE', x: 0, y: 400, data: { color: '#06b6d4' } },
    ],
    dynamic: []
  },

  exits: [
    { x: 0, y: 1300, targetZoneId: 'SECTOR_9', transitionType: 'GATE', locked: true }
  ],

  environment: {
    weather: 'ASH',
    floorPattern: 'HUB',
    colors: { ground: '#09090b', wall: '#27272a', detail: '#06b6d4' }
  },

  metadata: {
    difficulty: 1.0,
    isInstanced: false,
    playerStart: { x: 0, y: 800 }
  }
};
