
import { Item } from "./item.models";

export type SectorId = string;

export interface Entity {
  id: number;
  // Added zoneId for hierarchical system
  zoneId?: string; 
  type: 'PLAYER' | 'ENEMY' | 'HITBOX' | 'PICKUP' | 'WALL' | 'DESTRUCTIBLE' | 'EXIT' | 'NPC' | 'DECORATION' | 'SPAWNER' | 'SHRINE' | 'TERMINAL' | 'ARTIFACT';
  subType?: 'GRUNT' | 'HEAVY' | 'STALKER' | 'BOSS' | 'SNIPER' | 'STEALTH' | 'SUPPORT' | 'CRATE' | 'BARREL' | 'HAZARD' | 'MEDIC' | 'TRADER' | 'HANDLER' | 'GUARD' | 'TURRET' | 'FLOOR_CRACK' | 'VENT' | 'BLOOD' | 'PIPE' | 'CONSOLE' | 'SERVER' | 'LIGHT' | 'RUG' | 'BARRIER' | 'HOLO_TABLE' | 'SPAWN_NODE' | 'SHRINE_DMG' | 'SHRINE_SPEED' | 'SHRINE_HEAL' | 'NEON' | 'FAN' | 'GRAFFITI' | 'CABLE' | 'TRASH' | 'SLUDGE' | 'CITIZEN' | 'BENCH' | 'STREET_LIGHT' | 'SIGN_POST' | 'VENDING_MACHINE' | 'PLANT_BOX' | 'MURAL' | 'ECHO' | 'MONOLITH' | 'GATE_SEGMENT' | 'PILLAR';
  source?: 'PLAYER' | 'ENEMY' | 'ENVIRONMENT' | 'PSIONIC' | 'DEFENSE';
  exitType?: 'UP' | 'DOWN'; 
  transitionType?: 'GATE' | 'PORTAL' | 'WALK'; // Added for rendering context
  targetSector?: string; 
  x: number;
  y: number;
  z: number;
  width?: number; 
  height?: number; // Vertical Z-height
  depth?: number;  // Horizontal Y-depth (thickness)
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
  locked?: boolean;

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
  squadId?: number;
  aiRole?: 'ATTACKER' | 'SUPPORT' | 'TANK';
  
  // Optimization: Used for zero-allocation spatial hashing
  lastQueryId?: number;
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
  id: string; // Added ID for spatial hash lookups
  name: string;
  theme: ZoneTheme;
  groundColor: string;
  wallColor: string;
  detailColor: string;
  minDepth: number;
  difficultyMult: number;
  weather: 'NONE' | 'RAIN' | 'ASH';
  floorPattern: 'PLAIN' | 'GRID' | 'HAZARD' | 'ORGANIC' | 'HUB';
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
}
