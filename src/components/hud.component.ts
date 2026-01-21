
import { Component, inject, output, computed, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MissionService } from '../game/mission.service';
import { SkillTreeService } from '../game/skill-tree.service';
import { PlayerService } from '../game/player/player.service';
import { WorldService } from '../game/world/world.service';
import { InventoryService } from '../game/inventory.service';
import { EventBusService } from '../core/events/event-bus.service';
import { GameEvents, LocationDiscoveryPayload } from '../core/events/game-events';
import { MapComponent } from './map.component';
import { MapService } from '../services/map.service';
import { TutorialOverlayComponent } from './tutorial-overlay.component';
import { PlayerControlService } from '../systems/player-control.service';
import { DialogueService } from '../services/dialogue.service';
import { NarrativeService } from '../game/narrative.service';
import { InputService } from '../services/input.service';
import { ShopService } from '../services/shop.service';
import { FACTIONS } from '../config/narrative.config';
import { GlitchTextComponent } from './glitch-text.component';
import { Subscription } from 'rxjs';
import { InteractionService } from '../services/interaction.service';

@Component({
  selector: 'app-hud',
  standalone: true,
  imports: [CommonModule, MapComponent, TutorialOverlayComponent, GlitchTextComponent],
  template: `
    <!-- Z-Index 40 to ensure HUD sits ABOVE the Joystick (Z-10) and Action Buttons -->
    <div class="absolute inset-0 z-40 flex flex-col pointer-events-none pt-safe pb-safe pl-safe pr-safe">
        
        <app-tutorial-overlay></app-tutorial-overlay>

        <!-- TOP BAR -->
        <div class="flex justify-between items-start p-2 pointer-events-auto">
          
          <!-- LEFT: STATS -->
          <div class="flex flex-col gap-1 w-48 md:w-56 bg-zinc-900/90 p-2 border-l-4 border-orange-600 backdrop-blur-md shadow-2xl clip-path-slant">
            <div class="flex justify-between text-[10px] font-bold text-zinc-400 tracking-wider">
               <span>BIO-SIG</span>
               <span class="text-white">{{ Math.ceil(player.stats.playerHp()) }} / {{ Math.floor(player.stats.playerStats().hpMax) }}</span>
            </div>
            <div class="h-2 md:h-3 w-full bg-zinc-950 border border-zinc-800 relative overflow-hidden">
               <div class="h-full bg-gradient-to-r from-red-900 to-red-600 transition-all duration-200" 
                    [style.width.%]="(player.stats.playerHp() / player.stats.playerStats().hpMax) * 100"></div>
            </div>

            <div class="flex justify-between text-[10px] font-bold text-zinc-400 tracking-wider mt-1">
               <span>PSI-SIG</span>
               <span class="text-white">{{ Math.ceil(player.stats.psionicEnergy()) }} / {{ Math.floor(player.stats.maxPsionicEnergy()) }}</span>
            </div>
            <div class="h-2 md:h-3 w-full bg-zinc-950 border border-zinc-800 relative overflow-hidden">
               <div class="h-full bg-gradient-to-r from-purple-900 to-purple-600 transition-all duration-200" 
                    [style.width.%]="(player.stats.psionicEnergy() / player.stats.maxPsionicEnergy()) * 100"></div>
            </div>

            <div class="flex justify-between items-center mt-1">
               <span class="text-[10px] font-bold text-zinc-500 tracking-wider">RANK {{ player.progression.level() }}</span>
               <div class="flex flex-col items-end leading-none">
                   <span class="text-[10px] text-yellow-500 font-mono font-bold">{{ player.progression.credits() }} CR</span>
                   <span class="text-[9px] text-zinc-500 font-mono">{{ player.progression.scrap() }} SCRAP</span>
               </div>
            </div>
          </div>

          <!-- RIGHT: MAP & MENU -->
          <div class="flex flex-col items-end gap-2">
             <div class="relative group">
                 <app-map mode="MINI" (mousedown)="mapService.toggleFullMap()" class="cursor-pointer border-2 border-zinc-800 hover:border-cyan-500 transition-colors shadow-lg bg-black"></app-map>
                 
                 <!-- Persistent Zone Indicator -->
                 <div class="absolute top-0 right-0 max-w-[180px] bg-black/80 rounded-bl text-right p-1 pointer-events-none border-b border-l border-zinc-800">
                     <div class="text-[9px] font-mono text-cyan-500 font-bold uppercase truncate tracking-tight">{{ world.currentZone().name }}</div>
                     <div class="text-[7px] font-mono text-zinc-600 uppercase tracking-widest">Sector Depth {{ world.currentZone().minDepth }}</div>
                 </div>
             </div>

             <div class="flex gap-2 items-center">
                <div class="flex gap-1 mr-1 px-1 bg-black/40 items-center border border-zinc-800 rounded-sm h-8">
                    @for (s of narrative.factionStandings(); track s.factionId) {
                        <div class="w-2 h-2 rounded-full shadow-[0_0_5px]" 
                             [style.background-color]="FACTIONS[s.factionId].color"
                             [title]="FACTIONS[s.factionId].name"></div>
                    }
                </div>

                <button (mousedown)="openInventory.emit()" class="w-12 h-10 bg-zinc-900 border border-zinc-700 hover:border-orange-500 flex flex-col items-center justify-center transition-all group active:scale-95">
                   <span class="text-[9px] text-zinc-400 group-hover:text-white font-bold">KIT</span>
                   <span class="text-[7px] text-zinc-600 group-hover:text-zinc-400">INV</span>
                </button>
                <button (mousedown)="openAbilities.emit()" class="w-12 h-10 bg-zinc-900 border border-zinc-700 hover:border-purple-500 flex flex-col items-center justify-center transition-all group relative active:scale-95">
                   <span class="text-[9px] text-zinc-400 group-hover:text-white font-bold">PSI</span>
                   <span class="text-[7px] text-zinc-600 group-hover:text-zinc-400">TECH</span>
                </button>
                <button (mousedown)="openSkills.emit()" class="w-12 h-10 bg-zinc-900 border border-zinc-700 hover:border-cyan-500 flex flex-col items-center justify-center transition-all group relative active:scale-95">
                   <span class="text-[9px] text-zinc-400 group-hover:text-white font-bold">NET</span>
                   <span class="text-[7px] text-zinc-600 group-hover:text-zinc-400">TREE</span>
                   @if (skillTree.skillPoints() > 0) { <span class="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-bounce"></span> }
                </button>
                <button (mousedown)="openCodex.emit()" class="w-12 h-10 bg-zinc-900 border border-zinc-700 hover:border-cyan-400 flex flex-col items-center justify-center transition-all group active:scale-95">
                   <span class="text-[9px] text-zinc-400 group-hover:text-white font-bold">LOG</span>
                   <span class="text-[7px] text-zinc-600 group-hover:text-zinc-400">DATA</span>
                </button>
                <button (mousedown)="openJournal.emit()" class="w-12 h-10 bg-zinc-900 border border-zinc-700 hover:border-amber-500 flex flex-col items-center justify-center transition-all group active:scale-95">
                   <span class="text-[9px] text-zinc-400 group-hover:text-white font-bold">OBJ</span>
                   <span class="text-[7px] text-zinc-600 group-hover:text-zinc-400">QUEST</span>
                </button>
                <button (mousedown)="mapService.toggleSettings()" class="w-12 h-10 bg-zinc-900 border border-zinc-700 hover:border-zinc-400 flex flex-col items-center justify-center transition-all group active:scale-95">
                   <svg viewBox="0 0 24 24" class="w-5 h-5 fill-zinc-500 group-hover:fill-white"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L3.16 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.58 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6 3.6 1.62 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6 1.62 3.6-3.6 3.6 1.62 3.6-3.6 3.6 3.6z"></path></svg>
                </button>
             </div>
          </div>
        </div>

        <div class="absolute top-24 left-0 right-0 flex justify-center pointer-events-none px-4">
           @if (mission.trackedMission(); as activeM) {
               <div class="bg-gradient-to-r from-transparent via-black/80 to-transparent px-8 py-2 border-y border-orange-900/30 backdrop-blur text-center w-full max-w-md animate-in slide-in-from-top-2 pointer-events-auto cursor-pointer"
                    (click)="openJournal.emit()">
                  <div class="flex justify-center items-center gap-2 mb-1">
                      <span class="w-2 h-2 rounded-full" 
                            [class.bg-orange-500]="activeM.category === 'MAIN'"
                            [class.bg-cyan-500]="activeM.category === 'SIDE'"
                            [class.bg-zinc-500]="activeM.category === 'RADIANT'"></span>
                      <span class="text-[9px] text-zinc-500 tracking-[0.3em] uppercase">{{ activeM.category }} DIRECTIVE</span>
                  </div>
                  <div class="text-xs text-orange-100 font-bold tracking-wide">{{ mission.missionText() }}</div>
               </div>
           }
        </div>
        
        <!-- DISCOVERY NOTIFICATION -->
        @if (locationBanner()) {
            <div class="absolute top-40 left-0 right-0 flex flex-col items-center justify-center animate-in slide-in-from-top-10 fade-in duration-700 pointer-events-none z-50">
                <div class="bg-zinc-950/90 border-y-2 border-cyan-500 py-3 px-12 backdrop-blur-xl shadow-[0_0_50px_rgba(6,182,212,0.3)] relative overflow-hidden">
                    <div class="absolute inset-0 bg-cyan-500/10 animate-pulse"></div>
                    <div class="flex flex-col items-center relative z-10">
                        <div class="text-[10px] text-cyan-400 font-bold tracking-[0.4em] uppercase mb-1">
                            <app-glitch-text text="GEODATA ACQUIRED" [intensity]="0.3"></app-glitch-text>
                        </div>
                        <h2 class="text-3xl font-black text-white uppercase tracking-tighter shadow-cyan-glow">{{ locationBanner()!.name }}</h2>
                        <div class="w-full h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent mt-2"></div>
                    </div>
                </div>
            </div>
        }

        <!-- INTERACT BUTTON -->
        @if (interaction.activeInteractable() && !dialogueService.activeDialogue(); as target) {
            <!-- Centered horizontally, lifted up to avoid joystick overlap zone -->
            <div class="absolute bottom-48 left-0 right-0 flex justify-center pointer-events-auto z-50 animate-in fade-in slide-in-from-bottom-4">
                 <button (click)="interact(target)" 
                         (touchstart)="interact(target)"
                         class="group relative overflow-hidden bg-zinc-900/95 border-2 transition-all active:scale-95 py-4 px-12 rounded-full backdrop-blur-md shadow-[0_0_30px_rgba(0,0,0,0.8)] flex items-center gap-4 cursor-pointer"
                         [class.border-blue-500]="target.subType !== 'MEDIC'"
                         [class.border-red-500]="target.subType === 'MEDIC'">
                     
                     <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>

                     <span class="text-3xl font-black" [class.text-red-400]="target.subType === 'MEDIC'" [class.text-blue-400]="target.subType !== 'MEDIC'">
                        @if(target.subType === 'MEDIC') { ✚ }
                        @else if(target.subType === 'TRADER') { ⟳ }
                        @else if(target.subType === 'HANDLER') { ! }
                        @else if(target.subType === 'CONSOLE') { ⌨ }
                        @else if(target.subType === 'CITIZEN') { 🗨 }
                        @else { ? }
                     </span>
                     <div class="flex flex-col items-start">
                         <span class="font-bold tracking-widest text-white text-base uppercase">{{ interaction.getInteractLabel(target) }}</span>
                         <span class="text-[9px] text-zinc-400 font-mono">
                            {{ input.usingKeyboard() ? '[F] TO ENGAGE' : 'TAP TO ENGAGE' }}
                         </span>
                     </div>
                 </button>
            </div>
        }
    </div>
  `
})
export class HudComponent implements OnDestroy {
  player = inject(PlayerService);
  world = inject(WorldService);
  mission = inject(MissionService);
  skillTree = inject(SkillTreeService);
  playerControl = inject(PlayerControlService);
  narrative = inject(NarrativeService);
  mapService = inject(MapService);
  dialogueService = inject(DialogueService);
  input = inject(InputService);
  shopService = inject(ShopService);
  eventBus = inject(EventBusService);
  interaction = inject(InteractionService);
  FACTIONS = FACTIONS;
  
  openInventory = output<void>();
  openSkills = output<void>();
  openAbilities = output<void>();
  openCodex = output<void>();
  openShop = output<void>();
  openJournal = output<void>();
  Math = Math;

  locationBanner = signal<LocationDiscoveryPayload | null>(null);
  private sub: Subscription;

  constructor() {
      this.sub = this.eventBus.on(GameEvents.LOCATION_DISCOVERED).subscribe(payload => {
          this.locationBanner.set(payload);
          setTimeout(() => this.locationBanner.set(null), 4000);
      });
  }

  ngOnDestroy() {
      if (this.sub) this.sub.unsubscribe();
  }

  interact(target: any) {
      this.interaction.interact(target);
  }
}
