
import { Injectable, signal, computed, inject } from '@angular/core';
import { Item, ItemType } from '../models/item.models';
import * as CONFIG from '../config/game.config';
import { IdGeneratorService } from '../utils/id-generator.service';
import { ProofKernelService } from '../core/proof/proof-kernel.service';
import { EventBusService } from '../core/events/event-bus.service';
import { GameEvents } from '../core/events/game-events';
import { PlayerProgressionService } from './player/player-progression.service';

export interface DragState {
  isDragging: boolean;
  item: Item | null;
  sourceType: 'bag' | 'equipment' | null;
  sourceIndex: number | null;
  sourceSlot: 'weapon' | 'armor' | 'implant' | 'stim' | 'amulet' | 'ring' | null;
  cursorX: number;
  cursorY: number;
}

export interface DropTarget {
  type: 'bag' | 'equipment';
  index?: number;
  slot?: 'weapon' | 'armor' | 'implant' | 'stim' | 'amulet' | 'ring';
  isValid: boolean;
  isSwap: boolean;
  isMerge?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private idGenerator = inject(IdGeneratorService);
  private proofKernel = inject(ProofKernelService);
  private eventBus = inject(EventBusService);
  // Need to inject PlayerProgressionService lazily or use a different way to access credits/scrap 
  // to avoid potential circular dep if progression injects inventory.
  // For now, we'll assume verifying the BAG items is the priority, or inject if safe.
  // Since PlayerProgressionService injects SkillTree, Sound, EventBus - it seems safe.
  private progression = inject(PlayerProgressionService);

  bag = signal<Item[]>([]);
  equipped = signal<{
    weapon: Item | null;
    armor: Item | null;
    implant: Item | null;
    stim: Item | null;
    amulet: Item | null;
    ring: Item | null;
  }>({ weapon: null, armor: null, implant: null, stim: null, amulet: null, ring: null });

  dragState = signal<DragState>({
    isDragging: false, item: null, sourceType: null, sourceIndex: null, sourceSlot: null, cursorX: 0, cursorY: 0
  });

  activeDropTarget = signal<DropTarget | null>(null);
  bagSize = CONFIG.INVENTORY.BAG_SIZE;

  equipmentStats = computed(() => {
    const stats: Record<string, number> = { 
        dmg: 0, hp: 0, speed: 0, cdr: 0, crit: 0, lifesteal: 0, 
        armorPen: 0, psy: 0, tech: 0, armor: 0 
    };
    
    const equippedItems = this.equipped();
    if (!equippedItems) return stats;

    const items = Object.values(equippedItems) as (Item | null)[];
    
    items.forEach(item => {
      // Robust check: item must exist AND have stats object
      if (item && item.stats) {
        Object.entries(item.stats).forEach(([key, value]) => {
            if (typeof value === 'number') {
                stats[key] = (stats[key] || 0) + value;
            }
        });
      }
    });
    
    return stats;
  });

  public getItemSlot(type: ItemType): 'weapon' | 'armor' | 'implant' | 'stim' | 'amulet' | 'ring' {
    if (type === 'PSI_BLADE') return 'weapon';
    return type.toLowerCase() as any;
  }

  // --- VERIFICATION ---
  private verifyIntegrity(context: string) {
      const result = this.proofKernel.verifyInventoryState(
          this.bag(), 
          this.progression.credits(), 
          this.progression.scrap()
      );

      if (!result.isValid) {
          this.eventBus.dispatch({
              type: GameEvents.REALITY_BLEED,
              payload: {
                  severity: 'MEDIUM',
                  source: `INVENTORY:${context}`,
                  message: result.errors[0]
              }
          });
      }
  }

  startDrag(item: Item, sourceType: 'bag' | 'equipment', sourceIndex?: number, sourceSlot?: any, clientX: number = 0, clientY: number = 0) {
    this.dragState.set({ isDragging: true, item: item, sourceType: sourceType, sourceIndex: sourceIndex ?? null, sourceSlot: sourceSlot ?? null, cursorX: clientX, cursorY: clientY });
  }

  updateDragPosition(clientX: number, clientY: number) {
    if (this.dragState().isDragging) this.dragState.update(state => ({ ...state, cursorX: clientX, cursorY: clientY }));
  }

  setDropTarget(target: DropTarget | null) { this.activeDropTarget.set(target); }

