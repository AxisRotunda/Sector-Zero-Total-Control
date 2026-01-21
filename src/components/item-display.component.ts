
import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Item } from '../models/item.models';
import { ItemIconComponent } from './item-icon.component';

@Component({
  selector: 'app-item-display',
  standalone: true,
  imports: [CommonModule, ItemIconComponent],
  template: `
    <div class="relative w-full h-full flex flex-col items-center justify-center p-1 group">
        <app-item-icon [item]="item" class="w-full h-full"></app-item-icon>
        
        @if (showDetails) {
            <div class="absolute inset-x-0 bottom-0 flex flex-col pointer-events-none">
                @if (item.stack > 1) {
                    <div class="text-[9px] font-bold text-white bg-black/60 px-1 self-end border-t border-l border-zinc-800">
                        x{{item.stack}}
                    </div>
                }
                <div class="text-[8px] font-mono text-zinc-400 bg-zinc-950/80 px-1 truncate w-full text-center">
                    L{{item.level}} {{item.name}}
                </div>
            </div>
        }
        
        <!-- Rarity Top Bar -->
        <div class="absolute top-0 left-0 w-full h-0.5" [style.background-color]="item.color"></div>
    </div>
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; }`]
})
export class ItemDisplayComponent {
  @Input({ required: true }) item!: Item;
  @Input() showDetails: boolean = false;
}
