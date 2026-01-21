
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapService } from '../services/map.service';
import { InputService, Action, DEFAULT_BINDINGS } from '../services/input.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center animate-in fade-in p-4" (touchstart)="$event.stopPropagation()">
      <div class="w-full max-w-2xl bg-zinc-950 border border-zinc-700 shadow-2xl relative overflow-hidden flex flex-col h-[80vh]">
         
         <!-- Header -->
         <div class="p-6 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center shrink-0">
             <div>
                 <h2 class="text-xl font-black text-white tracking-widest uppercase">SYSTEM CONFIG</h2>
                 <div class="text-[10px] text-zinc-500 font-mono tracking-widest">Interface Customization</div>
             </div>
             <button (click)="close()" class="w-10 h-10 flex items-center justify-center border border-zinc-700 hover:bg-red-900/50 hover:border-red-500 text-zinc-500 hover:text-white transition-all">✕</button>
         </div>

         <!-- Tabs -->
         <div class="flex border-b border-zinc-800 bg-zinc-900/20 shrink-0">
             <button (click)="activeTab.set('GAME')" class="flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors"
                     [class]="activeTab() === 'GAME' ? 'bg-zinc-800 text-white border-b-2 border-cyan-500' : 'text-zinc-500 hover:text-zinc-300'">
                 Game & Interface
             </button>
             <button (click)="activeTab.set('CONTROLS')" class="flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors"
                     [class]="activeTab() === 'CONTROLS' ? 'bg-zinc-800 text-white border-b-2 border-orange-500' : 'text-zinc-500 hover:text-zinc-300'">
                 Controls
             </button>
         </div>

         <div class="p-6 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
             
             <!-- GAME SETTINGS -->
             @if (activeTab() === 'GAME') {
                 <div>
                     <h3 class="text-[10px] font-bold text-cyan-500 uppercase tracking-widest mb-4 border-b border-zinc-800 pb-1">HUD / Mapping</h3>
                     <div class="space-y-6">
                         <div class="flex flex-col gap-2">
                             <div class="flex justify-between text-xs text-zinc-300 font-bold">
                                 <span>Mini-Map Opacity</span>
                                 <span class="text-cyan-400 font-mono">{{ (map.settings().miniMapOpacity * 100).toFixed(0) }}%</span>
                             </div>
                             <input type="range" min="0.2" max="1" step="0.1" 
                                    [value]="map.settings().miniMapOpacity"
                                    (input)="updateSetting('miniMapOpacity', $any($event.target).value)"
                                    class="w-full accent-cyan-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer">
                         </div>

                         <div class="flex flex-col gap-2">
                             <div class="flex justify-between text-xs text-zinc-300 font-bold">
                                 <span>Zoom Level</span>
                                 <span class="text-cyan-400 font-mono">{{ map.settings().miniMapZoom.toFixed(2) }}x</span>
                             </div>
                             <input type="range" min="0.1" max="0.5" step="0.05" 
                                    [value]="map.settings().miniMapZoom"
                                    (input)="updateSetting('miniMapZoom', $any($event.target).value)"
                                    class="w-full accent-cyan-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer">
                         </div>

                         <!-- Toggles -->
                         <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                             @for (toggle of toggles; track toggle.key) {
                                 <div class="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-800 rounded-sm">
                                     <span class="text-xs text-zinc-300 font-bold">{{ toggle.label }}</span>
                                     <button (click)="toggleSetting(toggle.key)" 
                                             class="w-10 h-5 rounded-full transition-colors relative"
                                             [class]="map.settings()[toggle.key] ? 'bg-cyan-600' : 'bg-zinc-700'">
                                         <div class="absolute top-1 bottom-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm"
                                              [class.left-1]="!map.settings()[toggle.key]"
                                              [class.right-1]="map.settings()[toggle.key]"></div>
                                     </button>
                                 </div>
                             }
                         </div>
                     </div>
                 </div>
             }

             <!-- CONTROLS SETTINGS -->
             @if (activeTab() === 'CONTROLS') {
                 <div class="space-y-6">
                     <div class="flex justify-between items-center mb-4">
                         <h3 class="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Key Bindings</h3>
                         <button (click)="input.resetBindings()" class="text-[10px] text-red-400 hover:text-white uppercase font-bold hover:underline">Reset Defaults</button>
                     </div>

                     <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                         @for (group of actionGroups; track group.name) {
                             <div class="col-span-full mt-4 mb-2 border-b border-zinc-800 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{{group.name}}</div>
                             @for (action of group.actions; track action) {
                                 <div class="flex justify-between items-center py-2 group hover:bg-zinc-900/50 px-2 rounded transition-colors">
                                     <span class="text-xs text-zinc-300 font-mono">{{ formatAction(action) }}</span>
                                     <button (click)="startListening(action)" 
                                             class="min-w-[80px] py-1 px-3 bg-zinc-900 border text-xs font-mono font-bold text-center rounded transition-all"
                                             [class]="listeningFor() === action ? 'border-orange-500 text-orange-500 animate-pulse' : 'border-zinc-700 text-zinc-400 hover:border-white hover:text-white'">
                                         {{ listeningFor() === action ? 'PRESS KEY' : displayKey(input.bindings()[action]) }}
                                     </button>
                                 </div>
                             }
                         }
                     </div>
                 </div>
             }
         </div>
         
         <!-- Footer -->
         <div class="p-6 border-t border-zinc-800 bg-zinc-900/50 flex justify-end">
             <button (click)="close()" class="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold border border-zinc-600 uppercase tracking-wider transition-colors">
                 Close
             </button>
         </div>
         
         <!-- Deco -->
         <div class="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-orange-500 opacity-50"></div>
      </div>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #09090b; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: #06b6d4; cursor: pointer; border: 2px solid #000; box-shadow: 0 0 5px #06b6d4; }
  `]
})
export class SettingsComponent {
  map = inject(MapService);
  input = inject(InputService);
  
  activeTab = signal<'GAME' | 'CONTROLS'>('GAME');
  listeningFor = signal<Action | null>(null);

  toggles: {key: keyof import('../services/map.service').MapSettings, label: string}[] = [
      { key: 'showEnemyRadar', label: 'Enemy Radar' },
      { key: 'showMarkers', label: 'User Markers' },
      { key: 'showTrail', label: 'Movement Trail' },
      { key: 'rotateMiniMap', label: 'Rotate Map' }
  ];

  actionGroups: {name: string, actions: Action[]}[] = [
      { name: 'Movement', actions: ['MOVE_UP', 'MOVE_DOWN', 'MOVE_LEFT', 'MOVE_RIGHT'] },
      { name: 'Combat', actions: ['ATTACK', 'SKILL_1', 'SKILL_2', 'SKILL_3', 'SKILL_4'] },
      { name: 'Interaction', actions: ['INTERACT'] },
      { name: 'Interface', actions: ['TOGGLE_INV', 'TOGGLE_MAP', 'TOGGLE_SKILLS', 'TOGGLE_PSI', 'TOGGLE_CODEX', 'TOGGLE_SHOP', 'MENU'] }
  ];

  constructor() {
      window.addEventListener('keydown', this.handleBind);
  }

  ngOnDestroy() {
      window.removeEventListener('keydown', this.handleBind);
  }

  updateSetting(key: any, value: string) {
      this.map.updateSetting(key, parseFloat(value));
  }

  toggleSetting(key: any) {
      this.map.updateSetting(key, !this.map.settings()[key as keyof typeof this.map.settings]);
  }

  close() {
      this.listeningFor.set(null);
      this.map.isSettingsOpen.set(false);
  }

  formatAction(action: string) {
      return action.replace(/_/g, ' ');
  }

  displayKey(key: string) {
      if (key === ' ') return 'SPACE';
      return key.toUpperCase();
  }

  startListening(action: Action) {
      this.listeningFor.set(action);
  }

  handleBind = (e: KeyboardEvent) => {
      const target = this.listeningFor();
      if (target) {
          e.preventDefault();
          e.stopPropagation();
          // Don't allow binding Escape if it's the menu key, unless we are rebinding menu
          if (e.key === 'Escape' && target !== 'MENU') {
              this.listeningFor.set(null);
              return;
          }
          this.input.rebind(target, e.key);
          this.listeningFor.set(null);
      }
  }
}
