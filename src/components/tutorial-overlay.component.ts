
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TutorialService } from '../services/tutorial.service';

@Component({
  selector: 'app-tutorial-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (tutorial.activeTutorial(); as step) {
      <div class="absolute top-24 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-[100] animate-in slide-in-from-top-4 fade-in duration-300 pointer-events-auto">
        <div class="bg-zinc-950/95 border-l-4 border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.2)] p-6 relative backdrop-blur-md overflow-hidden group">
           
           <!-- Holographic Grid Background -->
           <div class="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(6,182,212,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.5)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

           <!-- Scanline -->
           <div class="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent translate-y-[-100%] animate-[scan_3s_ease-in-out_infinite] pointer-events-none"></div>

           <div class="flex items-start justify-between mb-4 relative z-10">
              <div class="flex flex-col">
                  <span class="text-[10px] font-bold text-cyan-500 tracking-[0.2em] uppercase mb-1">Training Module // {{step.id}}</span>
                  <h3 class="text-2xl font-black text-white italic tracking-tighter shadow-cyan-glow">{{ step.title }}</h3>
              </div>
              <div class="flex gap-2">
                  <button (click)="tutorial.skipAll()" class="text-[9px] font-bold text-zinc-500 hover:text-red-400 uppercase tracking-widest border border-zinc-800 hover:border-red-900 px-2 py-1 transition-colors">
                      Skip All
                  </button>
                  <button (click)="tutorial.dismiss()" class="text-zinc-500 hover:text-white transition-colors border border-transparent hover:border-zinc-700 rounded p-1">
                      <svg viewBox="0 0 24 24" class="w-6 h-6 fill-current"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>
                  </button>
              </div>
           </div>

           <!-- VISUAL SCHEMATICS -->
           <div class="w-full h-32 mb-4 bg-black/40 border border-zinc-800 relative overflow-hidden flex items-center justify-center">
                
                <!-- MOVEMENT VISUAL -->
                @if (step.id === 'movement') {
                    <div class="relative w-full h-full">
                        <div class="absolute inset-0 flex">
                            <!-- Left Zone Highlight -->
                            <div class="w-1/2 h-full bg-cyan-500/10 border-r border-dashed border-cyan-500/30 flex items-center justify-center relative">
                                <span class="absolute top-2 left-2 text-[8px] text-cyan-500 font-mono">TOUCH ZONE A</span>
                                <!-- Joystick Animation -->
                                <div class="w-12 h-12 rounded-full border border-zinc-500 relative animate-[pulse_2s_infinite]">
                                    <div class="absolute w-full h-full rounded-full border border-dashed border-cyan-500 opacity-50"></div>
                                    <div class="absolute w-6 h-6 bg-cyan-500 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_15px_rgba(6,182,212,0.8)] animate-[wiggle_2s_ease-in-out_infinite]"></div>
                                </div>
                                <div class="absolute bottom-4 text-[9px] text-cyan-400 font-bold uppercase tracking-widest">Drag to Move</div>
                            </div>
                            <div class="w-1/2 h-full flex items-center justify-center opacity-30">
                                <span class="text-[8px] text-zinc-600 font-mono">NO SIGNAL</span>
                            </div>
                        </div>
                    </div>
                }

                <!-- COMBAT VISUAL -->
                @if (step.id === 'combat') {
                    <div class="relative w-full h-full">
                        <div class="absolute inset-0 flex">
                            <div class="w-1/2 h-full opacity-20 bg-zinc-900 border-r border-zinc-800"></div>
                            <!-- Right Zone Highlight -->
                            <div class="w-1/2 h-full bg-orange-500/10 border-l border-dashed border-orange-500/30 flex items-center justify-center relative flex-col gap-2">
                                <span class="absolute top-2 right-2 text-[8px] text-orange-500 font-mono">TOUCH ZONE B</span>
                                
                                <div class="flex items-end gap-2">
                                    <!-- Small Btn -->
                                    <div class="w-6 h-6 rounded-full border border-zinc-600 bg-zinc-800"></div>
                                    <!-- Attack Btn -->
                                    <div class="w-12 h-12 rounded-full border-2 border-orange-500 bg-orange-900/40 shadow-[0_0_20px_rgba(249,115,22,0.4)] flex items-center justify-center animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]">
                                        <div class="w-8 h-8 rounded-full bg-orange-500 opacity-80"></div>
                                    </div>
                                </div>
                                <div class="text-[9px] text-orange-400 font-bold uppercase tracking-widest mt-1">Tap to Strike</div>
                            </div>
                        </div>
                    </div>
                }

                <!-- INVENTORY VISUAL -->
                @if (step.id === 'inventory') {
                    <div class="relative w-full h-full flex items-center justify-center bg-zinc-900/50">
                        <div class="grid grid-cols-3 gap-2">
                            <div class="w-10 h-10 border border-zinc-700 bg-black rounded-sm opacity-50"></div>
                            <!-- Active Item Slot -->
                            <div class="w-10 h-10 border border-cyan-500 bg-cyan-900/20 rounded-sm relative flex items-center justify-center overflow-visible">
                                <!-- Ghost Hand -->
                                <div class="absolute z-10 translate-x-4 translate-y-4 animate-[dragmove_2s_ease-in-out_infinite]">
                                    <div class="w-4 h-4 bg-white rounded-full opacity-80 shadow-[0_0_10px_white]"></div>
                                    <div class="w-8 h-8 border-2 border-white rounded-sm absolute -top-2 -left-2 opacity-50"></div>
                                </div>
                                <!-- Item -->
                                <div class="w-6 h-6 bg-purple-500 rounded-sm shadow-[0_0_10px_rgba(168,85,247,0.6)]"></div>
                            </div>
                            <div class="w-10 h-10 border border-zinc-700 bg-black rounded-sm opacity-50"></div>
                        </div>
                        <div class="absolute bottom-2 text-[9px] text-zinc-400 font-mono">HOLD & DRAG TO EQUIP</div>
                    </div>
                }
           </div>

           <p class="text-sm text-zinc-300 font-mono leading-relaxed border-t border-zinc-800 pt-3 relative z-10">
             {{ step.content }}
           </p>

           <div class="mt-4 flex justify-end relative z-10">
              <button (click)="tutorial.dismiss()" class="px-6 py-2 bg-cyan-600/20 border border-cyan-500/50 text-cyan-300 text-xs font-bold hover:bg-cyan-500 hover:text-white transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] rounded-sm tracking-wider uppercase">
                  Initialize
              </button>
           </div>

           <!-- Deco -->
           <div class="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-500"></div>
           <div class="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-500"></div>
        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes wiggle {
      0%, 100% { transform: translate(-50%, -50%); }
      25% { transform: translate(-30%, -70%); }
      50% { transform: translate(-70%, -30%); }
      75% { transform: translate(-30%, -30%); }
    }
    @keyframes dragmove {
      0% { transform: translate(10px, 10px); opacity: 0; }
      20% { transform: translate(10px, 10px); opacity: 1; } /* Grab */
      60% { transform: translate(-30px, -10px); opacity: 1; } /* Move */
      80% { transform: translate(-30px, -10px); opacity: 0; } /* Drop */
      100% { transform: translate(10px, 10px); opacity: 0; }
    }
    @keyframes scan {
      0% { transform: translateY(-100%); }
      100% { transform: translateY(100%); }
    }
  `]
})
export class TutorialOverlayComponent {
  tutorial = inject(TutorialService);
}
