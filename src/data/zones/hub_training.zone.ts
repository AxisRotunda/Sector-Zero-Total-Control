
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
      // Outer Walls
      { x: -700, y: 0, w: 20, h: 1400, height: 400, color: '#38bdf8', type: 'BARRIER' },
      { x: 700, y: 0, w: 20, h: 1400, height: 400, color: '#38bdf8', type: 'BARRIER' },
      { x: 0, y: -700, w: 1400, h: 20, height: 400, color: '#38bdf8', type: 'BARRIER' },
      { x: 0, y: 700, w: 1400, h: 20, height: 400, color: '#38bdf8', type: 'BARRIER' },
      
      // Control Platform (North)
      { x: 0, y: -550, w: 400, h: 200, height: 100, color: '#1e293b' },
      
      // Divider Walls (Separating Armory from Arena)
      { x: -300, y: -300, w: 400, h: 40, height: 200, color: '#334155' },
      { x: 300, y: -300, w: 400, h: 40, height: 200, color: '#334155' },
      
      // Obstacle Course (South East)
      { x: 350, y: 200, w: 40, h: 200, height: 150, color: '#475569' },
      { x: 450, y: 300, w: 200, h: 40, height: 150, color: '#475569' },
      
      // Pillars (Cover)
      { x: -300, y: 200, w: 60, h: 60, height: 200, color: '#475569', type: 'PILLAR' },
      { x: 0, y: 400, w: 60, h: 60, height: 200, color: '#475569', type: 'PILLAR' }
    ]
  },
  
  entities: {
    static: [
      // Central Control Terminal
      {
        type: 'TERMINAL',
        x: 0,
        y: -500,
        data: {
          dialogueId: 'training_terminal',
          color: '#38bdf8',
          hoverPrompt: 'SIMULATION CONTROL',
          interactionRadius: 150
        }
      },
      // Armory Kiosks (Visual only, function is in main terminal for now, or added later)
      { type: 'DECORATION', subType: 'INFO_KIOSK', x: -500, y: -500 },
      { type: 'DECORATION', subType: 'INFO_KIOSK', x: 500, y: -500 },

      // Holo Labels
      { type: 'DECORATION', subType: 'HOLO_SIGN', x: 0, y: -250, data: { label: 'COMBAT ZONE', color: '#ef4444', z: 250 } },
      
      // The Overseer
      {
        type: 'DECORATION', subType: 'OVERSEER_EYE', x: 0, y: -400,
        data: { z: 200, trackPlayer: true, color: '#38bdf8' }
      },
      // Floor details
      { type: 'DECORATION', subType: 'DYNAMIC_GLOW', x: 0, y: 0, data: { width: 800, depth: 800, color: '#0ea5e9' } }
    ],
    dynamic: [
      // Target Dummy Spawner (Center)
      {
        type: 'SPAWNER', subType: 'SPAWN_NODE', x: 0, y: 0,
        data: { spawnType: 'DUMMY', spawnMax: 1, triggerFlag: 'TRAINING_SPAWN_DUMMY', spawnCooldown: 100 }
      },
      // Grunt Spawners (Flanks)
      {
        type: 'SPAWNER', subType: 'SPAWN_NODE', x: -400, y: 200,
        data: { spawnType: 'GRUNT', spawnMax: 3, triggerFlag: 'TRAINING_SPAWN_GRUNT', spawnCooldown: 200 }
      },
      {
        type: 'SPAWNER', subType: 'SPAWN_NODE', x: 400, y: 200,
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
