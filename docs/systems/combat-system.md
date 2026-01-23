
# SYSTEM: Combat System

**META**
- **ID**: `combat-system`
- **LAST_UPDATED**: `2026-01-30T10:00:00Z`
- **PRIMARY_FILES**:
  - `src/systems/combat.service.ts`
  - `src/systems/status-effect.service.ts`
  - `src/systems/collision.service.ts`
  - `src/game/player/player-abilities.service.ts`
  - `src/game/time.service.ts`
- **DEPENDENCIES**: `player-system`, `world-system`, `entity-system`, `item-inventory-system`, `core-services`

---

**ANALYSIS**

**PURPOSE**:
- The definitive authority on combat resolution. It calculates damage (mitigation, crits), processes hits (collision to effect), applies status effects (resistances), and manages the "Game Feel" via Hit-Stop.

**ARCHITECTURE FLOW**:
```mermaid
Input -> PlayerControlService -> PlayerAbilitiesService -> HITBOX Spawning
                                        |
World Update Loop -> Physics/Collision Check <-> Spatial Hash
                                        |
                                Collision Detected
                                        |
CollisionService -> CombatService.processHit(hitbox, target)
                                        |
                                1. Calc Crit & Multipliers
                                2. Apply Weakness
                                3. Subtract Armor Pen
                                4. Apply DR Formula
                                5. Apply Status (w/ Resistances)
                                6. Trigger Hit-Stop (Global + Local)
                                7. Check Death
```

**CORE SUBSYSTEMS**:

### 1. The Damage Pipeline (`calculateMitigatedDamage`)

Damage is processed in a strictly ordered pipeline to ensure predictable scaling.

1.  **Incoming Base Damage**: From `hitbox.damageValue` or Weapon Stats.
2.  **Critical Roll**:
    *   `chance = source.critChance` (or Player Stats).
    *   `if (random < chance) damage *= 1.5`.
3.  **Vulnerability (Weakness)**:
    *   If target has `weakness` status: `damage *= (1 + weakness.damageReduction)`.
4.  **Armor Mitigation**:
    *   **Armor Penetration**: `effectiveArmor = max(0, target.armor * (1 - weakness.armorReduction) - source.armorPen)`.
    *   **Diminishing Returns Formula**:
        ```typescript
        reduction = effectiveArmor / (effectiveArmor + (10 * damage));
        ```
        *Example: 50 Armor vs 10 Damage = 50 / (50 + 100) = 33% reduction.*
    *   **Hard Cap**: Reduction is clamped at **90%**.
    *   `finalDamage = damage * (1 - reduction)`.

### 2. Hitbox Lifecycle & filtering

*   **Spawning**: Created via `EntityPoolService` (usually `HITBOX` type).
*   **Filtering**: To prevent a single sword swing from damaging an enemy 60 times a second, every Hitbox entity maintains a `hitIds: Set<number>`.
    *   When `CollisionService` detects an overlap, it checks `hitbox.hitIds.has(target.id)`.
    *   If false, it processes the hit and adds `target.id` to the set.
*   **Cleanup**:
    *   **Melee**: Have a `timer` property (e.g., 12 frames). Removed when timer <= 0.
    *   **Projectiles**: Destroyed immediately upon impact (`timer = 0`) unless they have a `pierce` property (not currently implemented).

### 3. Attack State Machine (Player)

The player's melee combat is governed by a frame-locked state machine in `PlayerControlService`.

| State | Frames | Description | Input Allowed? |
| :--- | :--- | :--- | :--- |
| **STARTUP** | 0 - 2 | Telegraphing animation. No hitbox. | Buffered Only |
| **ACTIVE** | 3 - 5 | **Hitbox Spawned**. Damage window. | Buffered Only |
| **RECOVERY**| 6 - 8 | Animation follow-through. | **Yes (Combo)** |

*   **Combos**: Input during `RECOVERY` triggers the next stage of the combo chain (0 -> 1 -> 2 -> 0).
*   **Data**:
    *   **Stage 1**: 1.0x Dmg, small knockback.
    *   **Stage 2**: 1.2x Dmg, medium knockback.
    *   **Stage 3**: 2.5x Dmg, heavy knockback + Stun.

### 4. Status Effects & Resistances

Status effects are objects stored on the `Entity.status` property.

*   **Application Logic**:
    *   `incomingDuration = baseDuration * target.resistances[type]`.
    *   **Merge Strategy**:
        *   `STUN/SLOW`: `max(currentDuration, newDuration)`.
        *   `DOTS` (Poison/Burn): Overwrite if `newDuration > currentDuration`.
*   **Tick Logic (`StatusEffectService`)**:
    *   **Poison**: 30 tick rate.
    *   **Burn**: 30 tick rate.
    *   **Bleed**: 30 tick rate. Damage scales: `dps * stacks`.

### 5. Hit-Stop (Game Feel)

Two distinct systems work in tandem to sell impact:

1.  **Global Hit-Stop (`TimeService`)**:
    *   Pauses the **entire game loop** (physics, AI, rendering updates) for a few frames (3-10).
    *   Triggered on heavy hits or crits.
    *   Result: Everything freezes, emphasizing the moment of impact.
2.  **Local Hit-Stun (`Entity.hitStopFrames`)**:
    *   Pauses **only the specific entity** for a duration.
    *   Entity cannot move or attack.
    *   Result: The enemy flinches/freezes while the player can continue moving (after the global stop ends).

---

**API_REFERENCE**

### `src/systems/combat.service.ts`

#### `CombatService`

**PUBLIC_METHODS**:
- `processHit(hitbox: Entity, target: Entity)`: The atomic unit of combat. Resolves one interaction.
- `applyDirectDamage(attacker, target, val)`: Used for contact damage (walking into enemies).
- `killEnemy(e)`: Handles XP, loot generation, and equipped item drops.

### `src/game/player/player-abilities.service.ts`

#### `PlayerAbilitiesService`

**PUBLIC_METHODS**:
- `spawnPrimaryAttackHitbox(player)`: Calculates reach/damage based on equipped weapon and combo index, then spawns the `HITBOX` entity into the world.
