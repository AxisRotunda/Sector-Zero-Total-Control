import { Injectable, signal, computed } from '@angular/core';
import * as BALANCE from '../config/balance.config';

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
  iconPath: string; // SVG Path Data
  stats: { [key: string]: number };
  connections: string[]; // IDs of nodes this connects TO
  
  // State
  allocated: boolean;
  available: boolean;
}

const ICONS = {
    BRAIN: "M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10A10 10 0 0 1 2 12 10 10 0 0 1 12 2m0 2a8 8 0 0 0-8 8 8 8 0 0 0 8 8 8 8 0 0 0 8-8 8 8 0 0 0-8-8m0 2a6 6 0 0 1 6 6 6 6 0 0 1-6 6 6 6 0 0 1-6-6 6 6 0 0 1 6-6m0 2a4 4 0 0 0-4 4 4 4 0 0 0 4 4 4 4 0 0 0 4-4 4 4 0 0 0-4-4",
    SHIELD: "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z",
    MUSCLE: "M2 12h2v9H2v-9zm20 0h-2v9h2v-9zm-11 5v4h2v-4h-2zm-6-8h4l2 3h4l2-3h4v-3H5v3z",
    ARMOR: "M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z",
    SWORD: "M3 21l3-3 7-7-1-1 4-4 2 2 4-4-2-2-4 4 2 2-4 4-1-1-7 7-3 3",
    BOLT: "M7 2v11h3v9l7-12h-4l4-8z",
    EYE: "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z",
    KNIFE: "M3.5 21l-1-1 7.5-7.5c.67-.67 1.6-1.11 2.5-1.11h3.1L21 6l1.5 1.5-5.4 5.4v3.1c0 .9-.44 1.83-1.11 2.5L8.5 26 3.5 21z",
    FAST: "M13 6v12l8.5-6M4 6v12l8.5-6",
    ORB: "M12 2A10 10 0 1 0 12 22A10 10 0 1 0 12 2Z M12 4A8 8 0 1 1 12 20A8 8 0 1 1 12 4Z M12 6A6 6 0 1 0 12 18A6 6 0 1 0 12 6Z",
    MEDITATE: "M12 4a3 3 0 1 0-3 3 3 3 0 0 0 3-3m7 16h-3.8c-.8-2.6-2.5-4.4-4.8-5.1-.3-.1-.5-.2-.8-.2s-.5.1-.8.2c-2-3.j.7-4 2.5-4.8 5.1H3c0-3.3 2-6.2 5-7.4V12c0 2.2 1.8 4 4 4s4-1.8 4-4v-.7c3 1.2 5 4.1 5 7.4z",
    BATTERY: "M16.67 4H15V2H9v2H7.33A1.33 1.33 0 0 0 6 5.33v15.33C6 21.4 6.6 22 7.33 22h9.33c.74 0 1.34-.6 1.34-1.33V5.33C18 4.6 17.4 4 16.67 4z",
    HOURGLASS: "M6 2v6h.01L6 8.01 10 12l-4 4 .01.01H6V22h12v-5.99h-.01L18 16l-4-4 4-3.99-.01-.01H18V2H6z",
    STAR: "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
    SKULL: "M12 2c-4.42 0-8 3.58-8 8 0 2.76 1.41 5.2 3.57 6.63L7 22h10l-.57-5.37C18.59 15.2 20 12.76 20 10c0-4.42-3.58-8-8-8zm0 13c-1.1 0-2-.9-2-2h4c0 1.1-.9 2-2 2z",
    CUBE: "M12 2L2 7l10 5 10-5-10-5zm0 12L2 9v10l10 5 10-5V9l-10 5z",
    GHOST: "M12 2a9 9 0 0 0-9 9v11l3-3 3 3 3-3 3 3 3-3 3 3V11a9 9 0 0 0-9-9zM9 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm6 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4z",
};

