
import { Injectable, inject } from '@angular/core';
import { WorldService } from '../game/world/world.service';
import { PhysicsService } from './physics.service';
import { AiService } from './ai.service';
import { CollisionService } from './collision.service';
import { SpawnerService } from './spawner.service';
import { StatusEffectService } from './status-effect.service';
import { NpcUpdateService } from './npc-update.service';
import { CombatService } from './combat.service';
import { SpatialHashService } from './spatial-hash.service';
import { NarrativeService } from '../game/narrative.service';
import { Entity } from '../models/game.models';
import { SoundService } from '../services/sound.service';
import { HapticService } from '../services/haptic.service';

@Injectable({ providedIn: 'root' })
export class EntityUpdateService {
  private world = inject(WorldService);
  private physics = inject(PhysicsService);
  private ai = inject(AiService);
  private collision = inject(CollisionService);
  private spawner = inject(SpawnerService);
  private status = inject(StatusEffectService);
  private npc = inject(NpcUpdateService);
  private combat = inject(CombatService);
  private spatialHash = inject(SpatialHashService);
  private narrative = inject(NarrativeService);
  private sound = inject(SoundService);
  private haptic = inject(HapticService);

  update(globalTime: number) {
    const player = this.world.player;
    const entities = this.world.entities;

    // 1. Spatial Hash Maintenance (The Bridge to Rendering)
    // Clear previous frame's dynamic buckets so we don't have ghost entries
    this.spatialHash.clearDynamic();
    
    // Register Player (Dynamic) so enemies can query position via Hash
    this.spatialHash.insert(player, false);

    // Register all Dynamic Entities
    for (let i = 0; i < entities.length; i++) {
        // Insert before logic to ensure physics/AI queries against reasonably fresh data
        this.spatialHash.insert(entities[i], false);
    }

    // 2. Logic Updates
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e.state === 'DEAD') continue;

      // CRITICAL: Decrement hit flash timer
      if (e.hitFlash > 0) e.hitFlash--;

      this.status.processStatusEffects(e, globalTime);

      if (e.hitStopFrames && e.hitStopFrames > 0) {
          e.hitStopFrames--;
          continue; // Skip logic this frame for impact weight
      }
      
      // Reset hit stun flag if frames are done
      if (e.hitStopFrames <= 0) e.isHitStunned = false;

      if (e.type === 'ENEMY') {
        this.ai.updateEnemy(e, player);
        this.physics.updateEntityPhysics(e, { speed: e.speed });
      } else if (e.type === 'HITBOX') {
        e.x += e.vx; e.y += e.vy;
        e.timer--;
        this.collision.checkHitboxCollisions(e);
      } else if (e.type === 'PICKUP') {
        this.combat.updatePickup(e);
        this.physics.updateEntityPhysics(e);
      } else if (e.type === 'SPAWNER') {
        this.spawner.updateSpawner(e);
      } else if (e.type === 'NPC') {
        if (e.subType === 'TURRET') this.npc.updateTurret(e);
        else if (e.subType === 'GUARD') this.npc.updateGuard(e);
        else if (e.subType === 'CITIZEN') this.npc.updateCitizen(e);
        else this.npc.updateGenericNpc(e);
        
        this.physics.updateEntityPhysics(e, { speed: e.speed || 1 });
      } else if (e.type === 'DECORATION') {
          if (e.subType === 'VENT') this.npc.updateSteamVent(e);
          if (e.subType === 'SLUDGE') this.npc.updateSludge(e, globalTime);
          if (e.subType === 'OVERSEER_EYE') this.npc.updateOverseerEye(e);
      } else if (e.type === 'DESTRUCTIBLE') {
          this.physics.updateEntityPhysics(e);
      } else if (e.type === 'WALL' && e.subType === 'GATE_SEGMENT') {
          this.updateGate(e);
      } else if (e.type === 'EXIT' && e.locked) {
          this.updateLockedExit(e);
      }
    }
  }

  private updateGate(gate: Entity) {
      const shouldOpen = this.narrative.getFlag('GATE_OPEN');
      
      // Initialize openness if undefined
      if (gate.openness === undefined) gate.openness = gate.locked ? 0 : 1;

      if (shouldOpen) {
          if (gate.locked) {
              gate.locked = false;
              gate.color = '#22c55e'; // Visual feedback for unlocked
              this.haptic.success();
              this.sound.play('GATE_OPEN');
          }

          if (gate.openness < 1.0) {
              gate.openness += 0.01; // Smooth open speed
              if (gate.openness > 1.0) gate.openness = 1.0;
          }
      } else {
          // Ensure it stays closed/locked if not triggered
          gate.locked = true;
          if (gate.openness > 0.0) {
              gate.openness -= 0.02;
              if (gate.openness < 0) gate.openness = 0;
          }
      }
  }

  private updateLockedExit(exit: Entity) {
      // Check if narrative flag has unlocked this exit globally
      if (this.narrative.getFlag('GATE_OPEN')) {
          exit.locked = false;
          exit.color = '#22c55e';
          // Find associated guard dialogue update if nearby (Simple optimization)
          // In a real system, this would be event driven
          const guard = this.world.entities.find(e => e.subType === 'GUARD' && e.dialogueId === 'gate_locked' && Math.hypot(e.x - exit.x, e.y - exit.y) < 300);
          if (guard) guard.dialogueId = 'gate_unlocked';
      }
  }
}
