
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
import { LightingService } from '../systems/rendering/lighting.service';
import { GameStateService } from './game-state.service';
import { SpatialGridService } from '../systems/spatial-grid.service';
import { RealityCorrectorService } from '../core/reality-corrector.service';
import { PerformanceTelemetryService } from '../systems/performance-telemetry.service';
import { AdaptiveQualityService } from '../systems/adaptive-quality.service';
import { ProofKernelService } from '../core/proof/proof-kernel.service';
import { WORLD_GRAPH } from '../data/world/world-graph.config';
import { LeanRect } from '../core/lean-bridge.service';

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
  private lighting = inject(LightingService);
  private gameState = inject(GameStateService);
  private spatialGrid = inject(SpatialGridService);
  private realityCorrector = inject(RealityCorrectorService);
  private telemetry = inject(PerformanceTelemetryService);
  private adaptiveQuality = inject(AdaptiveQualityService);
  private proofKernel = inject(ProofKernelService);

  isInMenu = this.gameState.isInMenu;
  private frameCount = 0;

  init(canvas: HTMLCanvasElement) {
    this.renderer.init(canvas);
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    
    // Expose headless test to window for automated runners
    (window as any).runHeadlessGeometryTest = () => this.runHeadlessGeometryTest();
    
    this.loop();
  }

  /**
   * 4. Automation and CI for “practical certainty”
   * Sets STRICT_DEV mode and verifies all static geometry in the graph.
   */
  async runHeadlessGeometryTest() {
      console.group('%c[CI] HEADLESS GEOMETRY VERIFICATION', 'color: #a855f7; font-weight: bold; font-size: 14px;');
      
      // 1. Boot Kernel in STRICT_DEV (This ensures any failure THROWS)
      this.proofKernel.setGeometryGateMode('STRICT_DEV');
      
      try {
          // 2. Run Self Test
          console.log('[CI] Running Bridge Self-Test...');
          this.proofKernel.debugRunGeometrySelfTest();
          
          // 3. Iterate Sector Templates
          let totalZones = 0;
          const zones = Object.values(WORLD_GRAPH.zones);
          console.log(`[CI] Scanning ${zones.length} Zones in Graph...`);
          
          for (const config of zones) {
              const tmpl = config.template;
              
              // Skip zones with no static walls (e.g. purely procedural ones generated at runtime)
              if (!tmpl.geometry.walls || tmpl.geometry.walls.length === 0) continue;
              
              totalZones++;
              
              // Map to Canonical Model (LeanRect)
              // Note: We replicate the SectorLoader transformation here to ensure parity
              const rects: LeanRect[] = tmpl.geometry.walls.map((w, index) => {
                  const width = w.w || 40;
                  const depth = w.depth || w.h || 40; // Depth is H in schema usually, mapping carefully
                  
                  return {
                      id: `static_${tmpl.id}_${index}`,
                      x: w.x - (width / 2),
                      y: w.y - (depth / 2),
                      w: width,
                      h: depth
                  };
              });
              
              // This CALL will throw if invalid because we are in STRICT_DEV
              this.proofKernel.verifyGeometry(rects, tmpl.id, "CI_SCAN");
          }
          
          console.log(`%c[CI] SUCCESS. Verified ${totalZones} Zones. No Overlaps.`, 'color: #22c55e; font-weight: bold;');
          
      } catch (e: any) {
          console.error(`%c[CI] CRITICAL FAILURE: ${e.message}`, 'color: #ef4444; font-weight: bold;');
          // In a real CI environment, we would process.exit(1) here or similar
          throw e; // Re-throw to ensure caller knows
      } finally {
          // Always reset to SOFT_PROD so the game doesn't crash if played after test
          this.proofKernel.setGeometryGateMode('SOFT_PROD');
          console.groupEnd();
      }
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
              this.zoneManager.initWorld(this.player.currentSectorId() || 'HUB');
              this.mapService.setSector(this.player.currentSectorId() || 'HUB');
          }
      }
      this.isInMenu.set(false);
  }

  changeFloor(targetZoneId: string, spawnOverride?: {x: number, y: number}) {
      this.zoneManager.transitionToZone(targetZoneId, spawnOverride);
      this.mapService.setSector(targetZoneId);
      this.persistence.saveGame();
  }

  private loop = () => {
    const frameStart = performance.now();

    try {
        this.adaptiveQuality.evaluateAndAdjust();

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

    const frameDuration = performance.now() - frameStart;
    this.telemetry.recordFrame(frameDuration);

    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  private update() {
    if (this.world.player.hp <= 0) return;

    this.frameCount++;

    if (this.frameCount % 30 === 0) {
        this.spatialGrid.rebuildGrid(this.world.entities);
        this.spatialGrid.updateEntity(this.world.player, this.world.player.x, this.world.player.y);
    } else {
        this.world.entities.forEach(e => {
            if ((e.type === 'ENEMY' || e.type === 'PLAYER') && (e.vx !== 0 || e.vy !== 0)) {
                this.spatialGrid.updateEntity(e, e.x, e.y);
            }
        });
        this.spatialGrid.updateEntity(this.world.player, this.world.player.x, this.world.player.y);
    }

    this.player.updatePerFrame();
    this.playerControl.update(this.timeService.globalTime);
    this.entityUpdater.update(this.timeService.globalTime);
    this.worldEffects.update();
    
    this.lighting.update(1, this.timeService.globalTime);
    this.lighting.updateGlobalIllumination(this.world.currentZone());
    
    const request = this.playerControl.requestedFloorChange();
    if (request) {
        const isLegacyString = typeof request === 'string';
        const targetId = isLegacyString 
          ? (request as unknown as string) 
          : (request.id || ''); 
        const spawn = isLegacyString ? undefined : request.spawn;
        
        if (!targetId || targetId.length === 0) {
            this.playerControl.requestedFloorChange.set(null);
            return;
        }

        let finalTargetId = targetId;
        
        if (targetId === 'UP' || targetId === 'DOWN') {
             const currentZone = this.player.currentSectorId();
             if (currentZone === 'HUB' && targetId === 'DOWN') finalTargetId = 'SECTOR_9_N';
             else if (currentZone === 'SECTOR_9_N' && targetId === 'UP') finalTargetId = 'HUB';
             else {
                 this.playerControl.requestedFloorChange.set(null);
                 return;
             }
        }
        
        if (finalTargetId && finalTargetId !== 'UP' && finalTargetId !== 'DOWN') {
             this.changeFloor(finalTargetId, spawn);
        }
        this.playerControl.requestedFloorChange.set(null);
    }

    this.world.cleanup();
  }
}
