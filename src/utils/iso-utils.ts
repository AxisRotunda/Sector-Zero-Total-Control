
export const IsoUtils = {
  /**
   * Converts World (Cartesian) to Screen (Isometric).
   * @param x World X
   * @param y World Y
   * @param z World Z (Height)
   * @param out Optional vector to store result in, avoiding allocation.
   */
  toIso: (x: number, y: number, z: number = 0, out: {x: number, y: number} = {x:0, y:0}) => {
    out.x = (x - y);
    out.y = (x + y) * 0.5 - z;
    return out;
  },

  /**
   * Converts Screen (Isometric) to World (Cartesian).
   * @param screenX Screen X
   * @param screenY Screen Y
   * @param out Optional vector to store result in, avoiding allocation.
   */
  fromIso: (screenX: number, screenY: number, out: {x: number, y: number} = {x:0, y:0}) => {
    const y = screenY; 
    const x = screenX; 
    out.x = y + 0.5 * x;
    out.y = y - 0.5 * x;
    return out;
  }
};
