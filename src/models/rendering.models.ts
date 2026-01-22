
export interface LightSource {
    id: string;
    x: number;
    y: number;
    z?: number;
    radius: number;
    color: string; // Hex or RGBA
    intensity: number; // 0.0 to 1.0
    type: 'STATIC' | 'DYNAMIC' | 'PULSE' | 'FLICKER';
    
    // For animated lights
    baseIntensity?: number;
    flickerSpeed?: number;
    pulseOffset?: number;
}

export interface GlobalIllumination {
    ambientColor: string;
    intensity: number;
}
