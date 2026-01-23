
import { DamagePacket, Penetration, DamageConversion, StatusEffects } from './damage.model';

export type Rarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'BLACK_MARKET';
export type ItemType = 'WEAPON' | 'ARMOR' | 'IMPLANT' | 'STIM' | 'PSI_BLADE' | 'AMULET' | 'RING';
export type ItemShape = 'sword' | 'shield' | 'chip' | 'syringe' | 'psiBlade' | 'amulet' | 'ring' | 'pistol' | 'rifle' | 'shotgun' | 'railgun';

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

  // Extended Combat Properties
  damagePacket?: DamagePacket;
  penetration?: Penetration;
  damageConversion?: DamageConversion;
  status?: Partial<StatusEffects>;
  
  // Ranged Properties
  projectile?: {
      speed: number;
      count: number;     // e.g. Shotgun = 5
      spread: number;    // Angle variance in radians
      range: number;     // Max distance/time
      renderType: 'BULLET' | 'PLASMA' | 'RAIL' | 'ROCKET';
      fireRate?: number; // Delay in frames (optional override)
  };
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
    dmg: 8,        
    spd: 2.0,      
    reach: 75,     
    crit: 15,      
    ls: 0,
    armorPen: 5    
  },
  stack: 1,
  maxStack: 1
};
