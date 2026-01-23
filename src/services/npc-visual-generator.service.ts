
import { Injectable } from '@angular/core';
import { VisualProfile, Entity } from '../models/game.models';

@Injectable({
  providedIn: 'root'
})
export class NpcVisualGeneratorService {

  generate(type: string, subType: string | undefined, factionId?: string): VisualProfile {
    // 1. Base Humanoid Profile
    const profile: VisualProfile = {
      headType: 'NONE',
      bodyType: 'STANDARD',
      clothingType: 'UNIFORM',
      accessoryType: 'NONE',
      faceType: 'NONE',
      colors: {
        primary: '#71717a',
        secondary: '#3f3f46',
        skin: '#d4d4d8', // Synthetic skin default
        hair: '#18181b',
        accent: '#06b6d4'
      },
      scaleHeight: 1.0,
      scaleWidth: 1.0
    };

    // 2. Faction-Based Overrides
    if (factionId === 'VANGUARD') {
      profile.clothingType = 'ARMOR';
      profile.colors.primary = '#1e293b'; // Navy Slate
      profile.colors.secondary = '#94a3b8'; // Light Slate
      profile.colors.accent = '#06b6d4'; // Cyan
      profile.faceType = 'VISOR';
    } else if (factionId === 'REMNANT') {
      profile.clothingType = 'ROBE';
      profile.colors.primary = '#431407'; // Rust Brown
      profile.colors.secondary = '#f97316'; // Orange
      profile.colors.accent = '#f59e0b'; // Amber
      profile.headType = 'HOOD';
    } else if (factionId === 'RESONANT') {
      profile.clothingType = 'COAT';
      profile.colors.primary = '#3b0764'; // Deep Purple
      profile.colors.secondary = '#a855f7'; // Purple
      profile.colors.accent = '#d8b4fe'; // Light Purple
      profile.accessoryType = 'CAPE';
    }

    // 3. SubType Specific Overrides (Trumps Faction)
    switch (subType) {
      case 'GUARD':
        profile.clothingType = 'ARMOR';
        profile.headType = 'HELMET';
        profile.accessoryType = 'NONE';
        profile.colors.primary = '#1e3a8a'; // Guard Blue
        profile.scaleWidth = 1.1;
        break;
        
      case 'MEDIC':
        profile.clothingType = 'COAT';
        profile.colors.primary = '#ef4444'; // Medic Red
        profile.colors.secondary = '#ffffff';
        profile.accessoryType = 'BACKPACK';
        profile.headType = 'CAP';
        break;

      case 'TRADER':
        profile.clothingType = 'COAT';
        profile.colors.primary = '#eab308'; // Gold
        profile.accessoryType = 'BACKPACK'; // Big bag for loot
        profile.headType = Math.random() > 0.5 ? 'BALD' : 'BUN_HAIR';
        profile.faceType = 'GOGGLES';
        profile.scaleWidth = 1.2; // Bulky with gear
        break;

      case 'CITIZEN':
        profile.clothingType = Math.random() > 0.5 ? 'RAGS' : 'VEST';
        profile.colors.primary = Math.random() > 0.5 ? '#57534e' : '#4b5563';
        profile.headType = Math.random() > 0.7 ? 'HOOD' : 'NONE';
        profile.scaleHeight = 0.9 + Math.random() * 0.15;
        break;

      case 'HANDLER':
        profile.clothingType = 'UNIFORM';
        profile.colors.primary = '#3b82f6';
        profile.faceType = 'EYEPATCH';
        profile.headType = 'SPIKEY_HAIR';
        break;

      case 'HEAVY': // Enemy
        profile.clothingType = 'ARMOR';
        profile.headType = 'HELMET';
        profile.scaleWidth = 1.4;
        profile.scaleHeight = 1.2;
        profile.colors.accent = '#f59e0b';
        break;

      case 'STALKER': // Enemy
        profile.clothingType = 'VEST';
        profile.faceType = 'GOGGLES';
        profile.headType = 'HOOD';
        profile.scaleWidth = 0.9;
        profile.accessoryType = 'POUCHES';
        break;
      
      case 'SNIPER': // Enemy
        profile.clothingType = 'COAT';
        profile.faceType = 'VISOR';
        profile.colors.accent = '#ef4444'; // Red laser eye
        break;
    }

    // 4. Random Variance (if Generic)
    if (!subType && type === 'NPC') {
       if (Math.random() > 0.5) profile.accessoryType = 'POUCHES';
       if (Math.random() > 0.8) profile.faceType = 'MASK';
    }

    return profile;
  }
}
