
import { ZoneTemplate } from "../../models/zone.models";
import { BUILDING_PREFABS, STRUCTURE_DIMENSIONS } from "../prefabs/structures";

// --- ARCHITECTURE: CITADEL HUB ---
// A bastion of Order and Sterility. Slate, Chrome, and Cyan light.

const D = STRUCTURE_DIMENSIONS;
const COLOR_PRIMARY = '#334155'; // Slate-700 (Replaces heavy dark industrial)

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

// Override prefab wall colors to match Citadel Theme
[...spire.walls, ...medBay.walls, ...shop.walls, ...training.walls, ...southGate.walls].forEach(w => {
    if (w.color === '#52525b' || w.color === '#27272a' || w.color === '#3f3f46') {
        w.color = COLOR_PRIMARY;
    }
});

export const HUB_ZONE: ZoneTemplate = {
  id: 'HUB',
  name: 'Liminal Citadel',
  theme: 'HIGH_TECH', // Switch to High Tech for grid/clean look
  bounds: { minX: -1600, maxX: 1600, minY: -1600, maxY: 1800 },
  
  regionType: 'hub',
  isSafeZone: true, // Safe harbor logic (brighter ambient)
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

      // --- PATROL GUARDS (Vanguard Security) ---
      // Patrol 1: Shop Security (East Wing)
      { 
          type: 'NPC', subType: 'GUARD', x: 250, y: 300, 
          data: { 
              color: '#3b82f6',
              dialogueId: 'generic_guard',
              patrolPoints: [
                  { x: 250, y: 300 },
                  { x: 400, y: 100 },
                  { x: 250, y: -100 }
              ]
          } 
      },
      // Patrol 2: MedBay Security (West Wing)
      { 
          type: 'NPC', subType: 'GUARD', x: -250, y: -100, 
          data: { 
              color: '#3b82f6',
              dialogueId: 'generic_guard',
              patrolPoints: [
                  { x: -250, y: -100 },
                  { x: -400, y: 100 },
                  { x: -250, y: 300 }
              ]
          } 
      },
      // Patrol 3: Spire Perimeter (Rear)
      { 
          type: 'NPC', subType: 'GUARD', x: 0, y: -450, 
          data: { 
              color: '#3b82f6',
              dialogueId: 'generic_guard',
              patrolPoints: [
                  { x: 150, y: -450 },
                  { x: -150, y: -450 }
              ]
          } 
      },

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
      
      // RIFTGATE - The anchor point
      {
          type: 'INTERACTABLE', subType: 'RIFTGATE', x: 0, y: -200, 
          data: { promptText: 'ACCESS RIFT NETWORK' }
      },
      
      // Flavor - Central Holo Map
      { type: 'DECORATION', subType: 'HOLO_TABLE', x: 0, y: 0, data: { color: '#06b6d4' } },

      // --- ATMOSPHERE ---
      { type: 'DECORATION', subType: 'RUG', x: 0, y: 0, data: { width: 600, height: 600, color: '#1e293b' } }, // Slate Rug
      
      // Lamps - Using White/Cyan overrides for sterile lighting
      { type: 'DECORATION', subType: 'STREET_LIGHT', x: -200, y: -200, data: { color: '#cffafe' } },
      { type: 'DECORATION', subType: 'STREET_LIGHT', x: 200, y: -200, data: { color: '#cffafe' } },
      { type: 'DECORATION', subType: 'STREET_LIGHT', x: -200, y: 200, data: { color: '#cffafe' } },
      { type: 'DECORATION', subType: 'STREET_LIGHT', x: 200, y: 200, data: { color: '#cffafe' } },
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
    weather: 'NONE', // Clean air
    floorPattern: 'HUB',
    colors: {
      ground: '#1e293b', // Slate-800
      wall: '#334155',   // Slate-700
      detail: '#06b6d4'  // Cyan-500
    },
    ambientColor: '#0f172a' // Slate-900 (High-Tech Base)
  },

  metadata: {
    difficulty: 1.0,
    isInstanced: false,
    playerStart: { x: 0, y: 150 },
    hasRiftgate: true
  }
};
