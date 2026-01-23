
export const RENDER_CONFIG = {
  FRUSTUM_MARGIN: 500,
  MAX_CACHE_SIZE: 500,
  FLOOR_CACHE_PADDING: 500,
  FLOOR_TILE_SIZE: 200,
  MAX_CANVAS_DIMENSION: 4096,
  SAFE_MAX_DIMENSION: 2048, 
  Z_SORT_BATCH_SIZE: 100,
  PARTICLE_BATCH_SIZE: 50,
  TARGET_FPS: 60,
  ENABLE_DEBUG_OVERLAY: false,
  ENABLE_PERFORMANCE_MONITORING: true,
  GC_THRESHOLD_MS: 16.67,
  
  LIGHTING: {
    ENABLED: true,
    RESOLUTION_SCALE: 0.5,
    BLUR_QUALITY: 'medium',
    BASE_AMBIENT: 'rgba(0, 0, 0, 0.7)',
    PRESETS: {
      PLAYER_MAIN: { radius: 400, intensity: 1.0, color: '#ffffff', z: 40 },
      STREET_LIGHT: { radius: 450, intensity: 0.8, color: '#fbbf24', z: 250 },
      NEON: { radius: 250, intensity: 0.6, z: 50 },
      DYNAMIC_GLOW: { radius: 200, intensity: 0.5, z: 10 },
      PROJECTILE: { radiusMultiplier: 4, intensity: 0.7, z: 20 },
      EXIT: { radius: 300, intensity: 0.5, z: 10 },
      PARTICLE: { radiusMultiplier: 3, z: 10 },
      BOSS_ENEMY: { radius: 200, intensity: 0.6, color: '#ef4444', z: 30 }
    }
  },

  CAMERA: {
    BASE_ZOOM: 1.0,
    MIN_ZOOM: 0.6,
    MAX_ZOOM: 1.4,
    ZOOM_SPEED: 0.05, 
    SMOOTH_FACTOR: 0.1,
    POSITION_DAMPING: 0.08,
    LOOK_AHEAD_DIST: 20,
    BOUNDS_MARGIN: 100, 
    
    MIN_ZOOM_SENSITIVITY: 0.0005,
    MAX_ZOOM_SENSITIVITY: 0.002,
    
    PINCH_SENSITIVITY: 0.005,
    WHEEL_SENSITIVITY: 0.001,
    
    ROTATION_SENSITIVITY: 1.5,
    ROTATION_SMOOTHING: 0.15
  }
};

export const QUALITY_TIERS = [
  { name: 'LOW', shadow: false, lightScale: 0.25, particleCap: 100 },
  { name: 'MEDIUM', shadow: false, lightScale: 0.5, particleCap: 300 },
  { name: 'HIGH', shadow: true, lightScale: 0.5, particleCap: 600 }
];

export const RENDER_STATE = {
  currentTier: 2, // Start at HIGH (index 2)
  shadowsEnabled: true,
  lightingScale: 0.5,
  particleLimit: 600
};
