
import { Entity } from '../models/game.models';

export class MapUtils {
  
  private static readonly MAX_WALL_LENGTH = 1000; // Increased to allow larger monolithic merges
  private static readonly EPSILON = 1.0; // Tolerance for alignment

  /**
   * Merges collinear wall entities to reduce draw calls and entity count.
   * Performs a Horizontal pass followed by a Vertical pass.
   */
  static mergeWalls(entities: Entity[]): Entity[] {
      const walls = entities.filter(e => e.type === 'WALL');
      const others = entities.filter(e => e.type !== 'WALL');
      
      if (walls.length === 0) return entities;

      // Pass 1: Merge Horizontally (Along X-axis)
      // We group by properties that MUST match, plus Depth (thickness). Width (length) can vary.
      const horizontalMerged = MapUtils.performMerge(walls, 'HORIZONTAL');

      // Pass 2: Merge Vertically (Along Y-axis)
      // We group by properties that MUST match, plus Width (thickness). Depth (length) can vary.
      const finalWalls = MapUtils.performMerge(horizontalMerged, 'VERTICAL');

      console.log(`[MapUtils] Wall Merge: ${walls.length} -> ${finalWalls.length} entities.`);

      return [...others, ...finalWalls];
  }

  private static performMerge(walls: Entity[], direction: 'HORIZONTAL' | 'VERTICAL'): Entity[] {
      const groups = new Map<string, Entity[]>();
      const results: Entity[] = [];

      // Grouping
      walls.forEach(w => {
          // Base key: Visual/Functional properties
          // Update: Include 'kind' (structural vs decorative) in grouping to prevent cross-merging
          const kind = w.data?.kind || 'STRUCTURAL';
          let key = `${w.color}_${w.height}_${w.subType || 'GENERIC'}_${w.locked}_${w.type}_${kind}`;
          
          // Dimensional Key: 
          // For Horizontal merge, Depth (Y-thickness) must match.
          // For Vertical merge, Width (X-thickness) must match.
          if (direction === 'HORIZONTAL') {
              key += `_D${Math.round(w.depth || 40)}`;
          } else {
              key += `_W${Math.round(w.width || 40)}`;
          }
          
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(w);
      });

      // Processing Groups
      groups.forEach(group => {
          if (direction === 'HORIZONTAL') {
              // Sort by Y (primary) then X (secondary)
              group.sort((a, b) => {
                  if (Math.abs(a.y - b.y) > MapUtils.EPSILON) return a.y - b.y;
                  return a.x - b.x;
              });
          } else {
              // Sort by X (primary) then Y (secondary)
              group.sort((a, b) => {
                  if (Math.abs(a.x - b.x) > MapUtils.EPSILON) return a.x - b.x;
                  return a.y - b.y;
              });
          }

          const processed = new Set<number>();

          for (let i = 0; i < group.length; i++) {
              if (processed.has(group[i].id)) continue;

              // Use structuredClone or manual deep copy for data to preserve metadata
              let current = { ...group[i] }; 
              if (group[i].data) {
                  current.data = { ...group[i].data };
              }
              
              processed.add(group[i].id);

              for (let j = i + 1; j < group.length; j++) {
                  const next = group[j];
                  if (processed.has(next.id)) continue;

                  let canMerge = false;

                  if (direction === 'HORIZONTAL') {
                      // Must be on same Y plane
                      if (Math.abs(current.y - next.y) < MapUtils.EPSILON) {
                          const currentRight = current.x + (current.width || 0) / 2;
                          const nextLeft = next.x - (next.width || 0) / 2;
                          // Check adjacency
                          if (Math.abs(nextLeft - currentRight) < 5) {
                              canMerge = true;
                          }
                      }
                  } else {
                      // Must be on same X plane
                      if (Math.abs(current.x - next.x) < MapUtils.EPSILON) {
                          const currentBottom = current.y + (current.depth || 0) / 2;
                          const nextTop = next.y - (next.depth || 0) / 2;
                          // Check adjacency
                          if (Math.abs(nextTop - currentBottom) < 5) {
                              canMerge = true;
                          }
                      }
                  }

                  if (canMerge) {
                      // Check Max Length
                      const currentLen = direction === 'HORIZONTAL' ? (current.width || 0) : (current.depth || 0);
                      const nextLen = direction === 'HORIZONTAL' ? (next.width || 0) : (next.depth || 0);

                      if (currentLen + nextLen > MapUtils.MAX_WALL_LENGTH) {
                          break; // Stop merging this chain, start new one next loop
                      }

                      // Execute Merge
                      if (direction === 'HORIZONTAL') {
                          const newWidth = currentLen + nextLen;
                          const leftEdge = current.x - (current.width || 0) / 2;
                          current.width = newWidth;
                          current.x = leftEdge + newWidth / 2;
                      } else {
                          const newDepth = currentLen + nextLen;
                          const topEdge = current.y - (current.depth || 0) / 2;
                          current.depth = newDepth;
                          current.y = topEdge + newDepth / 2;
                      }

                      processed.add(next.id);
                  } else {
                      // Gap found or misalignment
                      break; 
                  }
              }
              results.push(current);
          }
      });

      return results;
  }

  static createFortress(radius: number, thickness: number, height: number, color: string): any[] {
    const walls: any[] = [];
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
}
