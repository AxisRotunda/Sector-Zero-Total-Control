
import { Injectable } from '@angular/core';
import { Entity, Zone } from '../../models/game.models';
import { NavigationService } from '../../systems/navigation.service';

/**
 * THE AXIOMATIC SENTINEL
 * 
 * Represents a runtime approximation of a formal verification kernel.
 * In a full Lean integration, these checks would be compiled theorems 
 * ensuring correctness by construction.
 */

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

@Injectable({
    providedIn: 'root'
})
export class ProofKernelService {

    /**
     * Verifies that the generated world adheres to the Axiom of Connectivity.
     * Theorem: Forall(exit) -> Exists(Path(PlayerStart, exit))
     */
    verifyConnectivity(entities: Entity[], bounds: { minX: number, maxX: number, minY: number, maxY: number }, playerStart: { x: number, y: number }): ValidationResult {
        const errors: string[] = [];
        
        // 1. Build a temporary navigation grid for the proof
        // We simulate the NavigationService logic here for isolation
        const gridSize = 60;
        const gridWidth = Math.ceil((bounds.maxX - bounds.minX) / gridSize);
        const gridHeight = Math.ceil((bounds.maxY - bounds.minY) / gridSize);
        
        const grid: boolean[][] = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(true));
        
        // Rasterize Walls
        entities.filter(e => e.type === 'WALL').forEach(w => {
            this.markUnwalkable(grid, w, bounds, gridSize, gridWidth, gridHeight);
        });

        // 2. Locate Exits
        const exits = entities.filter(e => e.type === 'EXIT');
        if (exits.length === 0) {
            errors.push("Axiom Failure: Zone contains no exits.");
            return { isValid: false, errors };
        }

        // 3. Prove reachability for ALL exits
        const startNode = this.toGrid(playerStart, bounds, gridSize);
        
        // Flood Fill (BFS) to find all reachable cells from start
        const reachable = new Set<string>();
        const queue: {x: number, y: number}[] = [startNode];
        reachable.add(`${startNode.x},${startNode.y}`);

        while (queue.length > 0) {
            const current = queue.shift()!;
            
            const neighbors = [
                {x: current.x + 1, y: current.y},
                {x: current.x - 1, y: current.y},
                {x: current.x, y: current.y + 1},
                {x: current.x, y: current.y - 1}
            ];

            for (const n of neighbors) {
                if (n.x >= 0 && n.x < gridWidth && n.y >= 0 && n.y < gridHeight) {
                    const key = `${n.x},${n.y}`;
                    if (!reachable.has(key) && grid[n.y][n.x]) {
                        reachable.add(key);
                        queue.push(n);
                    }
                }
            }
        }

        // 4. Verify Exits are in reachable set
        exits.forEach((exit, index) => {
            const exitNode = this.toGrid({x: exit.x, y: exit.y}, bounds, gridSize);
            // Allow some fuzziness (check 3x3 area around exit)
            let exitReachable = false;
            for(let dx = -1; dx <= 1; dx++) {
                for(let dy = -1; dy <= 1; dy++) {
                    if (reachable.has(`${exitNode.x + dx},${exitNode.y + dy}`)) {
                        exitReachable = true;
                    }
                }
            }
            
            if (!exitReachable) {
                errors.push(`Axiom Failure: Exit ${index} at ${exit.x},${exit.y} is unreachable.`);
            }
        });

        return { isValid: errors.length === 0, errors };
    }

    /**
     * Verifies that no two static structures overlap.
     * Theorem: Forall(e1, e2) -> Intersection(e1, e2) == Empty
     */
    verifyNonOverlap(entities: Entity[]): ValidationResult {
        const errors: string[] = [];
        const solids = entities.filter(e => e.type === 'WALL' || e.type === 'DESTRUCTIBLE');
        
        for (let i = 0; i < solids.length; i++) {
            for (let j = i + 1; j < solids.length; j++) {
                const a = solids[i];
                const b = solids[j];
                
                // Simple AABB check
                const aw = a.width || 40; const ad = a.depth || 40;
                const bw = b.width || 40; const bd = b.depth || 40;
                
                if (Math.abs(a.x - b.x) * 2 < (aw + bw) && Math.abs(a.y - b.y) * 2 < (ad + bd)) {
                    // Overlap detected
                    errors.push(`Axiom Failure: Structural Co-location detected between ID ${a.id} and ${b.id}`);
                    // Fast fail
                    return { isValid: false, errors };
                }
            }
        }
        
        return { isValid: true, errors };
    }

    private toGrid(pos: {x: number, y: number}, bounds: any, size: number) {
        return {
            x: Math.floor((pos.x - bounds.minX) / size),
            y: Math.floor((pos.y - bounds.minY) / size)
        };
    }

    private markUnwalkable(grid: boolean[][], wall: Entity, bounds: any, gridSize: number, w: number, h: number) {
        const ww = wall.width || 40;
        const wd = wall.depth || 40;
        
        const startX = Math.max(0, Math.floor((wall.x - ww / 2 - bounds.minX) / gridSize));
        const endX = Math.min(w, Math.ceil((wall.x + ww / 2 - bounds.minX) / gridSize));
        const startY = Math.max(0, Math.floor((wall.y - wd / 2 - bounds.minY) / gridSize));
        const endY = Math.min(h, Math.ceil((wall.y + wd / 2 - bounds.minY) / gridSize));

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                grid[y][x] = false;
            }
        }
    }
}
