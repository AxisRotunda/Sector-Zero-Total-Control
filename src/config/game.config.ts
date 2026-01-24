import { Zone } from '../models/game.models';

export const SAVE_KEY = 'sector_zero_save_tower_v2';

export const CAMERA = {
    LOOK_AHEAD: 100,
};

export const WORLD = {
    FLOOR_SIZE: 3000, 
    CHUNK_SIZE: 1200,
};

export const INVENTORY = {
    BAG_SIZE: 20,
};

export const LOOT_CHANCES = {
    DESTRUCTIBLE_DROP: 0.4,
    ENEMY_DROP: 0.25,
    UNCOMMON: 0.6,
    RARE: 0.85,
    BLACK_MARKET: 0.96,
};

export const SKILL_TREE_GEN = {
    LAYERS: 5,
    BRANCHES: 6,
    RADIUS_STEP: 120,
};

export const LOOT_NAMES = {
    PREFIXES: ['Standard', 'Reinforced', 'Military', 'Spec-Ops', 'Illegal', 'Prototype', 'Corrupted', 'Ascended'],
    SUFFIXES: {
      'WEAPON': ['Baton', 'Crowbar', 'Machete', 'Sledge', 'Katana', 'Taser', 'Blade', 'Breaker'],
      'ARMOR': ['Vest', 'Plating', 'Jacket', 'Rig', 'Exo-Shell', 'Weave', 'Carapace'],
      'IMPLANT': ['Chip', 'Optics', 'Cortex', 'Link', 'Injector', 'Node', 'Socket'],
      'STIM': ['Adrenaline', 'Focus', 'Rage', 'Reflex', 'Booster', 'Cocktail', 'Serum'],
      'AMULET': ['Relic', 'Charm', 'Talisman', 'Amulet', 'Pendant'],
      'RING': ['Band', 'Loop', 'Ring', 'Signet', 'Coil']
    }
};