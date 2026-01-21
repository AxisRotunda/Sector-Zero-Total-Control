import { Injectable, signal, computed, inject } from '@angular/core';
import { Item, ItemType, Rarity, ItemShape } from '../models/item.models';
import * as CONFIG from '../config/game.config';
import { IdGeneratorService } from './id-generator.service';

export interface DragState {
  isDragging: boolean;
  item: Item | null;
  sourceType: 'bag' | 'equipment' | null;
  sourceIndex: number | null;
  sourceSlot: 'weapon' | 'armor' | 'implant' | 'stim' | null;
  cursorX: number;
  cursorY: number;
}

export interface DropTarget {
  type: 'bag' | 'equipment';
  index?: number;
  slot?: 'weapon' | 'armor' | 'implant' | 'stim';
  isValid: boolean;
  isSwap: boolean;
  isMerge?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private idGenerator = inject(IdGeneratorService);

  bag = signal<Item[]>([]);
  equipped = signal<{
    weapon: Item | null;
    armor: Item | null;
    implant: Item | null;
    stim: Item | null;
  }>({ weapon: null, armor: null, implant: null, stim: null });

  dragState = signal<DragState>({
    isDragging: false,
    item: null,
    sourceType: null,
    sourceIndex: null,
    sourceSlot: null,
    cursorX: 0,
    cursorY: 0
  });

  activeDropTarget = signal<DropTarget | null>(null);

  bagSize = CONFIG.INVENTORY.BAG_SIZE;

  equipmentStats = computed(() => {
    const stats = { 
      dmg: 0, hp: 0, speed: 0, cdr: 0, crit: 0, lifesteal: 0, armorPen: 0, psy: 0, tech: 0
    };
    
    const gear = [
      this.equipped().weapon,
      this.equipped().armor,
      this.equipped().implant,
      this.equipped().stim
    ];

    gear.forEach(item => {
      if (item) {
        if (item.stats['dmg']) stats.dmg += item.stats['dmg'];
        if (item.stats['hp']) stats.hp += item.stats['hp'];
        if (item.stats['spd']) stats.speed += item.stats['spd'];
        if (item.stats['cdr']) stats.cdr += item.stats['cdr'];
        if (item.stats['crit']) stats.crit += item.stats['crit'];
        if (item.stats['ls']) stats.lifesteal += item.stats['ls'];
        if (item.stats['armorPen']) stats.armorPen += item.stats['armorPen'];
        if (item.stats['psy']) stats.psy += item.stats['psy'];
        if (item.stats['tech']) stats.tech += item.stats['tech'];
      }
    });

    return stats;
  });

  public getItemSlot(type: ItemType): 'weapon' | 'armor' | 'implant' | 'stim' {
    if (type === 'PSI_BLADE') return 'weapon';
    return type.toLowerCase() as 'weapon' | 'armor' | 'implant' | 'stim';
  }

  startDrag(
    item: Item, 
    sourceType: 'bag' | 'equipment', 
    sourceIndex?: number, 
    sourceSlot?: 'weapon' | 'armor' | 'implant' | 'stim', 
    clientX: number = 0, 
    clientY: number = 0
  ) {
    this.dragState.set({
      isDragging: true,
      item: item,
      sourceType: sourceType,
      sourceIndex: sourceIndex ?? null,
      sourceSlot: sourceSlot ?? null,
      cursorX: clientX,
      cursorY: clientY
    });
  }

  updateDragPosition(clientX: number, clientY: number) {
    const current = this.dragState();
    if (current.isDragging) {
      this.dragState.update(state => ({
        ...state,
        cursorX: clientX,
        cursorY: clientY
      }));
    }
  }

  setDropTarget(target: DropTarget | null) {
    this.activeDropTarget.set(target);
  }

