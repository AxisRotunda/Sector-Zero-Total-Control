
export const PLAYER = {
    BASE_HP: 100,
    BASE_SPEED: 5,
    SPEED_STAT_SCALE: 0.1,
    XP_PER_LEVEL: 750,
    PRIMARY_ATTACK_DURATION: 15,
    HIT_FLASH_DURATION: 20,
};

export const SKILL_TREE = {
    PHYS_HP_SCALE: 3,
    PHYS_DMG_SCALE: 1.5,
    TECH_SPEED_SCALE: 0.01,
    PSI_CDR_SCALE: 0.02,
    ARMOR_PEN_COST: 2,
};

export const COOLDOWNS = {
    PRIMARY: 25,
    SECONDARY: 240,
    DASH: 90,
    UTILITY: 300,
    CDR_CAP: 0.7,
};

export const ABILITIES = {
    PRIMARY_REACH_BASE: 50,
    PRIMARY_REACH_DMG_SCALE: 0.1,
    SECONDARY_RADIUS_BASE: 150,
    SECONDARY_RADIUS_PSI_SCALE: 2,
    SECONDARY_STUN_DURATION: 90,
    DASH_DISTANCE: 180,
};

export const LOOT = {
    WEAPON_DMG_BASE: 10,
    WEAPON_DMG_SCALE: 3,
    ARMOR_HP_BASE: 50,
    ARMOR_HP_SCALE: 8,
    IMPLANT_CDR_SCALE: 0.8,
    IMPLANT_SPEED_SCALE: 0.4,
    STIM_CRIT_BASE: 5,
    STIM_CRIT_SCALE: 0.8,
    STIM_LIFESTEAL_BASE: 2,
    STIM_LIFESTEAL_SCALE: 0.2,
    RARE_BONUS_CRIT: 5,
    RARE_BONUS_DMG: 5,
    RARE_BONUS_HP: 50,
};

export const COMBAT = {
    CRIT_MULTIPLIER: 1.5,
    AUTO_ATTACK_RANGE: 400,
    HIT_STOP_FRAMES: 3,
    KNOCKBACK_FORCE: 8,
};

export const DAMAGE_TYPES = {
  // Base damage multipliers per enemy type
  ENEMY_TYPES: {
    MELEE: { physical: 1.0, fire: 0, cold: 0, lightning: 0, chaos: 0 },
    RANGED: { physical: 0.7, fire: 0, cold: 0, lightning: 0.3, chaos: 0 },
    ELITE: { physical: 0.5, fire: 0.3, cold: 0.2, lightning: 0, chaos: 0 },
    BOSS: { physical: 0.4, fire: 0.2, cold: 0.2, lightning: 0.1, chaos: 0.1 }
  },
  // Resistances (Flat for phys, % for others)
  RESISTANCES: {
    TRASH: { physical: 0, fire: 0, cold: 0, lightning: 0, chaos: -0.25 },
    ELITE: { physical: 100, fire: 0.2, cold: 0.2, lightning: 0.2, chaos: 0 },
    BOSS: { physical: 500, fire: 0.4, cold: 0.4, lightning: 0.4, chaos: 0.2 }
  },
  // Level scaling parameters
  LEVEL_SCALING: {
    BASE_DAMAGE: 10,           // Starting damage at level 1
    PER_LEVEL: 2.5,            // Linear scaling per level
    QUADRATIC_FACTOR: 0.1      // Level^2 scaling (makes high level dangerous)
  }
} as const;

export const ENVIRONMENT = {
    BARREL_EXPLOSION_DMG: 80,
    BARREL_EXPLOSION_RADIUS: 120,
    BARREL_EXPLOSION_STUN: 30,
};

export const PARTICLE = {
    GRAVITY: 0.5,
    LIFESPAN_DECAY: 0.05,
};

export const STATUS = {
    BURN_DPS: 5,
    BURN_DURATION: 180,
    POISON_DPS: 3,
    POISON_DURATION: 300,
    WEAKNESS_DURATION: 120,
    WEAKNESS_DMG_REDUCTION: 0.3,
    WEAKNESS_ARMOR_REDUCTION: 0.5,
    TICK_RATE: 30, 
    BLEED_DPS: 3,
    BLEED_DURATION: 180,
    BLEED_MAX_STACKS: 5,
};

export const SHAKE = {
    HIT: { intensity: 3, decay: 0.9 },
    CRIT: { intensity: 6, decay: 0.85 },
    EXPLOSION: { intensity: 15, decay: 0.8 },
    STEP: { intensity: 0.5, decay: 0.8 }
};

export const ENEMY_AI = {
    HIT_STOP_FRAMES_LIGHT: 3,
    HIT_STOP_FRAMES_HEAVY: 8,
    SQUAD_FORMATION_SPACING: 80,
    SUPPORT_HEAL_AMOUNT: 20,
    SUPPORT_COOLDOWN: 300,
    COVER_SEEK_DISTANCE: 250,
    COVER_HP_THRESHOLD: 0.5
};
