import { Injectable, inject } from '@angular/core';
import { Entity } from '../models/game.models';
import { WorldService } from '../game/world/world.service';
import { SoundService } from '../services/sound.service';
import { ParticleService } from '../systems/particle.service';
import { HapticService } from '../services/haptic.service';
import { EventBusService } from '../core/events/event-bus.service';
import { GameEvents } from '../core/events/game-events';
import { TimeService } from '../game/time.service';
import * as BALANCE from '../config/balance.config';

@Injectable({ providedIn: 'root' })
export class CombatFeedbackService {
  private world = inject(WorldService);
  private sound = inject(SoundService);
  private particles = inject(ParticleService);
  private haptic = inject(HapticService);
  private eventBus = inject(EventBusService);
  private time = inject(TimeService);

  public onHitConfirmed(target: Entity, damage: number, isCrit: boolean): void {
    // Audio
    this.sound.play(isCrit ? 'CRIT' : 'HIT');

    // Haptics
    if (isCrit) {
      this.haptic.impactHeavy();
    } else {
      this.haptic.impactLight();
    }

    // Screen Shake
    if (isCrit) {
      this.eventBus.dispatch({
        type: GameEvents.ADD_SCREEN_SHAKE,
        payload: BALANCE.SHAKE.CRIT
      });
    }

    // Time Manipulation
    if (isCrit) {
      this.time.triggerSlowMo(100, 0.2);
    }

    const stopDuration = Math.min(10, Math.floor(BALANCE.COMBAT.HIT_STOP_FRAMES + damage / 10));
    this.time.triggerHitStop(stopDuration);

    // Damage Numbers
    this.spawnDamageNumber(target, damage, isCrit);
  }

  private spawnDamageNumber(target: Entity, damage: number, isCrit: boolean): void {
    const displayDamage = Math.ceil(damage);
    const color = isCrit ? '#f97316' : '#fff';
    const size = isCrit ? 30 : 20;
    const yOffset = isCrit ? -50 : -40;

    this.world.spawnFloatingText(
      target.x,
      target.y + yOffset,
      displayDamage.toString(),
      color,
      size
    );

    if (isCrit) {
      this.world.spawnFloatingText(
        target.x,
        target.y - 50,
        'CRITICAL!',
        '#facc15',
        10
      );
    }
  }

  public spawnDerezEffect(x: number, y: number): void {
    this.particles.addParticles({
      x, y, z: 20,
      count: 30,
      color: '#06b6d4',
      speed: 4,
      size: 3,
      type: 'square',
      life: 0.6,
      composite: 'lighter',
      emitsLight: true
    });

    this.particles.addParticles({
      x, y, z: 20,
      count: 15,
      color: '#a855f7',
      speed: 2,
      size: 4,
      type: 'square',
      life: 0.8
    });
  }

  public spawnExplosionEffect(x: number, y: number): void {
    this.sound.play('EXPLOSION');
    this.eventBus.dispatch({
      type: GameEvents.ADD_SCREEN_SHAKE,
      payload: BALANCE.SHAKE.EXPLOSION
    });

    this.particles.addParticles({
      x, y, z: 10,
      color: '#ef4444',
      count: 30,
      speed: 8,
      size: 4,
      type: 'square',
      emitsLight: true
    });
  }

  public spawnDebrisEffect(x: number, y: number): void {
    this.particles.addParticles({
      x, y, z: 10,
      color: '#a16207',
      count: 10,
      speed: 4,
      size: 2,
      type: 'square'
    });
  }
}