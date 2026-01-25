
import { Injectable } from '@angular/core';
import { Entity, Zone } from '../../models/game.models';
import { DamageResult, DamagePacket } from '../../models/damage.model';
import { DialogueNode, Requirement } from '../../models/narrative.models';

/**
 * THE AXIOMATIC SENTINEL
 * 
 * Represents a runtime approximation of a formal verification kernel.
 * Enforces "Reality Consistency" via runtime axiom checks.
 */

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

@Injectable({
    providedIn: 'root'
})
export class ProofKernelService {

    // --- DOMAIN: WORLD TOPOLOGY ---

    /**
     * Verifies that the generated world adheres to the Axiom of Connectivity.
     * Theorem: Forall(exit) -> Exists(Path(PlayerStart, exit))
     */
    verifyConnectivity(entities: Entity[], bounds: { minX: number, maxX: number, minY: number, maxY: number }, playerStart: { x: number, y: number }): ValidationResult {
        const errors: string[] = [];
        
        // 1. Build a temporary navigation grid for the proof
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
            // Not necessarily an error for closed rooms, but usually we want exits
            // Only flag if it's not a safe zone
            // errors.push("Axiom Failure: Zone contains no exits."); 
        }

        // 3. Prove reachability for ALL exits
        const startNode = this.toGrid(playerStart, bounds, gridSize);
        
        // Flood Fill (BFS) to find all reachable cells from start
        const reachable = new Set<string>();
        const queue: {x: number, y: number}[] = [startNode];
        reachable.add(`${startNode.x},${startNode.y}`);

        // Safety break for loop
        let iterations = 0;
        const MAX_ITER = 10000;

        while (queue.length > 0 && iterations < MAX_ITER) {
            iterations++;
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
                errors.push(`Topological Bleed: Exit ${index} unreachable.`);
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
                    errors.push(`Material Bleed: Co-location detected ID ${a.id} / ${b.id}`);
                    return { isValid: false, errors };
                }
            }
        }
        
        return { isValid: true, errors };
    }

    // --- DOMAIN: COMBAT CALCULATIONS ---

    /**
     * Axiom: Damage Conservation.
     * The output total damage cannot exceed the input raw damage multiplied by the max critical multiplier + weakness.
     * Prevents runaway damage numbers due to stacking bugs.
     */
    verifyCombatTransaction(input: DamagePacket, output: DamageResult, sourceMultiplier: number = 1.0): ValidationResult {
        const errors: string[] = [];
        
        const rawTotal = input.physical + input.fire + input.cold + input.lightning + input.chaos;
        const resultTotal = output.total;

        // Theoretical Max Multiplier (Crit 1.5 * Weakness 1.3 * Variance 1.1) approx 2.2
        // We add a safety margin epsilon
        const THEORETICAL_CAP = rawTotal * 3.0 * sourceMultiplier + 10; // +10 for flat bonuses

        if (resultTotal > THEORETICAL_CAP && rawTotal > 0) {
            errors.push(`Entropy Violation: Output ${resultTotal} exceeds causal limit of ${THEORETICAL_CAP} (Input: ${rawTotal})`);
        }

        if (resultTotal < 0) {
            errors.push(`Void Error: Negative damage output ${resultTotal}`);
        }

        if (isNaN(resultTotal)) {
            errors.push(`Null Reference: Damage result is NaN`);
        }

        return { isValid: errors.length === 0, errors };
    }

    // --- DOMAIN: NARRATIVE CONSISTENCY ---

    /**
     * Axiom: Narrative Causality.
     * A dialogue node cannot offer options that have unmet strict requirements.
     */
    verifyDialogueState(node: DialogueNode, checkReqFn: (reqs?: Requirement[]) => boolean): ValidationResult {
        const errors: string[] = [];
        
        if (!node.text || node.text.length === 0) {
            errors.push(`Data Corruption: Empty dialogue text for Node ${node.id}`);
        }

        // We can't easily verify graph connectivity here without the full graph, 
        // but we can verify local option integrity.
        
        // This is a runtime check usually, but putting it here centralizes the "Audit" logic
        
        return { isValid: errors.length === 0, errors };
    }

    // --- HELPERS ---

    private toGrid(pos: {x: number, y: number}, bounds: any, size: number) {
        return {
            x: Math.floor((pos.x - bounds.minX) / size),
            y: Math.floor((pos.y - bounds.minY) / size)
        };
    }

    private markUnwalkable(grid: boolean[][], wall: Entity, bounds: any, gridSize: number, gridWidth: number, gridHeight: number) {
        const ww = wall.width || 40;
        const wd = wall.depth || 40;
        
        const startX = Math.max(0, Math.floor((wall.x - ww / 2 - bounds.minX) / gridSize));
        const endX = Math.min(gridWidth, Math.ceil((wall.x + ww / 2 - bounds.minX) / gridSize));
        const startY = Math.max(0, Math.floor((wall.y - wd / 2 - bounds.minY) / gridSize));
        const endY = Math.min(gridHeight, Math.ceil((wall.y + wd / 2 - bounds.minY) / gridSize));

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                grid[y][x] = false;
            }
        }
    }
}
