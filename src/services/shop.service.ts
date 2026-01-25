
import { Injectable, inject, signal, computed } from '@angular/core';
import { Item, ItemType } from '../models/item.models';
import { Entity } from '../models/game.models';
import { ItemGeneratorService } from './item-generator.service';
import { InventoryService } from '../game/inventory.service';
import { SoundService } from './sound.service';
import { PlayerProgressionService } from '../game/player/player-progression.service';
import { NarrativeService } from '../game/narrative.service';
import { Faction } from '../models/narrative.models';
import { WorldService } from '../game/world/world.service';

@Injectable({ providedIn: 'root' })
export class ShopService {
  private itemGen = inject(ItemGeneratorService);
  private progression = inject(PlayerProgressionService);
  private inventory = inject(InventoryService);
  private sound = inject(SoundService);
  private narrative = inject(NarrativeService);
  private world = inject(WorldService);

  merchantStock = signal<Item[]>([]);
  currentFaction = signal<Faction['id']>('REMNANT'); 
  private currentMerchantEntity: Entity | null = null;
  
  // Market Volatility: A random factor applied per shop session (0.9 to 1.1)
  private volatility = signal(1.0);

  private readonly BUY_MARKUP = 2.5; 
  private readonly SELL_MARKDOWN = 0.4; 

  // Faction Biases for Item Generation
  private factionPreferences: Record<string, ItemType[]> = {
      'VANGUARD': ['WEAPON', 'ARMOR', 'STIM'],
      'REMNANT': ['IMPLANT', 'PSI_BLADE', 'STIM', 'AMULET'],
      'RESONANT': ['PSI_BLADE', 'AMULET', 'RING', 'IMPLANT']
  };

  openShop(merchant: Entity) {
      // 1. Determine Faction (Type Safe)
      const validFactions: Faction['id'][] = ['VANGUARD', 'REMNANT', 'RESONANT'];
      const faction = (merchant.factionId && validFactions.includes(merchant.factionId as any)) 
          ? merchant.factionId as Faction['id'] 
          : (Math.random() > 0.5 ? 'VANGUARD' : 'REMNANT');
          
      this.currentFaction.set(faction);
      
      // 2. Set Volatility
      this.volatility.set(0.9 + Math.random() * 0.2); 
      this.currentMerchantEntity = merchant;

      // 3. Load or Generate Stock
      if (merchant.shopInventory && merchant.shopInventory.length > 0) {
          this.merchantStock.set(merchant.shopInventory);
      } else {
          // Generate new stock
          const level = this.progression.level();
          const difficulty = this.world.currentZone().difficultyMult;
          const newStock = this.generateStock(faction, level, difficulty);
          
          merchant.shopInventory = newStock;
          this.merchantStock.set(newStock);
      }
  }

  private generateStock(factionId: string, level: number, zoneDifficulty: number): Item[] {
    const stock: Item[] = [];
    const count = 8 + Math.floor(Math.random() * 4);
    const pref = this.factionPreferences[factionId] || [];

    for (let i = 0; i < count; i++) {
        // 50% chance to force a preferred item type
        const forceType = (pref.length > 0 && Math.random() < 0.5) 
            ? pref[Math.floor(Math.random() * pref.length)] 
            : undefined;

        const item = this.itemGen.generateLoot({ 
            level: level, 
            difficulty: zoneDifficulty, 
            rarityBias: 0.2, 
            source: 'CRATE',
            forceType: forceType
        });
        stock.push(item);
    }
    return stock;
  }

  getBuyPrice(item: Item): number {
      let base = 50 * item.level;
      if (item.rarity === 'UNCOMMON') base *= 1.5;
      if (item.rarity === 'RARE') base *= 3.0;
      if (item.rarity === 'BLACK_MARKET') base *= 8.0;
      
      let price = Math.floor(base * this.BUY_MARKUP);
      
      const rep = this.narrative.getReputation(this.currentFaction());
      let modifier = 1.0;
      if (rep > 50) modifier = 0.8; 
      else if (rep > 20) modifier = 0.9; 
      else if (rep < -30) modifier = 1.3;
      
      price = Math.floor(price * modifier * this.volatility());
      return price;
  }

  getSellPrice(item: Item): number {
      let base = 50 * item.level;
      if (item.rarity === 'UNCOMMON') base *= 1.5; if (item.rarity === 'RARE') base *= 3.0;
      return Math.floor(base * this.SELL_MARKDOWN);
  }

  getSalvageYield(item: Item): number {
      let base = item.level * 2;
      if (item.rarity === 'UNCOMMON') base *= 2;
      if (item.rarity === 'RARE') base *= 4;
      if (item.rarity === 'BLACK_MARKET') base *= 10;
      return Math.floor(base);
  }

  buyItem(item: Item): boolean {
      const price = this.getBuyPrice(item);
      if (this.progression.credits() >= price) {
          if (this.inventory.addItem(item)) {
              this.progression.gainCredits(-price);
              this.sound.play('UI'); 
              this.narrative.modifyReputation(this.currentFaction(), 1); // Small Rep gain

              // Atomic update of stock
              const newStock = this.merchantStock().filter(i => i.id !== item.id);
              this.merchantStock.set(newStock);
              
              if (this.currentMerchantEntity) {
                  this.currentMerchantEntity.shopInventory = newStock;
              }
              return true;
          }
      }
      return false;
  }

  sellItem(item: Item, index: number) {
      const price = this.getSellPrice(item);
      this.inventory.bag.update(b => { const newBag = [...b]; newBag.splice(index, 1); return newBag; });
      this.progression.gainCredits(price);
      this.narrative.modifyReputation(this.currentFaction(), 1); // Small Rep gain
      this.sound.play('UI');
  }

  salvageItem(item: Item, index: number) {
      const scrap = this.getSalvageYield(item);
      this.inventory.bag.update(b => { const newBag = [...b]; newBag.splice(index, 1); return newBag; });
      this.progression.gainScrap(scrap);
      this.sound.play('CRAFT');
  }
}
