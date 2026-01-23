# SYSTEM: World & Environment

**META**
- **ID**: `world-system`
- **LAST_UPDATED**: `2026-01-29T15:05:00Z`
- **PRIMARY_FILES**:
  - `src/game/world/zone-manager.service.ts`
  - `src/game/world/world.service.ts`
  - `src/game/world/zone-hierarchy-manager.service.ts`
  - `src/game/world/world-state.service.ts`
  - `src/game/world/strategies/static-zone-loader.ts`
  - `src/game/world/strategies/procedural-zone-loader.ts`
  - `src/data/world/world-graph.config.ts`
  - `src/data/zones/*.zone.ts`
- **DEPENDENCIES**: `entity-system`, `core-services`

---

**ANALYSIS**

**PURPOSE**:
- This system manages the game world environment using a **Hierarchical Graph** structure. It supports a mix of static, hand-crafted sectors (Hubs, Story Segments) and procedurally generated instances (Dungeons). It manages zone transitions, state persistence, and entity instantiation.

**CORE_CONCEPTS**:
- **Zone Architecture**: The world is defined as a graph of `ZoneTemplate` objects. Each zone has metadata, geometry (walls), and entity definitions.
- **Zone Manager**: `ZoneManagerService` is the central orchestrator. It handles the transition logic: saving the current zone, cleaning up, and loading the new zone.
- **Loading Strategies**: The system uses the Strategy Pattern to load zones differently based on their type:
  - **`StaticZoneLoader`**: Loads fixed geometry from a `ZoneTemplate`. Used for Hubs and specific story locations.
  - **`ProceduralZoneLoader`**: Delegates to `WorldGeneratorService` to create a fresh layout on the fly. Used for 'Instanced' zones.
- **Hierarchy & Graph**: `ZoneHierarchyManagerService` queries `WORLD_GRAPH` to determine parent/child relationships (e.g., `HUB` -> `SECTOR_9_N`). This structure informs transition sounds and map logic.
- **State Persistence**: `WorldStateService` acts as the memory bank.
  - **Persistent Zones**: (e.g., Hubs) retain their state indefinitely.
  - **Checkpoints**: Retain state for the session but may reset on death.
  - **Instanced**: Are generated fresh every entry.
- **Chunk Management**: `ChunkManagerService` (used by `StaticZoneLoader`) spatially partitions static geometry (walls) for optimized rendering culling.

**KEY_INTERACTIONS**:
- **Input**: `GameEngineService` calls `zoneManager.transitionToZone(id)`.
- **Output**: Populates `WorldService.entities`, `WorldService.staticDecorations`, and `SpatialHashService`.
- **State Mutation**: `WorldService` holds the *active* simulation state. `WorldStateService` holds the *serialized* state of inactive zones.

**HEURISTICS_AND_PATTERNS**:
- **Strategy Pattern**: Decouples the "how" of loading a zone (Static vs Procedural) from the "when" (Transition logic).
- **Data-Driven Design**: The world structure is defined entirely in configuration files (`src/data/`), making it easy to add new content without changing logic.

---

**API_REFERENCE**

### `src/game/world/zone-manager.service.ts`

#### `ZoneManagerService`

**PUBLIC_METHODS**:
- `transitionToZone(targetZoneId: string, spawnOverride?: {x, y})`:
  - **Description**: The primary entry point for moving the player.
  - **Flow**:
    1. Triggers `WorldStateService` to snapshot the current zone.
    2. Clears the `WorldService` entity lists and Spatial Hash.
    3. Selects the appropriate strategy (`Static` or `Procedural`) based on the target zone's config.
    4. Executes the strategy to populate the world.
    5. Updates `PlayerService` location and triggers discovery events.
- `initWorld(startZoneId: string)`: Bootstraps the game into a specific zone (usually 'HUB').

### `src/game/world/world-state.service.ts`

#### `WorldStateService`

**PUBLIC_METHODS**:
- `saveSector(id: string, entities: Entity[])`: Filters and serializes dynamic entities. It respects `persistenceTag` properties to determine what should be saved.
- `loadSector(id: string)`: Returns the hydrated list of entities from the snapshot.
- `hasSector(id: string)`: Checks if a snapshot exists.

### `src/game/world/zone-hierarchy-manager.service.ts`

#### `ZoneHierarchyManagerService`

**PUBLIC_METHODS**:
- `getParent(zoneId)`, `getChildren(zoneId)`, `getSiblings(zoneId)`: Navigates the `WORLD_GRAPH`.
- `getPathToRoot(zoneId)`: Returns the breadcrumb trail back to the root zone.

### `src/game/world/world.service.ts`

#### `WorldService`

**PUBLIC_PROPERTIES**:
- `currentZone`: `Signal<Zone>` - The active zone configuration.
- `entities`: `Entity[]` - The active list of updating entities.
- `staticDecorations`: `Entity[]` - Optimized list for non-interactive objects (rendered but not updated).
