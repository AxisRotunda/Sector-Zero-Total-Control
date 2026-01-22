
import { Injectable, signal, inject } from '@angular/core';
import * as BALANCE from '../../config/balance.config';
import { PlayerStatsService } from './player-stats.service';
import { SoundService } from '../../services/sound.service';
import { WorldService } from '../world/world.service';
import { EntityPoolService } from '../../services/entity-pool.service';
import { ParticleService } from '../../systems/particle.service';
import { InventoryService } from '../inventory.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { GameEvents } from '../../core/events/game-events';

@Injectable({ providedIn: 'root' })
export class PlayerAbilitiesService {
  private stats = inject(PlayerStatsService);
  private sound = inject(SoundService);
  private world = inject(WorldService);
  private entityPool = inject(EntityPoolService);
  private particleService = inject(ParticleService);
  private inventory = inject(InventoryService);
  private eventBus = inject(EventBusService);

  cooldowns = signal({ primary: 0, secondary: 0, dash: 0, utility: 0 });
  maxCooldowns = signal({ primary: BALANCE.COOLDOWNS.PRIMARY, secondary: BALANCE.COOLDOWNS.SECONDARY, dash: BALANCE.COOLDOWNS.DASH, utility: BALANCE.COOLDOWNS.UTILITY });

  // Combo State
  currentCombo = signal(0);
  private readonly MAX_COMBO = 3;

  updateCooldowns() {
    this.cooldowns.update(c => ({
        primary: Math.max(0, c.primary - 1), secondary: Math.max(0, c.secondary - 1), dash: Math.max(0, c.dash - 1), utility: Math.max(0, c.utility - 1)
    }));
  }

