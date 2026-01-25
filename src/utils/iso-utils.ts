
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
   * OPTIMIZED: Mutates target if provided to avoid allocation.
   */
  toIso: function(x: number, y: number, z: number = 0, target?: {x: number, y: number}) {
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
    const isoX = (rx - ry);
    const isoY = (rx + ry) * 0.5 - z;

    if (target) {
        target.x = isoX;
        target.y = isoY;
        return target;
    }

    return { x: isoX, y: isoY };
  },

  /**
   * Converts Screen (Isometric) to World (Cartesian).
   * Reverses the rotation applied by toIso.
   */
  fromIso: function(screenX: number, screenY: number, out: {x: number, y: number} = {x:0, y:0}) {
    // 1. Inverse Projection (assuming z=0 for ground plane clicks)
    const y = screenY; 
    const x = screenX; 
    
    // Derived from:
    // isoX = rx - ry
    // isoY = (rx + ry)/2
    const ry = y - 0.5 * x;
    const rx = y + 0.5 * x;

    // 2. Inverse Rotation (Rotate by -angle around center)
    if (this._rotation !== 0) {
        const dx = rx - this._cx;
        const dy = ry - this._cy;
        
        // Inverse rotation matrix (transpose of rotation matrix)
        // cos stays same, sin becomes -sin
        out.x = dx * this._cos - dy * (-this._sin) + this._cx;
        out.y = dx * (-this._sin) + dy * this._cos + this._cy;
    } else {
        out.x = rx;
        out.y = ry;
    }
    
    return out;
  },

  /**
   * Calculates the sorting depth of a point given a specific camera rotation.
   * This is critical for Z-sorting in a rotated isometric view.
   */
  getSortDepth: function(x: number, y: number, z: number, rotation: number): number {
      let rx = x;
      let ry = y;

      // Apply rotation around origin (0,0) for sorting is sufficient as relative depth is what matters
      if (rotation !== 0) {
          const cos = Math.cos(rotation);
          const sin = Math.sin(rotation);
          rx = x * cos - y * sin;
          ry = x * sin + y * cos;
      }

      // Isometric depth is essentially (x + y) in the aligned space.
      return rx + ry + (z * 0.01); 
  }
};
