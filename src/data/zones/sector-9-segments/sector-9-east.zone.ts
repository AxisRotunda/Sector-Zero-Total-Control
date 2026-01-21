
import { ZoneTemplate } from "../../../models/zone.models";

export const SECTOR_9_E_ZONE: ZoneTemplate = {
  id: 'SECTOR_9_E',
  name: 'Sector 9: Scavenger Yards',
  theme: 'INDUSTRIAL',
  regionType: 'segment',
  cardinalDirection: 'E',
  bounds: { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 },

  geometry: {
    walls: [
      { x: 500, y: 0, w: 200, h: 200, height: 100, color: '#292524' }, // Scrap pile
    ]
  },

  entities: {
    static: [
        { type: 'DECORATION', subType: 'TRASH', x: 400, y: 100 },
        { type: 'DECORATION', subType: 'TRASH', x: 600, y: -100 }
    ],
    dynamic: [
        { type: 'SPAWNER', subType: 'SPAWN_NODE', x: 300, y: 0, data: { spawnType: 'STALKER', spawnMax: 3, spawnCooldown: 400 } },
        { type: 'DESTRUCTIBLE', subType: 'CRATE', x: 550, y: 50 }
    ]
  },

  exits: [
    { x: -950, y: 0, targetZoneId: 'SECTOR_9_N', transitionType: 'WALK' } // Connects back to center/north
  ],

  environment: {
    weather: 'ASH',
    floorPattern: 'HAZARD',
    colors: { ground: '#292524', wall: '#44403c', detail: '#ca8a04' }
  },

  metadata: { difficulty: 1.2, isInstanced: false, playerStart: { x: -800, y: 0 } }
};
