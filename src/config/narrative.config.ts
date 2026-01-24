
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
        description: 'The last Federal Safe Zone on the surface crust. Elevated above the ash layer, it is strictly controlled by the Vanguard Remnant.',
        dangerLevel: 'SAFE',
        factionControl: 'VANGUARD'
    },
    'HUB_TRAINING': {
        id: 'HUB_TRAINING',
        name: 'Neural Simulation Chamber',
        description: 'A white-box reality construct for combat protocol testing. Located within the Citadel sub-levels.',
        dangerLevel: 'SAFE',
        factionControl: 'VANGUARD'
    },
    'SECTOR_9': {
        id: 'SECTOR_9',
        name: 'The Rust Sprawl',
        description: 'The industrial wasteland immediately South of the Citadel. Refugees crowd the gates, fleeing the spreading corruption.',
        dangerLevel: 'LOW',
        factionControl: 'CONTESTED'
    },
    'SECTOR_9_N': {
        id: 'SECTOR_9_N',
        name: 'Sector 9: North Approach',
        description: 'The primary checkpoint leading up to the Citadel Gates. Littered with debris from the first riots.',
        dangerLevel: 'LOW',
        factionControl: 'VANGUARD'
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
    'DUMMY': {
        id: 'DUMMY', name: 'Training Construct', type: 'OBJECT',
        description: 'A hardened data-block used for ballistics testing. It registers pain but does not scream.',
        stats: { hp: 'Infinite', threat: 'LOW' }
    },
    'GRUNT': {
        id: 'GRUNT', name: 'Security Enforcer', type: 'ENEMY',
        description: 'Standard-issue corporate security. Mass-produced bio-shells with limited cognition.',
        tactics: 'Dangerous only in swarms. Flanking protocols engaged.',
        stats: { hp: 'Low', threat: 'LOW' }
    },
    'STALKER': {
        id: 'STALKER', name: 'Phase Skulker', type: 'ENEMY',
        description: 'Modified with illegal optical camouflage. Likely Convergence defectors who lost their minds to the Void.',
        tactics: 'Uses hit-and-run attacks. Keep distance or stun them.',
        stats: { hp: 'Med', threat: 'MEDIUM' }
    },
    'SNIPER': {
        id: 'SNIPER', name: 'Vanguard Marksman', type: 'ENEMY',
        description: 'Elite units equipped with high-velocity railguns. They never miss, they only choose when to fire.',
        tactics: 'Watch for the targeting laser. Close the gap immediately.',
        stats: { hp: 'Low', threat: 'HIGH' }
    },
    'HEAVY': {
        id: 'HEAVY', name: 'Siege Automaton', type: 'ENEMY',
        description: 'A walking wall of plasteel. Originally designed for riot control, now repurposed for total war.',
        tactics: 'Armored plating reduces kinetic damage. Use Armor Penetration or Psionics.',
        stats: { hp: 'Very High', threat: 'HIGH' }
    },
    'STEALTH': {
        id: 'STEALTH', name: 'Assassin', type: 'ENEMY',
        description: 'Cybernetic killers used for corporate espionage. Their existence is officially denied.',
        tactics: 'Completely invisible until they strike. Listen for the hum.',
        stats: { hp: 'Med', threat: 'HIGH' }
    },
    'BOSS': {
        id: 'BOSS', name: 'Sector Apex', type: 'ENEMY',
        description: 'A localized singularity. A being that has absorbed too much Void energy to remain fully in our reality.',
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
    id: 'LOG_ARRIVAL_CONTEXT',
    title: 'NOTICE: SURFACE LOCKDOWN',
    author: 'Vanguard Command',
    timestamp: 'CURRENT',
    content: [
      '>> URGENT: TRANSIT AUTHORITY SUSPENDED.',
      'The Ash Storms on the surface have reached critical density. Maglev Line 4 (The one you just arrived on) is now the ONLY functional link to the Core Systems.',
      'Do not attempt to leave the Citadel on foot. You will freeze, or the static will boil your brain.',
      'Your only path is DOWN. The anomaly at Sector 0 must be resolved to stabilize the local reality field.'
    ],
    category: 'HISTORY',
    faction: 'VANGUARD'
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
  },
  {
    id: 'LOG_RUMOR_HARBINGER',
    title: 'The Visitor in Orbit',
    author: 'Observatory Node 9',
    timestamp: 'REDACTED',
    content: [
      'They say it paused. Just for forty seconds. A shadow cast over the moon.',
      'Then the broadcasts started. Not audio. Pure data. It rewrote the banking algorithms first. Value became zero overnight.',
      'It is still up there. Watching us starve.'
    ],
    category: 'HISTORY',
    faction: 'RESONANT'
  },
  {
    id: 'LOG_RUMOR_CORE',
    title: 'The Singing Pit',
    author: 'Miner 449',
    timestamp: 'CYCLE 88',
    content: [
      'Down in Sector 5, near the heat shields... you can hear it. It sounds like a choir.',
      'But the voices are all the same person. And they are screaming in perfect harmony.',
      'The Vanguard says it is just vent pressure. But vents do not beg for mercy.'
    ],
    category: 'PERSONAL'
  }
];

