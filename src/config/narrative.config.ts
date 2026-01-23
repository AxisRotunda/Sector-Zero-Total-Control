
import { Faction, DataLog, EntityLore, DialogueNode, ZoneLore } from '../models/narrative.models';

export const FACTIONS: Record<Faction['id'], Faction> = {
  VANGUARD: {
    id: 'VANGUARD',
    name: 'Vanguard Remnant',
    shortName: 'Vanguard',
    description: 'The iron fist of a dead world. The Vanguard seeks to enforce the separation between human and synthetic, believing this stasis is the only way to preserve what is left of humanity.',
    ideology: 'CONTAINMENT: MAINTAIN THE DELAY INDEFINITELY',
    color: '#06b6d4',
    icon: '▲'
  },
  REMNANT: {
    id: 'REMNANT',
    name: 'Convergence',
    shortName: 'Convergence',
    description: 'A collective of transhumanists who see biology as a cage. They believe the only path forward is to fully embrace the "Eloic Shadow".',
    ideology: 'DISSOLUTION: COLLAPSE INTO THE SHADOW',
    color: '#f97316',
    icon: '◆'
  },
  RESONANT: {
    id: 'RESONANT',
    name: 'Guardians',
    shortName: 'Guardians',
    description: 'A hidden order that believes in a third path: true symbiosis.',
    ideology: 'INTEGRATION: FORGE THE POST-HUMAN',
    color: '#a855f7',
    icon: '◉'
  }
};

export const ZONE_LORE: Record<string, ZoneLore> = {
    'HUB': {
        id: 'HUB',
        name: 'Liminal Citadel',
        description: 'The last bastion of stable reality on the surface crust. A fortress city built by the Vanguard to monitor the Core\'s fluctuations.',
        dangerLevel: 'SAFE',
        factionControl: 'VANGUARD'
    },
    'HUB_TRAINING': {
        id: 'HUB_TRAINING',
        name: 'Neural Simulation Chamber',
        description: 'A white-box reality construct for combat protocol testing.',
        dangerLevel: 'SAFE',
        factionControl: 'VANGUARD'
    },
    'SECTOR_9': {
        id: 'SECTOR_9',
        name: 'The Rust Sprawl',
        description: 'Once a bustling industrial transit zone, now a graveyard of corroded machinery. The ash rain here is unending.',
        dangerLevel: 'LOW',
        factionControl: 'CONTESTED'
    },
    'SECTOR_8': {
        id: 'SECTOR_8',
        name: 'The Arteries',
        description: 'Automated logistics hub. Maglev trains still run on loops, carrying empty containers to nowhere. Navigation is disorienting.',
        dangerLevel: 'LOW',
        factionControl: 'VANGUARD'
    },
    'SECTOR_7': {
        id: 'SECTOR_7',
        name: 'The Hive',
        description: 'High-density residential stacks. The neon lights still flicker, illuminating the ghost town where millions once lived.',
        dangerLevel: 'MEDIUM',
        factionControl: 'REMNANT'
    },
    'SECTOR_6': {
        id: 'SECTOR_6',
        name: 'Green Lung',
        description: 'Hydroponics and air filtration. The flora has mutated, fed by leaking coolant and psionic radiation.',
        dangerLevel: 'MEDIUM',
        factionControl: 'NONE'
    },
    'SECTOR_5': {
        id: 'SECTOR_5',
        name: 'Iron Heart',
        description: 'Geothermal foundry. The heat shields are failing. The floor is literally lava in some sectors.',
        dangerLevel: 'HIGH',
        factionControl: 'VANGUARD'
    },
    'SECTOR_4': {
        id: 'SECTOR_4',
        name: 'Memory Banks',
        description: 'The physical servers hosting the digitized consciousness of the Convergence. Cold, sterile, and silent.',
        dangerLevel: 'HIGH',
        factionControl: 'REMNANT'
    },
    'SECTOR_3': {
        id: 'SECTOR_3',
        name: 'Chimera Labs',
        description: 'Restricted research division. Evidence of biological tampering and forced evolution protocols.',
        dangerLevel: 'EXTREME',
        factionControl: 'NONE'
    },
    'SECTOR_2': {
        id: 'SECTOR_2',
        name: 'The Black Gate',
        description: 'The containment seal for the Core. Physics is merely a suggestion here. Void energy permeates the walls.',
        dangerLevel: 'EXTREME',
        factionControl: 'VANGUARD'
    }
};

