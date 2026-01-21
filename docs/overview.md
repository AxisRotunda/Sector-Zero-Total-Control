# Sector Zero: Total Control - System Documentation Overview

**META**
- **ID**: `overview`
- **LAST_UPDATED**: `2026-01-26T10:00:00Z`
- **DESCRIPTION**: This is the central entry point for all system documentation for the "Sector Zero: Total Control" project. It provides a high-level summary and links to detailed, machine-parsable documents for each subsystem.

---

## 1. Project Guides

These documents provide high-level, contextual information about the project's structure and features.

- **[Project Structure](./project-structure.md)**
  - A complete breakdown of the project's folder and file layout, with descriptions for each file's purpose.

- **[Feature Breakdown](./features.md)**
  - A human-oriented guide that maps major game features (e.g., "Player Movement", "Loot Drops") to the specific services and components responsible for their implementation.

- **[Feature Status](./feature-status.md)**
  - A checklist tracking the implementation status of planned and requested features.

- **[World Lore](./lore/)**
  - The canonical source for all in-game lore, character backstories, and narrative text. The documents within this directory define the metaphysical and political landscape of the game world.

## 2. Core Systems Documentation

These documents provide deep, specific, and structured information about each of the game's primary systems. They are designed for AI agent consumption.

- **[Core Services & Game Loop](./systems/core-services.md)**
  - **Covers**: `GameEngineService`, `TimeService`, `InputService`, `InputBufferService`, `PersistenceService`, `SoundService`.
  - **Summary**: Manages the main game loop, time (delta, slow-mo, hit-stop), user input (including buffering), saving/loading, and audio/haptic feedback.

- **[Entity System](./systems/entity-system.md)**
  - **Covers**: `EntityUpdateService`, `EntityPoolService`, `SpawnerService`, `NpcUpdateService`, `game.models.ts`.
  - **Summary**: Defines all game objects (`Entity`), manages their lifecycle via object pooling, and orchestrates per-frame updates for spawners and environmental hazards.

- **[Player System](./systems/player-system.md)**
  - **Covers**: `PlayerService` (Facade) and its sub-modules (`PlayerStatsService`, `PlayerProgressionService`, `PlayerAbilitiesService`).
  - **Summary**: A comprehensive, reactive model of the player, handling stats, progression (XP/level), abilities, and status.

- **[World & Environment System](./systems/world-system.md)**
  - **Covers**: `WorldService`, `WorldManagerService`, `SectorLoaderService`, `WorldGeneratorService`, `WorldStateService`.
  - **Summary**: Manages a hybrid world of static and procedural levels. Handles level loading, state persistence between visits, camera, and environmental effects.

- **[AI System](./systems/ai-system.md)**
  - **Covers**: `AiService`, `SquadAiService`.
  - **Summary**: Governs enemy behavior using a strategy pattern. Features squad-based coordination, tactical roles (Support), cover-seeking, and status resistances.

- **[Combat System](./systems/combat-system.md)**
  - **Covers**: `CombatService`, `StatusEffectService`.
  - **Summary**: Handles all damage calculations, armor penetration, individual hit-stop, status effect application, and entity death logic (loot, XP).

- **[Physics & Collision System](./systems/physics-collision.md)**
  - **Covers**: `PhysicsService`, `CollisionService`, `SpatialHashService`.
  - **Summary**: Manages entity movement, friction, wall sliding, and efficient broad-phase collision detection using a spatial hash grid.

- **[Render System](./systems/render-system.md)**
  - **Covers**: `RenderService` and all sub-renderers (e.g., `FloorRenderer`, `UnitRenderer`, `EffectRenderer`, `SpriteCacheService`).
  - **Summary**: Draws everything to the canvas, handling isometric projection, z-sorting, procedural sprite rendering, and performance optimizations like caching.

- **[Item & Inventory System](./systems/item-inventory-system.md)**
  - **Covers**: `InventoryService`, `CraftingService`, `ItemGeneratorService`, `ItemAffixService`, `ShopService`, `item.models.ts`.
  - **Summary**: Defines the item economy, including procedural loot generation, inventory/equipment management, item modification (crafting), and shop logic.

- **[UI System](./systems/ui-system.md)**
  - **Covers**: All Angular components, `UiPanelService`, `DialogueService`.
  - **Summary**: Manages all user interface elements, from the main HUD and menus to pop-up panels (Inventory, Journal, Codex) and interactive dialogue.
