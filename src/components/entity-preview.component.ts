
import { Component, ElementRef, Input, OnChanges, ViewChild, inject, SimpleChanges, OnDestroy, AfterViewInit } from '@angular/core';
import { Entity } from '../models/game.models';
import { EntityPoolService } from '../services/entity-pool.service';
import { UnitRendererService } from '../systems/rendering/unit-renderer.service';

@Component({
  selector: 'app-entity-preview',
  standalone: true,
  template: '<canvas #canvas width="300" height="300" class="w-full h-full object-contain"></canvas>',
  styles: [':host { display: block; width: 100%; height: 100%; }']
})
export class EntityPreviewComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() type!: string;
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private pool = inject(EntityPoolService);
  private renderer = inject(UnitRendererService);
  
  private dummyEntity: Entity | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationId = 0;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['type'] && this.type) {
       this.setupEntity();
    }
  }

  ngAfterViewInit() {
      this.ctx = this.canvasRef.nativeElement.getContext('2d');
      this.loop();
  }

  ngOnDestroy() {
      cancelAnimationFrame(this.animationId);
      if (this.dummyEntity) {
          this.pool.release(this.dummyEntity);
      }
  }

  private setupEntity() {
      if (this.dummyEntity) this.pool.release(this.dummyEntity);
      
      const parts = this.type.split('_'); 
      let mainType = parts[0] as any;
      let subType = parts.length > 1 ? parts[1] as any : undefined;
      
      if (this.type === 'GRUNT') { mainType = 'ENEMY'; subType = 'GRUNT'; }
      if (this.type === 'STALKER') { mainType = 'ENEMY'; subType = 'STALKER'; }
      if (this.type === 'SNIPER') { mainType = 'ENEMY'; subType = 'SNIPER'; }
      if (this.type === 'HEAVY') { mainType = 'ENEMY'; subType = 'HEAVY'; }
      if (this.type === 'STEALTH') { mainType = 'ENEMY'; subType = 'STEALTH'; }
      if (this.type === 'BOSS') { mainType = 'ENEMY'; subType = 'BOSS'; }
      if (this.type === 'MEDIC') { mainType = 'NPC'; subType = 'MEDIC'; }
      if (this.type === 'TRADER') { mainType = 'NPC'; subType = 'TRADER'; }
      if (this.type === 'HANDLER') { mainType = 'NPC'; subType = 'HANDLER'; }
      if (this.type === 'CITIZEN') { mainType = 'NPC'; subType = 'CITIZEN'; }
      if (this.type === 'CONSOLE') { mainType = 'NPC'; subType = 'CONSOLE'; }

      this.dummyEntity = this.pool.acquire(mainType, subType);
      
      if (subType === 'GRUNT') this.dummyEntity.color = '#a1a1aa';
      if (subType === 'STALKER') this.dummyEntity.color = '#60a5fa';
      if (subType === 'SNIPER') this.dummyEntity.color = '#a855f7';
      if (subType === 'HEAVY') { this.dummyEntity.color = '#f59e0b'; this.dummyEntity.armor = 10; }
      if (subType === 'BOSS') { this.dummyEntity.color = '#dc2626'; this.dummyEntity.radius = 30; }
      if (subType === 'MEDIC') this.dummyEntity.color = '#ef4444';
      if (subType === 'TRADER') this.dummyEntity.color = '#eab308';
      if (subType === 'HANDLER') this.dummyEntity.color = '#3b82f6';
      if (subType === 'CITIZEN') this.dummyEntity.color = '#a1a1aa';
      if (subType === 'CONSOLE') this.dummyEntity.color = '#38bdf8';

      this.dummyEntity.x = 0;
      this.dummyEntity.y = 0;
      this.dummyEntity.angle = Math.PI / 4;
      this.dummyEntity.state = 'IDLE';
  }

  private loop = () => {
      if (this.ctx && this.dummyEntity && this.canvasRef) {
          const w = this.canvasRef.nativeElement.width;
          const h = this.canvasRef.nativeElement.height;
          
          this.ctx.clearRect(0, 0, w, h);
          this.ctx.save();
          this.ctx.translate(w/2, h/2);
          this.ctx.scale(2, 2); 

          this.dummyEntity.animFrameTimer++;
          if (this.dummyEntity.animFrameTimer > 10) {
              this.dummyEntity.animFrameTimer = 0;
              this.dummyEntity.animFrame = (this.dummyEntity.animFrame + 1) % 4;
          }
          this.dummyEntity.angle += 0.01; 

          // Delegate to the specialized renderer
          if (this.dummyEntity.type === 'NPC') {
              this.renderer.drawNPC(this.ctx, this.dummyEntity);
          } else {
              this.renderer.drawHumanoid(this.ctx, this.dummyEntity);
          }

          this.ctx.restore();
      }
      this.animationId = requestAnimationFrame(this.loop);
  }
}