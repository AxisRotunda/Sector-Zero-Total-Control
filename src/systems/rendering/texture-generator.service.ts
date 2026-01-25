
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
  
  // Cache patterns to prevent regeneration loop
  private patternCache = new Map<string, CanvasPattern>();

  constructor() {}

  private getPattern(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): CanvasPattern | null {
      if (this.patternCache.has(key)) return this.patternCache.get(key)!;
      
      if (typeof document === 'undefined') return null;

      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) return null;
      
      draw(ctx);
      const pattern = ctx.createPattern(c, 'repeat');
      if (pattern) this.patternCache.set(key, pattern);
      return pattern;
  }

  getThemeVisuals(theme: ZoneTheme = 'INDUSTRIAL'): ThemeVisuals {
      const noise = this.getPattern('noise', 64, 64, (ctx) => {
          for(let i=0; i<400; i++) {
              ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
              ctx.fillRect(Math.random()*64, Math.random()*64, 2, 2);
          }
      });

      const base: ThemeVisuals = { pattern: noise, edgeColor: '#000000', erosionLevel: 0.1, rimLight: false, fillOpacity: 1.0, detailStyle: 'NONE' };
      
      switch(theme) {
          case 'RESIDENTIAL':
              return { ...base, pattern: noise, edgeColor: '#1e1b4b', erosionLevel: 0.05, rimLight: true, overlayColor: '#f472b6', detailStyle: 'PLATING' };
          case 'HIGH_TECH':
              const grid = this.getPattern('grid', 64, 64, (ctx) => {
                  ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)'; ctx.lineWidth = 1;
                  ctx.beginPath(); ctx.moveTo(0, 32); ctx.lineTo(16, 0); ctx.lineTo(48, 0); ctx.lineTo(64, 32); ctx.lineTo(48, 64); ctx.lineTo(16, 64); ctx.closePath(); ctx.stroke();
                  ctx.fillStyle = 'rgba(6, 182, 212, 0.05)'; ctx.fill();
              });
              return { ...base, pattern: grid, edgeColor: '#0ea5e9', erosionLevel: 0.0, rimLight: true, fillOpacity: 0.9, detailStyle: 'CIRCUITS' };
          case 'ORGANIC':
              const moss = this.getPattern('moss', 128, 128, (ctx) => {
                  for(let i=0; i<80; i++) {
                      const size = Math.random() * 15;
                      ctx.fillStyle = `rgba(20, 100, 40, ${Math.random() * 0.3})`;
                      ctx.beginPath(); ctx.arc(Math.random()*128, Math.random()*128, size, 0, Math.PI*2); ctx.fill();
                  }
              });
              return { ...base, pattern: moss, edgeColor: '#052e16', erosionLevel: 0.4, rimLight: false, detailStyle: 'NONE' };
          case 'VOID':
              const voidPat = this.getPattern('void', 64, 64, (ctx) => {
                  ctx.fillStyle = 'rgba(147, 51, 234, 0.1)';
                  for(let i=0; i<10; i++) ctx.fillRect(Math.random()*64, Math.random()*64, Math.random()*20, 2);
              });
              return { ...base, pattern: voidPat, edgeColor: '#581c87', erosionLevel: 0.3, rimLight: true, overlayColor: '#a855f7', detailStyle: 'GLYPHS' };
          case 'FROZEN':
              const vanguard = this.getPattern('vanguard', 200, 200, (ctx) => {
                  ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)'; ctx.lineWidth = 2;
                  ctx.beginPath(); ctx.moveTo(100, 50); ctx.lineTo(150, 150); ctx.lineTo(50, 150); ctx.closePath(); ctx.stroke();
                  ctx.beginPath(); ctx.arc(100, 115, 10, 0, Math.PI * 2); ctx.stroke();
                  ctx.fillStyle = 'rgba(6, 182, 212, 0.05)'; ctx.fillRect(50, 160, 100, 5);
              });
              return { ...base, pattern: vanguard, edgeColor: '#bae6fd', erosionLevel: 0.2, rimLight: true, fillOpacity: 0.8, detailStyle: 'PLATING', overlayColor: '#e0f2fe' };
          case 'INDUSTRIAL':
          default:
              const plating = this.getPattern('plating', 100, 100, (ctx) => {
                  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; ctx.strokeRect(2, 2, 96, 96);
                  ctx.fillStyle = 'rgba(0,0,0,0.4)'; 
                  ctx.beginPath(); ctx.arc(10, 10, 2, 0, Math.PI*2); ctx.fill();
                  ctx.beginPath(); ctx.arc(90, 10, 2, 0, Math.PI*2); ctx.fill();
              });
              return { ...base, pattern: plating, edgeColor: '#000000', erosionLevel: 0.1, rimLight: false, detailStyle: 'RIVETS' };
      }
  }

  adjustColor(hex: string, percent: number) {
      if (!hex) return '#333333';
      let fullHex = hex.replace(/^#/, '');
      if (fullHex.length === 3) fullHex = fullHex.split('').map(c => c + c).join('');
      else if (fullHex.length !== 6) return hex.length > 0 ? hex : '#333333';

      let R = parseInt(fullHex.substring(0,2), 16); 
      let G = parseInt(fullHex.substring(2,4), 16); 
      let B = parseInt(fullHex.substring(4,6), 16);

      if (isNaN(R) || isNaN(G) || isNaN(B)) return hex;

      R = Math.min(255, Math.max(0, R + percent)); 
      G = Math.min(255, Math.max(0, G + percent)); 
      B = Math.min(255, Math.max(0, B + percent));
      
      const RR = R.toString(16).padStart(2, '0');
      const GG = G.toString(16).padStart(2, '0');
      const BB = B.toString(16).padStart(2, '0');
      
      return "#"+RR+GG+BB;
  }
}
