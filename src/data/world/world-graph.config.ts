
import { WorldGraph } from "../../models/zone.models";
import { HUB_ZONE } from "../zones/hub.zone";
import { SECTOR_9_ZONE } from "../zones/sector-9.zone";
import { 
    SECTOR_8_ZONE, SECTOR_7_ZONE, SECTOR_6_ZONE, 
    SECTOR_5_ZONE, SECTOR_4_ZONE, SECTOR_3_ZONE, 
    SECTOR_2_ZONE 
} from "../zones/sector-templates";

export const WORLD_GRAPH: WorldGraph = {
  rootZoneId: 'HUB',
  zones: {
    'HUB': {
      id: 'HUB',
      displayName: 'Safe Haven',
      template: HUB_ZONE,
      adjacentZones: ['SECTOR_9'],
      persistence: 'persistent',
      maxInstances: 1
    },
    'SECTOR_9': {
      id: 'SECTOR_9',
      displayName: 'Sector 9: The Rust Sprawl',
      template: SECTOR_9_ZONE,
      adjacentZones: ['HUB', 'SECTOR_8'],
      persistence: 'persistent',
      maxInstances: 1
    },
    'SECTOR_8': {
      id: 'SECTOR_8', displayName: 'Sector 8: The Arteries', template: SECTOR_8_ZONE,
      adjacentZones: ['SECTOR_9', 'SECTOR_7'], persistence: 'instanced'
    },
    'SECTOR_7': {
      id: 'SECTOR_7', displayName: 'Sector 7: The Hive', template: SECTOR_7_ZONE,
      adjacentZones: ['SECTOR_8', 'SECTOR_6'], persistence: 'instanced'
    },
    'SECTOR_6': {
      id: 'SECTOR_6', displayName: 'Sector 6: Green Lung', template: SECTOR_6_ZONE,
      adjacentZones: ['SECTOR_7', 'SECTOR_5'], persistence: 'instanced'
    },
    'SECTOR_5': {
      id: 'SECTOR_5', displayName: 'Sector 5: Iron Heart', template: SECTOR_5_ZONE,
      adjacentZones: ['SECTOR_6', 'SECTOR_4'], persistence: 'instanced'
    },
    'SECTOR_4': {
      id: 'SECTOR_4', displayName: 'Sector 4: Memory Banks', template: SECTOR_4_ZONE,
      adjacentZones: ['SECTOR_5', 'SECTOR_3'], persistence: 'instanced'
    },
    'SECTOR_3': {
      id: 'SECTOR_3', displayName: 'Sector 3: Chimera Labs', template: SECTOR_3_ZONE,
      adjacentZones: ['SECTOR_4', 'SECTOR_2'], persistence: 'instanced'
    },
    'SECTOR_2': {
      id: 'SECTOR_2', displayName: 'Sector 2: The Black Gate', template: SECTOR_2_ZONE,
      adjacentZones: ['SECTOR_3'], persistence: 'instanced'
    }
  }
};
