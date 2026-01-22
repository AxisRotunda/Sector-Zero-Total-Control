
import { Injectable, signal, inject, OnDestroy, computed } from '@angular/core';
import { Subscription } from 'rxjs';
import { PlayerProgressionService } from './player-progression.service';
import { PlayerStatsService } from './player-stats.service';
import { PlayerAbilitiesService } from './player-abilities.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { GameEvents, ScreenShakePayload } from '../../core/events/game-events';
import { SectorId } from '../../models/game.models';

@Injectable({ providedIn: 'root' })
export class PlayerService implements OnDestroy {
  progression = inject(PlayerProgressionService);
  stats = inject(PlayerStatsService);
  abilities = inject(PlayerAbilitiesService);
  private eventBus = inject(EventBusService);
  private subscriptions: Subscription[] = [];

  currentSectorId = signal<SectorId>('HUB');
  currentFloor = signal(0); 
  
  autoCombatEnabled = signal(true);
  screenShake = signal<{intensity: number, decay: number, x: number, y: number}>({intensity: 0, decay: 0.9, x: 0, y: 0});
  
  // Facade Signals & Computeds
  playerStats = this.stats.playerStats;
  playerHp = this.stats.playerHp;
  level = this.progression.level;

  constructor() {
    const sub = this.eventBus.on(GameEvents.ADD_SCREEN_SHAKE).subscribe((payload: ScreenShakePayload) => this.addShake(payload));
    this.subscriptions.push(sub);
  }

  ngOnDestroy() { this.subscriptions.forEach(s => s.unsubscribe()); }
  
  toggleAutoCombat() { this.autoCombatEnabled.update(v => !v); }

  addShake(profile: { intensity: number, decay: number, x?: number, y?: number }) {
      this.screenShake.update(s => ({ intensity: Math.max(s.intensity, profile.intensity), decay: Math.min(s.decay, profile.decay), x: s.x + (profile.x || 0), y: s.y + (profile.y || 0) }));
  }
  
  updatePerFrame() { this.abilities.updateCooldowns(); this.stats.update(); }

  // Facade Methods
  useSkill(skill: 'PRIMARY' | 'SECONDARY' | 'DASH' | 'UTILITY' | 'OVERLOAD' | 'SHIELD_BASH', targetAngle?: number) {
      this.abilities.useSkill(skill, targetAngle);
  }

  damagePlayer(amount: number) {
      this.stats.takeDamage(amount);
  }

  gainXp(amount: number) {
      this.progression.gainXp(amount);
  }

  gainCredits(amount: number) {
      this.progression.gainCredits(amount);
  }

  reset() { 
      this.progression.reset(); 
      this.stats.reset(); 
      this.abilities.reset(); 
      this.currentSectorId.set('HUB'); 
      this.currentFloor.set(0); 
      this.autoCombatEnabled.set(true); 
  }

  getSaveData() { 
      return { 
          level: this.progression.level(), 
          currentXp: this.progression.currentXp(), 
          credits: this.progression.credits(), 
          playerHp: this.stats.playerHp(), 
          currentSectorId: this.currentSectorId(),
          autoCombat: this.autoCombatEnabled(),
          psiEnergy: this.stats.psionicEnergy()
      }; 
  }

  loadSaveData(data: any) {
    if(data) {
        this.progression.level.set(data.level || 1);
        this.progression.currentXp.set(data.currentXp || 0);
        this.progression.credits.set(data.credits || 0);
        this.stats.playerHp.set(data.playerHp || this.stats.playerStats().hpMax);
        this.currentSectorId.set(data.currentSectorId || 'HUB');
        this.currentFloor.set(data.currentSectorId === 'HUB' ? 0 : 1);
        if (data.autoCombat !== undefined) this.autoCombatEnabled.set(data.autoCombat);
        if (data.psiEnergy !== undefined) this.stats.psionicEnergy.set(data.psiEnergy);
    }
  }
}
