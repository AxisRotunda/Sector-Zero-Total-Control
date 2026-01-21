
import { ZoneTemplate } from "../../../models/zone.models";
import { WorldService } from "../world.service";

export enum ZoneTransitionState {
  IDLE = 'IDLE',
  SAVING_CURRENT = 'SAVING_CURRENT',
  LOADING_NEW = 'LOADING_NEW',
  INITIALIZING_ENTITIES = 'INITIALIZING_ENTITIES',
  SPAWNING_PLAYER = 'SPAWNING_PLAYER',
  DISCOVERY_CHECK = 'DISCOVERY_CHECK',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface ZoneLoadingContext {
  previousZoneId?: string;
  template: ZoneTemplate;
}

export interface ZoneLoadStrategy {
  load(world: WorldService, context: ZoneLoadingContext): Promise<void>;
}
