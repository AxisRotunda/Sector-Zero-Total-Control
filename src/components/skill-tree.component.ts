
import { Component, inject, output, signal, effect, ElementRef, ViewChild, OnDestroy, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkillTreeService, SkillNode, BranchType } from '../game/skill-tree.service';
import { select, zoom, zoomIdentity } from 'd3';

@Component({
  selector: 'app-skill-tree',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="absolute inset-0 z-50 bg-[#020617] flex overflow-hidden animate-in fade-in duration-300 font-mono" (touchstart)="$event.stopPropagation()">
        
        <!-- CANVAS AREA -->
        <div class="flex-1 relative overflow-hidden h-full w-full" #d3Container>
             <!-- D3 SVG will be injected here -->
        </div>

        <!-- HUD OVERLAY -->
        <div class="absolute top-4 left-4 z-10 pointer-events-none">
            <h1 class="text-3xl font-black text-white tracking-tighter drop-shadow-[0_0_10px_rgba(0,0,0,0.8)]">NEURAL <span class="text-cyan-500">MATRIX</span></h1>
            <div class="flex items-center gap-3 mt-2 bg-black/80 backdrop-blur px-4 py-2 border-l-4 border-orange-500 rounded-r-lg shadow-lg">
                <div class="flex flex-col">
                    <span class="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Neural Capacity</span>
                    <span class="text-2xl font-black text-white font-mono leading-none">{{ skillTree.skillPoints() }} <span class="text-xs text-orange-500 align-top">PTS</span></span>
                </div>
            </div>
        </div>
        
        <!-- EXIT BUTTON (GLOBAL) -->
        <button (click)="close.emit()" class="absolute top-4 right-4 z-30 w-12 h-12 bg-red-900/20 hover:bg-red-900/80 border border-red-900 hover:border-red-500 text-red-500 hover:text-white rounded-sm flex items-center justify-center transition-all group backdrop-blur-sm pointer-events-auto">
            <svg viewBox="0 0 24 24" class="w-6 h-6 fill-current"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>
        </button>

        <!-- SIDE PANEL -->
        <div class="w-full md:w-96 h-[60vh] md:h-full bg-zinc-950/95 border-t md:border-t-0 md:border-l border-zinc-800 backdrop-blur-xl flex flex-col shadow-2xl z-20 transition-transform duration-300 absolute bottom-0 md:right-0 md:top-0"
             [class.translate-y-full]="!selectedNode() && !isPanelOpen"
             [class.md:translate-x-full]="!selectedNode() && !isPanelOpen"
             [class.translate-y-0]="selectedNode() || isPanelOpen"
             [class.md:translate-x-0]="selectedNode() || isPanelOpen">
             
             <button class="absolute -top-10 right-4 md:hidden text-white bg-zinc-800 p-2 rounded-t-lg border-t border-x border-zinc-700 font-bold text-xs tracking-widest" (click)="selectedNode.set(null); isPanelOpen=false">
                ▼ HIDE INFO
             </button>

             @if (selectedNode(); as node) {
                 <div class="p-6 flex-1 overflow-y-auto custom-scrollbar">
                     <!-- Header -->
                     <div class="flex items-center gap-4 mb-6 relative overflow-hidden p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                         <div class="absolute inset-0 opacity-20 bg-gradient-to-br from-transparent to-black" [style.background-color]="getBranchColor(node.branch)"></div>
                         <div class="w-16 h-16 rounded-lg flex items-center justify-center text-3xl shadow-lg border border-zinc-700 bg-zinc-900 relative z-10">
                             <svg viewBox="0 0 24 24" class="w-10 h-10 fill-current text-white"><path [attr.d]="node.iconPath"></path></svg>
                         </div>
                         <div class="relative z-10">
                             <div class="text-[10px] font-bold uppercase tracking-widest mb-1" [style.color]="getBranchColor(node.branch)">{{ node.branch }} SEQUENCE</div>
                             <h2 class="text-xl font-bold text-white leading-tight mb-1">{{ node.name }}</h2>
                             <div class="text-[10px] text-zinc-500 font-mono">{{ node.type }} NODE // ID: {{ node.id }}</div>
                         </div>
                     </div>

                     <!-- Stats -->
                     <div class="bg-zinc-900/30 rounded p-4 border-l-2 border-zinc-700 mb-6">
                         <h3 class="text-[10px] font-bold text-zinc-500 uppercase mb-2">Neural Modification</h3>
                         <div class="text-sm text-cyan-400 font-bold font-mono">{{ node.description }}</div>
                     </div>

                     <!-- Lore -->
                     @if (node.lore) {
                         <div class="mb-6 italic text-zinc-600 text-xs pl-3 border-l border-zinc-800 leading-relaxed">
                             "{{ node.lore }}"
                         </div>
                     }

                     <!-- Action Bar -->
                     <div class="mt-auto pt-4 border-t border-zinc-800">
                         @if (!node.allocated) {
                             <button (click)="allocate(node)" 
                                     [disabled]="!node.available || skillTree.skillPoints() < 1"
                                     class="w-full py-4 text-sm font-bold tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-2 group relative overflow-hidden rounded-sm border"
                                     [class]="node.available && skillTree.skillPoints() > 0 ? 'bg-cyan-900/50 hover:bg-cyan-800 border-cyan-500 text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'">
                                 @if (node.available && skillTree.skillPoints() > 0) {
                                     <div class="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                                     <span>Initialize UPLINK</span>
                                 } @else {
                                     <span>Unavailable</span>
                                 }
                             </button>
                         } @else {
                             <div class="w-full py-4 text-center text-xs font-bold text-zinc-500 bg-zinc-950 border border-zinc-900 cursor-default tracking-[0.2em]">
                                 // COMPLETED //
                             </div>
                         }
                     </div>
                 </div>
             }
        </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #09090b; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 4px; }
  `]
})
export class SkillTreeComponent implements AfterViewInit, OnDestroy {
  skillTree = inject(SkillTreeService);
  close = output<void>();
  
  @ViewChild('d3Container') containerRef!: ElementRef<HTMLDivElement>;

  selectedNode = signal<SkillNode | null>(null);
  isPanelOpen = false;

  private svg: any;
  private g: any;
  private zoom: any;
  
  constructor() {
      effect(() => {
          const nodes = this.skillTree.nodes();
          if (this.g) {
              this.updateGraph(nodes);
          }
      });
  }

  getBranchColor(branch: BranchType): string {
      switch(branch) {
          case 'VANGUARD': return '#f97316'; // Orange
          case 'GHOST': return '#06b6d4'; // Cyan
          case 'PSION': return '#a855f7'; // Purple
          default: return '#71717a'; // Zinc
      }
  }

  selectNode(node: SkillNode) {
      this.selectedNode.set(node);
      this.isPanelOpen = true;
      this.updateGraph(this.skillTree.nodes());
  }

  allocate(node: SkillNode) {
      this.skillTree.allocate(node.id);
  }

  ngAfterViewInit() {
      // Use requestAnimationFrame to ensure the flex container has calculated its dimensions
      requestAnimationFrame(() => {
          this.initGraph();
          this.updateGraph(this.skillTree.nodes());
      });
  }

  @HostListener('window:resize')
  onResize() {
      if(this.svg) this.svg.remove();
      this.initGraph();
      this.updateGraph(this.skillTree.nodes());
  }

  ngOnDestroy() {
      if (this.svg) {
          this.svg.remove();
      }
  }

  private initGraph() {
      const container = this.containerRef.nativeElement;
      const width = container.clientWidth || window.innerWidth; // Fallback
      const height = container.clientHeight || window.innerHeight;

      if (width === 0 || height === 0) return;

      this.svg = select(container).append('svg')
          .attr('width', '100%')
          .attr('height', '100%')
          .attr('viewBox', [-width / 2, -height / 2, width, height])
          .style('background-color', '#020617')
          .style('cursor', 'grab');

      // Grid Pattern
      const defs = this.svg.append('defs');
      const pattern = defs.append('pattern')
          .attr('id', 'grid')
          .attr('width', 40)
          .attr('height', 40)
          .attr('patternUnits', 'userSpaceOnUse');
      pattern.append('path')
          .attr('d', 'M 40 0 L 0 0 0 40')
          .attr('fill', 'none')
          .attr('stroke', '#1e293b')
          .attr('stroke-width', 1);

      this.g = this.svg.append('g');
      
      // Grid Background Rect
      this.g.append('rect')
          .attr('width', 10000)
          .attr('height', 10000)
          .attr('x', -5000)
          .attr('y', -5000)
          .attr('fill', 'url(#grid)')
          .style('opacity', 0.2)
          .style('pointer-events', 'none');

      this.zoom = zoom()
          .scaleExtent([0.2, 2])
          .on('zoom', (event: any) => {
              this.g.attr('transform', event.transform);
          });

      this.svg.call(this.zoom)
          .call(this.zoom.transform, zoomIdentity.translate(0, 0).scale(1));
  }

  private updateGraph(nodes: SkillNode[]) {
      if (!this.g) return;

      // 1. Prepare Links
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      const links: any[] = [];
      nodes.forEach(n => {
          n.connections.forEach(targetId => {
              const target = nodeMap.get(targetId);
              if (target) {
                  if (n.id < target.id) links.push({ source: n, target: target });
              }
          });
      });

      // 2. Draw Links
      const linkSelection = this.g.selectAll('.link')
          .data(links, (d: any) => d.source.id + '-' + d.target.id);

      linkSelection.exit().remove();

      const linkEnter = linkSelection.enter().append('path')
          .attr('class', 'link')
          .attr('fill', 'none')
          .attr('stroke-width', 2)
          .attr('stroke-linecap', 'round');

      linkSelection.merge(linkEnter)
          .attr('d', (d: any) => {
              const dx = d.target.x - d.source.x;
              const dy = d.target.y - d.source.y;
              const dr = Math.sqrt(dx * dx + dy * dy) * 2; 
              return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
          })
          .transition().duration(500)
          .attr('stroke', (d: any) => {
              if (d.source.allocated && d.target.allocated) {
                  if (d.source.branch === d.target.branch && d.source.branch !== 'NEUTRAL') 
                      return this.getBranchColor(d.source.branch);
                  return '#ffffff';
              }
              return '#1e293b';
          })
          .attr('stroke-dasharray', (d: any) => (d.source.allocated && d.target.allocated) ? 'none' : '4 4')
          .style('filter', (d: any) => (d.source.allocated && d.target.allocated) ? 'drop-shadow(0 0 5px currentColor)' : 'none');


      // 3. Draw Nodes
      const nodeSelection = this.g.selectAll('.node')
          .data(nodes, (d: SkillNode) => d.id);

      nodeSelection.exit().remove();

      const nodeEnter = nodeSelection.enter().append('g')
          .attr('class', 'node')
          .style('cursor', 'pointer')
          .on('click', (event: any, d: SkillNode) => {
              event.stopPropagation();
              this.selectNode(d);
          });

      nodeEnter.append('circle')
          .attr('r', (d: SkillNode) => d.type === 'KEYSTONE' ? 25 : (d.type === 'MAJOR' ? 15 : 10))
          .attr('fill', '#000')
          .attr('stroke-width', 2);

      nodeEnter.append('path')
          .attr('d', (d: SkillNode) => d.iconPath)
          .attr('transform', (d: SkillNode) => {
              const scale = d.type === 'KEYSTONE' ? 1.2 : (d.type === 'MAJOR' ? 0.8 : 0.5);
              return `translate(-12, -12) scale(${scale})`;
          })
          .attr('fill', '#fff')
          .style('pointer-events', 'none');

      const nodesMerge = nodeSelection.merge(nodeEnter);
      
      nodesMerge.transition().duration(500)
          .attr('transform', (d: SkillNode) => `translate(${d.x}, ${d.y})`);

      nodesMerge.select('circle')
          .transition().duration(500)
          .attr('stroke', (d: SkillNode) => {
              if (d.allocated) return this.getBranchColor(d.branch);
              if (d.available) return '#71717a';
              return '#27272a';
          })
          .attr('fill', (d: SkillNode) => d.allocated ? '#09090b' : '#000');

      nodesMerge.select('path')
          .transition().duration(500)
          .attr('fill', (d: SkillNode) => {
              if (d.allocated) return this.getBranchColor(d.branch);
              if (d.available) return '#71717a';
              return '#27272a';
          });
      
      this.g.selectAll('.halo').remove();
      if (this.selectedNode()) {
          const s = this.selectedNode()!;
          this.g.insert('circle', '.node')
              .attr('class', 'halo')
              .attr('cx', s.x)
              .attr('cy', s.y)
              .attr('r', 40)
              .attr('fill', 'none')
              .attr('stroke', '#ffffff')
              .attr('stroke-width', 1)
              .attr('stroke-dasharray', '5 5')
              .style('opacity', 0.5)
              .style('pointer-events', 'none');
      }
  }
}
