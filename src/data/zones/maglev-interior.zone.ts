
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

// --- PROCEDURAL GENERATION: HULL CURVATURE ---
// Creates ribs overhead to sell the "Tube" effect
const HULL_CURVATURE_SEGMENTS = 12;
const HULL_RADIUS = 110;
const SECTION_START = -350;
const SECTION_END = 400;
const RIB_SPACING = 200;

for (let section = SECTION_START; section < SECTION_END; section += RIB_SPACING) {
  for (let i = 0; i < HULL_CURVATURE_SEGMENTS; i++) {
    const angle = (i / HULL_CURVATURE_SEGMENTS) * Math.PI; // 0 to π (half circle)
    // Skip very low segments to allow walking
    if (angle < 0.2 || angle > 2.9) continue;

    const nextAngle = ((i + 1) / HULL_CURVATURE_SEGMENTS) * Math.PI;
    
    // Approximate curve with straight segments (visual only)
    // We position them high so they act as ceiling ribs
    const x1 = Math.cos(angle) * HULL_RADIUS;
    const x2 = Math.cos(nextAngle) * HULL_RADIUS;
    const midX = (x1 + x2) / 2;
    
    // Height variation to simulate arch
    const zBase = 120 + Math.sin(angle) * 30;
    
    // Add rib segments as decorative walls (small w/h to minimize occlusion issues)
    interiorWalls.push({
      x: midX,
      y: section,
      w: 10,
      h: 20, // Rib thickness
      height: 10, // Visual thickness
      color: '#1e293b',
      type: 'WALL', // Use generic wall for now, specialized hull renderer could be added later
      data: { z: zBase } // Custom Z for floating walls support (requires renderer update to respect data.z if not standard)
    });
  }
}

// --- PROCEDURAL LIGHTING ---
const LIGHT_SPACING = 150;
for (let y = -300; y < 350; y += LIGHT_SPACING) {
  // Left corridor lights
  interiorEntities.push({
    type: 'DECORATION',
    subType: 'DYNAMIC_GLOW',
    x: -100,
    y: y,
    data: {
      width: 40,
      depth: 10,
      height: 140, // Ceiling height
      color: '#06b6d4',
      glowIntensity: 0.8,
      pulseSpeed: 0.3, // Slow flicker
      pulseRange: 0.2 
    }
  });
  
  // Right corridor lights
  interiorEntities.push({
    type: 'DECORATION',
    subType: 'DYNAMIC_GLOW',
    x: 100,
    y: y,
    data: {
      width: 40,
      depth: 10,
      height: 140,
      color: '#06b6d4',
      glowIntensity: 0.8,
      pulseSpeed: 0.3,
      pulseRange: 0.2
    }
  });
}

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
    ambientColor: 'rgba(14, 165, 233, 0.15)', // Cyan industrial lighting
    // Atmospheric Particles
    // Note: particleEffects logic needs to be handled in WorldService or EffectRenderer if data present
    // For now, we simulate via existing entity spawners if needed, or rely on ambient. 
    // Adding custom steam vents as entities.
  },
  
  metadata: {
    difficulty: 1.0,
    isInstanced: false,
    playerStart: { x: 0, y: -350 },
    hasRiftgate: false
  }
};
