
import { Injectable, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InventoryService } from '../inventory.service';
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
  createDefaultResistances,
  createZeroPenetration,
  createEmptyDamagePacket
} from '../../models/damage.model';
import * as BALANCE from '../../config/balance.config';

@Injectable({ providedIn: 'root' })
export class PlayerStatsService {
  private skillTree = inject(SkillTreeService);
  private inventory = inject(InventoryService);
  private world = inject(WorldService);
  private sound = inject(SoundService);
  private particleService = inject(ParticleService);
  private eventBus = inject(EventBusService);
  
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
    baseDamagePacket: { ...createEmptyDamagePacket(), physical: 10 },
    baseResistances: createDefaultResistances(),
    basePenetration: createZeroPenetration()
  });

  constructor() {
    this.eventBus.on(GameEvents.PLAYER_LEVEL_UP)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.baseStats.update(s => ({ ...s, level: s.level + 1 }));
        this.playerHp.set(this.playerStats().hpMax);
      });
  }

  // --- GRANULAR COMPUTED SIGNALS ---

  private gearStats = computed(() => this.inventory.equipmentStats());
  private treeStats = computed(() => this.skillTree.totalStats());
  private equippedWeapon = computed(() => this.inventory.equipped().weapon);
  private equippedArmor = computed(() => this.inventory.equipped().armor);

  private damagePacket = computed(() => {
    const base = this.baseStats();
    const tree = this.treeStats();
    const gear = this.gearStats();
    const weapon = this.equippedWeapon();

    const packet = createEmptyDamagePacket();
    
    // Base + Tree
    packet.physical += base.baseDamagePacket.physical + (tree?.damage ?? 0);

    // Weapon
    if (weapon) {
        if (weapon.damagePacket) {
            packet.physical += weapon.damagePacket.physical;
            packet.fire += weapon.damagePacket.fire;
            packet.cold += weapon.damagePacket.cold;
            packet.lightning += weapon.damagePacket.lightning;
            packet.chaos += weapon.damagePacket.chaos;
        } else if (weapon.stats?.['dmg']) {
            // Legacy/Simple weapon stat
            packet.physical += weapon.stats['dmg'];
        }

        // Psi Blade Bonus
        if (weapon.type === 'PSI_BLADE') {
            const psyBonus = ((tree?.psyche ?? 0) + (gear?.psy ?? 0)) * 1.5;
            packet.chaos += psyBonus;
        }
    } else {
        // Unarmed Scaling
        const levelBonus = (base.level - 1) * 2;
        packet.physical += levelBonus;
        if (gear?.dmg) packet.physical += gear.dmg;
    }

    return packet;
  });

  private penetration = computed(() => {
      const base = this.baseStats();
      const tree = this.treeStats();
      const weapon = this.equippedWeapon();
      
      const pen = createZeroPenetration();
      pen.physical += base.basePenetration.physical + ((tree?.armorPen ?? 0) / 100);

      if (weapon) {
          if (weapon.penetration) {
              pen.physical += weapon.penetration.physical;
              pen.fire += weapon.penetration.fire;
              // ... others
          } else if (weapon.stats?.['armorPen']) {
              pen.physical += (weapon.stats['armorPen'] / 100);
          }
      }
      
      // Cap physical pen
      pen.physical = Math.min(0.9, pen.physical);
      return pen;
  });

  private resistances = computed(() => {
      const gear = this.gearStats();
      const armorItem = this.equippedArmor();
      
      const res = createDefaultResistances();
      
      if (armorItem?.stats?.['armor']) {
          res.physical += armorItem.stats['armor'];
      }
      res.physical += gear?.armor ?? 0;
      
      return res;
  });

  public statusResistances = computed(() => {
      const gear = this.gearStats();
      // Placeholder: In future, map gear stats like 'burnRes' to this object
      // For now, return basic structure
      return {
          stun: 0,
          slow: 0,
          burn: 0,
          poison: 0
      };
  });

  // --- AGGREGATE STATS ---

  public playerStats = computed(() => {
    const base = this.baseStats();
    const tree = this.treeStats();
    const gear = this.gearStats();
    
    const damagePkt = this.damagePacket();
    const resist = this.resistances();
    const pen = this.penetration();

    const finalHpMax = base.hpMax + (tree?.hpMax ?? 0) + (gear?.hp ?? 0);
    const finalCrit = base.crit + (gear?.crit ?? 0);
    const finalSpeed = base.moveSpeed + (tree?.speed ?? 0) + (gear?.speed ?? 0);
    const finalPsyche = (tree?.psyche ?? 0) + (gear?.psy ?? 0);
    const finalCdr = (tree?.cdr ?? 0) + (gear?.cdr ?? 0);
    
    const totalDmg = damagePkt.physical + damagePkt.fire + damagePkt.cold + damagePkt.lightning + damagePkt.chaos;

    return {
      level: base.level,
      damagePacket: damagePkt,
      resistances: resist,
      penetration: pen,
      damage: totalDmg, // Legacy prop for UI
      armor: resist.physical,
      armorPen: pen.physical,
      hpMax: finalHpMax,
      crit: finalCrit,
      critMult: base.critMult,
      lifesteal: base.lifesteal + (gear?.lifesteal ?? 0),
      speed: finalSpeed,
      cdr: finalCdr,
      psyche: finalPsyche
    };
  });

  public maxPsionicEnergy = computed(() => 100 + (this.playerStats().psyche * 5));
  public psionicRegenRate = computed(() => (1.5 + (this.playerStats().psyche * 0.25)) / 60);

  // Performance Optimizations: Pre-computed percentages for UI
  public healthPercentage = computed(() => 
    (this.playerHp() / this.playerStats().hpMax) * 100
  );

  public energyPercentage = computed(() => 
    (this.psionicEnergy() / this.maxPsionicEnergy()) * 100
  );

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
      baseDamagePacket: { ...createEmptyDamagePacket(), physical: 10 },
      baseResistances: createDefaultResistances(),
      basePenetration: createZeroPenetration()
    });

    this.isDead.set(false);
    this.playerHp.set(100);
    this.psionicEnergy.set(100);
  }
}
