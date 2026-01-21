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