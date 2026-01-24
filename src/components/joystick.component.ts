
import { Component, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HapticService } from '../services/haptic.service';

@Component({
  selector: 'app-joystick',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Touch Area: Full coverage of container -->
    <div class="absolute inset-0 z-10 touch-none"
         (touchstart)="onTouchStart($event)"
         (touchmove)="onTouchMove($event)"
         (touchend)="onTouchEnd($event)"
         (touchcancel)="onTouchEnd($event)">
    </div>

    <!-- Dynamic Joystick Visuals -->
    @if (isActive()) {
        <div class="absolute w-36 h-36 -ml-18 -mt-18 pointer-events-none transition-opacity duration-150 animate-in fade-in zoom-in-95"
             [style.transform]="'translate3d(' + centerX() + 'px, ' + centerY() + 'px, 0)'"
             style="margin-left: -72px; margin-top: -72px;">
             
             <!-- Outer Ring -->
             <div class="absolute inset-0 rounded-full border-2 border-zinc-600/30 bg-zinc-900/40 backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.5)]"></div>
             
             <!-- Inner Deadzone Guide -->
             <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-dashed border-zinc-500/20"></div>

             <!-- Thumb Knob -->
             <div class="absolute top-1/2 left-1/2 -ml-8 -mt-8 w-16 h-16 bg-gradient-to-b from-orange-400 to-orange-600 rounded-full shadow-[0_0_20px_rgba(249,115,22,0.4)] border border-orange-300 ring-2 ring-orange-900/50"
                  [style.transform]="'translate3d(' + knobX() + 'px, ' + knobY() + 'px, 0)'">
                  <!-- Shine effect -->
                  <div class="absolute top-2 left-3 w-6 h-3 bg-white/40 rounded-full blur-[2px]"></div>
             </div>
        </div>
    }
  `,
  styles: [`:host { display: block; position: absolute; inset: 0; touch-action: none; }`]
})
export class JoystickComponent {
  move = output<{x: number, y: number}>();
  private haptic = inject(HapticService);
  
  isActive = signal(false);
  centerX = signal(0);
  centerY = signal(0);
  knobX = signal(0);
  knobY = signal(0);
  
  private maxDist = 75; 
  private deadZone = 10;
  private isAtMax = false;

  onTouchStart(e: TouchEvent) {
    if (e.cancelable) e.preventDefault(); 
    e.stopPropagation(); 
    
    const touch = e.changedTouches[0];
    this.isActive.set(true);
    this.centerX.set(touch.clientX);
    this.centerY.set(touch.clientY);
    this.knobX.set(0);
    this.knobY.set(0);
    this.isAtMax = false;
    
    this.haptic.impactLight();
    this.move.emit({x: 0, y: 0});
  }

  onTouchMove(e: TouchEvent) {
    if (e.cancelable) e.preventDefault(); 
    e.stopPropagation();
    
    if (!this.isActive()) return;

    const touch = e.changedTouches[0];
    let dx = touch.clientX - this.centerX();
    let dy = touch.clientY - this.centerY();
    let dist = Math.sqrt(dx*dx + dy*dy);

    if (dist > this.maxDist) {
        const ratio = this.maxDist / dist;
        const limitX = dx * ratio;
        const limitY = dy * ratio;
        const excessX = dx - limitX;
        const excessY = dy - limitY;
        
        this.centerX.update(cx => cx + excessX);
        this.centerY.update(cy => cy + excessY);
        
        dx = limitX;
        dy = limitY;
        dist = this.maxDist;

        if (!this.isAtMax) {
            this.isAtMax = true;
            this.haptic.impactLight();
        }
    } else {
        this.isAtMax = false;
    }
    
    this.updateKnob(dx, dy, dist);
  }

  onTouchEnd(e: TouchEvent) {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    this.reset();
  }

  private reset() {
    this.isActive.set(false);
    this.knobX.set(0);
    this.knobY.set(0);
    this.move.emit({x: 0, y: 0});
  }

  private updateKnob(dx: number, dy: number, dist: number) {
    if (dist < this.deadZone) {
        this.knobX.set(0);
        this.knobY.set(0);
        this.move.emit({ x: 0, y: 0 });
        return;
    }
    
    this.knobX.set(dx);
    this.knobY.set(dy);
    
    const outputDist = Math.min(dist, this.maxDist);
    const normalizedMag = (outputDist - this.deadZone) / (this.maxDist - this.deadZone);
    const angle = Math.atan2(dy, dx);
    const nx = Math.cos(angle) * normalizedMag;
    const ny = Math.sin(angle) * normalizedMag;
    
    this.move.emit({ x: nx, y: ny });
  }
}
