# SYSTEM: Physics & Collision

**META**
- **ID**: `physics-collision`
- **LAST_UPDATED**: `2024-05-21T10:00:00Z`
- **PRIMARY_FILES**:
  - `src/systems/physics.service.ts`
  - `src/systems/collision.service.ts`
  - `src/systems/spatial-hash.service.ts`
- **DEPENDENCIES**: `entity-system`, `combat-system`

---

**ANALYSIS**

**PURPOSE**:
- This system governs all physical interactions in the game world. It is responsible for entity movement, collision with static geometry (walls), and providing an efficient way to query for nearby entities. It also detects combat-related overlaps.

**CORE_CONCEPTS**:
- **Spatial Hash Grid**: `SpatialHashService` is the core of the optimization strategy. The game world is divided into a grid. Each entity is inserted into every grid cell it overlaps. When checking for collisions, an entity only needs to check against other entities in the same cell(s), drastically reducing the number of required checks from O(n^2) to nearly O(n).
- **Physics Update**: `PhysicsService` applies forces (input acceleration, knockback) and friction to an entity's velocity. It then predicts the next position and checks for collisions against static objects (`WALL`, `DESTRUCTIBLE`) using the spatial hash. It includes logic for sliding along walls.
- **Collision Detection**: `CollisionService` is specifically for "gameplay" collisions, not physics collisions. It uses the spatial hash to find overlaps between `HITBOX` entities and potential targets (`ENEMY`, `DESTRUCTIBLE`, `PLAYER`) and then delegates the outcome of that collision to the `CombatService`.

**KEY_INTERACTIONS**:
- **Input**: `EntityUpdateService` populates the `SpatialHashService` every frame. `PlayerControlService` and `AiService` modify entity velocities, which are then processed by `PhysicsService`.
- **Output**: `PhysicsService` modifies the `x`, `y`, `vx`, and `vy` of entities. `CollisionService` triggers `CombatService.processHit`.
- **State Mutation**: `PhysicsService` directly mutates entity position and velocity. `SpatialHashService` mutates its internal grid map.

**HEURISTICS_AND_PATTERNS**:
- **Spatial Partitioning**: The use of a spatial hash grid is a fundamental optimization pattern in game development for broad-phase collision detection.
- **Separation of Physics and Gameplay Collision**: The system correctly separates static physics collisions (stopping movement) from gameplay collisions (triggering damage). `PhysicsService` handles the former, `CollisionService` the latter.
- **Predictive Collision**: The `PhysicsService` checks the *next* predicted position for a collision before moving the entity, which helps prevent objects from getting stuck inside walls.

---

**API_REFERENCE**

### `src/systems/spatial-hash.service.ts`

#### `SpatialHashService`

**PUBLIC_PROPERTIES**:
- `cellSize`: `number` - The size of each grid cell. A critical tuning parameter for performance.

**PUBLIC_METHODS**:
- `clear()`:
  - **Description**: Empties the entire grid. Must be called at the start of each frame before inserting.
- `insert(entity: Entity)`:
  - **Description**: Inserts an entity into all grid cells that its bounding box overlaps.
- `query(x: number, y: number, radius: number)`:
  - **Description**: Returns a de-duplicated list of all entities found in the grid cells that overlap with the given query area. This is the primary method used by other systems to find nearby objects efficiently.
  - **Returns**: `Entity[]`.

### `src/systems/physics.service.ts`

#### `PhysicsService`

**PUBLIC_METHODS**:
- `updateEntityPhysics(e: Entity, stats?: { speed: number }, inputVec?: { x: number, y: number })`:
  - **Description**: Applies one frame of physics simulation to a single entity.
  - **Execution Order**:
    1. Apply acceleration from input (if provided).
    2. Apply friction to `vx` and `vy`.
    3. Predict next position (`x + vx`, `y + vy`).
    4. Query `SpatialHashService` for nearby static obstacles.
    5. Check for collision. If a collision occurs, adjust `vx` and/or `vy` to simulate sliding or stopping.
    6. Apply final (potentially adjusted) velocity to the entity's position.
  - **Returns**: `boolean` indicating if the entity was moved.

### `src/systems/collision.service.ts`

#### `CollisionService`

**PUBLIC_METHODS**:
- `checkHitboxCollisions(hitbox: Entity)`:
  - **Description**: Specifically checks for overlaps between a `HITBOX` entity and valid targets.
  - **Logic**:
    - If hitbox source is `PLAYER`, `ENVIRONMENT`, etc., it queries for nearby `ENEMY` and `DESTRUCTIBLE` entities.
    - If hitbox source is `ENEMY`, it checks only against the `PLAYER` entity.
  - **Side Effects**: If an overlap is detected, it calls `CombatService.processHit(hitbox, target)`.
