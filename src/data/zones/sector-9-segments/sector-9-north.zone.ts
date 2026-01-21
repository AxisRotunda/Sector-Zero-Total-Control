
import { ZoneTemplate } from "../../../models/zone.models";

export const SECTOR_9_N_ZONE: ZoneTemplate = {
  id: 'SECTOR_9_N',
  name: 'Sector 9: North Approach',
  theme: 'INDUSTRIAL',
  regionType: 'segment',
  cardinalDirection: 'N',
  bounds: { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 },

  geometry: {
    walls: [
      // Funnel from HUB Gate
      { x: -300, y: -900, w: 60, h: 400, height: 250, color: '#27272a' },
      { x: 300, y: -900, w: 60, h: 400, height: 250, color: '#27272a' },
      // Debris
      { x: 0, y: -700, w: 100, h: 40, height: 50, color: '#3f3f46' },
    ]
  },

  entities: {
    static: [
      { type: 'DECORATION', subType: 'RUG', x: 0, y: 0, data: { width: 600, height: 2000, color: '#1c1917' } },
      { type: 'DECORATION', subType: 'GRAFFITI', x: -280, y: -800, data: { color: '#ef4444' } }
    ],
    dynamic: [
      { type: 'SPAWNER', subType: 'SPAWN_NODE', x: 0, y: 200, data: { spawnType: 'GRUNT', spawnMax: 2, spawnCooldown: 500 } },
      { type: 'DESTRUCTIBLE', subType: 'CRATE', x: -150, y: -400 },
    ]
  },

  exits: [
    { x: 0, y: -950, targetZoneId: 'HUB', transitionType: 'GATE' },
    { x: 0, y: 950, targetZoneId: 'SECTOR_9_S', transitionType: 'WALK' }, // To South/Center
    { x: 950, y: 0, targetZoneId: 'SECTOR_9_E', transitionType: 'WALK' },
    { x: -950, y: 0, targetZoneId: 'SECTOR_9_W', transitionType: 'WALK' }
  ],

  environment: {
    weather: 'ASH',
    floorPattern: 'HAZARD',
    colors: { ground: '#18181b', wall: '#27272a', detail: '#ca8a04' }
  },

  metadata: { difficulty: 1.1, isInstanced: false, playerStart: { x: 0, y: -800 } }
};
