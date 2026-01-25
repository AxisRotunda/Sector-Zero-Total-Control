
import { Injectable, inject, signal } from '@angular/core';
import { Entity, Zone, FloatingText, Camera, Particle, RenderLayer } from '../models/game.models';
import { WorldService } from '../game/world/world.service';
import { FloorRendererService } from './rendering/floor-renderer.service';
import { StructureRendererService } from './rendering/structure-renderer.service';
import { UnitRendererService } from './rendering/unit-renderer.service';
import { ShadowRendererService } from './rendering/shadow-renderer.service';
import { EffectRendererService } from './rendering/effect-renderer.service';
import { EntityRendererService } from './rendering/entity-renderer.service'; 
import { LightingRendererService } from './rendering/lighting-renderer.service';
import { IsoUtils } from '../utils/iso-utils';
import { PlayerService } from '../game/player/player.service';
import { EntitySorterService } from './rendering/entity-sorter.service';
import { RENDER_CONFIG } from './rendering/render.config';
import { InputService } from '../services/input.service';
import { SpatialHashService } from './spatial-hash.service';
import { InteractionService } from '../services/interaction.service';
import { ChunkManagerService } from '../game/world/chunk-manager.service';
import { LightingService } from './rendering/lighting.service';
import { TimeService } from '../game/time.service';
import { MissionService } from '../game/mission.service';
import { PerformanceManagerService } from '../game/performance-manager.service';
import { isParticle } from '../utils/type-guards';
import { StaticBatchRendererService, BakedTile } from './rendering/static-batch-renderer.service';
import { LightmapBakerService } from './rendering/lightmap-baker.service';
import { CullingService } from './rendering/culling.service';
import { ProofKernelService } from '../core/proof/proof-kernel.service';
import { EventBusService } from '../core/events/event-bus.service';
import { GameEvents } from '../core/events/game-events';
import { AdaptiveQualityService } from './adaptive-quality.service';

@Injectable({
  providedIn: 'root'
})
export class RenderService {
  private ctx: CanvasRenderingContext2D | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private resizeListener: (() => void) | null = null;
  
  private world = inject(WorldService);
  private sorter = inject(EntitySorterService);
  private inputService = inject(InputService);
  private spatialHash = inject(SpatialHashService);
  private chunkManager = inject(ChunkManagerService);
  private interaction = inject(InteractionService);
  private lighting = inject(LightingService);
  private timeService = inject(TimeService);
  private mission = inject(MissionService);
  private performanceManager = inject(PerformanceManagerService);
  private adaptiveQuality = inject(AdaptiveQualityService);
  
  // Renderers
  private floorRenderer = inject(FloorRendererService);
  private structureRenderer = inject(StructureRendererService);
  private unitRenderer = inject(UnitRendererService);
  private shadowRenderer = inject(ShadowRendererService);
  private effectRenderer = inject(EffectRendererService);
  private entityRenderer = inject(EntityRendererService);
  private lightingRenderer = inject(LightingRendererService);
  
  // Optimizers
  private staticBatcher = inject(StaticBatchRendererService);
  private lightBaker = inject(LightmapBakerService);
  private culling = inject(CullingService);
  private proofKernel = inject(ProofKernelService);
  private eventBus = inject(EventBusService);
  
  private player = inject(PlayerService);
  
  debugMode = signal(false);
  private camCenter = { x: 0, y: 0 };

  private renderList: (Entity | Particle)[] = [];
  
  // Vector pools
  private _fp1 = { x: 0, y: 0 };
  private _fp2 = { x: 0, y: 0 };
  private _fp3 = { x: 0, y: 0 };
  private _fp4 = { x: 0, y: 0 };
  private _frustum = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

  private lastFrameTime = 0;
  private currentRenderScale = 1.0;
  private lastZoneId = '';
  
  private vignetteGradient: CanvasGradient | null = null;

  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.inputService.setCanvas(canvas);
    this.lastFrameTime = performance.now();

    this.resize();
    this.resizeListener = () => this.resize();
    window.addEventListener('resize', this.resizeListener);
    
