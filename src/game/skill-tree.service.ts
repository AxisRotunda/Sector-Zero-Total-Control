
import { Injectable, signal, computed } from '@angular/core';
import * as BALANCE from '../config/balance.config';
import { ICONS } from '../config/icons.config';

export type NodeType = 'CORE' | 'MINOR' | 'MAJOR' | 'KEYSTONE';
export type BranchType = 'NEUTRAL' | 'VANGUARD' | 'GHOST' | 'PSION';

export interface SkillNode {
  id: string;
  x: number;
  y: number;
  name: string;
  description: string;
  lore?: string;
  type: NodeType;
  branch: BranchType;
  iconPath: string;
  stats: { [key: string]: number };
  connections: string[];
  allocated: boolean;
  available: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SkillTreeService {
  nodes = signal<SkillNode[]>([]);
  skillPoints = signal<number>(0);
  
  totalStats = computed(() => {
    const stats = {
      phys: 10, tech: 10, psyche: 10, hpMax: BALANCE.PLAYER.BASE_HP,
      damage: 0, speed: 0, cdr: 0, armorPen: 0,
    };

    this.nodes().filter(n => n.allocated).forEach(n => {
      if (n.stats['phys']) stats.phys += n.stats['phys'];
      if (n.stats['tech']) stats.tech += n.stats['tech'];
      if (n.stats['psy']) stats.psyche += n.stats['psy'];
      if (n.stats['hp']) stats.hpMax += n.stats['hp'];
      if (n.stats['dmg']) stats.damage += n.stats['dmg'];
      if (n.stats['spd']) stats.speed += n.stats['spd'];
      if (n.stats['cdr']) stats.cdr += n.stats['cdr'];
      if (n.stats['armorPen']) stats.armorPen += n.stats['armorPen'];
    });

    stats.hpMax += stats.phys * BALANCE.SKILL_TREE.PHYS_HP_SCALE;
    stats.damage += stats.phys * BALANCE.SKILL_TREE.PHYS_DMG_SCALE;
    stats.speed += stats.tech * BALANCE.SKILL_TREE.TECH_SPEED_SCALE;
    stats.cdr += stats.psyche * BALANCE.SKILL_TREE.PSI_CDR_SCALE;

    return stats;
  });

  constructor() {
    this.generateTree();
  }

  addPoint() {
    this.skillPoints.update(p => p + 1);
    this.updateAvailability();
  }

  allocate(nodeId: string) {
    const node = this.nodes().find(n => n.id === nodeId);
    if (!node || node.allocated || !node.available || this.skillPoints() < 1) return;
    this.skillPoints.update(p => p - 1);
    this.nodes.update(nodes => nodes.map(n => n.id === nodeId ? { ...n, allocated: true } : n));
    this.updateAvailability();
  }

  private updateAvailability() {
    this.nodes.update(nodes => {
      const allocatedIds = new Set(nodes.filter(n => n.allocated).map(n => n.id));
      return nodes.map(node => {
        if (node.type === 'CORE') return { ...node, available: !node.allocated };
        const isNeighborAllocated = node.connections.some(connId => allocatedIds.has(connId)) || 
                                    nodes.some(n => n.connections.includes(node.id) && n.allocated);
        return { ...node, available: isNeighborAllocated && !node.allocated };
      });
    });
  }

  private generateTree() {
    const nodes: SkillNode[] = [];
    const add = (id: string, x: number, y: number, name: string, type: NodeType, branch: BranchType, iconPath: string, stats: any, connections: string[] = [], desc: string = '', lore: string = '') => {
        nodes.push({ id, x, y, name, type, branch, iconPath, stats, connections, description: desc, lore, allocated: false, available: false });
    };

    add('root', 0, 0, 'Cortex Interface', 'CORE', 'NEUTRAL', ICONS.BRAIN, { hp: 20 }, [], 'Base neural link established.', 'The seat of consciousness.');
    nodes[0].allocated = true;

    add('v_1', -80, -80, 'Hardened Skin', 'MINOR', 'VANGUARD', ICONS.SHIELD, { phys: 5, hp: 20 }, ['root'], '+5 Phys, +20 HP');
    add('v_2', -160, -160, 'Muscle Fiber', 'MINOR', 'VANGUARD', ICONS.MUSCLE, { dmg: 5 }, ['v_1'], '+5 Damage');
    add('v_3', -240, -120, 'Impact Plates', 'MAJOR', 'VANGUARD', ICONS.ARMOR, { armorPen: 5, hp: 50 }, ['v_2'], '+5 Armor Pen, +50 HP', 'Subdermal plating designed for riot control.');
    add('v_rp', -320, -60, 'REINFORCED PLATING', 'MAJOR', 'VANGUARD', ICONS.SHIELD, { armorPen: 5, hp: 50 }, ['v_3'], '+5 Armor Pen, +50 HP', 'Heavy-duty plating fused directly to the skeletal frame.');
    add('v_4', -240, -200, 'Violent Force', 'MAJOR', 'VANGUARD', ICONS.SWORD, { dmg: 15 }, ['v_2'], '+15 Damage', 'Hydraulic limiters removed.');
    add('v_key', -400, -160, 'TITAN FRAME', 'KEYSTONE', 'VANGUARD', ICONS.CUBE, { phys: 20, hp: 200 }, ['v_3', 'v_4'], '+20 Phys, +200 HP', 'Experimental heavy-assault chassis prototype.');

    add('g_1', 80, -80, 'Servo Motor', 'MINOR', 'GHOST', ICONS.BOLT, { tech: 5, spd: 0.2 }, ['root'], '+5 Tech, +2 Speed');
    add('g_2', 160, -160, 'Optic Camo', 'MINOR', 'GHOST', ICONS.EYE, { crit: 5 }, ['g_1'], '+5% Crit Chance');
    add('g_3', 240, -120, 'Mono-Edge', 'MAJOR', 'GHOST', ICONS.KNIFE, { dmg: 10, crit: 5 }, ['g_2'], '+10 Dmg, +5% Crit', 'Molecularly sharpened blades.');
    add('g_4', 240, -200, 'Overclock', 'MAJOR', 'GHOST', ICONS.FAST, { spd: 0.5, tech: 10 }, ['g_2'], '+0.5 Speed, +10 Tech', 'Running hot, moving fast.');
    add('g_key', 350, -160, 'PHANTOM PROTOCOL', 'KEYSTONE', 'GHOST', ICONS.GHOST, { crit: 15, armorPen: 15 }, ['g_3', 'g_4'], '+15% Crit, +15 Armor Pen', 'You are everywhere and nowhere.');

    add('p_1', 0, 100, 'Synapse Expansion', 'MINOR', 'PSION', ICONS.ORB, { psy: 5, cdr: 2 }, ['root'], '+5 Psy, +2% CDR');
    add('p_2', 0, 200, 'Mind Over Matter', 'MINOR', 'PSION', ICONS.MEDITATE, { cdr: 5 }, ['p_1'], '+5% CDR');
    add('p_3', -80, 280, 'Energy Siphon', 'MAJOR', 'PSION', ICONS.BATTERY, { ls: 2, psy: 10 }, ['p_2'], '+2% Lifesteal, +10 Psy', 'Feed on their fear.');
    add('p_4', 80, 280, 'Temporal Shift', 'MAJOR', 'PSION', ICONS.HOURGLASS, { cdr: 10, spd: 0.2 }, ['p_2'], '+10% CDR, +0.2 Speed', 'Reality bends to your will.');
    add('p_key', 0, 380, 'ASCENDANCE', 'KEYSTONE', 'PSION', ICONS.STAR, { psy: 30, cdr: 15 }, ['p_3', 'p_4'], '+30 Psy, +15% CDR', 'Flesh is temporary. The mind is eternal.');

    add('h_vg', 0, -250, 'Executioner', 'MAJOR', 'NEUTRAL', ICONS.SKULL, { dmg: 25, crit: 10 }, ['v_4', 'g_4'], '+25 Dmg, +10% Crit', 'Precision meets brute force.');

    this.nodes.set(nodes);
    this.updateAvailability();
  }

  getSaveData() { return { skillPoints: this.skillPoints(), allocated: this.nodes().filter(n => n.allocated).map(n => n.id) }; }
  loadSaveData(data: any) {
    if (typeof data.skillPoints === 'number') this.skillPoints.set(data.skillPoints);
    if (Array.isArray(data.allocated)) {
        const allocatedSet = new Set(data.allocated);
        this.nodes.update(nodes => nodes.map(n => ({ ...n, allocated: allocatedSet.has(n.id) })));
    }
    this.updateAvailability();
  }
  reset() { this.skillPoints.set(0); this.generateTree(); }
}
