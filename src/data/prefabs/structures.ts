
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
}

export interface PrefabResult {
    walls: PrefabWall[];
    entities: ZoneEntityDef[];
}

export const BUILDING_PREFABS = {
    
    medBay: (x: number, y: number): PrefabResult => ({
        walls: [
            { x: x, y: y, w: 20, h: 300, height: 120, color: '#52525b' }
        ],
        entities: [
            { type: 'NPC', subType: 'MEDIC', x: x + 50, y: y, data: { dialogueId: 'medic_intro', color: '#ef4444' } },
            { type: 'DECORATION', subType: 'HOLO_TABLE', x: x + 50, y: y - 50, data: { color: '#ef4444' } },
            // Added Sign
            { type: 'DECORATION', subType: 'NEON', x: x - 20, y: y - 100, data: { z: 120, color: '#ef4444', width: 40, height: 40 } }
        ]
    }),

    shop: (x: number, y: number): PrefabResult => ({
        walls: [
            { x: x, y: y, w: 60, h: 60, height: 150, color: '#52525b', type: 'PILLAR' }
        ],
        entities: [
            { type: 'NPC', subType: 'TRADER', x: x - 50, y: y, data: { dialogueId: 'generic', color: '#eab308' } },
            { type: 'DECORATION', subType: 'VENDING_MACHINE', x: x - 50, y: y - 80, data: {} },
            // Added Sign
            { type: 'DECORATION', subType: 'NEON', x: x, y: y, data: { z: 160, color: '#eab308', width: 60, height: 20 } }
        ]
    }),

    spire: (x: number, y: number): PrefabResult => ({
        walls: [
            { x: x, y: y, w: 200, h: 200, height: 600, color: '#06b6d4', type: 'MONOLITH' }
        ],
        entities: [
            { type: 'DECORATION', subType: 'CABLE', x: x, y: y, data: { targetX: x + 650, targetY: y + 300, z: 400 } },
            { type: 'DECORATION', subType: 'CABLE', x: x, y: y, data: { targetX: x - 650, targetY: y + 500, z: 400 } },
            // Base lights
            { type: 'DECORATION', subType: 'DYNAMIC_GLOW', x: x, y: y - 120, data: { z: 10, color: '#06b6d4', width: 100, depth: 20 } }
        ]
    }),

    gateAssembly: (y: number, locked: boolean = true): PrefabResult => {
        const D = STRUCTURE_DIMENSIONS;
        const walls: PrefabWall[] = [
            // Left Flank
            { x: -D.GATE_FLANK_OFFSET, y: y, w: D.GATE_FLANK_WIDTH, h: D.WALL_THICKNESS, height: 350, color: '#18181b' },
            // Right Flank
            { x: D.GATE_FLANK_OFFSET, y: y, w: D.GATE_FLANK_WIDTH, h: D.WALL_THICKNESS, height: 350, color: '#18181b' },
            // Mechanism (Center)
            { x: 0, y: y, w: D.GATE_WIDTH, h: 60, height: 300, color: '#3f3f46', type: 'GATE_SEGMENT', locked: locked },
            // Pillars
            { x: -D.PILLAR_OFFSET_X, y: y, w: D.PILLAR_WIDTH, h: D.PILLAR_DEPTH, height: D.PILLAR_HEIGHT, color: '#52525b', type: 'PILLAR' },
            { x: D.PILLAR_OFFSET_X, y: y, w: D.PILLAR_WIDTH, h: D.PILLAR_DEPTH, height: D.PILLAR_HEIGHT, color: '#52525b', type: 'PILLAR' },
            
            // Guard Booth (Left of Gate)
            // Back Wall
            { x: -200, y: y - 160, w: 100, h: 20, height: 200, color: '#3f3f46' },
            // Left Side
            { x: -260, y: y - 120, w: 20, h: 100, height: 200, color: '#3f3f46' },
            // Right Side
            { x: -140, y: y - 120, w: 20, h: 100, height: 200, color: '#3f3f46' },
            // Roof Slab (data.z indicates vertical offset for future advanced renderers)
            { x: -200, y: y - 120, w: 140, h: 100, height: 20, color: '#27272a', data: { z: 200 } } 
        ];

        const entities: ZoneEntityDef[] = [
            { type: 'NPC', subType: 'GUARD', x: -200, y: y - 120, data: { dialogueId: 'gate_locked', color: '#3b82f6' } },
            // Added Lights on gate pillars
            { type: 'DECORATION', subType: 'NEON', x: -D.PILLAR_OFFSET_X, y: y, data: { z: 300, color: '#ef4444', width: 20, height: 40 } },
            { type: 'DECORATION', subType: 'NEON', x: D.PILLAR_OFFSET_X, y: y, data: { z: 300, color: '#ef4444', width: 20, height: 40 } }
        ];

        return { walls, entities };
    },

    trainingChamber: (x: number, y: number): PrefabResult => {
        const wallColor = '#3f3f46';
        const accentColor = '#27272a';
        
        return {
            walls: [
                // Redesigned to be a U-shaped enterable room
                // Back Wall
                { x: x, y: y - 170, w: 500, h: 60, height: 350, color: wallColor, type: 'TRAINING_EXTERIOR' },
                // Left Wall
                { x: x - 220, y: y + 30, w: 60, h: 340, height: 350, color: wallColor, type: 'TRAINING_EXTERIOR' },
                // Right Wall
                { x: x + 220, y: y + 30, w: 60, h: 340, height: 350, color: wallColor, type: 'TRAINING_EXTERIOR' },
                
                // Entrance Columns
                { x: x - 150, y: y + 200, w: 80, h: 20, height: 350, color: wallColor },
                { x: x + 150, y: y + 200, w: 80, h: 20, height: 350, color: wallColor },

                // Interior Terminal Stand
                { x: x, y: y - 130, w: 140, h: 20, height: 120, color: accentColor },
                
                // Floor Strip
                {
                    x: x, y: y, 
                    w: 300, h: 10,
                    height: 5,
                    color: '#06b6d4',
                    type: 'DYNAMIC_GLOW',
                    data: { glowIntensity: 0.4, pulseSpeed: 1.5 }
                }
            ],
            entities: [
                // Zone transition (Inside the room)
                {
                    type: 'INTERACTABLE',
                    subType: 'ZONE_TRANSITION',
                    x: x,
                    y: y - 100,
                    data: {
                        targetZone: 'HUB_TRAINING',
                        promptText: 'ENTER SIMULATION',
                        isTransition: true
                    }
                }
            ]
        };
    }
};
