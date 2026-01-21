import { Injectable, signal } from '@angular/core';
import { Item } from '../models/item.models';

@Injectable({ providedIn: 'root' })
export class TooltipService {
  item = signal<Item | null>(null);
  position = signal<{ x: number, y: number }>({ x: 0, y: 0 });

  show(item: Item, event: MouseEvent) {
    this.item.set(item);
    this.position.set({ x: event.clientX, y: event.clientY });
  }
  hide() { this.item.set(null); }
}