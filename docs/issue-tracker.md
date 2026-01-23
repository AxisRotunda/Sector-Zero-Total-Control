# Persistent Issues & Technical Debt

**META**
- **ID**: `issue-tracker`
- **LAST_UPDATED**: `2026-01-29T14:45:00Z`
- **DESCRIPTION**: A log of recurring problems, edge cases, and areas requiring optimization that are not yet resolved.

---

## 1. Critical Bugs (Logic/Crash)

- **[P1] Zone Transition Jitter**: On some mobile browsers, transitioning zones via walking triggers the transition logic twice if the player doesn't move far enough from the trigger immediately.
  - *Current Workaround*: 1-second cooldown added to `InteractionService`.
- **[P2] Z-Sorting Edge Cases**: Tall structures (e.g., Spire) occasionally flicker or draw behind the player when the player is standing exactly at the "Base" of the isometric diamond.

## 2. Performance Bottlenecks

- **[P2] Physics O(n^2) Complexity**: The separation/steering logic in `PhysicsService` scales poorly in sectors with more than 50 active enemies.
  - *Potential Fix*: Implement a Quadtree or use the existing Spatial Hash for physics neighbor queries.
- **[P3] Vector Allocation**: The main game loop still allocates small objects for vector math (`{x, y}`). This causes garbage collection spikes on low-end devices during heavy combat.
  - *Required*: Audit `IsoUtils` and `UnitRenderer` for pool-based vector reuse.

## 3. UI / UX friction

- **[P2] Drag-and-Drop Reliability**: Touch-based dragging in the Inventory can sometimes "stick" if the user scrolls the page simultaneously.
- **[P3] Map Orientation**: Mouse users find the rotating mini-map disorienting compared to the fixed full map.
  - *Potential Fix*: Add a "Lock Mini-map North" setting.

## 4. Technical Debt

- **Deprecated Logic Cleanup**: Several files in `src/systems/` still contain legacy code from the 1.0 procedural prototype that has been superseded by 3.0 data-driven systems.
- **Event Bus Consolidation**: There is a minor overlap between the global `EventBusService` and the `MissionService` internal observers.
