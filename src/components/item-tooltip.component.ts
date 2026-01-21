
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Item } from '../models/item.models';
import { TooltipService } from '../services/tooltip.service';
import { InventoryService } from '../game/inventory.service';

@Component({
  selector: 'app-item-tooltip',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (tooltip.item(); as currentItem) {
      <div 
        class="fixed z-[100] w-72 p-4 bg-zinc-950/95 border border-zinc-700 rounded-sm shadow-2xl pointer-events-none transition-opacity duration-200 backdrop-blur-md"
        [style.left.px]="tooltip.position().x + 15"
        [style.top.px]="tooltip.position().y + 15">
        
        <!-- HEADER -->
        <div class="flex justify-between items-start pb-2 border-b border-zinc-800 mb-2">
          <div class="flex flex-col">
              <h3 class="font-bold text-lg leading-none mb-1" [style.color]="currentItem.color">{{ currentItem.name }}</h3>
              <p class="font-bold text-[10px] tracking-widest uppercase text-zinc-500">{{ currentItem.rarity }} {{ currentItem.type }}</p>
          </div>
          <div class="flex flex-col items-end">
             <span class="text-[10px] text-zinc-500 font-mono border border-zinc-800 px-1 bg-zinc-900">LVL {{ currentItem.level }}</span>
             @if (currentItem.stack > 1) {
                 <span class="text-[10px] text-zinc-400 font-mono mt-1">QTY: {{ currentItem.stack }}/{{ currentItem.maxStack }}</span>
             }
          </div>
        </div>

        <!-- STATS -->
        <div class="flex flex-col gap-1 text-xs font-mono mb-2">
          @for (stat of objectKeys(currentItem.stats); track stat) {
            <div class="flex justify-between items-center py-0.5 border-b border-zinc-900/50">
              <span class="text-zinc-400 uppercase">{{ getStatLabel(stat) }}</span>
              <div class="flex items-center gap-2">
                  <span class="text-zinc-200 font-bold">{{ currentItem.stats[stat] }}</span>
                  @if (getComparison(currentItem, stat); as comp) {
                      @if (comp !== 0) {
                          <span class="text-[10px]" [class]="comp > 0 ? 'text-green-500' : 'text-red-500'">
                             {{ comp > 0 ? '+' : '' }}{{ comp }}
                          </span>
                      }
                  }
              </div>
            </div>
          }
        </div>
        
        <!-- DESCRIPTION / FLAVOR -->
        <div class="text-[10px] text-zinc-600 italic border-t border-zinc-800 pt-2 mt-2">
            Comparison active vs equipped gear.
        </div>
      </div>
    }
  `
})
export class ItemTooltipComponent {
  tooltip = inject(TooltipService);
  inventory = inject(InventoryService);
  objectKeys = Object.keys;

  getStatLabel(key: string): string {
      const map: {[key:string]: string} = {
          'dmg': 'Damage',
          'hp': 'Integrity',
          'spd': 'Speed',
          'cdr': 'Psi-Cycle',
          'crit': 'Crit %',
          'ls': 'Leech %',
          'armorPen': 'Penetration',
          'psy': 'Psyche'
      };
      return map[key] || key;
  }

  getComparison(item: Item, statKey: string): number | null {
      const slot = this.inventory.getItemSlot(item.type);
      const equipped = this.inventory.equipped()[slot];
      
      // If comparing against itself (hovering equipped item), don't show diff
      if (equipped && equipped.id === item.id) return null;

      if (equipped && equipped.stats[statKey] !== undefined) {
          const currentVal = item.stats[statKey] || 0;
          const equippedVal = equipped.stats[statKey] || 0;
          return currentVal - equippedVal;
      } else if (equipped) {
          // Equipped item doesn't have this stat, so it's a pure gain
          return item.stats[statKey];
      }
      
      return null;
  }
}
