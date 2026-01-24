
import { ZoneTemplate, ZoneEntityDef } from "../../models/zone.models";
import { BUILDING_PREFABS, PrefabWall, PrefabResult } from "../prefabs/structures";

// --- CONSTANTS & CONFIG ---
const COLOR_FROZEN_WALL = '#475569'; // Slate-600
const COLOR_FROZEN_METAL = '#334155'; // Slate-700
const COLOR_WARM_LIGHT = '#f59e0b'; // Amber-500
const PLAZA_SIZE = 800;

// Centralized Dimension Constants to remove magic numbers
const DIMS = {
  TRAIN: { width: 800, height: 120, depth: 160 },
  BARRIER: { width: 200, depth: 20, height: 100 },
  PILLAR: { width: 100, depth: 100, height: 400 },
  PERIMETER: { width: 40, depth: 1600, height: 300 }
} as const;

// --- GEOMETRY HELPERS ---

/**
 * Applies a frozen metal texture to walls that match specific base colors.
 * Returns a NEW array with modified properties (Immutable).
 */
const applyFrozenTexture = (walls: PrefabWall[]): PrefabWall[] => {
    const targetColors = new Set(['#52525b', '#27272a', '#3f3f46', '#334155']);
    
    return walls.map(w => {
        if (targetColors.has(w.color)) {
            // Clone and modify
            return { ...w, color: COLOR_FROZEN_METAL };
        }
        return w;
    });
};

// --- DISTRICT INSTANTIATION ---

// 1. Define Core Architecture (Manual)
const CORNER_BLOCKS: PrefabWall[] = [
  { x: PLAZA_SIZE, y: -PLAZA_SIZE },
  { x: PLAZA_SIZE, y: PLAZA_SIZE },
  { x: -PLAZA_SIZE, y: -PLAZA_SIZE },
  { x: -PLAZA_SIZE, y: PLAZA_SIZE }
].map(pos => ({
  ...pos,
  w: DIMS.PILLAR.width, 
  h: DIMS.PILLAR.depth, 
  height: DIMS.PILLAR.height,
  color: COLOR_FROZEN_METAL,
  type: 'PILLAR'
}));

const PERIMETER_WALLS: PrefabWall[] = [
    { x: -800, y: 0, w: DIMS.PERIMETER.width, h: DIMS.PERIMETER.depth, height: DIMS.PERIMETER.height, color: COLOR_FROZEN_WALL },
    { x: 800, y: 0, w: DIMS.PERIMETER.width, h: DIMS.PERIMETER.depth, height: DIMS.PERIMETER.height, color: COLOR_FROZEN_WALL },
    // North Wall - Gap for station
    { x: -500, y: -800, w: 600, h: 40, height: 300, color: COLOR_FROZEN_WALL }, 
    { x: 500, y: -800, w: 600, h: 40, height: 300, color: COLOR_FROZEN_WALL },
];

const STATION_GEOMETRY: PrefabWall[] = [
    // Train Hull
    { x: 0, y: -880, w: DIMS.TRAIN.width, h: DIMS.TRAIN.height, height: DIMS.TRAIN.depth, color: '#0ea5e9', type: 'MAGLEV_TRAIN' },
    // Platform Barriers
    { x: -300, y: -800, w: DIMS.BARRIER.width, h: DIMS.BARRIER.depth, height: DIMS.BARRIER.height, color: '#ef4444', type: 'BARRIER' },
    { x: 300, y: -800, w: DIMS.BARRIER.width, h: DIMS.BARRIER.depth, height: DIMS.BARRIER.height, color: '#ef4444', type: 'BARRIER' },
    { x: 0, y: -800, w: DIMS.BARRIER.width, h: DIMS.BARRIER.depth, height: DIMS.BARRIER.height, color: '#ef4444', type: 'BARRIER' },
    // Roof Supports
    { x: -300, y: -700, w: 20, h: 20, height: 350, color: '#94a3b8' },
    { x: 300, y: -700, w: 20, h: 20, height: 350, color: '#94a3b8' },
    // Gates
    { x: -100, y: -600, w: 10, h: 40, height: 40, color: '#ef4444', type: 'BARRIER' },
    { x: 100, y: -600, w: 10, h: 40, height: 40, color: '#ef4444', type: 'BARRIER' },
    { x: -200, y: -600, w: 200, h: 10, height: 40, color: '#334155' },
    { x: 200, y: -600, w: 200, h: 10, height: 40, color: '#334155' },
];