  useSkill(skill: 'PRIMARY' | 'SECONDARY' | 'DASH' | 'UTILITY' | 'OVERLOAD' | 'SHIELD_BASH', targetAngle?: number) {
    const player = this.world.player;
    if (player.hp <= 0 || player.status.stun > 0) return;
    const stats = this.stats.playerStats();
    const cds = this.cooldowns();

    if (skill === 'PRIMARY') {
        const canCombo = player.state === 'ATTACK' && player.animPhase === 'recovery';
        
        if (cds.primary > 0 && !canCombo) return;
        
        let newComboIndex = 0;
        if (canCombo) {
            newComboIndex = (this.currentCombo() + 1) % this.MAX_COMBO;
        }
        this.currentCombo.set(newComboIndex);
        player.comboIndex = newComboIndex;

        const baseCdr = Math.max(0, Math.min(BALANCE.COOLDOWNS.CDR_CAP, stats.cdr / 100));
        // Reduce cooldown for combo chain hits to make it fluid
        const cdTime = canCombo ? 15 : BALANCE.COOLDOWNS.PRIMARY;
        const cooldown = Math.max(10, cdTime * (1 - baseCdr)); 
        
        this.maxCooldowns.update(c => ({...c, primary: cooldown})); 
        this.cooldowns.update(c => ({...c, primary: cooldown}));
        
        const attackDir = targetAngle ?? player.angle;
        player.angle = attackDir; 
        player.state = 'ATTACK'; 
        player.animFrame = 0; 
        player.animFrameTimer = 0; 
        player.animPhase = 'startup';
        
        // Vary shake intensity by combo step
        const shakeIntensity = 2 + newComboIndex;
        this.eventBus.dispatch({ type: GameEvents.ADD_SCREEN_SHAKE, payload: { intensity: shakeIntensity, decay: 0.9, x: Math.cos(attackDir), y: Math.sin(attackDir) } });
        
        // Pitch shift sound slightly for combos
        this.sound.play('SHOOT'); 
    }
    if (skill === 'SECONDARY') {
        const cost = 50;
        if (cds.secondary > 0 || this.stats.psionicEnergy() < cost) return;
        this.stats.psionicEnergy.update(e => e - cost);
        this.cooldowns.update(c => ({...c, secondary: 300}));
        
        const hitbox = this.entityPool.acquire('HITBOX');
        hitbox.zoneId = player.zoneId; // VISIBILITY FIX
        hitbox.source = 'PSIONIC'; hitbox.x = player.x; hitbox.y = player.y; hitbox.radius = 120 + stats.psyche * 3; hitbox.hp = 15 + stats.psyche * 2; hitbox.color = '#a855f7'; hitbox.state = 'ATTACK'; hitbox.timer = 10; hitbox.knockbackForce = 20; hitbox.psionicEffect = 'wave';
        this.world.entities.push(hitbox);
        this.eventBus.dispatch({ type: GameEvents.ADD_SCREEN_SHAKE, payload: BALANCE.SHAKE.EXPLOSION });
        this.sound.play('EXPLOSION');
    }
    if (skill === 'DASH') {
        if (cds.dash > 0) return;
        this.cooldowns.update(c => ({...c, dash: 40}));
        // Reset combo on dash
        this.currentCombo.set(0); 
        player.comboIndex = 0;
        
        const dashDir = targetAngle ?? player.angle;
        player.vx += Math.cos(dashDir) * 20; player.vy += Math.sin(dashDir) * 20;
        this.particleService.addParticles({ x: player.x, y: player.y, z: 0, color: '#71717a', count: 10, speed: 2, life: 0.5, size: 2, type: 'circle' });
        this.sound.play('DASH');
    }
    if (skill === 'UTILITY') {
        const cost = 35;
        if (cds.utility > 0 || this.stats.psionicEnergy() < cost) return;
        this.stats.psionicEnergy.update(e => e - cost);
        this.cooldowns.update(c => ({...c, utility: BALANCE.COOLDOWNS.UTILITY}));
        const angle = targetAngle ?? player.angle;
        const hitbox = this.entityPool.acquire('HITBOX');
        hitbox.zoneId = player.zoneId; // VISIBILITY FIX
        hitbox.source = 'PSIONIC'; 
        hitbox.x = player.x + Math.cos(angle) * 70; 
        hitbox.y = player.y + Math.sin(angle) * 70; 
        hitbox.radius = 60; 
        hitbox.hp = 5 + stats.psyche * 0.5; // Less damage
        hitbox.timer = 8; 
        hitbox.color = '#a855f7'; 
        hitbox.status.stun = 30; 
        hitbox.knockbackForce = -15; // VACUUM PULL
        hitbox.psionicEffect = 'wave';
        this.world.entities.push(hitbox);
        this.sound.play('CHARGE');
    }
    if (skill === 'SHIELD_BASH') {
        const cost = 40;
        if (cds.utility > 0 || this.stats.psionicEnergy() < cost) return;
        this.stats.psionicEnergy.update(e => e - cost);
        this.cooldowns.update(c => ({...c, utility: 200}));

        const angle = targetAngle ?? player.angle;
        player.vx += Math.cos(angle) * 10;
        player.vy += Math.sin(angle) * 10;

        const hitbox = this.entityPool.acquire('HITBOX');
        hitbox.zoneId = player.zoneId; // VISIBILITY FIX
        hitbox.source = 'PLAYER';
        hitbox.x = player.x + Math.cos(angle) * 40;
        hitbox.y = player.y + Math.sin(angle) * 40;
        hitbox.radius = 80;
        hitbox.hp = 25;
        hitbox.timer = 6;
        hitbox.color = '#fbbf24';
        hitbox.status.stun = 45;
        hitbox.knockbackForce = 15;
        this.world.entities.push(hitbox);
        this.sound.play('IMPACT');
    }
    if (skill === 'OVERLOAD') {
        if (this.stats.psionicEnergy() < this.stats.maxPsionicEnergy()) return;
        this.stats.psionicEnergy.set(0);
        this.world.player.status.stun = 120;
        const explosion = this.entityPool.acquire('HITBOX');
        explosion.zoneId = player.zoneId; // VISIBILITY FIX
        explosion.source = 'PSIONIC'; explosion.x = player.x; explosion.y = player.y; explosion.radius = 350; explosion.hp = 100 + this.stats.playerStats().psyche * 5; explosion.knockbackForce = 50; explosion.timer = 15; explosion.color = '#f0abfc'; explosion.psionicEffect = 'wave';
        this.world.entities.push(explosion);
        this.eventBus.dispatch({ type: GameEvents.ADD_SCREEN_SHAKE, payload: { intensity: 30, decay: 0.7 } });
        this.sound.play('EXPLOSION');
    }
  }
  reset() { this.cooldowns.set({ primary: 0, secondary: 0, dash: 0, utility: 0 }); this.currentCombo.set(0); }
}
