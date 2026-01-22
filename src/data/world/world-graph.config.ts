
import { WorldGraph } from "../../models/zone.models";
import { HUB_ZONE } from "../zones/hub.zone";
import { HUB_TRAINING_ZONE } from "../zones/hub_training.zone";
import { SECTOR_9_N_ZONE } from "../zones/sector-9-segments/sector-9-north.zone";
import { SECTOR_9_S_ZONE } from "../zones/sector-9-segments/sector-9-south.zone";
import { SECTOR_9_E_ZONE } from "../zones/sector-9-segments/sector-9-east.zone";
import { SECTOR_9_W_ZONE } from "../zones/sector-9-segments/sector-9-west.zone";
import { SECTOR_8_ZONE } from "../zones/sector-templates";

export const WORLD_GRAPH: WorldGraph = {
  rootZoneId: 'HUB',
  zones: {
    'HUB': {
      id: 'HUB',
      displayName: 'Safe Haven',
      template: HUB_ZONE,
      persistence: 'persistent',
      childZoneIds: ['SECTOR_9_N', 'HUB_TRAINING']
    },
    'HUB_TRAINING': {
        id: 'HUB_TRAINING',
        displayName: 'Sim Chamber',
        template: HUB_TRAINING_ZONE,
        persistence: 'persistent', // Keep it persistent to maintain state if re-entered
        parentZoneId: 'HUB'
    },
    'SECTOR_9_N': {
      id: 'SECTOR_9_N',
      displayName: 'Sector 9: North',
      template: SECTOR_9_N_ZONE,
      persistence: 'persistent',
      parentZoneId: 'HUB',
      childZoneIds: ['SECTOR_9_E', 'SECTOR_9_W', 'SECTOR_9_S']
    },
    'SECTOR_9_E': {
      id: 'SECTOR_9_E',
      displayName: 'Sector 9: East',
      template: SECTOR_9_E_ZONE,
      persistence: 'persistent',
      parentZoneId: 'SECTOR_9_N' 
    },
    'SECTOR_9_W': {
      id: 'SECTOR_9_W',
      displayName: 'Sector 9: West',
      template: SECTOR_9_W_ZONE,
      persistence: 'persistent',
      parentZoneId: 'SECTOR_9_N'
    },
    'SECTOR_9_S': {
      id: 'SECTOR_9_S',
      displayName: 'Sector 9: South',
      template: SECTOR_9_S_ZONE,
      persistence: 'persistent',
      parentZoneId: 'SECTOR_9_N',
      childZoneIds: ['SECTOR_8']
    },
    'SECTOR_8': {
      id: 'SECTOR_8', 
      displayName: 'The Arteries', 
      template: SECTOR_8_ZONE,
      persistence: 'instanced',
      parentZoneId: 'SECTOR_9_S'
    }
  }
};
