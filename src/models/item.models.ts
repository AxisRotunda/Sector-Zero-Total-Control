
export type Rarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'BLACK_MARKET';
export type ItemType = 'WEAPON' | 'ARMOR' | 'IMPLANT' | 'STIM' | 'PSI_BLADE' | 'AMULET' | 'RING';
export type ItemShape = 'sword' | 'shield' | 'chip' | 'syringe' | 'psiBlade' | 'amulet' | 'ring';

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  shape: ItemShape;
  rarity: Rarity;
  level: number;
  stats: { [key: string]: number };
  color: string;
  stack: number;
  maxStack: number;
}

export const UNARMED_WEAPON: Item = {
  id: 'FIST_BASE',
  name: 'Kinetic Arts',
  type: 'WEAPON',
  shape: 'chip', // Placeholder shape, not rendered
  rarity: 'COMMON',
  level: 1,
  color: '#fbbf24', // Gold
  stats: {
    dmg: 8,        // Buffed from 6
    spd: 2.0,      // Very fast base speed
    reach: 75,     // Buffed from 35/45 to 75
    crit: 15,      // High base crit (Martial precision)
    ls: 0,
    armorPen: 5    // Innate armor piercing (Targeting weak points)
  },
  stack: 1,
  maxStack: 1
};
