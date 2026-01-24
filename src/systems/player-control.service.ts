
import { Injectable, inject } from '@angular/core';
import { WorldService } from '../game/world/world.service';
import { InputService } from '../services/input.service';
import { PhysicsService } from './physics.service';
import { InteractionService } from '../services/interaction.service';
import { CameraService } from '../game/camera.service';
import { PlayerMovementService } from '../game/player/player-movement.service';
import { PlayerCombatService } from '../game/player/player-combat.service';
import { PlayerAnimationService } from '../game/player/player-animation.service';

@Injectable({ providedIn: 'root' })
export class PlayerControlService {
    private world = inject(WorldService);
    private input = inject(InputService);
    private physics = inject(PhysicsService);
    private cameraService = inject(CameraService);
    private interaction = inject(InteractionService);
    
    // Sub-systems
    private movement = inject(PlayerMovementService);
    private combat = inject(PlayerCombatService);
    private animation = inject(PlayerAnimationService);

    // Facade properties for UI binding
    nearbyInteractable = this.interaction.nearbyInteractable;
    activeInteractable = this.interaction.activeInteractable;
    requestedFloorChange = this.interaction.requestedFloorChange;

    update(globalTime: number) {
        const player = this.world.player;
        
        // Handle Stun
        if (player.status.stun > 0) {
            player.status.stun--; 
            player.vx *= 0.9; 
            player.vy *= 0.9; 
            this.physics.updateEntityPhysics(player); 
            this.animation.update(player); 
            this.cameraService.update();
            return;
        }
        
        this.cameraService.update();
        this.animation.update(player);

        // Movement Logic
        let isMoving = false;
        if (player.state !== 'ATTACK') {
            this.combat.currentAttackState = 'IDLE';
            isMoving = this.movement.update(player, globalTime);
        }

        // Facing Logic
        if (player.state !== 'ATTACK') {
            if (this.input.aimAngle !== null) {
                player.angle = this.input.aimAngle - this.world.camera.rotation;
            } else if (isMoving) {
                const moveAngle = Math.atan2(player.vy, player.vx);
                player.angle = moveAngle;
            }
        }

        this.interaction.update(player, globalTime);
        this.combat.update(player);
    }
}
