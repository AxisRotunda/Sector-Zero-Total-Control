
import { Component, inject, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MissionService, Mission } from '../game/mission.service';

@Component({
  selector: 'app-mission-journal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="absolute inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 animate-in fade-in" (touchstart)="$event.stopPropagation()">
        
        <div class="w-full max-w-5xl h-[85vh] bg-zinc-950 border border-zinc-800 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
            
            <!-- HEADER -->
            <div class="p-6 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center shrink-0 relative z-20">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-amber-900/30 border border-amber-500/50 flex items-center justify-center rounded-sm">
                        <span class="text-2xl">⚡</span>
                    </div>
                    <div>
                        <h2 class="text-2xl font-black text-white tracking-tighter uppercase">DIRECTIVES</h2>
                        <div class="text-[10px] text-amber-500 font-mono tracking-widest uppercase">Mission Control // Active Logs</div>
                    </div>
                </div>
                <button (click)="close.emit()" class="w-12 h-12 flex items-center justify-center bg-zinc-900 border border-zinc-700 hover:bg-red-900/40 hover:border-red-500 text-zinc-500 hover:text-white transition-all rounded-sm">
                    ✕
                </button>
            </div>

            <!-- TABS -->
            <div class="flex border-b border-zinc-800 bg-zinc-900/20 shrink-0">
                <button (click)="filter.set('ACTIVE')" class="flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-colors relative"
                        [class]="filter() === 'ACTIVE' ? 'text-amber-400 bg-amber-900/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'">
                    Active Directives
                    @if (filter() === 'ACTIVE') { <div class="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500 shadow-[0_0_10px_#f59e0b]"></div> }
                </button>
                <button (click)="filter.set('COMPLETED')" class="flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-colors relative"
                        [class]="filter() === 'COMPLETED' ? 'text-green-400 bg-green-900/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'">
                    Completed Logs
                    @if (filter() === 'COMPLETED') { <div class="absolute bottom-0 left-0 w-full h-0.5 bg-green-500 shadow-[0_0_10px_#22c55e]"></div> }
                </button>
            </div>

            <!-- CONTENT -->
            <div class="flex-1 flex overflow-hidden bg-black/40">
                
                <!-- LIST -->
                <div class="w-1/3 min-w-[200px] border-r border-zinc-800 overflow-y-auto custom-scrollbar flex flex-col">
                    @for (m of filteredMissions(); track m.id) {
                        <button (click)="selectedMission.set(m)"
                                class="p-4 border-b border-zinc-900 text-left transition-all hover:bg-zinc-900/50 group relative overflow-hidden"
                                [class.bg-zinc-900]="selectedMission()?.id === m.id">
                            
                            <!-- Selection Marker -->
                            @if (selectedMission()?.id === m.id) {
                                <div class="absolute left-0 top-0 bottom-0 w-1" [class]="m.state === 'COMPLETE' ? 'bg-green-500' : 'bg-amber-500'"></div>
                            }

                            <div class="flex justify-between items-start mb-1">
                                <span class="text-[9px] font-mono font-bold tracking-widest uppercase"
                                      [class]="getCategoryColor(m.category)">
                                    {{ m.category }}
                                </span>
                                @if (m.state === 'COMPLETE') {
                                    <span class="text-[9px] text-green-500 font-bold">DONE</span>
                                }
                            </div>
                            <div class="text-sm font-bold text-zinc-300 group-hover:text-white truncate">{{ m.title }}</div>
                        </button>
                    }
                    @if (filteredMissions().length === 0) {
                        <div class="p-8 text-center text-zinc-600 text-xs italic">No directives found.</div>
                    }
                </div>

                <!-- DETAILS -->
                <div class="flex-1 flex flex-col p-8 overflow-y-auto custom-scrollbar bg-zinc-950/50 relative">
                    @if (selectedMission(); as m) {
                        <div class="max-w-2xl mx-auto w-full animate-in fade-in slide-in-from-right-4">
                            
                            <!-- Title Block -->
                            <div class="border-b-2 pb-4 mb-6 flex justify-between items-end"
                                 [style.border-color]="m.state === 'COMPLETE' ? '#22c55e' : '#f59e0b'">
                                <div>
                                    <h3 class="text-3xl font-black text-white tracking-tighter uppercase leading-none mb-2">{{ m.title }}</h3>
                                    <div class="font-mono text-xs" [style.color]="m.state === 'COMPLETE' ? '#22c55e' : '#f59e0b'">ID: {{ m.id }}</div>
                                </div>
                                <div class="text-right">
                                    <div class="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Status</div>
                                    <div class="font-bold text-lg" [style.color]="m.state === 'COMPLETE' ? '#22c55e' : '#f59e0b'">
                                        {{ m.state }}
                                    </div>
                                </div>
                            </div>

                            <!-- Description -->
                            <div class="bg-zinc-900/30 p-6 border-l-2 border-zinc-700 mb-8">
                                <p class="text-zinc-300 font-mono text-sm leading-relaxed">{{ m.description }}</p>
                            </div>

                            <!-- Objectives -->
                            <h4 class="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Operational Objectives</h4>
                            <div class="space-y-3 mb-8">
                                @for (obj of m.objectives; track $index) {
                                    <div class="bg-black border border-zinc-800 p-3 flex items-center justify-between">
                                        <div class="flex items-center gap-3">
                                            <div class="w-4 h-4 border flex items-center justify-center"
                                                 [class]="obj.currentAmount >= obj.targetAmount ? 'border-green-500 bg-green-900/20' : 'border-zinc-600'">
                                                @if (obj.currentAmount >= obj.targetAmount) { <span class="text-[10px] text-green-500">✓</span> }
                                            </div>
                                            <span class="text-sm font-mono" [class]="obj.currentAmount >= obj.targetAmount ? 'text-zinc-500 line-through' : 'text-zinc-300'">
                                                {{ obj.description }}
                                            </span>
                                        </div>
                                        <span class="text-xs font-bold font-mono" [class]="obj.currentAmount >= obj.targetAmount ? 'text-green-500' : 'text-amber-500'">
                                            {{ obj.currentAmount }} / {{ obj.targetAmount }}
                                        </span>
                                    </div>
                                }
                            </div>

                            <!-- Rewards -->
                            <h4 class="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Contract Rewards</h4>
                            <div class="flex gap-4">
                                <div class="bg-zinc-900 border border-zinc-700 px-4 py-2 flex flex-col items-center min-w-[80px]">
                                    <span class="text-[9px] text-zinc-500 uppercase">Credits</span>
                                    <span class="text-yellow-500 font-bold font-mono">{{ m.rewardCredits }}</span>
                                </div>
                                <div class="bg-zinc-900 border border-zinc-700 px-4 py-2 flex flex-col items-center min-w-[80px]">
                                    <span class="text-[9px] text-zinc-500 uppercase">XP</span>
                                    <span class="text-purple-500 font-bold font-mono">{{ m.rewardXp }}</span>
                                </div>
                                @if (m.factionRep) {
                                    <div class="bg-zinc-900 border border-zinc-700 px-4 py-2 flex flex-col items-center min-w-[80px]">
                                        <span class="text-[9px] text-zinc-500 uppercase">Reputation</span>
                                        <span class="text-cyan-500 font-bold font-mono">{{ m.factionRep.factionId }} +{{ m.factionRep.amount }}</span>
                                    </div>
                                }
                            </div>

                        </div>
                    } @else {
                        <div class="flex-1 flex flex-col items-center justify-center opacity-20 select-none">
                            <div class="text-6xl mb-4 grayscale">⚡</div>
                            <span class="text-sm font-bold tracking-[0.5em] text-zinc-500 uppercase">Select Directive</span>
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
export class MissionJournalComponent {
  missionService = inject(MissionService);
  close = output<void>();
  
  filter = signal<'ACTIVE' | 'COMPLETED'>('ACTIVE');
  selectedMission = signal<Mission | null>(null);

  filteredMissions = computed(() => {
      const all = this.missionService.activeMissions(); 
      const completedIds = this.missionService.completedMissionIds();
      
      if (this.filter() === 'ACTIVE') {
          return all.filter(m => m.state === 'ACTIVE');
      } else {
          // Note: MissionService currently removes completed missions from activeMissions list
          // and stores IDs in a Set. To show them fully, MissionService would need to persist completed mission objects.
          // For now, we show missions marked as 'COMPLETE' that haven't been removed/claimed yet, 
          // or we iterate activeMissions looking for 'COMPLETE' state.
          // Given the current implementation of `claimReward` removing them, we might only see active ones.
          // Feature improvement: Assume MissionService might keep them in a history list in a future update.
          // For now, let's just filter activeMissions for 'COMPLETE' state if any linger.
          return all.filter(m => m.state === 'COMPLETE' || m.state === 'CLAIMED');
      }
  });

  getCategoryColor(cat: string) {
      if (cat === 'MAIN') return 'text-amber-500';
      if (cat === 'SIDE') return 'text-cyan-500';
      return 'text-zinc-500';
  }
}
