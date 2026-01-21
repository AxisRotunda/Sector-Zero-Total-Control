# Project Structure

**META**
- **ID**: `project-structure`
- **LAST_UPDATED**: `2026-01-26T10:00:00Z`
- **DESCRIPTION**: This document outlines the rationalized file and folder structure of the "Sector Zero: Total Control" project, reflecting the current architectural organization.

---

```
.
├── docs/                     # All project documentation.
├── index.html                # Main HTML file, loads TailwindCSS, defines import maps.
├── index.tsx                 # Application bootstrap entry point for Angular.
├── metadata.json             # Applet metadata (name, description, permissions).
└── src/
    ├── app.component.html        # Root component template (main menu, game UI layout).
    ├── app.component.ts          # Root component logic (input delegation).
    ├── components/               # Reusable, standalone Angular UI components.
    │   ├── abilities-panel.component.ts
    │   ├── codex.component.ts
    │   ├── dialogue-overlay.component.ts
    │   ├── entity-preview.component.ts
    │   ├── glitch-text.component.ts
    │   ├── hud.component.ts
    │   ├── inventory.component.html
    │   ├── inventory.component.ts
    │   ├── item-display.component.ts
    │   ├── item-icon.component.ts
    │   ├── item-tooltip.component.ts
    │   ├── joystick.component.ts
    │   ├── map.component.ts
    │   ├── mission-journal.component.ts
    │   ├── settings.component.ts
    │   ├── shop.component.ts
    │   ├── skill-tree.component.ts
    │   └── tutorial-overlay.component.ts
    ├── config/                   # Game balance and configuration constants.
    │   ├── balance.config.ts
    │   ├── game.config.ts
    │   ├── loot.config.ts
    │   ├── maps.config.ts
    │   └── narrative.config.ts
    ├── core/                     # Core application infrastructure.
    │   ├── events/
    │   │   ├── event-bus.service.ts
    │   │   └── game-events.ts
    │   └── persistence.service.ts
    ├── game/                     # Core game state management services.
    │   ├── crafting.service.ts
    │   ├── game-engine.service.ts
    │   ├── inventory.service.ts
    │   ├── mission.service.ts
    │   ├── narrative.service.ts
    │   ├── player/
    │   │   ├── player-abilities.service.ts
    │   │   ├── player-progression.service.ts
    │   │   ├── player-stats.service.ts
    │   │   └── player.service.ts
    │   ├── skill-tree.service.ts
    │   ├── time.service.ts
    │   └── world/
    │       ├── sector-loader.service.ts
    │       ├── world-generator.service.ts
    │       ├── world-manager.service.ts
    │       ├── world-state.service.ts
    │       └── world.service.ts
    ├── main.ts
    ├── models/                   # TypeScript interfaces for game data structures.
    │   ├── game.models.ts
    │   ├── item.models.ts
    │   ├── map.models.ts
    │   └── narrative.models.ts
    ├── services/                 # General-purpose, often UI-related services.
    │   ├── dialogue.service.ts
    │   ├── entity-pool.service.ts
    │   ├── haptic.service.ts
    │   ├── id-generator.service.ts
    │   ├── input-buffer.service.ts
    │   ├── input-validator.service.ts
    │   ├── input.service.ts
    │   ├── item-affix.service.ts
    │   ├── item-generator.service.ts
    │   ├── map.service.ts
    │   ├── shop.service.ts
    │   ├── sound.service.ts
    │   ├── tooltip.service.ts
    │   ├── tutorial.service.ts
    │   └── ui-panel.service.ts
    ├── systems/                  # ECS-like systems that operate on entities.
    │   ├── ai.service.ts
    │   ├── collision.service.ts
    │   ├── combat.service.ts
    │   ├── entity-update.service.ts
    │   ├── npc-update.service.ts
    │   ├── particle.service.ts
    │   ├── physics.service.ts
    │   ├── player-control.service.ts
    │   ├── rendering/
    │   │   ├── effect-renderer.service.ts
    │   │   ├── entity-renderer.service.ts
    │   │   ├── entity-sorter.service.ts
    │   │   ├── floor-renderer.service.ts
    │   │   ├── render.config.ts
    │   │   ├── shadow-renderer.service.ts
    │   │   ├── sprite-cache.service.ts
    │   │   ├── structure-renderer.service.ts
    │   │   └── unit-renderer.service.ts
    │   ├── render.service.ts
    │   ├── spatial-hash.service.ts
    │   ├── spawner.service.ts
    │   ├── squad-ai.service.ts
    │   ├── status-effect.service.ts
    │   └── world-effects.service.ts
    └── utils/                    # Utility functions and classes.
        ├── iso-utils.ts
        ├── map-utils.ts
        ├── object-pool.ts
        └── type-guards.ts
```