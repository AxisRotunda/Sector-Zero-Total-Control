
import { Entity } from '../models/game.models';
import { StaticWall } from '../models/map.models';

export class MapUtils {
  
  private static readonly MAX_WALL_LENGTH = 300; 
  private static readonly EPSILON = 0.5;

  /**
   * Merges collinear wall entities to reduce draw calls and entity count.
   */
  static mergeWalls(entities: Entity[]): Entity[] {
      const walls = entities.filter(e => e.type === 'WALL');
      const others = entities.filter(e => e.type !== 'WALL');
      
      if (walls.length === 0) return entities;

      // Group by distinct properties (color, height, type, depth, locked status)
      // We also include Width/Depth dimensions in grouping to only merge same-thickness walls
      const groups = new Map<string, Entity[]>();
      
      walls.forEach(w => {
          // Include subType and locked status in key to prevent merging distinct functional walls
          const key = `${w.color}_${w.height}_${w.subType || 'GENERIC'}_${w.locked}_${Math.round(w.width || 40)}_${Math.round(w.depth || 40)}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(w);
      });

      const mergedWalls: Entity[] = [];

      groups.forEach(group => {
          // 1. Horizontal Merge Pass
          // Sort by Y then X
          group.sort((a, b) => {
              if (Math.abs(a.y - b.y) > MapUtils.EPSILON) return a.y - b.y;
              return a.x - b.x;
          });

          const processed = new Set<number>();
          const horizontalResults: Entity[] = [];

          for (let i = 0; i < group.length; i++) {
              if (processed.has(group[i].id)) continue;
              
              let current = group[i];
              let merged = { ...current }; 
              processed.add(current.id);

              // Try horizontal merge
              for (let j = i + 1; j < group.length; j++) {
                  const next = group[j];
                  if (processed.has(next.id)) continue;
                  
                  // Check if they align horizontally (Same Y)
                  if (Math.abs(next.y - current.y) < MapUtils.EPSILON) { 
                      const currentRight = merged.x + (merged.width || 0) / 2;
                      const nextLeft = next.x - (next.width || 0) / 2;
                      
                      const currentLen = merged.width || 0;
                      const nextLen = next.width || 0;

                      // Check for adjacency (within small tolerance) AND Max Length Cap
                      if (Math.abs(nextLeft - currentRight) < 5) {
                          if (currentLen + nextLen > MapUtils.MAX_WALL_LENGTH) {
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
                  } else {
                      // Different row, stop
                      break;
                  }
              }
              horizontalResults.push(merged);
          }
          
          // 2. Vertical Merge Pass (Run on results of Horizontal pass)
          // Sort by X then Y
          horizontalResults.sort((a, b) => {
              if (Math.abs(a.x - b.x) > MapUtils.EPSILON) return a.x - b.x;
              return a.y - b.y;
          });
          
          const vProcessed = new Set<number>();
          
          for (let i = 0; i < horizontalResults.length; i++) {
              if (vProcessed.has(horizontalResults[i].id)) continue;
              
              let current = horizontalResults[i];
              let merged = { ...current };
              vProcessed.add(current.id);
              
              for (let j = i + 1; j < horizontalResults.length; j++) {
                  const next = horizontalResults[j];
                  if (vProcessed.has(next.id)) continue;
                  
                  // Check alignment X
                  if (Math.abs(next.x - current.x) < MapUtils.EPSILON) {
                      const currentBottom = merged.y + (merged.depth || 0) / 2;
                      const nextTop = next.y - (next.depth || 0) / 2;
                      
                      const currentH = merged.depth || 0;
                      const nextH = next.depth || 0;
                      
                      if (Math.abs(nextTop - currentBottom) < 5) {
                          if (currentH + nextH > MapUtils.MAX_WALL_LENGTH) {
                              break;
                          }
                          
                          const newDepth = currentH + nextH;
                          const topEdge = (merged.y - currentH/2);
                          merged.depth = newDepth;
                          merged.y = topEdge + newDepth / 2;
                          
                          vProcessed.add(next.id);
                      } else {
                          break;
                      }
                  } else {
                      break;
                  }
              }
              mergedWalls.push(merged);
          }
      });

      return [...others, ...mergedWalls];
  }

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

        if (i === 2 || i === 6) continue; 

        const x1 = Math.cos(angle) * radius;
        const y1 = Math.sin(angle) * radius;
        const x2 = Math.cos(nextAngle) * radius;
        const y2 = Math.sin(nextAngle) * radius;
        
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
