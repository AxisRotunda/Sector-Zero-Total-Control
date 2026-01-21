# SYSTEM: AI System

**META**
- **ID**: `ai-system`
- **LAST_UPDATED**: `2025-05-21T17:00:00Z`
- **PRIMARY_FILES**:
  - `src/systems/ai.service.ts`
  - `src/systems/squad-ai.service.ts`
- **DEPENDENCIES**: `world-system`, `player-system`, `entity-system`

---

**ANALYSIS**

**PURPOSE**:
- This system controls the behavior of all non-player entities, primarily enemies. It determines their state (IDLE, MOVE, ATTACK, RETREAT), movement, and usage of abilities. It now supports squad-based coordination and specialized tactical roles.

**CORE_CONCEPTS**:
- **Strategy Pattern**: `AiService` maps an enemy's `subType` to unique update functions (e.g., `updateSniper`, `updateFlanker`). This allows for highly specialized behavior per enemy type.
- **Squad Coordination**: `SquadAiService` manages groups of entities that share a `squadId`. The system calculates formation offsets so that "Attacker" role enemies fan out or stay in defensive clusters rather than stacking on top of each other.
- **Tactical Roles**:
  - `ATTACKER`: The standard role, seeks to flank or engage the player directly.
  - `SUPPORT`: Stays behind the front line. It prioritizes finding and healing injured squad members when they drop below 80% HP, only engaging the player if no allies need assistance.
- **Cover Seeking**: Non-boss enemies with low HP (defined by `COVER_HP_THRESHOLD` in `balance.config.ts`) will attempt to find the nearest `WALL` entity and position themselves behind it relative to the player's position to break line-of-sight.
- **Leashing**: Enemies will `RETREAT` to their `homeX/Y` coordinates if they move too far from their spawn point. While retreating, they gain accelerated HP regeneration.

**KEY_INTERACTIONS**:
- **Input**: Reads `player` and `squad` member data from `WorldService`. `EntityUpdateService` calls the AI update for each enemy.
- **Output**: Mutates the enemy entity's `state`, `angle`, `vx`, and `vy` properties. `SUPPORT` roles can directly modify the `hp` of other entities.
- **State Mutation**: Direct property modification of the enemy `Entity`.

**HEURISTICS_AND_PATTERNS**:
- **State Machine**: Each AI update function acts as a simple state machine, transitioning the entity between states like `IDLE`, `MOVE`, `CHARGE`, `RETREAT`, and `SUPPORT`.
- **Dynamic Formations**: Squad offsets are calculated using polar coordinates relative to the angle between the player and the squad center, creating a dynamic flanking behavior.
- **Behavioral Override**: AI roles (`aiRole`) can override the default `subType` behavior, allowing a `GRUNT` entity to act as a `SUPPORT` if assigned that role.

---

**API_REFERENCE**

### `src/systems/squad-ai.service.ts`

#### `SquadAiService`

**PUBLIC_METHODS**:
- `registerMember(entity: Entity)`: Adds an entity to its assigned squad map upon creation.
- `getSquadMembers(squadId: number)`: Retrieves all living members of a given squad.
- `getSquadOrders(entity: Entity, player: Entity)`:
  - **Returns**: `{ xOffset, yOffset, behavior: 'ATTACK' | 'SUPPORT' }`.
  - **Logic**: Calculates a target position offset for `ATTACKER` roles to maintain formation. `SUPPORT` roles receive no offset and handle their own positioning.

### `src/systems/ai.service.ts`

#### `AiService`

**PUBLIC_METHODS**:
- `updateEnemy(entity: Entity, player: Entity)`: The main entry point for AI logic.
  - **Execution Order**:
    1. Checks leash range and enters `RETREAT` state if necessary.
    2. Checks aggro range and enters `IDLE` state if player is too far.
    3. Gets squad orders to determine target position.
    4. Checks for low HP to enter `SEEK_COVER` behavior.
    5. Delegates to a role-based (`SUPPORT`) or type-based (`SNIPER`, `GRUNT`) strategy.

**PRIVATE_STRATEGIES**:
- `updateSupport(...)`: Logic for support-role enemies. Prioritizes finding and healing squad members.
- `updateSeekCover(...)`: Logic triggered at low HP. Queries the spatial hash for nearby walls and moves to a calculated "shadow" position.
- `updateDefault(...)`, `updateFlanker(...)`, `updateSkirmisher(...)`, `updateSniper(...)`, `updateStealth(...)`: Specific combat behavior routines for different enemy archetypes.
