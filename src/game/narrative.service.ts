
import { Injectable, signal, computed } from '@angular/core';
import { FACTIONS, DATA_LOGS, ENTITY_LORE, ZONE_LORE } from '../config/narrative.config';
import { Faction, FactionReputation, ZoneLore } from '../models/narrative.models';

@Injectable({ providedIn: 'root' })
export class NarrativeService {
  private reputations = signal<Map<Faction['id'], number>>(
    new Map([['VANGUARD', 0], ['REMNANT', 10], ['RESONANT', -20]])
  );
  private discoveredLogs = signal<Set<string>>(new Set());
  private discoveredEntities = signal<Set<string>>(new Set());
  private discoveredZones = signal<Set<string>>(new Set());
  private narrativeFlags = signal<Map<string, boolean>>(new Map());

  readonly factionStandings = computed(() => {
    const standings: FactionReputation[] = [];
    const currentReps = this.reputations();
    for (const factionId of ['VANGUARD', 'REMNANT', 'RESONANT'] as Faction['id'][]) {
      const value = currentReps.get(factionId) || 0;
      let standing: any = 'NEUTRAL';
      if (value <= -50) standing = 'HOSTILE';
      else if (value < 0) standing = 'UNFRIENDLY';
      else if (value < 30) standing = 'NEUTRAL';
      else if (value < 70) standing = 'FRIENDLY';
      else standing = 'ALLIED';
      standings.push({ factionId, value, standing });
    }
    return standings;
  });

  readonly discoveredLogsList = computed(() => DATA_LOGS.filter(log => this.discoveredLogs().has(log.id)));
  readonly discoveredEntityList = computed(() => Object.values(ENTITY_LORE).filter(e => this.discoveredEntities().has(e.id)).sort((a,b) => a.name.localeCompare(b.name)));
  readonly discoveredZonesList = computed(() => Object.values(ZONE_LORE).filter(z => this.discoveredZones().has(z.id)).sort((a,b) => a.name.localeCompare(b.name)));

  modifyReputation(factionId: Faction['id'], delta: number): void {
    const current = this.reputations().get(factionId) || 0;
    const updated = new Map(this.reputations());
    updated.set(factionId, Math.max(-100, Math.min(100, current + delta)));
    this.reputations.set(updated);
  }

  getReputation(factionId: Faction['id']): number {
    return this.reputations().get(factionId) || 0;
  }

  discoverLog(logId: string): boolean {
    if (this.discoveredLogs().has(logId)) return false;
    const updated = new Set(this.discoveredLogs());
    updated.add(logId);
    this.discoveredLogs.set(updated);
    return true; 
  }

  discoverEntity(entityType: string): boolean {
      if (!entityType || this.discoveredEntities().has(entityType)) return false;
      if (!ENTITY_LORE[entityType]) return false;
      const updated = new Set(this.discoveredEntities());
      updated.add(entityType);
      this.discoveredEntities.set(updated);
      return true;
  }

  discoverZone(zoneId: string): boolean {
      if (!zoneId || this.discoveredZones().has(zoneId)) return false;
      if (!ZONE_LORE[zoneId]) return false; // Only discover zones with Lore entries
      const updated = new Set(this.discoveredZones());
      updated.add(zoneId);
      this.discoveredZones.set(updated);
      return true;
  }

  setFlag(flagId: string, value: boolean = true): void {
    const updated = new Map(this.narrativeFlags());
    updated.set(flagId, value);
    this.narrativeFlags.set(updated);
  }

  getFlag(flagId: string): boolean {
    return this.narrativeFlags().get(flagId) || false;
  }

  getSaveData() {
    return {
      reputations: Array.from(this.reputations().entries()),
      discoveredLogs: Array.from(this.discoveredLogs()),
      discoveredEntities: Array.from(this.discoveredEntities()),
      discoveredZones: Array.from(this.discoveredZones()),
      narrativeFlags: Array.from(this.narrativeFlags().entries())
    };
  }

  loadSaveData(data: any): void {
    if (!data) return;
    if (data.reputations) this.reputations.set(new Map(data.reputations));
    if (data.discoveredLogs) this.discoveredLogs.set(new Set(data.discoveredLogs));
    if (data.discoveredEntities) this.discoveredEntities.set(new Set(data.discoveredEntities));
    if (data.discoveredZones) this.discoveredZones.set(new Set(data.discoveredZones));
    if (data.narrativeFlags) this.narrativeFlags.set(new Map(data.narrativeFlags));
  }

  reset(): void {
    this.reputations.set(new Map([['VANGUARD', 0], ['REMNANT', 10], ['RESONANT', -20]]));
    this.discoveredLogs.set(new Set());
    this.discoveredEntities.set(new Set());
    this.discoveredZones.set(new Set());
    this.narrativeFlags.set(new Map());
  }
}
