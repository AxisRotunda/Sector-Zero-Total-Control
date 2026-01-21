
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

    // Proxy signals for UI consumption
    nearbyInteractable = this.interaction.nearbyInteractable;
    activeInteractable = this.interaction.activeInteractable;
    requestedFloorChange = this.interaction.requestedFloorChange;

    update(globalTime: number) {
        const player = this.world.player;
        
        // Narrative Checks (e.g. unlocking gates based on flags)
        if (this.narrative.getFlag('GATE_OPEN')) {
            const gate = this.world.entities.find(e => e.type === 'EXIT' && e.locked);
            if (gate) { 
                gate.locked = false; 
                gate.color = '#22c55e'; 
                const guard = this.world.entities.find(e => e.subType === 'GUARD' && e.dialogueId === 'gate_locked'); 
                if (guard) guard.dialogueId = 'gate_unlocked'; 
            }
        }

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
        
        this.handleCombatInputs(player, globalTime);
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

        const canInterrupt = player.state === 'ATTACK' && player.animPhase === 'recovery';
        
        if (player.state !== 'ATTACK' || canInterrupt) {
            const cmd = this.inputBuffer.peekCommand();
            if (cmd) {
                if (player.state === 'ATTACK' && cmd.priority < 3) return;

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
         let closest: Entity | null = null; let minD = BALANCE.COMBAT.AUTO_ATTACK_RANGE;
         // FIX: Pass player.zoneId to auto-attack query
         const nearbyTargets = this.spatialHash.query(player.x, player.y, BALANCE.COMBAT.AUTO_ATTACK_RANGE, player.zoneId);
         
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
        const IDLE_FRAME_DURATION = 12; const IDLE_FRAMES = 4;
        const MOVE_FRAME_DURATION = 6; const MOVE_FRAMES = 6;
        const ATTACK_FRAME_DURATION = 3; const ATTACK_STARTUP_FRAMES = 2; const ATTACK_ACTIVE_FRAMES = 3; const ATTACK_TOTAL_FRAMES = 9;
        
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
                if (player.animFrameTimer >= ATTACK_FRAME_DURATION) {
                    player.animFrameTimer = 0; player.animFrame++;
                    if (player.animFrame < ATTACK_STARTUP_FRAMES) player.animPhase = 'startup';
                    else if (player.animFrame < ATTACK_STARTUP_FRAMES + ATTACK_ACTIVE_FRAMES) {
                        if (player.animPhase !== 'active') this.spawnPlayerPrimaryHitbox(player);
                        player.animPhase = 'active';
                    } else player.animPhase = 'recovery';
                    
                    if (player.animFrame >= ATTACK_TOTAL_FRAMES) { 
                        player.state = 'IDLE'; player.animFrame = 0; player.animPhase = undefined; 
                    }
                } 
                break;
        }
    }

    private spawnPlayerPrimaryHitbox(player: Entity) {
        const stats = this.playerService.playerStats();
        const reach = BALANCE.ABILITIES.PRIMARY_REACH_BASE + (stats.damage * BALANCE.ABILITIES.PRIMARY_REACH_DMG_SCALE);
        
        const hitbox = this.entityPool.acquire('HITBOX');
        hitbox.source = 'PLAYER'; 
        hitbox.x = player.x + Math.cos(player.angle) * 30; 
        hitbox.y = player.y + Math.sin(player.angle) * 30; 
        hitbox.z = 10;
        hitbox.vx = Math.cos(player.angle) * 2; 
        hitbox.vy = Math.sin(player.angle) * 2;
        hitbox.angle = player.angle; 
        hitbox.radius = reach; 
        hitbox.hp = stats.damage; 
        hitbox.maxHp = stats.damage; 
        hitbox.color = '#f97316'; 
        hitbox.state = 'ATTACK'; 
        hitbox.timer = 8;
        // FIX: Ensure hitbox has player's zoneId
        hitbox.zoneId = player.zoneId;
        
        this.world.entities.push(hitbox);
        this.haptic.impactMedium(); 
    }
}
