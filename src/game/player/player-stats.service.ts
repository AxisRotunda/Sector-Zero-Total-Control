
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
   * CRITICAL FIX: Explicitly constructs and returns damagePacket.
   */
  public playerStats = computed(() => {
    const base = this.baseStats();
    const tree = this.skillTree.totalStats();
    const equipped = this.inventory.equipped();
    const gearStats = this.inventory.equipmentStats();
    
    // ========================================
    // STEP 1: INITIALIZE PACKETS
    // ========================================
    // Start with empty packets to ensure clean state calculation
    const damagePacket = createEmptyDamagePacket();
    const resistances = createDefaultResistances();
    const penetration = createZeroPenetration();
    
    // ========================================
    // STEP 2: APPLY BASE & TREE STATS
    // ========================================
    damagePacket.physical += base.baseDamagePacket.physical;
    damagePacket.physical += tree.damage; // Tree generic damage adds to physical base
    
    // Apply Base/Tree Penetration
    penetration.physical += base.basePenetration.physical + (tree.armorPen / 100);

    // ========================================
    // STEP 3: APPLY WEAPON CONFIGURATION
    // ========================================
    if (equipped.weapon) {
      // New system: weapon has damagePacket
      if (equipped.weapon.damagePacket) {
        damagePacket.physical += equipped.weapon.damagePacket.physical;
        damagePacket.fire += equipped.weapon.damagePacket.fire;
        damagePacket.cold += equipped.weapon.damagePacket.cold;
        damagePacket.lightning += equipped.weapon.damagePacket.lightning;
        damagePacket.chaos += equipped.weapon.damagePacket.chaos;
      }
      // Legacy system: weapon has single 'damage' value
      else if (equipped.weapon.stats['dmg']) {
        damagePacket.physical += equipped.weapon.stats['dmg'];
      }
      
      // Weapon penetration
      if (equipped.weapon.penetration) {
        penetration.physical += equipped.weapon.penetration.physical;
        penetration.fire += equipped.weapon.penetration.fire;
        penetration.cold += equipped.weapon.penetration.cold;
        penetration.lightning += equipped.weapon.penetration.lightning;
        penetration.chaos += equipped.weapon.penetration.chaos;
      }
      // Legacy armorPen
      else if (equipped.weapon.stats['armorPen']) {
        penetration.physical += (equipped.weapon.stats['armorPen'] / 100);
      }
      
      // Psionic Blade Scaling (Special Case)
      if (equipped.weapon.type === 'PSI_BLADE') {
          const psyBonus = (tree.psyche + gearStats.psy) * 1.5;
          damagePacket.chaos += psyBonus;
      }

    } else {
      // ========================================
      // UNARMED SCALING
      // ========================================
      // Unarmed damage scales with Level and generic Gear Damage (Rings)
      const levelBonus = (base.level - 1) * 2;
      damagePacket.physical += levelBonus;
      
      if (gearStats.dmg) {
          damagePacket.physical += gearStats.dmg;
      }
    }

    // ========================================
    // STEP 4: APPLY ARMOR / RESISTANCES
    // ========================================
    if (equipped.armor) {
      // New system
      if (equipped.armor.stats['armor']) {
        resistances.physical += equipped.armor.stats['armor'];
      }
    }
    resistances.physical += gearStats.armor; // Add generic armor from other slots

    // Cap Penetration
    penetration.physical = Math.min(0.9, penetration.physical);

    // ========================================
    // STEP 5: CALCULATE SECONDARY STATS
    // ========================================
    const finalHpMax = base.hpMax + tree.hpMax + gearStats.hp;
    const finalCrit = base.crit + gearStats.crit;
    const finalCritMult = base.critMult;
    const finalLifesteal = base.lifesteal + gearStats.lifesteal;
    const finalSpeed = base.moveSpeed + tree.speed + gearStats.speed;
    const finalCdr = tree.cdr + gearStats.cdr;
    const finalPsyche = tree.psyche + gearStats.psy;

    // Calculate total flat damage for legacy consumers
    const totalDamage = damagePacket.physical + damagePacket.fire + damagePacket.cold + damagePacket.lightning + damagePacket.chaos;

    // ========================================
    // RETURN COMPLETE STATS OBJECT
    // ========================================
    return {
      level: base.level,
      
      // ✅ NEW SYSTEM (CRITICAL FIX)
      damagePacket,
      resistances,
      penetration,
      
      // Legacy compatibility
      damage: totalDamage,
      armor: resistances.physical,
      armorPen: penetration.physical,
      
      // Other stats
      hpMax: finalHpMax,
      crit: finalCrit,
      critMult: finalCritMult,
      lifesteal: finalLifesteal,
      speed: finalSpeed,
      cdr: finalCdr,
      psyche: finalPsyche
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
