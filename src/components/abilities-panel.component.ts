
import { Component, inject, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerAbilitiesService } from '../game/player/player-abilities.service';
import { PlayerStatsService } from '../game/player/player-stats.service';
import { ICONS } from '../config/icons.config';

@Component({
  selector: 'app-abilities-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center animate-in fade-in p-4" (touchstart)="$event.stopPropagation()">
        
        <div class="w-full max-w-4xl h-[85vh] bg-zinc-950 border border-zinc-700 flex flex-col shadow-2xl relative overflow-hidden">
            
             <!-- Header -->
            <div class="p-5 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center shrink-0 relative z-20">
                <div>
                    <h2 class="text-2xl font-black text-white tracking-tighter uppercase">COMBAT PROTOCOLS</h2>
                    <div class="text-[10px] text-purple-400 font-mono tracking-widest uppercase">Neural Link Status: ACTIVE</div>
                </div>
                <button (click)="close.emit()" class="w-10 h-10 flex items-center justify-center border border-zinc-700 hover:bg-red-900/50 hover:border-red-500 text-zinc-500 hover:text-white transition-all">
                    ✕
                </button>
            </div>

            <!-- Content Grid -->
            <div class="flex-1 overflow-y-auto p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 custom-scrollbar bg-black/40 relative z-10">
                
                @for (skill of skills(); track skill.id) {
                    <div class="bg-zinc-900/80 border border-zinc-800 p-4 flex flex-col gap-4 group hover:border-purple-500/50 transition-colors relative overflow-hidden rounded-sm shadow-lg">
                        
                        <div class="flex items-start justify-between relative z-10">
                            <div class="w-14 h-14 rounded bg-zinc-950 border border-zinc-700 flex items-center justify-center shadow-lg group-hover:border-purple-500 transition-colors relative">
                                <svg viewBox="0 0 24 24" class="w-8 h-8 fill-current text-white"><path [attr.d]="skill.iconPath"></path></svg>
                                <div class="absolute -bottom-2 -right-2 bg-zinc-800 border border-zinc-600 text-[8px] font-bold text-white px-2 py-0.5 rounded shadow">
                                    {{skill.slotName}}
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-[9px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Status</div>
                                <div class="text-[10px] font-mono font-bold flex items-center justify-end gap-1" [class.text-green-500]="skill.ready" [class.text-red-500]="!skill.ready">
                                    <span class="w-2 h-2 rounded-full" [class.bg-green-500]="skill.ready" [class.bg-red-500]="!skill.ready" [class.animate-pulse]="skill.ready"></span>
                                    {{ skill.ready ? 'ONLINE' : 'RECHARGING' }}
                                </div>
                            </div>
                        </div>

                        <div class="relative z-10 flex-1">
                            <h3 class="text-lg font-black text-white mb-1 group-hover:text-purple-400 transition-colors leading-none uppercase">{{skill.name}}</h3>
                            <p class="text-[11px] text-zinc-400 leading-relaxed mb-4 min-h-[3rem] mt-2">{{skill.desc}}</p>

                            <div class="space-y-1 bg-black/40 p-2 rounded border border-zinc-800/50 font-mono text-[10px]">
                                <div class="flex justify-between">
                                    <span class="text-zinc-500">COOLDOWN</span>
                                    <span class="text-zinc-300 font-bold">{{skill.cooldownMax / 60 | number:'1.1-1'}}s</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-zinc-500">PSI COST</span>
                                    <span class="text-cyan-400 font-bold">{{skill.cost}}</span>
                                </div>
                                @if (skill.damage > 0) {
                                    <div class="flex justify-between border-t border-zinc-800 pt-1 mt-1">
                                        <span class="text-zinc-500">OUTPUT</span>
                                        <span class="text-orange-400 font-bold">{{skill.damage | number:'1.0-0'}}</span>
                                    </div>
                                }
                            </div>
                        </div>

                        <div class="mt-auto pt-4 relative z-10">
                            <div class="w-full py-1.5 bg-zinc-800 border border-zinc-600 text-center text-[9px] font-bold tracking-[0.2em] text-zinc-300 uppercase">
                                EQUIPPED: {{skill.slotName}}
                            </div>
                        </div>

                        <div class="absolute -right-10 -bottom-10 w-40 h-40 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-2xl group-hover:bg-purple-500/20 transition-colors pointer-events-none"></div>
                    </div>
                }

                @if (skills().length === 0) {
                    <div class="col-span-full flex flex-col items-center justify-center p-12 text-zinc-600">
                        <div class="text-4xl mb-4">⚠</div>
                        <div class="text-sm font-mono uppercase tracking-widest">No Active Protocols Found</div>
                    </div>
                }

            </div>
            
            <div class="p-4 bg-zinc-900 border-t border-zinc-800 flex justify-around text-center text-xs font-mono shrink-0 relative z-20">
                <div>
                    <div class="text-zinc-500 uppercase tracking-widest text-[9px] mb-1">Total Psyche</div>
                    <div class="text-purple-400 font-bold text-lg">{{stats.playerStats().psyche}}</div>
                </div>
                <div>
                    <div class="text-zinc-500 uppercase tracking-widest text-[9px] mb-1">Psi Energy</div>
                    <div class="text-cyan-400 font-bold text-lg">{{stats.psionicEnergy() | number:'1.0-0'}} / {{stats.maxPsionicEnergy() | number:'1.0-0'}}</div>
                </div>
            </div>

        </div>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #09090b; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52525b; }
  `]
})
export class AbilitiesPanelComponent {
  abilities = inject(PlayerAbilitiesService);
  stats = inject(PlayerStatsService);
  close = output<void>();

  skills = computed(() => {
    const s = this.stats.playerStats();
    const cd = this.abilities.cooldowns();
    const maxCd = this.abilities.maxCooldowns();
    
    return [
        {
            id: 'primary',
            name: 'Kinetic Strike',
            iconPath: ICONS.KINETIC,
            slotName: 'PRIMARY',
            desc: 'Standard melee engagement. Scales with weapon damage.',
            cost: 0,
            damage: s.damage,
            cooldownMax: maxCd.primary,
            ready: cd.primary <= 0
        },
        {
            id: 'secondary',
            name: 'Psionic Blast',
            iconPath: ICONS.BLAST,
            slotName: 'ABILITY 1 (E)',
            desc: 'Unleashes a radial wave of force.',
            cost: 50,
            damage: 15 + s.psyche * 2,
            cooldownMax: maxCd.secondary,
            ready: cd.secondary <= 0
        },
        {
            id: 'dash',
            name: 'Phase Shift',
            iconPath: ICONS.DASH,
            slotName: 'DASH (SHIFT)',
            desc: 'Rapid movement displacement.',
            cost: 0,
            damage: 0,
            cooldownMax: maxCd.dash,
            ready: cd.dash <= 0
        },
        {
            id: 'utility',
            name: 'Stasis Field',
            iconPath: ICONS.STASIS,
            slotName: 'ABILITY 2 (R)',
            desc: 'Disrupts synaptic firing.',
            cost: 35,
            damage: 20 + s.psyche * 1.5,
            cooldownMax: maxCd.utility,
            ready: cd.utility <= 0
        }
    ];
  });
}
