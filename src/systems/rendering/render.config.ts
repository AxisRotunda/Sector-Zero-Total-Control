
export const RENDER_CONFIG = {
  FRUSTUM_MARGIN: 500, // Reduced margin for tighter culling
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
    BASE_AMBIENT: 'rgba(0, 0, 0, 0.7)'
  },

  CAMERA: {
    BASE_ZOOM: 1.0,
    MIN_ZOOM: 0.6,
    MAX_ZOOM: 1.4,
    ZOOM_SPEED: 0.05, // Speed of interpolation
    SMOOTH_FACTOR: 0.1,
    POSITION_DAMPING: 0.08, // Tighter tracking
    LOOK_AHEAD_DIST: 20,
    BOUNDS_MARGIN: 100, // Cushion against map edges
    
    // Dynamic Sensitivity Curve
    MIN_ZOOM_SENSITIVITY: 0.0005, // Slower when zoomed out (Tactical)
    MAX_ZOOM_SENSITIVITY: 0.002,  // Faster when zoomed in (Detail)
    
    PINCH_SENSITIVITY: 0.005,
    WHEEL_SENSITIVITY: 0.001
  }
};
