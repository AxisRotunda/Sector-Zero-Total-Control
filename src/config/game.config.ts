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

export const ZONES: Zone[] = [
    { name: 'Liminal Citadel', theme: 'INDUSTRIAL', groundColor: '#09090b', wallColor: '#27272a', detailColor: '#06b6d4', minDepth: 0, difficultyMult: 1.0, weather: 'ASH', floorPattern: 'HUB' },
    { name: 'Maintenance Tunnels', theme: 'INDUSTRIAL', groundColor: '#1c1917', wallColor: '#44403c', detailColor: '#78350f', minDepth: 1, difficultyMult: 1.5, weather: 'NONE', floorPattern: 'HAZARD' },
    { name: 'Residential Blocks', theme: 'RESIDENTIAL', groundColor: '#020617', wallColor: '#1e293b', detailColor: '#0f172a', minDepth: 6, difficultyMult: 2.5, weather: 'RAIN', floorPattern: 'PLAIN' },
    { name: 'Security Sector', theme: 'HIGH_TECH', groundColor: '#0f172a', wallColor: '#1e1b4b', detailColor: '#3b82f6', minDepth: 10, difficultyMult: 4.0, weather: 'NONE', floorPattern: 'GRID' },
    { name: 'The Core', theme: 'ORGANIC', groundColor: '#180303', wallColor: '#7f1d1d', detailColor: '#ef4444', minDepth: 15, difficultyMult: 6.0, weather: 'ASH', floorPattern: 'ORGANIC' }
];

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