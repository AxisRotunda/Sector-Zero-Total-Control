
import { Component, inject, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerAbilitiesService } from '../game/player/player-abilities.service';
import { PlayerStatsService } from '../game/player/player-stats.service';
import * as BALANCE from '../config/balance.config';

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
                
                <!-- Skill Card Template -->
                @for (skill of skills(); track skill.id) {
                    <div class="bg-zinc-900/80 border border-zinc-800 p-4 flex flex-col gap-4 group hover:border-purple-500/50 transition-colors relative overflow-hidden rounded-sm shadow-lg">
                        
                        <!-- Header -->
                        <div class="flex items-start justify-between relative z-10">
                            <div class="w-14 h-14 rounded bg-zinc-950 border border-zinc-700 flex items-center justify-center shadow-lg group-hover:border-purple-500 transition-colors relative">
                                <svg viewBox="0 0 24 24" class="w-8 h-8 fill-current text-white"><path [attr.d]="skill.iconPath"></path></svg>
                                <!-- Slot Indicator -->
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

                        <!-- Info -->
                        <div class="relative z-10 flex-1">
                            <h3 class="text-lg font-black text-white mb-1 group-hover:text-purple-400 transition-colors leading-none uppercase">{{skill.name}}</h3>
                            <p class="text-[11px] text-zinc-400 leading-relaxed mb-4 min-h-[3rem] mt-2">{{skill.desc}}</p>

                            <!-- Stats -->
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

                        <!-- Equip Controls (Visual Only for now as requested) -->
                        <div class="mt-auto pt-4 relative z-10">
                            <div class="w-full py-1.5 bg-zinc-800 border border-zinc-600 text-center text-[9px] font-bold tracking-[0.2em] text-zinc-300 uppercase">
                                EQUIPPED: {{skill.slotName}}
                            </div>
                        </div>

                        <!-- Lore -->
                        <div class="mt-2 pt-2 border-t border-zinc-800/50 relative z-10">
                            <p class="text-[9px] italic text-zinc-600">"{{skill.lore}}"</p>
                        </div>

                        <!-- Background decoration -->
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
            
            <!-- Footer Stats -->
            <div class="p-4 bg-zinc-900 border-t border-zinc-800 flex justify-around text-center text-xs font-mono shrink-0 relative z-20">
                <div>
                    <div class="text-zinc-500 uppercase tracking-widest text-[9px] mb-1">Total Psyche</div>
                    <div class="text-purple-400 font-bold text-lg">{{stats.playerStats().psyche}}</div>
                </div>
                <div>
                    <div class="text-zinc-500 uppercase tracking-widest text-[9px] mb-1">Cooldown Reduction</div>
                    <div class="text-blue-400 font-bold text-lg">{{stats.playerStats().cdr}}%</div>
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

  // SVG Paths
  icons = {
      sword: "M2.81 18.17l8.48-8.48 5.66 5.66-8.48 8.48zM19.78 2.81l1.41 1.41-2.12 2.12-1.41-1.41z M14.12 8.46l-4.24 4.24-1.41-1.41 4.24-4.24z",
      blast: "M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm0 2c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 4c2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4 1.79-4 4-4z",
      dash: "M4 12l8-8v6h8v4h-8v6z",
      stasis: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
      overload: "M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 16h2v2h-2zm0-6h2v4h-2z"
  };

  skills = computed(() => {
    const s = this.stats.playerStats();
    const cd = this.abilities.cooldowns();
    const maxCd = this.abilities.maxCooldowns();
    
    // Calculate dynamic values
    const primaryDmg = s.damage;
    const secDmg = 15 + s.psyche * 2;
    const utilHp = 20 + s.psyche * 1.5;
    const overloadDmg = 100 + s.psyche * 5;

    return [
        {
            id: 'primary',
            name: 'Kinetic Strike',
            iconPath: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
            slotName: 'PRIMARY',
            desc: 'Standard melee engagement. Scales with weapon damage and physical stats.',
            lore: 'Muscle memory augmented by combat subroutines.',
            cost: 0,
            damage: primaryDmg,
            cooldownMax: maxCd.primary,
            ready: cd.primary <= 0
        },
        {
            id: 'secondary',
            name: 'Psionic Blast',
            iconPath: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z",
            slotName: 'ABILITY 1 (E)',
            desc: 'Unleashes a radial wave of force, damaging and knocking back enemies.',
            lore: 'Telekinetic projection of pure will.',
            cost: 50,
            damage: secDmg,
            cooldownMax: maxCd.secondary,
            ready: cd.secondary <= 0
        },
        {
            id: 'dash',
            name: 'Phase Shift',
            iconPath: "M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z",
            slotName: 'DASH (SHIFT)',
            desc: 'Rapid movement displacement to evade attacks or close gaps.',
            lore: 'Momentary overclock of leg servos.',
            cost: 0,
            damage: 0,
            cooldownMax: maxCd.dash,
            ready: cd.dash <= 0
        },
        {
            id: 'utility',
            name: 'Stasis Field',
            iconPath: "M7 2v11h3v9l7-12h-4l4-8z",
            slotName: 'ABILITY 2 (R)',
            desc: 'Creates a localized field that stuns and weakens enemies caught inside.',
            lore: 'Disrupts synaptic firing in biological targets.',
            cost: 35,
            damage: utilHp, 
            cooldownMax: maxCd.utility,
            ready: cd.utility <= 0
        },
        {
            id: 'overload',
            name: 'Neural Overload',
            iconPath: "M12 2c-4.97 0-9 4.03-9 9 0 4.97 4.03 9 9 9s9-4.03 9-9c0-4.97-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7zm1-11h-2v6h2V7zm0 8h-2v2h2v-2z",
            slotName: 'ULTIMATE',
            desc: 'Consumes ALL energy to trigger a massive explosion. Stuns self briefly.',
            lore: 'Safety limiters disengaged. Brain bleed imminent.',
            cost: this.stats.psionicEnergy(),
            damage: overloadDmg,
            cooldownMax: 0,
            ready: this.stats.psionicEnergy() >= this.stats.maxPsionicEnergy()
        }
    ];
  });
}
