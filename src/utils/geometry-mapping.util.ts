
import { Entity } from '../models/game.models';
import { LeanRect } from '../core/lean-bridge.service';

export const GeometryMapping = {
  /**
   * Maps a runtime Entity to the canonical LeanRect format.
   * Coordinate System: Center-based (Engine) -> Corner-based (Lean)
   */
  fromEntity(e: Entity): LeanRect {
    const w = e.width || 40;
    const h = e.depth || 40; // LeanRect 'h' corresponds to depth (Y-span) in top-down logic
    
    return {
        id: e.id,
        x: e.x - w / 2, // Convert center X to left
        y: e.y - h / 2, // Convert center Y to bottom/top
        w: w,
        h: h
    };
  },

  /**
   * Maps a raw wall template definition to LeanRect.
   * Ensures CI sees exactly what the SectorLoader sees.
   */
  fromWallTemplate(wallDef: any, index: number, sectorId: string): LeanRect {
      const width = wallDef.w || 40;
      const depth = wallDef.depth || wallDef.h || 40; // Depth is H in schema usually
      
      return {
          id: `static_${sectorId}_${index}`,
          x: wallDef.x - (width / 2),
          y: wallDef.y - (depth / 2),
          w: width,
          h: depth
      };
  }
};
