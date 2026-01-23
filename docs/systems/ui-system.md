# SYSTEM: UI System

**META**
- **ID**: `ui-system`
- **LAST_UPDATED**: `2026-01-29T15:15:00Z`
- **PRIMARY_FILES**:
  - `src/app.component.ts` / `.html`
  - `src/services/ui-panel.service.ts`
  - All files in `src/components/`
- **DEPENDENCIES**: `player-system`, `item-inventory-system`, `core-services`, `game/mission.service.ts`, `game/world/waypoint.service.ts`

---

**ANALYSIS**

**PURPOSE**:
- Manages the visual interface and user interaction layers. It coordinates which panels are visible, renders game data (HUD, Inventory, Missions), and handles specific visual effects like text glitching.

**CORE_CONCEPTS**:
- **Panel Orchestration**: `UiPanelService` is the central state manager for full-screen or modal panels (`INVENTORY`, `SKILLS`, `SHOP`, `JOURNAL`, `CODEX`, `WORLD_MAP`). `AppComponent` binds to this service to conditionally render components.
- **Standalone Components**: The UI is modular. Specialized components like `ItemDisplayComponent` and `ItemIconComponent` standardize how game data is presented across different panels.
- **Mobile Ergonomics**: The UI layout prioritizes thumb reach zones. The `JoystickComponent` handles movement input, while action buttons are clustered in the bottom-right arc.

**KEY_INTERACTIONS**:
- **Input**: User clicks/taps. `InputService` actions call `UiPanelService`.
- **Output**: Renders HTML/Canvas overlays.
- **State**: `UiPanelService` holds the `activePanel` signal.

---

**API_REFERENCE**

### `src/services/ui-panel.service.ts`

#### `UiPanelService`

**SIGNALS**:
- `isInventoryOpen`, `isSkillsOpen`, `isWorldMapOpen`, etc. (Computed Booleans)

**PUBLIC_METHODS**:
- `openPanel(type: PanelType)`: Sets active panel. Toggles off if already open.
- `closeAll()`: Clears active panel.

### Key Components

- **`world-map-modal.component.ts`**:
  - **Purpose**: Displays the Rift Network (Fast Travel) interface.
  - **Features**: Lists unlocked sectors from `WaypointService`. Allows teleportation via `ZoneManagerService`. Supports "Personal Rift" return functionality.
- **`mission-journal.component.ts`**: Lists active and completed missions. Provides details on objectives and rewards.
- **`codex.component.ts`**: A multi-tab interface for viewing discovered lore, bestiary, and faction info. Uses `EntityPreviewComponent`.
- **`entity-preview.component.ts`**: Uses an internal canvas context to render a specific entity type/subtype using `UnitRendererService`.
- **`item-display.component.ts`**: Wrapper for `ItemIconComponent` that adds rarity borders and stack counts.
- **`glitch-text.component.ts`**: Accepts `text` and `intensity` inputs. Periodically corrupts the displayed string.
- **`hud.component.ts`**: Main game view. Shows Health/Energy bars, Mini-map, and interaction prompts.
