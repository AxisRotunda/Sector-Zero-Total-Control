
# SYSTEM: Camera System

**META**
- **ID**: `camera-system`
- **LAST_UPDATED**: `2026-01-29T12:00:00Z`
- **PRIMARY_FILES**:
  - `src/game/camera.service.ts`
  - `src/systems/rendering/render.config.ts`
- **DEPENDENCIES**: `world-system`, `player-system`

---

**ANALYSIS**

**PURPOSE**:
- Manages the viewport into the game world. It provides a dynamic, responsive view that adapts to the player's tactical needs (Zoom) and movement (Look-Ahead), while enforcing the simulation boundaries (World Bounds).

**CORE_CONCEPTS**:
- **Dynamic Sensitivity**: Input sensitivity scales with zoom level. 
  - *Tactical View (Zoomed Out)*: Lower sensitivity for precise framing.
  - *Action View (Zoomed In)*: Higher sensitivity for rapid adjustments.
- **Zoom-Responsive Look-Ahead**: The camera projects a target position in front of the player based on velocity. This projection scales inversely with zoom—zooming out lets the player see further ahead.
- **Soft-Clamp Bounds**: The camera target is clamped to the world map boundaries *before* smoothing is applied. This ensures the camera decelerates naturally as it approaches the edge, never showing the "void" outside the map.

**ALGORITHMS**:

### 1. Sensitivity Curve
```typescript
zoomProgress = (targetZoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM);
sensitivity = MIN_SENS + (MAX_SENS - MIN_SENS) * zoomProgress;
```

### 2. Look-Ahead & Bounds
```typescript
zoomFactor = 1.0 + (1.0 - zoom) * 0.5;
target = playerPos + (playerVel * LOOK_AHEAD * zoomFactor);
clampedTarget = clamp(target, mapBounds - margin);
cameraPos = lerp(cameraPos, clampedTarget, damping);
```

**KEY_INTERACTIONS**:
- **Input**: `InputService` (Scroll/Pinch), `PlayerService` (Position/Velocity), `WorldService` (MapBounds).
- **Output**: Mutates `WorldService.camera` x, y, and zoom.

**CONFIGURATION (`render.config.ts`)**:
- `MIN_ZOOM_SENSITIVITY`: 0.0005
- `MAX_ZOOM_SENSITIVITY`: 0.002
- `LOOK_AHEAD_DIST`: 20
- `BOUNDS_MARGIN`: 100
- `POSITION_DAMPING`: 0.08
