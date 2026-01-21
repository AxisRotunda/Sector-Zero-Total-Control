# Feature Breakdown

**META**
- **ID**: `feature-breakdown`
- **LAST_UPDATED**: `2026-01-26T10:00:00Z`
- **DESCRIPTION**: A human-oriented guide mapping major game features to the responsible codebase aspects. This helps in quickly locating code relevant to a specific feature.

---

### Player & Character

| Feature                 | Primary Code Files                                                                                                  | Description                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Player Movement**     | `player-control.service.ts`, `input.service.ts`, `physics.service.ts`, `joystick.component.ts`                        | Translates user input (keyboard/touch) into player velocity and applies physics for movement and collision. |
| **Input Handling**      | `input-buffer.service.ts`, `input-validator.service.ts`, `player-control.service.ts`                                | **Buffer**: Queues actions for combat fluidity. **Validator**: Sanitizes physics vectors to prevent errors. |
| **Player Stats**        | `player-stats.service.ts`, `skill-tree.service.ts`, `inventory.service.ts`                                            | Computes final player stats (HP, damage) by combining base values, skill tree nodes, and equipped items.  |
| **Abilities & Cooldowns** | `player-abilities.service.ts`, `app.component.html` (buttons), `hud.component.ts`                                   | Manages skill usage, cooldown timers, and psionic energy costs. Spawns hitboxes for abilities.            |
| **Leveling & XP**       | `player-progression.service.ts`, `combat.service.ts`                                                                  | Tracks XP gain from enemy kills, handles leveling up, and grants skill points.                          |
| **Inventory & Gear**    | `inventory.service.ts`, `inventory.component.ts`, `item-tooltip.component.ts`                                         | Manages the player's bag and equipped items. Handles drag-and-drop logic for item management.           |
| **Crafting (Nano-Forge)**| `crafting.service.ts`, `inventory.component.ts`                                                                     | Allows players to spend 'Scrap' to upgrade item levels or reroll item stats/affixes.                    |
| **Skill Tree**          | `skill-tree.service.ts`, `skill-tree.component.ts`                                                                    | Manages the state of the skill tree, including node allocation, point spending, and stat calculations.  |

### World & Environment

| Feature                    | Primary Code Files                                                                  | Description                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Sector System**          | `sector-loader.service.ts`, `maps.config.ts`, `world.service.ts`                    | Loads static level layouts (Hubs) defined in config, including wall placement, NPC locations, and exits.        |
| **World Management**       | `world-manager.service.ts`, `world-generator.service.ts`                            | Coordinates loading of static sectors vs. procedural dungeons.                                                  |
| **Floor State Persistence**| `world-state.service.ts`, `game-engine.service.ts`                                  | Caches the state of visited sectors in memory so they are not reset upon returning.                             |
| **Game Save/Load**         | `persistence.service.ts`, `game-engine.service.ts`                                  | Serializes and deserializes the entire game state (player progress, inventory, maps) to/from `localStorage`.    |
| **Time Management**        | `time.service.ts`, `game-engine.service.ts`                                         | Handles the game clock, delta time accumulation, slow-motion effects, and hit-stop pauses.                      |
| **Camera & Rendering**     | `render.service.ts`, `floor-renderer.service.ts`, `sprite-cache.service.ts`         | Renders all game objects in an isometric view. Uses **Sprite Caching** and **Off-screen Canvas** optimization.  |
| **Interactive Map**        | `map.service.ts`, `map.component.ts`, `settings.component.ts`                       | Manages map discovery ("fog of war"), markers, and displays a mini-map and full-screen tactical map.            |

### Combat & AI

| Feature             | Primary Code Files                                                         | Description                                                                                                        |
| ------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Enemy AI & Squads**| `ai.service.ts`, `squad-ai.service.ts`                                     | Controls enemy behavior using strategy patterns. Features squad formations, Support healers, and cover-seeking.    |
| **Damage & Hits**   | `combat.service.ts`, `collision.service.ts`                                | Processes hits, calculating damage with individual hit-stop frames and status resistance multipliers.             |
| **Status Effects**  | `status-effect.service.ts`                                                 | Applies damage-over-time and debuffs. Now includes resistance checks that reduce duration/intensity for enemies.  |
| **Loot Generation** | `item-generator.service.ts`, `item-affix.service.ts`, `combat.service.ts`  | Generates procedural items. Enemies can now spawn with equipment that modifies their stats and drops on death.    |
| **NPCs & Dialogue** | `dialogue.service.ts`, `dialogue-overlay.component.ts`, `hud.component.ts` | Manages conversations with NPCs, featuring branching dialogue and world-state-dependent responses.                 |

### UI & UX

| Feature              | Primary Code Files                                                                  | Description                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Main HUD**         | `hud.component.ts`                                                                  | Displays core player information (HP, energy, XP), the mini-map, and buttons to open panels. |
| **Mission Journal**  | `mission-journal.component.ts`, `mission.service.ts`                                | A dedicated interface for tracking Active and Completed missions/quests.                     |
| **Shop Interface**   | `shop.service.ts`, `shop.component.ts`                                              | Handles the buying, selling, and salvaging of items with a merchant.                         |
| **Tutorial System**  | `tutorial.service.ts`, `tutorial-overlay.component.ts`                              | Displays context-sensitive tutorial pop-ups to guide new players.                            |
| **Narrative & Codex**| `narrative.service.ts`, `codex.component.ts`, `entity-preview.component.ts`         | Manages discovery of lore, tracks faction reputation, and displays all collected data in the codex. |
| **Haptics**          | `haptic.service.ts`                                                                 | Provides physical vibration feedback for actions like hits, criticals, and UI interactions.  |
| **Audio**            | `sound.service.ts`                                                                  | Procedurally generates all sound effects and manages audio playback.                         |
