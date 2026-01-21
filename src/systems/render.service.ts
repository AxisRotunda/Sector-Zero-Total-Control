
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
  
  private floorRenderer = inject(FloorRendererService);
  private structureRenderer = inject(StructureRendererService);
  private unitRenderer = inject(UnitRendererService);
  private shadowRenderer = inject(ShadowRendererService);
  private effectRenderer = inject(EffectRendererService);
  private entityRenderer = inject(EntityRendererService);
  
  private player = inject(PlayerService);
  
  debugMode = signal(false);

  private camCenter = { x: 0, y: 0 };

  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.inputService.setCanvas(canvas);
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

    // --- PASS 1: BACKGROUND (Floor Cache) ---
    this.floorRenderer.drawFloor(this.ctx, cam, zone, this.world.mapBounds, w, h);

    // --- PASS 2: EFFICIENT CULLING VIA SPATIAL HASH ---
    const frustum = this.calculateFrustum(cam, w, h);
    
    const visibleEntitiesInRect = this.spatialHash.queryRect(frustum.minX, frustum.minY, frustum.maxX, frustum.maxY, zone.id);
    
    // Only filter out strictly FLAT decorations. Cables and HoloTables are 3D.
    const renderableEntities = visibleEntitiesInRect.filter(e => 
        !(e.type === 'DECORATION' && (e.subType === 'RUG' || e.subType === 'FLOOR_CRACK' || e.subType === 'GRAFFITI'))
    );
    
    const visibleParticles = particles.filter(p => 
        p.x >= frustum.minX && p.x <= frustum.maxX &&
        p.y >= frustum.minY && p.y <= frustum.maxY
    );

    // --- PASS 3: SORTING ---
    const sortedRenderList = this.sorter.sortForRender(renderableEntities, visibleParticles, player);
    
    // --- PASS 4: SHADOWS ---
    for (const e of sortedRenderList) {
        if (!e.type) continue; // Skip particles
        if (e.type === 'PLAYER' || e.type === 'ENEMY' || e.type === 'NPC') {
            this.shadowRenderer.drawUnitShadow(this.ctx, e);
        } else if (e.type === 'WALL' || e.type === 'DECORATION') {
            if (e.height && e.height > 50 && e.subType !== 'CABLE') { // Cables don't cast simple shadows
                this.shadowRenderer.drawStructureShadow(this.ctx, e);
            }
        }
    }

    // --- PASS 5: ENTITIES & PARTICLES ---
    let playerDrawn = false;
    const len = sortedRenderList.length;
    for (let i = 0; i < len; i++) {
        const obj = sortedRenderList[i];

        if (obj.type === 'PLAYER') {
          playerDrawn = true;
          this.effectRenderer.drawPsionicWave(this.ctx, obj); 
          this.unitRenderer.drawHumanoid(this.ctx, obj);
        }
        else if (obj.type === 'ENEMY') this.unitRenderer.drawHumanoid(this.ctx, obj);
        else if (obj.type === 'NPC') this.unitRenderer.drawNPC(this.ctx, obj);
        else if (obj.type === 'WALL') this.structureRenderer.drawStructure(this.ctx, obj, zone);
        else if (obj.type === 'DECORATION') this.entityRenderer.drawDecoration(this.ctx, obj);
        else if (obj.type === 'EXIT') this.entityRenderer.drawExit(this.ctx, obj);
        else if (obj.type === 'SHRINE') this.entityRenderer.drawShrine(this.ctx, obj);
        else if (obj.type === 'DESTRUCTIBLE') this.entityRenderer.drawDestructible(this.ctx, obj);
        else if (obj.type === 'PICKUP') this.entityRenderer.drawPickup(this.ctx, obj);
        else if (obj.type === 'HITBOX') {
            if (obj.psionicEffect === 'wave') this.effectRenderer.drawPsionicWave(this.ctx, obj);
            else if (obj.subType === 'VENT' && obj.state === 'ACTIVE') this.effectRenderer.drawSteamColumn(this.ctx, obj);
            else if (obj.subType === 'SLUDGE') this.effectRenderer.drawSludge(this.ctx, obj);
            else this.effectRenderer.drawHitboxIso(this.ctx, obj);
        }
        else if (obj.life !== undefined) this.effectRenderer.drawParticleIso(this.ctx, obj);

        if (this.debugMode() && obj.radius) {
            this.effectRenderer.drawDebugHitbox(this.ctx, obj);
        }
    }

    // --- PASS 5.5: X-RAY SILHOUETTE ---
    // If the player was drawn earlier in the stack than the last item (meaning something was drawn ON TOP of them)
    // AND that something is close to the player, we draw a silhouette.
    // A simpler heuristic for isometric: If player is behind a tall wall.
    
    // Check if player is obscured by querying nearby static walls that are "in front" of the player
    const obscured = this.checkOcclusion(player, zone.id);
    if (obscured) {
        this.ctx.save();
        this.ctx.globalAlpha = 0.25;
        this.ctx.globalCompositeOperation = 'source-over'; // Just draw semi-transparent on top
        this.unitRenderer.drawHumanoid(this.ctx, player);
        this.ctx.restore();
    }

    // --- PASS 6: EFFECTS & UI OVERLAYS ---
    this.effectRenderer.drawGlobalEffects(this.ctx, renderableEntities, player, zone, rainDrops);
    this.effectRenderer.drawFloatingTexts(this.ctx, texts, cam);

    this.ctx.restore();
    
    // --- PASS 7: POST-PROCESSING ---
    this.applyPostEffects(w, h);
  }

  private checkOcclusion(player: Entity, zoneId: string): boolean {
      // Find walls that are physically south/east of player (higher X+Y in screen space logic) 
      // but close enough to obscure.
      const searchRadius = 150;
      const nearby = this.spatialHash.query(player.x, player.y, searchRadius, zoneId);
      
      for (const e of nearby) {
          if (e.type === 'WALL' || (e.type === 'DECORATION' && e.height && e.height > 80)) {
              // Basic Isometric depth check: e is "in front" if e.x + e.y > player.x + player.y
              // AND e is physically overlapping the player's screen position
              const wallDepth = e.x + e.y;
              const playerDepth = player.x + player.y;
              
              if (wallDepth > playerDepth) {
                  // Check screen space bounding box overlap approximately
                  const pPos = IsoUtils.toIso(player.x, player.y, 0);
                  const wPos = IsoUtils.toIso(e.x, e.y, 0);
                  
                  // Wall sprite usually extends UP from wPos.y
                  // Player sprite is around pPos.y
                  // If wall is in front, wPos.y is lower (visually lower on screen? No, higher Y value is lower on screen)
                  // In Canvas coordinates: Higher Y is "down".
                  // IsoUtils: out.y = (x+y)*0.5 - z. Higher world x/y means higher screen Y (lower on screen).
                  // So things "in front" have higher screen Y.
                  
                  // If wall is in front, it's drawn LAST.
                  // We need to know if the wall's pixels cover the player's pixels.
                  // Wall base is at wPos. Wall top is at wPos.y - height.
                  // Player base is at pPos. Player top is pPos.y - 60.
                  
                  // Simple radial check + depth check
                  const dist = Math.hypot(e.x - player.x, e.y - player.y);
                  if (dist < (e.width || 50) + 20) {
                      return true;
                  }
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
      const energy = this.player.stats.psionicEnergy() / this.player.stats.maxPsionicEnergy();
      const glitchChance = (integrity < 0.3 ? 0.3 : 0) + (energy > 0.9 ? 0.2 : 0);
      
      if (Math.random() < glitchChance) {
          const offset = Math.random() * 4 * (1.5 - integrity);
          this.ctx.save();
          this.ctx.globalCompositeOperation = 'screen';
          this.ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
          this.ctx.translate(offset, 0);
          this.ctx.fillRect(0, 0, w, h);
          this.ctx.restore();
      }
  }
}
