
# SYSTEM: Kernel Architecture & Reality Proofing

**META**
- **ID**: `kernel-architecture`
- **LAST_UPDATED**: `2026-02-05T16:00:00Z`
- **PRIMARY_FILES**:
  - `src/core/proof/proof-kernel.service.ts`
  - `src/core/kernel-supervisor.service.ts`
  - `src/core/reality-corrector.service.ts`

---

## 1. Philosophy: The Immune System
Sector Zero uses a **Reality Integrity** system to manage simulation errors. Unlike traditional error handling (try/catch), the Kernel treats errors as *pathogens* in the simulation.

- **Proof Kernel**: The sensory organ. It detects violations of "Natural Law" (Axioms).
- **Kernel Supervisor**: The brain. It decides if a violation matters based on overall system health.
- **Reality Corrector**: The antibodies. It executes fixes (culling entities, resetting grids) to restore order.

## 2. The Verification Pipeline

### A. Fire-and-Forget Instrumentation
Systems do not wait for verification. They execute optimistically, then send data to the Kernel Worker.
*   *Example*: `SectorLoader` spawns walls immediately, then sends their coordinates to `ProofKernel`. If `ProofKernel` finds an overlap 50ms later, it raises a `REALITY_BLEED` event.

### B. The Axioms
Rules that must be true for the simulation to be "Real".
1.  **Combat**: `Damage >= 0`. `NewHP == OldHP - Damage`.
2.  **Inventory**: `StackCount > 0`. `Cost <= Balance`.
3.  **Topology**: `EntityCount / CellCount < Threshold`.
4.  **Geometry**: `Intersection(Wall A, Wall B) == False`.

## 3. The Supervisor's Logic

The Supervisor monitors `REALITY_BLEED` events. It maintains a **Stability Score** (0-100).

### The Emergency Latch
To prevent performance death-spirals, the Supervisor uses a "Breaker Switch" logic for quality degradation.

*   **Isolated Error**: If a single system fails (e.g., Spatial Grid density spike), the Supervisor triggers a `CORRECTION` (Rebuild Grid) but does *not* degrade graphics.
*   **Systemic Failure**: If the Stability Score drops below 40 (**CRITICAL**), *then* a Medium Severity error will trigger the **Emergency Cap**.
    *   **Action**: Sets `AdaptiveQuality` to `MEDIUM` (or `LOW`).
    *   **Recovery**: The cap remains locked until Stability recovers to >80.

## 4. Per-Domain Policies

| Domain | Violation | Severity | Policy |
| :--- | :--- | :--- | :--- |
| **GEOMETRY** | Walls overlapping | LOW/MEDIUM | Log Warning. Cap Quality to `HIGH` if frequent. |
| **SPATIAL** | Too many entities in cell | CRITICAL | Trigger `SPATIAL` correction (Cull/Rebuild). Cap `MEDIUM` if unstable. |
| **RENDER** | Z-Sort failure | LOW | Trigger `RENDER` correction (Cache Flush). No Cap. |
| **COMBAT** | Negative Damage | HIGH | Log Error. (Logic usually clamps automatically). |

## 5. Implementation Details

- **Worker Thread**: All heavy geometric proofs (Segment Intersection) run in `proof.worker.ts` to keep the UI thread hitting 60fps.
- **Decay**: The HUD indicators use a visual decay (2000ms) so users can see "pulses" of instability, giving the system a living feel.
