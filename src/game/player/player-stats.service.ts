import { Injectable, signal, computed, inject, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { SkillTreeService } from '../../game/skill-tree.service';
import { InventoryService } from '../inventory.service';
import * as BALANCE from '../../config/balance.config';
import { WorldService } from '../../game/world/world.service';
import { SoundService } from '../../services/sound.service';
import { ParticleService } from '../../systems/particle.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { GameEvents } from '../../core/events/game-events';

@Injectable({ providedIn: 'root' })
export class PlayerStatsService implements OnDestroy {
  private skillTree = inject(SkillTreeService);
  private inventory = inject(InventoryService);
  private world = inject(WorldService);
  private sound = inject(SoundService);
  private particleService = inject(ParticleService);
  private eventBus = inject(EventBusService);
  private subscriptions: Subscription[] = [];

  isDead = signal(false);

  constructor() {
    const sub = this.eventBus.on(GameEvents.PLAYER_LEVEL_UP).subscribe(() => this.playerHp.set(this.playerStats().hpMax));
    this.subscriptions.push(sub);
  }

  ngOnDestroy() { this.subscriptions.forEach(s => s.unsubscribe()); }

  playerStats = computed(() => {
    const tree = this.skillTree.totalStats();
    const gear = this.inventory.equipmentStats();
    let damage = tree.damage + gear.dmg;
    if (this.inventory.equipped().weapon?.type === 'PSI_BLADE') damage += (tree.psyche + (gear.psy || 0)) * 1.5;
    return { hpMax: tree.hpMax + gear.hp, damage: damage, speed: tree.speed + gear.speed, cdr: tree.cdr + gear.cdr, psyche: tree.psyche + (gear.psy || 0), crit: gear.crit || 0, lifesteal: gear.lifesteal || 0, armorPen: tree.armorPen + gear.armorPen };
  });

  playerHp = signal(BALANCE.PLAYER.BASE_HP);
  psionicEnergy = signal(100);
  maxPsionicEnergy = computed(() => 100 + (this.playerStats().psyche * 5));
  psionicRegenRate = computed(() => (1.5 + (this.playerStats().psyche * 0.25)) / 60);

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
          setTimeout(() => { this.playerHp.set(this.playerStats().hpMax); this.world.player.hp = this.playerHp(); this.world.player.x = 0; this.world.player.y = 0; this.eventBus.dispatch({ type: GameEvents.PLAYER_DEATH }); this.isDead.set(false); }, 5000);
      }
  }
  reset() { this.isDead.set(false); this.playerHp.set(BALANCE.PLAYER.BASE_HP); this.psionicEnergy.set(100); }
}