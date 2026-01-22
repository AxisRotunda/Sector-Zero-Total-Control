
import { Injectable, inject, signal } from '@angular/core';
import { Entity, Zone, FloatingText, Camera, Particle } from '../../models/game.models';
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
import { SpatialHashService } from '../spatial-hash.service';
import { InteractionService } from '../services/interaction.service';
import { ChunkManagerService } from '../game/world/chunk-manager.service';
import { LightingService } from './rendering/lighting.service';

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
  private staticEntities: Entity[] = []; 

  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.inputService.setCanvas(canvas);
    
    this.isHighEnd = navigator.hardwareConcurrency > 4 && !/Mobile|Android/.test(navigator.userAgent);
    
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

  getScreenToWorld(screenX: number, screenY: number, cam: Camera) {
      if (!this.canvas) return { x: 0, y: 0 };
      IsoUtils.toIso(cam.x, cam.y, 0, this.camCenter);
      
      const sx = screenX - this.canvas.width / 2;
      const sy = screenY - this.canvas.height / 2;
      const unzoomedX = sx / cam.zoom;
      const unzoomedY = sy / cam.zoom;
      
      const isoX = unzoomedX + this.camCenter.x;
      const isoY = unzoomedY + this.camCenter.y;
      
      const worldX = isoY + 0.5 * isoX;
      const worldY = isoY - 0.5 * isoX;
      
      return { x: worldX, y: worldY };
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
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // 1. Prepare Scene (Logic Phase)
    // Gather renderable entities and sort them
    this.prepareRenderList(cam, zone, entities, player, particles, w, h);
    
    // Prepare Lights (Culling & Extraction)
    this.prepareLighting(player, this.renderList, cam, w, h);

    // 2. Draw Frame
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, w, h);
    this.ctx.save();
    
    // Camera Transform
    this.applyCameraTransform(cam, w, h, shake);

    // 3. Background Pass
    this.floorRenderer.drawFloor(this.ctx, cam, zone, this.world.mapBounds, w, h);

    // 4. Shadow Pass (High End Only)
    if (this.isHighEnd) {
        this.drawShadows(this.renderList);
    }

    // 5. Main Geometry Pass (Sorted)
    this.drawGeometry(this.renderList, zone);

    // 6. Occlusion / X-Ray Pass
    this.drawOcclusion(player, this.staticEntities);

    // 7. Visual Effects
    this.effectRenderer.drawGlobalEffects(this.ctx, this.renderList as Entity[], player, zone, rainDrops);
    
    // 8. World UI
    this.drawWorldUI(texts, cam);

    this.ctx.restore();
    
    // 9. Lighting & Atmosphere Pass (Screen Space Overlay)
    this.lightingRenderer.drawLighting(this.ctx, this.renderList as Entity[], player, cam, zone, w, h);

    // 10. Post-Processing
    this.applyPostEffects(w, h);
  }

  private prepareLighting(player: Entity, renderList: (Entity | Particle)[], cam: Camera, w: number, h: number) {
      this.lighting.clear();
      
      // Player Dynamic Light
      this.lighting.registerLight({
          id: 'PLAYER_MAIN',
          x: player.x,
          y: player.y,
          z: 40,
          radius: 400,
          intensity: 1.0,
          color: '#ffffff',
          type: 'DYNAMIC'
      });

      // Extract Lights from Render List (Entities that emit light)
      // This includes dynamic projectiles and static decor that is visible
      const len = renderList.length;
      for (let i = 0; i < len; i++) {
          const e = renderList[i];
          if (!('type' in e)) continue; // Skip particles for now
          const ent = e as Entity;

          if (ent.type === 'DECORATION') {
              if (ent.subType === 'STREET_LIGHT') {
                  this.lighting.registerLight({ id: `L_${ent.id}`, x: ent.x, y: ent.y, z: 250, radius: 450, intensity: 0.8, color: '#fbbf24', type: 'STATIC' });
              } else if (ent.subType === 'NEON') {
                  this.lighting.registerLight({ id: `L_${ent.id}`, x: ent.x, y: ent.y, z: 50, radius: 250, intensity: 0.6, color: ent.color, type: 'STATIC' });
              } else if (ent.subType === 'DYNAMIC_GLOW') {
                  this.lighting.registerLight({ id: `L_${ent.id}`, x: ent.x, y: ent.y, z: 10, radius: 200, intensity: 0.5, color: ent.color, type: 'PULSE', flickerSpeed: ent.data?.pulseSpeed });
              }
          }
          else if (ent.type === 'HITBOX' && ent.source !== 'PLAYER') {
              this.lighting.registerLight({ id: `L_${ent.id}`, x: ent.x, y: ent.y, z: 20, radius: ent.radius * 4, intensity: 0.7, color: ent.color, type: 'DYNAMIC' });
          }
          else if (ent.type === 'EXIT' && !ent.locked) {
              this.lighting.registerLight({ id: `L_${ent.id}`, x: ent.x, y: ent.y, z: 10, radius: 300, intensity: 0.5, color: ent.color, type: 'STATIC' });
          }
      }

      // Perform Culling
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

  private prepareRenderList(cam: Camera, zone: Zone, dynamicEntities: Entity[], player: Entity, particles: Particle[], w: number, h: number) {
      const frustum = this.calculateFrustum(cam, w, h);
      
      this.renderList.length = 0;
      
      this.staticEntities = this.chunkManager.getVisibleStaticEntities(cam, w, h);
      const sLen = this.staticEntities.length;
      for (let i = 0; i < sLen; i++) {
          this.renderList.push(this.staticEntities[i]);
      }
      
      const visibleDynamic = this.spatialHash.queryRect(frustum.minX, frustum.minY, frustum.maxX, frustum.maxY, zone.id);
      const dLen = visibleDynamic.length;
      for (let i = 0; i < dLen; i++) {
          const e = visibleDynamic[i];
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

  private drawOcclusion(player: Entity, staticEntities: Entity[]) {
      if (!this.ctx) return;
      if (this.checkOcclusion(player, staticEntities)) {
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

  private checkOcclusion(player: Entity, staticEntities: Entity[]): boolean {
      const margin = 20;
      const px = player.x;
      const py = player.y;
      const pDepth = px + py;

      const len = staticEntities.length;
      for (let i = 0; i < len; i++) {
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
      const p1 = this.getScreenToWorld(0, 0, cam);
      const p2 = this.getScreenToWorld(width, 0, cam);
      const p3 = this.getScreenToWorld(0, height, cam);
      const p4 = this.getScreenToWorld(width, height, cam);
      const margin = RENDER_CONFIG.FRUSTUM_MARGIN;
      
      return {
        minX: Math.min(p1.x, p2.x, p3.x, p4.x) - margin,
        maxX: Math.max(p1.x, p2.x, p3.x, p4.x) + margin,
        minY: Math.min(p1.y, p2.y, p3.y, p4.y) - margin,
        maxY: Math.max(p1.y, p2.y, p3.y, p4.y) + margin
      };
  }

  private applyPostEffects(w: number, h: number) {
      if (!this.ctx) return;
      
      const grad = this.ctx.createRadialGradient(w/2, h/2, h/2, w/2, h/2, h);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(1, 'rgba(0,0,0,0.85)');
      this.ctx.fillStyle = grad;
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.fillRect(0, 0, w, h);

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
