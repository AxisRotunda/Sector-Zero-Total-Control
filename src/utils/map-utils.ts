
import { Entity } from '../models/game.models';
import { StaticWall } from '../models/map.models';

export class MapUtils {
  
  // Maximum length of a merged wall segment to prevent Z-sorting issues
  // with entities standing near the ends of the wall.
  // REDUCED from 600 to 300 to improve sort accuracy in Hub.
  private static readonly MAX_WALL_LENGTH = 300; 

  /**
   * Merges collinear wall entities to reduce draw calls and entity count.
   */
  static mergeWalls(entities: Entity[]): Entity[] {
      const walls = entities.filter(e => e.type === 'WALL');
      const others = entities.filter(e => e.type !== 'WALL');
      
      if (walls.length === 0) return entities;

      // Group by distinct properties (color, height, type, depth, locked status)
      const groups = new Map<string, Entity[]>();
      
      walls.forEach(w => {
          // Include subType and locked status in key to prevent merging distinct functional walls
          // e.g. A locked GATE_SEGMENT should never merge with a standard WALL
          const key = `${w.color}_${w.height}_${w.subType || 'GENERIC'}_${w.depth}_${w.locked}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(w);
      });

      const mergedWalls: Entity[] = [];

      groups.forEach(group => {
          // Sort by Y then X
          group.sort((a, b) => {
              if (Math.abs(a.y - b.y) > 1) return a.y - b.y;
              return a.x - b.x;
          });

          const processed = new Set<number>();

          for (let i = 0; i < group.length; i++) {
              if (processed.has(group[i].id)) continue;
              
              let current = group[i];
              // Clone to avoid mutating the original entity pool object prematurely
              let merged = { ...current }; 
              processed.add(current.id);

              // Try horizontal merge
              for (let j = i + 1; j < group.length; j++) {
                  const next = group[j];
                  if (processed.has(next.id)) continue;
                  
                  // Check if they align horizontally
                  if (Math.abs(next.y - current.y) < 1) { // Same Y row
                      const currentRight = merged.x + (merged.width || 0) / 2;
                      const nextLeft = next.x - (next.width || 0) / 2;
                      
                      const currentLen = merged.width || 0;
                      const nextLen = next.width || 0;

                      // Check for adjacency (within small tolerance) AND Max Length Cap
                      if (Math.abs(nextLeft - currentRight) < 5) {
                          if (currentLen + nextLen > MapUtils.MAX_WALL_LENGTH) {
                              // Don't break the loop, just stop merging into *this* segment
                              // The next segment will start a new merge block in the outer loop
                              break;
                          }

                          // Merge!
                          const newWidth = currentLen + nextLen;
                          // Recalculate center X
                          const leftEdge = (merged.x - currentLen/2); 
                          merged.width = newWidth;
                          merged.x = leftEdge + newWidth / 2;

                          processed.add(next.id);
                      } else {
                          // Gap found, stop merging this line
                          break;
                      }
                  }
              }
              mergedWalls.push(merged);
          }
      });

      // Also try vertical merge (Logic similar to horizontal but rotated)
      // For MVP, we stick to horizontal primarily, but simple vertical adjacencies often come pre-merged in prefabs.
      // If needed, a second pass here for vertical sorting.

      return [...others, ...mergedWalls];
  }

  /**
   * Generates a fortified perimeter wall with pillars.
   */
  static createFortress(radius: number, thickness: number, height: number, color: string): StaticWall[] {
    const walls: StaticWall[] = [];
    const segments = 8;
    
    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const nextAngle = ((i + 1) / segments) * Math.PI * 2;
        
        // Pillar at vertex
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        walls.push({
            x: px, y: py,
            w: thickness * 1.5, h: thickness * 1.5,
            height: height * 1.2,
            color: color,
            type: 'PILLAR'
        });

        // Skip Gate openings (North, South, East, West indices)
        if (i === 2 || i === 6) continue; 

        const x1 = Math.cos(angle) * radius;
        const y1 = Math.sin(angle) * radius;
        const x2 = Math.cos(nextAngle) * radius;
        const y2 = Math.sin(nextAngle) * radius;
        
        // Fill the gap with blocks
        const dist = Math.hypot(x2-x1, y2-y1);
        const blockCount = Math.ceil(dist / thickness);
        
        for(let j=1; j<blockCount; j++) {
            const t = j/blockCount;
            walls.push({
                x: x1 + (x2-x1)*t,
                y: y1 + (y2-y1)*t,
                w: thickness, 
                h: thickness, 
                height: height, 
                color: color
            });
        }
    }
    
    return walls;
  }

  static createOctagon(radius: number, thickness: number, height: number, color: string): StaticWall[] {
      const walls: StaticWall[] = [];
      const segments = 8;
      for (let i = 0; i < segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          const nextAngle = ((i + 1) / segments) * Math.PI * 2;
          
          const x1 = Math.cos(angle) * radius;
          const y1 = Math.sin(angle) * radius;
          const x2 = Math.cos(nextAngle) * radius;
          const y2 = Math.sin(nextAngle) * radius;
          
          const dist = Math.hypot(x2 - x1, y2 - y1);
          const blockCount = Math.ceil(dist / thickness);
          
          for(let j=0; j<blockCount; j++) {
              const t = j / blockCount;
              walls.push({
                  x: x1 + (x2 - x1) * t,
                  y: y1 + (y2 - y1) * t,
                  w: thickness,
                  h: thickness,
                  height: height,
                  color: color
              });
          }
      }
      return walls;
  }
}
