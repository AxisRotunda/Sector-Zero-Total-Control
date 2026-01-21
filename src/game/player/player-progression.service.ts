import { Injectable, signal, computed, inject, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import * as BALANCE from '../../config/balance.config';
import { SkillTreeService } from '../../game/skill-tree.service';
import { SoundService } from '../../services/sound.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { GameEvents } from '../../core/events/game-events';

@Injectable({ providedIn: 'root' })
export class PlayerProgressionService implements OnDestroy {
  private skillTree = inject(SkillTreeService);
  private sound = inject(SoundService);
  private eventBus = inject(EventBusService);
  private subscriptions: Subscription[] = [];

  level = signal(1);
  currentXp = signal(0);
  credits = signal(0);
  scrap = signal(0);
  nextLevelXp = computed(() => this.level() * BALANCE.PLAYER.XP_PER_LEVEL);

  constructor() {
    const sub = this.eventBus.on(GameEvents.PLAYER_DEATH).subscribe(() => this.credits.update(c => Math.floor(c * 0.8)));
    this.subscriptions.push(sub);
  }

  ngOnDestroy() { this.subscriptions.forEach(s => s.unsubscribe()); }

  gainXp(amount: number) {
      this.currentXp.update(x => x + amount);
      if (this.currentXp() >= this.nextLevelXp()) {
          this.level.update(l => l + 1); this.currentXp.set(0);
          this.eventBus.dispatch({ type: GameEvents.PLAYER_LEVEL_UP });
          this.skillTree.addPoint(); this.sound.play('POWERUP');
          this.eventBus.dispatch({ type: GameEvents.FLOATING_TEXT_SPAWN, payload: { onPlayer: true, yOffset: -80, text: "NEURAL MATRIX UPGRADED", color: '#fbbf24', size: 28 } });
      }
  }

  gainCredits(amount: number) {
      this.credits.update(c => c + amount);
      if (amount > 0) this.eventBus.dispatch({ type: GameEvents.FLOATING_TEXT_SPAWN, payload: { onPlayer: true, yOffset: -60, text: `+${amount} CR`, color: '#eab308', size: 20 } });
  }

  gainScrap(amount: number) {
      this.scrap.update(s => s + amount);
      if (amount > 0) this.eventBus.dispatch({ type: GameEvents.FLOATING_TEXT_SPAWN, payload: { onPlayer: true, yOffset: -40, text: `+${amount} SCRAP`, color: '#94a3b8', size: 18 } });
  }

  reset() { this.level.set(1); this.currentXp.set(0); this.credits.set(0); this.scrap.set(0); }
  
  getSaveData() { return { level: this.level(), currentXp: this.currentXp(), credits: this.credits(), scrap: this.scrap() }; }
  
  loadSaveData(data: any) {
      if (data) {
          this.level.set(data.level || 1);
          this.currentXp.set(data.currentXp || 0);
          this.credits.set(data.credits || 0);
          this.scrap.set(data.scrap || 0);
      }
  }
}