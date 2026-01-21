
import { Component, inject, signal, computed, output, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryService } from '../game/inventory.service';
import { PlayerService } from '../game/player/player.service';
import { CraftingService } from '../game/crafting.service';
import { Item } from '../models/item.models';
import { ItemIconComponent } from './item-icon.component';
import { TooltipService } from '../services/tooltip.service';
import { TutorialService } from '../services/tutorial.service';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, ItemIconComponent],
  templateUrl: './inventory.component.html',
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #18181b; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 2px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52525b; }
  `]
})
export class InventoryComponent {
  inventory = inject(InventoryService);
  player = inject(PlayerService);
  crafting = inject(CraftingService);
  tooltip = inject(TooltipService);
  tutorial = inject(TutorialService);
  
  close = output<void>();
  
  @ViewChildren('bagSlot') bagSlotElements!: QueryList<ElementRef>;
  @ViewChildren('equipSlot') equipSlotElements!: QueryList<ElementRef>;

  protected Math = Math;

  equipmentSlots: ('weapon' | 'armor' | 'implant' | 'stim' | 'amulet' | 'ring')[] = ['weapon', 'armor', 'implant', 'stim', 'amulet', 'ring'];
  
  // UI State
  showCrafting = signal(false);
  selectedCraftItem = signal<Item | null>(null);

  // Drag State for Mobile/Desktop
  draggedItem = signal<{item: Item, from: 'bag'|'equipment', fromIndex?: number, fromSlot?: string} | null>(null);
  dragOverSlot = signal<{type: 'bag'|'equipment', index?: number, slot?: string} | null>(null);
  
  // Ghost Element
  ghostPos = signal({x: 0, y: 0});
  isTouchDragging = signal(false);
  
  private bagRects: DOMRect[] = [];
  private equipRects: { slot: string, rect: DOMRect }[] = [];
  private holdTimer: any;
  private readonly HOLD_THRESHOLD = 250; // ms
  private hasDragStarted = false;
  private lastTapTime = 0;
  private lastTapId = '';

  constructor() {
      setTimeout(() => this.tutorial.trigger('INVENTORY'), 500);
  }

  toggleCrafting() {
      this.showCrafting.update(v => !v);
      this.selectedCraftItem.set(null);
  }

  selectForCrafting(item: Item) {
      if (this.showCrafting()) {
          this.selectedCraftItem.set(item);
      }
  }

  doReroll() {
      const item = this.selectedCraftItem();
      if (item) this.crafting.rerollItem(item);
  }

  doUpgrade() {
      const item = this.selectedCraftItem();
      if (item) this.crafting.upgradeItem(item);
  }

  // --- HTML5 DRAG EVENTS (Desktop) ---

  onDragStart(event: DragEvent, data: {item: Item, from: 'bag'|'equipment', fromIndex?: number, fromSlot?: string}) {
      this.draggedItem.set(data);
      if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', JSON.stringify(data));
      }
      this.tooltip.hide();
  }

  onDragOver(event: DragEvent, type: 'bag'|'equipment', index?: number, slot?: string) {
      event.preventDefault();
      this.dragOverSlot.set({type, index, slot});
  }

  onDragLeave() {
      this.dragOverSlot.set(null);
  }

  onDrop(event: DragEvent, toType: 'bag'|'equipment', index?: number, slot?: string) {
      event.preventDefault();
      this.dragOverSlot.set(null);
      
      const data = this.draggedItem();
      if (!data) return;

      this.inventory.moveItem(
          data.item,
          { type: data.from, index: data.fromIndex, slot: data.fromSlot },
          { type: toType, index, slot }
      );
      this.draggedItem.set(null);
  }

  onDragEnd() {
      this.draggedItem.set(null);
      this.dragOverSlot.set(null);
  }

  // --- TOUCH EVENTS (Mobile) ---

  onTouchStart(event: TouchEvent, data: {item: Item, from: 'bag'|'equipment', fromIndex?: number, fromSlot?: string}) {
      event.preventDefault();
      const touch = event.touches[0];
      
      this.hasDragStarted = false;
      this.ghostPos.set({x: touch.clientX, y: touch.clientY});

      // Start hold timer
      this.holdTimer = setTimeout(() => {
          this.startTouchDrag(data, touch);
      }, this.HOLD_THRESHOLD);
  }

  private startTouchDrag(data: {item: Item, from: 'bag'|'equipment', fromIndex?: number, fromSlot?: string}, touch: Touch) {
      this.hasDragStarted = true;
      this.isTouchDragging.set(true);
      this.draggedItem.set(data);
      this.tooltip.hide();
      if (navigator.vibrate) navigator.vibrate(20);

      this.bagRects = this.bagSlotElements.map(el => el.nativeElement.getBoundingClientRect());
      this.equipRects = this.equipSlotElements.map(el => ({
          slot: el.nativeElement.getAttribute('data-slot-name'),
          rect: el.nativeElement.getBoundingClientRect()
      }));
  }

  onTouchMove(event: TouchEvent) {
      if (!this.isTouchDragging() && !this.hasDragStarted) return;
      const touch = event.touches[0];
      if (!this.isTouchDragging()) return;
      
      event.preventDefault();
      this.ghostPos.set({x: touch.clientX, y: touch.clientY});

      let found = false;
      
      for (let i = 0; i < this.bagRects.length; i++) {
          const r = this.bagRects[i];
          if (touch.clientX >= r.left && touch.clientX <= r.right && touch.clientY >= r.top && touch.clientY <= r.bottom) {
              this.dragOverSlot.set({type: 'bag', index: i});
              found = true; break;
          }
      }

      if (!found) {
          for (let i = 0; i < this.equipRects.length; i++) {
              const r = this.equipRects[i].rect;
              if (touch.clientX >= r.left && touch.clientX <= r.right && touch.clientY >= r.top && touch.clientY <= r.bottom) {
                  this.dragOverSlot.set({type: 'equipment', slot: this.equipRects[i].slot});
                  found = true; break;
              }
          }
      }

      if (!found) this.dragOverSlot.set(null);
  }

  onTouchEnd(event: TouchEvent, data?: {item: Item, from: 'bag'|'equipment', fromIndex?: number, fromSlot?: string}) {
      event.preventDefault();
      clearTimeout(this.holdTimer);

      if (!this.hasDragStarted && data) {
          // If in crafting mode, tap selects
          if (this.showCrafting()) {
              this.selectedCraftItem.set(data.item);
              return;
          }

          const now = Date.now();
          if (data.item.id === this.lastTapId && (now - this.lastTapTime < 300)) {
              this.inventory.quickAction(data.item, { type: data.from, index: data.fromIndex, slot: data.fromSlot });
              this.tooltip.hide();
              this.lastTapId = '';
              this.lastTapTime = 0;
              if (navigator.vibrate) navigator.vibrate(50);
          } else {
              this.lastTapId = data.item.id;
              this.lastTapTime = now;
              const touch = event.changedTouches[0];
              const mockEvent = { clientX: touch.clientX, clientY: touch.clientY } as MouseEvent;
              this.tooltip.show(data.item, mockEvent);
          }
          return;
      }

      if (!this.isTouchDragging()) return;
      
      const dropTarget = this.dragOverSlot();
      const dragData = this.draggedItem();

      if (dropTarget && dragData) {
           this.inventory.moveItem(
              dragData.item,
              { type: dragData.from, index: dragData.fromIndex, slot: dragData.fromSlot },
              { type: dropTarget.type, index: dropTarget.index, slot: dropTarget.slot }
          );
      }

      this.isTouchDragging.set(false);
      this.draggedItem.set(null);
      this.dragOverSlot.set(null);
  }

  onMouseOver(event: MouseEvent, item: Item) {
      if (!this.isTouchDragging()) this.tooltip.show(item, event);
  }
  
  onMouseOut() { this.tooltip.hide(); }
}
