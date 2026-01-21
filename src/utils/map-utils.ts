
import { Entity } from '../models/game.models';
import { StaticWall } from '../models/map.models';

export class MapUtils {
  
  /**
   * Merges collinear wall entities to reduce draw calls and entity count.
   */
  static mergeWalls(entities: Entity[]): Entity[] {
      const walls = entities.filter(e => e.type === 'WALL');
      const others = entities.filter(e => e.type !== 'WALL');
      
      if (walls.length === 0) return entities;

      // Group by distinct properties (color, height, type, depth)
      const groups = new Map<string, Entity[]>();
      
      walls.forEach(w => {
          // Include depth in key to prevent merging walls of different thickness
          const key = `${w.color}_${w.height}_${w.subType}_${w.depth}`;
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
                      
                      // Check for adjacency (within small tolerance)
                      if (Math.abs(nextLeft - currentRight) < 5) {
                          // Merge!
                          const newWidth = (merged.width || 0) + (next.width || 0);
                          // Recalculate center X
                          const leftEdge = (merged.x - (merged.width || 0)/2); 
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
        // 0=East, 2=South, 4=West, 6=North (approximate based on standard trig)
        // Adjusted for visual orientation: 
        // 0 (Right), 2 (Bottom), 4 (Left), 6 (Top)
        if (i === 2 || i === 6) continue; // Leave gaps for Main Gates (Top/Bottom)

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
          // Use blocks to approximate wall
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