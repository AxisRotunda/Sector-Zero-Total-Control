# SYSTEM: Render System

**META**
- **ID**: `render-system`
- **LAST_UPDATED**: `2026-01-29T10:00:00Z`
- **PRIMARY_FILES**:
  - `src/systems/render.service.ts`
  - `src/systems/rendering/texture-generator.service.ts`
  - `src/systems/rendering/structure-renderer.service.ts`
  - `src/systems/rendering/floor-renderer.service.ts`
  - `src/systems/rendering/sprite-cache.service.ts`
  - `src/systems/rendering/entity-renderer.service.ts`
  - `src/systems/rendering/effect-renderer.service.ts`
  - `src/systems/rendering/unit-renderer.service.ts`
  - `src/systems/rendering/entity-sorter.service.ts`
- **DEPENDENCIES**: `world-system`, `player-system`, `entity-system`

---

**ANALYSIS**

**PURPOSE**:
- Responsible for drawing the game state to the canvas. It handles the isometric projection pipeline, z-sorting, and visual effects. The system is composed of specialized sub-services for different layers (floor, structures, units, effects).

**CORE_CONCEPTS**:
- **Texture Generation**: `TextureGeneratorService` is the central source for all procedural patterns (noise, rust, moss, grids). It creates `CanvasPattern` objects at runtime, eliminating the need for external texture assets while maintaining visual variety.
- **Pipeline Coordinator**: `RenderService` acts as the main entry point. It clears the canvas, sets up the camera transform, and calls the sub-renderers in order.
- **Floor Caching**: `FloorRendererService` draws the static world geometry (ground tiles, static decorations). It renders to an off-screen canvas (cache) and only updates when the camera moves significantly or the zone changes.
- **Sprite Caching**: `SpriteCacheService` stores the rendered output of procedural structures (like walls) to an off-screen canvas.
  - **Optimization**: Uses a **Lazy LRU** strategy. Instead of re-ordering the cache Map on every read (costly), it updates a timestamp. Pruning only occurs when the cache limit is hit, removing stale entries (>60s unused) or the oldest 20%.
- **Component Caching (Gates)**: `StructureRendererService` implements a specialized caching strategy for animated objects like gates. Instead of redrawing the entire geometry every frame during animation, it caches the static sub-components (Left Panel, Right Panel) and composites them with dynamic offsets.
- **Optimized Z-Sorting**: `EntitySorterService` uses a bucket sort algorithm to efficiently sort all dynamic entities by their isometric depth `(x + y)` before drawing.
- **Effect Rendering**: `EffectRendererService` handles transient visuals: particles, projectiles (hitboxes), weather (rain/ash), and UI overlays like floating text.

**KEY_INTERACTIONS**:
- **Input**: `GameEngineService` passes the full `World` state to `RenderService.render()`.
- **Output**: Pixels on Canvas.

**HEURISTICS_AND_PATTERNS**:
- **Flyweight/Pattern Generation**: Textures are generated once and reused across many renderers.
- **Painter's Algorithm**: Dynamic entities are sorted by their isometric depth to ensure correct occlusion.
- **Off-screen Buffering**: Used by both the Floor Cache and Sprite Cache for performance.

---

**API_REFERENCE**

### `src/systems/rendering/texture-generator.service.ts`

#### `TextureGeneratorService`

**PUBLIC_PROPERTIES**:
- `patterns`: Record of generated `CanvasPattern` objects (noise, rust, moss, etc.).

**PUBLIC_METHODS**:
- `getThemeVisuals(theme: ZoneTheme)`: Returns a configuration object containing the pattern, edge colors, and erosion settings for a specific zone theme.
- `adjustColor(hex, percent)`: Utility to darken/lighten hex colors.

### `src/systems/rendering/structure-renderer.service.ts`

#### `StructureRendererService`

**PUBLIC_METHODS**:
- `drawStructure(...)`: Determines specific render method (`Monolith`, `Gate`, `Wall`) based on entity subtype. Uses `SpriteCacheService` to retrieve or generate the sprite.
- **Gate Optimization**: Uses `drawAnimatedGate` to composite cached panel sprites for smooth performance during state changes.

### `src/systems/rendering/floor-renderer.service.ts`

#### `FloorRendererService`

**PUBLIC_METHODS**:
- `drawFloor(...)`: Manages the cache canvas. Checks if invalidation is needed (zoom change, view pan threshold). Redraws cache if dirty, then draws cache to main context.

### `src/systems/rendering/sprite-cache.service.ts`

#### `SpriteCacheService`

**PUBLIC_METHODS**:
- `getOrRender(key, width, height, renderFn)`: Retrieves a cached canvas or executes the render function to create one.
- `clear()`: Wipes the entire cache (useful on level load).