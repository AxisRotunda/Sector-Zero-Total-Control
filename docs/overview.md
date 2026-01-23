# Sector Zero: Total Control - System Documentation Overview

**META**
- **ID**: `overview`
- **LAST_UPDATED**: `2026-01-29T14:30:00Z`
- **DESCRIPTION**: Central entry point for all system documentation. Sector Zero is a hard-realism isometric dystopian ARPG built using Zoneless Angular and a custom Canvas rendering engine.

---

## 1. Project Philosophy
Sector Zero focuses on "The Inversion"—a narrative and mechanical descent from the decaying physical surface into a digital/metaphysical singularity. 

### Technical Stack
- **Framework**: Angular v20+ (Zoneless / Signal-based state).
- **Rendering**: HTML5 Canvas with Isometric projection and procedural texture generation.
- **Persistence**: IndexedDB for high-capacity state saving.
- **Logic**: Strategy-pattern AI and ECS-lite entity updates.

## 2. Core Documentation Index

- **[Project Structure](./project-structure.md)**
  - Current file layout and architectural boundaries.
- **[Feature Breakdown](./features.md)**
  - Maps gameplay features to code implementations.
- **[Feature Status](./feature-status.md)**
  - Checklist for implementation milestones.
- **[Issue Tracker](./issue-tracker.md) (NEW)**
  - Log of persistent technical debt and known bugs.
- **[Changelog](./changelog.md) (NEW)**
  - Project history and links to the Git repository.

## 3. Specialized System Deep-Dives

- **[Zone & World System](./systems/world-system.md)**
  - **Covers**: `ZoneManager`, `WorldGraph`, `SectorLoader`.
  - **Summary**: Manages a hierarchical graph of persistent static sectors and instanced procedural dungeons.
- **[Render System](./systems/render-system.md)**
  - **Covers**: `LightingRenderer`, `StructureRenderer`, `FloorCache`.
  - **Summary**: Handles isometric projection, Z-sorting, and the dynamic Global Illumination pass.
- **[Combat & AI](./systems/ai-system.md)**
  - **Covers**: `AiService`, `SquadAi`, `CombatService`.
  - **Summary**: Governs tactical squad behaviors and the individual hit-stop combat feel.
- **[Mobile UX](./systems/mobile-ux.md)**
  - **Covers**: `JoystickComponent`, `HapticService`, `InputBuffer`.
  - **Summary**: Optimization of ARPG controls for touch interfaces.
