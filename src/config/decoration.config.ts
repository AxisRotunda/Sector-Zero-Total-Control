
import { ZoneTheme } from "../models/game.models";

export interface DecorationDef {
    id: string;
    width: number;
    depth: number;
    height: number;
    baseColor: string;
    isStaticFloor: boolean; // If true, baked into floor cache. If false, rendered as sorted entity.
    renderStyle: 'PRISM' | 'CYLINDER' | 'FLAT' | 'CUSTOM';
    detailStyle?: 'NONE' | 'RIVETS' | 'CIRCUITS' | 'GLYPHS' | 'PLATING';
    defaultTheme?: ZoneTheme;
}

export const DECORATIONS: Record<string, DecorationDef> = {
    // --- STATIC FLOOR DECORATIONS ---
    'RUG': { id: 'RUG', width: 400, depth: 400, height: 0, baseColor: '#27272a', isStaticFloor: true, renderStyle: 'FLAT' },
    'FLOOR_CRACK': { id: 'FLOOR_CRACK', width: 60, depth: 60, height: 0, baseColor: '#000', isStaticFloor: true, renderStyle: 'FLAT' },
    'GRAFFITI': { id: 'GRAFFITI', width: 100, depth: 100, height: 0, baseColor: '#ef4444', isStaticFloor: true, renderStyle: 'FLAT' },
    'TRASH': { id: 'TRASH', width: 40, depth: 40, height: 0, baseColor: '#52525b', isStaticFloor: true, renderStyle: 'FLAT' },
    
    // --- DYNAMIC / 3D DECORATIONS ---
    'CRATE': { id: 'CRATE', width: 40, depth: 40, height: 40, baseColor: '#a16207', isStaticFloor: false, renderStyle: 'PRISM', detailStyle: 'PLATING' },
    'BARREL': { id: 'BARREL', width: 30, depth: 30, height: 40, baseColor: '#ef4444', isStaticFloor: false, renderStyle: 'CYLINDER', detailStyle: 'RIVETS' },
    'BENCH': { id: 'BENCH', width: 80, depth: 30, height: 20, baseColor: '#3f3f46', isStaticFloor: false, renderStyle: 'PRISM' },
    'VENDING_MACHINE': { id: 'VENDING_MACHINE', width: 50, depth: 50, height: 100, baseColor: '#27272a', isStaticFloor: false, renderStyle: 'CUSTOM' },
    'HOLO_TABLE': { id: 'HOLO_TABLE', width: 80, depth: 80, height: 40, baseColor: '#18181b', isStaticFloor: false, renderStyle: 'CUSTOM' },
    'CONSOLE': { id: 'CONSOLE', width: 40, depth: 30, height: 50, baseColor: '#38bdf8', isStaticFloor: false, renderStyle: 'PRISM', detailStyle: 'CIRCUITS' },
    'CABLE': { id: 'CABLE', width: 10, depth: 10, height: 10, baseColor: '#18181b', isStaticFloor: false, renderStyle: 'CUSTOM' },
    'VENT': { id: 'VENT', width: 60, depth: 20, height: 60, baseColor: '#52525b', isStaticFloor: false, renderStyle: 'CUSTOM' },
    'SLUDGE': { id: 'SLUDGE', width: 100, depth: 100, height: 0, baseColor: '#10b981', isStaticFloor: false, renderStyle: 'CUSTOM' },
    'PLANT_BOX': { id: 'PLANT_BOX', width: 60, depth: 60, height: 30, baseColor: '#064e3b', isStaticFloor: false, renderStyle: 'PRISM' },
    'SIGN_POST': { id: 'SIGN_POST', width: 10, depth: 10, height: 120, baseColor: '#71717a', isStaticFloor: false, renderStyle: 'PRISM' },
    'STREET_LIGHT': { id: 'STREET_LIGHT', width: 10, depth: 10, height: 250, baseColor: '#18181b', isStaticFloor: false, renderStyle: 'CUSTOM' },
    'MONOLITH': { id: 'MONOLITH', width: 200, depth: 200, height: 600, baseColor: '#06b6d4', isStaticFloor: false, renderStyle: 'CUSTOM' },
    'OBSERVATION_DECK': { id: 'OBSERVATION_DECK', width: 400, depth: 400, height: 200, baseColor: '#3f3f46', isStaticFloor: false, renderStyle: 'CUSTOM' },
    'TRAINING_EXTERIOR': { id: 'TRAINING_EXTERIOR', width: 500, depth: 400, height: 350, baseColor: '#3f3f46', isStaticFloor: false, renderStyle: 'CUSTOM' },
    'DYNAMIC_GLOW': { id: 'DYNAMIC_GLOW', width: 100, depth: 100, height: 10, baseColor: '#fff', isStaticFloor: false, renderStyle: 'CUSTOM' },
    'NEON': { id: 'NEON', width: 60, depth: 10, height: 30, baseColor: '#fff', isStaticFloor: false, renderStyle: 'CUSTOM' },
    'OVERSEER_EYE': { id: 'OVERSEER_EYE', width: 60, depth: 60, height: 60, baseColor: '#fff', isStaticFloor: false, renderStyle: 'CUSTOM' },
    
    // NEW VISUALS
    'MAGLEV_TRAIN': { id: 'MAGLEV_TRAIN', width: 800, depth: 120, height: 160, baseColor: '#0ea5e9', isStaticFloor: false, renderStyle: 'CUSTOM' },
    'INFO_KIOSK': { id: 'INFO_KIOSK', width: 60, depth: 20, height: 100, baseColor: '#1e293b', isStaticFloor: false, renderStyle: 'CUSTOM' },
    'BARRIER': { id: 'BARRIER', width: 20, depth: 20, height: 100, baseColor: '#ef4444', isStaticFloor: false, renderStyle: 'CUSTOM' },
    
    // PROPAGANDA & SYMBOLS
    'BANNER': { id: 'BANNER', width: 60, depth: 10, height: 180, baseColor: '#06b6d4', isStaticFloor: false, renderStyle: 'CUSTOM' },
    'HOLO_SIGN': { id: 'HOLO_SIGN', width: 100, depth: 10, height: 60, baseColor: '#06b6d4', isStaticFloor: false, renderStyle: 'CUSTOM' }
};
