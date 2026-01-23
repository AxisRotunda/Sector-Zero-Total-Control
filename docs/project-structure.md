# Project Structure

**META**
- **ID**: `project-structure`
- **LAST_UPDATED**: `2026-01-29T14:35:00Z`
- **DESCRIPTION**: Rationalized file and folder structure of the "Sector Zero" project.

---

```
.
├── docs/                     # Markdown system documentation
├── index.html                # Entry point (Tailwind & Import Maps)
├── src/
    ├── main.ts               # Zoneless bootstrap
    ├── app.component.ts      # Root layout and input delegation
    ├── components/           # UI Layer (Angular Standalone Components)
    │   ├── hud.component.ts  # Main game UI
    │   ├── map.component.ts  # Tactical overlay and mini-map
    │   ├── shop.component.ts # Economy interface
    │   └── ...
    ├── config/               # Global constants and balance values
    ├── core/                 # Low-level infrastructure (Events, Persistence)
    ├── data/                 # Game Content (The "World Database")
    │   ├── prefabs/          # Structural geometry templates
    │   ├── world/            # WorldGraph and hierarchy definitions
    │   └── zones/            # Static Sector templates (Hub, Sector 9, etc)
    ├── game/                 # Game State Layer (Services holding Signals)
    │   ├── player/           # Player Stats, Progression, Abilities
    │   ├── world/            # ZoneManager, WorldService, WorldState
    │   └── mission.service.ts# Narrative progression state
    ├── models/               # TypeScript interface definitions
    ├── services/             # Utility services (Sound, Haptics, Dialogues)
    ├── systems/              # Logic Layer (The "Engines")
    │   ├── rendering/        # Specialized Canvas renderers
    │   ├── ai.service.ts     # Behavioral strategies
    │   ├── combat.service.ts # Damage resolution
    │   ├── physics.service.ts# Wall-sliding and collision
    │   └── ...
    └── utils/                # Pure math and helper functions
```

### Key Architectural Boundaries:
1.  **State (src/game)**: Services here contain the `Signals` that represent the current state. They are the "Source of Truth".
2.  **Logic (src/systems)**: Services here contain the functions that operate on state. They are stateless or transient.
3.  **Content (src/data)**: Hardcoded templates that define the static world layout.
4.  **Presentation (src/components)**: Reactive UI that binds to state signals.
