
import { ZoneTemplate } from "../../models/zone.models";
import { BUILDING_PREFABS, STRUCTURE_DIMENSIONS } from "../prefabs/structures";

// --- ARCHITECTURE STRATEGY: THE CROSS ---
// A safe, enclosed central plaza with four cardinal extensions.
// The layout emphasizes symmetry and defensibility.

const D = STRUCTURE_DIMENSIONS;
const COLOR_PRIMARY = '#27272a';

// Phase 1: Procedural Perimeter Generation
const PLAZA_WIDTH = 1400; 
const PLAZA_DEPTH = 1400;
const PERIMETER_OFFSET_X = 800;
const PERIMETER_OFFSET_Y = 900;

const CORNER_BLOCKS = [
  { x: PERIMETER_OFFSET_X, y: -PERIMETER_OFFSET_Y },  // Top-Right
  { x: PERIMETER_OFFSET_X, y: PERIMETER_OFFSET_Y },   // Bottom-Right
  { x: -PERIMETER_OFFSET_X, y: -PERIMETER_OFFSET_Y }, // Top-Left
  { x: -PERIMETER_OFFSET_X, y: PERIMETER_OFFSET_Y }   // Bottom-Left
].map(pos => ({
  ...pos,
  w: D.WALL_THICKNESS, 
  h: 400, 
  height: D.WALL_HEIGHT_OUTER, 
  color: COLOR_PRIMARY
}));

const SIDE_WALLS = [
  { x: PERIMETER_OFFSET_X, y: 0 },  // East
  { x: -PERIMETER_OFFSET_X, y: 0 }  // West
].map(pos => ({
  ...pos,
  w: D.WALL_THICKNESS, 
  h: PLAZA_DEPTH, 
  height: D.WALL_HEIGHT_INNER, 
  color: COLOR_PRIMARY
}));

const NORTH_WALL = [
    { x: 0, y: -1000, w: PLAZA_WIDTH, h: D.WALL_THICKNESS, height: D.WALL_HEIGHT_OUTER, color: COLOR_PRIMARY }
];

// Phase 3: Instantiate Prefabs
const spire = BUILDING_PREFABS.spire(0, -500);
const medBay = BUILDING_PREFABS.medBay(600, -200);
const shop = BUILDING_PREFABS.shop(-600, 0);
const southGate = BUILDING_PREFABS.gateAssembly(1200, true);
const training = BUILDING_PREFABS.trainingChamber(-800, 800);

export const HUB_ZONE: ZoneTemplate = {
  id: 'HUB',
  name: 'Liminal Citadel',
  theme: 'INDUSTRIAL',
  bounds: { minX: -1600, maxX: 1600, minY: -1600, maxY: 1800 },
  
  regionType: 'hub',
  childZoneIds: ['SECTOR_9_N', 'HUB_TRAINING'],

  renderLayers: {
    floor: { zIndex: -1000 },
    walls: { zIndex: 0, sortBy: 'position' },
    roofs: { zIndex: 1000 },
    occluders: { zIndex: 2000, dynamic: true }
  },

  geometry: {
    walls: [
      ...NORTH_WALL,
      ...CORNER_BLOCKS,
      ...SIDE_WALLS,
      ...southGate.walls,
      ...spire.walls,
      ...medBay.walls,
      ...shop.walls,
      ...training.walls
    ]
  },

  entities: {
    static: [
      // Prefab Entities
      ...southGate.entities,
      ...spire.entities,
      ...medBay.entities,
      ...shop.entities,
      ...training.entities,

      // Unique Hub NPCs
      { type: 'NPC', subType: 'HANDLER', x: 0, y: -300, data: { dialogueId: 'start_1', color: '#3b82f6' } },
      { type: 'NPC', subType: 'CONSOLE', x: -100, y: -300, data: { dialogueId: 'start_1', color: '#06b6d4' } },
      
      // Flavor
      { type: 'DECORATION', subType: 'RUG', x: 0, y: 0, data: { width: 800, height: 800, color: '#18181b' } },
      { type: 'DECORATION', subType: 'RUG', x: 0, y: 1000, data: { width: 300, height: 600, color: '#18181b' } },

      // --- LIGHTING & ATMOSPHERE ---
      // Plaza Corners
      { type: 'DECORATION', subType: 'STREET_LIGHT', x: -300, y: -300, data: {} },
      { type: 'DECORATION', subType: 'STREET_LIGHT', x: 300, y: -300, data: {} },
      { type: 'DECORATION', subType: 'STREET_LIGHT', x: -300, y: 300, data: {} },
      { type: 'DECORATION', subType: 'STREET_LIGHT', x: 300, y: 300, data: {} },
      
      // Path to Gate
      { type: 'DECORATION', subType: 'STREET_LIGHT', x: -150, y: 800, data: {} },
      { type: 'DECORATION', subType: 'STREET_LIGHT', x: 150, y: 800, data: {} },

      // Glow Strips
      { type: 'DECORATION', subType: 'DYNAMIC_GLOW', x: 0, y: 600, data: { z: 5, color: '#3b82f6', width: 200, depth: 10, glowIntensity: 0.3 } },
      { type: 'DECORATION', subType: 'DYNAMIC_GLOW', x: 0, y: 900, data: { z: 5, color: '#3b82f6', width: 200, depth: 10, glowIntensity: 0.3 } },
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
    // Training exit is now handled by the prefab entity
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