  validateDropTarget(targetType: 'bag' | 'equipment', targetIndex?: number, targetSlot?: any): { isValid: boolean; isSwap: boolean; isMerge: boolean } {
    const drag = this.dragState();
    const item = drag.item; 
    if (!item) return { isValid: false, isSwap: false, isMerge: false };
    
    // Safety check for bag signal
    const currentBag = this.bag() || [];

    if (drag.sourceType === 'bag' && targetType === 'bag' && targetIndex !== undefined) {
      if (drag.sourceIndex === targetIndex) return { isValid: false, isSwap: false, isMerge: false };
      
      const targetItem = currentBag[targetIndex];
      const targetHasItem = targetIndex < currentBag.length;
      
      if (targetItem && targetItem.name === item.name && targetItem.stack < targetItem.maxStack && item.stack > 0) return { isValid: true, isSwap: false, isMerge: true };
      return { isValid: true, isSwap: targetHasItem, isMerge: false };
    }
    if (drag.sourceType === 'bag' && targetType === 'equipment' && targetSlot) {
      const itemTypeSlot = this.getItemSlot(item.type);
      const isValidSlot = itemTypeSlot === targetSlot;
      const currentEquipped = this.equipped();
      const targetHasItem = currentEquipped && currentEquipped[targetSlot as keyof typeof currentEquipped] !== null;
      return { isValid: isValidSlot, isSwap: isValidSlot && targetHasItem, isMerge: false };
    }
    if (drag.sourceType === 'equipment' && targetType === 'bag' && targetIndex !== undefined) {
      const targetItem = currentBag[targetIndex];
      if (targetItem && targetItem.name === item.name && targetItem.stack < targetItem.maxStack) return { isValid: true, isSwap: false, isMerge: true };
      return { isValid: true, isSwap: targetIndex < currentBag.length, isMerge: false };
    }
    return { isValid: false, isSwap: false, isMerge: false };
  }

  endDrag(targetType?: 'bag' | 'equipment', targetIndex?: number, targetSlot?: any) {
    const drag = this.dragState();
    if (!drag.isDragging || !drag.item || !targetType) { this.cancelDrag(); return; }
    const validation = this.validateDropTarget(targetType, targetIndex, targetSlot);
    if (!validation.isValid) { this.cancelDrag(); return; }
    this.executeDrop(drag, targetType, targetIndex, targetSlot, validation.isSwap, validation.isMerge);
    this.cancelDrag();
  }
  
  moveItem(item: Item, source: { type: 'bag'|'equipment', index?: number, slot?: any }, target: { type: 'bag'|'equipment', index?: number, slot?: any }): boolean {
      this.dragState.set({ isDragging: true, item: item, sourceType: source.type, sourceIndex: source.index ?? null, sourceSlot: source.slot ?? null, cursorX: 0, cursorY: 0 });
      const validation = this.validateDropTarget(target.type, target.index, target.slot);
      if (validation.isValid) {
          this.executeDrop(this.dragState(), target.type, target.index, target.slot, validation.isSwap, validation.isMerge);
          this.cancelDrag(); 
          this.verifyIntegrity('MOVE_ITEM');
          return true;
      }
      this.cancelDrag(); return false;
  }

  quickAction(item: Item, source: { type: 'bag' | 'equipment', index?: number, slot?: string }) {
      if (source.type === 'bag' && source.index !== undefined) {
          this.equip(item, source.index);
      } else if (source.type === 'equipment' && source.slot) {
          this.unequip(source.slot as any);
      }
      this.verifyIntegrity('QUICK_ACTION');
  }

  private executeDrop(drag: DragState, targetType: 'bag' | 'equipment', targetIndex?: number, targetSlot?: any, isSwap: boolean = false, isMerge: boolean = false) {
    if (isMerge && targetIndex !== undefined && targetType === 'bag') { this.mergeStacks(drag.sourceType!, drag.sourceIndex, drag.sourceSlot, targetIndex); return; }
    if (drag.sourceType === 'bag' && targetType === 'bag' && drag.sourceIndex !== null && targetIndex !== undefined) { if (isSwap) this.swapInBag(drag.sourceIndex, targetIndex); else this.moveInBag(drag.sourceIndex, targetIndex); }
    else if (drag.sourceType === 'bag' && targetType === 'equipment' && drag.sourceIndex !== null && targetSlot) { if (isSwap) this.swapBagWithEquipment(drag.sourceIndex, targetSlot); else this.equip(drag.item!, drag.sourceIndex); }
    else if (drag.sourceType === 'equipment' && targetType === 'bag' && drag.sourceSlot && targetIndex !== undefined) { if (isSwap) this.swapEquipmentWithBag(drag.sourceSlot, targetIndex); else this.unequip(drag.sourceSlot, targetIndex); }
  }

  cancelDrag() { this.dragState.set({ isDragging: false, item: null, sourceType: null, sourceIndex: null, sourceSlot: null, cursorX: 0, cursorY: 0 }); this.activeDropTarget.set(null); }

