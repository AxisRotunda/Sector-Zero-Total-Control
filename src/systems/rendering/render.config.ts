
export const RENDER_CONFIG = {
  FRUSTUM_MARGIN: 1000,
  MAX_CACHE_SIZE: 500,
  FLOOR_CACHE_PADDING: 500,
  FLOOR_TILE_SIZE: 200,
  MAX_CANVAS_DIMENSION: 4096,
  SAFE_MAX_DIMENSION: 2048, // Reduced limit for mobile safety (texture limit is often 4096, but memory is tight)
  Z_SORT_BATCH_SIZE: 100,
  PARTICLE_BATCH_SIZE: 50,
  TARGET_FPS: 60,
  ENABLE_DEBUG_OVERLAY: false,
  ENABLE_PERFORMANCE_MONITORING: true,
  GC_THRESHOLD_MS: 16.67, // 60fps frame budget
  
  // New Lighting Config
  LIGHTING: {
    ENABLED: true,
    RESOLUTION_SCALE: 0.5, // Render light map at half res for performance
    BLUR_QUALITY: 'medium', // low, medium, high
    BASE_AMBIENT: 'rgba(0, 0, 0, 0.7)' // Default darkness
  }
};
