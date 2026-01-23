
import { Injectable } from '@angular/core';
import { ZoneTheme } from '../../models/game.models';

export interface ThemeVisuals {
    pattern: CanvasPattern | null;
    edgeColor: string;
    erosionLevel: number; // 0 to 1
    rimLight: boolean;
    fillOpacity: number;
    overlayColor?: string;
    detailStyle: 'NONE' | 'RIVETS' | 'CIRCUITS' | 'GLYPHS' | 'PLATING';
}

@Injectable({ providedIn: 'root' })
export class TextureGeneratorService {
  
  // Patterns
  public patterns: Record<string, CanvasPattern | null> = {
      noise: null,
      rust: null,
      moss: null,
      grid: null,
      void: null,
      circuit: null,
      plating: null,
      ice: null
  };

  constructor() {
      this.initPatterns();
  }

  private initPatterns() {
      if (typeof document === 'undefined') return;
      
      const createPattern = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d')!;
          draw(ctx);
          return ctx.createPattern(c, 'repeat');
      };

      // 1. General Grime
      this.patterns.noise = createPattern(64, 64, (ctx) => {
          for(let i=0; i<400; i++) {
              ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
              ctx.fillRect(Math.random()*64, Math.random()*64, 2, 2);
          }
      });

      // 2. Rust (Industrial)
      this.patterns.rust = createPattern(128, 128, (ctx) => {
          for(let i=0; i<50; i++) {
              const size = Math.random() * 20;
              ctx.fillStyle = `rgba(180, 80, 50, ${Math.random() * 0.2})`;
              ctx.beginPath(); ctx.arc(Math.random()*128, Math.random()*128, size, 0, Math.PI*2); ctx.fill();
          }
      });

      // 3. Moss (Organic)
      this.patterns.moss = createPattern(128, 128, (ctx) => {
          for(let i=0; i<80; i++) {
              const size = Math.random() * 15;
              ctx.fillStyle = `rgba(20, 100, 40, ${Math.random() * 0.3})`;
              ctx.beginPath(); ctx.arc(Math.random()*128, Math.random()*128, size, 0, Math.PI*2); ctx.fill();
          }
      });

      // 4. Hex Grid (High Tech)
      this.patterns.grid = createPattern(64, 64, (ctx) => {
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, 32); ctx.lineTo(16, 0); ctx.lineTo(48, 0); ctx.lineTo(64, 32); ctx.lineTo(48, 64); ctx.lineTo(16, 64); ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = 'rgba(6, 182, 212, 0.05)';
          ctx.fill();
      });
      
      // 5. Void Glitch
      this.patterns.void = createPattern(64, 64, (ctx) => {
          ctx.fillStyle = 'rgba(147, 51, 234, 0.1)';
          for(let i=0; i<10; i++) {
              ctx.fillRect(Math.random()*64, Math.random()*64, Math.random()*20, 2);
          }
      });

      // 6. Circuits (High Tech Detail)
      this.patterns.circuit = createPattern(100, 100, (ctx) => {
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(10, 10); ctx.lineTo(90, 10); ctx.lineTo(90, 50); ctx.lineTo(50, 50); ctx.lineTo(50, 90);
          ctx.stroke();
          ctx.fillStyle = 'rgba(6, 182, 212, 0.3)';
          ctx.beginPath(); ctx.arc(10, 10, 3, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(50, 90, 3, 0, Math.PI*2); ctx.fill();
      });

      // 7. Plating (Industrial Detail)
      this.patterns.plating = createPattern(100, 100, (ctx) => {
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          ctx.lineWidth = 2;
          ctx.strokeRect(2, 2, 96, 96);
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.beginPath(); ctx.arc(10, 10, 2, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(90, 10, 2, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(90, 90, 2, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(10, 90, 2, 0, Math.PI*2); ctx.fill();
      });

      // 8. Ice (Frozen) - Jagged Cracks
      this.patterns.ice = createPattern(128, 128, (ctx) => {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 1;
          for (let i = 0; i < 5; i++) {
              ctx.beginPath();
              ctx.moveTo(Math.random() * 128, Math.random() * 128);
              ctx.lineTo(Math.random() * 128, Math.random() * 128);
              ctx.stroke();
          }
          ctx.fillStyle = 'rgba(200, 230, 255, 0.1)';
          ctx.fillRect(0, 0, 128, 128);
      });
  }

  getThemeVisuals(theme: ZoneTheme = 'INDUSTRIAL'): ThemeVisuals {
      const base: ThemeVisuals = { pattern: this.patterns.noise, edgeColor: '#000000', erosionLevel: 0.1, rimLight: false, fillOpacity: 1.0, detailStyle: 'NONE' };
      
      switch(theme) {
          case 'RESIDENTIAL':
              return { ...base, pattern: this.patterns.noise, edgeColor: '#1e1b4b', erosionLevel: 0.05, rimLight: true, overlayColor: '#f472b6', detailStyle: 'PLATING' };
          case 'HIGH_TECH':
              return { ...base, pattern: this.patterns.grid, edgeColor: '#0ea5e9', erosionLevel: 0.0, rimLight: true, fillOpacity: 0.9, detailStyle: 'CIRCUITS' };
          case 'ORGANIC':
              return { ...base, pattern: this.patterns.moss, edgeColor: '#052e16', erosionLevel: 0.4, rimLight: false, detailStyle: 'NONE' };
          case 'VOID':
              return { ...base, pattern: this.patterns.void, edgeColor: '#581c87', erosionLevel: 0.3, rimLight: true, overlayColor: '#a855f7', detailStyle: 'GLYPHS' };
          case 'FROZEN':
              return { ...base, pattern: this.patterns.ice, edgeColor: '#bae6fd', erosionLevel: 0.2, rimLight: true, fillOpacity: 0.8, detailStyle: 'PLATING', overlayColor: '#e0f2fe' };
          case 'INDUSTRIAL':
          default:
              return { ...base, pattern: this.patterns.plating, edgeColor: '#000000', erosionLevel: 0.1, rimLight: false, detailStyle: 'RIVETS' };
      }
  }

  adjustColor(hex: string, percent: number) {
      if (!hex) return '#333333';
      let R = parseInt(hex.substring(1,3),16); let G = parseInt(hex.substring(3,5),16); let B = parseInt(hex.substring(5,7),16);
      R = Math.min(255, Math.max(10, R + percent)); G = Math.min(255, Math.max(10, G + percent)); B = Math.min(255, Math.max(15, B + percent));
      const RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16)); const GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16)); const BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));
      return "#"+RR+GG+BB;
  }
}
