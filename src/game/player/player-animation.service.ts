
import { Injectable, inject } from '@angular/core';
import { Entity } from '../../models/game.models';
import { InventoryService } from '../inventory.service';
import { PlayerStatsService } from './player-stats.service';
import { PlayerAbilitiesService } from './player-abilities.service';
import { PlayerCombatService } from './player-combat.service';
import { UNARMED_WEAPON } from '../../models/item.models';

@Injectable({ providedIn: 'root' })
export class PlayerAnimationService {
  private inventory = inject(InventoryService);
  private stats = inject(PlayerStatsService);
  private abilities = inject(PlayerAbilitiesService);
  private combat = inject(PlayerCombatService);

  update(player: Entity) {
    const weapon = this.inventory.equipped().weapon || UNARMED_WEAPON;
    
    // Animation Constants
    const IDLE_FRAME_DURATION = 12; const IDLE_FRAMES = 4;
    const MOVE_FRAME_DURATION = 6; const MOVE_FRAMES = 6;
    
    player.animFrameTimer++;
    
    switch (player.state) {
        case 'IDLE': 
            if (player.animFrameTimer >= IDLE_FRAME_DURATION) { 
                player.animFrameTimer = 0; player.animFrame = (player.animFrame + 1) % IDLE_FRAMES; 
            } 
            break;
        case 'MOVE': 
            if (player.animFrameTimer >= MOVE_FRAME_DURATION) { 
                player.animFrameTimer = 0; player.animFrame = (player.animFrame + 1) % MOVE_FRAMES; 
            } 
            break;
        case 'ATTACK':
            this.handleAttackAnimation(player);
            break;
    }
  }

  private handleAttackAnimation(player: Entity) {
      // 1. Get Combo Data via Signal
      const comboStep = this.abilities.activeComboStep();
      
      // Fallback if no combo step (e.g. ranged or error)
      if (!comboStep) {
          this.handleGenericAttack(player);
          return;
      }

      // 2. Map current frame to Attack Phase
      const frame = player.animFrameTimer;
      const total = comboStep.durationTotal;
      const start = comboStep.hitboxStart;
      const end = comboStep.hitboxEnd;

      // Determine Phase based on frame data
      if (frame < start) {
          this.combat.currentAttackState = 'STARTUP';
          player.animPhase = 'startup';
          // normalize frame for renderer (0 to 1)
          player.animFrame = (frame / start) * 2; // Maps to approx range for lerping
      } 
      else if (frame >= start && frame < end) {
          if (this.combat.currentAttackState !== 'ACTIVE') {
              this.abilities.spawnPrimaryAttackHitbox(player);
          }
          this.combat.currentAttackState = 'ACTIVE';
          player.animPhase = 'active';
          player.animFrame = ((frame - start) / (end - start)) * 2 + 2; 
      } 
      else if (frame >= end) {
          this.combat.currentAttackState = 'RECOVERY';
          player.animPhase = 'recovery';
          player.animFrame = ((frame - end) / (total - end)) * 3 + 5;
      }

      // End of animation
      if (frame >= total) {
          player.state = 'IDLE';
          player.animFrame = 0;
          player.animFrameTimer = 0;
          this.combat.currentAttackState = 'IDLE';
          
          // Note: Combo Index reset is handled by Cooldown/Timer in PlayerAbilities service
      }
  }

  private handleGenericAttack(player: Entity) {
      // Fallback for Ranged or Non-Combo attacks
      // Basic 9 frame cycle
      if (player.animFrameTimer >= 3) {
          player.animFrameTimer = 0;
          player.animFrame++;
          if (player.animFrame > 8) {
              player.state = 'IDLE';
              player.animFrame = 0;
              this.combat.currentAttackState = 'IDLE';
          }
      }
  }
}
