
import { ZoneTemplate } from "../../../models/zone.models";

export const SECTOR_9_W_ZONE: ZoneTemplate = {
  id: 'SECTOR_9_W',
  name: 'Sector 9: West Perimeter',
  theme: 'INDUSTRIAL',
  regionType: 'segment',
  cardinalDirection: 'W',
  bounds: { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 },

  geometry: {
    walls: [
      { x: -600, y: 0, w: 50, h: 50, height: 250, color: '#57534e', type: 'PILLAR' }
    ]
  },

  entities: {
    static: [
       { type: 'DECORATION', subType: 'VENT', x: -400, y: 200 }
    ],
    dynamic: [
       { type: 'SPAWNER', subType: 'SPAWN_NODE', x: -300, y: -200, data: { spawnType: 'GRUNT', spawnMax: 2, spawnCooldown: 600 } }
    ]
  },

  exits: [
    { x: 950, y: 0, targetZoneId: 'SECTOR_9_N', transitionType: 'WALK' }
  ],

  environment: {
    weather: 'ASH',
    floorPattern: 'HAZARD',
    colors: { ground: '#18181b', wall: '#27272a', detail: '#ca8a04' }
  },

  metadata: { difficulty: 1.2, isInstanced: false, playerStart: { x: 800, y: 0 } }
};
