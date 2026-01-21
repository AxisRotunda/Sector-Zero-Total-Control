
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
            // Use the new, clean rectangular fortress generation
            ...MapUtils.createFortress(1200, 80, 400, '#27272a'),
            
            // The Central Spire
            { x: 0, y: -400, w: 250, h: 250, height: 800, color: '#06b6d4', type: 'MONOLITH' },
            
            // The Main Gate
            { x: 0, y: 1200, w: 400, h: 60, height: 350, color: '#3f3f46', type: 'GATE_SEGMENT', locked: true },
            
            // Med Bay Enclosure
            { x: 900, y: 0, w: 20, h: 600, height: 150, color: '#52525b' }, 
            
            // Market Pillars
            { x: -900, y: -300, w: 60, h: 60, height: 200, color: '#52525b', type: 'PILLAR' },
            { x: -900, y: 300, w: 60, h: 60, height: 200, color: '#52525b', type: 'PILLAR' },
        ],
        entities: [
            // NPCs
            { type: 'NPC', subType: 'HANDLER', x: 0, y: -200, data: { dialogueId: 'start_1', color: '#3b82f6' } },
            { type: 'NPC', subType: 'CONSOLE', x: -120, y: -200, data: { dialogueId: 'start_1', color: '#06b6d4' } },
            { type: 'NPC', subType: 'GUARD', x: 250, y: 1100, data: { dialogueId: 'gate_locked', color: '#3b82f6' } },
            { type: 'NPC', subType: 'MEDIC', x: 1050, y: 0, data: { dialogueId: 'medic_intro', color: '#ef4444' } },
            { type: 'NPC', subType: 'TRADER', x: -1050, y: 0, data: { dialogueId: 'generic', color: '#eab308' } },
            
            // Zones
            { type: 'DECORATION', subType: 'RUG', x: 1050, y: 0, data: { width: 300, height: 600, color: '#e2e8f0' } }, 
            { type: 'DECORATION', subType: 'RUG', x: -1050, y: 0, data: { width: 300, height: 600, color: '#1c1917' } },
            
            // Cables
            { type: 'DECORATION', subType: 'CABLE', x: 0, y: -400, data: { targetX: 1050, targetY: -200, z: 500 } },
            { type: 'DECORATION', subType: 'CABLE', x: 0, y: -400, data: { targetX: -1050, targetY: -200, z: 450 } },
            
            // Flavor
            { type: 'DECORATION', subType: 'VENDING_MACHINE', x: -1200, y: -100 },
            { type: 'DECORATION', subType: 'TRASH', x: -1000, y: 200 },
            { type: 'DECORATION', subType: 'HOLO_TABLE', x: 0, y: 400, data: { color: '#06b6d4' } },
        ],
        exits: [
            { x: 0, y: 1300, targetSector: 'SECTOR_9', direction: 'DOWN', locked: true, transitionType: 'GATE' }
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
            { x: -300, y: 0, w: 20, h: 2000, height: 150, color: '#44403c' },
            { x: 300, y: 0, w: 20, h: 2000, height: 150, color: '#44403c' },
            { x: -800, y: 1000, w: 500, h: 20, height: 150, color: '#44403c' },
            { x: 800, y: 1000, w: 500, h: 20, height: 150, color: '#44403c' },
        ],
        entities: [
            { type: 'DECORATION', subType: 'RUG', x: 0, y: 500, data: { width: 580, height: 1000, color: '#292524' } },
            { type: 'SPAWNER', subType: 'SPAWN_NODE', x: 0, y: 600, data: { spawnType: 'GRUNT', spawnMax: 3, spawnCooldown: 400 } },
            { type: 'DESTRUCTIBLE', subType: 'CRATE', x: -200, y: 300 },
        ],
        exits: [
            { x: 0, y: -100, targetSector: 'HUB', direction: 'UP' },
            { x: 0, y: 2000, targetSector: 'SECTOR_2', direction: 'DOWN' }
        ]
    }
};