  private mergeStacks(sourceType: 'bag' | 'equipment', sourceIndex: number | null, sourceSlot: string | null, targetIndex: number) {
      let sourceItem: Item | null = null;
      if (sourceType === 'bag' && sourceIndex !== null) sourceItem = this.bag()[sourceIndex];
      else if (sourceType === 'equipment' && sourceSlot) sourceItem = this.equipped()[sourceSlot as any];
      if (!sourceItem) return;
      this.bag.update(b => {
          const newBag = [...b];
          const targetItem = newBag[targetIndex];
          if (targetItem && targetItem.name === sourceItem!.name) {
              const availableSpace = targetItem.maxStack - targetItem.stack;
              const amountToTransfer = Math.min(availableSpace, sourceItem!.stack);
              targetItem.stack += amountToTransfer; sourceItem!.stack -= amountToTransfer;
          }
          return newBag;
      });
      if (sourceItem.stack <= 0) {
          if (sourceType === 'bag' && sourceIndex !== null) this.bag.update(b => { const newBag = [...b]; newBag.splice(sourceIndex, 1); return newBag; });
          else if (sourceType === 'equipment' && sourceSlot) this.equipped.update(e => ({ ...e, [sourceSlot]: null }));
      }
  }

  addItem(item: Item): boolean {
    let success = false;
    if (item.maxStack > 1) {
        this.bag.update(b => {
            const newBag = [...b];
            const existing = newBag.find(i => i.name === item.name && i.stack < i.maxStack);
            if (existing) {
                const space = existing.maxStack - existing.stack;
                const add = Math.min(space, item.stack);
                existing.stack += add; item.stack -= add;
                // If consumed fully, stop
            }
            return newBag;
        });
        if (item.stack <= 0) success = true;
    }
    
    if (!success) {
        if (this.bag().length >= this.bagSize) success = false;
        else {
            this.bag.update(b => [...b, item]);
            success = true;
        }
    }
    
    if (success) this.verifyIntegrity('ADD_ITEM');
    return success;
  }

  swapBagWithEquipment(bagIndex: number, equipSlot: any) {
    const bagItem = this.bag()[bagIndex];
    const equippedItem = this.equipped()[equipSlot as keyof ReturnType<typeof this.equipped>];
    if (!bagItem || !equippedItem) return;
    this.bag.update(b => { const newBag = [...b]; newBag[bagIndex] = equippedItem; return newBag; });
    this.equipped.update(e => ({ ...e, [equipSlot]: bagItem }));
  }

  swapEquipmentWithBag(equipSlot: any, bagIndex: number) {
    const equippedItem = this.equipped()[equipSlot as keyof ReturnType<typeof this.equipped>];
    const bagItem = this.bag()[bagIndex];
    if (!equippedItem || !bagItem) return;
    const bagItemSlot = this.getItemSlot(bagItem.type);
    if (bagItemSlot !== equipSlot) return;
    this.equipped.update(e => ({ ...e, [equipSlot]: bagItem }));
    this.bag.update(b => { const newBag = [...b]; newBag[bagIndex] = equippedItem; return newBag; });
  }

  swapInBag(fromIndex: number, toIndex: number) {
    this.bag.update(b => {
        const newBag = [...b];
        if (fromIndex >= 0 && fromIndex < newBag.length && toIndex >= 0 && toIndex < newBag.length) {
            const temp = newBag[fromIndex]; newBag[fromIndex] = newBag[toIndex]; newBag[toIndex] = temp;
        }
        return newBag;
    });
  }

  moveInBag(fromIndex: number, toIndex: number) {
    this.bag.update(b => {
      const newBag = [...b]; const [movedItem] = newBag.splice(fromIndex, 1);
      newBag.splice(Math.min(toIndex, newBag.length), 0, movedItem); return newBag;
    });
  }

  equip(item: Item, fromBagIndex?: number) {
    if (fromBagIndex !== undefined) this.bag.update(b => { const newBag = [...b]; newBag.splice(fromBagIndex, 1); return newBag; });
    else this.bag.update(b => b.filter(i => i.id !== item.id));
    const slotName = this.getItemSlot(item.type);
    const unequippedItem = this.equipped()[slotName as keyof ReturnType<typeof this.equipped>];
    this.equipped.update(e => ({ ...e, [slotName]: item }));
    if (unequippedItem) this.addItem(unequippedItem);
  }

  unequip(slot: any, toBagIndex?: number) {
    const item = this.equipped()[slot as keyof ReturnType<typeof this.equipped>];
    if (!item) return;
    if (toBagIndex === undefined && this.bag().length >= this.bagSize) return;
    this.equipped.update(e => ({ ...e, [slot]: null }));
    if (toBagIndex !== undefined) this.bag.update(b => { const newBag = [...b]; newBag.splice(Math.min(toBagIndex, newBag.length), 0, item); return newBag; });
    else this.addItem(item);
  }

  getSaveData() { return { bag: this.bag(), equipped: this.equipped() }; }
  loadSaveData(data: any) {
    if (data.bag) this.bag.set(data.bag);
    if (data.equipped) this.equipped.set(data.equipped);
  }
  reset() { this.bag.set([]); this.equipped.set({ weapon: null, armor: null, implant: null, stim: null, amulet: null, ring: null }); }
}