  validateDropTarget(
    targetType: 'bag' | 'equipment', 
    targetIndex?: number, 
    targetSlot?: 'weapon' | 'armor' | 'implant' | 'stim'
  ): { isValid: boolean; isSwap: boolean; isMerge: boolean } {
    const drag = this.dragState();
    const item = drag.item; 
    const sourceType = drag.sourceType;
    const sourceIndex = drag.sourceIndex;
    const sourceSlot = drag.sourceSlot;

    if (!item) return { isValid: false, isSwap: false, isMerge: false };

    // Bag to Bag
    if (sourceType === 'bag' && targetType === 'bag' && targetIndex !== undefined) {
      if (sourceIndex === targetIndex) {
        return { isValid: false, isSwap: false, isMerge: false };
      }
      const targetItem = this.bag()[targetIndex];
      const targetHasItem = targetIndex < this.bag().length;
      
      if (targetItem && targetItem.name === item.name && targetItem.stack < targetItem.maxStack && item.stack > 0) {
          return { isValid: true, isSwap: false, isMerge: true };
      }

      return { isValid: true, isSwap: targetHasItem, isMerge: false };
    }

    // Bag to Equipment
    if (sourceType === 'bag' && targetType === 'equipment' && targetSlot) {
      const itemTypeSlot = this.getItemSlot(item.type);
      const isValidSlot = itemTypeSlot === targetSlot;
      const targetHasItem = this.equipped()[targetSlot] !== null;
      return { isValid: isValidSlot, isSwap: isValidSlot && targetHasItem, isMerge: false };
    }

    // Equipment to Bag
    if (sourceType === 'equipment' && targetType === 'bag' && targetIndex !== undefined) {
      const targetItem = this.bag()[targetIndex];
      const targetHasItem = targetIndex < this.bag().length;
      
      if (targetItem && targetItem.name === item.name && targetItem.stack < targetItem.maxStack) {
          return { isValid: true, isSwap: false, isMerge: true };
      }

      const bagHasSpace = this.bag().length < this.bagSize;
      return { isValid: targetHasItem || bagHasSpace, isSwap: targetHasItem, isMerge: false };
    }

    // Equipment to Equipment
    if (sourceType === 'equipment' && targetType === 'equipment' && sourceSlot && targetSlot) {
      if (sourceSlot === targetSlot) return { isValid: false, isSwap: false, isMerge: false };
      const sourceItem = this.equipped()[sourceSlot];
      const targetItem = this.equipped()[targetSlot];
      if (!sourceItem || !targetItem) return { isValid: false, isSwap: false, isMerge: false };
      const sourceItemSlot = this.getItemSlot(sourceItem.type);
      const targetItemSlot = this.getItemSlot(targetItem.type);
      const canSwap = sourceItemSlot === targetSlot && targetItemSlot === sourceSlot;
      return { isValid: canSwap, isSwap: canSwap, isMerge: false };
    }

    return { isValid: false, isSwap: false, isMerge: false };
  }

  endDrag(
    targetType?: 'bag' | 'equipment', 
    targetIndex?: number, 
    targetSlot?: 'weapon' | 'armor' | 'implant' | 'stim'
  ) {
    const drag = this.dragState();
    if (!drag.isDragging || !drag.item || !targetType) {
      this.cancelDrag();
      return;
    }

    const validation = this.validateDropTarget(targetType, targetIndex, targetSlot);
    if (!validation.isValid) {
      this.cancelDrag();
      return;
    }

    this.executeDrop(drag, targetType, targetIndex, targetSlot, validation.isSwap, validation.isMerge);
    this.cancelDrag();
  }
  
  moveItem(
    item: Item,
    source: { type: 'bag'|'equipment', index?: number, slot?: any },
    target: { type: 'bag'|'equipment', index?: number, slot?: any }
  ): boolean {
      this.dragState.set({
          isDragging: true,
          item: item,
          sourceType: source.type,
          sourceIndex: source.index ?? null,
          sourceSlot: source.slot ?? null,
          cursorX: 0, cursorY: 0
      });

      const validation = this.validateDropTarget(target.type, target.index, target.slot);
      if (validation.isValid) {
          this.executeDrop(this.dragState(), target.type, target.index, target.slot, validation.isSwap, validation.isMerge);
          this.cancelDrag();
          return true;
      } else {
          this.cancelDrag();
          return false;
      }
  }

  private executeDrop(
    drag: DragState,
    targetType: 'bag' | 'equipment',
    targetIndex?: number,
    targetSlot?: 'weapon' | 'armor' | 'implant' | 'stim',
    isSwap: boolean = false,
    isMerge: boolean = false
  ) {
    if (isMerge && targetIndex !== undefined && targetType === 'bag') {
        this.mergeStacks(drag.sourceType!, drag.sourceIndex, drag.sourceSlot, targetIndex);
        return;
    }

    if (drag.sourceType === 'bag' && targetType === 'bag' && drag.sourceIndex !== null && targetIndex !== undefined) {
      if (isSwap) this.swapInBag(drag.sourceIndex, targetIndex);
      else this.moveInBag(drag.sourceIndex, targetIndex);
    }
    else if (drag.sourceType === 'bag' && targetType === 'equipment' && drag.sourceIndex !== null && targetSlot) {
      if (isSwap) this.swapBagWithEquipment(drag.sourceIndex, targetSlot);
      else this.equip(drag.item!, drag.sourceIndex);
    }
    else if (drag.sourceType === 'equipment' && targetType === 'bag' && drag.sourceSlot && targetIndex !== undefined) {
      if (isSwap) this.swapEquipmentWithBag(drag.sourceSlot, targetIndex);
      else this.unequip(drag.sourceSlot, targetIndex);
    }
    else if (drag.sourceType === 'equipment' && targetType === 'equipment' && drag.sourceSlot && targetSlot && isSwap) {
      this.swapEquipped(drag.sourceSlot, targetSlot);
    }
  }

  cancelDrag() {
    this.dragState.set({
      isDragging: false, item: null, sourceType: null, sourceIndex: null, sourceSlot: null,
      cursorX: 0, cursorY: 0
    });
    this.activeDropTarget.set(null);
  }

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
              
