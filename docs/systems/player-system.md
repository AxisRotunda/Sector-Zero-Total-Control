# SYSTEM: Player System

**META**
- **ID**: `player-system`
- **LAST_UPDATED**: `2025-05-21T17:00:00Z`
- **PRIMARY_FILES**:
  - `src/game/player/player.service.ts`
  - `src/game/player/player-stats.service.ts`
  - `src/game/player/player-progression.service.ts`
  - `src/game/player/player-abilities.service.ts`
  - `src/systems/player-control.service.ts`
- **DEPENDENCIES**: `world-system`, `item-inventory-system`, `skill-tree-system`, `core-services`, `physics-collision`

---

**ANALYSIS**

**PURPOSE**:
- This system encapsulates all logic and data related to the player character. It's structured as a facade (`PlayerService`) that aggregates several specialized sub-services for stats, progression, and abilities. It also includes the control service that translates user input into player actions.

**CORE_CONCEPTS**:
- **Facade Service**: `PlayerService` serves as a single point of injection for other systems, providing access to all player-related functionality and state.
- **Computed Stats**: `PlayerStatsService` uses an Angular `computed` signal to derive the player's final stats. It automatically recalculates whenever its dependencies (skill tree stats, equipped items) change. This is a core reactive pattern.
- **Progression**: `PlayerProgressionService` manages XP, leveling up, and currency.
- **Abilities**: `PlayerAbilitiesService` handles cooldowns, energy costs, and the direct effects of using a skill (e.g., creating a hitbox).
- **Player Control**: `PlayerControlService` is the "brain" of the player entity during the update loop. It reads from `InputService` and `PlayerService` to move the player, handle auto-combat, and manage interactions.

**KEY_INTERACTIONS**:
- **Input**: Consumes `InputService` state for movement and actions. Consumes `SkillTreeService` and `InventoryService` computed signals for stat calculation.
- **Output**: Modifies the `player` entity in `WorldService`. Dispatches events via `EventBusService` (e.g., `PLAYER_LEVEL_UP`, `ADD_SCREEN_SHAKE`). Creates `HITBOX` entities.
- **State Mutation**: All sub-services manage their own signals (`level`, `playerHp`, `cooldowns`, etc.). `PlayerControlService` mutates the player `Entity`'s position, velocity, and state.

**HEURISTICS_AND_PATTERNS**:
- **Facade Pattern**: `PlayerService` simplifies access to the player subsystem.
- **Reactive Programming**: Extensive use of `signal` and `computed` ensures that data flows automatically and efficiently. For example, equipping an item automatically updates the `playerStats` computed signal, which might then affect damage calculations and UI displays without manual refresh calls.
- **Separation of Concerns**: The player's logic is cleanly separated into stats, progression, abilities, and control, making the system easier to manage.

---

**API_REFERENCE**

### `src/game/player/player-stats.service.ts`

#### `PlayerStatsService`

**SIGNALS / STATE**:
- `playerStats`:
  - **Type**: `Signal<object>` (Computed)
  - **Description**: Derives the final combat stats of the player by combining stats from the skill tree and equipped gear. This is the single source of truth for player combat values.
- `playerHp`, `psionicEnergy`, `maxPsionicEnergy`:
  - **Type**: `Signal<number>`
  - **Description**: Manages the player's current and maximum resource values.

**PUBLIC_METHODS**:
- `takeDamage(amt: number)`:
  - **Description**: Reduces player HP, applies hit flash, triggers screen shake and sound, and handles player death logic by dispatching a `PLAYER_DEATH` event.
- `update()`:
  - **Description**: Called every frame to handle passive regeneration of HP and psionic energy.

### `src/game/player/player-progression.service.ts`

#### `PlayerProgressionService`

**SIGNALS / STATE**:
- `level`, `currentXp`, `credits`, `scrap`, `nextLevelXp`:
  - **Type**: `Signal<number>`
  - **Description**: Manages the player's level, experience points, and all currencies.

**PUBLIC_METHODS**:
- `gainXp(amount: number)`:
  - **Description**: Adds XP to the player. If XP exceeds `nextLevelXp`, it triggers a level up, grants a skill point, and dispatches events.
- `gainCredits(amount: number)`:
  - **Description**: Adds or removes credits and spawns a floating text notification.
- `gainScrap(amount: number)`:
  - **Description**: Adds or removes scrap currency used for crafting.

### `src/game/player/player-abilities.service.ts`

#### `PlayerAbilitiesService`

**SIGNALS / STATE**:
- `cooldowns`, `maxCooldowns`:
  - **Type**: `Signal<object>`
  - **Description**: Tracks the current remaining frames and total duration for each ability cooldown.

**PUBLIC_METHODS**:
- `useSkill(skill: 'PRIMARY' | 'SECONDARY' | 'DASH' | 'UTILITY' | 'OVERLOAD' | 'SHIELD_BASH', targetAngle?: number)`:
  - **Description**: The main entry point for activating any player ability. It checks costs and cooldowns, applies them, and executes the skill's effect (e.g., setting player state to 'ATTACK', spawning hitboxes, applying velocity).
- `updateCooldowns()`:
  - **Description**: Called every frame to decrement active cooldown timers.

### `src/systems/player-control.service.ts`

#### `PlayerControlService`

**SIGNALS / STATE**:
- `nearbyInteractable`:
  - **Type**: `Signal<Entity | null>`
  - **Description**: Holds a reference to the closest interactable NPC or object if one is in range. Consumed by `HudComponent` to show an interaction button.
- `activeInteractable`:
  - **Type**: `Signal<Entity | null>` (Computed)
  - **Description**: A safe version of `nearbyInteractable` for UI binding that filters out dead or recycled entities to prevent errors.
- `requestedFloorChange`:
  - **Type**: `Signal<'UP' | 'DOWN' | string | null>`
  - **Description**: Set when the player collides with an exit entity. Consumed by `GameEngineService` to trigger a floor change.

**PUBLIC_METHODS**:
- `update(globalTime: number)`:
  - **Description**: The main update function for the player. Orchestrates movement, animation state changes, camera control, interaction checks, and auto-combat logic.
