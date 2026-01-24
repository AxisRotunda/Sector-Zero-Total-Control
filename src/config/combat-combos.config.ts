
export type SwingType = 'SLASH_RIGHT' | 'SLASH_LEFT' | 'THRUST' | 'OVERHEAD' | 'SPIN';

export interface ComboStep {
    damageMult: number;
    knockback: number;
    radiusMult: number;
    // Timing (in frames @ 60fps)
    durationTotal: number;
    hitboxStart: number;
    hitboxEnd: number;
    // Physics
    forwardLunge: number;
    // Visuals
    swingType: SwingType;
    trailColor?: string;
    sound: 'SWOOSH' | 'WHOOSH' | 'HEAVY_SWING';
    shake: number;
}

export interface WeaponArchetype {
    id: string;
    chain: ComboStep[];
}

export const MELEE_COMBOS: Record<string, WeaponArchetype> = {
    // Standard 3-hit chain for Swords/Batons
    'STANDARD': {
        id: 'STANDARD',
        chain: [
            { 
                damageMult: 1.0, knockback: 5, radiusMult: 1.0, 
                durationTotal: 18, hitboxStart: 4, hitboxEnd: 8, 
                forwardLunge: 8, swingType: 'SLASH_RIGHT', sound: 'SWOOSH', shake: 1 
            },
            { 
                damageMult: 1.2, knockback: 8, radiusMult: 1.1, 
                durationTotal: 18, hitboxStart: 4, hitboxEnd: 8, 
                forwardLunge: 10, swingType: 'SLASH_LEFT', sound: 'SWOOSH', shake: 2 
            },
            { 
                damageMult: 2.5, knockback: 25, radiusMult: 1.3, 
                durationTotal: 24, hitboxStart: 8, hitboxEnd: 14, 
                forwardLunge: 20, swingType: 'THRUST', sound: 'WHOOSH', shake: 5 
            }
        ]
    },
    // Faster, lower damage chain for Psi-Blades / Daggers
    'FAST': {
        id: 'FAST',
        chain: [
            { 
                damageMult: 0.8, knockback: 2, radiusMult: 0.9, 
                durationTotal: 12, hitboxStart: 2, hitboxEnd: 5, 
                forwardLunge: 12, swingType: 'SLASH_RIGHT', sound: 'SWOOSH', shake: 0 
            },
            { 
                damageMult: 0.8, knockback: 2, radiusMult: 0.9, 
                durationTotal: 12, hitboxStart: 2, hitboxEnd: 5, 
                forwardLunge: 12, swingType: 'SLASH_LEFT', sound: 'SWOOSH', shake: 0 
            },
            { 
                damageMult: 1.5, knockback: 10, radiusMult: 1.0, 
                durationTotal: 16, hitboxStart: 4, hitboxEnd: 8, 
                forwardLunge: 25, swingType: 'SPIN', sound: 'WHOOSH', shake: 2 
            }
        ]
    },
    // Heavy slow chain for Hammers/Axes (Future proofing)
    'HEAVY': {
        id: 'HEAVY',
        chain: [
            { 
                damageMult: 1.5, knockback: 20, radiusMult: 1.2, 
                durationTotal: 30, hitboxStart: 12, hitboxEnd: 18, 
                forwardLunge: 5, swingType: 'OVERHEAD', sound: 'HEAVY_SWING', shake: 4 
            },
            { 
                damageMult: 3.0, knockback: 50, radiusMult: 1.5, 
                durationTotal: 40, hitboxStart: 15, hitboxEnd: 25, 
                forwardLunge: 15, swingType: 'OVERHEAD', sound: 'HEAVY_SWING', shake: 8 
            }
        ]
    }
};
