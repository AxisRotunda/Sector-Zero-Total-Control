
import { ZoneTemplate } from "../../models/zone.models";

// These templates act as config for the Procedural Generator
// Geometry is empty because the WorldGenerator will fill it based on metadata

export const SECTOR_8_ZONE: ZoneTemplate = {
  id: 'SECTOR_8', name: 'The Arteries', theme: 'INDUSTRIAL',
  bounds: { minX: -3000, maxX: 3000, minY: -3000, maxY: 3000 },
  geometry: { walls: [] },
  entities: { static: [], dynamic: [] },
  exits: [],
  environment: { weather: 'NONE', floorPattern: 'HAZARD', colors: { ground: '#292524', wall: '#44403c', detail: '#facc15' } },
  metadata: { difficulty: 1.5, isInstanced: true, playerStart: { x: 0, y: 0 } }
};

export const SECTOR_7_ZONE: ZoneTemplate = {
  id: 'SECTOR_7', name: 'The Hive', theme: 'RESIDENTIAL',
  bounds: { minX: -3000, maxX: 3000, minY: -3000, maxY: 3000 },
  geometry: { walls: [] },
  entities: { static: [], dynamic: [] },
  exits: [],
  environment: { weather: 'RAIN', floorPattern: 'PLAIN', colors: { ground: '#020617', wall: '#1e1b4b', detail: '#f472b6' } },
  metadata: { difficulty: 2.0, isInstanced: true, playerStart: { x: 0, y: 0 } }
};

export const SECTOR_6_ZONE: ZoneTemplate = {
  id: 'SECTOR_6', name: 'Green Lung', theme: 'ORGANIC',
  bounds: { minX: -3000, maxX: 3000, minY: -3000, maxY: 3000 },
  geometry: { walls: [] },
  entities: { static: [], dynamic: [] },
  exits: [],
  environment: { weather: 'NONE', floorPattern: 'ORGANIC', colors: { ground: '#052e16', wall: '#14532d', detail: '#22c55e' } },
  metadata: { difficulty: 2.5, isInstanced: true, playerStart: { x: 0, y: 0 } }
};

export const SECTOR_5_ZONE: ZoneTemplate = {
  id: 'SECTOR_5', name: 'Iron Heart', theme: 'INDUSTRIAL',
  bounds: { minX: -3000, maxX: 3000, minY: -3000, maxY: 3000 },
  geometry: { walls: [] },
  entities: { static: [], dynamic: [] },
  exits: [],
  environment: { weather: 'ASH', floorPattern: 'HAZARD', colors: { ground: '#450a0a', wall: '#7f1d1d', detail: '#fbbf24' } },
  metadata: { difficulty: 3.0, isInstanced: true, playerStart: { x: 0, y: 0 } }
};

export const SECTOR_4_ZONE: ZoneTemplate = {
  id: 'SECTOR_4', name: 'Memory Banks', theme: 'HIGH_TECH',
  bounds: { minX: -3000, maxX: 3000, minY: -3000, maxY: 3000 },
  geometry: { walls: [] },
  entities: { static: [], dynamic: [] },
  exits: [],
  environment: { weather: 'NONE', floorPattern: 'GRID', colors: { ground: '#f8fafc', wall: '#94a3b8', detail: '#0ea5e9' } },
  metadata: { difficulty: 3.5, isInstanced: true, playerStart: { x: 0, y: 0 } }
};

export const SECTOR_3_ZONE: ZoneTemplate = {
  id: 'SECTOR_3', name: 'Chimera Labs', theme: 'HIGH_TECH',
  bounds: { minX: -3000, maxX: 3000, minY: -3000, maxY: 3000 },
  geometry: { walls: [] },
  entities: { static: [], dynamic: [] },
  exits: [],
  environment: { weather: 'NONE', floorPattern: 'PLAIN', colors: { ground: '#fff1f2', wall: '#e2e8f0', detail: '#f43f5e' } },
  metadata: { difficulty: 4.0, isInstanced: true, playerStart: { x: 0, y: 0 } }
};

export const SECTOR_2_ZONE: ZoneTemplate = {
  id: 'SECTOR_2', name: 'The Black Gate', theme: 'VOID',
  bounds: { minX: -3000, maxX: 3000, minY: -3000, maxY: 3000 },
  geometry: { walls: [] },
  entities: { static: [], dynamic: [] },
  exits: [],
  environment: { weather: 'ASH', floorPattern: 'GRID', colors: { ground: '#020617', wall: '#581c87', detail: '#a855f7' } },
  metadata: { difficulty: 5.0, isInstanced: true, playerStart: { x: 0, y: 0 } }
};
