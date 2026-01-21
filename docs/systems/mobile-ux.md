# Mobile UX & Input Patterns

**META**
- **ID**: `mobile-ux`
- **LAST_UPDATED**: `2025-05-22T14:00:00Z`
- **PURPOSE**: Documents the specific input handling and UI patterns designed for touch-screen devices.

---

## 1. Input Zones

The game screen is logically divided to support ergonomic thumb use.

*   **Left Zone (0% - 50% width)**:
    *   **Primary Function**: Movement.
    *   **Implementation**: A floating, dynamic joystick (`app-joystick`). The center point is set wherever the user first touches.
    *   **Logic**: `JoystickComponent` calculates a normalized vector relative to the touch start position.

*   **Right Zone (50% - 100% width)**:
    *   **Primary Function**: Combat & Actions.
    *   **Double Tap**: Triggers the **DASH** ability towards the current facing direction.
    *   **Action Arc**: A cluster of buttons positioned at the bottom-right corner for easy thumb reach:
        *   **Primary (Large)**: Main Attack.
        *   **Secondary (Medium)**: Blast Skill.
        *   **Utility (Medium)**: Stasis Field.
        *   **Ultimate (Floating)**: Appears only when charged.

## 2. Inventory Interactions

Managing complex inventory on mobile requires specific gestures to replace mouse hover and drag-and-drop.

*   **Single Tap**: Opens the Item Tooltip. This mimics the "Hover" state on desktop, allowing the user to inspect stats before taking action.
*   **Double Tap**: **Quick Action**.
    *   If item is in **Bag**: Equips the item to the appropriate slot. Swaps if full.
    *   If item is **Equipped**: Unequips the item to the first available bag slot.
*   **Long Press & Drag**: Initiates a drag-and-drop operation.
    *   **Visual Feedback**: A ghost icon follows the finger.
    *   **Logic**: A timer (300ms) starts on `touchstart`. If the finger moves significantly before the timer ends, the action is interpreted as a scroll (if inside a scrollable container). If the timer fires, drag mode is engaged.

## 3. Haptic Feedback

The `HapticService` provides tactile confirmation for actions, crucial for touch interfaces lacking physical button feedback.

*   **Light Impact (10ms)**: UI Button clicks, opening menus, toggling options.
*   **Medium Impact (30ms)**: Dash activation, Enemy death, Loot pickup.
*   **Heavy Impact (50ms)**: Taking damage, Critical hits, Explosion effects.
*   **Patterns**:
    *   **Error**: Double pulse (`50ms, 100ms, 50ms`).
    *   **Success**: Quick pulse (`20ms, 50ms, 20ms`).

## 4. UI Scaling & Safe Areas

*   **Viewport**: `user-scalable=no`, `viewport-fit=cover` ensures the app behaves like a native game.
*   **Safe Areas**: CSS variables `env(safe-area-inset-...)` are used in `app-hud` to prevent UI elements from being obscured by notches or home bars.
*   **Hit Targets**: All interactive elements have a minimum touch target size of 44x44px (or effectively larger via padding).
