
import { ZoneEntityDef } from "../../models/zone.models";

export const STRUCTURE_DIMENSIONS = {
    WALL_THICKNESS: 200,
    WALL_HEIGHT_OUTER: 400,
    WALL_HEIGHT_INNER: 300,
    PILLAR_HEIGHT: 380,
    GATE_WIDTH: 200,
    GATE_FLANK_OFFSET: 500,
    GATE_FLANK_WIDTH: 800,
    PILLAR_OFFSET_X: 120,
    PILLAR_WIDTH: 60,
    PILLAR_DEPTH: 220
};

export interface PrefabWall {
    x: number;
    y: number;
    w: number;
    h: number;
    height: number;
    color: string;
    type?: string;
    locked?: boolean;
    data?: any;
    subType?: string; // Explicit subtype for renderer dispatch
}

export interface PrefabResult {
    walls: PrefabWall[];
    entities: ZoneEntityDef[];
}

// Dimensions for the Transit Station
const STATION_DIMS = {
  TRAIN: { width: 800, height: 120, depth: 160 },
  BARRIER: { width: 200, depth: 20, height: 100 }
};

export const BUILDING_PREFABS = {
    
    transitStation: (x: number, y: number): PrefabResult => ({
        walls: [
            // Train Hull
            { x: x, y: y - 80, w: STATION_DIMS.TRAIN.width, h: STATION_DIMS.TRAIN.height, height: STATION_DIMS.TRAIN.depth, color: '#0ea5e9', type: 'MAGLEV_TRAIN' },
            // Platform Barriers
            { x: x - 300, y: y, w: STATION_DIMS.BARRIER.width, h: STATION_DIMS.BARRIER.depth, height: STATION_DIMS.BARRIER.height, color: '#ef4444', type: 'BARRIER', subType: 'BARRIER' },
            { x: x + 300, y: y, w: STATION_DIMS.BARRIER.width, h: STATION_DIMS.BARRIER.depth, height: STATION_DIMS.BARRIER.height, color: '#ef4444', type: 'BARRIER', subType: 'BARRIER' },
            { x: x, y: y, w: STATION_DIMS.BARRIER.width, h: STATION_DIMS.BARRIER.depth, height: STATION_DIMS.BARRIER.height, color: '#ef4444', type: 'BARRIER', subType: 'BARRIER' },
            // Roof Supports
            { x: x - 300, y: y + 100, w: 20, h: 20, height: 350, color: '#94a3b8' },
            { x: x + 300, y: y + 100, w: 20, h: 20, height: 350, color: '#94a3b8' },
            // Gates
            { x: x - 100, y: y + 200, w: 10, h: 40, height: 40, color: '#ef4444', type: 'BARRIER', subType: 'BARRIER' },
            { x: x + 100, y: y + 200, w: 10, h: 40, height: 40, color: '#ef4444', type: 'BARRIER', subType: 'BARRIER' },
            { x: x - 200, y: y + 200, w: 200, h: 10, height: 40, color: '#334155' },
            { x: x + 200, y: y + 200, w: 200, h: 10, height: 40, color: '#334155' },
        ],
        entities: [
            // Default Station Entities
            { id: `station_kiosk_w`, type: 'DECORATION', subType: 'INFO_KIOSK', x: x - 150, y: y + 100 },
            { id: `station_kiosk_e`, type: 'DECORATION', subType: 'INFO_KIOSK', x: x + 150, y: y + 100 },
            { type: 'DECORATION', subType: 'NEON', x: x, y: y + 100, data: { width: 600, height: 20, z: 300, color: '#bae6fd' } },
            // Entrance Trigger
            { 
                id: 'station_entrance',
                type: 'INTERACTABLE', 
                subType: 'ZONE_TRANSITION', 
                x: x, 
                y: y - 40, 
                data: { 
                  targetZone: 'MAGLEV_INTERIOR', 
                  promptText: 'BOARD MAGLEV', 
                  isTransition: true,
                  width: 120,
                  depth: 60
                } 
            }
        ]
    }),

    maglevCockpit: (x: number, y: number): PrefabResult => ({
        walls: [
          // Front viewport (Lower wall)
          { x: x, y: y - 60, w: 200, h: 20, height: 150, color: '#1e293b' },
          // Side walls
          { x: x - 110, y: y, w: 20, h: 120, height: 150, color: '#334155' },
          { x: x + 110, y: y, w: 20, h: 120, height: 150, color: '#334155' },
          // Control console base
          { x: x, y: y - 20, w: 120, h: 60, height: 80, color: '#0ea5e9' }
        ],
        entities: [
          { type: 'TERMINAL', x: x, y: y - 20, data: { 
            dialogueId: 'maglev_nav_system', 
            color: '#06b6d4', 
            promptText: 'NAV CONSOLE',
            width: 40, depth: 30, height: 50
          }},
          { type: 'DECORATION', subType: 'DYNAMIC_GLOW', x: x, y: y - 50, data: { 
            width: 180, depth: 20, z: 90, color: '#06b6d4', glowIntensity: 1.2 
          }},
          { type: 'NPC', subType: 'HANDLER', x: x - 40, y: y, data: {
            dialogueId: 'maglev_pilot',
            color: '#eab308',
            behavior: 'IDLE'
          }},
          // Pilot Locker
          { type: 'INTERACTABLE', subType: 'STASH', x: x + 50, y: y + 40, data: {
            promptText: 'PILOT LOCKER',
            lootTable: 'TOOLS',
            requiresLockpick: 2,
            isLocked: true,
            width: 30, height: 60, depth: 20, color: '#475569'
          }}
        ]
    }),
      
    maglevPassengerCar: (x: number, y: number, carId: string): PrefabResult => ({
        walls: [
          // Side walls
          { x: x - 110, y: y, w: 20, h: 200, height: 150, color: '#334155' },
          { x: x + 110, y: y, w: 20, h: 200, height: 150, color: '#334155' },
          // Seat rows (low walls)
          { x: x - 60, y: y - 60, w: 80, h: 30, height: 40, color: '#475569' },
          { x: x + 60, y: y - 60, w: 80, h: 30, height: 40, color: '#475569' },
          { x: x - 60, y: y + 60, w: 80, h: 30, height: 40, color: '#475569' },
          { x: x + 60, y: y + 60, w: 80, h: 30, height: 40, color: '#475569' }
        ],
        entities: [
          // Passengers (randomized)
          { type: 'NPC', subType: 'CITIZEN', x: x - 60, y: y - 60, data: { 
            dialogueId: 'passenger_gossip', behavior: 'IDLE', color: '#94a3b8' 
          }},
          { type: 'NPC', subType: 'CITIZEN', x: x + 60, y: y + 60, data: { 
            dialogueId: 'passenger_anxious', behavior: 'COWER', color: '#64748b' 
          }},
          // Window lights
          { type: 'DECORATION', subType: 'NEON', x: x - 120, y: y, data: { 
            z: 100, width: 20, height: 200, color: '#0ea5e9' 
          }},
          { type: 'DECORATION', subType: 'NEON', x: x + 120, y: y, data: { 
            z: 100, width: 20, height: 200, color: '#0ea5e9' 
          }},
          // Luggage
          { type: 'DECORATION', subType: 'CRATE', x: x, y: y - 90, data: { 
            width: 30, height: 25, depth: 20, color: '#3f3f46' 
          }},
          // Emergency Terminal (Car 1/2 logic handled by caller, but we add to all for now or check ID)
          carId === 'car1' ? {
            type: 'TERMINAL', x: x - 100, y: y, data: {
                dialogueId: 'emergency_broadcast',
                color: '#ef4444', 
                promptText: 'EMERGENCY FEED',
                width: 30, depth: 20, height: 40,
                renderStyle: 'CUSTOM' // Screen
            }
          } : {
            // Hidden Loot in Car 2
            type: 'INTERACTABLE', subType: 'STASH', x: x + 60, y: y - 90, data: {
                promptText: 'SEARCH LUGGAGE',
                lootTable: 'CONTRABAND',
                width: 20, height: 20, depth: 20, color: '#a1a1aa'
            }
          },
          // Notice Board
          { type: 'DECORATION', subType: 'HOLO_SIGN', x: x, y: y - 95, data: {
             width: 60, depth: 5, height: 30, z: 100, label: 'EVAC ROUTE', color: '#fbbf24'
          }},
          // Propaganda
          { type: 'DECORATION', subType: 'BANNER', x: x - 110, y: y + 50, data: {
             width: 40, depth: 2, height: 60, z: 90, color: '#3b82f6'
          }}
        ]
    }),
      
    maglevCargoBay: (x: number, y: number): PrefabResult => ({
        walls: [
          // Wider walls for cargo space
          { x: x - 140, y: y, w: 20, h: 250, height: 150, color: '#334155' },
          { x: x + 140, y: y, w: 20, h: 250, height: 150, color: '#334155' },
          // Cargo containers
          { x: x - 60, y: y - 80, w: 60, h: 60, height: 80, color: '#854d0e' },
          { x: x + 60, y: y - 80, w: 60, h: 60, height: 80, color: '#854d0e' },
          { x: x, y: y + 80, w: 100, h: 50, height: 70, color: '#3f3f46' }
        ],
        entities: [
          { type: 'INTERACTABLE', subType: 'STASH', x: x, y: y + 80, data: {
            promptText: 'INSPECT CARGO'
          }},
          { type: 'NPC', subType: 'GUARD', x: x, y: y - 100, data: {
            dialogueId: 'cargo_guard',
            color: '#3b82f6',
            behavior: 'PATROL',
            patrolPoints: [
              { x: x, y: y - 100 },
              { x: x, y: y + 100 }
            ],
            detectionRadius: 150,
            alertBehavior: 'CONFRONT'
          }},
          { type: 'DECORATION', subType: 'BARREL', x: x - 80, y: y, data: { marking: 'BIOHAZARD', color: '#f59e0b' } },
          { type: 'DECORATION', subType: 'BARREL', x: x + 80, y: y, data: {} },
          // Manifest Terminal
          { type: 'TERMINAL', x: x + 80, y: y + 60, data: {
            dialogueId: 'cargo_manifest',
            color: '#eab308',
            promptText: 'CARGO MANIFEST',
            width: 30, depth: 20, height: 35
          }},
          // Hazmat Crate
          { type: 'DECORATION', subType: 'CRATE', x: x - 100, y: y - 50, data: {
             width: 40, depth: 40, height: 50, color: '#f59e0b'
          }}
        ]
    }),

    medBay: (x: number, y: number): PrefabResult => ({
        walls: [
            { x: x, y: y, w: 20, h: 300, height: 120, color: '#52525b' },
            { x: x + 50, y: y - 50, w: 80, h: 80, height: 20, color: '#18181b' }
        ],
        entities: [
            { type: 'NPC', subType: 'MEDIC', x: x + 50, y: y, data: { dialogueId: 'medic_hub_main', color: '#ef4444' } },
            { type: 'DECORATION', subType: 'HOLO_TABLE', x: x + 50, y: y - 50, data: { color: '#ef4444' } },
            { type: 'DECORATION', subType: 'NEON', x: x - 20, y: y - 100, data: { z: 120, color: '#ef4444', width: 40, height: 40 } }
        ]
    }),

    shop: (x: number, y: number): PrefabResult => ({
        walls: [
            { x: x, y: y, w: 60, h: 60, height: 150, color: '#52525b', type: 'PILLAR', subType: 'PILLAR' }
        ],
        entities: [
            { type: 'NPC', subType: 'TRADER', x: x - 50, y: y, data: { dialogueId: 'generic', color: '#eab308' } },
            { type: 'DECORATION', subType: 'VENDING_MACHINE', x: x - 50, y: y - 80, data: {} },
            { type: 'DECORATION', subType: 'NEON', x: x, y: y, data: { z: 160, color: '#eab308', width: 60, height: 20 } }
        ]
    }),

    spire: (x: number, y: number): PrefabResult => ({
        walls: [
            { x: x, y: y, w: 200, h: 200, height: 600, color: '#06b6d4', type: 'MONOLITH', subType: 'MONOLITH' }
        ],
        entities: [
            { type: 'DECORATION', subType: 'CABLE', x: x, y: y, data: { targetX: x + 650, targetY: y + 300, z: 400 } },
            { type: 'DECORATION', subType: 'CABLE', x: x, y: y, data: { targetX: x - 650, targetY: y + 500, z: 400 } },
            { type: 'DECORATION', subType: 'DYNAMIC_GLOW', x: x, y: y - 120, data: { z: 10, color: '#06b6d4', width: 100, depth: 20 } }
        ]
    }),

    gateAssembly: (y: number, locked: boolean = true): PrefabResult => {
        const D = STRUCTURE_DIMENSIONS;
        const cellX = 300;
        const cellY = y - 150;
        const cellSize = 120;
        const cellHalf = cellSize / 2;
        const wallThick = 20;

        const walls: PrefabWall[] = [
            { x: -D.GATE_FLANK_OFFSET, y: y, w: D.GATE_FLANK_WIDTH, h: D.WALL_THICKNESS, height: 350, color: '#18181b' },
            { x: D.GATE_FLANK_OFFSET, y: y, w: D.GATE_FLANK_WIDTH, h: D.WALL_THICKNESS, height: 350, color: '#18181b' },
            { x: 0, y: y, w: D.GATE_WIDTH, h: 60, height: 300, color: '#3f3f46', type: 'GATE_SEGMENT', subType: 'GATE_SEGMENT', locked: locked },
            { x: -D.PILLAR_OFFSET_X, y: y, w: D.PILLAR_WIDTH, h: D.PILLAR_DEPTH, height: D.PILLAR_HEIGHT, color: '#52525b', type: 'PILLAR', subType: 'PILLAR' },
            { x: D.PILLAR_OFFSET_X, y: y, w: D.PILLAR_WIDTH, h: D.PILLAR_DEPTH, height: D.PILLAR_HEIGHT, color: '#52525b', type: 'PILLAR', subType: 'PILLAR' },
            { x: -200, y: y - 160, w: 100, h: 20, height: 200, color: '#3f3f46' },
            { x: -260, y: y - 120, w: 20, h: 100, height: 200, color: '#3f3f46' },
            { x: -140, y: y - 120, w: 20, h: 100, height: 200, color: '#3f3f46' },
            { x: -200, y: y - 120, w: 140, h: 100, height: 20, color: '#27272a', data: { z: 200 } },
            { x: cellX, y: cellY - cellHalf, w: cellSize, h: wallThick, height: 180, color: '#3f3f46' },
            { x: cellX - cellHalf, y: cellY, w: wallThick, h: cellSize, height: 180, color: '#3f3f46' },
            { x: cellX, y: cellY + cellHalf, w: cellSize, h: wallThick, height: 20, color: '#27272a' },
            { x: cellX + cellHalf, y: cellY, w: wallThick, h: cellSize, height: 20, color: '#27272a' },
        ];

        const entities: ZoneEntityDef[] = [
            { type: 'NPC', subType: 'GUARD', x: -200, y: y - 120, data: { dialogueId: 'gate_locked', color: '#3b82f6' } },
            { type: 'DECORATION', subType: 'NEON', x: -D.PILLAR_OFFSET_X, y: y, data: { z: 300, color: '#ef4444', width: 20, height: 40 } },
            { type: 'DECORATION', subType: 'NEON', x: D.PILLAR_OFFSET_X, y: y, data: { z: 300, color: '#ef4444', width: 20, height: 40 } },
            { type: 'DECORATION', subType: 'BARRIER', x: cellX, y: cellY + cellHalf, data: { width: cellSize, height: 150, color: '#ef4444' } },
            { type: 'DECORATION', subType: 'BARRIER', x: cellX + cellHalf, y: cellY, data: { width: 20, depth: cellSize, height: 150, color: '#ef4444' } },
            { type: 'NPC', subType: 'CITIZEN', x: cellX, y: cellY, data: { dialogueId: 'prisoner_bark', behavior: 'COWER', color: '#f97316' } },
            { type: 'NPC', subType: 'CITIZEN', x: -350, y: y - 200, data: { dialogueId: 'refugee_context', behavior: 'COWER', color: '#a1a1aa' } },
            { type: 'NPC', subType: 'CITIZEN', x: -320, y: y - 250, data: { dialogueId: 'citizen_bark', behavior: 'IDLE', color: '#a1a1aa' } },
            { type: 'DECORATION', subType: 'CRATE', x: -370, y: y - 210, data: { width: 20, height: 15, depth: 10, color: '#854d0e' } },
            { type: 'DECORATION', subType: 'CRATE', x: -300, y: y - 260, data: { width: 25, height: 20, depth: 15, color: '#3f3f46' } }
        ];

        return { walls, entities };
    },

    trainingChamber: (x: number, y: number): PrefabResult => {
        const wallColor = '#3f3f46';
        const accentColor = '#27272a';
        return {
            walls: [
                { x: x, y: y - 170, w: 500, h: 60, height: 350, color: wallColor, type: 'TRAINING_EXTERIOR', subType: 'TRAINING_EXTERIOR' },
                { x: x - 220, y: y + 30, w: 60, h: 340, height: 350, color: wallColor, type: 'TRAINING_EXTERIOR', subType: 'TRAINING_EXTERIOR' },
                { x: x + 220, y: y + 30, w: 60, h: 340, height: 350, color: wallColor, type: 'TRAINING_EXTERIOR', subType: 'TRAINING_EXTERIOR' },
                { x: x - 150, y: y + 200, w: 80, h: 20, height: 350, color: wallColor },
                { x: x + 150, y: y + 200, w: 80, h: 20, height: 350, color: wallColor },
                { x: x, y: y - 130, w: 140, h: 20, height: 120, color: accentColor },
                { x: x, y: y, w: 300, h: 10, height: 5, color: '#06b6d4', type: 'DYNAMIC_GLOW', subType: 'DYNAMIC_GLOW', data: { glowIntensity: 0.4, pulseSpeed: 1.5 } }
            ],
            entities: [
                { type: 'INTERACTABLE', subType: 'ZONE_TRANSITION', x: x, y: y - 100, data: { targetZone: 'HUB_TRAINING', promptText: 'ENTER SIMULATION', isTransition: true } }
            ]
        };
    },

    livingQuarters: (x: number, y: number, color: string, idPrefix: string = 'barracks'): PrefabResult => {
        const walls: PrefabWall[] = [
            { x: x, y: y - 120, w: 300, h: 20, height: 250, color: color },
            { x: x, y: y + 120, w: 300, h: 20, height: 250, color: color },
            { x: x - 160, y: y - 60, w: 20, h: 120, height: 250, color: color },
            { x: x - 160, y: y + 60, w: 20, h: 120, height: 250, color: color }
        ];
        const entities: ZoneEntityDef[] = [];
        let ctr = 0;
        for(let i = -1; i <= 1; i++) {
            const bx = x - 80 + (i * 80);
            entities.push({ id: `${idPrefix}_bed_${ctr}`, type: 'DECORATION', subType: 'BED', x: bx, y: y - 80, data: { color: '#3f3f46' } });
            entities.push({ id: `${idPrefix}_locker_${ctr}`, type: 'DECORATION', subType: 'LOCKER', x: bx, y: y - 110, data: { color: '#52525b' } });
            ctr++;
            entities.push({ id: `${idPrefix}_bed_${ctr}`, type: 'DECORATION', subType: 'BED', x: bx, y: y + 80, data: { color: '#3f3f46' } });
            entities.push({ id: `${idPrefix}_locker_${ctr}`, type: 'DECORATION', subType: 'LOCKER', x: bx, y: y + 110, data: { color: '#52525b' } });
            ctr++;
        }
        entities.push({ id: `${idPrefix}_sleeper`, type: 'NPC', subType: 'CITIZEN', x: x, y: y + 80, data: { behavior: 'IDLE', color: '#94a3b8' } });
        entities.push({ type: 'DECORATION', subType: 'RUG', x: x, y: y, data: { width: 320, height: 260, color: '#1e293b' } });
        return { walls, entities };
    },

    messHall: (x: number, y: number, color: string, idPrefix: string = 'mess'): PrefabResult => {
        const walls: PrefabWall[] = [
            { x: x, y: y - 100, w: 250, h: 20, height: 250, color: color },
            { x: x - 135, y: y, w: 20, h: 220, height: 250, color: color },
        ];
        const entities: ZoneEntityDef[] = [];
        entities.push({ id: `${idPrefix}_table_1`, type: 'DECORATION', subType: 'TABLE', x: x - 50, y: y - 40, data: {} });
        entities.push({ id: `${idPrefix}_table_2`, type: 'DECORATION', subType: 'TABLE', x: x + 50, y: y - 40, data: {} });
        entities.push({ id: `${idPrefix}_table_3`, type: 'DECORATION', subType: 'TABLE', x: x, y: y + 40, data: {} });
        entities.push({ id: `${idPrefix}_vending_1`, type: 'DECORATION', subType: 'VENDING_MACHINE', x: x + 100, y: y - 90, data: {} });
        entities.push({ id: `${idPrefix}_vending_2`, type: 'DECORATION', subType: 'VENDING_MACHINE', x: x + 60, y: y - 90, data: {} });
        entities.push({ id: `${idPrefix}_eater_1`, type: 'NPC', subType: 'CITIZEN', x: x - 50, y: y - 60, data: { behavior: 'IDLE', color: '#a1a1aa' } });
        entities.push({ id: `${idPrefix}_eater_2`, type: 'NPC', subType: 'CITIZEN', x: x, y: y + 60, data: { behavior: 'IDLE', color: '#64748b' } });
        entities.push({ type: 'DECORATION', subType: 'RUG', x: x, y: y, data: { width: 280, height: 240, color: '#27272a' } });
        return { walls, entities };
    },

    supplyDepot: (x: number, y: number, idPrefix: string = 'supply'): PrefabResult => {
        const walls: PrefabWall[] = [
            { x: x, y: y, w: 200, h: 100, height: 250, color: '#3f3f46' }
        ];
        const entities: ZoneEntityDef[] = [
            { id: `${idPrefix}_crate_1`, type: 'DECORATION', subType: 'CRATE', x: x - 60, y: y + 30, data: { width: 50, height: 50, depth: 50 } },
            { id: `${idPrefix}_crate_stack`, type: 'DECORATION', subType: 'CRATE', x: x - 60, y: y + 80, data: { width: 50, height: 50, depth: 50 } }, 
            { id: `${idPrefix}_barrel_1`, type: 'DECORATION', subType: 'BARREL', x: x + 50, y: y + 40, data: {} },
            { id: `${idPrefix}_barrel_2`, type: 'DECORATION', subType: 'BARREL', x: x + 80, y: y + 30, data: {} },
            { id: `${idPrefix}_barrel_3`, type: 'DECORATION', subType: 'BARREL', x: x + 60, y: y + 60, data: {} },
            { type: 'DECORATION', subType: 'TRASH', x: x, y: y + 100, data: { width: 200, depth: 100 } }
        ];
        return { walls, entities };
    }
};
