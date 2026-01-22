
import { ZoneTemplate } from "../../models/zone.models";

export const HUB_TRAINING_ZONE: ZoneTemplate = {
  id: 'HUB_TRAINING',
  name: 'Neural Simulation Chamber',
  theme: 'HIGH_TECH',
  bounds: { minX: -500, maxX: 500, minY: -500, maxY: 500 },
  
  isTrainingZone: true,
  regionType: 'hub',
  parentZoneId: 'HUB',

  environment: {
    floorPattern: 'GRID',
    weather: 'NONE',
    colors: {
        ground: '#f8fafc',
        wall: '#cbd5e1',
        detail: '#0ea5e9'
    },
    ambientColor: '#f0f9ff'
  },
  
  geometry: {
    walls: [
      // Perimeter containment field (invisible walls or glass)
      { x: -500, y: 0, w: 20, h: 1000, height: 400, color: '#e2e8f0', type: 'BARRIER' }, // West
      { x: 500, y: 0, w: 20, h: 1000, height: 400, color: '#e2e8f0', type: 'BARRIER' },  // East
      { x: 0, y: -500, w: 1000, h: 20, height: 400, color: '#e2e8f0', type: 'BARRIER' }, // North
      { x: 0, y: 500, w: 1000, h: 20, height: 400, color: '#e2e8f0', type: 'BARRIER' },  // South
      
      // Observation deck (glass-walled platform at north)
      { 
        x: 0, y: -450, 
        w: 400, h: 80, 
        height: 200, 
        color: '#3f3f46', 
        type: 'OBSERVATION_DECK',
        data: { glassWalls: true }
      }
    ]
  },
  
  entities: {
    static: [
      // Central training terminal (dialogue-driven spawner)
      {
        type: 'TERMINAL',
        x: 0,
        y: 0,
        data: {
          dialogueId: 'training_terminal',
          color: '#06b6d4',
          hoverPrompt: 'Access Protocols [F]'
        }
      },
      // The Overseer (floating observation eye)
      {
        type: 'DECORATION',
        subType: 'OVERSEER_EYE',
        x: 0,
        y: -400,
        data: {
          z: 150,
          trackPlayer: true
        }
      }
    ],
    dynamic: [
      // Corner spawners (dormant until terminal activates them)
      {
        type: 'SPAWNER',
        subType: 'SPAWN_NODE',
        x: -350,
        y: -250,
        data: {
          spawnType: 'GRUNT',
          spawnMax: 3,
          triggerFlag: 'TRAINING_LVL1_ACTIVE',
          spawnCooldown: 1000
        }
      },
      {
        type: 'SPAWNER',
        subType: 'SPAWN_NODE',
        x: 350,
        y: -250,
        data: {
          spawnType: 'GRUNT',
          spawnMax: 3,
          triggerFlag: 'TRAINING_LVL1_ACTIVE',
          spawnCooldown: 1000
        }
      },
      {
        type: 'SPAWNER',
        subType: 'SPAWN_NODE',
        x: 0,
        y: -300,
        data: {
          spawnType: 'STALKER',
          spawnMax: 2,
          triggerFlag: 'TRAINING_LVL2_ACTIVE',
          spawnCooldown: 2000
        }
      }
    ]
  },
  
  exits: [
      // Return to Hub
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
