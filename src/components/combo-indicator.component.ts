
import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerAbilitiesService } from '../game/player/player-abilities.service';
import { InventoryService } from '../game/inventory.service';

@Component({
  selector: 'app-combo-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (comboIndex() > 0) {
        <div class="fixed top-28 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-in fade-in zoom-in pointer-events-none z-50">
            <div class="flex items-center gap-2">
                <span class="text-4xl font-black italic text-white drop-shadow-[0_0_10px_rgba(249,115,22,0.8)]">
                    {{comboIndex()}}x
                </span>
                <span class="text-xs font-bold text-orange-400 uppercase tracking-widest bg-black/60 px-2 py-1 rounded">
                    COMBO
                </span>
            </div>
            
            <div class="w-32 h-1.5 bg-black/50 border border-zinc-700 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-orange-600 to-yellow-400 transition-all duration-75 ease-linear"
                     [style.width.%]="windowPercent()"></div>
            </div>

            @if (nextStep(); as step) {
                <div class="text-[9px] font-mono text-zinc-300 bg-black/40 px-2 py-0.5 rounded mt-1 backdrop-blur-sm border-l-2 border-orange-500">
                    NEXT: {{step.damageMult}}x DMG
                </div>
            }
        </div>
    }
  `
})
export class ComboIndicatorComponent {
  abilities = inject(PlayerAbilitiesService);
  inventory = inject(InventoryService);
  
  comboIndex = this.abilities.currentComboIndex;
  
  nextStep = computed(() => {
    const weapon = this.inventory.equipped().weapon;
    const archetype = this.abilities.getWeaponArchetype(weapon);
    const nextIndex = (this.comboIndex()) % archetype.chain.length;
    return archetype.chain[nextIndex];
  });
  
  windowPercent = computed(() => {
    return (this.abilities.comboWindowTimer() / this.abilities.COMBO_WINDOW_MS) * 100;
  });
}
