
# SYSTEM: Core Services & Game Loop

**META**
- **ID**: `core-services`
- **LAST_UPDATED**: `2026-02-05T10:00:00Z`
- **PRIMARY_FILES**:
  - `src/game/game-engine.service.ts`
  - `src/game/time.service.ts`
  - `src/services/input.service.ts`
  - `src/services/input-buffer.service.ts`
  - `src/services/input-validator.service.ts`
  - `src/core/persistence.service.ts`
  - `src/core/proof/proof-kernel.service.ts`
  - `src/core/reality-corrector.service.ts`
  - `src/services/indexed-db.service.ts`
- **DEPENDENCIES**: `world-system`, `entity-system`, `player-system`, `ui-system`

---

**ANALYSIS**

**PURPOSE**:
- This cluster of services forms the foundational layer of the application. It orchestrates the game loop, time management, inputs, persistence, and most importantly, the **Reality Integrity** via the Proof Kernel.

**CORE_CONCEPTS**:
- **Proof Kernel**: The `ProofKernelService` acts as a runtime verifier (Axiomatic Guard). It enforces invariants (e.g., "Health cannot be negative", "Inventory stack > 0") *before* state is committed.
  - **Axioms**: Explicit rules registered per domain (Combat, Inventory, World).
  - **Transactions**: Atomic operations that are validated against axioms. If validation fails, the transaction rolls back, and a `REALITY_BLEED` event is dispatched.
  - **Reality Bleed**: A meta-concept representing system corruption or logic failures, handled by the `RealityCorrectorService`.
- **Game Loop**: `GameEngineService` uses `requestAnimationFrame`. `TimeService` manages fixed-step logic updates (`tick()`).
- **Input Pipeline**: Raw inputs -> `InputService` -> `InputBufferService` (queuing) -> `InputValidatorService` (NaN checks).
- **State Serialization**: `PersistenceService` snapshots state to `IndexedDbService`.

**KEY_INTERACTIONS**:
- **Proof**: `CombatService` asks Kernel to verify damage calculations. `InventoryService` asks Kernel to verify item moves.
- **Output**: `RealityCorrectorService` listens for Kernel failures and applies auto-fixes (e.g., clamping values, resetting grids).

**HEURISTICS_AND_PATTERNS**:
- **Design by Contract**: The Kernel enforces the "Contract" of the game state.
- **Fail-Safe**: If the Kernel detects a critical error, it attempts to degrade gracefully (Bleed) rather than crash.

---

**API_REFERENCE**

### `src/core/proof/proof-kernel.service.ts`

#### `ProofKernelService`

**PUBLIC_METHODS**:
- `createTransaction<T>(state: T)`: Creates a transactional wrapper for safe mutation.
- `verify(domain: AxiomDomain, context: any)`: Runs checks. Returns `ValidationResult`.
- `verifyCombatTransaction(...)`: Facade for checking damage integrity.
- `verifyInventoryState(...)`: Facade for checking bag/currency integrity.

### `src/game/game-engine.service.ts`

#### `GameEngineService`

**PUBLIC_METHODS**:
- `init(canvas)`: Starts loop.
- `startGame(isNew)`: Bootstraps session.

### `src/game/time.service.ts`

#### `TimeService`

**PUBLIC_METHODS**:
- `tick()`: Advances game time accumulator. Handles Hit-Stop.
- `triggerHitStop(frames)`: Pauses logic for impact.
