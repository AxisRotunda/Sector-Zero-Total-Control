
import { ZoneTemplate } from "../../models/zone.models";
import { BUILDING_PREFABS, STRUCTURE_DIMENSIONS } from "../prefabs/structures";

const D = STRUCTURE_DIMENSIONS;
const COLOR_FROZEN_WALL = '#475569'; // Slate-600
const COLOR_FROZEN_METAL = '#334155'; // Slate-700
const COLOR_WARM_LIGHT = '#f59e0b'; // Amber-500

const PLAZA_SIZE = 800; 

const CORNER_BLOCKS = [
  { x: PLAZA_SIZE, y: -PLAZA_SIZE },  
  { x: PLAZA_SIZE, y: PLAZA_SIZE },   
  { x: -PLAZA_SIZE, y: -PLAZA_SIZE }, 
  { x: -PLAZA_SIZE, y: PLAZA_SIZE }   
].map(pos => ({
  ...pos,
  w: 100, 
  h: 100, 
  height: 400, 
  color: COLOR_FROZEN_METAL,
  type: 'PILLAR'
}));

// Re-position prefabs
const spire = BUILDING_PREFABS.spire(0, -200); 
const medBay = BUILDING_PREFABS.medBay(-400, 100); 
const shop = BUILDING_PREFABS.shop(400, 100); 
const training = BUILDING_PREFABS.trainingChamber(-600, -300); 
const southGate = BUILDING_PREFABS.gateAssembly(1000, true);

// Retexture prefabs to Frozen theme
[...spire.walls, ...medBay.walls, ...shop.walls, ...training.walls, ...southGate.walls].forEach(w => {
    if (['#52525b', '#27272a', '#3f3f46', '#334155'].includes(w.color || '')) {
        w.color = COLOR_FROZEN_METAL;
    }
});
spire.walls[0].color = ''; 

