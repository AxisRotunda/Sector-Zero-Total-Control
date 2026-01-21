
# SYSTEM: Input Buffer

**META**
- **ID**: `input-buffer-system`
- **LAST_UPDATED**: `2025-05-23T10:00:00Z`
- **PRIMARY_FILES**:
  - `src/services/input-buffer.service.ts`
  - `src/systems/player-control.service.ts`
- **DEPENDENCIES**: `core-services`, `player-system`

---

**ANALYSIS**

**PURPOSE**:
- To provide a smoother, more responsive combat experience on mobile devices by mitigating input latency and precision issues. It allows actions pressed "slightly too early" (e.g., while in hit-stun or cooldown) to be queued and executed immediately upon becoming available.

**CORE_CONCEPTS**:
- **Action Queue**: A short-lived (TTL ~300ms) buffer of player commands (`PRIMARY`, `DASH`, etc.).
- **Prioritization**: Commands are ranked. A `DASH` (Evasion) might prioritize over a `PRIMARY` attack if both are buffered.
- **Consumption**: The `PlayerControlService` checks this buffer every frame. If the player is in a valid state to act (e.g., `IDLE` or `MOVE`), it consumes the highest-priority valid command.

**KEY_INTERACTIONS**:
- **Input**: `PlayerControlService` pushes commands to `InputBufferService` when `InputService` detects button presses.
- **Output**: `PlayerControlService` pulls commands and calls `PlayerAbilitiesService.useSkill()`.

**HEURISTICS**:
- **Latency Compensation**: Essential for "Game Feel". Without buffering, a player might tap "Attack" 10ms before their previous attack finishes, and the input would be eaten, feeling unresponsive.
- **Mobile Ergonomics**: Touch screens lack tactile feedback for "pressed" states. Buffering ensures that even imperfect timing registers intent.

---

**API_REFERENCE**

### `src/services/input-buffer.service.ts`

#### `InputBufferService`

**PUBLIC_METHODS**:
- `addCommand(type: CommandType, angle?: number, priority?: number)`: Adds a command to the queue. Automatically prunes old commands.
- `consumeCommand()`: Returns the highest priority, valid command and removes it from the queue.
- `peekCommand()`: Returns the next command without removing it (useful for checking if we *should* auto-attack or wait for a manual command).
- `clear()`: Wipes the buffer (e.g., on death or cutscene).
