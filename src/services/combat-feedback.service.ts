
import { Injectable, inject } from '@angular/core';
import { Entity } from '../models/game.models';
import { WorldService } from '../game/world/world.service';
import { SoundService } from '../services/sound.service';
import { ParticleService } from '../systems/particle.service';
import { HapticService } from '../services/haptic.service';
import { EventBusService } from '../core/events/event-bus.service';
import { GameEvents, CombatHitPayload } from '../core/events/game-events';
import { TimeService } from '../game/time.service';
import * as BALANCE from '../config/balance.config';
import { DamagePacket, DAMAGE_TYPE_COLORS } from '../models/damage.model';

@Injectable({ providedIn: 'root' })
export class CombatFeedbackService {
  private world = inject(WorldService);
  private sound = inject(SoundService);
  private particles = inject(ParticleService);
  private haptic = inject(HapticService);
  private eventBus = inject(EventBusService);
  private time = inject(TimeService);

  constructor() {
      // Listen to Combat Events
      this.eventBus.on(GameEvents.COMBAT_HIT_CONFIRMED).subscribe((payload: CombatHitPayload) => {
          this.onHitConfirmed(payload.target, payload.result.total, payload.result.isCrit, payload.result.breakdown);
      });
      
      // Could also listen to EnemyKilled for death effects
      this.eventBus.on(GameEvents.ENEMY_KILLED).subscribe((payload: { type: string }) => {
          // General death effect could be triggered here if we pass coordinates in payload
          // For now kept simple
      });
  }

  private onHitConfirmed(
    target: Entity, 
    damage: number, 
    isCrit: boolean,
    breakdown?: DamagePacket
  ): void {
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

    // Visual Effects based on target
    if (target.state === 'DEAD') {
        if (target.subType === 'BARREL') this.spawnExplosionEffect(target.x, target.y);
        else if (this.world.currentZone().isTrainingZone) this.spawnDerezEffect(target.x, target.y);
        else this.spawnDebrisEffect(target.x, target.y);
    }

    // Damage Numbers
    this.spawnDamageNumbers(target, damage, isCrit, breakdown);
  }

  private spawnDamageNumbers(
    target: Entity,
    totalDamage: number,
    isCrit: boolean,
    breakdown?: DamagePacket
  ): void {
    if (!breakdown) {
        this.spawnSingleDamageNumber(target, totalDamage, isCrit);
        return;
    }

    const significantTypes = [
        { type: 'physical', val: breakdown.physical, color: DAMAGE_TYPE_COLORS.physical },
        { type: 'fire', val: breakdown.fire, color: DAMAGE_TYPE_COLORS.fire },
        { type: 'cold', val: breakdown.cold, color: DAMAGE_TYPE_COLORS.cold },
        { type: 'lightning', val: breakdown.lightning, color: DAMAGE_TYPE_COLORS.lightning },
        { type: 'chaos', val: breakdown.chaos, color: DAMAGE_TYPE_COLORS.chaos }
    ].filter(t => t.val > 0.5);

    if (significantTypes.length === 0) {
        this.spawnSingleDamageNumber(target, totalDamage, isCrit);
        return;
    }

    significantTypes.sort((a, b) => b.val - a.val);
    const topTypes = significantTypes.slice(0, 2);

    let yOffset = isCrit ? -60 : -40;
    
    topTypes.forEach((t, i) => {
        const isMain = i === 0;
        const size = isCrit && isMain ? 26 : (isMain ? 20 : 16);
        const prefix = isCrit && isMain ? '!' : '';
        const offset = i * 20;

        this.world.spawnFloatingText(
            target.x + (i * 10),
            target.y + yOffset + offset,
            `${Math.ceil(t.val)}${prefix}`,
            t.color,
            size
        );
    });
  }

  private spawnSingleDamageNumber(target: Entity, damage: number, isCrit: boolean): void {
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
      x, y, z: 20, count: 30, color: '#06b6d4', speed: 4, size: 3, type: 'square', life: 0.6, composite: 'lighter', emitsLight: true
    });
    this.particles.addParticles({
      x, y, z: 20, count: 15, color: '#a855f7', speed: 2, size: 4, type: 'square', life: 0.8
    });
  }

  public spawnExplosionEffect(x: number, y: number): void {
    this.particles.addParticles({
      x, y, z: 10, color: '#ef4444', count: 30, speed: 8, size: 4, type: 'square', emitsLight: true
    });
  }

  public spawnDebrisEffect(x: number, y: number): void {
    this.particles.addParticles({
      x, y, z: 10, color: '#a16207', count: 10, speed: 4, size: 2, type: 'square'
    });
  }
}