// 2. Instantiate Prefabs (Districts)
const districts: Record<string, PrefabResult> = {
    spire: BUILDING_PREFABS.spire(0, -200),
    medBay: BUILDING_PREFABS.medBay(-400, 100),
    shop: BUILDING_PREFABS.shop(400, 100),
    training: BUILDING_PREFABS.trainingChamber(-600, -300),
    southGate: BUILDING_PREFABS.gateAssembly(1000, true),
    barracks: BUILDING_PREFABS.livingQuarters(800, -300, COLOR_FROZEN_WALL),
    messHall: BUILDING_PREFABS.messHall(-800, 100, COLOR_FROZEN_WALL),
    supplies: BUILDING_PREFABS.supplyDepot(600, -600)
};

// 3. Aggregate Geometry & Entities (Linear Complexity)
const zoneWalls: PrefabWall[] = [];
const zoneStaticEntities: ZoneEntityDef[] = [];

// Add Manual Geometry
zoneWalls.push(...CORNER_BLOCKS, ...PERIMETER_WALLS, ...STATION_GEOMETRY);

// Add Districts
Object.values(districts).forEach(district => {
    // Apply Texture Processing per district (Immutable)
    const processedWalls = applyFrozenTexture(district.walls);
    
    // Aggregate
    zoneWalls.push(...processedWalls);
    zoneStaticEntities.push(...district.entities);
});

// Special Overrides (e.g. Spire base reset)
// Note: Since we cloned the arrays, we must find the spire walls in the main array or apply before pushing.
// Since we aggregated linearly, we can just check if Spire was added. 
// However, specific overrides on prefabs are better done via the prefab function arguments or post-processing map.
// For now, we will leave the spire override out as the immutable pattern handles the "frozen" look safely.

