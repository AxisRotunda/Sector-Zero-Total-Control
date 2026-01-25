
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

## 2. Stability Math & Discrete-Time Model

The Supervisor models system stability ($S$) as a discrete-time recurrence relation. This transforms abstract "bugs" into quantifiable "entropy pressure."

### The Recurrence
On each tick ($t$):
\[ S_{t+1} = \min(100,\ \max(0,\ S_t - \sum_i w(severity_i) + r)) \]

Where:
*   $S$: Stability Score (0-100).
*   $w(severity)$: Penalty weight for a violation.
    *   **LOW**: 1
    *   **MEDIUM**: 5
    *   **HIGH**: 10
    *   **CRITICAL**: 20
*   $r$: Recovery rate (Fixed at **1 per second**).

### Status Thresholds
The scalar $S$ maps to discrete system states:
*   **STABLE**: $S \ge 80$. Normal operation.
*   **UNSTABLE**: $40 \le S < 80$. Warning state.
*   **CRITICAL**: $S < 40$. Emergency measures active.

## 3. The Verification Pipeline

### A. Fire-and-Forget Instrumentation
Systems do not wait for verification. They execute optimistically, then send data to the Kernel Worker.
*   *Example*: `SectorLoader` spawns walls immediately, then sends their coordinates to `ProofKernel`. If `ProofKernel` finds an overlap 50ms later, it raises a `REALITY_BLEED` event.

### B. The Axioms
Rules that must be true for the simulation to be "Real".
1.  **Combat**: `Damage >= 0`. `NewHP == OldHP - Damage`.
2.  **Inventory**: `StackCount > 0`. `Cost <= Balance`.
3.  **Topology**: `EntityCount / CellCount < Threshold`.
4.  **Geometry**: `Intersection(Wall A, Wall B) == False`.

## 4. Per-Domain Policies & Predicates

Policies are pure predicates mapping `(domain, severity, status)` to actions.

| Domain | Condition (Severity) | Action | Cap Logic |
| :--- | :--- | :--- | :--- |
| **GEOMETRY** | {MEDIUM, HIGH, CRITICAL} | Log WARN | One-shot `HIGH` (Immediate). |
| **SPATIAL** | {MEDIUM, CRITICAL} | Trigger `SPATIAL` | `MEDIUM` **if and only if** `Status == CRITICAL`. |
| **RENDER** | Any | Trigger `RENDER` | No Cap. |
| **PATH** | Any | Log WARN | No Cap. |

## 5. Implementation Details

- **Worker Thread**: All heavy geometric proofs (Segment Intersection) run in `proof.worker.ts` to keep the UI thread hitting 60fps.
- **Decay**: The HUD indicators use a visual decay (2000ms) so users can see "pulses" of instability, giving the system a living feel.
- **Emergency Latch**: If stability drops to **CRITICAL**, the system latches to `MEDIUM` quality. It will not return to `HIGH/ULTRA` until stability recovers to **STABLE** (>80), creating a hysteresis loop that prevents oscillation.
