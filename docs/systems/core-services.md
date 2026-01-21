# SYSTEM: Core Services & Game Loop

**META**
- **ID**: `core-services`
- **LAST_UPDATED**: `2026-01-26T10:00:00Z`
- **PRIMARY_FILES**:
  - `src/game/game-engine.service.ts`
  - `src/game/time.service.ts`
  - `src/services/input.service.ts`
  - `src/services/input-buffer.service.ts`
  - `src/services/input-validator.service.ts`
  - `src/core/persistence.service.ts`
  - `src/services/sound.service.ts`
  - `src/services/haptic.service.ts`
- **DEPENDENCIES**: `world-system`, `entity-system`, `player-system`, `ui-system`

---

**ANALYSIS**

**PURPOSE**:
- This cluster of services forms the foundational layer of the application. It is responsible for orchestrating the main game loop, handling time (including dilation/pausing), user inputs (raw, buffered, and validated), game state persistence, and sensory feedback (audio/haptics).

**CORE_CONCEPTS**:
- **Game Loop**: The `GameEngineService` uses `requestAnimationFrame` to create a continuous loop. This loop drives the `TimeService`, which determines if enough time has passed to trigger a logic update (`tick()`).
- **Time Management**: `TimeService` decouples "Real Time" from "Game Time". It handles:
  - **Delta Time Accumulation**: Ensures fixed-step logic updates (60hz) regardless of frame rate.
  - **Time Dilation**: Allows for slow-motion effects (e.g., on critical hits) via `timeScale`.
  - **Hit Stop**: Can pause the game logic entirely for a few frames to add impact to combat events.
- **Input Pipeline**:
  - `InputService`: Captures raw browser events (keyboard, mouse, touch, gamepad).
  - `InputBufferService`: Queues actions (like attacks) for short durations to allow for "early" presses during animations to register, improving game feel.
  - `InputValidatorService`: Sanitizes input vectors (e.g., from physics or joystick) to ensure they are finite and clamped, preventing crashes due to `NaN` propagation.
- **State Serialization**: The `PersistenceService` acts as a facade for saving and loading. It coordinates with other services to gather serializable data and stores it in `localStorage`.
- **Procedural Audio**: The `SoundService` uses the Web Audio API to synthesize sound effects dynamically.
- **Haptics**: `HapticService` interfaces with the `navigator.vibrate` API to provide tactile feedback for key game events.

**KEY_INTERACTIONS**:
- **Input**: `InputService` consumes DOM events. `PlayerControlService` reads from `InputBufferService`.
- **Output**: `SoundService` and `HapticService` provide feedback. `GameEngineService` drives `RenderService`.
- **State Mutation**: `TimeService` updates `globalTime`. `PersistenceService` snapshots state.

**HEURISTICS_AND_PATTERNS**:
- **Singleton Services**: All services are `providedIn: 'root'`.
- **Facade Pattern**: `PersistenceService` simplifies saving/loading.
- **Fixed Time Step**: The logic loop uses an accumulator to ensure deterministic updates, crucial for physics consistency.

---

**API_REFERENCE**

### `src/game/game-engine.service.ts`

#### `GameEngineService`

**SIGNALS / STATE**:
- `isInMenu`: `Signal<boolean>` - Pauses the main game rendering/logic when true.

**PUBLIC_METHODS**:
- `init(canvas: HTMLCanvasElement)`: Starts the loop.
- `startGame(isNew: boolean)`: Bootstraps a session (new or loaded).
- `changeFloor(direction: string)`: Handles transition between Sectors. Saves state of current sector, loads/generates next.

### `src/game/time.service.ts`

#### `TimeService`

**PUBLIC_PROPERTIES**:
- `globalTime`: `number` - Total number of logic ticks processed.
- `timeScale`: `Signal<number>` - Multiplier for game speed (1.0 = normal, 0.2 = slow-mo).

**PUBLIC_METHODS**:
- `tick()`:
  - **Description**: Advances the accumulator based on delta time and `timeScale`. Returns `true` if a physics/logic step should occur. Handles `hitStopFrames`.
- `triggerHitStop(intensity: 'LIGHT' | 'HEAVY' | number)`:
  - **Description**: Pauses the game logic for a few frames to emphasize impact.
- `triggerSlowMo(durationMs: number, scale: number)`:
  - **Description**: Smoothly transitions time scale to target value and back.

### `src/services/input.service.ts`

#### `InputService`

**PUBLIC_PROPERTIES**:
- `inputVector`: `{ x: number, y: number }`
- `aimAngle`: `number | null`
- `isAttackPressed`: `boolean`

**PUBLIC_METHODS**:
- `setJoystick(x: number, y: number)`: Updates input vector from touch UI.

### `src/services/input-buffer.service.ts`

#### `InputBufferService`

**PUBLIC_METHODS**:
- `addCommand(type, angle, priority)`: Adds a combat command to the short-term queue.
- `consumeCommand()`: Returns the highest priority command if valid.

### `src/core/persistence.service.ts`

#### `PersistenceService`

**PUBLIC_METHODS**:
- `saveGame()`: Serializes state from Player, World, Inventory, etc.
- `loadGame()`: Deserializes state and restores service data.
- `resetGame()`: Wipes save data.
