# Feature Breakdown

**META**
- **ID**: `feature-breakdown`
- **LAST_UPDATED**: `2026-01-29T14:40:00Z`
- **DESCRIPTION**: Mapping of game features to their technical implementations.

---

### World & Exploration

| Feature | primary Code Files | Description |
| :--- | :--- | :--- |
| **Hierarchical Zones** | `zone-manager.service.ts`, `world-graph.config.ts` | The world is a graph of connected sectors with parent/child relationships. |
| **Rift Network** | `waypoint.service.ts`, `world-map-modal.component.ts` | Unlockable fast-travel points and personal return-rifts. |
| **Fog of War** | `map.service.ts`, `map.component.ts` | Discovery-based map drawing that persists per sector. |
| **Dynamic Lighting** | `lighting.service.ts`, `lighting-renderer.service.ts` | Zone-specific ambient light and real-time light source culling. |

### Character & Combat

| Feature | Primary Code Files | Description |
| :--- | :--- | :--- |
| **Psionic Combat** | `player-abilities.service.ts`, `player-stats.service.ts` | Ability usage using PSI-SIG energy, featuring the "Overload" mechanic. |
| **Squad AI** | `squad-ai.service.ts`, `ai.service.ts` | Enemies coordinate movement and roles (Support/Attacker). |
| **Melee Combos** | `player-control.service.ts`, `player-abilities.service.ts` | 3-step primary attack chain with frame-locked hitbox windows. |
| **Procedural Loot** | `item-generator.service.ts`, `item-affix.service.ts` | Diablolike loot system with tiers, prefixes, and suffixes. |

### Narrative & Systems

| Feature | Primary Code Files | Description |
| :--- | :--- | :--- |
| **Branching Dialogue** | `dialogue.service.ts`, `dialogue-overlay.component.ts` | Requirement-based dialogue nodes influenced by stats and rep. |
| **Faction Reputation** | `narrative.service.ts`, `codex.component.ts` | Tracking standings with Vanguard, Remnant, and Guardians. |
| **Nano-Forge** | `crafting.service.ts`, `inventory.component.ts` | Item level optimization and stat re-initialization (rerolling). |
| **Save Pipeline** | `persistence.service.ts`, `indexed-db.service.ts` | Async binary-capable saving of the entire world state. |
