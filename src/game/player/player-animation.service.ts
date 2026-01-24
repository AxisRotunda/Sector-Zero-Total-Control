
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
    const weaponSpeed = weapon.stats['spd'] || 1.0;
    
    const comboSpeedMult = player.comboIndex === 2 ? 0.7 : (player.comboIndex === 1 ? 0.85 : 1.0);
    const attackSpeedStat = this.stats.playerStats().speed * 0.1; 
    
    const baseSpeed = 3;
    const attackFrameDuration = Math.max(1, Math.floor(baseSpeed / (weaponSpeed + attackSpeedStat) * comboSpeedMult));

    const IDLE_FRAME_DURATION = 12; const IDLE_FRAMES = 4;
    const MOVE_FRAME_DURATION = 6; const MOVE_FRAMES = 6;
    
    const ATTACK_STARTUP_FRAMES = 2; 
    const ATTACK_ACTIVE_FRAMES = 3; 
    const ATTACK_TOTAL_FRAMES = 9;
    
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
            if (player.animFrameTimer >= attackFrameDuration) {
                player.animFrameTimer = 0; player.animFrame++;
                
                if (player.animFrame === 0) {
                    this.combat.currentAttackState = 'STARTUP';
                    player.animPhase = 'startup';
                }
                else if (this.combat.currentAttackState === 'STARTUP' && player.animFrame >= ATTACK_STARTUP_FRAMES) {
                    this.combat.currentAttackState = 'ACTIVE';
                    player.animPhase = 'active';
                    this.abilities.spawnPrimaryAttackHitbox(player);
                }
                else if (this.combat.currentAttackState === 'ACTIVE' && player.animFrame >= ATTACK_STARTUP_FRAMES + ATTACK_ACTIVE_FRAMES) {
                    this.combat.currentAttackState = 'RECOVERY';
                    player.animPhase = 'recovery';
                }
                if (player.animFrame >= ATTACK_TOTAL_FRAMES) { 
                    player.state = 'IDLE'; 
                    player.animFrame = 0; 
                    player.animPhase = undefined;
                    this.combat.currentAttackState = 'IDLE';
                    player.comboIndex = 0;
                    this.abilities.currentCombo.set(0);
                }
            } 
            break;
    }
  }
}
