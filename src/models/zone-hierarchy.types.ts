
import { ZoneTemplate } from "./zone.models";

export interface ZoneNode {
    id: string;
    config: ZoneTemplate;
    parentId?: string;
    childrenIds: string[];
}

export interface HierarchicalExit {
    targetZoneId: string;
    spawnPoint?: { x: number, y: number };
    transitionType: 'GATE' | 'PORTAL' | 'WALK';
}

export interface ZonePath {
    path: string[]; // [HUB, SECTOR_9_N, DUNGEON_A]
    depth: number;
}
