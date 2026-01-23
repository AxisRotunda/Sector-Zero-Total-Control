
import { ZoneTemplate } from "../../models/zone.models";

export const HUB_TRAINING_ZONE: ZoneTemplate = {
  id: 'HUB_TRAINING',
  name: 'Neural Simulation Chamber',
  theme: 'HIGH_TECH',
  bounds: { minX: -800, maxX: 800, minY: -800, maxY: 800 },
  
  isTrainingZone: true,
  regionType: 'hub',
  parentZoneId: 'HUB',

  environment: {
    floorPattern: 'GRID',
    weather: 'NONE',
    colors: {
        ground: '#0f172a', // Darker Blue/Slate for contrast
        wall: '#334155',   // Slate
        detail: '#38bdf8'  // Cyan Light
    },
    ambientColor: '#0c4a6e'
  },
  
  geometry: {
    walls: [
      // --- Perimeter Bounds ---
      // Vertical
      { x: -700, y: 0, w: 20, h: 1400, height: 400, color: '#38bdf8', type: 'BARRIER' },
      { x: 700, y: 0, w: 20, h: 1400, height: 400, color: '#38bdf8', type: 'BARRIER' },
      // Horizontal
      { x: 0, y: -700, w: 1400, h: 20, height: 400, color: '#38bdf8', type: 'BARRIER' },
      { x: 0, y: 700, w: 1400, h: 20, height: 400, color: '#38bdf8', type: 'BARRIER' },
      
      // --- Combat Arena Cover (Symmetric) ---
      // Top Left Quadrant
      { x: -300, y: -200, w: 60, h: 60, height: 200, color: '#475569', type: 'PILLAR' },
      { x: -400, y: -200, w: 20, h: 150, height: 150, color: '#334155' }, // Low wall
      
      // Top Right Quadrant
      { x: 300, y: -200, w: 60, h: 60, height: 200, color: '#475569', type: 'PILLAR' },
      { x: 400, y: -200, w: 20, h: 150, height: 150, color: '#334155' }, // Low wall

      // Bottom Left Quadrant
      { x: -300, y: 200, w: 60, h: 60, height: 200, color: '#475569', type: 'PILLAR' },
      { x: -400, y: 200, w: 20, h: 150, height: 150, color: '#334155' },

      // Bottom Right Quadrant
      { x: 300, y: 200, w: 60, h: 60, height: 200, color: '#475569', type: 'PILLAR' },
      { x: 400, y: 200, w: 20, h: 150, height: 150, color: '#334155' },
      
      // Center Obstacle (Line of Sight breaker)
      { x: 0, y: 400, w: 120, h: 20, height: 100, color: '#1e293b' }
    ]
  },
  
  entities: {
    static: [
      // --- Control Deck (North) ---
      // Visual Platform (No Collision)
      { type: 'DECORATION', subType: 'RUG', x: 0, y: -550, data: { width: 600, height: 200, color: '#1e293b' } },
      
      // Central Control Terminal
      {
        type: 'TERMINAL',
        x: 0,
        y: -550,
        data: {
          dialogueId: 'training_terminal',
          color: '#38bdf8',
          promptText: 'SIMULATION CONTROL',
          interactionRadius: 150,
          width: 60, depth: 40, height: 80
        }
      },
      
      // Visual Kiosks (Flanking)
      { type: 'DECORATION', subType: 'INFO_KIOSK', x: -200, y: -550 },
      { type: 'DECORATION', subType: 'INFO_KIOSK', x: 200, y: -550 },

      // Holo Labels
      { type: 'DECORATION', subType: 'HOLO_SIGN', x: 0, y: -300, data: { label: 'COMBAT ZONE', color: '#ef4444', z: 250 } },
      
      // The Overseer (Watching from above)
      {
        type: 'DECORATION', subType: 'OVERSEER_EYE', x: 0, y: -650,
        data: { z: 250, trackPlayer: true, color: '#38bdf8' }
      },
      
      // Floor details
      { type: 'DECORATION', subType: 'DYNAMIC_GLOW', x: 0, y: 0, data: { width: 800, depth: 800, color: '#0ea5e9', glowIntensity: 0.2 } }
    ],
    dynamic: [
      // Target Dummy Spawner (Center)
      {
        type: 'SPAWNER', subType: 'SPAWN_NODE', x: 0, y: 0,
        data: { spawnType: 'DUMMY', spawnMax: 1, triggerFlag: 'TRAINING_SPAWN_DUMMY', spawnCooldown: 100 }
      },
      // Grunt Spawners (Flanks)
      {
        type: 'SPAWNER', subType: 'SPAWN_NODE', x: -500, y: 0,
        data: { spawnType: 'GRUNT', spawnMax: 3, triggerFlag: 'TRAINING_SPAWN_GRUNT', spawnCooldown: 200 }
      },
      {
        type: 'SPAWNER', subType: 'SPAWN_NODE', x: 500, y: 0,
        data: { spawnType: 'GRUNT', spawnMax: 3, triggerFlag: 'TRAINING_SPAWN_GRUNT', spawnCooldown: 200 }
      },
      // Heavy Spawner (Back)
      {
        type: 'SPAWNER', subType: 'SPAWN_NODE', x: 0, y: 500,
        data: { spawnType: 'HEAVY', spawnMax: 1, triggerFlag: 'TRAINING_SPAWN_HEAVY', spawnCooldown: 200 }
      }
    ]
  },
  
  exits: [
      {
        x: 0,
        y: -650,
        targetZoneId: 'HUB',
        transitionType: 'GATE'
      }
  ],

  metadata: {
    difficulty: 1.0,
    isInstanced: true,
    playerStart: { x: 0, y: -400 }
  }
};
