
import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { InventoryService } from '../inventory.service';
import { Subscription } from 'rxjs';
import { SkillTreeService } from '../../game/skill-tree.service';
import { WorldService } from '../../game/world/world.service';
import { SoundService } from '../../services/sound.service';
import { ParticleService } from '../../systems/particle.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { GameEvents } from '../../core/events/game-events';
import {
  DamagePacket,
  Resistances,
  Penetration,
  createEmptyDamagePacket,
  createDefaultResistances,
  createZeroPenetration
} from '../../models/damage.model';
import * as BALANCE from '../../config/balance.config';

@Injectable({ providedIn: 'root' })
export class PlayerStatsService implements OnDestroy {
  private skillTree = inject(SkillTreeService);
  private inventory = inject(InventoryService);
  private world = inject(WorldService);
  private sound = inject(SoundService);
  private particleService = inject(ParticleService);
  private eventBus = inject(EventBusService);
  private subscriptions: Subscription[] = [];

  // Player HP signal
  public playerHp = signal(BALANCE.PLAYER.BASE_HP);
  public isDead = signal(false);
  public psionicEnergy = signal(100);

  // Base stats definition
  private baseStats = signal({
    level: 1,
    hpMax: 100,
    crit: 5,
    critMult: 1.5,
    lifesteal: 0,
    moveSpeed: 1.0,
    
    // Base unarmed damage (before equipment)
    baseDamagePacket: {
      physical: 10,
      fire: 0,
      cold: 0,
      lightning: 0,
      chaos: 0
    } as DamagePacket,
    
    baseResistances: createDefaultResistances(),
    basePenetration: createZeroPenetration()
  });

  constructor() {
    const sub = this.eventBus.on(GameEvents.PLAYER_LEVEL_UP).subscribe(() => {
        this.baseStats.update(s => ({ ...s, level: s.level + 1 }));
        this.playerHp.set(this.playerStats().hpMax);
    });
    this.subscriptions.push(sub);
  }

  ngOnDestroy() { this.subscriptions.forEach(s => s.unsubscribe()); }

