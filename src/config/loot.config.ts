import { ItemType } from '../models/item.models';

export const RARITY_WEIGHTS = {
    COMMON: 60,
    UNCOMMON: 25,
    RARE: 12,
    BLACK_MARKET: 3
};

export const TYPE_WEIGHTS = {
    WEAPON: 15,
    ARMOR: 15,
    IMPLANT: 15,
    STIM: 20,
    PSI_BLADE: 10,
    AMULET: 12,
    RING: 13
};

export const BASE_STATS: { [key in ItemType]: { [stat: string]: number } } = {
    'WEAPON': { dmg: 8 },
    'ARMOR': { hp: 40 },
    'IMPLANT': { cdr: 2, speed: 0.05 },
    'PSI_BLADE': { dmg: 5, psy: 8 },
    'STIM': { hp: 0 },
    'AMULET': { psy: 10, cdr: 5 },
    'RING': { crit: 5, dmg: 2 }
};