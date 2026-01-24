
import { Injectable, inject } from '@angular/core';
import { Entity } from '../../models/game.models';
import { InputService } from '../../services/input.service';
import { PhysicsService } from '../../systems/physics.service';
import { CameraService } from '../camera.service';
import { PlayerService } from './player.service';
import { MapService } from '../../services/map.service';
import { HapticService } from '../../services/haptic.service';

@Injectable({ providedIn: 'root' })
export class PlayerMovementService {
  private input = inject(InputService);
  private physics = inject(PhysicsService);
  private cameraService = inject(CameraService);
  private playerService = inject(PlayerService);
  private mapService = inject(MapService);
  private haptic = inject(HapticService);

  private _rotatedInput = { x: 0, y: 0 };

  update(player: Entity, globalTime: number): boolean {
    const stats = this.playerService.playerStats();
    const prevVx = player.vx;
    const prevVy = player.vy;
    
    const cos = this.cameraService.rotationCos;
    const sin = -this.cameraService.rotationSin;
    
    const input = this.input.inputVector;
    
    // Rotate input based on camera angle
    this._rotatedInput.x = input.x * cos - input.y * sin;
    this._rotatedInput.y = input.x * sin + input.y * cos;

    // Physics Update
    const isMoving = this.physics.updateEntityPhysics(player, stats, this._rotatedInput);
    
    // Haptic Feedback on start move
    if (Math.hypot(input.x, input.y) > 0.5) {
        if (!isMoving && (Math.abs(prevVx) > 0.5 || Math.abs(prevVy) > 0.5)) {
            if (this.playerService.screenShake().intensity < 1) {
                this.haptic.impactLight();
            }
        }
    }

    if (isMoving) { 
        player.state = 'MOVE'; 
        if (globalTime % 10 === 0) this.mapService.updateDiscovery(player.x, player.y); 
    } else {
        player.state = 'IDLE';
    }

    return isMoving;
  }

  /**
   * Updates physics with zero input vector.
   * Useful for preserving momentum (sliding/lunging) during states where control is locked (e.g. ATTACK).
   * Does NOT modify player.state.
   */
  updateMomentum(player: Entity, globalTime: number) {
      const stats = this.playerService.playerStats();
      
      // Pass zero input to apply friction/slide logic only
      const isMoving = this.physics.updateEntityPhysics(player, stats, {x: 0, y: 0});
      
      // Still trigger discovery if the momentum carries us into new chunks
      if (isMoving && globalTime % 10 === 0) {
          this.mapService.updateDiscovery(player.x, player.y);
      }
  }
}