  /**
   * Computed player stats with equipment bonuses.
   */
  public playerStats = computed(() => {
    const base = this.baseStats();
    const tree = this.skillTree.totalStats();
    const equipped = this.inventory.equipped();
    const gearStats = this.inventory.equipmentStats();
    
    // Initialize final stats containers
    const finalDamagePacket = { ...base.baseDamagePacket };
    const finalResistances = { ...base.baseResistances };
    const finalPenetration = { ...base.basePenetration };
    
    // Base Scaling from Skill Tree
    finalDamagePacket.physical += tree.damage;
    
    // ============================
    // WEAPON: Damage & Penetration
    // ============================
    if (equipped.weapon) {
      // New damage packet system from item (if generated with one)
      if (equipped.weapon.damagePacket) {
        finalDamagePacket.physical += equipped.weapon.damagePacket.physical;
        finalDamagePacket.fire += equipped.weapon.damagePacket.fire;
        finalDamagePacket.cold += equipped.weapon.damagePacket.cold;
        finalDamagePacket.lightning += equipped.weapon.damagePacket.lightning;
        finalDamagePacket.chaos += equipped.weapon.damagePacket.chaos;
      } 
      // Legacy/Simple weapon fallback (scalar damage to physical)
      else if (equipped.weapon.stats['dmg']) {
        finalDamagePacket.physical += equipped.weapon.stats['dmg'];
      }

      // Weapon penetration
      if (equipped.weapon.penetration) {
        finalPenetration.physical += equipped.weapon.penetration.physical;
        finalPenetration.fire += equipped.weapon.penetration.fire;
        finalPenetration.cold += equipped.weapon.penetration.cold;
        finalPenetration.lightning += equipped.weapon.penetration.lightning;
        finalPenetration.chaos += equipped.weapon.penetration.chaos;
      }
      else if (equipped.weapon.stats['armorPen']) {
        finalPenetration.physical += (equipped.weapon.stats['armorPen'] / 100);
      }
    } else {
      // ✅ UNARMED: Base fist damage scales with level + tree
      // Base is 10, plus 2 per level (handled in baseStats update or here)
      // We'll calculate dynamic level scaling here to be safe
      const levelBonus = (base.level - 1) * 2;
      finalDamagePacket.physical = 10 + levelBonus + tree.damage;
    }

    // Apply generic gear stats (flat damage bonuses from rings/etc)
    if (gearStats.dmg && !equipped.weapon) {
        // If unarmed, ring damage adds directly
        finalDamagePacket.physical += gearStats.dmg;
    }

    // Psionic Blade Scaling
    if (equipped.weapon?.type === 'PSI_BLADE') {
        const psyBonus = (tree.psyche + gearStats.psy) * 1.5;
        finalDamagePacket.chaos += psyBonus;
    }

    // Armor Pen from Tree/Gear
    finalPenetration.physical += (tree.armorPen + gearStats.armorPen) / 100;

    // Cap Penetration
    finalPenetration.physical = Math.min(0.9, finalPenetration.physical);

    return {
      level: base.level,
      
      // ✅ NEW SYSTEM
      damagePacket: finalDamagePacket,
      resistances: finalResistances,
      penetration: finalPenetration,
      
      // Legacy compatibility (single values = physical/primary only)
      damage: finalDamagePacket.physical + finalDamagePacket.fire + finalDamagePacket.cold + finalDamagePacket.lightning + finalDamagePacket.chaos,
      armor: finalResistances.physical + gearStats.armor,
      armorPen: finalPenetration.physical,
      
      // Other stats
      hpMax: base.hpMax + tree.hpMax + gearStats.hp,
      crit: base.crit + gearStats.crit,
      critMult: base.critMult,
      lifesteal: base.lifesteal + gearStats.lifesteal,
      
      // EXPOSED AS 'speed' TO CONSUMERS
      speed: base.moveSpeed + tree.speed + gearStats.speed,
      
      cdr: tree.cdr + gearStats.cdr,
      psyche: tree.psyche + gearStats.psy
    };
  });

  public maxPsionicEnergy = computed(() => 100 + (this.playerStats().psyche * 5));
  public psionicRegenRate = computed(() => (1.5 + (this.playerStats().psyche * 0.25)) / 60);

  update() {
    if (this.isDead()) return;
    this.psionicEnergy.update(e => Math.min(this.maxPsionicEnergy(), e + this.psionicRegenRate()));
    if (this.world.player.state !== 'ATTACK' && this.world.player.hitFlash === 0 && this.playerHp() < this.playerStats().hpMax) {
        this.playerHp.update(h => Math.min(this.playerStats().hpMax, h + (0.5 + this.playerStats().psyche * 0.1) / 60));
    }
  }

  takeDamage(amt: number) {
      if (this.world.player.hitFlash > 0 || this.isDead()) return;
      this.playerHp.update(h => h - amt);
      this.world.player.hitFlash = BALANCE.PLAYER.HIT_FLASH_DURATION;
      this.eventBus.dispatch({ type: GameEvents.ADD_SCREEN_SHAKE, payload: BALANCE.SHAKE.HIT });
      this.sound.play('HIT');
      if (this.playerHp() <= 0) {
          this.world.player.hp = 0; this.isDead.set(true);
          setTimeout(() => { 
              this.reset();
              this.eventBus.dispatch({ type: GameEvents.PLAYER_DEATH }); 
          }, 5000);
      }
  }

  reset() {
    this.baseStats.set({
      level: 1,
      hpMax: 100,
      crit: 5,
      critMult: 1.5,
      lifesteal: 0,
      moveSpeed: 1.0,
      baseDamagePacket: { physical: 10, fire: 0, cold: 0, lightning: 0, chaos: 0 },
      baseResistances: createDefaultResistances(),
      basePenetration: createZeroPenetration()
    });
    this.isDead.set(false);
    this.playerHp.set(100);
    this.psionicEnergy.set(100);
  }
}
