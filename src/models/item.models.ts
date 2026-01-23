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
  name: 'Unarmed Strike',
  type: 'WEAPON',
  shape: 'chip',
  rarity: 'COMMON',
  level: 1,
  color: '#fbbf24', // Gold
  stats: {
    dmg: 5,        // Low base damage
    spd: 1.5,      // Fast attack speed
    reach: 40,     // Short range
    crit: 5,       // 5% base crit
    ls: 0,
    armorPen: 0
  },
  stack: 1,
  maxStack: 1
};