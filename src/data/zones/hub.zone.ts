
import { ZoneTemplate } from "../../models/zone.models";
import { MapUtils } from "../../utils/map-utils";

export const HUB_ZONE: ZoneTemplate = {
  id: 'HUB',
  name: 'Liminal Citadel',
  theme: 'INDUSTRIAL',
  // Expanded bounds for better camera framing
  bounds: { minX: -1600, maxX: 1600, minY: -1600, maxY: 1800 },
  
  // Hierarchy Metadata
  regionType: 'hub',
  childZoneIds: ['SECTOR_9_N'],

  geometry: {
    walls: [
      // --- PERIMETER WALLS (Octagon-ish) ---
      // North Wall (Behind Spire)
      { x: 0, y: -1400, w: 1000, h: 60, height: 300, color: '#27272a' },
      
      // North-East Angle
      { x: 1000, y: -1000, w: 60, h: 800, height: 300, color: '#27272a' }, // Vertical-ish
      // East Wall
      { x: 1400, y: 0, w: 60, h: 1400, height: 300, color: '#27272a' },
      // South-East Angle
      { x: 1000, y: 1000, w: 60, h: 800, height: 300, color: '#27272a' },

      // North-West Angle
      { x: -1000, y: -1000, w: 60, h: 800, height: 300, color: '#27272a' },
      // West Wall
      { x: -1400, y: 0, w: 60, h: 1400, height: 300, color: '#27272a' },
      // South-West Angle
      { x: -1000, y: 1000, w: 60, h: 800, height: 300, color: '#27272a' },

      // --- SOUTH GATE COMPLEX ---
      // The Gatehouse Walls (Thicker, taller)
      { x: -400, y: 1400, w: 800, h: 100, height: 350, color: '#18181b' }, // Left Flank
      { x: 400, y: 1400, w: 800, h: 100, height: 350, color: '#18181b' },  // Right Flank
      
      // The Physical Gate (Sliding Door) - Positioned in the gap
      // ID is implicit by position for now, but logical locking is handled by SectorLoader
      { x: 0, y: 1400, w: 300, h: 40, height: 300, color: '#3f3f46', type: 'GATE_SEGMENT', locked: true },

      // --- INTERNAL STRUCTURES ---
      // The Spire (North Center)
      { x: 0, y: -600, w: 200, h: 200, height: 600, color: '#06b6d4', type: 'MONOLITH' },
      
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
      // Gate Guard (Standing visible in front of the gate structure)
      { type: 'NPC', subType: 'GUARD', x: -180, y: 1320, data: { dialogueId: 'gate_locked', color: '#3b82f6' } },
      
      // Plaza Patrol
      { 
        type: 'NPC', subType: 'GUARD', x: 0, y: 0, 
        data: { 
          color: '#1d4ed8', 
          dialogueId: 'generic_guard',
          patrolPoints: [{x: -300, y: 200}, {x: 300, y: 200}, {x: 0, y: -200}] 
        } 
      },

      // --- DECORATIONS ---
      { type: 'DECORATION', subType: 'RUG', x: 1100, y: 0, data: { width: 400, height: 500, color: '#e2e8f0' } },
      { type: 'DECORATION', subType: 'RUG', x: -1100, y: 0, data: { width: 400, height: 500, color: '#1c1917' } },
      
      // Road to Gate
      { type: 'DECORATION', subType: 'RUG', x: 0, y: 1000, data: { width: 300, height: 800, color: '#18181b' } },

      // Gate Details
      { type: 'DECORATION', subType: 'HOLO_TABLE', x: 200, y: 1320, data: { color: '#ef4444' } }, // Checkpoint scanner

      // Spire Cables
      { type: 'DECORATION', subType: 'CABLE', x: 0, y: -600, data: { targetX: 1100, targetY: -200, z: 400 } },
      { type: 'DECORATION', subType: 'CABLE', x: 0, y: -600, data: { targetX: -1100, targetY: -200, z: 350 } },
    ],
    dynamic: []
  },

  exits: [
    // South Exit -> Sector 9 North (Main Gate)
    // Placed slightly 'inside' the gate geometry logic so player walks *through* the open gate to trigger
    { 
      x: 0, 
      y: 1420, 
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