    if (this.canvas) {
        this.lightingRenderer.init(this.canvas.width, this.canvas.height);
    }
  }

  destroy() {
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
      this.resizeListener = null;
    }
  }

  resize() {
    this.vignetteGradient = null; 
    if (this.canvas) {
      const scale = this.performanceManager.renderScale();
      this.currentRenderScale = scale;
      this.canvas.width = Math.max(window.innerWidth * scale, 320);
      this.canvas.height = Math.max(window.innerHeight * scale, 320);
      this.lightingRenderer.resize(this.canvas.width, this.canvas.height);
    }
  }

  getScreenToWorld(screenX: number, screenY: number, cam: Camera, out: {x: number, y: number} = {x:0, y:0}) {
      if (!this.canvas) return out;
      IsoUtils.setContext(cam.rotation, cam.x, cam.y);
      IsoUtils.toIso(cam.x, cam.y, 0, this.camCenter);
      
      const scale = this.currentRenderScale;
      const dx = (screenX * scale) - this.canvas.width / 2;
      const dy = (screenY * scale) - this.canvas.height / 2;
      
      const isoX = this.camCenter.x + dx / cam.zoom;
      const isoY = this.camCenter.y + dy / cam.zoom;
      
      IsoUtils.fromIso(isoX, isoY, out);
      return out;
  }

  render(
      entities: Entity[], 
      player: Entity, 
      particles: Particle[], 
      texts: FloatingText[], 
      cam: Camera, 
      zone: Zone,
      rainDrops: any[],
      shake: {intensity: number, x: number, y: number}
  ) {
    if (!this.ctx || !this.canvas) return;
    
    const now = performance.now();
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;
    this.performanceManager.monitorFrame(delta);

    if (zone.id !== this.lastZoneId) {
        this.staticBatcher.clearCache();
        this.lightBaker.clearCache();
        this.lastZoneId = zone.id;
    }

    this.lightingRenderer.setResolutionScale(this.performanceManager.lightingScale());
    
    const targetScale = this.performanceManager.renderScale();
    if (Math.abs(targetScale - this.currentRenderScale) > 0.05) {
        this.resize();
    }

    const w = this.canvas.width;
    const h = this.canvas.height;
    
    IsoUtils.setContext(cam.rotation, cam.x, cam.y);

    this.calculateFrustum(cam, window.innerWidth, window.innerHeight);

    const bakedTiles = this.staticBatcher.bakeStaticGeometry(zone, entities, cam.rotation);
    const bakedLighting = this.lightBaker.bakeStaticLights(this.lighting.allLights, cam.rotation);

    // Apply Quality Culling
    this.prepareRenderList(cam, zone, entities, player, particles, window.innerWidth, window.innerHeight, this._frustum, !!bakedTiles);
    
    this.prepareLighting(player, this.renderList, cam, window.innerWidth, window.innerHeight, this._frustum);
    this.lighting.update(1, this.timeService.globalTime);

    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, w, h);
    this.ctx.save();
    
    this.applyCameraTransform(cam, w, h, shake);

    this.floorRenderer.drawFloor(this.ctx, cam, zone, this.world.mapBounds, w, h);

    if (bakedTiles) {
        for (const tile of bakedTiles) {
            this.ctx.drawImage(tile.canvas, tile.x, tile.y);
        }
    }

    // Shadow Rendering based on Quality Preset
    if (this.adaptiveQuality.getPreset().shadowsEnabled) {
        this.drawShadows(this.renderList);
    }

    this.drawGeometry(this.renderList, zone, player);

    this.effectRenderer.drawGlobalEffects(this.ctx, this.renderList as Entity[], player, zone, rainDrops);
    
    this.drawWorldUI(texts, cam);

    this.ctx.restore();
    
    this.lightingRenderer.drawLighting(this.ctx, this.renderList as Entity[], player, cam, zone, w, h, bakedLighting);

    this.applyPostEffects(w, h);
    
    this.effectRenderer.drawGuidanceOverlay(
        this.ctx, 
        this.mission.activeObjective(), 
        player, 
        cam, 
        w, h, 
        zone.id
    );
    
    IsoUtils.setContext(0, 0, 0);
  }

  private prepareLighting(player: Entity, renderList: (Entity | Particle)[], cam: Camera, w: number, h: number, frustum: any) {
      this.lighting.clear();
      const presets = RENDER_CONFIG.LIGHTING.PRESETS;
      
      this.lighting.registerLight({
          id: 'PLAYER_MAIN',
          x: player.x,
          y: player.y,
          type: 'DYNAMIC',
          ...presets.PLAYER_MAIN
      });

      const len = renderList.length;
      for (let i = 0; i < len; i++) {
          const obj = renderList[i];
          if (isParticle(obj)) {
              const p = obj as Particle;
              if (p.emitsLight) {
                  if (p.x >= frustum.minX && p.x <= frustum.maxX && p.y >= frustum.minY && p.y <= frustum.maxY) {
                      this.lighting.registerLight({
                          id: `LP_${i}`,
                          x: p.x, y: p.y, z: p.z || presets.PARTICLE.z,
                          radius: p.sizeStart * presets.PARTICLE.radiusMultiplier,
                          intensity: p.life,
                          color: p.color,
                          type: 'DYNAMIC'
                      });
                  }
              }
              continue;
          }

          const ent = obj as Entity;
          
          if (ent.type === 'DECORATION') {
              if (ent.subType === 'STREET_LIGHT') {
                  const lightColor = ent.color && ent.color !== '#ffffff' ? ent.color : presets.STREET_LIGHT.color;
                  this.lighting.registerLight({ id: `L_${ent.id}`, x: ent.x, y: ent.y, type: 'STATIC', ...presets.STREET_LIGHT, color: lightColor });
              } else if (ent.subType === 'NEON') {
                  this.lighting.registerLight({ id: `L_${ent.id}`, x: ent.x, y: ent.y, color: ent.color, type: 'STATIC', ...presets.NEON });
              } else if (ent.subType === 'DYNAMIC_GLOW') {
                  const intensity = ent.data?.glowIntensity !== undefined ? ent.data.glowIntensity : 1.0;
                  this.lighting.registerLight({ 
                      id: `L_${ent.id}`, 
                      x: ent.x, 
                      y: ent.y, 
                      color: ent.color, 
                      intensity: intensity,
                      type: 'PULSE', 
                      flickerSpeed: ent.data?.pulseSpeed, 
                      ...presets.DYNAMIC_GLOW 
                  });
              }
          }
          else if (ent.type === 'HITBOX' && ent.source !== 'PLAYER') {
              this.lighting.registerLight({ id: `L_${ent.id}`, x: ent.x, y: ent.y, color: ent.color, type: 'DYNAMIC', radius: ent.radius * presets.PROJECTILE.radiusMultiplier, intensity: presets.PROJECTILE.intensity, z: presets.PROJECTILE.z });
          }
          else if (ent.type === 'EXIT' && !ent.locked) {
              this.lighting.registerLight({ id: `L_${ent.id}`, x: ent.x, y: ent.y, color: ent.color, type: 'STATIC', ...presets.EXIT });
          }
          else if (ent.type === 'ENEMY' && ent.subType === 'BOSS') {
              this.lighting.registerLight({ id: `L_${ent.id}`, x: ent.x, y: ent.y, type: 'DYNAMIC', ...presets.BOSS_ENEMY });
          }
      }
      this.lighting.cullLights(cam, w, h);
  }

  private applyCameraTransform(cam: Camera, w: number, h: number, shake: {intensity: number, x: number, y: number}) {
      if (!this.ctx) return;
      IsoUtils.toIso(cam.x, cam.y, 0, this.camCenter);
      this.ctx.translate(w/2, h/2);
      if (shake.intensity > 0.1) {
          let sx = (Math.random()-0.5) * shake.intensity;
          let sy = (Math.random()-0.5) * shake.intensity;
          sx += shake.x * shake.intensity * 0.5;
          sy += shake.y * shake.intensity * 0.5;
          this.ctx.translate(sx, sy);
      }
      this.ctx.scale(cam.zoom, cam.zoom);
      this.ctx.translate(-this.camCenter.x, -this.camCenter.y);
  }

  private prepareRenderList(cam: Camera, zone: Zone, entities: Entity[], player: Entity, particles: Particle[], w: number, h: number, frustum: any, hasBakedLayer: boolean) {
      const quality = this.adaptiveQuality.getPreset();
      
      let renderIndex = 0;
      
      const { buffer: staticBuffer, count: staticCount } = this.chunkManager.getVisibleStaticEntities(cam, w, h);
      
      // Filter statics by render distance as well to be safe
      const renderDistSq = quality.renderDistance * quality.renderDistance;

      for (let i = 0; i < staticCount; i++) {
          const e = staticBuffer[i];
          if (hasBakedLayer) {
              if (e.type === 'DECORATION' && ['RUG', 'FLOOR_CRACK', 'GRAFFITI', 'TRASH', 'SCORCH'].includes(e.subType || '')) continue;
          }
          
          // Distance check
          const distSq = (e.x - player.x)**2 + (e.y - player.y)**2;
          if (distSq > renderDistSq) continue;

          this.renderList[renderIndex++] = e;
      }
      
      const { buffer: dynamicBuffer, count: dynamicCount } = this.spatialHash.queryRectFast(frustum.minX, frustum.minY, frustum.maxX, frustum.maxY, zone.id);
      
      // Temporary list to sort dynamics by distance if over budget
      let visibleDynamics: Entity[] = [];

      for (let i = 0; i < dynamicCount; i++) {
          const e = dynamicBuffer[i];
          if (e.state === 'DEAD' || e.data?.isDead) continue; 
          if (hasBakedLayer) {
              if (e.type === 'DECORATION' && ['RUG', 'FLOOR_CRACK', 'GRAFFITI', 'TRASH', 'SCORCH'].includes(e.subType || '')) continue;
          }
          
          const distSq = (e.x - player.x)**2 + (e.y - player.y)**2;
          if (distSq > renderDistSq) continue;

          visibleDynamics.push(e);
      }
      
      // Hard cap logic for dynamic entities
      if (visibleDynamics.length > quality.maxVisibleEntities) {
          // Sort by distance to prioritize closer entities
          visibleDynamics.sort((a, b) => {
              const da = (a.x - player.x)**2 + (a.y - player.y)**2;
              const db = (b.x - player.x)**2 + (b.y - player.y)**2;
              return da - db;
          });
          visibleDynamics.length = quality.maxVisibleEntities;
      }

      // Add surviving dynamics to render list
      for(const e of visibleDynamics) {
          this.renderList[renderIndex++] = e;
      }
      
      this.renderList[renderIndex++] = player;

      const pLen = particles.length;
      // Use particle multiplier from quality preset
      const pLimit = Math.floor(this.performanceManager.particleLimit() * quality.particleMultiplier);
      
      let pCount = 0;
      for (let i = 0; i < pLen; i++) {
          if (pCount >= pLimit) break;
          const p = particles[i];
          if (p.x >= frustum.minX && p.x <= frustum.maxX && p.y >= frustum.minY && p.y <= frustum.maxY) {
              this.renderList[renderIndex++] = p;
              pCount++;
          }
      }
      
      if (this.renderList.length > renderIndex) {
          this.renderList.length = renderIndex;
      }
      
      this.sorter.sortForRender(this.renderList, cam.rotation);
  }

  private drawShadows(renderList: (Entity | Particle)[]) {
      if (!this.ctx) return;
      const len = renderList.length;
      for (let i = 0; i < len; i++) {
          const e = renderList[i];
          if (isParticle(e)) continue;
          const ent = e as Entity;
          
          if (ent.type === 'PLAYER' || ent.type === 'ENEMY' || ent.type === 'NPC') {
              this.shadowRenderer.drawUnitShadow(this.ctx, ent);
          } else if (ent.type === 'WALL' || ent.type === 'DECORATION') {
              if (ent.height && ent.height > 50 && ent.subType !== 'CABLE') { 
                  this.shadowRenderer.drawStructureShadow(this.ctx, ent);
              }
          }
      }
  }

  private drawGeometry(renderList: (Entity | Particle)[], zone: Zone, player: Entity) {
      if (!this.ctx) return;
      const len = renderList.length;
      const particles: Particle[] = [];

      for (let i = 0; i < len; i++) {
          const obj = renderList[i];
          if (isParticle(obj)) {
              particles.push(obj as Particle);
              continue;
          }
          
          const e = obj as Entity;

          if (e.type === 'WALL' && e.subType !== 'GATE_SEGMENT') {
              this.structureRenderer.drawStructure(this.ctx, e, zone);
          } 
          else if (e.type === 'PLAYER') {
            this.effectRenderer.drawPsionicWave(this.ctx, e); 
            this.unitRenderer.drawHumanoid(this.ctx, e);
          }
          else if (e.type === 'ENEMY') this.unitRenderer.drawHumanoid(this.ctx, e);
          else if (e.type === 'NPC') this.unitRenderer.drawNPC(this.ctx, e);
          else if (e.type === 'WALL') this.structureRenderer.drawStructure(this.ctx, e, zone); 
          else if (e.type === 'DECORATION') this.entityRenderer.drawDecoration(this.ctx, e);
          else if (e.type === 'EXIT') this.entityRenderer.drawExit(this.ctx, e);
          else if (e.type === 'SHRINE') this.entityRenderer.drawShrine(this.ctx, e);
          else if (e.type === 'DESTRUCTIBLE') this.entityRenderer.drawDestructible(this.ctx, e);
          else if (e.type === 'PICKUP') this.entityRenderer.drawPickup(this.ctx, e);
          else if (e.type === 'HITBOX') {
              if (e.psionicEffect === 'wave') this.effectRenderer.drawPsionicWave(this.ctx, e);
              else if (e.subType === 'VENT' && e.state === 'ACTIVE') this.effectRenderer.drawSteamColumn(this.ctx, e);
              else if (e.subType === 'SLUDGE') this.effectRenderer.drawSludge(this.ctx, e);
              else this.effectRenderer.drawHitboxIso(this.ctx, e);
          }

          if (this.debugMode() && e.radius) {
              this.effectRenderer.drawDebugHitbox(this.ctx, e);
          }
      }

      if (particles.length > 0) {
          this.effectRenderer.drawParticles(this.ctx, particles);
      }
  }

  private drawWorldUI(texts: FloatingText[], cam: Camera) {
      if (!this.ctx) return;
      this.effectRenderer.drawFloatingTexts(this.ctx, texts, cam);
      
      const activeTarget = this.interaction.activeInteractable();
      if (activeTarget) {
          const label = this.interaction.getInteractLabel(activeTarget);
          this.effectRenderer.drawInteractionIndicator(this.ctx, activeTarget, label);
      }
  }

  private calculateFrustum(cam: Camera, width: number, height: number) {
      this.getScreenToWorld(0, 0, cam, this._fp1);
      this.getScreenToWorld(width, 0, cam, this._fp2);
      this.getScreenToWorld(0, height, cam, this._fp3);
      this.getScreenToWorld(width, height, cam, this._fp4);
      
      const margin = RENDER_CONFIG.FRUSTUM_MARGIN;
      
      this._frustum.minX = Math.min(this._fp1.x, this._fp2.x, this._fp3.x, this._fp4.x) - margin;
      this._frustum.maxX = Math.max(this._fp1.x, this._fp2.x, this._fp3.x, this._fp4.x) + margin;
      this._frustum.minY = Math.min(this._fp1.y, this._fp2.y, this._fp3.y, this._fp4.y) - margin;
      this._frustum.maxY = Math.max(this._fp1.y, this._fp2.y, this._fp3.y, this._fp4.y) + margin;
  }

  private applyPostEffects(w: number, h: number) {
      if (!this.ctx) return;
      
      if (this.performanceManager.currentTier().name !== 'LOW') {
          if (!this.vignetteGradient) {
              this.vignetteGradient = this.ctx.createRadialGradient(w/2, h/2, h/2, w/2, h/2, h);
              this.vignetteGradient.addColorStop(0, 'transparent');
              this.vignetteGradient.addColorStop(1, 'rgba(0,0,0,0.85)');
          }
          
          this.ctx.fillStyle = this.vignetteGradient;
          this.ctx.globalCompositeOperation = 'source-over';
          this.ctx.fillRect(0, 0, w, h);
      }

      const integrity = this.player.stats.playerHp() / this.player.stats.playerStats().hpMax;
      if (integrity < 0.3 && Math.random() < 0.1) {
          const offset = Math.random() * 10;
          this.ctx.save();
          this.ctx.globalCompositeOperation = 'color-dodge';
          this.ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
          this.ctx.translate(offset, 0);
          this.ctx.fillRect(0, 0, w, h);
          this.ctx.restore();
      }
  }
}
