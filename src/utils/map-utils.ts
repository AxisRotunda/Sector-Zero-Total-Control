
import { Entity } from '../models/game.models';
import { StaticWall } from '../models/map.models';

export class MapUtils {
  
  /**
   * Merges collinear wall entities to reduce draw calls and entity count.
   * Fixes z-fighting and "messy" rendering issues by creating single large blocks.
   * Now supports both Horizontal and Vertical merging.
   */
  static mergeWalls(entities: Entity[]): Entity[] {
      const walls = entities.filter(e => e.type === 'WALL');
      const others = entities.filter(e => e.type !== 'WALL');
      
      if (walls.length === 0) return entities;

      // Helper to generate a unique key for grouping
      const getKey = (w: Entity) => `${w.color}_${w.height}_${w.subType}_${w.depth}`;

      // --- PASS 1: HORIZONTAL MERGE (Same Y) ---
      let mergedH = this.mergePass(walls, 'y', 'x', 'width', getKey);

      // --- PASS 2: VERTICAL MERGE (Same X) ---
      // We must re-group because dimensions might have changed
      // For vertical merge, we check if widths match (instead of depths) to ensure alignment
      const getKeyV = (w: Entity) => `${w.color}_${w.height}_${w.subType}_${w.width}`;
      let finalWalls = this.mergePass(mergedH, 'x', 'y', 'depth', getKeyV);

      return [...others, ...finalWalls];
  }

  private static mergePass(
      input: Entity[], 
      axisStable: 'x' | 'y', 
      axisMove: 'x' | 'y', 
      dimProp: 'width' | 'depth',
      keyFn: (e: Entity) => string
  ): Entity[] {
      const groups = new Map<string, Entity[]>();
      
      input.forEach(w => {
          // Group by stable axis (e.g., Row Y) + Visual Properties
          // We round the position to handle floating point drift
          const posKey = Math.round((w as any)[axisStable]); 
          const key = `${posKey}_${keyFn(w)}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(w);
      });

      const mergedList: Entity[] = [];

      groups.forEach(group => {
          // Sort by moving axis (e.g., Column X)
          group.sort((a, b) => (a as any)[axisMove] - (b as any)[axisMove]);

          const processed = new Set<number>();

          for (let i = 0; i < group.length; i++) {
              if (processed.has(group[i].id)) continue;
              
              let current = { ...group[i] };
              processed.add(group[i].id);

              for (let j = i + 1; j < group.length; j++) {
                  const next = group[j];
                  if (processed.has(next.id)) continue;

                  // Check adjacency
                  // Current End = Start + Dimension/2
                  // Next Start = Start - Dimension/2
                  const currentDim = (current as any)[dimProp] || 40;
                  const nextDim = (next as any)[dimProp] || 40;
                  
                  const currentEnd = (current as any)[axisMove] + currentDim / 2;
                  const nextStart = (next as any)[axisMove] - nextDim / 2;

                  if (Math.abs(nextStart - currentEnd) < 5) { // 5px tolerance
                      // Merge
                      const newTotalDim = currentDim + nextDim;
                      
                      // New center = LeftEdge + NewDim/2
                      const leftEdge = (current as any)[axisMove] - currentDim / 2;
                      (current as any)[axisMove] = leftEdge + newTotalDim / 2;
                      (current as any)[dimProp] = newTotalDim;
                      
                      processed.add(next.id);
                  } else {
                      break; // Gap found
                  }
              }
              mergedList.push(current);
          }
      });

      return mergedList;
  }

  /**
   * Generates a clean, rectangular fortress layout.
   * This aligns with isometric projection better than octagons/circles, preventing jagged edges.
   */
  static createFortress(radius: number, thickness: number, height: number, color: string): StaticWall[] {
    const walls: StaticWall[] = [];
    const size = radius; // Half-width
    
    // Coordinates
    const left = -size;
    const right = size;
    const top = -size;
    const bottom = size;
    
    // 1. North Wall (Full span)
    walls.push({
        x: 0, y: top,
        w: (size * 2) + thickness, h: thickness,
        height, color
    });

    // 2. West Wall (Between Top/Bottom)
    walls.push({
        x: left, y: 0,
        w: thickness, h: (size * 2) - thickness, // Subtract corners to avoid Z-fight overlap if strict
        height, color
    });

    // 3. East Wall
    walls.push({
        x: right, y: 0,
        w: thickness, h: (size * 2) - thickness,
        height, color
    });

    // 4. South Wall (With Gate Gap)
    const gateGap = 400;
    const segmentWidth = size - (gateGap / 2);
    // South-Left
    walls.push({
        x: left + (segmentWidth / 2), y: bottom,
        w: segmentWidth + thickness, h: thickness,
        height, color
    });
    // South-Right
    walls.push({
        x: right - (segmentWidth / 2), y: bottom,
        w: segmentWidth + thickness, h: thickness,
        height, color
    });

    // 5. Pillars at corners for visual anchor
    const pSize = thickness * 1.5;
    const pH = height * 1.2;
    walls.push({ x: left, y: top, w: pSize, h: pSize, height: pH, color, type: 'PILLAR' });
    walls.push({ x: right, y: top, w: pSize, h: pSize, height: pH, color, type: 'PILLAR' });
    walls.push({ x: left, y: bottom, w: pSize, h: pSize, height: pH, color, type: 'PILLAR' });
    walls.push({ x: right, y: bottom, w: pSize, h: pSize, height: pH, color, type: 'PILLAR' });

    // Gate Pillars
    walls.push({ x: -gateGap/2 - 20, y: bottom, w: pSize, h: pSize, height: pH, color, type: 'PILLAR' });
    walls.push({ x: gateGap/2 + 20, y: bottom, w: pSize, h: pSize, height: pH, color, type: 'PILLAR' });

    return walls;
  }

  static createOctagon(radius: number, thickness: number, height: number, color: string): StaticWall[] {
      return this.createFortress(radius, thickness, height, color);
  }
}
