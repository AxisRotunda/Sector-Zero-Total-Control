
import { ZoneTheme } from "./game.models";

export interface ZoneBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ZoneGeometry {
  walls: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    height?: number;
    color?: string;
    type?: string;
    locked?: boolean;
    depth?: number;
    data?: any;
  }>;
}

export interface ZoneEntityDef {
  type: 'NPC' | 'ENEMY' | 'DECORATION' | 'SPAWNER' | 'DESTRUCTIBLE' | 'TERMINAL' | 'INTERACTABLE';
  subType?: string;
  x: number;
  y: number;
  z?: number;
  data?: any; // Extra props like dialogueId, loot, spawn info
}

export interface ZoneExit {
  x: number;
  y: number;
  targetZoneId: string;
  direction?: 'UP' | 'DOWN'; // Deprecated in favor of generic transition
  transitionType?: 'GATE' | 'PORTAL' | 'WALK';
  locked?: boolean;
}

export interface RenderLayerConfig {
  zIndex: number;
  sortBy?: 'position' | 'y';
  dynamic?: boolean;
}

export interface ZoneTemplate {
  id: string;
  name: string;
  theme: ZoneTheme;
  bounds: ZoneBounds;
  
  // NEW: Training zone flag
  isTrainingZone?: boolean;

  // Hierarchy Metadata
  regionType?: 'hub' | 'segment' | 'dungeon' | 'poi';
  cardinalDirection?: 'N' | 'E' | 'S' | 'W';
  parentZoneId?: string;
  childZoneIds?: string[];

  geometry: ZoneGeometry;
  
  // Phase 2: Render Layer Metadata
  renderLayers?: {
    floor?: RenderLayerConfig;
    walls?: RenderLayerConfig;
    roofs?: RenderLayerConfig;
    occluders?: RenderLayerConfig;
    gridOverlay?: RenderLayerConfig;
    entities?: RenderLayerConfig;
    effects?: RenderLayerConfig;
    ui?: RenderLayerConfig;
  };
  
  entities: {
    static: ZoneEntityDef[]; // NPCs, Decorations (Hash-only)
    dynamic: ZoneEntityDef[]; // Spawners, Enemies (Update loop)
  };

  exits: ZoneExit[];

  environment: {
    weather: 'NONE' | 'RAIN' | 'ASH';
    lighting?: string;
    floorPattern: 'PLAIN' | 'GRID' | 'HAZARD' | 'ORGANIC' | 'HUB';
    colors: {
      ground: string;
      wall: string;
      detail: string;
    };
    ambientColor?: string;
  };

  metadata: {
    difficulty: number;
    isInstanced: boolean;
    playerStart: { x: number, y: number };
  };
}

export interface WorldZoneConfig {
  id: string;
  displayName: string;
  template: ZoneTemplate;
  adjacentZones?: string[]; // Deprecated, use parent/child
  persistence: 'persistent' | 'transient' | 'instanced';
  maxInstances?: number;
  parentZoneId?: string;
  childZoneIds?: string[];
}

export interface WorldGraph {
  zones: Record<string, WorldZoneConfig>;
  rootZoneId: string;
}
