
import { Injectable, signal, inject, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PlayerProgressionService } from './player-progression.service';
import { PlayerStatsService } from './player-stats.service';
import { PlayerAbilitiesService } from './player-abilities.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { GameEvents, ScreenShakePayload } from '../../core/events/game-events';
import { SectorId } from '../../models/game.models';
import { catchError } from 'rxjs/operators';
import { EMPTY } from 'rxjs';

export interface PlayerSaveData {
  level: number;
  currentXp: number;
  credits: number;
  playerHp: number;
  currentSectorId: SectorId;
  autoCombat: boolean;
  psiEnergy: number;
}

@Injectable({ providedIn: 'root' })
export class PlayerService {
  progression = inject(PlayerProgressionService);
  stats = inject(PlayerStatsService);
  abilities = inject(PlayerAbilitiesService);
  private eventBus = inject(EventBusService);

  currentSectorId = signal<SectorId>('HUB');
  currentFloor = signal(0); 
  
  autoCombatEnabled = signal(true);
  screenShake = signal<{intensity: number, decay: number, x: number, y: number}>({intensity: 0, decay: 0.9, x: 0, y: 0});
  
  // Facade Signals & Computeds
  playerStats = this.stats.playerStats;
  playerHp = this.stats.playerHp;
  level = this.progression.level;

  constructor() {
    this.eventBus.on(GameEvents.ADD_SCREEN_SHAKE)
      .pipe(
        takeUntilDestroyed(),
        catchError(err => {
          console.error('Screen shake error:', err);
          return EMPTY;
        })
      )
      .subscribe((payload: ScreenShakePayload) => this.addShake(payload));
  }
  
  toggleAutoCombat() { this.autoCombatEnabled.update(v => !v); }

  addShake(profile: { intensity: number, decay: number, x?: number, y?: number }) {
      this.screenShake.update(s => {
          // Fix: Clamp and decay added impulse to prevent infinite accumulation
          const newX = (s.x + (profile.x || 0)) * 0.9;
          const newY = (s.y + (profile.y || 0)) * 0.9;
          return { 
              intensity: Math.max(s.intensity, profile.intensity), 
              decay: Math.min(s.decay, profile.decay), 
              x: Math.max(-20, Math.min(20, newX)), 
              y: Math.max(-20, Math.min(20, newY))
          };
      });
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

  getSaveData(): PlayerSaveData { 
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

  loadSaveData(data: Partial<PlayerSaveData>) {
    if(data) {
        this.progression.level.set(data.level ?? 1);
        this.progression.currentXp.set(data.currentXp ?? 0);
        this.progression.credits.set(data.credits ?? 0);
        this.stats.playerHp.set(data.playerHp ?? this.stats.playerStats().hpMax);
        this.currentSectorId.set(data.currentSectorId || 'HUB');
        this.currentFloor.set(data.currentSectorId === 'HUB' ? 0 : 1);
        
        if (typeof data.autoCombat === 'boolean') this.autoCombatEnabled.set(data.autoCombat);
        if (typeof data.psiEnergy === 'number') this.stats.psionicEnergy.set(data.psiEnergy);
    }
  }
}