@Injectable({
  providedIn: 'root'
})
export class SkillTreeService {
  nodes = signal<SkillNode[]>([]);
  skillPoints = signal<number>(0);
  
  totalStats = computed(() => {
    const stats = {
      phys: 10,
      tech: 10,
      psyche: 10,
      hpMax: BALANCE.PLAYER.BASE_HP,
      damage: 0,
      speed: 0,
      cdr: 0,
      armorPen: 0,
    };

    this.nodes().filter(n => n.allocated).forEach(n => {
      if (n.stats['phys']) stats.phys += n.stats['phys'];
      if (n.stats['tech']) stats.tech += n.stats['tech'];
      if (n.stats['psy']) stats.psyche += n.stats['psy'];
      
      // Direct stats
      if (n.stats['hp']) stats.hpMax += n.stats['hp'];
      if (n.stats['dmg']) stats.damage += n.stats['dmg'];
      if (n.stats['spd']) stats.speed += n.stats['spd'];
      if (n.stats['cdr']) stats.cdr += n.stats['cdr'];
      if (n.stats['armorPen']) stats.armorPen += n.stats['armorPen'];
    });

    // Attribute Scaling
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
    
    this.nodes.update(nodes => nodes.map(n => 
      n.id === nodeId ? { ...n, allocated: true } : n
    ));

    this.updateAvailability();
  }

  private updateAvailability() {
    this.nodes.update(nodes => {
      const allocatedIds = new Set(nodes.filter(n => n.allocated).map(n => n.id));
      
      return nodes.map(node => {
        if (node.type === 'CORE') return { ...node, available: !node.allocated };
        
        // A node is available if any node connected TO it is allocated
        // In this bi-directional logical model, we check if any neighbor is allocated
        const isNeighborAllocated = node.connections.some(connId => allocatedIds.has(connId)) || 
                                    nodes.some(n => n.connections.includes(node.id) && n.allocated);

        return { ...node, available: isNeighborAllocated && !node.allocated };
      });
    });
  }

  private generateTree() {
    const nodes: SkillNode[] = [];
    
    // Helper to add nodes
    const add = (id: string, x: number, y: number, name: string, type: NodeType, branch: BranchType, iconPath: string, stats: any, connections: string[] = [], desc: string = '', lore: string = '') => {
        nodes.push({
            id, x, y, name, type, branch, iconPath, stats, connections, description: desc, lore, allocated: false, available: false
        });
    };

    // --- ROOT ---
    add('root', 0, 0, 'Cortex Interface', 'CORE', 'NEUTRAL', ICONS.BRAIN, { hp: 20 }, [], 'Base neural link established.', 'The seat of consciousness.');
    nodes[0].allocated = true; // Start unlocked

    // --- BRANCH 1: VANGUARD (Phys/Tank/Dmg) - Top Left (225 deg) ---
    // The Brawler path
    add('v_1', -80, -80, 'Hardened Skin', 'MINOR', 'VANGUARD', ICONS.SHIELD, { phys: 5, hp: 20 }, ['root'], '+5 Phys, +20 HP');
    add('v_2', -160, -160, 'Muscle Fiber', 'MINOR', 'VANGUARD', ICONS.MUSCLE, { dmg: 5 }, ['v_1'], '+5 Damage');
    add('v_3', -240, -120, 'Impact Plates', 'MAJOR', 'VANGUARD', ICONS.ARMOR, { armorPen: 5, hp: 50 }, ['v_2'], '+5 Armor Pen, +50 HP', 'Subdermal plating designed for riot control.');
    add('v_4', -240, -200, 'Violent Force', 'MAJOR', 'VANGUARD', ICONS.SWORD, { dmg: 15 }, ['v_2'], '+15 Damage', 'Hydraulic limiters removed.');
    add('v_key', -350, -160, 'TITAN FRAME', 'KEYSTONE', 'VANGUARD', ICONS.CUBE, { phys: 20, hp: 200 }, ['v_3', 'v_4'], '+20 Phys, +200 HP', 'Embrace the physical. Become the "Real." Enforce the separation through overwhelming force.');

    // --- BRANCH 2: GHOST (Tech/Speed/Crit) - Top Right (315 deg) ---
    // The Speedster path
    add('g_1', 80, -80, 'Servo Motor', 'MINOR', 'GHOST', ICONS.BOLT, { tech: 5, spd: 0.2 }, ['root'], '+5 Tech, +2 Speed');
    add('g_2', 160, -160, 'Optic Camo', 'MINOR', 'GHOST', ICONS.EYE, { crit: 5 }, ['g_1'], '+5% Crit Chance');
    add('g_3', 240, -120, 'Mono-Edge', 'MAJOR', 'GHOST', ICONS.KNIFE, { dmg: 10, crit: 5 }, ['g_2'], '+10 Dmg, +5% Crit', 'Molecularly sharpened blades.');
    add('g_4', 240, -200, 'Overclock', 'MAJOR', 'GHOST', ICONS.FAST, { spd: 0.5, tech: 10 }, ['g_2'], '+0.5 Speed, +10 Tech', 'Running hot, moving fast.');
    add('g_key', 350, -160, 'PHANTOM PROTOCOL', 'KEYSTONE', 'GHOST', ICONS.GHOST, { crit: 15, armorPen: 15 }, ['g_3', 'g_4'], '+15% Crit, +15 Armor Pen', 'Become the "Abstract." A ghost in the machine, manipulating the system from within.');

    // --- BRANCH 3: PSION (Psi/CDR/Utility) - Bottom (90 deg) ---
    // The Caster path
    add('p_1', 0, 100, 'Synapse Expansion', 'MINOR', 'PSION', ICONS.ORB, { psy: 5, cdr: 2 }, ['root'], '+5 Psy, +2% CDR');
    add('p_2', 0, 200, 'Mind Over Matter', 'MINOR', 'PSION', ICONS.MEDITATE, { cdr: 5 }, ['p_1'], '+5% CDR');
    add('p_3', -80, 280, 'Energy Siphon', 'MAJOR', 'PSION', ICONS.BATTERY, { ls: 2, psy: 10 }, ['p_2'], '+2% Lifesteal, +10 Psy', 'Feed on their fear.');
    add('p_4', 80, 280, 'Temporal Shift', 'MAJOR', 'PSION', ICONS.HOURGLASS, { cdr: 10, spd: 0.2 }, ['p_2'], '+10% CDR, +0.2 Speed', 'Reality bends to your will.');
    add('p_key', 0, 380, 'ASCENDANCE', 'KEYSTONE', 'PSION', ICONS.STAR, { psy: 30, cdr: 15 }, ['p_3', 'p_4'], '+30 Psy, +15% CDR', 'Achieve lawful integration of Void and Vacancy. Become the Post-Human.');

    // --- CROSS CONNECTIONS (Hybrids) ---
    // Hybrid nodes that require deep investment in adjacent trees
    add('h_vg', 0, -250, 'Executioner', 'MAJOR', 'NEUTRAL', ICONS.SKULL, { dmg: 25, crit: 10 }, ['v_4', 'g_4'], '+25 Dmg, +10% Crit', 'Precision meets brute force.');

    this.nodes.set(nodes);
    this.updateAvailability();
  }

  getSaveData() {
    return {
        skillPoints: this.skillPoints(),
        allocated: this.nodes().filter(n => n.allocated).map(n => n.id)
    };
  }

  loadSaveData(data: any) {
    if (typeof data.skillPoints === 'number') this.skillPoints.set(data.skillPoints);
    if (Array.isArray(data.allocated)) {
        const allocatedSet = new Set(data.allocated);
        this.nodes.update(nodes => nodes.map(n => ({
            ...n,
            allocated: allocatedSet.has(n.id)
        })));
    }
    this.updateAvailability();
  }

  reset() {
      this.skillPoints.set(0);
      this.generateTree();
  }
}