export const ENTITY_LORE: Record<string, EntityLore> = {
    'GRUNT': {
        id: 'GRUNT', name: 'Security Enforcer', type: 'ENEMY',
        description: 'Standard-issue corporate security.',
        tactics: 'Dangerous only in swarms. Flanking protocols engaged.',
        stats: { hp: 'Low', threat: 'LOW' }
    },
    'STALKER': {
        id: 'STALKER', name: 'Phase Skulker', type: 'ENEMY',
        description: 'Modified with illegal optical camouflage.',
        tactics: 'Uses hit-and-run attacks. Keep distance or stun them.',
        stats: { hp: 'Med', threat: 'MEDIUM' }
    },
    'SNIPER': {
        id: 'SNIPER', name: 'Vanguard Marksman', type: 'ENEMY',
        description: 'Elite units equipped with high-velocity railguns.',
        tactics: 'Watch for the targeting laser. Close the gap immediately.',
        stats: { hp: 'Low', threat: 'HIGH' }
    },
    'HEAVY': {
        id: 'HEAVY', name: 'Siege Automaton', type: 'ENEMY',
        description: 'A walking wall of plasteel.',
        tactics: 'Armored plating reduces kinetic damage. Use Armor Penetration or Psionics.',
        stats: { hp: 'Very High', threat: 'HIGH' }
    },
    'STEALTH': {
        id: 'STEALTH', name: 'Assassin', type: 'ENEMY',
        description: 'Cybernetic killers used for corporate espionage.',
        tactics: 'Completely invisible until they strike. Listen for the hum.',
        stats: { hp: 'Med', threat: 'HIGH' }
    },
    'BOSS': {
        id: 'BOSS', name: 'Sector Apex', type: 'ENEMY',
        description: 'A localized singularity.',
        tactics: 'Extreme threat level. Prepare all protocols.',
        stats: { hp: 'Extreme', threat: 'EXTREME' }
    },
    'MEDIC': { id: 'MEDIC', name: 'Field Surgeon', type: 'NPC', description: 'A cynical field surgeon operating out of a mobile clinic.' },
    'TRADER': { id: 'TRADER', name: 'Black Market Dealer', type: 'NPC', description: 'Sells anything to anyone.' },
    'HANDLER': { id: 'HANDLER', name: 'Mission Handler', type: 'NPC', description: 'Your voice in the ear.' },
    'CITIZEN': { id: 'CITIZEN', name: 'Sector Civilian', type: 'NPC', description: 'The last dregs of biological humanity.' },
    'ECHO': { id: 'ECHO', name: 'Echo', type: 'NPC', description: 'An emissary of The Convergence.' },
    'CONSOLE': { id: 'CONSOLE', name: 'Data Terminal', type: 'OBJECT', description: 'Access point for the sector-wide intranet.' }
};

export const GUARD_BARKS = [
    "Sector secure.",
    "Watching you, Operative.",
    "Bio-scans clear.",
    "Maintain distance.",
    "Report anomalies.",
    "The Core is stable.",
    "No loitering.",
    "Checking protocols...",
    "Vanguard protects.",
    "Compliance mandatory."
];

