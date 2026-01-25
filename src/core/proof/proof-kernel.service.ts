
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
    private snapshot: T;

    constructor(private state: T) {
        // Optimization: Use structuredClone instead of JSON serialization
        // This is ~5x faster for deep cloning and preserves dates/maps if present
        this.snapshot = structuredClone(state);
    }

    /**
     * Executes a mutation on a clone of the state. 
     * If validation passes, returns the new state.
     * If validation fails, returns null (Rollback).
     */
    attempt(mutator: (draft: T) => void, validator: (draft: T) => ValidationResult): { success: boolean; newState: T | null; errors: string[] } {
        try {
            // Clone from snapshot for the draft (prevents mutation of snapshot)
            const draft = structuredClone(this.snapshot);
            mutator(draft);
            
            const result = validator(draft);
            if (result.isValid) {
                return { success: true, newState: draft, errors: [] };
            } else {
                return { success: false, newState: null, errors: result.errors };
            }
        } catch (e: any) {
            console.error('Transaction failed', e);
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
    
    // Cache for heavy connectivity proofs
    private connectivityCache = new Map<string, boolean>();

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

    /**
     * Optimized checksum computation.
     * Detects Entity arrays to perform a fast topology hash (XOR sum) instead of full serialization.
     */
    computeChecksum(data: any): string {
        let hash = 0;
        
        if (Array.isArray(data)) {
            // Fast path for Entity Arrays: Hash critical topology/identity fields only
            const prime = 31;
            for (let i = 0; i < data.length; i++) {
                const item = data[i];
                if (item && typeof item === 'object') {
                    // Integer bitwise ops are much faster than string concatenation
                    const x = (item.x | 0);
                    const y = (item.y | 0);
                    const id = (item.id | 0);
                    // Hash type string using first char code to avoid alloc
                    const typeCode = item.type ? item.type.charCodeAt(0) : 0;
                    
                    // XOR-Rotate-Mix
                    hash = (hash << 5) - hash + x;
                    hash = (hash << 5) - hash + y;
                    hash = (hash << 5) - hash + id;
                    hash = (hash << 5) - hash + typeCode;
                    hash |= 0; // Force 32-bit int
                }
            }
        } else {
            // Fallback for complex objects: Stringify
            const str = JSON.stringify(data);
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; 
            }
        }
        
        // Return hex string (unsigned)
        return (hash >>> 0).toString(16);
    }

    // --- DOMAIN: WORLD TOPOLOGY ---

    /**
     * Verifies that the generated world adheres to the Axiom of Connectivity.
     * Theorem: Forall(exit) -> Exists(Path(PlayerStart, exit))
     */
    verifyConnectivity(entities: Entity[], bounds: { minX: number, maxX: number, minY: number, maxY: number }, playerStart: { x: number, y: number }): ValidationResult {
        return this.measure(() => {
            // 0. Cache Check
            const topoHash = this.computeTopologyHash(entities, playerStart);
            if (this.connectivityCache.has(topoHash)) {
                const cachedResult = this.connectivityCache.get(topoHash);
                return { isValid: !!cachedResult, errors: cachedResult ? [] : ['Connectivity Check Failed (Cached)'] };
            }

            const errors: string[] = [];
            
            // 1. Build a temporary navigation grid for the proof
            const gridSize = 60;
            const gridWidth = Math.ceil((bounds.maxX - bounds.minX) / gridSize);
            const gridHeight = Math.ceil((bounds.maxY - bounds.minY) / gridSize);
            
            // Use flat typed array for grid (faster than array of arrays)
            const grid = new Uint8Array(gridWidth * gridHeight).fill(1); // 1 = walkable
            
            // Rasterize Walls
            // Optimization: Filter in-place loop
            for (const e of entities) {
                if (e.type === 'WALL') {
                    this.markUnwalkableFlat(grid, e, bounds, gridSize, gridWidth, gridHeight);
                }
            }

            // 2. Locate Exits
            const exits = entities.filter(e => e.type === 'EXIT');

            // 3. Prove reachability for ALL exits
            const startNode = this.toGrid(playerStart, bounds, gridSize);
            const startIdx = startNode.y * gridWidth + startNode.x;
            
            if (startNode.x < 0 || startNode.x >= gridWidth || startNode.y < 0 || startNode.y >= gridHeight) {
                // Player outside bounds - trivial fail
                this.connectivityCache.set(topoHash, false);
                return { isValid: false, errors: ['Player start outside world bounds'] };
            }

            // BFS Flood Fill
            // 0 = Unknown/Unvisited, 1 = Walkable, 2 = Visited, 3 = Wall
            // We reuse the 'grid' array. 1 means "Can Walk", we mark "2" as "Reached"
            const queue = new Int32Array(gridWidth * gridHeight);
            let qHead = 0;
            let qTail = 0;
            
            queue[qTail++] = startIdx;
            grid[startIdx] = 2; // Mark visited

            // Safety break
            let iterations = 0;
            const MAX_ITER = gridWidth * gridHeight; 

            while (qHead < qTail && iterations < MAX_ITER) {
                iterations++;
                const currIdx = queue[qHead++];
                const cx = currIdx % gridWidth;
                const cy = Math.floor(currIdx / gridWidth);
                
                // Neighbors: Up, Down, Left, Right
                const neighbors = [
                    currIdx - gridWidth, // Up
                    currIdx + gridWidth, // Down
                    currIdx - 1,         // Left
                    currIdx + 1          // Right
                ];

                // Boundary checks implicitly handled by array bounds or valid logic below
                if (cy > 0 && grid[neighbors[0]] === 1) { grid[neighbors[0]] = 2; queue[qTail++] = neighbors[0]; }
                if (cy < gridHeight - 1 && grid[neighbors[1]] === 1) { grid[neighbors[1]] = 2; queue[qTail++] = neighbors[1]; }
                if (cx > 0 && grid[neighbors[2]] === 1) { grid[neighbors[2]] = 2; queue[qTail++] = neighbors[2]; }
                if (cx < gridWidth - 1 && grid[neighbors[3]] === 1) { grid[neighbors[3]] = 2; queue[qTail++] = neighbors[3]; }
            }

            // 4. Verify Exits are in reachable set
            for (let i = 0; i < exits.length; i++) {
                const exit = exits[i];
                const exitNode = this.toGrid({x: exit.x, y: exit.y}, bounds, gridSize);
                
                // Check 3x3 area around exit for connectivity
                let exitReachable = false;
                
                // Fast boundary check
                const minX = Math.max(0, exitNode.x - 1);
                const maxX = Math.min(gridWidth - 1, exitNode.x + 1);
                const minY = Math.max(0, exitNode.y - 1);
                const maxY = Math.min(gridHeight - 1, exitNode.y + 1);

                for(let y = minY; y <= maxY; y++) {
                    for(let x = minX; x <= maxX; x++) {
                        if (grid[y * gridWidth + x] === 2) {
                            exitReachable = true;
                            break;
                        }
                    }
                    if (exitReachable) break;
                }
                
                if (!exitReachable) {
                    errors.push(`Topological Bleed: Exit at ${exit.x},${exit.y} unreachable.`);
                }
            }

            if (errors.length > 0) this.metrics.failedChecks++;
            const isValid = errors.length === 0;
            
            // Cache result
            this.connectivityCache.set(topoHash, isValid);
            
            return { isValid, errors };
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
            
            // Simple O(N^2) for now - usually N is small for solids (< 100)
            // Can be optimized with Sweep and Prune if N grows > 500
            for (let i = 0; i < solids.length; i++) {
                for (let j = i + 1; j < solids.length; j++) {
                    const a = solids[i];
                    const b = solids[j];
                    
                    const aw = a.width || 40; const ad = a.depth || 40;
                    const bw = b.width || 40; const bd = b.depth || 40;
                    
                    if (Math.abs(a.x - b.x) * 2 < (aw + bw) && Math.abs(a.y - b.y) * 2 < (ad + bd)) {
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

            if (credits < 0) errors.push(`Economic Anomaly: Negative Credits (${credits}) detected.`);
            if (scrap < 0) errors.push(`Economic Anomaly: Negative Scrap (${scrap}) detected.`);

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

    private markUnwalkableFlat(grid: Uint8Array, wall: Entity, bounds: any, gridSize: number, gridWidth: number, gridHeight: number) {
        const ww = wall.width || 40;
        const wd = wall.depth || 40;
        
        const startX = Math.max(0, Math.floor((wall.x - ww / 2 - bounds.minX) / gridSize));
        const endX = Math.min(gridWidth, Math.ceil((wall.x + ww / 2 - bounds.minX) / gridSize));
        const startY = Math.max(0, Math.floor((wall.y - wd / 2 - bounds.minY) / gridSize));
        const endY = Math.min(gridHeight, Math.ceil((wall.y + wd / 2 - bounds.minY) / gridSize));

        for (let y = startY; y < endY; y++) {
            const rowOffset = y * gridWidth;
            for (let x = startX; x < endX; x++) {
                grid[rowOffset + x] = 0; // 0 = unwalkable (wall)
            }
        }
    }

    private computeTopologyHash(entities: Entity[], start: {x: number, y: number}): string {
        let hash = 0;
        // Hash player start
        hash = (hash << 5) - hash + Math.floor(start.x);
        hash = (hash << 5) - hash + Math.floor(start.y);
        
        // Hash geometry only (Walls and Exits)
        for(const e of entities) {
            if (e.type === 'WALL' || e.type === 'EXIT') {
                hash = (hash << 5) - hash + Math.floor(e.x);
                hash = (hash << 5) - hash + Math.floor(e.y);
                hash = (hash << 5) - hash + (e.width || 0);
                hash = (hash << 5) - hash + (e.depth || 0);
                hash |= 0;
            }
        }
        return (hash >>> 0).toString(16);
    }
}
