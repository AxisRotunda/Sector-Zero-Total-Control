
import { Injectable, inject, computed } from '@angular/core';
import { WorldService } from '../game/world/world.service';
import { PlayerService } from '../game/player/player.service';
import { InputService } from '../services/input.service';
import { PhysicsService } from './physics.service';
import { SpatialHashService } from './spatial-hash.service';
import { MapService } from '../services/map.service';
import { TutorialService } from '../services/tutorial.service';
import { EntityPoolService } from '../services/entity-pool.service';
import { NarrativeService } from '../game/narrative.service';
import * as BALANCE from '../config/balance.config';
import { Entity } from '../models/game.models';
import { isEnemy, isDestructible } from '../utils/type-guards';
import { InputBufferService } from '../services/input-buffer.service';
import { HapticService } from '../services/haptic.service';
import { CameraService } from '../game/camera.service';
import { InteractionService } from '../services/interaction.service';
import { InventoryService } from '../game/inventory.service';

@Injectable({ providedIn: 'root' })
export class PlayerControlService {
    private world = inject(WorldService);
    private playerService = inject(PlayerService);
    private input = inject(InputService);
    private physics = inject(PhysicsService);
    private spatialHash = inject(SpatialHashService);
    private mapService = inject(MapService);
    private tutorial = inject(TutorialService);
    private entityPool = inject(EntityPoolService);
    private narrative = inject(NarrativeService);
    private inputBuffer = inject(InputBufferService);
    private haptic = inject(HapticService);
    private cameraService = inject(CameraService);
    private interaction = inject(InteractionService);
    private inventory = inject(InventoryService);

    // Proxy signals for UI consumption
    nearbyInteractable = this.interaction.nearbyInteractable;
    activeInteractable = this.interaction.activeInteractable;
    requestedFloorChange = this.interaction.requestedFloorChange;

    // Explicit Attack State Machine
    private attackState: 'IDLE' | 'STARTUP' | 'ACTIVE' | 'RECOVERY' = 'IDLE';

