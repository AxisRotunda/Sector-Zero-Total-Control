
import { ZoneEntityDef } from "../../models/zone.models";

// Phase 1: Semantic Extraction
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

export interface PrefabResult {
    walls: any[];
    entities: ZoneEntityDef[];
}

// Phase 3: Modular Composition
export const BUILDING_PREFABS = {
    
    medBay: (x: number, y: number): PrefabResult => ({
        walls: [
            { x: x, y: y, w: 20, h: 300, height: 120, color: '#52525b' }
        ],
        entities: [
            { type: 'NPC', subType: 'MEDIC', x: x + 50, y: y, data: { dialogueId: 'medic_intro', color: '#ef4444' } },
            { type: 'DECORATION', subType: 'HOLO_TABLE', x: x + 50, y: y - 50, data: { color: '#ef4444' } }
        ]
    }),

    shop: (x: number, y: number): PrefabResult => ({
        walls: [
            { x: x, y: y, w: 60, h: 60, height: 150, color: '#52525b', type: 'PILLAR' }
        ],
        entities: [
            { type: 'NPC', subType: 'TRADER', x: x - 50, y: y, data: { dialogueId: 'generic', color: '#eab308' } },
            { type: 'DECORATION', subType: 'VENDING_MACHINE', x: x - 50, y: y - 80, data: {} }
        ]
    }),

    spire: (x: number, y: number): PrefabResult => ({
        walls: [
            { x: x, y: y, w: 200, h: 200, height: 600, color: '#06b6d4', type: 'MONOLITH' }
        ],
        entities: [
            { type: 'DECORATION', subType: 'CABLE', x: x, y: y, data: { targetX: x + 650, targetY: y + 300, z: 400 } },
            { type: 'DECORATION', subType: 'CABLE', x: x, y: y, data: { targetX: x - 650, targetY: y + 500, z: 400 } }
        ]
    }),

    gateAssembly: (y: number, locked: boolean = true): PrefabResult => {
        const D = STRUCTURE_DIMENSIONS;
        const walls = [
            // Left Flank
            { x: -D.GATE_FLANK_OFFSET, y: y, w: D.GATE_FLANK_WIDTH, h: D.WALL_THICKNESS, height: 350, color: '#18181b' },
            // Right Flank
            { x: D.GATE_FLANK_OFFSET, y: y, w: D.GATE_FLANK_WIDTH, h: D.WALL_THICKNESS, height: 350, color: '#18181b' },
            // Mechanism (Center)
            { x: 0, y: y, w: D.GATE_WIDTH, h: 60, height: 300, color: '#3f3f46', type: 'GATE_SEGMENT', locked: locked },
            // Pillars
            { x: -D.PILLAR_OFFSET_X, y: y, w: D.PILLAR_WIDTH, h: D.PILLAR_DEPTH, height: D.PILLAR_HEIGHT, color: '#52525b', type: 'PILLAR' },
            { x: D.PILLAR_OFFSET_X, y: y, w: D.PILLAR_WIDTH, h: D.PILLAR_DEPTH, height: D.PILLAR_HEIGHT, color: '#52525b', type: 'PILLAR' }
        ];

        const entities: ZoneEntityDef[] = [
            { type: 'NPC', subType: 'GUARD', x: -200, y: y - 100, data: { dialogueId: 'gate_locked', color: '#3b82f6' } }
        ];

        return { walls, entities };
    },

    trainingChamber: (x: number, y: number): PrefabResult => {
        return {
            walls: [
                // Main containment structure (brutalist block)
                { 
                    x, y, 
                    w: 500, h: 400, depth: 400, 
                    height: 350, 
                    color: '#3f3f46', 
                    type: 'TRAINING_EXTERIOR'
                },
                // Entrance alcove (recessed door frame)
                { 
                    x, y: y + 150, 
                    w: 140, h: 100, depth: 100, 
                    height: 320, 
                    color: '#27272a' 
                },
                // Cyan neon accent strip (glows when player inside)
                {
                    x, y: y + 120,
                    w: 500, h: 10, depth: 10,
                    height: 340,
                    color: '#06b6d4',
                    type: 'DYNAMIC_GLOW',
                    data: { 
                        glowIntensity: 0.6,
                        pulseSpeed: 2.0,
                        activeColor: '#a855f7' // Changes when isPlayerInTraining = true
                    }
                }
            ],
            entities: [
                // Zone transition door
                {
                    type: 'INTERACTABLE', // Custom type mapping to EXIT logic via data
                    subType: 'ZONE_TRANSITION',
                    x: x,
                    y: y + 180,
                    data: {
                        targetZone: 'HUB_TRAINING',
                        spawnPoint: 'chamber_entrance', // Handled via spawn point logic
                        promptText: 'Access Neural Simulation',
                        isTransition: true
                    }
                }
            ]
        };
    }
};
