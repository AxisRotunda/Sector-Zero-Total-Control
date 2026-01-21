# SYSTEM: Item & Inventory System

**META**
- **ID**: `item-inventory-system`
- **LAST_UPDATED**: `2026-01-25T12:00:00Z`
- **PRIMARY_FILES**:
  - `src/game/inventory.service.ts`
  - `src/game/crafting.service.ts`
  - `src/services/item-generator.service.ts`
  - `src/services/item-affix.service.ts`
  - `src/services/shop.service.ts`
  - `src/models/item.models.ts`
  - `src/config/loot.config.ts`
- **DEPENDENCIES**: `player-system`, `core-services`

---

**ANALYSIS**

**PURPOSE**:
- This system defines the item economy. It handles the generation of procedural loot, player inventory management, equipment stats, trading (Shop), and item modification (Crafting).

**CORE_CONCEPTS**:
- **Procedural Generation**: `ItemGeneratorService` creates unique items by combining base types (`ItemType`), rarities, and procedurally selected affixes (`ItemAffixService`).
- **Inventory Management**: `InventoryService` manages the `bag` (array) and `equipped` (slot map) states. It handles logic for stacking, swapping, and equipping items, now including `AMULET` and `RING` slots.
- **Crafting (Nano-Forge)**: `CraftingService` allows players to modify existing items using 'Scrap' currency.
  - **Reroll**: Regenerates the stats/affixes of an item while keeping its level and type.
  - **Upgrade**: Increases the item's level and scales its existing stats.
- **Shop Economy**: `ShopService` generates a merchant inventory based on the current sector's difficulty. Buy/Sell prices are dynamic, influenced by the `Market Volatility` factor and Faction Reputation.

**KEY_INTERACTIONS**:
- **Input**: `CombatService` triggers loot generation. UI components (`InventoryComponent`, `ShopComponent`) trigger move/buy/sell/craft actions.
- **Output**: `InventoryService.equipmentStats` computed signal drives `PlayerStatsService`.
- **State Mutation**: Updates player's item lists, credits, and scrap.

**HEURISTICS_AND_PATTERNS**:
- **Computed Aggregation**: Player power is derived reactively from `equipmentStats`.
- **Currency Sink**: Crafting and Shopping act as the primary sinks for the 'Scrap' and 'Credits' resources.

---

**API_REFERENCE**

### `src/game/inventory.service.ts`

#### `InventoryService`

**SIGNALS**:
- `bag`: `Signal<Item[]>`
- `equipped`: `Signal<{ weapon, armor, implant, stim, amulet, ring }>`
- `equipmentStats`: `Signal<Stats>` (Computed)

**PUBLIC_METHODS**:
- `addItem(item: Item)`: Adds to bag, handles stacking.
- `moveItem(item, source, target)`: Core drag-and-drop logic.
- `equip(item)`, `unequip(slot)`: Helper methods.

### `src/game/crafting.service.ts`

#### `CraftingService`

**PUBLIC_METHODS**:
- `rerollItem(item: Item)`:
  - **Cost**: 50 Scrap.
  - **Effect**: Re-rolls stats via `ItemGeneratorService`.
- `upgradeItem(item: Item)`:
  - **Cost**: 100 Scrap.
  - **Effect**: Increments level, scales stats by ~15%.

### `src/services/item-generator.service.ts`

#### `ItemGeneratorService`

**PUBLIC_METHODS**:
- `generateLoot(context: LootContext)`:
  - **Parameters**: `level`, `difficulty`, `source` (Enemy/Boss), `forceType`.
  - **Returns**: A new `Item` with appropriate tier and affixes.

### `src/services/shop.service.ts`

#### `ShopService`

**PUBLIC_METHODS**:
- `openShop(factionId, level, difficulty)`: Generates fresh stock.
- `buyItem(item)`, `sellItem(item, index)`: Transaction logic.
- `salvageItem(item, index)`: Destroys item, grants Scrap based on rarity.