export const HUB_ZONE: ZoneTemplate = {
  id: 'HUB',
  name: 'Liminal Citadel [Surface Layer]',
  theme: 'FROZEN', 
  bounds: { minX: -1600, maxX: 1600, minY: -1600, maxY: 1800 },
  
  regionType: 'hub',
  isSafeZone: true, 
  childZoneIds: ['SECTOR_9_N', 'HUB_TRAINING'],

  renderLayers: {
    floor: { zIndex: -1000 },
    walls: { zIndex: 0, sortBy: 'position' },
    roofs: { zIndex: 1000 },
    occluders: { zIndex: 2000, dynamic: true }
  },

  geometry: {
    walls: [
      ...CORNER_BLOCKS,
      ...southGate.walls,
      ...spire.walls,
      ...medBay.walls,
      ...shop.walls,
      ...training.walls,
      { x: -800, y: 0, w: 40, h: 1600, height: 300, color: COLOR_FROZEN_WALL },
      { x: 800, y: 0, w: 40, h: 1600, height: 300, color: COLOR_FROZEN_WALL },
      // North Wall - Gap for station
      { x: -500, y: -800, w: 600, h: 40, height: 300, color: COLOR_FROZEN_WALL }, 
      { x: 500, y: -800, w: 600, h: 40, height: 300, color: COLOR_FROZEN_WALL },

      // --- TRANSIT STATION GEOMETRY ---
      
      // 1. Train Hull (Backdrop, Physical Barrier)
      // Placed further back to allow walking space in front
      { x: 0, y: -880, w: 800, h: 120, height: 160, color: '#0ea5e9', type: 'MAGLEV_TRAIN' },
      
      // 2. Platform Edge Barriers (Prevents walking onto track)
      // Glass doors that open/close visually
      { x: -300, y: -800, w: 200, h: 20, height: 100, color: '#ef4444', type: 'BARRIER' },
      { x: 300, y: -800, w: 200, h: 20, height: 100, color: '#ef4444', type: 'BARRIER' },
      { x: 0, y: -800, w: 200, h: 20, height: 100, color: '#ef4444', type: 'BARRIER' }, // Center Door

      // 3. Roof Supports
      { x: -300, y: -700, w: 20, h: 20, height: 350, color: '#94a3b8' },
      { x: 300, y: -700, w: 20, h: 20, height: 350, color: '#94a3b8' },
      
      // 4. Ticket Gates (South boundary of station)
      { x: -100, y: -600, w: 10, h: 40, height: 40, color: '#ef4444', type: 'BARRIER' },
      { x: 100, y: -600, w: 10, h: 40, height: 40, color: '#ef4444', type: 'BARRIER' },
      { x: -200, y: -600, w: 200, h: 10, height: 40, color: '#334155' }, // Fence Left
      { x: 200, y: -600, w: 200, h: 10, height: 40, color: '#334155' }, // Fence Right
    ]
  },

  entities: {
    static: [
      ...southGate.entities,
      ...spire.entities,
      ...medBay.entities,
      ...shop.entities,
      ...training.entities,

      // --- PROPAGANDA DECORATIONS ---
      { type: 'DECORATION', subType: 'BANNER', x: -820, y: -200, data: { z: 150, color: '#06b6d4' } },
      { type: 'DECORATION', subType: 'BANNER', x: 820, y: -200, data: { z: 150, color: '#06b6d4' } },
      { type: 'DECORATION', subType: 'BANNER', x: -820, y: 200, data: { z: 150, color: '#06b6d4' } },
      { type: 'DECORATION', subType: 'BANNER', x: 820, y: 200, data: { z: 150, color: '#06b6d4' } },
      
      { type: 'DECORATION', subType: 'HOLO_SIGN', x: 0, y: 300, data: { z: 150, label: 'OBEY', color: '#06b6d4' } },
      { type: 'DECORATION', subType: 'HOLO_SIGN', x: 0, y: -300, data: { z: 150, label: 'REPORT', color: '#06b6d4' } },
      { type: 'DECORATION', subType: 'HOLO_SIGN', x: -600, y: 0, data: { z: 150, label: 'ORDER', color: '#06b6d4' } },
      { type: 'DECORATION', subType: 'HOLO_SIGN', x: 600, y: 0, data: { z: 150, label: 'DELAY', color: '#06b6d4' } },

      // --- STATION VISUALS ---
      // Floor Platform (Walkable Area)
      { type: 'DECORATION', subType: 'RUG', x: 0, y: -700, data: { width: 800, height: 200, color: '#1e293b' } },
      // Hazard Strip at track edge
      { type: 'DECORATION', subType: 'RUG', x: 0, y: -790, data: { width: 800, height: 20, color: '#eab308' } },
      
      // Info Screens
      { type: 'DECORATION', subType: 'INFO_KIOSK', x: -150, y: -700 },
      { type: 'DECORATION', subType: 'INFO_KIOSK', x: 150, y: -700 },

      // Overhead Lighting
      { type: 'DECORATION', subType: 'NEON', x: 0, y: -700, data: { width: 600, height: 20, z: 300, color: '#bae6fd' } },

      // Signage
      { type: 'DECORATION', subType: 'GRAFFITI', x: 0, y: 800, data: { label: "SECTOR 9 ACCESS ↓", color: '#f59e0b', width: 400 } },
      { type: 'DECORATION', subType: 'GRAFFITI', x: 0, y: -650, data: { label: "TRANSIT DOCK 04", color: '#06b6d4', width: 300 } },

      // Thermal Pylons
      { type: 'DECORATION', subType: 'DYNAMIC_GLOW', x: 400, y: 100, data: { width: 150, depth: 150, color: COLOR_WARM_LIGHT, glowIntensity: 0.8 } }, 
      { type: 'DECORATION', subType: 'DYNAMIC_GLOW', x: -400, y: 100, data: { width: 150, depth: 150, color: COLOR_WARM_LIGHT, glowIntensity: 0.8 } }, 
      
      // Guard
      { 
          type: 'NPC', subType: 'GUARD', x: 0, y: -630, 
          data: { color: '#3b82f6', dialogueId: 'arrival_guard' } 
      },

      // Arrival Info Terminal
      {
          type: 'TERMINAL',
          x: 200,
          y: -650,
          data: {
              dialogueId: 'terminal_arrival_log',
              color: '#38bdf8',
              promptText: 'READ LOG',
              width: 30, depth: 20, height: 50
          }
      },

      // Patrol Guard
      { 
          type: 'NPC', subType: 'GUARD', x: 250, y: 300, 
          data: { 
              color: '#3b82f6',
              dialogueId: 'generic_guard',
              patrolPoints: [ { x: 250, y: 300 }, { x: 400, y: 100 }, { x: 250, y: -100 } ]
          } 
      },

      { type: 'NPC', subType: 'HANDLER', x: -50, y: -100, data: { dialogueId: 'handler_hub_main', color: '#3b82f6' } },
      
      { 
          type: 'INTERACTABLE', subType: 'STASH', x: 150, y: 0, 
          data: { 
              promptText: 'OPEN STASH', 
              width: 60, height: 40, depth: 40, color: '#f59e0b',
              renderStyle: 'PRISM', detailStyle: 'PLATING'
          } 
      },
      
      { type: 'INTERACTABLE', subType: 'RIFTGATE', x: 0, y: -400, data: { promptText: 'ACCESS RIFT NETWORK' } },
      
      { type: 'TERMINAL', x: 0, y: -200, data: { dialogueId: 'monolith_intro', color: '#a855f7', promptText: 'COMMUNE' } },

      {
          type: 'TERMINAL', x: 400, y: -300,
          data: { dialogueId: 'directorate_public', color: '#3b82f6', promptText: 'GOVERNMENT NET', width: 40, depth: 30, height: 60 }
      },
      
      { type: 'DECORATION', subType: 'HOLO_TABLE', x: 0, y: 200, data: { color: '#06b6d4' } },
      { type: 'DECORATION', subType: 'RUG', x: 0, y: 0, data: { width: 600, height: 600, color: '#1e293b' } }, 
      
      { type: 'DECORATION', subType: 'STREET_LIGHT', x: -200, y: -200, data: { color: '#cffafe' } },
      { type: 'DECORATION', subType: 'STREET_LIGHT', x: 200, y: -200, data: { color: '#cffafe' } },
      { type: 'DECORATION', subType: 'STREET_LIGHT', x: -200, y: 200, data: { color: '#cffafe' } },
      { type: 'DECORATION', subType: 'STREET_LIGHT', x: 200, y: 200, data: { color: '#cffafe' } },

      { type: 'NPC', subType: 'CITIZEN', x: 400, y: -300, data: { dialogueId: 'citizen_gossip_hub', behavior: 'IDLE', color: '#64748b' } },
      { type: 'NPC', subType: 'CITIZEN', x: -450, y: 250, data: { dialogueId: 'citizen_gossip_hub', behavior: 'IDLE', color: '#64748b' } },
    ],
    dynamic: []
  },

  exits: [
    { 
      x: 0, 
      y: 1050, 
      targetZoneId: 'SECTOR_9_N', 
      transitionType: 'GATE', 
      locked: true,
      spawnOverride: { x: 0, y: -650 } 
    }
  ],

  environment: {
    weather: 'SNOW', 
    floorPattern: 'HUB',
    colors: { ground: '#e2e8f0', wall: COLOR_FROZEN_WALL, detail: '#bae6fd' },
    ambientColor: '#eff6ff' 
  },

  metadata: {
    difficulty: 1.0,
    isInstanced: false,
    playerStart: { x: 0, y: -720 }, // Safe spot on the platform RUG
    hasRiftgate: true
  }
};
