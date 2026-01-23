
import { ZoneTemplate } from "../../models/zone.models";

export const HUB_TRAINING_ZONE: ZoneTemplate = {
  id: 'HUB_TRAINING',
  name: 'Neural Simulation Chamber',
  theme: 'HIGH_TECH',
  bounds: { minX: -600, maxX: 600, minY: -600, maxY: 600 },
  
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
      // Perimeter containment field (invisible walls or glass)
      { x: -500, y: 0, w: 20, h: 1000, height: 400, color: '#38bdf8', type: 'BARRIER' }, // West
      { x: 500, y: 0, w: 20, h: 1000, height: 400, color: '#38bdf8', type: 'BARRIER' },  // East
      { x: 0, y: -500, w: 1000, h: 20, height: 400, color: '#38bdf8', type: 'BARRIER' }, // North
      { x: 0, y: 500, w: 1000, h: 20, height: 400, color: '#38bdf8', type: 'BARRIER' },  // South
      
      // Observation deck (glass-walled platform at north)
      { 
        x: 0, y: -450, 
        w: 400, h: 100, 
        height: 250, 
        color: '#1e293b', 
        type: 'OBSERVATION_DECK',
        data: { glassWalls: true }
      }
    ]
  },
  
  entities: {
    static: [
      // Central training terminal
      {
        type: 'TERMINAL',
        x: 0,
        y: 0,
        data: {
          dialogueId: 'training_terminal',
          color: '#38bdf8',
          hoverPrompt: 'SIMULATION CONTROL',
          interactionRadius: 150 // Extended for mobile tap
        }
      },
      // The Overseer (floating observation eye)
      {
        type: 'DECORATION',
        subType: 'OVERSEER_EYE',
        x: 0,
        y: -400,
        data: {
          z: 200,
          trackPlayer: true,
          color: '#38bdf8'
        }
      },
      // Floor details
      {
          type: 'DECORATION', subType: 'DYNAMIC_GLOW', x: 0, y: 0,
          data: { width: 400, depth: 400, color: '#0ea5e9' }
      }
    ],
    dynamic: [
      // Corner spawners
      {
        type: 'SPAWNER', subType: 'SPAWN_NODE', x: -350, y: -250,
        data: { spawnType: 'GRUNT', spawnMax: 3, triggerFlag: 'TRAINING_LVL1_ACTIVE', spawnCooldown: 1000 }
      },
      {
        type: 'SPAWNER', subType: 'SPAWN_NODE', x: 350, y: -250,
        data: { spawnType: 'GRUNT', spawnMax: 3, triggerFlag: 'TRAINING_LVL1_ACTIVE', spawnCooldown: 1000 }
      },
      {
        type: 'SPAWNER', subType: 'SPAWN_NODE', x: 0, y: -300,
        data: { spawnType: 'STALKER', spawnMax: 2, triggerFlag: 'TRAINING_LVL2_ACTIVE', spawnCooldown: 2000 }
      }
    ]
  },
  
  exits: [
      {
        x: 0,
        y: 480,
        targetZoneId: 'HUB',
        transitionType: 'GATE'
      }
  ],

  metadata: {
    difficulty: 1.0,
    isInstanced: true,
    playerStart: { x: 0, y: 400 }
  }
};
