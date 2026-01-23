# SYSTEM: Entity System

**META**
- **ID**: `entity-system`
- **LAST_UPDATED**: `2026-01-29T15:10:00Z`
- **PRIMARY_FILES**:
  - `src/systems/entity-update.service.ts`
  - `src/systems/spawner.service.ts`
  - `src/systems/npc-update.service.ts`
  - `src/services/entity-pool.service.ts`
  - `src/services/npc-visual-generator.service.ts`
  - `src/models/game.models.ts`
- **DEPENDENCIES**: `world-system`, `ai-system`, `combat-system`, `physics-collision`

---

**ANALYSIS**

**PURPOSE**:
- Defines the core data structures (`Entity`) for all objects in the game world, manages their lifecycle through an object pool, orchestrates the main update loop, and handles the procedural generation of visual characteristics for units.

**CORE_CONCEPTS**:
- **Entity Model**: A data-oriented interface in `game.models.ts` that represents everything from the player and enemies to walls, pickups, and temporary hitboxes.
- **Visual Profiles**: The `Entity` model includes a `visuals` property (type `VisualProfile`). This decouples game logic stats (HP, Speed) from rendering details (Head type, Clothing color, Accessories).
- **Visual Generation**: `NpcVisualGeneratorService` creates unique `VisualProfile` configurations based on entity type, sub-type, and faction. This allows for diverse-looking crowds (Citizens) or uniform military units (Guards) using the same underlying renderer.
- **Object Pooling**: `EntityPoolService` maintains pools of recycled `Entity` objects. It is responsible for calling the visual generator when a new unit is acquired to ensure it looks correct.
- **Update Orchestration**: `EntityUpdateService` is the central coordinator. It delegates specific entity logic:
  - **Spawners**: Handled by `SpawnerService`.
  - **NPCs & Environment**: Handled by `NpcUpdateService`.
  - **Enemies**: Delegated to `AiService`.

**KEY_INTERACTIONS**:
- **Input**: The `GameEngineService` calls `EntityUpdateService.update()` every frame.
- **Output**: The service mutates the state of all `Entity` objects in the `WorldService.entities` array.
- **State Mutation**: Directly modifies properties of `Entity` objects. Calls `EntityPoolService` to acquire new entities.

**HEURISTICS_AND_PATTERNS**:
- **Component-like Data**: `visuals` acts as a component attached to the entity.
- **Object Pooling**: Critical for performance. The `release` method in `EntityPoolService` carefully resets all state, including clearing the `visuals` object, to prevent data bleeding between instances.

---

**API_REFERENCE**

### `src/models/game.models.ts`

**DATA_MODELS**:
- `interface Entity`:
  - **Key Properties**:
    - `visuals?: VisualProfile`: Configuration for the `UnitRendererService`.
    - `hitStopFrames?: number`: Pauses update logic for impact feel.
    - `equipment?: { weapon?, armor? }`: Gear carried by the entity.
    - `squadId?: number`: ID for `SquadAiService` coordination.
    - `zoneId?: string`: The zone this entity belongs to (crucial for spatial hashing).

### `src/services/npc-visual-generator.service.ts`

#### `NpcVisualGeneratorService`

**PUBLIC_METHODS**:
- `generate(type, subType, factionId)`:
  - **Description**: Returns a `VisualProfile`.
  - **Logic**: Applies a base humanoid template, then overrides colors/accessories based on Faction (e.g., Vanguard = Armor/Blue), then overrides specific geometry based on SubType (e.g., Medic = Backpack/Cap).

### `src/services/entity-pool.service.ts`

#### `EntityPoolService`

**PUBLIC_METHODS**:
- `acquire(type, subType)`: Retrieves an entity. If it's an NPC or Enemy, it automatically triggers `NpcVisualGeneratorService` to populate `visuals`.
- `release(entity)`: Resets state.

### `src/systems/entity-update.service.ts`

#### `EntityUpdateService`

**PUBLIC_METHODS**:
- `update(globalTime: number)`:
  - **Execution Order**:
    1. Clears dynamic `SpatialHashService`.
    2. Updates Player.
    3. Iterates Entities:
       - Checks `hitStopFrames`.
       - Updates Status Effects.
       - Delegates to specific update services (`AiService`, `NpcUpdateService`, etc.).
