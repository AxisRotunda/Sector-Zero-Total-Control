
import { Injectable } from '@angular/core';
import { WORLD_GRAPH } from '../../data/world/world-graph.config';
import { WorldZoneConfig } from '../../models/zone.models';

@Injectable({
  providedIn: 'root'
})
export class ZoneHierarchyManagerService {
  private graph = WORLD_GRAPH;

  getParent(zoneId: string): string | undefined {
    const zone = this.graph.zones[zoneId];
    return zone?.parentZoneId;
  }

  getChildren(zoneId: string): string[] {
    const zone = this.graph.zones[zoneId];
    return zone?.childZoneIds || [];
  }

  getSiblings(zoneId: string): string[] {
    const parentId = this.getParent(zoneId);
    if (!parentId) return [];
    return this.getChildren(parentId).filter(id => id !== zoneId);
  }

  getZoneConfig(zoneId: string): WorldZoneConfig | undefined {
    return this.graph.zones[zoneId];
  }

  isChildOf(childId: string, parentId: string): boolean {
    let current = childId;
    while (current) {
        const p = this.getParent(current);
        if (p === parentId) return true;
        if (!p) return false;
        current = p;
    }
    return false;
  }

  getPathToRoot(zoneId: string): string[] {
      const path: string[] = [zoneId];
      let current = zoneId;
      while (true) {
          const parent = this.getParent(current);
          if (!parent) break;
          path.unshift(parent);
          current = parent;
      }
      return path;
  }
}
