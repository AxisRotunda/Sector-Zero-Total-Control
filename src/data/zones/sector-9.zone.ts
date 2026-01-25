
import { ZoneTemplate } from "../../models/zone.models";

export const SECTOR_9_ZONE: ZoneTemplate = {
  id: 'SECTOR_9',
  name: 'Sector 9: The Rust Sprawl',
  theme: 'INDUSTRIAL',
  bounds: { minX: -2500, maxX: 2500, minY: -3000, maxY: 3000 },

  geometry: {
    walls: [
      // --- North Entrance Area (Connection to Hub) ---
      // Funnel shape leading to the gate
      { x: -300, y: -2800, w: 60, h: 400, height: 250, color: '#27272a' },
      { x: 300, y: -2800, w: 60, h: 400, height: 250, color: '#27272a' },
      
      // Broken Gate debris
      // Adjusted Y from -2580 to -2550 to ensure strict Euclidean separation from funnel wall
      { x: -150, y: -2550, w: 100, h: 40, height: 50, color: '#3f3f46', data: { id: 'debris_gate', kind: 'DECORATIVE' } },
      
      // --- Main Highway (The Spine) ---
      { x: -500, y: -1000, w: 40, h: 2000, height: 180, color: '#44403c' },
      { x: 500, y: -1000, w: 40, h: 2000, height: 180, color: '#44403c' },
      
      // --- Central Plaza (The Junction) ---
      { x: -800, y: 500, w: 400, h: 40, height: 150, color: '#44403c' },
      { x: 800, y: 500, w: 400, h: 40, height: 150, color: '#44403c' },
      
      // Ruined Structures
      { x: -700, y: 800, w: 200, h: 200, height: 100, color: '#292524' },
      { x: 700, y: 200, w: 150, h: 150, height: 80, color: '#292524' },
      
      // --- South Perimeter ---
      { x: -400, y: 2000, w: 40, h: 800, height: 200, color: '#27272a' },
      { x: 400, y: 2000, w: 40, h: 800, height: 200, color: '#27272a' },
      
      // Pillars
      { x: 600, y: -500, w: 50, h: 50, height: 250, color: '#57534e', type: 'PILLAR' },
      { x: -600, y: 0, w: 50, h: 50, height: 250, color: '#57534e', type: 'PILLAR' },
    ]
  },

  entities: {
    static: [
      // Roads
      { type: 'DECORATION', subType: 'RUG', x: 0, y: -1000, data: { width: 900, height: 2000, color: '#1c1917' } }, 
      { type: 'DECORATION', subType: 'RUG', x: 0, y: 1500, data: { width: 700, height: 1500, color: '#1c1917' } },

      // Hazards
      { type: 'DECORATION', subType: 'VENT', x: -400, y: -1500 },
      { type: 'DECORATION', subType: 'VENT', x: 400, y: -500 },
      { type: 'DECORATION', subType: 'SLUDGE', x: 200, y: 800, data: { radius: 120, color: '#10b981' } },
      
      // Flavor
      { type: 'DECORATION', subType: 'GRAFFITI', x: -480, y: -1000, data: { color: '#ef4444' } },
      { type: 'DECORATION', subType: 'TRASH', x: 300, y: -2400 },
      { type: 'DECORATION', subType: 'TRASH', x: -350, y: -2300 },
    ],
    dynamic: [
      // Spawners
      { type: 'SPAWNER', subType: 'SPAWN_NODE', x: 0, y: -800, data: { spawnType: 'GRUNT', spawnMax: 2, spawnCooldown: 500 } },
      { type: 'SPAWNER', subType: 'SPAWN_NODE', x: -600, y: 600, data: { spawnType: 'STALKER', spawnMax: 2, spawnCooldown: 600 } },
      { type: 'SPAWNER', subType: 'SPAWN_NODE', x: 0, y: 1800, data: { spawnType: 'HEAVY', spawnMax: 1, spawnCooldown: 1200 } },
      
      // Loot
      { type: 'DESTRUCTIBLE', subType: 'CRATE', x: -200, y: -1800 },
      { type: 'DESTRUCTIBLE', subType: 'CRATE', x: 250, y: -200 },
      { type: 'DESTRUCTIBLE', subType: 'BARREL', x: 500, y: 400 },
      { type: 'DESTRUCTIBLE', subType: 'BARREL', x: -500, y: 1200 },
    ]
  },

  exits: [
    // North Exit -> Hub
    { x: 0, y: -2900, targetZoneId: 'HUB', direction: 'UP' },
    // South Exit -> Deep Sector (Placeholder)
    { x: 0, y: 2800, targetZoneId: 'SECTOR_2', direction: 'DOWN', locked: true }
  ],

  environment: {
    weather: 'ASH', // Light ash falling
    floorPattern: 'HAZARD',
    colors: {
      ground: '#18181b',
      wall: '#27272a',
      detail: '#ca8a04'
    }
  },

  metadata: {
    difficulty: 1.2,
    isInstanced: false,
    playerStart: { x: 0, y: -2700 } // Start near Hub gate
  }
};
