
import { Entity } from '../../models/game.models';
import { WorldService } from '../../game/world/world.service';
import { CombatService } from '../../systems/combat.service';
import { SpatialHashService } from '../../systems/spatial-hash.service';
import { SquadAiService } from '../../systems/squad-ai.service';
import { NavigationService } from '../navigation.service';
import { EntityPoolService } from '../../services/entity-pool.service';
import { SoundService } from '../../services/sound.service';

export interface AIContext {
  world: WorldService;
  combat: CombatService;
  spatialHash: SpatialHashService;
  squadAi: SquadAiService;
  navigation: NavigationService;
  entityPool: EntityPoolService;
  sound: SoundService;
}

export interface AIStrategy {
  execute(enemy: Entity, player: Entity, context: AIContext): void;
}
