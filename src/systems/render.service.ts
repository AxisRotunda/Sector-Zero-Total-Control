
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

  // Performance Monitoring
  private lastFrameTime = 0;
  private currentRenderScale = 1.0;
  private lastZoneId = '';
  
  // Cached Resources
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
    this.vignetteGradient = null; // Invalidate cache
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

    // Zone Change cleanup
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
    
    // --- 0. SETUP ROTATION CONTEXT ---
    IsoUtils.setContext(cam.rotation, cam.x, cam.y);

    // Calculate View Frustum
    this.calculateFrustum(cam, window.innerWidth, window.innerHeight);

    // 1. Prepare Scene & Bake Check
    const bakedTiles = this.staticBatcher.bakeStaticGeometry(zone, entities, cam.rotation);
    // Returns BakedTile[] or null
    const bakedLightTiles = this.lightBaker.bakeStaticLights(this.lighting.allLights, cam.rotation);

    this.prepareRenderList(cam, zone, entities, player, particles, window.innerWidth, window.innerHeight, this._frustum, !!bakedTiles);
    
    // Prepare Lights
    this.prepareLighting(player, this.renderList, cam, window.innerWidth, window.innerHeight, this._frustum);
    this.lighting.update(1, this.timeService.globalTime);

    // 2. Draw Frame
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, w, h);
    this.ctx.save();
    
    // Camera Transform
    this.applyCameraTransform(cam, w, h, shake);

    // 3. Background Pass
    this.floorRenderer.drawFloor(this.ctx, cam, zone, this.world.mapBounds, w, h);

    // 4. Baked Static Geometry Pass (Tiles)
    if (bakedTiles) {
        for (const tile of bakedTiles) {
            this.ctx.drawImage(tile.canvas, tile.x, tile.y);
        }
    }

    // 5. Shadow Pass (Dynamic Only if baked)
    if (this.performanceManager.shadowsEnabled()) {
        this.drawShadows(this.renderList);
    }

    // 6. Main Geometry Pass (Sorted & Occlusion)
    this.drawGeometry(this.renderList, zone, player);

    // 7. Visual Effects
    this.effectRenderer.drawGlobalEffects(this.ctx, this.renderList as Entity[], player, zone, rainDrops);
    
    // 8. World UI
    this.drawWorldUI(texts, cam);

    this.ctx.restore();
    
    // 9. Lighting & Atmosphere Pass
    this.lightingRenderer.drawLighting(this.ctx, this.renderList as Entity[], player, cam, zone, w, h, bakedLightTiles);

    // 10. Post-Processing
    this.applyPostEffects(w, h);
    
    // 11. Guidance Overlay
    this.effectRenderer.drawGuidanceOverlay(
        this.ctx, 
        this.mission.activeObjective(), 
        player, 
        cam, 
        w, h, 
        zone.id
    );
    
    // --- CLEANUP ---
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
          // IMPORTANT: Static lights (Street Lights, Neon) are handled by LightBaker now.
          // Only register dynamic lights here.
          
          if (ent.type === 'DECORATION') {
              if (ent.subType === 'STREET_LIGHT') {
                  // Register as STATIC for baking
                  const lightColor = ent.color && ent.color !== '#ffffff' ? ent.color : presets.STREET_LIGHT.color;
                  this.lighting.registerLight({ id: `L_${ent.id}`, x: ent.x, y: ent.y, type: 'STATIC', ...presets.STREET_LIGHT, color: lightColor });
              } else if (ent.subType === 'NEON') {
                  this.lighting.registerLight({ id: `L_${ent.id}`, x: ent.x, y: ent.y, color: ent.color, type: 'STATIC', ...presets.NEON });
              } else if (ent.subType === 'DYNAMIC_GLOW') {
                  // Pulse is dynamic
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
              // Exits are static
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
      let renderIndex = 0;
      
      // Get Visible Entities
      const { buffer: staticBuffer, count: staticCount } = this.chunkManager.getVisibleStaticEntities(cam, w, h);
      
      // Process Static (Walls)
      for (let i = 0; i < staticCount; i++) {
          const e = staticBuffer[i];
          if (hasBakedLayer) {
              // Only skip floor decos that were baked. Walls are NOT baked anymore.
              if (e.type === 'DECORATION' && ['RUG', 'FLOOR_CRACK', 'GRAFFITI', 'TRASH', 'SCORCH'].includes(e.subType || '')) continue;
          }
          this.renderList[renderIndex++] = e;
      }
      
      const { buffer: dynamicBuffer, count: dynamicCount } = this.spatialHash.queryRectFast(frustum.minX, frustum.minY, frustum.maxX, frustum.maxY, zone.id);
      for (let i = 0; i < dynamicCount; i++) {
          const e = dynamicBuffer[i];
          if (e.state === 'DEAD' || e.data?.isDead) continue; 
          
          if (hasBakedLayer) {
              // Same check for dynamic floor decos (rare)
              if (e.type === 'DECORATION' && ['RUG', 'FLOOR_CRACK', 'GRAFFITI', 'TRASH', 'SCORCH'].includes(e.subType || '')) continue;
          }
          
          this.renderList[renderIndex++] = e;
      }
      
      this.renderList[renderIndex++] = player;

      const pLen = particles.length;
      const pLimit = this.performanceManager.particleLimit();
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

  // --- SCREEN-SPACE OCCLUSION ---
  private checkScreenSpaceOcclusion(wall: Entity, target: Entity): boolean {
      const wallDepth = wall._depthKey || 0;
      const targetDepth = target._depthKey || 0;
      if (wallDepth < targetDepth) return false;

      const wWidth = wall.width || 40;
      const wDepth = wall.depth || 40;
      const wHeight = wall.height || 100;
      
      const wallBaseIso = { x: 0, y: 0 };
      const targetBaseIso = { x: 0, y: 0 };
      
      IsoUtils.toIso(wall.x, wall.y, 0, wallBaseIso);
      IsoUtils.toIso(target.x, target.y, 0, targetBaseIso);
      
      const wallScreenW = (wWidth + wDepth) * 1.2;
      const wallScreenH = wHeight + (wWidth + wDepth) * 0.5;
      
      const wx = wallBaseIso.x - wallScreenW / 2;
      const wy = wallBaseIso.y - wallScreenH; 
      
      const tRadius = target.radius || 20;
      const tHeight = 60;
      const tx = targetBaseIso.x - tRadius;
      const ty = targetBaseIso.y - tHeight;
      const tw = tRadius * 2;
      const th = tHeight;

      if (wx < tx + tw && wx + wallScreenW > tx &&
          wy < ty + th && wy + wallScreenH > ty) {
          return true;
      }
      return false;
  }

  private checkAnyTargetOcclusion(wall: Entity, player: Entity, zoneId: string): boolean {
      if (this.checkScreenSpaceOcclusion(wall, player)) return true;

      const searchRadius = Math.max(wall.width || 100, wall.depth || 100);
      const { buffer, count } = this.spatialHash.queryFast(wall.x, wall.y, searchRadius, zoneId);
      
      for (let i = 0; i < count; i++) {
          const ent = buffer[i];
          if (ent.type === 'ENEMY' && ent.state !== 'DEAD') {
              if (this.checkScreenSpaceOcclusion(wall, ent)) {
                  return true;
              }
          }
      }
      return false;
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
              const isOccluding = this.checkAnyTargetOcclusion(e, player, zone.id);
              if (isOccluding) {
                  this.ctx.globalAlpha = 0.3;
              }
              this.structureRenderer.drawStructure(this.ctx, e, zone);
              this.ctx.globalAlpha = 1.0;
          } 
          else if (e.type === 'PLAYER') {
            this.effectRenderer.drawPsionicWave(this.ctx, e); 
            this.unitRenderer.drawHumanoid(this.ctx, e);
          }
          else if (e.type === 'ENEMY') this.unitRenderer.drawHumanoid(this.ctx, e);
          else if (e.type === 'NPC') this.unitRenderer.drawNPC(this.ctx, e);
          else if (e.type === 'WALL') this.structureRenderer.drawStructure(this.ctx, e, zone); // Gate Segment
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
