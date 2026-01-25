
import { ZoneTemplate, ZoneEntityDef } from "../../models/zone.models";
import { BUILDING_PREFABS, PrefabWall, cachedStructure } from "../prefabs/structures";

// --- CONSTANTS & CONFIG ---
const COLOR_FROZEN_WALL = '#475569'; // Slate-600
const COLOR_FROZEN_METAL = '#334155'; // Slate-700
const PLAZA_SIZE = 800;

// Centralized Dimension Constants to remove magic numbers
const DIMS = {
  PERIMETER: { width: 40, depth: 1600, height: 300 }
} as const;

// --- COLD FORGE PROTOCOL: PHASE 1 ---
// Execution wrapped in IIFE to ensure single-pass initialization (O(1) app load)
// and immutability of the resulting data structures.
const HUB_CACHE = (() => {
    // 1. Define Core Architecture (Manual)
    const CORNER_BLOCKS: PrefabWall[] = [
      { x: PLAZA_SIZE, y: -PLAZA_SIZE },
      { x: PLAZA_SIZE, y: PLAZA_SIZE },
      { x: -PLAZA_SIZE, y: -PLAZA_SIZE },
      { x: -PLAZA_SIZE, y: PLAZA_SIZE }
    ].map(pos => ({
      ...pos,
      w: 100, h: 220, height: 400, // Explicit DIMS to avoid external dependency drift
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

    /**
     * Applies a frozen metal texture to walls that match specific base colors.
     * Logic runs ONCE during cache initialization.
     */
    const applyFrozenTexture = (walls: readonly PrefabWall[]): PrefabWall[] => {
        const targetColors = new Set(['#52525b', '#27272a', '#3f3f46', '#334155']);
        return walls.map(w => {
            if (targetColors.has(w.color)) {
                return { ...w, color: COLOR_FROZEN_METAL };
            }
            return w;
        });
    };

    // 2. Instantiate Prefabs (Districts) using Memoization
    // Uses cachedStructure to skip re-generation if key matches
    const districts = {
        spire: cachedStructure('hub_spire', () => BUILDING_PREFABS.spire(0, -200)),
        medBay: cachedStructure('hub_medbay', () => BUILDING_PREFABS.medBay(-400, 100)),
        shop: cachedStructure('hub_shop', () => BUILDING_PREFABS.shop(400, 100)),
        training: cachedStructure('hub_training', () => BUILDING_PREFABS.trainingChamber(-600, -300)),
        southGate: cachedStructure('hub_southgate', () => BUILDING_PREFABS.gateAssembly(1000, true)),
        station: cachedStructure('hub_station', () => BUILDING_PREFABS.transitStation(0, -800)),
        barracks: cachedStructure('hub_barracks', () => BUILDING_PREFABS.livingQuarters(800, -300, COLOR_FROZEN_WALL, 'hub_barracks')),
        messHall: cachedStructure('hub_mess', () => BUILDING_PREFABS.messHall(-800, 100, COLOR_FROZEN_WALL, 'hub_mess')),
        supplies: cachedStructure('hub_supply', () => BUILDING_PREFABS.supplyDepot(600, -600, 'hub_supply'))
    };

    // 3. Aggregate Geometry & Entities (Zero-Alloc post-init)
    const finalWalls: PrefabWall[] = [...CORNER_BLOCKS, ...PERIMETER_WALLS];
    const finalEntities: ZoneEntityDef[] = [];

    // Flatten districts
    for (const d of Object.values(districts)) {
        finalWalls.push(...applyFrozenTexture(d.walls));
        finalEntities.push(...d.entities);
    }

    // Freeze Result to enforce immutability protocols
    return {
        walls: Object.freeze(finalWalls),
        entities: Object.freeze(finalEntities)
    };
})();

// 4. Manual Static Entities (Decorations not part of a prefab)
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
    { type: 'DECORATION', subType: 'GRAFFITI', x: 0, y: 800, data: { label: "SECTOR 9 ACCESS ↓", color: '#f59e0b', width: 400 } },
    { type: 'DECORATION', subType: 'GRAFFITI', x: 0, y: -650, data: { label: "TRANSIT DOCK 04", color: '#06b6d4', width: 300 } },

    // Lighting
    { type: 'DECORATION', subType: 'DYNAMIC_GLOW', x: 400, y: 100, data: { glowIntensity: 0.8 } }, 
    { type: 'DECORATION', subType: 'DYNAMIC_GLOW', x: -400, y: 100, data: { glowIntensity: 0.8 } }, 
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
  childZoneIds: ['SECTOR_9_N', 'HUB_TRAINING', 'MAGLEV_INTERIOR'],

  renderLayers: {
    floor: { zIndex: -1000 },
    walls: { zIndex: 0, sortBy: 'position' },
    roofs: { zIndex: 1000 },
    occluders: { zIndex: 2000, dynamic: true }
  },

  geometry: {
    // Reference frozen geometry cache
    walls: HUB_CACHE.walls as any[] // Cast required due to PrefabWall type alias nuance
  },

  entities: {
    static: [
        // Concatenate cached prefab entities with manual static ones
        ...HUB_CACHE.entities,
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
    playerStart: { x: 0, y: -720 },
    hasRiftgate: true
  }
};

// Phase 3: Freeze the entire zone export to prevent downstream mutations
Object.freeze(HUB_ZONE);
Object.freeze(HUB_ZONE.geometry);
Object.freeze(HUB_ZONE.entities);
