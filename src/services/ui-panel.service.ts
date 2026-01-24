
import { Injectable, signal, computed, inject } from '@angular/core';
import { InputService } from './input.service';
import { MapService } from './map.service';
import { GameStateService } from '../game/game-state.service';

export type PanelType = 'INVENTORY' | 'SKILLS' | 'SHOP' | 'ABILITIES' | 'CODEX' | 'MAP' | 'SETTINGS' | 'JOURNAL' | 'WORLD_MAP';

@Injectable({
  providedIn: 'root'
})
export class UiPanelService {
  private input = inject(InputService);
  private mapService = inject(MapService);
  private gameState = inject(GameStateService);

  private activePanel = signal<PanelType | null>(null);
  
  // Dynamic UI Scale for text sizing
  uiScale = signal(1.0);

  isInventoryOpen = computed(() => this.activePanel() === 'INVENTORY');
  isSkillsOpen = computed(() => this.activePanel() === 'SKILLS');
  isShopOpen = computed(() => this.activePanel() === 'SHOP');
  isAbilitiesOpen = computed(() => this.activePanel() === 'ABILITIES');
  isCodexOpen = computed(() => this.activePanel() === 'CODEX');
  isJournalOpen = computed(() => this.activePanel() === 'JOURNAL');
  isMapOpen = computed(() => this.activePanel() === 'MAP');
  isSettingsOpen = computed(() => this.activePanel() === 'SETTINGS');
  isWorldMapOpen = computed(() => this.activePanel() === 'WORLD_MAP');
  
  isAnyPanelOpen = computed(() => this.activePanel() !== null);

  // Consolidated logic for when to hide the cursor (mouse users)
  shouldHideCursor = computed(() => {
      if (!this.input.usingKeyboard()) return false;
      
      const uiOpen = this.isAnyPanelOpen() || 
                     this.gameState.isInMenu() || 
                     this.mapService.isFullMapOpen() || 
                     this.mapService.isSettingsOpen();
                     
      return !uiOpen;
  });
  
  constructor() {
      this.calculateUIScale();
      window.addEventListener('resize', () => this.calculateUIScale());
  }

  private calculateUIScale() {
      const baseWidth = 1920;
      const dpr = window.devicePixelRatio || 1;
      // Scale based on width, boosted slightly by DPR for mobile readability
      const scaleFactor = (window.innerWidth / baseWidth) * (dpr > 1 ? 1.2 : 1.0);
      // Clamp between 0.8x (Mobile) and 1.5x (4k)
      this.uiScale.set(Math.max(0.8, Math.min(1.5, scaleFactor)));
  }
  
  openPanel(panel: PanelType) {
    if (this.activePanel() === panel) {
      this.closeAll();
    } else {
      this.activePanel.set(panel);
    }
  }

  closeAll() {
    this.activePanel.set(null);
  }

  isOpen(panel: PanelType): boolean {
    return this.activePanel() === panel;
  }
}
