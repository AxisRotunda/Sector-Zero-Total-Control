
import { ZoneTemplate } from "../../models/zone.models";
import { BUILDING_PREFABS, STRUCTURE_DIMENSIONS } from "../prefabs/structures";

// --- ARCHITECTURE: COMPACT HUB ---
// Services are clustered around the spawn point for efficient access.
// High-traffic NPCs are immediate neighbors.

const D = STRUCTURE_DIMENSIONS;
const COLOR_PRIMARY = '#27272a';

// Use a tighter plaza for the settlement feel
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
  color: COLOR_PRIMARY,
  type: 'PILLAR'
}));

// Instantiate Prefabs at tighter coordinates
const spire = BUILDING_PREFABS.spire(0, -600); // Back center
const medBay = BUILDING_PREFABS.medBay(-300, 100); // Left side
const shop = BUILDING_PREFABS.shop(300, 100); // Right side
const training = BUILDING_PREFABS.trainingChamber(-600, -300); // Back Left
const southGate = BUILDING_PREFABS.gateAssembly(1000, true);

export const HUB_ZONE: ZoneTemplate = {
  id: 'HUB',
  name: 'Liminal Citadel',
  theme: 'INDUSTRIAL',
  bounds: { minX: -1600, maxX: 1600, minY: -1600, maxY: 1800 },
  
  regionType: 'hub',
  isSafeZone: true, // Safe harbor, disable combat
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
      // Perimeter walls
      { x: -800, y: 0, w: 40, h: 1600, height: 300, color: COLOR_PRIMARY },
      { x: 800, y: 0, w: 40, h: 1600, height: 300, color: COLOR_PRIMARY },
      { x: 0, y: -800, w: 1600, h: 40, height: 300, color: COLOR_PRIMARY }
    ]
  },

  entities: {
    static: [
      ...southGate.entities,
      ...spire.entities,
      ...medBay.entities,
      ...shop.entities,
      ...training.entities,

      // --- SERVICE CLUSTER ---
      // Quest Giver (Handler) - Top Center near Spire
      { type: 'NPC', subType: 'HANDLER', x: -50, y: -300, data: { dialogueId: 'start_1', color: '#3b82f6' } },
      
      // Stash (Storage) - Visualized as a heavy crate near spawn
      { 
          type: 'INTERACTABLE', subType: 'STASH', x: 150, y: 0, 
          data: { 
              promptText: 'OPEN STASH', 
              width: 60, height: 40, depth: 40, color: '#f59e0b',
              renderStyle: 'PRISM', detailStyle: 'PLATING'
          } 
      },
      
      // Flavor - Central Holo Map
      { type: 'DECORATION', subType: 'HOLO_TABLE', x: 0, y: 0, data: { color: '#06b6d4' } },

      // --- ATMOSPHERE ---
      { type: 'DECORATION', subType: 'RUG', x: 0, y: 0, data: { width: 600, height: 600, color: '#18181b' } },
      
      // Lamps
      { type: 'DECORATION', subType: 'STREET_LIGHT', x: -200, y: -200, data: {} },
      { type: 'DECORATION', subType: 'STREET_LIGHT', x: 200, y: -200, data: {} },
      { type: 'DECORATION', subType: 'STREET_LIGHT', x: -200, y: 200, data: {} },
      { type: 'DECORATION', subType: 'STREET_LIGHT', x: 200, y: 200, data: {} },
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
    playerStart: { x: 0, y: 150 } // Start in center plaza
  }
};
