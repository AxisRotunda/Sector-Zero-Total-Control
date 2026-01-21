
import { ZoneTemplate } from "../../../models/zone.models";

export const SECTOR_9_S_ZONE: ZoneTemplate = {
  id: 'SECTOR_9_S',
  name: 'Sector 9: The Arteries Gate',
  theme: 'INDUSTRIAL',
  regionType: 'segment',
  cardinalDirection: 'S',
  bounds: { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 },

  geometry: {
    walls: [
      // Gate to Sector 8
      { x: 0, y: 800, w: 400, h: 40, height: 200, color: '#27272a', type: 'GATE_SEGMENT', locked: true },
      { x: -300, y: 800, w: 40, h: 200, height: 200, color: '#27272a' },
      { x: 300, y: 800, w: 40, h: 200, height: 200, color: '#27272a' },
    ]
  },

  entities: {
    static: [
        { type: 'NPC', subType: 'GUARD', x: 200, y: 750, data: { dialogueId: 'gate_locked', color: '#3b82f6' } },
        { type: 'DECORATION', subType: 'SLUDGE', x: -200, y: 300, data: { radius: 100, color: '#10b981' } }
    ],
    dynamic: [
        { type: 'SPAWNER', subType: 'SPAWN_NODE', x: 0, y: 0, data: { spawnType: 'HEAVY', spawnMax: 1, spawnCooldown: 1200 } }
    ]
  },

  exits: [
    { x: 0, y: 900, targetZoneId: 'SECTOR_8', transitionType: 'GATE', locked: true },
    { x: 0, y: -950, targetZoneId: 'SECTOR_9_N', transitionType: 'WALK' },
    { x: 950, y: 0, targetZoneId: 'SECTOR_9_E', transitionType: 'WALK' },
    { x: -950, y: 0, targetZoneId: 'SECTOR_9_W', transitionType: 'WALK' }
  ],

  environment: {
    weather: 'ASH',
    floorPattern: 'HAZARD',
    colors: { ground: '#1c1917', wall: '#27272a', detail: '#ca8a04' }
  },

  metadata: { difficulty: 1.3, isInstanced: false, playerStart: { x: 0, y: -800 } }
};
