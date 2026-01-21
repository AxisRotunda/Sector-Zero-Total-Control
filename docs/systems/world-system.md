# SYSTEM: World & Environment

**META**
- **ID**: `world-system`
- **LAST_UPDATED**: `2026-01-26T10:00:00Z`
- **PRIMARY_FILES**:
  - `src/game/world/world.service.ts`
  - `src/game/world/world-manager.service.ts`
  - `src/game/world/sector-loader.service.ts`
  - `src/game/world/world-generator.service.ts`
  - `src/game/world/world-state.service.ts`
  - `src/systems/world-effects.service.ts`
  - `src/config/maps.config.ts`
- **DEPENDENCIES**: `entity-system`, `core-services`

---

**ANALYSIS**

**PURPOSE**:
- This system manages the game world environment. It supports a hybrid architecture of statically defined "Sectors" (Hubs, specific levels) and procedurally generated dungeons. It manages entity persistence across sector transitions and handles environmental effects.

**CORE_CONCEPTS**:
- **Sector Architecture**: The world is divided into Sectors, identified by a `SectorId` (e.g., 'HUB', 'SECTOR_1').
- **World Management**: `WorldManagerService` is a high-level facade that abstracts the difference between loading a static sector and generating a procedural floor.
- **Static Loading**: `SectorLoaderService` loads pre-defined layouts from `maps.config.ts`. These definitions include walls, static NPCs, exits, and zone themes.
- **Procedural Generation**: `WorldGeneratorService` is used when a Sector requires dynamic generation (e.g., specific dungeon depths or radiant mission zones). It generates rooms, corridors, and spawns based on difficulty.
- **State Persistence**: `WorldStateService` acts as an in-memory cache. When the player leaves a sector, the current state of dynamic entities (health, position) is snapshot. When returning, this snapshot is restored, ensuring the world feels persistent. Static entities (decorations) are re-loaded from config to save memory.
- **World Container**: `WorldService` holds the active state: the `player`, the `entities` list, `camera`, and `currentZone`.

**KEY_INTERACTIONS**:
- **Input**: `GameEngineService` calls `world.loadSector(id)`.
- **Output**: Populates `WorldService.entities` for `RenderService` and `EntityUpdateService` to consume.
- **State Mutation**: `WorldService` mutates the active entity list. `WorldStateService` stores/retrieves snapshots.

**HEURISTICS_AND_PATTERNS**:
- **Strategy Pattern**: The loading logic differentiates between static and dynamic generation strategies.
- **Flyweight/Caching**: Static decorations are not fully serialized in save states; they are reloaded from the static config to reduce save file size, while only dynamic/changed entities are persisted.

---

**API_REFERENCE**

### `src/game/world/world.service.ts`

#### `WorldService`

**PUBLIC_PROPERTIES**:
- `player`: `Entity`
- `entities`: `Entity[]` - Dynamic entities (enemies, projectiles).
- `staticDecorations`: `Entity[]` - optimized list for non-interactive objects.
- `camera`: `Camera`

**PUBLIC_METHODS**:
- `loadSector(sectorId: SectorId)`:
  - **Description**: Orchestrates the loading process.
  - **Logic**:
    1. Checks `WorldStateService` for a saved snapshot of the sector.
    2. If found, restores dynamic entities from snapshot and loads static geometry from `SectorLoader`.
    3. If not found, triggers a fresh load via `SectorLoader` (which may delegate to `WorldGenerator`).
- `cleanup()`: Removes dead entities.

### `src/game/world/world-manager.service.ts`

#### `WorldManagerService`

**PUBLIC_METHODS**:
- `loadContent(type: 'SECTOR' | 'PROCEDURAL', id: string | number)`: Dispatches the load request to either `SectorLoader` or `WorldGenerator` via `WorldService`.

### `src/game/world/sector-loader.service.ts`

#### `SectorLoaderService`

**PUBLIC_METHODS**:
- `loadSector(world: WorldService, sectorId: string)`:
  - **Description**: Looks up the `SectorDefinition` in `maps.config.ts`. Instantiates walls, exits, and initial entities into the `world`.
- `loadStaticDecorationsOnly(...)`: Helper to reload only the visual layer when restoring a save state.

### `src/game/world/world-generator.service.ts`

#### `WorldGeneratorService`

**PUBLIC_METHODS**:
- `generate(depth: number)`:
  - **Description**: Creates a procedural layout (rooms/corridors) for generic dungeon sectors.

### `src/game/world/world-state.service.ts`

#### `WorldStateService`

**PUBLIC_METHODS**:
- `saveSector(id: SectorId, entities: Entity[])`: Creates a snapshot of dynamic entities.
- `loadSector(id: SectorId)`: Returns the hydrated list of entities from the snapshot.
- `hasSector(id: SectorId)`: Checks if a snapshot exists.
