
# SYSTEM: Render System

**META**
- **ID**: `render-system`
- **LAST_UPDATED**: `2026-01-28T12:00:00Z`
- **PRIMARY_FILES**:
  - `src/systems/render.service.ts`
  - `src/systems/rendering/floor-renderer.service.ts`
  - `src/systems/rendering/entity-renderer.service.ts`
  - `src/systems/rendering/effect-renderer.service.ts`
  - `src/systems/rendering/unit-renderer.service.ts`
  - `src/systems/rendering/structure-renderer.service.ts`
  - `src/systems/rendering/sprite-cache.service.ts`
  - `src/systems/rendering/entity-sorter.service.ts`
- **DEPENDENCIES**: `world-system`, `player-system`, `entity-system`

---

**ANALYSIS**

**PURPOSE**:
- Responsible for drawing the game state to the canvas. It handles the isometric projection pipeline, z-sorting, and visual effects. The system has been refactored into specialized sub-services to handle the complexity of different render layers.

**CORE_CONCEPTS**:
- **Pipeline Coordinator**: `RenderService` acts as the main entry point. It clears the canvas, sets up the camera transform, and calls the sub-renderers in order.
- **Floor Caching**: `FloorRendererService` draws the static world geometry (ground tiles, static decorations). Crucially, it renders to an off-screen canvas (cache) and only updates when the camera moves significantly or the zone changes. This is a massive performance optimization.
- **Procedural Rendering**: `UnitRendererService` and `StructureRendererService` handle complex procedural drawing for units (Player, Enemies, NPCs) and structures (Walls).
- **Texturing & Noise**: `StructureRendererService` now generates static noise patterns at runtime to apply grime, rust, and texture to walls, avoiding flat-colored primitives without requiring external asset loading.
- **Sprite Caching**: `SpriteCacheService` stores the rendered output of procedural structures (like walls) to an off-screen canvas. Subsequent draws of identical structures blit the cached image instead of re-rendering, saving significant CPU time.
- **Optimized Z-Sorting**: `EntitySorterService` uses a bucket sort algorithm to efficiently sort all dynamic entities by their isometric depth `(x + y)` before drawing, ensuring correct occlusion.
- **Occlusion (X-Ray)**: `RenderService` performs a final check for player occlusion by tall structures. If obscured, it renders a semi-transparent silhouette of the player on top of the geometry.
- **Effect Rendering**: `EffectRendererService` handles transient visuals: particles, projectiles (hitboxes), weather (rain/ash), and UI overlays like floating text.
- **Post-Processing**: `RenderService` applies final screen-space effects, such as vignettes and glitch effects based on player health.

**KEY_INTERACTIONS**:
- **Input**: `GameEngineService` passes the full `World` state to `RenderService.render()`.
- **Output**: Pixels on Canvas.

**HEURISTICS_AND_PATTERNS**:
- **Painter's Algorithm**: Dynamic entities are sorted by their isometric depth to ensure correct occlusion.
- **Off-screen Buffering**: Used by both the Floor Cache and Sprite Cache for performance.
- **Separation of Concerns**: Rendering logic is broken down into multiple services, each with a clear responsibility (floor, units, effects, etc.).

---

**API_REFERENCE**

### `src/systems/render.service.ts`

#### `RenderService`

**PUBLIC_METHODS**:
- `render(entities, player, particles, ...)`:
  - **Execution Order**:
    1. `FloorRenderer.drawFloor()` (Draws cached background).
    2. Frustum Culling (Filters visible entities).
    3. `EntitySorterService.sortForRender()` (Z-Sorting).
    4. Loop sorted entities:
       - Call `UnitRenderer`, `StructureRenderer`, etc. for physical objects.
       - Call `EffectRenderer` for particles/projectiles.
    5. **Occlusion Check**: Redraw player silhouette if obscured.
    6. `EffectRenderer.drawGlobalEffects()` (Weather, overlays).
    7. Post-Processing (Glitch/Vignette).

### `src/systems/rendering/structure-renderer.service.ts`

#### `StructureRendererService`

**PUBLIC_METHODS**:
- `drawStructure(...)`: Determines specific render method (`Monolith`, `Gate`, `Wall`) based on entity subtype. Uses `SpriteCacheService` to retrieve or generate the sprite.
- **Internal**: Initializes procedural noise patterns for texturing.

### `src/systems/rendering/floor-renderer.service.ts`

#### `FloorRendererService`

**PUBLIC_METHODS**:
- `drawFloor(...)`: Manages the cache canvas. Checks if invalidation is needed (zoom change, view pan threshold). Redraws cache if dirty, then draws cache to main context.
