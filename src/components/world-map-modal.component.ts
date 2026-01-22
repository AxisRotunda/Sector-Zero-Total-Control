
import { Component, inject, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WaypointService } from '../game/world/waypoint.service';
import { ZoneManagerService } from '../game/world/zone-manager.service';
import { WORLD_GRAPH } from '../data/world/world-graph.config';
import { PlayerService } from '../game/player/player.service';

@Component({
  selector: 'app-world-map-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="absolute inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-12 animate-in fade-in" (touchstart)="$event.stopPropagation()">
        
        <div class="w-full max-w-4xl h-full md:h-[80vh] bg-zinc-950 border border-zinc-800 flex flex-col shadow-2xl relative overflow-hidden">
            
            <!-- HEADER -->
            <div class="p-6 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center shrink-0">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-cyan-900/20 border border-cyan-500/50 flex items-center justify-center rounded-full animate-pulse">
                        <span class="text-2xl">⚡</span>
                    </div>
                    <div>
                        <h2 class="text-2xl font-black text-white tracking-tighter uppercase">RIFT NETWORK</h2>
                        <div class="text-[10px] text-cyan-500 font-mono tracking-widest uppercase">Global Teleportation System</div>
                    </div>
                </div>
                <button (click)="close.emit()" class="px-6 py-2 bg-zinc-900 border border-zinc-700 hover:bg-red-900/40 hover:border-red-500 text-zinc-500 hover:text-white transition-all rounded-sm font-bold text-xs">
                    CLOSE UPLINK
                </button>
            </div>

            <!-- MAP CONTENT -->
            <div class="flex-1 flex overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed relative">
                <div class="absolute inset-0 bg-gradient-to-b from-black/80 to-black/40"></div>
                
                <!-- Zone List -->
                <div class="relative z-10 w-full p-8 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 content-start">
                    
                    @for (node of mapNodes(); track node.id) {
                        <button (click)="travel(node.id)" 
                                [disabled]="!node.unlocked && !node.isCurrent"
                                class="relative group p-6 border transition-all duration-300 flex flex-col items-start gap-2 overflow-hidden"
                                [class]="getNodeClasses(node)">
                            
                            <!-- Connecting Line (Visual) -->
                            <div class="absolute top-0 left-0 w-1 h-full transition-colors duration-300"
                                 [class]="node.isCurrent ? 'bg-green-500' : (node.unlocked ? 'bg-cyan-600 group-hover:bg-cyan-400' : 'bg-zinc-800')">
                            </div>

                            <div class="flex justify-between w-full items-start">
                                <span class="text-lg font-black uppercase tracking-tight">{{ node.name }}</span>
                                @if (node.isCurrent) {
                                    <span class="text-[9px] font-bold bg-green-900/50 text-green-400 px-2 py-1 rounded border border-green-800">CURRENT</span>
                                } @else if (node.unlocked) {
                                    <span class="text-[9px] font-bold text-cyan-500 group-hover:text-cyan-300">ACTIVE</span>
                                } @else {
                                    <span class="text-[9px] font-bold text-zinc-600">OFFLINE</span>
                                }
                            </div>
                            
                            <div class="text-xs font-mono opacity-70 text-left">{{ node.desc }}</div>
                            
                            <!-- Tech deco -->
                            <div class="absolute bottom-2 right-2 text-[8px] font-mono opacity-30">{{ node.id }}</div>
                        </button>
                    }

                </div>
            </div>

            <!-- PERSONAL RIFT (Footer) -->
            @if (waypoint.personalRift(); as rift) {
                @if (rift.active) {
                    <div class="p-4 border-t border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
                        <div class="flex flex-col">
                            <span class="text-xs font-bold text-purple-400 uppercase tracking-widest">Personal Rift Active</span>
                            <span class="text-[10px] text-zinc-500">Linked to: {{ rift.sourceZoneId }}</span>
                        </div>
                        <button (click)="travelToPersonal()" class="px-6 py-3 bg-purple-900/30 border border-purple-500 text-purple-200 font-bold hover:bg-purple-800 transition-colors uppercase tracking-widest text-xs">
                            Return to Rift
                        </button>
                    </div>
                }
            }
        </div>
    </div>
  `,
  styles: []
})
export class WorldMapModalComponent {
  waypoint = inject(WaypointService);
  zoneManager = inject(ZoneManagerService);
  player = inject(PlayerService);
  
  close = output<void>();

  mapNodes = computed(() => {
      const unlocked = this.waypoint.unlockedWaypoints();
      const current = this.player.currentSectorId();
      
      // Flatten graph for list display, filtering only zones with Riftgates (or hubs)
      return Object.values(WORLD_GRAPH.zones)
        .filter(z => z.template.metadata.hasRiftgate || z.id === 'HUB')
        .map(z => ({
            id: z.id,
            name: z.displayName,
            desc: z.template.name, // Subtitle
            unlocked: unlocked.has(z.id),
            isCurrent: current === z.id
        }))
        .sort((a, b) => a.unlocked === b.unlocked ? 0 : a.unlocked ? -1 : 1); // Unlocked first
  });

  getNodeClasses(node: any): string {
      if (node.isCurrent) return 'bg-green-900/10 border-green-800 text-green-100 cursor-default';
      if (node.unlocked) return 'bg-cyan-900/10 border-cyan-800 hover:border-cyan-500 text-cyan-100 hover:bg-cyan-900/20 cursor-pointer';
      return 'bg-zinc-950 border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50';
  }

  travel(zoneId: string) {
      if (this.player.currentSectorId() === zoneId) return;
      this.zoneManager.transitionToZone(zoneId);
      this.close.emit();
  }

  travelToPersonal() {
      const rift = this.waypoint.personalRift();
      if (rift) {
          // Pass specific coordinates for personal rift travel
          this.zoneManager.transitionToZone(rift.sourceZoneId, { x: rift.x, y: rift.y });
          this.close.emit();
      }
  }
}
