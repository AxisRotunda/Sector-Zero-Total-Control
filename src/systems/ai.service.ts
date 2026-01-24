
import { Injectable, inject } from '@angular/core';
import { Entity } from '../models/game.models';
import { WorldService } from '../game/world/world.service';
import { PlayerService } from '../game/player/player.service';
import { SoundService } from '../services/sound.service';
import { EntityPoolService } from '../services/entity-pool.service';
import { SquadAiService } from './squad-ai.service';
import { SpatialHashService } from './spatial-hash.service';
import { CombatService } from './combat.service';
import { NavigationService } from './navigation.service';
import * as BALANCE from '../config/balance.config';
import { AIStrategy, AIContext } from './ai-strategies/ai-interface';
import { 
    MeleeStrategy, 
    SniperStrategy, 
    StealthStrategy, 
    SupportStrategy, 
    SkirmisherStrategy 
} from './ai-strategies/common-strategies';

@Injectable({ providedIn: 'root' })
export class AiService {
  private world = inject(WorldService);
  private playerService = inject(PlayerService);
  private sound = inject(SoundService);
  private entityPool = inject(EntityPoolService);
  private squadAi = inject(SquadAiService);
  private spatialHash = inject(SpatialHashService);
  private combat = inject(CombatService);
  private navigation = inject(NavigationService);
  
  private aiContext: AIContext;
  private strategies = new Map<string, AIStrategy>();
  private defaultStrategy = new MeleeStrategy();

  constructor() {
      this.aiContext = {
          world: this.world,
          combat: this.combat,
          spatialHash: this.spatialHash,
          squadAi: this.squadAi,
          navigation: this.navigation,
          entityPool: this.entityPool,
          sound: this.sound
      };

      this.strategies.set('GRUNT', new MeleeStrategy()); // Flanker logic merged into moveTowardTarget pathing or separate strategy if needed, simpler is better for now
      this.strategies.set('HEAVY', new MeleeStrategy());
      this.strategies.set('BOSS', new MeleeStrategy());
      this.strategies.set('SNIPER', new SniperStrategy());
      this.strategies.set('STEALTH', new StealthStrategy());
      this.strategies.set('SUPPORT', new SupportStrategy());
      this.strategies.set('STALKER', new SkirmisherStrategy());
  }

  public updateEnemy(enemy: Entity, player: Entity): void {
    const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    const aggroRange = enemy.aggroRadius || 400;
    const leashRange = aggroRange * 2;
    
    // 1. Leashing (High Priority Override)
    let distFromHome = 0;
    if (enemy.homeX !== undefined && enemy.homeY !== undefined) {
        distFromHome = Math.hypot(enemy.x - enemy.homeX, enemy.y - enemy.homeY);
    }

    if (distFromHome > leashRange) {
        enemy.state = 'RETREAT';
        const homeAngle = Math.atan2(enemy.homeY! - enemy.y, enemy.homeX! - enemy.x);
        enemy.angle = homeAngle; 
        enemy.vx += Math.cos(homeAngle) * 0.5; 
        enemy.vy += Math.sin(homeAngle) * 0.5;
        if (enemy.hp < enemy.maxHp) enemy.hp += 0.5;
        
        if (distFromHome < 20) {
            enemy.state = 'IDLE';
            // Clear path when home
            if (enemy.data) enemy.data.path = null;
        }
        return;
    }

    // 2. Idle Check
    if (distToPlayer > aggroRange && enemy.state !== 'ATTACK' && enemy.state !== 'SUPPORT' && enemy.state !== 'CHARGE') {
        enemy.state = 'IDLE'; 
        if (enemy.hp < enemy.maxHp) enemy.hp += 0.1; 
        return;
    }

    // 3. Strategy Execution
    const strategy = this.strategies.get(enemy.subType!) || this.defaultStrategy;
    
    // Override logic for Support Role
    if (enemy.aiRole === 'SUPPORT') {
        this.strategies.get('SUPPORT')!.execute(enemy, player, this.aiContext);
    } else {
        strategy.execute(enemy, player, this.aiContext);
    }
    
    // 4. Low Health Cover Seeking (Override for non-Bosses)
    if (enemy.hp < enemy.maxHp * BALANCE.ENEMY_AI.COVER_HP_THRESHOLD && enemy.subType !== 'BOSS' && enemy.state !== 'RETREAT') {
        this.updateSeekCover(enemy, player);
    }
  }

  private updateSeekCover(enemy: Entity, player: Entity) {
      // Reuse existing cover logic but potentially use nav mesh later
      const { buffer, count } = this.spatialHash.queryFast(enemy.x, enemy.y, BALANCE.ENEMY_AI.COVER_SEEK_DISTANCE, enemy.zoneId);
      
      let bestCover: Entity | null = null; let bestDist = Infinity;
      
      for (let i = 0; i < count; i++) {
          const w = buffer[i];
          if (w.type === 'WALL') {
              const d = Math.hypot(w.x - enemy.x, w.y - enemy.y);
              if (d < bestDist) { bestDist = d; bestCover = w; }
          }
      }

      if (bestCover) {
          const w = bestCover.width || 40;
          const h = bestCover.depth || 40;
          const clampX = Math.max(bestCover.x - w/2, Math.min(player.x, bestCover.x + w/2));
          const clampY = Math.max(bestCover.y - h/2, Math.min(player.y, bestCover.y + h/2));
          const angleToWall = Math.atan2(clampY - player.y, clampX - player.x);
          const coverX = clampX + Math.cos(angleToWall) * (w + 40); 
          const coverY = clampY + Math.sin(angleToWall) * (h + 40);
          
          const coverAngle = Math.atan2(coverY - enemy.y, coverX - enemy.x);
          enemy.vx += Math.cos(coverAngle) * 0.5; 
          enemy.vy += Math.sin(coverAngle) * 0.5;
      }
  }
}
