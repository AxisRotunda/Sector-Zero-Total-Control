
import { Injectable } from '@angular/core';
import { Entity, Zone } from '../../models/game.models';
import { DamageResult, DamagePacket } from '../../models/damage.model';
import { DialogueNode, Requirement } from '../../models/narrative.models';
import { Item } from '../../models/item.models';

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

export class Transaction<T> {
    private snapshot: string;

    constructor(private state: T) {
        this.snapshot = JSON.stringify(state);
    }

    /**
     * Executes a mutation on a clone of the state. 
     * If validation passes, returns the new state.
     * If validation fails, returns null (Rollback).
     */
    attempt(mutator: (draft: T) => void, validator: (draft: T) => ValidationResult): { success: boolean; newState: T | null; errors: string[] } {
        try {
            // Deep clone for the draft
            const draft = JSON.parse(this.snapshot) as T;
            mutator(draft);
            
            const result = validator(draft);
            if (result.isValid) {
                return { success: true, newState: draft, errors: [] };
            } else {
                return { success: false, newState: null, errors: result.errors };
            }
        } catch (e: any) {
            return { success: false, newState: null, errors: [`Runtime Exception: ${e.message}`] };
        }
    }
}

@Injectable({
    providedIn: 'root'
})
export class ProofKernelService {

    // --- METRICS & PERFORMANCE ---
    private metrics = {
        totalChecks: 0,
        failedChecks: 0,
        lastCheckTime: 0,
        avgCheckTime: 0
    };

    getMetrics() { return this.metrics; }

    private measure<T>(fn: () => T): T {
        const start = performance.now();
        const result = fn();
        const duration = performance.now() - start;
        
        this.metrics.totalChecks++;
        this.metrics.lastCheckTime = duration;
        // Exponential moving average for smoothing
        this.metrics.avgCheckTime = (this.metrics.avgCheckTime * 0.95) + (duration * 0.05);
        
        return result;
    }

    // --- TRANSACTION FACTORY ---
    
    createTransaction<T>(state: T): Transaction<T> {
        return new Transaction(state);
    }

    computeChecksum(data: any): string {
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(16);
    }

    // --- DOMAIN: WORLD TOPOLOGY ---

    /**
     * Verifies that the generated world adheres to the Axiom of Connectivity.
     * Theorem: Forall(exit) -> Exists(Path(PlayerStart, exit))
     */
    verifyConnectivity(entities: Entity[], bounds: { minX: number, maxX: number, minY: number, maxY: number }, playerStart: { x: number, y: number }): ValidationResult {
        return this.measure(() => {
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

            if (errors.length > 0) this.metrics.failedChecks++;
            return { isValid: errors.length === 0, errors };
        });
    }

    /**
     * Verifies that no two static structures overlap.
     * Theorem: Forall(e1, e2) -> Intersection(e1, e2) == Empty
     */
    verifyNonOverlap(entities: Entity[]): ValidationResult {
        return this.measure(() => {
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
                        this.metrics.failedChecks++;
                        return { isValid: false, errors };
                    }
                }
            }
            
            return { isValid: true, errors };
        });
    }

    // --- DOMAIN: COMBAT CALCULATIONS ---

    verifyCombatTransaction(input: DamagePacket, output: DamageResult, sourceMultiplier: number = 1.0): ValidationResult {
        return this.measure(() => {
            const errors: string[] = [];
            
            const rawTotal = input.physical + input.fire + input.cold + input.lightning + input.chaos;
            const resultTotal = output.total;

            const THEORETICAL_CAP = rawTotal * 3.0 * sourceMultiplier + 10; 

            if (resultTotal > THEORETICAL_CAP && rawTotal > 0) {
                errors.push(`Entropy Violation: Output ${resultTotal} exceeds causal limit of ${THEORETICAL_CAP} (Input: ${rawTotal})`);
            }

            if (resultTotal < 0) {
                errors.push(`Void Error: Negative damage output ${resultTotal}`);
            }

            if (isNaN(resultTotal)) {
                errors.push(`Null Reference: Damage result is NaN`);
            }

            if (errors.length > 0) this.metrics.failedChecks++;
            return { isValid: errors.length === 0, errors };
        });
    }

    // --- DOMAIN: NARRATIVE CONSISTENCY ---

    verifyDialogueState(node: DialogueNode, checkReqFn: (reqs?: Requirement[]) => boolean): ValidationResult {
        return this.measure(() => {
            const errors: string[] = [];
            
            if (!node.text || node.text.length === 0) {
                errors.push(`Data Corruption: Empty dialogue text for Node ${node.id}`);
            }
            
            if (errors.length > 0) this.metrics.failedChecks++;
            return { isValid: errors.length === 0, errors };
        });
    }

    // --- DOMAIN: INVENTORY INTEGRITY ---

    verifyInventoryState(bag: Item[], credits: number, scrap: number): ValidationResult {
        return this.measure(() => {
            const errors: string[] = [];

            // 1. Economic Consistency
            if (credits < 0) errors.push(`Economic Anomaly: Negative Credits (${credits}) detected.`);
            if (scrap < 0) errors.push(`Economic Anomaly: Negative Scrap (${scrap}) detected.`);

            // 2. Matter Consistency (Items)
            bag.forEach((item, index) => {
                if (!item.id) errors.push(`Identity Loss: Item at index ${index} lacks ID.`);
                if (item.stack <= 0) errors.push(`Matter Collapse: Item '${item.name}' has zero or negative stack.`);
                if (item.stack > item.maxStack) errors.push(`Volume Violation: Item '${item.name}' exceeds max stack limit.`);
            });

            if (errors.length > 0) this.metrics.failedChecks++;
            return { isValid: errors.length === 0, errors };
        });
    }

    // --- DOMAIN: STATUS EFFECTS ---

    verifyStatusEffects(entity: Entity): ValidationResult {
        return this.measure(() => {
            const errors: string[] = [];
            const s = entity.status;

            if (s.poison && s.poison.duration < 0) errors.push(`Temporal Paradox: Entity ${entity.id} has negative Poison duration.`);
            if (s.burn && s.burn.duration < 0) errors.push(`Temporal Paradox: Entity ${entity.id} has negative Burn duration.`);
            if (s.weakness && s.weakness.duration < 0) errors.push(`Temporal Paradox: Entity ${entity.id} has negative Weakness duration.`);

            if (s.stun < 0) errors.push(`Causality Break: Entity ${entity.id} has negative Stun frames.`);
            if (s.slow < 0) errors.push(`Causality Break: Entity ${entity.id} has negative Slow value.`);

            if (s.bleed && s.bleed.stacks <= 0) errors.push(`Matter Underflow: Entity ${entity.id} has non-positive Bleed stacks.`);

            if (errors.length > 0) this.metrics.failedChecks++;
            return { isValid: errors.length === 0, errors };
        });
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
