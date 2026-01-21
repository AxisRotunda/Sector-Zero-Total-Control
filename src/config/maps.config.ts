
import { SectorDefinition } from '../models/map.models';
import { MapUtils } from '../utils/map-utils';

export const SECTOR_SEQUENCE = ['HUB', 'SECTOR_1', 'SECTOR_2', 'SECTOR_3'];

export const SECTORS: Record<string, SectorDefinition> = {
    'HUB': {
        id: 'HUB',
        name: 'Liminal Citadel',
        theme: 'INDUSTRIAL',
        difficulty: 1.0,
        weather: 'ASH',
        floorPattern: 'HUB',
        groundColor: '#09090b',
        wallColor: '#27272a',
        detailColor: '#06b6d4',
        playerStart: { x: 0, y: 800 },
        bounds: { minX: -2000, maxX: 2000, minY: -2000, maxY: 2000 },
        walls: [
            // Brighter wall color for visibility
            ...MapUtils.createOctagon(1200, 40, 300, '#3f3f46'),
            // Spire
            { x: 0, y: -300, w: 180, h: 180, height: 400, color: '#06b6d4', type: 'MONOLITH' },
            // Gate
            { x: 0, y: -1100, w: 400, h: 20, height: 250, color: '#334155', type: 'GATE_SEGMENT', locked: true },
            // Med Bay Walls
            { x: 800, y: -200, w: 400, h: 20, height: 100, color: '#94a3b8' },
        ],
        entities: [
            { type: 'NPC', subType: 'HANDLER', x: 0, y: -150, data: { dialogueId: 'start_1', color: '#3b82f6' } },
            { type: 'NPC', subType: 'CONSOLE', x: -80, y: -150, data: { dialogueId: 'start_1', color: '#06b6d4' } },
            { type: 'NPC', subType: 'GUARD', x: 150, y: -1020, data: { dialogueId: 'gate_locked', color: '#3b82f6' } },
            { type: 'NPC', subType: 'MEDIC', x: 800, y: -50, data: { dialogueId: 'medic_intro', color: '#ef4444' } },
            { type: 'NPC', subType: 'TRADER', x: -800, y: -50, data: { dialogueId: 'generic', color: '#eab308' } },
            { type: 'DECORATION', subType: 'RUG', x: 800, y: 0, data: { width: 400, height: 400, color: '#e2e8f0' } }, // Med Rug
            { type: 'DECORATION', subType: 'RUG', x: -800, y: 0, data: { width: 400, height: 400, color: '#1c1917' } }, // Market Rug
            { type: 'DECORATION', subType: 'CABLE', x: 0, y: -300, data: { targetX: 800, targetY: -200, z: 300 } },
            { type: 'DECORATION', subType: 'CABLE', x: 0, y: -300, data: { targetX: -800, targetY: -200, z: 280 } },
            { type: 'DECORATION', subType: 'VENDING_MACHINE', x: -900, y: -100 },
            { type: 'DECORATION', subType: 'TRASH', x: -700, y: 50 },
            { type: 'DECORATION', subType: 'TRASH', x: -850, y: 150 },
        ],
        exits: [
            { x: 0, y: -1200, targetSector: 'SECTOR_1', direction: 'DOWN', locked: true }
        ]
    },
    'SECTOR_1': {
        id: 'SECTOR_1',
        name: 'The Slag Heaps',
        theme: 'INDUSTRIAL',
        difficulty: 1.5,
        weather: 'NONE',
        floorPattern: 'HAZARD',
        groundColor: '#1c1917',
        wallColor: '#44403c',
        detailColor: '#78350f',
        playerStart: { x: 0, y: 0 },
        bounds: { minX: -2000, maxX: 2000, minY: -3000, maxY: 3000 },
        walls: [
            // Long Corridor
            { x: -300, y: 0, w: 20, h: 2000, height: 150, color: '#44403c' },
            { x: 300, y: 0, w: 20, h: 2000, height: 150, color: '#44403c' },
            // Cross room at y=1000
            { x: -800, y: 1000, w: 500, h: 20, height: 150, color: '#44403c' },
            { x: 800, y: 1000, w: 500, h: 20, height: 150, color: '#44403c' },
        ],
        entities: [
            { type: 'DECORATION', subType: 'RUG', x: 0, y: 500, data: { width: 580, height: 1000, color: '#292524' } },
            // Spawners
            { type: 'SPAWNER', subType: 'SPAWN_NODE', x: 0, y: 600, data: { spawnType: 'GRUNT', spawnMax: 3, spawnCooldown: 400 } },
            { type: 'SPAWNER', subType: 'SPAWN_NODE', x: 0, y: 1200, data: { spawnType: 'STALKER', spawnMax: 2, spawnCooldown: 600 } },
            // Loot
            { type: 'DESTRUCTIBLE', subType: 'CRATE', x: -200, y: 300 },
            { type: 'DESTRUCTIBLE', subType: 'BARREL', x: 200, y: 800 },
            // Decoration
            { type: 'DECORATION', subType: 'VENT', x: -280, y: 200 },
            { type: 'DECORATION', subType: 'VENT', x: 280, y: 600 },
        ],
        exits: [
            { x: 0, y: -100, targetSector: 'HUB', direction: 'UP' },
            { x: 0, y: 2000, targetSector: 'SECTOR_2', direction: 'DOWN' }
        ]
    }
};
