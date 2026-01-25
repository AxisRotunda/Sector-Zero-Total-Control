
import { Injectable, signal } from '@angular/core';
import { LightSource, GlobalIllumination } from '../../models/rendering.models';
import { Camera, Zone } from '../../models/game.models';

@Injectable({ providedIn: 'root' })
export class LightingService {
  
  // State
  globalAmbient = signal<GlobalIllumination>({ ambientColor: '#000000', intensity: 0.8 });
  private lights = new Map<string, LightSource>();
  
  // Optimization: Pre-allocated array for render pass
  visibleLights: LightSource[] = [];

  get allLights(): LightSource[] {
      return Array.from(this.lights.values());
  }

  registerLight(light: LightSource) {
      this.lights.set(light.id, light);
  }

  removeLight(id: string) {
      this.lights.delete(id);
  }

  clear() {
      this.lights.clear();
  }

  update(dt: number, time: number) {
      // Animate dynamic lights
      this.lights.forEach(light => {
          if (light.type === 'FLICKER') {
              // Random flicker for fire/faulty electronics
              const noise = Math.random() * 0.2 - 0.1;
              light.intensity = Math.max(0.1, Math.min(1.0, (light.baseIntensity || 0.5) + noise));
          } else if (light.type === 'PULSE') {
              // Smooth sine wave for machinery/magic
              const speed = light.flickerSpeed || 0.005;
              const offset = light.pulseOffset || 0;
              const sine = Math.sin(time * speed + offset);
              light.intensity = (light.baseIntensity || 0.6) + (sine * 0.2);
          }
      });
  }

  updateGlobalIllumination(zone: Zone) {
      // ARPG Pattern: Different ambient levels per zone theme
      let intensity = 0.9;
      let color = '#000000';

      switch (zone.theme) {
          case 'INDUSTRIAL': intensity = 0.85; break; // Dark, oppressive
          case 'HIGH_TECH': intensity = 0.6; color = '#0f172a'; break; // Sterile, slightly brighter
          case 'RESIDENTIAL': intensity = 0.95; color = '#1a0505'; break; // Very dark, neon pop
          case 'ORGANIC': intensity = 0.7; color = '#022c22'; break; // Dim, green tint
          case 'VOID': intensity = 0.95; color = '#020617'; break; // Pitch black
          case 'FROZEN': intensity = 0.7; color = '#eff6ff'; break; // Bright, cold reflection
      }
      
      // SOCIO-POLITICAL OVERRIDE: Safe Zones (Hubs) should be well-lit to represent Order/Safety
      // Lower intensity value = Less darkness alpha = Brighter scene
      if (zone.isSafeZone) {
          intensity = Math.min(intensity, 0.4); 
          // Shift ambient towards blue/white in safe zones for sterility
          if (color === '#000000') color = '#1e293b'; 
      }
      
      this.globalAmbient.set({ ambientColor: color, intensity });
  }

  // Culling: Only return lights inside the camera view
  cullLights(cam: Camera, viewportWidth: number, viewportHeight: number): void {
      this.visibleLights.length = 0; // Clear without alloc
      
      // Calculate World Bounds of Viewport
      const worldW = viewportWidth / cam.zoom;
      const worldH = viewportHeight / cam.zoom;
      // Iso Expansion Factor (roughly 1.5x coverage needed due to rotation)
      const buffer = Math.max(worldW, worldH) * 0.8; 

      const minX = cam.x - buffer;
      const maxX = cam.x + buffer;
      const minY = cam.y - buffer;
      const maxY = cam.y + buffer;

      for (const light of this.lights.values()) {
          // Simple AABB check
          if (light.x + light.radius > minX && light.x - light.radius < maxX &&
              light.y + light.radius > minY && light.y - light.radius < maxY) {
              this.visibleLights.push(light);
          }
      }
  }
}
