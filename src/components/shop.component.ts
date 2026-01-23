
import { Component, inject, output, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShopService } from '../services/shop.service';
import { InventoryService } from '../game/inventory.service';
import { PlayerProgressionService } from '../game/player/player-progression.service';
import { ItemIconComponent } from './item-icon.component';
import { GlitchTextComponent } from './glitch-text.component';
import { Item } from '../models/item.models';
import { HapticService } from '../services/haptic.service';
import { NarrativeService } from '../game/narrative.service';

type MobileView = 'MERCHANT' | 'PLAYER';
type InventoryMode = 'SELL' | 'SALVAGE';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [CommonModule, ItemIconComponent, GlitchTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="absolute inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center animate-in fade-in p-0 md:p-4" (touchstart)="$event.stopPropagation()">
        
        <div class="w-full max-w-6xl h-full md:h-[85vh] bg-zinc-950 border-x-0 md:border md:border-zinc-800 flex flex-col shadow-2xl relative overflow-hidden">
            
            <!-- HEADER -->
            <div class="p-4 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center shrink-0 relative z-20">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 border flex items-center justify-center text-xl font-black bg-black"
                         [style.border-color]="factionColor()" [style.color]="factionColor()">
                         {{ factionInitial() }}
                    </div>
                    <div>
                        <h2 class="text-xl md:text-2xl font-black text-white tracking-tighter uppercase flex items-center gap-2">
                            <span [style.color]="factionColor()">{{ shop.currentFaction() }}</span> EXCHANGE
                        </h2>
                        <div class="text-[9px] text-zinc-500 font-mono tracking-widest uppercase">
                            Market Volatility: <span [class.text-red-500]="isVolatile()" [class.text-green-500]="!isVolatile()">{{ volatilityLabel() }}</span>
                        </div>
                    </div>
                </div>
                
                <div class="flex items-center gap-4">
                    <!-- Resources -->
                    <div class="flex flex-col items-end mr-2">
                        <div class="flex items-center gap-2 text-xs font-mono font-bold">
                            <span class="text-yellow-500">{{ progression.credits() }} CR</span>
                            <span class="text-zinc-600">|</span>
                            <span class="text-zinc-400">{{ progression.scrap() }} SCRAP</span>
                        </div>
                    </div>

                    <button (click)="close.emit()" class="w-10 h-10 flex items-center justify-center border border-zinc-700 hover:bg-red-900/50 hover:border-red-500 text-zinc-500 hover:text-white transition-all">
                        ✕
                    </button>
                </div>
            </div>

            <!-- MOBILE TABS -->
            <div class="flex md:hidden border-b border-zinc-800 shrink-0">
                <button (click)="mobileView.set('MERCHANT')" class="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors border-b-2"
                        [style.border-color]="mobileView() === 'MERCHANT' ? factionColor() : 'transparent'"
                        [class.bg-zinc-900]="mobileView() === 'MERCHANT'"
                        [class.text-white]="mobileView() === 'MERCHANT'"
                        [class.text-zinc-500]="mobileView() !== 'MERCHANT'">
                    Requisition
                </button>
                <button (click)="mobileView.set('PLAYER')" class="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors border-b-2"
                        [class.border-zinc-500]="mobileView() === 'PLAYER'"
                        [class.border-transparent]="mobileView() !== 'PLAYER'"
                        [class.bg-zinc-900]="mobileView() === 'PLAYER'"
                        [class.text-white]="mobileView() === 'PLAYER'"
                        [class.text-zinc-500]="mobileView() !== 'PLAYER'">
                    Inventory
                </button>
            </div>

            <!-- CONTENT AREA -->
            <div class="flex-1 flex overflow-hidden relative">
                
                <!-- MERCHANT PANEL (Left) -->
                <div class="flex-1 flex flex-col bg-zinc-900/10 border-r border-zinc-800 transition-all duration-300"
                     [class.hidden]="isMobile() && mobileView() !== 'MERCHANT'"
                     [class.block]="!isMobile() || mobileView() === 'MERCHANT'">
                    
                    <div class="p-3 bg-black/40 border-b border-zinc-800 text-center flex justify-between items-center md:justify-center shrink-0">
                        <span class="text-[10px] font-bold tracking-[0.2em] uppercase" [style.color]="factionColor()">Stock // Requisition</span>
                    </div>

                    <div class="flex-1 overflow-y-auto p-4 grid grid-cols-1 gap-2 content-start custom-scrollbar">
                        @for (item of shop.merchantStock(); track item.id) {
                            <div class="flex gap-3 p-2 bg-zinc-900/80 border border-zinc-800 hover:border-white/30 transition-all group relative overflow-hidden">
                                <div class="w-14 h-14 bg-black shrink-0 border border-zinc-700 relative">
                                    <app-item-icon [item]="item"></app-item-icon>
                                    <div class="absolute bottom-0 right-0 bg-zinc-800 text-[8px] text-white px-1 font-mono">L{{item.level}}</div>
                                </div>
                                <div class="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                    <div class="flex justify-between items-start">
                                        <span class="text-sm font-bold truncate text-zinc-300 group-hover:text-white" [style.color]="item.color">{{ item.name }}</span>
                                    </div>
                                    <div class="flex justify-between items-end">
                                        <div class="flex flex-col text-[9px] text-zinc-500 font-mono">
                                            <span>{{ item.type }}</span>
                                            <span class="uppercase">{{ item.rarity }}</span>
                                        </div>
                                        <button (click)="buy(item)" 
                                                [disabled]="progression.credits() < shop.getBuyPrice(item)"
                                                class="px-4 py-1.5 text-[10px] font-bold bg-zinc-950 border border-zinc-700 hover:border-white disabled:opacity-50 disabled:border-zinc-800 text-white transition-all flex items-center gap-2">
                                            @if (isGlitching()) {
                                                <app-glitch-text [text]="shop.getBuyPrice(item) + ' CR'" [intensity]="0.3"></app-glitch-text>
                                            } @else {
                                                {{ shop.getBuyPrice(item) }} CR
                                            }
                                        </button>
                                    </div>
                                </div>
                            </div>
                        }
                        @if (shop.merchantStock().length === 0) {
                            <div class="py-12 text-center text-zinc-600 text-xs tracking-widest uppercase">
                                // STOCK DEPLETED //
                            </div>
                        }
                    </div>
                </div>

                <!-- PLAYER PANEL (Right) -->
                <div class="flex-1 flex flex-col bg-zinc-950 transition-all duration-300"
                     [class.hidden]="isMobile() && mobileView() !== 'PLAYER'"
                     [class.block]="!isMobile() || mobileView() === 'PLAYER'">
                    
                    <!-- Mode Toggle Header -->
                    <div class="flex border-b border-zinc-800 shrink-0">
                        <button (click)="setInventoryMode('SELL')" 
                                class="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 relative overflow-hidden"
                                [class]="inventoryMode() === 'SELL' ? 'bg-zinc-900 text-yellow-500 border-yellow-600' : 'text-zinc-600 border-transparent hover:text-zinc-400 hover:bg-zinc-900/50'">
                            SELL MODE
                            @if(inventoryMode() === 'SELL') { <div class="absolute inset-0 bg-yellow-500/5 pointer-events-none"></div> }
                        </button>
                        <button (click)="setInventoryMode('SALVAGE')" 
                                class="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 relative overflow-hidden"
                                [class]="inventoryMode() === 'SALVAGE' ? 'bg-zinc-900 text-red-500 border-red-600' : 'text-zinc-600 border-transparent hover:text-zinc-400 hover:bg-zinc-900/50'">
                            SALVAGE MODE
                            @if(inventoryMode() === 'SALVAGE') { <div class="absolute inset-0 bg-red-500/5 pointer-events-none"></div> }
                        </button>
                    </div>

                    <div class="flex-1 overflow-y-auto p-4 grid grid-cols-1 gap-2 content-start custom-scrollbar">
                         @for (item of inventory.bag(); track item.id; let i = $index) {
                            <div class="flex gap-3 p-2 bg-zinc-900/30 border border-zinc-800 hover:bg-zinc-900 transition-colors relative group">
                                <div class="w-14 h-14 bg-black shrink-0 border border-zinc-700 relative">
                                    <app-item-icon [item]="item"></app-item-icon>
                                    @if(item.stack > 1) { <div class="absolute top-0 right-0 bg-zinc-800 text-[8px] text-white px-1">x{{item.stack}}</div> }
                                </div>
                                <div class="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                    <div class="flex justify-between items-start">
                                        <span class="text-sm font-bold truncate text-zinc-300" [style.color]="item.color">{{ item.name }}</span>
                                    </div>
                                    <div class="flex justify-between items-end">
                                        <div class="flex flex-col text-[9px] text-zinc-500 font-mono">
                                            <span>L{{ item.level }} {{ item.type }}</span>
                                        </div>
                                        
                                        @if (inventoryMode() === 'SELL') {
                                            <button (click)="sell(item, i)" 
                                                    class="px-4 py-1.5 text-[10px] font-bold bg-zinc-900 hover:bg-yellow-900/30 border border-zinc-700 hover:border-yellow-500 text-zinc-300 hover:text-yellow-200 transition-all">
                                                SELL {{ shop.getSellPrice(item) }}
                                            </button>
                                        } @else {
                                            <button (click)="salvage(item, i)" 
                                                    class="px-4 py-1.5 text-[10px] font-bold bg-zinc-900 hover:bg-red-900/30 border border-zinc-700 hover:border-red-500 text-zinc-300 hover:text-red-200 transition-all flex items-center gap-1 group/btn">
                                                <span class="group-hover/btn:animate-pulse">⚠</span> SCRAP {{ shop.getSalvageYield(item) }}
                                            </button>
                                        }
                                    </div>
                                </div>
                            </div>
                        }
                        @if (inventory.bag().length === 0) {
                            <div class="flex-1 flex flex-col items-center justify-center text-zinc-700 opacity-50">
                                <span class="text-xs tracking-[0.2em] uppercase font-bold">Inventory Empty</span>
                            </div>
                        }
                    </div>
                </div>

            </div>
            
            <!-- Scanline Overlay -->
            <div class="absolute inset-0 pointer-events-none opacity-[0.03] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,#fff_3px)] z-50"></div>
        </div>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #09090b; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 2px; }
  `]
})
export class ShopComponent {
  shop = inject(ShopService);
  inventory = inject(InventoryService);
  progression = inject(PlayerProgressionService);
  narrative = inject(NarrativeService);
  haptic = inject(HapticService);
  close = output<void>();

  // State
  mobileView = signal<MobileView>('MERCHANT');
  inventoryMode = signal<InventoryMode>('SELL');
  isMobile = signal(window.innerWidth < 768);

  // Computeds
  factionColor = computed(() => {
      switch(this.shop.currentFaction()) {
          case 'VANGUARD': return '#06b6d4';
          case 'REMNANT': return '#f97316';
          case 'RESONANT': return '#a855f7';
          default: return '#71717a';
      }
  });

  factionInitial = computed(() => this.shop.currentFaction().charAt(0));
  
  isVolatile = computed(() => {
      const rep = this.narrative.getReputation(this.shop.currentFaction());
      return rep < -10; 
  });

  isGlitching = computed(() => this.isVolatile());

  volatilityLabel = computed(() => this.isVolatile() ? 'UNSTABLE' : 'STABLE');

  constructor() {
      window.addEventListener('resize', this.checkMobile);
  }

  setInventoryMode(m: InventoryMode) {
      this.inventoryMode.set(m);
      this.haptic.impactLight();
  }

  buy(item: Item) {
      if (this.shop.buyItem(item)) {
          this.haptic.success();
      } else {
          this.haptic.error();
      }
  }

  sell(item: Item, index: number) {
      this.shop.sellItem(item, index);
      this.haptic.impactMedium();
  }

  salvage(item: Item, index: number) {
      if(confirm(`Destroy ${item.name} for scrap?`)) {
          this.shop.salvageItem(item, index);
          this.haptic.explosion();
      }
  }

  checkMobile = () => {
      this.isMobile.set(window.innerWidth < 768);
  }
}