export const DATA_LOGS: DataLog[] = [
  {
    id: 'LOG_001_COLLAPSE',
    title: 'The Day the Sky Screamed',
    author: 'Dr. Elena Marsh',
    timestamp: 'DAY -3',
    content: [
      'The psionic reading went off-scale at 0400. We thought it was equipment failure.',
      'By 0600, every neural implant in Sector Zero was broadcasting the same frequency.',
      'By noon, the screaming started. Not from mouths. From minds.'
    ],
    category: 'HISTORY'
  },
  {
    id: 'LOG_TECH_PSI',
    title: 'PSI-SIG Analysis: Revision 4',
    author: 'Vanguard Research Div.',
    timestamp: 'DAY 42',
    content: [
      'The psionic signature (PSI-SIG) is not just a brainwave—it is a localized warping of the kinetic constant.',
      'Overload protocols remain dangerous. Synaptic burnout is a 94% probability if safety limiters are disengaged.'
    ],
    category: 'TECHNICAL',
    faction: 'VANGUARD'
  },
  {
    id: 'LOG_REMNANT_POEM',
    title: 'Ash and Neon',
    author: 'Unknown Scavenger',
    timestamp: 'DAY 112',
    content: [
      'The rain is blue, the sky is black,',
      'The world we knew is not coming back.'
    ],
    category: 'PERSONAL',
    faction: 'REMNANT'
  }
];

