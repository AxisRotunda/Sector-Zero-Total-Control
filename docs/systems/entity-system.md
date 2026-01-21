# SYSTEM: Entity System

**META**
- **ID**: `entity-system`
- **LAST_UPDATED**: `2025-05-22T12:00:00Z`
- **PRIMARY_FILES**:
  - `src/systems/entity-update.service.ts`
  - `src/systems/spawner.service.ts`
  - `src/systems/npc-update.service.ts`
  - `src/services/entity-pool.service.ts`
  - `src/models/game.models.ts`
- **DEPENDENCIES**: `world-system`, `ai-system`, `combat-system`, `physics-collision`

---

**ANALYSIS**

**PURPOSE**:
- Defines the core data structures (`Entity`) for all objects in the game world, manages their lifecycle through an object pool, and orchestrates the main update loop that calls specialized systems (AI, physics, etc.) for each entity.

**CORE_CONCEPTS**:
- **Entity**: A data-oriented interface in `game.models.ts` that represents everything from the player and enemies to walls, pickups, and temporary hitboxes.
- **Object Pooling**: `EntityPoolService` maintains pools of recycled `Entity` objects to reduce garbage collection overhead. When an entity is "killed" or expires, it is released back to the pool to be reused.
- **Update Orchestration**: `EntityUpdateService` is the central coordinator. It has been decomposed to delegate specific entity logic:
  - **Spawners**: Handled by `SpawnerService`.
  - **NPCs & Environment**: Handled by `NpcUpdateService` (Turrets, Guards, Vents, Sludge).
  - **Enemies**: Delegated to `AiService`.
- **Individual Hit-Stop**: The `Entity` model includes `hitStopFrames`. `EntityUpdateService` checks this property at the start of an entity's update. If greater than zero, it decrements the counter and skips the rest of the update logic for that entity for that frame, creating a brief, impactful freeze on hit.

**KEY_INTERACTIONS**:
- **Input**: The `GameEngineService` calls `EntityUpdateService.update()` every frame.
- **Output**: The service mutates the state of all `Entity` objects in the `WorldService.entities` array.
- **State Mutation**: Directly modifies properties of `Entity` objects. Calls `EntityPoolService` to acquire new entities (e.g., from spawners) and `CombatService` when an entity's HP drops to zero.

**HEURISTICS_AND_PATTERNS**:
- **Entity Component System (ECS-like)**: While not a pure ECS, the architecture follows its principles. `Entity` is the data, and various "systems" (`AiService`, `PhysicsService`, `SpawnerService`) contain the logic that operates on that data.
- **Object Pooling**: A critical performance optimization pattern to manage memory in a game with many short-lived objects like particles and hitboxes.

---

**API_REFERENCE**

### `src/models/game.models.ts`

**DATA_MODELS**:
- `interface Entity`:
  - **Updated Properties**:
    - `hitStopFrames?: number`: If > 0, the entity's logic is paused for that many frames.
    - `isHitStunned?: boolean`: A flag to prevent multi-hits from a single attack.
    - `resistances?: { [key: string]: number }`: Multipliers for status effect duration/intensity (e.g., `{ burn: 0.5 }` means 50% resistance).
    - `equipment?: { [key: string]: Item }`: A map of equipment slots to `Item` objects for entities that can have gear.
    - `squadId?: number`: The ID of the tactical group the entity belongs to.
    - `aiRole?: 'ATTACKER' | 'SUPPORT' | 'TANK'`: The specific tactical directive for the entity within its squad.

### `src/services/entity-pool.service.ts`

#### `EntityPoolService`

**PUBLIC_METHODS**:
- `acquire(type: Entity['type'], subType?: Entity['subType'])`: Retrieves a clean, re-initialized entity from the appropriate pool.
- `release(entity: Entity)`: Resets an entity's state to its default values and returns it to the pool. The reset logic is crucial and now includes clearing new properties like `resistances`, `equipment`, and `squadId`.

### `src/systems/entity-update.service.ts`

#### `EntityUpdateService`

**PUBLIC_METHODS**:
- `update(globalTime: number)`:
  - **Execution Order**:
    1. Rebuilds the dynamic `SpatialHashService` for the current frame.
    2. Updates the player via `PlayerControlService`.
    3. Iterates through all other entities, delegating logic to `AiService`, `NpcUpdateService`, and `SpawnerService`.
