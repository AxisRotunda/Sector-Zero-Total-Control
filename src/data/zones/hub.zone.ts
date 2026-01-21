
import { ZoneTemplate } from "../../models/zone.models";

export const HUB_ZONE: ZoneTemplate = {
  id: 'HUB',
  name: 'Liminal Citadel',
  theme: 'INDUSTRIAL',
  bounds: { minX: -1600, maxX: 1600, minY: -1600, maxY: 1800 },
  
  regionType: 'hub',
  childZoneIds: ['SECTOR_9_N'],

  geometry: {
    walls: [
      // --- ARCHITECTURE STRATEGY: THE CROSS ---
      // A safe, enclosed central plaza with four cardinal extensions.
      // Thickness of perimeter walls: 200px (Prevents tunneling)
      
      // --- NORTH WALLS ---
      // Top Edge
      { x: 0, y: -1000, w: 1400, h: 200, height: 400, color: '#27272a' },
      
      // --- EAST WALLS ---
      // Top-Right Corner Block
      { x: 800, y: -900, w: 200, h: 400, height: 400, color: '#27272a' },
      // East Side Wall
      { x: 800, y: 0, w: 200, h: 1400, height: 300, color: '#27272a' },
      // Bottom-Right Corner Block
      { x: 800, y: 900, w: 200, h: 400, height: 400, color: '#27272a' },

      // --- WEST WALLS ---
      // Top-Left Corner Block
      { x: -800, y: -900, w: 200, h: 400, height: 400, color: '#27272a' },
      // West Side Wall
      { x: -800, y: 0, w: 200, h: 1400, height: 300, color: '#27272a' },
      // Bottom-Left Corner Block
      { x: -800, y: 900, w: 200, h: 400, height: 400, color: '#27272a' },

      // --- SOUTH WALLS & GATE ---
      // The Gate area is a bottleneck. 
      // Main Plaza extends to Y=800.
      // Gate is at Y=1200.
      
      // Left Flank (Solid Block)
      { x: -500, y: 1200, w: 800, h: 200, height: 350, color: '#18181b' },
      
      // Right Flank (Solid Block)
      { x: 500, y: 1200, w: 800, h: 200, height: 350, color: '#18181b' },

      // Gate Mechanism (The Moving Part) - Center Gap (-100 to 100)
      { x: 0, y: 1200, w: 200, h: 60, height: 300, color: '#3f3f46', type: 'GATE_SEGMENT', locked: true },

      // Gate Pillars (Visual Anchors)
      { x: -120, y: 1200, w: 60, h: 220, height: 380, color: '#52525b', type: 'PILLAR' },
      { x: 120, y: 1200, w: 60, h: 220, height: 380, color: '#52525b', type: 'PILLAR' },

      // --- INTERNAL STRUCTURES ---
      // The Spire (Center North)
      { x: 0, y: -500, w: 200, h: 200, height: 600, color: '#06b6d4', type: 'MONOLITH' },
      
      // Medical Bay (East Alcove) - Thin partitions
      { x: 600, y: -200, w: 20, h: 300, height: 120, color: '#52525b' },
      
      // Shop Kiosk (West Alcove) - Pillars
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
      { type: 'DECORATION', subType: 'RUG', x: 0, y: 1000, data: { width: 300, height: 600, color: '#18181b' } }, // Path to gate
      
      // Cables
      { type: 'DECORATION', subType: 'CABLE', x: 0, y: -500, data: { targetX: 650, targetY: -200, z: 400 } },
      { type: 'DECORATION', subType: 'CABLE', x: 0, y: -500, data: { targetX: -650, targetY: 0, z: 400 } },
    ],
    dynamic: []
  },

  exits: [
    // South Exit -> Sector 9 North
    // Positioned past the gate logic
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
