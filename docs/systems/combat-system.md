# SYSTEM: Combat System

**META**
- **ID**: `combat-system`
- **LAST_UPDATED**: `2025-05-21T17:00:00Z`
- **PRIMARY_FILES**:
  - `src/systems/combat.service.ts`
  - `src/systems/status-effect.service.ts`
- **DEPENDENCIES**: `player-system`, `world-system`, `entity-system`, `item-inventory-system`, `core-services`

---

**ANALYSIS**

**PURPOSE**:
- This system is the definitive authority on combat resolution. It calculates damage, processes hits, applies status effects, and handles the consequences of an entity's death (XP, loot, etc.). It integrates player stats, enemy stats, and environmental factors into a cohesive ruleset.

**CORE_CONCEPTS**:
- **Hit Processing**: The `processHit` method is the core of the system. It is called by `CollisionService` when a hitbox overlaps a valid target. It performs all calculations in a specific order: armor reduction, critical hit check, damage application, knockback, and status effect application.
- **Armor Penetration (AP)**: AP is a flat stat sourced from the player's skill tree and equipment. When a player-sourced hitbox hits an enemy, the AP value is subtracted from the target's armor *before* the damage reduction formula is applied: `EffectiveArmor = Max(0, TargetArmor - AttackerArmorPen)`.
- **Individual Hit-Stop**: To add weight to impacts, `processHit` sets a `hitStopFrames` value on the target entity. The `EntityUpdateService` will then pause that specific entity's logic for the duration, creating a satisfying stutter on hit without freezing the whole game.
- **Status Effect Application & Resistance**: `processHit` checks the hitbox for status effects to apply. Before applying, it checks the target's `resistances` property. A resistance value (e.g., `resistances: { burn: 0.5 }`) acts as a multiplier on the duration/intensity of the incoming effect.
- **Death Logic**: When an entity's HP drops to zero, `killEnemy` or `destroyObject` is called. These methods handle awarding XP and credits, triggering mission objectives, and initiating loot drops.
- **Enemy Equipment Drops**: `killEnemy` now inspects the `equipment` property of the defeated enemy. It then has a chance to drop the specific items the enemy was using, rather than always generating new loot.

**KEY_INTERACTIONS**:
- **Input**: `CollisionService` calls `processHit` when a valid combat collision occurs.
- **Output**: Dispatches floating text events via `EventBusService`. Creates `PICKUP` entities via `WorldService`. Modifies player state (HP, XP, credits) via `PlayerService`.
- **State Mutation**: Directly mutates the `hp`, `vx`, `vy`, and `status` properties of target entities. Sets entity `state` to `DEAD`.

**HEURISTICS_AND_PATTERNS**:
- **Centralized Rules Engine**: All core combat calculations are centralized in this service, ensuring consistent rule application across the game.
- **Event-Driven Feedback**: Rather than directly manipulating UI, the service dispatches events (e.g., for floating text), decoupling combat logic from its presentation.

---

**API_REFERENCE**

### `src/systems/combat.service.ts`

#### `CombatService`

**PUBLIC_METHODS**:
- `processHit(hitbox: Entity, target: Entity)`:
  - **Description**: The main entry point for resolving a single instance of damage.
  - **Logic Flow**: Calculates effective armor, applies damage, checks for crits, applies knockback, sets individual hit-stop frames, and applies status effects considering resistances.
- `killEnemy(e: Entity)`:
  - **Description**: Handles all logic for when an enemy dies.
  - **Side Effects**: Awards XP/credits to the player, updates mission progress, and triggers loot drop logic, including a chance for equipped items to drop.
- `destroyObject(e: Entity)`:
  - **Description**: Handles logic for destructible objects, such as explosive barrels.
- `updatePickup(e: Entity)`:
  - **Description**: Manages the behavior of loot pickups, causing them to magnetize towards the player when nearby.

### `src/systems/status-effect.service.ts`

#### `StatusEffectService`

**PUBLIC_METHODS**:
- `processStatusEffects(e: Entity, globalTime: number)`:
  - **Description**: Called every frame for each entity by `EntityUpdateService`. It decrements timers on active status effects and applies their periodic effects (e.g., damage-over-time for poison/burn).
