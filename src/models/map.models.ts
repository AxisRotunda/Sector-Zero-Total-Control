
import { ZoneTheme } from "./game.models";

export interface StaticWall {
    x: number;
    y: number;
    w: number;
    h: number;
    color?: string;
    type?: string; // e.g., 'BARRIER', 'GATE_SEGMENT'
    locked?: boolean;
    height?: number;
}

export interface StaticEntity {
    type: string;
    subType?: string;
    x: number;
    y: number;
    data?: any; // Extra props like dialogueId, loot, spawn info
}

export interface StaticExit {
    x: number;
    y: number;
    targetSector: string;
    direction: 'UP' | 'DOWN';
    locked?: boolean;
}

export interface SectorDefinition {
    id: string;
    name: string;
    theme: ZoneTheme;
    difficulty: number;
    weather: 'NONE' | 'RAIN' | 'ASH';
    floorPattern: 'PLAIN' | 'GRID' | 'HAZARD' | 'ORGANIC' | 'HUB';
    groundColor: string;
    wallColor: string;
    detailColor: string;
    
    // Layout
    walls: StaticWall[];
    entities: StaticEntity[];
    exits: StaticExit[];
    
    playerStart: { x: number, y: number };
    bounds: { minX: number, maxX: number, minY: number, maxY: number };
}
