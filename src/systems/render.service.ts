
import { Injectable, inject, signal } from '@angular/core';
import { Entity, Zone, FloatingText, Camera, Particle } from '../models/game.models';
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
import { RENDER_CONFIG, RENDER_STATE, QUALITY_TIERS } from './rendering/render.config';
import { InputService } from '../services/input.service';
import { SpatialHashService } from './spatial-hash.service';
import { InteractionService } from '../services/interaction.service';
import { ChunkManagerService } from '../game/world/chunk-manager.service';
import { LightingService } from './rendering/lighting.service';
import { TimeService } from '../game/time.service';
import { MissionService } from '../game/mission.service';

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
  
  // Renderers
  private floorRenderer = inject(FloorRendererService);
  private structureRenderer = inject(StructureRendererService);
  private unitRenderer = inject(UnitRendererService);
  private shadowRenderer = inject(ShadowRendererService);
  private effectRenderer = inject(EffectRendererService);
  private entityRenderer = inject(EntityRendererService);
  private lightingRenderer = inject(LightingRendererService);
  
  private player = inject(PlayerService);
  
  debugMode = signal(false);
  private isHighEnd = true;
  private camCenter = { x: 0, y: 0 };

  private renderList: (Entity | Particle)[] = [];
  
  // Vector pools for frustum calc to avoid allocations
  private _fp1 = { x: 0, y: 0 };
  private _fp2 = { x: 0, y: 0 };
  private _fp3 = { x: 0, y: 0 };
  private _fp4 = { x: 0, y: 0 };
  private _frustum = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

  // Performance Monitoring
  private lastFrameTime = 0;
  private frameCount = 0;
  private fpsAccumulator = 0;
  private qualityStableFrames = 0;

  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.inputService.setCanvas(canvas);
    
    this.isHighEnd = navigator.hardwareConcurrency > 4 && !/Mobile|Android/.test(navigator.userAgent);
    
    // Initial Quality Set
    this.applyQuality(this.isHighEnd ? 2 : 1); // High or Medium

    this.resize();
    this.resizeListener = () => this.resize();
    window.addEventListener('resize', this.resizeListener);
  }

  destroy() {
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
      this.resizeListener = null;
    }
  }

  resize() {
    if (this.canvas) {
      this.canvas.width = Math.max(window.innerWidth, 320);
      this.canvas.height = Math.max(window.innerHeight, 320);
      this.lightingRenderer.resize(this.canvas.width, this.canvas.height);
    }
  }

  getScreenToWorld(screenX: number, screenY: number, cam: Camera, out: {x: number, y: number} = {x:0, y:0}) {
      if (!this.canvas) return out;
      
      // We must temporarily set the IsoUtils context to the current camera state 
      // to correctly inverse the rotation.
      IsoUtils.setContext(cam.rotation, cam.x, cam.y);
      
      // Calculate Center Iso position (pivot)
      IsoUtils.toIso(cam.x, cam.y, 0, this.camCenter);
      
      // 1. Un-center and Un-zoom (Screen Space -> Iso Space)
      const dx = screenX - this.canvas.width / 2;
      const dy = screenY - this.canvas.height / 2;
      
      const isoX = this.camCenter.x + dx / cam.zoom;
      const isoY = this.camCenter.y + dy / cam.zoom;
      
      // 2. Inverse Projection & Rotation via IsoUtils
      IsoUtils.fromIso(isoX, isoY, out);
      
      return out;
  }

  private monitorPerformance(now: number) {
      const delta = now - this.lastFrameTime;
      this.lastFrameTime = now;
      
      // Update FPS
      const fps = 1000 / delta;
      this.fpsAccumulator += fps;
      this.frameCount++;

      if (this.frameCount >= 30) {
          const avgFps = this.fpsAccumulator / 30;
          this.frameCount = 0;
          this.fpsAccumulator = 0;
          
          this.adjustQuality(avgFps);
      }
  }

  private adjustQuality(avgFps: number) {
      // Adaptive Logic:
      // FPS < 45: Downgrade
      // FPS > 58: Upgrade (if not max)
      // Hysteresis: Require consistent performance to switch
      
      if (avgFps < 45) {
          this.qualityStableFrames--;
          if (this.qualityStableFrames < -2) {
              // Downgrade
              const nextTier = Math.max(0, RENDER_STATE.currentTier - 1);
              if (nextTier !== RENDER_STATE.currentTier) {
                  console.log(`[RenderService] Performance Drop (${avgFps.toFixed(1)} FPS). Downgrading to ${QUALITY_TIERS[nextTier].name}`);
                  this.applyQuality(nextTier);
                  this.qualityStableFrames = 0;
              }
          }
      } else if (avgFps > 58) {
          this.qualityStableFrames++;
          if (this.qualityStableFrames > 5) {
              // Upgrade
              const nextTier = Math.min(QUALITY_TIERS.length - 1, RENDER_STATE.currentTier + 1);
              if (nextTier !== RENDER_STATE.currentTier) {
                  console.log(`[RenderService] Performance Good (${avgFps.toFixed(1)} FPS). Upgrading to ${QUALITY_TIERS[nextTier].name}`);
                  this.applyQuality(nextTier);
                  this.qualityStableFrames = 0;
              }
          }
      } else {
          // Stable in middle, reset counter slowly
          if (this.qualityStableFrames > 0) this.qualityStableFrames--;
          if (this.qualityStableFrames < 0) this.qualityStableFrames++;
      }
  }

  private applyQuality(tierIndex: number) {
      const tier = QUALITY_TIERS[tierIndex];
      RENDER_STATE.currentTier = tierIndex;
      RENDER_STATE.shadowsEnabled = tier.shadow;
      RENDER_STATE.lightingScale = tier.lightScale;
      RENDER_STATE.particleLimit = tier.particleCap;
      
      this.lightingRenderer.setResolutionScale(tier.lightScale);
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
    this.monitorPerformance(now);

    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // --- 0. SETUP ROTATION CONTEXT ---
    IsoUtils.setContext(cam.rotation, cam.x, cam.y);

    // Calculate View Frustum (Zero Alloc)
    this.calculateFrustum(cam, w, h);

    // 1. Prepare Scene (Logic Phase)
    // Gather renderable entities and sort them
    this.prepareRenderList(cam, zone, entities, player, particles, w, h, this._frustum);
    
    // Prepare Lights (Culling & Extraction)
    this.prepareLighting(player, this.renderList, cam, w, h, this._frustum);
    
    // Update Lighting Animation
    this.lighting.update(1, this.timeService.globalTime);

    // 2. Draw Frame
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, w, h);
    this.ctx.save();
    
    // Camera Transform (Pan & Zoom ONLY)
    this.applyCameraTransform(cam, w, h, shake);

    // 3. Background Pass
    this.floorRenderer.drawFloor(this.ctx, cam, zone, this.world.mapBounds, w, h);

    // 4. Shadow Pass (High End Only, Now Dynamic)
    if (RENDER_STATE.shadowsEnabled) {
        this.drawShadows(this.renderList);
    }

    // 5. Main Geometry Pass (Sorted)
    this.drawGeometry(this.renderList, zone);

    // 6. Occlusion / X-Ray Pass
    // We need to pass the static list source to check occlusion properly
    const { buffer, count } = this.chunkManager.getVisibleStaticEntities(cam, w, h);
    this.drawOcclusion(player, buffer, count);

    // 7. Visual Effects
    this.effectRenderer.drawGlobalEffects(this.ctx, this.renderList as Entity[], player, zone, rainDrops);
    
    // 8. World UI (In-World)
    this.drawWorldUI(texts, cam);

    this.ctx.restore();
    
    // 9. Lighting & Atmosphere Pass (Screen Space Overlay)
    this.lightingRenderer.drawLighting(this.ctx, this.renderList as Entity[], player, cam, zone, w, h);

    // 10. Post-Processing & HUD Overlays
    this.applyPostEffects(w, h);
    
    // 11. Guidance Overlay (Always on top)
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

  private prepareLighting(
      player: Entity, 
      renderList: (Entity | Particle)[], 
      cam: Camera, 
      w: number, 
      h: number,
      frustum: {minX: number, maxX: number, minY: number, maxY: number}
  ) {
      this.lighting.clear();
      const presets = RENDER_CONFIG.LIGHTING.PRESETS;
      
      // Player Dynamic Light
      this.lighting.registerLight({
          id: 'PLAYER_MAIN',
          x: player.x,
          y: player.y,
          type: 'DYNAMIC',
          ...presets.PLAYER_MAIN
      });

      // Extract Lights from Render List
      const len = renderList.length;
      for (let i = 0; i < len; i++) {
          const obj = renderList[i];
          
          if ('life' in obj) {
              // Particle Light
              const p = obj as Particle;
              if (p.emitsLight) {
                  // Culling check for particles before registering light
                  if (p.x >= frustum.minX && p.x <= frustum.maxX && p.y >= frustum.minY && p.y <= frustum.maxY) {
                      this.lighting.registerLight({
                          id: `LP_${i}`, // Safe since list is rebuilt per frame
                          x: p.x, y: p.y, z: p.z || presets.PARTICLE.z,
                          radius: p.sizeStart * presets.PARTICLE.radiusMultiplier,
                          intensity: p.life, // Fade with life
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
                  this.lighting.registerLight({ 
                      id: `L_${ent.id}`, x: ent.x, y: ent.y, type: 'STATIC', 
                      ...presets.STREET_LIGHT,
                      color: lightColor 
                  });
              } else if (ent.subType === 'NEON') {
                  this.lighting.registerLight({ id: `L_${ent.id}`, x: ent.x, y: ent.y, color: ent.color, type: 'STATIC', ...presets.NEON });
              } else if (ent.subType === 'DYNAMIC_GLOW') {
                  this.lighting.registerLight({ id: `L_${ent.id}`, x: ent.x, y: ent.y, color: ent.color, type: 'PULSE', flickerSpeed: ent.data?.pulseSpeed, ...presets.DYNAMIC_GLOW });
              }
          }
          else if (ent.type === 'HITBOX' && ent.source !== 'PLAYER') {
              this.lighting.registerLight({ 
                  id: `L_${ent.id}`, 
                  x: ent.x, y: ent.y, 
                  color: ent.color, 
                  type: 'DYNAMIC',
                  radius: ent.radius * presets.PROJECTILE.radiusMultiplier,
                  intensity: presets.PROJECTILE.intensity,
                  z: presets.PROJECTILE.z
              });
          }
          else if (ent.type === 'EXIT' && !ent.locked) {
              this.lighting.registerLight({ id: `L_${ent.id}`, x: ent.x, y: ent.y, color: ent.color, type: 'STATIC', ...presets.EXIT });
          }
          else if (ent.type === 'ENEMY' && ent.subType === 'BOSS') {
              this.lighting.registerLight({ id: `L_${ent.id}`, x: ent.x, y: ent.y, type: 'DYNAMIC', ...presets.BOSS_ENEMY });
          }
      }

      // Perform Culling
      this.lighting.cullLights(cam, w, h);
  }

  private applyCameraTransform(cam: Camera, w: number, h: number, shake: {intensity: number, x: number, y: number}) {
      if (!this.ctx) return;
      
      // Calculate pivot point in Iso space (Center of screen)
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

  private prepareRenderList(
      cam: Camera, 
      zone: Zone, 
      dynamicEntities: Entity[], 
      player: Entity, 
      particles: Particle[], 
      w: number, 
      h: number,
      frustum: {minX: number, maxX: number, minY: number, maxY: number}
  ) {
      this.renderList.length = 0;
      
      // OPTIMIZED: Use Zero-Alloc ChunkManager API for static entities
      const { buffer: staticBuffer, count: staticCount } = this.chunkManager.getVisibleStaticEntities(cam, w, h);
      
      for (let i = 0; i < staticCount; i++) {
          this.renderList.push(staticBuffer[i]);
      }
      
      // OPTIMIZED: Use Zero-Alloc SpatialHash query for dynamic entities
      const { buffer: dynamicBuffer, count: dynamicCount } = this.spatialHash.queryRectFast(frustum.minX, frustum.minY, frustum.maxX, frustum.maxY, zone.id);
      
      for (let i = 0; i < dynamicCount; i++) {
          const e = dynamicBuffer[i];
          if (e.type === 'WALL' && e.subType !== 'GATE_SEGMENT') continue;
          if (e.type === 'DECORATION' && (e.subType === 'RUG' || e.subType === 'FLOOR_CRACK' || e.subType === 'GRAFFITI')) continue;
          this.renderList.push(e);
      }
      
      this.renderList.push(player);

      const pLen = particles.length;
      for (let i = 0; i < pLen; i++) {
          const p = particles[i];
          if (p.x >= frustum.minX && p.x <= frustum.maxX && p.y >= frustum.minY && p.y <= frustum.maxY) {
              this.renderList.push(p);
          }
      }

      this.sorter.sortForRender(this.renderList, player);
  }

  private drawShadows(renderList: (Entity | Particle)[]) {
      if (!this.ctx) return;
      const len = renderList.length;
      for (let i = 0; i < len; i++) {
          const e = renderList[i];
          if (!('type' in e)) continue;
          
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

  private drawGeometry(renderList: (Entity | Particle)[], zone: Zone) {
      if (!this.ctx) return;
      const len = renderList.length;
      
      for (let i = 0; i < len; i++) {
          const obj = renderList[i];
          if ('life' in obj) {
              this.effectRenderer.drawParticleIso(this.ctx, obj as Particle);
              continue;
          }
          
          const e = obj as Entity;

          if (e.type === 'PLAYER') {
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
  }

  private drawOcclusion(player: Entity, staticEntities: Entity[], count: number) {
      if (!this.ctx) return;
      if (this.checkOcclusion(player, staticEntities, count)) {
          this.ctx.save();
          this.ctx.globalAlpha = 0.3;
          this.ctx.globalCompositeOperation = 'source-over'; 
          this.ctx.shadowColor = '#06b6d4';
          this.ctx.shadowBlur = 15;
          this.unitRenderer.drawHumanoid(this.ctx, player);
          this.ctx.restore();
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

  private checkOcclusion(player: Entity, staticEntities: Entity[], count: number): boolean {
      const margin = 20;
      const px = player.x;
      const py = player.y;
      const pDepth = px + py;

      for (let i = 0; i < count; i++) {
          const e = staticEntities[i];
          if ((e.type === 'WALL' || (e.type === 'DECORATION' && (e.height || 0) > 80))) {
              const eDepth = e.x + e.y;
              if (eDepth <= pDepth) continue; 

              const w = e.width || 40;
              const d = e.depth || 40;
              const halfW = w / 2 + margin;
              const halfD = d / 2 + margin;
              
              if (Math.abs(e.x - px) < halfW && Math.abs(e.y - py) < halfD) {
                  return true;
              }
          }
      }
      return false;
  }

  private calculateFrustum(cam: Camera, width: number, height: number) {
      // Reuse vector pools
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
      
      // Skip expensive gradients on LOW quality
      if (RENDER_STATE.currentTier > 0) {
          const grad = this.ctx.createRadialGradient(w/2, h/2, h/2, w/2, h/2, h);
          grad.addColorStop(0, 'transparent');
          grad.addColorStop(1, 'rgba(0,0,0,0.85)');
          this.ctx.fillStyle = grad;
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
