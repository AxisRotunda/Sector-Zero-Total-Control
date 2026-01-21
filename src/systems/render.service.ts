
import { Injectable, inject, signal } from '@angular/core';
import { Entity, Zone, FloatingText, Camera, Particle } from '../../models/game.models';
import { WorldService } from '../game/world/world.service';
import { FloorRendererService } from './rendering/floor-renderer.service';
import { StructureRendererService } from './rendering/structure-renderer.service';
import { UnitRendererService } from './rendering/unit-renderer.service';
import { ShadowRendererService } from './rendering/shadow-renderer.service';
import { EffectRendererService } from './rendering/effect-renderer.service';
import { EntityRendererService } from './rendering/entity-renderer.service'; 
import { IsoUtils } from '../utils/iso-utils';
import { PlayerService } from '../game/player/player.service';
import { EntitySorterService } from './rendering/entity-sorter.service';
import { RENDER_CONFIG } from './rendering/render.config';
import { InputService } from '../services/input.service';
import { SpatialHashService } from './spatial-hash.service';
import { InteractionService } from '../services/interaction.service';
import { ChunkManagerService } from '../game/world/chunk-manager.service';

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
  
  private floorRenderer = inject(FloorRendererService);
  private structureRenderer = inject(StructureRendererService);
  private unitRenderer = inject(UnitRendererService);
  private shadowRenderer = inject(ShadowRendererService);
  private effectRenderer = inject(EffectRendererService);
  private entityRenderer = inject(EntityRendererService);
  
  private player = inject(PlayerService);
  
  debugMode = signal(false);
  
  // Performance Tiering
  private isHighEnd = true;

  private camCenter = { x: 0, y: 0 };

  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.inputService.setCanvas(canvas);
    
    // Simple hardware check
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
    
    // Clear
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, w, h);

    this.ctx.save();
    
    // Apply Camera Shake & Centering
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

    // --- PASS 1: BACKGROUND (Cached Floor) ---
    this.floorRenderer.drawFloor(this.ctx, cam, zone, this.world.mapBounds, w, h);

    // --- PASS 2: CULLING ---
    const frustum = this.calculateFrustum(cam, w, h);
    
    // A. Get Static Structures from ChunkManager (Walls, Buildings)
    const staticEntities = this.chunkManager.getVisibleStaticEntities(cam, w, h);
    
    // B. Get Dynamic Entities from SpatialHash (Enemies, Projectiles, Props)
    const dynamicEntities = this.spatialHash.queryRect(frustum.minX, frustum.minY, frustum.maxX, frustum.maxY, zone.id);
    
    // Filter out items already drawn in floor cache (Decorations)
    // Note: If ChunkManager handles Walls, SpatialHash might still contain them if not cleared carefully.
    // Ideally, spatialHash should NOT contain static walls if ChunkManager does.
    // For safety, we deduplicate or filter.
    const renderableDynamic = dynamicEntities.filter(e => 
        e.type !== 'WALL' && 
        !(e.type === 'DECORATION' && (e.subType === 'RUG' || e.subType === 'FLOOR_CRACK' || e.subType === 'GRAFFITI'))
    );
    
    const visibleParticles = particles.filter(p => 
        p.x >= frustum.minX && p.x <= frustum.maxX &&
        p.y >= frustum.minY && p.y <= frustum.maxY
    );

    // --- PASS 3: SORTING ---
    // Merge lists: Static Chunks + Dynamic Entities + Player + Particles
    const renderList: (Entity | Particle)[] = [...staticEntities, ...renderableDynamic, player, ...visibleParticles];
    const sortedList = this.sorter.sortForRender(renderList, player);
    
    // --- PASS 4: SHADOWS (High End Only) ---
    if (this.isHighEnd) {
        for (const e of renderList) {
            if (!(e as any).type) continue; // Skip particles
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

    // --- PASS 5: MAIN DRAW LOOP ---
    const len = sortedList.length;
    for (let i = 0; i < len; i++) {
        const obj = sortedList[i];
        
        // Type Guard Hack for Particle vs Entity
        if ((obj as Particle).life !== undefined) {
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

    // --- PASS 6: OCCLUSION X-RAY ---
    // If player is behind a tall structure in the sort list, we draw a silhouette
    const playerIndex = sortedList.indexOf(player);
    // Heuristic: If player is drawn early in the list, and there are Walls after it that obscure pos
    // This is complex to check perfectly in 2D list. 
    // Simpler: Check specific neighbors in spatial hash or Chunk manager near player pos
    if (this.checkOcclusion(player)) {
        this.ctx.save();
        this.ctx.globalAlpha = 0.3;
        this.ctx.globalCompositeOperation = 'source-over'; 
        this.unitRenderer.drawHumanoid(this.ctx, player);
        this.ctx.restore();
    }

    // --- PASS 7: EFFECTS & UI ---
    this.effectRenderer.drawGlobalEffects(this.ctx, sortedList as Entity[], player, zone, rainDrops);
    this.effectRenderer.drawFloatingTexts(this.ctx, texts, cam);
    
    const activeTarget = this.interaction.activeInteractable();
    if (activeTarget) {
        const label = this.interaction.getInteractLabel(activeTarget);
        this.effectRenderer.drawInteractionIndicator(this.ctx, activeTarget, label);
    }

    this.ctx.restore();
    
    // --- PASS 8: POST-PROCESSING ---
    this.applyPostEffects(w, h);
  }

  private checkOcclusion(player: Entity): boolean {
      // Check for walls south-east/south-west of player (visually "in front")
      const checkDist = 150;
      // Get static entities from chunks near player
      const statics = this.chunkManager.getVisibleStaticEntities(this.world.camera, 100, 100); 
      // This is inefficient to query ALL visible, but ChunkManager returns subsets.
      // Better: ask spatial hash for walls? But we moved walls to ChunkManager.
      // Let's iterate the visible statics since it's a culled list.
      
      for (const e of statics) {
          if (e.type === 'WALL' && (e.height || 0) > 80) {
              const dist = Math.hypot(e.x - player.x, e.y - player.y);
              if (dist < 100) {
                  // Simple depth check: Is the wall "visually below" the player?
                  // In iso, Y down is "forward/down".
                  const pIso = IsoUtils.toIso(player.x, player.y);
                  const wIso = IsoUtils.toIso(e.x, e.y);
                  if (wIso.y > pIso.y) return true;
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
      
      // Vignette
      const grad = this.ctx.createRadialGradient(w/2, h/2, h/2, w/2, h/2, h);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(1, 'rgba(0,0,0,0.85)');
      this.ctx.fillStyle = grad;
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.fillRect(0, 0, w, h);

      // Low Health / Glitch
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
