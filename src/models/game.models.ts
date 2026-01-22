
import { Item } from "./item.models";

export type SectorId = string;

// Standardized Interface for 3D Structures
export interface Volumetric {
    width?: number;  // X-axis span
    depth?: number;  // Y-axis span (for top-down/iso collisions)
    height?: number; // Z-axis span (visual height)
}

export interface Entity extends Volumetric {
  id: number;
  zoneId?: string; 
  chunkId?: string; // Spatial Partition ID
  type: 'PLAYER' | 'ENEMY' | 'HITBOX' | 'PICKUP' | 'WALL' | 'DESTRUCTIBLE' | 'EXIT' | 'NPC' | 'DECORATION' | 'SPAWNER' | 'SHRINE' | 'TERMINAL' | 'ARTIFACT' | 'INTERACTABLE';
  subType?: 'GRUNT' | 'HEAVY' | 'STALKER' | 'BOSS' | 'SNIPER' | 'STEALTH' | 'SUPPORT' | 'CRATE' | 'BARREL' | 'HAZARD' | 'MEDIC' | 'TRADER' | 'HANDLER' | 'GUARD' | 'TURRET' | 'FLOOR_CRACK' | 'VENT' | 'BLOOD' | 'PIPE' | 'CONSOLE' | 'SERVER' | 'LIGHT' | 'RUG' | 'BARRIER' | 'HOLO_TABLE' | 'SPAWN_NODE' | 'SHRINE_DMG' | 'SHRINE_SPEED' | 'SHRINE_HEAL' | 'NEON' | 'FAN' | 'GRAFFITI' | 'CABLE' | 'TRASH' | 'SLUDGE' | 'CITIZEN' | 'BENCH' | 'STREET_LIGHT' | 'SIGN_POST' | 'VENDING_MACHINE' | 'PLANT_BOX' | 'MURAL' | 'ECHO' | 'MONOLITH' | 'GATE_SEGMENT' | 'PILLAR' | 'GENERIC' | 'OVERSEER_EYE' | 'DYNAMIC_GLOW' | 'OBSERVATION_DECK' | 'TRAINING_EXTERIOR' | 'ZONE_TRANSITION' | 'STASH' | 'RIFTGATE' | 'PORTAL';
  source?: 'PLAYER' | 'ENEMY' | 'ENVIRONMENT' | 'PSIONIC' | 'DEFENSE';
  exitType?: 'UP' | 'DOWN'; 
  targetSector?: string; 
  x: number;
  y: number;
  z: number;
  
  // Render Sorting
  isoDepth?: number; 

  vx: number;
  vy: number;
  angle: number;
  radius: number;
  hp: number;
  maxHp: number;
  armor: number;
  armorPen?: number;
  color: string;
  state: 'IDLE' | 'MOVE' | 'ATTACK' | 'DEAD' | 'CHARGE' | 'RETREAT' | 'PATROL' | 'ACTIVE' | 'COOLDOWN' | 'SUPPORT';
  animFrame: number;
  animFrameTimer: number;
  animPhase?: 'startup' | 'active' | 'recovery';
  comboIndex?: number; // 0, 1, 2 for combo chain
  timer: number;
  attackTimer?: number;
  speed: number;
  hitFlash: number;
  xpValue: number;
  itemData?: Item;
  trail?: {x: number, y: number, alpha: number}[];
  status: {
      stun: number;
      slow: number;
      poison: { duration: number; dps: number; timer: number } | null;
      burn: { duration: number; dps: number; timer: number } | null;
      weakness: { duration: number; damageReduction: number; armorReduction: number; timer: number } | null;
      bleed: { duration: number; dps: number; stacks: number; timer: number } | null;
  };
  knockbackForce?: number;
  psionicEffect?: 'wave';
  rotation?: number;
  text?: string; 
  name?: string;
  
  homeX?: number;
  homeY?: number;
  aggroRadius?: number;
  interactionRadius?: number;
  patrolPoints?: {x: number, y: number}[];
  patrolIndex?: number;
  
  spawnType?: string; 
  spawnCooldown?: number;
  spawnMax?: number;
  spawnedIds?: number[]; 

  targetX?: number;
  targetY?: number;
  
  dialogueId?: string;
  logId?: string;
  accessed?: boolean;
  factionId?: 'REMNANT' | 'VANGUARD' | 'RESONANT';
  
  // Logic State
  locked?: boolean;
  openness?: number; // 0.0 (Closed) to 1.0 (Open) for gates/doors

  hitStopFrames?: number;
  isHitStunned?: boolean;
  resistances?: {
      burn?: number;
      poison?: number;
      stun?: number;
      slow?: number;
  };
  equipment?: {
      weapon?: Item;
      armor?: Item;
      amulet?: Item;
      ring?: Item;
  };
  shopInventory?: Item[]; // Persistent shop stock for traders
  squadId?: number;
  aiRole?: 'ATTACKER' | 'SUPPORT' | 'TANK';
  
  lastQueryId?: number;
  
  // Generic data bag for zone-specific properties
  data?: any;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  vy: number;
  size: number;
}

export type ZoneTheme = 'INDUSTRIAL' | 'RESIDENTIAL' | 'HIGH_TECH' | 'ORGANIC' | 'VOID';

export interface Zone {
  id: string; 
  name: string;
  theme: ZoneTheme;
  groundColor: string;
  wallColor: string;
  detailColor: string;
  minDepth: number;
  difficultyMult: number;
  weather: 'NONE' | 'RAIN' | 'ASH';
  floorPattern: 'PLAIN' | 'GRID' | 'HAZARD' | 'ORGANIC' | 'HUB';
  isTrainingZone?: boolean;
  isSafeZone?: boolean; // Disables combat
  ambientColor?: string;
}

export interface Camera {
    x: number;
    y: number;
    zoom: number;
}

export interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  color: string; 
  life: number; 
  sizeStart: number;
  sizeEnd: number;
  alphaStart: number;
  alphaEnd: number;
  shape: 'circle' | 'square' | 'star' | 'spark';
  rotation: number;
  rotSpeed: number;
  composite?: GlobalCompositeOperation;
  emitsLight?: boolean;
  
  // Render Sorting
  isoDepth?: number;
}
