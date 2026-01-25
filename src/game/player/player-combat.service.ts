
import { Injectable, inject } from '@angular/core';
import { Entity } from '../../models/game.models';
import { InputService } from '../../services/input.service';
import { InputBufferService } from '../../services/input-buffer.service';
import { PlayerService } from './player.service';
import { SpatialHashService } from '../../systems/spatial-hash.service';
import { WorldService } from '../world/world.service';
import { TutorialService } from '../../services/tutorial.service';
import { InteractionService } from '../../services/interaction.service';
import { isEnemy, isDestructible } from '../../utils/type-guards';
import * as BALANCE from '../../config/balance.config';

@Injectable({ providedIn: 'root' })
export class PlayerCombatService {
  private input = inject(InputService);
  private inputBuffer = inject(InputBufferService);
  private playerService = inject(PlayerService);
  private spatialHash = inject(SpatialHashService);
  private world = inject(WorldService);
  private tutorial = inject(TutorialService);
  private interaction = inject(InteractionService);

  private attackState: 'IDLE' | 'STARTUP' | 'ACTIVE' | 'RECOVERY' = 'IDLE';

  get currentAttackState() { return this.attackState; }
  set currentAttackState(v) { this.attackState = v; }

  update(player: Entity) {
    if (this.world.currentZone().isSafeZone) return;

    this.handleInputs(player);
  }

  private handleInputs(player: Entity) {
    if (this.input.isDown('SKILL_1')) this.inputBuffer.addCommand('SECONDARY', this.input.aimAngle ?? undefined, 2);
    if (this.input.isDown('SKILL_2')) this.inputBuffer.addCommand('UTILITY', this.input.aimAngle ?? undefined, 2);
    if (this.input.isDown('SKILL_3')) this.inputBuffer.addCommand('DASH', this.input.aimAngle ?? undefined, 3);
    if (this.input.isDown('SKILL_4')) this.inputBuffer.addCommand('OVERLOAD', this.input.aimAngle ?? undefined, 3);
    
    const manualAttack = this.input.isAttackPressed || this.input.isDown('ATTACK');
    
    if (manualAttack) {
        let targetAngle = this.input.aimAngle;
        
        if (targetAngle === null) {
            const autoTarget = this.findBestTarget(player);
            if (autoTarget) {
                targetAngle = Math.atan2(autoTarget.y - player.y, autoTarget.x - player.x);
            } else if (Math.hypot(player.vx, player.vy) > 0.1) {
                targetAngle = Math.atan2(player.vy, player.vx);
            } else {
                targetAngle = player.angle;
            }
        } else {
            targetAngle -= this.world.camera.rotation;
        }
        
        this.inputBuffer.addCommand('PRIMARY', targetAngle ?? undefined, 1);
    }

    const autoCombat = this.playerService.autoCombatEnabled();
    const activeInteraction = this.interaction.activeInteractable();
    
    if (autoCombat && !activeInteraction && player.state !== 'ATTACK' && !manualAttack) {
         const nextCmd = this.inputBuffer.peekCommand();
         if (!nextCmd || nextCmd.priority <= 1) {
             this.handleAutoAttack(player);
         }
    }

    const canInterrupt = player.state === 'ATTACK' && this.attackState === 'RECOVERY';
    
    if (player.state !== 'ATTACK' || canInterrupt) {
        const cmd = this.inputBuffer.peekCommand();
        if (cmd) {
            if (player.state === 'ATTACK' && cmd.priority < 1) return;

            this.inputBuffer.consumeCommand();
            const targetAngle = cmd.angle ?? player.angle;
            this.playerService.useSkill(cmd.type, targetAngle);
        }
    }
  }

  private findBestTarget(player: Entity): Entity | null {
      const zoneId = this.world.currentZone().id;
      const range = 500; 
      // OPTIMIZATION: Zero-Alloc
      const { buffer, count } = this.spatialHash.queryFast(player.x, player.y, range, zoneId);
      
      let best: Entity | null = null;
      let minScore = Infinity;
      
      const playerDirX = Math.cos(player.angle);
      const playerDirY = Math.sin(player.angle);

      for (let i = 0; i < count; i++) {
          const e = buffer[i];
          if (e.id === player.id) continue;
          if (e.state === 'DEAD') continue;
          if (!isEnemy(e) && !isDestructible(e)) continue;
          
          const dx = e.x - player.x;
          const dy = e.y - player.y;
          const dist = Math.hypot(dx, dy);
          
          const dirX = dx / dist;
          const dirY = dy / dist;
          
          const dot = playerDirX * dirX + playerDirY * dirY;
          
          let score = dist;
          
          if (dot > 0) {
              score *= (1 - dot * 0.5); 
          } else {
              score += 300; 
          }
          
          if (isDestructible(e)) score += 150;

          if (score < minScore) {
              minScore = score;
              best = e;
          }
      }
      return best;
  }

  private handleAutoAttack(player: Entity) {
       const zoneId = this.world.currentZone().id;
       // OPTIMIZATION: Zero-Alloc
       const { buffer, count } = this.spatialHash.queryFast(player.x, player.y, BALANCE.COMBAT.AUTO_ATTACK_RANGE, zoneId);
       
       let closest: Entity | null = null; 
       let minD = BALANCE.COMBAT.AUTO_ATTACK_RANGE;
       
       for (let i = 0; i < count; i++) {
          const e = buffer[i];
          if ((isEnemy(e) || isDestructible(e)) && e.state !== 'DEAD') {
              const d = Math.hypot(e.x - player.x, e.y - player.y);
              if (d < minD) { minD = d; closest = e; }
          }
      }

      if (closest) {
           if (isEnemy(closest)) this.tutorial.trigger('COMBAT');
           const targetAngle = Math.atan2((closest as Entity).y - player.y, (closest as Entity).x - player.x);
           const speed = Math.hypot(player.vx, player.vy);
           if (speed < 0.5 && !this.input.usingKeyboard()) {
               this.inputBuffer.addCommand('PRIMARY', targetAngle, 0);
           }
      }
  }
}
