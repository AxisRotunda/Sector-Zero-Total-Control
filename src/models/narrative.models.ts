
export interface Faction {
  id: 'REMNANT' | 'VANGUARD' | 'RESONANT';
  name: string;
  shortName: string;
  description: string;
  ideology: string;
  color: string;
  icon: string;
}

export interface FactionReputation {
  factionId: Faction['id'];
  value: number;
  standing: 'HOSTILE' | 'UNFRIENDLY' | 'NEUTRAL' | 'FRIENDLY' | 'ALLIED';
}

export interface DataLog {
  id: string;
  title: string;
  author?: string;
  timestamp?: string;
  content: string[];
  faction?: Faction['id'];
  category: 'HISTORY' | 'TECHNICAL' | 'PERSONAL' | 'PROPAGANDA';
}

export interface EntityLore {
  id: string;
  name: string;
  type: 'ENEMY' | 'NPC' | 'OBJECT';
  description: string;
  tactics?: string;
  stats?: {
      hp: string;
      threat: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  };
}

export interface ZoneLore {
    id: string;
    name: string;
    description: string;
    dangerLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    factionControl: 'VANGUARD' | 'REMNANT' | 'NONE' | 'CONTESTED';
}

// --- DIALOGUE SYSTEM MODELS ---

export type RequirementType = 'REP' | 'STAT' | 'FLAG' | 'ITEM' | 'CREDITS';
export interface Requirement {
    type: RequirementType;
    target: string; // FactionID, StatName, FlagKey, ItemID
    value: number | string | boolean;
    invert?: boolean; // if true, requirement is NOT met when condition is true
}

export type ActionType = 'GIVE_ITEM' | 'REMOVE_ITEM' | 'ADD_REP' | 'SET_FLAG' | 'START_MISSION' | 'COMPLETE_MISSION' | 'ADD_CREDITS' | 'HEAL' | 'UNLOCK_LORE';
export interface DialogueAction {
    type: ActionType;
    target?: string;
    value?: number | string | boolean;
}

export interface DialogueOption {
    text: string;
    nextId?: string; // If undefined, closes dialogue
    reqs?: Requirement[];
    actions?: DialogueAction[];
    style?: 'DEFAULT' | 'AGGRESSIVE' | 'TECH' | 'SUBMISSIVE' | 'LOCKED';
}

export interface DialogueNode {
    id: string;
    speaker: string;
    text: string;
    options: DialogueOption[];
    factionId?: Faction['id'];
    mood?: 'NEUTRAL' | 'ANGRY' | 'AFRAID' | 'GLITCHED' | 'DIGITAL';
}
