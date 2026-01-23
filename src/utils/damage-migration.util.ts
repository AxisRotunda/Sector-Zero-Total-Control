
import { Entity } from '../models/game.models';
import {
  DamagePacket,
  Resistances,
  createEmptyDamagePacket,
  createDefaultResistances
} from '../models/damage.model';

/**
 * Runtime migration utilities for legacy entities.
 */

/**
 * Migrates legacy damageValue to physical-only packet.
 */
export function migrateLegacyDamage(entity: Entity): void {
  // Skip if already using new system
  if (entity.damagePacket) return;

  // Convert legacy damage to physical
  if (entity.damageValue !== undefined) {
    entity.damagePacket = createEmptyDamagePacket();
    entity.damagePacket.physical = entity.damageValue;
    
    // Clear legacy property
    delete entity.damageValue;
  }
}

/**
 * Migrates legacy armor to physical resistance value.
 */
export function migrateLegacyArmor(entity: Entity): void {
  // Initialize resistances if missing
  if (!entity.resistances) {
    entity.resistances = createDefaultResistances();
  }

  // Move legacy armor to new system
  if (entity.armor !== undefined && entity.armor > 0) {
    entity.resistances.physical = entity.armor;
    entity.armor = 0; // Zero out but don't delete (backward compat)
  }
}

/**
 * Migrates legacy armorPen to penetration.
 */
export function migrateLegacyPenetration(entity: Entity): void {
  if (entity.armorPen !== undefined && entity.armorPen > 0) {
    if (!entity.penetration) {
      entity.penetration = {
        physical: 0,
        fire: 0,
        cold: 0,
        lightning: 0,
        chaos: 0
      };
    }

    // Legacy armorPen was flat value, convert to % penetration or use directly?
    // In legacy, armorPen was likely flat. In new system, penetration is %. 
    // Assuming 100 armor = 10% penetration for migration context
    entity.penetration.physical = Math.min(0.5, entity.armorPen / 100);
    
    delete entity.armorPen;
  }
}

/**
 * Full entity migration (call on world.entities array).
 */
export function migrateEntities(entities: Entity[]): void {
  entities.forEach(entity => {
    migrateLegacyDamage(entity);
    migrateLegacyArmor(entity);
    migrateLegacyPenetration(entity);
  });
}

/**
 * Validates entity damage configuration.
 */
export function validateDamageConfig(entity: Entity): string[] {
  const errors: string[] = [];

  // Check for mixed legacy/new systems
  if (entity.damageValue !== undefined && entity.damagePacket) {
    errors.push(`Entity has both damageValue and damagePacket`);
  }

  if (entity.armor > 0 && entity.resistances?.physical > 0) {
    errors.push(`Entity has both legacy armor and resistances.physical`);
  }

  // Validate resistance ranges
  if (entity.resistances) {
    Object.entries(entity.resistances).forEach(([type, value]) => {
      if (type === 'physical') {
        // Physical resistance is armor value (can be any positive)
        if (value < 0) {
          errors.push(`Invalid physical armor: ${value} (must be >= 0)`);
        }
      } else {
        // Elemental resistances are percentages
        if (value < -1.0 || value > 1.0) {
          errors.push(`Invalid ${type} resistance: ${value} (must be -100% to 100%)`);
        }
      }
    });
  }

  return errors;
}
