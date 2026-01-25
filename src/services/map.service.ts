
import { Injectable, signal } from '@angular/core';
import { SectorId } from '../models/game.models';

export interface MapSettings {
  miniMapOpacity: number;
  miniMapZoom: number;
  showEnemyRadar: boolean;
  showTrail: boolean;
  showMarkers: boolean;
  rotateMiniMap: boolean;
  fullMapOpacity: number;
  gridOpacity: number;
  debugKernel: boolean; // New Debug Flag
}

export interface MapMarker {
    x: number; y: number; color: string; label?: string; type?: 'USER' | 'OBJECTIVE';
}

@Injectable({
  providedIn: 'root'
})
export class MapService {
  settings = signal<MapSettings>({
    miniMapOpacity: 0.9, miniMapZoom: 0.2, showEnemyRadar: true, showTrail: true,
    showMarkers: true, rotateMiniMap: true, fullMapOpacity: 0.95, gridOpacity: 0.1,
    debugKernel: false
  });

  // Map<SectorId, Set<ChunkKey>>
  private visitedSectors = new Map<SectorId, Set<string>>();
  private currentSectorId: SectorId = 'HUB';
  
  private readonly chunkSize = 600;
  
  // User placed markers
  markers = signal<MapMarker[]>([]);
  
  // System generated markers (Missions)
  objectiveMarkers = signal<MapMarker[]>([]);

  isFullMapOpen = signal(false);
  isSettingsOpen = signal(false);

  setSector(id: SectorId) {
      this.currentSectorId = id;
      if (!this.visitedSectors.has(id)) {
          this.visitedSectors.set(id, new Set());
      }
      // Reset markers for new sector
      this.markers.set([]); 
      this.objectiveMarkers.set([]);
  }

  updateDiscovery(x: number, y: number) {
    const visited = this.visitedSectors.get(this.currentSectorId);
    if (!visited) return;

    const cx = Math.floor(x / this.chunkSize);
    const cy = Math.floor(y / this.chunkSize);
    for(let i=-1; i<=1; i++) {
        for(let j=-1; j<=1; j++) {
            visited.add(`${cx+i},${cy+j}`);
        }
    }
  }

  isChunkVisited(x: number, y: number): boolean {
      const visited = this.visitedSectors.get(this.currentSectorId);
      if (!visited) return false;
      const cx = Math.floor(x / this.chunkSize);
      const cy = Math.floor(y / this.chunkSize);
      return visited.has(`${cx},${cy}`);
  }

  addMarker(x: number, y: number, color: string = '#facc15', label?: string) {
      this.markers.update(m => [...m, {x, y, color, label, type: 'USER'}]);
  }

  removeMarkerAt(x: number, y: number, radius: number = 50) {
      this.markers.update(m => m.filter(marker => Math.hypot(marker.x - x, marker.y - y) > radius));
  }
  
  setObjectiveMarkers(markers: MapMarker[]) {
      this.objectiveMarkers.set(markers.map(m => ({...m, type: 'OBJECTIVE'})));
  }

  reset() {
      this.visitedSectors.clear();
      this.markers.set([]);
      this.objectiveMarkers.set([]);
      this.isFullMapOpen.set(false);
      this.currentSectorId = 'HUB';
  }

  toggleFullMap() {
      this.isFullMapOpen.update(v => !v);
      if (this.isFullMapOpen()) this.isSettingsOpen.set(false);
  }
  
  toggleSettings() {
      this.isSettingsOpen.update(v => !v);
      if (this.isSettingsOpen()) this.isFullMapOpen.set(false);
  }

  updateSetting<K extends keyof MapSettings>(key: K, value: MapSettings[K]) {
      this.settings.update(s => ({ ...s, [key]: value }));
  }

  getSaveData() { 
      // Convert Map<SectorId, Set> to Array structure for JSON
      const visitedData = Array.from(this.visitedSectors.entries()).map(([k, v]) => [k, Array.from(v)]);
      return { 
          visitedSectors: visitedData, 
          markers: this.markers(), 
          settings: this.settings() 
      }; 
  }
  
  loadSaveData(data: any) {
      if (data.visitedSectors) {
          this.visitedSectors = new Map(data.visitedSectors.map(([k, v]: [string, string[]]) => [k, new Set(v)]));
      }
      if (data.markers) this.markers.set(data.markers);
      if (data.settings) this.settings.set({ ...this.settings(), ...data.settings });
  }
}
