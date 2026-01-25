
import { Item } from "./item.models";
import { DamagePacket, Resistances, Penetration, DamageConversion, StatusEffects } from './damage.model';

export type SectorId = string;

export enum RenderLayer {
  FLOOR = 0,           // z < 5: Ground tiles, shadows
  GROUND = 1,          // z < 80: Characters, low decorations
  ELEVATED = 2,        // z >= 80: Platforms, bridges
  OVERHEAD = 3,        // z >= 300: Roofs, flying entities
  UI = 4               // Always on top
}

export interface SortMetadata {
    min: number;
    max: number;
    center: number;
}

// Standardized Interface for 3D Structures
export interface Volumetric {
    width?: number;  // X-axis span
    depth?: number;  // Y-axis span (for top-down/iso collisions)
    height?: number; // Z-axis span (visual height)
}

export interface VisualProfile {
    headType: 'NONE' | 'HELMET' | 'HOOD' | 'CAP' | 'BALD' | 'SPIKEY_HAIR' | 'BUN_HAIR';
    bodyType: 'STANDARD' | 'BULKY' | 'SLENDER';
    clothingType: 'UNIFORM' | 'RAGS' | 'ARMOR' | 'COAT' | 'ROBE' | 'VEST';
    accessoryType: 'NONE' | 'BACKPACK' | 'CAPE' | 'POUCHES' | 'RADIO';
    faceType: 'NONE' | 'VISOR' | 'MASK' | 'GOGGLES' | 'EYEPATCH';
    colors: {
        primary: string;   // Main cloth/armor
        secondary: string; // Detail/Trim
        skin: string;      // Exposed skin
        hair: string;      // Hair/Helmet detail
        accent: string;    // Glows/Visors
    };
    scaleHeight?: number; // Variance in height
    scaleWidth?: number;  // Variance in width
}

export interface Entity extends Volumetric {
  id: number;
  zoneId?: string; 
  chunkId?: string; // Spatial Partition ID
  type: 'PLAYER' | 'ENEMY' | 'HITBOX' | 'PICKUP' | 'WALL' | 'DESTRUCTIBLE' | 'EXIT' | 'NPC' | 'DECORATION' | 'SPAWNER' | 'SHRINE' | 'TERMINAL' | 'ARTIFACT' | 'INTERACTABLE';
  subType?: 'GRUNT' | 'HEAVY' | 'STALKER' | 'BOSS' | 'SNIPER' | 'STEALTH' | 'SUPPORT' | 'CRATE' | 'BARREL' | 'HAZARD' | 'MEDIC' | 'TRADER' | 'HANDLER' | 'GUARD' | 'TURRET' | 'FLOOR_CRACK' | 'VENT' | 'BLOOD' | 'PIPE' | 'CONSOLE' | 'SERVER' | 'LIGHT' | 'RUG' | 'BARRIER' | 'HOLO_TABLE' | 'SPAWN_NODE' | 'SHRINE_DMG' | 'SHRINE_SPEED' | 'SHRINE_HEAL' | 'NEON' | 'FAN' | 'GRAFFITI' | 'CABLE' | 'TRASH' | 'SLUDGE' | 'CITIZEN' | 'BENCH' | 'STREET_LIGHT' | 'SIGN_POST' | 'VENDING_MACHINE' | 'PLANT_BOX' | 'MURAL' | 'ECHO' | 'MONOLITH' | 'GATE_SEGMENT' | 'PILLAR' | 'GENERIC' | 'OVERSEER_EYE' | 'DYNAMIC_GLOW' | 'OBSERVATION_DECK' | 'TRAINING_EXTERIOR' | 'ZONE_TRANSITION' | 'STASH' | 'RIFTGATE' | 'PORTAL' | 'MAGLEV_TRAIN' | 'INFO_KIOSK' | 'BANNER' | 'HOLO_SIGN';
  source?: 'PLAYER' | 'ENEMY' | 'ENVIRONMENT' | 'PSIONIC' | 'DEFENSE';
  exitType?: 'UP' | 'DOWN'; 
  targetSector?: string; 
  spawnOverride?: { x: number; y: number }; // Target spawn coordinates when transitioning via this entity
  x: number;
  y: number;
  z: number;
  
  // Persistence Lifecycle
  persistenceTag?: 'PERSISTENT' | 'SESSION' | 'TEMPORARY';

  // Render Sorting & Layers
  isoDepth?: number; 
  renderLayer?: RenderLayer;
  // Transient sorting metadata (calculated per frame, not saved)
  _sortMeta?: SortMetadata;
  _depthKey?: number; // Pre-calculated depth for O(1) comparator

  vx: number;
  vy: number;
  angle: number;
  radius: number;
  hp: number;
  maxHp: number;
  armor: number; // Legacy Physical Armor Value
  level?: number; // Entity Level
  
  // Combat Stats (Explicit)
  damageValue?: number; // Legacy Flat Damage
  
  // New Damage System
  damagePacket?: DamagePacket;
  resistances?: Resistances;
  penetration?: Penetration;
  damageConversion?: DamageConversion;

  armorPen?: number; // Legacy
  critChance?: number;
  
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
  weaponTrail?: {x: number, y: number, angle: number, alpha: number}[]; // New: Weapon trail for swings
  status: StatusEffects;
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
  
  // Collision State
  hitIds?: Set<number>; // Tracks IDs of entities already hit by this instance

  invulnerable?: boolean; // New: Iframes support
  iframeTimer?: number; // New: Frame-based invulnerability countdown
  
  // Resistance modifiers for Status Effects (legacy structure, consider migrating to main resistances later)
  statusResistances?: {
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
  
  // Visual Customization
  visuals?: VisualProfile;

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

export type ZoneTheme = 'INDUSTRIAL' | 'RESIDENTIAL' | 'HIGH_TECH' | 'ORGANIC' | 'VOID' | 'FROZEN';

export interface Zone {
  id: string; 
  name: string;
  theme: ZoneTheme;
  groundColor: string;
  wallColor: string;
  detailColor: string;
  minDepth: number;
  difficultyMult: number;
  weather: 'NONE' | 'RAIN' | 'ASH' | 'SNOW';
  floorPattern: 'PLAIN' | 'GRID' | 'HAZARD' | 'ORGANIC' | 'HUB';
  isTrainingZone?: boolean;
  isSafeZone?: boolean; // Disables combat
  ambientColor?: string;
}

export interface Camera {
    x: number;
    y: number;
    zoom: number;
    rotation: number; // Radians
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
  priority?: number; // Optimization: Higher priority survives culling
  
  // Render Sorting
  isoDepth?: number;
  renderLayer?: RenderLayer; // Layer override for particles
  _sortMeta?: SortMetadata;
  _depthKey?: number;
}
