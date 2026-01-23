
/**
 * Multi-type damage packet.
 */
export interface DamagePacket {
  physical: number;
  fire: number;
  cold: number;
  lightning: number;
  chaos: number;
}

/**
 * Per-type resistances.
 */
export interface Resistances {
  physical: number;    // Armor value (flat)
  fire: number;        // Percentage (0.0 to 1.0)
  cold: number;        // Percentage
  lightning: number;   // Percentage
  chaos: number;       // Percentage
}

/**
 * Resistance penetration.
 */
export interface Penetration {
  physical: number;
  fire: number;
  cold: number;
  lightning: number;
  chaos: number;
}

/**
 * Result of damage calculation with type breakdown.
 */
export interface DamageResult {
  total: number;
  breakdown: DamagePacket;
  isCrit: boolean;
  penetratedResistances: Resistances;
}

export interface DamageConversion {
  physicalToFire?: number;
  physicalToCold?: number;
  physicalToLightning?: number;
  physicalToChaos?: number;
}

export function createEmptyDamagePacket(): DamagePacket {
  return { physical: 0, fire: 0, cold: 0, lightning: 0, chaos: 0 };
}

export function createDefaultResistances(): Resistances {
  return { physical: 0, fire: 0, cold: 0, lightning: 0, chaos: 0 };
}

export function createZeroPenetration(): Penetration {
  return { physical: 0, fire: 0, cold: 0, lightning: 0, chaos: 0 };
}

export function calculateTotalDamage(packet: DamagePacket): number {
  return packet.physical + packet.fire + packet.cold + packet.lightning + packet.chaos;
}

export const DAMAGE_TYPE_COLORS = {
  physical: '#d4d4d4',   // Gray
  fire: '#f97316',       // Orange
  cold: '#3b82f6',       // Blue
  lightning: '#eab308',  // Yellow
  chaos: '#a855f7'       // Purple
} as const;

export const RESISTANCE_CAPS = {
  fire: 0.75,
  cold: 0.75,
  lightning: 0.75,
  chaos: 0.75
} as const;

export const RESISTANCE_FLOOR = -1.0; 