// 4. Manual Static Entities (Decorations not part of a prefab)
// Now with Stable IDs for logic/scripting access.
const manualEntities: ZoneEntityDef[] = [
    // Propaganda
    { id: 'banner_prop_nw', type: 'DECORATION', subType: 'BANNER', x: -820, y: -200, data: { z: 150, color: '#06b6d4' } },
    { id: 'banner_prop_ne', type: 'DECORATION', subType: 'BANNER', x: 820, y: -200, data: { z: 150, color: '#06b6d4' } },
    { id: 'banner_prop_sw', type: 'DECORATION', subType: 'BANNER', x: -820, y: 200, data: { z: 150, color: '#06b6d4' } },
    { id: 'banner_prop_se', type: 'DECORATION', subType: 'BANNER', x: 820, y: 200, data: { z: 150, color: '#06b6d4' } },
    
    { id: 'holo_obey', type: 'DECORATION', subType: 'HOLO_SIGN', x: 0, y: 300, data: { z: 150, label: 'OBEY', color: '#06b6d4' } },
    { id: 'holo_report', type: 'DECORATION', subType: 'HOLO_SIGN', x: 0, y: -300, data: { z: 150, label: 'REPORT', color: '#06b6d4' } },
    { id: 'holo_order', type: 'DECORATION', subType: 'HOLO_SIGN', x: -600, y: 0, data: { z: 150, label: 'ORDER', color: '#06b6d4' } },
    { id: 'holo_delay', type: 'DECORATION', subType: 'HOLO_SIGN', x: 600, y: 0, data: { z: 150, label: 'DELAY', color: '#06b6d4' } },

    // Station
    { type: 'DECORATION', subType: 'RUG', x: 0, y: -700, data: { width: 800, height: 200, color: '#1e293b' } },
    { type: 'DECORATION', subType: 'RUG', x: 0, y: -790, data: { width: 800, height: 20, color: '#eab308' } },
    { type: 'DECORATION', subType: 'INFO_KIOSK', x: -150, y: -700 },
    { type: 'DECORATION', subType: 'INFO_KIOSK', x: 150, y: -700 },
    { type: 'DECORATION', subType: 'NEON', x: 0, y: -700, data: { width: 600, height: 20, z: 300, color: '#bae6fd' } },
    { type: 'DECORATION', subType: 'GRAFFITI', x: 0, y: 800, data: { label: "SECTOR 9 ACCESS ↓", color: '#f59e0b', width: 400 } },
    { type: 'DECORATION', subType: 'GRAFFITI', x: 0, y: -650, data: { label: "TRANSIT DOCK 04", color: '#06b6d4', width: 300 } },

    // Lighting
    { type: 'DECORATION', subType: 'DYNAMIC_GLOW', x: 400, y: 100, data: { width: 150, depth: 150, color: COLOR_WARM_LIGHT, glowIntensity: 0.8 } }, 
    { type: 'DECORATION', subType: 'DYNAMIC_GLOW', x: -400, y: 100, data: { width: 150, depth: 150, color: COLOR_WARM_LIGHT, glowIntensity: 0.8 } }, 
    { type: 'DECORATION', subType: 'STREET_LIGHT', x: -200, y: -200, data: { color: '#cffafe' } },
    { type: 'DECORATION', subType: 'STREET_LIGHT', x: 200, y: -200, data: { color: '#cffafe' } },
    { type: 'DECORATION', subType: 'STREET_LIGHT', x: -200, y: 200, data: { color: '#cffafe' } },
    { type: 'DECORATION', subType: 'STREET_LIGHT', x: 200, y: 200, data: { color: '#cffafe' } },

    // Interactables
    { id: 'npc_arrival_guard', type: 'NPC', subType: 'GUARD', x: 0, y: -630, data: { color: '#3b82f6', dialogueId: 'arrival_guard' } },
    { id: 'term_arrival_log', type: 'TERMINAL', x: 200, y: -650, data: { dialogueId: 'terminal_arrival_log', color: '#38bdf8', promptText: 'READ LOG', width: 30, depth: 20, height: 50 } },
    { id: 'npc_patrol_guard', type: 'NPC', subType: 'GUARD', x: 250, y: 300, data: { color: '#3b82f6', dialogueId: 'generic_guard', patrolPoints: [ { x: 250, y: 300 }, { x: 400, y: 100 }, { x: 250, y: -100 } ] } },
    { id: 'npc_handler', type: 'NPC', subType: 'HANDLER', x: -50, y: -100, data: { dialogueId: 'handler_hub_main', color: '#3b82f6' } },
    { id: 'int_stash', type: 'INTERACTABLE', subType: 'STASH', x: 150, y: 0, data: { promptText: 'OPEN STASH', width: 60, height: 40, depth: 40, color: '#f59e0b', renderStyle: 'PRISM', detailStyle: 'PLATING' } },
    { id: 'int_riftgate', type: 'INTERACTABLE', subType: 'RIFTGATE', x: 0, y: -400, data: { promptText: 'ACCESS RIFT NETWORK' } },
    { id: 'term_monolith', type: 'TERMINAL', x: 0, y: -200, data: { dialogueId: 'monolith_intro', color: '#a855f7', promptText: 'COMMUNE' } },
    { id: 'term_directorate', type: 'TERMINAL', x: 400, y: -300, data: { dialogueId: 'directorate_public', color: '#3b82f6', promptText: 'GOVERNMENT NET', width: 40, depth: 30, height: 60 } },
    { type: 'DECORATION', subType: 'HOLO_TABLE', x: 0, y: 200, data: { color: '#06b6d4' } },
    { type: 'DECORATION', subType: 'RUG', x: 0, y: 0, data: { width: 600, height: 600, color: '#1e293b' } }, 
    { type: 'NPC', subType: 'CITIZEN', x: 400, y: -300, data: { dialogueId: 'citizen_gossip_hub', behavior: 'IDLE', color: '#64748b' } },
    { type: 'NPC', subType: 'CITIZEN', x: -450, y: 250, data: { dialogueId: 'citizen_gossip_hub', behavior: 'IDLE', color: '#64748b' } },
];

// --- ZONE DEFINITION ---

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
    walls: zoneWalls
  },

  entities: {
    static: [
        ...zoneStaticEntities,
        ...manualEntities
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
