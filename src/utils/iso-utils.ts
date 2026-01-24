
export const IsoUtils = {
  // Global rotation state for the current render frame
  _rotation: 0,
  _sin: 0,
  _cos: 1,
  _cx: 0, // Center X (Camera World X)
  _cy: 0, // Center Y (Camera World Y)

  /**
   * Sets the rotation context for subsequent toIso/fromIso calls.
   * Call this at the start of a render frame with the camera's properties.
   */
  setContext(rotation: number, centerX: number, centerY: number) {
    this._rotation = rotation;
    this._cx = centerX;
    this._cy = centerY;
    this._sin = Math.sin(rotation);
    this._cos = Math.cos(rotation);
  },

  /**
   * Converts World (Cartesian) to Screen (Isometric).
   * Applies rotation around the set context center.
   */
  toIso: function(x: number, y: number, z: number = 0, out: {x: number, y: number} = {x:0, y:0}) {
    // 1. Rotate around camera center
    let rx = x;
    let ry = y;

    if (this._rotation !== 0) {
        const dx = x - this._cx;
        const dy = y - this._cy;
        rx = dx * this._cos - dy * this._sin + this._cx;
        ry = dx * this._sin + dy * this._cos + this._cy;
    }

    // 2. Isometric Projection
    out.x = (rx - ry);
    out.y = (rx + ry) * 0.5 - z;
    return out;
  },

  /**
   * Converts Screen (Isometric) to World (Cartesian).
   * Reverses the rotation applied by toIso.
   */
  fromIso: function(screenX: number, screenY: number, out: {x: number, y: number} = {x:0, y:0}) {
    // 1. Inverse Projection (assuming z=0 for ground plane clicks)
    const y = screenY; 
    const x = screenX; 
    
    const ry = y - 0.5 * x;
    const rx = y + 0.5 * x;

    // 2. Inverse Rotation (Rotate by -angle around center)
    if (this._rotation !== 0) {
        const dx = rx - this._cx;
        const dy = ry - this._cy;
        
        // Inverse rotation matrix
        out.x = dx * this._cos - dy * (-this._sin) + this._cx;
        out.y = dx * (-this._sin) + dy * this._cos + this._cy;
    } else {
        out.x = rx;
        out.y = ry;
    }
    
    return out;
  },

  /**
   * Calculates a depth sort key based on the current rotation context.
   * This approximates the visual "distance" from the back of the scene to the front.
   * Essential for Z-Sorting entities correctly when the camera rotates.
   */
  getSortDepth(x: number, y: number, z: number = 0): number {
      // Calculate rotated coordinates relative to the camera center (0,0 is sufficient for relative depth)
      // rx = x * cos - y * sin
      // ry = x * sin + y * cos
      // In standard isometric projection (45 deg Y-axis compression), 
      // objects with higher transformed 'Y' are closer to the viewer.
      // Objects with higher transformed 'X' are to the right.
      
      const rx = x * this._cos - y * this._sin;
      const ry = x * this._sin + y * this._cos;
      
      // Depth formula:
      // Primary factor: Transformed Y (Rows).
      // Secondary tie-breaker: Transformed X (Cols).
      // Z (Height) adds to sort value (drawn later = on top)
      
      return (ry * 10000) + (rx * 100) + z;
  }
};
