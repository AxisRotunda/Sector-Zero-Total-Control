
import { Injectable, inject } from '@angular/core';
import { Entity } from '../models/game.models';
import { WorldService } from '../game/world/world.service';
import { ParticleService } from './particle.service';
import * as BALANCE from '../config/balance.config';
import { ProofKernelService } from '../core/proof/proof-kernel.service';
import { EventBusService } from '../core/events/event-bus.service';
import { GameEvents } from '../core/events/game-events';

@Injectable({ providedIn: 'root' })
export class StatusEffectService {
  private world = inject(WorldService);
  private particleService = inject(ParticleService);
  private proofKernel = inject(ProofKernelService);
  private eventBus = inject(EventBusService);

  public processStatusEffects(e: Entity, globalTime: number): void {
    if (e.hp <= 0) return;

    // --- AXIOM CHECK ---
    const proof = this.proofKernel.verifyStatusEffects(e);
    if (!proof.isValid) {
        this.eventBus.dispatch({
            type: GameEvents.REALITY_BLEED,
            payload: {
                severity: 'LOW',
                source: `STATUS_CHECK:${e.id}`,
                message: proof.errors[0]
            }
        });
        
        // Auto-Correction: Reset status if corrupted
        e.status = { stun: 0, slow: 0, poison: null, burn: null, weakness: null, bleed: null };
        return;
    }

    if (e.status.poison && e.status.poison.timer > 0) {
        e.status.poison.timer--;
        if (globalTime % BALANCE.STATUS.TICK_RATE === 0) {
            e.hp -= e.status.poison.dps;
            e.hitFlash = 5;
            this.world.spawnFloatingText(e.x, e.y - 20, `${e.status.poison.dps}`, '#84cc16', 14);
            this.particleService.addParticles({ x: e.x, y: e.y, z: 10, color: '#84cc16', count: 2, speed: 1, size: 2, type: 'circle' });
        }
        if (e.status.poison.timer <= 0) e.status.poison = null;
    }

    if (e.status.burn && e.status.burn.timer > 0) {
        e.status.burn.timer--;
        if (globalTime % BALANCE.STATUS.TICK_RATE === 0) {
            e.hp -= e.status.burn.dps;
            e.hitFlash = 5;
            this.world.spawnFloatingText(e.x, e.y - 20, `${e.status.burn.dps}`, '#f97316', 14);
            this.particleService.addParticles({ x: e.x, y: e.y, z: 10, color: '#f97316', count: 3, speed: 2, size: 3, type: 'square' });
        }
        if (e.status.burn.timer <= 0) e.status.burn = null;
    }

    if (e.status.bleed && e.status.bleed.timer > 0) {
      e.status.bleed.timer--;
      if (globalTime % BALANCE.STATUS.TICK_RATE === 0) {
        const damage = e.status.bleed.dps * e.status.bleed.stacks;
        e.hp -= damage;
        e.hitFlash = 3;
        this.world.spawnFloatingText(e.x, e.y - 20, `${Math.floor(damage)}`, '#dc2626', 14);
        this.particleService.addParticles({ x: e.x, y: e.y - 10, z: e.z, color: '#dc2626', count: e.status.bleed.stacks, speed: 0.5, size: 2, type: 'circle', life: 0.8 });
      }
      if (e.status.bleed.timer <= 0) e.status.bleed = null;
    }

    if (e.status.weakness && e.status.weakness.timer > 0) {
        e.status.weakness.timer--;
        if (e.status.weakness.timer <= 0) e.status.weakness = null;
    }
  }
}
