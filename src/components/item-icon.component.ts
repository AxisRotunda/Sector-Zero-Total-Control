
import { Component, ElementRef, Input, OnChanges, ViewChild, inject, SimpleChanges } from '@angular/core';
import { Item } from '../models/item.models';
import { EntityRendererService } from '../systems/rendering/entity-renderer.service';

@Component({
  selector: 'app-item-icon',
  standalone: true,
  template: '<canvas #canvas width="64" height="64" class="w-full h-full object-contain"></canvas>',
  styles: [':host { display: block; width: 100%; height: 100%; }']
})
export class ItemIconComponent implements OnChanges {
  @Input({ required: true }) item!: Item;
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private renderer = inject(EntityRendererService);

  ngOnChanges(changes: SimpleChanges) {
    if (changes['item'] || (this.item && !changes['item'].firstChange)) {
      this.draw();
    }
  }

  private draw() {
    if (this.canvasRef && this.item) {
        const ctx = this.canvasRef.nativeElement.getContext('2d');
        if (ctx) {
            this.renderer.drawItemIcon(ctx, this.item, 64);
        }
    }
  }
}
