# Implementation & Refactoring Roadmap

**Document Version**: 1.0
**Date**: 2026-01-27

---

## 1. Executive Summary

This document outlines a prioritized roadmap for the next development cycle of "Sector Zero: Total Control." The audit reveals a strong but complex codebase with some architectural debt from rapid prototyping. The primary goals are to **stabilize** the foundation by resolving critical conflicts, **optimize** core systems for performance and scalability, and **complete** key ARPG and user experience features. This will be executed in three distinct phases to ensure stability at each step.

## 2. Critical Fixes (High Priority)

These tasks address immediate architectural conflicts, bugs, and orphaned code that pose a risk to stability and future development.

- **[P1][2h]** Consolidate Dual Event Bus Systems into the single typed implementation.
- **[P1][2h]** Remove All Deprecated and Orphaned Service Files to eliminate confusion.
- **[P1][4h]** Integrate In-Memory Sector State (`WorldStateService`) into the Global Save/Load System.
- **[P1][4h]** Decompose monolithic `PlayerControlService` into focused `CameraService` and `InteractionService`.
- **[P1][1h]** Resolve the duplicate `MissionService` implementations, merging features into the `game/` version.
- **[P1][1h]** Correct `PlayerService` facade to ensure comprehensive save/load data handling.

## 3. Performance Optimizations

These tasks focus on improving frame rate, reducing memory allocation, and ensuring a smooth user experience, especially on mobile devices.

- **[P2][4h]** Optimize the Entity Z-Sorting algorithm to use an efficient merge pass instead of a full re-sort.
- **[P2][6h]** Refactor the physics separation/steering behavior to reduce O(n^2) complexity in dense situations.
- **[P3][1h]** Implement a trigonometry cache for player/enemy animation calculations to reduce redundant computations.
- **[P3][2h]** Audit and reduce object allocations within the main game loop, particularly for vector math.
- **[P3][16h+]** *Research*: Investigate offloading the physics and spatial hash systems to a Web Worker.

## 4. Architectural Improvements

These tasks modernize the codebase, improve scalability, and enhance maintainability for long-term development.

- **[P2][8h]** Upgrade the persistence layer from `localStorage` to `IndexedDB` for asynchronous, larger saves.
- **[P2][6h]** Create a reusable `[draggable]` Angular directive to handle all touch/mouse drag-and-drop logic, simplifying the inventory component.
- **[P2][2h]** Refactor `WorldStateService` into a pure, serializable data store, removing its direct loading logic.
- **[P3][4h]** Ensure all application state management is standardized to use signal-based services for maximum reactivity and performance.

## 5. New Features & Completions

These tasks focus on delivering high-value, user-facing features that complete core gameplay loops.

- **[P2][6h]** Implement dynamic objective markers on the full-screen map, linked to the `MissionService`.
- **[P3][12h]** Implement the "Augment Installation" crafting feature, allowing players to add specific affixes to items.
- **[P3][16h+]** Design and implement the roguelite meta-progression system for unlocks between runs.
- **[P3][8h]** Create an Accessibility settings panel (e.g., colorblind filters, UI scaling, reduced screen shake).
- **[P3][4h]** Implement a protocol for an advanced multi-hit melee combo system.

## 6. File Restructuring Plan

- **DELETE**:
  - `src/core/event-bus.service.ts` & `src/core/game-events.ts`
  - `src/services/game-engine.service.ts`
  - `src/systems/player.service.ts`
  - `src/systems/world.service.ts`
  - `src/services/mission.service.ts` (the older, non-`game/` version)

- **SPLIT**:
  - `src/systems/player-control.service.ts` will be decomposed. Its camera logic will move to a new `src/systems/camera.service.ts` and its interaction logic to a new `src/services/interaction.service.ts`.

- **MERGE**:
  - The feature set (e.g., radiant quests) from the deprecated `src/services/mission.service.ts` will be merged into the primary `src/game/mission.service.ts`.

## 7. Documentation Updates Needed

- Update `project-structure.md` to reflect all file changes.
- Update `core-services.md` and `player-system.md` to document the new `CameraService`, `InteractionService`, and the consolidated `EventBusService`.
- Update `features.md` to correctly map features to the newly refactored services.
- Create a new document in `docs/systems/` for the `IndexedDB` persistence strategy.

## 8. Testing Strategy

- **Unit Tests**: Add tests for pure, critical services like `InputValidator`, the new `Draggable` directive, and `ItemAffixService`.
- **Integration Tests**: Focus on the complete save/load pipeline with `IndexedDB`. Verify event consolidation by ensuring a single listener fires for a given event.
- **Manual E2E Testing**:
  - A full playthrough after each phase is mandatory.
  - Rigorous testing of save/load across different sectors and after closing the app.
  - Verify all inventory and UI interactions on both desktop (mouse) and mobile (touch).
  - Confirm all keybindings and gamepad controls remain functional after input system refactors.

## 9. Rollout Phases

- **Phase 1: Stabilization (High Priority)**
  - **Goal**: Resolve all critical architectural conflicts and remove dead code.
  - **Tasks**: Execute all tasks listed in section #2.
  - **Outcome**: A stable, predictable codebase with a single source of truth for all core systems.

- **Phase 2: Modernization & Performance (Medium Priority)**
  - **Goal**: Improve the performance, scalability, and maintainability of core systems.
  - **Tasks**: Execute tasks marked [P2] from sections #3, #4, and #5.
  - **Outcome**: A faster, more robust application ready for significant feature expansion.

- **Phase 3: Feature Expansion (Low Priority)**
  - **Goal**: Complete remaining high-value user-facing features.
  - **Tasks**: Execute tasks marked [P3] from sections #3, #4, and #5.
  - **Outcome**: A more feature-complete and engaging gameplay experience.