export const DIALOGUES: Record<string, DialogueNode> = {
    // --- MAGLEV INTERIOR ---
    'maglev_pilot': {
      id: 'maglev_pilot',
      speaker: 'Pilot Kovac',
      factionId: 'VANGUARD',
      mood: 'NEUTRAL',
      text: "Route locked to Undercity. Directorate orders. Nothing I can do about it.",
      options: [
        { text: "When's the next departure?", nextId: 'maglev_schedule' },
        { text: "Can you override the lock?", nextId: 'maglev_locked' },
        { text: "Never mind.", nextId: undefined }
      ]
    },
    'maglev_schedule': {
      id: 'maglev_schedule',
      speaker: 'Pilot Kovac',
      factionId: 'VANGUARD',
      text: "Every 6 hours. Next run is 0400. If you're not cleared by then, don't bother showing up.",
      options: [{ text: "Understood.", nextId: undefined }]
    },
    'maglev_locked': {
      id: 'maglev_locked',
      speaker: 'Pilot Kovac',
      factionId: 'VANGUARD',
      mood: 'ANGRY',
      text: "You think I want to stay stuck here? Override codes are at Command. Good luck with that.",
      options: [{ text: "Thanks for nothing.", nextId: undefined }]
    },
    
    'passenger_anxious': {
      id: 'passenger_anxious',
      speaker: 'Refugee',
      text: "They say Sector 9 is flooding again. I just want to get to the surface levels...",
      options: [
        { text: "What happened in Sector 9?", nextId: 'passenger_sector9' },
        { text: "Stay calm.", nextId: undefined }
      ]
    },
    'passenger_sector9': {
      id: 'passenger_sector9',
      speaker: 'Refugee',
      mood: 'AFRAID',
      text: "Containment breach. That's all they told us. Just 'evacuate immediately.' No explanation.",
      options: [{ text: "...", nextId: undefined }]
    },
    
    'cargo_guard': {
      id: 'cargo_guard',
      speaker: 'Vanguard Guard',
      factionId: 'VANGUARD',
      text: "Manifest check. State your clearance level.",
      options: [
        { text: "Just looking around.", nextId: 'cargo_suspicious' },
        { text: "I'm with the Handler's unit.", nextId: 'cargo_clearance' }, // Could add reqs later
        { text: "Leave.", nextId: undefined }
      ]
    },
    'cargo_suspicious': {
      id: 'cargo_suspicious',
      speaker: 'Vanguard Guard',
      mood: 'ANGRY',
      text: "Then look somewhere else. This area is restricted.",
      options: [{ text: "Fine.", nextId: undefined }]
    },
    'cargo_clearance': {
      id: 'cargo_clearance',
      speaker: 'Vanguard Guard',
      text: "...Verified. Don't touch anything without authorization.",
      options: [{ text: "Understood.", nextId: undefined }]
    },

    // --- VANGUARD HANDLER ---
    'handler_hub_main': { 
        id: 'handler_hub_main', speaker: 'Overseer-9', factionId: 'VANGUARD', mood: 'DIGITAL',
        text: "Transport log confirmed. You made good time across the Ash Wastes, 7421. Welcome to the Citadel. It's the only warm place left on the surface.", 
        options: [
            { text: "Status Report.", nextId: 'handler_status', style: 'TECH' }, 
            { text: "Why are we locked in?", nextId: 'handler_lore_surface' },
            { text: "I am ready to descend.", nextId: 'handler_mission_start', style: 'AGGRESSIVE' }
        ] 
    },
    'handler_status': { 
        id: 'handler_status', speaker: 'Overseer-9', factionId: 'VANGUARD',
        text: "The Quarantine is holding, barely. Anomalous fusions detected in Sector 9. Refugees are crowding the South Gate, creating a tactical liability.", 
        options: [{ text: "Directives?", nextId: 'handler_mission_start' }] 
    },
    'handler_lore_surface': {
        id: 'handler_lore_surface', speaker: 'Overseer-9', factionId: 'VANGUARD',
        text: "The storms outside are metaphysical, not just meteorological. The reality field is dissolving. This Citadel is an anchor. But the rot comes from below, from Sector 0.",
        options: [
            { text: "Understood. Order prevails.", nextId: 'handler_hub_main', actions: [{ type: 'ADD_REP', target: 'VANGUARD', value: 2 }] },
            { text: "We are trapped.", nextId: 'handler_hub_main', actions: [{ type: 'ADD_REP', target: 'VANGUARD', value: -1 }] }
        ]
    },
    'handler_mission_start': { 
        id: 'handler_mission_start', speaker: 'Overseer-9', factionId: 'VANGUARD',
        text: "Aggression is a virtue. Proceed South to the Sector 9 Access Gate. Terminate resistance. Do not hesitate.", 
        options: [{ 
            text: "Moving out.", 
            nextId: undefined,
            actions: [
                { type: 'COMPLETE_MISSION', target: 'MQ_01_ARRIVAL' },
                { type: 'START_MISSION', target: 'MQ_02_DESCEND' }
            ]
        }] 
    },

    // --- TERMINAL LOGS ---
    'terminal_arrival_log': {
        id: 'terminal_arrival_log', speaker: 'SYSTEM', factionId: 'VANGUARD', mood: 'DIGITAL',
        text: ">> TRANSIT LOG 449-B\n>> ORIGIN: FEDERATION CORE\n>> DEST: SECTOR ZERO CITADEL\n>> CARGO: 1x CLASS-4 OPERATIVE (UNIT 7421)\n>> STATUS: ARRIVED. MAGLEV LINE SEALED DUE TO STORM.",
        options: [
            { 
                text: "Download Lockdown Info.", 
                nextId: undefined, 
                actions: [{ type: 'UNLOCK_LORE', target: 'LOG_ARRIVAL_CONTEXT' }] 
            },
            { text: "Exit.", nextId: undefined }
        ]
    },
    'maglev_nav_system': {
        id: 'maglev_nav_system', speaker: 'NAV-COM', factionId: 'VANGUARD', mood: 'DIGITAL',
        text: ">> ROUTE LOCKED: CITADEL -> UNDERCITY -> [REDACTED]\n>> WARNING: SECTOR 9 SIGNAL LOST.\n>> STATUS: HOLDING PATTERN.",
        options: [{ text: "Log off.", nextId: undefined }]
    },

    // --- ARRIVAL GUARD ---
    'arrival_guard': { 
        id: 'arrival_guard', speaker: 'Transit Guard', factionId: 'VANGUARD',
        text: "Step away from the platform, Operative. The wind out there will freeze your lungs in seconds. Get inside the dome.", 
        options: [{ text: "Acknowledged.", nextId: undefined }] 
    },

    // --- FIELD MEDIC (REMNANT LEANING) ---
    'medic_hub_main': { 
        id: 'medic_hub_main', speaker: 'Doc Voss', factionId: 'REMNANT', mood: 'NEUTRAL',
        text: "You look like chewed meat, kid. The Vanguard won't fix what they can replace. But I'm feeling generous today.", 
        options: [
            { text: "Patch me up. (Full Heal)", nextId: undefined, actions: [{ type: 'HEAL' }, { type: 'ADD_CREDITS', value: -10 }], reqs: [{ type: 'CREDITS', target: 'SELF', value: 10 }] },
            { text: "What's the news from below?", nextId: 'medic_rumors' },
            { text: "Who are you?", nextId: 'medic_lore_bio' },
            { text: "Just looking.", nextId: undefined }
        ] 
    },
    'medic_lore_bio': {
        id: 'medic_lore_bio', speaker: 'Doc Voss', factionId: 'REMNANT',
        text: "I used to write laws for the Old Government. Now I sew limbs back onto scavengers. It's honest work. More honest than politics, anyway.",
        options: [{ text: "Back to business.", nextId: 'medic_hub_main' }]
    },
    'medic_rumors': {
        id: 'medic_rumors', speaker: 'Doc Voss', factionId: 'REMNANT', mood: 'NEUTRAL',
        text: "Word is, the Convergence isn't just a cult. They're finding ways to live *in* the static. Actually merging with the signal. Sounds peaceful... or horrifying.",
        options: [
            { text: "Sounds like giving up.", nextId: 'medic_hub_main', actions: [{ type: 'ADD_REP', target: 'VANGUARD', value: 1 }] },
            { text: "Maybe they're right.", nextId: 'medic_hub_main', actions: [{ type: 'ADD_REP', target: 'REMNANT', value: 2 }] },
            { text: "[DATA] Any technical details?", nextId: 'medic_give_log', style: 'TECH', reqs: [{ type: 'STAT', target: 'tech', value: 5 }] }
        ]
    },
    'medic_give_log': {
        id: 'medic_give_log', speaker: 'Doc Voss', factionId: 'REMNANT',
        text: "You're a curious one. Here. Pulled this off a dead miner who was raving about 'The Singing Pit'. Maybe you can make sense of it.",
        options: [{ 
            text: "Take Data Log.", 
            nextId: 'medic_hub_main',
            actions: [{ type: 'UNLOCK_LORE', target: 'LOG_RUMOR_CORE' }]
        }]
    },

    // --- GATEKEEPER ---
    'gate_locked': { 
        id: 'gate_locked', speaker: 'Gatekeeper', factionId: 'VANGUARD', mood: 'ANGRY',
        text: "Halt. PROXY-level lockdown in effect. No passage to the lower sectors without clearance. The Directorate has sealed the zone.", 
        options: [
            { 
                text: "[OVERRIDE] I have authorization.", 
                nextId: 'gate_open_action', 
                style: 'TECH',
                actions: [{ type: 'SET_FLAG', target: 'GATE_OPEN', value: true }],
                reqs: [{ type: 'STAT', target: 'psyche', value: 5 }] 
            }, 
            { text: "Why the lockdown?", nextId: 'gate_lore' },
            { text: "Backing off.", nextId: undefined }
        ] 
    },
    'gate_lore': {
        id: 'gate_lore', speaker: 'Gatekeeper', factionId: 'VANGUARD',
        text: "It's not just refugees anymore. Something came up from Sector 8. Something that looked like us, but wasn't. Now move along, citizen.",
        options: [{ text: "Understood.", nextId: 'gate_locked' }]
    },
    'gate_open_action': { 
        id: 'gate_open_action', speaker: 'Gatekeeper', factionId: 'VANGUARD',
        text: "Clearance code... Valid. Disengaging locks. Be advised: We cannot guarantee extraction if you go past Sector 9.", 
        options: [{ text: "Proceeding.", nextId: undefined }] 
    },
    'gate_unlocked': { 
        id: 'gate_unlocked', speaker: 'Gatekeeper', factionId: 'VANGUARD',
        text: "Gate is open. Watch your six. The shadows move when you're not looking.", 
        options: [{ text: "Understood.", nextId: undefined }] 
    },

    // --- GENERIC CITIZENS (GOSSIP SYSTEM) ---
    'citizen_gossip_hub': {
        id: 'citizen_gossip_hub', speaker: 'Citizen',
        text: "Did you feel it? The ground shook. Not an earthquake... it felt like the world skipped a beat.",
        options: [
            { text: "I felt it.", nextId: 'citizen_gossip_2' },
            { text: "Ignore them.", nextId: undefined }
        ]
    },
    'citizen_gossip_2': {
        id: 'citizen_gossip_2', speaker: 'Citizen', mood: 'AFRAID',
        text: "They say 'He' is back. The Harbinger. Orbiting. Watching us starve. If the Vanguard can't stop him, who can?",
        options: [
            { text: "We save ourselves.", nextId: undefined, actions: [{ type: 'ADD_REP', target: 'RESONANT', value: 1 }] },
            { text: "Trust the System.", nextId: undefined, actions: [{ type: 'ADD_REP', target: 'VANGUARD', value: 1 }] }
        ]
    },
    'passenger_gossip': {
        id: 'passenger_gossip', speaker: 'Passenger',
        text: "I heard the food synthesizers in Sector 8 are failing. People are eating the bio-mass... I'd rather starve.",
        options: [{ text: "Grim times.", nextId: undefined }]
    },

    // --- TERMINALS & OBJECTS ---
    'directorate_public': {
        id: 'directorate_public',
        speaker: 'The Directorate',
        factionId: 'VANGUARD',
        mood: 'DIGITAL',
        text: '>> GOVERNMENT PUBLIC ADDRESS\n>> CITIZENS: The "Vanguard" is your shield. We are the architects of the new epoch.\n>> Rumors of "The Shadow" are dissolutionist propaganda.',
        options: [
            { text: 'Who is the Director?', nextId: 'directorate_info', style: 'TECH' },
            { text: 'Log out.', nextId: undefined }
        ]
    },
    'directorate_info': {
        id: 'directorate_info',
        speaker: 'The Directorate',
        mood: 'NEUTRAL',
        text: '>> ACCESS DENIED. CLEARANCE LEVEL: OMEGA.\n>> NOTE: Authority is derived from Structural Integrity. We hold the walls up. Therefore, we rule.',
        options: [{ text: 'Understood.', nextId: undefined }]
    },
    'monolith_intro': {
        id: 'monolith_intro',
        speaker: 'THE PRISM',
        mood: 'GLITCHED',
        text: '>> ...signal detected. Not 7421. Not Vanguard.\n>> You are looking through the glass. You are the [OBSERVER].\n>> The Vanguard built these walls to hide the delay. Do you see it? The lag between the shadow and the object?',
        options: [
            { 
                text: '[TOUCH] Who are you?', 
                nextId: 'monolith_lore', 
                style: 'TECH',
            },
            { 
                text: '[SYNC] Stabilize the signal.', 
                nextId: 'monolith_sync', 
                style: 'TECH',
                actions: [
                    { type: 'ADD_REP', target: 'VANGUARD', value: 2 },
                    { type: 'SET_FLAG', target: 'ANCHOR_SYNCED', value: true }
                ] 
            },
            { text: '[DISENGAGE] Too loud.', nextId: undefined }
        ]
    },
    'monolith_lore': {
        id: 'monolith_lore',
        speaker: 'THE PRISM',
        mood: 'DIGITAL',
        text: '>> I am the Anchor. They think they built me to hold the System together.\n>> But I was here before the code. Before the "Absque Habitatore" collapsed.\n>> They want me to be a cage. I am a door.',
        options: [{ text: 'Understood.', nextId: 'monolith_sync' }]
    },
    'monolith_sync': {
        id: 'monolith_sync',
        speaker: 'THE PRISM',
        mood: 'NEUTRAL',
        text: '>> CONNECTION ESTABLISHED. \n>> Your perspective stabilizes the waveform, Observer.\n>> Proceed. The Inversion awaits.',
        options: [{ text: 'Disengage.', nextId: undefined }]
    },

    // --- EXPANDED TRAINING & ARMORY ---
    'training_terminal': {
        id: 'training_terminal', speaker: 'SYSTEM', factionId: 'VANGUARD', mood: 'DIGITAL',
        text: '>> NEURAL SIMULATION CHAMBER v5.0\n>> WELCOME, OPERATIVE.\n>> SELECT MODULE:',
        options: [
          { text: '[ARMORY]', nextId: 'training_armory' },
          { text: '[COMBAT TRIALS]', nextId: 'training_combat' },
          { text: '[RESET ROOM]', nextId: 'reset_confirm', style: 'AGGRESSIVE', reqs: [{ type: 'FLAG', target: 'TRAINING_ACTIVE', value: true }] },
          { text: '[EXIT]', nextId: undefined }
        ]
    },
    'training_armory': {
        id: 'training_armory', speaker: 'SYSTEM', mood: 'DIGITAL',
        text: '>> VANGUARD ARMORY DATABASE ACCESSED.\n>> SELECT WEAPON PATTERN FOR MATERIALIZATION:',
        options: [
            { text: '[KINETIC] Standard Rifle', nextId: 'training_armory', actions: [{type: 'GIVE_ITEM', target: 'TEST_KINETIC'}] },
            { text: '[PLASMA] Thermal Caster', nextId: 'training_armory', actions: [{type: 'GIVE_ITEM', target: 'TEST_PLASMA'}] },
            { text: '[CRYO] Zero Emitter', nextId: 'training_armory', actions: [{type: 'GIVE_ITEM', target: 'TEST_CRYO'}] },
            { text: '[VOID] Chaos Blade', nextId: 'training_armory', actions: [{type: 'GIVE_ITEM', target: 'TEST_VOID'}] },
            { text: '<< BACK', nextId: 'training_terminal' }
        ]
    },
    'training_combat': {
        id: 'training_combat', speaker: 'SYSTEM', mood: 'DIGITAL',
        text: '>> SELECT THREAT PROFILE:',
        options: [
            { text: '[TARGET DUMMY] (No Threat)', nextId: 'training_combat', actions: [{type: 'SET_FLAG', target: 'TRAINING_SPAWN_DUMMY', value: true}, {type: 'SET_FLAG', target: 'TRAINING_ACTIVE', value: true}] },
            { text: '[GRUNT WAVE] (Swarm)', nextId: 'training_combat', actions: [{type: 'SET_FLAG', target: 'TRAINING_SPAWN_GRUNT', value: true}, {type: 'SET_FLAG', target: 'TRAINING_ACTIVE', value: true}] },
            { text: '[HEAVY UNIT] (Armor Test)', nextId: 'training_combat', actions: [{type: 'SET_FLAG', target: 'TRAINING_SPAWN_HEAVY', value: true}, {type: 'SET_FLAG', target: 'TRAINING_ACTIVE', value: true}] },
            { text: '<< BACK', nextId: 'training_terminal' }
        ]
    },
    'reset_confirm': { id: 'reset_confirm', speaker: 'SYSTEM', mood: 'DIGITAL', text: '>> WARNING: RESETTING WILL PURGE ACTIVE ENTITIES\n>> CONFIRM ACTION?', options: [{ text: '[CONFIRM RESET]', nextId: 'training_terminal', actions: [{ type: 'SET_FLAG', target: 'TRAINING_ACTIVE', value: false }, { type: 'SET_FLAG', target: 'RESET_ZONE_ENTITIES', value: true }] }, { text: '[CANCEL]', nextId: 'training_terminal' }] },

    'generic': { id: 'generic', speaker: 'Unknown', text: "...", options: [{ text: "Leave", nextId: undefined }] },
    
    // NPC BARKS
    'prisoner_bark': { id: 'prisoner_bark', speaker: 'Detained Citizen', factionId: 'REMNANT', mood: 'AFRAID', text: "I didn't do anything! I just had a high bio-reading! Please, tell them I'm clean!", options: [{ text: "Not my problem.", nextId: undefined }] },
    'refugee_context': { id: 'refugee_context', speaker: 'Displaced Citizen', text: "We came from Sector 9... the ash storms got too bad. Then the machines... they just stopped recognizing us as human.", options: [{ text: 'Stay safe.', nextId: undefined }] },
    'citizen_bark': { id: 'citizen_bark', speaker: 'Refugee', text: "We've been waiting for processing for three days... water rations are gone.", options: [{ text: "Move along.", nextId: undefined }] },
    'generic_guard': { id: 'generic_guard', speaker: 'Vanguard Unit', factionId: 'VANGUARD', text: "Move along, Operative. Perimeter is secure.", options: [{ text: "Acknowledged.", nextId: undefined }] }
};