    update(globalTime: number) {
        const player = this.world.player;
        
        // Status Effects (Stun)
        if (player.status.stun > 0) {
            player.status.stun--; 
            player.vx *= 0.9; 
            player.vy *= 0.9; 
            this.physics.updateEntityPhysics(player); 
            this.updatePlayerAnimation(player); 
            this.cameraService.update();
            return;
        }
        
        // Camera & Animation
        this.cameraService.update();
        this.updatePlayerAnimation(player);

        // Movement Physics
        if (player.state !== 'ATTACK') {
            // Reset attack state if not attacking
            this.attackState = 'IDLE'; 
            
            const stats = this.playerService.playerStats();
            const prevVx = player.vx;
            const prevVy = player.vy;
            
            const isMoving = this.physics.updateEntityPhysics(player, stats, this.input.inputVector);
            
            // Haptic feedback for sudden stops (wall hits)
            if (Math.hypot(this.input.inputVector.x, this.input.inputVector.y) > 0.5) {
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
        }

        if (this.input.aimAngle !== null && player.state !== 'ATTACK') player.angle = this.input.aimAngle;

        // Delegate Interaction Logic
        this.interaction.update(player, globalTime);
        
        // Only allow combat inputs if NOT in a safe zone
        if (!this.world.currentZone().isSafeZone) {
            this.handleCombatInputs(player, globalTime);
        }
    }

    private handleCombatInputs(player: Entity, globalTime: number) {
        if (this.input.isDown('SKILL_1')) this.inputBuffer.addCommand('SECONDARY', this.input.aimAngle ?? undefined, 2);
        if (this.input.isDown('SKILL_2')) this.inputBuffer.addCommand('UTILITY', this.input.aimAngle ?? undefined, 2);
        if (this.input.isDown('SKILL_3')) this.inputBuffer.addCommand('DASH', this.input.aimAngle ?? undefined, 3);
        if (this.input.isDown('SKILL_4')) this.inputBuffer.addCommand('OVERLOAD', this.input.aimAngle ?? undefined, 3);
        
        const manualAttack = this.input.isAttackPressed || this.input.isDown('ATTACK');
        if (manualAttack) this.inputBuffer.addCommand('PRIMARY', this.input.aimAngle ?? undefined, 1);

        const autoCombat = this.playerService.autoCombatEnabled();
        
        // Auto-combat check
        if (autoCombat && !this.activeInteractable() && player.state !== 'ATTACK') {
             const nextCmd = this.inputBuffer.peekCommand();
             if (!nextCmd || nextCmd.priority <= 1) {
                 this.handleAutoAttack(player);
             }
        }

        // Chaining Logic: Allow input consumption during recovery or if not attacking
        const canInterrupt = player.state === 'ATTACK' && this.attackState === 'RECOVERY';
        
        if (player.state !== 'ATTACK' || canInterrupt) {
            const cmd = this.inputBuffer.peekCommand();
            if (cmd) {
                // If attacking, only accept high priority or primary (for combos)
                if (player.state === 'ATTACK' && cmd.priority < 1) return;

                this.inputBuffer.consumeCommand();
                
                let targetAngle = cmd.angle ?? player.angle;
                // Auto-aim if stick is pushed but no mouse/stick aim
                if (cmd.type === 'PRIMARY' && cmd.angle === undefined && Math.hypot(this.input.inputVector.x, this.input.inputVector.y) > 0.1) {
                    targetAngle = Math.atan2(this.input.inputVector.y, this.input.inputVector.x);
                }
                this.playerService.useSkill(cmd.type, targetAngle);
            }
        }
    }

    private handleAutoAttack(player: Entity) {
         // CRITICAL FIX: Use current zoneId for spatial queries
         const zoneId = this.world.currentZone().id;
         const nearbyTargets = this.spatialHash.query(player.x, player.y, BALANCE.COMBAT.AUTO_ATTACK_RANGE, zoneId);
         
         let closest: Entity | null = null; 
         let minD = BALANCE.COMBAT.AUTO_ATTACK_RANGE;
         
         nearbyTargets.forEach(e => {
            if ((isEnemy(e) || isDestructible(e)) && e.state !== 'DEAD') {
                const d = Math.hypot(e.x - player.x, e.y - player.y);
                if (d < minD) { minD = d; closest = e; }
            }
        });

        if (closest) {
             if (isEnemy(closest)) this.tutorial.trigger('COMBAT');
             const targetAngle = Math.atan2((closest as Entity).y - player.y, (closest as Entity).x - player.x);
             const speed = Math.hypot(player.vx, player.vy);
             if (speed < 0.5 && !this.input.usingKeyboard()) {
                 this.inputBuffer.addCommand('PRIMARY', targetAngle, 0);
             }
        }
    }

    private updatePlayerAnimation(player: Entity) {
        // Calculate Speed based on Weapon Stats
        const weapon = this.inventory.equipped().weapon;
        const weaponSpeed = weapon?.stats?.['spd'] || 1.0;
        // Faster animations for later combo steps
        const comboSpeedMult = player.comboIndex === 2 ? 0.7 : (player.comboIndex === 1 ? 0.85 : 1.0);
        const attackSpeedStat = this.playerService.stats.playerStats().speed * 0.1; // Minor impact from Agility
        
        const baseSpeed = 3;
        // Formula: Higher speed stat -> Lower duration
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
                    
                    // --- ATTACK STATE MACHINE ---
                    
                    // 1. Initial State
                    if (player.animFrame === 0) {
                        this.attackState = 'STARTUP';
                        player.animPhase = 'startup';
                    }
                    
                    // 2. Startup -> Active (Hitbox Spawn)
                    else if (this.attackState === 'STARTUP' && player.animFrame >= ATTACK_STARTUP_FRAMES) {
                        this.attackState = 'ACTIVE';
                        player.animPhase = 'active';
                        // Frame-Locked Hitbox Spawn
                        this.playerService.abilities.spawnPrimaryAttackHitbox(player);
                    }
                    
                    // 3. Active -> Recovery
                    else if (this.attackState === 'ACTIVE' && player.animFrame >= ATTACK_STARTUP_FRAMES + ATTACK_ACTIVE_FRAMES) {
                        this.attackState = 'RECOVERY';
                        player.animPhase = 'recovery';
                    }
                    
                    // 4. End of Animation
                    if (player.animFrame >= ATTACK_TOTAL_FRAMES) { 
                        player.state = 'IDLE'; 
                        player.animFrame = 0; 
                        player.animPhase = undefined;
                        this.attackState = 'IDLE';
                        // If we didn't chain, reset combo
                        player.comboIndex = 0;
                        this.playerService.abilities.currentCombo.set(0);
                    }
                } 
                break;
        }
    }
}
