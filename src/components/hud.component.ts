
import { Component, inject, output, computed, signal, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MissionService } from '../game/mission.service';
import { SkillTreeService } from '../game/skill-tree.service';
import { PlayerService } from '../game/player/player.service';
import { WorldService } from '../game/world/world.service';
import { MapComponent } from './map.component';
import { MapService } from '../services/map.service';
import { TutorialOverlayComponent } from './tutorial-overlay.component';
import { NarrativeService } from '../game/narrative.service';
import { FACTIONS } from '../config/narrative.config';
import { GlitchTextComponent } from './glitch-text.component';
import { ICONS } from '../config/icons.config';
import { UiPanelService } from '../services/ui-panel.service';
import { InteractionService } from '../services/interaction.service';
import { Entity } from '../models/game.models';
import { EventBusService } from '../core/events/event-bus.service';
import { GameEvents, RealityBleedPayload } from '../core/events/game-events';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RealityCorrectorService } from '../core/reality-corrector.service';
import { PerformanceTelemetryService } from '../systems/performance-telemetry.service';
import { AdaptiveQualityService } from '../systems/adaptive-quality.service';
import { ProofKernelService, KernelDiagnostics } from '../core/proof/proof-kernel.service';

@Component({
  selector: 'app-hud',
  standalone: true,
  imports: [CommonModule, MapComponent, TutorialOverlayComponent, GlitchTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="absolute inset-0 z-40 flex flex-col pointer-events-none pt-safe pb-safe pl-safe pr-safe font-mono">
        
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
                    [style.width.%]="player.stats.healthPercentage()"></div>
            </div>

            <div class="flex justify-between text-[10px] font-bold text-zinc-400 tracking-wider mt-1">
               <span>PSI-SIG</span>
               <span class="text-white">{{ Math.ceil(player.stats.psionicEnergy()) }} / {{ Math.floor(player.stats.maxPsionicEnergy()) }}</span>
            </div>
            <div class="h-2 md:h-3 w-full bg-zinc-950 border border-zinc-800 relative overflow-hidden">
               <div class="h-full bg-gradient-to-r from-purple-900 to-purple-600 transition-all duration-200" 
                    [style.width.%]="player.stats.energyPercentage()"></div>
            </div>

            <div class="flex justify-between items-center mt-1">
               <span class="text-[10px] font-bold text-zinc-500 tracking-wider">RANK {{ player.progression.level() }}</span>
               <div class="flex flex-col items-end leading-none">
                   <span class="text-[10px] text-yellow-500 font-bold">{{ player.progression.credits() }} CR</span>
                   <span class="text-[9px] text-zinc-500">{{ player.progression.scrap() }} SCRAP</span>
               </div>
            </div>
            
            <!-- REALITY INTEGRITY INDICATOR -->
            <div class="mt-2 pt-2 border-t border-zinc-800">
              <div class="flex justify-between text-[11px] uppercase tracking-widest font-bold mb-1">
                <span class="text-cyan-600 drop-shadow-[0_0_4px_rgba(6,182,212,0.8)]">REALITY STABILITY</span>
                <span 
                  [class.text-red-500]="realityIntegrity() < 50" 
                  [class.text-yellow-500]="realityIntegrity() >= 50 && realityIntegrity() < 80"
                  [class.text-cyan-500]="realityIntegrity() >= 80"
                  class="drop-shadow-[0_0_4px_currentColor]">
                  {{ realityIntegrity() }}%
                </span>
              </div>
              <div class="w-full h-3 bg-zinc-950 border border-zinc-700 relative overflow-hidden">
                <div class="h-full transition-all duration-300"
                  [style.width.%]="realityIntegrity()"
                  [class.bg-gradient-to-r]="true"
                  [class.from-cyan-600]="realityIntegrity() >= 80"
                  [class.to-cyan-400]="realityIntegrity() >= 80"
                  [class.from-yellow-600]="realityIntegrity() >= 50 && realityIntegrity() < 80"
                  [class.to-yellow-400]="realityIntegrity() >= 50 && realityIntegrity() < 80"
                  [class.from-red-600]="realityIntegrity() < 50"
                  [class.to-red-400]="realityIntegrity() < 50"
                  [class.shadow-[0_0_8px_currentColor]]="true"
                  [class.animate-pulse]="realityIntegrity() < 30"></div>
              </div>
              
              <!-- KERNEL DEBUG PANEL (Visible if failures exist) -->
              @if (kernelDiagnostics().failingAxioms.length > 0) {
                <div class="mt-1 border-t border-zinc-800 pt-1 bg-red-900/10 p-1">
                  <div class="text-[9px] text-red-500 font-bold tracking-tight mb-1">TOP AXIOM FAILURES</div>
                  @for (ax of kernelDiagnostics().failingAxioms | slice:0:3; track ax.id) {
                    <div class="flex justify-between text-[8px] text-zinc-400 font-mono">
                      <span class="truncate max-w-[120px]">{{ ax.id }}</span>
                      <span class="text-red-400">{{ ax.failures }}</span>
                    </div>
                  }
                </div>
              }

              <!-- Performance Telemetry Overlay -->
              <div class="mt-2 pt-2 border-t border-zinc-800">
                  <div class="flex justify-between text-[10px]">
                    <span class="text-zinc-500">FPS</span>
                    <span 
                      [class.text-green-500]="getPerformanceStats().fps >= 55"
                      [class.text-yellow-500]="getPerformanceStats().fps >= 30 && getPerformanceStats().fps < 55"
                      [class.text-red-500]="getPerformanceStats().fps < 30">
                      {{ getPerformanceStats().fps.toFixed(0) }}
                    </span>
                  </div>
                  <div class="flex justify-between text-[10px]">
                    <span class="text-zinc-500">Quality</span>
                    <span class="text-cyan-500">{{ getCurrentQuality() }}</span>
                  </div>
                  @if (getPerformanceStats().trend === 'DEGRADING' || getPerformanceStats().trend === 'CRITICAL') {
                    <div class="text-[9px] text-orange-500 animate-pulse mt-1 font-bold">
                      ⚠ ENTROPY RISING
                    </div>
                  }
              </div>

              @if (lastBleedMessage()) {
                <div class="text-[10px] text-red-500 mt-1 animate-pulse truncate drop-shadow-[0_0_6px_rgba(239,68,68,1)]">
                  {{ lastBleedMessage() }}
                </div>
              }
            </div>

            <!-- AUTO-CORRECTION STATS -->
            @if (getCorrectionStats().totalCorrections > 0) {
              <div class="mt-2 pt-2 border-t border-zinc-800">
                <div class="text-[10px] text-orange-500 font-bold tracking-widest">
                  AUTO-CORRECTIONS: {{ getCorrectionStats().totalCorrections }}
                </div>
              </div>
            }
          </div>

          <!-- RIGHT: MAP & MENU -->
          <div class="flex flex-col items-end gap-2">
             <div class="relative group">
                 <app-map mode="MINI" (mousedown)="mapService.toggleFullMap()" class="cursor-pointer border-2 border-zinc-800 hover:border-cyan-500 transition-colors shadow-lg bg-black"></app-map>
                 
                 <div class="absolute top-0 right-0 max-w-[180px] bg-black/80 rounded-bl text-right p-1 pointer-events-none border-b border-l border-zinc-800 flex flex-col items-end">
                     <div class="text-[9px] text-cyan-500 font-bold uppercase truncate tracking-tight">{{ world.currentZone().name }}</div>
                     <div class="flex items-center gap-2">
                         @if (world.currentZone().isSafeZone) {
                             <span class="text-[7px] font-bold text-green-500 bg-green-900/30 px-1 rounded border border-green-900/50 tracking-widest animate-pulse">SAFE ZONE</span>
                         }
                         <div class="text-[7px] text-zinc-600 uppercase tracking-widest">Depth {{ world.currentZone().minDepth }}</div>
                     </div>
                 </div>
             </div>

             <!-- ICON NAV BAR -->
             <div class="flex gap-1 items-center bg-black/40 p-1 border border-zinc-800 rounded shadow-xl">
                <div class="flex gap-1 px-1 border-r border-zinc-800 mr-1">
                    @for (s of narrative.factionStandings(); track s.factionId) {
                        <div class="w-2 h-2 rounded-full shadow-[0_0_5px]" 
                             [style.background-color]="FACTIONS[s.factionId].color"
                             [title]="FACTIONS[s.factionId].name"></div>
                    }
                </div>

                <button (click)="openInventory.emit()" class="hud-btn group" title="Inventory">
                   <svg viewBox="0 0 24 24" class="hud-icon"><path [attr.d]="icons.INVENTORY"></path></svg>
                   <span class="hud-label">KIT</span>
                </button>
                <button (click)="openAbilities.emit()" class="hud-btn group" title="Abilities">
                   <svg viewBox="0 0 24 24" class="hud-icon"><path [attr.d]="icons.ABILITIES"></path></svg>
                   <span class="hud-label">PSI</span>
                </button>
                <button (click)="openSkills.emit()" class="hud-btn group relative" title="Skill Tree">
                   <svg viewBox="0 0 24 24" class="hud-icon"><path [attr.d]="icons.SKILLS"></path></svg>
                   <span class="hud-label">NET</span>
                   @if (skillTree.skillPoints() > 0) { <span class="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-bounce"></span> }
                </button>
                <button (click)="openCodex.emit()" class="hud-btn group" title="Codex">
                   <svg viewBox="0 0 24 24" class="hud-icon"><path [attr.d]="icons.CODEX"></path></svg>
                   <span class="hud-label">LOG</span>
                </button>
                <button (click)="openJournal.emit()" class="hud-btn group" title="Journal">
                   <svg viewBox="0 0 24 24" class="hud-icon"><path [attr.d]="icons.JOURNAL"></path></svg>
                   <span class="hud-label">OBJ</span>
                </button>
                <button (click)="mapService.toggleSettings()" class="hud-btn group" title="Settings">
                   <svg viewBox="0 0 24 24" class="hud-icon"><path [attr.d]="icons.SETTINGS"></path></svg>
                   <span class="hud-label">SYS</span>
                </button>
             </div>
          </div>
        </div>

        <!-- CENTER BOTTOM: MISSION TRACKER -->
        <div class="mt-auto mb-6 px-4 self-center max-w-lg w-full pointer-events-auto">
            <div class="bg-zinc-900/80 border border-zinc-800 p-2 backdrop-blur-sm relative group cursor-pointer" (click)="mission.cycleTracked()">
                <div class="absolute -top-px left-0 w-8 h-px bg-cyan-500"></div>
                <div class="text-[9px] text-zinc-500 uppercase tracking-[0.3em] mb-1 font-bold">Current Directive</div>
                <div class="text-white font-bold leading-tight" 
                     [style.font-size.rem]="0.75 * ui.uiScale()">
                    @if (mission.trackedMission(); as m) {
                        <app-glitch-text [text]="mission.missionText()" [intensity]="0.05"></app-glitch-text>
                    } @else {
                        <span class="text-zinc-600 italic">No Active Directive</span>
                    }
                </div>
                <div class="absolute bottom-1 right-2 text-[7px] text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity">CLICK TO CYCLE</div>
            </div>
        </div>
    </div>
  `,
  styles: [`
    .hud-btn {
        @apply w-10 h-10 bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center transition-all active:scale-95 hover:border-zinc-500 hover:bg-zinc-800;
    }
    .hud-icon {
        @apply w-5 h-5 fill-zinc-500 group-hover:fill-white transition-colors;
    }
    .hud-label {
        @apply text-[7px] text-zinc-600 font-bold uppercase group-hover:text-zinc-400;
    }
    .pt-safe { padding-top: env(safe-area-inset-top, 10px); }
    .pb-safe { padding-bottom: env(safe-area-inset-bottom, 10px); }
    .pl-safe { padding-left: env(safe-area-inset-left, 10px); }
    .pr-safe { padding-right: env(safe-area-inset-right, 10px); }
    .clip-path-slant { clip-path: polygon(0 0, 100% 0, 100% 85%, 85% 100%, 0 100%); }
  `]
})
export class HudComponent {
  mission = inject(MissionService);
  skillTree = inject(SkillTreeService);
  player = inject(PlayerService);
  world = inject(WorldService);
  mapService = inject(MapService);
  narrative = inject(NarrativeService);
  ui = inject(UiPanelService);
  interaction = inject(InteractionService);
  private eventBus = inject(EventBusService);
  private realityCorrector = inject(RealityCorrectorService);
  private proofKernel = inject(ProofKernelService);
  
  // New Injections
  private telemetry = inject(PerformanceTelemetryService);
  private adaptiveQuality = inject(AdaptiveQualityService);

  openInventory = output<void>();
  openSkills = output<void>();
  openAbilities = output<void>();
  openCodex = output<void>();
  openJournal = output<void>();
  openShop = output<void>();

  readonly Math = Math;
  readonly icons = ICONS;
  readonly FACTIONS = FACTIONS;

  realityIntegrity = signal(100);
  lastBleedMessage = signal<string | null>(null);

  constructor() {
      // Listen for Reality Bleed events to lower stability
      this.eventBus.on(GameEvents.REALITY_BLEED)
        .pipe(takeUntilDestroyed())
        .subscribe((payload: RealityBleedPayload) => {
            const drop = payload.severity === 'CRITICAL' ? 15 : (payload.severity === 'MEDIUM' ? 5 : 1);
            this.realityIntegrity.update(v => Math.max(0, v - drop));
            this.lastBleedMessage.set(`[${payload.source}] ${payload.message}`);
            
            setTimeout(() => this.lastBleedMessage.set(null), 3000);
        });
        
      // Recover Integrity slowly
      setInterval(() => {
          this.realityIntegrity.update(v => Math.min(100, v + 1));
      }, 1000);
  }

  getCorrectionStats() {
    return this.realityCorrector.getStats();
  }

  kernelDiagnostics() {
    return this.proofKernel.getDiagnostics();
  }

  // Performance monitoring integration
  getPerformanceStats() {
    return this.telemetry.getStats();
  }

  getCurrentQuality() {
    return this.adaptiveQuality.getPreset().name;
  }
}
