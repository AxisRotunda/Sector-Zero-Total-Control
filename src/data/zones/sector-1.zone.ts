
import { ZoneTemplate } from "../../models/zone.models";

export const SECTOR_1_ZONE: ZoneTemplate = {
  id: 'SECTOR_1',
  name: 'The Slag Heaps',
  theme: 'INDUSTRIAL',
  bounds: { minX: -2000, maxX: 2000, minY: -3000, maxY: 3000 },

  geometry: {
    walls: [
      // Main Corridor Sides
      { x: -400, y: 500, w: 40, h: 1000, height: 200, color: '#44403c' },
      { x: 400, y: 500, w: 40, h: 1000, height: 200, color: '#44403c' },
      
      // Broken debris piles (Walls acting as obstacles)
      { x: -100, y: 300, w: 80, h: 80, height: 40, color: '#292524' },
      { x: 150, y: 600, w: 100, h: 60, height: 60, color: '#292524' },
      { x: -200, y: 900, w: 120, h: 120, height: 80, color: '#292524' },
      
      // Cross Room
      { x: -800, y: 1500, w: 600, h: 40, height: 200, color: '#44403c' },
      { x: 800, y: 1500, w: 600, h: 40, height: 200, color: '#44403c' },
      
      // Random Columns
      { x: 600, y: 1300, w: 60, h: 60, height: 300, color: '#57534e', type: 'PILLAR' },
      { x: -600, y: 1700, w: 60, h: 60, height: 300, color: '#57534e', type: 'PILLAR' },
    ]
  },

  entities: {
    static: [
      { type: 'DECORATION', subType: 'RUG', x: 0, y: 500, data: { width: 700, height: 1200, color: '#1c1917' } }, // Dark road
      { type: 'DECORATION', subType: 'VENT', x: -350, y: 200 },
      { type: 'DECORATION', subType: 'VENT', x: 350, y: 800 },
      { type: 'DECORATION', subType: 'SLUDGE', x: 0, y: 1500, data: { radius: 100, color: '#10b981' } },
    ],
    dynamic: [
      { type: 'SPAWNER', subType: 'SPAWN_NODE', x: 0, y: 600, data: { spawnType: 'GRUNT', spawnMax: 3, spawnCooldown: 400 } },
      { type: 'SPAWNER', subType: 'SPAWN_NODE', x: -600, y: 1500, data: { spawnType: 'STALKER', spawnMax: 2, spawnCooldown: 600 } },
      { type: 'DESTRUCTIBLE', subType: 'CRATE', x: 100, y: 250 },
      { type: 'DESTRUCTIBLE', subType: 'BARREL', x: 200, y: 850 },
      { type: 'DESTRUCTIBLE', subType: 'BARREL', x: -200, y: 1400 },
    ]
  },

  exits: [
    { x: 0, y: -100, targetZoneId: 'HUB', direction: 'UP' },
    { x: 0, y: 2000, targetZoneId: 'SECTOR_2', direction: 'DOWN' }
  ],

  environment: {
    weather: 'NONE',
    floorPattern: 'HAZARD',
    colors: {
      ground: '#1c1917',
      wall: '#44403c',
      detail: '#ca8a04' // Dark Yellow hazard
    }
  },

  metadata: {
    difficulty: 1.5,
    isInstanced: true,
    playerStart: { x: 0, y: 0 }
  }
};