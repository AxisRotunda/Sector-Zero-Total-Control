
import { Component, inject, signal, computed, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NarrativeService } from '../game/narrative.service';
import { FACTIONS } from '../config/narrative.config';
import { DataLog, EntityLore } from '../models/narrative.models';
import { EntityPreviewComponent } from './entity-preview.component';

@Component({
  selector: 'app-codex',
  standalone: true,
  imports: [CommonModule, EntityPreviewComponent],
  template: `
    <div class="absolute inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 animate-in fade-in" (touchstart)="$event.stopPropagation()">
        
        <div class="w-full max-w-6xl h-[85vh] bg-zinc-950 border border-zinc-800 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
            
            <!-- TOP BAR -->
            <div class="p-6 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center shrink-0">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 bg-cyan-900/30 border border-cyan-500/50 flex items-center justify-center rounded-sm">
                        <svg viewBox="0 0 24 24" class="w-6 h-6 fill-cyan-400"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"></path></svg>
                    </div>
                    <div>
                        <h2 class="text-2xl font-black text-white tracking-tighter uppercase">CODEX</h2>
                        <div class="text-[10px] text-cyan-500 font-mono tracking-widest uppercase">Operative 7421 // Knowledge Base</div>
                    </div>
                </div>
                <button (click)="close.emit()" class="w-12 h-12 flex items-center justify-center bg-zinc-900 border border-zinc-700 hover:bg-red-900/40 hover:border-red-500 text-zinc-500 hover:text-white transition-all rounded-sm">
                    <svg viewBox="0 0 24 24" class="w-6 h-6 fill-current"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>
                </button>
            </div>

            <div class="flex-1 flex overflow-hidden">
                
                <!-- LEFT NAV -->
                <div class="w-20 md:w-64 border-r border-zinc-800 flex flex-col bg-zinc-900/20 shrink-0">
                    <div class="flex flex-col gap-1 p-2 md:p-4 flex-1">
                        <button (click)="activeTab.set('LOGS')" 
                                class="w-full flex items-center gap-3 p-3 transition-all relative group"
                                [class]="activeTab() === 'LOGS' ? 'bg-cyan-500/10 text-cyan-400' : 'text-zinc-500 hover:bg-zinc-800'">
                            @if (activeTab() === 'LOGS') { <div class="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500 shadow-[0_0_10px_#06b6d4]"></div> }
                            <span class="text-xl">📄</span>
                            <span class="text-xs font-bold tracking-widest uppercase hidden md:inline">DATA LOGS</span>
                        </button>
                        <button (click)="activeTab.set('BESTIARY')" 
                                class="w-full flex items-center gap-3 p-3 transition-all relative group"
                                [class]="activeTab() === 'BESTIARY' ? 'bg-red-500/10 text-red-400' : 'text-zinc-500 hover:bg-zinc-800'">
                            @if (activeTab() === 'BESTIARY') { <div class="absolute left-0 top-0 bottom-0 w-1 bg-red-500 shadow-[0_0_10px_#ef4444]"></div> }
                            <span class="text-xl">👾</span>
                            <span class="text-xs font-bold tracking-widest uppercase hidden md:inline">BESTIARY</span>
                        </button>
                        <button (click)="activeTab.set('DOSSIER')" 
                                class="w-full flex items-center gap-3 p-3 transition-all relative group"
                                [class]="activeTab() === 'DOSSIER' ? 'bg-purple-500/10 text-purple-400' : 'text-zinc-500 hover:bg-zinc-800'">
                            @if (activeTab() === 'DOSSIER') { <div class="absolute left-0 top-0 bottom-0 w-1 bg-purple-500 shadow-[0_0_10px_#a855f7]"></div> }
                            <span class="text-xl">👤</span>
                            <span class="text-xs font-bold tracking-widest uppercase hidden md:inline">DOSSIER</span>
                        </button>
                        <button (click)="activeTab.set('LOCATIONS')" 
                                class="w-full flex items-center gap-3 p-3 transition-all relative group"
                                [class]="activeTab() === 'LOCATIONS' ? 'bg-green-500/10 text-green-400' : 'text-zinc-500 hover:bg-zinc-800'">
                            @if (activeTab() === 'LOCATIONS') { <div class="absolute left-0 top-0 bottom-0 w-1 bg-green-500 shadow-[0_0_10px_#22c55e]"></div> }
                            <span class="text-xl">🌐</span>
                            <span class="text-xs font-bold tracking-widest uppercase hidden md:inline">GEOGRAPHY</span>
                        </button>
                        <button (click)="activeTab.set('FACTIONS')" 
                                class="w-full flex items-center gap-3 p-3 transition-all relative group"
                                [class]="activeTab() === 'FACTIONS' ? 'bg-orange-500/10 text-orange-400' : 'text-zinc-500 hover:bg-zinc-800'">
                            @if (activeTab() === 'FACTIONS') { <div class="absolute left-0 top-0 bottom-0 w-1 bg-orange-500 shadow-[0_0_10px_#f97316]"></div> }
                            <span class="text-xl">🚩</span>
                            <span class="text-xs font-bold tracking-widest uppercase hidden md:inline">FACTIONS</span>
                        </button>
                    </div>
                </div>

                <!-- MAIN AREA -->
                <div class="flex-1 flex overflow-hidden bg-black/40 relative">
                    
                    @if (activeTab() === 'LOGS') {
                        <!-- LOG LIST -->
                        <div class="w-48 md:w-80 border-r border-zinc-800 flex flex-col shrink-0">
                            <div class="p-3 bg-zinc-900/30 border-b border-zinc-800 text-[10px] font-mono text-zinc-500 uppercase tracking-widest text-center">
                                Discovered: {{ narrative.discoveredLogsList().length }}
                            </div>
                            <div class="flex-1 overflow-y-auto custom-scrollbar">
                                @for (log of narrative.discoveredLogsList(); track log.id) {
                                    <button (click)="selectedLog.set(log)"
                                            class="w-full p-4 border-b border-zinc-900 text-left transition-colors hover:bg-zinc-900/50 group"
                                            [class.bg-zinc-900]="selectedLog()?.id === log.id">
                                        <span class="text-[8px] font-mono text-zinc-600 uppercase tracking-widest">{{ log.category }}</span>
                                        <div class="text-sm font-bold truncate" [class]="selectedLog()?.id === log.id ? 'text-cyan-400' : 'text-zinc-400'">{{ log.title }}</div>
                                    </button>
                                }
                                @if (narrative.discoveredLogsList().length === 0) {
                                    <div class="p-8 text-center text-zinc-700 text-xs italic">No data logs found.</div>
                                }
                            </div>
                        </div>

                        <!-- LOG VIEWER -->
                        <div class="flex-1 flex flex-col bg-zinc-950 p-8 md:p-12 overflow-y-auto custom-scrollbar relative">
                            @if (selectedLog(); as log) {
                                <div class="max-w-2xl mx-auto space-y-6 animate-in fade-in">
                                    <div class="flex justify-between items-end border-b-2 border-cyan-900 pb-4 mb-8">
                                        <div>
                                            <h3 class="text-2xl md:text-3xl font-black text-white tracking-tighter italic">{{ log.title }}</h3>
                                            <div class="text-[10px] font-mono text-cyan-600 uppercase mt-1">ID: {{ log.id }} // CAT: {{ log.category }}</div>
                                        </div>
                                        <div class="text-right text-[10px] font-mono text-zinc-600">
                                            @if (log.author) { <div>AUTHOR: {{ log.author }}</div> }
                                            @if (log.timestamp) { <div>DATE: {{ log.timestamp }}</div> }
                                        </div>
                                    </div>
                                    @for (para of log.content; track $index) {
                                        <p class="text-zinc-400 font-mono text-base leading-relaxed mb-4">{{ para }}</p>
                                    }
                                </div>
                            } @else {
                                <div class="flex-1 flex flex-col items-center justify-center opacity-20 select-none">
                                    <div class="text-6xl mb-4">📄</div>
                                    <span class="text-sm font-bold tracking-[0.5em] text-zinc-500 uppercase">Select Log</span>
                                </div>
                            }
                        </div>
                    }

                    @if (activeTab() === 'LOCATIONS') {
                        <div class="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar">
                             <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                @for (zone of narrative.discoveredZonesList(); track zone.id) {
                                    <div class="bg-zinc-950 border border-zinc-800 p-6 flex flex-col gap-4 relative overflow-hidden group hover:border-green-500/50 transition-colors">
                                        
                                        <!-- Header -->
                                        <div class="flex justify-between items-start border-b border-zinc-800 pb-2 relative z-10">
                                            <h3 class="font-black text-xl text-white uppercase tracking-tighter">{{ zone.name }}</h3>
                                            <span class="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border"
                                                  [class.text-green-500]="zone.dangerLevel === 'SAFE'" [class.border-green-900]="zone.dangerLevel === 'SAFE'"
                                                  [class.text-yellow-500]="zone.dangerLevel === 'LOW'" [class.border-yellow-900]="zone.dangerLevel === 'LOW'"
                                                  [class.text-orange-500]="zone.dangerLevel === 'MEDIUM'" [class.border-orange-900]="zone.dangerLevel === 'MEDIUM'"
                                                  [class.text-red-500]="zone.dangerLevel === 'HIGH'" [class.border-red-900]="zone.dangerLevel === 'HIGH'">
                                                {{ zone.dangerLevel }}
                                            </span>
                                        </div>

                                        <p class="text-sm text-zinc-400 font-mono leading-relaxed relative z-10">{{ zone.description }}</p>
                                        
                                        <div class="mt-auto pt-2 flex justify-between items-center text-[10px] font-mono text-zinc-600 relative z-10">
                                            <span>ID: {{ zone.id }}</span>
                                            <span class="uppercase">Control: {{ zone.factionControl }}</span>
                                        </div>

                                        <!-- Background Scanlines -->
                                        <div class="absolute inset-0 pointer-events-none opacity-5 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,#fff_3px)]"></div>
                                    </div>
                                }
                                @if (narrative.discoveredZonesList().length === 0) {
                                    <div class="col-span-full flex flex-col items-center justify-center p-12 opacity-50">
                                        <div class="text-4xl mb-4">🌐</div>
                                        <div class="text-sm font-mono uppercase">No sectors mapped.</div>
                                    </div>
                                }
                             </div>
                        </div>
                    }

                    @if (activeTab() === 'BESTIARY' || activeTab() === 'DOSSIER') {
                        <!-- ENTITY LIST -->
                        <div class="w-48 md:w-80 border-r border-zinc-800 flex flex-col shrink-0">
                            <div class="p-3 bg-zinc-900/30 border-b border-zinc-800 text-[10px] font-mono text-zinc-500 uppercase tracking-widest text-center">
                                Database: {{ getFilteredEntities().length }} Entries
                            </div>
                            <div class="flex-1 overflow-y-auto custom-scrollbar">
                                @for (entity of getFilteredEntities(); track entity.id) {
                                    <button (click)="selectedEntity.set(entity)"
                                            class="w-full p-4 border-b border-zinc-900 text-left transition-colors hover:bg-zinc-900/50 group"
                                            [class.bg-zinc-900]="selectedEntity()?.id === entity.id">
                                        <span class="text-[8px] font-mono text-zinc-600 uppercase tracking-widest">{{ entity.type }}</span>
                                        <div class="text-sm font-bold truncate" [class]="selectedEntity()?.id === entity.id ? 'text-purple-400' : 'text-zinc-400'">{{ entity.name }}</div>
                                    </button>
                                }
                                @if (getFilteredEntities().length === 0) {
                                    <div class="p-8 text-center text-zinc-700 text-xs italic">
                                        No entries in this category.
                                    </div>
                                }
                            </div>
                        </div>

                        <!-- ENTITY VIEWER -->
                        <div class="flex-1 flex flex-col bg-zinc-950 p-8 md:p-12 overflow-y-auto custom-scrollbar relative">
                            @if (selectedEntity(); as entity) {
                                <div class="max-w-2xl mx-auto space-y-6 animate-in fade-in w-full">
                                    <!-- Header -->
                                    <div class="flex items-start gap-6 border-b border-zinc-800 pb-6">
                                        <div class="w-32 h-32 bg-zinc-900 border border-zinc-700 flex items-center justify-center shrink-0 shadow-lg overflow-hidden relative">
                                            <app-entity-preview [type]="entity.id"></app-entity-preview>
                                        </div>
                                        <div class="flex-1">
                                            <h3 class="text-3xl font-black text-white tracking-tighter uppercase">{{ entity.name }}</h3>
                                            <div class="flex gap-2 mt-2">
                                                <span class="text-[10px] bg-purple-900/30 text-purple-400 px-2 py-1 border border-purple-900/50 rounded font-bold uppercase">{{ entity.type }}</span>
                                                @if(entity.stats?.threat) {
                                                    <span class="text-[10px] px-2 py-1 border rounded font-bold uppercase"
                                                          [class.text-green-500]="entity.stats?.threat === 'LOW'"
                                                          [class.text-yellow-500]="entity.stats?.threat === 'MEDIUM'"
                                                          [class.text-orange-500]="entity.stats?.threat === 'HIGH'"
                                                          [class.text-red-500]="entity.stats?.threat === 'EXTREME'"
                                                          [class.bg-red-900-20]="entity.stats?.threat === 'EXTREME'">
                                                        Threat: {{ entity.stats?.threat }}
                                                    </span>
                                                }
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Description -->
                                    <div class="bg-zinc-900/20 p-6 border-l-2 border-zinc-700">
                                        <p class="text-zinc-300 leading-relaxed font-mono text-sm">{{ entity.description }}</p>
                                    </div>

                                    <!-- Tactics -->
                                    @if(entity.tactics) {
                                        <div>
                                            <h4 class="text-xs font-bold text-orange-500 uppercase tracking-widest mb-2">Tactical Analysis</h4>
                                            <p class="text-zinc-400 font-mono text-sm">{{ entity.tactics }}</p>
                                        </div>
                                    }

                                    <!-- Stats Table -->
                                    @if(entity.stats?.hp) {
                                        <div class="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-900">
                                            <div>
                                                <div class="text-[9px] text-zinc-600 uppercase tracking-widest">Resilience</div>
                                                <div class="text-white font-mono">{{ entity.stats?.hp }}</div>
                                            </div>
                                        </div>
                                    }
                                </div>
                            } @else {
                                <div class="flex-1 flex flex-col items-center justify-center opacity-20 select-none">
                                    <div class="text-6xl mb-4">🔍</div>
                                    <span class="text-sm font-bold tracking-[0.5em] text-zinc-500 uppercase">Select Entity</span>
                                </div>
                            }
                        </div>
                    }

                    @if (activeTab() === 'FACTIONS') {
                        <div class="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar">
                             <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                @for (standing of narrative.factionStandings(); track standing.factionId) {
                                    @let f = FACTIONS[standing.factionId];
                                    <div class="bg-zinc-900/30 border border-zinc-800 p-6 rounded-sm flex flex-col gap-4 relative overflow-hidden group hover:border-zinc-600 transition-colors"
                                         [style.border-top-color]="f.color"
                                         style="border-top-width: 4px;">
                                        
                                        <!-- Decorative BG -->
                                        <div class="absolute inset-0 opacity-5 pointer-events-none" 
                                             [style.background-image]="'radial-gradient(circle at top right, ' + f.color + ', transparent 70%)'"></div>

                                        <div class="flex items-center gap-4 border-b border-zinc-800 pb-4 relative z-10">
                                            <div class="w-14 h-14 flex items-center justify-center bg-black border border-zinc-700 text-3xl shadow-lg" [style.color]="f.color">{{ f.icon }}</div>
                                            <div>
                                                <h3 class="font-bold text-xl text-white leading-tight uppercase tracking-tight">{{ f.name }}</h3>
                                                <span class="text-[10px] font-bold uppercase tracking-widest bg-black/60 px-2 py-0.5 rounded" [style.color]="f.color">{{ standing.standing }}</span>
                                            </div>
                                        </div>
                                        <p class="text-xs text-zinc-500 leading-relaxed italic border-l-2 border-zinc-800 pl-3">"{{ f.ideology }}"</p>
                                        <p class="text-sm text-zinc-400 font-mono leading-relaxed">{{ f.description }}</p>
                                        
                                        <div class="mt-auto pt-4 space-y-2 relative z-10">
                                            <div class="flex justify-between text-[10px] font-mono font-bold">
                                                <span class="text-zinc-500 uppercase tracking-widest">Influence</span>
                                                <span [style.color]="f.color">{{ standing.value }} / 100</span>
                                            </div>
                                            <div class="h-2 w-full bg-black border border-zinc-800 rounded-full overflow-hidden">
                                                <div class="h-full transition-all duration-500 relative" 
                                                     [style.width.%]="(standing.value + 100) / 2"
                                                     [style.background-color]="f.color">
                                                     <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                }
                             </div>
                        </div>
                    }

                </div>
            </div>
            
            <div class="absolute inset-0 pointer-events-none opacity-[0.03] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,#fff_3px)]"></div>
        </div>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #09090b; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 4px; }
  `]
})
export class CodexComponent {
  narrative = inject(NarrativeService);
  FACTIONS = FACTIONS;
  activeTab = signal<'LOGS' | 'FACTIONS' | 'BESTIARY' | 'DOSSIER' | 'LOCATIONS'>('LOGS');
  selectedLog = signal<DataLog | null>(null);
  selectedEntity = signal<EntityLore | null>(null);
  close = output<void>();

  getFilteredEntities() {
      const all = this.narrative.discoveredEntityList();
      if (this.activeTab() === 'BESTIARY') return all.filter(e => e.type === 'ENEMY');
      if (this.activeTab() === 'DOSSIER') return all.filter(e => e.type === 'NPC' || e.type === 'OBJECT');
      return [];
  }
}
