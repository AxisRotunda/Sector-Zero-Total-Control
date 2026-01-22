
import { Injectable, signal, inject } from '@angular/core';
import { SoundService } from '../services/sound.service';
import { RenderService } from '../systems/render.service';
import { WorldService } from './world/world.service';
import { PlayerService } from './player/player.service';
import { EntityUpdateService } from '../systems/entity-update.service';
import { PersistenceService } from '../core/persistence.service';
import { ParticleService } from '../systems/particle.service';
import { TutorialService } from '../services/tutorial.service';
import { PlayerControlService } from '../systems/player-control.service';
import { WorldEffectsService } from '../systems/world-effects.service';
import { WorldStateService } from './world/world-state.service';
import { TimeService } from './time.service';
import { MapService } from '../services/map.service';
import { ZoneManagerService } from './world/zone-manager.service';

@Injectable({
  providedIn: 'root'
})
export class GameEngineService {
  private animationFrameId: number = 0;
  
  private sound = inject(SoundService);
  private renderer = inject(RenderService);
  private world = inject(WorldService);
  private player = inject(PlayerService);
  private entityUpdater = inject(EntityUpdateService);
  private persistence = inject(PersistenceService);
  private particleService = inject(ParticleService);
  private tutorial = inject(TutorialService);
  private playerControl = inject(PlayerControlService);
  private worldEffects = inject(WorldEffectsService);
  private worldState = inject(WorldStateService);
  private timeService = inject(TimeService);
  private mapService = inject(MapService);
  private zoneManager = inject(ZoneManagerService);

  isInMenu = signal(true);

  init(canvas: HTMLCanvasElement) {
    this.renderer.init(canvas);
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.loop();
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  async startGame(isNew: boolean) {
      this.sound.init();
      if (isNew) {
          await this.persistence.resetGame();
          this.worldState.reset(); 
          this.zoneManager.initWorld('HUB');
          this.mapService.setSector('HUB');
          setTimeout(() => this.tutorial.trigger('START'), 1000);
      } else {
          const loaded = await this.persistence.loadGame();
          if (!loaded) {
              await this.persistence.resetGame();
              this.worldState.reset();
              this.zoneManager.initWorld('HUB');
              this.mapService.setSector('HUB');
              setTimeout(() => this.tutorial.trigger('START'), 1000);
          } else {
              // Load the current sector tracked in player service
              this.zoneManager.initWorld(this.player.currentSectorId() || 'HUB');
              this.mapService.setSector(this.player.currentSectorId() || 'HUB');
          }
      }
      this.isInMenu.set(false);
  }

  changeFloor(targetZoneId: string) {
      // Delegate completely to ZoneManager
      this.zoneManager.transitionToZone(targetZoneId);
      this.mapService.setSector(targetZoneId);
      this.persistence.saveGame();
  }

  private loop = () => {
    try {
        if (this.isInMenu()) {
            const t = Date.now();
            this.world.camera.x = Math.sin(t * 0.0005) * 500;
            this.world.camera.y = Math.cos(t * 0.0005) * 500;
        } else {
            if (this.timeService.tick()) {
                this.update();
            }
            if (this.timeService.globalTime % 1800 === 0) this.persistence.saveGame();
        }

        this.renderer.render(
            this.world.entities, 
            this.world.player, 
            this.particleService.particles, 
            this.world.floatingTexts, 
            this.world.camera, 
            this.world.currentZone(),
            this.world.rainDrops,
            this.player.screenShake()
        );

    } catch (e) { console.error(e); }
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  private update() {
    if (this.world.player.hp <= 0) return;

    this.player.updatePerFrame();
    
    // CRITICAL FIX: Player Input/Physics Update was missing
    this.playerControl.update(this.timeService.globalTime);
    
    this.entityUpdater.update(this.timeService.globalTime);
    this.worldEffects.update();
    
    // Check floor changes
    const request = this.playerControl.requestedFloorChange();
    if (request) {
        if (request === 'UP' || request === 'DOWN') {
             console.warn('Generic direction exit triggered. Mapping to default sectors.');
             // Fallback for generic exits if any remain
             if (this.player.currentSectorId() === 'HUB' && request === 'DOWN') this.changeFloor('SECTOR_9');
             else if (this.player.currentSectorId() === 'SECTOR_9' && request === 'UP') this.changeFloor('HUB');
        } else {
             this.changeFloor(request);
        }
        this.playerControl.requestedFloorChange.set(null);
    }

    this.world.cleanup();
  }
}
