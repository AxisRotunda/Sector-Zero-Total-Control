
import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogueService } from '../services/dialogue.service';
import { GlitchTextComponent } from './glitch-text.component';
import { DialogueNode, DialogueOption } from '../models/narrative.models';

@Component({
  selector: 'app-dialogue-overlay',
  standalone: true,
  imports: [CommonModule, GlitchTextComponent],
  template: `
    @if (dialogue.activeDialogue(); as node) {
      <div class="fixed inset-0 z-[100] flex flex-col justify-end pointer-events-none pb-safe">
          
          <!-- Letterbox Borders -->
          <div class="absolute top-0 left-0 w-full h-16 bg-black z-10 transition-transform duration-500 translate-y-0"></div>
          <div class="absolute bottom-0 left-0 w-full h-16 bg-black z-10 transition-transform duration-500 translate-y-0"></div>

          <!-- Main Dialogue Container -->
          <div class="w-full max-w-4xl mx-auto mb-4 md:mb-12 pointer-events-auto animate-in slide-in-from-bottom-4 fade-in duration-300 px-4">
              
              <div class="bg-black/90 border-2 backdrop-blur-md shadow-2xl relative overflow-hidden flex flex-col md:flex-row rounded-sm transition-colors duration-500"
                   [style.border-color]="getFactionColor(node)">
                  
                  <!-- Background Scanlines -->
                  <div class="absolute inset-0 pointer-events-none opacity-20 z-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,currentColor_3px)]" 
                       [style.color]="getFactionColor(node)"></div>

                  <!-- Left: Portrait / Speaker Info -->
                  <div class="w-full md:w-48 border-b md:border-b-0 md:border-r flex flex-row md:flex-col shrink-0 relative bg-zinc-900/50"
                       [style.border-color]="getFactionColor(node)">
                      
                      <!-- Hologram Portrait Placeholder -->
                      <div class="w-24 h-24 md:w-full md:h-48 relative overflow-hidden flex items-center justify-center bg-black">
                          <!-- Simulated signal noise -->
                          <div class="absolute inset-0 opacity-30 animate-pulse bg-gradient-to-b from-transparent via-white/10 to-transparent translate-y-full"></div>
                          <div class="text-6xl filter grayscale contrast-150 drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">
                              👤
                          </div>
                          <!-- Glitch Overlay -->
                          <div class="absolute inset-0 bg-red-500/20 mix-blend-screen opacity-0 animate-[ping_3s_random_infinite]" *ngIf="node.mood === 'GLITCHED'"></div>
                      </div>

                      <div class="flex-1 p-3 flex flex-col justify-center border-l md:border-l-0 md:border-t border-zinc-800">
                          <span class="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Transmission Source</span>
                          <span class="text-lg font-black uppercase leading-none tracking-tighter" [style.color]="getFactionColor(node)">
                              {{ node.speaker }}
                          </span>
                          @if (node.factionId) {
                              <span class="text-[9px] font-mono text-zinc-400 mt-1 uppercase">[{{ node.factionId }}]</span>
                          }
                      </div>
                  </div>

                  <!-- Right: Text & Options -->
                  <div class="flex-1 p-6 flex flex-col justify-between relative z-10 min-h-[200px]">
                      
                      <!-- Dialogue Text -->
                      <div class="mb-6 relative font-mono text-base md:text-lg leading-relaxed text-zinc-200" (click)="dialogue.skipTypewriter()">
                          
                          @if (node.mood === 'GLITCHED' || node.mood === 'DIGITAL') {
                              <app-glitch-text [text]="dialogue.visibleText()" [intensity]="0.05"></app-glitch-text>
                          } @else {
                              {{ dialogue.visibleText() }}
                          }
                          
                          <!-- Blinking cursor if typing -->
                          @if (dialogue.isTyping()) {
                              <span class="inline-block w-2 h-4 bg-current animate-pulse ml-1 align-middle" [style.color]="getFactionColor(node)"></span>
                          }
                      </div>

                      <!-- Options List -->
                      <div class="flex flex-col gap-2 items-end mt-auto">
                          @for (opt of node.options; track $index) {
                              @if (dialogue.checkRequirements(opt.reqs)) {
                                  <button (mousedown)="dialogue.selectOption(opt)" 
                                          class="group relative overflow-hidden px-6 py-3 bg-zinc-900 border transition-all duration-200 text-right w-full md:w-auto"
                                          [ngClass]="getOptionClasses(opt)">
                                      
                                      <!-- Hover Slide -->
                                      <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-l from-current to-transparent pointer-events-none" 
                                           [style.color]="getOptionColor(opt) + '20'"></div>
                                      
                                      <div class="relative z-10 flex flex-col items-end">
                                          <span class="font-bold font-mono text-sm group-hover:text-white transition-colors"
                                                [style.color]="dialogue.isTyping() ? '#52525b' : ''">
                                              > {{ opt.text }}
                                          </span>
                                          @if (opt.style === 'TECH') { <span class="text-[8px] uppercase tracking-widest text-zinc-500 group-hover:text-zinc-300">[INTEL]</span> }
                                          @if (opt.style === 'AGGRESSIVE') { <span class="text-[8px] uppercase tracking-widest text-red-500 group-hover:text-red-300">[HOSTILE]</span> }
                                      </div>
                                  </button>
                              } @else {
                                  <!-- Locked Option (Optional: Don't show or show disabled) -->
                                  <div class="px-6 py-2 border border-zinc-800 text-zinc-700 font-mono text-xs text-right cursor-not-allowed opacity-50 select-none">
                                      [LOCKED] {{ opt.text }}
                                  </div>
                              }
                          }
                      </div>
                  </div>
                  
                  <!-- Decorative Corner -->
                  <div class="absolute top-0 right-0 w-0 h-0 border-t-[40px] border-r-[40px] border-t-transparent border-r-current opacity-50"
                       [style.color]="getFactionColor(node)"></div>
              </div>
          </div>
      </div>
    }
  `
})
export class DialogueOverlayComponent {
  dialogue = inject(DialogueService);

  getFactionColor(node: DialogueNode): string {
      switch (node.factionId) {
          case 'VANGUARD': return '#06b6d4'; // Cyan
          case 'REMNANT': return '#f97316'; // Orange
          case 'RESONANT': return '#a855f7'; // Purple
          default: return '#71717a'; // Zinc
      }
  }

  getOptionColor(opt: DialogueOption): string {
      if (opt.style === 'AGGRESSIVE') return '#ef4444';
      if (opt.style === 'TECH') return '#06b6d4';
      return '#ffffff';
  }

  getOptionClasses(opt: DialogueOption): string {
      let classes = "border-zinc-700 text-zinc-400";
      if (this.dialogue.isTyping()) {
          return "border-zinc-800 text-zinc-700 cursor-default";
      }
      if (opt.style === 'AGGRESSIVE') classes += " hover:border-red-500";
      else if (opt.style === 'TECH') classes += " hover:border-cyan-500";
      else classes += " hover:border-white";
      return classes;
  }
}
