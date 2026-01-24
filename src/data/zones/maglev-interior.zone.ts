
import { ZoneTemplate, ZoneEntityDef } from "../../models/zone.models";
import { BUILDING_PREFABS, PrefabWall } from "../prefabs/structures";

// Assemble Interior Zone from Prefabs
const STATION_INTERIOR = {
  cockpit: BUILDING_PREFABS.maglevCockpit(0, -300),
  car1: BUILDING_PREFABS.maglevPassengerCar(0, -100, 'car1'),
  car2: BUILDING_PREFABS.maglevPassengerCar(0, 100, 'car2'),
  cargo: BUILDING_PREFABS.maglevCargoBay(0, 300)
};

const interiorWalls: PrefabWall[] = [];
const interiorEntities: ZoneEntityDef[] = [];

// Flatten prefabs
Object.values(STATION_INTERIOR).forEach(section => {
  interiorWalls.push(...section.walls);
  interiorEntities.push(...section.entities);
});

// Add exit door wall segment
interiorWalls.push({
  x: 0, y: 400, w: 100, h: 20, height: 150, color: '#ef4444', type: 'DOOR'
});

// Add exit trigger
interiorEntities.push({
  id: 'station_exit',
  type: 'INTERACTABLE',
  subType: 'ZONE_TRANSITION',
  x: 0, y: 420,
  data: {
    targetZone: 'HUB',
    promptText: 'DISEMBARK',
    isTransition: true
  }
});

export const MAGLEV_INTERIOR_ZONE: ZoneTemplate = {
  id: 'MAGLEV_INTERIOR',
  name: 'Transit Dock 04 [Interior]',
  theme: 'INDUSTRIAL',
  bounds: { minX: -600, maxX: 600, minY: -400, maxY: 400 },
  
  regionType: 'hub', // Sub-hub
  isSafeZone: true,
  parentZoneId: 'HUB',
  
  renderLayers: {
    floor: { zIndex: -1000 },
    walls: { zIndex: 0, sortBy: 'position' },
    roofs: { zIndex: 1000 },
    occluders: { zIndex: 2000, dynamic: true }
  },
  
  geometry: {
    walls: interiorWalls
  },
  
  entities: {
    static: interiorEntities,
    dynamic: []
  },
  
  exits: [{
    x: 0,
    y: 400,
    targetZoneId: 'HUB',
    transitionType: 'WALK',
    spawnOverride: { x: 0, y: -700 } // Return to station platform
  }],
  
  environment: {
    weather: 'NONE', // Interior space
    floorPattern: 'GRID',
    colors: { 
      ground: '#1e293b', 
      wall: '#334155', 
      detail: '#0ea5e9' 
    },
    ambientColor: 'rgba(14, 165, 233, 0.15)' // Cyan industrial lighting
  },
  
  metadata: {
    difficulty: 1.0,
    isInstanced: false,
    playerStart: { x: 0, y: -350 },
    hasRiftgate: false
  }
};