export const DIALOGUES: Record<string, DialogueNode> = {
    'training_terminal': {
        id: 'training_terminal',
        speaker: 'SYSTEM',
        factionId: 'VANGUARD',
        mood: 'DIGITAL',
        text: '>> NEURAL SIMULATION CHAMBER v4.12\n>> SELECT COMBAT PROTOCOL',
        options: [
          {
            text: '[TRIAL_01: GRUNT SUPPRESSION]',
            nextId: 'confirm_trial_01'
          },
          {
            text: '[TRIAL_02: STALKER ENGAGEMENT]',
            nextId: 'confirm_trial_02',
            reqs: [{ type: 'FLAG', target: 'TRAINING_LVL1_COMPLETE', value: true }]
          },
          {
            text: '[RESET SIMULATION]',
            nextId: 'reset_confirm',
            reqs: [{ type: 'FLAG', target: 'TRAINING_ACTIVE', value: true }]
          },
          {
            text: '[EXIT]',
            nextId: undefined
          }
        ]
    },
    'confirm_trial_01': {
        id: 'confirm_trial_01', speaker: 'SYSTEM', mood: 'DIGITAL',
        text: '>> INITIALIZING HOSTILE MEMORY ECHOES\n>> 6x GRUNT UNITS LOADING...',
        options: [
          {
            text: '[COMMENCE]',
            nextId: 'in_progress',
            actions: [
              { type: 'SET_FLAG', target: 'TRAINING_LVL1_ACTIVE', value: true },
              { type: 'SET_FLAG', target: 'TRAINING_ACTIVE', value: true }
            ]
          },
          { text: '[ABORT]', nextId: 'training_terminal' }
        ]
    },
    'confirm_trial_02': {
        id: 'confirm_trial_02', speaker: 'SYSTEM', mood: 'DIGITAL',
        text: '>> INITIALIZING ADVANCED PROTOCOLS\n>> 2x STALKER UNITS LOADING...',
        options: [
          {
            text: '[COMMENCE]',
            nextId: 'in_progress',
            actions: [
              { type: 'SET_FLAG', target: 'TRAINING_LVL2_ACTIVE', value: true },
              { type: 'SET_FLAG', target: 'TRAINING_ACTIVE', value: true }
            ]
          },
          { text: '[ABORT]', nextId: 'training_terminal' }
        ]
    },
    'reset_confirm': {
        id: 'reset_confirm', speaker: 'SYSTEM', mood: 'DIGITAL',
        text: '>> WARNING: RESETTING WILL PURGE ACTIVE ENTITIES\n>> CONFIRM ACTION?',
        options: [
          {
            text: '[CONFIRM RESET]',
            nextId: 'training_terminal',
            actions: [
              { type: 'SET_FLAG', target: 'TRAINING_ACTIVE', value: false },
              { type: 'SET_FLAG', target: 'TRAINING_LVL1_ACTIVE', value: false },
              { type: 'SET_FLAG', target: 'TRAINING_LVL2_ACTIVE', value: false },
              { type: 'SET_FLAG', target: 'RESET_ZONE_ENTITIES', value: true } // Custom trigger for ZoneManager
            ]
          },
          { text: '[CANCEL]', nextId: 'training_terminal' }
        ]
    },
    'in_progress': {
        id: 'in_progress', speaker: 'SYSTEM', mood: 'DIGITAL',
        text: '>> SIMULATION RUNNING\n>> TERMINATE ALL HOSTILES TO PROCEED',
        options: [{ text: '[ACKNOWLEDGE]', nextId: undefined }]
    },
    'start_1': { 
        id: 'start_1', speaker: 'Handler', factionId: 'VANGUARD', mood: 'DIGITAL',
        text: "Operative 7421. Bio-signals fluctuating. Re-aligning neural matrix...", 
        options: [
            { text: "Status Report.", nextId: 'start_2', style: 'TECH' }, 
            { text: "I am ready.", nextId: 'start_3', style: 'AGGRESSIVE' }
        ] 
    },
    'start_2': { 
        id: 'start_2', speaker: 'Handler', factionId: 'VANGUARD',
        text: "Anomalous fusions detected in Sector Zero. The quarantine is failing.", 
        options: [{ text: "Directives?", nextId: 'start_3' }] 
    },
    'start_3': { 
        id: 'start_3', speaker: 'Handler', factionId: 'VANGUARD',
        text: "Aggression is a virtue. Secure the gate to Sector 9. Terminate resistance.", 
        options: [{ 
            text: "Moving out.", 
            nextId: undefined,
            // Automatically complete the arrival mission and start the next
            actions: [
                { type: 'COMPLETE_MISSION', target: 'MQ_01_ARRIVAL' },
                { type: 'START_MISSION', target: 'MQ_02_DESCEND' }
            ]
        }] 
    },
    'medic_intro': { 
        id: 'medic_intro', speaker: 'Doc', factionId: 'REMNANT', mood: 'NEUTRAL',
        text: "You look like chewed meat, kid. Need a stitch?", 
        options: [
            { text: "Patch me up. (Full Heal)", nextId: undefined, actions: [{ type: 'HEAL' }, { type: 'ADD_CREDITS', value: -10 }], reqs: [{ type: 'CREDITS', target: 'SELF', value: 10 }] },
            { text: "Just looking.", nextId: undefined }
        ] 
    },
    'gate_locked': { 
        id: 'gate_locked', speaker: 'Gatekeeper', factionId: 'VANGUARD', mood: 'ANGRY',
        text: "Halt. PROXY-level lockdown in effect. No passage to the lower sectors without clearance.", 
        options: [
            { 
                text: "[OVERRIDE] I have authorization.", 
                nextId: 'gate_open_action', 
                style: 'TECH',
                actions: [{ type: 'SET_FLAG', target: 'GATE_OPEN', value: true }],
                reqs: [{ type: 'STAT', target: 'psyche', value: 5 }] 
            }, 
            { text: "Backing off.", nextId: undefined }
        ] 
    },
    'gate_open_action': { 
        id: 'gate_open_action', speaker: 'Gatekeeper', factionId: 'VANGUARD',
        text: "Clearance code... Valid. Disengaging locks.", 
        options: [{ text: "Proceeding.", nextId: undefined }] 
    },
    'gate_unlocked': { 
        id: 'gate_unlocked', speaker: 'Gatekeeper', factionId: 'VANGUARD',
        text: "Gate is open. Watch your six.", 
        options: [{ text: "Understood.", nextId: undefined }] 
    },
    'generic': {
        id: 'generic', speaker: 'Unknown', text: "...", options: [{ text: "Leave", nextId: undefined }]
    },
    'citizen_bark': {
        id: 'citizen_bark', speaker: 'Refugee', text: "We're just trying to survive... leave us be.", 
        options: [{ text: "Move along.", nextId: undefined }]
    },
    'generic_guard': {
        id: 'generic_guard', speaker: 'Vanguard Unit', factionId: 'VANGUARD', text: "Move along, Operative. Perimeter is secure.",
        options: [{ text: "Acknowledged.", nextId: undefined }]
    }
};
