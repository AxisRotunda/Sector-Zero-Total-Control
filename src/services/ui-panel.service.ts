import { Injectable, signal, computed } from '@angular/core';

export type PanelType = 'INVENTORY' | 'SKILLS' | 'SHOP' | 'ABILITIES' | 'CODEX' | 'MAP' | 'SETTINGS' | 'JOURNAL';

@Injectable({
  providedIn: 'root'
})
export class UiPanelService {
  private activePanel = signal<PanelType | null>(null);

  isInventoryOpen = computed(() => this.activePanel() === 'INVENTORY');
  isSkillsOpen = computed(() => this.activePanel() === 'SKILLS');
  isShopOpen = computed(() => this.activePanel() === 'SHOP');
  isAbilitiesOpen = computed(() => this.activePanel() === 'ABILITIES');
  isCodexOpen = computed(() => this.activePanel() === 'CODEX');
  isJournalOpen = computed(() => this.activePanel() === 'JOURNAL');
  isMapOpen = computed(() => this.activePanel() === 'MAP');
  isSettingsOpen = computed(() => this.activePanel() === 'SETTINGS');
  
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