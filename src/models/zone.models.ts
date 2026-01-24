
import { ZoneTheme } from "./game.models";

export enum ZoneLifecycle {
  /** Never resets. Used for player hubs, towns, and safe houses. State is saved indefinitely. */
  PERSISTENT = 'PERSISTENT',
  /** Resets on death or logout. Used for standard campaign zones to allow retries. */
  CHECKPOINT = 'CHECKPOINT',
  /** Always fresh on entry. Used for procedural dungeons or one-time events. */
  INSTANCED = 'INSTANCED',
  /** Resets on exit. Used for boss rooms to allow immediate re-attempts without reloading the whole sector. */
  BOSS_ARENA = 'BOSS_ARENA'
}

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
  id?: string; // Stable identifier for scripting/diffing
  type: 'NPC' | 'ENEMY' | 'DECORATION' | 'SPAWNER' | 'DESTRUCTIBLE' | 'TERMINAL' | 'INTERACTABLE';
  subType?: string;
  x: number;
  y: number;
  z?: number;
  conditionFlag?: string; // Only spawn if this Narrative Flag is TRUE
  data?: any; // Extra props like dialogueId, loot, spawn info
}

export interface ZoneExit {
  x: number;
  y: number;
  targetZoneId: string;
  direction?: 'UP' | 'DOWN'; // Deprecated in favor of generic transition
  transitionType?: 'GATE' | 'PORTAL' | 'WALK';
  locked?: boolean;
  spawnOverride?: { x: number; y: number }; // Optional override for player spawn location in target zone
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
  
  isTrainingZone?: boolean;
  isSafeZone?: boolean; // Safe harbor mode

  // Hierarchy Metadata
  regionType?: 'hub' | 'segment' | 'dungeon' | 'poi';
  cardinalDirection?: 'N' | 'E' | 'S' | 'W';
  parentZoneId?: string;
  childZoneIds?: string[];

  geometry: ZoneGeometry;
  
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
    weather: 'NONE' | 'RAIN' | 'ASH' | 'SNOW';
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
    hasRiftgate?: boolean; // New: Does this zone have a static waypoint?
  };
}

export interface WorldZoneConfig {
  id: string;
  displayName: string;
  template: ZoneTemplate;
  lifecycle: ZoneLifecycle;
  parentZoneId?: string;
  childZoneIds?: string[];
}

export interface WorldGraph {
  zones: Record<string, WorldZoneConfig>;
  rootZoneId: string;
}
