import { Component, Input, signal, OnChanges, SimpleChanges, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-glitch-text',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="font-mono relative inline-block">
      <span [class.opacity-0]="isGlitching()">{{ text }}</span>
      @if (isGlitching()) {
        <span class="absolute inset-0 text-red-500 left-[1px] opacity-80">{{ scrambledText() }}</span>
        <span class="absolute inset-0 text-cyan-500 -left-[1px] opacity-80">{{ scrambledText() }}</span>
        <span class="absolute inset-0 text-white">{{ scrambledText() }}</span>
      }
    </span>
  `
})
export class GlitchTextComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) text: string = '';
  @Input() intensity: number = 0.1; // 0 to 1

  display = signal('');
  scrambledText = signal('');
  isGlitching = signal(false);

  private intervalId: any;
  private chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&?!<>';

  ngOnChanges(changes: SimpleChanges) {
    if (changes['text']) {
      this.display.set(this.text);
      this.stopGlitch();
      this.startGlitchLoop();
    }
  }

  ngOnDestroy() {
    this.stopGlitch();
  }

  private startGlitchLoop() {
    this.intervalId = setInterval(() => {
      if (Math.random() < this.intensity) {
        this.triggerGlitch();
      }
    }, 100); // Check every 100ms
  }

  private stopGlitch() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.isGlitching.set(false);
  }

  private triggerGlitch() {
    this.isGlitching.set(true);
    
    // Scramble logic
    const len = this.text.length;
    let out = '';
    for (let i = 0; i < len; i++) {
        if (this.text[i] === ' ') {
            out += ' ';
            continue;
        }
        if (Math.random() > 0.6) {
            out += this.chars[Math.floor(Math.random() * this.chars.length)];
        } else {
            out += this.text[i];
        }
    }
    this.scrambledText.set(out);

    // Reset after short duration
    setTimeout(() => {
        this.isGlitching.set(false);
    }, 50 + Math.random() * 100);
  }
}