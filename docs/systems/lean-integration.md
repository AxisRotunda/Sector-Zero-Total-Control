# SYSTEM: Lean Theorem Integration

**META**
- **ID**: `lean-integration`
- **LAST_UPDATED**: `2026-02-05T18:00:00Z`
- **PRIMARY_FILES**:
  - `src/lean/combat.lean`
  - `src/lean/geometry.lean`
  - `src/core/lean-bridge.service.ts`
  - `src/core/proof/proof-kernel.service.ts`

---

## 1. Concept: Mathematical Certainty
In the unstable reality of Sector Zero, probabilistic checks (heuristics) are prone to "Hallucination" (bugs). To counter this, we introduce **Formal Verification** via the Lean Theorem Prover.

While the browser cannot execute the Lean toolchain directly, the architecture is designed to support a future **WASM** compilation path. Currently, we utilize a **Bridge Pattern** with a "Shadow Mode" implementation.

## 2. Architecture: The Bridge Pattern

### The Interface
The `LeanBridgeService` defines strict interfaces (`LeanCombatState`, `LeanRect`) that mirror the data structures defined in the `.lean` source files.

### The "Shadow Mode"
Since we are offline/browser-based, `LeanBridgeService` implements the verification logic in strict TypeScript. This logic is:
1.  **Pure**: No side effects.
2.  **Strict**: No fuzzy matching or floating-point leniency (where possible).
3.  **Axiomatic**: It mirrors the specific predicates defined in `src/lean/`.

### Integration Flow
```mermaid
Game Loop -> ProofKernel -> LeanBridgeService -> (Simulated WASM) -> Result
```

1.  **Geometry**: When `SectorLoader` initializes a zone, it converts all Walls into `LeanRect`s and asks the Bridge to prove `ValidLevel` (Non-Overlap).
2.  **Combat**: When damage is calculated, `ProofKernel` sends the Pre-State, Input, and Post-State to the Bridge to prove `SafeStep` (HP consistency).

## 3. The Source Truth (`src/lean/`)

We maintain the `.lean` files as the **Specification of Truth**.

*   `combat.lean`: Defines `SafeStep`, ensuring HP never exceeds MaxHP and damage arithmetic is exact.
*   `geometry.lean`: Defines `ValidLevel`, ensuring no two static walls overlap.

## 4. Error Handling
If the Bridge returns `valid: false`, the `ProofKernel` treats this as a **CRITICAL** failure (or HIGH depending on domain). It dispatches a `REALITY_BLEED` event, which the `KernelSupervisor` uses to degrade system quality or trigger emergency resets.

This system provides the "Hard Skeleton" of logic inside the "Soft Meat" of the simulation.