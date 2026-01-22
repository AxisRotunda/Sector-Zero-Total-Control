
import { ZoneTemplate } from "../../models/zone.models";

// Procedural generation for symmetric structures
const CORNER_BLOCKS = [
  { x: 800, y: -900 },  // Top-Right
  { x: 800, y: 900 },   // Bottom-Right
  { x: -800, y: -900 }, // Top-Left
  { x: -800, y: 900 }   // Bottom-Left
].map(pos => ({
  ...pos,
  w: 200, 
  h: 400, 
  height: 400, 
  color: '#27272a'
}));

const SIDE_WALLS = [
  { x: 800, y: 0 },  // East
  { x: -800, y: 0 }  // West
].map(pos => ({
  ...pos,
  w: 200, 
  h: 1400, 
  height: 300, 
  color: '#27272a'
}));

export const HUB_ZONE: ZoneTemplate = {
  id: 'HUB',
  name: 'Liminal Citadel',
  theme: 'INDUSTRIAL',
  bounds: { minX: -1600, maxX: 1600, minY: -1600, maxY: 1800 },
  
  regionType: 'hub',
  childZoneIds: ['SECTOR_9_N'],

  geometry: {
    walls: [
      // --- NORTH WALLS ---
      { x: 0, y: -1000, w: 1400, h: 200, height: 400, color: '#27272a' },
      
      // --- PROCEDURAL PERIMETER ---
      ...CORNER_BLOCKS,
      ...SIDE_WALLS,

      // --- SOUTH WALLS & GATE ---
      // Left Flank
      { x: -500, y: 1200, w: 800, h: 200, height: 350, color: '#18181b' },
      // Right Flank
      { x: 500, y: 1200, w: 800, h: 200, height: 350, color: '#18181b' },

      // Gate Mechanism (Center Gap)
      { x: 0, y: 1200, w: 200, h: 60, height: 300, color: '#3f3f46', type: 'GATE_SEGMENT', locked: true },

      // Gate Pillars
      { x: -120, y: 1200, w: 60, h: 220, height: 380, color: '#52525b', type: 'PILLAR' },
      { x: 120, y: 1200, w: 60, h: 220, height: 380, color: '#52525b', type: 'PILLAR' },

      // --- INTERNAL STRUCTURES ---
      // The Spire
      { x: 0, y: -500, w: 200, h: 200, height: 600, color: '#06b6d4', type: 'MONOLITH' },
      
      // Medical Bay (East)
      { x: 600, y: -200, w: 20, h: 300, height: 120, color: '#52525b' },
      
      // Shop Kiosk (West)
      { x: -600, y: 0, w: 60, h: 60, height: 150, color: '#52525b', type: 'PILLAR' },
    ]
  },

  entities: {
    static: [
      // Key NPCs
      { type: 'NPC', subType: 'HANDLER', x: 0, y: -300, data: { dialogueId: 'start_1', color: '#3b82f6' } },
      { type: 'NPC', subType: 'CONSOLE', x: -100, y: -300, data: { dialogueId: 'start_1', color: '#06b6d4' } },
      
      // Med Bay
      { type: 'NPC', subType: 'MEDIC', x: 650, y: -200, data: { dialogueId: 'medic_intro', color: '#ef4444' } },
      { type: 'DECORATION', subType: 'HOLO_TABLE', x: 650, y: -250, data: { color: '#ef4444' } },

      // Market
      { type: 'NPC', subType: 'TRADER', x: -650, y: 0, data: { dialogueId: 'generic', color: '#eab308' } },
      { type: 'DECORATION', subType: 'VENDING_MACHINE', x: -650, y: -80, data: {} },

      // Gate Guard
      { type: 'NPC', subType: 'GUARD', x: -200, y: 1100, data: { dialogueId: 'gate_locked', color: '#3b82f6' } },
      
      // Flavor
      { type: 'DECORATION', subType: 'RUG', x: 0, y: 0, data: { width: 800, height: 800, color: '#18181b' } },
      { type: 'DECORATION', subType: 'RUG', x: 0, y: 1000, data: { width: 300, height: 600, color: '#18181b' } },
      
      // Cables
      { type: 'DECORATION', subType: 'CABLE', x: 0, y: -500, data: { targetX: 650, targetY: -200, z: 400 } },
      { type: 'DECORATION', subType: 'CABLE', x: 0, y: -500, data: { targetX: -650, targetY: 0, z: 400 } },
    ],
    dynamic: []
  },

  exits: [
    { 
      x: 0, 
      y: 1250, 
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
    playerStart: { x: 0, y: 600 }
  }
};