              targetItem.stack += amountToTransfer;
              sourceItem!.stack -= amountToTransfer;
          }
          return newBag;
      });

      if (sourceItem.stack <= 0) {
          if (sourceType === 'bag' && sourceIndex !== null) {
              this.bag.update(b => {
                  const newBag = [...b];
                  newBag.splice(sourceIndex, 1);
                  return newBag;
              });
          } else if (sourceType === 'equipment' && sourceSlot) {
              this.equipped.update(e => ({ ...e, [sourceSlot]: null }));
          }
      }
  }

  addItem(item: Item): boolean {
    if (item.maxStack > 1) {
        let addedToStack = false;
        this.bag.update(b => {
            const newBag = [...b];
            const existing = newBag.find(i => i.name === item.name && i.stack < i.maxStack);
            if (existing) {
                const space = existing.maxStack - existing.stack;
                const add = Math.min(space, item.stack);
                existing.stack += add;
                item.stack -= add;
                addedToStack = true;
            }
            return newBag;
        });

        if (item.stack <= 0) return true;
    }

    if (this.bag().length >= this.bagSize) return false;
    this.bag.update(b => [...b, item]);
    return true;
  }

  swapBagWithEquipment(bagIndex: number, equipSlot: 'weapon' | 'armor' | 'implant' | 'stim') {
    const bagItem = this.bag()[bagIndex];
    const equippedItem = this.equipped()[equipSlot];
    if (!bagItem || !equippedItem) return;

    this.bag.update(b => {
      const newBag = [...b];
      newBag[bagIndex] = equippedItem;
      return newBag;
    });
    this.equipped.update(e => ({ ...e, [equipSlot]: bagItem }));
  }

  swapEquipmentWithBag(equipSlot: 'weapon' | 'armor' | 'implant' | 'stim', bagIndex: number) {
    const equippedItem = this.equipped()[equipSlot];
    const bagItem = this.bag()[bagIndex];
    if (!equippedItem || !bagItem) return;

    const bagItemSlot = this.getItemSlot(bagItem.type);
    if (bagItemSlot !== equipSlot) return;

    this.equipped.update(e => ({ ...e, [equipSlot]: bagItem }));
    this.bag.update(b => {
      const newBag = [...b];
      newBag[bagIndex] = equippedItem; 
      return newBag;
    });
  }

  swapInBag(fromIndex: number, toIndex: number) {
    this.bag.update(b => {
        const newBag = [...b];
        if (fromIndex >= 0 && fromIndex < newBag.length && toIndex >= 0 && toIndex < newBag.length) {
            const temp = newBag[fromIndex];
            newBag[fromIndex] = newBag[toIndex];
            newBag[toIndex] = temp;
        }
        return newBag;
    });
  }

  moveInBag(fromIndex: number, toIndex: number) {
    this.bag.update(b => {
      const newBag = [...b];
      const [movedItem] = newBag.splice(fromIndex, 1);
      const target = Math.min(toIndex, newBag.length);
      newBag.splice(target, 0, movedItem);
      return newBag;
    });
  }

  swapEquipped(slotA: keyof ReturnType<typeof this.equipped>, slotB: keyof ReturnType<typeof this.equipped>) {
    const itemA = this.equipped()[slotA];
    const itemB = this.equipped()[slotB];
    if (!itemA || !itemB) return;

    const itemASlot = this.getItemSlot(itemA.type);
    const itemBSlot = this.getItemSlot(itemB.type);

    if (itemASlot === slotB && itemBSlot === slotA) {
      this.equipped.update(e => ({ ...e, [slotA]: itemB, [slotB]: itemA }));
    }
  }

  equip(item: Item, fromBagIndex?: number) {
    if (fromBagIndex !== undefined) {
      this.bag.update(b => {
        const newBag = [...b];
        newBag.splice(fromBagIndex, 1);
        return newBag;
      });
    } else {
      this.bag.update(b => b.filter(i => i.id !== item.id));
    }

    const slotName = this.getItemSlot(item.type);
    const unequippedItem = this.equipped()[slotName];

    this.equipped.update(e => ({ ...e, [slotName]: item }));

    if (unequippedItem) {
      if (fromBagIndex !== undefined && this.bag().length < this.bagSize) {
        this.bag.update(b => {
            const newBag = [...b];
            newBag.splice(fromBagIndex, 0, unequippedItem);
            return newBag;
        });
      } else {
        this.addItem(unequippedItem);
      }
    }
  }

  unequip(slot: 'weapon' | 'armor' | 'implant' | 'stim', toBagIndex?: number) {
    const item = this.equipped()[slot];
    if (!item) return;
    if (toBagIndex === undefined && this.bag().length >= this.bagSize) return;

    this.equipped.update(e => ({ ...e, [slot]: null }));

    if (toBagIndex !== undefined) {
      this.bag.update(b => {
        const newBag = [...b];
        newBag.splice(Math.min(toBagIndex, newBag.length), 0, item);
        return newBag;
      });
    } else {
      this.bag.update(b => [...b, item]);
    }
  }

  getSaveData() {
    return { bag: this.bag(), equipped: this.equipped() };
  }

  loadSaveData(data: any) {
    if (data.bag) this.bag.set(data.bag);
    if (data.equipped) this.equipped.set(data.equipped);
  }

  reset() {
    this.bag.set([]);
    this.equipped.set({ weapon: null, armor: null, implant: null, stim: null });
  }
}
