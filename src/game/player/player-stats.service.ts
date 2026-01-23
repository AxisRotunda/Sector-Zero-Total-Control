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
    
    // ✅ CRITICAL: Base unarmed damage
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

    // ✅ DEBUG: Log on init
    console.log('🎮 PlayerStatsService Initialized');
    console.log('   Base Damage Packet:', this.baseStats().baseDamagePacket);
  }

  ngOnDestroy() { 
    this.subscriptions.forEach(s => s.unsubscribe()); 
  }

  /**
   * ✅ NUCLEAR FIX: Explicit damage packet construction with extensive logging
   */
  public playerStats = computed(() => {
    const base = this.baseStats();
    const tree = this.skillTree.totalStats();
    const equipped = this.inventory.equipped();
    const gearStats = this.inventory.equipmentStats();

    // ========================================
    // STEP 1: INITIALIZE FRESH PACKETS
    // ========================================
    const damagePacket: DamagePacket = {
      physical: 0,
      fire: 0,
      cold: 0,
      lightning: 0,
      chaos: 0
    };
    
    const resistances: Resistances = {
      physical: 0,
      fire: 0,
      cold: 0,
      lightning: 0,
      chaos: 0
    };
    
    const penetration: Penetration = {
      physical: 0,
      fire: 0,
      cold: 0,
      lightning: 0,
      chaos: 0
    };

    // ========================================
    // STEP 2: APPLY BASE DAMAGE (ALWAYS)
    // ========================================
    damagePacket.physical += base.baseDamagePacket?.physical ?? 10;
    damagePacket.physical += tree?.damage ?? 0;

    // Apply base penetration
    penetration.physical += base.basePenetration?.physical ?? 0;
    penetration.physical += (tree?.armorPen ?? 0) / 100;

    // ========================================
    // STEP 3: WEAPON CONFIGURATION
    // ========================================
    const hasWeapon = !!equipped?.weapon;
    
    if (hasWeapon) {
      const weapon = equipped.weapon!;
      
      // Check for new damage packet system
      if (weapon.damagePacket) {
        damagePacket.physical += weapon.damagePacket.physical ?? 0;
        damagePacket.fire += weapon.damagePacket.fire ?? 0;
        damagePacket.cold += weapon.damagePacket.cold ?? 0;
        damagePacket.lightning += weapon.damagePacket.lightning ?? 0;
        damagePacket.chaos += weapon.damagePacket.chaos ?? 0;
      }
      // Legacy weapon damage
      else if (weapon.stats?.['dmg']) {
        damagePacket.physical += weapon.stats['dmg'];
      }

      // Weapon penetration
      if (weapon.penetration) {
        penetration.physical += weapon.penetration.physical ?? 0;
        penetration.fire += weapon.penetration.fire ?? 0;
        penetration.cold += weapon.penetration.cold ?? 0;
        penetration.lightning += weapon.penetration.lightning ?? 0;
        penetration.chaos += weapon.penetration.chaos ?? 0;
      }
      // Legacy armorPen
      else if (weapon.stats?.['armorPen']) {
        penetration.physical += (weapon.stats['armorPen'] / 100);
      }

      // Psionic Blade special scaling
      if (weapon.type === 'PSI_BLADE') {
        const psyBonus = ((tree?.psyche ?? 0) + (gearStats?.psy ?? 0)) * 1.5;
        damagePacket.chaos += psyBonus;
      }
    } else {
      // ========================================
      // UNARMED COMBAT (THE BUG FIX)
      // ========================================
      const levelBonus = (base.level - 1) * 2;
      damagePacket.physical += levelBonus;
      
      // Add gear damage bonuses (rings, etc)
      if (gearStats?.dmg) {
        damagePacket.physical += gearStats.dmg;
      }

      // ✅ DEBUG: Log unarmed damage calculation
      console.log('👊 Unarmed Damage:', {
        base: base.baseDamagePacket.physical,
        tree: tree?.damage ?? 0,
        level: levelBonus,
        gear: gearStats?.dmg ?? 0,
        total: damagePacket.physical
      });
    }

    // ========================================
    // STEP 4: ARMOR / RESISTANCES
    // ========================================
    if (equipped?.armor?.stats?.['armor']) {
      resistances.physical += equipped.armor.stats['armor'];
    }
    resistances.physical += gearStats?.armor ?? 0;

    // Cap penetration at 90%
    penetration.physical = Math.min(0.9, penetration.physical);

    // ========================================
    // STEP 5: SECONDARY STATS
    // ========================================
    const finalHpMax = base.hpMax + (tree?.hpMax ?? 0) + (gearStats?.hp ?? 0);
    const finalCrit = base.crit + (gearStats?.crit ?? 0);
    const finalCritMult = base.critMult;
    const finalLifesteal = base.lifesteal + (gearStats?.lifesteal ?? 0);
    const finalSpeed = base.moveSpeed + (tree?.speed ?? 0) + (gearStats?.speed ?? 0);
    const finalCdr = (tree?.cdr ?? 0) + (gearStats?.cdr ?? 0);
    const finalPsyche = (tree?.psyche ?? 0) + (gearStats?.psy ?? 0);

    // Calculate total damage for legacy systems
    const totalDamage = 
      damagePacket.physical + 
      damagePacket.fire + 
      damagePacket.cold + 
      damagePacket.lightning + 
      damagePacket.chaos;

    // ========================================
    // RETURN STATS OBJECT
    // ========================================
    const stats = {
      level: base.level,
      
      // ✅ NEW SYSTEM (PRIMARY)
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

    // ✅ DEBUG: Log final stats
    console.log('📊 Player Stats Computed:', {
      hasWeapon,
      damagePacket: stats.damagePacket,
      totalDamage: stats.damage
    });

    return stats;
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
      this.world.player.hp = 0;
      this.isDead.set(true);
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