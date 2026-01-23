
import { Component, ElementRef, Input, ViewChild, inject, AfterViewInit, OnDestroy, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorldService } from '../game/world/world.service';
import { MapService } from '../services/map.service';
import { Entity } from '../models/game.models';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative overflow-hidden rounded-lg shadow-xl border border-zinc-700 bg-black cursor-crosshair group"
         [class.w-full]="mode === 'FULL'" [class.h-full]="mode === 'FULL'"
         [class.w-48]="mode === 'MINI'" [class.h-48]="mode === 'MINI'"
         [style.opacity]="mode === 'MINI' ? mapService.settings().miniMapOpacity : mapService.settings().fullMapOpacity"
         (mousedown)="onMouseDown($event)"
         (mousemove)="onMouseMove($event)"
         (mouseup)="onMouseUp()"
         (mouseleave)="onMouseUp()"
         (wheel)="onWheel($event)"
         (touchstart)="onTouchStart($event)"
         (touchmove)="onTouchMove($event)"
         (touchend)="onTouchEnd()"
         (dblclick)="onDoubleClick($event)">
         
         <canvas #mapCanvas class="block w-full h-full"></canvas>
         
         <!-- TOOLTIP (Hover info) -->
         @if (hoverInfo()) {
             <div class="absolute bg-zinc-900/90 border border-zinc-500 px-2 py-1 rounded text-[10px] text-white pointer-events-none z-50 whitespace-nowrap shadow-lg backdrop-blur-sm"
                  [style.left.px]="hoverInfo()!.x + 10" [style.top.px]="hoverInfo()!.y + 10">
                 {{ hoverInfo()!.text }}
             </div>
         }

         <!-- Overlay Info (Mini Only) -->
         @if (mode === 'MINI') {
             <div class="absolute bottom-1 left-0 right-0 text-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                 <span class="text-[9px] font-mono text-cyan-500 bg-black/60 px-1 rounded">{{ playerCoords() }}</span>
             </div>
         }
         
         <!-- Overlay Controls (Full Only) -->
         @if (mode === 'FULL') {
             <div class="absolute top-4 right-4 flex gap-2 pointer-events-auto">
                 <button (click)="mapService.toggleFullMap()" class="px-4 py-2 bg-red-900/80 text-white font-bold border border-red-500 rounded hover:bg-red-800 shadow-lg text-xs tracking-widest">CLOSE MAP</button>
             </div>
             
             <!-- Legend -->
             <div class="absolute top-4 left-4 bg-black/80 border border-zinc-700 p-2 rounded pointer-events-none">
                 <div class="text-[9px] font-bold text-zinc-500 uppercase mb-1 tracking-widest border-b border-zinc-800 pb-1">Legend</div>
                 <div class="flex flex-col gap-1 text-[9px] font-mono">
                     <div class="flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-[#06b6d4]"></div><span>Player</span></div>
                     <div class="flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-[#fbbf24] animate-pulse"></div><span>Objective</span></div>
                     <div class="flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-[#ef4444]"></div><span>Hostile</span></div>
                     <div class="flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-[#eab308]"></div><span>Trader</span></div>
                     <div class="flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-[#22c55e]"></div><span>Exit</span></div>
                 </div>
             </div>

             <div class="absolute bottom-8 left-0 right-0 text-center pointer-events-none flex flex-col gap-1 items-center">
                 <span class="text-xs font-mono text-cyan-400 bg-black/80 px-4 py-2 rounded border border-cyan-900 shadow-lg">TACTICAL OVERVIEW // SECTOR {{ world.currentZone().name }}</span>
                 <span class="text-[9px] text-zinc-500 bg-black/50 px-2 rounded backdrop-blur-sm">DOUBLE CLICK TO MARK • DRAG TO PAN • SCROLL TO ZOOM</span>
             </div>
         }
    </div>
  `,
  styles: [`:host { display: block; pointer-events: auto; }`]
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @Input() mode: 'MINI' | 'FULL' = 'MINI';
  @ViewChild('mapCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  world = inject(WorldService);
  mapService = inject(MapService);
  
  private ctx: CanvasRenderingContext2D | null = null;
  private animationId: number = 0;
  
  // Full Map Interaction State
  private viewX = 0;
  private viewY = 0;
  private viewZoom = 0.08;
  private isDragging = false;
  private lastDragX = 0;
  private lastDragY = 0;
  private pinchDist = 0;
  
  hoverInfo = signal<{x: number, y: number, text: string} | null>(null);
  playerCoords = signal('0, 0');

  ngAfterViewInit() {
    this.ctx = this.canvasRef.nativeElement.getContext('2d');
    this.viewX = this.world.player.x;
    this.viewY = this.world.player.y;
    this.resize();
    this.loop();
  }

  ngOnDestroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }

  private resize() {
      if (!this.canvasRef) return;
      const canvas = this.canvasRef.nativeElement;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      if (this.ctx) this.ctx.scale(dpr, dpr);
  }

  // --- Interaction Handlers ---

  onMouseDown(e: MouseEvent) {
      if (this.mode !== 'FULL') return;
      this.isDragging = true;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
  }

  onMouseMove(e: MouseEvent) {
      // Tooltip Logic
      if (this.mode === 'FULL') {
          const rect = this.canvasRef.nativeElement.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          
          const cx = rect.width / 2;
          const cy = rect.height / 2;
          
          const wx = this.viewX + (mx - cx) / this.viewZoom;
          const wy = this.viewY + (my - cy) / this.viewZoom;
          
          let found = null;
          
          // Check Objective Markers first
          for (const m of this.mapService.objectiveMarkers()) {
              if (Math.hypot(m.x - wx, m.y - wy) < 60) {
                  found = m.label;
                  break;
              }
          }

          // Check User markers
          if (!found) {
              for (const m of this.mapService.markers()) {
                  if (Math.hypot(m.x - wx, m.y - wy) < 50) {
                      found = m.label || "Marker";
                      break;
                  }
              }
          }
          // Check entities
          if (!found) {
              for (const en of this.world.entities) {
                  if (this.mapService.isChunkVisited(en.x, en.y) && Math.hypot(en.x - wx, en.y - wy) < (en.radius + 20)) {
                      if (en.type === 'NPC') found = en.subType || "Unknown Contact";
                      else if (en.type === 'EXIT') found = en.exitType === 'DOWN' ? "Sector Descent" : "Sector Ascent";
                      else if (en.type === 'ENEMY') found = "Hostile Signal";
                      else if (en.type === 'SHRINE') found = "Energy Signature";
                      if (found) break;
                  }
              }
          }
          
          if (found) {
              this.hoverInfo.set({ x: mx, y: my, text: found });
          } else {
              this.hoverInfo.set(null);
          }
      }

      if (this.mode !== 'FULL' || !this.isDragging) return;
      const dx = e.clientX - this.lastDragX;
      const dy = e.clientY - this.lastDragY;
      
      this.viewX -= dx / this.viewZoom;
      this.viewY -= dy / this.viewZoom;
      
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
  }

  onMouseUp() {
      this.isDragging = false;
  }

  onWheel(e: WheelEvent) {
      if (this.mode !== 'FULL') return;
      e.preventDefault();
      const zoomSpeed = 0.001;
      this.viewZoom = Math.max(0.02, Math.min(0.5, this.viewZoom - e.deltaY * zoomSpeed));
  }

  onDoubleClick(e: MouseEvent) {
      if (this.mode !== 'FULL') {
          this.mapService.toggleFullMap();
          return;
      }
      
      const canvas = this.canvasRef.nativeElement;
      const rect = canvas.getBoundingClientRect();
      const cx = canvas.width / (2 * (window.devicePixelRatio || 1));
      const cy = canvas.height / (2 * (window.devicePixelRatio || 1));
      
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const screenDx = mouseX - cx;
      const screenDy = mouseY - cy;
      
      const worldDx = screenDx / this.viewZoom;
      const worldDy = screenDy / this.viewZoom;
      
      const worldX = this.viewX + worldDx;
      const worldY = this.viewY + worldDy;
      
      const existing = this.mapService.markers().find(m => Math.hypot(m.x - worldX, m.y - worldY) < 100);
      if (existing) {
          this.mapService.removeMarkerAt(worldX, worldY, 100);
      } else {
          this.mapService.addMarker(worldX, worldY, '#eab308', 'Waypoint');
      }
  }

  onTouchStart(e: TouchEvent) {
      if (this.mode !== 'FULL') return;
      if (e.touches.length === 1) {
          this.isDragging = true;
          this.lastDragX = e.touches[0].clientX;
          this.lastDragY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
          this.isDragging = false;
          this.pinchDist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
          );
      }
  }

  onTouchMove(e: TouchEvent) {
      if (this.mode !== 'FULL') return;
      e.preventDefault();
      
      if (e.touches.length === 1 && this.isDragging) {
          const dx = e.touches[0].clientX - this.lastDragX;
          const dy = e.touches[0].clientY - this.lastDragY;
          this.viewX -= dx / this.viewZoom;
          this.viewY -= dy / this.viewZoom;
          this.lastDragX = e.touches[0].clientX;
          this.lastDragY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
          const newDist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
          );
          const diff = newDist - this.pinchDist;
          this.viewZoom = Math.max(0.02, Math.min(0.5, this.viewZoom + diff * 0.001));
          this.pinchDist = newDist;
      }
  }

  onTouchEnd() {
      this.isDragging = false;
  }

  private loop = () => {
      this.render();
      this.animationId = requestAnimationFrame(this.loop);
  }

  private render() {
      if (!this.ctx || !this.canvasRef) return;
      const canvas = this.canvasRef.nativeElement;
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);
      const settings = this.mapService.settings();
      const player = this.world.player;
      const zone = this.world.currentZone();
      
      this.ctx.clearRect(0, 0, w, h);
      this.ctx.save();
      this.ctx.translate(w/2, h/2);
      
      let zoom = settings.miniMapZoom;
      let focusX = player.x;
      let focusY = player.y;
      let rotation = 0;

      // In Isometric Projection:
      // X Axis points Down-Right
      // Y Axis points Down-Left
      // "North" is Y- (Up-Right)
      // "South" is Y+ (Down-Left)
      // "West" is X- (Up-Left)
      // "East" is X+ (Down-Right)

      if (this.mode === 'FULL') {
          zoom = this.viewZoom;
          focusX = this.viewX;
          focusY = this.viewY;
          rotation = 0;
      } else {
          if (settings.rotateMiniMap) {
              // Rotate map so Player Angle faces UP (-PI/2)
              // Player Angle 0 is East (Right)
              // To make angle 0 face Up (-PI/2), we rotate by -PI/2
              // Map needs to rotate opposite to player
              rotation = -player.angle - Math.PI/2;
          }
      }

      this.ctx.scale(zoom, zoom);
      this.ctx.rotate(rotation);
      this.ctx.translate(-focusX, -focusY);
      
      // Grid
      this.ctx.strokeStyle = `rgba(6, 182, 212, ${settings.gridOpacity})`;
      this.ctx.lineWidth = 1 / zoom;
      const gridSize = 500;
      
      const startX = Math.floor((focusX - (w/zoom)) / gridSize) * gridSize;
      const endX = Math.floor((focusX + (w/zoom)) / gridSize) * gridSize;
      const startY = Math.floor((focusY - (h/zoom)) / gridSize) * gridSize;
      const endY = Math.floor((focusY + (h/zoom)) / gridSize) * gridSize;

      this.ctx.beginPath();
      for (let x = startX; x <= endX; x += gridSize) {
          this.ctx.moveTo(x, startY); this.ctx.lineTo(x, endY);
      }
      for (let y = startY; y <= endY; y += gridSize) {
          this.ctx.moveTo(startX, y); this.ctx.lineTo(endX, y);
      }
      this.ctx.stroke();

      for (const e of this.world.entities) {
          if (!this.mapService.isChunkVisited(e.x, e.y)) continue;
          
          if (e.type === 'WALL') {
              this.ctx.fillStyle = '#1f1f22';
              if (e.width && e.height) {
                   this.ctx.fillRect(e.x - e.width/2, e.y - e.height/2, e.width, e.height);
                   this.ctx.strokeStyle = zone.wallColor;
                   this.ctx.lineWidth = 2 / zoom;
                   this.ctx.strokeRect(e.x - e.width/2, e.y - e.height/2, e.width, e.height);
              } else {
                   this.ctx.beginPath();
                   this.ctx.arc(e.x, e.y, e.radius, 0, Math.PI*2);
                   this.ctx.fill();
              }
          }
          
          if (e.type === 'DECORATION' && (e.subType === 'RUG' || e.subType === 'HOLO_TABLE' || e.subType === 'GRAFFITI')) {
               // Render Labels if they exist (e.g., GRAFFITI with text data)
               if (e.data?.label) {
                   this.ctx.fillStyle = '#fff';
                   this.ctx.font = `bold 32px monospace`;
                   this.ctx.textAlign = 'center';
                   this.ctx.save();
                   this.ctx.translate(e.x, e.y);
                   this.ctx.scale(1/zoom, 1/zoom);
                   this.ctx.fillText(e.data.label, 0, 0);
                   this.ctx.restore();
               }

               if (e.subType === 'RUG') {
                   this.ctx.fillStyle = zone.detailColor;
                   this.ctx.globalAlpha = 0.2;
                   if (e.width && e.height) {
                       this.ctx.fillRect(e.x - e.width/2, e.y - e.height/2, e.width, e.height);
                   }
                   this.ctx.globalAlpha = 1.0;
               }
          }
          
          if (e.type === 'EXIT') {
              const color = e.exitType === 'DOWN' ? '#22c55e' : '#f97316';
              this.ctx.fillStyle = color;
              this.ctx.beginPath();
              this.ctx.arc(e.x, e.y, e.radius * 1.5, 0, Math.PI*2);
              this.ctx.fill();
              
              this.ctx.fillStyle = '#000';
              this.ctx.textAlign = 'center';
              this.ctx.textBaseline = 'middle';
              this.ctx.save();
              this.ctx.translate(e.x, e.y);
              this.ctx.scale(1.5/zoom, 1.5/zoom); 
              this.ctx.font = `bold 14px monospace`; 
              this.ctx.fillText(e.exitType === 'DOWN' ? 'EXIT' : 'UP', 0, 0);
              this.ctx.restore();
          }

          if (e.type === 'NPC') {
              const color = e.subType === 'MEDIC' ? '#ef4444' : e.subType === 'TRADER' ? '#eab308' : '#3b82f6';
              this.ctx.fillStyle = color;
              this.ctx.beginPath();
              this.ctx.arc(e.x, e.y, 30, 0, Math.PI*2);
              this.ctx.fill();
              
              let char = '?';
              if (e.subType === 'MEDIC') char = '+';
              if (e.subType === 'TRADER') char = '$';
              if (e.subType === 'HANDLER') char = '!';
              
              this.ctx.fillStyle = '#fff';
              this.ctx.textAlign = 'center';
              this.ctx.textBaseline = 'middle';
              this.ctx.save();
              this.ctx.translate(e.x, e.y);
              this.ctx.scale(1.5/zoom, 1.5/zoom);
              this.ctx.font = 'bold 12px monospace';
              this.ctx.fillText(char, 0, 0);
              this.ctx.restore();
          }
      }

      if (settings.showTrail && player.trail) {
          this.ctx.beginPath();
          this.ctx.strokeStyle = '#06b6d4';
          this.ctx.lineWidth = 2 / zoom;
          this.ctx.globalAlpha = 0.5;
          let first = true;
          for (const p of player.trail) {
              if (first) { this.ctx.moveTo(p.x, p.y); first = false; }
              else { this.ctx.lineTo(p.x, p.y); }
          }
          this.ctx.stroke();
          this.ctx.globalAlpha = 1.0;
      }

      // Draw User Markers
      if (settings.showMarkers) {
          for (const m of this.mapService.markers()) {
              this.drawMarker(m, zoom);
          }
      }
      
      // Draw Objective Markers (Always visible, overrides settings)
      for (const m of this.mapService.objectiveMarkers()) {
          this.drawObjectiveMarker(m, zoom);
      }

      if (settings.showEnemyRadar) {
          for (const e of this.world.entities) {
              if (e.type === 'ENEMY' && e.state !== 'DEAD') {
                  const dist = Math.hypot(e.x - player.x, e.y - player.y);
                  if (dist < 800 || this.mapService.isChunkVisited(e.x, e.y)) {
                      this.ctx.fillStyle = '#ef4444';
                      if (e.subType === 'BOSS') this.ctx.fillStyle = '#b91c1c';
                      this.ctx.beginPath();
                      this.ctx.arc(e.x, e.y, e.subType === 'BOSS' ? 40 : 20, 0, Math.PI*2);
                      this.ctx.fill();
                  }
              }
          }
      }

      // PLAYER ICON
      this.ctx.save();
      this.ctx.translate(player.x, player.y);
      this.ctx.rotate(player.angle);
      
      // Field of View Cone
      this.ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
      this.ctx.beginPath();
      this.ctx.moveTo(0,0);
      this.ctx.arc(0,0, 400, -Math.PI/4, Math.PI/4); // 90 degree cone
      this.ctx.closePath();
      this.ctx.fill();

      // Drone Body
      this.ctx.fillStyle = '#06b6d4'; 
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 2 / zoom;
      
      this.ctx.beginPath();
      this.ctx.moveTo(15, 0);
      this.ctx.lineTo(-10, 10);
      this.ctx.lineTo(-5, 0);
      this.ctx.lineTo(-10, -10);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
      
      this.ctx.restore();

      // RESTORE TO SCREEN SPACE FOR HUD ELEMENTS (Compass)
      this.ctx.restore();
      
      // COMPASS RENDERER
      this.drawCompass(w, h, rotation);

      // Update UI coords signal to ensure stability for template binding
      const coords = `${Math.round(player.x)}, ${Math.round(player.y)}`;
      if (this.playerCoords() !== coords) {
          this.playerCoords.set(coords);
      }
  }

  private drawCompass(w: number, h: number, rotation: number) {
      if (!this.ctx) return;
      const r = Math.min(w, h) * 0.4; // Radius from center to place letters
      
      this.ctx.save();
      this.ctx.translate(w/2, h/2);
      
      // Font settings
      this.ctx.font = 'bold 12px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      const cardinals = [
          { text: 'N', angle: -Math.PI / 2, color: '#ef4444' }, // North (Up)
          { text: 'E', angle: 0, color: '#fff' },               // East (Right)
          { text: 'S', angle: Math.PI / 2, color: '#fff' },     // South (Down)
          { text: 'W', angle: Math.PI, color: '#fff' }          // West (Left)
      ];

      // In Map Space (Cartesian): 
      // North is Y- ( -PI/2 in Canvas coords? No, Canvas Y+ is Down. So Y- is Up. Angle -PI/2)
      // We applied rotation to the world context earlier. 
      // Now we are in Screen Space. 
      // If the map rotated by `R`, then "North" on the screen is at angle `-PI/2 + R`.
      
      cardinals.forEach(card => {
          // Calculate screen angle for this cardinal direction
          // World Angle + Map Rotation
          // Note: In our World Coords, North is Y-. West is X-.
          // Y- is -90 deg. 
          // World North is strictly Y-.
          // If player rotates, map rotates opposite.
          
          let worldAngle = 0;
          if (card.text === 'N') worldAngle = -Math.PI/2; // Up
          if (card.text === 'S') worldAngle = Math.PI/2;  // Down
          if (card.text === 'E') worldAngle = 0;          // Right
          if (card.text === 'W') worldAngle = Math.PI;    // Left
          
          // Apply map rotation to the cardinal position
          const screenAngle = worldAngle + rotation;
          
          const lx = Math.cos(screenAngle) * (r - 15);
          const ly = Math.sin(screenAngle) * (r - 15);
          
          this.ctx!.fillStyle = card.color;
          this.ctx!.fillText(card.text, lx, ly);
          
          // Draw small tick
          const tx = Math.cos(screenAngle) * (r - 5);
          const ty = Math.sin(screenAngle) * (r - 5);
          
          this.ctx!.beginPath();
          this.ctx!.arc(tx, ty, 2, 0, Math.PI*2);
          this.ctx!.fill();
      });

      this.ctx.restore();
  }

  private drawMarker(m: any, zoom: number) {
      if (!this.ctx) return;
      this.ctx.fillStyle = m.color;
      this.ctx.beginPath();
      this.ctx.moveTo(m.x, m.y);
      this.ctx.lineTo(m.x - 10/zoom, m.y - 25/zoom);
      this.ctx.lineTo(m.x + 10/zoom, m.y - 25/zoom);
      this.ctx.fill();
      
      if (m.label) {
          this.ctx.fillStyle = '#fff';
          this.ctx.save();
          this.ctx.translate(m.x, m.y - 30/zoom);
          this.ctx.scale(1/zoom, 1/zoom);
          this.ctx.font = `12px monospace`;
          this.ctx.fillText(m.label, 0, 0);
          this.ctx.restore();
      }
  }

  private drawObjectiveMarker(m: any, zoom: number) {
      if (!this.ctx) return;
      // Pulse effect
      const t = Date.now() / 500;
      const r = (15 + Math.sin(t) * 5) / zoom;
      
      this.ctx.save();
      this.ctx.strokeStyle = m.color;
      this.ctx.lineWidth = 3 / zoom;
      this.ctx.beginPath();
      this.ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
      this.ctx.stroke();
      
      this.ctx.fillStyle = m.color;
      this.ctx.beginPath();
      this.ctx.arc(m.x, m.y, 8 / zoom, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Draw Label Background
      if (m.label) {
          this.ctx.font = `bold 12px monospace`;
          this.ctx.save();
          this.ctx.translate(m.x, m.y - 30/zoom);
          this.ctx.scale(1/zoom, 1/zoom);
          
          const textWidth = this.ctx.measureText(m.label).width;
          this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
          this.ctx.fillRect(-textWidth/2 - 4, -10, textWidth + 8, 14);
          
          this.ctx.fillStyle = '#fff';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(m.label, 0, 0);
          this.ctx.restore();
      }
      this.ctx.restore();
  }
}
