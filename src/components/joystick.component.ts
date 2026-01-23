
import { Component, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-joystick',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Touch Area: Covers the left side of the screen usually -->
    <div class="absolute inset-0 z-10 touch-none"
         (touchstart)="onTouchStart($event)"
         (touchmove)="onTouchMove($event)"
         (touchend)="onTouchEnd($event)"
         (touchcancel)="onTouchEnd($event)">
    </div>

    <!-- Dynamic Joystick Visuals -->
    @if (isActive()) {
        <div class="absolute w-32 h-32 rounded-full border border-zinc-500/30 bg-zinc-900/20 pointer-events-none transition-opacity duration-150 animate-in fade-in zoom-in-95"
             [style.left.px]="centerX() - 64"
             [style.top.px]="centerY() - 64">
             
             <!-- Inner Ring -->
             <div class="absolute inset-2 rounded-full border border-dashed border-zinc-600/50"></div>
             
             <!-- Deadzone Indicator -->
             <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-red-900/20 border border-red-500/30"></div>

             <!-- Thumb Knob -->
             <div class="absolute w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-700 rounded-full shadow-[0_0_15px_rgba(249,115,22,0.5)] border border-orange-400"
                  [style.transform]="'translate(' + (knobX() + 40) + 'px, ' + (knobY() + 40) + 'px)'">
             </div>
        </div>
    }
  `,
  styles: [`:host { display: block; position: absolute; inset: 0; }`]
})
export class JoystickComponent {
  move = output<{x: number, y: number}>();
  
  isActive = signal(false);
  centerX = signal(0);
  centerY = signal(0);
  knobX = signal(0);
  knobY = signal(0);
  
  private maxDist = 50;
  private deadZone = 5;

  onTouchStart(e: TouchEvent) {
    e.preventDefault(); 
    e.stopPropagation(); // Stop bubbling to prevent triggering global click logic
    const touch = e.changedTouches[0];
    
    this.isActive.set(true);
    // Floating behavior: center is wherever touch begins
    this.centerX.set(touch.clientX);
    this.centerY.set(touch.clientY);
    this.knobX.set(0);
    this.knobY.set(0);
    
    this.move.emit({x: 0, y: 0});
  }

  onTouchMove(e: TouchEvent) {
    e.preventDefault(); 
    e.stopPropagation();
    if (!this.isActive()) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - this.centerX();
    const dy = touch.clientY - this.centerY();
    
    this.updateKnob(dx, dy);
  }

  onTouchEnd(e: TouchEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.reset();
  }

  private reset() {
    this.isActive.set(false);
    this.knobX.set(0);
    this.knobY.set(0);
    this.move.emit({x: 0, y: 0});
  }

  private updateKnob(dx: number, dy: number) {
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist < this.deadZone) {
        this.knobX.set(0);
        this.knobY.set(0);
        this.move.emit({ x: 0, y: 0 });
        return;
    }
    
    const angle = Math.atan2(dy, dx);
    const cappedDist = Math.min(dist, this.maxDist);
    
    const x = Math.cos(angle) * cappedDist;
    const y = Math.sin(angle) * cappedDist;
    
    this.knobX.set(x);
    this.knobY.set(y);
    
    // Normalize output vector
    let nx = x / this.maxDist;
    let ny = y / this.maxDist;
    
    this.move.emit({ x: nx, y: ny });
  }
}
