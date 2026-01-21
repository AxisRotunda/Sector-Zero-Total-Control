# SYSTEM: UI System

**META**
- **ID**: `ui-system`
- **LAST_UPDATED**: `2026-01-26T10:00:00Z`
- **PRIMARY_FILES**:
  - `src/app.component.ts` / `.html`
  - `src/services/ui-panel.service.ts`
  - All files in `src/components/`
- **DEPENDENCIES**: `player-system`, `item-inventory-system`, `core-services`, `game/mission.service.ts`

---

**ANALYSIS**

**PURPOSE**:
- Manages the visual interface and user interaction layers. It coordinates which panels are visible, renders game data (HUD, Inventory, Missions), and handles specific visual effects like text glitching.

**CORE_CONCEPTS**:
- **Panel Orchestration**: `UiPanelService` is the central state manager for full-screen or modal panels (`INVENTORY`, `SKILLS`, `SHOP`, `JOURNAL`, etc.). `AppComponent` binds to this service to conditionally render components.
- **Standalone Components**: The UI is modular. Specialized components like `ItemDisplayComponent` and `ItemIconComponent` standardize how game data is presented across different panels. `EntityPreviewComponent` renders a live, rotating 3D-simulated model of an entity for the Codex.
- **Visual Flavor**: `GlitchTextComponent` provides the "cyberpunk/dystopian" aesthetic by randomly scrambling text characters based on an intensity parameter.
- **Mobile Ergonomics**: The UI layout prioritizes thumb reach zones. The `JoystickComponent` handles movement input, while action buttons are clustered in the bottom-right arc.

**KEY_INTERACTIONS**:
- **Input**: User clicks/taps. `InputService` actions (e.g., pressing 'J' for journal) call `UiPanelService`.
- **Output**: Renders HTML/Canvas overlays.
- **State**: `UiPanelService` holds the `activePanel` signal.

---

**API_REFERENCE**

### `src/services/ui-panel.service.ts`

#### `UiPanelService`

**SIGNALS**:
- `isInventoryOpen`, `isSkillsOpen`, `isShopOpen`, etc. (Computed Booleans)

**PUBLIC_METHODS**:
- `openPanel(type: PanelType)`: Sets active panel. Toggles off if already open.
- `closeAll()`: Clears active panel.
- `isOpen(type)`: Boolean check for templates.

### Key Components

- **`mission-journal.component.ts`**: Lists active and completed missions. Provides details on objectives and rewards.
- **`codex.component.ts`**: A multi-tab interface for viewing discovered lore (Data Logs), enemy info (Bestiary), NPC info (Dossier), and Faction standings.
- **`entity-preview.component.ts`**: Uses an internal canvas context to render a specific entity type/subtype (e.g., 'ENEMY_BOSS') using `UnitRendererService`. Used in `CodexComponent`.
- **`item-display.component.ts`**: Wrapper for `ItemIconComponent` that adds rarity borders and stack counts. Used in Inventory and Shop.
- **`glitch-text.component.ts`**: Accepts `text` and `intensity` inputs. Periodically corrupts the displayed string with random characters.
- **`hud.component.ts`**: Main game view. Shows Health/Energy bars, Mini-map, and interaction prompts.
